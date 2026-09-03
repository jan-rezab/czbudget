import { execFile } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const helper = fileURLToPath(new URL('./raw_cache_archives.py', import.meta.url));
const exists = (file) => access(file).then(() => true, (error) => {
  if (error.code === 'ENOENT') return false;
  throw error;
});

export async function archivedInventory(directory) {
  if (!await exists(path.join(directory, '.raw-cache.manifest.json'))
      && !await exists(path.join(directory, '.raw-cache.tar.gz'))) return null;
  // Hash the actual compressed members; never trust the sidecar on its own.
  const { stdout } = await run('python3', [helper, 'inventory', '--directory', directory],
    { maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(stdout);
}

export async function restoreArchivedGroups(base) {
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(base, entry.name);
    if (!await exists(path.join(directory, '.raw-cache.manifest.json'))
        && !await exists(path.join(directory, '.raw-cache.tar.gz'))) continue;
    await run('python3', [helper, 'restore', '--directory', directory]);
  }
}
