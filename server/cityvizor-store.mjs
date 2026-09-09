import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const POINTER_TTL_MS = setting("CITYVIZOR_POINTER_TTL_MS", 60_000);
const PROFILE_CACHE_SIZE = setting("CITYVIZOR_PROFILE_CACHE_SIZE", 24);
const SHARD_CACHE_SIZE = setting("CITYVIZOR_SHARD_CACHE_SIZE", 48);
const FETCH_TIMEOUT_MS = setting("CITYVIZOR_FETCH_TIMEOUT_MS", 8_000);
const LAYERS = new Set(["accounting", "events", "payments", "plans", "pbo_payment_source_rows"]);

export class CityVizorError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class CityVizorStore {
  constructor({
    base = process.env.CITYVIZOR_SNAPSHOT_BASE_URL,
    localRoot = process.env.CITYVIZOR_SNAPSHOT_RELEASE_ROOT,
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.base = base ? String(base).replace(/\/+$/, "") : "";
    this.localRoot = localRoot ? path.resolve(localRoot) : "";
    this.fetchImpl = fetchImpl;
    this.pointer = null;
    this.indexDocument = null;
    this.profileMap = new Map();
    this.pointerLoadedAt = 0;
    this.profileCache = new Map();
    this.shardCache = new Map();
    this.accessToken = null;
  }

  get enabled() {
    return Boolean(this.base || this.localRoot);
  }

  async index() {
    await this.refresh();
    return { payload: this.indexDocument, etag: this.pointer.index_content_sha256 || sha256(JSON.stringify(this.indexDocument)) };
  }

  async codelists() {
    await this.refresh();
    const descriptor = this.indexDocument.codelist_asset;
    if (!descriptor?.file) throw new CityVizorError(404, "cityvizor_codelists_not_found", "CityVizor codelists are absent from this release.");
    return { payload: await this.readAsset({ ...descriptor, path: descriptor.file }), etag: descriptor.content_sha256 };
  }

  async municipality(icoValue) {
    await this.refresh();
    const ico = canonicalIco(icoValue);
    const municipalityProfiles = this.indexDocument.profiles.filter((profile) => profile.type === "municipality" && profile.ico === ico);
    const parentKeys = new Set(municipalityProfiles.map((profile) => profile.key));
    const organizations = this.indexDocument.profiles.filter((profile) => parentKeys.has(profile.parent_profile_key));
    const payload = {
      schema_version: "1.0.0",
      dataset_id: "cityvizor-municipality-integration",
      release_id: this.pointer.release_id,
      municipality_ico: ico,
      status: municipalityProfiles.length ? "available" : "not_published",
      matched: municipalityProfiles.length > 0,
      definitions: {
        relationship: "Municipality profiles are matched by exact eight-digit IČO. Organizations are included only when CityVizor publishes their parent_profile_key against a matched municipality profile.",
        coverage: "CityVizor publication is voluntary. Absence here does not mean that the municipality has no accounting records or invoices.",
        non_additive: "CityVizor invoice-view, accounting, event and plan layers overlap each other and the national municipal accounts. Their totals must not be added.",
      },
      municipality_profiles: municipalityProfiles.map(publicProfileDescriptor),
      organizations: organizations.map(publicProfileDescriptor),
    };
    return { payload, etag: sha256(JSON.stringify(payload)) };
  }

  async profile(profileKey, yearValue) {
    await this.refresh();
    const descriptor = this.profileDescriptor(profileKey);
    const year = requiredYear(yearValue, descriptor.available_years);
    const document = await this.readProfile(descriptor);
    let selected = document.years?.find((entry) => entry.year === year);
    if (!selected) throw new CityVizorError(404, "cityvizor_year_not_found", "The selected profile does not publish this year.");
    if (selected.year_summary_asset) selected = await this.readAsset(selected.year_summary_asset);
    return {
      payload: {
        schema_version: document.schema_version,
        release_id: this.pointer.release_id,
        profile: document.profile,
        contracts: document.contracts,
        noticeboard: document.noticeboard,
        years: [selected],
      },
      etag: `${descriptor.profile_asset.content_sha256}-${year}`,
    };
  }

  async shard(profileKey, yearValue, layerValue, partValue) {
    await this.refresh();
    const descriptor = this.profileDescriptor(profileKey);
    const year = requiredYear(yearValue, descriptor.available_years);
    const layer = String(layerValue || "");
    if (!LAYERS.has(layer)) throw new CityVizorError(400, "invalid_cityvizor_layer", "Unknown CityVizor detail layer.");
    const part = Number(partValue);
    if (!Number.isInteger(part) || part < 1 || part > 100) throw new CityVizorError(400, "invalid_cityvizor_part", "Part must be an integer from 1 to 100.");

    const profile = await this.readProfile(descriptor);
    let selected = profile.years?.find((entry) => entry.year === year);
    if (!selected) throw new CityVizorError(404, "cityvizor_year_not_found", "The selected profile does not publish this year.");
    if (selected.year_summary_asset) selected = await this.readAsset(selected.year_summary_asset);
    const assets = layer === "pbo_payment_source_rows"
      ? selected.alternate_pbo_payment_source_view?.assets
      : selected.assets?.[layer];
    if (!Array.isArray(assets)) throw new CityVizorError(404, "cityvizor_layer_not_found", "This detail layer is not published for the selected profile and year.");
    const asset = assets[part - 1];
    if (!asset) throw new CityVizorError(404, "cityvizor_part_not_found", "This detail part does not exist.");

    const cacheKey = `${this.pointer.release_id}:${asset.path}`;
    let payload = this.shardCache.get(cacheKey);
    if (payload) touch(this.shardCache, cacheKey, payload);
    else {
      payload = await this.readAsset(asset);
      const expectedKind = layer === "pbo_payment_source_rows" ? "pbo-payment-source" : layer;
      if (payload.profile_key !== descriptor.key || payload.year !== year || payload.kind !== expectedKind || !Array.isArray(payload.rows)) {
        throw new CityVizorError(502, "cityvizor_asset_contract_mismatch", "The detail object does not match its profile, year and layer descriptor.");
      }
      if (payload.rows.length !== asset.rows) throw new CityVizorError(502, "cityvizor_asset_count_mismatch", "The detail object row count does not match its descriptor.");
      remember(this.shardCache, cacheKey, payload, SHARD_CACHE_SIZE);
    }
    return { payload, etag: asset.content_sha256 };
  }

  async status() {
    if (!this.enabled) return { enabled: false };
    try {
      await this.refresh();
      return {
        enabled: true,
        release_id: this.pointer.release_id,
        profile_count: this.indexDocument.profile_count,
        record_counts: this.indexDocument.record_counts,
      };
    } catch (error) {
      return { enabled: true, error: error.code || "cityvizor_snapshot_unavailable" };
    }
  }

  profileDescriptor(value) {
    const key = canonicalProfileKey(value);
    const descriptor = this.profileMap.get(key);
    if (!descriptor) throw new CityVizorError(404, "cityvizor_profile_not_found", "CityVizor profile does not exist in the current release.");
    return descriptor;
  }

  async refresh(force = false) {
    if (!this.enabled) throw new CityVizorError(503, "cityvizor_store_disabled", "The CityVizor data store is not configured.");
    const now = Date.now();
    if (!force && this.pointer && now - this.pointerLoadedAt < POINTER_TTL_MS) return;
    const pointer = JSON.parse((await this.readObject("current.json")).toString("utf8"));
    if (!pointer.release_id || !pointer.index) throw new CityVizorError(502, "invalid_cityvizor_pointer", "The active CityVizor pointer is incomplete.");
    if (!this.pointer || pointer.release_id !== this.pointer.release_id || pointer.index !== this.pointer.index) {
      const raw = await this.readObject(pointer.index);
      if (pointer.index_sha256 && sha256(raw) !== pointer.index_sha256) throw new CityVizorError(502, "cityvizor_index_hash_mismatch", "The CityVizor index failed its compressed integrity check.");
      const body = maybeGunzip(raw);
      if (pointer.index_content_sha256 && sha256(body) !== pointer.index_content_sha256) throw new CityVizorError(502, "cityvizor_index_hash_mismatch", "The CityVizor index failed its content integrity check.");
      const indexDocument = JSON.parse(body.toString("utf8"));
      if (!indexDocument.complete || !Array.isArray(indexDocument.profiles) || indexDocument.profile_count !== indexDocument.profiles.length) {
        throw new CityVizorError(502, "invalid_cityvizor_index", "The CityVizor index is incomplete.");
      }
      const profileMap = new Map();
      for (const descriptor of indexDocument.profiles) {
        const key = canonicalProfileKey(descriptor.key);
        if (profileMap.has(key) || !descriptor.profile_asset?.path) throw new CityVizorError(502, "invalid_cityvizor_index", "The CityVizor profile index is invalid.");
        profileMap.set(key, descriptor);
      }
      this.indexDocument = indexDocument;
      this.profileMap = profileMap;
      this.profileCache.clear();
      this.shardCache.clear();
    }
    this.pointer = pointer;
    this.pointerLoadedAt = now;
  }

  async readProfile(descriptor) {
    const cacheKey = `${this.pointer.release_id}:${descriptor.key}`;
    let document = this.profileCache.get(cacheKey);
    if (document) touch(this.profileCache, cacheKey, document);
    else {
      document = await this.readAsset(descriptor.profile_asset);
      if (document.profile?.key !== descriptor.key || !Array.isArray(document.years)) {
        throw new CityVizorError(502, "cityvizor_profile_contract_mismatch", "The profile object does not match its index descriptor.");
      }
      remember(this.profileCache, cacheKey, document, PROFILE_CACHE_SIZE);
    }
    return document;
  }

  async readAsset(descriptor) {
    if (!descriptor?.path || !descriptor.sha256 || !descriptor.content_sha256) {
      throw new CityVizorError(502, "invalid_cityvizor_asset", "A CityVizor asset descriptor is incomplete.");
    }
    const objectKey = releaseObjectKey(this.pointer.release_id, descriptor.path);
    const raw = await this.readObject(objectKey);
    if (sha256(raw) !== descriptor.sha256) throw new CityVizorError(502, "cityvizor_asset_hash_mismatch", "A CityVizor object failed its compressed integrity check.");
    const body = maybeGunzip(raw);
    if (sha256(body) !== descriptor.content_sha256) throw new CityVizorError(502, "cityvizor_asset_hash_mismatch", "A CityVizor object failed its content integrity check.");
    return JSON.parse(body.toString("utf8"));
  }

  async readObject(objectKey) {
    assertSafeObjectKey(objectKey);
    if (this.localRoot) {
      const target = path.resolve(this.localRoot, objectKey);
      if (!target.startsWith(`${this.localRoot}${path.sep}`)) throw new CityVizorError(502, "invalid_cityvizor_object_key", "CityVizor object escaped the configured root.");
      try { return await fs.readFile(target); }
      catch (error) {
        if (error.code === "ENOENT") throw new CityVizorError(502, "cityvizor_object_missing", `CityVizor object is missing: ${objectKey}`);
        throw error;
      }
    }
    return this.fetchObject(objectKey);
  }

  async fetchObject(objectKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const { url, headers } = await this.objectRequest(objectKey);
      const response = await this.fetchImpl(url, { headers, signal: controller.signal });
      if (!response.ok) throw new CityVizorError(502, "cityvizor_fetch_failed", `CityVizor storage returned HTTP ${response.status}.`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (error.name === "AbortError") throw new CityVizorError(504, "cityvizor_fetch_timeout", "CityVizor storage timed out.");
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async objectRequest(objectKey) {
    if (!this.base.startsWith("gs://")) return { url: `${this.base}/${objectKey}`, headers: {} };
    const withoutScheme = this.base.slice(5);
    const slash = withoutScheme.indexOf("/");
    const bucket = slash === -1 ? withoutScheme : withoutScheme.slice(0, slash);
    const prefix = slash === -1 ? "" : withoutScheme.slice(slash + 1).replace(/\/+$/, "");
    const fullKey = prefix ? `${prefix}/${objectKey}` : objectKey;
    const token = await this.googleAccessToken();
    return { url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(fullKey)}?alt=media`, headers: { Authorization: `Bearer ${token}` } };
  }

  async googleAccessToken() {
    const now = Date.now();
    if (this.accessToken && this.accessToken.expiresAt > now + 60_000) return this.accessToken.value;
    const response = await this.fetchImpl("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
      headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new CityVizorError(502, "cityvizor_auth_failed", `Metadata server returned HTTP ${response.status}.`);
    const payload = await response.json();
    this.accessToken = { value: payload.access_token, expiresAt: now + Number(payload.expires_in || 300) * 1000 };
    return this.accessToken.value;
  }
}

export function canonicalProfileKey(value) {
  const key = String(value || "");
  if (!/^[a-z0-9.-]+\/[0-9]+$/.test(key) || key.length > 160) throw new CityVizorError(400, "invalid_cityvizor_profile_key", "Expected a CityVizor instance/profile key.");
  return key;
}

function canonicalIco(value) {
  const ico = String(value || "").trim();
  if (!/^\d{8}$/.test(ico)) throw new CityVizorError(400, "invalid_cityvizor_municipality_ico", "Expected an eight-digit Czech municipality IČO.");
  return ico;
}

function publicProfileDescriptor(profile) {
  return {
    key: profile.key,
    name: profile.name,
    ico: profile.ico,
    type: profile.type,
    parent_profile_key: profile.parent_profile_key,
    pbo_category_cs: profile.pbo_category_cs,
    pbo_category_en: profile.pbo_category_en,
    instance: profile.instance,
    profile_url: profile.profile_url,
    available_years: profile.available_years,
    payment_years: profile.payment_years,
    noticeboard_rows: profile.noticeboard_rows,
    record_counts: profile.record_counts,
  };
}

function requiredYear(value, availableYears) {
  const text = String(value ?? "");
  if (!/^20\d{2}$/.test(text)) throw new CityVizorError(400, "invalid_cityvizor_year", "Year is required in YYYY format.");
  const year = Number(text);
  if (!availableYears.includes(year)) throw new CityVizorError(404, "cityvizor_year_not_found", "The selected profile does not publish this year.");
  return year;
}

function releaseObjectKey(releaseId, relativePath) {
  if (!/^[A-Za-z0-9._-]+$/.test(String(releaseId || ""))) throw new CityVizorError(502, "invalid_cityvizor_release", "The CityVizor release identifier is unsafe.");
  assertSafeObjectKey(relativePath);
  return `releases/${releaseId}/${relativePath}`;
}

function assertSafeObjectKey(value) {
  const key = String(value || "");
  if (!key || key.startsWith("/") || key.split("/").includes("..") || key.includes("\\")) throw new CityVizorError(502, "invalid_cityvizor_object_key", "CityVizor object key is unsafe.");
}

function maybeGunzip(body) { return body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body; }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function setting(name, fallback) { const value = Number(process.env[name]); return Number.isSafeInteger(value) && value > 0 ? value : fallback; }
function touch(cache, key, value) { cache.delete(key); cache.set(key, value); }
function remember(cache, key, value, limit) { cache.set(key, value); while (cache.size > limit) cache.delete(cache.keys().next().value); }

export const cityVizorStore = new CityVizorStore();
