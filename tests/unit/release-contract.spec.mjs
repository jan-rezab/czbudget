import test from 'node:test';
import assert from 'node:assert/strict';
import {requiredReleasePaths} from '../../scripts/validate-release-contract.mjs';
import {registry} from '../../scripts/chart-registry.mjs';

test('release contract covers every adapter and its architecture sources',()=>{
  const required=requiredReleasePaths();
  for(const adapter of registry.release.content_versioned_adapters) assert.ok(required.includes(adapter),adapter);
  for(const file of ['chart-components.json','chart-coverage.json','ui-environment.json','scripts/chart-registry.mjs','scripts/build-chart-coverage.mjs']) assert.ok(required.includes(file),file);
});
