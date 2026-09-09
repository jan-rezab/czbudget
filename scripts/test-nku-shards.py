#!/usr/bin/env python3
"""Focused OOXML preservation and byte-bound regression test; no network."""
import gzip,importlib.util,json,tempfile,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('build-czech-audit-transport.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp);m.OUT=root/'data';p=root/'fixture.xlsx'
 ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
 with zipfile.ZipFile(p,'w') as z:
  z.writestr('xl/workbook.xml',f'<workbook xmlns="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Native" r:id="r1"/><sheet name="Empty" r:id="r2"/></sheets></workbook>')
  z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="worksheets/sheet2.xml"/></Relationships>')
  z.writestr('xl/sharedStrings.xml',f'<sst xmlns="{ns}"><si><t>Český native text</t></si></sst>')
  rows=''.join(f'<row r="{i}"><c r="B{i}" t="s"><v>0</v></c><c r="D{i}"><f>B{i}+1</f><v>45123.5</v></c></row>' for i in range(2,52))
  z.writestr('xl/worksheets/sheet1.xml',f'<worksheet xmlns="{ns}"><sheetData>{rows}</sheetData></worksheet>')
  z.writestr('xl/worksheets/sheet2.xml',f'<worksheet xmlns="{ns}"><sheetData/></worksheet>')
 baseline=m.tables(p)
 archive=m.OUT/'czech-nku/test.native.json.gz';archive.parent.mkdir(parents=True);archive.write_bytes(b'legacy')
 try:m.publish_nku_workbook(p,{'url':'fixture'},'test',max_bytes=1800,expected_rows=51)
 except ValueError:pass
 else:raise AssertionError('Mismatch must fail')
 assert archive.exists(),'Failed verification must retain original archive'
 result=m.publish_nku_workbook(p,{'url':'fixture'},'test',max_bytes=1800,expected_rows=50)
 assert result['rows']==50 and result['tables']==[{'sheet':'Native','rows':50},{'sheet':'Empty','rows':0}]
 assert len(result['shards'])>1 and not archive.exists()
 actual=[]
 for shard in result['shards']:
  q=m.OUT/'czech-nku'/Path(shard['path']).name
  assert shard['uncompressed_bytes']<1800 and q.stat().st_size==shard['bytes']
  actual.extend(json.loads(gzip.decompress(q.read_bytes()))['rows'])
 assert actual==baseline[0]['rows'],'Native row numbers, null columns, values and formulas must survive exactly'
 print(json.dumps({'fixture_rows':50,'shards':len(result['shards']),'native_roundtrip':'exact','failed_verification_retains_archive':True}))
