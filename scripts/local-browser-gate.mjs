#!/usr/bin/env node
// Optional pre-push browser gate. When Playwright and its Chromium are installed in
// this checkout, run the component-proven specs a release would exercise, on the
// same component server the production build uses. About twenty seconds locally,
// against an eight-to-eighteen-minute cloud round trip when a spec fails there.
// A component lane runs its selected specs; a full lane runs every component spec
// (the data-backed specs still run in the production build).
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { groups, selectVerification } from './verification-plan.mjs';
import { registry } from './chart-registry.mjs';

if (process.env.PSD_SKIP_LOCAL_BROWSER === '1') { console.log('local browser gate: skipped (PSD_SKIP_LOCAL_BROWSER=1)'); process.exit(0); }
let chromium;
try { ({ chromium } = await import('@playwright/test')); } catch {}
if (!chromium || !existsSync(chromium.executablePath())) {
  console.log('local browser gate: skipped; run `npm ci && npx playwright install chromium` to catch browser failures before the cloud does');
  process.exit(0);
}
const planPath = process.argv[2];
const plan = planPath ? JSON.parse(readFileSync(planPath, 'utf8')) : null;
const selected = plan ? selectVerification(plan.files) : null;
const every = [...new Set([...Object.values(groups).flat(), ...registry.consumers.flatMap((consumer) => consumer.tests)])];
const specs = (selected?.lane === 'component' ? selected.specs : every).filter(existsSync);
const started = Date.now();
const result = spawnSync('npx', ['playwright', 'test', ...specs, '--config=playwright.ui.config.mjs', '--workers=4', '--retries=0', '--reporter=dot', '--output=test-results/local-gate'], { stdio: 'inherit' });
console.log(`local browser gate: ${specs.length} spec file(s) in ${Math.round((Date.now() - started) / 1000)} s`);
process.exit(result.status ?? 1);
