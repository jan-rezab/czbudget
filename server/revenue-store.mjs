import crypto from 'node:crypto';

const BUCKET = 'czbudget-janrezab-data-layers';
const POINTER = 'processing-runs/revenue-serving/current.json';
const RELEASE_PATH = /^processing-runs\/revenue-serving\/releases\/[a-f0-9-]{36}\/revenue\.json$/;

export class RevenueError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export class RevenueStore {
  constructor({fetchImpl = globalThis.fetch, token, ttlMs = 60_000} = {}) {
    this.fetch = fetchImpl;
    this.token = token || this.metadataToken.bind(this);
    this.ttlMs = ttlMs;
  }

  async metadataToken() {
    const response = await this.fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: {'Metadata-Flavor': 'Google'}, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new RevenueError(502, 'revenue_auth_failed');
    const payload = await response.json();
    if (!payload.access_token) throw new RevenueError(502, 'revenue_auth_failed');
    return payload.access_token;
  }

  async object(key, token, generation) {
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(key)}?alt=media${generation?`&generation=${encodeURIComponent(generation)}`:""}`;
    const response = await this.fetch(url, {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw new RevenueError(502, 'revenue_object_failed');
    return Buffer.from(await response.arrayBuffer());
  }

  async current() {
    if (this.cached && Date.now() - this.loadedAt < this.ttlMs) return this.cached;
    this.loading ||= (async () => {
      const token = await this.token();
      const pointer = JSON.parse((await this.object(POINTER, token)).toString('utf8'));
      if (pointer.schema_version !== '1.0.0' || pointer.bucket !== BUCKET ||
          !RELEASE_PATH.test(pointer.object) || !/^[a-f0-9]{64}$/.test(pointer.sha256) ||
          !/^\d+$/.test(pointer.generation||'') || !Number.isSafeInteger(pointer.country_count) || pointer.country_count<1 || !Number.isSafeInteger(pointer.bytes) || pointer.bytes <= 0 || pointer.bytes > 8 * 1024 * 1024) {
        throw new RevenueError(502, 'revenue_pointer_invalid');
      }
      const body = await this.object(pointer.object, token, pointer.generation);
      if (body.length !== pointer.bytes || crypto.createHash('sha256').update(body).digest('hex') !== pointer.sha256) {
        throw new RevenueError(502, 'revenue_checksum_failed');
      }
      const payload = JSON.parse(body.toString('utf8'));
      if (payload.schema_version !== '1.0.0' || payload.release_id !== pointer.release_id ||
          !payload.countries || !payload.availability?.countries || Object.keys(payload.countries).length !== pointer.country_count ||
          Object.keys(payload.countries).some(code=>payload.availability.countries[code]?.eligible !== true)) {
        throw new RevenueError(502, 'revenue_payload_invalid');
      }
      this.cached = {release_id: pointer.release_id, ...payload};
      this.loadedAt = Date.now();
      return this.cached;
    })().catch(error => {
      if (error instanceof RevenueError) throw error;
      throw new RevenueError(502, 'revenue_unavailable');
    }).finally(() => { this.loading = null; });
    return this.loading;
  }
}

export const revenueStore = new RevenueStore();
