import crypto from 'node:crypto';

const BUCKET = 'czbudget-janrezab-public-snapshots';
const POINTER = 'static-assets/human-development/current.json';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MAX_BYTES = 2 * 1024 * 1024;
const STATUSES = new Set(['ready', 'unavailable', 'historical', 'withdrawn', 'needs_definition']);
const TYPES = new Set(['line', 'column', 'bar', 'stacked']);
const translated = value => value && typeof value.en === 'string' && typeof value.cs === 'string';
const text = value => typeof value === 'string' || translated(value);
const sourceURL = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };

export class HumanDevelopmentError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export function validateHumanDevelopment(payload, releaseId) {
  const fail = () => { throw new HumanDevelopmentError(502, 'human_development_payload_invalid'); };
  if (payload?.schema_version !== '1.0.0' || payload.release_id !== releaseId ||
      typeof payload.generated_at !== 'string' || !Number.isFinite(Date.parse(payload.generated_at)) || !payload.source_releases ||
      !Array.isArray(payload.geographies) || !Array.isArray(payload.chapters) ||
      !Array.isArray(payload.charts) || !payload.coverage ||
      !Number.isSafeInteger(payload.coverage.source_count) || payload.coverage.source_count < 0 ||
      !Array.isArray(payload.coverage.unavailable_sources)) fail();
  const codes = new Set(), chapters = new Set(), charts = new Set();
  for (const g of payload.geographies) {
    if (typeof g.code !== 'string' || !g.code || codes.has(g.code) || !text(g.name)) fail();
    codes.add(g.code);
  }
  for (const chapter of payload.chapters) {
    if (typeof chapter.id !== 'string' || !chapter.id || chapters.has(chapter.id) || !translated(chapter.title)) fail();
    chapters.add(chapter.id);
  }
  for (const chart of payload.charts) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chart.id) || charts.has(chart.id) ||
        !chapters.has(chart.chapter) || !translated(chart.title) || !STATUSES.has(chart.status) ||
        !Array.isArray(chart.rows) || !Array.isArray(chart.fields) || !Array.isArray(chart.source_refs) ||
        !text(chart.method) || !text(chart.denominator) || typeof chart.unit !== 'string' || !Array.isArray(chart.original_refs)) fail();
    charts.add(chart.id);
    const keys = new Set();
    for (const field of chart.fields) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key) || keys.has(field.key) || !text(field.label)) fail();
      keys.add(field.key);
    }
    for (const ref of chart.source_refs) {
      if (!sourceURL(ref.url) || typeof ref.vintage !== 'string' || typeof ref.table !== 'string') fail();
    }
    const defaults = chart.row_defaults || {};
    if (typeof defaults !== 'object' || Array.isArray(defaults) ||
        Object.keys(defaults).some(key => !['country', 'year', 'period'].includes(key)) ||
        (defaults.country != null && !codes.has(defaults.country)) ||
        (defaults.year != null && !Number.isSafeInteger(defaults.year)) ||
        (defaults.period != null && (typeof defaults.period !== 'string' || defaults.period.length > 100))) fail();
    const columns = chart.row_columns;
    if (columns != null && (!Array.isArray(columns) || !columns.length ||
        new Set(columns).size !== columns.length ||
        columns.some(key => !['country', 'year', 'period'].includes(key) && !keys.has(key)))) fail();
    const restoredRows = [];
    for (const nativeRow of chart.rows) {
      if (!nativeRow || typeof nativeRow !== 'object' ||
          (columns ? !Array.isArray(nativeRow) || nativeRow.length !== columns.length : Array.isArray(nativeRow))) fail();
      const row = {...defaults, ...(columns ? Object.fromEntries(columns.map((key,index) => [key,nativeRow[index]])) : nativeRow)};
      restoredRows.push(row);
      if (
          (row.country != null && !codes.has(row.country)) ||
          (row.year == null && row.period == null && row.label == null)) fail();
      for (const key of keys) if (row[key] != null && (typeof row[key] !== 'number' || !Number.isFinite(row[key]))) fail();
    }
    for (const [code, ranges] of Object.entries(chart.missing_periods_by_country || {})) {
      if (!codes.has(code) || !Array.isArray(ranges)) fail();
      let previousEnd = -Infinity;
      for (const range of ranges) {
        if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.end < range.start ||
            range.end - range.start > 1000 || range.start <= previousEnd) fail();
        previousEnd = range.end;
      }
    }
    for (const [code, periods] of Object.entries(chart.missing_period_values_by_country || {})) {
      if (!codes.has(code) || !Array.isArray(periods) || periods.length > 1000 ||
          periods.some(period => typeof period !== 'string' || period.length > 100)) fail();
    }
    if (chart.status === 'ready' || chart.status === 'historical') {
      if (!TYPES.has(chart.chart_type) || !chart.fields.length || !chart.source_refs.length ||
          !restoredRows.some(row => [...keys].some(key => Number.isFinite(row[key])))) fail();
    }
  }
  return payload;
}

export class HumanDevelopmentStore {
  constructor({fetchImpl = globalThis.fetch, token, ttlMs = 60_000} = {}) {
    this.fetch = fetchImpl; this.token = token || this.metadataToken.bind(this); this.ttlMs = ttlMs;
  }
  async metadataToken() {
    const r = await this.fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: {'Metadata-Flavor': 'Google'}, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new HumanDevelopmentError(502, 'human_development_auth_failed');
    const p = await r.json();
    if (!p.access_token) throw new HumanDevelopmentError(502, 'human_development_auth_failed');
    return p.access_token;
  }
  async object(key, token, maxBytes = MAX_BYTES) {
    const r = await this.fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(key)}?alt=media`, {
      headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new HumanDevelopmentError(r.status === 404 ? 503 : 502, 'human_development_release_unavailable');
    if (Number(r.headers.get('content-length')) > maxBytes) throw new HumanDevelopmentError(502, 'human_development_object_too_large');
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length > maxBytes) throw new HumanDevelopmentError(502, 'human_development_object_too_large');
    return bytes;
  }
  async current() {
    if (this.cached && Date.now() - this.loadedAt < this.ttlMs) return this.cached;
    this.loading ||= (async () => {
      const token = await this.token();
      const p = JSON.parse((await this.object(POINTER, token, 16384)).toString('utf8'));
      if (p.schema_version !== '1.0.0' || p.bucket !== BUCKET || !UUID.test(p.release_id) ||
          p.object !== `static-assets/human-development/releases/${p.release_id}/reports.json` ||
          !/^[a-f0-9]{64}$/.test(p.sha256) || !Number.isSafeInteger(p.bytes) || p.bytes <= 0 || p.bytes > MAX_BYTES) {
        throw new HumanDevelopmentError(502, 'human_development_pointer_invalid');
      }
      const body = await this.object(p.object, token);
      if (body.length !== p.bytes || crypto.createHash('sha256').update(body).digest('hex') !== p.sha256) {
        throw new HumanDevelopmentError(502, 'human_development_checksum_failed');
      }
      this.cached = validateHumanDevelopment(JSON.parse(body.toString('utf8')), p.release_id);
      this.loadedAt = Date.now();
      return this.cached;
    })().catch(error => {
      if (error instanceof HumanDevelopmentError) throw error;
      throw new HumanDevelopmentError(502, 'human_development_unavailable');
    }).finally(() => { this.loading = null; });
    return this.loading;
  }
}
export const humanDevelopmentStore = new HumanDevelopmentStore();
