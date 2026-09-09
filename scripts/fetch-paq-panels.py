#!/usr/bin/env python3
"""Snapshot public, aggregated chart data from PAQ's two household panels."""
import argparse, concurrent.futures, hashlib, json, re, time, urllib.parse, urllib.request
from pathlib import Path

def main():
    p=argparse.ArgumentParser();p.add_argument('--archive',required=True);p.add_argument('--output',required=True);p.add_argument('--public-output',required=True);args=p.parse_args()
    archive=Path(args.archive);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    public=Path(args.public_output);public.mkdir(parents=True,exist_ok=True)
    urls=set()
    for file in archive.glob('*.meta.json'):
        record=json.loads(file.read_text())
        if record['url'] in ['https://data.irozhlas.cz/zivot/projekt/','https://zivotbehempandemie.cz/']:
            for link in record.get('links',[]):
                u=urllib.parse.urlparse(link)
                if (u.netloc=='data.irozhlas.cz' and u.path.startswith('/zivot/')) or u.netloc=='zivotbehempandemie.cz':
                    urls.add(urllib.parse.urlunparse(u._replace(query='',fragment='')))
    def get(url):
        key=hashlib.sha256(url.encode()).hexdigest();target=out/(key+'.html')
        if not target.exists():
            with urllib.request.urlopen(url,timeout=60) as response:target.write_bytes(response.read())
        match=re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',target.read_text(),re.S)
        if not match:return {'url':url,'status':'no_embedded_data'}
        raw=json.loads(match.group(1));(out/(key+'.json')).write_text(json.dumps(raw,ensure_ascii=False))
        props=raw.get('props',{}).get('pageProps',{});data=props.get('data')
        if not isinstance(data,dict) or not data.get('total'):return {'url':url,'status':'not_a_chart'}
        project='Život k nezaplacení' if 'irozhlas' in url else 'Život během pandemie'
        title=props.get('texts',{}).get('pageData',{}).get('title') or props.get('chartKey') or props.get('key')
        return {'url':url,'status':'downloaded','project':project,'key':props.get('chartKey') or props.get('key'),
            'title':title,'geography':'stat:CZ','population':'Published survey population and subgroups; not individual respondents or municipality estimates',
            'methodology_url':url,'source_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
            'attribution':'PAQ Research / Český rozhlas / NMS' if 'irozhlas' in url else 'PAQ Research / NMS',
            'data':data}
    records=[];errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures={executor.submit(get,u):u for u in sorted(urls)}
        for future in concurrent.futures.as_completed(futures):
            try:records.append(future.result())
            except Exception as e:errors.append({'url':futures[future],'error':str(e)})
    charts={}
    for row in records:
        if row['status']=='downloaded':charts.setdefault((row['project'],row['key']),row)
    result={'retrieved_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'scope':'Published aggregated household panel charts only. All chart periods and published respondent-group aggregates retained. Source terms apply separately; no DataPAQ licence is assigned to these partner datasets.','charts':list(charts.values()),'unavailable':errors}
    (out/'manifest.json').write_text(json.dumps({'records':records,'errors':errors},ensure_ascii=False))
    (public/'panels.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
    print('Charts',len(charts),'errors',errors,flush=True)

if __name__=='__main__':main()
