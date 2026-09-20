import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const groups = {
  charts: ['tests/browser/shared-charts.spec.mjs', 'tests/browser/stories.spec.mjs'],
  stories: ['tests/browser/stories.spec.mjs'],
  navigation: ['tests/browser/shared-navigation.spec.mjs'],
};
export function selectVerification(files) {
  const selected = new Set(['navigation']);
  const broad = [];
  for (const file of files) {
    if (/^(assets\/chart-releases\/(?:current\.json|[a-f0-9]{64}\.(?:js|css))|lib\/chart-renderer\.js|shared-charts\.css|cz-history\.js|municipal-expanded-profile\.js|tests\/(?:unit\/chart-renderer\.spec\.mjs|browser\/shared-charts\.spec\.mjs|fixtures\/charts\/.*))$/.test(file)) selected.add('charts');
    else if (/^(stories\/|content\/stories\/|stories\.(?:js|css)$|scripts\/publish-stories\.mjs$|tests\/(?:browser|unit)\/stories\.spec\.mjs$)/.test(file)) selected.add('stories');
    // Shell changes affect every consuming layout; a smoke is not sufficient.
    else broad.push(file);
  }
  return { version: 1, lane: broad.length || !files.length ? 'full' : 'component', groups: [...selected].sort(), specs: [...new Set([...selected].flatMap(name => groups[name]))].sort(), broad, files };
}
export function contractDigest() {
  const files = execFileSync('git', ['ls-files', 'scripts', 'tests', 'cloudbuild*.yaml', 'playwright*.mjs', 'package*.json', '.githooks/pre-push'], {encoding:'utf8'}).trim().split('\n').filter(Boolean).sort();
  const hash=createHash('sha256');
  for(const file of files) { hash.update(file+'\0'); hash.update(readFileSync(file)); }
  return hash.digest('hex');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2], head = process.argv[3] || 'HEAD';
  if (!base || !/^[a-f0-9]{40}$/.test(base)) throw new Error('An explicit 40-character verified base commit is required');
  const commit = execFileSync('git',['rev-parse',head],{encoding:'utf8'}).trim();
  execFileSync('git',['merge-base','--is-ancestor',base,commit]);
  const files=execFileSync('git',['diff','--name-only',base,commit],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  console.log(JSON.stringify({...selectVerification(files),base,commit,contract:contractDigest()},null,2));
}
