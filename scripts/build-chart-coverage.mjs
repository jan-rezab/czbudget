import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {registry} from './chart-registry.mjs';

const root=resolve(import.meta.dirname,'..');
const inventory=JSON.parse(await readFile(resolve(root,registry.legacy.inventory),'utf8'));
const classifications=Object.values(registry.legacy.classifications);
const report={
  schema_version:1,
  shared_adapters:registry.consumers.length,
  shared_family_usages:registry.consumers.reduce((sum,item)=>sum+item.families.length,0),
  shared_families:registry.renderer.families,
  legacy_files:Object.keys(inventory.files).length,
  legacy_drawing_patterns:Object.values(inventory.files).reduce((sum,count)=>sum+count,0),
  ordinary_migration_files:classifications.filter(value=>value.startsWith('ordinary-')).length,
  hybrid_migration_files:classifications.filter(value=>value.startsWith('hybrid-')).length,
  specialized_files:classifications.filter(value=>!value.startsWith('ordinary-')&&!value.startsWith('hybrid-')).length,
  ordinary_or_hybrid_migration_queue:Object.entries(registry.legacy.classifications).filter(([,value])=>/^(ordinary|hybrid)-/.test(value)).map(([file])=>file).sort()
};
const target=resolve(root,'chart-coverage.json'), serialized=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check')) {
  if(await readFile(target,'utf8')!==serialized) throw new Error('Chart coverage changed; run npm run build:chart-coverage');
  console.log(`Chart coverage verified: ${report.shared_adapters} shared adapters; ${report.ordinary_migration_files} ordinary and ${report.hybrid_migration_files} hybrid legacy files remain.`);
} else {
  await writeFile(target,serialized);
  console.log(`Chart coverage written: ${report.shared_adapters} shared adapters; ${report.ordinary_migration_files} ordinary and ${report.hybrid_migration_files} hybrid legacy files remain.`);
}
