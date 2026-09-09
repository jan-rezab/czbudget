#!/usr/bin/env python3
"""Convert already-verified NKÚ JSON shards to deterministic gzip, one at a time."""
import gzip,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];manifest_path=ROOT/'data/czech-nku/edfea5b56257.json'
def sha(data):return hashlib.sha256(data).hexdigest()
manifest=json.loads(manifest_path.read_text());updated=[]
for shard in manifest['shards']:
 source=ROOT/shard['path'].lstrip('/')
 if source.suffix=='.gz':updated.append(shard);continue
 data=source.read_bytes()
 if sha(data)!=shard['sha256'] or len(data)!=shard['bytes']:raise ValueError('Existing NKÚ shard integrity failure: '+str(source))
 compressed=gzip.compress(data,compresslevel=9,mtime=0);target=source.with_suffix(source.suffix+'.gz');tmp=target.with_suffix('.part');tmp.write_bytes(compressed)
 if gzip.decompress(tmp.read_bytes())!=data:raise ValueError('NKÚ compression roundtrip failure')
 tmp.replace(target);source.unlink()
 updated.append({**shard,'path':shard['path']+'.gz','bytes':len(compressed),'sha256':sha(compressed),'uncompressed_bytes':len(data),'uncompressed_sha256':sha(data),'content_encoding':'gzip'})
manifest['shards']=updated;manifest['format']='gzip-compressed sharded native JSON';manifest['max_uncompressed_shard_bytes_exclusive']=manifest.pop('max_shard_bytes_exclusive',16*1024*1024)
tmp=manifest_path.with_suffix('.part');tmp.write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n');tmp.replace(manifest_path)
print(json.dumps({'shards':len(updated),'compressed_bytes':sum(s['bytes'] for s in updated),'native_rows_sha256':manifest['verification']['canonical_native_rows_sha256']}))
