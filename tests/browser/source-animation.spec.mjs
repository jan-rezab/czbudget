import { test, expect } from '@playwright/test';
const url='/studio/data-in-one-place/';

test('the source film exposes municipalities, ministries and global institutions',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await expect(page.locator('#film-number')).toHaveText('6,254');
  await page.locator('[data-film-scene="1"]').click();
  await expect(page.locator('#film-number')).toHaveText('47');
  await expect(page.locator('#film-number-label')).toContainText('14 ministries');
  await page.locator('[data-film-scene="2"]').click();
  await expect(page.locator('#film-labels')).toContainText('UN Comtrade');
  await expect(page.locator('#film-labels')).toContainText('UN Population Division');
  await expect(page.locator('#film-labels')).toContainText('World Bank');
  await expect(page.locator('#film-number')).toHaveText('191');
  await page.locator('[data-film-scene="3"]').click();
  await expect(page.locator('#film-number')).toHaveText('318');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow, noarchive');
  expect(errors).toEqual([]);
});

test('source filters and entity search change both the result list and film',async({page})=>{
  await page.goto(url);
  await page.locator('[data-network-origin="international"]').click();
  await expect(page.locator('#network-count')).toHaveText('44 of 318 source references');
  await expect(page.locator('#film-number')).toHaveText('44');
  await page.locator('#network-search').fill('Comtrade');
  await expect(page.locator('#network-count')).toHaveText('1 of 318 source references');
  await expect(page.locator('#network-grid a')).toHaveAttribute('href','https://comtrade.un.org/');
  await expect(page.locator('#film-number')).toHaveText('1');
  await page.locator('#network-search').fill('');
  await page.locator('#network-kind').selectOption('municipalities');
  await expect(page.locator('#network-count')).toHaveText('6,254 Czech municipalities');
  await page.locator('#network-search').fill('Prague');
  await expect(page.locator('#network-count')).toHaveText('1 Czech municipalities');
  await expect(page.locator('#film-number')).toHaveText('1');
  await page.locator('#network-search').fill('');
  await page.locator('#network-kind').selectOption('chapters');
  await expect(page.locator('#network-count')).toHaveText('47 state-budget chapters');
  await page.locator('#network-search').fill('Ministry');
  await expect(page.locator('#film-number')).toHaveText('14');
});

test('the film fits its viewport and retains the exact record explorer',async({page},testInfo)=>{
  if(testInfo.project.name.startsWith('mobile'))await page.setViewportSize({width:390,height:844});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  for(const scene of ['0','1','2','3','4','5']){
    await page.locator(`[data-film-scene="${scene}"]`).click();
    const bounds=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    expect(bounds.scroll).toBe(bounds.width);
  }
  await page.locator('.volume-explorer > summary').click();
  await page.locator('[data-scope="czech"]').click();
  await expect(page.locator('#count')).toHaveText('600,126');
  await page.locator('#layer').selectOption('national');
  await page.locator('#year').selectOption('2024');
  await page.locator('#indicator').selectOption('1');
  await expect(page.locator('#count')).toHaveText('1');
  expect(errors).toEqual([]);
});
