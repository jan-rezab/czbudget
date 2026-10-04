import {RussiaSuppliersSnapshot} from './russia-suppliers-snapshot.mjs';
import {shareInFlight} from './in-flight.mjs';

const PREFIX = 'static-assets/trade-services/';
const BUCKET = 'czbudget-janrezab-public-snapshots';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const COUNTRY = /^[A-Z]{3}$/;

// A separate pointer keeps service reports independent of the goods release.
// Missing or corrupt snapshots never initiate a visitor-triggered BQ query.
export class ServicesSnapshots extends RussiaSuppliersSnapshot {
  validateServiceRef(ref, object) {
    if (ref?.object !== object || !/^[a-f0-9]{64}$/.test(ref.sha256 || '') ||
      !/^[1-9][0-9]*$/.test(ref.generation || '') ||
      !Number.isSafeInteger(ref.bytes) || ref.bytes < 1 || ref.bytes > 8 * 1024 * 1024)
      throw Error('services_reference_invalid');
  }
  async current() {
    if (this.now() - this.checkedAt < 60_000) return this.manifest || null;
    return shareInFlight(this.pending, 'services-manifest', async () => {
      try {
        const token = await this.token();
        const body = await this.object(PREFIX + 'current.json', token, 4096, null, true);
        if (!body) {this.checkedAt = this.now(); return this.manifest || null;}
        const pointer = JSON.parse(body);
        if (pointer.schema_version !== '1.0.0' || pointer.bucket !== BUCKET || !UUID.test(pointer.release_id || ''))
          throw Error('services_pointer_invalid');
        this.validateServiceRef(pointer, `${PREFIX}releases/${pointer.release_id}/manifest.json`);
        if (this.manifestRef?.sha256 === pointer.sha256) {this.checkedAt = this.now(); return this.manifest;}
        const manifest = await this.verified(pointer, token, 8 * 1024 * 1024);
        if (manifest.schema_version !== 'trade-services.v1' || manifest.release_id !== pointer.release_id ||
          !Number.isFinite(Date.parse(manifest.snapshot_as_of)) || !manifest.countries ||
          Object.keys(manifest.countries).length > 300)
          throw Error('services_manifest_invalid');
        for (const [country, ref] of Object.entries(manifest.countries)) {
          if (!COUNTRY.test(country)) throw Error('services_country_invalid');
          this.validateServiceRef(ref, `${PREFIX}releases/${pointer.release_id}/${country}.json`);
          if (!Number.isSafeInteger(ref.rows) || ref.rows < 0 || ref.rows > 3000) throw Error('services_count_invalid');
        }
        this.rowsCache.clear(); this.manifest = manifest; this.manifestRef = pointer; this.checkedAt = this.now();
        return manifest;
      } catch (error) {
        if (this.manifest) {this.checkedAt = this.now(); return this.manifest;}
        throw error;
      }
    });
  }
  async rows(country) {
    if (!COUNTRY.test(country)) throw Error('services_country_invalid');
    const manifest = await this.current();
    const ref = manifest?.countries[country];
    if (!ref) return [];
    const key = `${manifest.release_id}:${country}`;
    if (this.rowsCache.has(key)) return this.rowsCache.get(key);
    return shareInFlight(this.pending, key, async () => {
      const payload = await this.verified(ref, await this.token(), 8 * 1024 * 1024);
      if (payload.schema_version !== 'trade-services.rows.v1' || payload.release_id !== manifest.release_id ||
        payload.country !== country || !Array.isArray(payload.rows) || payload.rows.length !== ref.rows)
        throw Error('services_payload_invalid');
      this.rowsCache.set(key, payload.rows);
      while (this.rowsCache.size > 12) this.rowsCache.delete(this.rowsCache.keys().next().value);
      return payload.rows;
    });
  }
}
