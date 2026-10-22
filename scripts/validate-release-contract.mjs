import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {registry,matchPath} from './chart-registry.mjs';

const root=resolve(import.meta.dirname,'..');
const required=[
  ...registry.release.content_versioned_adapters,
  'chart-components.json','chart-legacy-inventory.json','chart-coverage.json','ui-environment.json',
  'Dockerfile.slim','package.json','package-lock.json','cloudbuild.yaml',
  'scripts/chart-registry.mjs','scripts/build-chart-coverage.mjs','scripts/validate-chart-ownership.mjs',
  'scripts/validate-ui-environment.mjs','scripts/validate-release-contract.mjs',
  'scripts/release-verification.mjs','scripts/prepare-production-verification.mjs','scripts/run-component-gate.mjs',
  'scripts/build-admission.py','tests/test_build_admission.py',
  'nginx.conf.template','scripts/stage-runtime.py','scripts/render-localized-shells.mjs',
  'scripts/localized-shell-copy.mjs','scripts/localized-shell-literals.json',
  'tests/unit/localized-shells.spec.mjs','tests/unit/budget-i18n.spec.mjs',
  'server/metadata-paths.mjs','server/published-metadata.mjs',
  'tests/api/published-metadata.spec.mjs','tests/api/data-health-provenance.spec.mjs',
  'tests/unit/chart-registry.spec.mjs','tests/unit/release-contract.spec.mjs','tests/browser/shared-charts.spec.mjs'
];
const triggerPath=process.argv[2];
if(triggerPath) {
  const trigger=JSON.parse(readFileSync(resolve(triggerPath),'utf8'));
  const patterns=trigger.includedFiles || [];
  const missing=required.filter(file=>!patterns.some(pattern=>matchPath(pattern,file)));
  if(missing.length) throw new Error(`Production trigger misses release paths: ${missing.join(', ')}`);
}
const stage=readFileSync(resolve(root,'scripts/stage-runtime.py'),'utf8');
if(!stage.includes('version_runtime_references')) throw new Error('Runtime staging does not content-version registered adapters');
const releaseTest=readFileSync(resolve(root,'tests/release/image.spec.mjs'),'utf8');
for(const marker of ['current.json','immutable','psd-plot-tooltip']) if(!releaseTest.includes(marker)) throw new Error(`Candidate-image cache/interaction contract misses ${marker}`);
console.log(`Release contract passed: ${required.length} registered code paths; staged adapter versions and candidate-image cache checks present.`);

export function requiredReleasePaths(){return required;}
