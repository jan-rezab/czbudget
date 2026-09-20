import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const root = '/usr/share/nginx/html';
for (const name of ['.asset-release', '.public-serving-build', '.cityvizor-serving', 'scripts', 'pipeline', 'tests', 'data/.municipal-headlines-query.json', 'data/isred', 'data/industrial-intelligence', 'data/czech-nku', 'data/contracts', 'data/czech-project-geography', 'data/industry']) {
  await assert.rejects(fs.stat(`${root}/${name}`), {code: 'ENOENT'});
}
const lockPath = process.env.DATA_ASSET_LOCK || '/app/server/data-assets-lock.json';
const lock = JSON.parse(await fs.readFile(lockPath, 'utf8'));
const child = spawn('/app/server/start.sh', {stdio: 'inherit'});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch('http://127.0.0.1:8080/healthz', {signal: AbortSignal.timeout(500)})).ok; } catch {}
    if (ready) break;
    await delay(100);
  }
  assert.ok(ready, 'Image must start both Nginx and API');
  for (const name of ['automotive', 'money-flow-model', 'funding-deep-dive', 'funding-ledgers', 'funding-systems']) {
    const response = await fetch(`http://127.0.0.1:8080/lib/${name}.mjs`);
    assert.equal(response.status, 200, name);
    assert.match(response.headers.get('content-type') || '', /^(?:application|text)\/javascript\b/, `${name} must load as a browser module`);
    await response.arrayBuffer();
  }
  for (const url of ['/mini-reports', '/mini-reports/app.js', '/mini-reports/style.css', '/api/mini-reports']) {
    const response = await fetch(`http://127.0.0.1:8080${url}`, {redirect: 'manual'});
    assert.equal(response.status, url === '/mini-reports' ? 302 : 401, url);
    assert.equal(response.headers.get('cache-control'), 'no-store', url);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', url);
    await response.arrayBuffer();
  }
  for (const group of Object.keys(lock.packs)) {
    const [url, file] = Object.entries(lock.files).find(([, file]) => file.pack === group && file.size);
    const response = await fetch(`http://127.0.0.1:8080${url}`);
    assert.equal(response.status, 200, url);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), file.raw_sha256 || file.sha256, url);
    const head = await fetch(`http://127.0.0.1:8080${url}`, {method: 'HEAD', headers: {'Accept-Encoding': 'identity'}});
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(file.raw_size || file.size));
    const conditional = await fetch(`http://127.0.0.1:8080${url}`, {headers: {'If-None-Match': response.headers.get('etag')}});
    assert.equal(conditional.status, 304);
  }
  const missing = await fetch('http://127.0.0.1:8080/data/isred/not-a-published-file.json');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('cache-control'), 'no-store');
  for (const url of ['/', '/demo', '/cz/municipalities/praha/?lang=en', '/process/log/?lang=en', '/public-data/cityvizor/index']) {
    const response = await fetch(`http://127.0.0.1:8080${url}`, {signal: AbortSignal.timeout(20000)});
    assert.equal(response.status, 200, url);
    await response.arrayBuffer();
  }
  console.log('Runtime image contract passed: lean filesystem, cloud-pack routes, pinned snapshots and Nginx.');
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    await stopped;
  }
}
