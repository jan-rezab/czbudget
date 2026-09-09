import crypto from 'node:crypto';
import { DataError } from './data-store.mjs';
const fail = (status, message) => { throw new DataError(status, 'data_report_error', message); };
export function reportConfig(env = process.env) {
  return { enabled: env.DATA_REPORTS_ENABLED === 'true' && !!env.REPORTS_PROJECT_ID && !!env.REPORTS_RECAPTCHA_SITE_KEY, siteKey: env.REPORTS_RECAPTCHA_SITE_KEY || '' };
}
export function validateReport(body, origin) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid report.');
  const field = (name, max, min = 0) => {
    const value = body[name] ?? '';
    if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail(400, `Invalid ${name}.`);
    return value.trim();
  };
  const reason = field('reason', 30);
  if (!['incorrect', 'outdated', 'source', 'context', 'other'].includes(reason)) fail(400, 'Choose a reason.');
  const page = field('page', 2000, 1);
  let url;
  try { url = new URL(page, origin); } catch { fail(400, 'Invalid page.'); }
  if (url.origin !== origin || !page.startsWith('/') || page.startsWith('//')) fail(400, 'Invalid page.');
  // Only retain known page state; never store arbitrary query strings or URL tokens.
  for (const key of [...url.searchParams.keys()]) if (!['lang', 'code', 'country', 'year', 'id'].includes(key)) url.searchParams.delete(key);
  const source = field('source', 2000);
  if (source) { let parsed; try { parsed = new URL(source); } catch { fail(400, 'Invalid source URL.'); } if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) fail(400, 'Invalid source URL.'); }
  const email = field('email', 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Invalid email.');
  return { page: url.pathname + url.search + url.hash, title: field('title', 300), target: field('target', 500), reason, explanation: field('explanation', 4000, 20), source, email, website: field('website', 200), token: field('token', 10000, 1) };
}
export function createReportService({ env = process.env, fetchImpl = fetch } = {}) {
  async function json(url, options = {}) {
    const result = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(8000) });
    if (!result.ok) fail(503, 'Reporting is temporarily unavailable. Your report has not been confirmed.');
    return result.json();
  }
  return async (body, origin) => {
    if (!reportConfig(env).enabled) fail(503, 'Reporting is not yet enabled.');
    const report = validateReport(body, origin);
    if (report.website) fail(400, 'Unable to accept this report.');
    const identity = await json('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } });
    if (!identity.access_token) fail(503, 'Reporting is temporarily unavailable.');
    const headers = { Authorization: `Bearer ${identity.access_token}`, 'Content-Type': 'application/json' };
    const project = encodeURIComponent(env.REPORTS_PROJECT_ID);
    const assessment = await json(`https://recaptchaenterprise.googleapis.com/v1/projects/${project}/assessments`, { method: 'POST', headers, body: JSON.stringify({ event: { token: report.token, siteKey: env.REPORTS_RECAPTCHA_SITE_KEY, expectedAction: 'data_report' } }) });
    const props = assessment.tokenProperties;
    if (!props?.valid || props.action !== 'data_report' || props.hostname !== new URL(origin).hostname || !(assessment.riskAnalysis?.score >= 0.5)) fail(400, 'Spam verification failed. Please try again.');
    const id = crypto.randomUUID();
    const root = `projects/${env.REPORTS_PROJECT_ID}/databases/${env.REPORTS_DATABASE_ID || '(default)'}/documents`;
    const { email, token, website, ...content } = report;
    const fields = Object.fromEntries(Object.entries({ ...content, status: 'new', schemaVersion: '1' }).map(([key, value]) => [key, { stringValue: value }]));
    fields.createdAt = { timestampValue: new Date().toISOString() };
    const writes = [{ update: { name: `${root}/dataReports/${id}`, fields }, currentDocument: { exists: false } }];
    if (email) writes.push({ update: { name: `${root}/dataReportContacts/${id}`, fields: { email: { stringValue: email }, expiresAt: { timestampValue: new Date(Date.now() + 90 * 86400000).toISOString() } } }, currentDocument: { exists: false } });
    await json(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ writes }) });
    return { id, status: 'new' };
  };
}
