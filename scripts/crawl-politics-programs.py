#!/usr/bin/env python3
"""Fetch primary political programmes, retain private snapshots, extract fiscal candidates.
Full documents stay outside the serving tree. Only provenance is emitted publicly.
Candidates are discovery aids; reviewed promises live in a separate versioned dataset.
"""
import argparse, concurrent.futures, datetime, hashlib, io, json, re, subprocess
from pathlib import Path
import requests
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
FISCAL=re.compile(r'tax|fiscal|budget|deficit|debt|spend|pension|revenue|invest|welfare|dani|daně|daň|rozpoč|dluh|důchod|výdaj|schod|steuer|schulden|haushalt|rente|vermögen|skat|velfærd|offentlig|impôt|dépens|dette|déficit|retrait|podat|budżet|emeryt|złot|skatt|pension|utgift|подат|бюджет|пенсі|борг|оборону',re.I)
NUMBER=re.compile(r'\d|percent|prozent|procent|billion|million|milliard|miliard|prosent|percent|відсот',re.I)
def fetch(source,cache,refresh):
    sid=source['id']; folder=cache/sid;folder.mkdir(parents=True,exist_ok=True)
    metadata=folder/'metadata.json'
    if metadata.exists() and not refresh:
        saved=json.loads(metadata.read_text())
        if saved.get('status')=='extracted' and saved['url']==source['url']:
            latest=folder/('source.pdf' if saved['format']=='pdf' else 'source.html')
            snapshots=folder/'snapshots';snapshots.mkdir(exist_ok=True)
            snapshot=snapshots/(saved['sha256']+latest.suffix)
            if not snapshot.exists():snapshot.write_bytes(latest.read_bytes())
            return saved
    result={**source,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}
    try:
        response=requests.get(source['url'],timeout=50,headers={'User-Agent':'PublicSpendingData/1.0 (https://publicspendingdata.org; source verification)'})
        result.update(http_status=response.status_code,resolved_url=response.url)
        response.raise_for_status()
        raw=response.content
        result['sha256']=hashlib.sha256(raw).hexdigest()
        pdf=raw.startswith(b'%PDF')
        path=folder/('source.pdf' if pdf else 'source.html');path.write_bytes(raw)
        snapshots=folder/'snapshots';snapshots.mkdir(exist_ok=True)
        (snapshots/(result['sha256']+path.suffix)).write_bytes(raw)
        if pdf:
            subprocess.run(['pdftotext',str(path),str(folder/'text.txt')],check=True,capture_output=True)
            pages=(folder/'text.txt').read_text().split('\f')
            if not pages[-1].strip():pages.pop()
        else:
            soup=BeautifulSoup(raw,'html.parser')
            for tag in soup(['script','style','nav','header','footer']):tag.decompose()
            area=soup.select_one('article') or soup.select_one('main') or soup
            pages=[area.get_text('\n',strip=True)]
            (folder/'text.txt').write_text(pages[0])
        candidates=[]
        for page,text in enumerate(pages,1):
            paragraphs=re.split(r'\n\s*\n',text) if pdf else text.split('\n')
            for p in paragraphs:
                p=' '.join(p.split())
                if FISCAL.search(p) and NUMBER.search(p):
                    candidates.append({'page':page if pdf else None,'text':p})
        (folder/'pages.json').write_text(json.dumps(pages,ensure_ascii=False))
        (folder/'candidates.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2))
        length=sum(len(p.strip()) for p in pages)
        if length<300:raise ValueError('Too little document text; possibly a challenge page')
        result.update(status='extracted',format='pdf' if pdf else 'html',pages=len(pages) if pdf else None,characters=length,candidate_count=len(candidates))
    except Exception as error:result.update(status='failed',error=str(error)[:240])
    history=folder/'retrievals';history.mkdir(exist_ok=True)
    (history/(result['retrieved_at'].replace(':','-')+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    metadata.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache',type=Path,default=ROOT.parent/'outputs/politics-source-crawl')
    parser.add_argument('--refresh',action='store_true')
    parser.add_argument('--include-government-programs',action='store_true')
    args=parser.parse_args()
    if args.cache.resolve().is_relative_to(ROOT):parser.error('Full snapshots must remain outside the public repository')
    sources=json.loads((ROOT/'pipeline/config/politics_manifestos.v1.json').read_text())['sources']
    outcomes=ROOT/'pipeline/config/politics_outcome_sources.v1.json'
    if outcomes.exists():sources+=json.loads(outcomes.read_text())['sources']
    if args.include_government_programs:
        sources+=list(json.loads((ROOT/'pipeline/config/european_politics.v1.json').read_text())['documents'].values())
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(lambda source:fetch(source,args.cache,args.refresh),sources))
    output={'schema_version':'1.0.0','sources':{r['id']:r for r in results}}
    (ROOT/'data/politics-source-crawl.v1.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    for r in results:print(r['id'],r['status'],r.get('candidate_count',0),r.get('error',''))
if __name__=='__main__':main()
