#!/usr/bin/env python3
"""Publish one tracked fan-out directory from a pinned commit as an immutable raw copy.

Data plane only: cloudbuild.raw-fanout.yaml runs it in europe-west4 as psd-data-builder
(tag plane-data), from a depth-1 fetch of --source-sha. It never touches the website,
Cloud Run, BigQuery or any serving pointer.

  raw         gs://<bucket>/raw/<dataset>/<source-sha>/<directory>/...  (write-once)
  manifest    gs://<bucket>/raw/<dataset>/<source-sha>/source-manifest.json, the same
              schema as the Czech history copy: path, bytes, sha256, git_blob_sha per file
  validation  every file equals its Git blob at the pinned commit before upload; after
              upload every object's size and MD5 are re-read, extra objects are refused,
              and an object that already exists is accepted only if its bytes match
  receipt     gs://<bucket>/processing-runs/raw-<dataset>/<build-id>/receipt.json

There is no mutable pointer: consumers pin the copy by its manifest SHA-256 in
pipeline/config/municipal-serving-inputs.v1.json, in a reviewed website commit.
Re-running for the same commit is idempotent and only re-verifies.
"""
import argparse
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

REPOSITORY = 'https://github.com/jan-rezab/czbudget.git'


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')


def run(*args, capture=False):
    result = subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE if capture else None, timeout=1800)
    return result.stdout if capture else ''


def tracked(root, sha, directory):
    """Every file under DIRECTORY at SHA, proven equal to its Git blob."""
    if run('git', '-C', str(root), 'rev-parse', 'HEAD', capture=True).strip() != sha:
        raise ValueError(f'{root} is not checked out at {sha}')
    listing = run('git', '-C', str(root), 'ls-tree', '-r', sha, '--', directory, capture=True)
    files = []
    for line in listing.splitlines():
        meta, relative = line.split('\t', 1)
        mode, kind, blob = meta.split()
        if kind != 'blob' or mode != '100644':
            raise ValueError(f'Unexpected tree entry {mode} {kind}: {relative}')
        body = (root / relative).read_bytes()
        if hashlib.sha1(b'blob %d\0' % len(body) + body).hexdigest() != blob:
            raise ValueError(f'Checkout differs from the pinned commit: {relative}')
        files.append({'path': relative, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(),
                      'git_blob_sha': blob, 'md5': base64.b64encode(hashlib.md5(body).digest()).decode()})
    if not files:
        raise ValueError(f'No tracked files under {directory} at {sha}')
    return sorted(files, key=lambda item: item['path'])


def list_objects(prefix):
    try:
        text = run('gcloud', 'storage', 'ls', '--recursive', '--json', prefix + '**', capture=True)
    except subprocess.CalledProcessError:
        return {}
    objects = {}
    for item in json.loads(text or '[]'):
        url, meta = item.get('url', ''), item.get('metadata', item)
        if not url.startswith(prefix) or item.get('type') not in (None, 'cloud_object'):
            continue
        relative = url[len(prefix):].split('#', 1)[0]
        objects[relative] = {'md5': meta.get('md5Hash') or meta.get('md5_hash'), 'size': int(meta.get('size', -1)),
                             'generation': int(meta['generation']) if meta.get('generation') else None}
    return objects


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--root', required=True, help='checkout of the pinned commit')
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--dataset', required=True, help='e.g. municipal-benchmarks')
    parser.add_argument('--directory', required=True, help='e.g. data/municipal-benchmarks')
    parser.add_argument('--bucket', default='czbudget-janrezab-data-layers')
    parser.add_argument('--output', required=True, help='local directory for the manifest and receipt')
    parser.add_argument('--publish', action='store_true', help='upload; without it only the manifest is built')
    args = parser.parse_args()
    for name, value in [('--dataset', args.dataset), ('--directory', args.directory)]:
        if not value or value.startswith('/') or '..' in value.split('/') or not all(c.isalnum() or c in '-_/.' for c in value):
            raise ValueError(f'{name} is not a safe relative name: {value!r}')

    root, output = Path(args.root).resolve(), Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    build_id = os.environ.get('BUILD_ID') or 'local'
    prefix = f'gs://{args.bucket}/raw/{args.dataset}/{args.source_sha}/'
    receipt_uri = f'gs://{args.bucket}/processing-runs/raw-{args.dataset}/{build_id}/receipt.json'
    receipt = {
        'receipt_schema': 'raw-fanout/1', 'dataset': args.dataset, 'directory': args.directory,
        'source': {'repository': REPOSITORY, 'git_sha': args.source_sha},
        'loader_git_sha': args.source_sha, 'loader_script_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'cloud_build_id': os.environ.get('BUILD_ID'), 'project': os.environ.get('PROJECT_ID'),
        'region': os.environ.get('REGION'), 'service_account': os.environ.get('SERVICE_ACCOUNT'),
        'raw_destination': prefix, 'staging_destination': None, 'publication_pointer': None,
        'started_at': now(), 'processing_status': 'running', 'publication_status': 'not_published', 'validations': [],
    }
    files = tracked(root, args.source_sha, args.directory)
    manifest = {'repository': REPOSITORY, 'git_sha': args.source_sha,
                'files': [{key: item[key] for key in ('path', 'bytes', 'sha256', 'git_blob_sha')} for item in files]}
    manifest_path = output / 'source-manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=1) + '\n')
    manifest_bytes = manifest_path.read_bytes()
    receipt['counts'] = {'files_received': len(files), 'files_accepted': len(files), 'files_rejected': 0,
                         'files_deduplicated': 0, 'bytes': sum(item['bytes'] for item in files)}
    receipt['manifest_sha256'] = hashlib.sha256(manifest_bytes).hexdigest()
    receipt['validations'].append({'check': 'every file equals its git blob at the pinned commit', 'passed': True})
    receipt['processing_status'] = 'succeeded'

    if args.publish:
        existing = list_objects(prefix)
        wanted = {item['path']: item for item in files}
        extra = sorted(set(existing) - set(wanted) - {'source-manifest.json'})
        if extra:
            raise ValueError(f'{prefix} holds objects this commit does not: {extra[:5]}')
        for relative, obj in existing.items():
            if relative in wanted and (obj['md5'] != wanted[relative]['md5'] or obj['size'] != wanted[relative]['bytes']):
                raise ValueError(f'{prefix}{relative} already exists with different bytes; raw copies are immutable')
        missing = [item for item in files if item['path'] not in existing]
        receipt['counts']['files_deduplicated'] = len(files) - len(missing)
        if missing:
            with tempfile.TemporaryDirectory() as temporary:
                stage = Path(temporary)
                for item in missing:
                    target = stage / item['path']
                    target.parent.mkdir(parents=True, exist_ok=True)
                    os.link(root / item['path'], target)
                top = sorted({item['path'].split('/')[0] for item in missing})
                # --no-clobber is an if-generation-match=0 precondition on every object.
                run('gcloud', 'storage', 'cp', '--no-clobber', '--recursive', *(str(stage / name) for name in top), prefix)
        objects = list_objects(prefix)
        for item in files:
            obj = objects.get(item['path'])
            if not obj or obj['md5'] != item['md5'] or obj['size'] != item['bytes']:
                raise ValueError(f'{prefix}{item["path"]} is missing or differs after upload')
        receipt['validations'].append({'check': 'every raw object re-read with matching size and MD5', 'passed': True, 'objects': len(files)})
        # The manifest goes last: its presence means the copy is complete.
        manifest_md5 = base64.b64encode(hashlib.md5(manifest_bytes).digest()).decode()
        if 'source-manifest.json' in objects:
            if objects['source-manifest.json']['md5'] != manifest_md5:
                raise ValueError(f'{prefix}source-manifest.json exists with different content')
        else:
            run('gcloud', 'storage', 'cp', '--no-clobber', str(manifest_path), prefix + 'source-manifest.json')
        final = list_objects(prefix).get('source-manifest.json')
        if not final or final['md5'] != manifest_md5:
            raise ValueError('source manifest did not land intact')
        receipt['raw_manifest_object'] = {'uri': prefix + 'source-manifest.json', 'generation': final['generation']}
        receipt['publication_status'] = 'raw_published'
    receipt['finished_at'] = now()
    receipt_path = output / 'receipt.json'
    receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n')
    if args.publish:
        run('gcloud', 'storage', 'cp', '--no-clobber', str(receipt_path), receipt_uri)
    print(json.dumps({key: receipt[key] for key in ('dataset', 'raw_destination', 'manifest_sha256', 'counts', 'publication_status')}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, subprocess.CalledProcessError) as error:
        print(f'publish-raw-fanout: {error}', file=sys.stderr)
        sys.exit(1)
