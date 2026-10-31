import { test, expect } from '@playwright/test';

// Synthetic three-municipality map; the published dataset has the same contract.
const square = (x, y) => `M${x} ${y}h80v80h-80z`;
const row = (c, n, p, o, ob, cx, cf, k, f, m, x) => ({ c, i: String(c).padStart(8, '0'), n, r: 'Kraj Vysočina', s: `/cz/municipalities/${c}/`, p, o, ob, cx, cf, k, f, fb: ob - cx + cf, m, cc: 1e6, d: square(x, 40) });
const sample = {
  schema_version: 1, dataset_id: 'CZ_MUNICIPAL_BUDGET_MAP_2021_2025', period: '2021-2025', currency: 'CZK',
  releases: { history: 'cb5e6d60-fcf9-4c12-af75-1c59491114a1', transfers: 'd5410309-fe00-413f-a082-a85041386efb', snapshot_fiscal_year: 2025 },
  viewBox: '0 0 400 160',
  municipalities: [
    row(1, 'Horní Ves', 6000, .42, 42e6, 30e6, 5e6, 9000, .17, 12, 10),
    row(2, 'Dolní Ves', 8000, -.05, -5e6, 1e6, 2e6, null, -.04, 1.5, 100),
    row(3, 'Malá Ves', 300, .2, 1e6, 2e6, 1e6, 4000, 0, null, 190),
  ],
  unbudgeted: [{ c: 9, n: 'Vojenský újezd', d: square(280, 40) }],
  regions: [{ n: 'Kraj Vysočina', d: 'M10 40h260v80h-260z' }],
  state: 'M10 40h350v80h-350z',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/data/czech-municipal-budget-map.v1.json', route => route.fulfill({ json: sample }));
});

test('map paints every municipality, keeps missing values apart and ranks by size', async ({ page }) => {
  await page.goto('/?lang=en');
  const root = page.locator('#home-budget-map-root');
  await root.scrollIntoViewIfNeeded();
  await expect(root.locator('[data-chart-component="choropleth"] [data-area]')).toHaveCount(3);
  await expect(root.locator('.is-empty')).toHaveCount(1);
  await expect(root.locator('[data-area="0"]')).toHaveClass('b6');
  await expect(root.locator('[data-area="1"]')).toHaveClass('b1');
  await expect(root.locator('[data-list=best] li')).toHaveCount(2);
  await expect(root.locator('[data-list=best] li').first()).toContainText('Horní Ves');
  await root.locator('[data-metric=k]').click();
  await expect(root.locator('[data-area="1"]')).toHaveClass('bx');
  await expect(root.locator('[data-chart-component="choropleth"]')).toHaveAttribute('data-ramp', 'sequential');
  await root.locator('.home-budget-map-size select').selectOption('0');
  await expect(root.locator('[data-list=best] li')).toHaveCount(2);
});

test('keyboard, search, Escape and the table expose the same values', async ({ page }) => {
  await page.goto('/?lang=en');
  const root = page.locator('#home-budget-map-root');
  await root.scrollIntoViewIfNeeded();
  const map = root.locator('.psd-choro-frame svg');
  await map.focus();
  await page.keyboard.press('Home');
  const tip = root.locator('.psd-choro-tip');
  await expect(tip).toContainText('Horní Ves');
  await expect(tip).toContainText('+42.0 %');
  await page.keyboard.press('ArrowRight');
  await expect(tip).toContainText('Malá Ves');
  await page.keyboard.press('Enter');
  await expect(tip.locator('a')).toHaveAttribute('href', '/cz/municipalities/3/?lang=en');
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  const search = root.locator('.home-budget-map-find input');
  await search.fill('dolni');
  await page.keyboard.press('Enter');
  await expect(tip).toContainText('Dolní Ves');
  await expect(tip).toContainText('−5.0 %');
  await root.locator('[data-action="table"]').click();
  await expect(root.locator('.psd-chart-panel tbody tr')).toHaveCount(3);
  await expect(root.locator('.psd-chart-panel')).toContainText('Dolní Ves');
});

test('Czech copy and narrow layout stay inside the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=cs');
  const root = page.locator('#home-budget-map-root');
  await root.scrollIntoViewIfNeeded();
  await expect(root.locator('h2')).toHaveText('Nejlepší a nejhorší rozpočty obcí');
  await expect(root.locator('.psd-choro-missing')).toContainText('Bez obecního rozpočtu');
  await root.locator('[data-area="0"]').click();
  await expect(root.locator('.psd-choro-tip')).toContainText('Otevřít rozpočet');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
