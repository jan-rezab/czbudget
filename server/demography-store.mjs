import crypto from 'node:crypto';

const BUCKET = 'czbudget-janrezab-public-snapshots';
const POINTER = 'static-assets/worldwide-demography/current.json';
const RELEASE_PATH = /^static-assets\/worldwide-demography\/releases\/[a-f0-9-]{36}\/demography\.json$/;

export class DemographyError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export class DemographyStore {
  constructor({fetchImpl = globalThis.fetch, token, ttlMs = 60_000} = {}) {
    this.fetch = fetchImpl;
    this.token = token || this.metadataToken.bind(this);
    this.ttlMs = ttlMs;
  }

  async metadataToken() {
    const response = await this.fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: {'Metadata-Flavor': 'Google'}, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new DemographyError(502, 'demography_auth_failed');
    const payload = await response.json();
    if (!payload.access_token) throw new DemographyError(502, 'demography_auth_failed');
    return payload.access_token;
  }

  async object(key, token, generation) {
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(key)}?alt=media${generation ? `&generation=${generation}` : ''}`;
    const response = await this.fetch(url, {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw new DemographyError(502, 'demography_object_failed');
    return Buffer.from(await response.arrayBuffer());
  }

  async current() {
    if (this.cached && Date.now() - this.loadedAt < this.ttlMs) return this.cached;
    this.loading ||= (async () => {
      const token = await this.token();
      const pointer = JSON.parse((await this.object(POINTER, token)).toString('utf8'));
      if (pointer.release_id !== '7c4803a6-426e-4fb5-9e47-74b61117d29d' || pointer.warehouse_release_id !== '0b7239dd-8ca1-4ea8-93e6-a5c7632ed167' || pointer.schema_version !== '1.0.0' || pointer.bucket !== BUCKET ||
          !RELEASE_PATH.test(pointer.object) || !/^[a-f0-9]{64}$/.test(pointer.sha256) ||
          !/^\d+$/.test(pointer.generation || '') || !Number.isSafeInteger(pointer.bytes) || pointer.bytes <= 0 || pointer.bytes > 2 * 1024 * 1024) {
        throw new DemographyError(502, 'demography_pointer_invalid');
      }
      const body = await this.object(pointer.object, token, pointer.generation);
      if (body.length !== pointer.bytes || crypto.createHash('sha256').update(body).digest('hex') !== pointer.sha256) {
        throw new DemographyError(502, 'demography_checksum_failed');
      }
      const payload = JSON.parse(body.toString('utf8'));
      if (payload.schema_version !== 'worldwide-demography-story.v1' || payload.release_id !== pointer.release_id ||
          payload.warehouse_release_id !== pointer.warehouse_release_id || Object.keys(payload.countries || {}).length !== 217 ||
          payload.years?.length !== 65 || payload.years[0] !== 1960 || payload.years.at(-1) !== 2024 ||
          Object.values(payload.countries).some(country => country.fertility?.length !== 65 || country.birth_rate?.length !== 65)) {
        throw new DemographyError(502, 'demography_payload_invalid');
      }
      this.cached = {release_id: pointer.release_id, ...payload};
      this.loadedAt = Date.now();
      return this.cached;
    })().catch(error => {
      if (error instanceof DemographyError) throw error;
      throw new DemographyError(502, 'demography_unavailable');
    }).finally(() => { this.loading = null; });
    return this.loading;
  }
}

export const demographyStore = new DemographyStore();
