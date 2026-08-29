import { test, expect } from "@playwright/test";

test("map view opens as an education versus defence budget duel", async ({ page }) => {
  await page.goto("/map.html?lang=en", { waitUntil: "networkidle" });

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('[data-global-nav="map"]')).toHaveClass(/active/);
  await expect(page.locator(".map-canvas svg")).toBeVisible();
  await expect(page.locator("[data-map-country]")).toHaveCount(195);
  await expect(page.locator("#map-metric-a")).toHaveValue("defence");
  await expect(page.locator("#map-metric-b")).toHaveValue("education_research");
  await expect(page.locator(".map-detail")).toContainText("Czechia");
  await expect(page.locator(".map-detail")).toContainText("6.8%");
  await expect(page.locator(".map-detail")).toContainText("12.5%");
  await expect(page.locator(".map-contract")).toContainText("not harmonised COFOG");
});

test("map lenses, year and single-layer mode update the visual state", async ({ page }) => {
  await page.goto("/map.html?lang=en", { waitUntil: "networkidle" });

  await page.locator('[data-map-lens="functions"]').click();
  await expect(page.locator("#map-metric-a")).toHaveValue("social");
  await expect(page.locator("#map-metric-b")).toHaveValue("health");
  await page.locator("#map-year").fill("2020");
  await expect(page).toHaveURL(/year=2020/);
  await expect(page.locator(".map-detail")).toContainText("2020");

  await page.locator('[data-map-mode="single"]').click();
  await expect(page.locator(".map-control-deck")).toHaveClass(/is-single/);
  await expect(page.locator(".map-canvas [class*='map-q']").first()).toBeVisible();

  await page.locator('[data-map-lens="fiscal"]').click();
  await expect(page.locator("#map-metric-a")).toHaveValue("expenditure_pct_gdp");
  await expect(page.locator(".map-ranking")).toContainText("2024");
});

test("map view switches all visible interface copy to Czech", async ({ page }) => {
  await page.goto("/map.html?lang=cs", { waitUntil: "networkidle" });
  await expect(page.locator(".map-hero h1")).toHaveText("Mapa veřejných výdajů");
  await expect(page.locator('[data-map-mode="duel"]')).toHaveText("Souboj");
  await expect(page.locator(".map-contract")).toContainText("Nejde o harmonizovanou COFOG statistiku");
  await expect(page.locator("body")).not.toContainText("The public spending map");
});
