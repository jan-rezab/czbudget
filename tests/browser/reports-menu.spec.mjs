import { test, expect } from "@playwright/test";

test("reports navigation opens the reports view in one click", async ({ page }) => {
  await page.goto("/about.html?lang=en", { waitUntil: "networkidle" });
  const reports = page.locator('psd-site-header [data-global-nav="deep-dives"]');
  await expect(reports).toHaveText("Reports");
  await expect(page.locator("psd-site-header .deep-dive-menu")).toHaveCount(0);
  await reports.click();
  await expect(page).toHaveURL(/\/deep-dives\/\?lang=en$/);
  await expect(page.locator(".deep-card").first()).toBeVisible();
  await expect(page.locator('psd-site-header [data-global-nav="deep-dives"]')).toHaveClass(/active/);
});
