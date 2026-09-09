#!/usr/bin/env python3
"""Build bounded geography shards, preserving DataPAQ values and their native scope."""
import argparse, collections, gzip, hashlib, json, tempfile, time
from pathlib import Path

def encoded(value): return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
def read(path): return json.loads(path.read_bytes())
def compressed(path, value):
    data = gzip.compress(encoded(value), mtime=0)
    path.write_bytes(data)
    return {'file': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def main():
    p = argparse.ArgumentParser(); p.add_argument('--snapshot', required=True); p.add_argument('--output', default='data/paq')
    args = p.parse_args(); raw = Path(args.snapshot); out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
    manifest = read(raw/'manifest.json')
    assert manifest.get('completed_at') and not manifest['errors'], 'Snapshot must finish without errors'
    assert len(manifest['responses']) == manifest['requested_jobs'], 'Incomplete snapshot'
    bootstrap = read(raw/'bootstrap.json')
    municipalities = read(Path('data/municipal-snapshot.v1.json'))['municipalities']
    # Crosswalk uses official territorial codes, never fuzzy names or IČO-as-RÚIAN.
    municipal_by_code = {str(e['territory']['municipality_code']): e for e in municipalities}
    regions = {}
    for region in bootstrap['regions']:
        level = region['region_granularity']['key']; code = str(region['code']); key = f'{level}:{code}'
        parent = region.get('parent_region')
        regions[key] = {'key': key, 'level': level, 'code': code, 'name': region['name'],
            'parent': f"{parent['region_granularity']['key']}:{parent['code']}" if parent else None}
        if level == 'obec' and code in municipal_by_code:
            entity = municipal_by_code[code]
            regions[key].update({'ico': entity['national_id'], 'profile': entity['seo']['path']})
    variables = {v['key']: read(raw/'metadata'/f"{v['id']}.json") for v in bootstrap['catalogue_variables']}
    fields = {}; field_ids = {}; expected = set(); received = set(); observations = 0; nonnull = 0
    region_counts = collections.Counter(); shards = []; source_counts = collections.Counter()
    with tempfile.TemporaryDirectory(prefix='paq-build-') as temporary:
        spool = [open(Path(temporary)/str(i), 'wb') for i in range(128)]
        for i, record in enumerate(manifest['responses']):
            data = (raw/'responses'/f"{record['id']}.json.gz").read_bytes()
            assert hashlib.sha256(data).hexdigest() == record['sha256'], 'Raw checksum mismatch'
            response = json.loads(gzip.decompress(data)); level = record['granularity']; measure_map = {}
            for m in record['requested_measures']:
                expected.update((level, m['variableKey'], m['valuesTypeKey'], period) for period in m['periodKeys'])
            for measure in response['measures']:
                identity = (level, measure['variable_key'], measure['values_type_key'], measure['period_key'])
                received.add(identity)
                field_key = level + ':' + measure['key']
                if field_key not in field_ids:
                    fid = str(len(field_ids)); field_ids[field_key] = fid
                    fields[fid] = dict(measure, granularity=level)
                measure_map[measure['key']] = field_ids[field_key]
            for row in response['rows']:
                region = row['region']; key = f"{level}:{region['code']}"
                if key not in regions:
                    regions[key] = {'key': key, 'level': level, 'code': str(region['code']), 'name': region['name'], 'parent': None}
                regions[key]['source_region'] = {k:v for k,v in region.items() if k not in ['orp_like_mine', 'orp_to_aspire']}
                values = {measure_map[k]: v for k, v in row['values'].items() if k in measure_map}
                observations += len(values); nonnull += sum(v.get('value') is not None for v in values.values())
                shard = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16) % 128
                regions[key]['shard'] = f'{shard:03d}.json.gz'
                spool[shard].write(encoded([key, values]) + b'\n')
            if i % 50 == 0: print(f'Normalize {i}/{len(manifest["responses"])}', flush=True)
        for handle in spool: handle.close()
        missing = sorted(expected - received)
        (out/'coverage-audit.json').write_bytes(encoded({'expected': len(expected), 'received': len(received), 'missing': missing}))
        assert not missing, f'{len(missing)} catalogue variants missing from API responses'
        unique_cells = 0
        for shard in range(128):
            objects = {}
            with open(Path(temporary)/str(shard), 'rb') as stream:
                for line in stream:
                    key, values = json.loads(line); obj = objects.setdefault(key, {})
                    for fid, value in values.items():
                        assert fid not in obj or obj[fid] == value, f'Conflicting duplicate {key}/{fid}'
                        obj[fid] = value
            unique_cells += sum(len(v) for v in objects.values())
            shards.append(compressed(out/f'{shard:03d}.json.gz', objects))
    for region in regions.values():
        if 'shard' in region: region_counts[region['level']] += 1
    assert unique_cells == observations, 'Unexpected duplicate observations'
    catalog = {'variables': variables, 'fields': fields, 'categories': bootstrap['catalogue_variable_categories']}
    shards.append(compressed(out/'catalog.json.gz', catalog))
    index = {k: manifest[k] for k in ['source','license','license_url','attribution','started_at','completed_at']}
    index.update({'schema_version': 1, 'variables': len(variables), 'fields': len(fields), 'observations': observations,
        'non_null_observations': nonnull, 'region_counts': dict(region_counts), 'regions': regions,
        'scope': 'All variants, periods and granularities enumerated by the public DataPAQ bootstrap endpoint. No respondent microdata or non-DataPAQ study data is implied.',
        'raw_manifest_sha256': hashlib.sha256((raw/'manifest.json').read_bytes()).hexdigest(), 'files': shards})
    (out/'index.json').write_bytes(encoded(index))
    links = {r['profile']:r['key'] for r in regions.values() if r.get('profile')}
    links.update({'/countries/czechia': 'stat:CZ', '/countries/cze': 'stat:CZ', '/cesko.html': 'stat:CZ'})
    import unicodedata
    for r in regions.values():
        if r['level'] == 'kraj':
            slug = unicodedata.normalize('NFKD', r['name']).encode('ascii','ignore').decode().lower().replace(' ', '-')
            if r['code'] == '3018': slug = 'praha'
            links[f'/cz/kraje/{slug}/'] = r['key']
    (out/'links.json').write_bytes(encoded(links))
    print(json.dumps({k:index[k] for k in ['variables','fields','observations','non_null_observations','region_counts']}, ensure_ascii=False), flush=True)

if __name__ == '__main__': main()
