"""Aggregate chapter 3–4 panels bound to reviewed, exact provider snapshots.

No fetch/publication or respondent aggregation. Empty contracts deliberately
leave gaps until the cloud aggregate schema and source units are reviewed.
"""
import json
import math
import re
from pathlib import Path
from chart_ch3_4 import transform
from wipo_family_history import BINDINGS as WIPO_BINDINGS, derive_family_history

ADMITTED = {
 'wipo_assistive_conventional2021': 'wipo_assistive',
 'wipo_assistive_emerging2021': 'wipo_assistive',
 'sapien_msw2024': 'sapien_public',
 'sapien_gmp2025': 'sapien_public',
 'sapien_youth2025': 'sapien_public',
 'itu_global_regional2025': 'itu_connectivity',
}
CONTRACTS_PATH=Path(__file__).with_name('ch3_4_panel_bindings.json')
def bi(en,cs):return dict(en=en,cs=cs)

def pinned_records(rows,sid,meta,expectations):
 found=set()
 for raw in rows:
  for key,value in [('source_id',sid),('release_id',meta['release_id']),('source_sha256',meta['sha256']),('source_url',meta['url'])]:
   if raw.get(key)!=value:raise ValueError('Pinned aggregate source mismatch: '+key)
  key=(raw['member'],raw['row_number'])
  if key in expectations:
   if key in found:raise ValueError('Duplicate schema anchor')
   found.add(key)
   payload=json.loads(raw['record_json'])
   if payload.get('representation')!='cached_values':raise ValueError('Schema anchor is not cached source aggregate')
   for column,expected in expectations[key]:
    if column>=len(payload['values']) or payload['values'][column]!=expected:raise ValueError('Reviewed aggregate schema anchor changed')
  yield raw
 if found!=set(expectations):raise ValueError('Reviewed aggregate schema anchor missing')

def provider_panels(source_rows,by_source):
 contracts=json.loads(CONTRACTS_PATH.read_text())
 charts=[];gaps=[]
 for sid,family in ADMITTED.items():
  meta=by_source.get(sid)
  applicable=[c for c in contracts if c['source_id']==sid]
  if not meta or not meta.get('accepted_records'):
   gaps.append(dict(source_id=sid,reason='No validated pinned aggregate source release available.'));continue
  if sid in WIPO_BINDINGS:
   binding=WIPO_BINDINGS[sid]
   if meta.get('sha256')!=binding['sha256']:
    gaps.append(dict(source_id=sid,reason='WIPO family-history contract belongs to a different source snapshot.'));continue
   result=derive_family_history(source_rows(sid),sid,meta,binding)
   conventional=binding['kind']=='conventional';kind_en='Conventional' if conventional else 'Emerging';kind_cs='Konvenční' if conventional else 'Nové'
   charts.append(dict(id='provider-wipo-'+binding['kind']+'-family-history',chapter='chapter4',title=bi(kind_en+' assistive technology families by first filing year',kind_cs+' asistivní technologie: rodiny podle roku první přihlášky'),unit='families',chart_type='line',rows=result['rows'],fields=[dict(key='value',label=bi('DWPI families (calculated count)','Rodiny DWPI (vypočtený počet)'))],source_refs=[dict(url=meta['url'],vintage=meta['vintage'],table='Overall Metadata; DWPI accession and earliest priority year',release_id=meta['release_id'],source_id=sid,sha256=meta['sha256'])],method=bi('Calculation: count unique native DWPI accession identifiers by earliest priority year in the complete published workbook. Patent, utility-model and research-disclosure families retain the source classification. This is a fixed landscape, not granted patent counts or a live patent feed. The 2020 year is partial at the source export cutoff '+binding['cutoff']+'. Categories and the two workbooks may overlap and are not summed. HDR2025 officially corrects Figures4.2/4.3 to2000–2020; this additional historical panel shows all available1998–2020 source years, not a reproduction of that cross-section.','Výpočet: počet jedinečných původních identifikátorů rodin DWPI podle roku nejstarší priority v úplném zveřejněném sešitu. Rodiny patentů, užitných vzorů a výzkumných oznámení zachovávají klasifikaci zdroje. Jde o pevnou studii, nikoli počty udělených patentů či živý tok. Rok2020 je neúplný k datu exportu '+binding['cutoff']+'. Kategorie a oba sešity se mohou překrývat a nesčítají se. Oficiální oprava HDR2025 stanoví pro obrázky4.2/4.3 období2000–2020; tento doplňující graf ukazuje všechny dostupné roky1998–2020 a nereprodukuje původní průřez.'),denominator=bi('Unique published DWPI families in this '+binding['kind']+' assistive-technology landscape; no population denominator.','Jedinečné zveřejněné rodiny DWPI v této studii asistivních technologií; bez populačního jmenovatele.'),original_refs=['4.2' if conventional else '4.3'],status='historical',latest_period='2020',source_coverage=dict(native_family_count=result['native_family_count'],native_treatment_counts=result['native_treatment_counts'],source_export_cutoff=binding['cutoff'],partial_final_year=True,geography='Global published landscape; WIPO/EPO offices are not treated as countries',original_corrected_scope='2000–2020',history_scope='1998–2020',erratum_url='https://hdr.undp.org/errata-and-corrigenda-hdr-2025')))
   continue
  if not applicable:
   gaps.append(dict(source_id=sid,reason='Aggregate source loaded; exact cloud schema, native units and denominator binding remains unresolved.'));continue
  for contract in applicable:
   if not re.fullmatch('[a-f0-9]{64}',meta.get('sha256','')) or contract['source_sha256']!=meta['sha256']:
    gaps.append(dict(source_id=sid,reason='Reviewed aggregate contract belongs to a different source snapshot.'));continue
   expectations={}
   for anchor in contract['schema_anchors']:
    expectations.setdefault((anchor['member'],anchor['row_number']),[]).append((anchor['column_index'],anchor['source_value']))
   binding=contract['binding']
   if binding['source_id']!=sid or binding['source_sha256']!=meta['sha256']:raise ValueError('Contract identity mismatch')
   result=transform(family,pinned_records(source_rows(sid),sid,meta,expectations),binding)
   if result['status']!='extracted':
    gaps.append(dict(source_id=sid,reason=result.get('reason',result['status'])));continue
   rows=[]
   for obs in result['observations']:
    value=float(obs['value']) if obs['value'] is not None else None
    if value is not None and not math.isfinite(value):raise ValueError('Nonfinite aggregate chart value')
    if obs['unit']!=contract['unit'] or obs['denominator']!=contract['denominator_en']:raise ValueError('Mixed native units or denominators')
    rows.append(dict(country=contract.get('country'),period=obs['period'],label=obs['category'],value=value,source_value=obs['source_value'],source_member=obs['member'],source_row_number=obs['source_row_number'],source_column_index=obs['source_column_index'],source_geography=obs['geography']))
   charts.append(dict(id=contract['id'],chapter=contract['chapter'],title=contract['title'],unit=contract['unit'],chart_type=contract['chart_type'],rows=rows,fields=[dict(key='value',label=contract['value_label'])],source_refs=[dict(url=meta['url'],vintage=meta['vintage'],table=sid,release_id=meta['release_id'],source_id=sid,sha256=meta['sha256'])],method=contract['method'],denominator=bi(contract['denominator_en'],contract['denominator_cs']),original_refs=contract['original_refs'],status=contract['status'],latest_period=max(str(row['period']) for row in rows),source_coverage=dict(schema_evidence=binding['schema_evidence'],native_aggregate_cells=len(rows),limitations=result['limitations'])))
 return charts,gaps
