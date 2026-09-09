#!/usr/bin/env python3
"""Package a completed, verified CityVizor snapshot without recompressing exports."""
import argparse,hashlib,json,shutil,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def build(snapshot,out):
 manifest=json.loads((snapshot/'manifest.json').read_text())
 verification=json.loads((snapshot/'verification.json').read_text())
 if not manifest.get('complete') or verification.get('partial_run') or not verification.get('byte_and_row_integrity') or verification['profiles']!=manifest['profile_count']:
  raise ValueError('Refusing to package an incomplete or unverified snapshot')
 files=sorted(p for p in snapshot.rglob('*') if p.is_file() and p.suffix not in ('.part','.tmp'))
 needed=sum(p.stat().st_size for p in files)
 out.parent.mkdir(parents=True,exist_ok=True)
 if shutil.disk_usage(out.parent).free<needed+1024**3:raise RuntimeError('Insufficient disk space for bundle and 1 GiB reserve')
 tmp=out.with_suffix(out.suffix+'.part')
 with zipfile.ZipFile(tmp,'w',allowZip64=True) as z:
  for p in files:z.write(p,p.relative_to(snapshot),compress_type=zipfile.ZIP_STORED if p.suffix in ('.zip','.gz') else zipfile.ZIP_DEFLATED)
 with zipfile.ZipFile(tmp) as z:
  if z.testzip() is not None:raise ValueError('Bundle CRC verification failed')
 tmp.replace(out);h=hashlib.sha256()
 with out.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 out.with_suffix(out.suffix+'.sha256').write_text(h.hexdigest()+'  '+out.name+'\n')
 print(json.dumps({'path':str(out),'files':len(files),'bytes':out.stat().st_size,'sha256':h.hexdigest()}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--snapshot',type=Path,default=ROOT/'data/source_cache/cityvizor/2026-09-09');p.add_argument('--output',type=Path,default=ROOT/'outputs/czech-source-implementation-2026-09-09/cityvizor-public-2026-09-09.zip');a=p.parse_args();build(a.snapshot,a.output)
