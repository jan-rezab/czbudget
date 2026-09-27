import { test, expect } from '@playwright/test';

// Always part of the fast preflight, before expensive published-data hydration.
test('shared navigation exposes the same primary destinations on narrow and wide screens', async ({ page }) => {
  await page.goto('/stories/?lang=en');
  for (const width of [390, 1200, 1440]) {
    await page.setViewportSize({width,height:900});
    const nav=page.locator('.global-nav');
    await expect(nav).toContainText('Stories');
    const items=await nav.locator(':scope > a, :scope > details > summary').allTextContents();
    expect(items.map(item=>item.replace(/\s+/g,''))).toEqual(['Country⌄','Municipalities⌄','Compare','Map','Reports','Stories','Coverage','About']);
    // Every destination fits onscreen without having to discover a sideways rail.
    for (const item of await nav.locator(':scope > a, :scope > details > summary').all()) {
      const box = await item.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

test('country menus fit the viewport, filter countries and return keyboard focus', async ({ page }) => {
  await page.goto('/deep-dives/?lang=en');
  for (const width of [390, 1280]) {
    await page.setViewportSize({width,height:720});
    const menu = page.locator('.country-menu:not(.municipality-menu)');
    const summary = menu.locator('summary');
    await summary.click();
    const search = menu.locator('input[type="search"]');
    await search.fill('Czechia');
    await expect(menu.locator('a[data-country-code]:visible')).toHaveCount(1);
    await expect(menu.locator('a[data-country-code="CZE"]')).toBeVisible();
    const box = await menu.locator('.country-menu-panel').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(720);
    await search.press('Escape');
    await expect(search).toHaveValue('');
    await search.press('Escape');
    await expect(menu).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
  }
  await expect(page.locator('[data-global-nav="deep-dives"]')).toHaveAttribute('aria-current', 'page');
});
