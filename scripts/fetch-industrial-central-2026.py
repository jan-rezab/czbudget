#!/usr/bin/env python3
"""Direct 2026 national industrial production. Raw snapshots are never overwritten."""
import argparse,csv,datetime,hashlib,html,io,json,re,ssl,urllib.request,urllib.parse,os
from pathlib import Path
import openpyxl

P=argparse.ArgumentParser(); P.add_argument('--output',default='/Users/johnwick/dev/czbudget/outputs/20260907-industrial-direct/central'); A=P.parse_args()
OUT=Path(A.output); (OUT/'raw').mkdir(parents=True,exist_ok=True)
manifest=[]; observations=[]; errors={}
# Bundled Python can lack the system trust roots on macOS; preserve verification.
if not os.environ.get('SSL_CERT_FILE') and Path('/opt/homebrew/etc/openssl@3/cert.pem').exists():
    os.environ['SSL_CERT_FILE']='/opt/homebrew/etc/openssl@3/cert.pem'
def fetch(url,name):
    req=urllib.request.Request(url,headers={'User-Agent':'CZBudget research data ingestion (national statistics)'})
    with urllib.request.urlopen(req,timeout=60) as r: b=r.read(); headers=dict(r.headers); final=r.url
    at=datetime.datetime.now(datetime.timezone.utc).isoformat(); sha=hashlib.sha256(b).hexdigest()
    f=OUT/'raw'/f'{name}-{sha[:12]}'
    if not f.exists(): f.write_bytes(b)
    m=dict(source_url=url,resolved_url=final,retrieved_at=at,raw_file=str(f),sha256=sha,bytes=len(b),content_type=headers.get('Content-Type'),last_modified=headers.get('Last-Modified'))
    manifest.append(m); return b,m

def emit(country,publisher,dataset,code,label,period,measure,adjustment,value,m,base=None,status='unknown'):
    observations.append(dict(country=country,publisher=publisher,dataset=dataset,series_id=f'{dataset}:{code}:{measure}:{adjustment}',industry_code=code,industry_label=label,frequency='Q' if 'Q' in period else 'M',period=period,measure=measure,adjustment=adjustment,unit='index_points' if measure=='index' else 'percent',base_period=base,value=float(value),status=status,**{k:m[k] for k in ['source_url','retrieved_at','raw_file']}))

def czech():
    for ds in ['PRU01B','PRU01C']:
        b,m=fetch(f'https://data.csu.gov.cz/opendata/sady/{ds}/distribuce/csv',f'CZE-{ds}.csv')
        for r in csv.DictReader(io.StringIO(b.decode('utf-8-sig'))):
            period=r.get('CASMKMMQR',r.get('CASMQ',''))
            # Retain monthly and quarterly rows, excluding cumulative periods.
            if period.endswith('K'): continue
            if not re.fullmatch(r'\d{4}-(?:0[1-9]|1[0-2]|Q[1-4])',period): continue
            kind=r.get('TYPUDAJEZ',r.get('TYPUDAJEP2'))
            adj={'P':'CA','O':'SCA','N':'NSA'}.get(r.get('OCIST2',r.get('OCIST3')),'unknown')
            code=r['NACEIPP.NACE2'] or r['NACEIPP.NACE1']; label=r['CZ-NACE-Oddíl'] or r['CZ-NACE-Sekce']
            try: value=float(r['Hodnota'])
            except ValueError: continue
            if kind=='IZ2021': measure='index';base='2021'
            elif 'Meziroční' in r['Typ indexu']: measure='yoy_pct';base=None;value-=100
            elif 'Meziměsíční' in r['Typ indexu']: measure='mom_pct';base=None;value-=100
            elif 'Mezičtvrtletní' in r['Typ indexu']: measure='qoq_pct';base=None;value-=100
            else: continue
            emit('CZE','Czech Statistical Office',ds,code,label,period,measure,adj,value,m,base)
            observations[-1].update(raw_value=float(r['Hodnota']),transformation='source index minus 100' if measure!='index' else 'none')

def clean(s): return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',str(s)))).strip()
def germany():
    u='https://www.destatis.de/EN/Themes/Economy/Short-Term-Indicators/Production/pgw510.html'
    b,m=fetch(u,'DEU-pgw510.html'); s=b.decode('utf-8')
    codes=['B-D,F','C','MIG_ING','MIG_CAG','MIG_DCOG','MIG_NDCOG']; labels=['Production industries (including construction)','Manufacturing','Intermediate goods','Capital goods','Durable goods','Non-durable goods']
    for table in re.findall(r'<table\b.*?</table>',s,re.S):
        t=clean(table[:table.find('<tbody')]); measure='yoy_pct' if 'same month' in t or 'previous year' in t else 'mom_pct' if 'previous month' in t else 'index'
        year=None
        for row in re.findall(r'<tr\b.*?</tr>',table,re.S):
            cells=[clean(x) for x in re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>',row,re.S)]
            if cells and re.fullmatch(r'20\d\d',cells[0]): year=cells.pop(0)
            if year!='2026' or not cells:continue
            months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            if cells[0][:3] not in months:continue
            period=f'2026-{months.index(cells[0][:3])+1:02d}'
            if len(cells)!=7: raise ValueError(f'Unexpected German row {cells}')
            for code,label,v in zip(codes,labels,cells[1:]): emit('DEU','Destatis','pgw510',code,label,period,measure,'NSA',v,m,'2021' if measure=='index' else None,'provisional' if period=='2026-07' else 'unknown')

POL_CODES=['B-E','B','05','C','10','11','12','13','14','16','17','18','20','21','22','23','24','25','26','27','28','29','30','31','32','33','D','E','36','38']
POL_LABELS=['T O T A L','Mining and quarrying','Of which mining of coal and lignite','Manufacturing','Manufacture of food products','Manufacture of beverages','Manufacture of tobacco products','Manufacture of textiles','Manufacture of wearing apparel','Manufacture of products of wood, cork, straw and wicker','Manufacture of paper and paper products','Printing and reproduction of recorded media','Manufacture of chemicals and chemical products','Manufacture of pharmaceutical products','Manufacture of rubber and plastic products','Manufacture of other non-metallic mineral products','Manufacture of basic metals','Manufacture of metal products','Manufacture of computer, electronic and optical products','Manufacture of electrical equipment','Manufacture of machinery and equipment n.e.c.','Manufacture of motor vehicles, trailers and semi-trailers','Manufacture of other transport equipment','Manufacture of furniture','Other manufacturing','Repair and installation of machinery and equipment','Electricity, gas, steam and air conditioning supply','Water supply; sewerage, waste management and remediation activities','Water collection, treatment and supply','Waste collection, treatment and disposal activities; materials recovery']
def poland():
    months=['january','february','march','april','may','june','july']
    for n,month in enumerate(months,1):
        u=f'https://stat.gov.pl/en/topics/industry-construction-fixed-assets/industry/sold-production-of-industry-in-{month}-2026%2C12%2C{84+n}.html'
        b,meta=fetch(u,f'POL-{n:02d}-release.html');s=b.decode('utf-8','replace')
        links=list(dict.fromkeys(html.unescape(x) for x in re.findall(r'href=[\"\']([^\"\']+)[\"\']',s) if 'xlsx' in x and 'table' in x))
        if len(links)!=1:raise ValueError(f'Expected one Polish XLSX table for {month}; found {links}')
        b,m=fetch(urllib.parse.urljoin(u,links[0]),f'POL-{n:02d}.xlsx');w=openpyxl.load_workbook(io.BytesIO(b),data_only=True)
        rows=[]
        for row in w.active.values:
            if len(row)<4:continue
            try: y=float(row[2]);mo=float(row[3])
            except (TypeError,ValueError):continue
            rows.append((clean(row[0]).split('…')[0].strip().removesuffix('D'),y,mo))
        if len(rows)!=len(POL_CODES):raise ValueError(f'Unexpected Polish categories {len(rows)} in {month}')
        for expected,(label,_,_) in zip(POL_LABELS,rows):
            assert label.strip(' .')==expected.strip(' .'),f'Poland label/order changed: {label!r} != {expected!r}'
        for code,(label,y,mo) in zip(POL_CODES,rows):
            for measure,raw_value in [('yoy_pct',y),('mom_pct',mo)]:
                emit('POL','Statistics Poland (GUS)','sold-production-monthly',code,label,f'2026-{n:02d}',measure,'NSA',round(raw_value-100,6),m)
                observations[-1].update(raw_value=raw_value,transformation='source index minus 100')

def bundesbank():
    # Official national central bank adjustments based on Destatis production data.
    u='https://api.statistiken.bundesbank.de/rest/data/BBDE1/M.DE..BAA1..G.C.I21.A?format=csv&lang=en&startPeriod=2025-01&endPeriod=2026-12'
    b,m=fetch(u,'DEU-Bundesbank-BBDE1.csv'); rows=list(csv.reader(io.StringIO(b.decode('utf-8-sig'))))
    names=rows[0]; labels=rows[1]; meta={r[0]:r for r in rows[2:] if not re.fullmatch(r'20\d\d-\d\d',r[0])}
    periods={r[0]:r for r in rows if re.fullmatch(r'20\d\d-\d\d',r[0])}
    for i in range(1,len(names),2):
        series=names[i]; label=labels[i].split(' / ')[2]; native=series.split('.')[5]
        assert meta['unit'][i]=='2021=100',meta['unit'][i]
        adj={'W':'CA','Y':'SCA'}[series.split('.')[3]]
        code=native[3:5] if re.fullmatch(r'N2[A-Z]\d{6}',native) and native[3:5]!='00' else native
        for period,r in periods.items():
            if not period.startswith('2026-') or not r[i]:continue
            try:v=float(r[i])
            except ValueError:continue
            flag=r[i+1];status='provisional' if 'Provisional' in flag else 'unknown'
            emit('DEU','Deutsche Bundesbank (adjustments based on Destatis)','BBDE1',code,label,period,'index',adj,v,m,'2021',status)
            observations[-1].update(series_id=series,raw_value=v,transformation='none',original_publisher='Destatis',source_note=meta['Source'][i])
            measure='yoy_pct' if adj=='CA' else 'mom_pct'
            previous=f'2025-{period[-2:]}' if adj=='CA' else ('2025-12' if period[-2:]=='01' else f"2026-{int(period[-2:])-1:02d}")
            if previous not in periods or not periods[previous][i]:continue
            try:comparison=float(periods[previous][i])
            except ValueError:continue
            if comparison==0:continue
            emit('DEU','Deutsche Bundesbank (adjustments based on Destatis)','BBDE1',code,label,period,measure,adj,100*(v/comparison-1),m,None,status)
            observations[-1].update(series_id=series+':'+measure,raw_value=v,comparison_period=previous,comparison_value=comparison,transformation='100 * (current source index / comparison source index - 1)',original_publisher='Destatis',source_note=meta['Source'][i],precision_note='Growth computed from published indices rounded to one decimal; may differ from official growth calculated with unrounded indices')

def germany_all():
    germany(); bundesbank()

for country,fn in [('CZE',czech),('DEU',germany_all),('POL',poland)]:
    try: fn()
    except Exception as e: errors[country]=str(e)
    print(country,sum(r['country']==country for r in observations),errors.get(country,''),flush=True)
keys=['country','series_id','frequency','period']; unique={}; exact_duplicates=0
for r in observations:
    key=tuple(r[k] for k in keys)
    if key in unique:
        assert unique[key]==r,f'Conflicting observation: {key}'
        exact_duplicates+=1
    unique[key]=r
observations=list(unique.values())
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
(OUT/'observations.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in observations))
limitations={'CZE':['Bulk CSV contains historical rows; normalization retains 2026 M/Q only. Cumulative observations excluded. Relative indices converted to percent changes by subtracting 100.'], 'DEU':['Destatis HTML provides six unadjusted aggregates. Bundesbank official national CSV adds CA/SCA detailed indices based on Destatis. Growth is derived from rounded indices and can differ slightly from official published growth. Detailed CA coverage is narrower than SCA. Includes explicitly labeled construction aggregates. GENESIS API unavailable; no Eurostat fallback.'], 'POL':['Published selected NACE divisions only; firms with at least ten persons employed. Unadjusted sold production, constant prices. Relative indices converted to percent changes by subtracting 100.']}
coverage={}
for c in ['CZE','POL','DEU']:
    rr=[r for r in observations if r['country']==c]; coverage[c]=dict(observations=len(rr),periods=sorted({r['period'] for r in rr}),categories=sorted({r['industry_code'] for r in rr}),measures=sorted({r['measure'] for r in rr}),limitations=limitations[c],error=errors.get(c),exact_duplicates_removed=exact_duplicates,status='partial' if c in errors else 'downloaded')
(OUT/'coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2)); print(json.dumps(coverage,ensure_ascii=False))
