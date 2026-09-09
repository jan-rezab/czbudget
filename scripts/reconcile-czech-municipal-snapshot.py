"""Read-only audit of all snapshot budget stages against cached FINM203."""
import argparse,csv,io,json,zipfile,hashlib
from datetime import datetime,timezone
from collections import Counter
from decimal import Decimal
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);args=parser.parse_args()
OUT=ROOT/'website/data'
source=args.source
snapshot=json.loads((ROOT/'website/data/municipal-snapshot.v1.json').read_text())
entities={r['national_id']:r for r in snapshot['municipalities']}
def dec(s):
 s=str(s).strip().replace(' ','').replace(',','.')
 return -Decimal(s[:-1]) if s.endswith('-') else Decimal(s)
checks=Counter(); mismatches=[];seen=set()
with zipfile.ZipFile(source) as z:
 for r in csv.reader(io.TextIOWrapper(z.open('FINM203_2025012.csv'),encoding='utf-8-sig'),delimiter=';'):
  if len(r)<11 or r[4] not in entities or r[7] not in {'4200','4430','4440'}:continue
  ico=r[4]; rowcode=r[7]; e=entities[ico]
  for stage,col in [('approved',8),('adjusted',9),('actual',10)]:
   key=('revenue_' if rowcode=='4200' else 'expense_')+stage
   expected=dec(r[col])
   if rowcode=='4440':
    actual=dec(e['amounts']['revenue_'+stage])-dec(e['amounts']['expense_'+stage]);key='balance_'+stage
   else:actual=dec(e['amounts'][key])
   identity=(ico,key)
   if identity in seen:raise ValueError('Duplicate source measure '+str(identity))
   seen.add(identity);checks[key]+=1
   if abs(actual-expected)>Decimal('0.01'):
    mismatches.append(dict(ico=ico,name=e['name'],measure=key,source=str(expected),snapshot=str(actual),difference=str(actual-expected)))
if len(seen)!=len(entities)*9:raise ValueError('Incomplete source comparison')
result=dict(schema_version='1.0.0',country_code='CZE',source={'url':'https://monitor.statnipokladna.gov.cz/data/extrakty/csv/FinM/2025_12_Data_CSUIS_FINM.zip','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'retrieved_at':datetime.fromtimestamp(source.stat().st_mtime,timezone.utc).isoformat()},generated_at=datetime.now(timezone.utc).isoformat(),snapshot_entities=len(entities),comparison_counts=dict(checks),total_comparisons=sum(checks.values()),mismatch_count=len(mismatches),mismatches=mismatches,limitation='Comparison of the specified official FINM203 export with the local 2025 serving snapshot. FINM201 detailed and FINM203 summary source differences are retained, not silently corrected. This does not verify a deployed warehouse.')
(OUT/'czech-municipal-reconciliation.v1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='mismatches'},indent=2))
print(json.dumps(mismatches[:15],ensure_ascii=False,indent=2))
