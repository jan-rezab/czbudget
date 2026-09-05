#!/usr/bin/env python3
"""Verify reviewed quotations against private crawl snapshots (no network)."""
import argparse,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def normalize(value):return re.sub(r'\s+',' ',value.replace('\u00ad','')).strip()
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--cache',type=Path,default=ROOT.parent/'outputs/politics-source-crawl');args=parser.parse_args()
 review=json.loads((ROOT/'pipeline/config/politics_promises.v1.json').read_text());crawl=json.loads((ROOT/'data/politics-source-crawl.v1.json').read_text())['sources'];checked=0
 for promise in review['promises']:
  references=[dict(source_id=promise['source_id'],source_sha256=promise['source_sha256'],page=promise['page'],locator=promise['quote'])]+promise['evidence']
  for ref in references:
   source=crawl[ref['source_id']];folder=args.cache/ref['source_id'];raw=folder/('source.pdf' if source['format']=='pdf' else 'source.html')
   assert hashlib.sha256(raw.read_bytes()).hexdigest()==ref['source_sha256']==source['sha256'],f'Changed source: {promise["id"]}'
   pages=json.loads((folder/'pages.json').read_text());text=pages[ref['page']-1] if ref['page'] else '\n'.join(pages)
   assert normalize(ref['locator']) in normalize(text),f'Quotation not found: {promise["id"]} / {ref["source_id"]}'
   checked+=1
 print(f'Verified {checked} page/text references and content hashes across {len(review["promises"])} reviewed promises.')
if __name__=='__main__':main()
