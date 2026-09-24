import { test, expect } from '@playwright/test';

const range = page => page.evaluate(() => [Number(document.querySelector('#explorer-start').value), Number(document.querySelector('#explorer-end').value)]);
async function ready(page) {
  await page.goto('/chart-explorer.html');
  await expect(page.locator('.explorer-workspace')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#explorer-plot svg')).toBeVisible();
}

test('explorer keeps trend, exact table, calculation and shared URL consistent', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#focus-CZE .explorer-chip-value')).toHaveText('42.858%');
  await page.locator('[data-action="png"]').click();
  await expect(page.locator('[data-action="png"]')).toHaveAttribute('data-export-status', 'complete');
  const point = page.locator('#explorer-plot [data-point]').first();
  await point.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('.psd-plot-tooltip')).toContainText('2006');
  await expect(page.locator('#focus-CZE .explorer-chip-value')).toHaveText('41.468%');
  await page.keyboard.press('Escape');
  await expect(page.locator('.psd-plot-tooltip')).toBeHidden();
  await page.locator('#view-table').click();
  await expect(page.locator('.psd-chart-table')).toContainText('42.858');
  await expect(page.locator('.psd-chart-table thead')).toContainText('Government spending · % of GDP');
  await page.locator('#mode-change').click();
  await expect(page.locator('.psd-chart-table')).toContainText('0.525');
  await page.reload();
  await expect(page.locator('#view-table')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.psd-chart-table')).toContainText('0.525');
  await page.locator('#view-bar').click();
  await expect(page.locator('#explorer-plot')).toHaveAttribute('data-chart-component', 'bar');
});

test('country picker preserves a readable maximum and restores focus', async ({ page }) => {
  await ready(page);
  await page.locator('#explorer-compare').click();
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

test('timeline changes the plot during drag, preserves controls, and commits URL state on release', async ({ page }) => {
  await ready(page);
  await page.locator('#range-5').click();
  expect(await range(page)).toEqual([2020, 2024]);
  const start = page.locator('.psd-range-handle[data-drag=start]');
  await start.scrollIntoViewIfNeeded();
  const box = await start.boundingBox();
  const track = await page.locator('.psd-range-track').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 25);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * 10 / 19, box.y + 25, { steps: 12 });
  await expect(page.locator('#explorer-start')).toHaveValue('2015');
  await expect(page.locator('#explorer-plot [data-point]')).toHaveCount(10);
  // The handle remains connected and captured while the main plot updates.
  await expect(page.locator('#explorer-navigator')).toHaveAttribute('data-dragging', '');
  await page.mouse.up();
  await expect(page).toHaveURL(/start=2015/);
  await expect(page.locator('#explorer-navigator')).not.toHaveAttribute('data-dragging', '');
  await page.locator('#explorer-undo').click();
  expect(await range(page)).toEqual([2020, 2024]);
});

test('plot brush zooms without triggering a point click; undo and double-click restore ranges', async ({ page }) => {
  await ready(page);
  await page.locator('#explorer-plot').scrollIntoViewIfNeeded();
  const a = await page.locator('#explorer-plot [data-point="5"]').boundingBox();
  const b = await page.locator('#explorer-plot [data-point="12"]').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await expect(page.locator('.psd-plot-brush')).toBeVisible();
  await page.mouse.up();
  expect(await range(page)).toEqual([2010, 2017]);
  await expect(page.locator('#explorer-year')).toHaveValue('2017');
  await page.locator('#explorer-undo').click();
  expect(await range(page)).toEqual([2005, 2024]);
  await page.locator('#range-3').click();
  await page.locator('#explorer-plot [data-point="1"]').dblclick();
  expect(await range(page)).toEqual([2005, 2024]);
});

test('keyboard range movement keeps window width, table rows and reduced-motion behavior', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#range-5').click();
  await page.locator('[data-drag=window]').press('ArrowLeft');
  expect(await range(page)).toEqual([2019, 2023]);
  await page.locator('[data-drag=start]').press('ArrowRight');
  expect(await range(page)).toEqual([2020, 2023]);
  await page.locator('#view-table').click();
  await expect(page.locator('.psd-chart-table tbody tr')).toHaveCount(4);
  await expect(page.locator('.psd-chart-table tbody tr').first()).toContainText('2020');
});
