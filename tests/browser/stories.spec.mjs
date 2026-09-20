import {test,expect} from '@playwright/test';

test('story catalogue supports formats, search, URL state and Czech UI',async({page})=>{
  await page.goto('/stories/?lang=en');
  await expect(page.locator('h1')).toHaveText('Data stories.');
  await expect(page.locator('.story-card:visible')).toHaveCount(3);
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
  for(const path of ['/stories/','/stories/tariffs-went-up-did-america-win/','/stories/customs-revenue-gross-is-not-net/','/stories/reciprocal-tariffs-are-not-equal/']){
    await page.goto(`${path}?lang=en`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('psd-site-header [data-global-nav="stories"]')).toBeVisible();
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
