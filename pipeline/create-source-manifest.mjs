import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const websiteRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(process.env.CZBUDGET_WORKSPACE_ROOT || path.join(websiteRoot, ".."));
const manifestPath = path.join(websiteRoot, "pipeline", "source-assets.manifest.json");
const verify = process.argv.includes("--verify");

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(target));
    else if (entry.isFile()) output.push(target);
  }
  return output;
}

function digest(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("error", reject).on("end", () => resolve(hash.digest("hex")));
  });
}

const roots = ["data/source_cache", "data/sources"];
const files = (await Promise.all(roots.map((relative) => filesBelow(path.join(workspaceRoot, relative))))).flat().sort();
const assets = [];
for (const file of files) {
  const metadata = await stat(file);
  assets.push({
    path: path.relative(workspaceRoot, file),
    bytes: metadata.size,
    sha256: await digest(file),
  });
}
const manifest = { schema_version: "1.0.0", algorithm: "sha256", asset_count: assets.length, total_bytes: assets.reduce((sum, item) => sum + item.bytes, 0), assets };

if (verify) {
  const expected = JSON.parse(await readFile(manifestPath, "utf8"));
  if (JSON.stringify(expected) !== JSON.stringify(manifest)) {
    console.error("Source assets differ from pipeline/source-assets.manifest.json");
    process.exit(1);
  }
  console.log(`Verified ${assets.length} source assets (${manifest.total_bytes} bytes)`);
} else {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Recorded ${assets.length} source assets (${manifest.total_bytes} bytes)`);
}
