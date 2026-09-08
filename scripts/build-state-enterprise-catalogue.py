#!/usr/bin/env python3
"""Expand the international comparison with the sourced Czech state inventory."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def build():
    path = ROOT / 'data/state-owned-enterprises.v1.json'
    catalogue = json.loads(path.read_text())
    inventory = json.loads((ROOT / 'data/cz-public-entities-2024.json').read_text())
    strategic = json.loads((ROOT / 'data/cz-state-enterprises-2024.json').read_text())
    source = strategic['sources'][0]
    # Retain the existing, explicitly scoped international comparison values.
    retained = {'45274649': 'CZE-CEZ', '26463318': 'CZE-OTE', '60193531': 'CZE-CEPRO'}
    records = [r for r in catalogue['records'] if not r.get('inventory_ico')]
    for row in inventory['entities']:
        if row['category'] != 'Firma' or row['owner_level'] != 'Stát':
            continue
        if row['ico'] in retained:
            next(r for r in records if r['id'] == retained[row['ico']])['ico'] = row['ico']
            continue
        financial = row['strategic_highlight']
        sector = row.get('classification', {}).get('sector_code', 'other')
        note_en = 'Individual entity, not consolidated group accounts. ' if financial else 'Revenue is not available in the current dataset. '
        note_cs = 'Samostatný subjekt, nikoli konsolidovaná skupina. ' if financial else 'Výnosy nejsou v aktuálním datasetu dostupné. '
        if sector == 'finance':
            note_en += 'Financial institution: turnover is not directly comparable with non-financial company revenue. '
            note_cs += 'Finanční instituce: obrat není přímo srovnatelný s výnosy nefinančních firem. '
        records.append(dict(id=f"CZE-{row['ico']}", inventory_ico=row['ico'], ico=row['ico'], country_code='CZE', country_cs='Česko', country_en='Czechia', company=row['name'], sector=sector, source_revenue_m=row['revenue_mczk'], currency='CZK', period='2024', ownership_pct=None, ownership_cs='Stát — přesný podíl neuveden', ownership_en='State-controlled — exact share not supplied', metric_cs='obrat samostatného subjektu' if financial else 'Výnosy nedostupné', metric_en='individual-entity turnover' if financial else 'Revenue unavailable', note_cs=note_cs+'Přesný vlastnický podíl není v inventáři uveden.', note_en=note_en+'The inventory does not supply an exact ownership percentage.', source_title=source['title'] if financial else inventory['sources'][0]['item'], source_url=source['url'] if financial else inventory['sources'][0]['url']))
    catalogue['records'] = records
    catalogue['coverage'] = 'Czech state-controlled companies from the 2024 public-entity inventory, plus three selected enterprises per other comparison country. Missing revenue and ownership shares remain null; this is not a complete state portfolio.'
    catalogue['as_of'] = '2026-09-08'
    path.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2)+'\n')

if __name__ == '__main__':
    build()
