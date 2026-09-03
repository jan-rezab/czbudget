import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const POINTER_TTL_MS = setting("PUBLIC_SNAPSHOT_POINTER_TTL_MS", 60_000);
const PROFILE_CACHE_SIZE = setting("PUBLIC_SNAPSHOT_PROFILE_CACHE_SIZE", 250);
const SHARD_CACHE_SIZE = setting("PUBLIC_SNAPSHOT_SHARD_CACHE_SIZE", 16);
const FETCH_TIMEOUT_MS = setting("PUBLIC_SNAPSHOT_FETCH_TIMEOUT_MS", 8_000);

export class SnapshotError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class SnapshotStore {
  constructor({ base = process.env.PUBLIC_SNAPSHOT_BASE_URL, localRoot = process.env.PUBLIC_SNAPSHOT_RELEASE_ROOT, fetchImpl = globalThis.fetch } = {}) {
    this.base = base ? String(base).replace(/\/+$/, "") : "";
    this.localRoot = localRoot ? path.resolve(localRoot) : "";
    this.fetchImpl = fetchImpl;
    this.pointer = null;
    this.pointerLoadedAt = 0;
    this.routeMap = new Map();
    this.profileIdMap = new Map();
    this.routeReleaseId = "";
    this.profileCache = new Map();
    this.shards = new Map();
    this.shardCache = new Map();
    this.accessToken = null;
  }

  get enabled() {
    return Boolean(this.base || this.localRoot);
  }

  async profileForPath(requestPath) {
    const canonicalPath = canonicalMunicipalityPath(requestPath);
    const route = await this.routeForPath(canonicalPath);
    if (!route) throw new SnapshotError(404, "municipality_not_found", "Municipality profile does not exist in the current public release.");
    const cached = this.profileCache.get(route.profile_id);
    if (cached?.releaseId === this.routeReleaseId) {
      this.profileCache.delete(route.profile_id);
      this.profileCache.set(route.profile_id, cached);
      return { route, release_id: cached.releaseId, profile: cached.value.profile, history: cached.value.history };
    }

    const wrapper = route.shard_key
      ? await this.profileFromShard(route)
      : JSON.parse((await this.readObject(route.object_key, true)).toString("utf8"));
    if (wrapper.release_id !== this.routeReleaseId || wrapper.profile_id !== route.profile_id || wrapper.payload_sha256 !== route.payload_sha256) {
      throw new SnapshotError(502, "snapshot_contract_mismatch", "The profile object does not match the active route index.");
    }
    const profileJson = JSON.stringify(wrapper.profile);
    const historyJson = wrapper.history === null ? "null" : JSON.stringify(wrapper.history);
    if (sha256(`${profileJson}\n${historyJson}`) !== wrapper.payload_sha256) {
      throw new SnapshotError(502, "snapshot_hash_mismatch", "The profile object failed its integrity check.");
    }
    this.profileCache.set(route.profile_id, { releaseId: wrapper.release_id, value: wrapper });
    while (this.profileCache.size > PROFILE_CACHE_SIZE) this.profileCache.delete(this.profileCache.keys().next().value);
    return { route, release_id: wrapper.release_id, profile: wrapper.profile, history: wrapper.history };
  }

  async profileFromShard(route) {
    const descriptor = this.shards.get(route.shard_key);
    if (!descriptor || descriptor.object_key !== route.shard_key) {
      throw new SnapshotError(502, "snapshot_contract_mismatch", "The route references an unknown profile shard.");
    }
    let cached = this.shardCache.get(route.shard_key);
    if (cached?.releaseId === this.routeReleaseId) {
      this.shardCache.delete(route.shard_key);
      this.shardCache.set(route.shard_key, cached);
    } else {
      const body = await this.readObject(route.shard_key, true);
      if (sha256(body) !== descriptor.body_sha256) throw new SnapshotError(502, "snapshot_hash_mismatch", "The profile shard failed its integrity check.");
      const profiles = new Map();
      for (const line of body.toString("utf8").split("\n")) {
        if (!line) continue;
        const wrapper = JSON.parse(line);
        if (profiles.has(wrapper.profile_id)) throw new SnapshotError(502, "snapshot_contract_mismatch", `Duplicate profile in shard: ${wrapper.profile_id}`);
        profiles.set(wrapper.profile_id, wrapper);
      }
      if (profiles.size !== descriptor.profile_count) throw new SnapshotError(502, "snapshot_contract_mismatch", "The profile shard count does not match its index.");
      cached = { releaseId: this.routeReleaseId, profiles };
      this.shardCache.set(route.shard_key, cached);
      while (this.shardCache.size > SHARD_CACHE_SIZE) this.shardCache.delete(this.shardCache.keys().next().value);
    }
    const wrapper = cached.profiles.get(route.profile_id);
    if (!wrapper) throw new SnapshotError(502, "snapshot_contract_mismatch", "The profile is absent from its indexed shard.");
    return wrapper;
  }

  async routeForPath(requestPath) {
    if (!this.enabled) throw new SnapshotError(503, "snapshot_store_disabled", "The public snapshot store is not configured.");
    await this.refreshRoutes();
    return this.routeMap.get(canonicalMunicipalityPath(requestPath)) || null;
  }

  async profileForId(profileId) {
    if (!this.enabled) throw new SnapshotError(503, "snapshot_store_disabled", "The public snapshot store is not configured.");
    await this.refreshRoutes();
    const route = this.profileIdMap.get(String(profileId));
    if (!route) throw new SnapshotError(404, "municipality_not_found", "Municipality profile does not exist in the current public release.");
    return this.profileForPath(route.path);
  }

  async refreshRoutes(force = false) {
    const now = Date.now();
    if (!force && this.pointer && now - this.pointerLoadedAt < POINTER_TTL_MS) return;
    const pointer = JSON.parse((await this.readObject("current.json", false)).toString("utf8"));
    if (!pointer.release_id || !pointer.routes) throw new SnapshotError(502, "invalid_snapshot_pointer", "The active snapshot pointer is incomplete.");
    if (pointer.release_id !== this.routeReleaseId) {
      const routeDocument = JSON.parse((await this.readObject(pointer.routes, true)).toString("utf8"));
      if (routeDocument.release_id !== pointer.release_id || !Array.isArray(routeDocument.routes)) {
        throw new SnapshotError(502, "invalid_snapshot_routes", "The active route index is incomplete.");
      }
      const next = new Map();
      const nextIds = new Map();
      const nextShards = new Map();
      for (const descriptor of Object.values(routeDocument.shards || {})) {
        if (!descriptor.object_key || nextShards.has(descriptor.object_key)) throw new SnapshotError(502, "invalid_snapshot_routes", "The shard index is invalid.");
        nextShards.set(descriptor.object_key, descriptor);
      }
      for (const route of routeDocument.routes) {
        const canonicalPath = canonicalMunicipalityPath(route.path);
        if (next.has(canonicalPath)) throw new SnapshotError(502, "duplicate_snapshot_route", `Duplicate route in snapshot: ${canonicalPath}`);
        next.set(canonicalPath, route);
        if (nextIds.has(route.profile_id)) throw new SnapshotError(502, "duplicate_snapshot_profile_id", `Duplicate profile ID in snapshot: ${route.profile_id}`);
        nextIds.set(route.profile_id, route);
        if (!route.object_key && !route.shard_key) throw new SnapshotError(502, "invalid_snapshot_routes", "A profile route has no storage object.");
      }
      this.routeMap = next;
      this.profileIdMap = nextIds;
      this.shards = nextShards;
      this.routeReleaseId = pointer.release_id;
      this.profileCache.clear();
      this.shardCache.clear();
    }
    this.pointer = pointer;
    this.pointerLoadedAt = now;
  }

  async status() {
    if (!this.enabled) return { enabled: false };
    try {
      await this.refreshRoutes();
      return { enabled: true, release_id: this.routeReleaseId, route_count: this.routeMap.size };
    } catch (error) {
      return { enabled: true, error: error.code || "snapshot_unavailable" };
    }
  }

  async readObject(objectKey, compressed) {
    if (!objectKey || objectKey.startsWith("/") || objectKey.split("/").includes("..")) {
      throw new SnapshotError(502, "invalid_snapshot_object_key", "Snapshot object key is unsafe.");
    }
    let body;
    if (this.localRoot) {
      const target = path.resolve(this.localRoot, objectKey);
      if (!target.startsWith(`${this.localRoot}${path.sep}`)) throw new SnapshotError(502, "invalid_snapshot_object_key", "Snapshot object escaped the configured root.");
      try { body = await fs.readFile(target); } catch (error) {
        if (error.code === "ENOENT") throw new SnapshotError(502, "snapshot_object_missing", `Snapshot object is missing: ${objectKey}`);
        throw error;
      }
    } else {
      body = await this.fetchObject(objectKey);
    }
    if (compressed && body[0] === 0x1f && body[1] === 0x8b) return gunzipSync(body);
    return body;
  }

  async fetchObject(objectKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const { url, headers } = await this.objectRequest(objectKey);
      const response = await this.fetchImpl(url, { headers, signal: controller.signal });
      if (!response.ok) throw new SnapshotError(502, "snapshot_fetch_failed", `Snapshot storage returned HTTP ${response.status}.`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (error.name === "AbortError") throw new SnapshotError(504, "snapshot_fetch_timeout", "Snapshot storage timed out.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async objectRequest(objectKey) {
    if (!this.base.startsWith("gs://")) return { url: `${this.base}/${objectKey}`, headers: {} };
    const withoutScheme = this.base.slice(5);
    const slash = withoutScheme.indexOf("/");
    const bucket = slash === -1 ? withoutScheme : withoutScheme.slice(0, slash);
    const prefix = slash === -1 ? "" : withoutScheme.slice(slash + 1).replace(/\/+$/, "");
    const fullKey = prefix ? `${prefix}/${objectKey}` : objectKey;
    const token = await this.googleAccessToken();
    return {
      url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(fullKey)}?alt=media`,
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  async googleAccessToken() {
    const now = Date.now();
    if (this.accessToken && this.accessToken.expiresAt > now + 60_000) return this.accessToken.value;
    const response = await this.fetchImpl("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new SnapshotError(502, "snapshot_auth_failed", `Metadata server returned HTTP ${response.status}.`);
    const payload = await response.json();
    this.accessToken = { value: payload.access_token, expiresAt: now + Number(payload.expires_in || 300) * 1000 };
    return this.accessToken.value;
  }
}

export function canonicalMunicipalityPath(value) {
  const pathname = new URL(String(value || ""), "https://publicspendingdata.org").pathname;
  const canonical = `/${pathname.split("/").filter(Boolean).join("/")}/`;
  if (!/^\/(?:municipalities\/[^/]+\/[^/]+|cz\/municipalities\/[^/]+)\/$/.test(canonical)) {
    throw new SnapshotError(400, "invalid_municipality_path", "Expected a canonical municipality profile path.");
  }
  return canonical;
}

export const publicSnapshotStore = new SnapshotStore();

function setting(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
