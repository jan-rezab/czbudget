import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, linkSync } from 'node:fs';
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
    const manifest=JSON.parse(readFileSync(path.join(output,'localized-shells.json'),'utf8'));
    const registry=JSON.parse(readFileSync(path.join(root,'deep-dives/reports.json'),'utf8'));
    const nginx=readFileSync(path.join(root,'nginx.conf.template'),'utf8');
    for(const report of registry.reports) {
      const route='/'+report.navPath.split('?')[0];
      assert.ok(manifest.routes.some(entry=>entry.route===route), `Missing report shell: ${route}`);
    }
    for(const entry of manifest.routes) {
      const html=readFileSync(path.join(output,entry.englishFile),'utf8');
      assert.match(html,/<html lang="en"/);
      assert.ok(html.includes(`rel="canonical" href="https://publicspendingdata.org${entry.route}?lang=en"`),entry.route);
      for(const language of ['cs','en']) assert.ok(html.includes(`hreflang="${language}" href="https://publicspendingdata.org${entry.route}?lang=${language}"`),entry.route);
      assert.ok(nginx.includes(`"${entry.route}:en" /${entry.englishFile};`), `Unrouted shell: ${entry.route}`);
      assert.match(html,/<h1\b/);
      assert.doesNotMatch(html,/<title>[^<]*(?:Rozpočet|Výdaje|Mapa|Srovnání|Provozní)/);
    }
    const budget=readFileSync(path.join(output,'cesky-rozpocet.en.html'),'utf8');
    const originalBudget=readFileSync(path.join(root,'cesky-rozpocet.html'),'utf8');
    assert.match(budget,/data-rendered-language="en"/);
    const directory=readFileSync(path.join(output,'municipalities/index.en.html'),'utf8');
    assert.match(directory,/data-placeholder="searchPlaceholder" placeholder="Name or national code…"/);
    const capitalPage=readFileSync(path.join(output,'eu-capitals.en.html'),'utf8');
    assert.match(capitalPage,/data-i18n-placeholder="searchPlaceholder"/);
    assert.doesNotMatch(capitalPage,/placeholder="Praha, France…"/);
    assert.match(budget,/Czech budget over time/);
    assert.match(budget,/Most profitable strategic entities/);
    assert.match(budget,/Comparable statements 2024|Comparable 2024 statements/);
    assert.deepEqual([...budget.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]).filter(id=>!id.startsWith('alternate-')&&id!=='canonical-url').sort(),[...originalBudget.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]).filter(id=>!id.startsWith('alternate-')&&id!=='canonical-url').sort(),'The full budget retains every section, chart mount and control');
    assert.equal((budget.match(/<section\b/g)||[]).length,(originalBudget.match(/<section\b/g)||[]).length);
    assert.match(readFileSync(path.join(output,'municipalities/germany/index.en.html'),'utf8'),/<h1 id="country-title">[^<]*German/);
    assert.match(readFileSync(path.join(output,'process/log/index.en.html'),'utf8'),/<h1>Data processing and release log<\/h1>/);
    assert.match(readFileSync(path.join(output,'deep-dives/trade/index.en.html'),'utf8'),/Services have their own trade map/);
    assert.doesNotMatch(budget,/Součty za všechny|Nejziskovější|Nový úplný rámec/);
    assert.ok(!readdirSync(path.join(output, 'country-shells')).includes('zzz.en.html'));
    for (const [slug, code, name] of [['germany', 'DEU', 'Germany'], ['chn', 'CHN', 'China']]) {
      const html = readFileSync(path.join(output, 'country-shells', `${slug}.en.html`), 'utf8');
      assert.match(html, /<html lang="en">/);
      assert.match(html, /<meta id="og-url" property="og:url"/);
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


test('rendering staged source copies never modifies hard-linked checkout files', () => {
  const output=mkdtempSync(path.join(os.tmpdir(),'psd-shell-links-'));
  try {
    const before=readFileSync(path.join(root,'about.html'),'utf8');
    linkSync(path.join(root,'about.html'),path.join(output,'about.html'));
    const run=spawnSync('node',['scripts/render-localized-shells.mjs',root,output],{cwd:root,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    assert.equal(readFileSync(path.join(root,'about.html'),'utf8'),before);
    assert.notEqual(readFileSync(path.join(output,'about.html'),'utf8'),before);
  } finally {rmSync(output,{recursive:true,force:true});}
});
