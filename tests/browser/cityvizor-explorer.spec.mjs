import { expect, test } from "@playwright/test";

const profileKey = "cityvizor.cz/1";
const pboProfileKey = "cityvizor.cz/100";
const columns = {
  accounting: ["type", "paragraph", "item", "unit", "event", "income_actual_cents", "income_budget_cents", "expenditure_actual_cents", "expenditure_budget_cents"],
  events: ["event", "name", "income_actual_cents", "income_budget_cents", "expenditure_actual_cents", "expenditure_budget_cents"],
  plans: ["synthetic_account", "analytic_account", "analytic_label", "income_actual_cents", "income_budget_cents", "expenditure_actual_cents", "expenditure_budget_cents"],
  payments: ["row_id", "date", "income_cents", "expenditure_cents", "counterparty_id", "counterparty_name", "description", "paragraph", "item", "unit", "event"],
};

const layerRows = {
  accounting: [["UCT", "2212", "5169", null, "A1", 0, 0, 12345600, 14000000]],
  events: [["A1", "Oprava místní komunikace", 0, 0, 12345600, 14000000]],
  plans: [["5", "501", "Spotřeba materiálu", 0, 0, 5000000, 7500000]],
  payments: [
    ["one", "2025-04-10", 0, 12345600, "12345678", "Dodavatel silnic s.r.o.", "Oprava vozovky", "2212", "5169", null, "A1"],
    ["two", "2025-03-02", 0, -500, "source:broken", "Město �", "Oprava znaku �", "6171", "5162", null, null],
    ["three", "2025-02-01", 250000, 0, null, null, "Vrácený přeplatek", "2212", "2324", null, null],
  ],
};
const pboLayerRows = {
  accounting: [["KDF", null, "501", null, null, 0, 0, 250000, 0]],
  events: [],
  plans: [["5", "501", "Spotřeba materiálu", 0, 0, 250000, 300000]],
  payments: [["pbo-one", "2025-05-01", 0, 250000, "supplier:1", "Školní dodavatel", "Materiál", null, "501", null, null]],
};

async function mockCityVizor(page) {
  await page.route("**/public-data/cityvizor/index", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      schema_version: "1.0.0", profile_count: 2,
      profiles: [
        { key: profileKey, data_slug: "legacy-profile-slug", name: "Nové Město na Moravě", ico: "00294900", type: "municipality", instance: "https://cityvizor.cz", profile_url: "https://cityvizor.cz/nmnm", available_years: [2025], payment_years: [2025], record_counts: { accounting: 1, events: 1, plans: 1, payments: 3 } },
        { key: pboProfileKey, name: "Základní škola", ico: "71209859", type: "pbo", instance: "https://cityvizor.cz", profile_url: "https://cityvizor.cz/skola", available_years: [2025], payment_years: [2025], record_counts: { accounting: 1, events: 0, plans: 1, payments: 1 } },
      ],
    }),
  }));
  await page.route("**/public-data/cityvizor/codelists", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ codelists: { paragraphs: [{ id: "2212", name: "Silnice", validFrom: "1900-01-01", validTill: null }, { id: "6171", name: "Činnost místní správy", validFrom: "1900-01-01", validTill: null }], items: [{ id: "5169", name: "Nákup ostatních služeb", validFrom: "1900-01-01", validTill: null }, { id: "5162", name: "Služby elektronických komunikací", validFrom: "1900-01-01", validTill: null }, { id: "2324", name: "Přijaté nekapitálové příspěvky", validFrom: "1900-01-01", validTill: null }], "pbo-su": [{ id: "501", name: "Spotřeba materiálu", validFrom: "1900-01-01", validTill: null }] } }),
  }));
  await page.route("**/public-data/cityvizor/profile?**", (route) => {
    const key = new URL(route.request().url()).searchParams.get("key"); const isPbo = key === pboProfileKey; const sourceRows = isPbo ? pboLayerRows : layerRows;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({
      profile: { key, name: isPbo ? "Základní škola" : "Nové Město na Moravě", ico: isPbo ? "71209859" : "00294900", type: isPbo ? "pbo" : "municipality" }, contracts: { rows: 0, records: [] },
      noticeboard: { rows: isPbo ? 0 : 1, records: isPbo ? [] : [{ date: "2025-06-01", title: "Rozpočtové opatření", document_url: "https://example.test/document" }] },
      years: [{ year: 2025, annual_finance: { recomputed_from_accounting: { income_actual_cents: 250000, income_budget_cents: 300000, expenditure_actual_cents: 12345100, expenditure_budget_cents: 14000000 } }, assets: Object.fromEntries(Object.keys(columns).map((layer) => [layer, sourceRows[layer].length ? [{ part: 1, rows: sourceRows[layer].length }] : []])), payments: { rows: sourceRows.payments.length, exact_duplicate_groups: 0 } }],
    }) });
  });
  await page.route("**/public-data/cityvizor/shard?**", (route) => {
    const url = new URL(route.request().url()); const layer = url.searchParams.get("layer"); const key = url.searchParams.get("key"); const sourceRows = key === pboProfileKey ? pboLayerRows : layerRows;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ kind: layer, profile_key: key, year: 2025, columns: columns[layer], rows: sourceRows[layer] }) });
  });
}

test("CityVizor explorer resolves an IČO deep link and exposes normalized profile layers", async ({ page }) => {
  await mockCityVizor(page);
  await page.goto("/cityvizor/?lang=cs&ico=00294900&year=2025");

  await expect(page.locator("#profile-name")).toHaveText("Nové Město na Moravě");
  await expect(page).toHaveURL(/profile=cityvizor.cz%2F1/);
  await expect(page.locator("#accounting-rows tr")).toHaveCount(1);
  await expect(page.locator("#accounting-rows")).toContainText("Silnice");
  await expect(page.locator("#kpi-records")).toHaveText("3");
  await expect(page.locator("#payment-rows tr")).toHaveCount(3);
  await expect(page.locator("#payment-rows")).toContainText(/[-−]5[^0-9]/);
  await expect(page.locator(".cv-damaged-text")).toHaveCount(2);

  await page.locator("#filter-query").fill("Dodavatel");
  await page.locator("#filter-direction").selectOption("expenditure");
  await page.locator("#filter-paragraph").selectOption("2212");
  await expect(page.locator("#payment-rows tr")).toHaveCount(1);
  await expect(page.locator("#payment-rows")).toContainText("Dodavatel silnic s.r.o.");
  await expect(page.locator("#payment-result-count")).toContainText("Vybráno 1 z 3 záznamů");

  await page.locator("#tab-events").click();
  await expect(page.locator("#event-cards")).toContainText("Oprava místní komunikace");
  await page.locator("#tab-plans").click();
  await expect(page.locator("#plan-rows")).toContainText("Spotřeba materiálu");
  await page.locator("#tab-notices").click();
  await expect(page.locator("#notice-cards")).toContainText("Rozpočtové opatření");
});

test("CityVizor definitions and controls switch completely to English", async ({ page }) => {
  await mockCityVizor(page);
  await page.goto("/cityvizor/?lang=en&profile=cityvizor.cz%2F1&year=2025");

  await expect(page.locator(".cv-hero h1")).toContainText("Invoice-view rows in CityVizor");
  await expect(page.locator("#payments-title")).toHaveText("Rows and their allocations");
  await expect(page.locator("#method-title")).toHaveText("A row does not confirm bank payment");
  await expect(page.locator("#filter-direction option").first()).toHaveText("Income and expenditure");
  await expect(page.locator(".cv-damaged-text").first()).toContainText("The source contains a damaged character");
  await expect(page.locator("body")).not.toContainText("Řádek nepotvrzuje bankovní úhradu");
});

test("PBO profiles use the synthetic-account codelist and account terminology", async ({ page }) => {
  await mockCityVizor(page);
  await page.goto(`/cityvizor/?lang=cs&profile=${encodeURIComponent(pboProfileKey)}&year=2025`);

  await expect(page.locator("#profile-kind")).toHaveText("Příspěvková organizace");
  await expect(page.locator("#filter-item-label")).toHaveText("Účet");
  await expect(page.locator("#filter-item option[value='501']")).toHaveText("501 · Spotřeba materiálu");
  await expect(page.locator("#payment-rows .cv-classification")).toContainText("Účet 501 · Spotřeba materiálu");
  await expect(page.locator("#accounting-rows")).toContainText("Účet 501 · Spotřeba materiálu");

  await page.goto(`/cityvizor/?lang=en&profile=${encodeURIComponent(pboProfileKey)}&year=2025`);
  await expect(page.locator("#filter-item-label")).toHaveText("Account");
  await expect(page.locator("#payment-rows .cv-classification")).toContainText("Account 501 · Spotřeba materiálu");
});
