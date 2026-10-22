import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('candidate image serves navigation and the published story',async({page})=>{
  await page.goto('/stories/?lang=en');
  await expect(page.locator('.global-nav')).toContainText('Stories');
  await page.goto('/stories/tariffs-went-up-did-america-win/?lang=en');
  await expect(page.locator('h1')).toBeVisible();
});
test('candidate image serves matching immutable chart assets and usable tooltips',async({page,request})=>{
  const response=await request.get('/assets/chart-releases/current.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-cache');
  const manifest=await response.json();
  for(const asset of [manifest.script,manifest.style]) {
    const response=await request.get(asset.url);
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('immutable');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  }
  // Route only the synthetic HTML: JS, CSS and manifest must come from the image.
  await page.route('**/chart-contract-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><div id="plot"></div><script type="module">await import("/chart-runtime.js");await window.PSDPlotReady;window.PSDPlot.render(document.querySelector("#plot"),{rows:[{year:2025,amount:42}],fields:[{key:"amount",label:"Revenue"}]});</script></main></body></html>'}));
  await page.goto('/chart-contract-fixture');
  await page.locator('[data-point]').focus();
  await expect(page.locator('.psd-plot-tooltip')).toContainText('42');
  await page.keyboard.press('Escape');
  await expect(page.locator('.psd-plot-tooltip')).toBeHidden();
});

 test('candidate image allows and loads the same-origin Russia report embed',async({page,request})=>{
  const response=await request.get('/stories/trade-surged-around-russia/?lang=en');
  expect(response.headers()['content-security-policy']).toContain("frame-src 'self'");
  await page.goto('/stories/trade-surged-around-russia/?lang=en');
  await page.locator('iframe').scrollIntoViewIfNeeded();
  await expect(page.frameLocator('iframe').locator('#rt-map')).toBeAttached();
  await expect(page.frameLocator('iframe').locator('#rt-growth-KAZ')).toBeAttached();
 });


// The ordinary full-suite server serves checkout HTML. Only this candidate-image
// gate exercises nginx's staged, language-specific first response before promotion.
const reportRegistry=JSON.parse(readFileSync(new URL('../../deep-dives/reports.json',import.meta.url),'utf8'));
const localizedRoutes=[
  ...reportRegistry.reports.map(report=>({label:`report: ${report.slug}`,route:`/${report.navPath}`})),
  ...['/comparison.html','/map.html','/process/log/','/cesky-rozpocet.html','/municipalities/','/municipalities/czechia/','/municipalities/germany/','/municipalities/france/'].map(route=>({label:route,route})),
];
const budgetSource=readFileSync(new URL('../../cesky-rozpocet.html',import.meta.url),'utf8');
const sectionIds=html=>[...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(match=>match[1]);
const fullBudgetSections=['overview','cesko','rozpocet-v-case','utraceni','statni-firmy','zdravotni-system','nemocnice-benchmark','demografie','benchmark','metodika'];
for(const {label,route} of localizedRoutes) {
  test(`candidate image returns English HTML before scripts run: ${label}`,async({request})=>{
    const url=new URL(route,'https://publicspendingdata.org');
    url.searchParams.set('lang','en');
    const response=await request.get(url.pathname+url.search);
    try {
      expect(response.status(),route).toBe(200);
      expect(response.headers()['content-type'],route).toContain('text/html');
      const html=await response.text();
      expect(html,route).toMatch(/<html\b[^>]*\blang="en"/i);
      const canonical=html.match(/<link\b(?=[^>]*\brel="canonical")[^>]*\bhref="([^"]+)"/i)?.[1];
      expect(canonical,route).toBe(`https://publicspendingdata.org${url.pathname}?lang=en`);
      if(url.pathname==='/cesky-rozpocet.html') {
        expect(html).toContain('data-rendered-language="en"');
        expect(sectionIds(html)).toEqual(fullBudgetSections);
        expect(sectionIds(html)).toEqual(sectionIds(budgetSource));
        expect((html.match(/<section\b/g)||[]).length).toBe((budgetSource.match(/<section\b/g)||[]).length);
        const ids=markup=>[...markup.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]).filter(id=>!id.startsWith('alternate-')&&id!=='canonical-url').sort();
        expect(ids(html)).toEqual(ids(budgetSource));
      }
    } finally {await response.dispose();}
  });
}
