import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import catalog from '../../content/stories/catalog.mjs';
import {selectVerification} from '../../scripts/verification-plan.mjs';
const read = path => readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('published chart adapters have content-derived cache versions',async()=>{
  for (const story of catalog.filter(s=>s.status==='published')) {
    const html=await read(`stories/${story.slug}/index.html`);
    for (const name of ['tariff-charts.js','chart-rails.js']) {
      if (!html.includes(`/stories/${name}`)) continue;
      const digest=createHash('sha256').update(await read(`stories/${name}`)).digest('hex');
      assert.ok(html.includes(`/stories/${name}?v=${digest}"`), `${story.slug}: ${name}`);
    }
  }
});

test('published articles, index, RSS and sitemap agree; drafts stay private',async()=>{
  const index=await read('stories/index.html'),feed=await read('stories/feed.xml'),map=await read('stories/sitemap.xml');
  for(const s of catalog){
    const route=`/stories/${s.slug}/`;
    for(const surface of [index,feed,map]) assert.equal(surface.includes(route),s.status==='published');
    if(s.status!=='published')continue;
    const html=await read(`stories/${s.slug}/index.html`);
    assert.equal([...html.matchAll(/<h1\b/g)].length,1);
    assert.ok(html.includes(`href="https://publicspendingdata.org${route}"`));
    assert.ok(html.includes('<article lang="en">'));
    assert.doesNotMatch(html,/file:\/\/|\.codex\/|Local editorial version|psd-trade-war-reference/);
    const slugs=[...html.matchAll(/data-story-table="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(slugs).size,slugs.length);
    for(const slug of slugs) assert.ok(html.includes(`id="${slug}"`));
    for(const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(()=>JSON.parse(match[1]));
  }
});
test('the full story preserves seven readable chart tables and source caveats',async()=>{
  const html=await read('stories/tariffs-went-up-did-america-win/index.html');
  assert.equal([...html.matchAll(/data-story-table=/g)].length,7);
  for(const text of ['not proof of why','include estimates','not a pre-tariff baseline','Not a live tracker','current_month_net_rcpt_amt','October–August']) assert.ok(html.includes(text),text);
  assert.ok((await read('robots.txt')).includes('/stories/sitemap.xml'));
});
test('editorial output and checks are wired into release verification',async()=>{
  assert.ok((await read('cloudbuild.verify.yaml')).includes('npm run check:stories'));
  assert.ok((await read('cloudbuild.ui.yaml')).includes('scripts/run-component-gate.mjs'));
  for(const file of ['stories/tariff-charts.js','content/stories/catalog.mjs','lib/chart-renderer.js']) {
    assert.ok(selectVerification([file]).specs.includes('tests/browser/stories.spec.mjs'),file);
  }
});
