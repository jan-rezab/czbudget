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
  ],
  source: { retrieved_at:"2026-08-31T00:00:00Z" },
} };

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/trade/countries", (route) => route.fulfill({ contentType:"application/json", body:JSON.stringify(catalog) }));
  await page.route("**/api/v1/trade?country=*", (route) => route.fulfill({ contentType:"application/json", body:JSON.stringify(profile) }));
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
