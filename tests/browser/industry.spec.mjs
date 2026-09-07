import { test, expect } from '@playwright/test';

test('industry opens historical data with global country controls before the hero', async ({page}) => {
  await page.goto('/deep-dives/industry/?lang=cs');
  await expect(page.locator('#industry-trend-chart circle').first()).toBeAttached();
  expect(new URL(page.url()).searchParams.get('channel')).toBe('eurostat');
  await expect(page.locator('.industry-history-range')).toContainText('2010');
  expect(await page.locator('#industry-trend-chart circle').count()).toBeGreaterThan(192);
  const order=await page.evaluate(()=>document.querySelector('.industry-global-controls').compareDocumentPosition(document.querySelector('.industry-hero')));
  expect(order & 4).toBeTruthy();
  await page.locator('[data-year="2010"]').click();
  await expect(page.locator('#industry-subtitle')).toContainText('2010');
});

test('report catalogue links directly to industry history', async ({page}) => {
  await page.goto('/deep-dives/?lang=cs');
  const card=page.locator('.deep-card-grid #industry');
  await expect(card).toContainText('2010–2026');
  await card.click();
  await expect(page.locator('.industry-history-range')).toContainText('2010');
});

test('an explicit national selection offers a route to full history', async ({page}) => {
  await page.goto('/deep-dives/industry/?lang=cs&country=CZE&channel=national');
  await expect(page.locator('#industry-source-badge')).toContainText('Český statistický úřad');
  await page.getByRole('button',{name:'Zobrazit celou historii Eurostatu od roku 2010 →'}).click();
  await expect(page.locator('.industry-history-range')).toContainText('2010');
});
