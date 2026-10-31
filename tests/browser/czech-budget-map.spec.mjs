import { test, expect } from '@playwright/test';

// Synthetic municipalities; the published dataset has the same contract.
const square = (x, y) => `M${x} ${y}h80v80h-80z`;
const row = (c, n, p, o, ob, ce, cx, cf, k, f, m, x) => ({ c, i: String(c).padStart(8, '0'), n, r: 'Kraj Vysočina', s: `/cz/municipalities/${c}/`, p, o, ob, ce, cx, cf, k, f, fb: ob - cx + cf, m, cc: 1e6, d: square(x, 40) });
const sample = {
  schema_version: 1, dataset_id: 'CZ_MUNICIPAL_BUDGET_MAP_2021_2025', period: '2021-2025', currency: 'CZK',
  releases: { history: 'cb5e6d60-fcf9-4c12-af75-1c59491114a1', transfers: 'd5410309-fe00-413f-a082-a85041386efb', snapshot_fiscal_year: 2025 },
  viewBox: '0 0 460 160',
  municipalities: [
    // operating surplus, investment larger than surplus + capital funding: deficit from investment
    row(1, 'Horní Ves', 6000, .42, 42e6, 58e6, 60e6, 5e6, 9000, -.13, 12, 10),
    // operating deficit: deficit from running costs
    row(2, 'Dolní Ves', 8000, -.05, -5e6, 105e6, 1e6, 2e6, null, -.04, 1.5, 100),
    // surplus
    row(3, 'Malá Ves', 300, .2, 10e6, 40e6, 10e6, 1e6, 4000, .02, null, 190),
  ],
  unbudgeted: [{ c: 9, n: 'Vojenský újezd', d: square(280, 40) }],
  regions: [{ n: 'Kraj Vysočina', d: 'M10 40h260v80h-260z' }],
  state: 'M10 40h350v80h-350z',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/data/czech-municipal-budget-map.v1.json?*', route => route.fulfill({ json: sample }));
});

test('budget map lives on the Czech municipalities page, not the homepage', async ({ page }) => {
  await page.goto('/?lang=en');
  await expect(page.locator('#czech-budget-map-root, #home-budget-map-root')).toHaveCount(0);
  await page.goto('/municipalities/czechia/?lang=en');
  await expect(page.locator('.municipal-rail a[href="#budget-map"]')).toHaveText('Budget map');
  const root = page.locator('#czech-budget-map-root');
  await root.scrollIntoViewIfNeeded();
  await expect(root.locator('[data-chart-component="choropleth"] [data-area]')).toHaveCount(3);
  await expect(root.locator('.is-empty')).toHaveCount(1);
  await expect(root.locator('[data-area="0"]')).toHaveClass('b6');
  await expect(root.locator('[data-area="1"]')).toHaveClass('b1');
  await expect(root.locator('[data-list=best] li').first()).toContainText('Horní Ves');
});

test('investment is a share of spending and deficits show whether investment or running costs caused them', async ({ page }) => {
  await page.goto('/municipalities/czechia/?lang=en');
  const root = page.locator('#czech-budget-map-root');
  await root.scrollIntoViewIfNeeded();
  await root.locator('[data-metric=ks]').click();
  await expect(root.locator('[data-chart-component="choropleth"]')).toHaveAttribute('data-ramp', 'sequential');
  // 60 / (58 + 60) = 50.8 %; 1 / 106 = 0.9 %; 10 / 50 = 20 %
  await expect(root.locator('[data-area="0"]')).toHaveClass('b5');
  await expect(root.locator('[data-area="1"]')).toHaveClass('b0');
  await expect(root.locator('.psd-choro-marks path')).toHaveCount(2);
  await expect(root.locator('.psd-choro-mark-legend')).toContainText('Deficit from investment');
  await expect(root.locator('.psd-choro-mark-legend')).toContainText('Operating deficit');
  await expect(root.locator('.czech-budget-map-stats')).toContainText('1 deficits from investment');
  await expect(root.locator('.czech-budget-map-stats')).toContainText('1 operating deficits');
  await expect(root.locator('[data-list=best] li').first()).toContainText('50.8 %');
  await expect(root.locator('[data-list=best] li').first().locator('.czech-budget-map-cause')).toHaveText('Deficit from investment');
  const map = root.locator('.psd-choro-frame svg');
  await map.focus();
  await page.keyboard.press('Home');
  const tip = root.locator('.psd-choro-tip');
  await expect(tip).toContainText('Horní Ves');
  await expect(tip).toContainText('Deficit from investment: current revenue covered running costs');
  await page.keyboard.press('End');
  await expect(tip).toContainText('Dolní Ves');
  await expect(tip).toContainText('Operating deficit: current revenue did not cover running costs');
});

test('keyboard, search, Escape and the table expose the same values', async ({ page }) => {
  await page.goto('/municipalities/czechia/?lang=en');
  const root = page.locator('#czech-budget-map-root');
  await root.scrollIntoViewIfNeeded();
  const map = root.locator('.psd-choro-frame svg');
  await map.focus();
  await page.keyboard.press('Home');
  const tip = root.locator('.psd-choro-tip');
  await expect(tip).toContainText('+42.0 %');
  await page.keyboard.press('ArrowRight');
  await expect(tip).toContainText('Malá Ves');
  await page.keyboard.press('Enter');
  await expect(tip.locator('a')).toHaveAttribute('href', '/cz/municipalities/3/?lang=en');
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  const search = root.locator('.czech-budget-map-find input');
  await search.fill('dolni');
  await page.keyboard.press('Enter');
  await expect(tip).toContainText('Dolní Ves');
  await expect(tip).toContainText('−5.0 %');
  await root.locator('[data-action="table"]').click();
  await expect(root.locator('.psd-chart-panel tbody tr')).toHaveCount(3);
  await expect(root.locator('.psd-chart-panel')).toContainText('deficit from investment');
});

test('Czech copy and narrow layout stay inside the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/municipalities/czechia/?lang=cs');
  const root = page.locator('#czech-budget-map-root');
  await root.scrollIntoViewIfNeeded();
  await expect(root.locator('h2')).toHaveText('Nejlepší a nejhorší rozpočty obcí');
  await expect(root.locator('.psd-choro-missing')).toContainText('Bez obecního rozpočtu');
  await root.locator('[data-area="0"]').click();
  await expect(root.locator('.psd-choro-tip')).toContainText('Otevřít rozpočet');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
