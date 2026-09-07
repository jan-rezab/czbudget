#!/usr/bin/env python3
"""Build small, country-partitioned public chart data from immutable source rows."""
import argparse
from collections import defaultdict
import datetime as dt
import gzip
import hashlib
import json
from pathlib import Path
import re

COUNTRY_NAMES = {
    'CZE': ('Česko', 'Czechia'), 'GBR': ('Spojené království', 'United Kingdom'), 'USA': ('Spojené státy', 'United States'),
    'ALB': ('Albánie', 'Albania'), 'AUT': ('Rakousko', 'Austria'), 'BEL': ('Belgie', 'Belgium'), 'BGR': ('Bulharsko', 'Bulgaria'),
    'BIH': ('Bosna a Hercegovina', 'Bosnia and Herzegovina'), 'CHE': ('Švýcarsko', 'Switzerland'), 'CYP': ('Kypr', 'Cyprus'),
    'DEU': ('Německo', 'Germany'), 'DNK': ('Dánsko', 'Denmark'), 'ESP': ('Španělsko', 'Spain'), 'EST': ('Estonsko', 'Estonia'),
    'FIN': ('Finsko', 'Finland'), 'FRA': ('Francie', 'France'), 'GRC': ('Řecko', 'Greece'), 'HRV': ('Chorvatsko', 'Croatia'),
    'HUN': ('Maďarsko', 'Hungary'), 'IRL': ('Irsko', 'Ireland'), 'ITA': ('Itálie', 'Italy'), 'LTU': ('Litva', 'Lithuania'),
    'LUX': ('Lucembursko', 'Luxembourg'), 'LVA': ('Lotyšsko', 'Latvia'), 'MKD': ('Severní Makedonie', 'North Macedonia'),
    'MLT': ('Malta', 'Malta'), 'MNE': ('Černá Hora', 'Montenegro'), 'NLD': ('Nizozemsko', 'Netherlands'), 'NOR': ('Norsko', 'Norway'),
    'POL': ('Polsko', 'Poland'), 'PRT': ('Portugalsko', 'Portugal'), 'ROU': ('Rumunsko', 'Romania'), 'SRB': ('Srbsko', 'Serbia'),
    'SVK': ('Slovensko', 'Slovakia'), 'SVN': ('Slovinsko', 'Slovenia'), 'SWE': ('Švédsko', 'Sweden'), 'TUR': ('Turecko', 'Türkiye'),
    'UKR': ('Ukrajina', 'Ukraine'), 'EU27_2020': ('Evropská unie (27 zemí)', 'European Union (27 countries)'),
    'EU28': ('Evropská unie (28 zemí)', 'European Union (28 countries)'), 'EA21': ('Eurozóna (21 zemí)', 'Euro area (21 countries)'),
    'EA20': ('Eurozóna (20 zemí)', 'Euro area (20 countries)'), 'EA19': ('Eurozóna (19 zemí)', 'Euro area (19 countries)'),
}
# Display translations only. Original codes and full labels remain in each series.
LABELS = {
    'B': ('Těžba a dobývání', 'Mining and quarrying'), 'C': ('Zpracovatelský průmysl', 'Manufacturing'),
    'D': ('Elektřina, plyn a teplo', 'Electricity, gas, steam and air conditioning'), 'E': ('Voda a odpady', 'Water and waste'),
    '05': ('Uhlí', 'Coal and lignite'), '06': ('Ropa a zemní plyn', 'Crude petroleum and natural gas'), '07': ('Rudné suroviny', 'Metal ores'),
    '08': ('Ostatní těžba', 'Other mining and quarrying'), '09': ('Podpůrné činnosti při těžbě', 'Mining support services'),
    '10': ('Potraviny', 'Food products'), '11': ('Nápoje', 'Beverages'), '12': ('Tabákové výrobky', 'Tobacco products'),
    '13': ('Textil', 'Textiles'), '14': ('Oděvy', 'Wearing apparel'), '15': ('Kůže a obuv', 'Leather and related products'),
    '16': ('Dřevozpracující průmysl', 'Wood products'), '17': ('Papír', 'Paper products'), '18': ('Tisk a rozmnožování nosičů', 'Printing and recorded media'),
    '19': ('Koks a rafinované ropné produkty', 'Coke and refined petroleum'), '20': ('Chemický průmysl', 'Chemicals'),
    '21': ('Farmaceutický průmysl', 'Pharmaceuticals'), '22': ('Plasty a pryž', 'Rubber and plastics'), '23': ('Ostatní nekovové minerální výrobky', 'Other non-metallic minerals'),
    '24': ('Hutě a základní kovy', 'Basic metals'), '25': ('Kovodělné výrobky', 'Fabricated metal products'), '26': ('Počítače, elektronika a optika', 'Computers, electronics and optics'),
    '27': ('Elektrická zařízení', 'Electrical equipment'), '28': ('Stroje a zařízení', 'Machinery and equipment'),
    '29': ('Motorová vozidla', 'Motor vehicles'), '30': ('Ostatní dopravní prostředky', 'Other transport equipment'),
    '31': ('Nábytek', 'Furniture'), '32': ('Ostatní zpracovatelský průmysl', 'Other manufacturing'), '33': ('Opravy a instalace strojů', 'Repair and installation'),
    '35': ('Elektřina, plyn a teplo', 'Electricity, gas and steam'), '36': ('Zásobování vodou', 'Water supply'),
    '37': ('Odpadní vody', 'Sewerage'), '38': ('Odpady a recyklace', 'Waste and recycling'), '39': ('Sanace a jiné nakládání s odpady', 'Remediation and other waste management'),
}


def classify(row):
    code = row['industry_code']
    country = row['country']
    totals = {'B-D', 'B-E', 'B-F', 'BCD', 'A21-BCD', 'A2P100000', 'B50001'}
    if code in totals:
        return 'total', True
    if country == 'USA':
        return ('division' if re.fullmatch(r'G\d{3}', code) else 'section' if code in ['GMF', 'G21', 'G22'] else 'detail'), False
    if re.fullmatch(r'(?:[BCDE])?\d{2}', code):
        return 'division', False
    if re.fullmatch(r'[BCDE]|A21-[BCDE]|N2[BCDE]000000', code):
        return 'section', False
    if re.fullmatch(r'(?:[BCDE])?\d{3,}|\d{2}[._-]\d{1,2}', code):
        return 'detail', False
    return 'aggregate', False


def labels(row):
    original = row['industry_label'].strip()
    code = row['industry_code']
    clean = re.sub(r'^.*?\(base 100 in 2021\) [–-] ', '', original)
    clean = re.sub(r' \((?:NAF rev\. 2|MIG),.*$', '', clean)
    _, total = classify(row)
    if total:
        suffix = 'B–E' if code == 'B-E' else 'B–F' if code == 'B-F' else ''
        return ('Průmysl celkem' + (' (' + suffix + ')' if suffix else ''), 'Total industry' + (' (' + suffix + ')' if suffix else ''))
    normalized = re.sub(r'^[BCDE](?=\d{2}$)', '', code)
    if row['country'] != 'USA' and normalized in LABELS:
        return LABELS[normalized]
    if code.startswith('A21-') and code[4:] in LABELS:
        return LABELS[code[4:]]
    return clean, clean


def notes(row, derived):
    cs, en = [], []
    if derived:
        cs.append('Změna je vypočtená z publikovaných indexů; zaokrouhlení může ovlivnit poslední desetinné místo.')
        en.append('Change calculated from published indices; input rounding can affect the last decimal.')
    if row['country'] == 'POL' and row['channel'] == 'national':
        cs.append('Prodaná produkce podniků s alespoň 10 zaměstnanými; samostatná měsíční vydání.')
        en.append('Sold production of businesses with at least 10 persons employed; separate monthly releases.')
    if row['country'] == 'UKR':
        cs.append('Územní pokrytí omezené okupací a boji.'); en.append('Territorial coverage affected by occupation and combat.')
    if row['country'] == 'CHE' and row['channel'] == 'national':
        cs.append('Měsíční výsledky vydávané čtvrtletně.'); en.append('Monthly observations published quarterly.')
    if row['country'] == 'FRA' and row['channel'] == 'national':
        cs.append('Metropolitní Francie.'); en.append('Metropolitan France.')
    if row['frequency'] == 'A':
        cs.append('Oficiální roční řada; změna celého roku, nikoli prosinec proti prosinci.')
        en.append('Official annual series; full-year change, not December against December.')
    cs.append('Národní a eurostatové řady se nepřepisují ani automaticky neslučují.')
    en.append('National and Eurostat series are preserved separately, without automatic merging.')
    return ' '.join(cs), ' '.join(en)


def build(inputs, output):
    countries = {}
    series = defaultdict(dict)
    total_input, skipped = 0, defaultdict(int)
    for channel, file in inputs:
        with (gzip.open(file, 'rt') if file.suffix == '.gz' else file.open()) as stream:
            for line in stream:
                row = json.loads(line)
                total_input += 1
                row['channel'] = channel
                if row['frequency'] not in ['M', 'A']:
                    skipped['frequency'] += 1
                    continue
                if row['measure'] in ['yoy_index', 'mom_index']:
                    row = dict(row, measure='yoy_pct' if row['measure'] == 'yoy_index' else 'mom_pct', value=row['value'] - 100,
                               base_period=None, unit='percent', transformation='source index minus 100')
                if row['measure'] not in ['index', 'yoy_pct', 'mom_pct']:
                    skipped['measure'] += 1
                    continue
                # Offer the current Eurostat reference basis; old bases remain in the archive.
                if channel == 'eurostat' and row['measure'] == 'index' and row['base_period'] != '2021':
                    skipped['old_index_base'] += 1
                    continue
                country = row['country']
                name = row.get('country_name', country)
                names = COUNTRY_NAMES.get(country, (name, name))
                countries[country] = dict(code=country, name_cs=names[0], name_en=names[1], type=row.get('geography_type', 'country'))
                identity = [channel, row['dataset'], row['series_id'], row['measure'], row['frequency'], row['adjustment'], row['base_period']]
                key = hashlib.sha256(json.dumps(identity).encode()).hexdigest()[:20]
                derived = bool(row.get('derived')) or row.get('transformation', 'none') not in ['none', None, 'source index minus 100']
                point = dict(period=row['period'], value=row['value'], status=row['status'], derived=derived,
                             source_status=row.get('source_status'))
                if key not in series[country]:
                    level, is_total = classify(row)
                    cs, en = labels(row)
                    notes_cs, notes_en = notes(row, derived)
                    series[country][key] = dict(id=key, source_series_id=row['series_id'], industry_code=row['industry_code'], label_cs=cs, label_en=en,
                        original_label=row['industry_label'], channel=channel, publisher=row['publisher'], dataset=row['dataset'],
                        frequency=row['frequency'], measure=row['measure'], adjustment=row['adjustment'], unit=row['unit'], base_period=row['base_period'],
                        is_total=is_total, level=level, source_url=row['source_url'], retrieved_at=row['retrieved_at'],
                        notes_cs=notes_cs, notes_en=notes_en, points=[], _periods=set())
                item = series[country][key]
                assert point['period'] not in item['_periods'], f'Duplicate serving point: {country} {key} {point["period"]}'
                item['_periods'].add(point['period'])
                for field in ['source_url', 'retrieved_at']:
                    if row[field] != item[field]:
                        point[field] = row[field]
                item['points'].append(point)
    output.mkdir(parents=True, exist_ok=True)
    index = dict(generated_at=dt.datetime.now(dt.timezone.utc).isoformat(), countries=[], counts={},
                 method_version='industrial-federation/1.1.0', omitted_from_chart=dict(skipped), input_observations=total_input)
    all_points = 0
    for code, meta in sorted(countries.items()):
        items = list(series[code].values())
        for item in items:
            del item['_periods']
            item['points'].sort(key=lambda p: p['period'])
            all_points += len(item['points'])
        monthly = sorted({p['period'] for s in items if s['frequency'] == 'M' for p in s['points']})
        annual = sorted({p['period'] for s in items if s['frequency'] == 'A' for p in s['points']})
        index['countries'].append(dict(meta, file=f'/data/industry/{code}.json', monthly_periods=monthly, annual_periods=annual,
                                       channels=sorted({s['channel'] for s in items})))
        (output / f'{code}.json').write_text(json.dumps(dict(meta, series=items), ensure_ascii=False, separators=(',', ':')) + '\n')
    index['counts'] = dict(countries=sum(c['type'] == 'country' for c in index['countries']),
                           monthly_countries=sum(c['type'] == 'country' and bool(c['monthly_periods']) for c in index['countries']),
                           aggregates=sum(c['type'] == 'aggregate' for c in index['countries']), observations=all_points)
    (output / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(counts=index['counts'], skipped=dict(skipped))))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--national', required=True, type=Path)
    p.add_argument('--derived', required=True, type=Path)
    p.add_argument('--eurostat', required=True, type=Path)
    p.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'data/industry')
    args = p.parse_args()
    build([('national', args.national), ('national', args.derived), ('eurostat', args.eurostat)], args.output)
