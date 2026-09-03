import { expect, test } from "@playwright/test";

const catalog = { data: { countries: [{ code: "CZE", name: "Czechia", latest_annual_period: "2025", latest_monthly_period: "202506" }] } };
const profile = { data: {
  country: "CZE", currency: "USD", valuation: { imports: "CIF", exports: "FOB" },
  totals: [
    { period:"2024",period_start:"2024-01-01",year:2024,month:52,frequency:"A",flow:"import",value_usd:100 },
    { period:"2024",period_start:"2024-01-01",year:2024,month:52,frequency:"A",flow:"export",value_usd:120 },
    { period:"2025",period_start:"2025-01-01",year:2025,month:52,frequency:"A",flow:"import",value_usd:150 },
    { period:"2025",period_start:"2025-01-01",year:2025,month:52,frequency:"A",flow:"export",value_usd:125 },
    { period:"202505",period_start:"2025-05-01",year:2025,month:5,frequency:"M",flow:"import",value_usd:12 },
    { period:"202505",period_start:"2025-05-01",year:2025,month:5,frequency:"M",flow:"export",value_usd:14 },
    { period:"202506",period_start:"2025-06-01",year:2025,month:6,frequency:"M",flow:"import",value_usd:15 },
    { period:"202506",period_start:"2025-06-01",year:2025,month:6,frequency:"M",flow:"export",value_usd:13 },
  ],
  partners: [
    {year:2025,flow:"export",code:"DEU",name:"Germany",value_usd:50},
    {year:2025,flow:"import",code:"DEU",name:"Germany",value_usd:60},
    {year:2025,flow:"export",code:"USA",name:"United States",value_usd:38},
    {year:2025,flow:"import",code:"USA",name:"United States",value_usd:18},
    {year:2025,flow:"export",code:"FRA",name:"France",value_usd:22},
    {year:2025,flow:"import",code:"CHN",name:"China",value_usd:44},
    {year:2025,flow:"import",code:"POL",name:"Poland",value_usd:28},
  ],
  products: [
    {year:2025,flow:"export",code:"87",name:"Vehicles",value_usd:40},
    {year:2025,flow:"import",code:"87",name:"Vehicles",value_usd:30},
    {year:2025,flow:"export",code:"84",name:"Machinery",value_usd:34},
    {year:2025,flow:"import",code:"84",name:"Machinery",value_usd:48},
    {year:2025,flow:"export",code:"85",name:"Electrical equipment",value_usd:22},
    {year:2025,flow:"import",code:"85",name:"Electrical equipment",value_usd:37},
    {year:2025,flow:"export",code:"27",name:"Mineral fuels",value_usd:8},
    {year:2025,flow:"import",code:"27",name:"Mineral fuels",value_usd:31},
    {year:2025,flow:"export",code:"30",name:"Pharmaceutical products",value_usd:18},
    {year:2025,flow:"import",code:"30",name:"Pharmaceutical products",value_usd:12},
    {year:2025,flow:"export",code:"93",name:"Arms and ammunition",value_usd:0.001},
    {year:2025,flow:"import",code:"93",name:"Arms and ammunition",value_usd:0.001},
  ],
  source: { retrieved_at:"2026-08-31T00:00:00Z" },
} };
const productPartners = { data: { country:"CZE", product_code:"87", year:2025, partners:[
  {year:2025,flow:"export",code:"DEU",name:"Germany",value_usd:20},
  {year:2025,flow:"import",code:"CHN",name:"China",value_usd:18},
] } };

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/trade/countries", (route) => route.fulfill({ contentType:"application/json", body:JSON.stringify(catalog) }));
  await page.route("**/api/v1/trade?country=*", (route) => route.fulfill({ contentType:"application/json", body:JSON.stringify(profile) }));
  await page.route("**/api/v1/trade/product-partners?country=*&product=*", (route) => route.fulfill({ contentType:"application/json", body:JSON.stringify(productPartners) }));
});

test("trade deep dive exposes balance, chart state, and linked rankings", async ({ page }) => {
  await page.goto("/deep-dives/trade/?code=CZE&lang=en");
  await expect(page.locator("#trade-kpis")).toContainText("Deficit");
  await expect(page.locator('#trade-chart svg[aria-label="Imports, Exports"]')).toHaveCount(1);
  await expect(page.locator("#trade-chart path.series")).toHaveCount(2);
  await page.getByRole("button", { name:"Monthly" }).click();
  await expect(page).toHaveURL(/freq=M/);
  await expect(page.locator("#trade-selected-period")).toContainText("2025–06");
  await page.locator("#trade-partners button").first().click();
  await expect(page.locator("#trade-detail")).toContainText("Germany");
  await expect(page.locator("#trade-detail")).toContainText("Opposite flow");
});

test("trade market map sizes, zooms, and drills from product to partner", async ({ page }) => {
  await page.goto("/deep-dives/trade/?code=CZE&lang=en");
  await expect(page.locator("#trade-matrix .trade-matrix-tile")).toHaveCount(6);
  await expect(page.locator('#trade-matrix [data-product="87"] b')).toHaveText("Vehicles");
  await expect(page.locator('#trade-matrix [data-product="87"] span')).toHaveText("HS 87");
  await page.locator('#trade-size-metric [data-size="export"]').click();
  await expect(page).toHaveURL(/size=export/);
  await page.getByRole("button", { name:"Open sector: Transport equipment" }).click();
  await expect(page).toHaveURL(/sector=transport/);
  await expect(page.locator('#trade-matrix [data-product="87"]')).toHaveCount(1);
  await page.locator('#trade-matrix [data-product="87"]').click();
  await expect(page.locator("#trade-market-drawer")).toContainText("Vehicles");
  await expect(page.locator("#trade-market-drawer")).toContainText("Germany");
  await page.locator('#trade-market-drawer [data-drawer-flow="import"]').click();
  await expect(page.locator("#trade-market-drawer")).toContainText("China");
  await page.locator("#trade-market-drawer [data-close]").click();
  await expect(page).not.toHaveURL(/product=87/);
});

test("country markets show destinations and origins with clickable bilateral detail", async ({ page }) => {
  await page.goto("/deep-dives/trade/?code=CZE&lang=en#routes");
  await expect(page.locator("#trade-export-routes .trade-route-tile")).toHaveCount(3);
  await expect(page.locator("#trade-import-routes .trade-route-tile")).toHaveCount(4);
  await expect(page.locator('#trade-export-routes [data-partner="USA"] b')).toHaveText("United States");
  await page.locator('#trade-export-routes [data-partner="DEU"]').click();
  await expect(page).toHaveURL(/partner=DEU/);
  await expect(page.locator("#trade-route-detail")).toContainText("Germany");
  await expect(page.locator("#trade-route-detail")).toContainText("Bilateral balance");
  await expect(page.locator("#trade-route-detail")).toContainText("Share of exports");
  await expect(page.locator("#trade-route-detail")).toContainText("Share of imports");
});

test("product intelligence switches business areas and EU aggregation without losing flow totals", async ({ page }) => {
  await page.goto("/deep-dives/product-markets/?lang=en#product-intelligence-view");
  await expect(page).toHaveTitle("Global product markets — Public Spending Data");
  await expect(page.locator("#product-intelligence-kpis")).toContainText("$180.7B");
  await expect(page.locator("#product-flow svg")).toHaveCount(1);
  await expect(page.locator("#product-flow .flow-link")).toHaveCount(61);
  await expect(page.locator("#product-markets")).toContainText("EU-27");
  await page.locator("#product-area").selectOption("PASSENGER_VEHICLES");
  await expect(page.locator("#product-intelligence-kpis")).toContainText("$693.2B");
  await page.locator("#product-geography").selectOption("COUNTRY");
  await expect(page.locator("#product-origins .product-rank-row").first()).toContainText("Germany");
  await expect(page).toHaveURL(/area=PASSENGER_VEHICLES/);
  await expect(page).toHaveURL(/geo=COUNTRY/);
  await expect(page.locator("#product-history .history-point")).toHaveCount(1);
});

test("trade is registered in reports and the language switch translates the whole page", async ({ page }) => {
  await page.goto("/deep-dives/trade/?code=CZE&lang=cs");
  await expect(page).toHaveTitle("Zahraniční obchod — Public Spending Data");
  await expect(page.locator("#overview h1")).toContainText("Obchodní trh");
  const menuLink = page.locator('psd-site-header .deep-dive-menu-panel a[href*="/deep-dives/trade/"]');
  await expect(menuLink).toContainText("Zahraniční obchod");
  await page.locator('psd-site-header [data-lang="en"]').click();
  await expect(page).toHaveURL(/lang=en/);
  await expect(page).toHaveTitle("Foreign trade — Public Spending Data");
  await expect(page.locator("#overview h1")).toContainText("The trade market");
  await expect(page.locator("#matrix h2")).toHaveText("The goods market as a portfolio");
  await expect(page.locator("#routes h2")).toHaveText("Where exports go. Where imports come from.");
  await expect(page.locator("#method h2")).toHaveText("One balance, two valuation bases");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Imports, exports, the trade balance/);

  await page.goto("/deep-dives/?lang=en");
  await expect(page.locator("#trade")).toContainText("Foreign trade");
  await expect(page.locator("#product-markets")).toContainText("Global product markets");
  await expect(page.locator('psd-site-header .deep-dive-menu-panel a[href*="/deep-dives/trade/"]')).toContainText("Foreign trade");
  await expect(page.locator('psd-site-header .deep-dive-menu-panel a[href*="/deep-dives/product-markets/"]')).toContainText("Global product markets");
});

test("product markets translate independently from the country trade report", async ({ page }) => {
  await page.goto("/deep-dives/product-markets/?lang=cs");
  await expect(page).toHaveTitle("Globální produktové trhy — Public Spending Data");
  await expect(page.locator("#overview h1")).toContainText("Sledujte produkt");
  await page.locator('psd-site-header [data-lang="en"]').click();
  await expect(page).toHaveURL(/lang=en/);
  await expect(page).toHaveTitle("Global product markets — Public Spending Data");
  await expect(page.locator("#overview h1")).toContainText("Follow a product");
  await expect(page.locator("#product-intelligence-view h2")).toHaveText("Who supplies. Who buys. Where the market is moving.");
  await expect(page.locator("#method h2")).toHaveText("Origin is not the same as manufacturer");
});

test("legacy country-report product links move to the standalone report and preserve filters", async ({ page }) => {
  await page.goto("/deep-dives/trade/?code=CZE&lang=en&area=SMARTPHONES&geo=COUNTRY&product_period=2025#product-intelligence");
  await expect(page).toHaveURL(/\/deep-dives\/product-markets\/\?lang=en&area=SMARTPHONES&geo=COUNTRY&product_period=2025#product-intelligence-view/);
  await expect(page.locator("#product-geography")).toHaveValue("COUNTRY");
});
