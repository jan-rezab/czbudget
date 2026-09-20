import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..'), directory=resolve(root,'assets/chart-releases');
const check=process.argv.includes('--check');
if(!check) await mkdir(directory,{recursive:true});
const release={schema_version:1};
for(const [key,file,extension] of [['script','lib/chart-renderer.js','js'],['style','shared-charts.css','css']]) {
  const bytes=await readFile(resolve(root,file));
  const digest=createHash('sha256').update(bytes).digest();
  const name=`${digest.toString('hex')}.${extension}`;
  const target=resolve(directory,name);
  if(check) { if(!(await readFile(target)).equals(bytes)) throw new Error(`Chart asset differs: ${name}`); }
  else { try { await writeFile(target,bytes,{flag:'wx'}); } catch(error) { if(error.code!=='EEXIST') throw error; if(!(await readFile(target)).equals(bytes)) throw new Error('Immutable chart asset collision'); } }
  release[key]={url:`/assets/chart-releases/${name}`,integrity:`sha256-${digest.toString('base64')}`};
}
const manifest=JSON.stringify(release,null,2)+'\n';
if(check) {
  if(await readFile(resolve(directory,'current.json'),'utf8')!==manifest) throw new Error('Run npm run build:chart-assets');
  for(const name of await readdir(directory)) {
    if(name==='current.json') continue;
    if(!/^[a-f0-9]{64}\.(js|css)$/.test(name)) throw new Error(`Unexpected asset ${name}`);
    const actual=createHash('sha256').update(await readFile(resolve(directory,name))).digest('hex');
    if(actual!==name.split('.')[0]) throw new Error(`Modified immutable chart asset ${name}`);
  }
} else await writeFile(resolve(directory,'current.json'),manifest);
console.log(`Chart assets ${check?'verified':'built'}; retained earlier versions unchanged.`);
