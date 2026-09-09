#!/usr/bin/env python3
"""Extract MF workbook evidence without flattening overlapping totals into a sum."""
import io,json,zipfile,hashlib,re
from pathlib import Path
from datetime import date,datetime,timezone
from openpyxl import load_workbook
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT.parent/'data/source_cache'
ARCHIVE=ROOT.parent/'data/sources/ministries/CZE/state-budget-proposal-2027-documentation.zip'
URL='https://mf.gov.cz/assets/attachments/2026-08-31_Dokumentace-k-navrhu-zakona-o-statnim-rozpoctu-CR-na-rok-2027.zip'
def clean(v):
    if isinstance(v,(date,datetime)): return v.isoformat()
    return v

def sheet_evidence(w):
    return [{'name':s.title,'rows':[{'source_row':n,'cells':[clean(c) for c in row]} for n,row in enumerate(s.values,1) if any(c is not None for c in row)]} for s in w if s.sheet_state=='visible']
def numeric(v):
    if not isinstance(v,(int,float)) or isinstance(v,bool): raise ValueError(f'Missing required amount: {v!r}')
    return v

def budget_series(w):
    income=list(w['Tab.1 - příjmy'].values);expense=list(w['Tab.1 - výdaje druhově'].values)
    # Header-driven vintage mapping, never assume the last column is an amount.
    headers=income[7]
    columns={int(v):i for i,v in enumerate(headers[:8]) if isinstance(v,(int,float)) and 2022<=v<=2027}
    if set(columns)!=set(range(2022,2028)):raise ValueError('Unexpected MF revenue year headers')
    def amount(rows,prefix,i):
        found=[r for r in rows if len(r)>i and re.sub(r'\s+',' ',str(r[1] or '')).strip().startswith(prefix)]
        if len(found)!=1:raise ValueError(f'Expected one row {prefix!r}, got {len(found)}')
        return numeric(found[0][i])
    out=[]
    for year,i in columns.items():
        taxes=amount(income,'Z daňových příjmů celkem:',i)
        insurance=amount(income,'16 ',i)
        other=amount(income,'2, 3, 4 ',i)
        social=amount(expense,'541 ',i);wages=amount(expense,'50 ',i);capital=amount(expense,'6 ',i)
        total=amount(expense,'VÝDAJE STÁTNÍHO ROZPOČTU CELKEM',i)
        revenue=amount(income,'PŘÍJMY STÁTNÍHO ROZPOČTU CELKEM',i)
        if abs(taxes+insurance+other-revenue)>0.1:raise ValueError(f'MF revenue does not reconcile {year}: {taxes+insurance+other-revenue}')
        out.append({'year':year,'stage':'actual' if year<=2025 else 'approved_budget' if year==2026 else 'proposal','unit':'CZK','taxes':taxes,'insurance':insurance,'other_income':other,'social_benefits':social,'wages':wages,'other_expense':total-social-wages-capital,'capital':capital,'revenue':revenue,'expense':total})
    return out

def main():
    with zipfile.ZipFile(ARCHIVE) as z:
        f=next(n for n in z.namelist() if n.startswith('F_01_') and n.endswith('.xlsx'))
        w=load_workbook(io.BytesIO(z.read(f)),data_only=True,read_only=True)
        series=budget_series(w)
        books=[]
        for n in z.namelist():
            if n.endswith('.xlsx'):
                books.append({'archive_member':n,'sheets':sheet_evidence(load_workbook(io.BytesIO(z.read(n)),data_only=True,read_only=True))})
    payload={'schema_version':'1.0.0','source':{'url':URL,'published':'2026-08-31','sha256':hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()},'series':series,'workbooks':books,'scope':'State budget; includes EU/FM unless a source table explicitly excludes them','aggregation':'Rows include overlapping subtotals; do not sum all source rows','definition':'wages is economic grouping 50: wages and related expenses, including employer contributions'}
    (ROOT/'data/czech-mf-budget-detail.v1.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
    p=ROOT/'data/czech-budget.v1.json';old=json.loads(p.read_text());by_year={r['year']:r for r in series}
    old.setdefault('retained_vintages',[])
    if not any(x.get('id')=='pre-mf-reconciliation-20260909' for x in old['retained_vintages']):
        old['retained_vintages'].append({'id':'pre-mf-reconciliation-20260909','rows':[r for r in old['rows'] if r[0]>=2022],'sources':old['sources'],'note':'Previous rounded presentation; retained for audit, superseded by workbook-derived amounts'})
    for r in old['rows']:
        if r[0] in by_year:
            s=by_year[r[0]]
            for i,key in enumerate(old['columns'][1:],1):r[i]=round(s[key]/1e9,2)
    old['proposal_year']=None;old['approved_budget_year']=2026
    old['stages']={str(r[0]):'actual' if r[0]<=2025 else 'approved_budget' for r in old['rows']}
    old['detail_path']='data/czech-mf-budget-detail.v1.json'
    old['monthly_detail_path']='data/czech-mf-monthly-2026.v1.json'
    old['sources']=[s for s in old['sources'] if '62672' not in s['url']]+[{'label':'MF — approved 2026 baseline and 2022–2025 actuals in 2027 documentation','url':URL},{'label':'MF — enacted Act 38/2026','url':'https://mf.gov.cz/cs/kontrola-a-regulace/legislativa/legislativni-dokumenty/2026/zakon-c-38-2026-sb-63436'}]
    old['sources']=list({s['url']:s for s in old['sources']}.values())
    # Reconcile published tax detail residual to the freshly sourced tax aggregate.
    for r in old.get('tax_detail',{}).get('rows',[]):
        if r[0] in by_year:r[-1]=round(round(by_year[r[0]]['taxes']/1e9,2)-sum(r[1:-1]),2)
    p.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'budget_periods':len(series),'workbooks':len(books),'approved_2026':by_year[2026]}))
if __name__=='__main__':main()
