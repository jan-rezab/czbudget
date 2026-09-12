import { test, expect } from "@playwright/test";

async function openProjects(page, language = "cs") {
  await page.goto(`/cz/kraje/praha/projekty/?lang=${language}`);
  await expect(page.locator("#pp-integrity")).toHaveText(language === "en" ? "PASSED" : "PROŠLO");
}

test("prague project register renders from the published contract", async ({ page, request }) => {
  const response = await request.get("/data/prague-accountability.v1.json");
  expect(response.ok()).toBe(true);
  const data = await response.json();
  await openProjects(page);
  await expect(page.locator("#pp-kpi-projects")).toHaveText(String(data.stuck_summary.projects));
  await expect(page.locator("#pp-rows tr.pp-row")).toHaveCount(data.stuck_summary.projects);
  await expect(page.locator("#pp-baseline-columns > div")).toHaveCount(data.execution_baseline.length);
  await expect(page.locator("#pp-baseline-columns > div.broken")).toHaveCount(1);
  await expect(page.locator("#pp-checks .coverage-check")).toHaveCount(Object.keys(data.integrity.checks).length);
  await expect(page.locator("#pp-baseline-headline")).toContainText("Praha utratí");
});

test("filters narrow the register and a row opens its decision trail", async ({ page }) => {
  await openProjects(page);
  await page.locator("#pp-filter-status").selectOption("traced");
  const rows = page.locator("#pp-rows tr.pp-row");
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(10);
  await rows.first().click();
  await expect(page.locator("#pp-rows tr.pp-detail")).toHaveCount(1);
  await expect(page.locator("#pp-rows tr.pp-detail .pp-trace h3")).toContainText("Stopa rozhodnutí");
  await page.locator("#pp-filter-entity").selectOption("Hlavní město Praha");
  await expect(page.locator("#pp-rows tr.pp-row td:nth-child(2)").first()).toHaveText("Hlavní město Praha");
});

test("prague projects page is bilingual and removes the paint guard", async ({ page }) => {
  await openProjects(page, "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).not.toHaveAttribute("data-language-pending", "en");
  await expect(page.locator(".pp-hero h1")).toContainText("never builds");
  await expect(page.locator("#pp-baseline-headline")).toContainText("Prague spends");
  await expect(page.locator("#pp-rows tr.pp-row").first().locator("td:last-child")).not.toBeEmpty();
});
