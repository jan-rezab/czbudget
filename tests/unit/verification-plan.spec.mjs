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
test('unknown, empty, global, data and CI changes fail closed to exhaustive verification',()=>{
  for(const file of ['global-nav.js','site-header.css','server/index.mjs','data/a.json','scripts/verification-plan.mjs','new-chart.js','nginx.conf.template']) assert.equal(selectVerification([file]).lane,'full',file);
  assert.equal(selectVerification([]).lane,'full');
});
test('a mixed change cannot hide broad impact behind a component edit',()=>{
  assert.equal(selectVerification(['shared-charts.css','global-nav.js']).lane,'full');
});
