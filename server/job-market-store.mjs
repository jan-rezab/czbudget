import crypto from 'node:crypto';

const BUCKET = 'czbudget-janrezab-public-snapshots';
const POINTER = 'static-assets/job-market/current.json';
const RELEASE_PATH = /^static-assets\/job-market\/releases\/[a-f0-9-]{36}\/job-market-2024\.json$/;

export class JobMarketError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export class JobMarketStore {
  constructor({fetchImpl = globalThis.fetch, token, ttlMs = 60_000} = {}) {
    this.fetch = fetchImpl;
    this.token = token || this.metadataToken.bind(this);
    this.ttlMs = ttlMs;
  }

  async metadataToken() {
    const response = await this.fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: {'Metadata-Flavor': 'Google'}, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new JobMarketError(502, 'job_market_auth_failed');
    const payload = await response.json();
    if (!payload.access_token) throw new JobMarketError(502, 'job_market_auth_failed');
    return payload.access_token;
  }

  async object(key, token) {
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(key)}?alt=media`;
    const response = await this.fetch(url, {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw new JobMarketError(502, 'job_market_object_failed');
    return Buffer.from(await response.arrayBuffer());
  }

  async current() {
    if (this.cached && Date.now() - this.loadedAt < this.ttlMs) return this.cached;
    this.loading ||= (async () => {
      const token = await this.token();
      const pointer = JSON.parse((await this.object(POINTER, token)).toString('utf8'));
      if (pointer.schema_version !== '1.0.0' || pointer.bucket !== BUCKET ||
          !RELEASE_PATH.test(pointer.object) || !/^[a-f0-9]{64}$/.test(pointer.sha256) ||
          !Number.isSafeInteger(pointer.bytes) || pointer.bytes <= 0 || pointer.bytes > 2 * 1024 * 1024) {
        throw new JobMarketError(502, 'job_market_pointer_invalid');
      }
      const body = await this.object(pointer.object, token);
      if (body.length !== pointer.bytes || crypto.createHash('sha256').update(body).digest('hex') !== pointer.sha256) {
        throw new JobMarketError(502, 'job_market_checksum_failed');
      }
      const payload = JSON.parse(body.toString('utf8'));
      if (payload.schema_version !== '1.0.0' || Number(payload.period) !== 2024 ||
          payload.series?.service_divisions?.length !== 270 || payload.series?.ownership?.length !== 167 ||
          payload.series?.labour_status?.length !== 30 || payload.series?.national_public?.length !== 8 ||
          payload.series?.employment_shares?.length !== 18) {
        throw new JobMarketError(502, 'job_market_payload_invalid');
      }
      this.cached = {release_id: pointer.release_id, ...payload};
      this.loadedAt = Date.now();
      return this.cached;
    })().catch(error => {
      if (error instanceof JobMarketError) throw error;
      throw new JobMarketError(502, 'job_market_unavailable');
    }).finally(() => { this.loading = null; });
    return this.loading;
  }
}

export const jobMarketStore = new JobMarketStore();
