#!/usr/bin/env python3
"""Validate and combine the four direct national download groups (no network)."""
import argparse
import collections
import datetime as dt
import hashlib
import gzip
import json
import math
from pathlib import Path
import re

COUNTRIES = ['CZE', 'UKR', 'POL', 'DEU', 'GBR', 'FRA', 'USA', 'CHE', 'SWE', 'DNK']
GROUPS = ['central', 'north', 'anglo', 'east-alpine']
REQUIRED = 'country publisher dataset series_id industry_code industry_label frequency period measure adjustment unit base_period value status source_url retrieved_at raw_file'.split()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input', type=Path, required=True)
    args = ap.parse_args()
    folder = args.input.resolve()
    rows, manifests, group_coverage = [], [], {}
    for group in GROUPS:
        path = folder / group
        group_coverage[group] = json.loads((path / 'coverage.json').read_text())
        manifest = json.loads((path / 'manifest.json').read_text())
        if isinstance(manifest, dict):
            manifest = manifest.get('files', manifest.get('downloads', manifest.get('assets')))
        assert isinstance(manifest, list), f'Unknown manifest shape: {group}'
        assets = {}
        for asset in manifest:
            file = Path(asset['raw_file']).resolve()
            raw = file.read_bytes()
            assert hashlib.sha256(raw).hexdigest() == asset['sha256'], f'Hash mismatch: {file}'
            assert len(raw) == asset['bytes'], f'Size mismatch: {file}'
            assets[str(file)] = asset
            manifests.append(dict(group=group, **asset))
        for line in (path / 'observations.jsonl').read_text().splitlines():
            row = json.loads(line)
            assert all(k in row for k in REQUIRED), f'Missing fields: {group}'
            assert row['country'] in COUNTRIES
            assert isinstance(row['value'], (int, float)) and math.isfinite(row['value'])
            assert re.fullmatch(r'2026-(0[1-9]|1[0-2]|Q[1-4])', row['period'])
            assert row['frequency'] == ('Q' if '-Q' in row['period'] else 'M')
            assert row['adjustment'] in ['NSA', 'CA', 'SA', 'SCA', 'unknown']
            asset = assets[str(Path(row['raw_file']).resolve())]
            assert row['source_url'] == asset['source_url']
            assert row['retrieved_at'] == asset['retrieved_at']
            if row.get('transformation') == 'source index minus 100':
                assert math.isclose(row['value'], row['raw_value'] - 100, abs_tol=1e-6)
            if row.get('transformation') == '100 * (current source index / comparison source index - 1)':
                assert math.isclose(row['value'], 100 * (row['raw_value'] / row['comparison_value'] - 1), abs_tol=1e-9)
            rows.append(row)
    keys = [(r['country'], r['dataset'], r['series_id'], r['frequency'], r['period']) for r in rows]
    assert len(keys) == len(set(keys)), 'Duplicate observations'
    assert {r['country'] for r in rows} == set(COUNTRIES), 'Missing country'
    rows.sort(key=lambda r: (COUNTRIES.index(r['country']), r['series_id'], r['period']))
    summary = []
    for country in COUNTRIES:
        subset = [r for r in rows if r['country'] == country]
        monthly = sorted({r['period'] for r in subset if r['frequency'] == 'M'})
        assert monthly and monthly[0] == '2026-01', f'Missing January: {country}'
        assert monthly == [f'2026-{i:02d}' for i in range(1, int(monthly[-1][-2:]) + 1)], f'Country month gap: {country}'
        series = collections.defaultdict(set)
        for r in subset:
            if r['frequency'] == 'M':
                series[r['dataset'] + ':' + r['series_id']].add(r['period'])
        incomplete = {k: sorted(set(monthly) - v) for k, v in series.items() if set(monthly) - v}
        summary.append(dict(country=country, observations=len(subset), monthly_periods=monthly,
                            quarterly_periods=sorted({r['period'] for r in subset if r['frequency'] == 'Q'}),
                            categories=len({r['industry_code'] for r in subset}), series=len({r['series_id'] for r in subset}),
                            measures=sorted({r['measure'] for r in subset}), incomplete_monthly_series=incomplete))
    result = dict(reference_year=2026, assembled_at=dt.datetime.now(dt.timezone.utc).isoformat(),
                  observations=len(rows), raw_files=len(manifests), raw_bytes=sum(a['bytes'] for a in manifests),
                  countries=summary, source_coverage=group_coverage,
                  validation=dict(unique_observations=True, finite_values=True, all_raw_hashes_verified=True,
                                  all_observations_linked_to_raw=True, country_months_contiguous=True))
    (folder / 'observations.jsonl').write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows))
    (folder / 'observations.jsonl.gz').write_bytes(gzip.compress((folder / 'observations.jsonl').read_bytes(), mtime=0))
    (folder / 'coverage.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    (folder / 'manifest.json').write_text(json.dumps(manifests, ensure_ascii=False, indent=2) + '\n')
    report = ['# Průmyslová produkce: přímé národní zdroje, rok 2026', '',
              f"Staženo {len(rows):,} pozorování z deseti zemí. Původní soubory: {result['raw_bytes']/1e6:.1f} MB.", '',
              '| Země | Měsíce 2026 | Kategorie zdroje | Pozorování |', '|---|---|---:|---:|']
    for s in summary:
        report.append(f"| {s['country']} | 01–{s['monthly_periods'][-1][-2:]} | {s['categories']} | {s['observations']} |")
    report += ['', '## Jak data číst', '',
               '- `observations.jsonl`: sjednocená pozorování; `coverage.json`: rozsah a omezení; `manifest.json`: zdroje, čas stažení a SHA256.',
               '- Jde o národní výběry a klasifikace, nikoli harmonizovanou sadu s identickým pokrytím odvětví. Kategorie obsahují také agregáty; nelze je sčítat.',
               '- Rozlišujte index, procentní změnu a očištění. Ukrajinské meziroční poměry mají základ 100: hodnota 98,3 znamená pokles 1,7 %, není to růst 98,3 %.',
               '- Počet měsíců označuje pokrytí země, ne každé dílčí řady. Chybějící měsíce jednotlivých řad jsou uvedeny v coverage.json.',
               '- Česko obsahuje také Q1 a Q2. Švýcarské měsíce jsou publikovány čtvrtletně. Francouzská rodina IPI a některé německé agregáty zahrnují stavebnictví.',
               '- Polsko: prodaná produkce podniků alespoň s deseti zaměstnanými. Ukrajina: územní omezení kvůli okupaci a bojům.',
               '- Německé CA/SCA změny jsou dopočtené z publikovaných zaokrouhlených indexů Bundesbank. Mohou se mírně lišit od oficiálního tempa; vzorec a vstupy jsou u každé hodnoty.',
               '- Stažené tabulky představují dostupnou verzi při stažení. Polské měsíce pocházejí z příslušných měsíčních vydání; nejsou garantovanou jednotnou pozdější revizí.',
               '- Obnovovací skripty jsou v website/scripts/fetch-industrial-*-2026.py. Pro nové stažení použijte novou výstupní složku, aby zůstal tento snapshot zachován.', '']
    (folder / 'README.md').write_text('\n'.join(report))
    print(json.dumps({k: result[k] for k in ['observations', 'raw_files', 'raw_bytes', 'validation']}, indent=2))


if __name__ == '__main__':
    main()
