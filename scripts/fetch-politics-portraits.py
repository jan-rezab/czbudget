#!/usr/bin/env python3
"""Download leader thumbnails with Wikimedia source and licence attribution."""
import json,re,hashlib,concurrent.futures,io
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
HEADERS={'User-Agent':'PublicSpendingData/1.0 (https://publicspendingdata.org; illustrated historical report)'}
config=json.loads((ROOT/'pipeline/config/european_politics.v1.json').read_text())
names=sorted({re.sub(r' [IV]+$','',g['leader']) for c in config['countries'].values() if c['code']!='CHE' for g in c['terms']})
folder=ROOT/'assets/politics';folder.mkdir(exist_ok=True)
meta={}
if (folder/'portraits.json').exists():meta=json.loads((folder/'portraits.json').read_text())
def fetch(name):
 if name in meta:return name,meta[name]
 def get(url,**kw):
  r=requests.get(url,headers=HEADERS,timeout=40,**kw);r.raise_for_status();return r
 try:
  pages=get('https://en.wikipedia.org/w/api.php',params={'action':'query','titles':name,'redirects':1,'prop':'pageimages','piprop':'name','format':'json'}).json()['query']['pages']
  filename=next(iter(pages.values()))['pageimage']
  pages=get('https://commons.wikimedia.org/w/api.php',params={'action':'query','titles':'File:'+filename,'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':160,'format':'json'}).json()['query']['pages']
  info=next(iter(pages.values()))['imageinfo'][0];m=info['extmetadata'];lic=m.get('LicenseShortName',{}).get('value','')
  if not ('CC' in lic or 'Public domain' in lic or lic in ['OGL 3','Licence Ouverte'] or (lic=='Attribution' and 'European Union license' in m.get('Categories',{}).get('value',''))):raise ValueError('Review licence '+lic)
  raw=get(info['thumburl']).content
  im=Image.open(io.BytesIO(raw)).convert('RGB');im.thumbnail((160,200))
  stem=hashlib.sha256(name.encode()).hexdigest()[:12]+'.jpg';im.save(folder/stem,quality=86)
  clean=lambda k:BeautifulSoup(m.get(k,{}).get('value',''),'html.parser').get_text(' ',strip=True)
  return name,{'path':'assets/politics/'+stem,'source':info['descriptionurl'],'author':clean('Artist'),'attribution':clean('Attribution'),'license':lic,'license_url':clean('LicenseUrl'),'image_date':clean('DateTimeOriginal'),'modification':'Resized thumbnail; displayed with circular crop','retrieved_on':'2026-09-05'}
 except Exception as e:print(name,str(e)[:200],flush=True);return name,None
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for name,result in pool.map(fetch,names):
  if result:meta[name]=result
(folder/'portraits.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(f'{len(meta)}/{len(names)} portraits')
