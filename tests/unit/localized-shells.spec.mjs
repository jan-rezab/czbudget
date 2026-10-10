import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('first-response shells carry the requested country and language', () => {
  const output = mkdtempSync(path.join(os.tmpdir(), 'psd-shell-test-'));
  try {
    const run = spawnSync('node', ['scripts/render-localized-shells.mjs', root, output], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(readdirSync(path.join(output, 'country-shells')).length, 390);
    assert.ok(!readdirSync(path.join(output, 'country-shells')).includes('zzz.en.html'));
    for (const [slug, code, name] of [['germany', 'DEU', 'Germany'], ['chn', 'CHN', 'China']]) {
      const html = readFileSync(path.join(output, 'country-shells', `${slug}.en.html`), 'utf8');
      assert.match(html, /<html lang="en">/);
      assert.match(html, new RegExp(`<h1 id="country-name">${name}</h1>`));
      assert.match(html, new RegExp(`<span class="country-code-large" id="country-code">${code}</span>`));
      assert.match(html, new RegExp(`"url":"https://publicspendingdata.org/countries/${slug}"`));
      assert.match(html, new RegExp(`"spatialCoverage":\\{"@type":"Country","name":"${name}"`));
      assert.doesNotMatch(html, /<h1 id="country-name">Česko<\/h1>|data-shell-pending/);
    }
    const home = readFileSync(path.join(output, 'index.en.html'), 'utf8');
    assert.match(home, /<html lang="en">/);
    assert.match(home, /Follow public money/);
    assert.match(home, /Itemized municipal budgets are published for only some countries/);
    assert.match(home, /Loading comparison…/);
    assert.match(home, /Loading health indicators…/);
    assert.doesNotMatch(home, /Načítám/);
    const about = readFileSync(path.join(output, 'about.en.html'), 'utf8');
    assert.match(about, /<h1 data-page-copy="aboutTitle">About Public Spending Data<\/h1>/);
    assert.match(about, /We bring together official budget data/);
    assert.match(about, /Official website ↗/);
    assert.match(about, /Results and impact ↗/);
    assert.match(about, /Support Hlidac statu, z\.u\. ↗/);
    assert.doesNotMatch(about, /Oficiální web|Výsledky a dopad|Podpořit/);
    const coverage = readFileSync(path.join(output, 'methodology.en.html'), 'utf8');
    assert.match(coverage, /<h1 data-status-copy="pageTitle">Coverage<\/h1>/);
    assert.match(coverage, /Data freshness by layer/);
    const reports = readFileSync(path.join(output, 'deep-dives/index.en.html'), 'utf8');
    assert.match(reports, /<h1 id="reports-title" data-deep-copy="indexTitle">Budgets by topic<\/h1>/);
    assert.doesNotMatch(reports, /5 zemí \/ countries|7 views \/ pohledů/);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

