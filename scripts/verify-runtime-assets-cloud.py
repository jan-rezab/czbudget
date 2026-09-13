#!/usr/bin/env python3
"""Check generation-pinned range reads before a candidate can reference a pack."""
import hashlib
import json
import subprocess
import sys
import urllib.parse
import urllib.request

lock = json.load(open(sys.argv[1]))
token = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True, timeout=60).strip()
for name, pack in lock['packs'].items():
    files = [(url, f) for url, f in lock['files'].items() if f['pack'] == name and f['size']]
    candidates = [min(files, key=lambda p: p[1]['offset']), max(files, key=lambda p: p[1]['offset']), max(files, key=lambda p: p[1]['size'])]
    for url, file in dict(candidates).items():
        endpoint = ('https://storage.googleapis.com/storage/v1/b/' + lock['bucket'] + '/o/'
                    + urllib.parse.quote(pack['key'], safe='') + '?alt=media&generation=' + pack['generation'])
        last = file['offset'] + file['size'] - 1
        request = urllib.request.Request(endpoint, headers={'Authorization': 'Bearer ' + token,
                    'Range': f"bytes={file['offset']}-{last}", 'Accept-Encoding': 'identity'})
        with urllib.request.urlopen(request, timeout=30) as response:
            assert response.status == 206, url
            assert response.headers['Content-Range'] == f"bytes {file['offset']}-{last}/{pack['size']}", url
            body = response.read(file['size'] + 1)
        assert len(body) == file['size'] and hashlib.sha256(body).hexdigest() == file['sha256'], url
        print('Verified cloud range:', url)
