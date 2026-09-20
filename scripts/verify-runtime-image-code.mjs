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
  console.log('Code-only runtime contract passed: lean filesystem, health and static routes.');
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    await stopped;
  }
}
