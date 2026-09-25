import { test, expect } from "@playwright/test";

test("process log separates source, PSD dataset and lifecycle states", async ({ page }) => {
  await page.route("**/api/v1/process-log/data-runs", async route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({data: {
      schema_version: "1.0.0", status: "available", events: [{
        schema_version: "1.0.0", event_type: "data_run", event_id: "data-run:example-build",
        timestamp: "2026-09-25T08:00:00Z", outcome: "completed",
        source_id: "un_comtrade", dataset: "budget_detail.trade_observations",
        cloud_build_id: "example-build", lifecycle: {received: true, processed: true, published: false},
        sections: [], source_urls: ["https://comtrade.un.org/"], volume: {responses: 3},
      }],
    }}),
  }));
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

  const dataRun = page.locator(".run-log__row", { hasText: "budget_detail.trade_observations" });
  await expect(dataRun).toContainText("Data run");
  await expect(dataRun.locator(".run-log__lifecycle")).toContainText("not mapped to a public page");
  await dataRun.click();
  await expect(page.locator(".run-log__detail")).toContainText("example-build");
});

test("methodology English entry point presents the full registry, not CityVizor", async ({ page }) => {
  await page.goto("/methodology.html?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator(".status-header")).toContainText("Browse the complete source registry");
  await expect(page.locator(".status-header")).not.toContainText("CityVizor");
  await expect(page.locator("#surface-coverage-atlas .surface-map")).toBeVisible();
});
