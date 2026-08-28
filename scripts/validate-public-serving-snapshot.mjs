#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const root = path.resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("Usage: node scripts/validate-public-serving-snapshot.mjs OUTPUT_DIR");
const pointer = await readJSON(path.join(root, "current.json"));
const manifest = await readJSON(path.join(root, pointer.manifest));
if (pointer.release_id !== manifest.release_id) throw new Error("Pointer and manifest release IDs differ");
const expectedManifestHash = manifest.manifest_sha256;
const manifestCore = { ...manifest };
delete manifestCore.manifest_sha256;
if (sha256(JSON.stringify(manifestCore)) !== expectedManifestHash) throw new Error("Manifest hash mismatch");

const routesCompressed = await fs.readFile(path.join(root, pointer.routes));
const routesBody = gunzipSync(routesCompressed).toString("utf8");
if (sha256(routesBody) !== manifest.route_index_sha256) throw new Error("Route index hash mismatch");
const routeIndex = JSON.parse(routesBody);
if (routeIndex.release_id !== manifest.release_id) throw new Error("Route index release ID mismatch");
if (routeIndex.routes.length !== manifest.profile_count) throw new Error("Route count does not match manifest");

let prior = "";
const ids = new Set();
for (const route of routeIndex.routes) {
  if (route.path <= prior) throw new Error(`Routes are duplicated or unsorted at ${route.path}`);
  if (ids.has(route.profile_id)) throw new Error(`Duplicate profile ID ${route.profile_id}`);
  const objectPath = path.resolve(root, route.object_key);
  if (!objectPath.startsWith(`${root}${path.sep}`)) throw new Error(`Object escapes release root: ${route.object_key}`);
  await fs.access(objectPath);
  prior = route.path;
  ids.add(route.profile_id);
}

const first = routeIndex.routes[0];
const last = routeIndex.routes.at(-1);
for (const route of [first, last]) {
  const wrapper = JSON.parse(gunzipSync(await fs.readFile(path.join(root, route.object_key))));
  if (wrapper.profile_id !== route.profile_id || wrapper.payload_sha256 !== route.payload_sha256) {
    throw new Error(`Profile wrapper mismatch for ${route.profile_id}`);
  }
  const profileJson = JSON.stringify(wrapper.profile);
  const historyJson = wrapper.history === null ? "null" : JSON.stringify(wrapper.history);
  if (sha256(`${profileJson}\n${historyJson}`) !== wrapper.payload_sha256) throw new Error(`Payload hash mismatch for ${route.profile_id}`);
}

process.stdout.write(`${JSON.stringify({
  status: "ok",
  release_id: manifest.release_id,
  profile_count: manifest.profile_count,
  checked_profile_objects: [first.profile_id, last.profile_id],
}, null, 2)}\n`);

async function readJSON(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
