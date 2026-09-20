import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createMiniReports, requireMiniAuthor, validateMiniReport, SEED_ID } from '../../server/mini-reports.mjs';

const claims = { sub: 'author-1', name: 'Jane Author', email: 'jane@example.org', email_verified: true };
const content = { title: 'Test report', summary: 'A sourced comparison.', authorName: 'Jane Author', topics: ['Tax'], countries: ['Czechia'], cities: ['Prague'], status: 'draft', methodology: 'Synthetic test data, not an observed rate.', sources: [{ label: 'Source', url: 'https://example.org/data' }], chart: { label: 'Tax / value', unit: '%', comparisonLabel: '', rows: [{ label: 'Prague', value: 0.45, note: 'Scenario' }] } };
const seed = JSON.parse(await readFile(new URL('../../server/mini-reports-seed.json', import.meta.url), 'utf8'));
test('access fails closed for ordinary and unverified accounts', () => {
  for (const user of [claims, { ...claims, email_verified: false }, { ...claims, email: 'outsider@example.org' }]) assert.throws(() => requireMiniAuthor(user, {}), { status: 403 });
  assert.throws(() => requireMiniAuthor({ ...claims, email_verified: false }, { MINI_REPORTS_AUTHOR_EMAILS: claims.email }), { status: 403 });
  assert.equal(requireMiniAuthor(claims, { REPORTS_ADMIN_EMAILS: 'JANE@example.org' }), claims);
  assert.throws(() => requireMiniAuthor(claims, { MINI_REPORTS_AUTHOR_EMAILS: '', REPORTS_ADMIN_EMAILS: claims.email }), { status: 403 });
});
test('publishing requires a human review, sources and methodology', () => {
  for (const patch of [{ reviewed: false }, { sources: [] }, { methodology: '' }]) assert.throws(() => validateMiniReport({ ...content, status: 'published', reviewed: true, ...patch }));
  assert.equal(validateMiniReport({ ...content, status: 'published', reviewed: true, authorId: 'forged' }).authorId, undefined);
  for (const url of ['javascript:alert(1)', 'http://example.org', 'https://user:pass@example.org']) assert.throws(() => validateMiniReport({ ...content, sources: [{ label: 'Bad', url }] }));
  for (const value of [null, '1', Infinity, -1, NaN]) assert.throws(() => validateMiniReport({ ...content, chart: { ...content.chart, rows: [{ label: 'Bad', value }] } }));
  assert.throws(() => validateMiniReport({ ...content, topics: ['Unsupported'] }));
});
function fake() {
  const docs = new Map(), commits = [];
  let tick = 0;
  const fetchImpl = async (url, options = {}) => {
    const ok = value => ({ ok: true, json: async () => value });
    if (url.includes('metadata.google')) return ok({ access_token: 'fixture' });
    if (url.endsWith(':commit')) {
      const commit = JSON.parse(options.body); commits.push(commit); const write = commit.writes[0], id = write.update.name.split('/').at(-1), prior = docs.get(id);
      if (write.currentDocument.exists === false && prior || write.currentDocument.updateTime && write.currentDocument.updateTime !== prior?.updateTime) return { ok: false, status: 409 };
      const doc = { ...write.update, updateTime: `2026-09-20T12:00:${String(++tick).padStart(2, '0')}.000Z` }; docs.set(id, doc); return ok({});
    }
    if (url.includes('/miniReports?')) return ok({ documents: [...docs.values()] });
    const doc = docs.get(url.split('/').at(-1)); return doc ? ok(doc) : { ok: false, status: 404 };
  };
  return { service: createMiniReports({ env: { REPORTS_PROJECT_ID: 'test' }, fetchImpl }), docs, commits };
}
test('starter includes all 28 cities and explicitly labels Prague as a scenario', async () => {
  assert.equal(seed.chart.rows.length, 28);
  const row = seed.chart.rows.find(r => r.label === 'Prague'); assert.equal(row.value, 0.450363); assert.match(row.note, /SCENARIO/);
  validateMiniReport({ ...seed, authorName: 'Reviewer', status: 'draft' });
  const service = createMiniReports({ env: {} }); const list = await service.list(claims);
  assert.equal(list.storageConfigured, false); assert.equal(list.reports[0].authorId, null); assert.equal(list.reports[0].status, 'draft');
  await assert.rejects(service.save(null, content, claims), { status: 503 });
});
test('draft → publish → withdraw survives service reads and keeps authenticated ownership', async () => {
  const { service, commits } = fake();
  let { report } = await service.save(null, { ...content, authorId: 'forged' }, claims);
  assert.equal(report.authorId, claims.sub); assert.equal(report.publishedAt, null);
  assert.equal((await service.list({ ...claims, sub: 'other' })).reports.some(r => r.id === report.id), false);
  report = (await service.save(report.id, { ...content, status: 'published', reviewed: true, updateTime: report.updateTime }, claims)).report;
  assert.ok(report.publishedAt); assert.equal((await service.list({ ...claims, sub: 'other' })).reports.some(r => r.id === report.id), true);
  await assert.rejects(service.save(report.id, { ...content, updateTime: report.updateTime }, { ...claims, sub: 'other' }), { status: 403 });
  const stale = report.updateTime;
  report = (await service.save(report.id, { ...content, updateTime: report.updateTime }, claims)).report;
  assert.equal(report.status, 'draft'); assert.equal(report.publishedAt, null);
  await assert.rejects(service.save(report.id, { ...content, updateTime: stale }, claims), { status: 409 });
  assert.equal(commits.length, 3);
});
test('claiming the starter is create-only and cannot overwrite another author', async () => {
  const { service, commits } = fake();
  const { report } = await service.save(SEED_ID, { ...content, updateTime: 'seed' }, claims);
  assert.equal(report.id, SEED_ID); assert.deepEqual(commits[0].writes[0].currentDocument, { exists: false });
  await assert.rejects(service.save(SEED_ID, { ...content, updateTime: 'seed' }, { ...claims, sub: 'other' }), { status: 403 });
  assert.equal((await service.list(claims)).reports.filter(r => r.id === SEED_ID).length, 1);
});
