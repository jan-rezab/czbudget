#!/usr/bin/env python3
"""ČEZ 2025 final issuer statements; group ESEF and individual PDF are distinct scopes."""
import argparse, hashlib, json, re, subprocess, zipfile
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from lxml import etree
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT.parent/'data/source_cache/cez2025'
LANDING='https://www.cez.cz/cs/pro-investory/hospodarske-vysledky/vyrocni-zpravy'
BASE='https://www.cez.cz/webpublic/file/edee/ospol/fileexport/investori/vz-2025/'
URLS={'esef-2025.zip':BASE+'529900s5r9yhjhykkg94-2025-12-31-1-cs.zip','annual-2025.pdf':BASE+'vyrocni-financni-zprava-skupina-cez-2025.pdf'}
NS={'x':'http://www.xbrl.org/2003/instance','ix':'http://www.xbrl.org/2013/inlineXBRL','h':'http://www.w3.org/1999/xhtml','d':'http://xbrl.org/2006/xbrldi'}
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def clean(s):return ' '.join(s.split())
def parse_number(raw):
    raw=clean(raw)
    if raw in ['-','–','—']:return None
    s=re.sub(r'\s','',raw).replace(',','.')
    if not re.fullmatch(r'-?\d+(?:\.\d+)?',s):raise ValueError('Unexpected numeric token: '+raw)
    return Decimal(s)
def esef_number(e):
    if e.get('format')!='ixt:num-comma-decimal':raise ValueError('Unsupported ESEF number format')
    if e.get('{http://www.w3.org/2001/XMLSchema-instance}nil')=='true':return None
    n=parse_number(''.join(e.itertext()))
    if n is None:raise ValueError('Unexpected ESEF dash without nil')
    return str(n*(Decimal(10)**int(e.get('scale','0')))*(-1 if e.get('sign')=='-' else 1))
def extract_group():
    with zipfile.ZipFile(CACHE/'esef-2025.zip') as z:
        member=next(n for n in z.namelist() if n.endswith('.xhtml'))
        root=etree.fromstring(z.read(member),etree.XMLParser(huge_tree=True,resolve_entities=False,no_network=True))
        taxonomy_member=next(n for n in z.namelist() if n.endswith('taxonomyPackage.xml'))
        taxonomy=etree.fromstring(z.read(taxonomy_member))
        taxonomy_publication=taxonomy.findtext('{http://xbrl.org/2016/taxonomy-package}publicationDate')
    contexts={}
    for c in root.findall('.//x:context',NS):
        ident=c.find('.//x:identifier',NS);period=c.find('x:period',NS)
        contexts[c.get('id')]={'identifier':ident.text,'identifier_scheme':ident.get('scheme'),'period':{etree.QName(e).localname:e.text for e in period},'dimensions':[{'axis':e.get('dimension'),'member':clean(''.join(e.itertext()))} for e in c.findall('.//d:explicitMember',NS)]}
    units={u.get('id'):{'native_xml':etree.tostring(u,encoding='unicode')} for u in root.findall('.//x:unit',NS)}
    facts=[]
    for e in root.findall('.//ix:nonFraction',NS):
        if e.get('contextRef') not in contexts or e.get('unitRef') not in units:raise ValueError('Unresolved ESEF reference')
        facts.append({'fact_id':e.get('id'),'concept':e.get('name'),'context_id':e.get('contextRef'),'unit_id':e.get('unitRef'),'decimals':e.get('decimals'),'scale':e.get('scale'),'sign':e.get('sign'),'format':e.get('format'),'native_text':clean(''.join(e.itertext())),'value_in_base_unit':esef_number(e),'source_member':member,'scope':'consolidated_group'})
    if len({f['fact_id'] for f in facts})!=len(facts):raise ValueError('Duplicate fact ID')
    tables=[]
    for i,t in enumerate(root.findall('.//h:table',NS)):
        rows=[[clean(''.join(c.itertext())) for c in row if etree.QName(c).localname in ['td','th']] for row in t.findall('.//h:tr',NS)]
        tables.append({'source_table_index':i,'section':'primary_statements' if i<8 else 'notes','rows':rows})
    for year in [2024,2025]:
        a=[Decimal(f['value_in_base_unit']) for f in facts if f['concept']=='ifrs:Assets' and f['context_id']==f'cez{year}end']
        p=[Decimal(f['value_in_base_unit']) for f in facts if f['concept']=='ifrs:EquityAndLiabilities' and f['context_id']==f'cez{year}end']
        if len(a)!=1 or a!=p:raise ValueError('Group balance sheet control failed')
    return {'scope':'consolidated_group','reporting_entity':'Skupina ČEZ','format':'ESEF inline XBRL','taxonomy_publication_date':taxonomy_publication,'taxonomy_date_definition':'Extension taxonomy package date, not annual-report publication or filing date','source_member':member,'contexts':contexts,'units':units,'numeric_facts':facts,'native_tables':tables,'comparator_2024':'restated in 2025 report; not original 2024 vintage','coverage':'All numeric inline-XBRL facts and all XHTML tables; textual note block tags are not flattened into numeric facts'}
def extract_individual():
    pages=[];facts=[]
    for page,statement in [(251,'balance_sheet'),(252,'income_statement'),(253,'comprehensive_income_and_equity_changes'),(254,'cash_flow')]:
        txt=subprocess.check_output(['pdftotext','-f',str(page),'-l',str(page),'-layout',str(CACHE/'annual-2025.pdf'),'-'],text=True)
        if '2025' not in txt or '2024' not in txt or 'V mil. Kč' not in txt:raise ValueError('Individual statement headers missing')
        pages.append({'pdf_page':page,'printed_page':page-7,'statement':statement,'layout_text':txt})
        equity=False
        for line_no,line in enumerate(txt.splitlines(),1):
            if 'Výkaz změn vlastního kapitálu' in line:equity=True
            if equity:continue # Native multi-column equity table retained; never misread its columns as years.
            cols=re.split(r'\s{2,}',line.strip())
            if len(cols)<3:continue
            try:values=[parse_number(c) for c in cols[-2:]]
            except ValueError:continue
            if cols[-2:]==['2025','2024']:continue
            label=cols[0]
            if not re.search('[A-Za-zÀ-ž]',label):continue
            unit='CZK_per_share' if statement=='income_statement' and label in ['Základní','Zředěný'] else 'million_CZK'
            for year,raw,val in zip([2025,2024],cols[-2:],values):facts.append({'scope':'individual_company','statement':statement,'label_cs':label,'note_reference':' '.join(cols[1:-2]),'year':year,'period':{'instant':f'{year}-12-31'} if statement=='balance_sheet' else {'startDate':f'{year}-01-01','endDate':f'{year}-12-31'},'native_value':raw,'value':str(val) if val is not None else None,'missing_kind':'source_dash' if val is None else None,'unit':unit,'pdf_page':page,'printed_page':page-7,'source_line':line_no})
    for year in [2024,2025]:
        def value(label):
            x=[f['value'] for f in facts if f['statement']=='balance_sheet' and f['year']==year and f['label_cs']==label]
            if len(x)!=1:raise ValueError('Missing/duplicate balance label '+label)
            return Decimal(x[0])
        if value('AKTIVA CELKEM')!=value('PASIVA CELKEM'):raise ValueError('Individual balance mismatch')
        if value('PASIVA CELKEM')!=sum(value(x) for x in ['Vlastní kapitál celkem','Dlouhodobé závazky celkem','Krátkodobé závazky celkem']):raise ValueError('Individual component mismatch')
    return {'scope':'individual_company','reporting_entity':'ČEZ, a. s.','native_statement_pages':pages,'facts':facts,'comparator_2024':'as published alongside 2025 individual statements','coverage':'Balance sheet, income, comprehensive income and cash flow numeric rows; equity-change table retained as native layout text, not forced into year columns','source_dash_policy':'Dashes preserved as null/source_dash, never silently converted to zero'}
def main():
    a=argparse.ArgumentParser();a.add_argument('--fetch',action='store_true');args=a.parse_args();CACHE.mkdir(parents=True,exist_ok=True)
    for name,url in URLS.items():
        path=CACHE/name;side=path.with_suffix(path.suffix+'.source.json')
        if args.fetch:
            tmp=path.with_suffix(path.suffix+'.tmp');subprocess.run(['curl','-fL','--max-time','180',url,'-o',str(tmp)],check=True);tmp.replace(path)
            side.write_text(json.dumps({'url':url,'retrieved_at':datetime.now(timezone.utc).isoformat(),'sha256':digest(path)},indent=2)+'\n')
        if not side.exists():raise ValueError('Retrieval sidecar missing: '+str(side))
        if json.loads(side.read_text())['sha256']!=digest(path):raise ValueError('Source digest mismatch')
    group=extract_group();individual=extract_individual()
    sources=[{'source_id':'cez2025-'+name,**json.loads((CACHE/name).with_suffix((CACHE/name).suffix+'.source.json').read_text()),'status':'official_ESEF_version' if name.endswith('.zip') else 'issuer_published_readable_unofficial_version','filing_date':None,'filing_status':'No Justice or regulator filing acquired'} for name in URLS]
    out={'schema_version':'1.0.0','source_family':'CEZ issuer annual accounts','entity':{'ico':'45274649','lei':'529900S5R9YHJHYKKG94','name':'ČEZ, a. s.','identity_locator':URLS['annual-2025.pdf']+'#page=255'},'financial_period':{'start':'2025-01-01','end':'2025-12-31'},'financial_basis':'IFRS as adopted by EU; accrual financial statements, not public-budget cash spending','statement_authorised_for_issue_at':'2026-04-07','approval_evidence':{'source':URLS['annual-2025.pdf'],'pdf_pages':[243,303]},'audit_status':'audited final annual statements','audit_report_pdf_pages':[244,304],'publication_date':'2026-04-28','publication_date_evidence':'https://www.cez.cz/cs/pro-investory/kalendar-ir-akci','filing_date':None,'landing_url':LANDING,'sources':sources,'group':group,'individual':individual,'reported_ownership':{'as_of':'2025-12-31','owner_name':'Česká republika zastoupená Ministerstvem financí','capital_share_percent':69.8,'voting_share_percent':69.9,'source_url':URLS['annual-2025.pdf'],'pdf_page':255,'basis':'issuer direct disclosure, not inferred from MF consolidation register'},'limitations':['Individual and group accounts are separate scopes and must not be added.','2024 MF card and its financial amounts remain unchanged; annual-report 2024 comparators stay in this report vintage.','No regulatory/Justice filing date inferred from issuer publication or retrieval.','ESEF contexts, dimensions, units, duplicate concept occurrences and source signs are preserved; sum only explicitly selected contexts.']}
    target=ROOT/'data/cez-issuer-2025.v1.json';target.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    cards=ROOT/'data/cz-state-enterprises-2024.json';d=json.loads(cards.read_text())
    for e in d['entities']:
        if e.get('ico')=='45274649':e['additional_financial_sources']=[{'dataset':'data/cez-issuer-2025.v1.json','period_end':'2025-12-31','scopes':['individual_company','consolidated_group'],'replaces_2024_card':False,'issuer_url':LANDING}]
    cards.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'group_numeric_facts':len(group['numeric_facts']),'group_tables':len(group['native_tables']),'individual_facts':len(individual['facts']),'output_bytes':target.stat().st_size}))
if __name__=='__main__':main()
