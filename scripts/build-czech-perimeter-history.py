#!/usr/bin/env python3
"""Historical MF lists: final 2020 FOI perimeter versus annual declared registers."""
import json,gzip,hashlib,subprocess,argparse,re
from pathlib import Path
from datetime import datetime,date,timezone
from openpyxl import load_workbook
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT.parent/'data/source_cache/mf_consolidated/perimeter-discovery'
OUTPUT=ROOT/'data/mf-perimeter-history'
FOI='https://mf.gov.cz/assets/attachments/Informace-zadost-106_Pr-001_2021-12-02_Info-106-99-MF-33397-2021-48.xlsx'
RESPONSE='https://mf.gov.cz/assets/attachments/Informace-zadost-106_2021-12-02_Info-106-99-MF-33397-2021-48.pdf'
LANDING='https://mf.gov.cz/cs/ministerstvo/sluzby-verejnosti/komunikace-s-verejnosti/zadosti-o-informace-dle-zakona-106-1999/seznam-podanych-zadosti/2021/zadost-o-poskytnuti-informaci-ve-smyslu-44036'
REGISTER='https://mf.gov.cz/cs/dane-a-ucetnictvi/ucetnictvi/ucetni-reforma-verejnych-financi-ucetnic/ucetni-vykaznictvi-statu/vycet-konsolidovanych-jednotek-statu-a-d'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def cell(v):return v.isoformat() if isinstance(v,(datetime,date)) else v

def read_native(path):
    if path.suffix=='.xls':
        import xlrd
        w=xlrd.open_workbook(path)
        return [{'name':s.name,'rows':[{'source_row':i+1,'cells':[cell(v) for v in s.row_values(i)]} for i in range(s.nrows) if any(v not in ['',None] for v in s.row_values(i))]} for s in w.sheets()]
    w=load_workbook(path,read_only=True,data_only=True)
    return [{'name':s.title,'rows':[{'source_row':i,'cells':[cell(v) for v in r]} for i,r in enumerate(s.values,1) if any(v is not None for v in r)]} for s in w]
def write_detail(name,payload):
    OUTPUT.mkdir(parents=True,exist_ok=True);p=OUTPUT/name;raw=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode();p.write_bytes(gzip.compress(raw,mtime=0))
    return {'path':'data/mf-perimeter-history/'+name,'sha256':sha(p),'logical_json_sha256':hashlib.sha256(raw).hexdigest(),'bytes':p.stat().st_size}
def main():
    a=argparse.ArgumentParser();a.add_argument('--fetch',action='store_true');args=a.parse_args()
    CACHE.mkdir(parents=True,exist_ok=True)
    prior_path=ROOT/'data/czech-mf-perimeter-history.v1.json'
    prior=json.loads(prior_path.read_text()) if prior_path.exists() else None
    inventory=json.loads((CACHE/'register-inventory.json').read_text()) if (CACHE/'register-inventory.json').exists() else [e['source'] for e in prior['declared_registers_and_changes']]
    foi=json.loads((CACHE/'foi-source.json').read_text()) if (CACHE/'foi-source.json').exists() else prior['actual_perimeters'][0]['source']
    if args.fetch:
        for entry in inventory+[foi]:
            p=CACHE/entry['file'];tmp=p.with_suffix(p.suffix+'.tmp');subprocess.run(['curl','-fsSL','--max-time','90',entry['url'],'-o',str(tmp)],check=True);tmp.replace(p);entry['retrieved_at']=datetime.now(timezone.utc).isoformat();entry['sha256']=sha(p)
        (CACHE/'register-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n');(CACHE/'foi-source.json').write_text(json.dumps(foi,ensure_ascii=False,indent=2)+'\n')
    annual=[]
    for source in sorted(inventory,key=lambda e:(e['year'],e['kind'])):
        if sha(CACHE/source['file'])!=source['sha256']:raise ValueError('Raw source checksum mismatch')
        sheets=read_native(CACHE/source['file']);detail=write_detail(Path(source['file']).stem+'.json.gz',{'year':source['year'],'kind':source['kind'],'source':source,'sheets':sheets,'status':'declared_reporting_perimeter_not_verified_final_membership','date_policy':'Workbook validity cells are source values; no effective dates are imputed from download time.'})
        annual.append({'year':source['year'],'kind':source['kind'],'source':source,'sheet_count':len(sheets),'native_nonempty_rows':sum(len(s['rows']) for s in sheets),'detail':detail})
    if sha(CACHE/foi['file'])!=foi['sha256']:raise ValueError('FOI source checksum mismatch')
    sheets=read_native(CACHE/foi['file']);rows=sheets[0]['rows'];records=[]
    if '2020' not in str(rows[0]['cells'][0]):raise ValueError('FOI year mismatch')
    for r in rows[2:]:
        native,name,form=r['cells'];identifier=str(int(native)) if isinstance(native,(int,float)) else str(native)
        if not name or not identifier:raise ValueError('Incomplete actual-perimeter record')
        records.append({'source_identifier':identifier,'ico':identifier.zfill(8) if re.fullmatch(r'\d{1,8}',identifier) else None,'name':name,'legal_form_native':form,'source_row':r['source_row'],'period':2020})
    if len(records)!=18159 or len({r['source_identifier'] for r in records})!=18159:raise ValueError('Actual2020 perimeter control failed')
    actual=write_detail('2020-actual-perimeter.json.gz',{'year':2020,'scope':'actual_final_consolidation_perimeter','source':foi,'response_url':RESPONSE,'response_dated':'2021-12-02','sheets':sheets,'records':records,'count':18159,'note':'Request quoted18,163 (2019 count); MF response expressly identifies2020 and workbook contains18,159, matching final2020 population. The request wording is not the source year.'})
    checks=json.loads((CACHE/'inventory.json').read_text()) if (CACHE/'inventory.json').exists() else [{'year':e['year'],'url':e['annual_account_url'],'attachments':[{'url':u} for u in e['attachments_checked']]} for e in prior['availability']];availability=[]
    for item in checks:
        availability.append({'year':item['year'],'actual_entity_list_status':'acquired_from_published_MF_FOI_response' if item['year']==2020 else 'not_found_in_checked_public_sources','annual_account_url':item['url'],'attachments_checked':list(dict.fromkeys(a['url'] for a in item['attachments'])),'declared_register_available':True,'search_limit':'Checked official annual-account attachments, historical register page, and public MF FOI search; not a claim no unpublished list exists.'})
    d={'schema_version':'1.0.0','scope':'Historical MF consolidation membership evidence, not legal ownership','period':{'from':2016,'to':2023},'checked_at':'2026-09-09','register_landing':REGISTER,'declared_registers_and_changes':annual,'actual_perimeters':[{'year':2020,'count':18159,'source':foi,'landing':LANDING,'detail':actual}],'availability':availability,'existing_2024_actual_perimeter':'data/czech-consolidated-accounts.v1.json','definitions':['Annual declared registers include entities expected to report/be consolidated and may differ from final actual inclusion.','Published change workbooks retained as original source tables, not used to backcast current membership.','No ownership/control or entity finance inferred from these lists.','Dates and headers retained; native rows include headers and explanatory rows, not a claim every row is an entity.']}
    (ROOT/'data/czech-mf-perimeter-history.v1.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'declared_workbooks':len(annual),'actual2020_entities':len(records),'native_register_change_rows':sum(e['native_nonempty_rows'] for e in annual),'actual_years_not_found':[e['year'] for e in availability if e['actual_entity_list_status'].startswith('not_found')]}))
if __name__=='__main__':main()
