import { expect, test } from "@playwright/test";

// One viewer serves every Czech municipality by IČO. The first tests exercise the
// published Praha release without fixtures; the rest use small synthetic responses to
// pin scope, missing data, failures and the three data tiers.
const PRAHA = { ico: "00064581", name: "Praha", territory: "554782", profileKey: "cityvizor.praha.eu/4", profileName: "Magistrát hlavního města Prahy" };
const paymentColumns = ["row_id", "date", "income_cents", "expenditure_cents", "counterparty_id", "counterparty_name", "description", "paragraph", "item", "unit", "event"];
const fixturePayments = [
  ["invoice-with-description", "2025-04-10", 0, 100000, "12345678", "Pražská stavební společnost", "Oprava chodníku", "2212", "5169", "001", "A1"],
  ["invoice-without-description", "2025-03-02", 0, 250000, "87654321", "Dodavatel bez popisu", null, "3111", "5169", "002", null],
  ["invoice-credit", "2025-02-01", 0, -5000, "12345678", "Pražská stavební společnost", "Dobropis", "2212", "5169", "001", "A1"],
];

// A reconciled two-line statement. The accounting rows sit on purpose 6409, away from
// the budget lines the drilldown tests open.
const accountingColumns = ["type", "paragraph", "item", "event", "unit", "income_actual_cents", "expenditure_actual_cents", "income_budget_cents", "expenditure_budget_cents"];
const fixtureAccounting = [["KDF", "6409", "1111", "", "001", 310000000, 0, 300000000, 0], ["KDF", "6409", "5169", "", "001", 0, 250000000, 0, 350000000]];
const statementItems = [
  { key: "1111", label: "Daň z příjmů", income_budget_cents: 300000000, income_actual_cents: 310000000, expenditure_budget_cents: 0, expenditure_actual_cents: 0, rows: 1 },
  { key: "5169", label: "Nákup ostatních služeb", income_budget_cents: 0, income_actual_cents: 0, expenditure_budget_cents: 350000000, expenditure_actual_cents: 250000000, rows: 1 },
];
const statementTotals = { income_budget_cents: 300000000, income_actual_cents: 310000000, expenditure_budget_cents: 350000000, expenditure_actual_cents: 250000000 };

async function fixtureCity(page, { city = PRAHA, records = true, contextUnavailable = false, ledgerUnavailable = false } = {}) {
  const requests = { payments: 0 };
  await page.route('**/api/v1/praha/reconciliation/2025', route => route.fulfill({json:{status:'not_published',year:2025,municipality_ico:city.ico}}));
  const series = Array.from({ length: 6 }, (_, index) => {
    const expense = 1750000 + index * 250000;
    return {
      year: 2020 + index, revenue_actual: expense + 100000, expense_actual: expense,
      revenue_approved: expense, revenue_adjusted: expense + 200000,
      expense_approved: expense - 1000000, expense_adjusted: expense + 500000,
      budget_balance: 100000, current_expense: expense - 500000, capital_expense: 500000,
      tax_revenue: expense - 200000, nontax_revenue: 100000, capital_revenue: 100000,
      transfer_revenue: 100000, cash_current: 500000, cash_previous: 400000,
      population_mid_year: 1000, expense_per_capita: expense / 1000,
      source_kind: "monitor_fin_2_12_m", comparability: "same_reporting_unit",
    };
  });
  await page.route(`**/data/municipal-history/${city.ico}.json*`, route => route.fulfill({ json: {
    dataset_id: "municipal-browser-fixture", generated_at: "2026-09-27T00:00:00Z",
    municipality: { national_id: city.ico, name: city.name }, series,
  } }));
  await page.route(`**/data/entities/${city.ico}.json*`, route => route.fulfill({ json: {
    entity: { national_id: city.ico, name: city.name, short_name: city.name, entity_type: "municipality", territory: { region_name: "Fixture region", municipality_code: Number(city.territory) }, population: { value: 1000 }, budget_breakdown: {
      fiscal_year: 2025, fiscal_period: "202512", lineage: { fixture: true }, stages: {
        enacted: { purpose_expenditure: [["2212", 1000000], ["3111", 1000000]], economic_expenditure: [["5169", 2000000]], economic_revenue: [["1111", 3000000]] },
        revised: { purpose_expenditure: [["2212", 2250000], ["3111", 1250000]], economic_expenditure: [["5169", 3500000]], economic_revenue: [["1111", 3200000]] },
        actual: { purpose_expenditure: [["2212", 2000000], ["3111", 1000000]], economic_expenditure: [["5169", 2500000], ["6121", 500000]], economic_revenue: [["1111", 3100000]] },
      },
    } },
  } }));
  await page.route("**/data/municipal-budget-codebook.v1.json*", route => route.fulfill({ json: {
    dimensions: {
      purpose: { "2212": { cs: "Silnice" }, "3111": { cs: "Mateřské školy" } },
      economic: { "5169": { cs: "Nákup ostatních služeb" }, "6121": { cs: "Budovy, haly a stavby" }, "1111": { cs: "Daň z příjmů" } },
    },
  } }));
  const profile = { key: city.profileKey, name: city.profileName, ico: city.ico, type: "municipality", available_years: [2025], payment_years: [2025], profile_url: "https://cityvizor.cz/fixture" };
  await page.route("**/public-data/municipality-cityvizor?*", route => route.fulfill({ json: {
    release_id: "municipal-browser-fixture", municipality_ico: city.ico,
    municipality_profiles: records ? [profile] : [],
  } }));
  await page.route("**/public-data/cityvizor/profile?*", route => {
    const year = Number(new URL(route.request().url()).searchParams.get("year"));
    return route.fulfill({ json: {
      release_id: "municipal-browser-fixture",
      profile: { key: city.profileKey, ico: city.ico, name: city.profileName, type: "municipality" },
      years: year === 2025 ? [{ year, source_validity: "2025-12-31", source_bulk_export: { sha256: "a".repeat(64), retrieved_at: "2026-09-09T00:00:00Z" },
        assets: { accounting: [{ part: 1 }], events: [], payments: [{ part: 1, rows: 3 }] },
        accounting: { rows: 2, by_paragraph: [], by_item: statementItems, totals: statementTotals },
        annual_finance: { source_api_control: statementTotals },
        payments: { rows: 3, exact_duplicate_groups: 0 },
      }] : [],
    } });
  });
  await page.route("**/public-data/cityvizor/shard?*", route => {
    const url = new URL(route.request().url());
    const layer = url.searchParams.get("layer");
    if (layer === "payments") requests.payments += 1;
    if (layer === "payments" && ledgerUnavailable) return route.fulfill({ status: 503, body: "Fixture ledger unavailable" });
    const [columns, rows] = layer === "payments" ? [paymentColumns, fixturePayments] : layer === "accounting" ? [accountingColumns, fixtureAccounting] : [[], []];
    return route.fulfill({ json: { profile_key: city.profileKey, year: Number(url.searchParams.get("year")), kind: layer, columns, rows } });
  });
  const territoryKey = `obec:${city.territory}`;
  await page.route("**/data/paq/index.json*", route => contextUnavailable
    ? route.fulfill({ status: 503, body: "Fixture context unavailable" })
    : route.fulfill({ json: { completed_at: "2026-09-09T00:00:00Z", license: "CC BY-NC 4.0", license_url: "https://creativecommons.org/licenses/by-nc/4.0/", regions: {
      [territoryKey]: { key: territoryKey, name: city.name, code: city.territory, level: "obec", ico: city.ico, shard: "regions/fixture.json.gz" },
    } } }));
  await page.route("**/data/paq/catalog.json.gz*", route => route.fulfill({ json: {
    variables: { podil_lidi_v_nezamestnanosti: { name: "Podíl lidí v nezaměstnanosti", description: "Synthetic annual context for a browser contract", sources: [] } },
    fields: Object.fromEntries(series.map(row => [`u-${row.year}`, { variable_key: "podil_lidi_v_nezamestnanosti", values_type_key: "hodnoty", period_key: String(row.year), period_name: String(row.year), display_unit: "%", display_decimal_digits: 1 }])),
  } }));
  await page.route("**/data/paq/regions/fixture.json.gz*", route => route.fulfill({ json: {
    [territoryKey]: Object.fromEntries(series.map((row, index) => [`u-${row.year}`, { value: 8 - index * 0.5 }])),
  } }));
  return requests;
}

async function open(page, path = "/praha-budget.html?lang=en") {
  await page.goto(path);
  await expect(page.locator("#budget-app")).toHaveAttribute("data-ready", "true");
}

async function trajectoryTable(page) {
  const toggle = page.locator('#trajectory-chart [data-action="table"]');
  if (await toggle.getAttribute("aria-pressed") !== "true") await toggle.click();
  const table = page.locator("#trajectory-chart .psd-chart-panel table");
  await expect(table).toBeVisible();
  return table.locator("tbody");
}

async function records(page, tab) {
  await page.locator(`[data-records-tab="${tab}"]`).click();
  await expect(page.locator(`#records-${tab}`)).toBeVisible();
}

async function expectNoRawDownloads(page) {
  const rawLinks = await page.locator("#budget-app a[href]").evaluateAll(links => links
    .map(link => link.getAttribute("href"))
    .filter(href => /\.(?:json|ndjson|jsonl|csv|zip|gz)(?:[?#]|$)/i.test(href) || /\/public-data\//.test(href)));
  expect(rawLinks, "The view may explain provenance, but must not expose raw-data download links").toEqual([]);
  await expect(page.locator('#budget-app [data-action="csv"], #budget-app [data-action="json"]')).toHaveCount(0);
}

test("published Praha budget exposes the annual history and a reconciled breakdown", async ({ page }) => {
  // Runs where the published release is served (the full-data shards); the component
  // server carries no municipal data, and every other test here uses fixtures.
  test.skip(!(await page.request.get("/data/municipal-history/00064581.json")).ok(), "Published municipal history is not served here");
  await open(page);
  await expect(page.locator("#budget-year")).toHaveValue("2025");
  expect((await page.locator("#budget-year option").evaluateAll(options => options.map(option => Number(option.value)))).sort()).toEqual(Array.from({ length: 16 }, (_, index) => 2010 + index));
  await expect(page.locator("#trajectory-chart .pb-plot")).toHaveAttribute("data-chart-component", "line");
  await expect((await trajectoryTable(page)).locator("tr")).toHaveCount(16);
  await expect(page.locator("#spending-map .pb-plot")).toHaveAttribute("data-chart-component", "treemap");
  await expect(page.locator("#budget-status")).toContainText("add up to the reported total of 123,970,124,035.39 CZK");
  await expect(page.locator("#kpi-spending")).toContainText("123.97");
  const firstPoint = page.locator("#trajectory-chart [data-point]").first();
  await firstPoint.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#trajectory-chart .psd-plot-tooltip")).toContainText("2011");
  await page.keyboard.press("Escape");
  await expect(page.locator("#trajectory-chart .psd-plot-tooltip")).toBeHidden();
  await expectNoRawDownloads(page);
});

test("annual statements follow the page year and reconcile their controls", async ({ page }) => {
  await fixtureCity(page);
  await open(page);
  const statements = page.locator("#records-statements");
  await expect(statements.locator(".pb-mag-metrics")).toBeVisible();
  await expect(statements.locator(".pb-mag-statement").first()).toContainText("Financing · class 8 (not revenue)");
  await expect(statements.locator(".pb-mag-statement").first()).toContainText("3,100,000.00 CZK");
  await expect(statements.locator(".pb-mag-statement").last()).toContainText("2,500,000.00 CZK");
  await expect(statements.locator(".pb-mag-evidence summary")).toContainText("all four controls agree");
  await statements.locator('[data-mag-code="5169"]').first().evaluate(button => button.click());
  await expect(page.locator("#record-dialog")).toContainText("2,500,000.00 CZK");
  await page.keyboard.press("Escape");
  await page.locator("#budget-year").selectOption("2024");
  await expect(page).toHaveURL(/year=2024/);
  await expect(statements).toContainText("has not published a statement for 2024");
  await expect(statements.locator(".pb-mag-metrics")).toHaveCount(0);
  await expect(page.locator("#spending-map")).toContainText("published for 2025");
  await expectNoRawDownloads(page);
});

test("view, stage, search and year keep the selected budget boundary", async ({ page }) => {
  await fixtureCity(page);
  await open(page);
  const rows = page.locator("#budget-table tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(page.locator("#budget-status")).toContainText("add up to the reported total");
  const actual = await page.locator("#budget-table tbody").textContent();
  await page.locator("#budget-stage").selectOption("approved");
  await expect(page.locator("#budget-table tbody")).not.toHaveText(actual);
  await page.locator("#budget-stage").selectOption("actual");
  await expect(page.locator("#budget-table tbody")).toHaveText(actual);
  await page.locator("#budget-search").fill("2212");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("2212");
  await page.locator("#budget-search").clear();
  await page.locator('[data-view="cost"]').click();
  await expect(page).toHaveURL(/view=cost/);
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Operating spending");
  await rows.first().getByRole("button").click();
  await expect(rows.first()).toContainText("5169");
  await page.locator('[data-view="revenue"]').click();
  await expect(rows.first()).toContainText("Taxes");
  await page.locator("#budget-year").selectOption("2024");
  await expect(page).toHaveURL(/year=2024/);
  await expect(page.locator("#trajectory-chart .psd-plot-selected-label")).toHaveText("2024");
  await expect(rows).toHaveCount(0);
  await expect(page.locator("#spending-map")).toContainText("published for 2025");
  await page.locator("#spending-map [data-goto-year]").click();
  await expect(page.locator("#budget-year")).toHaveValue("2025");
  const totalHistory = await (await trajectoryTable(page)).textContent();
  await page.locator("#budget-unit").selectOption("per-capita");
  await expect(await trajectoryTable(page)).not.toHaveText(totalHistory);
  await page.locator("#budget-unit").selectOption("total");
  await expect(await trajectoryTable(page)).toHaveText(totalHistory);
  await page.locator('[data-trend="split"]').click();
  await expect(page.locator("#trajectory-title")).toContainText("Operating and capital");
});

test("invoice allocations load on demand without changing budget totals", async ({ page }) => {
  const requests = await fixtureCity(page);
  await open(page);
  const budgetBefore = await page.locator("#budget-table tbody").textContent();
  const historyBefore = await (await trajectoryTable(page)).textContent();
  expect(requests.payments).toBe(0);
  await records(page, "ledger");
  await page.locator("#ledger-load").click();
  await expect(page.locator("#ledger-table tbody tr")).toHaveCount(3);
  expect(requests.payments).toBe(1);
  await expect(page.locator("#budget-table tbody")).toHaveText(budgetBefore);
  await expect(await trajectoryTable(page)).toHaveText(historyBefore);
  await expect(page.locator("#ledger-status")).toContainText(/not proof of bank payment/);
  await page.locator("#ledger-search").fill("bez popisu");
  const missingDescription = page.locator("#ledger-table tbody tr");
  await expect(missingDescription).toHaveCount(1);
  await expect(missingDescription).toContainText("Dodavatel bez popisu");
  await expect(missingDescription).not.toContainText(/undefined|null/);
  await missingDescription.getByRole("button").click();
  await expect(page.locator("#record-dialog")).toBeVisible();
  await expect(page.locator("#record-dialog")).toContainText("87654321");
  await expect(page.locator("#record-dialog")).not.toContainText(/undefined|null/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#record-dialog")).toBeHidden();
  await expectNoRawDownloads(page);
});

test("missing ledger and context stay unavailable while the budget stays usable", async ({ page }) => {
  await fixtureCity(page, { contextUnavailable: true, ledgerUnavailable: true });
  await open(page);
  await expect(page.locator("#budget-table tbody tr")).toHaveCount(2);
  await expect(page.locator("#association-status")).toContainText(/unavailable/i);
  await records(page, "ledger");
  await page.locator("#ledger-load").click();
  await expect(page.locator("#ledger-status")).toContainText(/could not be loaded/i);
  await expect(page.locator("#ledger-table tbody")).not.toContainText("Pražská stavební společnost");
  await expect(page.locator("#budget-table tbody tr")).toHaveCount(2);
});

test("context, records and deep tables stay inspectable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtureCity(page);
  await open(page);
  await expect(page.locator("#context-series")).toBeEnabled();
  await expect(page.locator('#context-series option[value="podil_lidi_v_nezamestnanosti:hodnoty"]')).toHaveCount(1);
  await page.locator("#context-lag").selectOption("1");
  await expect(page.locator("#association-status")).toContainText(/correlation|matched years/i);
  await records(page, "ledger");
  await page.locator("#ledger-load").click();
  await expect(page.locator("#ledger-table tbody tr")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expectNoRawDownloads(page);
});

test("a budget line opens its three stages and its exact-code invoice records", async ({ page }) => {
  await fixtureCity(page);
  await open(page);
  await page.locator("#budget-table tbody tr").filter({ hasText: "Transport" }).getByRole("button").click();
  await expect(page.locator("#spending-path")).toContainText("Transport");
  await expect(page).toHaveURL(/group=transport/);
  await page.locator("#budget-table tbody tr").filter({ hasText: "2212" }).getByRole("button").click();
  await expect(page.locator("#purpose-title")).toHaveText("Roads");
  await expect(page.locator("#purpose-detail")).toContainText("Revised budget");
  await expect(page.locator("#purpose-detail")).toContainText("No accounting rows with this code");
  await page.locator("[data-purpose-invoices]").click();
  await expect(page.locator("#ledger-purpose-filter")).toContainText("2212");
  await expect(page.locator("#ledger-table tbody tr")).toHaveCount(2);
  await expect(page.locator("#ledger-table tbody")).not.toContainText("Dodavatel bez popisu");
  await page.locator("#ledger-purpose-filter button").click();
  await expect(page.locator("#ledger-table tbody tr")).toHaveCount(3);
  await expectNoRawDownloads(page);
});

test("projects trace only their own allocations and name the contract boundary", async ({ page }) => {
  await fixtureCity(page);
  await open(page);
  await records(page, "projects");
  await expect(page).toHaveURL(/records=projects/);
  await page.locator("[data-explore-load]").click();
  await page.locator('[data-project="A1"]').click();
  await expect(page.locator("#inspector-content [data-explore-invoice]")).toHaveCount(2);
  await expect(page.locator("#inspector-content")).not.toContainText("Dodavatel bez popisu");
  await page.locator('[data-inspector-tab="contracts"]').click();
  await expect(page.locator("#inspector-content")).toContainText("verified link");
  await expectNoRawDownloads(page);
});

test("invoice detail distinguishes missing line items from an unassessed contract link", async ({ page }) => {
  await fixtureCity(page);
  await open(page);
  await records(page, "ledger");
  await page.locator("#ledger-load").click();
  await page.locator("#ledger-table tbody tr").filter({ hasText: "Pražská stavební společnost" }).first().getByRole("button").click();
  const dialog = page.locator("#record-dialog");
  await expect(dialog.locator("[data-contract-status]")).toHaveAttribute("data-contract-status", "not_assessed");
  await expect(dialog).toContainText("Purchased goods / services line items");
  await expect(dialog).toContainText("not an invoice line item");
  await expect(dialog.getByRole("link", { name: "Investigate this supplier on Hlídač státu" })).toHaveAttribute("href", "https://www.hlidacstatu.cz/hledat?Q=ico%3A12345678");
  await expectNoRawDownloads(page);
});

test("opening an allocation looks up exact-party contracts and keeps source boundaries", async ({ page }) => {
  await fixtureCity(page);
  let lookups = 0;
  await page.route("**/api/v1/praha/related-contracts?*", route => {
    lookups++; const q = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: { status: "related_by_exact_parties", match_status: "not_verified", payer_ico: q.get("payer"), supplier_ico: q.get("supplier"), release_id: "95efccaf-8f0f-421d-b5fc-1316ee967cc6", cityvizor_source_release_id: "municipal-browser-fixture", cityvizor_warehouse_release_id: "3c1b0b77-f00f-42c9-ae74-1a2366034a62", serving_release_id: "fixture-curated", coverage_contracts: 115429, related_count: 1, filtered_count: 1, rows: [{ contract_id: "7939187", subject: "Published project agreement", signed_at: "2019-01-01", value_czk: "1016400.01", currency: "CZK", source_url: "https://smlouvy.gov.cz/smlouva/7939187", parent_contract_id: "5395991", compact_contract_sha256: "b".repeat(64) }] } });
  });
  await open(page);
  await records(page, "ledger");
  await page.locator("#ledger-load").click();
  await page.locator("#ledger-table tbody tr").filter({ hasText: "Pražská stavební společnost" }).first().getByRole("button").click();
  const results = page.locator("#related-contract-results");
  await expect(results).toContainText("Published project agreement");
  await expect(results).toContainText("1,016,400.01 CZK");
  await expect(results).toContainText("invoice-to-contract link not verified");
  await expect(results.getByRole("link", { name: "Published project agreement" })).toHaveAttribute("href", "https://www.hlidacstatu.cz/Detail/7939187");
  expect(lookups).toBe(1);
  await expectNoRawDownloads(page);
});

test("overview keeps the cash stock distinct from annual budget flows", async ({ page }) => {
  await fixtureCity(page);
  await open(page);
  const overview = page.locator("#overview");
  await expect(overview).toContainText("Cash and deposits");
  await expect(overview).toContainText("500,000 CZK");
  await overview.getByText("Exact figures and definitions", { exact: true }).click();
  await expect(overview).toContainText("500,000.00 CZK");
  await expect(overview).toContainText("100,000.00 CZK");
  await expect(overview).toContainText("not annual revenue or spendable reserves");
  await expect(page.locator("#evidence-list").getByRole("link", { name: /Hlídač státu/ })).toBeVisible();
});

test("a municipality without published records shows the shared tier only", async ({ page }) => {
  const city = { ico: "00099999", name: "Fixtureville", territory: "999999", profileKey: "cityvizor.cz/999", profileName: "Fixtureville" };
  await fixtureCity(page, { city, records: false });
  await open(page, `/municipal-budget.html?ico=${city.ico}&lang=en`);
  await expect(page.locator("h1")).toContainText("Fixtureville");
  await expect(page.locator("section.pb-section")).toHaveCount(4);
  await expect(page.locator("#records")).toHaveCount(0);
  await expect(page.locator("#budget-status")).toContainText("add up to the reported total");
  await expect(page.locator("#evidence-list h3")).toHaveText(["Budget", "Local conditions"]);
  await page.locator("#budget-table tbody tr").filter({ hasText: "Transport" }).getByRole("button").click();
  await page.locator("#budget-table tbody tr").filter({ hasText: "2212" }).getByRole("button").click();
  await expect(page.locator("#purpose-detail")).toBeVisible();
  await expect(page.locator("[data-purpose-invoices]")).toHaveCount(0);
  await expect(page.locator("#budget-app")).not.toContainText(/Praha|Prague|00064581/);
  await expectNoRawDownloads(page);
});

test("a municipality's own CityVizor profile adds records; a district sharing its IČO does not", async ({ page }) => {
  const own = { ico: "00099998", name: "Fixtureton", territory: "999998", profileKey: "cityvizor.cz/998", profileName: "Fixtureton" };
  await fixtureCity(page, { city: own });
  await open(page, `/municipal-budget.html?ico=${own.ico}&lang=en`);
  await expect(page.locator("#records")).toBeVisible();
  await expect(page.locator("[data-records-tab]")).toHaveText(["Annual statements", "Projects and suppliers", "All records", "Technology"]);
  await records(page, "ledger");
  await page.locator("#ledger-load").click();
  await expect(page.locator("#ledger-table tbody tr")).toHaveCount(3);
  await page.locator("#ledger-table tbody tr").first().getByRole("button").click();
  await expect(page.locator("#related-contract-form")).toHaveCount(0);
  await page.keyboard.press("Escape");

  const district = { ico: "00099997", name: "Fixturegrad", territory: "999997", profileKey: "cityvizor.cz/997", profileName: "Fixturegrad - Sever" };
  await fixtureCity(page, { city: district });
  await open(page, `/municipal-budget.html?ico=${district.ico}&lang=en`);
  await expect(page.locator("section.pb-section")).toHaveCount(4);
  await expect(page.locator("#records")).toHaveCount(0);
});

test("an invalid IČO asks for a municipality instead of guessing one", async ({ page }) => {
  await page.goto("/municipal-budget.html?ico=123&lang=en");
  await expect(page.locator("#budget-app")).toContainText("eight-digit IČO");
  await expect(page.locator("#budget-app a[href^='/cz-obce.html']")).toBeVisible();
});

test('Prague publishes connection gaps and opens held organisation plans without substituting years', async ({ page }) => {
  await fixtureCity(page);
  const parent = { key: PRAHA.profileKey, name: PRAHA.profileName, ico: PRAHA.ico, type: 'municipality', available_years: [2025] };
  const org = { key: 'cityvizor.praha.eu/81', name: 'Fixture school', ico: '63831708', parent_profile_key: PRAHA.profileKey, available_years: [2025], payment_years: [], profile_url: 'https://cityvizor.praha.eu/mss_slunicko' };
  const older = { ...org, key: 'cityvizor.praha.eu/100', name: 'Older school', ico: '60460041', available_years: [2024] };
  await page.route('**/public-data/municipality-cityvizor?*', route => route.fulfill({ json: { release_id: 'municipal-browser-fixture', municipality_profiles: [parent], organizations: [org, older] } }));
  await page.route('**/public-data/cityvizor/profile?key=cityvizor.praha.eu%2F81*', route => route.fulfill({ json: { release_id: 'municipal-browser-fixture', profile: org, years: [{ year: 2025, source_validity: '2024-03-31', plans: { rows: 1 }, accounting: { rows: 0 }, payments: { rows: 0 }, events: { rows: 0 }, assets: { plans: [{ part: 1 }], accounting: [], payments: [], events: [] } }] } }));
  await page.route('**/public-data/cityvizor/shard?key=cityvizor.praha.eu%2F81*', route => route.fulfill({ json: { profile_key: org.key, year: 2025, kind: 'plans', rows: [{ synthetic_account: '521', expenditure_budget_cents: 100000, expenditure_actual_cents: 25000 }] } }));
  await page.goto('/praha-budget.html?lang=en');
  await expect(page.locator('#connection-status')).toContainText('Links unverified');
  await page.locator('#organization-directory summary').click();
  await expect(page.locator('#organization-coverage')).toContainText('2 city-linked profiles; 1 have some 2025 data; 0 advertise 2025 payments');
  await expect(page.locator('#organization-table tr').filter({ hasText: 'Older school' })).toContainText('Not published');
  await page.getByRole('button', { name: 'Open records · 2025' }).click();
  await expect(page.locator('#organization-records')).toContainText('2024-03-31');
  await expect(page.locator('#organization-records')).toContainText('1,000.00 CZK');
  await expect(page.locator('#organization-records')).toContainText('250.00 CZK');
  await expect(page.locator('#organization-records [data-organization-kind="payments"]')).toBeDisabled();
  await page.locator('[data-organization-row="0"]').click();
  await expect(page.locator('#record-body')).toContainText('expenditure_budget_cents');
  await expect(page.locator('#record-body')).toContainText('100000');
});

test('multi-source spending keeps code matches, controls and unmatched records visible without automatic invoice loading',async({page})=>{
 const requests=await fixtureCity(page);await open(page);
 await expect(page.locator('#source-comparison-table')).toBeVisible();
 await expect(page.locator('#source-control-status')).toContainText('all four controls reconcile');
 await expect(page.locator('#source-unmatched')).toContainText('2');
 await expect(page.locator('#official-reconciliation-status')).toContainText('not yet been published');
 expect(requests.payments).toBe(0);
 await page.locator('[data-source-load]').click();
 await expect.poll(()=>requests.payments).toBe(1);
 await expect(page.locator('#source-comparison-table')).toContainText('allocations');
});
