#!/usr/bin/env python3
"""Publish immutable static-data packs on a cloud worker; never restore archives."""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.parse
import urllib.request

PREFIXES = ('isred', 'industrial-intelligence', 'czech-nku', 'contracts', 'czech-project-geography', 'industry')
BUCKET = 'czbudget-janrezab-public-snapshots'
MAX_FILE = 32 * 1024 * 1024


def pack(root, output):
    output.mkdir(parents=True, exist_ok=True)
    manifest = {'version': 1, 'bucket': BUCKET, 'packs': {}, 'files': {}}
    for group in PREFIXES:
        folder = root / 'data' / group
        if not folder.is_dir() or folder.is_symlink():
            raise ValueError('Missing or unsafe data directory: ' + str(folder))
        sha, md5, offset = hashlib.sha256(), hashlib.md5(), 0
        entries = {}
        # hydrate-industry verifies these gzip files against the raw byte hashes.
        # Publish one compressed representation and alias the original JSON URL.
        aliases = {}
        if group == 'industry':
            aliases = {row['file']: row for row in json.loads((folder / 'archive-manifest.json').read_text())}
        temporary = output / (group + '.tmp')
        with temporary.open('wb') as destination:
            for source in sorted(folder.rglob('*')):
                if source.is_symlink():
                    raise ValueError('Symlinks cannot be published: ' + str(source))
                if not source.is_file():
                    continue
                if source.name in aliases:
                    if source.stat().st_size != aliases[source.name]['bytes']:
                        raise ValueError('Industry alias size changed after hydration')
                    continue
                if source.stat().st_size > MAX_FILE:
                    raise ValueError('Asset exceeds bounded response size: ' + str(source))
                body = source.read_bytes()
                url = '/' + source.relative_to(root).as_posix()
                if any(part.startswith('.') for part in source.relative_to(folder).parts):
                    raise ValueError('Hidden files cannot be published: ' + url)
                entries[url] = {'pack': group, 'offset': offset, 'size': len(body),
                                'sha256': hashlib.sha256(body).hexdigest()}
                destination.write(body)
                sha.update(body)
                md5.update(body)
                offset += len(body)
        if not entries or not offset:
            raise ValueError('Empty data pack: ' + group)
        filename = sha.hexdigest() + '.pack'
        temporary.replace(output / filename)
        manifest['packs'][group] = {'key': 'static-assets/v1/' + filename, 'file': filename,
                                    'size': offset, 'md5': base64.b64encode(md5.digest()).decode(),
                                    'sha256': sha.hexdigest()}
        manifest['files'].update(entries)
        for name, row in aliases.items():
            url = '/data/industry/' + name
            entry = entries[url + '.gz']
            manifest['files'][url] = {**entry, 'encoding': 'gzip', 'raw_size': row['bytes'], 'raw_sha256': row['sha256']}
    return manifest


def verify_remote(descriptor, remote):
    if (int(remote['size']) != descriptor['size'] or remote.get('crc32c') != descriptor['crc32c']
            or (remote.get('md5Hash') is not None and remote['md5Hash'] != descriptor['md5'])
            or remote.get('contentEncoding') or not str(remote.get('generation', '')).isdigit()):
        raise ValueError('Cloud pack failed size/checksum/encoding verification: ' + descriptor['key'])
    return str(remote['generation'])


def publish(manifest, output):
    token = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True, timeout=60).strip()

    def upload(descriptor):
        # gcloud uses accelerated CRC32C and may upload large files as composite
        # objects. Those objects have CRC32C but deliberately no MD5 metadata.
        checksums = json.loads(subprocess.check_output(['gcloud', 'storage', 'hash',
                               str(output / descriptor['file']), '--format=json'], text=True, timeout=180))
        descriptor['crc32c'] = checksums[0]['crc32c_hash']
        if checksums[0]['md5_hash'] != descriptor['md5']:
            raise ValueError('Pack changed after assembly: ' + descriptor['key'])
        url = ('https://storage.googleapis.com/storage/v1/b/' + BUCKET + '/o/'
               + urllib.parse.quote(descriptor['key'], safe=''))

        def metadata():
            request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    return json.load(response)
            except urllib.error.HTTPError as error:
                if error.code == 404:
                    return None
                raise

        remote = metadata()
        reused = remote is not None
        if remote is None:
            result = subprocess.run(['gcloud', 'storage', 'cp', str(output / descriptor['file']),
                                     'gs://' + BUCKET + '/' + descriptor['key'],
                                     '--if-generation-match=0', '--content-type=application/octet-stream',
                                     '--quiet'], timeout=900)
            # Another build can win the create-only upload race. Accept only verified bytes.
            remote = metadata()
            if remote is None:
                raise RuntimeError('Pack upload failed with exit status ' + str(result.returncode))
        descriptor['generation'] = verify_remote(descriptor, remote)
        print(json.dumps({'pack': descriptor['key'], 'bytes': descriptor['size'], 'reused': reused}), flush=True)

    with ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(upload, manifest['packs'].values()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    if args.publish and (not os.environ.get('BUILD_ID') or os.environ.get('PROJECT_ID') != 'czbudget-janrezab'):
        raise RuntimeError('Publication runs only on the canonical cloud build worker.')
    manifest = pack(args.root.resolve(), args.output.resolve())
    if args.publish:
        manifest['release_id'] = 'static-assets:' + os.environ['BUILD_ID']
        publish(manifest, args.output)
    lock = json.dumps(manifest, separators=(',', ':'), sort_keys=True) + '\n'
    (args.output / 'lock.json').write_text(lock)
    print(json.dumps({'files': len(manifest['files']), 'pack_bytes': sum(p['size'] for p in manifest['packs'].values()),
                      'lock_bytes': len(lock.encode())}), flush=True)


if __name__ == '__main__':
    main()
