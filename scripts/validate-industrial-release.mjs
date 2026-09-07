import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root=path.resolve('data/industrial-intelligence');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'index.json')));
const scope=JSON.parse(fs.readFileSync('pipeline/config/industrial-intelligence.json'));
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
assert(manifest.complete===scope.datasets.length&&manifest.errors===0&&manifest.pending===0,'Incomplete industrial archive');
assert(JSON.stringify(manifest.datasets.map(d=>d.code).sort())===JSON.stringify(scope.datasets.map(d=>d.code).sort()),'Archive scope mismatch');
let count=0,rows=0;
for(const d of manifest.datasets){
  const folder=path.join(root,d.code),meta=JSON.parse(fs.readFileSync(path.join(folder,'index.json')));
  assert(meta.filtered_sha256===d.filtered_sha256,'Source fingerprint mismatch: '+d.code);
  assert(meta.periods.every(p=>/^20\d\d/.test(p)&&Number(p.slice(0,4))>=2010),'History outside scope: '+d.code);
  let total=0;
  const filenames=new Set();
  for(const group of meta.groups){let groupRows=0;
    for(const shard of group.shards){
      assert(/^[\w.-]+\.json\.gz$/.test(shard.file)&&!filenames.has(shard.file),'Invalid or duplicate shard');filenames.add(shard.file);
      const bytes=fs.readFileSync(path.join(folder,shard.file)),raw=gunzipSync(bytes);
      assert(bytes.length===shard.bytes&&crypto.createHash('sha256').update(raw).digest('hex')===shard.sha256,'Corrupt shard: '+d.code+'/'+shard.file);
      const data=JSON.parse(raw);assert(data.length===shard.rows,'Row count mismatch');
      assert(data.every(r=>Array.isArray(r)&&r[0].length===meta.dimension_order.length&&r[1].length===meta.periods.length),'Invalid data shape');
      total+=data.length;groupRows+=data.length;count++;
    }
    assert(groupRows===group.rows,'Partition row mismatch');
  }
  assert(total===meta.series&&total===d.series,'Dataset row mismatch: '+d.code);rows+=total;
}
console.log(JSON.stringify({datasets:manifest.complete,shards:count,rows,numericCells:manifest.observations,status:'passed'}));
