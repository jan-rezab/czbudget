import { expect, test } from "@playwright/test";

const sharedStructure = [
  ".detail-hero",
  ".detail-kpis",
  "#history-explorer",
  "#rozpocet",
  ".plan-panel",
  ".detail-grid",
  "#metodika.data-contract",
];

const generatedProfileFamilies = [
  "/municipalities/denmark/aabenraa-580/",
  "/municipalities/brazil/estiva-3124500/",
  "/municipalities/spain/ababuj-44001aa000/",
  "/municipalities/japan/municipality-242144/",
  "/municipalities/colombia/abejorral-210205002/",
  "/municipalities/georgia/municipality-mof-033/",
  "/municipalities/italy/abano-terme-000105310/",
  "/municipalities/bolivia/autonomia-del-territorio-indigena-originario-campesino-guarani-chaqueno-de-huacaya-3101/",
  "/municipalities/el-salvador/acajutla-8301/",
  "/municipalities/mexico/aguascalientes-01001/",
  "/municipalities/costa-rica/abangares-sipp-abangares/",
  "/municipalities/guatemala/cahabon-12101612/",
  "/municipalities/peru/aramango-300023/",
  "/municipalities/south-korea/municipality-4213000/",
  "/municipalities/chile/antofagasta-02101/",
  "/municipalities/norway/oslo-oslove-0301/",
  "/municipalities/netherlands/laarbeek-1659/",
  "/municipalities/finland/saarijarvi-729/",
];

test("Brno keeps the full Czech budget template while sharing the municipal hierarchy", async ({ page }) => {
  await page.goto("/cz/municipalities/brno/?lang=en");
  await expect(page.locator("body")).toHaveClass(/cz-budget-page/);
  await expect(page.locator(".municipal-profile-loading")).toHaveCount(0);
  await expect(page.locator("#history-explorer")).toBeVisible();
  await expect(page.locator("#rozpocet .plan-panel")).toBeVisible();
  await expect(page.locator("#metodika.data-contract")).toBeVisible();

  for (const route of [
    "/cz/municipalities/brno/?lang=en",
    "/municipalities/brazil/sao-paulo-3550308/?lang=en",
  ]) {
    await page.goto(route);
    for (const selector of sharedStructure) await expect(page.locator(selector)).toBeVisible();
    await expect(page.locator(".detail-kpis article")).toHaveCount(4);
  }
});

test("Czech profiles surface warehouse purpose and economic detail without changing reconciled totals", async ({ page }) => {
  await page.route("**/fixture/cze-profile.json", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      period: { fiscal_year: 2025 },
      entity: {
        national_id: "44992785", short_name: "Brno", currency_code: "CZK", fiscal_year: 2025,
        territory: { region_name: "Jihomoravský kraj" },
        sources: { budget: "https://monitor.statnipokladna.gov.cz/ucetni-jednotka/44992785/rozpocet/souhrnny?obdobi=2512&rad=t" },
        amounts: {
          revenue_approved: 21000000000, revenue_adjusted: 23000000000, revenue_actual: 23700000000,
          expense_approved: 26000000000, expense_adjusted: 27600000000, expense_actual: 23000000000,
          tax_revenue: 17000000000, transfer_revenue: 4000000000, nontax_revenue: 2000000000,
          capital_revenue: 700000000, current_expense: 15000000000, capital_expense: 8000000000,
          budget_balance: 700000000, cash_current: 9600000000,
        },
      },
    }),
  }));
  await page.route("**/public-data/municipality-lines?country=CZE&code=44992785", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      schema_version: "1.0.0",
      country: "CZE",
      entity_code: "44992785",
      currency: "CZK",
      years: [2025],
      coverage: { line_count: 4, stages: ["actual"], dimensions: { economic: 2, functional: 2 } },
      lines: [
        { year: 2025, period: "2025-12", stage: "actual", side: "expenditure", dimension: "functional", code: "3113", name_native: "Základní školy", name_cs: "Základní školy", amount: 980000000, currency: "CZK" },
        { year: 2025, period: "2025-12", stage: "actual", side: "expenditure", dimension: "functional", code: "2212", name_native: "Silnice", name_cs: "Silnice", amount: 720000000, currency: "CZK" },
        { year: 2025, period: "2025-12", stage: "actual", side: "expenditure", dimension: "economic", code: "5011", name_native: "Platy zaměstnanců", name_cs: "Platy zaměstnanců", amount: 410000000, currency: "CZK" },
        { year: 2025, period: "2025-12", stage: "actual", side: "expenditure", dimension: "economic", code: "5137", name_native: "Drobný dlouhodobý hmotný majetek", name_cs: "Drobný dlouhodobý hmotný majetek", amount: 90000000, currency: "CZK" },
      ],
      source_url: "https://monitor.statnipokladna.gov.cz/",
    }),
  }));

  await page.goto("/about.html?lang=cs");
  await page.setContent(`<!doctype html><html lang="cs"><head><meta name="description" content=""><link rel="canonical" href=""><link rel="alternate" hreflang="cs" href=""><link rel="alternate" hreflang="en" href=""></head><body data-profile-url="/fixture/cze-profile.json" data-warehouse-country="CZE" data-warehouse-code="44992785"><psd-site-header></psd-site-header><main><p class="municipal-profile-loading">Loading</p></main><footer></footer><script src="/municipal-expanded-profile.js"></script></body></html>`);
  await expect(page.locator('[data-detail-dimension="functional"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#native-detail h2")).toHaveText("Výdaje podle veřejného účelu");
  await expect(page.locator("#profile-detail-visual")).toContainText("Základní školy");
  await expect(page.locator("#profile-detail-visual")).not.toContainText("Platy zaměstnanců");

  await page.locator('[data-detail-dimension="economic"]').click();
  await expect(page.locator('[data-detail-dimension="economic"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#profile-detail-visual")).toContainText("Platy zaměstnanců");
  await expect(page.locator("#profile-detail-visual")).not.toContainText("Základní školy");
  await expect(page.locator(".budget-stage-actual")).toBeVisible();
  await expect(page.locator('.source-list a').first()).toHaveAttribute("href", /ucetni-jednotka\/44992785/);
  await expect(page.locator('a[href*="/public-data/municipality-lines?country=CZE"]')).toBeVisible();
});

test("Polish budget codes show English labels with the official Polish label beneath", async ({ page }) => {
  await page.route("**/fixture/pol-profile.json", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      country: "POL", code: "0611032", name: "Adamów", currency: "PLN", years: [2024],
      history: [{ year: 2024, revenue: 10_000_000, expenditure: 7_350_000, balance: 2_650_000 }],
      latest: { year: 2024, revenue: 10_000_000, expenditure: 7_350_000, balance: 2_650_000 },
      detail: [], source_url: "https://finansejst.mf.gov.pl/",
    }),
  }));
  await page.route("**/public-data/municipality-lines?country=POL&code=0611032", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      country: "POL", entity_code: "0611032", currency: "PLN", years: [2024],
      lines: [{ year: 2024, stage: "actual", side: "expenditure", code: "4010", amount: 7_350_000 }],
      source_url: "https://finansejst.mf.gov.pl/",
    }),
  }));

  await page.goto("/about.html?lang=en");
  await page.setContent(`<!doctype html><html lang="en"><head><meta name="description" content=""><link rel="canonical" href=""><link rel="alternate" hreflang="cs" href=""><link rel="alternate" hreflang="en" href=""></head><body data-profile-url="/fixture/pol-profile.json" data-warehouse-country="POL" data-warehouse-code="0611032"><main><p class="municipal-profile-loading">Loading</p></main><footer></footer><script src="/municipal-expanded-profile.js"></script></body></html>`);

  const row = page.locator("#profile-detail-visual .native-visual-row").first();
  await expect(row.locator("strong").first()).toHaveText("Employee salaries");
  await expect(row.locator("small")).toContainText("Wynagrodzenia osobowe pracowników · 4010");
  expect(await row.locator("small").evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)))
    .toBeLessThan(await row.locator("strong").first().evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)));
});

test("Brazilian profile reconciles stages and keeps tax rows on the revenue side", async ({ page }) => {
  await page.goto("/municipalities/brazil/sao-paulo-3550308/?lang=en");
  await page.locator('[data-profile-currency="native"]').click();

  const actual = page.locator(".budget-stage-actual");
  await expect(actual).toContainText("R$112,335,533,909");
  await expect(actual).toContainText("R$106,090,574,099");
  await expect(actual).toContainText("R$6,244,959,810");

  await expect(page.locator('[data-detail-side="expenditure"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#profile-detail-visual .native-visual-row").first()).toBeVisible();
  await page.locator('[data-detail-side="revenue"]').click();
  await expect(page.locator('[data-detail-side="revenue"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#profile-detail-visual")).toContainText("ReceitaTributaria");
  const taxRow = page.locator("#profile-detail tbody tr", { hasText: "ReceitaTributaria" }).first();
  await expect(taxRow).toContainText("Revenue");
  await expect(page.locator("#profile-detail-stage")).toContainText("In period");
  await expect(page.locator("#profile-detail-stage")).toContainText("Remaining");

  await page.locator("#profile-detail-search").fill("Taxas");
  await expect(page.locator("#profile-detail-visual")).toContainText("Taxas");
  await expect(page.locator("#profile-detail-visual")).not.toContainText("Receitas de Capital");
});

test("municipal profiles always offer auditable EUR, USD and native currency views", async ({ page }) => {
  await page.goto("/municipalities/brazil/sao-paulo-3550308/?lang=en");

  const revenue = page.locator(".detail-kpis article").first().locator("strong");
  await expect(page.locator('[data-profile-currency="EUR"]')).toHaveAttribute("aria-pressed", "true");
  await expect(revenue).toContainText("€");
  await expect(page.locator(".profile-currency-converter")).toContainText("IMF WEO annual rate 2024");
  await expect(page.locator(".profile-currency-converter")).toContainText("nearest available year");

  await page.locator('[data-profile-currency="USD"]').click();
  await expect(revenue).toContainText("$");
  await page.reload();
  await expect(page.locator('[data-profile-currency="USD"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator('[data-profile-currency="native"]').click();
  await expect(revenue).toContainText("R$");

  for (const route of [
    "/municipalities/japan/municipality-242144/",
    "/municipalities/denmark/aabenraa-580/",
    "/municipalities/spain/ababuj-44001aa000/",
    "/municipalities/el-salvador/acajutla-8301/",
  ]) {
    await page.goto(`${route}?lang=en`);
    await page.locator('[data-profile-currency="EUR"]').click();
    await expect(page.locator(".profile-currency-converter"), route).toBeVisible();
    await expect(page.locator('[data-profile-currency="EUR"]'), route).toHaveAttribute("aria-pressed", "true");
  }
});

test("every generated country family renders the shared municipal hierarchy", async ({ page }) => {
  test.setTimeout(120_000);
  for (const route of generatedProfileFamilies) {
    await page.goto(`${route}?lang=en`);
    await expect(page.locator(".detail-hero"), route).toBeVisible();
    await expect(page.locator(".detail-kpis article"), route).toHaveCount(4);
    await expect(page.locator("#history-explorer"), route).toBeVisible();
    await expect(page.locator("#native-detail"), route).toBeVisible();
    await expect(page.locator(".municipal-profile-loading"), route).toHaveCount(0);
  }
});

test("international profiles remain useful without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/municipalities/brazil/sao-paulo-3550308/?lang=en");
  await expect(page.locator(".detail-hero h1")).toHaveText("São Paulo");
  await expect(page.locator(".detail-kpis article")).toHaveCount(4);
  await expect(page.locator("#history-explorer")).toBeVisible();
  await expect(page.locator("#rozpocet .plan-panel")).toBeVisible();
  await expect(page.locator(".detail-kpis")).toContainText("BRL");
  await expect(page.locator("#profile-detail-visual .native-visual-row")).toHaveCount(10);
  await expect(page.locator(".raw-detail-audit")).not.toHaveAttribute("open", "");
  await expect(page.locator("#profile-detail tbody tr")).toHaveCount(11);
  await expect(page.locator("#metodika.data-contract")).toBeVisible();
  await context.close();
});

test("section navigation follows the data available for each country", async ({ page }) => {
  await page.goto("/municipalities/denmark/aabenraa-580/?lang=en");
  await expect(page.locator(".international-context-rail a")).toHaveText(["Overview", "Budget", "Detail", "Method"]);
  await expect(page.locator(".detail-kpis article").first()).toContainText("Not available");

  await page.goto("/municipalities/norway/oslo-oslove-0301/?lang=en");
  await expect(page.locator(".international-context-rail a")).toHaveText(["Overview", "Trend", "Accounts", "Detail", "Method"]);

  await page.goto("/municipalities/germany/profile/?code=F07235500700010&lang=en");
  await expect(page.locator(".international-context-rail a")).toHaveText(["Overview", "Trend", "Accounts", "Coverage", "Method"]);
  await expect(page.locator("#native-detail")).toContainText("No item-level city budget is inferred");
});

test("French communes expose DGFiP account lines separately from functional purpose", async ({ page }) => {
  await page.route("**/public-data/france-municipality-lines?code=31555", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      entity_code: "31555", currency: "EUR", years: [2025],
      coverage: { economic_account_detail: true, economic_line_count: 2, functional_purpose_detail: true, functional_line_count: 1 },
      economic: [
        { year: 2025, stage: "actual", side: "expenditure", code: "60612", name_native: "Énergie et électricité", name_en: "Energy and electricity", name_cs: "Energie a elektřina", amount: 1250, currency: "EUR" },
        { year: 2025, stage: "actual", side: "expenditure", code: "64", name_native: "Charges de personnel", name_en: "Personnel costs", name_cs: "Osobní náklady", amount: 900, currency: "EUR" },
      ],
      functional: [
        { year: 2025, stage: "actual", side: "expenditure", code: "212", name_native: "Enseignement et formation", name_en: "Education and training", name_cs: "Vzdělávání a odborná příprava", amount: 1250, currency: "EUR" },
      ],
      source_url: "https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-communes-en-2025/",
    }),
  }));
  await page.goto("/municipalities/france/profile/?code=31555&lang=en");
  await expect(page.locator(".detail-hero h1")).toHaveText("Toulouse");
  await expect(page.locator(".detail-kpis article")).toHaveCount(4);
  await expect(page.locator("#history-table-body tr")).toHaveCount(2);
  await expect(page.locator("#native-detail")).toContainText("Spending by economic account");
  await expect(page.locator("#native-detail")).toContainText("Energy and electricity");
  await expect(page.locator(".france-detail-contract")).toContainText("2 reported lines");
  await page.getByRole("button", { name: "Public purpose" }).click();
  await expect(page.locator("#native-detail h2")).toHaveText("Spending by public purpose");
  await expect(page.locator("#native-detail")).toContainText("Education and training");
  await expect(page.locator('.source-list a[href*="refine.com_code=31555"]')).toBeVisible();
  await expect(page.locator('.source-list a[href*="budget-primitif-2026-ville-de-toulouse"]')).toContainText("Published approved budget 2026");
  await expect(page.locator('.source-list a[href*="balances-comptables-des-regions"]')).toContainText("Official regional accounts");

  await page.goto("/municipalities/france/?lang=en");
  expect(await page.locator(".municipality-card").first().locator("dd").allTextContents()).not.toContain("—");
  await expect(page.locator('.municipality-card a[href*="/municipalities/france/profile/?code="]').first()).toBeVisible();
  await expect(page.locator('#country-context-grid a[href*="balances-comptables-des-regions"]')).toBeVisible();
  await expect(page.locator("#country-insight-grid")).toContainText("Total revenue");
  await expect(page.locator("#country-insight-grid")).toContainText("34,778");
  await expect(page.locator("#municipal-balance-split")).toContainText("Communes in surplus");
  await expect(page.locator("#municipal-ranking-grid .municipal-ranking-card")).toHaveCount(3);
  await expect(page.locator("#municipal-ranking-grid .municipal-ranking-card").first()).toContainText("Paris");
  await expect(page.locator("#country-municipality-grid .municipality-card").first().locator("h3")).toHaveText("Paris");
  await page.locator("#country-municipality-search").fill("Toulouse");
  await expect(page.locator("#country-municipality-grid .municipality-card").first().locator("h3")).toHaveText("Toulouse");
  await page.locator("#country-municipality-search").fill("");
  await page.locator("#country-balance-filter").selectOption("deficit");
  await expect(page.locator("#country-municipality-grid .municipality-card").first().locator("dd.negative")).toBeVisible();
});

test("a French commune without functional codes still surfaces economic accounts honestly", async ({ page }) => {
  await page.route("**/public-data/france-municipality-lines?code=55001", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      entity_code: "55001", currency: "EUR", years: [2025],
      coverage: { economic_account_detail: true, economic_line_count: 55, functional_purpose_detail: false, functional_line_count: 0 },
      economic: [{ year: 2025, stage: "actual", side: "expenditure", code: "60612", name_native: "Énergie et électricité", name_en: "Energy and electricity", name_cs: "Energie a elektřina", amount: 1250, currency: "EUR" }],
      functional: [],
      source_url: "https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-communes-en-2025/",
    }),
  }));
  await page.goto("/municipalities/france/profile/?code=55001&lang=en");
  await expect(page.locator(".detail-hero h1")).toHaveText("Abainville");
  await expect(page.locator("#native-detail")).toContainText("Energy and electricity");
  await expect(page.locator(".france-detail-contract")).toContainText("Not reported for this commune");
  await expect(page.getByRole("button", { name: "Public purpose" })).toBeDisabled();
});
