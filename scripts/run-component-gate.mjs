import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { selectVerification, groups } from './verification-plan.mjs';

const planPath=process.argv[2];
const plan=planPath ? JSON.parse(readFileSync(planPath,'utf8')) : {groups:Object.keys(groups)};
const expected=plan.files ? selectVerification(plan.files) : plan;
// A diff can delete a test; run what the candidate still contains.
const specs=[...new Set(expected.specs || expected.groups.flatMap(group=>groups[group]||[]))].filter(existsSync);
const unit=(expected.unit || []).filter(existsSync);
if(!specs.length) throw new Error('Empty component gate is forbidden');
const started=Date.now();
for(const [command,args] of [
  [process.execPath,['--test',...new Set([...registryContracts(),...unit])]],
  ['npx',['playwright','test',...specs,'--config=playwright.ui.config.mjs','--workers=2','--max-failures=1','--retries=0','--reporter=line']],
]) {
  const result=spawnSync(command,args,{stdio:'inherit',env:process.env});
  if(result.status!==0) process.exit(result.status||1);
}
console.log(JSON.stringify({event:'component-gate-complete',seconds:(Date.now()-started)/1000,specs,unit,target_seconds:180}));

function registryContracts() {
  return ['tests/unit/chart-renderer.spec.mjs','tests/unit/chart-registry.spec.mjs','tests/unit/release-contract.spec.mjs','tests/unit/verification-plan.spec.mjs','tests/unit/verification-plan-sparse.spec.mjs'];
}
