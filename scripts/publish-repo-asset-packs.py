#!/usr/bin/env python3
"""Publish tracked data from one pinned Git commit as static-asset packs.

Data plane only: a Cloud Build in europe-west4 as psd-data-builder, tagged plane-data.
  raw         the exact Git tree at --source-sha (immutable, content-addressed)
  staging     one write-once, content-addressed pack object per directory or named file set
  validation  every file's bytes hash to its committed Git blob; pack size, MD5 and
              generation are verified after upload; no URL may belong to another pack
  publish     static-assets/current.json replaced by compare-and-swap on its generation,
              so readers switch atomically and a concurrent publisher is never overwritten
Other packs in the lock are kept unchanged. The receipt records every count and hash.

Two kinds of pack:
  --directories countries,registry/source-provenance
      every tracked file below data/<directory>; the pack is named after the path
      with "/" replaced by "-" (registry/source-provenance -> registry-source-provenance)
  --file-packs "top-level-datasets=municipal-snapshot.v1.json,methodology-sources.v1.json"
      an explicit list of tracked files below data/, packed under the given name;
      several packs are separated by ";"
Text files (JSON, CSV, NDJSON, Markdown, XML) are stored as deterministic gzip when that
is smaller. Their lock entry carries encoding=gzip plus raw_size/raw_sha256 of the exact
committed bytes, so the server hands gzip clients the stored bytes and inflates for the
rest, as nginx's gzip_static did when these files were in the image.
"""
import argparse
import base64
import datetime
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess

BUCKET = 'czbudget-janrezab-public-snapshots'
LOCK_OBJECT = f'gs://{BUCKET}/static-assets/current.json'
PACK_PREFIX = f'gs://{BUCKET}/static-assets/v1'
RECEIPT_PREFIX = 'gs://czbudget-janrezab-data-layers/processing-runs/static-assets'
MAX_FILE = 32 * 1024 * 1024
MAX_RAW = 128 * 1024 * 1024
SEGMENT = re.compile(r'^[a-z0-9][a-z0-9-]*$')
FILE_SEGMENT = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*$')
COMPRESSIBLE = {'.json', '.csv', '.ndjson', '.md', '.xml', '.txt'}


def run(*args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True, timeout=900).strip()


def pack_name(directory):
    return directory.replace('/', '-')


def parse_directories(value):
    directories = [name for name in (value or '').split(',') if name]
    for name in directories:
        if not all(SEGMENT.match(part) for part in name.split('/')):
            raise ValueError(f'Directories must be plain paths under data/: {name!r}')
    return directories


def parse_file_packs(value):
    """'name=a.json,b/c.json;other=d.json' -> {'name': ['a.json', 'b/c.json'], 'other': ['d.json']}"""
    packs = {}
    for group in filter(None, (value or '').split(';')):
        name, separator, listing = group.partition('=')
        name = name.strip()
        if not separator or not SEGMENT.match(name):
            raise ValueError(f'File packs are written name=file,file: {group!r}')
        if name in packs:
            raise ValueError(f'File pack {name} is listed twice')
        files = [item.strip() for item in listing.split(',') if item.strip()]
        if not files:
            raise ValueError(f'File pack {name} names no files')
        for item in files:
            parts = PurePosixPath(item).parts
            if item.startswith('/') or not parts or not all(FILE_SEGMENT.match(part) for part in parts):
                raise ValueError(f'File pack entries must be plain paths under data/: {item!r}')
        if len(set(files)) != len(files):
            raise ValueError(f'File pack {name} lists a file twice')
        packs[name] = files
    return packs


def git_blobs(root, pathspec):
    listing = subprocess.check_output(['git', 'ls-files', '-s', '-z', '--', pathspec], cwd=root, timeout=300)
    for record in filter(None, listing.split(b'\0')):
        meta, path = record.split(b'\t', 1)
        mode, blob, _stage = meta.decode().split()
        yield path.decode(), mode, blob


def verified(root, relative, mode, blob):
    """The committed bytes of one file, proven equal to its Git blob."""
    if mode != '100644':
        raise ValueError(f'Unexpected file mode {mode}: {relative}')
    if any(part.startswith('.') for part in relative.split('/')):
        raise ValueError(f'Hidden file is not publishable: {relative}')
    body = (root / relative).read_bytes()
    if hashlib.sha1(b'blob %d\0' % len(body) + body).hexdigest() != blob:
        raise ValueError(f'Checkout differs from the pinned commit: {relative}')
    if len(body) > MAX_RAW:
        raise ValueError(f'File exceeds the {MAX_RAW} byte raw limit: {relative}')
    return body


def tracked(root, directory):
    """Committed files under data/<directory>, each proven equal to its Git blob."""
    files = [(relative, verified(root, relative, mode, blob), blob)
             for relative, mode, blob in git_blobs(root, f'data/{directory}')]
    if not files:
        raise ValueError(f'No tracked files under data/{directory}')
    return files


def tracked_files(root, names):
    """Exactly the named committed files under data/, each proven equal to its Git blob."""
    files = []
    for name in names:
        relative = f'data/{name}'
        listed = list(git_blobs(root, relative))
        matches = [item for item in listed if item[0] == relative]
        if len(matches) != 1 or len(listed) != 1:
            raise ValueError(f'{relative} is not exactly one tracked file at the pinned commit')
        path, mode, blob = matches[0]
        files.append((path, verified(root, path, mode, blob), blob))
    return files


def stored(relative, body, compress):
    """The bytes the pack stores for one file and the lock entry fields that describe them."""
    extra = {}
    if compress and PurePosixPath(relative).suffix in COMPRESSIBLE and body:
        packed = gzip.compress(body, compresslevel=9, mtime=0)
        if len(packed) < len(body) and gzip.decompress(packed) == body:
            extra = {'encoding': 'gzip', 'raw_size': len(body), 'raw_sha256': hashlib.sha256(body).hexdigest()}
            body = packed
    if len(body) > MAX_FILE:
        raise ValueError(f'File exceeds the {MAX_FILE} byte response limit: {relative}')
    return body, extra


def assemble(root, directories, file_packs, base_lock, output, compress=True):
    lock = json.loads(base_lock.read_text())
    if lock.get('version') != 1 or lock.get('bucket') != BUCKET:
        raise ValueError('Invalid base static-asset lock')
    groups = [(pack_name(directory), 'directory', directory) for directory in directories]
    groups += [(name, 'files', names) for name, names in file_packs.items()]
    if not groups:
        raise ValueError('Nothing to publish: pass --directories and/or --file-packs')
    replaced = [name for name, _kind, _source in groups]
    if len(set(replaced)) != len(replaced):
        raise ValueError(f'Pack names collide: {replaced}')
    output.mkdir(parents=True, exist_ok=False)
    kept = {url: item for url, item in lock['files'].items() if item.get('pack') not in replaced}
    packs, entries, summary = {}, {}, {}
    for name, kind, source in groups:
        files = tracked(root, source) if kind == 'directory' else tracked_files(root, source)
        sha256, md5, offset, raw_bytes = hashlib.sha256(), hashlib.md5(), 0, 0
        temporary = output / f'{name}.tmp'
        with temporary.open('wb') as destination:
            for relative, raw, _blob in files:
                url = '/' + relative
                if url in kept:
                    raise ValueError(f'{url} already belongs to pack {kept[url]["pack"]}')
                if url in entries:
                    raise ValueError(f'{url} is listed in packs {entries[url]["pack"]} and {name}')
                body, extra = stored(relative, raw, compress)
                entries[url] = {'pack': name, 'offset': offset, 'size': len(body),
                                'sha256': hashlib.sha256(body).hexdigest(), **extra}
                destination.write(body)
                sha256.update(body)
                md5.update(body)
                offset += len(body)
                raw_bytes += len(raw)
        digest = sha256.hexdigest()
        temporary.replace(output / f'{digest}.pack')
        packs[name] = {'key': f'static-assets/v1/{digest}.pack', 'file': f'{digest}.pack', 'size': offset,
                       'md5': base64.b64encode(md5.digest()).decode(), 'sha256': digest}
        summary[name] = {'kind': kind, 'files': len(files), 'bytes': offset, 'raw_bytes': raw_bytes, 'sha256': digest,
                         'compressed': sum(1 for relative, *_ in files if 'encoding' in entries['/' + relative])}
        if kind == 'directory':
            summary[name]['tree'] = run('git', 'rev-parse', f'HEAD:data/{source}', cwd=root)
        else:
            summary[name]['blobs'] = {relative: blob for relative, _raw, blob in files}
    lock['packs'] = {name: item for name, item in lock['packs'].items() if name not in replaced} | packs
    lock['files'] = kept | entries
    return lock, packs, summary


def publish(lock, packs, output, base_generation):
    if not os.environ.get('BUILD_ID') or os.environ.get('PROJECT_ID') != 'czbudget-janrezab':
        raise RuntimeError('Publication runs only on the canonical data-plane cloud worker')
    for name, descriptor in packs.items():
        uri = f'{PACK_PREFIX}/{descriptor["file"]}'
        try:
            remote = json.loads(run('gcloud', 'storage', 'objects', 'describe', uri, '--format=json'))
            descriptor['reused'] = True
        except subprocess.CalledProcessError:
            subprocess.run(['gcloud', 'storage', 'cp', str(output / descriptor['file']), uri, '--if-generation-match=0',
                            '--content-type=application/octet-stream', '--quiet'], check=True, timeout=900)
            remote = json.loads(run('gcloud', 'storage', 'objects', 'describe', uri, '--format=json'))
            descriptor['reused'] = False
        if (int(remote['size']) != descriptor['size'] or remote.get('md5_hash') != descriptor['md5']
                or not str(remote.get('generation', '')).isdigit()):
            raise ValueError(f'Pack {name} failed size/MD5/generation verification')
        descriptor['generation'] = str(remote['generation'])
    stored_packs = {name: {key: value for key, value in item.items() if key != 'reused'} for name, item in lock['packs'].items()}
    lock['packs'] = stored_packs
    lock['release_id'] = f'static-assets:{os.environ["BUILD_ID"]}'
    lock['published_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    path = output / 'current.json'
    path.write_text(json.dumps(lock, separators=(',', ':'), sort_keys=True) + '\n')
    subprocess.run(['gcloud', 'storage', 'cp', str(path), LOCK_OBJECT, f'--if-generation-match={base_generation}',
                    '--content-type=application/json', '--quiet'], check=True, timeout=300)
    # Read back the published pointer: every new entry must be present exactly as assembled.
    live = json.loads(run('gcloud', 'storage', 'cat', LOCK_OBJECT))
    generation = run('gcloud', 'storage', 'objects', 'describe', LOCK_OBJECT, '--format=value(generation)')
    for name in packs:
        if live['packs'].get(name) != stored_packs[name]:
            raise ValueError(f'Published lock lost pack {name}')
        if {url: item for url, item in live['files'].items() if item.get('pack') == name} != \
                {url: item for url, item in lock['files'].items() if item.get('pack') == name}:
            raise ValueError(f'Published lock lost entries of pack {name}')
    if live['release_id'] != lock['release_id']:
        raise ValueError('Published lock is not this release')
    return generation


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--directories', default='', help='comma-separated paths under data/')
    parser.add_argument('--file-packs', default='', help='name=file,file[;name=file] with files under data/')
    parser.add_argument('--base-lock', type=Path, required=True)
    parser.add_argument('--base-generation', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--no-compress', action='store_true', help='store every file as committed')
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    root = args.root.resolve()
    directories = parse_directories(args.directories)
    file_packs = parse_file_packs(args.file_packs)
    head = run('git', 'rev-parse', 'HEAD', cwd=root)
    if head != args.source_sha or len(head) != 40:
        raise ValueError(f'Checkout {head} is not the pinned source {args.source_sha}')
    started = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    base = json.loads(args.base_lock.read_text())
    lock, packs, summary = assemble(root, directories, file_packs, args.base_lock.resolve(), args.output.resolve(),
                                    compress=not args.no_compress)
    receipt = {
        'dataset': 'static-assets', 'event': 'data-release', 'source_repository': 'https://github.com/jan-rezab/czbudget',
        'source_git_sha': head, 'loader_git_sha': head, 'cloud_build_id': os.environ.get('BUILD_ID'),
        'service_account': os.environ.get('SERVICE_ACCOUNT'), 'region': os.environ.get('REGION'),
        'started_at': started, 'base_release_id': base.get('release_id'), 'base_lock_generation': args.base_generation,
        'packs_assembled': summary, 'files_received': sum(item['files'] for item in summary.values()),
        'files_accepted': sum(item['files'] for item in summary.values()), 'files_rejected': 0,
        'raw_bytes': sum(item['raw_bytes'] for item in summary.values()),
        'stored_bytes': sum(item['bytes'] for item in summary.values()),
        'validation': {'git_blob_match': 'all', 'max_file_bytes': MAX_FILE, 'url_conflicts': 0,
                       'gzip_round_trip': 'all compressed entries'},
        'processing_status': 'succeeded', 'publication_status': 'not_published',
    }
    if args.publish:
        receipt['lock_generation'] = publish(lock, packs, args.output.resolve(), args.base_generation)
        receipt.update({'publication_status': 'published', 'release_id': lock['release_id'],
                        'published_at': lock['published_at'],
                        'packs': {name: {'generation': item['generation'], 'reused': item.get('reused')} for name, item in packs.items()}})
    else:
        # A dry run leaves the assembled lock beside the packs, for DATA_ASSET_LOCK and
        # DATA_ASSET_PACK_ROOT in local verification. New packs carry no generation yet.
        (args.output / 'lock.json').write_text(json.dumps(lock, separators=(',', ':'), sort_keys=True) + '\n')
    receipt['finished_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    path = args.output / 'receipt.json'
    path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n')
    if args.publish:
        subprocess.run(['gcloud', 'storage', 'cp', str(path), f'{RECEIPT_PREFIX}/{os.environ["BUILD_ID"]}/receipt.json',
                        '--if-generation-match=0', '--quiet'], check=True, timeout=300)
    print(json.dumps(receipt, sort_keys=True), flush=True)


if __name__ == '__main__':
    main()
