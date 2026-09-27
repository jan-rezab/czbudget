#!/usr/bin/env python3
"""Publish tracked data directories from one pinned Git commit as static-asset packs.

Data plane only: a Cloud Build in europe-west4 as psd-data-builder, tagged plane-data.
  raw         the exact Git tree at --source-sha (immutable, content-addressed)
  staging     one write-once, content-addressed pack object per directory
  validation  every file's bytes hash to its committed Git blob; pack size, MD5 and
              generation are verified after upload; no URL may belong to another pack
  publish     static-assets/current.json replaced by compare-and-swap on its generation,
              so readers switch atomically and a concurrent publisher is never overwritten
Other packs in the lock are kept unchanged. The receipt records every count and hash.
"""
import argparse
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess

BUCKET = 'czbudget-janrezab-public-snapshots'
LOCK_OBJECT = f'gs://{BUCKET}/static-assets/current.json'
PACK_PREFIX = f'gs://{BUCKET}/static-assets/v1'
RECEIPT_PREFIX = 'gs://czbudget-janrezab-data-layers/processing-runs/static-assets'
MAX_FILE = 32 * 1024 * 1024
DIRECTORY = __import__('re').compile(r'^[a-z0-9][a-z0-9-]*$')


def run(*args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True, timeout=900).strip()


def tracked(root, directory):
    """Committed files under data/<directory>, each proven equal to its Git blob."""
    listing = subprocess.check_output(['git', 'ls-files', '-s', '-z', '--', f'data/{directory}'], cwd=root, timeout=300)
    files = []
    for record in filter(None, listing.split(b'\0')):
        meta, path = record.split(b'\t', 1)
        mode, blob, _stage = meta.decode().split()
        relative = path.decode()
        if mode != '100644':
            raise ValueError(f'Unexpected file mode {mode}: {relative}')
        if any(part.startswith('.') for part in relative.split('/')):
            raise ValueError(f'Hidden file is not publishable: {relative}')
        body = (root / relative).read_bytes()
        if hashlib.sha1(b'blob %d\0' % len(body) + body).hexdigest() != blob:
            raise ValueError(f'Checkout differs from the pinned commit: {relative}')
        if len(body) > MAX_FILE:
            raise ValueError(f'File exceeds the {MAX_FILE} byte response limit: {relative}')
        files.append((relative, body, blob))
    if not files:
        raise ValueError(f'No tracked files under data/{directory}')
    return files


def assemble(root, directories, base_lock, output):
    lock = json.loads(base_lock.read_text())
    if lock.get('version') != 1 or lock.get('bucket') != BUCKET:
        raise ValueError('Invalid base static-asset lock')
    output.mkdir(parents=True, exist_ok=False)
    replaced = set(directories)
    kept = {url: item for url, item in lock['files'].items() if item.get('pack') not in replaced}
    packs, entries, summary = {}, {}, {}
    for directory in directories:
        sha256, md5, offset, files = hashlib.sha256(), hashlib.md5(), 0, tracked(root, directory)
        temporary = output / f'{directory}.tmp'
        with temporary.open('wb') as destination:
            for relative, body, _blob in files:
                url = '/' + relative
                if url in kept:
                    raise ValueError(f'{url} already belongs to pack {kept[url]["pack"]}')
                entries[url] = {'pack': directory, 'offset': offset, 'size': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
                destination.write(body)
                sha256.update(body)
                md5.update(body)
                offset += len(body)
        digest = sha256.hexdigest()
        temporary.replace(output / f'{digest}.pack')
        packs[directory] = {'key': f'static-assets/v1/{digest}.pack', 'file': f'{digest}.pack', 'size': offset,
                            'md5': base64.b64encode(md5.digest()).decode(), 'sha256': digest}
        summary[directory] = {'files': len(files), 'bytes': offset, 'sha256': digest,
                              'tree': run('git', 'rev-parse', f'HEAD:data/{directory}', cwd=root)}
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
    stored = {name: {key: value for key, value in item.items() if key != 'reused'} for name, item in lock['packs'].items()}
    lock['packs'] = stored
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
        if live['packs'].get(name) != stored[name]:
            raise ValueError(f'Published lock lost pack {name}')
    if live['release_id'] != lock['release_id']:
        raise ValueError('Published lock is not this release')
    return generation


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--directories', required=True, help='comma-separated names under data/')
    parser.add_argument('--base-lock', type=Path, required=True)
    parser.add_argument('--base-generation', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    root = args.root.resolve()
    directories = [name for name in args.directories.split(',') if name]
    if not directories or any(not DIRECTORY.match(name) for name in directories):
        raise ValueError('Directories must be plain names under data/')
    head = run('git', 'rev-parse', 'HEAD', cwd=root)
    if head != args.source_sha or len(head) != 40:
        raise ValueError(f'Checkout {head} is not the pinned source {args.source_sha}')
    started = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    base = json.loads(args.base_lock.read_text())
    lock, packs, summary = assemble(root, directories, args.base_lock.resolve(), args.output.resolve())
    receipt = {
        'dataset': 'static-assets', 'event': 'data-release', 'source_repository': 'https://github.com/jan-rezab/czbudget',
        'source_git_sha': head, 'loader_git_sha': head, 'cloud_build_id': os.environ.get('BUILD_ID'),
        'service_account': os.environ.get('SERVICE_ACCOUNT'), 'region': os.environ.get('REGION'),
        'started_at': started, 'base_release_id': base.get('release_id'), 'base_lock_generation': args.base_generation,
        'directories': summary, 'files_received': sum(item['files'] for item in summary.values()),
        'files_accepted': sum(item['files'] for item in summary.values()), 'files_rejected': 0,
        'validation': {'git_blob_match': 'all', 'max_file_bytes': MAX_FILE, 'url_conflicts': 0},
        'processing_status': 'succeeded', 'publication_status': 'not_published',
    }
    if args.publish:
        receipt['lock_generation'] = publish(lock, packs, args.output.resolve(), args.base_generation)
        receipt.update({'publication_status': 'published', 'release_id': lock['release_id'],
                        'published_at': lock['published_at'],
                        'packs': {name: {'generation': item['generation'], 'reused': item.get('reused')} for name, item in packs.items()}})
    receipt['finished_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    path = args.output / 'receipt.json'
    path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n')
    if args.publish:
        subprocess.run(['gcloud', 'storage', 'cp', str(path), f'{RECEIPT_PREFIX}/{os.environ["BUILD_ID"]}/receipt.json',
                        '--if-generation-match=0', '--quiet'], check=True, timeout=300)
    print(json.dumps(receipt, sort_keys=True), flush=True)


if __name__ == '__main__':
    main()
