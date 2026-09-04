import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Whole-page checks for the repaired families, including both translations.
// No element exclusions: new low-contrast content must fail the release gate.
const routes = ['/', '/comparison.html', '/countries/czechia', '/cz/municipalities/brno/', '/municipalities/brazil/sao-paulo-3550308/'];
for (const route of routes) for (const lang of ['en', 'cs']) {
  test(`${route} has readable text in ${lang}`, async ({ page }) => {
    test.setTimeout(90_000);
    const response = await page.goto(`${route}?lang=${lang}`, { waitUntil: 'networkidle' });
    expect(response.ok()).toBeTruthy();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const audit = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(audit.violations).toEqual([]);
    if (route.includes('/municipalities/')) {
      if (page.viewportSize().width > 860) {
        const rail = await page.locator('.context-rail').boundingBox();
        const main = await page.locator('main').boundingBox();
        expect(main.x).toBeGreaterThanOrEqual(rail.x + rail.width);
      }
      for (const currency of ['USD', 'native']) {
        await page.locator(`[data-profile-currency="${currency}"]`).click();
        await expect(page.locator(`[data-profile-currency="${currency}"]`)).toHaveAttribute('aria-pressed', 'true');
        const changed = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        expect(changed.violations).toEqual([]);
      }
      await page.locator('.raw-detail-audit summary').click();
      const expanded = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(expanded.violations).toEqual([]);
    }
  });
}
