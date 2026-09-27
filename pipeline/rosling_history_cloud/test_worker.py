import importlib.util, json, tempfile, unittest, zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('worker',Path(__file__).with_name('worker.py'));w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
class Contracts(unittest.TestCase):
 def test_wb_precision_missing_and_duplicate(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)/'fixture.json';records=[{'countryiso3code':c,'date':'1960','indicator':{'id':'test'},'value':None} for c in w.COUNTRIES]
   records[0]['value']=1.123456789012345; p.write_text(json.dumps([{'pages':1,'total':len(records)},records]));groups,meta,count=w.parse_wb(p,'test');self.assertEqual(groups['CZE'][0]['source_value'],'1.123456789012345');self.assertEqual(count['missing'],16)
   records.append(records[0]);p.write_text(json.dumps([{'pages':1,'total':len(records)},records]));self.assertRaises(ValueError,w.parse_wb,p,'test')
 def test_truncated_page_rejected(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)/'fixture.json';p.write_text('[{"pages":2,"total":30},[]]');self.assertRaises(ValueError,w.parse_wb,p,'test')
 def test_xlsx_country_year_status_and_baseline(self):
  def column(i):
   x=''
   while i:i,r=divmod(i-1,26);x=chr(65+r)+x
   return x
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)/'fixture.xlsx';headers=['COUNTRY.ID','INDICATOR.ID','LATEST_ACTUAL_ANNUAL_DATA']+list(range(1980,2026));xml=[]
   for j,values in enumerate([headers]+[[c,'PPPPC',2024]+[12345.123]*46 for c in w.COUNTRIES],1):
    cells=[]
    for i,v in enumerate(values,1):
     tag=f'<is><t>{v}</t></is>' if isinstance(v,str) else f'<v>{v}</v>';typ=' t="inlineStr"' if isinstance(v,str) else '';cells.append(f'<c r="{column(i)}{j}"{typ}>{tag}</c>')
    xml.append(f'<row r="{j}">'+''.join(cells)+'</row>')
   with zipfile.ZipFile(p,'w') as z:
    z.writestr('xl/workbook.xml','<workbook xmlns="'+w.N['m']+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Countries" r:id="rId1"/></sheets></workbook>')
    z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');z.writestr('xl/worksheets/sheet1.xml','<worksheet xmlns="'+w.N['m']+'"><sheetData>'+''.join(xml)+'</sheetData></worksheet>')
   base={'source':{},'countries':[{'country_code':c} for c in w.COUNTRIES],'series':[]};gdp,n=w.gdp_from_xlsx(p,base);rows=gdp['series'][0]['metrics']['gdp_per_capita_ppp']['values'];self.assertEqual(rows[0]['year'],1980);self.assertEqual(rows[0]['value'],12345.123);self.assertEqual(rows[-1]['status'],'estimate');self.assertEqual(rows[-2]['status'],'actual')
   base['series']=[{'country_code':'CZE','metrics':{'gdp_per_capita_ppp':{'values':[{'year':2024,'value':1,'status':'actual'}]}}}];self.assertRaises(ValueError,w.gdp_from_xlsx,p,base)
if __name__=='__main__':unittest.main()
