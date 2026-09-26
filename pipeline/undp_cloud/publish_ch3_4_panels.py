"""Aggregate chapter 3–4 panels bound to reviewed, exact provider snapshots.

No fetch/publication or respondent aggregation. Empty contracts deliberately
leave gaps until the cloud aggregate schema and source units are reviewed.
"""
import json
import math
import re
from pathlib import Path
from chart_ch3_4 import transform

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
