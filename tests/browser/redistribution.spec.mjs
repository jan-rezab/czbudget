import { expect, test } from "@playwright/test";

test("redistribution report leads with the measured gap and keeps context separate", async ({ page }) => {
  const response = await page.goto("/deep-dives/redistribution/?code=CZE&lang=en", { waitUntil: "networkidle" });
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle("Taxes, transfers and income inequality — Public Spending Data");

  await expect(page.locator('[data-oecd-chart="redistribution_hero_stat"]')).toContainText("−43.6 %");
  await expect(page.locator('[data-oecd-chart="redistribution_summary"]')).toContainText("43.6%");
  await expect(page.locator('[data-oecd-chart="redistribution_summary"]')).toContainText("0.429 → 0.242");
  await expect(page.locator('[data-oecd-chart="redistribution_bridge"] .oecd-bridge-track')).toHaveCount(2);
  await expect(page.locator('[data-oecd-chart="redistribution_comparison"] tbody tr.is-selected th')).toHaveText("Czechia");
  await expect(page.locator('[data-oecd-chart="socx_composition"]')).toContainText("Separate aggregate");
  await expect(page.locator('[data-oecd-chart="socx_composition"]')).toContainText("% GDP");
  await expect(page.locator("#sources")).toContainText("below 50% of their country’s median");
  await expect(page.locator("#pensions, #relationship, #outcomes")).toHaveCount(0);

  const plot=page.locator('[data-redistribution-plot]');
  await expect(plot).toHaveAttribute('data-chart-component','bar');
  const usMark=plot.getByRole('button', {name:/United States/});
  await usMark.focus();
  await expect(plot.locator('.psd-plot-tooltip')).toContainText('United States');
  await expect(plot.locator('.psd-plot-tooltip')).toContainText('Before taxes and transfers');
  await expect(plot.locator('.psd-plot-tooltip')).toContainText('After taxes and transfers');
  await page.keyboard.press('Escape');
  await expect(plot.locator('.psd-plot-tooltip')).toBeHidden();
  await expect(plot.locator('rect[fill="#c93237"]')).toHaveCount(1);
  await page.locator('[data-redistribution-figure] [data-action="table"]').click();
  await expect(page.locator('[data-redistribution-figure] .psd-chart-table')).toContainText('United States');
  await expect(page.locator('[data-redistribution-figure] .psd-chart-table')).toContainText('source year');

  await page.locator("#deep-dive-country").selectOption("DEU");
  await expect(page.locator('[data-oecd-chart="redistribution_summary"] .redistribution-summary > div:first-child .summary-eyebrow')).toContainText("Germany");
  await expect(page.locator('[data-oecd-chart="redistribution_comparison"] tbody tr.is-selected th')).toHaveText("Germany");
  await expect(plot.getByRole("button", {name:/Germany/})).toHaveCount(1);
  await expect(plot.locator('rect[fill="#c93237"]')).toHaveCount(1);
});

test("redistribution definitions are available in Czech", async ({ page }) => {
  await page.goto("/deep-dives/redistribution/?code=CZE&lang=cs", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle("Daně, transfery a příjmová nerovnost — Public Spending Data");
  await expect(page.locator("h1")).toContainText("příjmovou nerovnost");
  await expect(page.locator('[data-oecd-chart="socx_composition"]')).toContainText("% HDP");
  await expect(page.locator("#sources")).toContainText("pod 50 % mediánu");
});
