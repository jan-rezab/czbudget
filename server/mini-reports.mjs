import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { AuthError } from './auth.mjs';
import { DataError } from './data-store.mjs';

export const TOPICS = ['Tax', 'Economy', 'Public spending', 'Housing', 'Health', 'Education', 'Transport', 'Environment', 'Demography'];
export const SEED_ID = 'city-property-tax-comparison';
export function requireMiniAuthor(claims, env = process.env) {
  const emails = (env.MINI_REPORTS_AUTHOR_EMAILS ?? env.REPORTS_ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!claims?.sub || claims.email_verified !== true || !emails.includes(String(claims.email || '').toLowerCase())) {
    throw new AuthError(403, 'mini_reports_private', 'Mini Reports is currently open to invited authors only.');
  }
  return claims;
}
function text(value, name, max, optional = false) {
  if (typeof value !== 'string' || value.trim().length > max || (!optional && !value.trim())) throw new DataError(400, 'invalid_report', `Check ${name} (maximum ${max} characters).`);
  return value.trim();
}
function tags(value, name, max) {
  if (!Array.isArray(value) || value.length > max) throw new DataError(400, 'invalid_report', `Choose up to ${max} ${name}.`);
  return [...new Set(value.map(v => text(v, name, 80)))];
}
export function validateMiniReport(body) {
  if (!body || !['draft', 'published'].includes(body.status)) throw new DataError(400, 'invalid_report', 'Choose draft or published.');
  const topics = tags(body.topics, 'topics', 4);
  if (!topics.length || topics.some(v => !TOPICS.includes(v))) throw new DataError(400, 'invalid_report', 'Choose a supported topic.');
  const chart = body.chart;
  if (!chart || !Array.isArray(chart.rows) || chart.rows.length < 1 || chart.rows.length > 40) throw new DataError(400, 'invalid_report', 'Add 1–40 chart rows.');
  const comparisonLabel = text(chart.comparisonLabel ?? '', 'second measure', 80, true);
  const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e15;
  const rows = chart.rows.map(row => {
    if (!row || !number(row.value) || (comparisonLabel && !number(row.comparisonValue))) throw new DataError(400, 'invalid_report', 'Chart values must be finite, nonnegative numbers.');
    return { label: text(row.label, 'row label', 80), value: row.value, ...(comparisonLabel ? { comparisonValue: row.comparisonValue } : {}), note: text(row.note ?? '', 'row note', 400, true) };
  });
  if (!Array.isArray(body.sources) || body.sources.length > 30) throw new DataError(400, 'invalid_report', 'Add up to 30 sources.');
  const sources = body.sources.map(source => {
    const url = text(source?.url, 'source URL', 1500);
    let parsed; try { parsed = new URL(url); } catch { /* rejected below */ }
    if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new DataError(400, 'invalid_report', 'Source links must use HTTPS.');
    return { label: text(source.label, 'source label', 160), url };
  });
  const methodology = text(body.methodology ?? '', 'methodology', 4000, true);
  if (body.status === 'published' && (!sources.length || !methodology || body.reviewed !== true)) throw new DataError(400, 'review_required', 'Review the data, add sources and explain the method before publishing.');
  return {
    title: text(body.title, 'title', 140), summary: text(body.summary, 'summary', 800),
    authorName: text(body.authorName, 'author name', 80), topics,
    countries: tags(body.countries, 'countries', 30), cities: tags(body.cities, 'cities', 40),
    status: body.status, methodology, sources,
    chart: { label: text(chart.label, 'measure', 80), unit: text(chart.unit, 'unit', 30), comparisonLabel, rows },
  };
}

export function createMiniReports({ env = process.env, fetchImpl = fetch, seedLoader = async () => JSON.parse(await readFile(new URL('./mini-reports-seed.json', import.meta.url), 'utf8')) } = {}) {
  let identity;
  const project = () => env.MINI_REPORTS_PROJECT_ID || env.REPORTS_PROJECT_ID;
  const root = () => `projects/${project()}/databases/${env.MINI_REPORTS_DATABASE_ID || env.REPORTS_DATABASE_ID || '(default)'}/documents`;
  const configured = () => Boolean(project());
  const checkID = id => { if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) throw new DataError(400, 'invalid_id', 'Invalid report ID.'); };
  const unpack = doc => ({ ...JSON.parse(doc.fields.payload.stringValue), id: doc.name.split('/').at(-1), updateTime: doc.updateTime });
  async function request(suffix, options = {}) {
    if (!configured()) throw new DataError(503, 'mini_reports_unconfigured', 'Publishing storage is not configured. Your report has not been saved.');
    if (!identity || identity.expires < Date.now() + 60000) {
      const response = await fetchImpl('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new DataError(503, 'mini_reports_unavailable', 'Publishing storage is unavailable.');
      const token = await response.json();
      if (!token.access_token) throw new DataError(503, 'mini_reports_unavailable', 'Publishing storage is unavailable.');
      identity = { value: token.access_token, expires: Date.now() + Number(token.expires_in || 300) * 1000 };
    }
    const response = await fetchImpl(`https://firestore.googleapis.com/v1/${root()}${suffix}`, { ...options, headers: { Authorization: `Bearer ${identity.value}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      if (response.status === 404) throw new DataError(404, 'report_not_found', 'Report not found.');
      if ([409, 412].includes(response.status)) throw new DataError(409, 'report_changed', 'This report changed. Reload it before saving.');
      throw new DataError(503, 'mini_reports_unavailable', 'Publishing storage is unavailable. Your change has not been confirmed.');
    }
    return response.json();
  }
  const seed = async () => ({ ...await seedLoader(), id: SEED_ID, status: 'draft', authorId: null, authorName: '', publishedAt: null, updateTime: 'seed' });
  async function detail(id) {
    checkID(id);
    if (configured()) {
      try { return unpack(await request(`/miniReports/${id}`)); } catch (error) { if (error.status !== 404 || id !== SEED_ID) throw error; }
    } else if (id !== SEED_ID) throw new DataError(404, 'report_not_found', 'Report not found.');
    return seed();
  }
  return {
    async list(claims, cursor = '') {
      if (typeof cursor !== 'string' || cursor.length > 4000) throw new DataError(400, 'invalid_cursor', 'Invalid page cursor.');
      const result = configured() ? await request(`/miniReports?${new URLSearchParams({ pageSize: '40', orderBy: 'updatedAt desc', ...(cursor ? { pageToken: cursor } : {}) })}`) : {};
      const reports = (result.documents || []).map(unpack).filter(r => r.status === 'published' || r.authorId === claims.sub);
      if (!cursor && !reports.some(r => r.id === SEED_ID)) {
        const original = await detail(SEED_ID);
        if (original.authorId === null) reports.push(original);
      }
      return { reports, nextPageToken: result.nextPageToken || '', storageConfigured: configured(), topics: TOPICS, author: { id: claims.sub, name: claims.name || '' } };
    },
    async save(id, body, claims) {
      const content = validateMiniReport(body);
      let existing = null;
      if (id) {
        existing = await detail(id);
        if (existing.authorId && existing.authorId !== claims.sub) throw new AuthError(403, 'author_required', 'Only the author can edit this report.');
        if (!body.updateTime || body.updateTime !== existing.updateTime) throw new DataError(409, 'report_changed', 'This report changed. Reload it before saving.');
      } else id = crypto.randomUUID();
      const now = new Date().toISOString();
      const report = { ...content, authorId: claims.sub, createdAt: existing?.createdAt || now, updatedAt: now, publishedAt: content.status === 'published' ? existing?.publishedAt || now : null };
      await request(':commit', { method: 'POST', body: JSON.stringify({ writes: [{
        update: { name: `${root()}/miniReports/${id}`, fields: { payload: { stringValue: JSON.stringify(report) }, updatedAt: { timestampValue: now } } },
        currentDocument: existing && existing.updateTime !== 'seed' ? { updateTime: existing.updateTime } : { exists: false },
      }] }) });
      return { report: await detail(id) };
    },
  };
}
