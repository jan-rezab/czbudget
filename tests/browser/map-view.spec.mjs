import { test, expect } from "@playwright/test";
import { mockPublishedCoverage } from '../fixtures/published-coverage.mjs';

test.beforeEach(async ({page}) => mockPublishedCoverage(page));

test("map view opens on the global expenditure versus revenue fiscal layer", async ({ page }) => {
  await page.goto("/map.html?lang=en", { waitUntil: "networkidle" });

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('[data-global-nav="map"]')).toHaveClass(/active/);
  await expect(page.locator(".map-canvas svg")).toBeVisible();
  await expect(page.locator("[data-map-country]")).toHaveCount(195);
  await expect(page.locator('[data-map-lens="fiscal"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#map-metric-a")).toHaveValue("expenditure_pct_gdp");
  await expect(page.locator("#map-metric-b")).toHaveValue("revenue_pct_gdp");
  await expect(page.locator("#map-year")).toHaveValue("2024");
  await expect(page.locator(".map-detail")).toContainText("Czechia");
  await expect(page.locator(".map-contract")).toContainText("IMF World Economic Outlook");
  expect(await page.locator(".map-canvas .map-no-data").count()).toBeLessThan(40);
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
  await expect(page.locator(".map-contract")).toContainText("Globální fiskální řady používají harmonizovaný sektor vládních institucí");
  await expect(page.locator("body")).not.toContainText("The public spending map");
});

test('published-section view links current trade grains and the full report catalogue', async ({page}) => {
  await page.goto('/map.html?lang=en&view=published&section=trade_monthly&country=CZE', {waitUntil:'networkidle'});
  await expect(page.locator('.map-workbench')).toBeHidden();
  await expect(page.locator('.map-published-view .surface-map')).toBeVisible();
  await expect(page.locator('#surface-mode')).toHaveValue('trade_monthly');
  await expect(page.locator('.surface-detail')).toContainText('2026–08');
  await expect(page.locator('.surface-detail a', {hasText:'Open section'})).toHaveAttribute('href',/code=CZE&freq=M/);
  await expect(page.locator('.surface-catalogue')).toContainText('Where people work and who employs them');
  await page.locator('[data-map-view="spending"]').click();
  await expect(page.locator('.map-canvas svg')).toBeVisible();
});

test('job-market map uses published estimates, exact source values and only covered countries', async ({page}) => {
  await page.goto('/map.html?lang=en&lens=jobs&country=CZE', {waitUntil:'networkidle'});
  await expect(page.locator('[data-map-lens="jobs"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#map-metric-a')).toHaveValue('services');
  await expect(page.locator('.map-contract')).toContainText('ILO modelled estimates');
  await expect(page.locator('.map-ranking')).toContainText('6 countries · 2024');
  await expect(page.locator('.map-detail')).toContainText('59.1234%');
  await expect(page.locator('.map-detail')).toContainText('fixture-published-job-release');
  await expect(page.locator('.map-detail-head a')).toHaveAttribute('href',/job-market\/\?country=CZE/);
  await page.locator('[data-map-lens="fiscal"]').click();
  await expect(page.locator('#map-metric-a')).toHaveValue('expenditure_pct_gdp');
});
