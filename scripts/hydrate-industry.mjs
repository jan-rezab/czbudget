import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const root = path.resolve('data/industry');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'archive-manifest.json'), 'utf8'));
for (const row of manifest) {
  if (!/^[A-Z0-9_]+\.json$/.test(row.file)) throw new Error('Invalid country filename');
  const bytes = gunzipSync(fs.readFileSync(path.join(root, row.file + '.gz')));
  if (bytes.length !== row.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== row.sha256)
    throw new Error('Industry checksum mismatch: ' + row.file);
  fs.writeFileSync(path.join(root, row.file), bytes);
}
console.log(`Hydrated and verified ${manifest.length} industry country/aggregate files`);
