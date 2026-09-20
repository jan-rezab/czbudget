import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const fixture=await readFile(new URL('../fixtures/automotive/monthly.json',import.meta.url),'utf8');
test.beforeEach(async({page})=>{
  await page.route('**/data/trade/automotive-monthly.v1.json*',route=>route.fulfill({contentType:'application/json',body:fixture}));
});
test('separate automotive report compares three product groups and four origins',async({page})=>{
  await page.goto('/deep-dives/automotive/?lang=en');
  await expect(page).toHaveTitle('Automotive — Public Spending Data');
  await expect(page.locator('.auto-chart-card')).toHaveCount(3);
  await expect(page.locator('.auto-line')).toHaveCount(12);
  await expect(page.locator('#auto-status')).toContainText('2 importing markets');
  await page.locator('#auto-metric').selectOption('share');
  await expect(page).toHaveURL(/metric=share/);
  await expect(page.locator('.auto-unit').first()).toHaveText('% of observed trade');
  await page.locator('#auto-market').selectOption('CZE');
  await expect(page.locator('#auto-status')).toContainText('1 importing market');
  const first=page.locator('.auto-chart-card').first();
  await first.locator('[data-action="table"]').click();
  await expect(first.locator('table')).toContainText('European Union');
  await expect(first.locator('table')).toContainText('202510');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
test('indexed range and Czech language survive a copied URL',async({page})=>{
  await page.goto('/deep-dives/automotive/?lang=cs&market=USA&metric=index&start=202602&end=202607');
  await expect(page.locator('#auto-start')).toHaveValue('202602');
  await expect(page.locator('.auto-chart-card')).toHaveCount(3);
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
  await expect(page.locator('.auto-chart-card')).toHaveCount(0);
});

test('the release serves verified monthly data rather than an empty report',async({page})=>{
  await page.unroute('**/data/trade/automotive-monthly.v1.json*');
  const receipt=JSON.parse(await readFile(new URL('../../data/trade/automotive-release.v1.json',import.meta.url),'utf8'));
  await page.goto('/deep-dives/automotive/?lang=en');
  await expect(page.locator('#auto-status')).toContainText(`${receipt.market_count} importing markets`);
  await expect(page.locator('.auto-line')).toHaveCount(12);
  for(const card of await page.locator('.auto-chart-card').all())expect(await card.locator('.auto-point').count()).toBeGreaterThan(20);
});
