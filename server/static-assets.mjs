import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGunzip, gunzip as gunzipCallback} from 'node:zlib';
import {promisify} from 'node:util';

const gunzip = promisify(gunzipCallback);

// Data routes served from published static-asset packs rather than from the image.
// nginx.conf.template mirrors this pattern and stage-runtime.py leaves these paths out.
export const ASSET_PATH = /^\/data\/(?:(?:isred|industrial-intelligence|czech-nku|contracts|czech-project-geography|industry|paq|monitor-2026|dotaceeu|mv-administration-grants|mf-perimeter-history|france-municipal-profiles|municipal-benchmarks|countries|public-entities|economy|international-municipalities|czech-sfdi-tables|monitor-grants|registry\/source-provenance)\/|(?:trade\/automotive-monthly|municipal-budget-codebook|international-municipalities|municipal-snapshot|municipal-history-directory|cze-medicine-reimbursements|cze-school-funding-2026|czech-consolidated-accounts|czech-sfdi-financing|pensions-today|methodology-sources|eu-budget-flows|sovereign-benchmark-slim)\.v1\.json$)/;
export const PUBLIC_ENTITY_PATH = /^\/data\/(?:public-entity-directory\/(?:[A-Z]{3}|manifest)\.v1\.json|public-entity-(?:coverage|aggregates)\.v1\.json|cz-public-entities-2024\.json|cz-public-entity-history\.v1\.json)$/;
const MAX_FILE = 32 * 1024 * 1024;
const MAX_IN_FLIGHT_BYTES = 48 * 1024 * 1024;
const CACHE_BYTES = 16 * 1024 * 1024;
// Parsed JSON is several times its raw size in memory. Budget the raw bytes behind the
// parsed values and evict least-recently-used documents; never keep one above the limit.
const JSON_CACHE_RAW_BYTES = 48 * 1024 * 1024;
const JSON_MAX_CACHED_RAW = 32 * 1024 * 1024;

export class AssetError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export class StaticAssets {
  constructor({lockPath = process.env.DATA_ASSET_LOCK || (process.env.DATA_ASSET_LOCK_OBJECT ? null : new URL('./data-assets-lock.json', import.meta.url)),
    lockObject = process.env.DATA_ASSET_LOCK_OBJECT, lockTtlMs = 60_000,
    localRoot = process.env.DATA_ASSET_PACK_ROOT, fetchImpl = globalThis.fetch, manifest, tokenProvider, maxInFlightBytes} = {}) {
    this.configure({lockPath, lockObject, lockTtlMs, localRoot, fetchImpl, manifest, tokenProvider, maxInFlightBytes});
  }

  /** Point this store at another lock (test servers use local credentials). Clears every cache. */
  configure({lockPath = null, lockObject, lockTtlMs = 60_000, localRoot, fetchImpl = globalThis.fetch, manifest, tokenProvider, maxInFlightBytes = MAX_IN_FLIGHT_BYTES} = {}) {
    this.maxInFlightBytes = maxInFlightBytes;
    this.lockPath = lockPath;
    this.lockObject = lockObject;
    this.lockTtlMs = lockTtlMs;
    this.localRoot = localRoot;
    this.fetch = fetchImpl;
    this.manifest = manifest;
    this.tokenProvider = tokenProvider;
    this.cache = new Map();
    this.pending = new Map();
    this.cacheBytes = 0;
    this.inFlightBytes = 0;
    this.json = new Map();
    this.jsonPending = new Map();
    this.jsonBytes = 0;
    this.loading = null;
    this.remoteLock = null;
    this.lockFingerprint = null;
    this.localPacks = new Map();
    return this;
  }

  validateLock(lock) {
      if (lock.version !== 1 || lock.bucket !== 'czbudget-janrezab-public-snapshots') throw new Error('Invalid asset lock');
      for (const pack of Object.values(lock.packs)) {
        if (!/^[a-f0-9]{64}\.pack$/.test(pack.file) || pack.key !== `static-assets/v1/${pack.file}`
          || !Number.isSafeInteger(pack.size) || pack.size <= 0
          || (!this.localRoot && !/^\d+$/.test(pack.generation || ''))) throw new Error('Invalid pack descriptor');
      }
      // A data release may publish paths this build does not route yet. Skip them
      // rather than rejecting the whole lock, which would fail every asset route.
      const files = {};
      for (const [url, file] of Object.entries(lock.files)) {
        if (!(ASSET_PATH.test(url) || PUBLIC_ENTITY_PATH.test(url))) continue;
        files[url] = file;
        const pack = lock.packs[file.pack];
        if (url.split('/').some(p => p.startsWith('.')) || !pack
          || !Number.isSafeInteger(file.offset) || file.offset < 0
          || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE
          || file.offset + file.size > pack.size || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid asset descriptor');
        if (file.encoding && (file.encoding !== 'gzip' || !Number.isSafeInteger(file.raw_size)
          || file.raw_size <= 0 || file.raw_size > 128 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(file.raw_sha256))) throw new Error('Invalid compressed alias');
      }
      return {...lock, files};
  }

  async lock() {
    if (this.manifest) return this.validateLock(this.manifest);
    if (this.lockPath) {
      this.loading ||= fs.readFile(this.lockPath, 'utf8').then(raw => this.validateLock(JSON.parse(raw)));
      return this.loading;
    }
    if (!this.lockObject) throw new Error('No static asset lock configured');
    const now = Date.now();
    if (this.remoteLock && now - this.lockLoadedAt < this.lockTtlMs) return this.remoteLock;
    this.loading ||= (async () => {
      try {
        const token = await this.token();
        const response = await this.fetch(`https://storage.googleapis.com/storage/v1/b/czbudget-janrezab-public-snapshots/o/${encodeURIComponent(this.lockObject)}?alt=media`, {
          headers: {Authorization: `Bearer ${token}`, 'Accept-Encoding': 'identity'},
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new AssetError(502, 'asset_lock_failed');
        const raw = await response.text();
        const lock = this.validateLock(JSON.parse(raw));
        const fingerprint = crypto.createHash('sha256').update(raw).digest('hex');
        if (this.lockFingerprint && this.lockFingerprint !== fingerprint) {
          this.cache.clear();
          this.cacheBytes = 0;
          this.json.clear();
          this.jsonBytes = 0;
        }
        this.lockFingerprint = fingerprint;
        this.remoteLock = lock;
        this.lockLoadedAt = Date.now();
        return lock;
      } catch (error) {
        // Keep serving the last verified lock through a failed refresh; retry after the TTL.
        if (this.remoteLock) { this.lockLoadedAt = Date.now(); return this.remoteLock; }
        if (error instanceof AssetError) throw error;
        throw new AssetError(502, 'asset_lock_failed');
      }
    })().finally(() => { this.loading = null; });
    return this.loading;
  }

  async publishedEntityJSON(url) {
    if (!PUBLIC_ENTITY_PATH.test(url)) throw new AssetError(400, 'invalid_entity_asset_path');
    let lock;
    try { lock = await this.lock(); }
    catch (error) {
      // A local fixture needs no cloud configuration; remote failures fail closed.
      if (this.lockPath && error.code === 'ENOENT') return null;
      throw error;
    }
    const file = Object.hasOwn(lock.files, url) && lock.files[url];
    if (!file) return null; // Consumer code lands before the first data release.
    if (file.encoding) throw new AssetError(502, 'invalid_entity_asset_encoding');
    return JSON.parse((await this.body(url, file, lock)).toString('utf8'));
  }

  async token() {
    if (this.tokenProvider) return this.tokenProvider();
    if (this.accessToken?.expires > Date.now() + 60000) return this.accessToken.value;
    this.tokenLoading ||= (async () => {
      try {
        const response = await this.fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
          headers: {'Metadata-Flavor': 'Google'}, signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new AssetError(502, 'asset_auth_failed');
        const result = await response.json();
        if (!result.access_token) throw new AssetError(502, 'asset_auth_failed');
        this.accessToken = {value: result.access_token, expires: Date.now() + Number(result.expires_in || 300) * 1000};
        return result.access_token;
      } catch (error) {
        if (error instanceof AssetError) throw error;
        throw new AssetError(502, 'asset_auth_failed');
      }
    })().finally(() => { this.tokenLoading = null; });
    return this.tokenLoading;
  }

  async body(url, file, lock) {
    if (this.cache.has(url)) {
      const body = this.cache.get(url);
      this.cache.delete(url); this.cache.set(url, body);
      return body;
    }
    if (this.pending.has(url)) return this.pending.get(url);
    if (this.pending.size >= 32 || this.inFlightBytes + file.size > this.maxInFlightBytes) throw new AssetError(503, 'asset_capacity_exceeded');
    this.inFlightBytes += file.size;
    const operation = (async () => {
      const pack = lock.packs[file.pack];
      let body;
      if (!file.size) body = Buffer.alloc(0);
      else if (this.localRoot && await this.localPack(pack)) {
        const handle = await fs.open(path.join(this.localRoot, pack.file), 'r');
        try {
          body = Buffer.alloc(file.size);
          let offset = 0;
          while (offset < body.length) {
            const {bytesRead} = await handle.read(body, offset, body.length - offset, file.offset + offset);
            if (!bytesRead) throw new AssetError(502, 'asset_truncated');
            offset += bytesRead;
          }
        } finally { await handle.close(); }
      } else {
        // A hydrated pack root may hold only some packs (a local dry-run publication);
        // the others are read from the bucket, still pinned to their generation.
        if (!/^\d+$/.test(pack.generation || '')) throw new AssetError(502, 'asset_pack_missing');
        const token = await this.token();
        const response = await this.fetch(`https://storage.googleapis.com/storage/v1/b/${lock.bucket}/o/${encodeURIComponent(pack.key)}?alt=media&generation=${pack.generation}`, {
          headers: {Authorization: `Bearer ${token}`, Range: `bytes=${file.offset}-${file.offset + file.size - 1}`, 'Accept-Encoding': 'identity'},
          signal: AbortSignal.timeout(12000),
        });
        if (response.status !== 206 || response.headers.get('content-range') !== `bytes ${file.offset}-${file.offset + file.size - 1}/${pack.size}`) {
          await response.body?.cancel();
          throw new AssetError(502, 'asset_range_failed');
        }
        const parts = []; let total = 0;
        for await (const part of response.body) {
          total += part.length;
          if (total > file.size) throw new AssetError(502, 'asset_size_failed');
          parts.push(part);
        }
        body = Buffer.concat(parts, total);
      }
      if (body.length !== file.size || crypto.createHash('sha256').update(body).digest('hex') !== file.sha256) throw new AssetError(502, 'asset_checksum_failed');
      if (body.length <= CACHE_BYTES) {
        while (this.cacheBytes + body.length > CACHE_BYTES || this.cache.size >= 256) {
          const key = this.cache.keys().next().value;
          this.cacheBytes -= this.cache.get(key).length; this.cache.delete(key);
        }
        this.cache.set(url, body); this.cacheBytes += body.length;
      }
      return body;
    })().finally(() => { this.pending.delete(url); this.inFlightBytes -= file.size; });
    this.pending.set(url, operation);
    return operation;
  }

  async localPack(pack) {
    if (!this.localPacks.has(pack.file)) {
      this.localPacks.set(pack.file, fs.stat(path.join(this.localRoot, pack.file)).then(info => info.isFile() && info.size === pack.size, () => false));
    }
    return this.localPacks.get(pack.file);
  }

  /** The lock entry for a published URL, or null. */
  async entry(url) {
    const lock = await this.lock();
    return Object.hasOwn(lock.files, url) ? lock.files[url] : null;
  }

  /** Published URLs below a prefix such as /data/countries/. */
  async list(prefix) {
    const lock = await this.lock();
    return Object.keys(lock.files).filter(url => url.startsWith(prefix)).sort();
  }

  /** The exact committed bytes of a published file: gzip aliases are inflated and re-verified. */
  async readBuffer(url) {
    const lock = await this.lock();
    const file = Object.hasOwn(lock.files, url) && lock.files[url];
    if (!file) throw new AssetError(404, 'asset_not_found');
    const body = await this.body(url, file, lock);
    if (!file.encoding) return body;
    let raw;
    try { raw = await gunzip(body, {maxOutputLength: file.raw_size}); } catch { throw new AssetError(502, 'asset_checksum_failed'); }
    if (raw.length !== file.raw_size || crypto.createHash('sha256').update(raw).digest('hex') !== file.raw_sha256) throw new AssetError(502, 'asset_checksum_failed');
    return raw;
  }

  /**
   * Parsed JSON for server-side readers. Concurrent callers share one read; parsed values
   * are kept in a least-recently-used cache bounded by their raw size, so a data release
   * can never grow the API process without limit. Callers must not mutate the result.
   */
  async readJSON(url) {
    const file = await this.entry(url);
    if (!file) throw new AssetError(404, 'asset_not_found');
    const key = `${url}\0${file.raw_sha256 || file.sha256}`;
    if (this.json.has(key)) {
      const hit = this.json.get(key);
      this.json.delete(key); this.json.set(key, hit);
      return hit.value;
    }
    if (this.jsonPending.has(key)) return this.jsonPending.get(key);
    const operation = (async () => {
      const raw = await this.readBuffer(url);
      const value = JSON.parse(raw.toString('utf8'));
      if (raw.length <= JSON_MAX_CACHED_RAW) {
        while (this.json.size && this.jsonBytes + raw.length > JSON_CACHE_RAW_BYTES) {
          const [oldest, entry] = this.json.entries().next().value;
          this.jsonBytes -= entry.bytes; this.json.delete(oldest);
        }
        this.json.set(key, {value, bytes: raw.length}); this.jsonBytes += raw.length;
      }
      return value;
    })().finally(() => this.jsonPending.delete(key));
    this.jsonPending.set(key, operation);
    return operation;
  }

  async serve(request, response, pathname) {
    if (!['GET', 'HEAD'].includes(request.method)) throw new AssetError(405, 'method_not_allowed');
    const lock = await this.lock();
    let url;
    try { url = decodeURIComponent(pathname); } catch { throw new AssetError(400, 'invalid_asset_path'); }
    const file = Object.hasOwn(lock.files, url) && lock.files[url];
    if (!file) throw new AssetError(404, 'asset_not_found');
    const etag = `${file.encoding ? 'W/' : ''}"${file.sha256}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const validators = String(request.headers['if-none-match'] || '').split(',').map(value => value.trim().replace(/^W\//, ''));
    if (file.encoding) response.setHeader('Vary', 'Accept-Encoding');
    if (validators.includes(etag.replace(/^W\//, '')) || validators.includes('*')) { response.writeHead(304); response.end(); return; }
    // .gz URLs are downloadable gzip payloads. Do not set Content-Encoding:
    // browser clients explicitly decompress these files themselves.
    const types = {'.json': 'application/json; charset=utf-8', '.gz': 'application/gzip', '.xml': 'text/xml; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.md': 'text/plain; charset=utf-8'};
    const accepted = String(request.headers['accept-encoding'] || '').split(',').map(value => {
      const [name, ...parameters] = value.trim().toLowerCase().split(';');
      const q = parameters.find(p => p.trim().startsWith('q='));
      return {name, q: q ? Number(q.trim().slice(2)) : 1};
    });
    const gzip = file.encoding && (accepted.find(item => item.name === 'gzip') || accepted.find(item => item.name === '*'))?.q > 0;
    const body = request.method === 'HEAD' ? undefined : await this.body(url, file, lock);
    if (gzip) response.setHeader('Content-Encoding', 'gzip');
    response.writeHead(200, {'Content-Type': types[path.extname(url)] || 'application/octet-stream', 'Content-Length': file.encoding && !gzip ? file.raw_size : file.size});
    // Identity clients receive a backpressured stream, never a 90 MB JSON buffer.
    if (body && file.encoding && !gzip) { await pipeline(Readable.from([body]), createGunzip(), response); return; }
    response.end(body);
  }
}

export const staticAssets = new StaticAssets();

export async function warmStaticAssetLock(assetStore = staticAssets, onError = () => {}) {
  try {
    await assetStore.lock();
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
}
