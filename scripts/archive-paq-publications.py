#!/usr/bin/env python3
"""Archive public catalogue pages and their directly linked research/data downloads.

Local preservation only. The manifest does not grant republication rights to PDFs.
"""
import argparse, concurrent.futures, hashlib, json, re, time, urllib.parse, urllib.request
from html.parser import HTMLParser
from pathlib import Path

class Links(HTMLParser):
    def __init__(self): super().__init__(); self.urls=[]
    def handle_starttag(self, tag, attrs):
        if tag in ['a','iframe']:
            a=dict(attrs); url=a.get('href') or a.get('src')
            if url:self.urls.append(url)

def main():
    p=argparse.ArgumentParser();p.add_argument('--catalogue',required=True);p.add_argument('--output',required=True)
    args=p.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    catalogue=json.loads(Path(args.catalogue).read_text());records=[]
    def get(url):
        uid=hashlib.sha256(url.encode()).hexdigest(); suffix=Path(urllib.parse.urlparse(url).path).suffix.lower()
        suffix=suffix if suffix in ['.pdf','.xlsx','.xls','.csv','.zip','.json','.tsv','.sav','.dta','.rds'] else '.html'
        target=out/(uid+suffix);meta=out/(uid+'.meta.json')
        if meta.exists() and target.exists():return json.loads(meta.read_text())
        error=None
        for attempt in range(3):
            try:
                request=urllib.request.Request(url,headers={'User-Agent':'PublicSpendingData research archive/1.0'})
                with urllib.request.urlopen(request,timeout=60) as response:
                    content=response.read();final=response.url;ctype=response.headers.get('Content-Type','')
                target.write_bytes(content);r={'url':url,'final_url':final,'file':target.name,'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content),'content_type':ctype}
                if 'html' in ctype or suffix=='.html':
                    parser=Links();parser.feed(content.decode('utf-8',errors='replace'));r['links']=sorted(set(urllib.parse.urljoin(final,u) for u in parser.urls))
                meta.write_text(json.dumps(r,ensure_ascii=False));time.sleep(.2);return r
            except Exception as e:error=str(e);time.sleep(attempt+1)
        return {'url':url,'error':error}
    urls=sorted(set(e['url'] for e in catalogue['entries'])|{'https://www.paqresearch.cz/datove-nastroje/','https://data.irozhlas.cz/zivot/','https://data.irozhlas.cz/zivot/projekt/','https://zivotbehempandemie.cz/','https://www.mapavzdelavani.cz/','https://chytrejsidane.cz/'})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        for i,r in enumerate(executor.map(get,urls)):
            records.append(r)
            if i%20==0:print(f'Pages {i+1}/{len(urls)}',flush=True)
    files=sorted(set(u for r in records for u in r.get('links',[]) if re.search(r'\.(pdf|xlsx?|csv|tsv|zip|json|sav|dta|rds)(?:\?|$)',u,re.I) and urllib.parse.urlparse(u).scheme in ['https','http']))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        for i,r in enumerate(executor.map(get,files)):
            records.append(r)
            if i%20==0:print(f'Attachments {i+1}/{len(files)}',flush=True)
    manifest={'retrieved_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'scope':'Public PAQ catalogue pages, named public tools and directly linked research/data files; not private data or an unlimited recursive web crawl. Rights remain with original publishers.','records':records}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    print('Complete:',len(records),'items;',sum('error' in r for r in records),'unavailable',flush=True)

if __name__=='__main__':main()
