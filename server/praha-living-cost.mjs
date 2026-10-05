import crypto from 'node:crypto';
import { metadataToken } from './france-municipal-lines.mjs';

const BUCKET = 'czbudget-janrezab-public-snapshots';
const PREFIX = 'static-assets/praha-living-cost/';
const MAX = 2 * 1024 * 1024;
export class PrahaLivingCostError extends Error {
  constructor(code) { super(code); this.status = 503; this.code = code; }
}
const fail = () => { throw new PrahaLivingCostError('prague_living_cost_unavailable'); };
export class PrahaLivingCostStore {
  constructor({ fetchImpl = globalThis.fetch, tokenProvider } = {}) {
    this.fetch = fetchImpl; this.token = tokenProvider || (() => metadataToken(this.fetch));
  }
  async object(key, token, asset) {
    if (!key.startsWith(PREFIX)) fail();
    const response = await this.fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(key)}?alt=media${asset ? '&generation=' + asset.generation : ''}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
    if (response.status === 404 && !asset) return null;
    if (!response.ok || Number(response.headers?.get('content-length')) > MAX) fail();
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > MAX || (asset && (body.length !== asset.bytes || crypto.createHash('sha256').update(body).digest('hex') !== asset.sha256))) fail();
    return body;
  }
  async current() {
    if (this.cached && Date.now() - this.loadedAt < 60000) return this.cached;
    this.loading ||= (async () => {
      const token = await this.token(), raw = await this.object(PREFIX + 'current.json', token);
      if (!raw) return { status: 'not_published', year: 2025, municipality_ico: '00064581' };
      const p = JSON.parse(raw), a = p.report;
      if (p.schema_version !== '1.0.0' || p.bucket !== BUCKET || p.validated !== true || !/^[a-f0-9-]{36}$/.test(p.release_id) || !a || a.object !== PREFIX + 'releases/' + p.release_id + '/report.json' || !/^\d+$/.test(a.generation) || !Number.isSafeInteger(a.bytes) || a.bytes < 1 || a.bytes > MAX || !/^[a-f0-9]{64}$/.test(a.sha256)) fail();
      const report = JSON.parse(await this.object(a.object, token, a));
      if (report.schema_version !== '1.0.0' || report.release_id !== p.release_id || report.municipality_ico !== '00064581' || report.validation?.passed !== true || !Array.isArray(report.sources) || !Array.isArray(report.observations) || !report.observations.length || report.observations.some(o => o.metric !== 'average_monthly_housing_cost' || o.year !== 2025 || o.currency !== 'CZK' || o.denominator !== 'household' || o.frequency !== 'month' || o.geography !== 'Prague' || typeof o.amount_exact !== 'string' || !/^\d+(\.\d+)?$/.test(o.amount_exact) || !report.sources.some(s => s.id === o.source_id && s.url === 'https://csu.gov.cz/pha/zivotni-podminky-prazskych-domacnosti-v-roce-2025' && /^[a-f0-9]{64}$/.test(s.sha256)))) fail();
      this.cached = { ...report, status: 'available' }; this.loadedAt = Date.now(); return this.cached;
    })().catch(error => { if (error instanceof PrahaLivingCostError) throw error; fail(); }).finally(() => { this.loading = null; });
    return this.loading;
  }
}
export const prahaLivingCostStore = new PrahaLivingCostStore();
