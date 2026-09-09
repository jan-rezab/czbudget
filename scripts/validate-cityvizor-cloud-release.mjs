#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const root = path.resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("CityVizor release root is required");

const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));

async function readAsset(descriptor, relative = descriptor.path || descriptor.file) {
  if (!relative || relative.startsWith("/") || relative.split("/").includes("..")) throw new Error(`Unsafe CityVizor asset path: ${relative}`);
  const target = path.resolve(root, relative);
  if (path.relative(root, target).startsWith("..")) throw new Error(`CityVizor asset escaped release root: ${relative}`);
  const compressed = await fs.readFile(target);
  if (compressed.length !== descriptor.bytes || digest(compressed) !== descriptor.sha256) throw new Error(`Compressed CityVizor asset mismatch: ${relative}`);
  const raw = gunzipSync(compressed);
  if (raw.length !== descriptor.uncompressed_bytes || digest(raw) !== descriptor.content_sha256) throw new Error(`CityVizor asset content mismatch: ${relative}`);
  return JSON.parse(raw.toString("utf8"));
}

async function countFiles(directory) {
  let count = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countFiles(path.join(directory, entry.name));
    else if (entry.isFile()) count += 1;
  }
  return count;
}

const expected = { accounting: 493800, events: 76106, noticeboard: 700, payments: 1270458, pbo_payment_source_rows: 71632, plans: 111004, profile_years: 1688 };
const report = await readJson(path.join(root, "build-report.json"));
const index = await readAsset(report.index_asset);
if (!index.complete || index.schema_version !== "1.0.0") throw new Error("CityVizor index is incomplete or unsupported");
if (index.profile_count !== 557 || index.profiles?.length !== 557 || index.profiles_with_payments !== 105) throw new Error("CityVizor profile counts differ");
if (JSON.stringify(index.record_counts) !== JSON.stringify(expected) || JSON.stringify(report.record_counts) !== JSON.stringify(expected)) throw new Error("CityVizor record totals differ");
const codelists = await readAsset(index.codelist_asset);
if (!codelists.codelists?.items?.length || !codelists.codelists?.paragraphs?.length || !codelists.codelists?.["pbo-su"]?.length) throw new Error("CityVizor codelists are incomplete");
const files = await countFiles(root);
if (files !== report.files) throw new Error(`CityVizor release file count differs: ${files} != ${report.files}`);
console.log(JSON.stringify({ status: "ok", scope: "cloud-release", profiles: index.profile_count, record_counts: index.record_counts, files }));
