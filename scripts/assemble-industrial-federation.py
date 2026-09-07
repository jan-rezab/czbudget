#!/usr/bin/env python3
"""Retain both source channels; do not equate or replace economic observations."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path


def assemble(national, eurostat, output):
    if output.exists() and any(output.iterdir()):
        raise ValueError('Choose a new output directory to retain previous versions')
    output.mkdir(parents=True, exist_ok=True)
    observations, ids, sources = [], set(), []
    for channel, folder in [('national', national), ('eurostat', eurostat)]:
        manifest = json.loads((folder / 'manifest.json').read_text())
        assets = {entry['raw_file']: entry for entry in manifest}
        for entry in assets.values():
            assert hashlib.sha256(Path(entry['raw_file']).read_bytes()).hexdigest() == entry['sha256']
        sources.append(dict(channel=channel, folder=str(folder), observations_sha256=hashlib.sha256((folder / 'observations.jsonl').read_bytes()).hexdigest()))
        for line in (folder / 'observations.jsonl').read_text().splitlines():
            row = json.loads(line)
            identity = [channel, row['country'], row['dataset'], row['series_id'], row['frequency'], row['period'], assets[row['raw_file']]['sha256']]
            key = hashlib.sha256(json.dumps(identity, separators=(',', ':')).encode()).hexdigest()
            assert key not in ids, f'Duplicate source observation: {identity}'
            ids.add(key)
            row.update(observation_id=key, source_channel=channel, mapping_status='not_assessed',
                       method_version='industrial-federation/1.0.0')
            row.setdefault('disseminator', row['publisher'])
            row.setdefault('publication_at', None)
            row.setdefault('vintage_at', None)
            observations.append(row)
    blob = ''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in observations).encode()
    (output / 'observations.jsonl').write_bytes(blob)
    (output / 'observations.jsonl.gz').write_bytes(gzip.compress(blob, mtime=0))
    coverage = []
    for country in sorted({r['country'] for r in observations}):
        item = dict(country=country)
        for channel in ['national', 'eurostat']:
            rows = [r for r in observations if r['country'] == country and r['source_channel'] == channel]
            item[channel] = dict(observations=len(rows), monthly_periods=sorted({r['period'] for r in rows if r['frequency'] == 'M'}))
        coverage.append(item)
    report = dict(method_version='industrial-federation/1.0.0', observations=len(observations), inputs=sources, countries=coverage,
                  comparison_status='Source overlay only. No approved semantic mappings or numeric reconciliation; counts do not measure agreement.',
                  eurostat_request_coverage=json.loads((eurostat / 'coverage.json').read_text()))
    (output / 'coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    table = ['# Národní zdroje a Eurostat, 2026', '',
             'Obě distribuční cesty jsou zachované. Jde o společnou zdrojovou vrstvu; ekonomická ekvivalence řad není automaticky schválena.', '',
             '| Země | Národní: počet | Eurostat: počet | Národní poslední měsíc | Eurostat poslední měsíc |',
             '|---|---:|---:|---|---|']
    for item in coverage:
        n, e = item['national'], item['eurostat']
        table.append(f"| {item['country']} | {n['observations']} | {e['observations']} | {max(n['monthly_periods'], default='—')} | {max(e['monthly_periods'], default='—')} |")
    table += ['', 'Počty obsahují různé ukazatele, očištění a překrývající se agregáty. Rozdíl počtů neměří kvalitu ani počet shodných řad.',
              'Prázdná země Eurostatu znamená, že dotaz nevrátil pozorování za rok 2026. Podrobnosti žádostí jsou v coverage.json.',
              'Každý záznam má source_channel, původní řadu, zdrojový soubor a mapping_status=not_assessed.',
              'publication_at a vintage_at zůstávají null, nejsou-li doloženy; timestamp datasetu Eurostatu je samostatné pole.', '']
    (output / 'README.md').write_text('\n'.join(table))
    print(json.dumps(dict(observations=len(observations), countries=len(coverage)), indent=2))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for arg in ['national', 'eurostat', 'output']:
        p.add_argument('--' + arg, type=Path, required=True)
    args = p.parse_args()
    assemble(args.national.resolve(), args.eurostat.resolve(), args.output.resolve())
