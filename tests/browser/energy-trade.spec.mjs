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
        { frequency: "M", period: "202603", period_start: "2026-03-01", reporting_markets: 1, reported_origins: 1, observed_value_usd: 5, retrieved_at: "2026-09-20" },
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
  return { data: { schema_version: "energy-trade-flows.v1", product: { id: product, code, name: product }, frequency, period, routes, totals: { observed_value_usd: 180, reporting_markets: 2, reported_origins: 2 }, source: { retrieved_at: "1.7898624E9" } } };
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
  await expect(page.locator("#energy-country")).toHaveValue("NOR");
  await page.locator("#energy-frequency").selectOption("M");
  await expect(page.locator("#energy-period")).toHaveValue("202601");
  await expect(page).toHaveURL(/frequency=M/);
  await expect(page.locator("#energy-country")).toHaveValue("NOR");
  await expect(page.locator("#energy-vintage")).toHaveText("Retrieved 2026-09-20");
  await page.reload();
  await expect(page.locator("#energy-country")).toHaveValue("NOR");
  await page.goto("/deep-dives/energy-trade/?lang=en");
  await expect(page.locator("#energy-country")).toHaveValue("NOR");
  await page.goto("/deep-dives/energy-trade/?lang=en&country=USA");
  await expect(page.locator("#energy-country")).toHaveValue("USA");
  await page.locator("#energy-reset").click();
  await page.goto("/deep-dives/energy-trade/?lang=en");
  await expect(page.locator("#energy-country")).toHaveValue("ALL");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("an unavailable monthly gas series clears the previous product without a failing query", async ({ page }) => {
  const invalidRequests = [];
  page.on("request", request => { if (request.url().includes("period=null")) invalidRequests.push(request.url()); });
  await page.goto("/deep-dives/energy-trade/?lang=en");
  await expect(page.locator(".energy-route-group")).toHaveCount(3);
  await page.locator("#energy-country").selectOption("NOR");
  await page.locator('[data-product="gas"]').click();
  await expect(page.locator("#energy-status")).toContainText("Natural gas");
  await page.locator("#energy-frequency").selectOption("M");
  await expect(page.locator("#energy-status")).toContainText("No data is published yet");
  await expect(page.locator("#energy-routes")).toBeEmpty();
  await expect(page.locator("#energy-kpis")).toBeEmpty();
  await expect(page.locator("#energy-country")).toHaveValue("NOR");
  await page.locator("#energy-reset").click();
  await expect(page.locator("#energy-country")).toHaveValue("ALL");
  await expect(page).not.toHaveURL(/country=/);
  expect(invalidRequests).toEqual([]);
});

test("yearly playback restarts at the beginning, keeps the country and stops at the end", async ({ page }) => {
  await page.clock.install();
  await page.goto("/deep-dives/energy-trade/?lang=en&country=NOR");
  await expect(page.locator(".energy-route-group")).toHaveCount(2);
  await page.locator("#energy-play").click();
  await expect(page.locator("#energy-period")).toHaveValue("2024");
  await expect(page.getByRole("button", { name: "Period", exact: true })).toContainText("2024");
  await expect(page.locator("#energy-map")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#energy-play")).toHaveText("Ⅱ Pause");
  await page.clock.runFor(1500);
  await expect(page.locator("#energy-period")).toHaveValue("2025");
  await expect(page.getByRole("button", { name: "Period", exact: true })).toContainText("2025");
  await expect(page.locator("#energy-play")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#energy-country")).toHaveValue("NOR");
  await expect(page.locator(".energy-route-group")).toHaveCount(2);
  await page.getByRole("button", { name: "Previous period", exact: true }).click();
  await expect(page.locator("#energy-period")).toHaveValue("2024");
  await expect(page.locator("#energy-map")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Next period", exact: true }).click();
  await expect(page.locator("#energy-period")).toHaveValue("2025");
});

test("monthly playback can pause and scrub without discarding a country missing from a frame", async ({ page }) => {
  await page.clock.install();
  await page.route("**/api/v1/trade/energy/flows?*", route => {
    const url = new URL(route.request().url());
    const response = flows(url);
    if (url.searchParams.get("period") === "202602") response.data.routes = response.data.routes.filter(row => row.market.code !== "CZE");
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(response) });
  });
  await page.goto("/deep-dives/energy-trade/?lang=en&frequency=M&period=202601&country=CZE");
  await expect(page.locator(".energy-route-group")).toHaveCount(1);
  await page.locator("#energy-play").click();
  await page.clock.runFor(1500);
  await expect(page.locator("#energy-status")).toContainText("no reported routes");
  await expect(page.locator("#energy-country")).toHaveValue("CZE");
  await expect(page.locator("#energy-kpis strong")).toHaveText(["—", "—", "—", "—"]);
  await page.locator("#energy-play").click();
  await page.clock.runFor(5000);
  await expect(page.locator("#energy-period")).toHaveValue("202602");
  await page.locator("#energy-play").click();
  await page.clock.runFor(1500);
  await expect(page.locator("#energy-period")).toHaveValue("202603");
  await expect(page.locator(".energy-route-group")).toHaveCount(1);
  await expect(page.locator("#energy-play")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#energy-timeline").focus();
  await page.keyboard.press("Home");
  await expect(page.locator("#energy-period")).toHaveValue("202601");
  await expect(page).toHaveURL(/country=CZE/);
  await expect(page.locator("#energy-map")).toHaveAttribute("aria-busy", "false");
  await page.locator("#energy-frequency").selectOption("A");
  await expect(page.locator("#energy-country")).toHaveValue("CZE");
  await expect(page.locator("#energy-playback-label")).toHaveText("Year by year");
});

test("playback waits for a slow frame and ignores its response after a product change", async ({ page }) => {
  await page.clock.install();
  const requested = [];
  let releaseFrame;
  const frameGate = new Promise(resolve => { releaseFrame = resolve; });
  await page.route("**/api/v1/trade/energy/flows?*", async route => {
    const url = new URL(route.request().url());
    requested.push(url.searchParams.get("period"));
    if (url.searchParams.get("product") === "petroleum" && url.searchParams.get("period") === "202602") await frameGate;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(flows(url)) });
  });
  await page.goto("/deep-dives/energy-trade/?lang=en&frequency=M&period=202601&country=NOR");
  await expect(page.locator(".energy-route-group")).toHaveCount(2);
  await page.locator("#energy-play").click();
  await page.clock.runFor(1500);
  await expect(page.locator("#energy-map")).toHaveAttribute("aria-busy", "true");
  await page.clock.runFor(5000);
  expect(requested).not.toContain("202603");
  await expect(page.locator(".energy-route-group")).toHaveCount(2);
  await page.locator('[data-product="lng"]').click();
  await expect(page.locator("#energy-status")).toContainText("LNG");
  releaseFrame();
  await expect(page.locator("#energy-country")).toHaveValue("NOR");
  await expect(page.locator("#energy-play")).toBeDisabled();
  await expect(page.locator("#energy-map svg")).toHaveAttribute("aria-label", "LNG · Jan 2026");
});

test("play becomes available after the first frame is ready", async ({ page }) => {
  let releaseFrame;
  const frameGate = new Promise(resolve => { releaseFrame = resolve; });
  await page.route("**/api/v1/trade/energy/flows?*", async route => {
    await frameGate;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(flows(new URL(route.request().url()))) });
  });
  await page.goto("/deep-dives/energy-trade/?lang=en");
  await expect(page.locator("#energy-period")).toHaveValue("2025");
  await expect(page.locator("#energy-map")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#energy-play")).toBeDisabled();
  releaseFrame();
  await expect(page.locator("#energy-play")).toBeEnabled();
  await page.locator("#energy-play").click();
  await expect(page.locator("#energy-period")).toHaveValue("2024");
});
