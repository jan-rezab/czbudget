import test from 'node:test';
import assert from 'node:assert/strict';
import {requiredReleasePaths} from '../../scripts/validate-release-contract.mjs';
import {registry} from '../../scripts/chart-registry.mjs';
import {productionPlan, releaseMode} from '../../scripts/release-verification.mjs';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('release contract covers every adapter and its architecture sources',()=>{
  const required=requiredReleasePaths();
  for(const adapter of registry.release.content_versioned_adapters) assert.ok(required.includes(adapter),adapter);
  for(const file of ['chart-components.json','chart-coverage.json','ui-environment.json','scripts/chart-registry.mjs','scripts/build-chart-coverage.mjs']) assert.ok(required.includes(file),file);
});

const base='a'.repeat(40), commit='b'.repeat(40);
test('component verification runs in production only for a classified diff from the deployed commit',()=>{
  const plan=productionPlan(['stories/index.html'],base,commit,base);
  assert.equal(releaseMode(plan),'component');
  assert.ok(plan.specs.includes('tests/browser/stories.spec.mjs'));
  assert.ok(plan.specs.includes('tests/browser/shared-navigation.spec.mjs'));
});
test('unknown deployment provenance and accumulated structural changes require full verification',()=>{
  assert.equal(releaseMode(productionPlan(['stories/index.html'],base,commit,'')),'full');
  assert.equal(releaseMode(productionPlan(['stories/index.html','server/index.mjs'],base,commit,base)),'full');
  assert.throws(()=>productionPlan(['stories/index.html'],base,commit,'c'.repeat(40)),/deployed commit/);
});
test('a forged component lane cannot hide unknown files, missing provenance or invalid commit identity',()=>{
  for (const change of [{files:['server/index.mjs']},{baseUnverified:true},{commit:'HEAD'},{files:[]}]) {
    assert.throws(()=>releaseMode({...productionPlan(['stories/index.html'],base,commit,base),...change}));
  }
});
test('production cannot promote before focused or exhaustive verification and candidate-image browser checks',()=>{
  const yaml=readFileSync(new URL('../../cloudbuild.yaml',import.meta.url),'utf8');
  const block=id=>yaml.split(`  - id: ${id}\n`)[1]?.split('\n  - id: ')[0];
  assert.match(block('build-admission'),/scripts\/build-admission\.py, admit/);
  assert.match(block('component-verification'),/scripts\/run-component-gate\.mjs \.verification-plan\.json/);
  assert.match(block('component-verification'),/waitFor: \[source-contracts, warm-browser-worker\]/);
  assert.match(block('warm-browser-worker'),/waitFor: \[build-admission\]/);
  assert.match(block('image-browser-contract'),/waitFor: \[start-image-browser-candidate, component-verification\]/);
  // The exhaustive suite uses the pinned published releases and never shares the worker
  // with the candidate-image browser pool.
  assert.match(block('full-verification'),/waitFor: \[verify-published-releases, image-browser-contract, full-python-contracts, warm-browser-worker\]/);
  assert.match(block('full-python-contracts'),/pipeline\/tests/);
  assert.match(block('full-verification'),/npx playwright test --workers=16 --max-failures=1 --retries=0/);
  assert.match(block('hydrate-published-releases'),/gcloud storage cp -I/);
  assert.match(yaml,/machineType: E2_HIGHCPU_32/);
  assert.match(block('verify-published-releases'),/validate-cityvizor-cloud-release\.mjs/);
  assert.match(block('hydrate-published-releases'),/verify-runtime-assets-cloud\.py/);
  assert.match(block('assert-current-main'),/waitFor: \[assert-single-production, component-verification, full-verification, image-contract, image-browser-contract, push\]/);
  assert.match(block('verification-input'),/git diff --no-renames --name-only "\$\$base" "\$COMMIT_SHA"/);
  assert.match(yaml,/\ntimeout: 1800s\n/);
});


test('the production trigger cannot omit localization helpers or metadata verification',()=>{
  const required=requiredReleasePaths();
  const newDependencies=['scripts/localized-shell-copy.mjs','scripts/localized-shell-literals.json','tests/unit/budget-i18n.spec.mjs','tests/api/published-metadata.spec.mjs','tests/api/data-health-provenance.spec.mjs','tests/release/image.spec.mjs','tests/release/html-attributes.mjs','tests/unit/image-html-contract.spec.mjs'];
  for(const file of [...newDependencies,'server/metadata-paths.mjs','server/published-metadata.mjs']) assert.ok(required.includes(file),file);
  const directory=mkdtempSync(join(tmpdir(),'psd-release-trigger-'));
  const trigger=join(directory,'trigger.json');
  const validator=new URL('../../scripts/validate-release-contract.mjs',import.meta.url);
  try {
    // Keep the deployed trigger's server/** convention; an exact helper omission
    // must fail even though every other release file remains covered.
    const covered=[...required.filter(file=>!file.startsWith('server/')),'server/**'];
    writeFileSync(trigger,JSON.stringify({includedFiles:covered}));
    const valid=spawnSync(process.execPath,[validator.pathname,trigger],{encoding:'utf8'});
    assert.equal(valid.status,0,valid.stderr);
    for(const omitted of newDependencies) {
      writeFileSync(trigger,JSON.stringify({includedFiles:covered.filter(file=>file!==omitted)}));
      const invalid=spawnSync(process.execPath,[validator.pathname,trigger],{encoding:'utf8'});
      assert.notEqual(invalid.status,0,omitted);
      assert.ok(invalid.stderr.includes(`Production trigger misses release paths: ${omitted}`),invalid.stderr);
    }
  } finally {rmSync(directory,{recursive:true,force:true});}
});
