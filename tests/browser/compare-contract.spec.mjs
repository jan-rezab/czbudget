import { test, expect } from "@playwright/test";

// The comparison page is contract-driven: data/compare-metrics.v1.json decides
// whether a metric ranks, groups, or refuses. These tests assert the three
// renderers actually differ, because a grouped metric that silently falls back
// to a ranked table is exactly the bug the contract exists to prevent.

const page_url = "/comparison.html?lang=cs";

async function openCompare(page) {
  await page.goto(page_url);
  await expect(page.locator("#compare-perimeters .cmp-pill").first()).toBeVisible();
}

test("every perimeter in the registry renders a control", async ({ page }) => {
  await openCompare(page);
  const registry = await page.evaluate(() =>
    fetch("data/compare-metrics.v1.json").then((r) => r.json()));
  await expect(page.locator("#compare-perimeters .cmp-pill"))
    .toHaveCount(registry.perimeters.length);
  await expect(page.locator("#compare-perimeter-note")).not.toBeEmpty();
});

test("a full metric ranks, and missing values sort last without a rank", async ({ page }) => {
  await openCompare(page);
  await expect(page.locator("#compare-contract .cmp-verdict.is-full")).toBeVisible();

  const rows = page.locator("#compare-result .cmp-row");
  expect(await rows.count()).toBeGreaterThan(10);
  await expect(rows.first().locator(".cmp-rank")).toHaveText("01");

  // Values must descend among the rows that carry one.
  const values = await page.locator("#compare-result .cmp-row .cmp-value").allTextContents();
  const numeric = values
    .filter((v) => v.trim() !== "—")
    .map((v) => Number(v.replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", ".")));
  const sorted = [...numeric].sort((a, b) => b - a);
  expect(numeric).toEqual(sorted);
});

test("the sovereign ranking stays at Top 20 and can pin any country", async ({ page }) => {
  await openCompare(page);
  await expect(page.locator("#compare-result .cmp-row")).toHaveCount(20);
  await expect(page.locator("#comparison-country-options option")).toHaveCount(191);
  await expect(page.locator("#comparison-coverage-count")).toHaveText("191 × 20");
  await expect(page.locator("#compare-result .country-flag-svg img").first())
    .toHaveAttribute("src", /assets\/flags\/[a-z]{2}\.svg/);

  const picker = page.locator("#comparison-country");
  await picker.fill("IND");
  await picker.press("Enter");

  const india = page.locator("#compare-result .cmp-row", {
    has: page.locator('a[href*="ind"]'),
  });
  await expect(india).toHaveCount(1);
  await expect(india).toHaveClass(/is-extra/);
  await expect(india.locator(".cmp-rank")).toHaveText("+");
});

test("a conditional metric groups and withholds the global rank", async ({ page }) => {
  await openCompare(page);
  await page.locator('[data-metric="health_gf07_pct_gdp"]').click();

  await expect(page.locator("#compare-contract .cmp-verdict.is-conditional")).toBeVisible();
  await expect(page.locator("#compare-result .cmp-warning")).toBeVisible();
  expect(await page.locator("#compare-result .cmp-group").count()).toBeGreaterThan(1);

  // No row may carry a rank number: ranking across groups is the invalid move.
  const ranks = await page.locator("#compare-result .cmp-row .cmp-rank").allTextContents();
  expect(ranks.every((r) => r.trim() === "")).toBe(true);
});

test("Switzerland is grouped away from the tax-funded systems", async ({ page }) => {
  await openCompare(page);
  await page.locator('[data-metric="health_gf07_pct_gdp"]').click();

  const swissGroup = page.locator("#compare-result .cmp-group", { has: page.locator('a[href*="switzerland"]') });
  const czechGroup = page.locator("#compare-result .cmp-group", { has: page.locator('a[href*="czechia"]') });
  await expect(swissGroup).toHaveCount(1);
  await expect(czechGroup).toHaveCount(1);
  const swissHeading = await swissGroup.locator("h4").textContent();
  const czechHeading = await czechGroup.locator("h4").textContent();
  expect(swissHeading).not.toEqual(czechHeading);
});

test("a national-only metric refuses and its substitute button works", async ({ page }) => {
  await openCompare(page);
  await page.locator('[data-perimeter="municipal"]').click();

  await expect(page.locator("#compare-contract .cmp-verdict.is-refused")).toBeVisible();
  await expect(page.locator("#compare-result .cmp-refusal")).toBeVisible();
  await expect(page.locator("#compare-result .cmp-row")).toHaveCount(0);

  await page.locator("#compare-result .cmp-swap-btn").click();

  // The substitute must land on a metric that actually renders a ranked table.
  await expect(page.locator("#compare-contract .cmp-verdict.is-full")).toBeVisible();
  await expect(page.locator('[data-metric="health_che_pct_gdp"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("#compare-result .cmp-row").count()).toBeGreaterThan(5);
});

test("a country with no reported value shows absence, not a zero", async ({ page }) => {
  await openCompare(page);
  await page.locator('[data-perimeter="health_accounts"]').click();
  await page.locator('[data-metric="health_oop_share"]').click();

  const norway = page.locator("#compare-result .cmp-row", { has: page.locator('a[href*="norway"]') });
  await expect(norway).toHaveCount(1);
  await expect(norway.locator(".cmp-absent")).toBeVisible();
  await expect(norway.locator(".cmp-value")).toHaveText("—");
  await expect(norway.locator(".cmp-rank")).toHaveText("");
});

test("the section is bilingual", async ({ page }) => {
  await openCompare(page);
  const csLabel = await page.locator("#compare-metrics .cmp-pill").first().textContent();

  await page.goto("/comparison.html?lang=en");
  await expect(page.locator("#compare-metrics .cmp-pill").first()).toBeVisible();
  const enLabel = await page.locator("#compare-metrics .cmp-pill").first().textContent();

  expect(csLabel.trim()).not.toEqual(enLabel.trim());
  await expect(page.locator("#compare-contract .cmp-field dd").first()).toContainText("full");
});

// The ownership perimeter answers "who runs the hospitals" from national facility
// registers. Only four of the ten known registers carry named records, so the point of
// the grouping is to show that gap rather than to hide it behind an average.

test("the ownership perimeter groups countries by what their register reveals", async ({ page }) => {
  await openCompare(page);
  await page.locator('[data-perimeter="facility_registers"]').click();

  await expect(page.locator("#compare-contract .cmp-verdict.is-conditional")).toBeVisible();
  await expect(page.locator("#compare-result .cmp-warning")).toBeVisible();

  const groups = await page.locator("#compare-result .cmp-group h4").allTextContents();
  expect(groups.length).toBeGreaterThanOrEqual(2);

  // Every country with a known register appears, loaded or not.
  const networks = await page.evaluate(() =>
    fetch("data/country-provider-networks.v1.json").then((r) => r.json()));
  await expect(page.locator("#compare-result .cmp-row"))
    .toHaveCount(Object.keys(networks.countries).length);

  // Ranking across coverage groups is the invalid move, so no row carries a rank.
  const ranks = await page.locator("#compare-result .cmp-row .cmp-rank").allTextContents();
  expect(ranks.every((r) => r.trim() === "")).toBe(true);
});

test("a register that reveals nothing is shown as absent, not as private", async ({ page }) => {
  await openCompare(page);
  await page.locator('[data-perimeter="facility_registers"]').click();

  // Great Britain's extract is NHS-only, so it reads 100% public by construction.
  const gb = page.locator("#compare-result .cmp-row", { has: page.locator('a[href*="united-kingdom"]') });
  await expect(gb.locator(".cmp-value")).toContainText("100");

  // Germany has a known register with no named records loaded: no value, never a zero.
  const de = page.locator("#compare-result .cmp-row", { has: page.locator('a[href*="germany"]') });
  await expect(de.locator(".cmp-absent")).toBeVisible();
  await expect(de.locator(".cmp-value")).toHaveText("—");
});

test("unresolved ownership is reported as its own metric", async ({ page }) => {
  await openCompare(page);
  await page.locator('[data-perimeter="facility_registers"]').click();
  await page.locator('[data-metric="hospital_unresolved_share"]').click();

  // Two thirds of the Czech register records a legal form that does not name the owner.
  const cz = page.locator("#compare-result .cmp-row", { has: page.locator('a[href*="czechia"]') });
  await expect(cz.locator(".cmp-value")).toContainText("66");
});
