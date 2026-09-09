#!/usr/bin/env python3
"""Build reviewed 2024 individual balance-sheet summaries (integer CZK).

Input is a manual transcription with original units and PDF provenance. Optional
--verify-cache checks the original PDFs, which intentionally live outside the site.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'pipeline/config/state-enterprise-balance-sheets/2024.json'
OUTPUT = ROOT / 'data/cz-state-enterprise-balance-sheets-2024.v1.json'
PORTFOLIO = ROOT / 'data/cz-state-enterprises-2024.json'


def build(portfolio, config, cache=None):
    observations = config['observations']
    by_ico = {row['ico']: row for row in observations}
    expected = {entity['ico'] for entity in portfolio['entities']}
    if len(by_ico) != len(observations) or set(by_ico) != expected:
        raise ValueError('Balance sheets must cover the portfolio exactly once per ICO')
    entities = []
    for entity in portfolio['entities']:
        row = by_ico[entity['ico']]
        if cache is not None:
            pdf = cache / (row['source_key'] + '.pdf')
            if hashlib.sha256(pdf.read_bytes()).hexdigest() != row['source']['sha256']:
                raise ValueError(f'Source checksum mismatch: {pdf}')
        scale = row['source_unit_czk']
        if scale not in (1000, 1000000) or not row['balance_sheet_pdf_pages']:
            raise ValueError(f'Missing unit or source pages: {entity["ico"]}')
        values = {key + '_czk': row[key] * scale for key in ('cash', 'total_assets', 'equity')}
        if any(type(value) is not int for value in values.values()):
            raise ValueError('Missing or non-integer reviewed value; do not replace with zero')
        if not 0 <= values['cash_czk'] <= values['total_assets_czk']:
            raise ValueError(f'Cash exceeds assets: {entity["ico"]}')
        values['non_equity_funding_czk'] = values['total_assets_czk'] - values['equity_czk']
        entities.append({
            'ico': entity['ico'], 'name': entity['name'], 'as_of': config['as_of'],
            'perimeter': 'individual_legal_entity', **values,
            'cash_label': row['cash_label'], 'cash_basis': row['cash_basis'],
            'separate_financial_institution': row.get('separate_financial_institution', False),
            'source': {**row['source'], 'pdf_pages': row['balance_sheet_pdf_pages'],
                       'unit_czk': scale, 'accessed_on': '2026-09-09'},
            'notes': row['notes'],
            'mf_card_difference_czk': {
                key: values[key + '_czk'] - entity['metrics'][key] * 1000000
                for key in ('total_assets', 'equity')},
        })
    def subtotal(rows):
        return {'entity_count': len(rows), **{
            key: sum(row[key] for row in rows)
            for key in ('cash_czk', 'total_assets_czk', 'equity_czk', 'non_equity_funding_czk')}}
    return {
        'schema_version': 1, 'as_of': config['as_of'], 'currency': 'CZK',
        'scope': portfolio['scope'], 'coverage': {'expected': len(expected), 'available': len(entities)},
        'methodology': {
            'aggregation': 'Hrubý součet individuálních rozvah 38 vybraných subjektů; bez konsolidace vzájemných vztahů a bez vážení státním podílem. Nejde o všechny státní firmy.',
            'cash': 'Rozvahová položka peněz, případně peněžních ekvivalentů podle příslušné závěrky. Ostatní finanční investice ani pohledávky nejsou automaticky hotovost.',
            'availability': 'Účetní zůstatek není částka volně převoditelná do státního rozpočtu; může krýt klientské, provozní a další závazky.',
            'non_equity_funding': 'Dopočet aktiva netto minus vlastní kapitál: závazky, rezervy a případné časové rozlišení pasiv. Není to úročený dluh.',
            'financial_institutions': 'Samostatný mezisoučet pro ČEB, NRB a EGAP; jejich peněžní položky mají specifické definice. Není to sektorová klasifikace ČSÚ.',
            'detail': 'Normalizovány jsou základní součty rozvahy a cash; úplné řádky rozvah jsou v citovaných PDF, nikoli všechny strojově normalizované.',
            'source_pages': 'Čísla PDF stránek od 1, nikoli tištěné číslování.',
            'mf_comparison': 'Původní metriky MF zůstávají zachovány; rozdíly proti závěrkám jsou explicitně uvedeny.'},
        'summary': {'gross_portfolio': subtotal(entities),
                    'excluding_banks_and_egap': subtotal([x for x in entities if not x['separate_financial_institution']]),
                    'banks_and_egap': subtotal([x for x in entities if x['separate_financial_institution']])},
        'entities': entities}


def attach(portfolio, dataset):
    by_ico = {x['ico']: x for x in dataset['entities']}
    for entity in portfolio['entities']:
        entity['balance_sheet'] = by_ico[entity['ico']]
        entity.setdefault('metric_definitions', {})['debt'] = 'MF card debt indicator; not a verified total of balance-sheet liabilities or interest-bearing debt'
    portfolio['balance_sheet_dataset'] = OUTPUT.name
    portfolio['balance_sheet_summary'] = dataset['summary']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-cache', type=Path)
    args = parser.parse_args()
    portfolio = json.loads(PORTFOLIO.read_text())
    dataset = build(portfolio, json.loads(CONFIG.read_text()), args.verify_cache)
    attach(portfolio, dataset)
    for path, value in ((OUTPUT, dataset), (PORTFOLIO, portfolio)):
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dataset['summary'], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
