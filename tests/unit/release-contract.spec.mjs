import test from 'node:test';
import assert from 'node:assert/strict';
import {requiredReleasePaths} from '../../scripts/validate-release-contract.mjs';
import {registry} from '../../scripts/chart-registry.mjs';
import {productionPlan, releaseMode} from '../../scripts/release-verification.mjs';
import {readFileSync} from 'node:fs';

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
test('production cannot promote before focused verification and candidate-image browser checks',()=>{
  const yaml=readFileSync(new URL('../../cloudbuild.yaml',import.meta.url),'utf8');
  const block=id=>yaml.split(`  - id: ${id}\n`)[1]?.split('\n  - id: ')[0];
  assert.match(block('component-verification'),/scripts\/run-component-gate\.mjs \.verification-plan\.json/);
  assert.match(block('component-verification'),/waitFor: \[source-contracts\]/);
  assert.match(block('image-browser-contract'),/waitFor: \[start-image-browser-candidate, component-verification\]/);
  assert.match(block('assert-current-main'),/waitFor: \[assert-single-production, component-verification, image-contract, image-browser-contract, push\]/);
  assert.match(block('assert-verified-candidate'),/scripts\/check-cloud-verification\.py --plan \.verification-plan\.json/);
  assert.match(block('verification-input'),/git diff --name-only "\$\$base" "\$COMMIT_SHA"/);
});
