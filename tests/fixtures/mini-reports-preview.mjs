// Loopback-only browser fixture. No credentials or cloud writes. Never shipped.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
process.env.NODE_ENV = 'test';
process.env.AUTH_DISABLED_FOR_TESTS = '1';
process.env.MINI_REPORTS_AUTHOR_EMAILS = 'test@example.test';
process.env.MINI_REPORTS_PROJECT_ID = 'mini-reports-local-fixture';
process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:4189';
const docs = new Map();
let revision = 0;
globalThis.fetch = async (url, options = {}) => {
  const ok = result => ({ ok: true, json: async () => result });
  if (String(url).includes('metadata.google.internal')) return ok({ access_token: 'local-fixture' });
  if (!String(url).startsWith('https://firestore.googleapis.com/v1/projects/mini-reports-local-fixture/')) throw new Error('External requests disabled in this fixture.');
  if (url.endsWith(':commit')) {
    const write = JSON.parse(options.body).writes[0], id = write.update.name.split('/').at(-1), prior = docs.get(id);
    if (write.currentDocument.exists === false && prior || write.currentDocument.updateTime && prior?.updateTime !== write.currentDocument.updateTime) return { ok: false, status: 409 };
    docs.set(id, { ...write.update, updateTime: new Date(Date.UTC(2026, 8, 20, 12, 0, ++revision)).toISOString() }); return ok({});
  }
  if (url.includes('/miniReports?')) return ok({ documents: [...docs.values()].reverse() });
  const doc = docs.get(url.split('/').at(-1)); return doc ? ok(doc) : { ok: false, status: 404 };
};
const { handler } = await import('../../server/index.mjs');
http.createServer(async (request, response) => {
  if (request.url === '/assets/logo-lockup.svg' || request.url === '/assets/favicon.svg') {
    response.writeHead(200, { 'Content-Type': 'image/svg+xml' }); response.end(await readFile(new URL(`../../${request.url.slice(1)}`, import.meta.url))); return;
  }
  await handler(request, response);
}).listen(4189, '127.0.0.1', () => console.log('Mini Reports fixture: http://127.0.0.1:4189/mini-reports'));
