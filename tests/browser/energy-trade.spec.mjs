import { test, expect } from "@playwright/test";

const periods = {
  data: {
    schema_version: "energy-trade-periods.v1",
    products: [
      { id: "petroleum", code: "270900", name: "Crude petroleum", periods: [
        { frequency: "A", period: "2024", period_start: "2024-01-01", reporting_markets: 3, reported_origins: 3, observed_value_usd: 240, retrieved_at: "2026-09-20" },
        { frequency: "A", period: "2025", period_start: "2025-01-01", reporting_markets: 2, reported_origins: 3, observed_value_usd: 180, retrieved_at: "2026-09-20" },
        { frequency: "M", period: "202601", period_start: "2026-01-01", reporting_markets: 3, reported_origins: 3, observed_value_usd: 24, retrieved_at: "2026-09-20" },
        { frequency: "M", period: "202602", period_start: "2026-02-01", reporting_markets: 1, reported_origins: 1, observed_value_usd: 4, retrieved_at: "2026-09-20" },
      ] },
      { id: "lng", code: "271111", name: "Liquefied natural gas", periods: [
        { frequency: "A", period: "2025", period_start: "2025-01-01", reporting_markets: 2, reported_origins: 2, observed_value_usd: 90, retrieved_at: "2026-09-20" },
        { frequency: "M", period: "202601", period_start: "2026-01-01", reporting_markets: 2, reported_origins: 2, observed_value_usd: 9, retrieved_at: "2026-09-20" },
      ] },
      { id: "gas", code: "271121", name: "Natural gas in gaseous state", periods: [{ frequency: "A", period: "2025", period_start: "2025-01-01", reporting_markets: 2, reported_origins: 2, observed_value_usd: 80, retrieved_at: "2026-09-20" }] },
    ],
  },
};

function flows(url) {
  const product = url.searchParams.get("product") || "petroleum", period = url.searchParams.get("period") || "2025", frequency = url.searchParams.get("frequency") || "A";
  const code = product === "lng" ? "271111" : product === "gas" ? "271121" : "270900";
  const routes = [
    { origin: { code: "NOR", iso2: "NO", name: "Norway" }, market: { code: "DEU", iso2: "DE", name: "Germany" }, value_usd: 100, net_weight_kg: 50e9, net_weight_is_estimated: false },
    { origin: { code: "USA", iso2: "US", name: "United States" }, market: { code: "DEU", iso2: "DE", name: "Germany" }, value_usd: 50, net_weight_kg: 20e9, net_weight_is_estimated: true },
    { origin: { code: "NOR", iso2: "NO", name: "Norway" }, market: { code: "CZE", iso2: "CZ", name: "Czechia" }, value_usd: 30, net_weight_kg: 10e9, net_weight_is_estimated: false },
  ];
  return { data: { schema_version: "energy-trade-flows.v1", product: { id: product, code, name: product }, frequency, period, routes, totals: { observed_value_usd: 180, reporting_markets: 2, reported_origins: 2 }, source: { retrieved_at: "2026-09-20" } } };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/trade/energy/periods", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(periods) }));
  await page.route("**/api/v1/trade/energy/flows?*", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(flows(new URL(route.request().url()))) }));
});

test("energy map defaults to petroleum and filters annual, monthly and country routes", async ({ page }) => {
  await page.goto("/deep-dives/energy-trade/?lang=en");
  await expect(page).toHaveTitle("World oil and gas trade — Public Spending Data");
  await expect(page.locator('[data-product="petroleum"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".energy-route-group")).toHaveCount(3);
  await expect(page.locator("#energy-status")).toContainText("Crude petroleum");
  await page.locator("#energy-country").selectOption("NOR");
  await expect(page.locator(".energy-route-group")).toHaveCount(2);
  await page.locator('[data-product="lng"]').click();
  await expect(page).toHaveURL(/product=lng/);
  await expect(page.locator('[data-product="lng"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("#energy-frequency").selectOption("M");
  await expect(page.locator("#energy-period")).toHaveValue("202601");
  await expect(page).toHaveURL(/frequency=M/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("an unavailable monthly gas series clears the previous product without a failing query", async ({ page }) => {
  const invalidRequests = [];
  page.on("request", request => { if (request.url().includes("period=null")) invalidRequests.push(request.url()); });
  await page.goto("/deep-dives/energy-trade/?lang=en");
  await expect(page.locator(".energy-route-group")).toHaveCount(3);
  await page.locator('[data-product="gas"]').click();
  await expect(page.locator("#energy-status")).toContainText("Natural gas");
  await page.locator("#energy-frequency").selectOption("M");
  await expect(page.locator("#energy-status")).toContainText("No data is published yet");
  await expect(page.locator("#energy-routes")).toBeEmpty();
  await expect(page.locator("#energy-kpis")).toBeEmpty();
  expect(invalidRequests).toEqual([]);
});
