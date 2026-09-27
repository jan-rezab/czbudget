// Local and CI access to datasets that live in the published static-asset packs instead
// of Git. Validators, tests and the test servers read a file from the checkout when it is
// there and otherwise from the pack named by the static-asset lock:
//
//   DATA_ASSET_LOCK (+ DATA_ASSET_PACK_ROOT)  a hydrated lock, as Cloud Build prepares it;
//                                             packs missing from the root are range-read
//                                             from the bucket at their pinned generation
//   neither                                   the live gs://czbudget-janrezab-public-snapshots/
//                                             static-assets/current.json
//
// Remote reads authenticate with `gcloud auth print-access-token` (or the metadata server
// on a Cloud Build worker without gcloud). Tokens and bytes are held in memory only:
// nothing here writes a dataset to disk.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { ASSET_PATH, AssetError, StaticAssets } from "../../server/static-assets.mjs";

const run = promisify(execFile);
export const LOCK_OBJECT = "static-assets/current.json";
export const CREDENTIALS_HELP = "Datasets served from the published static-asset packs need read access to "
  + "gs://czbudget-janrezab-public-snapshots: run `gcloud auth login` (the token comes from "
  + "`gcloud auth print-access-token`), or set DATA_ASSET_LOCK and DATA_ASSET_PACK_ROOT to a hydrated lock.";

export class MissingCredentialsError extends Error {}

let token;
let pendingToken;
/** A short-lived OAuth token for read-only GCS access, cached in memory. */
export async function localAccessToken({ command = "gcloud", fetchImpl = globalThis.fetch } = {}) {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  pendingToken ||= (async () => {
    try {
      const { stdout } = await run(command, ["auth", "print-access-token"], { timeout: 30_000 });
      const value = stdout.trim();
      if (!value) throw new MissingCredentialsError(CREDENTIALS_HELP);
      // gcloud tokens last an hour; refresh well before that.
      token = { value, expires: Date.now() + 45 * 60_000 };
      return value;
    } catch (error) {
      if (error.code !== "ENOENT") throw new MissingCredentialsError(`${CREDENTIALS_HELP}\n${String(error.stderr || error.message).trim()}`);
      // No gcloud: a Cloud Build worker still has its service account on the metadata server.
      try {
        const response = await fetchImpl("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
          headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(3000),
        });
        const result = response.ok ? await response.json() : {};
        if (!result.access_token) throw new Error(`metadata server answered ${response.status}`);
        token = { value: result.access_token, expires: Date.now() + Number(result.expires_in || 300) * 1000 };
        return token.value;
      } catch (metadataError) {
        throw new MissingCredentialsError(`${CREDENTIALS_HELP}\n(gcloud is not installed; metadata server: ${metadataError.message})`);
      }
    }
  })().finally(() => { pendingToken = null; });
  return pendingToken;
}

let warned = false;
/**
 * The same token for a server: a missing login becomes a 502 asset_auth_failed response
 * (instead of an opaque 500) and the remedy is printed once on stderr.
 */
export async function serverAccessToken() {
  try {
    return await localAccessToken();
  } catch (error) {
    if (!(error instanceof MissingCredentialsError)) throw error;
    if (!warned) console.error(`static-asset packs: ${error.message}`);
    warned = true;
    throw new AssetError(502, "asset_auth_failed");
  }
}

/** StaticAssets options for a checkout: the hydrated lock when given, else the live lock. */
export function localAssetOptions(env = process.env, { tokenProvider = localAccessToken } = {}) {
  const common = { tokenProvider, maxInFlightBytes: 256 * 1024 * 1024 };
  if (env.DATA_ASSET_LOCK) return { ...common, lockPath: env.DATA_ASSET_LOCK, localRoot: env.DATA_ASSET_PACK_ROOT || undefined };
  return { ...common, lockPath: null, lockObject: env.DATA_ASSET_LOCK_OBJECT || LOCK_OBJECT, localRoot: undefined };
}

let shared;
export function localAssetStore() {
  shared ||= new StaticAssets(localAssetOptions());
  return shared;
}

const exists = (file) => stat(file).then((info) => info.isFile(), () => false);

function published(relative) {
  const url = `/${relative.split(path.sep).join("/").replace(/^\/+/, "")}`;
  return ASSET_PATH.test(url) ? url : null;
}

function explain(error, relative) {
  if (error instanceof MissingCredentialsError) return new Error(`${relative} is not in this checkout. ${error.message}`);
  if (error instanceof AssetError && error.status === 404) {
    return Object.assign(new Error(`ENOENT: ${relative} is neither in this checkout nor in the static-asset lock`), { code: "ENOENT", path: relative });
  }
  if (error instanceof AssetError) return new Error(`${relative} could not be read from the static-asset packs (${error.code}). ${CREDENTIALS_HELP}`);
  return error;
}

/** The exact committed bytes of a data file: from the checkout, else from the published pack. */
export async function readDataFile(relative, { root = process.cwd(), store = localAssetStore() } = {}) {
  const file = path.resolve(root, relative);
  if (await exists(file)) return readFile(file);
  const url = published(path.relative(root, file));
  if (!url) return readFile(file);
  try { return await store.readBuffer(url); } catch (error) { throw explain(error, relative); }
}

export async function readDataText(relative, options) {
  return (await readDataFile(relative, options)).toString("utf8");
}

export async function readDataJSON(relative, options) {
  return JSON.parse(await readDataText(relative, options));
}

/** Size and SHA-256 of the committed bytes, from the lock when the file is not checked out. */
export async function dataFileDigest(relative, { root = process.cwd(), store = localAssetStore() } = {}) {
  const file = path.resolve(root, relative);
  if (!(await exists(file)) && published(path.relative(root, file))) {
    try {
      const entry = await store.entry(published(path.relative(root, file)));
      if (!entry) throw new AssetError(404, "asset_not_found");
      return entry.encoding ? { bytes: entry.raw_size, sha256: entry.raw_sha256 } : { bytes: entry.size, sha256: entry.sha256 };
    } catch (error) { throw explain(error, relative); }
  }
  const content = await readDataFile(relative, { root, store });
  return { bytes: content.length, sha256: createHash("sha256").update(content).digest("hex") };
}

/**
 * Files below a data directory, relative to the root and sorted: the checkout's own listing
 * when the directory is checked out, else every published URL below it.
 */
export async function listDataFiles(directory, { root = process.cwd(), store = localAssetStore(), recursive = true } = {}) {
  const absolute = path.resolve(root, directory);
  const base = path.relative(root, absolute).split(path.sep).join("/");
  const local = await stat(absolute).then((info) => info.isDirectory(), () => false);
  if (local) {
    const found = [];
    const walk = async (folder) => {
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        const target = path.join(folder, entry.name);
        if (entry.isDirectory() && recursive) await walk(target);
        else if (entry.isFile()) found.push(path.relative(root, target).split(path.sep).join("/"));
      }
    };
    await walk(absolute);
    return found.sort();
  }
  if (!published(`${base}/x`)) return [];
  try {
    const urls = await store.list(`/${base}/`);
    return urls.map((url) => url.slice(1)).filter((relative) => recursive || !relative.slice(base.length + 1).includes("/")).sort();
  } catch (error) { throw explain(error, directory); }
}

/** True when the path is served from the packs (whether or not it is also checked out). */
export function isPublishedDataPath(relative) {
  return Boolean(published(relative));
}
