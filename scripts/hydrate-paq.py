#!/usr/bin/env python3
"""Hydrate only the checksum-pinned PAQ data archive during canonical Cloud Build."""
import hashlib, json, subprocess, tarfile, tempfile
from pathlib import Path

root=Path('data/paq')
manifest=json.loads((root/'archive.json').read_text())
assert manifest['uri'].startswith('gs://czbudget-janrezab-data-layers/paq/'), 'Unexpected archive bucket'
with tempfile.TemporaryDirectory(prefix='paq-hydrate-') as temporary:
    target=Path(temporary)/'archive.tar'
    subprocess.run(['gcloud','storage','cp',manifest['uri'],str(target)],check=True)
    digest=hashlib.sha256()
    with target.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):digest.update(chunk)
    assert digest.hexdigest()==manifest['sha256'], 'PAQ archive checksum mismatch'
    index=json.loads((root/'index.json').read_text()); expected={f['file']:f for f in index['files']}
    with tarfile.open(target) as archive:
        members=archive.getmembers()
        assert {m.name for m in members}==set(expected), 'Unexpected archive members'
        for member in members:
            assert member.isfile() and '/' not in member.name and member.size==expected[member.name]['bytes'], 'Unsafe archive entry'
            content=archive.extractfile(member).read()
            assert hashlib.sha256(content).hexdigest()==expected[member.name]['sha256'], 'PAQ file checksum mismatch'
            (root/member.name).write_bytes(content)
print(f'Hydrated and verified {len(expected)} PAQ files')
