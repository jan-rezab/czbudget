import { test, expect } from "@playwright/test";

test("process log separates source, PSD dataset and lifecycle states", async ({ page }) => {
  await page.goto("/process/log/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toHaveText("Data processing and release log");
  await expect(page.locator(".run-log__column-heads")).toContainText("Upstream source");
  await expect(page.locator(".run-log__column-heads")).toContainText("PSD dataset / project");

  const cityvizor = page.locator(".run-log__row", { hasText: "cityvizor-catalogue" });
  await expect(cityvizor).toHaveCount(1);
  await expect(cityvizor.locator(".run-log__lifecycle")).toContainText("received");
  await expect(cityvizor.locator(".run-log__lifecycle")).toContainText("processed");
  await expect(cityvizor.locator(".run-log__lifecycle")).toContainText("published");
  await cityvizor.click();
  await expect(page.locator(".run-log__detail .run-log__wiki")).toContainText("Czech source registry");
  await expect(page.locator(".run-log__detail .run-log__wiki")).toContainText("/czech-sources.html");
});

test("methodology English entry point presents the full registry, not CityVizor", async ({ page }) => {
  await page.goto("/methodology.html?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator(".status-header")).toContainText("Browse the complete source registry");
  await expect(page.locator(".status-header")).not.toContainText("CityVizor");
  await expect(page.locator("#surface-coverage-atlas .surface-map")).toBeVisible();
});
