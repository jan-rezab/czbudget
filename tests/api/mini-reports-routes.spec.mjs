import assert from 'node:assert/strict';
import http from 'node:http';
import { before, after, test } from 'node:test';
process.env.NODE_ENV = 'test';
delete process.env.MINI_REPORTS_PROJECT_ID; delete process.env.REPORTS_PROJECT_ID;
const { handler } = await import('../../server/index.mjs');
let server, base;
before(async () => { server = http.createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); });
test('anonymous requests cannot read the page, data or assets', async () => {
  process.env.AUTH_DISABLED_FOR_TESTS = '0';
  for (const path of ['/mini-reports', '/mini-reports/', '/mini-reports/app.js', '/mini-reports/style.css', '/api/mini-reports']) {
    const r = await fetch(base + path, { redirect: 'manual' }); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(r.status, ['/mini-reports', '/mini-reports/'].includes(path) ? 302 : 401);
  }
});
test('verified users still need an invitation; invited authors can view the starter', async () => {
  process.env.AUTH_DISABLED_FOR_TESTS = '1'; process.env.MINI_REPORTS_AUTHOR_EMAILS = '';
  assert.equal((await fetch(base + '/api/mini-reports')).status, 403);
  process.env.MINI_REPORTS_AUTHOR_EMAILS = 'test@example.test';
  for (const path of ['/mini-reports', '/mini-reports/app.js', '/mini-reports/style.css']) { const r = await fetch(base + path); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store'); }
  const data = await (await fetch(base + '/api/mini-reports')).json(); assert.equal(data.reports[0].chart.rows.length, 28); assert.equal(data.storageConfigured, false);
});
test('cross-origin writes and unknown endpoints are rejected', async () => {
  assert.equal((await fetch(base + '/api/mini-reports', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(base + '/api/mini-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(base + '/mini-reports/seed.json')).status, 404);
});
