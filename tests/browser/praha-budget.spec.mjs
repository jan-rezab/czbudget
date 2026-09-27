import { expect, test } from "@playwright/test";

const profileKey = "cityvizor.praha.eu/4";
const paymentColumns = ["row_id", "date", "income_cents", "expenditure_cents", "counterparty_id", "counterparty_name", "description", "paragraph", "item", "unit", "event"];
const fixturePayments = [
  ["invoice-with-description", "2025-04-10", 0, 100000, "12345678", "Pražská stavební společnost", "Oprava chodníku", "2212", "5169", "001", "A1"],
  ["invoice-without-description", "2025-03-02", 0, 250000, "87654321", "Dodavatel bez popisu", null, "3111", "5169", "002", null],
  ["invoice-credit", "2025-02-01", 0, -5000, "12345678", "Pražská stavební společnost", "Dobropis", "2212", "5169", "001", "A1"],
];

// Synthetic responses exercise scope, missing fields and failures. The first test
// below separately exercises the actual published Praha release without fixtures.
async function fixturePraha(page, { contextUnavailable = false, ledgerUnavailable = false } = {}) {
  const requests = { payments: 0 };
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
  await page.route("**/data/municipal-history/00064581.json*", route => route.fulfill({ json: {
    dataset_id: "praha-browser-fixture", generated_at: "2026-09-27T00:00:00Z",
    municipality: { national_id: "00064581", name: "Praha" }, series,
  } }));
  await page.route("**/data/entities/00064581.json*", route => route.fulfill({ json: {
    entity: { national_id: "00064581", name: "Praha", population: 1000, budget_breakdown: {
      fiscal_year: 2025, fiscal_period: "202512", lineage: { fixture: true }, stages: {
        enacted: { purpose_expenditure: [["2212", 1000000], ["3111", 1000000]], economic_expenditure: [["5169", 2000000]], economic_revenue: [["1111", 3000000]] },
        revised: { purpose_expenditure: [["2212", 2250000], ["3111", 1250000]], economic_expenditure: [["5169", 3500000]], economic_revenue: [["1111", 3200000]] },
        actual: { purpose_expenditure: [["2212", 2000000], ["3111", 1000000]], economic_expenditure: [["5169", 3000000]], economic_revenue: [["1111", 3100000]] },
      },
    } },
  } }));
  await page.route("**/data/municipal-budget-codebook.v1.json*", route => route.fulfill({ json: {
    dimensions: {
      purpose: { "2212": { cs: "Silnice", en: "Roads" }, "3111": { cs: "Mateřské školy", en: "Kindergartens" } },
      economic: { "5169": { cs: "Nákup ostatních služeb", en: "Other purchased services" }, "1111": { cs: "Daň z příjmů", en: "Income tax" } },
    },
  } }));
  await page.route("**/public-data/municipality-cityvizor?*", route => route.fulfill({ json: {
    release_id: "praha-browser-fixture", municipality_ico: "00064581",
    municipality_profiles: [{ key: profileKey, name: "Magistrát hlavního města Prahy", ico: "00064581", type: "municipality", available_years: [2025], payment_years: [2025] }],
  } }));
  await page.route("**/public-data/cityvizor/profile?*", route => {
    const year = Number(new URL(route.request().url()).searchParams.get("year"));
    return route.fulfill({ json: {
      release_id: "praha-browser-fixture",
      profile: { key: profileKey, ico: "00064581", name: "Magistrát hlavního města Prahy", type: "municipality" },
      years: year === 2025 ? [{ year, source_validity: "2025-12-31", source_bulk_export: { sha256: "a".repeat(64), retrieved_at: "2026-09-09T00:00:00Z" },
        assets: { accounting: [], events: [], payments: [{ part: 1, rows: 3 }] },
        accounting: { rows: 0, by_paragraph: [], totals: { expenditure_actual_cents: 345000 } },
        payments: { rows: 3, exact_duplicate_groups: 0 },
      }] : [],
    } });
  });
  await page.route("**/public-data/cityvizor/shard?*", route => {
    const url = new URL(route.request().url());
    const layer = url.searchParams.get("layer");
    if (layer === "payments") requests.payments += 1;
    if (layer === "payments" && ledgerUnavailable) return route.fulfill({ status: 503, body: "Fixture ledger unavailable" });
    return route.fulfill({ json: { profile_key: profileKey, year: Number(url.searchParams.get("year")), kind: layer, columns: layer === "payments" ? paymentColumns : [], rows: layer === "payments" ? fixturePayments : [] } });
  });
  const territoryKey = "obec:554782";
  await page.route("**/data/paq/index.json*", route => contextUnavailable
    ? route.fulfill({ status: 503, body: "Fixture context unavailable" })
    : route.fulfill({ json: { completed_at: "2026-09-09T00:00:00Z", license: "CC BY-NC 4.0", license_url: "https://creativecommons.org/licenses/by-nc/4.0/", regions: {
      [territoryKey]: { key: territoryKey, name: "Praha", code: "554782", level: "obec", ico: "00064581", shard: "regions/praha-fixture.json.gz" },
    } } }));
  await page.route("**/data/paq/catalog.json.gz*", route => route.fulfill({ json: {
    variables: { podil_lidi_v_nezamestnanosti: { name: "Podíl lidí v nezaměstnanosti", description: "Synthetic annual context for a browser contract", sources: [] } },
    fields: Object.fromEntries(series.map(row => [`u-${row.year}`, { variable_key: "podil_lidi_v_nezamestnanosti", values_type_key: "hodnoty", period_key: String(row.year), period_name: String(row.year), display_unit: "%", display_decimal_digits: 1 }])),
  } }));
  await page.route("**/data/paq/regions/praha-fixture.json.gz*", route => route.fulfill({ json: {
    [territoryKey]: Object.fromEntries(series.map((row, index) => [`u-${row.year}`, { value: 8 - index * 0.5 }])),
  } }));
  return requests;
}

async function openPraha(page) {
  await page.goto("/praha-budget.html?lang=en");
  await expect(page.locator("#praha-app")).toHaveAttribute("data-ready", "true");
}

async function trajectoryTable(page) {
  const toggle = page.locator('#trajectory-chart [data-action="table"]');
  if (await toggle.getAttribute("aria-pressed") !== "true") await toggle.click();
  const table = page.locator("#trajectory-chart .psd-chart-panel table");
  await expect(table).toBeVisible();
  return table.locator("tbody");
}

async function expectNoRawDownloads(page) {
  const rawLinks = await page.locator("#praha-app a[href]").evaluateAll(links => links
    .map(link => link.getAttribute("href"))
    .filter(href => /\.(?:json|ndjson|jsonl|csv|zip|gz)(?:[?#]|$)/i.test(href) || /\/public-data\//.test(href)));
  expect(rawLinks, "The view may explain provenance, but must not expose raw-data download links").toEqual([]);
  await expect(page.locator('#praha-app [data-action="csv"], #praha-app [data-action="json"]')).toHaveCount(0);
}

test("published Praha budgets expose the complete annual history and native detail", async ({ page }) => {
  await openPraha(page);
  await expect(page.locator("#budget-year")).toHaveValue("2025");
  expect((await page.locator("#budget-year option").evaluateAll(options => options.map(option => Number(option.value)))).sort()).toEqual(Array.from({ length: 16 }, (_, index) => 2010 + index));
  await expect(page.locator("#trajectory-chart .pb-plot")).toHaveAttribute("data-chart-component", "line");
  await expect((await trajectoryTable(page)).locator("tr")).toHaveCount(16);
  await expect(page.locator("#budget-table tbody tr")).toHaveCount(209);
  await expect(page.locator("#budget-table thead")).toContainText(/code|category/i);

  const firstPoint = page.locator("#trajectory-chart [data-point]").first();
  await firstPoint.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#trajectory-chart .psd-plot-tooltip")).toContainText("2011");
  await page.keyboard.press("Escape");
  await expect(page.locator("#trajectory-chart .psd-plot-tooltip")).toBeHidden();
  await expectNoRawDownloads(page);
});

test("year, stage and accounting dimension preserve the selected budget boundary", async ({ page }) => {
  await fixturePraha(page);
  await openPraha(page);
  const rows = page.locator("#budget-table tbody tr");
  await expect(rows).toHaveCount(2);
  const actual = await page.locator("#budget-table tbody").textContent();
  await page.locator("#budget-stage").selectOption("approved");
  await expect(page.locator("#budget-table tbody")).not.toHaveText(actual);
  await page.locator("#budget-stage").selectOption("actual");
  await expect(page.locator("#budget-table tbody")).toHaveText(actual);
  await page.locator("#budget-search").fill("2212");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("2212");
  await page.locator("#budget-search").clear();
  await page.locator("#budget-dimension").selectOption("economic");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("5169");
  await page.locator("#budget-dimension").selectOption("revenue");
  await expect(rows.first()).toContainText("1111");
  await page.locator("#budget-year").selectOption("2024");
  await expect(page).toHaveURL(/year=2024/);
  await expect(page.locator("#trajectory-chart .psd-plot-selected-label")).toHaveText("2024");
  await expect(page.locator("#budget-table tbody")).not.toContainText("1111");
  await page.locator("#budget-year").selectOption("2025");
  await expect(rows.first()).toContainText("1111");
  const totalHistory = await (await trajectoryTable(page)).textContent();
  await page.locator("#budget-unit").selectOption("per-capita");
  await expect(await trajectoryTable(page)).not.toHaveText(totalHistory);
  await page.locator("#budget-unit").selectOption("total");
  await expect(await trajectoryTable(page)).toHaveText(totalHistory);
});

test("invoice allocations load on demand without changing full-budget totals", async ({ page }) => {
  const requests = await fixturePraha(page);
  await openPraha(page);
  await expect(page.locator("#budget-table tbody tr")).toHaveCount(2);
  const budgetBefore = await page.locator("#budget-table tbody").textContent();
  const historyBefore = await (await trajectoryTable(page)).textContent();
  expect(requests.payments).toBe(0);
  await page.locator("#ledger-load").click();
  await expect(page.locator("#ledger-table tbody tr")).toHaveCount(3);
  expect(requests.payments).toBe(1);
  await expect(page.locator("#budget-table tbody")).toHaveText(budgetBefore);
  await expect(await trajectoryTable(page)).toHaveText(historyBefore);
  await expect(page.locator("#ledger-status")).toContainText(/not (?:proof|confirmation|all)|does not (?:prove|confirm)|not added/i);

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
  await page.locator("#ledger-search").fill("Oprava chodníku");
  await expect(page.locator("#ledger-table tbody tr")).toHaveCount(1);
  await expect(page.locator("#ledger-table tbody")).toContainText("Pražská stavební společnost");
  await expectNoRawDownloads(page);
});

test("missing ledger and context remain unavailable while budgets stay usable", async ({ page }) => {
  await fixturePraha(page, { contextUnavailable: true, ledgerUnavailable: true });
  await openPraha(page);
  await expect(page.locator("#budget-table tbody tr")).toHaveCount(2);
  await expect(page.locator("#association-status")).toContainText(/unavailable|could not|cannot|not available|failed/i);
  await page.locator("#ledger-load").click();
  await expect(page.locator("#ledger-status")).toContainText(/unavailable|could not|cannot|not available|failed/i);
  await expect(page.locator("#ledger-table tbody")).not.toContainText("Pražská stavební společnost");
  await expect(page.locator("#budget-table tbody tr")).toHaveCount(2);
  await expect(page.locator("#association-status")).not.toHaveText(/^\s*0(?:[.,]0+)?\s*$/);
});

test("context associations and deep tables stay inspectable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixturePraha(page);
  await openPraha(page);
  await expect(page.locator("#context-series")).toBeEnabled();
  await expect(page.locator('#context-series option[value="podil_lidi_v_nezamestnanosti:hodnoty"]')).toHaveCount(1);
  await page.locator("#context-lag").selectOption("1");
  await expect(page.locator("#context-lag")).toHaveValue("1");
  await expect(page.locator("#association-status")).toContainText(/association|correlation|caus|pairs|observations/i);
  await page.locator("#ledger-load").click();
  await expect(page.locator("#ledger-table tbody tr")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expectNoRawDownloads(page);
});

test('service drilldown follows the exact purpose into supporting invoices and keeps incomplete coverage visible', async ({ page }) => {
  await fixturePraha(page);
  await openPraha(page);
  await expect(page.locator('[data-service]')).toHaveCount(2);
  await page.locator('[data-purpose="2212"]').click();
  await expect(page.locator('#purpose-title')).toHaveText('Roads');
  await expect(page.locator('#purpose-detail')).toContainText('do not explain the entire total');
  await expect(page.locator('#purpose-detail')).toContainText('No supporting accounting rows');
  await page.locator('[data-purpose-invoices]').click();
  await expect(page.locator('#ledger-purpose-filter')).toContainText('2212');
  await expect(page.locator('#ledger-table tbody tr')).toHaveCount(2);
  await expect(page.locator('#ledger-table tbody')).not.toContainText('Dodavatel bez popisu');
  await page.locator('#ledger-purpose-filter button').click();
  await expect(page.locator('#ledger-table tbody tr')).toHaveCount(3);
  await page.locator('#budget-year').selectOption('2024');
  await expect(page.locator('#purpose-detail')).toBeHidden();
  await expect(page.locator('[data-service]')).toHaveCount(0);
  await expectNoRawDownloads(page);
});

test('the overview starts with all spending and traces only the selected project allocations', async ({page}) => {
  await fixturePraha(page);
  await openPraha(page);
  await expect(page.locator('.pb-lenses [data-lens="all"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.pb-overview-grid button')).toHaveCount(2);
  await expect(page.locator('#explore-summary')).toContainText('3 m CZK');
  await page.locator('[data-explore-load]').click();
  await page.locator('[data-project="A1"]').click();
  await expect(page.locator('#inspector-content [data-explore-invoice]')).toHaveCount(2);
  await expect(page.locator('#inspector-content')).not.toContainText('Dodavatel bez popisu');
  await expect(page.locator('#explore-summary')).toContainText('3 m CZK');
  await page.locator('[data-inspector-tab="contracts"]').click();
  await expect(page.locator('#inspector-content')).toContainText('not this project’s contract count');
  await expectNoRawDownloads(page);
});

test('the visual map preserves financial boundaries down to signed invoice allocations',async({page})=>{
  await fixturePraha(page);await openPraha(page);
  await expect(page.locator('[data-flow-class="opex"]')).toContainText('2.5 m CZK');
  await expect(page.locator('[data-flow-class="capex"]')).toContainText('500,000 CZK');
  await expect(page.locator('#praha-money-map-chart .psd-treemap-tile')).toHaveCount(2);
  await page.locator('#ledger-load').click();
  await page.locator('#praha-money-map-chart').getByRole('button',{name:/^Transport\. /}).press('Enter');
  await page.locator('#praha-money-map-chart').getByRole('button',{name:/^Roads\. /}).click();
  await expect(page.locator('.pb-flow-boundary')).toContainText('reporting scope differs');
  await expect(page.locator('.pb-flow-boundary')).toContainText('Whole-city code: 2 m CZK');
  await page.locator('#praha-money-map-chart .psd-treemap-unsized button').click();
  await expect(page.locator('.pb-flow-boundary')).toContainText('Invoice and accounting totals remain separate');
  await page.locator('#praha-money-map-chart').getByRole('button',{name:/^Pražská stavební společnost\. /}).click();
  await expect(page.locator('#praha-money-map-chart .psd-treemap-tile')).toHaveCount(1);
  await expect(page.locator('#praha-money-map-chart .psd-treemap-unsized')).toContainText('-50.00 CZK');
  await page.locator('#praha-money-map-chart .psd-treemap-tile').press('Enter');
  await expect(page.locator('#record-dialog')).toContainText('invoice-with-description');
  await expect(page.locator('#record-dialog')).toContainText('Not supplied in the published record');
  await expect(page.locator('#record-dialog')).not.toContainText('invoice-without-description');
  await expectNoRawDownloads(page);
});

test('capital navigation flags inconsistent categories and keeps absent years missing',async({page})=>{
  await fixturePraha(page);await openPraha(page);
  await page.locator('[data-flow-class="opex"]').click();
  await expect(page.locator('.pb-flow-boundary')).toContainText('RECONCILIATION GAP');
  await page.locator('.pb-capital-history summary').click();
  await expect(page.locator('#praha-capital-history-chart [data-chart-component]')).toHaveAttribute('data-chart-component','line');
  await page.locator('#budget-unit').selectOption('per-capita');
  await expect(page.locator('.pb-capital-history')).toHaveAttribute('open','');
  await expect(page.locator('[data-flow-class="capex"]')).toContainText('500 CZK');
  await page.locator('#budget-year').selectOption('2024');
  await expect(page.locator('.pb-flow-view')).toContainText('No published detail is available');
  await page.locator('[data-flow-mode="it"]').click();
  await expect(page.locator('#praha-money-map-chart .psd-treemap-unsized li')).toHaveCount(5);
  await expect(page.locator('.pb-flow-heading')).toContainText('— CZK');
  await expectNoRawDownloads(page);
});

test('magistrate overview separates financing, reconciles statements and keeps its year independent', async ({page}) => {
  await openPraha(page);
  const magistrate=page.locator('#magistrate');
  await expect(magistrate.locator('.pb-mag-metrics')).toBeVisible();
  await expect(magistrate.locator('.pb-mag-statement').first()).toContainText('Financing · class 8 (not revenue)');
  await expect(magistrate.locator('.pb-mag-statement').last()).toContainText('4,922,951,114.87 CZK');
  await expect(magistrate.locator('.pb-mag-evidence summary')).toContainText('all four controls agree');
  await magistrate.locator('[data-mag-code="6125"]').click();
  await expect(page.locator('#record-dialog')).toContainText('5,769,650.26 CZK');
  await page.locator('#record-dialog').press('Escape');
  await magistrate.locator('#magistrate-year').selectOption('2007');
  await expect(magistrate.locator('.pb-mag-metrics')).toBeVisible();
  await expect(page).toHaveURL(/magyear=2007/);
  await expect(magistrate.locator('.pb-empty').first()).toContainText('No accounting rows');
  await expect(magistrate.locator('.pb-mag-metrics')).toContainText('— CZK');
  await expect(page.locator('#hero-amount')).toContainText('123.97');
  await expectNoRawDownloads(page);
});


test('invoice detail distinguishes missing line items from an unassessed Hlídač link',async({page})=>{
 await fixturePraha(page);await openPraha(page);await page.locator('#ledger-load').click();
 await expect(page.locator('#ledger-table tbody tr')).toHaveCount(3);
 await page.locator('#ledger-table tbody tr').filter({hasText:'Pražská stavební společnost'}).first().getByRole('button').click();
 const dialog=page.locator('#record-dialog');await expect(dialog.locator('[data-contract-status]')).toHaveAttribute('data-contract-status','not_assessed');
 await expect(dialog).toContainText('Purchased goods / services line items');
 await expect(dialog).toContainText('not an invoice line item');
 await expect(dialog.getByRole('link',{name:'Investigate this supplier on Hlídač státu'})).toHaveAttribute('href','https://www.hlidacstatu.cz/hledat?Q=ico%3A12345678');
 await expectNoRawDownloads(page);
});

test('opening an allocation automatically shows exact-party contract evidence and preserves source boundaries',async({page})=>{
 await fixturePraha(page);let lookups=0;
 await page.route('**/api/v1/praha/related-contracts?*',route=>{
  lookups++;const q=new URL(route.request().url()).searchParams;
  return route.fulfill({json:{status:'related_by_exact_parties',match_status:'not_verified',payer_ico:q.get('payer'),supplier_ico:q.get('supplier'),release_id:'95efccaf-8f0f-421d-b5fc-1316ee967cc6',cityvizor_source_release_id:'praha-browser-fixture',cityvizor_warehouse_release_id:'3c1b0b77-f00f-42c9-ae74-1a2366034a62',serving_release_id:'fixture-curated',coverage_contracts:115429,related_count:1,filtered_count:1,rows:[{contract_id:'7939187',subject:'Published project agreement',signed_at:'2019-01-01',value_czk:'1016400.01',currency:'CZK',source_url:'https://smlouvy.gov.cz/smlouva/7939187',parent_contract_id:'5395991',compact_contract_sha256:'b'.repeat(64)}]}});
 });
 await openPraha(page);await page.locator('#ledger-load').click();
 await page.locator('#ledger-table tbody tr').filter({hasText:'Pražská stavební společnost'}).first().getByRole('button').click();
 const results=page.locator('#related-contract-results');
 await expect(results).toContainText('Published project agreement');
 await expect(results).toContainText('1,016,400.01 CZK');
 await expect(results).toContainText('invoice-to-contract link not verified');
 await expect(results.getByRole('link',{name:'Published project agreement'})).toHaveAttribute('href','https://www.hlidacstatu.cz/Detail/7939187');
 await expect(results.getByRole('link',{name:'Original register',exact:false})).toHaveAttribute('href','https://smlouvy.gov.cz/smlouva/7939187');
 expect(lookups).toBe(1);await expectNoRawDownloads(page);
});

 test('financial status opens with cash and keeps cash stock distinct from annual budget flows',async({page})=>{
 await fixturePraha(page);await openPraha(page);
 const status=page.locator('#financial-status');
 await expect(status).toContainText('Cash & selected deposits');
 await expect(status).toContainText('500,000 CZK');
 await status.getByText('Exact figures, cash movement & definition',{exact:true}).click();
 await expect(status).toContainText('500,000.00 CZK');
 await expect(status).toContainText('100,000.00 CZK');
 await expect(status).toContainText('Its scope differs from consolidated city-and-district budget flows');
 await expect(page.locator('#evidence-cards').getByRole('link',{name:/Hlídač státu/})).toBeVisible();
 });
