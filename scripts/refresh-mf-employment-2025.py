#!/usr/bin/env python3
"""Extract actual/prior-year cells from updated MF2025 final-account tables50–51."""
import csv,re,subprocess,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];PDF=ROOT/'data/source_cache/mf_employment/final-account-2025-c.pdf';OUT=ROOT/'website'
URL='https://mf.gov.cz/assets/attachments/2026-04-30_C-Zprava-o-vysledcich-hospodareni-statniho-rozpoctu_v01.pdf'
def number_rows(text):
 result=[]
 for line in text.splitlines():
  parts=re.split(r'\s{2,}',line.strip())
  if len(parts)<6:continue
  try:values=[int(x.replace(' ','')) for x in parts[1:6]]
  except ValueError:continue
  result.append((parts[0],values))
 return result
def main():
 text=subprocess.check_output(['pdftotext','-f','88','-l','89','-layout',str(PDF),'-'],text=True)
 count=number_rows(text.split('Tabulka č. 50:')[1].split('Tabulka č. 51:')[0]);salary=number_rows(text.split('Tabulka č. 51:')[1].split('Tabulka č. 52:')[0])
 assert len(count)==8 and len(salary)==8,(count,salary)
 assert count[-1][1][4]==490977 and count[0][1][4]+count[4][1][4]==490977
 keys=['state_organisational_units','state_employees_labour_service','state_uniformed_and_soldiers','state_prosecutors_and_derived','state_contributory_organisations',None,'state_regional_education_budget',None]
 skeys=['state_organisational_avg_salary_czk','state_labour_service_avg_salary_czk','state_uniformed_avg_salary_czk','state_prosecutors_avg_salary_czk','state_contributory_avg_salary_czk',None,'state_regional_education_avg_salary_czk',None]
 new=[]
 for table,rows,series,unit in [(50,count,keys,'average_FTE'),(51,salary,skeys,'CZK_month')]:
  for (label,values),key in zip(rows,series):
   if not key:continue
   for year,col in [(2024,0),(2025,4)]:new.append({'source_id':'mf_state_final_account_2025','series_id':key,'year':year,'value':values[col],'unit':unit,'status':'official','scope_note':f'Actual; MF2025 final account table{table}, printed page{82 if table==50 else 83}. Regulated state budget workforce; not full S.13. Counts are average FTE-equivalent positions (prepoctena mista), not unique persons.'})
 p=OUT/'pipeline/source_data/cze_public_employment_observations.csv'
 with p.open() as f:r=csv.DictReader(f);fields=r.fieldnames;old=[row for row in r if row['source_id']!='mf_state_final_account_2025']
 with p.open('w',newline='') as f:w=csv.DictWriter(f,fieldnames=fields,lineterminator="\n");w.writeheader();w.writerows(old+new)
 payload={'source_url':URL,'source_sha256':hashlib.sha256(PDF.read_bytes()).hexdigest(),'source_updated':'2026-08-21','stage':'actual','tables':{'50':count,'51':salary},'column_order':['actual2024','approved2025','adjusted2025','final_budget2025','actual2025'],'observations':new,'scope':'Government-regulated state workforce; not full public sector. Employee counts are average FTE-equivalent positions (přepočtená místa), not unique persons. Salary averages use that recalculated employment denominator.'}
 (OUT/'data/czech-mf-employment-2025.v1.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n');print(len(new))
if __name__=='__main__':main()
