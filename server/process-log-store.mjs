import fs from 'node:fs/promises';
import path from 'node:path';

const TIMEOUT_MS = 8_000;
const TTL_MS = 60_000;
const MAX_EVENTS = 200;

export class ProcessLogError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export class ProcessLogStore {
  constructor({base = process.env.PROCESS_LOG_BASE_URL || '', localRoot = process.env.PROCESS_LOG_RELEASE_ROOT || '', fetchImpl = globalThis.fetch} = {}) {
    this.base = base.replace(/\/+$/, '');
    this.localRoot = localRoot ? path.resolve(localRoot) : '';
    this.fetch = fetchImpl;
    this.cached = null;
    this.cachedAt = 0;
    this.dataCached = null;
    this.dataCachedAt = 0;
    this.accessToken = null;
  }

  get enabled() { return Boolean(this.base || this.localRoot); }

  async deployments() {
    if (!this.enabled) return {schema_version: '1.0.0', events: [], status: 'not_configured'};
    if (this.cached && Date.now() - this.cachedAt < TTL_MS) return this.cached;
    const events = this.localRoot ? await this.localEvents() : await this.cloudEvents();
    events.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    this.cached = {schema_version: '1.0.0', events: events.slice(0, MAX_EVENTS), status: 'available'};
    this.cachedAt = Date.now();
    return this.cached;
  }

  async dataRuns() {
    if (!this.enabled) return {schema_version: '1.0.0', events: [], status: 'not_configured'};
    if (this.dataCached && Date.now() - this.dataCachedAt < TTL_MS) return this.dataCached;
    const events = this.localRoot ? await this.localEvents('data-runs', this.validateDataRun) : await this.cloudEvents('data-runs', this.validateDataRun);
    events.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    this.dataCached = {schema_version: '1.0.0', events: events.slice(0, MAX_EVENTS), status: 'available'};
    this.dataCachedAt = Date.now();
    return this.dataCached;
  }

  validateDataRun(event) {
    const lifecycle = event?.lifecycle;
    if (event?.schema_version !== '1.0.0' || event.event_type !== 'data_run'
      || !/^data-run:[a-zA-Z0-9_-]+$/.test(event.event_id || '')
      || !/^\d{4}-\d\d-\d\dT/.test(event.timestamp || '') || !Number.isFinite(Date.parse(event.timestamp))
      || !event.cloud_build_id || event.event_id !== `data-run:${event.cloud_build_id}`
      || !event.source_id || !event.dataset
      || !['queued', 'working', 'completed', 'failed', 'cancelled'].includes(event.outcome)
      || !lifecycle || typeof lifecycle.processed !== 'boolean' || typeof lifecycle.published !== 'boolean'
      || !Array.isArray(event.sections) || !Array.isArray(event.source_urls)
      || event.sections.some((route) => typeof route !== 'string' || !/^\/(?!\/)[A-Za-z0-9/_?&=.-]*$/.test(route) || route.includes('..'))
      || event.source_urls.some((url) => typeof url !== 'string' || !/^https:\/\/[^\s]+$/.test(url))
      || (lifecycle.published && (!lifecycle.processed || event.outcome !== 'completed' || !event.sections.length))
      || (event.git_sha != null && !/^[a-f0-9]{40}$/.test(event.git_sha))) {
      throw new ProcessLogError(502, 'invalid_data_run_event', 'A data-run receipt failed its public contract.');
    }
    return event;
  }

  validate(event) {
    if (event?.schema_version !== '1.0.0' || event.event_type !== 'deployment'
      || !/^deployment:.+/.test(event.event_id || '') || !['deployed', 'skipped'].includes(event.outcome)
      || !/^[a-f0-9]{40}$/.test(event.git_sha || '') || !event.cloud_build_id
      || !/^sha256:[a-f0-9]{64}$/.test(event.image_digest || '') || !Array.isArray(event.data_release_ids)) {
      throw new ProcessLogError(502, 'invalid_process_log_event', 'A deployment receipt failed its public contract.');
    }
    return event;
  }

  async localEvents(kind = 'deployments', validate = this.validate) {
    const directory = path.join(this.localRoot, kind);
    const names = await fs.readdir(directory).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
    return Promise.all(names.filter((name) => name.endsWith('.json')).map(async (name) =>
      validate.call(this, JSON.parse(await fs.readFile(path.join(directory, name), 'utf8')))));
  }

  async cloudEvents(kind = 'deployments', validate = this.validate) {
    if (!this.base.startsWith('gs://')) throw new ProcessLogError(500, 'invalid_process_log_base', 'Process log storage must use gs://.');
    const {bucket, prefix} = this.location();
    const token = await this.token();
    const items = [];
    let pageToken = '';
    for (let page = 0; page < 10; page += 1) {
      const tokenQuery = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const listUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?prefix=${encodeURIComponent(`${prefix}${kind}/`)}&fields=items(name,updated),nextPageToken&maxResults=1000${tokenQuery}`;
      const listing = await this.request(listUrl, token);
      items.push(...(listing.items || []));
      pageToken = listing.nextPageToken || '';
      if (!pageToken) break;
    }
    const names = items.filter((item) => item.name.endsWith('.json'))
      .sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, MAX_EVENTS).map((item) => item.name);
    return Promise.all(names.map(async (name) => {
      const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`;
      return validate.call(this, await this.request(url, token));
    }));
  }

  location() {
    const raw = this.base.slice(5);
    const slash = raw.indexOf('/');
    return {bucket: slash < 0 ? raw : raw.slice(0, slash), prefix: slash < 0 ? '' : `${raw.slice(slash + 1).replace(/\/+$/, '')}/`};
  }

  async request(url, token) {
    const response = await this.fetch(url, {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(TIMEOUT_MS)});
    if (!response.ok) throw new ProcessLogError(502, 'process_log_fetch_failed', `Process log storage returned HTTP ${response.status}.`);
    return response.json();
  }

  async token() {
    if (this.accessToken?.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const response = await this.fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: {'Metadata-Flavor': 'Google'}, signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new ProcessLogError(502, 'process_log_auth_failed', 'Could not authenticate to process log storage.');
    const payload = await response.json();
    this.accessToken = {value: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 300) * 1000};
    return this.accessToken.value;
  }
}

export const processLogStore = new ProcessLogStore();
