#!/usr/bin/env python3
"""Fetch official NKU audit links and SFDI financing; retain source tables separately."""
import argparse,csv,gzip,hashlib,io,json,re,shutil,subprocess,zipfile,sqlite3,tempfile
import xml.etree.ElementTree as ET
from datetime import datetime,timezone
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[2]
CACHE=ROOT/'data/source_cache/czech-audit-transport'
OUT=ROOT/'website/data'
SFDI='https://sfdi.gov.cz/o-sfdi/rozpocet-sfdi/'
NKU='https://nkuweb.nku.cz/cz/otevreny-urad/opendata/'
FIN='https://kz.sfdi.cz/exporty/export_evid_m330.xlsx'
APPROVED='https://sfdi.gov.cz/wp-content/uploads/2026/03/schvaleny-rozpocet-2026-a-sdv-prilohy.xlsx'
def stamp():return datetime.now(timezone.utc).isoformat()
def write(p,v):
 p.parent.mkdir(parents=True,exist_ok=True)
 if p.parent.name=='czech-nku':
  archive=p.with_name(p.stem+'.native.json.gz')
  with gzip.open(archive,'wt',encoding='utf-8') as f:json.dump(v,f,ensure_ascii=False,separators=(',',':'),default=str)
  count=len(v.get('rows',[])) if 'rows' in v else sum(len(t['rows']) for t in v.get('tables',[]))
  v={'source':v['source'],'rows':count,'download_path':'/data/czech-nku/'+archive.name,'format':'gzip-compressed native JSON','sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
 p.write_text(json.dumps(v,ensure_ascii=False,separators=(',',':'),default=str)+'\n')
def fetch(url,refresh=False):
 p=CACHE/(hashlib.sha256(url.encode()).hexdigest()[:12]+'-'+Path(urlsplit(url).path).name)
 if not p.name.split('-',1)[1]:p=p.with_name(p.name+'index.html')
 meta=p.with_suffix(p.suffix+'.meta.json')
 if refresh or not p.exists() or not meta.exists():
  p.parent.mkdir(parents=True,exist_ok=True)
  tmp=p.with_suffix(p.suffix+'.part')
  subprocess.run(['curl','--fail','--location','--silent','--show-error','--retry','3','--max-time','120','--output',str(tmp),url],check=True)
  tmp.replace(p)
  write(meta,{'url':url,'retrieved_at':stamp(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 m=json.loads(meta.read_text())
 if hashlib.sha256(p.read_bytes()).hexdigest()!=m['sha256']:raise ValueError('Cache checksum mismatch')
 return p,m
class Links(HTMLParser):
 def __init__(self):super().__init__();self.urls=[]
 def handle_starttag(self,t,a):
  if t=='a' and dict(a).get('href'):self.urls.append(dict(a)['href'])
def xml_rows(stream):
 stack=[]
 for event,node in ET.iterparse(stream,events=('start','end')):
  if event=='start':stack.append(node);continue
  if node.tag.endswith('}row'):
   yield node
   if len(stack)>1:stack[-2].remove(node)
   node.clear()
  stack.pop()

def tables(p):
 # Read OOXML values directly: publisher date formats sometimes decorate money
 # cells. Never let a style convert a financial number into a date or error.
 ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 result=[]
 with zipfile.ZipFile(p) as z:
  strings=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   strings=[''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
  rel={r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',ns):
   target=rel[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
   path=target.lstrip('/') if target.startswith('/') else 'xl/'+target
   rows=[]
   for row in xml_rows(z.open(path)):
    values=[];formulas={}
    for c in row:
     coord=c.attrib['r'];letters=re.match('[A-Z]+',coord)[0];idx=0
     for ch in letters:idx=idx*26+ord(ch)-64
     raw=c.findtext('s:v',default=None,namespaces=ns);typ=c.get('t')
     if typ=='s':v=strings[int(raw)] if raw is not None else None
     elif typ=='inlineStr':v=''.join(c.find('s:is',ns).itertext())
     elif typ in ('str','e','d'):v=raw
     elif raw is not None:
      v=float(raw) if any(x in raw.lower() for x in ('.','e')) else int(raw)
     else:v=None
     while len(values)<idx:values.append(None)
     values[idx-1]=v
     formula=c.findtext('s:f',default=None,namespaces=ns)
     if formula is not None:formulas[coord]=formula
    while values and values[-1] is None:values.pop()
    if values or formulas:rows.append({'row':int(row.attrib['r']),'values':values,**({'formulas':formulas} if formulas else {})})
   result.append({'sheet':sheet.attrib['name'],'rows':rows,'value_policy':'Native OOXML values and cached formula results; numeric date serials preserved without style-based coercion. Original workbook retains formatting.'})
 return result

def file_sha256(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()

class DiskStrings:
 """Bound shared-string memory even for the publisher's 174 MB string XML."""
 def __init__(self,db):self.db=db
 def __getitem__(self,key):return self.db.execute('select value from strings where id=?',(key,)).fetchone()[0]

def nku_native_rows(p):
 ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 with tempfile.TemporaryDirectory(prefix='nku-strings-') as tmp,zipfile.ZipFile(p) as z:
  db=sqlite3.connect(str(Path(tmp)/'strings.sqlite'))
  try:
   db.execute('create table strings(id integer primary key,value text)')
   if 'xl/sharedStrings.xml' in z.namelist():
    with z.open('xl/sharedStrings.xml') as stream:
     stack=[];idx=0
     for event,node in ET.iterparse(stream,events=('start','end')):
      if event=='start':stack.append(node);continue
      if node.tag.endswith('}si'):
       db.execute('insert into strings values(?,?)',(idx,''.join(node.itertext())));idx+=1
       stack[-2].remove(node);node.clear()
      stack.pop()
    db.commit()
   strings=DiskStrings(db)
   rel={r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
   for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',ns):
    yield sheet.attrib['name'],None
    target=rel[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
    path=target.lstrip('/') if target.startswith('/') else 'xl/'+target
    with z.open(path) as stream:
     for row in xml_rows(stream):
      values=[];formulas={}
      for c in row:
       coord=c.attrib['r'];letters=re.match('[A-Z]+',coord)[0];idx=0
       for ch in letters:idx=idx*26+ord(ch)-64
       raw=c.findtext('s:v',default=None,namespaces=ns);typ=c.get('t')
       if typ=='s':v=strings[int(raw)] if raw is not None else None
       elif typ=='inlineStr':v=''.join(c.find('s:is',ns).itertext())
       elif typ in ('str','e','d'):v=raw
       elif raw is not None:
        v=float(raw) if any(x in raw.lower() for x in ('.','e')) else int(raw)
       else:v=None
       while len(values)<idx:values.append(None)
       values[idx-1]=v
       formula=c.findtext('s:f',default=None,namespaces=ns)
       if formula is not None:formulas[coord]=formula
      while values and values[-1] is None:values.pop()
      if values or formulas:yield sheet.attrib['name'],{'row':int(row.attrib['r']),'values':values,**({'formulas':formulas} if formulas else {})}
  finally:db.close()

def publish_nku_workbook(p,source,key,max_bytes=16*1024*1024,expected_rows=None):
 """Gzipped native JSON shards bounded before compression, never a workbook-sized object.

 Each shard retains sheet, original one-based row numbers, positional values and
 formula coordinate maps. Null padding preserves the original column coordinates.
 The old archive is removed only after every shard has been re-read and verified.
 """
 if max_bytes<1024:raise ValueError('Shard limit too small')
 directory=OUT/'czech-nku';directory.mkdir(parents=True,exist_ok=True)
 old_path=directory/(key+'.json')
 if old_path.exists() and expected_rows is None:
  previous=json.loads(old_path.read_text())
  if previous['source'].get('sha256')==source.get('sha256'):expected_rows=previous['rows']
 policy='Native OOXML values and cached formula results; numeric date serials preserved without style-based coercion. Original workbook retains formatting.'
 shards=[];sheets=[];total=0;source_digest=hashlib.sha256();buffer=[];size=0;prefix=b'';sheet_name=None
 def encode(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'),default=str).encode('utf-8')
 def flush():
  nonlocal buffer,size
  if not buffer:return
  data=prefix+b','.join(buffer)+b']}'
  if len(data)>=max_bytes:raise ValueError('Oversized shard')
  # Content-addressed filenames keep the prior manifest valid until publication.
  native_digest=hashlib.sha256(data).hexdigest();compressed=gzip.compress(data,compresslevel=9,mtime=0);digest=hashlib.sha256(compressed).hexdigest()
  name=f'{key}.table-{len(sheets):02d}.part-{len(shards)+1:04d}.{native_digest[:12]}.json.gz'
  dest=directory/name;tmp=dest.with_suffix('.part');tmp.write_bytes(compressed);tmp.replace(dest)
  rows=json.loads(data)['rows']
  shards.append({'path':'/data/czech-nku/'+name,'sheet':sheet_name,'rows':len(rows),'first_source_row':rows[0]['row'],'last_source_row':rows[-1]['row'],'bytes':len(compressed),'sha256':digest,'uncompressed_bytes':len(data),'uncompressed_sha256':native_digest,'content_encoding':'gzip'})
  buffer=[];size=len(prefix)+2
 for name,row in nku_native_rows(p):
  if row is None:
   flush();sheet_name=name;sheets.append({'sheet':name,'rows':0})
   prefix=encode({'source':source,'sheet':name,'value_policy':policy})[:-1]+b',"rows":[';size=len(prefix)+2
   continue
  raw=encode(row)
  if size+len(raw)+(1 if buffer else 0)>=max_bytes:flush()
  if size+len(raw)>=max_bytes:raise ValueError('Single native row exceeds shard limit')
  buffer.append(raw);size+=len(raw)+(1 if len(buffer)>1 else 0)
  source_digest.update(encode([name,row])+b'\n');total+=1;sheets[-1]['rows']+=1
 flush()
 if expected_rows is not None and total!=expected_rows:raise ValueError(f'Native row count changed: {total} != {expected_rows}')
 verified=0;verification_digest=hashlib.sha256()
 for shard in shards:
  path=directory/Path(shard['path']).name
  if path.stat().st_size>=max_bytes or file_sha256(path)!=shard['sha256']:raise ValueError('Shard integrity failure')
  payload=json.loads(gzip.decompress(path.read_bytes()))
  for row in payload['rows']:verification_digest.update(encode([payload['sheet'],row])+b'\n');verified+=1
 if verified!=total or verification_digest.digest()!=source_digest.digest():raise ValueError('Native shard roundtrip mismatch')
 manifest={'source':source,'rows':total,'format':'gzip-compressed sharded native JSON','value_policy':policy,'max_uncompressed_shard_bytes_exclusive':max_bytes,'tables':sheets,'shards':shards,'verification':{'source_rows':total,'published_rows':verified,'canonical_native_rows_sha256':source_digest.hexdigest(),'includes':'Sheet names, row numbers, positional cells and formula coordinate maps'}}
 tmp=old_path.with_suffix('.part');tmp.write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n');tmp.replace(old_path)
 old_archive=directory/(key+'.native.json.gz')
 if old_archive.exists():old_archive.unlink()
 return manifest


def main():
 a=argparse.ArgumentParser();a.add_argument('--refresh',action='store_true');a.add_argument('--nku-workbook-key');args=a.parse_args()
 if args.nku_workbook_key:
  key=args.nku_workbook_key
  if not re.fullmatch('[a-f0-9]{12}',key):raise ValueError('Invalid workbook key')
  paths=list(CACHE.glob(key+'-*.xlsx'))
  if len(paths)!=1:raise ValueError('Expected one cached workbook')
  p=paths[0];m=json.loads(p.with_suffix(p.suffix+'.meta.json').read_text())
  if file_sha256(p)!=m['sha256']:raise ValueError('Source checksum mismatch')
  result=publish_nku_workbook(p,m,key)
  manifest_path=OUT/'czech-nku.v1.json';manifest=json.loads(manifest_path.read_text())
  for entry in manifest['datasets']:
   if entry['path']==f'/data/czech-nku/{key}.json':entry.update(rows=result['rows'],format=result['format'],shard_count=len(result['shards']))
  write(manifest_path,manifest);print(json.dumps({'rows':result['rows'],'shards':len(result['shards'])}));return
 get=lambda url:fetch(url,args.refresh)
 p,meta=get(FIN);native=tables(p);sheet=next(s for s in native if s['sheet']=='rozpočet+uvolněno');byrow={r['row']:r['values'] for r in sheet['rows']}
 headers=byrow[7];expected=['Evidenční číslo akce','Kód','D  ','T  ','Stav akce','Název akce','Celkem akce','Upravený rozpočet celkem','Uvolněno celkem']
 if headers[:9]!=expected:raise ValueError('SFDI financing schema changed')
 records=[]
 for row in sheet['rows']:
  v=row['values']
  if row['row']<=7 or not v or v[0] is None:continue
  if not isinstance(v[0],(int,float)):raise ValueError('Unexpected project ID')
  r=dict(zip([h.strip() for h in headers],v));r['source_row']=row['row'];r['project_id']=str(int(v[0]));r['cost_category']=str(int(v[1]));records.append(r)
 for col in (7,8):
  total=sum(Decimal(str(r[headers[col].strip()])) for r in records)
  if abs(total-Decimal(str(byrow[4][col])))>Decimal('.001'):raise ValueError('SFDI financing does not reconcile')
 if len(records)!=byrow[4][0]:raise ValueError('SFDI row count mismatch')
 write(OUT/'czech-sfdi-financing.v1.json',{'schema_version':'1.0.0','country_code':'CZE','generated_at':stamp(),'source':meta,'source_reference_date':byrow[3][5],'year':2026,'unit':'CZK_thousands','stage':'revised_budget_and_funds_released','definitions':{'records':'Project and investment/non-investment category lines; project IDs may repeat.','released':'Funds released by SFDI, not verified supplier invoice settlement.','total_project_cost':'Multi-year source estimate; repeated across cost categories. Never sum this field across all rows.','scope':'2026 SFDI without prefinancing; overlaps recipient budgets and contracts.','native_tables':'Original cells, including subtotal rows, preserved separately. Only identified detail rows enter summary.'},'row_count':len(records),'unique_projects':len({r['project_id'] for r in records}),'revised_budget_thousand_czk':byrow[4][7],'released_thousand_czk':byrow[4][8],'records':records,'native_tables':native})
 p,meta=get(SFDI);links=Links();links.feed(p.read_text());urls=sorted({u for u in links.urls if u.endswith('.xlsx') and 'prilohy' in u})
 if APPROVED not in urls:raise ValueError('Approved SFDI workbook disappeared from source page')
 books=[]
 for url in urls:
  p,m=get(url);tabs=tables(p);key=hashlib.sha256(url.encode()).hexdigest()[:12]
  write(OUT/f'czech-sfdi-tables/{key}.json',{'source':m,'tables':tabs})
  books.append({'source':m,'path':f'/data/czech-sfdi-tables/{key}.json','sheets':len(tabs),'native_rows':sum(len(t['rows']) for t in tabs)})
 write(OUT/'czech-sfdi-budget-tables.v1.json',{'schema_version':'1.0.0','country_code':'CZE','generated_at':stamp(),'source_url':SFDI,'definition':'Budget annexes linked by SFDI. Native units, periods, approved plans and outlooks remain in each table; do not add tables or assume actual spending.','workbooks':books})
 p,meta=get(NKU);links=Links();links.feed(p.read_text());urls=sorted({u for u in links.urls if u.startswith('https://data.nku.cz/') and u.endswith(('.csv','.xlsx'))});datasets=[]
 for url in urls:
  p,m=get(url);key=hashlib.sha256(url.encode()).hexdigest()[:12]
  if url.endswith('.csv'):
   raw=p.read_bytes()
   try:text=raw.decode('utf-8-sig');encoding='utf-8-sig'
   except UnicodeDecodeError:text=raw.decode('cp1250');encoding='cp1250'
   delimiter=csv.Sniffer().sniff(text[:16000],delimiters=',;\t').delimiter
   rows=[r for r in csv.reader(io.StringIO(text),delimiter=delimiter) if r];payload={'encoding':encoding,'delimiter':delimiter,'headers':rows[0] if rows else [],'rows':rows[1:]};count=max(len(rows)-1,0)
   payload['ragged_source_rows']=[i+2 for i,r in enumerate(payload['rows']) if len(r)!=len(payload['headers'])]
  else:
   published=publish_nku_workbook(p,m,key);count=published['rows']
  if url.endswith('.csv'):write(OUT/f'czech-nku/{key}.json',{'source':m,**payload})
  datasets.append({'source':m,'path':f'/data/czech-nku/{key}.json','rows':count,'type':'schema' if '_schema.' in url else 'data'})
 write(OUT/'czech-nku.v1.json',{'schema_version':'1.0.0','country_code':'CZE','generated_at':stamp(),'source_url':NKU,'definition':'Selective audits and audited entities, with original audit IDs and IČO where supplied. Audit coverage is not a national prevalence estimate; a listed audited entity is not itself a finding of wrongdoing. Schemas and native table headers preserved.','datasets':datasets})
 print(json.dumps({'sfdi_financing_lines':len(records),'sfdi_projects':len({r['project_id'] for r in records}),'sfdi_workbooks':len(books),'nku_datasets':len(datasets)}))
if __name__=='__main__':main()
