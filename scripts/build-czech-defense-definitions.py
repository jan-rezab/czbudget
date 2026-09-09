#!/usr/bin/env python3
"""Keep NATO core defence and national chapter outturn as distinct Czech series.

NATO's image-only PDF uses a reviewed, hash-pinned Czech transcription. Ministry
tables 1a/1b are extracted from PDF text, with monetary units and stages retained.
"""
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT.parent / 'data/sources/defense'
MO_URL = 'https://mocr.mo.gov.cz/assets/finance-a-zakazky/resortni-rozpocet/szu_2025.pdf'
MO_SHA256 = '53410a5d3a9e1ae0eec5edc8171b41025e0272f750ea172f4d7bb86a6fe36b0f'
LABELS = {
    'total': 'Výdaje celkem',
    'armed_forces': 'Zajištění obrany ČR silami Armády ČR',
    'defence_system': 'Vytváření a rozvoj systému obrany státu',
    'intelligence': 'Zajištění strategického zpravodajství',
    'presidential_support': 'Zajištění podpory prezidenta republiky ve funkci vrchního velitele ozbrojených',
    'pensions': 'Zajištění dávek důchodového pojištění',
    'service_benefits': 'Zajištění dávek výsluhových náležitostí',
    'sport': 'Zajištění státní sportovní reprezentace',
}
EN = {'total': 'Total chapter expenditure', 'armed_forces': 'Armed forces',
    'defence_system': 'Development of the defence system', 'intelligence': 'Strategic intelligence',
    'presidential_support': 'Support for the president as commander-in-chief', 'pensions': 'Pensions',
    'service_benefits': 'Service benefits', 'sport': 'National sporting representation'}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def row_values(page, label, count):
    lines = page.splitlines()
    index = next(i for i, line in enumerate(lines) if line.strip().startswith(label))
    text = lines[index]
    if not re.findall(r'\d[\d ]*,\d{2}', text) and index + 1 < len(lines) and re.match(r'\s*\d', lines[index + 1]):
        text += ' ' + lines[index + 1]
    values = re.findall(r'\d[\d ]*,\d{2}', text)
    if len(values) < count:
        raise ValueError(f'Incomplete money row: {label}')
    return [Decimal(value.replace(' ', '').replace(',', '.')) for value in values[:count]]

def nato_data():
    fixture = json.loads((ROOT / 'pipeline/config/defense/nato-czech-2026-transcription.json').read_text())
    path = SOURCES / 'nato-def-exp-2026-en.pdf'
    if digest(path) != fixture['source_sha256']:
        raise ValueError('NATO PDF changed: review the Czech transcription before rebuilding')
    observations = []
    for i, year in enumerate(fixture['years']):
        categories = {key: row['values'][i] for key, row in fixture['categories'].items()}
        if abs(sum(categories.values()) - 100) > .025:
            raise ValueError(f'NATO categories do not reconcile at published rounding: {year}')
        observations.append({'year': year, 'status': 'estimate' if year in fixture['estimate_years'] else 'reported',
            'source_flag': 'e' if year in fixture['estimate_years'] else None,
            'categories_pct_core_defence': categories,
            'total_current_million_czk': fixture['totals']['current_prices']['values'][i],
            'total_constant_2021_million_czk': fixture['totals']['constant_2021_prices']['values'][i]})
    return {'definition': 'NATO core defence expenditure', 'source': {'provider': 'NATO',
        'title': 'Defence Investment of NATO Countries (2014–2026)', 'url': fixture['source_url'],
        'edition': '2026 compendium', 'information_cutoff': fixture['cutoff_date'],
        'retrieved_at': '2026-09-09', 'sha256': fixture['source_sha256']},
        'method': fixture['method'], 'source_locations': {'categories': 'Tables 8a/8b, PDF pages 12/13, Czechia rows',
            'totals': 'Table 1, PDF page 5, Czechia rows', 'estimate_flags': 'PDF page 1'},
        'category_definitions': {'equipment': 'Major equipment and associated R&D',
            'personnel': 'Military and civilian personnel, including pensions',
            'infrastructure': 'NATO common and national military construction',
            'other': 'Operations, maintenance, other R&D and other core expenditure'},
        'observations': observations}

def chapter_data():
    path = SOURCES / 'mo-szu-2025.pdf'
    if digest(path) != MO_SHA256:
        raise ValueError('MO PDF changed: review the source dates and table layout before rebuilding')
    pages = subprocess.check_output(['pdftotext', '-layout', str(path), '-']).decode().split('\f')
    a = next((i, p) for i, p in enumerate(pages, 1) if 'Plnění závazných ukazatelů (tis. Kč)' in p and 'Tabulka č. 1a' in p)
    b = next((i, p) for i, p in enumerate(pages, 1) if 'Plnění závazných ukazatelů v uplynulých 5 letech' in p and 'Tabulka č. 1b' in p)
    history, stages = {}, {}
    for key, label in LABELS.items():
        history[key] = row_values(b[1], label, 5)
        stages[key] = row_values(a[1], label, 5)  # 2024 actual, approved, amended, final, 2025 actual.
        if history[key][-1] != stages[key][-1]:
            raise ValueError(f'Tables 1a/1b disagree: {key}')
    for i, year in enumerate(range(2021, 2026)):
        if abs(sum(values[i] for key, values in history.items() if key != 'total') - history['total'][i]) > Decimal('.04'):
            raise ValueError(f'Chapter components do not reconcile: {year}')
    observations = [{'year': year, 'status': 'reported_outturn', 'unit': 'thousand_CZK',
        'total': float(history['total'][i]), 'components': {key: float(values[i]) for key, values in history.items() if key != 'total'}}
        for i, year in enumerate(range(2021, 2026))]
    return {'definition': 'Czech state budget chapter 307 Ministry of Defence', 'chapter': '307',
        'source': {'provider': 'Ministerstvo obrany ČR', 'title': 'Návrh závěrečného účtu kapitoly 307 za rok 2025',
            'url': MO_URL, 'edition': '2025 final-account proposal', 'document_date': '2026-03-27',
            'published_at': '2026-05-13', 'retrieved_at': '2026-09-09', 'sha256': digest(path)},
        'document_status': 'Final-account proposal as titled in the published document; approval not independently established.',
        'source_locations': {'history': f'Table 1b, PDF page {b[0]}', 'budget_stages': f'Table 1a, PDF page {a[0]}',
            'table_generated_at': '2026-02-02', 'original_system': 'IISSP'},
        'component_labels': {key: {'cs': label + (' sil' if key == 'presidential_support' else ''), 'en': EN[key]} for key, label in LABELS.items()},
        'observations': observations,
        'budget_stages_2025': {stage: {'unit': 'thousand_CZK', 'total': float(stages['total'][i]),
            'components': {key: float(values[i]) for key, values in stages.items() if key != 'total'}}
            for stage, i in [('approved', 1), ('amended', 2), ('final_budget', 3), ('reported_outturn', 4)]}}

def main():
    payload = {'schema_version': '1.0.0', 'dataset_id': 'CZE_DEFENSE_DEFINITIONS_V1',
        'generated_at': datetime.now(timezone.utc).isoformat(), 'country_code': 'CZE',
        'nato_core': nato_data(), 'chapter_307': chapter_data(),
        'sipri_artifact': 'data/czech-sipri-military-expenditure.v1.json',
        'comparability': 'SIPRI military expenditure, NATO core defence, and chapter 307 have distinct definitions, source vintages and stages. No common total, category bridge, eligibility ruling or reconciliation across these concepts is inferred.'}
    target = ROOT / 'data/czech-defense-definitions.v1.json'
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    defense_path = ROOT / 'data/defense-deep-dive.v1.json'
    defense = json.loads(defense_path.read_text())
    czech = next(row for row in defense['countries'] if row['code'] == 'CZE')
    czech['definition_detail'] = {'artifact': 'data/czech-defense-definitions.v1.json',
        'nato_latest': payload['nato_core']['observations'][-1], 'nato_source': payload['nato_core']['source'],
        'chapter_latest': payload['chapter_307']['observations'][-1], 'chapter_source': payload['chapter_307']['source']}
    defense['generated_at'] = payload['generated_at']
    defense_path.write_text(json.dumps(defense, ensure_ascii=False, indent=2) + '\n')
    print(f'Wrote {target}: NATO 2014–2026, chapter outturn 2021–2025 and 2025 budget stages')

if __name__ == '__main__':
    main()
