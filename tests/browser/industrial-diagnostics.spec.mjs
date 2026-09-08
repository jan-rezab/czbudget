import {test,expect} from '@playwright/test';

const report='/deep-dives/industry/diagnostics/?lang=en';
const ready=async page=>expect(page.locator('#explorer')).toHaveAttribute('aria-busy','false');

test('report exposes English corporate investment and all six working topics',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(report);
  await expect(page.locator('h1')).toContainText('What powers');
  await expect(page.locator('#investment-facts')).toContainText('2025');
  for(const view of ['capacity','production','machines','energy','chains','products']){
    await page.locator(`[data-view="${view}"]`).click();await ready(page);
    await expect(page.locator('#series-chart svg')).toBeVisible();
    await expect(page.locator('#status')).toBeEmpty();
    expect(await page.locator('#series-chart circle').count()).toBeGreaterThan(0);
  }
  await page.locator('#series-chart svg').press('ArrowLeft');
  await expect(page.locator('#series-chart .chart-readout')).toContainText('2023');
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('comparison, year filters, CSV and share links preserve identical series',async({page})=>{
  await page.goto(report);await ready(page);
  await page.locator('#compare').selectOption('DE');await ready(page);
  await page.locator('#from').fill('2020');await page.locator('#to').fill('2024');await page.locator('#apply-years').click();
  await expect(page.locator('#series-facts')).toContainText('20 numeric observations');
  await expect(page.locator('#series-chart .chart-legend')).toContainText('Germany');
  const downloadPromise=page.waitForEvent('download');await page.locator('#series-chart [data-action="csv"]').click();
  const download=await downloadPromise;const stream=await download.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk;
  expect(csv).toContain('2020-Q1');expect(csv).toContain('geo=DE');expect(csv).not.toContain('2019-Q4');
  const pngPromise=page.waitForEvent('download');await page.locator('#series-chart [data-action="png"]').click();
  const png=await pngPromise;expect(png.suggestedFilename()).toMatch(/\.png$/);
  const pngStream=await png.createReadStream();const bytes=[];for await(const chunk of pngStream)bytes.push(chunk);expect(Buffer.concat(bytes).subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  await page.reload();await ready(page);await expect(page.locator('#from')).toHaveValue('2020');await expect(page.locator('#compare')).toHaveValue('DE');
  await expect(page.locator('#series-facts')).toContainText('20 numeric observations');
});

test('confidential product observations stay blank in the table',async({page})=>{
  await page.goto(report+'&view=products');await ready(page);
  await page.locator('#dim-product').selectOption('23121190');await ready(page);
  await page.locator('#series-chart [data-action="table"]').click();
  const row=page.locator('#series-chart tbody tr').filter({hasText:'2010'});
  await expect(row).toContainText(':C');
  await expect(row.locator('td').nth(2)).toBeEmpty();
});

test('changing topics while requests are pending never renders an obsolete selection',async({page})=>{
  await page.goto(report);await ready(page);
  await page.route('**/data/industrial-intelligence/DS-059358/*.gz*',async route=>{await new Promise(r=>setTimeout(r,350));await route.continue();});
  await page.locator('[data-view="products"]').click();await page.locator('[data-view="capacity"]').click();await ready(page);
  await expect(page.locator('#dataset')).toHaveValue('ei_bsin_q_r2');
  await expect(page.locator('#series-chart h3')).toContainText('capacity utilization');
});

test('checksum failure has a retry path and never plots damaged data',async({page})=>{
  await page.route('**/ei_bsin_q_r2/*.gz*',route=>route.fulfill({status:200,body:'[]',contentType:'application/json'}));
  await page.goto(report);await expect(page.locator('#status')).toContainText('checksum mismatch');
  await expect(page.locator('#series-chart svg')).toHaveCount(0);await expect(page.locator('#retry')).toBeVisible();
  await page.unroute('**/ei_bsin_q_r2/*.gz*');await page.locator('#retry').click();await ready(page);
  await expect(page.locator('#series-chart svg')).toBeVisible();
});

test('language switching keeps the selected product and dates',async({page})=>{await page.goto(report+'&view=products');await ready(page);const product=await page.locator('#dim-product').inputValue();await page.locator('[data-lang="cs"]').click();await ready(page);await expect(page.locator('html')).toHaveAttribute('lang','cs');await expect(page.locator('h1')).toContainText('Co se děje');await expect(page.locator('#dim-product')).toHaveValue(product);});


test('English report discovery uses current shared translations',async({page})=>{
  await page.goto('/deep-dives/?lang=en');
  await expect(page.locator('#industrial-diagnostics h3')).toHaveText('Inside industry');
  await expect(page.locator('#industrial-diagnostics p')).toContainText('Business earnings and investment');
  await expect(page.locator('script[src*="deep-dives.js"]')).toHaveAttribute('src',/v=20260908-industrial-diagnostics-final/);
  await page.locator('#industrial-diagnostics').click();await ready(page);
  await expect(page.locator('h1')).toContainText('What powers');
});
