#!/usr/bin/env python3
"""Lossless native table extraction of ČSSZ yearbook XLS sheets (requires xlrd).
Rows retain 1-based Excel addresses; blank cells stay null. Tables are separate
marginals and must never be joined into an invented age/amount distribution.
"""
import argparse,hashlib,json,zipfile
from pathlib import Path
import xlrd
ROOT=Path(__file__).resolve().parents[2]
URL='https://www.cssz.gov.cz/documents/20143/2946719/Rocenka_2025.zip/a927732b-31f5-7f4c-8487-5ca9223e4dda'
def main():
 p=argparse.ArgumentParser();p.add_argument('--input',type=Path,default=ROOT/'outputs/pensions-20260907/cssz-2025.zip');a=p.parse_args();out=ROOT/'website/data/cze-pension-tables-2025';out.mkdir(exist_ok=True)
 tables=[]
 with zipfile.ZipFile(a.input) as z:
  for name in sorted(z.namelist()):
   if not name.endswith('.xls'):continue
   b=xlrd.open_workbook(file_contents=z.read(name),formatting_info=True);sheets=[]
   for s in b.sheets():
    rows=[]
    for i in range(s.nrows):
     values=[None if c.ctype in (xlrd.XL_CELL_EMPTY,xlrd.XL_CELL_BLANK) else c.value for c in s.row(i)]
     if any(v is not None for v in values):rows.append({'row':i+1,'values':values})
    sheets.append({'name':s.name,'column_count':s.ncols,'merged_cells_zero_based_exclusive':s.merged_cells,'rows':rows})
   key=name.split(' ')[0];path=out/f'{key}.json';path.write_text(json.dumps({'workbook':name,'sha256':hashlib.sha256(z.read(name)).hexdigest(),'sheets':sheets},ensure_ascii=False,separators=(',',':'))+'\n')
   tables.append({'id':key,'workbook':name,'sheet_count':len(sheets),'row_count':sum(len(s['rows']) for s in sheets),'records':f'data/cze-pension-tables-2025/{key}.json'})
 assert len(tables)==14
 (ROOT/'website/data/cze-pension-tables-2025.v1.json').write_text(json.dumps({'schema_version':'1.0.0','year':2025,'source_url':URL,'archive_sha256':hashlib.sha256(a.input.read_bytes()).hexdigest(),'coverage':'All 14 native workbooks, including region, age, amount, new awards, terminations and disability. Headers, source notes and suppression markers retained. Numeric cells are native workbook units; interpret each table heading. No marginal distributions joined.','extraction':'native_sheet_rows_not_semantically_normalized','tables':tables},ensure_ascii=False,indent=2)+'\n');print(f'{len(tables)} workbooks, {sum(t["sheet_count"] for t in tables)} sheets, {sum(t["row_count"] for t in tables)} nonempty rows')
if __name__=='__main__':main()
