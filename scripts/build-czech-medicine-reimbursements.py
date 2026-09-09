#!/usr/bin/env python3
"""Stream NR-04-17 into separate dispensing/prescribing-provider monthly facts.
Patient counts cannot be summed. Monetary amounts are accumulated in exact cents.
"""
import argparse,csv,gzip,hashlib,json
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
URL='https://datanzis.uzis.gov.cz/data/NR-04-NRHZS/NR-04-17/Otevrena-data-NR-04-17-individualne-pripravovane-lecive-pripravky-sukl-mesic-icp-predpis-icz-vydej.csv.gz'
p=argparse.ArgumentParser();p.add_argument('--input',type=Path,default=ROOT.parent/'outputs/czech-source-implementation-20260909/sources/nr04-17.csv.gz');a=p.parse_args()
monthly=defaultdict(int);dispensing=defaultdict(int);prescribing=defaultdict(int);drug=defaultdict(int);count=0
with gzip.open(a.input,'rt',encoding='utf-8-sig',newline='') as f:
 reader=csv.DictReader(f);assert {'ICO_vydej','ICO_predpis','uhrada_ZP','rok','mesic','kod'}<=set(reader.fieldnames)
 for r in reader:
  period=f"{int(r['rok']):04}-{int(r['mesic']):02}";assert 1<=int(r['mesic'])<=12
  amount=Decimal(r['uhrada_ZP'])*100;assert amount==amount.to_integral_value();cents=int(amount)
  monthly[period]+=cents;dispensing[(period,r['ICO_vydej'] or None)]+=cents;prescribing[(period,r['ICO_predpis'] or None)]+=cents;drug[(period,r['kod'])]+=cents;count+=1
assert count>10000 and sum(monthly.values())==sum(dispensing.values())==sum(prescribing.values())==sum(drug.values())
def records(values,key):return [{'period':period,key:code,'reimbursement_czk':cents/100} for (period,code),cents in sorted(values.items(),key=lambda x:(x[0][0],x[0][1] or ''))]
source={'url':URL,'sha256':hashlib.sha256(a.input.read_bytes()).hexdigest(),'dataset':'NR-04-17','license':'CC BY 4.0','documentation':'https://www.nzip.cz/data/2288-individualne-pripravovane-lecive-pripravky-sukl-mesic-icp-predpis-icz-vydej-otevrena-data'}
output={'schema_version':'1.0.0','source':source,'source_row_count':count,'first_period':min(monthly),'last_period':max(monthly),'unit':'CZK','scope':'Individually prepared medicines reported to public health insurers. Excludes private payments, nonreported inpatient drug lump sums and specified sensitive diagnoses. Latest quarter subject to revision. Prescribing and dispensing are two views of the same expenditure; never add them together.','patient_counts':'Not aggregated: patients can overlap across rows/providers/months.','monthly':[{'period':p,'reimbursement_czk':v/100} for p,v in sorted(monthly.items())],'dispensing_provider_month':records(dispensing,'ico'),'prescribing_provider_month':records(prescribing,'ico'),'drug_month':records(drug,'sukl_code')}
out=ROOT/'data/cze-medicine-reimbursements.v1.json';out.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
summary={k:v for k,v in output.items() if k not in ('dispensing_provider_month','prescribing_provider_month','drug_month')};summary['records_url']='/data/cze-medicine-reimbursements.v1.json';summary['dispensing_provider_count']=len({k[1] for k in dispensing if k[1]});(ROOT/'data/cze-medicine-reimbursements-summary.v1.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(f'{count} source rows; {len(monthly)} months; {len(dispensing)} dispensing-provider months; {sum(monthly.values())/100} CZK; both role totals reconcile')
