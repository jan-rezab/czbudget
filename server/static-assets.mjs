import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';

export const ASSET_PATH = /^\/data\/(?:(?:isred|industrial-intelligence|czech-nku|contracts|czech-project-geography|industry|paq)\/|trade\/automotive-monthly\.v1\.json$|municipal-budget-codebook\.v1\.json$)/;
const MAX_FILE = 32 * 1024 * 1024;
const MAX_IN_FLIGHT_BYTES = 48 * 1024 * 1024;
const CACHE_BYTES = 16 * 1024 * 1024;

export class AssetError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export class StaticAssets {
  constructor({lockPath = process.env.DATA_ASSET_LOCK || (process.env.DATA_ASSET_LOCK_OBJECT ? null : new URL('./data-assets-lock.json', import.meta.url)),
    lockObject = process.env.DATA_ASSET_LOCK_OBJECT, lockTtlMs = 60_000,
    localRoot = process.env.DATA_ASSET_PACK_ROOT, fetchImpl = globalThis.fetch, manifest} = {}) {
    this.lockPath = lockPath;
    this.lockObject = lockObject;
    this.lockTtlMs = lockTtlMs;
    this.localRoot = localRoot;
    this.fetch = fetchImpl;
    this.manifest = manifest;
    this.cache = new Map();
    this.pending = new Map();
    this.cacheBytes = 0;
    this.inFlightBytes = 0;
  }

  validateLock(lock) {
      if (lock.version !== 1 || lock.bucket !== 'czbudget-janrezab-public-snapshots') throw new Error('Invalid asset lock');
      for (const pack of Object.values(lock.packs)) {
        if (!/^[a-f0-9]{64}\.pack$/.test(pack.file) || pack.key !== `static-assets/v1/${pack.file}`
          || !Number.isSafeInteger(pack.size) || pack.size <= 0
          || (!this.localRoot && !/^\d+$/.test(pack.generation || ''))) throw new Error('Invalid pack descriptor');
      }
      for (const [url, file] of Object.entries(lock.files)) {
        const pack = lock.packs[file.pack];
        if (!ASSET_PATH.test(url) || url.split('/').some(p => p.startsWith('.')) || !pack
          || !Number.isSafeInteger(file.offset) || file.offset < 0
          || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE
          || file.offset + file.size > pack.size || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid asset descriptor');
        if (file.encoding && (file.encoding !== 'gzip' || !Number.isSafeInteger(file.raw_size)
          || file.raw_size <= 0 || file.raw_size > 128 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(file.raw_sha256))) throw new Error('Invalid compressed alias');
      }
      return lock;
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
        }
        this.lockFingerprint = fingerprint;
        this.remoteLock = lock;
        this.lockLoadedAt = Date.now();
        return lock;
      } catch (error) {
        if (error instanceof AssetError) throw error;
        throw new AssetError(502, 'asset_lock_failed');
      }
    })().finally(() => { this.loading = null; });
    return this.loading;
  }

  async token() {
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
    if (this.pending.size >= 32 || this.inFlightBytes + file.size > MAX_IN_FLIGHT_BYTES) throw new AssetError(503, 'asset_capacity_exceeded');
    this.inFlightBytes += file.size;
    const operation = (async () => {
      const pack = lock.packs[file.pack];
      let body;
      if (!file.size) body = Buffer.alloc(0);
      else if (this.localRoot) {
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
