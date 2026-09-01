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
  await expect(page.locator("#trade-matrix .trade-matrix-tile")).toHaveCount(5);
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
