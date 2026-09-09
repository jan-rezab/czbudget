#!/usr/bin/env python3
"""Refresh official MF inputs into shared raw cache; no UI or deployment side effects."""
import json,urllib.request,hashlib
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];CACHE=ROOT/'data/source_cache'
CATALOG='https://monitor.statnipokladna.gov.cz/api/opendata/monitor'
def fetch(url,path):
    path.parent.mkdir(parents=True,exist_ok=True)
    req=urllib.request.Request(url,headers={'User-Agent':'PublicSpendingData/1.0'})
    with urllib.request.urlopen(req,timeout=180) as r:raw=r.read()
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_bytes(raw);tmp.replace(path)
    path.with_suffix(path.suffix+'.source.json').write_text(json.dumps({'url':url,'retrieved_at':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(raw).hexdigest()},ensure_ascii=False)+'\n')
    return raw

def main():
    cat=json.loads(fetch(CATALOG,CACHE/'monitor2026/catalog.json'))
    candidates=sorted(u for u in cat['datová_sada'] if '/FinM_2026/2026_' in u)
    if not candidates:raise ValueError('No C063 dataset published')
    meta=json.loads(fetch(candidates[-1],CACHE/'monitor2026/fin2026-metadata.json'))
    url=next(d['soubor_ke_stažení'] for d in meta['distribuce'] if d.get('soubor_ke_stažení','').endswith('.zip'))
    period=meta['časové_pokrytí']['konec'];name=period[:7].replace('-','_')+'_FINM2026.zip'
    fetch(url,CACHE/'monitor2026'/name)
    files={'history-2024.xlsx':'2024-12-31_Priloha-c-2-Vyvoj-jednotlivych-polozek-ucetnich-vykazu-za-Ceskou-republiku-2016-2024.xlsx','perimeter-2024.xlsx':'2024-12-31_Priloha-c-3-Konsolidacni-celek-Ceska-republika.xlsx'}
    for name,remote in files.items():fetch('https://mf.gov.cz/assets/attachments/'+remote,CACHE/'mf_consolidated'/name)
    fetch('https://mf.gov.cz/assets/attachments/2026-04-30_C-Zprava-o-vysledcich-hospodareni-statniho-rozpoctu_v01.pdf',CACHE/'mf_employment/final-account-2025-c.pdf')
    fetch('https://mf.gov.cz/cs/rozpoctova-politika/statni-rozpocet/plneni-statniho-rozpoctu/2026/mesicni-pokladni-plneni-sr-62773',CACHE/'mf_monthly/2026.html')
    print('Official MF sources refreshed; run owned builders separately.')
if __name__=='__main__':main()
