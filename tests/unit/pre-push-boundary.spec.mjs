import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const hookPath=new URL('../../.githooks/pre-push',import.meta.url);
const hook=readFileSync(hookPath,'utf8');
const cloud=readFileSync(new URL('../../cloudbuild.verify.yaml',import.meta.url),'utf8');
const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));

test('push source contracts never require local dataset/API integrity fixtures',()=>{
  const executable=hook.split('\n').filter(line=>!line.trim().startsWith('#')).join('\n');
  for(const forbidden of [/validate:european-politics/,/validate:accountability/,/validate:invariants/,/validate:glossary/,/validate-site\.mjs/,/validate-integrity\.mjs/,/tests\/api\/\*/,/npm run[^\n]*\svalidate(?:\s|$)/]) assert.doesNotMatch(executable,forbidden);
  for(const required of ['build-chart-assets.mjs','validate-chart-ownership.mjs','build-chart-coverage.mjs','validate-ui-environment.mjs','validate-release-contract.mjs','prepare-ui-build-context.mjs','publish-stories.mjs','tests.test_cloud_verification','validate-build-planes.mjs','create-source-manifest.mjs --self-check','validate:reports-index']) assert.ok(executable.includes(required),required);
});

test('all deferred data and API checks remain mandatory in existing cloud gate',()=>{
  const gate=cloud.split('  - id: browser-contrast-a\n')[1].split('\n  - id: ')[0];
  assert.match(gate,/waitFor: \[preflight-components, python-contracts, verify-published-snapshots, verify-published-assets, validate-source-contract\]/);
  assert.match(gate,/npm run test:api/);assert.match(gate,/PSD_BUILD_MODE=local npm run validate/);
  for(const check of ['validate:european-politics','validate:accountability','validate:invariants','validate:glossary','validate:reports-index','validate-site.mjs','validate-integrity.mjs']) assert.ok(pkg.scripts.validate.includes(check),check);
  assert.equal(pkg.scripts['test:api'],'node --test tests/api/*.spec.mjs');
});

function simulate(remoteRef, lane, receiptExit){
  const dir=mkdtempSync(join(tmpdir(),'psd-hook-contract-'));
  const log=join(dir,'calls');
  const executable=(name,body)=>writeFileSync(join(dir,name),'#!/bin/sh\n'+body,{mode:0o755});
  executable('git',`case "$1" in\n rev-parse) echo '${dir}' ;;\n rev-list|status) exit 0 ;;\n *) exit 90 ;;\nesac\n`);
  executable('node',`printf 'node %s\\n' "$*" >> '${log}'\ncase "$1" in\n scripts/release-verification.mjs) echo '${lane}' ;;\n scripts/verification-plan.mjs) echo '{"lane":"${lane}"}' ;;\nesac\n`);
  executable('python3',`printf 'python3 %s\\n' "$*" >> '${log}'\ncase "$1" in\n scripts/check-cloud-verification.py) exit ${receiptExit} ;;\nesac\n`);
  executable('npm',`printf 'npm %s\\n' "$*" >> '${log}'\n`);
  try{
    const result=spawnSync('/bin/sh',[hookPath.pathname],{input:`refs/heads/candidate ${'a'.repeat(40)} ${remoteRef} ${'b'.repeat(40)}\n`,encoding:'utf8',env:{...process.env,PATH:dir+':/usr/bin:/bin'}});
    return {status:result.status,log:readFileSync(log,'utf8')};
  }finally{rmSync(dir,{recursive:true,force:true});}
}

test('a legitimate branch uses source-only checks and does not query cloud receipts',()=>{
  const result=simulate('refs/heads/candidate','full',1);
  assert.equal(result.status,0);assert.doesNotMatch(result.log,/check-cloud-verification\.py/);
});
test('full-lane main is blocked without exact successful cloud verification',()=>{
  const result=simulate('refs/heads/main','full',1);
  assert.notEqual(result.status,0);assert.match(result.log,/python3 scripts\/check-cloud-verification\.py --plan/);
});
test('full-lane main proceeds only after the existing receipt checker succeeds',()=>{
  const result=simulate('refs/heads/main','full',0);
  assert.equal(result.status,0);assert.match(result.log,/python3 scripts\/check-cloud-verification\.py --plan/);
});
test('classified component lane retains production focused verification policy',()=>{
  const result=simulate('refs/heads/main','component',1);
  assert.equal(result.status,0);assert.doesNotMatch(result.log,/check-cloud-verification\.py/);
});
