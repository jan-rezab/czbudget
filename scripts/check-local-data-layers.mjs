#!/usr/bin/env node
/** Exit 0 only when all generated layers needed by the full local validator are present. */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, 'data/manifest.v1.json'), 'utf8'));
const required = new Set(['serving', 'entities', 'bundles']);

async function countFiles(directory) {
  let count = 0;
  let entries;
  try { entries = await readdir(directory, {withFileTypes: true}); } catch { return 0; }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) count += await countFiles(path.join(directory, entry.name));
    else if (entry.isFile()) count += 1;
  }
  return count;
}

const missing = [];
for (const layer of manifest.layers.filter((item) => required.has(item.id))) {
  const base = layer.root === 'parent' ? path.dirname(root) : root;
  const actual = await countFiles(path.join(base, layer.path));
  if (actual !== layer.file_count) missing.push(`${layer.id}:${actual}/${layer.file_count}`);
}
if (missing.length) {
  console.error(`cloud-only generated layers: ${missing.join(', ')}`);
  process.exit(3);
}
console.log('all generated validation layers are present');
