import { test, expect } from "@playwright/test";

test("parallel national-budget route renders the shared modules without replacing country pages", async ({ page }) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") failures.push(message.text()); });

  const response = await page.goto("/national-budgets/germany?lang=en", { waitUntil: "networkidle" });
  expect(response?.ok()).toBeTruthy();
  expect(failures).toEqual([]);
  await expect(page.locator("#country-name")).toHaveText("Germany");
  await expect(page.locator("#budget-kpis article")).toHaveCount(4);
  await expect(page.locator("#economy-kpis")).toContainText("Unemployment");
  await expect(page.locator("#revenue-bars .nb-bar")).toHaveCount(7);
  await expect(page.locator("#spending-bars .nb-bar")).toHaveCount(18);
  await expect(page.locator("#health-kpis article")).toHaveCount(4);
  await expect(page.locator("#demography-kpis article")).toHaveCount(4);
  await expect(page.locator("#insight-cards article")).toHaveCount(5);
  await expect(page.locator("#existing-profile-link")).toHaveAttribute("href", "/countries/germany?lang=en");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");

  await page.goto("/countries/germany?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toHaveClass(/country-page/);
  await expect(page.locator("#country-name")).toHaveText("Germany");
});

test("all 17 dashboard slugs resolve and the selector keeps the parallel route", async ({ page }) => {
  await page.goto("/national-budgets/czechia?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#country-switch option")).toHaveCount(17);
  await page.locator("#country-switch").selectOption("/national-budgets/japan");
  await expect(page).toHaveURL(/\/national-budgets\/japan\?lang=en$/);
  await expect(page.locator("#country-name")).toHaveText("Japan");
});
