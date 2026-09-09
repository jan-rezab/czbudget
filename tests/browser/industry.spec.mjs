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

test('industry ranking stays compact with the full division list', async ({page}) => {
  await page.goto('/deep-dives/industry/?code=CZE&channel=eurostat&lang=en&country=FRA&frequency=M&measure=yoy_pct&adjustment=CA&base=none&level=division&period=2026-06');
  const chart=page.locator('#industry-ranked-chart svg');
  await expect(chart).toBeAttached();
  const geometry=await chart.evaluate(svg=>({
    width:svg.viewBox.baseVal.width,
    height:svg.viewBox.baseVal.height,
    rows:svg.querySelectorAll('[data-series]').length,
    renderedWidth:svg.getBoundingClientRect().width
  }));
  const desktop=page.viewportSize().width>=600;
  const expectedWidth=desktop?760:500;
  const maximumRowHeight=desktop?26:40;
  expect(geometry.rows).toBeGreaterThan(20);
  expect(geometry.width).toBe(expectedWidth);
  expect(geometry.height).toBeLessThanOrEqual(geometry.rows*maximumRowHeight+50);
  expect(geometry.renderedWidth).toBeLessThanOrEqual(expectedWidth);
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
