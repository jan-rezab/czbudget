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
    for (const name of ['tariff-charts.js','chart-rails.js','oil-pivot.js','stories.js','stories.css','oil-pivot.css']) {
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


test('oil editorial evidence keeps grains separate and excludes unsupported periods',async()=>{
  const html=await read('content/stories/the-great-oil-pivot.fragment');
  const values=id=>JSON.parse(html.match(new RegExp('<script id="'+id+'" type="application/json">([\\s\\S]*?)</script>'))[1]);
  const annual=values('oa-data'),monthly=values('oa-months');
  assert.deepEqual(annual.map(d=>d.period),['2020','2021','2022','2023','2024']);
  assert.equal(monthly.length,10);assert.equal(monthly.at(-1).period,'202607');
  assert.ok(monthly.every(d=>d.frequency==='M'&&d.china===null&&d.eu===null));
  assert.ok(annual.every(d=>d.frequency==='A'&&d.euReporting<=27));
  assert.match(html,/EU-27 is the sum of available/);
  assert.doesNotMatch(await read('stories/oil-pivot.js'),/window\.openai|new Tweak|append\('(?:svg|path)'/);
});
test('a story release with a regenerated chart coverage report stays in the single-build lane',()=>{
  // chart-coverage.json is derived from the registry; alone it once forced a 16-minute exhaustive gate.
  assert.equal(selectVerification(['chart-coverage.json']).lane,'component');
  const oilPivotRelease=['assets/chart-releases/current.json','chart-components.json','chart-coverage.json','content/stories/catalog.mjs','content/stories/the-great-oil-pivot.fragment','deep-dives/energy-trade/index.html','lib/chart-renderer.js','scripts/publish-stories.mjs','stories/feed.xml','stories/index.html','stories/oil-pivot.css','stories/oil-pivot.js','stories/sitemap.xml','stories/stories.css','stories/stories.js','stories/the-great-oil-pivot/index.html','stories/vendor/topojson-client-3.1.0.min.js','tests/browser/stories.spec.mjs','tests/unit/stories.spec.mjs'];
  const plan=selectVerification(oilPivotRelease);
  assert.deepEqual([plan.lane,plan.broad],['component',[]]);
  assert.ok(plan.specs.includes('tests/browser/stories.spec.mjs'));
});
test('published story pages link only to files that ship with the site',async()=>{
  // The release integrity gate rejects root-relative links without a static file; catch them before a cloud build.
  const {stat}=await import('node:fs/promises');
  const exists=async path=>{for(const candidate of [path,`${path}.html`,`${path.replace(/\/?$/,'/')}index.html`]){try{if((await stat(new URL(`../../${candidate}`,import.meta.url))).isFile())return true;}catch{}}return false;};
  for(const page of ['stories/index.html',...catalog.filter(s=>s.status==='published').map(s=>`stories/${s.slug}/index.html`)]){
    const html=await read(page);
    for(const [,reference] of html.matchAll(/<(?:a|link|script|img)\b[^>]*(?:href|src)=["']([^"']+)["']/gi)){
      if(/^(?:https?:|mailto:|tel:|data:|javascript:|#|\/\/)/.test(reference))continue;
      const path=decodeURIComponent(reference.split(/[?#]/)[0]).replace(/^\//,'');
      if(path&&reference.startsWith('/'))assert.ok(await exists(path),`${page} -> ${reference}`);
    }
  }
});
