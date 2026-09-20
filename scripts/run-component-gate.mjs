import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { selectVerification, groups } from './verification-plan.mjs';

const planPath=process.argv[2];
const plan=planPath ? JSON.parse(readFileSync(planPath,'utf8')) : {groups:Object.keys(groups)};
const expected=plan.files ? selectVerification(plan.files) : plan;
const specs=[...new Set(expected.groups.flatMap(group=>groups[group]||[]))];
if(!specs.length) throw new Error('Empty component gate is forbidden');
const started=Date.now();
for(const [command,args] of [
  [process.execPath,['--test','tests/unit/chart-renderer.spec.mjs','tests/unit/verification-plan.spec.mjs']],
  ['npx',['playwright','test',...specs,'--config=playwright.ui.config.mjs','--workers=2','--max-failures=1','--retries=0','--reporter=line']],
]) {
  const result=spawnSync(command,args,{stdio:'inherit',env:process.env});
  if(result.status!==0) process.exit(result.status||1);
}
console.log(JSON.stringify({event:'component-gate-complete',seconds:(Date.now()-started)/1000,specs,target_seconds:180}));
