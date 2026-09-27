import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const path=new URL('../../.githooks/pre-push',import.meta.url);
const hook=readFileSync(path,'utf8');
const cloud=readFileSync(new URL('../../cloudbuild.yaml',import.meta.url),'utf8');
const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));

test('local push contracts remain source-only while preserving current lane/browser selection',()=>{
  const executable=hook.split('\n').filter(line=>!line.trim().startsWith('#')).join('\n');
  for(const forbidden of [/validate:european-politics/,/validate:accountability/,/validate:invariants/,/validate:glossary/,/validate-site\.mjs/,/validate-integrity\.mjs/,/tests\/api\/\*/,/check-cloud-verification\.py/])assert.doesNotMatch(executable,forbidden);
  for(const required of ['build-chart-assets.mjs','validate-chart-ownership.mjs','build-chart-coverage.mjs','validate-ui-environment.mjs','validate-release-contract.mjs','prepare-ui-build-context.mjs','publish-stories.mjs','tests.test_cloud_verification','validate-build-planes.mjs','create-source-manifest.mjs --self-check','validate:reports-index','verification-plan.mjs','release-verification.mjs','local-browser-gate.mjs "$plan"'])assert.ok(executable.includes(required),required);
});
test('all deferred checks remain mandatory after hydration and block production deployment',()=>{
  const gate=cloud.split('  - id: full-verification\n')[1].split('\n  - id: ')[0];
  assert.match(gate,/waitFor: \[verify-published-releases, image-browser-contract, full-python-contracts, warm-browser-worker\]/);
  assert.match(gate,/npm run test:api/);assert.match(gate,/PSD_BUILD_MODE=local npm run validate/);
  for(const check of ['validate:european-politics','validate:accountability','validate:invariants','validate:glossary','validate:reports-index','validate-site.mjs','validate-integrity.mjs'])assert.ok(pkg.scripts.validate.includes(check),check);
  assert.match(cloud,/id: assert-current-main\n\s+waitFor: \[[^\]]*full-verification[^\]]*\]/);
  assert.match(cloud,/id: read-active-data-release\n\s+waitFor: \[assert-current-main\]/);
  assert.match(cloud,/id: deploy\n\s+waitFor: \[read-active-data-release\]/);
});
function simulate(remoteRef,lane){
  const dir=mkdtempSync(join(tmpdir(),'psd-source-hook-')),log=join(dir,'calls');
  const executable=(name,body)=>writeFileSync(join(dir,name),'#!/bin/sh\n'+body,{mode:0o755});
  executable('git',`case "$1" in\n rev-parse) echo '${dir}' ;;\n rev-list|status) exit 0 ;;\n *) exit 90 ;;\nesac\n`);
  executable('node',`printf 'node %s\\n' "$*" >> '${log}'\ncase "$1" in\n scripts/release-verification.mjs) echo '${lane}' ;;\n scripts/verification-plan.mjs) echo '{"lane":"${lane}"}' ;;\nesac\n`);
  executable('python3',`printf 'python3 %s\\n' "$*" >> '${log}'\n`);
  executable('npm',`printf 'npm %s\\n' "$*" >> '${log}'\n`);
  try{
    const result=spawnSync('/bin/sh',[path.pathname],{input:`refs/heads/candidate ${'a'.repeat(40)} ${remoteRef} ${'b'.repeat(40)}\n`,encoding:'utf8',env:{...process.env,PSD_SKIP_LOCAL_BROWSER:'1',PATH:dir+':/usr/bin:/bin'}});
    return {status:result.status,log:readFileSync(log,'utf8'),stdout:result.stdout};
  }finally{rmSync(dir,{recursive:true,force:true});}
}
test('legitimate branch retains optional browser hook without data restoration or receipt handoff',()=>{
  const result=simulate('refs/heads/candidate','full');assert.equal(result.status,0);
  assert.match(result.log,/node scripts\/local-browser-gate.mjs/);
  assert.doesNotMatch(result.log,/check-cloud-verification|validate:glossary|tests\/api/);
});
test('full main retains mandatory production full gate and no obsolete separate receipt',()=>{
  const result=simulate('refs/heads/main','full');assert.equal(result.status,0);
  assert.match(result.log,/local-browser-gate.mjs .*psd-verification-plan/);
  assert.match(result.stdout,/production build runs the exhaustive suite/);
  assert.doesNotMatch(result.log,/check-cloud-verification/);
});
test('component main retains existing focused production verification',()=>{
  const result=simulate('refs/heads/main','component');assert.equal(result.status,0);
  assert.match(result.stdout,/focused tests run inside the production build/);
});
