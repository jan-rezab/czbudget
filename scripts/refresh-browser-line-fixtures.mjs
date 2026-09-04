// Explicit maintenance command, never invoked by tests or a production build.
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const root = new URL('../tests/fixtures/municipal-lines/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
for (const entry of manifest.responses) {
  const response = await fetch(entry.url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${entry.url}: ${response.status}`);
  const body = await response.text();
  JSON.parse(body);
  await writeFile(new URL(entry.file, root), gzipSync(body));
}
manifest.recorded_at = new Date().toISOString();
await writeFile(new URL('manifest.json', root), `${JSON.stringify(manifest, null, 2)}\n`);
