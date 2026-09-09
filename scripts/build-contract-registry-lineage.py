#!/usr/bin/env python3
"""Build contract/version lookup artifacts from verified, scoped monthly imports.

The SQLite index is temporary and bounded on disk. No contractual amounts are
summed; an amendment/version is not an additional realized payment.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
import os
import sqlite3
import tempfile
from collections import Counter
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('registry', Path(__file__).with_name('fetch-contract-registry.py'))
registry = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(registry)

def build(out):
    manifest = json.loads((out / 'manifest.v1.json').read_text())
    counters = Counter({'unique_versions': 0, 'unique_contracts': 0, 'duplicate_version_rows': 0})
    entity_counts = {ico: Counter({'contracts': 0, 'linked_versions': 0, 'multiple_valid_versions': 0}) for ico in manifest['entities']}
    artifacts = []
    with tempfile.TemporaryDirectory(prefix='psd-contract-lineage-') as temp:
        db = sqlite3.connect(Path(temp) / 'versions.sqlite')
        db.execute('PRAGMA cache_size=-8192')
        db.execute('CREATE TABLE versions(version_id TEXT PRIMARY KEY,contract_id TEXT,period TEXT,line_number INTEGER,published TEXT,validity TEXT,metadata_hash TEXT,entities TEXT)')
        for month in manifest['months']:
            path = out / month['artifact']
            if registry.sha256_file(path) != month['artifact_sha256']:
                raise ValueError(f'Artifact integrity mismatch: {path}')
            count = 0
            with gzip.open(path, 'rt', encoding='utf-8') as source:
                for count, line in enumerate(source, 1):
                    row = json.loads(line)
                    metadata_hash = hashlib.sha256(row['metadata_xml'].encode()).hexdigest()
                    value = (row['version_id'], row['contract_id'], month['period'], count,
                        row['published_at'], row['valid_record_raw'], metadata_hash, json.dumps(row['matched_icos']))
                    try:
                        db.execute('INSERT INTO versions VALUES(?,?,?,?,?,?,?,?)', value)
                    except sqlite3.IntegrityError:
                        previous = db.execute('SELECT contract_id,metadata_hash FROM versions WHERE version_id=?', (row['version_id'],)).fetchone()
                        if previous != (row['contract_id'], metadata_hash):
                            raise ValueError(f'Conflicting metadata for version {row["version_id"]}')
                        counters['duplicate_version_rows'] += 1
            if count != month['matched_versions']:
                raise ValueError(f'Row count mismatch: {month["period"]}')
            db.commit()
        db.execute('CREATE INDEX contract_versions ON versions(contract_id,version_id)')
        handles = {}
        for ico in manifest['entities']:
            name = f'{ico}.lineage.jsonl.gz'
            handles[ico] = gzip.open(out / (name + '.part'), 'wt', encoding='utf-8')
        def emit(contract_id, versions, entities):
            counters['unique_contracts'] += 1
            valid = [v['version_id'] for v in versions if v['valid_record_raw'] == '1']
            row = {'contract_id': contract_id, 'versions': versions, 'valid_version_ids': valid,
                'scope_icos': sorted(entities), 'multiple_valid_versions': len(valid) > 1,
                'lineage_completeness': 'Only published versions matching at least one selected ICO; missing/withdrawn versions not inferred.'}
            for ico in entities:
                handles[ico].write(json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n')
                entity_counts[ico]['contracts'] += 1
                entity_counts[ico]['linked_versions'] += len(versions)
                entity_counts[ico]['multiple_valid_versions'] += len(valid) > 1
        current = None
        versions, entities = [], set()
        try:
            for row in db.execute('SELECT contract_id,version_id,period,line_number,published,validity,entities FROM versions ORDER BY contract_id,CAST(version_id AS INTEGER)'):
                contract_id, version_id, period, line_number, published, validity, icos = row
                if current is not None and contract_id != current:
                    emit(current, versions, entities)
                    versions, entities = [], set()
                current = contract_id
                matched = json.loads(icos)
                entities.update(matched)
                versions.append({'version_id': version_id, 'published_at': published, 'valid_record_raw': validity,
                    'artifact': f'{period}.jsonl.gz', 'line_number': line_number, 'matched_icos': matched})
                counters['unique_versions'] += 1
            if current is not None:
                emit(current, versions, entities)
        finally:
            for handle in handles.values():
                handle.close()
            db.close()
        for ico in manifest['entities']:
            name = f'{ico}.lineage.jsonl.gz'
            os.replace(out / (name + '.part'), out / name)
            artifacts.append({'ico': ico, **manifest['entities'][ico], **entity_counts[ico],
                'artifact': name, 'sha256': registry.sha256_file(out / name)})
    output = {'schema_version': '1.0.0', 'generated_at': registry.now(), 'source': manifest['source'],
        'coverage': manifest['coverage'], 'month_fingerprints': {m['period']: m['fingerprint'] for m in manifest['months']},
        'counts': dict(counters), 'entities': artifacts, 'semantics': manifest['semantics']}
    registry.atomic_json(out / 'lineage.v1.json', output)
    print(json.dumps({'coverage': output['coverage'], 'counts': dict(counters), 'entities': artifacts}, ensure_ascii=False))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=registry.OUT)
    build(parser.parse_args().out)
