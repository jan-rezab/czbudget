import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const root = '/usr/share/nginx/html';
for (const name of ['.asset-release', '.public-serving-build', '.cityvizor-serving', 'scripts', 'pipeline', 'tests', 'data/.municipal-headlines-query.json', 'data/isred', 'data/industrial-intelligence', 'data/czech-nku', 'data/contracts', 'data/czech-project-geography']) {
  await assert.rejects(fs.stat(`${root}/${name}`), {code: 'ENOENT'});
}
const lock = JSON.parse(await fs.readFile('/app/server/data-assets-lock.json', 'utf8'));
const child = spawn('/app/server/start.sh', {stdio: 'inherit'});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch('http://127.0.0.1:8080/healthz', {signal: AbortSignal.timeout(500)})).ok; } catch {}
    if (ready) break;
    await delay(100);
  }
  assert.ok(ready, 'Image must start both Nginx and API');
  for (const group of Object.keys(lock.packs)) {
    const [url, file] = Object.entries(lock.files).find(([, file]) => file.pack === group && file.size);
    const response = await fetch(`http://127.0.0.1:8080${url}`);
    assert.equal(response.status, 200, url);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), file.sha256, url);
    const head = await fetch(`http://127.0.0.1:8080${url}`, {method: 'HEAD'});
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(file.size));
    const conditional = await fetch(`http://127.0.0.1:8080${url}`, {headers: {'If-None-Match': `"${file.sha256}"`}});
    assert.equal(conditional.status, 304);
  }
  const missing = await fetch('http://127.0.0.1:8080/data/isred/not-a-published-file.json');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('cache-control'), 'no-store');
  for (const url of ['/', '/demo', '/cz/municipalities/praha/?lang=en', '/public-data/cityvizor/index']) {
    const response = await fetch(`http://127.0.0.1:8080${url}`, {signal: AbortSignal.timeout(20000)});
    assert.equal(response.status, 200, url);
    await response.arrayBuffer();
  }
  console.log('Runtime image contract passed: lean filesystem, cloud-pack routes, pinned snapshots and Nginx.');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
}
