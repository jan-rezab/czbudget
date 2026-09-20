import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const ledgerPath=resolve(root,'chart-legacy-inventory.json');
const files=[];
for(const directory of ['','lib','stories']) {
  for(const item of await readdir(resolve(root,directory),{withFileTypes:true})) {
    if(item.isFile() && /\.(?:js|mjs)$/.test(item.name)) files.push([directory,item.name].filter(Boolean).join('/'));
  }
}
const findings={};
for(const file of files.sort()) {
  if(file==='lib/chart-renderer.js') continue;
  const source=await readFile(resolve(root,file),'utf8');
  const count=[...source.matchAll(/<svg\b|\.append\(['"](?:svg|path)['"]\)/g)].length;
  if(count)findings[file]=count;
}
if(process.argv.includes('--record-reviewed-baseline')) {
  await writeFile(ledgerPath,JSON.stringify({purpose:'Existing legacy SVG/icon sites; ceilings, not permission to add charts. Reduce on migration. Never raise to silence validation.',files:findings},null,2)+'\n');
} else {
  const ledger=JSON.parse(await readFile(ledgerPath,'utf8'));
  for(const [file,count] of Object.entries(findings)) if(count>(ledger.files[file]||0)) throw new Error(`${file} adds page-owned drawing (${count} > ${ledger.files[file]||0}). Use the shared chart renderer; do not raise the legacy ceiling.`);
  for(const file of ['cz-history.js','stories/tariff-charts.js']) {
    const source=await readFile(resolve(root,file),'utf8');
    if(findings[file] || !source.includes('PSDPlot')) throw new Error(`${file} must remain a shared-chart adapter`);
  }
  console.log('Shared chart ownership passed; no new page-owned SVG renderers.');
}
