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

  await page.locator("#deep-dive-country").selectOption("DEU");
  await expect(page.locator('[data-oecd-chart="redistribution_summary"] .summary-eyebrow')).toContainText("Germany");
  await expect(page.locator('[data-oecd-chart="redistribution_comparison"] tbody tr.is-selected th')).toHaveText("Germany");
});

test("redistribution definitions are available in Czech", async ({ page }) => {
  await page.goto("/deep-dives/redistribution/?code=CZE&lang=cs", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle("Daně, transfery a příjmová nerovnost — Public Spending Data");
  await expect(page.locator("h1")).toContainText("příjmovou nerovnost");
  await expect(page.locator('[data-oecd-chart="socx_composition"]')).toContainText("% HDP");
  await expect(page.locator("#sources")).toContainText("pod 50 % mediánu");
});
