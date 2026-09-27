import crypto from 'node:crypto';
import { metadataToken } from './france-municipal-lines.mjs';

const BUCKET = 'czbudget-janrezab-public-snapshots';
const POINTER = 'static-assets/energy-trade-periods/current.json';
const RELEASE = /^static-assets\/energy-trade-periods\/releases\/([a-f0-9-]{36})\/periods.json$/;
const LIMIT = 2 * 1024 * 1024;

export class EnergyPeriodsSnapshot {
  constructor({fetchImpl = globalThis.fetch, tokenProvider, now = () => Date.now()} = {}) {
    this.fetch = fetchImpl;
    this.token = tokenProvider || (() => metadataToken(fetchImpl));
    this.now = now;
    this.checkedAt = -Infinity;
  }

  async object(key, token, optional = false) {
    const response = await this.fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(key)}?alt=media`, {
      headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(8000),
    });
    if (optional && response.status === 404) return null;
    if (!response.ok) throw new Error('energy_snapshot_object_failed');
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > LIMIT) throw new Error('energy_snapshot_oversized');
    return body;
  }

  async current() {
    if (this.now() - this.checkedAt < 60_000) return this.cached || null;
    this.loading ||= this.load().finally(() => {this.loading = null;});
    return this.loading;
  }

  async load() {
    try {
      const token = await this.token();
      const document = await this.object(POINTER, token, true);
      if (!document) {
        this.checkedAt = this.now();
        return this.cached || null;
      }
      const pointer = JSON.parse(document);
      const match = RELEASE.exec(pointer.object || '');
      if (pointer.schema_version !== '1.0.0' || pointer.bucket !== BUCKET || !match ||
          match[1] !== pointer.release_id || !/^[a-f0-9]{64}$/.test(pointer.sha256) ||
          !Number.isSafeInteger(pointer.bytes) || pointer.bytes <= 0 || pointer.bytes > LIMIT) {
        throw new Error('energy_snapshot_pointer_invalid');
      }
      if (this.releaseId === pointer.release_id) {
        this.checkedAt = this.now();
        return this.cached;
      }
      const body = await this.object(pointer.object, token);
      if (body.length !== pointer.bytes || crypto.createHash('sha256').update(body).digest('hex') !== pointer.sha256) {
        throw new Error('energy_snapshot_checksum_failed');
      }
      const payload = JSON.parse(body);
      if (payload.schema_version !== 'energy-trade-periods.v1' || payload.release_id !== pointer.release_id ||
          !Array.isArray(payload.products) || payload.products.length !== 3 ||
          !payload.snapshot_as_of || !Number.isFinite(Date.parse(payload.snapshot_as_of))) throw new Error('energy_snapshot_payload_invalid');
      const expected = {petroleum:'270900', lng:'271111', gas:'271121'};
      const ids = new Set();
      for (const product of payload.products) {
        if (expected[product.id] !== product.code || ids.has(product.id) || !Array.isArray(product.periods) || product.periods.length > 2048) throw new Error('energy_snapshot_product_invalid');
        ids.add(product.id);
        const periods = new Set();
        for (const row of product.periods) {
          const key = `${row.frequency}:${row.period}`;
          const pattern = row.frequency === 'A' ? /^\d{4}$/ : row.frequency === 'M' ? /^\d{4}(0[1-9]|1[0-2])$/ : null;
          if (!pattern?.test(row.period) || periods.has(key) || !Number.isFinite(Date.parse(row.period_start)) ||
              !Number.isSafeInteger(row.reporting_markets) || row.reporting_markets <= 0 ||
              !Number.isSafeInteger(row.reported_origins) || row.reported_origins <= 0 ||
              !Number.isFinite(row.observed_value_usd) ||
              (row.observed_net_weight_kg !== null && !Number.isFinite(row.observed_net_weight_kg))) throw new Error('energy_snapshot_period_invalid');
          periods.add(key);
        }
      }
      this.cached = payload;
      this.releaseId = pointer.release_id;
      this.checkedAt = this.now();
      return payload;
    } catch (error) {
      // Keep the previous verified release while a new pointer is unavailable
      // or invalid. Never turn corruption into an expensive warehouse fallback.
      if (this.cached) {this.checkedAt = this.now(); return this.cached;}
      throw error;
    }
  }
}
