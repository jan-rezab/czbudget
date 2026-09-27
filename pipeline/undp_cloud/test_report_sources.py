"""Tiny synthetic source-fidelity tests; no local bulk or cloud SDK needed."""
import ast,codecs,csv,io,json,tempfile,tarfile,zipfile,unittest,re
from pathlib import Path
from decimal import Decimal
import openpyxl
source=Path(__file__).with_name('report_sources.py').read_text()
tree=ast.parse(source)
selected=ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'members','records','archive_metadata_member','claim_source_text','decode','csv_encoding'}],type_ignores=[])
ns=dict(re=re,codecs=codecs,csv=csv,io=io,json=json,Path=Path,Decimal=Decimal,openpyxl=openpyxl,tarfile=tarfile,zipfile=zipfile)
exec(compile(selected,'source_adapters','exec'),ns)
records=ns['records']
class SourceFidelity(unittest.TestCase):
 def test_csv_exact_decimals_duplicate_headers_and_missing(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'x.csv';p.write_text('year,value,value\n2023,0.12345678901234567890,\n')
   rows=list(records(p,'csv',Path(d)))
   self.assertEqual(rows[1][2]['columns'],['year','value','value'])
   self.assertEqual(rows[1][2]['values'],['2023','0.12345678901234567890',''])
 def test_zip_never_extracts_provider_path(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'x.zip'
   with zipfile.ZipFile(p,'w') as z:z.writestr('../../outside.csv','a,b\n1,2\n')
   rows=list(records(p,'zip',Path(d)))
   self.assertEqual(len(rows),2);self.assertTrue(rows[1][0].startswith('../../outside.csv::'))
   self.assertFalse((Path(d).parent/'outside.csv').exists())
 def test_zip_preserves_but_does_not_parse_appledouble_metadata(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'who.zip'
   with zipfile.ZipFile(p,'w') as z:
    z.writestr('Estimates/estimates.csv','iso_alpha_3_code,year,value\nCZE,2023,1\n')
    z.writestr('__MACOSX/Estimates/._estimates.csv',b'\x00\x05\x16\x07\x81')
    z.writestr('__MACOSX/._inputs.xlsx',b'\x00\x05\x16\x07\x81')
   self.assertEqual(len(list(ns['members'](p,'zip'))),3)
   rows=list(records(p,'zip',Path(d)))
   self.assertEqual(len(rows),2)
   self.assertEqual(rows[0][2]['columns'],['iso_alpha_3_code','year','value'])
   self.assertFalse(any('__MACOSX' in r[0] for r in rows))
 def test_csv_cp1252_quote_after_clean_64k_prefix(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'late.csv';p.write_bytes(b'year,value\n'+b'2023,ascii\n'*7000+b'2024,source\x92s quote\n')
   rows=list(records(p,'csv',Path(d)))
   self.assertEqual(rows[0][2]['encoding'],'cp1252')
   self.assertEqual(rows[-1][2]['values'],['2024','source’s quote'])
 def test_csv_truncated_utf8_sequence_is_not_silently_dropped(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'bad.csv';p.write_bytes(b'year,value\n2023,\xe2\x81')
   with self.assertRaises(UnicodeDecodeError):list(records(p,'csv',Path(d)))
 def test_real_csv_invalid_encoding_still_fails(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'bad.csv';p.write_bytes(b'year,value\n2023,\x81\n')
   with self.assertRaises(UnicodeDecodeError):list(records(p,'csv',Path(d)))
 def test_xlsx_keeps_formula_and_cached_representations_separate(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'x.xlsx';w=openpyxl.Workbook();w.active.append(['year','share']);w.active.append([2023,'=1/3']);w.save(p)
   rows=list(records(p,'xlsx',Path(d)))
   formula=[r for r in rows if r[0].endswith('::formula')]
   self.assertEqual(formula[1][2]['values'][1],'=1/3')
   self.assertEqual(len(set((m,n) for m,n,_ in rows)),len(rows))
 def test_worldbank_rejects_unreceived_pages(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'x.json';p.write_text('[{"pages":2},[{"value":1.2}]]')
   with self.assertRaises(ValueError):list(records(p,'worldbank_json',Path(d)))
 def test_wid_exact_headers_filter_and_exclusion_counts(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'x.csv';p.write_text('country;variable;percentile;year;value;age;pop;data_quality\nCZ;sptincj992;p99p100;2024;0.12;992;j;estimated\nCZ;other;p99p100;2024;999;992;j;estimated\n')
   rows=list(records(p,'wid_csv',Path(d)))
   self.assertEqual(rows[0][2]['columns'],['country','variable','percentile','year','value','age','pop','data_quality'])
   self.assertEqual(rows[1][2]['value'],'0.12')
   self.assertEqual(rows[-1][2]['filtered_out_rows'],1)
   self.assertEqual(rows[-1][2]['accepted_top1_income_rows'],1)
 def test_claim_pdf_requires_magic_and_extractable_text(self):
  from pypdf import PdfWriter
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'claim.pdf';p.write_text('<p>16 percent</p>')
   with self.assertRaisesRegex(ValueError,'magic'):ns['claim_source_text'](p,'verified_claim_pdf')
   w=PdfWriter();w.add_blank_page(width=100,height=100)
   with open(p,'wb') as f:w.write(f)
   with self.assertRaisesRegex(ValueError,'extractable'):ns['claim_source_text'](p,'verified_claim_pdf')
 def test_claim_html_keeps_numeric_anchor_text(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'claim.html';p.write_text('<p>16 percent</p>')
   self.assertEqual(ns['claim_source_text'](p,'verified_claim_html').strip(),'16 percent')
 def test_childlight_is_data_not_executable_code(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'x.js';p.write_text('var mapData = {"features":[{"properties":{"py_dpos":".."}}]};')
   self.assertEqual(list(records(p,'js',Path(d)))[0][2]['properties']['py_dpos'],'..')
if __name__=='__main__':unittest.main()
