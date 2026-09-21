import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const fixture=await readFile(new URL('../fixtures/automotive/monthly.json',import.meta.url),'utf8');
test.beforeEach(async({page})=>{
  await page.route('**/data/trade/automotive-monthly.v1.json*',route=>route.fulfill({contentType:'application/json',body:fixture}));
});
test('separate automotive report compares three product groups and four origins',async({page})=>{
  await page.goto('/deep-dives/automotive/?lang=en');
  await expect(page).toHaveTitle('Automotive — Public Spending Data');
  await expect(page.locator('#auto-charts .auto-chart-card')).toHaveCount(3);
  await expect(page.locator('#auto-charts .psd-plot-line')).toHaveCount(12);
  await expect(page.locator('#auto-status')).toContainText('2 importing markets');
  await page.locator('#auto-metric').selectOption('share');
  await expect(page).toHaveURL(/metric=share/);
  await expect(page.locator('.auto-unit').first()).toHaveText('% of observed trade');
  await page.locator('#auto-market').selectOption('CZE');
  await expect(page.locator('#auto-status')).toContainText('1 importing market');
  const first=page.locator('#auto-charts .auto-chart-card').first();
  await first.locator('[data-action="table"]').click();
  await expect(first.locator('table')).toContainText('European Union');
  await expect(first.locator('table')).toContainText('202510');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
test('indexed range and Czech language survive a copied URL',async({page})=>{
  await page.goto('/deep-dives/automotive/?lang=cs&market=USA&metric=index&start=202602&end=202607');
  await expect(page.locator('#auto-start')).toHaveValue('202602');
  await expect(page.locator('#auto-charts .auto-chart-card')).toHaveCount(3);
  await expect(page.locator('.auto-card-heading h3').first()).toContainText('Osobní a lehká vozidla');
  await page.locator('#auto-end').selectOption('202510');
  await expect(page.locator('#auto-start')).toHaveValue('202510');
  await page.reload();
  await expect(page.locator('#auto-metric')).toHaveValue('index');
  await expect(page.locator('#auto-start')).toHaveValue('202510');
});
test('failed data request is visible and produces no invented charts',async({page})=>{
  await page.route('**/data/trade/automotive-monthly.v1.json*',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/deep-dives/automotive/?lang=en');
  await expect(page.locator('#auto-status')).toContainText('could not be loaded');
  await expect(page.locator('#auto-charts .auto-chart-card')).toHaveCount(0);
});

test('the release serves verified monthly data rather than an empty report',async({page})=>{
  await page.unroute('**/data/trade/automotive-monthly.v1.json*');
  const receipt=JSON.parse(await readFile(new URL('../../data/trade/automotive-release.v1.json',import.meta.url),'utf8'));
  await page.goto('/deep-dives/automotive/?lang=en');
  await expect(page.locator('#auto-status')).toContainText(`${receipt.market_count} importing markets`);
  await expect(page.locator('#auto-charts .psd-plot-line')).toHaveCount(12);
  for(const card of await page.locator('#auto-charts .auto-chart-card').all())expect(await card.locator('[data-point]').count()).toBeGreaterThan(5);
});

test('whole-month hover compares four regions and keyboard selection opens that month’s routes',async({page})=>{
  await page.goto('/deep-dives/automotive/?lang=en');
  const card=page.locator('#auto-charts .auto-chart-card').first();
  const month=card.locator('[data-point]').nth(2);
  await month.hover();
  await expect(card.locator('.psd-plot-tooltip')).toBeVisible();
  await expect(card.locator('.psd-plot-tooltip > span')).toHaveCount(4);
  await expect(card.locator('.psd-plot-tooltip')).toContainText('Dec 2025');
  await month.focus();await month.press('ArrowRight');
  await expect(card.locator('.psd-plot-tooltip')).toContainText('Jan 2026');
  await page.keyboard.press('Enter');
  await expect(page.locator('#auto-flowPeriod')).toHaveValue('202601');
  await expect(page).toHaveURL(/flowPeriod=202601/);
});
test('trade scope adds intra-EU values and routes while explaining the comparison limit',async({page})=>{
  await page.goto('/deep-dives/automotive/?lang=en&market=CZE&geography=countries&origin=DEU&flowPeriod=202607');
  await expect(page.locator('#auto-scope')).toHaveValue('external');
  await expect(page.locator('#auto-scope-note')).toContainText('domestic US and Chinese sales are absent');
  await expect(page.locator('#automotive-trade-origin-destination .auto-flow-route')).toHaveCount(0);
  await page.locator('#auto-scope').selectOption('all');
  await expect(page).toHaveURL(/scope=all/);
  await expect(page.locator('#auto-scope-note')).toContainText('Includes cross-border deliveries between EU countries');
  await expect(page.locator('#automotive-trade-origin-destination .auto-flow-route')).toHaveCount(1);
  await expect(page.locator('#auto-flow-context')).toContainText('All cross-border trade');
  await page.reload();
  await expect(page.locator('#auto-scope')).toHaveValue('all');
});
test('country routes, destination filters and copied flow URLs retain direction',async({page})=>{
  await page.goto('/deep-dives/automotive/?lang=en&geography=countries&origin=JPN&segment=parts&flowPeriod=202601');
  await expect(page.locator('#auto-flow-context')).toContainText('Auto parts');
  const flow=page.locator('#automotive-trade-origin-destination');
  await expect(flow.locator('.auto-flow-route')).toHaveCount(2);
  await flow.locator('[data-action="table"]').click();
  await expect(flow.locator('table')).toContainText('Japan');
  await expect(flow.locator('table')).toContainText('Czechia');
  await page.locator('#auto-market').selectOption('CZE');
  await expect(flow.locator('.auto-flow-route')).toHaveCount(1);
  await expect(page.locator('#auto-flow-context')).toContainText('Czechia');
  await page.reload();
  await expect(page.locator('#auto-origin')).toHaveValue('JPN');
  await expect(page.locator('#auto-market')).toHaveValue('CZE');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
