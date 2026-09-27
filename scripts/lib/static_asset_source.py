"""Python twin of scripts/lib/static-asset-source.mjs for tests and focused validators.

A data file is read from the checkout when it is there, otherwise from the static-asset
pack the lock names: DATA_ASSET_LOCK (+ DATA_ASSET_PACK_ROOT) when set, else the live
gs://czbudget-janrezab-public-snapshots/static-assets/current.json. Remote reads use a
token from `gcloud auth print-access-token` and a generation-pinned range request. Bytes
are verified against the lock and kept in memory only; nothing is written to disk.
"""
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BUCKET = 'czbudget-janrezab-public-snapshots'
LOCK_OBJECT = 'static-assets/current.json'
HELP = ('Datasets served from the published static-asset packs need read access to gs://' + BUCKET
        + ': run `gcloud auth login`, or set DATA_ASSET_LOCK and DATA_ASSET_PACK_ROOT to a hydrated lock.')
_lock = None
_token = None


def _access_token():
    global _token
    if _token is None:
        try:
            _token = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True, timeout=60,
                                             stderr=subprocess.PIPE).strip()
        except (OSError, subprocess.CalledProcessError) as error:
            raise RuntimeError(HELP) from error
        if not _token:
            raise RuntimeError(HELP)
    return _token


def _get(url, headers=None):
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + _access_token(),
                                                   'Accept-Encoding': 'identity', **(headers or {})})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.status, response.headers, response.read()


def lock():
    global _lock
    if _lock is None:
        path = os.environ.get('DATA_ASSET_LOCK')
        if path:
            _lock = json.loads(Path(path).read_text())
        else:
            _status, _headers, body = _get('https://storage.googleapis.com/storage/v1/b/' + BUCKET + '/o/'
                                           + urllib.parse.quote(LOCK_OBJECT, safe='') + '?alt=media')
            _lock = json.loads(body)
        if _lock.get('version') != 1 or _lock.get('bucket') != BUCKET:
            raise ValueError('Invalid static-asset lock')
    return _lock


def _stored_bytes(entry, pack):
    root = os.environ.get('DATA_ASSET_PACK_ROOT')
    local = Path(root) / pack['file'] if root else None
    if local and local.is_file() and local.stat().st_size == pack['size']:
        with local.open('rb') as handle:
            handle.seek(entry['offset'])
            return handle.read(entry['size'])
    if not str(pack.get('generation', '')).isdigit():
        raise FileNotFoundError(f'Pack {pack["file"]} is neither hydrated nor pinned to a generation')
    last = entry['offset'] + entry['size'] - 1
    status, headers, body = _get('https://storage.googleapis.com/storage/v1/b/' + BUCKET + '/o/'
                                 + urllib.parse.quote(pack['key'], safe='') + '?alt=media&generation=' + pack['generation'],
                                 {'Range': f'bytes={entry["offset"]}-{last}'})
    if status != 206 or headers.get('Content-Range') != f'bytes {entry["offset"]}-{last}/{pack["size"]}':
        raise ValueError('Static-asset range read failed')
    return body


def read_data_bytes(relative, root=ROOT):
    """The exact committed bytes of data/<...>: from the checkout, else from the published pack."""
    path = Path(root) / relative
    if path.is_file():
        return path.read_bytes()
    entry = lock()['files'].get('/' + Path(relative).as_posix())
    if not entry:
        raise FileNotFoundError(f'{relative} is neither in this checkout nor in the static-asset lock')
    body = _stored_bytes(entry, lock()['packs'][entry['pack']])
    if len(body) != entry['size'] or hashlib.sha256(body).hexdigest() != entry['sha256']:
        raise ValueError(f'{relative}: static-asset checksum mismatch')
    if entry.get('encoding') == 'gzip':
        body = gzip.decompress(body)
        if len(body) != entry['raw_size'] or hashlib.sha256(body).hexdigest() != entry['raw_sha256']:
            raise ValueError(f'{relative}: inflated static-asset checksum mismatch')
    return body


def read_data_json(relative, root=ROOT):
    return json.loads(read_data_bytes(relative, root))
