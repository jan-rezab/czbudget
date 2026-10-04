import {test,expect} from '@playwright/test';
import catalog from '../../content/stories/catalog.mjs';

test('story catalogue supports formats, search, URL state and Czech UI',async({page})=>{
  await page.goto('/stories/?lang=en');
  await expect(page.locator('h1')).toHaveText('Data stories.');
  await expect(page.locator('.story-card:visible')).toHaveCount(catalog.filter(story=>story.status==='published').length);
  await page.locator('[data-filter="mini"]').click();
  await expect(page.locator('.story-card:visible')).toHaveCount(2);
  await page.locator('#story-search').fill('customs');
  await expect(page.locator('.story-card:visible')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.story-card:visible')).toHaveCount(1);
  await page.locator('#story-search').fill('no matching topic');
  await expect(page.locator('#stories-empty')).toBeVisible();
  await page.locator('psd-site-header [data-lang="cs"]').click();
  await expect(page.locator('h1')).toHaveText('Příběhy v datech.');
  await expect(page.locator('psd-site-header [data-global-nav="stories"]')).toHaveText('Příběhy');
});

test('full tariff story renders seven chart objects with tables, downloads and sources',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/stories/tariffs-went-up-did-america-win/?lang=en');
  await expect(page.locator('[data-chart-slug]')).toHaveCount(7);
  await expect(page.locator('#psd-clear-tariffs .chart svg')).toHaveCount(3);
  const cash=page.locator('#tariff-story-monthly-customs');
  await cash.locator('[data-action="table"]').click();
  await expect(cash.locator('.psd-chart-panel')).toContainText('-25.555668441');
  await cash.locator('[data-action="sources"]').click();
  await expect(cash.locator('.psd-chart-drawer')).toContainText('MTS Table 4');
  const download=page.waitForEvent('download');await cash.locator('[data-action="csv"]').click();
  expect((await download).suggestedFilename()).toBe('tariff-story-monthly-customs.csv');
  const image=page.waitForEvent('download');await cash.locator('[data-action="png"]').click();
  expect((await image).suggestedFilename()).toBe('tariff-story-monthly-customs.png');
  await page.locator('#trade-legend button').first().click();
  await page.reload();
  await expect(page.locator('#trade-legend button').first()).toHaveAttribute('aria-pressed','false');
  expect(errors).toEqual([]);
});

test('stories are readable on mobile and mini articles have shared navigation',async({page})=>{
  await page.setViewportSize({width:1200,height:800});
  await page.goto('/stories/?lang=en');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/stories/','/stories/the-great-oil-pivot/','/stories/tariffs-went-up-did-america-win/','/stories/customs-revenue-gross-is-not-net/','/stories/reciprocal-tariffs-are-not-equal/']){
    await page.goto(`${path}?lang=en`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('psd-site-header [data-global-nav="stories"]')).toBeVisible();
    if(path.includes('customs-revenue-') || path.includes('reciprocal-tariffs-')) {
      await expect(page.locator('[data-chart-slug]')).toHaveCount(1);
      await expect(page.locator('.chart-fallback')).toBeHidden();
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  }
});

test('article narrative and chart tables survive without JavaScript',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  const page=await context.newPage();
  await page.goto('/stories/tariffs-went-up-did-america-win/');
  await expect(page.locator('h1')).toHaveText('Tariffs went up. Did America come out ahead?');
  await expect(page.locator('.chart-fallback')).toHaveCount(7);
  await page.locator('#tariff-story-monthly-customs summary').click();
  await expect(page.locator('#tariff-story-monthly-customs table')).toBeVisible();
  await context.close();
});


test('oil story plays through, keeps its clock when expanded and separates monthly coverage',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/v1/trade/energy/flows?*',route=>route.fulfill({status:404,body:'Unavailable'}));
  await page.clock.install();
  await page.goto('/stories/the-great-oil-pivot/?lang=en');
  const atlas=page.locator('#oil-atlas');await expect(atlas).toHaveAttribute('data-ready','true');
  await expect(page.locator('.oa-trend-panel')).toHaveCount(3);
  await page.locator('#oa-play').click();await page.clock.runFor(1100);
  const before=Number(await atlas.getAttribute('data-globe-longitude'));
  await page.locator('#oa-expand').click();await expect(atlas).toHaveClass(/is-expanded/);
  await page.clock.runFor(1200);expect(Number(await atlas.getAttribute('data-globe-longitude'))).toBeLessThan(before);
  await page.locator('#oa-expand').click();await expect(atlas).not.toHaveClass(/is-expanded/);
  await page.locator('#oa-play').click();const frozen=await page.locator('.oa-trend-panel').first().getAttribute('data-playhead');
  await page.clock.runFor(1000);expect(await page.locator('.oa-trend-panel').first().getAttribute('data-playhead')).toBe(frozen);
  await page.locator('#oa-play').click();await page.clock.fastForward(22000);
  await expect(page.locator('#oa-continue-monthly')).toBeVisible();await expect(page.locator('#oa-map-year')).toHaveText('2024');
  await page.locator('#oa-continue-monthly').click();await page.clock.runFor(2000);
  await expect(atlas).toHaveAttribute('data-view','monthly');await expect(page.locator('.oa-trend-panel')).toHaveCount(1);
  await expect(page.locator('[data-year]')).toHaveCount(10);await expect(page.locator('[data-year]').last()).toHaveText('Jul 2026');
  await expect(page.locator('[data-country="china"]')).toBeDisabled();
  await page.clock.fastForward(29000);await expect(page.locator('#oa-map-year')).toHaveText('Jul 2026');
  await page.locator('[data-action="table"]').click();await expect(page.locator('.psd-chart-panel')).toContainText('369.');
  expect(errors).toEqual([]);
});

test('oil story supports keyboard chart selection, reduced motion and mobile expansion',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/stories/the-great-oil-pivot/?lang=en');await expect(page.locator('#oil-atlas')).toHaveAttribute('data-ready','true');
  const mark=page.locator('.oa-trend-plot [data-point="0"]').first();await mark.focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('.psd-plot-tooltip').first()).toContainText('2021');await page.keyboard.press('Escape');await expect(page.locator('.psd-plot-tooltip').first()).toBeHidden();
  await page.locator('#oa-expand').click();await expect(page.locator('#oa-expand')).toHaveAttribute('aria-expanded','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.keyboard.press('Escape');await expect(page.locator('#oa-expand')).toHaveAttribute('aria-expanded','false');
  await page.locator('#oa-monthly').check();await expect(page.locator('.oa-trend-panel')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});

 test('Russia story includes the complete maps and charts report',async({page})=>{
  await page.goto('/stories/trade-surged-around-russia/?lang=en');
  await expect(page.locator('h1')).toHaveText('Trade surged around Russia. Where did the goods go?');
  const report=page.locator('iframe[title="Russia trade: interactive maps, category stacks and supplier comparisons"]');
  await report.scrollIntoViewIfNeeded();
  await expect(report).toHaveAttribute('src',/deep-dives\/russia-trade\/.*frequency=A/);
  const frame=page.frameLocator('iframe[title="Russia trade: interactive maps, category stacks and supplier comparisons"]');
  await expect(frame.locator('#rt-map')).toBeAttached();
  await expect(frame.locator('#rt-growth-KAZ')).toBeAttached();
  await expect(frame.locator('#rt-growth-KGZ')).toBeAttached();
  await expect(frame.locator('#rt-lead-chart')).toBeAttached();
 });


test('oil story extends annual history from published 2025 routes and preserves deep links',async({page})=>{
  const rows=[['IND',88723174160],['CHN',100855331239],['SVK',5110849000],['HUN',4280875000],['CZE',526941000]].map(([code,weight])=>({origin:{code:'RUS'},market:{code},net_weight_kg:weight,net_weight_is_estimated:false}));
  await page.route('**/api/v1/trade/energy/flows?*',route=>route.fulfill({json:{data:{frequency:'A',period:'2025',product:{code:'270900'},routes:rows,totals:{reporting_markets:81},source:{snapshot_as_of:'2026-10-04T19:00:00Z'}}}}));
  await page.goto('/stories/the-great-oil-pivot/?lang=en&view=annual&period=2025');
  await expect(page.locator('#oil-atlas')).toHaveAttribute('data-ready','true');
  await expect(page.locator('#oa-map-year')).toHaveText('2025');
  await expect(page.locator('[data-year]')).toHaveCount(6);
  await expect(page.locator('#oa-source-rows tr').last()).toContainText('276.316');
  await expect(page.locator('#oa-source-rows tr').last()).toContainText('243.077');
  await expect(page.locator('.story-edition')).toContainText('2020–2025');
  await page.locator('[data-country="eu"]').click();
  await expect(page.locator('#oa-inspection')).toContainText('Netherlands');
  await expect(page.locator('#oa-inspection')).toContainText('—');
  await page.reload();await expect(page.locator('#oa-map-year')).toHaveText('2025');
  await page.goto('/stories/the-great-oil-pivot/?lang=en&view=annual&period=2024');
  await expect(page.locator('#oa-map-year')).toHaveText('2024');
  await page.locator('#oa-monthly').check();
  await expect(page.locator('[data-country="china"]')).toBeDisabled();
});
