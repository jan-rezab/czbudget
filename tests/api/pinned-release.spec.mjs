import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {SnapshotStore} from '../../server/snapshot-store.mjs';
import {CityVizorStore} from '../../server/cityvizor-store.mjs';

test('municipal and Cityvizor revisions keep their own data when the global pointer moves', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pinned-release-'));
  try {
    const municipal = {release_id: 'old-municipal', routes: 'old-routes.json'};
    const city = {release_id: 'old-city', index: 'old-index.json'};
    await fs.writeFile(path.join(root, 'municipal.json'), JSON.stringify(municipal));
    await fs.writeFile(path.join(root, 'city.json'), JSON.stringify(city));
    const one = new SnapshotStore({base: 'gs://test', pointerFile: path.join(root, 'municipal.json')});
    one.readObject = async key => {
      assert.equal(key, municipal.routes);
      return Buffer.from(JSON.stringify({release_id: municipal.release_id, routes: []}));
    };
    const two = new CityVizorStore({base: 'gs://test', pointerFile: path.join(root, 'city.json')});
    two.readObject = async key => {
      assert.equal(key, city.index);
      return Buffer.from(JSON.stringify({complete: true, profiles: [], profile_count: 0}));
    };
    await one.refreshRoutes(); await two.refresh();
    await fs.writeFile(path.join(root, 'current.json'), JSON.stringify({release_id: 'new-incompatible-release'}));
    await one.refreshRoutes(true); await two.refresh(true);
    assert.equal(one.pointer.release_id, municipal.release_id);
    assert.equal(two.pointer.release_id, city.release_id);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});
