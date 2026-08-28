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

test("French communes expose OFGL accounts, city sources and separate regional data", async ({ page }) => {
  await page.goto("/municipalities/france/profile/?code=31555&lang=en");
  await expect(page.locator(".detail-hero h1")).toHaveText("Toulouse");
  await expect(page.locator(".detail-kpis article")).toHaveCount(4);
  await expect(page.locator("#history-table-body tr")).toHaveCount(2);
  await expect(page.locator("#native-detail")).toContainText("Official OFGL aggregates");
  await expect(page.locator('.source-list a[href*="refine.com_code=31555"]')).toBeVisible();
  await expect(page.locator('.source-list a[href*="budget-primitif-2026-ville-de-toulouse"]')).toContainText("Published approved budget 2026");
  await expect(page.locator('.source-list a[href*="balances-comptables-des-regions"]')).toContainText("Official regional accounts");

  await page.goto("/municipalities/france/?lang=en");
  expect(await page.locator(".municipality-card").first().locator("dd").allTextContents()).not.toContain("—");
  await expect(page.locator('.municipality-card a[href*="/municipalities/france/profile/?code="]').first()).toBeVisible();
  await expect(page.locator('#country-context-grid a[href*="balances-comptables-des-regions"]')).toBeVisible();
});
