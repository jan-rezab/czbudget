import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contractDigest, selectVerification } from '../../scripts/verification-plan.mjs';
test('shared chart changes select their consumers and the shell contract',()=>{
  const plan=selectVerification(['lib/chart-renderer.js']);
  assert.equal(plan.lane,'component'); assert.deepEqual(plan.groups,['charts','navigation']);
});
test('story changes include the navigation contract',()=>{
  assert.deepEqual(selectVerification(['content/stories/a.fragment']).groups,['navigation','stories']);
});
test('every registered adapter selects its declared consumer coverage',()=>{
  const plan=selectVerification(['municipalities-czechia.js']);
  assert.equal(plan.lane,'component');
  assert.ok(plan.specs.includes('tests/browser/shared-charts.spec.mjs'));
});
test('unknown, empty, global, data and CI changes fail closed to exhaustive verification',()=>{
  for(const file of ['global-nav.js','site-header.css','server/index.mjs','data/a.json','scripts/verification-plan.mjs','new-chart.js','nginx.conf.template']) assert.equal(selectVerification([file]).lane,'full',file);
  assert.equal(selectVerification([]).lane,'full');
});
test('a mixed change cannot hide broad impact behind a component edit',()=>{
  assert.equal(selectVerification(['shared-charts.css','global-nav.js']).lane,'full');
});
test('contract digest includes files omitted from a sparse checkout',()=>{
  const root=mkdtempSync(join(tmpdir(),'psd-sparse-contract-'));
  const previous=process.cwd();
  // The pre-push hook exports GIT_DIR for the real checkout. Isolate this fixture.
  const gitVariables=Object.entries(process.env).filter(([name])=>name.startsWith('GIT_'));
  for(const [name] of gitVariables) delete process.env[name];
  try {
    execFileSync('git',['init','-q',root]);
    mkdirSync(join(root,'tests'));
    const file=join(root,'tests','country.spec.mjs');
    writeFileSync(file,'export const chapterCount = 8;\n');
    execFileSync('git',['-C',root,'add','tests/country.spec.mjs']);
    execFileSync('git',['-C',root,'-c','user.name=Contract Test','-c','user.email=contract@example.com','commit','-qm','fixture']);
    process.chdir(root);
    const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    const present=contractDigest(commit);
    rmSync(file);
    assert.equal(contractDigest(commit),present);
  } finally {
    process.chdir(previous);
    for(const [name,value] of gitVariables) process.env[name]=value;
    rmSync(root,{recursive:true,force:true});
  }
});
