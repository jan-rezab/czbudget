import { test, expect } from '@playwright/test';

// Always part of the fast preflight, before expensive published-data hydration.
test('shared navigation exposes the same primary destinations on narrow and wide screens', async ({ page }) => {
  await page.goto('/stories/?lang=en');
  for (const width of [390, 1200, 1440]) {
    await page.setViewportSize({width,height:900});
    const nav=page.locator('.global-nav');
    await expect(nav).toContainText('Stories');
    const items=await nav.locator(':scope > a, :scope > details > summary').allTextContents();
    expect(items.map(item=>item.replace(/\s+/g,''))).toEqual(['Country⌄','Municipalities⌄','Compare','Map','Reports⌄','Stories','Coverage','About']);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
