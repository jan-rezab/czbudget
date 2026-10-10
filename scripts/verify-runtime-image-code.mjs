import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const root = '/usr/share/nginx/html';
for (const name of [
  '.asset-release', '.public-serving-build', '.cityvizor-serving', 'scripts',
  'pipeline', 'tests', 'content', 'data/.municipal-headlines-query.json', 'data/isred',
  'data/industrial-intelligence', 'data/czech-nku', 'data/contracts',
  'data/czech-project-geography', 'data/industry',
  // Served from the static-asset packs since the repository stopped tracking them.
  'data/countries',
  'data/public-entities',
  'data/economy',
  'data/international-municipalities',
  'data/czech-sfdi-tables',
  'data/monitor-grants',
  'data/registry/source-provenance',
  'data/paq',
  'data/international-municipalities.v1.json',
  'data/municipal-snapshot.v1.json',
  'data/municipal-history-directory.v1.json',
  'data/cze-medicine-reimbursements.v1.json',
  'data/cze-school-funding-2026.v1.json',
  'data/czech-consolidated-accounts.v1.json',
  'data/czech-sfdi-financing.v1.json',
  'data/pensions-today.v1.json',
  'data/methodology-sources.v1.json',
  'data/eu-budget-flows.v1.json',
  'data/sovereign-benchmark-slim.v1.json',
]) {
  await assert.rejects(fs.stat(`${root}/${name}`), {code: 'ENOENT'});
}
for (const name of ['data-assets-lock.json', 'municipal-pointer.json', 'cityvizor-pointer.json']) {
  await assert.rejects(fs.stat(`/app/server/${name}`), {code: 'ENOENT'});
}

const child = spawn('/app/server/start.sh', {stdio: 'inherit'});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch('http://127.0.0.1:8080/healthz', {
        signal: AbortSignal.timeout(500),
      })).ok;
    } catch {}
    if (ready) break;
    await delay(100);
  }
  assert.ok(ready, 'Image must start both Nginx and API');
  for (const url of ['/', '/demo', '/process/log/?lang=en', '/stories/', '/stories/tariffs-went-up-did-america-win/', '/stories/feed.xml']) {
    const response = await fetch(`http://127.0.0.1:8080${url}`, {
      signal: AbortSignal.timeout(20_000),
    });
    assert.equal(response.status, 200, url);
    await response.arrayBuffer();
  }
  for (const [url, expected] of [
    ['/about.html?lang=en', '<html lang="en">'],
    ['/methodology.html?lang=en', '<html lang="en">'],
    ['/deep-dives/?lang=en', '<html lang="en">'],
    ['/countries/germany?lang=en', '<h1 id="country-name">Germany</h1>'],
  ]) {
    const response = await fetch(`http://127.0.0.1:8080${url}`, {signal: AbortSignal.timeout(20_000)});
    assert.equal(response.status, 200, url);
    assert.ok((await response.text()).includes(expected), `${url} must contain ${expected}`);
  }
  const unknownCountry = await fetch('http://127.0.0.1:8080/countries/zzz?lang=en', {signal: AbortSignal.timeout(20_000)});
  assert.equal(unknownCountry.status, 404, 'Unknown country must not serve another country profile');
  console.log('Code-only runtime contract passed: lean filesystem, health and static routes.');
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    await stopped;
  }
}
