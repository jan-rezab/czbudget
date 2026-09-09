#!/usr/bin/env python3
"""Read cumulative actual cash execution, retaining unpublished months as null."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
import json,hashlib
ROOT=Path(__file__).resolve().parents[2];URL='https://mf.gov.cz/cs/rozpoctova-politika/statni-rozpocet/plneni-statniho-rozpoctu/2026/mesicni-pokladni-plneni-sr-62773'
class Table(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None;self.links=[]
 def handle_starttag(self,tag,attrs):
  if tag=='tr':self.row=[];self.links=[]
  if tag in ['td','th'] and self.row is not None:self.cell=''
  if tag=='a' and self.row is not None:
   self.links.extend(v for k,v in attrs if k=='href')
 def handle_data(self,data):
  if self.cell is not None:self.cell+=data
 def handle_endtag(self,tag):
  if tag in ['td','th'] and self.cell is not None:self.row.append(' '.join(self.cell.split()));self.cell=None
  if tag=='tr' and self.row is not None:self.rows.append((self.row,self.links));self.row=None

def main():
 p=ROOT/'data/source_cache/mf_monthly/2026.html';t=Table();t.feed(p.read_text());months=['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];rows=[]
 for cells,links in t.rows:
  if not cells or cells[0] not in months:continue
  vals=[float(x.replace(' ','').replace(',','.')) if x else None for x in cells[1:4]]
  if len(vals)!=3 or any(v is None for v in vals) and not all(v is None for v in vals):raise ValueError('Incomplete published row')
  available=vals[0] is not None
  if available and abs(vals[0]-vals[1]-vals[2])>.11:raise ValueError('Revenue/expenditure/saldo mismatch')
  rows.append({'month':months.index(cells[0])+1,'revenue_ytd_bn_czk':vals[0],'expenditure_ytd_bn_czk':vals[1],'balance_ytd_bn_czk':vals[2],'stage':'actual_ytd' if available else 'not_yet_published','release_url':urljoin(URL,links[0]) if links else None})
 assert len(rows)==12
 result={'schema_version':1,'year':2026,'source_url':URL,'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'latest_actual_month':max(r['month'] for r in rows if r['stage']=='actual_ytd'),'unit':'CZK_bn','basis':'cash_state_budget','rows':rows,'scope_notes':['Cumulative January-to-month execution; do not sum months.','Includes EU/FM flows; distinct from adjusted balance excluding those flows.','Partial year actuals are not the approved annual2026 budget or2027 proposal.','Unpublished months remain null. Source display precision0.1bn CZK.']}
 (ROOT/'website/data/czech-mf-monthly-2026.v1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(result['latest_actual_month'])
if __name__=='__main__':main()
