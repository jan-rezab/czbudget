import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registry,consumerTests,sharedPath} from '../../scripts/chart-registry.mjs';

test('one registry covers every shared adapter, family and legacy drawing site',()=>{
  const inventory=JSON.parse(readFileSync(new URL('../../chart-legacy-inventory.json',import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(registry.legacy.classifications).sort(),Object.keys(inventory.files).sort());
  assert.equal(new Set(registry.consumers.map(item=>item.adapter)).size,registry.consumers.length);
  for(const consumer of registry.consumers) {
    assert.ok(consumer.tests.length && consumer.routes.length && consumer.change_paths.includes(consumer.adapter));
    consumer.families.forEach(family=>assert.ok(registry.renderer.families.includes(family),`${consumer.id}: ${family}`));
  }
});
test('consumer edits select their declared tests, including Czech nationwide history',()=>{
  assert.ok(consumerTests('municipalities-czechia.js').includes('tests/browser/shared-charts.spec.mjs'));
  assert.ok(consumerTests('stories/tariff-charts.js').includes('tests/browser/stories.spec.mjs'));
  assert.ok(sharedPath('assets/chart-releases/abc.js'));
  const czechia=readFileSync(new URL('../../municipalities-czechia.js',import.meta.url),'utf8');
  assert.match(czechia,/PSDPlot\.render/); assert.match(czechia,/onSelect/);
});
