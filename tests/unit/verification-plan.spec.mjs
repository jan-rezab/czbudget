import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectVerification } from '../../scripts/verification-plan.mjs';
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
test('unknown, empty, server, data and CI changes fail closed to exhaustive verification',()=>{
  for(const file of ['server/index.mjs','data/a.json','data/NOTES.md','process/x.md','scripts/verification-plan.mjs','new-chart.js','nginx.conf.template','tests/browser/site.spec.mjs','tests/fixtures/x.json']) assert.equal(selectVerification([file]).lane,'full',file);
  assert.equal(selectVerification([]).lane,'full');
});
test('a mixed change cannot hide broad impact behind a component edit',()=>{
  assert.equal(selectVerification(['shared-charts.css','server/index.mjs']).lane,'full');
  assert.equal(selectVerification(['global-nav.js','README.md','data/a.json']).lane,'full');
});
test('header changes run the shell pages; the reports index runs its own view',()=>{
  for(const file of ['global-nav.js','site-header.css','global-footer.js']) {
    const plan=selectVerification([file]);
    assert.equal(plan.lane,'component',file);
    for(const spec of ['shared-navigation','reports-menu','stories']) assert.ok(plan.specs.includes(`tests/browser/${spec}.spec.mjs`),file+spec);
  }
  const reports=selectVerification(['deep-dives/index.html','deep-dives/reports.json']);
  assert.equal(reports.lane,'component');
  assert.ok(reports.specs.includes('tests/browser/reports-menu.spec.mjs'));
});
test('notes and component-proven tests do not force the exhaustive gate',()=>{
  const notes=selectVerification(['README.md','AGENTS.md','scripts/NOTES.md']);
  assert.deepEqual([notes.lane,notes.specs],['component',['tests/browser/shared-navigation.spec.mjs']]);
  const spec=selectVerification(['tests/browser/reports-menu.spec.mjs']);
  assert.equal(spec.lane,'component');
  const unit=selectVerification(['tests/api/russia-trade.spec.mjs','tests/unit/chart-registry.spec.mjs']);
  assert.deepEqual([unit.lane,unit.unit],['component',['tests/api/russia-trade.spec.mjs','tests/unit/chart-registry.spec.mjs']]);
});
