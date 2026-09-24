import { test, expect } from '@playwright/test';

test('explorer keeps trend, exact table, calculation and shared URL consistent', async ({ page }) => {
  await page.goto('/chart-explorer.html');
  await expect(page.locator('.explorer-workspace')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#explorer-plot svg')).toBeVisible();
  await expect(page.locator('.explorer-snapshot')).toContainText('42.858');
  await page.locator('[data-action="png"]').click();
  await expect(page.locator('[data-action="png"]')).toHaveAttribute('data-export-status', 'complete');
  const point = page.locator('#explorer-plot [data-point]').first();
  await point.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('.psd-plot-tooltip')).toContainText('2006');
  await page.keyboard.press('Escape');
  await expect(page.locator('.psd-plot-tooltip')).toBeHidden();
  await page.locator('#view-table').click();
  await expect(page.locator('.psd-chart-table')).toContainText('42.858');
  await expect(page.locator('.psd-chart-table thead')).toContainText('Government spending · % of GDP');
  await page.locator('#mode-change').click();
  await expect(page.locator('.psd-chart-table')).toContainText('0.525');
  await expect(page).toHaveURL(/mode=change/);
  await page.reload();
  await expect(page.locator('#view-table')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.psd-chart-table')).toContainText('0.525');
  await page.locator('#view-bar').click();
  await expect(page.locator('#explorer-plot')).toHaveAttribute('data-chart-component', 'bar');
});

test('country picker preserves a readable maximum and restores focus', async ({ page }) => {
  await page.goto('/chart-explorer.html');
  await page.locator('#explorer-compare').click();
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('input[value="FRA"]')).toBeDisabled();
  await page.locator('input[value="USA"]').uncheck();
  await page.locator('#country-search').fill('France');
  await page.locator('input[value="FRA"]').check();
  await page.getByRole('button', { name: 'Apply comparison' }).click();
  await expect(page.locator('.explorer-chips')).toContainText('France');
  await expect(page.locator('.explorer-chips')).not.toContainText('United States');
  await expect(page.locator('#explorer-compare')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
