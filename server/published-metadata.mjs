import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {AssetError, staticAssets} from './static-assets.mjs';
import {METADATA_PATHS, isMetadataPath} from './metadata-paths.mjs';

const MAX_RELEASE_BYTES = 32 * 1024 * 1024;
const digest = (body) => crypto.createHash('sha256').update(body).digest('hex');
const nonEmptyText = (value) => typeof value === 'string' && value.trim().length > 0;
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id);

/** A complete group is verified before any member replaces the previous group. */
export class PublishedMetadataStore {
  constructor({assets = staticAssets, root = process.env.SITE_ROOT || '/usr/share/nginx/html',
    now = Date.now, ttlMs = 60_000, onError = () => {}} = {}) {
    this.assets = assets;
    this.root = root;
    this.now = now;
    this.ttlMs = ttlMs;
    this.onError = onError;
    this.checkedAt = -Infinity;
    this.snapshot = null;
    this.fallbackJSON = new Map();
  }

  async current() {
    if (this.now() - this.checkedAt < this.ttlMs) return this.snapshot;
    this.loading ||= (async () => {
      try {
        const lock = await this.assets.lock();
        const release = lock.metadata_release;
        // The consumer is deployed first. Absence never replaces a verified group.
        if (!release) return this.snapshot;
        if (release.schema_version !== 'public-metadata-release.v1' || !validId(release.release_id) ||
            !Number.isFinite(Date.parse(release.verified_at)) || !lock.packs[release.pack] ||
            !Array.isArray(release.paths) || release.paths.length !== METADATA_PATHS.length ||
            new Set(release.paths).size !== METADATA_PATHS.length ||
            !release.paths.every(isMetadataPath)) throw new Error('metadata_release_invalid');
        const entries = METADATA_PATHS.map(url => [url, lock.files[url]]);
        let bytes = 0;
        for (const [, file] of entries) {
          if (!file || file.pack !== release.pack || file.encoding || !Number.isSafeInteger(file.size) || file.size <= 0)
            throw new Error('metadata_release_incomplete');
          bytes += file.size;
        }
        if (bytes > MAX_RELEASE_BYTES) throw new Error('metadata_release_too_large');
        const fingerprint = digest(JSON.stringify([release, lock.packs[release.pack], entries]));
        if (this.snapshot?.fingerprint === fingerprint) return this.snapshot;
        const bodies = new Map();
        // Sequential reads bound peak memory. The hash in the key isolates in-flight
        // reads from earlier locks; an old request cannot poison a new release cache.
        for (const [url, file] of entries) {
          const body = await this.assets.body(`${url}\0${file.sha256}`, file, lock);
          if (body.length !== file.size || digest(body) !== file.sha256) throw new Error('metadata_checksum_failed');
          if (url.endsWith('.json')) JSON.parse(body.toString('utf8'));
          else if (!/<urlset(?:\s|>)/.test(body.toString('utf8')) || !body.toString('utf8').includes('</urlset>'))
            throw new Error('metadata_sitemap_invalid');
          bodies.set(url, {body, sha256: file.sha256, releaseId: release.release_id});
        }
        const qa = JSON.parse(bodies.get('/data/data-quality-report.v1.json').body);
        const manifest = JSON.parse(bodies.get('/data/release-manifest.v1.json').body);
        if (qa.release_id !== release.release_id || manifest.release_id !== release.release_id ||
            qa.verified_at !== release.verified_at || qa.build_mode !== 'published-release-audit' ||
            qa.status !== 'passed' || !nonEmptyText(qa.verification_scope?.cs) || !nonEmptyText(qa.verification_scope?.en) ||
            !Array.isArray(qa.published_releases) || qa.published_releases.length === 0 ||
            !qa.published_releases.every(item => item && nonEmptyText(item.dataset) && nonEmptyText(item.release_id)) ||
            !Array.isArray(manifest.artifacts)) throw new Error('metadata_provenance_invalid');
        for (const [url, file] of entries) {
          if (url === '/data/release-manifest.v1.json') continue; // No circular self-hash.
          const matches = manifest.artifacts.filter(item => item.path === url.slice(1));
          if (matches.length !== 1 || matches[0].sha256 !== file.sha256 || matches[0].bytes !== file.size)
            throw new Error('metadata_manifest_mismatch');
        }
        this.snapshot = {fingerprint, bodies, json: new Map(), releaseId: release.release_id};
        this.fallbackJSON.clear();
        return this.snapshot;
      } catch (error) {
        this.onError(error);
        return this.snapshot;
      } finally {
        this.checkedAt = this.now();
      }
    })().finally(() => { this.loading = null; });
    return this.loading;
  }

  async entry(url) {
    if (!isMetadataPath(url)) throw new AssetError(404, 'metadata_not_found');
    const snapshot = await this.current();
    if (snapshot) return snapshot.bodies.get(url);
    try {
      const body = await fs.readFile(path.join(this.root, url.slice(1)));
      if (body.length > MAX_RELEASE_BYTES) throw new AssetError(502, 'metadata_fallback_too_large');
      return {body, sha256: digest(body), releaseId: null};
    } catch (error) {
      if (error.code === 'ENOENT') throw new AssetError(404, 'metadata_not_found');
      throw error;
    }
  }

  async readJSON(url, {useCache = true} = {}) {
    if (!isMetadataPath(url) || !url.endsWith('.json')) throw new AssetError(404, 'metadata_not_found');
    const snapshot = await this.current();
    const cache = snapshot ? snapshot.json : this.fallbackJSON;
    if (useCache && cache.has(url)) return cache.get(url);
    const entry = snapshot ? snapshot.bodies.get(url) : await this.entry(url);
    const value = JSON.parse(entry.body.toString('utf8'));
    if (useCache) cache.set(url, value);
    return value;
  }

  async serve(request, response, url) {
    if (!['GET', 'HEAD'].includes(request.method)) throw new AssetError(405, 'method_not_allowed');
    const entry = await this.entry(url);
    const etag = `"${entry.sha256}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (entry.releaseId) response.setHeader('X-Data-Release', entry.releaseId);
    const matches = String(request.headers['if-none-match'] || '').split(',').map(value => value.trim().replace(/^W\//, ''));
    if (matches.includes(etag) || matches.includes('*')) { response.writeHead(304); response.end(); return; }
    response.writeHead(200, {'Content-Type': url.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'application/json; charset=utf-8', 'Content-Length': entry.body.length});
    response.end(request.method === 'HEAD' ? undefined : entry.body);
  }
}

export const publishedMetadataStore = new PublishedMetadataStore({
  onError: error => console.warn('Published metadata refresh retained previous release:', error.code || error.message),
});
