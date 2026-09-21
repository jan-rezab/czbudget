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
if(lock.packages['']?.engines?.node!==pkg.engines.node) throw new Error('package-lock Node engine differs from package.json');
if(contract.package_node_major!==contract.verifier_node_major) throw new Error('Website package and browser verifier must use the same Node major');
for(const file of ['cloudbuild.verify.yaml','cloudbuild.yaml']) {
  const source=readFileSync(resolve(root,file),'utf8');
  const images=[...source.matchAll(/name: (node:\d+-alpine@sha256:[a-f0-9]{64})/g)].map(match=>match[1]);
  if(!images.length || images.some(image=>image!==contract.node_image)) throw new Error(`${file} has an unpinned or mismatched Node image`);
}
for(const file of ['Dockerfile','Dockerfile.slim']) {
  const source=readFileSync(resolve(root,file),'utf8');
  if(!source.includes(`FROM ${contract.node_image} AS node-runtime`)) throw new Error(`${file} has a mismatched runtime Node image`);
}
if(process.argv.includes('--runtime') && Number(process.versions.node.split('.')[0])!==contract.verifier_node_major) throw new Error(`Verifier runtime needs Node ${contract.verifier_node_major}, found ${process.versions.node}`);
console.log(`UI environment contract passed: website Node ${contract.package_node_major}, Playwright ${contract.playwright}, pinned image digests.`);
