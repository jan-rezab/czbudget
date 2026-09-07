#!/usr/bin/env python3
"""Download national IPI 2026 observations; raw provenance preserved. Stdlib only."""
import argparse,csv,datetime,hashlib,io,itertools,json,math,pathlib,urllib.request,zipfile,xml.etree.ElementTree as ET
P=argparse.ArgumentParser();P.add_argument('--output',default='/Users/johnwick/dev/czbudget/outputs/20260907-industrial-direct/north');args=P.parse_args();out=pathlib.Path(args.output);(out/'raw').mkdir(parents=True,exist_ok=True)
manifest=[];rows=[];coverage={}
def fetch(url,name,body=None):
 data=None if body is None else json.dumps(body).encode();req=urllib.request.Request(url,data=data,headers={'User-Agent':'CZBudget national statistics research','Accept':'application/json, */*','Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=60) as r:b=r.read()
 path=out/'raw'/name;path.write_bytes(b);stamp=datetime.datetime.now(datetime.timezone.utc).isoformat();manifest.append(dict(source_url=url,retrieved_at=stamp,raw_file=str(path),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),request_body=body));return b,manifest[-1]
def add(country,publisher,dataset,industry,label,series,period,measure,adj,value,meta,base='2021',status='unknown'):
 try:value=float(str(value).replace(',','.'))
 except (ValueError,TypeError):return
 if not math.isfinite(value) or not period.startswith('2026-'):return
 rows.append(dict(country=country,publisher=publisher,dataset=dataset,series_id=series,industry_code=industry,industry_label=label,frequency='M',period=period,measure=measure,adjustment=adj,unit='percent' if 'pct' in measure else 'index',base_period=base,value=value,status=status,**{k:meta[k] for k in ('source_url','retrieved_at','raw_file')}))
def sweden():
 url='https://api.scb.se/OV0104/v1/doris/en/ssd/START/NV/NV0402/NV0402A/IPI2010KedjM';b,_=fetch(url,'SWE_metadata.json');m=json.loads(b);query=[]
 for v in m['variables']:query.append({'code':v['code'],'selection':{'filter':'item','values':[x for x in v['values'] if x.startswith('2026')] if v.get('time') else v['values']}})
 b,meta=fetch(url,'SWE_data.json',{'query':query,'response':{'format':'json-stat2'}});j=json.loads(b);dims=j['id'];cats={k:sorted(j['dimension'][k]['category']['index'],key=j['dimension'][k]['category']['index'].get) for k in dims};labels=j['dimension']['SNI2007']['category']['label'];vals=j['value'];mapping={'NV0402AJ':('index','CA'),'NV0402AK':('index','NSA'),'NV0402AL':('index','SCA'),'NV0402AM':('trend_index','unknown'),'NV0402AY':('mom_pct','SCA'),'NV0402AZ':('yoy_pct','CA')}
 for i,combo in enumerate(itertools.product(*(cats[k] for k in dims))):
  d=dict(zip(dims,combo));v=vals[i] if isinstance(vals,list) else vals.get(str(i));measure,adj=mapping[d['ContentsCode']];add('SWE','Statistics Sweden','IPI2010KedjM',d['SNI2007'],labels[d['SNI2007']],d['SNI2007']+'.'+d['ContentsCode'],d['Tid'].replace('M','-'),measure,adj,v,meta,None if 'pct' in measure else '2021')
 coverage['SWE']={'limitations':['Trend kept as separate trend_index with adjustment unknown; no interpolation of suppressed values.']}
def denmark():
 b,_=fetch('https://api.statbank.dk/v1/tableinfo/IPOP21?format=JSON&lang=en','DNK_metadata.json');m=json.loads(b);vs=m['variables'];body={'table':'IPOP21','format':'BULK','lang':'en','valuePresentation':'Code','variables':[{'code':v['id'],'values':[x['id'] for x in v['values'] if not v['time'] or x['id'].startswith('2026')]} for v in vs]};b,meta=fetch('https://api.statbank.dk/v1/data','DNK_data.csv',body);labels={x['id']:x['text'] for x in vs[1]['values']}
 for r in csv.DictReader(io.StringIO(b.decode('utf-8-sig')),delimiter=';'):
  keys=list(r);industry=r[keys[1]];add('DNK','Statistics Denmark','IPOP21',industry,labels[industry],industry+'.'+r[keys[0]],r[keys[2]].replace('M','-'),'index','NSA' if r[keys[0]]=='EJSÆSON' else 'SA',r[keys[3]],meta)
 coverage['DNK']={'limitations':['DB25 national industry classification; two published adjustment variants; percent changes not derived.']}
def france():
 url='https://bdm.insee.fr/series/sdmx/data/IPI-2021?startPeriod=2026-01';b,meta=fetch(url,'FRA_data.xml');root=ET.fromstring(b)
 for s in root.iter():
  if s.tag.split('}')[-1]!='Series':continue
  a=s.attrib
  if a.get('FREQ')!='M':continue
  industry=a.get('NAF2','SO')
  if industry=='SO':industry=a.get('AUTRES_REGROUPEMENTS','unknown')
  label=a.get('TITLE_EN') or a.get('TITLE_FR') or industry
  adj={'BRUT':'NSA','CVS-CJO':'SCA'}.get(a.get('CORRECTION'),'unknown')
  measure={'INDICE':'index','GLISSEMENT_ANNUEL':'yoy_pct','VARIATIONS_M':'mom_pct'}.get(a.get('NATURE'))
  if measure is None:continue
  for o in s:
   if o.tag.split('}')[-1]=='Obs':add('FRA','INSEE','IPI-2021',industry,label,a['IDBANK'],o.get('TIME_PERIOD',''),measure,adj,o.get('OBS_VALUE'),meta,None if 'pct' in measure else a.get('BASIND'),{'P':'provisional','R':'revised'}.get(o.get('OBS_STATUS'),'unknown'))
 if not any(r['country']=='FRA' for r in rows):raise ValueError('No 2026 observations extracted from INSEE response')
 coverage['FRA']={'limitations':['Metropolitan France (REF_AREA FM). National IPI family includes construction aggregates, preserved as explicitly labelled series. Annual-frequency series excluded.']}
for country,fn in [('SWE',sweden),('DNK',denmark),('FRA',france)]:
 try:fn()
 except Exception as e:coverage[country]={'blocked':True,'limitations':[str(e)]}
 rr=[r for r in rows if r['country']==country];coverage[country].update(observations=len(rr),months=sorted(set(r['period'] for r in rr)),categories=len(set(r['industry_code'] for r in rr)),measures=sorted(set(r['measure'] for r in rr)));print(country,coverage[country],flush=True)
# Validate the meaningful invariants before replacing normalized outputs.
keys=[(r['country'],r['series_id'],r['period']) for r in rows]
assert len(keys)==len(set(keys)), 'Duplicate country/series/period observations'
assert all(r['period'].startswith('2026-') and math.isfinite(r['value']) for r in rows)
for asset in manifest:
 assert hashlib.sha256(pathlib.Path(asset['raw_file']).read_bytes()).hexdigest()==asset['sha256']
(out/'observations.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows));(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));(out/'coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2))
