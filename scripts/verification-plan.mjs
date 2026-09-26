import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {consumerTests,registry,sharedPath} from './chart-registry.mjs';

export const groups = {
  charts: [...new Set(registry.consumers.flatMap(consumer=>consumer.tests))],
  stories: ['tests/browser/stories.spec.mjs'],
  navigation: registry.verification.always,
  // The header runs on every page. These specs load stories, the reports index and
  // the about page; the candidate-image contract then loads the home page and a story
  // from the built image. A broken header script fails all of them.
  shell: ['tests/browser/shared-navigation.spec.mjs', 'tests/browser/reports-menu.spec.mjs', 'tests/browser/stories.spec.mjs'],
  reports: ['tests/browser/reports-menu.spec.mjs'],
};
const componentSpecs=()=>new Set([...Object.values(groups).flat(),...registry.consumers.flatMap(consumer=>consumer.tests)]);
// Notes that are never served: the repository root and tooling directories.
const NOTES = /^(?:[^/]+|(?:scripts|pipeline|tests)\/.+)\.md$/;
const SHELL = new Set(['global-nav.js', 'global-footer.js', 'site-header.css', 'reports-menu.css']);
const REPORTS_INDEX = new Set(['deep-dives/index.html', 'deep-dives.js', 'deep-dives/reports.json', 'scripts/build-reports-index.mjs']);
export function selectVerification(files) {
  const selected = new Set(['navigation']);
  const broad = [], changedSpecs = [], unit = [];
  for (const file of files) {
    const declared=consumerTests(file);
    if (sharedPath(file)) selected.add('charts');
    else if (declared.length && /^(stories\/|content\/stories\/)/.test(file)) selected.add('stories');
    else if (/^(stories\.(?:js|css)$|scripts\/publish-stories\.mjs$|tests\/(?:browser|unit)\/stories\.spec\.mjs$)/.test(file)) selected.add('stories');
    else if (declared.length) { /* declaredSpecs below owns the focused consumer coverage */ }
    else if (SHELL.has(file)) selected.add('shell');
    else if (REPORTS_INDEX.has(file)) selected.add('reports');
    else if (NOTES.test(file)) { /* not served and not executed */ }
    // A changed test runs itself when it already runs on the component server; other
    // browser specs need the full data server. tests/release runs on every candidate image.
    else if (componentSpecs().has(file)) changedSpecs.push(file);
    else if (/^tests\/(?:unit|api)\/[^/]+\.spec\.mjs$/.test(file)) unit.push(file);
    else if (/^tests\/release\/[^/]+\.spec\.mjs$/.test(file)) { /* image-browser-contract */ }
    // Server, data, routing, build machinery and unregistered pages need the exhaustive gate.
    else broad.push(file);
  }
  const declaredSpecs=files.flatMap(consumerTests);
  return { version: 3, lane: broad.length || !files.length ? 'full' : 'component', groups: [...selected].sort(), specs: [...new Set([...selected].flatMap(name => groups[name]).concat(declaredSpecs, changedSpecs))].sort(), unit: [...new Set(unit)].sort(), broad, files };
}
export function contractDigest(commit = 'HEAD') {
  const files = execFileSync('git', ['ls-files', 'scripts', 'tests', 'cloudbuild*.yaml', 'playwright*.mjs', 'package*.json', '.githooks/pre-push'], {encoding:'utf8'}).trim().split('\n').filter(Boolean).sort();
  const hash=createHash('sha256');
  for(const file of files) {
    hash.update(file+'\0');
    try { hash.update(readFileSync(file)); }
    catch(error) {
      if(error?.code !== 'ENOENT') throw error;
      // Sparse worktrees can omit a newly tracked test. Hash its exact Git blob
      // rather than failing or silently leaving it out of the release contract.
      hash.update(execFileSync('git',['show',`${commit}:${file}`]));
    }
  }
  return hash.digest('hex');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2], head = process.argv[3] || 'HEAD';
  if (!base || !/^[a-f0-9]{40}$/.test(base)) throw new Error('An explicit 40-character verified base commit is required');
  const commit = execFileSync('git',['rev-parse',head],{encoding:'utf8'}).trim();
  execFileSync('git',['merge-base','--is-ancestor',base,commit]);
  const files=execFileSync('git',['diff','--name-only',base,commit],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  console.log(JSON.stringify({...selectVerification(files),base,commit,contract:contractDigest(commit)},null,2));
}
