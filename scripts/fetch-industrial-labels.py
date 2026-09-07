#!/usr/bin/env python3
"""Fetch publisher codelists for only the dimension codes present in the archive."""
import argparse,gzip,json,xml.etree.ElementTree as E
from pathlib import Path
import importlib.util
sp=importlib.util.spec_from_file_location('fetcher',Path(__file__).with_name('fetch-industrial-intelligence.py'));f=importlib.util.module_from_spec(sp);sp.loader.exec_module(f)
NS={'s':'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure','c':'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common'}

def main():
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('data/industrial-intelligence/labels.json'));a=p.parse_args();needed={}
 for file in (a.source/'metadata').glob('*.json'):
  for dim,values in json.loads(file.read_text()).get('dimensions',{}).items():needed.setdefault(dim,set()).update(values)
 labels={};errors={};cache=a.source/'codelists';cache.mkdir(exist_ok=True)
 for dim,values in needed.items():
  path=cache/f'{dim}.xml.gz'
  try:
   if not path.exists():
    base=f.BASE.replace('/api/','/api/comext/') if dim in ['product','reporter','indicators'] else f.BASE
    code={'reporter':'CXT_FREE_ISO','product':'CXT_PRODCOM2_SOLD','indicators':'CXT_INDICATORS'}.get(dim,dim.upper())
    f.download(f'{base}/sdmx/2.1/codelist/ESTAT/{code}?compressed=true',path)
   with gzip.open(path,'rb') as z:root=E.parse(z).getroot()
   found={}
   for code in root.findall('.//s:Code',NS):
    key=code.get('id')
    if key not in values:continue
    names=code.findall('c:Name',NS);name=next((n.text for n in names if n.get('{http://www.w3.org/XML/1998/namespace}lang')=='en'),None)
    if name:found[key]=name
   labels[dim]=found
   print(dim,len(found),flush=True)
  except Exception as e:errors[dim]=str(e);print('LABEL ERROR',dim,str(e),flush=True)
 a.output.parent.mkdir(exist_ok=True,parents=True);f.save(a.output,dict(labels=labels,errors=errors,retrieved_at=f.stamp()))
if __name__=='__main__':main()
