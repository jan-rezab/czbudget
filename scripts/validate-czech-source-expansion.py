#!/usr/bin/env python3
"""Focused reconciliation of Czech expanded source outputs (stdlib only)."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(name):return json.loads((ROOT/'data'/name).read_text())
f=read('cze-school-funding-2026.v1.json');r=f['records'];assert len(r)==f['entity_count']==len({x['RED_IZO'] for x in r});assert sum(x['NIV_CELKEM'] for x in r)==f['allocation_czk']
for x in r:
 assert abs(x['NIV_CELKEM']-sum(x[k] for k in ('PLATY_CELKEM','ODVODY_CELKEM','FKSP_CELKEM','OBV_CELKEM')))<=1
 assert x['ICO'] is None or (len(x['ICO'])==8 and x['ICO'].isdigit())
p=read('cze-pension-tables-2025.v1.json');assert len(p['tables'])==14
for t in p['tables']:
 d=json.loads((ROOT/t['records']).read_text());assert len(d['sheets'])==t['sheet_count']
 for s in d['sheets']:
  positions=[r['row'] for r in s['rows']];assert positions==sorted(set(positions))
c=read('countries/cze/providers.v1.json');manifest=read('country-provider-networks.v1.json')['countries']['CZE'];assert len(c['facilities'])==manifest['facility_count'];assert len({f['id'] for f in c['facilities']})==len(c['facilities'])
for f in c['facilities']:
 assert f['native_records'] and any('lůžková' in r['ZZ_forma_pece'].lower() for r in f['native_records'])
 for r in f['native_records']:assert f['id']=='CZE:'+r['ZZ_misto_poskytovani_ID']
assert manifest['payments']['loaded'] is True
assert manifest['payments']['scope']=='NR-04-17 individually prepared medicines only'
h=read('cz-health-budget.v1.json');assert h['system_2024_summary']['status']=='preliminary'
for key in ('sources','destinations'):assert abs(sum(x['value_bn'] for x in h['system_2023'][key])-h['system_2023']['total_bn'])<.001
b=read('demography-social.v1.json');assert b['base_2025']['care_allowance']==46.52918511;assert b['baseline_definitions']['care_allowance']['administrative_paid_benefits_bn']!=b['base_2025']['care_allowance']
print('Czech source expansion: allocation identities, IDs, pension sheet positions, NRPZS scope, health conservation and care concepts pass.')

i=read('industry/CZE.json');native=[s for s in i['series'] if s['channel']=='national' and s['dataset'] in ('PRU01B','PRU01C')]
assert len(native)==248 and sum(len(s['points']) for s in native)==50161
for series in native:
 periods=[p['period'] for p in series['points']];assert periods==sorted(set(periods))
 assert series['unit']==('index_points' if series['measure']=='index' else 'percent')
assert {'M','Q'}=={s['frequency'] for s in native}
import gzip,hashlib
raw=(ROOT/'data/industry/CZE.json').read_bytes();archive=read('industry/archive-manifest.json');entry=next(e for e in archive if e['file']=='CZE.json');assert hashlib.sha256(raw).hexdigest()==entry['sha256'];assert gzip.decompress((ROOT/'data/industry/CZE.json.gz').read_bytes())==raw
m=read('money-reports/cze.v1.json');a=read('money-reports/cze-arad-native.v1.json');assert len(a['series'])==73
for name,meta in m['series_metadata'].items():
 points=m['series'][name];assert len(points)>250;assert points[0][0]==meta['first_period'] and points[-1][0]==meta['last_period']
assert abs(m['series']['broad'][-1][1]-7.6051932)<1e-9
for code in ('m1','m2','broad'):
 assert m['series'][code][0][0]=='2002-01'
r=read('cze-medicine-reimbursements.v1.json');total=sum(round(x['reimbursement_czk']*100) for x in r['monthly'])
for key in ('dispensing_provider_month','prescribing_provider_month','drug_month'):
 assert sum(round(x['reimbursement_czk']*100) for x in r[key])==total
assert r['first_period']=='2025-01' and r['last_period']=='2026-03'
print('Industry archive/history, ARAD units/periods and NR-04-17 role reconciliation pass.')
