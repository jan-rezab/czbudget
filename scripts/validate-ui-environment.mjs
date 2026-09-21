import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const contract=JSON.parse(readFileSync(resolve(root,'ui-environment.json'),'utf8'));
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const lock=JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'));
for(const file of ['cloudbuild.ui.yaml','cloudbuild.verify.yaml','cloudbuild.yaml']) {
  const source=readFileSync(resolve(root,file),'utf8');
  if(!source.includes(contract.image)) throw new Error(`${file} does not use the pinned UI image`);
}
if(pkg.devDependencies['@playwright/test']!==contract.playwright) throw new Error('package.json Playwright differs from UI environment contract');
if(lock.packages['node_modules/@playwright/test']?.version!==contract.playwright) throw new Error('package-lock Playwright differs from UI environment contract');
if(Number(pkg.engines.node.replace(/\D/g,''))!==contract.package_node_major) throw new Error('Package Node engine differs from UI environment contract');
if(process.argv.includes('--runtime') && Number(process.versions.node.split('.')[0])!==contract.verifier_node_major) throw new Error(`Verifier runtime needs Node ${contract.verifier_node_major}, found ${process.versions.node}`);
console.log(`UI environment contract passed: package Node ${contract.package_node_major}, verifier Node ${contract.verifier_node_major}, Playwright ${contract.playwright}, pinned image digest.`);
