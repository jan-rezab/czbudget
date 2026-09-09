#!/usr/bin/env python3
"""Stream official monthly Registr smluv metadata for a fixed public-entity scope.

No complete raw dump or attachment binary is retained. Every accepted month is
verified against the frozen index (hash, byte count and generation timestamp).
Resume keys include all three and the filter/extractor revision. Revisions replace
the previous month atomically, removing metadata withdrawn from the live dump.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import subprocess
import time
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX_URL = 'https://data.smlouvy.gov.cz/index.xml'
OUT = ROOT / 'data/contracts/official-registry'
VERSION = 1
ENTITIES = {
    '00075370': {'name': 'Statutární město Plzeň', 'identity_source': 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/00075370'},
    '65993390': {'name': 'Ředitelství silnic a dálnic s. p.', 'identity_source': 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/65993390'},
    '70994234': {'name': 'Správa železnic, státní organizace', 'identity_source': 'https://provoz.spravazeleznic.cz/Portal/ViewArticle.aspx?oid=1788149'},
}

def now():
    return datetime.now(timezone.utc).isoformat()

def local(tag):
    return tag.rsplit('}', 1)[-1]

def child_text(element, name):
    return next((c.text for c in element if local(c.tag) == name), None)

def normalize_ico(value):
    value = (value or '').strip()
    return value.zfill(8) if value.isascii() and value.isdigit() and len(value) <= 8 else value

def sha256_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def atomic_json(path, payload):
    temporary = path.with_suffix(path.suffix + '.part')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    os.replace(temporary, path)

def monthly_entries(index):
    months = []
    seen = set()
    for element in ET.fromstring(index):
        if local(element.tag) != 'dump' or child_text(element, 'den') is not None:
            continue  # Daily and monthly exports overlap; use only monthly exports.
        fields = {local(c.tag): c.text for c in element}
        period = f"{int(fields['rok']):04d}-{int(fields['mesic']):02d}"
        if period in seen:
            raise ValueError(f'Duplicate monthly dump: {period}')
        seen.add(period)
        hash_element = next(c for c in element if local(c.tag) == 'hashDumpu')
        algorithm = hash_element.attrib['algoritmus'].lower()
        algorithm = {'sha2': 'sha256'}.get(algorithm, algorithm)
        if algorithm not in ('sha1', 'sha256'):
            raise ValueError(f'Unsupported integrity algorithm {algorithm}')
        url = fields['odkaz']
        if url != f"https://data.smlouvy.gov.cz/dump_{period.replace('-', '_')}.xml":
            raise ValueError(f'Unexpected dump URL: {url}')
        months.append({'period': period, 'url': url, 'hash_algorithm': algorithm,
            'expected_hash': fields['hashDumpu'], 'expected_bytes': int(fields['velikostDumpu']),
            'source_generated_at': fields['casGenerovani'], 'completed_month': fields['dokoncenyMesic'] == '1'})
    return sorted(months, key=lambda row: row['period'])

def fingerprint(entry):
    return hashlib.sha256(json.dumps({'entry': entry, 'entities': sorted(ENTITIES),
        'extractor_version': VERSION}, sort_keys=True).encode()).hexdigest()

class HashedReader:
    def __init__(self, stream, algorithm):
        self.stream, self.digest, self.byte_count = stream, hashlib.new(algorithm), 0

    def read(self, size=-1):
        chunk = self.stream.read(size)
        self.digest.update(chunk)
        self.byte_count += len(chunk)
        return chunk

def extract_record(element):
    matched = sorted({normalize_ico(c.text) for c in element.iter() if local(c.tag) == 'ico'} & ENTITIES.keys())
    if not matched:
        return None
    identifier = next((c for c in element if local(c.tag) == 'identifikator'), None)
    if identifier is None:
        raise ValueError('Matched record missing identifier')
    contract_id, version_id = child_text(identifier, 'idSmlouvy'), child_text(identifier, 'idVerze')
    if not contract_id or not version_id:
        raise ValueError('Matched record missing contract/version ID')
    agreement = next((c for c in element if local(c.tag) == 'smlouva'), None)
    prices = {local(c.tag): {'text': c.text, 'xml': ET.tostring(c, encoding='unicode')}
        for c in agreement if local(c.tag) in ('hodnotaBezDph', 'hodnotaVcetneDph', 'ciziMena')} if agreement is not None else {}
    return {'contract_id': contract_id, 'version_id': version_id,
        'valid_record_raw': child_text(element, 'platnyZaznam'),
        'published_at': child_text(element, 'casZverejneni'), 'url': child_text(element, 'odkaz'),
        'matched_icos': matched, 'source_price_fields': prices,
        'metadata_xml': ET.tostring(element, encoding='unicode')}

def parse_dump(stream, entry, output):
    reader = HashedReader(stream, entry['hash_algorithm'])
    events = ET.iterparse(reader, events=('start', 'end'))
    _, root = next(events)
    if local(root.tag) != 'mesic' and local(root.tag) != 'dump':
        # The documented monthly envelope is mesic; accept observed schema naming
        # only after checking its own year/month metadata below.
        if local(root.tag) != 'monthly':
            raise ValueError(f'Unexpected monthly envelope: {root.tag}')
    total = matched_count = 0
    counts, validity = Counter(), Counter()
    header = {}
    for event, element in events:
        if event != 'end':
            continue
        if local(element.tag) == 'zaznam':
            total += 1
            record = extract_record(element)
            if record:
                record['source_period'] = entry['period']
                output.write(json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n')
                matched_count += 1
                counts.update(record['matched_icos'])
                validity.update([record['valid_record_raw']])
            root.clear()  # Release complete records; memory does not grow with dump size.
        elif element in root and local(element.tag) in ('mesic', 'rok', 'casGenerovani', 'dokoncenyMesic'):
            header[local(element.tag)] = element.text
    if reader.byte_count != entry['expected_bytes'] or reader.digest.hexdigest() != entry['expected_hash']:
        raise ValueError(f"Integrity mismatch {entry['period']}: {reader.byte_count} bytes, {reader.digest.hexdigest()}")
    if header.get('casGenerovani') != entry['source_generated_at']:
        raise ValueError('Dump generation time differs from frozen index')
    if (header.get('dokoncenyMesic') == '1') != entry['completed_month']:
        raise ValueError('Dump completion status differs from frozen index')
    if f"{int(header['rok']):04d}-{int(header['mesic']):02d}" != entry['period']:
        raise ValueError('Dump period differs from index')
    return {'records_scanned': total, 'matched_versions': matched_count,
        'versions_by_entity': {ico: counts[ico] for ico in ENTITIES}, 'validity_counts': dict(validity),
        'verified_hash': reader.digest.hexdigest(), 'verified_bytes': reader.byte_count,
        'dump_header': header}

def cached_month(out, entry):
    metadata = out / f"{entry['period']}.meta.json"
    artifact = out / f"{entry['period']}.jsonl.gz"
    if not metadata.exists() or not artifact.exists():
        return None
    try:
        status = json.loads(metadata.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    if status.get('fingerprint') != fingerprint(entry) or sha256_file(artifact) != status.get('artifact_sha256'):
        return None
    return status

def acquire_month(out, entry):
    artifact = out / f"{entry['period']}.jsonl.gz"
    temporary = artifact.with_suffix('.gz.part')
    started = now()
    process = subprocess.Popen(['curl', '-fLsS', '--max-time', '900', '--speed-limit', '1000', '--speed-time', '60', entry['url']],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        with gzip.open(temporary, 'wt', encoding='utf-8', compresslevel=6) as output:
            status = parse_dump(process.stdout, entry, output)
        _, error = process.communicate()
        if process.returncode:
            raise RuntimeError(f'curl failed {process.returncode}: {error.decode()[:1000]}')
        status.update(entry)
        status.update({'fingerprint': fingerprint(entry), 'extractor_version': VERSION,
            'retrieval_started_at': started, 'retrieved_at': now(), 'artifact': artifact.name,
            'artifact_sha256': sha256_file(temporary), 'artifact_bytes': temporary.stat().st_size})
        os.replace(temporary, artifact)
        atomic_json(out / f"{entry['period']}.meta.json", status)
        return status
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
        temporary.unlink(missing_ok=True)

def write_manifest(out, entries, statuses, index_hash):
    completed = {s['period'] for s in statuses}
    atomic_json(out / 'manifest.v1.json', {'schema_version': '1.0.0', 'generated_at': now(),
        'source': {'provider': 'Registr smluv', 'title': 'Official monthly metadata dumps', 'url': INDEX_URL,
            'index_sha256': index_hash, 'documentation_url': 'https://smlouvy.gov.cz/stranka/otevrena-data'},
        'entities': ENTITIES, 'coverage': {'indexed_months': len(entries), 'ingested_months': len(statuses),
            'pending_months': [e['period'] for e in entries if e['period'] not in completed],
            'complete_for_index': len(statuses) == len(entries),
            'selection': 'Any publisher or contracting-party ICO matches the fixed three-entity scope. Monthly dumps only.',
            'limitations': 'Matched published versions only. Versions where the target ICO is absent are not inferred. Current-month dump is partial. Missing versions and withdrawn contracts are not reconstructed.'},
        'semantics': 'Contract ID groups versions; version ID identifies one publication. Validity is the native record flag, not an independent legal-validity assessment. Versions and amendments must not be summed as expenditure. Full XML metadata includes all parties, native prices/currency, attachment links/hashes; no attachments downloaded.',
        'months': sorted(statuses, key=lambda s: s['period'])})

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', type=Path, help='Frozen official index XML; otherwise fetch current index')
    parser.add_argument('--out', type=Path, default=OUT)
    parser.add_argument('--limit', type=int, help='Limit network processing, retaining full indexed coverage in manifest')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    if args.index:
        index = args.index.read_bytes()
    else:
        index = subprocess.check_output(['curl', '-fLsS', '--max-time', '60', INDEX_URL])
    entries = monthly_entries(index)
    index_hash = hashlib.sha256(index).hexdigest()
    (args.out / 'index.xml').write_bytes(index)
    statuses = []
    todo = []
    for entry in entries:
        previous = cached_month(args.out, entry)
        if previous:
            statuses.append(previous)
        else:
            todo.append(entry)
    write_manifest(args.out, entries, statuses, index_hash)
    # Newest complete months first provide a usable baseline even if interrupted.
    todo.sort(key=lambda e: (e['completed_month'], e['period']), reverse=True)
    if args.limit is not None:
        todo = todo[:args.limit]
    for entry in todo:
        for attempt in range(3):
            try:
                status = acquire_month(args.out, entry)
                break
            except Exception as error:
                print(f"{entry['period']} attempt {attempt + 1}: {error}", flush=True)
                if attempt == 2:
                    raise
                time.sleep(2)
        statuses.append(status)
        write_manifest(args.out, entries, statuses, index_hash)
        print(f"{len(statuses)}/{len(entries)} {entry['period']}: {status['records_scanned']} scanned, {status['matched_versions']} matched, {status['artifact_bytes']} compressed bytes", flush=True)

if __name__ == '__main__':
    main()
