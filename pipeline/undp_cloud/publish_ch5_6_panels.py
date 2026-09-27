"""Reviewed provider panels from exact pinned source records; no fetch/publication.

Only admitted source IDs are iterated. Complete source series are retained;
public output has aggregates, never a model ledger or survey respondents.
"""
from collections import Counter
import json
import math
import re

from chart_ch5_6 import hadcrut_source, rupp, epoch_source, ilo_tree

ADMITTED = frozenset({'hadcrut5_1','hadcrut5_2','rupp_transistors_1','epoch_models_1','ilo_genai_2023_occupations'})


def bi(en, cs): return dict(en=en, cs=cs)
def numeric(value):
    if value is None: return None
    result = float(value)
    if not math.isfinite(result): raise ValueError('Nonfinite provider panel')
    return result


def provenance(sid, meta):
    required = {'release_id','url','sha256','vintage'}
    if required - meta.keys() or not re.fullmatch('[a-f0-9]{64}',meta['sha256']):
        raise ValueError('Incomplete pinned provider source provenance')
    return dict(source_id=sid,source_sha256=meta['sha256'],source_url=meta['url'],
        source_vintage=meta['vintage'],relation=meta.get('relation','source_snapshot'))


def decoded(records, sid, meta):
    for raw in records:
        if raw['source_id'] != sid or raw['release_id'] != meta['release_id'] or raw['source_sha256'] != meta['sha256'] or raw['source_url'] != meta['url']:
            raise ValueError('Pinned source record mismatch')
        yield json.loads(raw['record_json'])


def csv_rows(records):
    # BigQuery physical records have no guaranteed order; every data row carries
    # its own header. Validate all rows against one schema without relying on order.
    columns = None; headers = 0
    for raw in records:
        if raw.get('kind') not in {'header','data'}:
            raise ValueError('Unexpected CSV source record')
        current = raw['columns']
        if len(current) != len(set(current)): raise ValueError('Duplicate source columns')
        if columns is not None and columns != current: raise ValueError('CSV source schema changed')
        columns = current
        if raw['kind'] == 'header':
            headers += 1
            if headers > 1: raise ValueError('Multiple CSV headers')
        else:
            if len(raw['values']) != len(columns): raise ValueError('CSV source width mismatch')
            yield dict(zip(columns,raw['values']))
    if headers != 1: raise ValueError('Missing CSV header')


def panel(sid,meta,title,unit,rows,fields,method,denominator,original,chapter='chapter6',kind='line',status='ready'):
    if not rows: raise ValueError('Admitted source produced no public observations')
    source=dict(url=meta['url'],vintage=str(meta['vintage']),table=sid,
        release_id=meta['release_id'],source_id=sid,sha256=meta['sha256'])
    return dict(id='provider-'+sid.replace('_','-'),chapter=chapter,title=title,unit=unit,
        chart_type=kind,rows=rows,fields=fields,source_refs=[source],method=method,
        denominator=denominator,original_refs=original,status=status,
        latest_period=max(str(r.get('period',r.get('year',''))) for r in rows))


def provider_panels(source_rows, by_source):
    charts=[]; gaps=[]
    for sid in sorted(ADMITTED):
        meta=by_source.get(sid)
        if not meta or not meta.get('accepted_records'):
            gaps.append(dict(source_id=sid,reason='No validated pinned source observations available for this reviewed binding.'))
            continue
        metadata=provenance(sid,meta)
        records=decoded(source_rows(sid),sid,meta)
        if sid.startswith('hadcrut5_'):
            grain='annual' if sid.endswith('_1') else 'monthly'
            observations,coverage=hadcrut_source(csv_rows(records),metadata,grain)
            rows=[dict(country='WLD',period=r['period'],value=numeric(r['value']),lower=numeric(r['lower']),upper=numeric(r['upper'])) for r in sorted(observations,key=lambda r:r['period'])]
            chart=panel(sid,meta,bi('Global temperature anomaly — '+grain,'Globální teplotní odchylka — '+('roční' if grain=='annual' else 'měsíční')),'degrees Celsius / °C',rows,
                [dict(key='value',label=bi('Global anomaly','Globální odchylka')),dict(key='lower',label=bi('Source lower uncertainty bound (2.5%)','Dolní mez nejistoty zdroje (2,5 %)')),dict(key='upper',label=bi('Source upper uncertainty bound (97.5%)','Horní mez nejistoty zdroje (97,5 %)'))],
                bi('HadCRUT5 native reference period 1961–1990; all available '+grain+' source observations and source uncertainty bounds. No rebasing to the report’s 1850–1900 reference. Annual and monthly grains remain separate.','Původní referenční období HadCRUT5 1961–1990; všechna dostupná '+('roční' if grain=='annual' else 'měsíční')+' pozorování a meze nejistoty zdroje. Bez přepočtu na základ 1850–1900 z původní zprávy. Roční a měsíční řady jsou oddělené.'),
                bi('Global analysis series; mean of Northern and Southern Hemisphere anomalies. Source uncertainty includes ensemble and additional coverage uncertainty.','Globální analytická řada; průměr odchylek severní a jižní polokoule. Nejistota zahrnuje soubor realizací a dodatečnou nejistotu pokrytí.'),['S6.1.1'])
            chart['source_coverage']=coverage;charts.append(chart)
        elif sid == 'rupp_transistors_1':
            def lines():
                for r in records:
                    if set(r) != {'source_line'}: raise ValueError('Unexpected Rupp source schema')
                    yield r['source_line']
            observations,coverage=rupp(lines(),metadata,value_column=1)
            rows=[dict(country='WLD',period=r['period'],value=numeric(r['value'])) for r in sorted(observations,key=lambda r:r['fractional_year'])]
            chart=panel(sid,meta,bi('Microprocessor transistor observations','Pozorování počtu tranzistorů mikroprocesorů'),'thousand transistors / tisíc tranzistorů',rows,
                [dict(key='value',label=bi('Transistors (thousands)','Tranzistory (tisíce)'))],
                bi('Author data column2 in thousands. Decimal source year retained exactly, without date interpolation or annual averaging. Current file is a historical observation series; download date does not imply a current-year observation. Original HDR/OWID2022 snapshot match remains unverified.','Druhý sloupec autora v tisících. Desetinný rok zachován bez interpolace dat a ročního průměrování. Soubor obsahuje historická pozorování; datum stažení neznamená pozorování pro aktuální rok. Shoda s původní verzí HDR/OWID2022 není ověřena.'),
                bi('Individual source microprocessor observations; no annual mean or universal processor census.','Jednotlivá pozorování mikroprocesorů ve zdroji; nejde o roční průměr ani úplný soupis procesorů.'),['S6.1.1'],status='historical')
            chart['source_coverage']={k:v for k,v in coverage.items() if k!='source_comments'};charts.append(chart)
        elif sid == 'epoch_models_1':
            try:
                result,coverage=epoch_source(csv_rows(records),metadata)
            except ValueError as error:
                # An unreviewed global field layout holds only this source panel.
                # Provenance and numeric-integrity errors still propagate.
                if str(error) not in {'Reviewed Epoch columns missing','CSV source schema changed','CSV source width mismatch','Multiple CSV headers','Missing CSV header','Duplicate source columns','Unexpected CSV source record'}:
                    raise
                gaps.append(dict(source_id=sid,reason='Epoch panel held: unreviewed source binding ('+str(error)+'). No model counts published.',status='needs_definition'))
                continue
            categories=sorted({r['country_category'] for r in result['series']})
            keys={c:'category'+str(i) for i,c in enumerate(categories)}
            for metric, suffix, en, cs in [('annual_models','annual','Annual','Roční'),('cumulative_models','cumulative','Cumulative','Kumulativní')]:
                grouped={}
                for r in result['series']:
                    row=grouped.setdefault(r['year'],dict(country='WLD',year=r['year']))
                    row[keys[r['country_category']]]=r[metric]
                rows=[grouped[y] for y in sorted(grouped)]
                chart=panel(sid,meta,bi(en+' curated AI models by organization country category',cs+' počet evidovaných modelů AI podle geografické kategorie organizace'),'curated model count / počet evidovaných modelů',rows,
                    [dict(key=keys[c],label=bi(c,c)) for c in categories],
                    bi('Calculated scenario: central training-compute estimate strictly >10^23FLOP; estimates marked Wrong or with inconsistent source compute/bounds excluded; original values retained in the source ledger. Source organization-country categorical strings preserved, including Multinational and multiple selections; they are organization associations, not uniquely headquarters or training location. Confidence, bounds and exclusion counts retained in coverage. Original HDR5.5 grouping/snapshot is not reproduced.','Vypočtený scénář: střední odhad výpočetní práce při trénování výhradně >10^23FLOP; odhady označené Wrong nebo s rozpornými zdrojovými hodnotami či mezemi vyloučeny; původní hodnoty zachovány ve zdrojovém záznamu. Původní geografické kategorie organizací zachovány včetně Multinational a vícenásobných voleb; nejde nutně o sídlo ani místo trénování. Počty vyloučení a nejistota zachovány v pokrytí. Původní seskupení/verze HDR5.5 se nereprodukují.'),
                    bi('Epoch curated models with known publication date, country category and central compute; not all AI models, people or investment. Internal year gaps are zero counts; series stops at latest included publication.','Modely evidované Epoch se známým datem zveřejnění, kategorií země a středním odhadem práce; nejde o všechny modely AI, osoby či investice. Vnitřní roční mezery mají nulový počet; řada končí posledním zahrnutým zveřejněním.'),['5.5'],chapter='chapter5')
                chart['id']+='-'+suffix
                chart['source_coverage']=dict(coverage,confidence_counts=dict(Counter(r['confidence'] for r in result['model_selection'])),uncertainty_crossing_threshold_models=sum(r['uncertainty_crosses_threshold'] for r in result['model_selection']),received_models=len(result['model_selection']),model_ledger_status='Not included in public report; original model records retained in pinned source warehouse. Excluded counts disclosed here.')
                charts.append(chart)
        elif sid == 'ilo_genai_2023_occupations':
            trees=list(records)
            if len(trees)!=1: raise ValueError('Expected one original ILO risk tree')
            observations,coverage=ilo_tree(trees[0],metadata)
            counts=Counter(r['risk_classification'] for r in observations)
            rows=[dict(country='WLD',period='2023',label=k,value=v) for k,v in sorted(counts.items())]
            chart=panel(sid,meta,bi('ISCO occupations by original 2023 AI risk classification','Povolání ISCO podle původní klasifikace rizika AI z roku2023'),'occupation categories / kategorie povolání',rows,
                [dict(key='value',label=bi('Number of ISCO4 categories','Počet kategorií ISCO4'))],
                bi('Counts of original ISCO08 four-digit leaf risk labels from author2023 taxonomy. This is not the HDR6.1 employment share; original labour microdata and HDI2022 group definitions remain unavailable. The newer2025 four-gradient taxonomy has a different definition.','Počty původních čtyřmístných kategorií ISCO08 podle taxonomie autora2023. Nejde o podíly zaměstnanosti HDR6.1; původní pracovní mikrodata a skupiny HDI2022 chybí. Novější taxonomie2025 se čtyřmi stupni má jinou definici.'),
                bi('Occupation categories, equally counted; no people, jobs, FTE, employment or population weighting.','Kategorie povolání, každá se počítá jednou; žádné osoby, pracovní místa, úvazky ani váhy zaměstnanosti či populace.'),['6.1'],kind='bar',status='historical')
            chart['source_coverage']=coverage;charts.append(chart)
            gaps.append(dict(source_id=sid,reason='Occupational taxonomy chart available; original HDR6.1 country/HDI-group employment shares require original labour microdata and remain unavailable.'))
    disclose_hadcrut_year_coverage(charts)
    return charts,gaps


def disclose_hadcrut_year_coverage(charts):
    """Monthly observations disclose annual coverage; never recompute anomalies."""
    annual=next((c for c in charts if c['id']=='provider-hadcrut5-1'),None)
    if annual is None: return
    latest=max(annual['rows'],key=lambda r:r['period'])
    year=latest['period']
    monthly=next((c for c in charts if c['id']=='provider-hadcrut5-2'),None)
    annual_ref=annual['source_refs'][0]
    paired=False
    if monthly is not None:
        monthly_ref=monthly['source_refs'][0]
        paired=(annual_ref['release_id']==monthly_ref['release_id'] and
                annual_ref['vintage']==monthly_ref['vintage'] and
                annual_ref['url'].endswith('.global.annual.csv') and
                monthly_ref['url']==annual_ref['url'].replace('.global.annual.csv','.global.monthly.csv'))
    coverage=dict(year=year,status='unverified',observed_months=None)
    if paired:
        months=sorted({int(r['period'][5:7]) for r in monthly['rows'] if r['period'][:4]==year})
        complete=months==list(range(1,13))
        coverage.update(status='complete_calendar_year' if complete else 'partial_year',
            observed_months=len(months),months=months,
            observed_through=year+'-'+str(max(months)).zfill(2) if months else None,
            monthly_source_id=monthly_ref['source_id'],
            monthly_release_id=monthly_ref['release_id'],monthly_sha256=monthly_ref['sha256'])
        annual['source_refs'].append(dict(monthly_ref))
        en=f" Latest annual year {year}: {len(months)} of 12 monthly source observations available; " + ('complete calendar year.' if complete else 'partial calendar-year coverage.')
        cs=f" Poslední roční údaj {year}: dostupných {len(months)} z 12 měsíčních pozorování zdroje; " + ('úplný kalendářní rok.' if complete else 'neúplné pokrytí kalendářního roku.')
    else:
        en=f" Latest annual year {year}: calendar-year completeness is unverified because a matching pinned monthly series is unavailable."
        cs=f" Poslední roční údaj {year}: úplnost kalendářního roku není ověřena, protože odpovídající připnutá měsíční řada není dostupná."
    latest['calendar_year_status']=coverage['status']
    latest['observed_months']=coverage['observed_months']
    latest['observed_through']=coverage.get('observed_through')
    annual['source_coverage']['latest_year_monthly_coverage']=coverage
    annual['method']['en']+=en+' The official annual anomaly and uncertainty bounds are preserved unchanged; monthly observations are used only to disclose coverage, without annual recalculation.'
    annual['method']['cs']+=cs+' Oficiální roční odchylka a meze nejistoty zůstávají beze změny; měsíční pozorování slouží pouze k uvedení pokrytí, bez přepočtu roční hodnoty.'
