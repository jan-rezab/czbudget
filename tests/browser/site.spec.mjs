import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  ["homepage", "/?lang=cs"],
  ["comparison", "/comparison.html?lang=cs"],
  ["methodology", "/methodology.html?lang=cs"],
  ["about", "/about.html?lang=cs"],
  ["country", "/country.html?code=CZE&lang=cs"],
  ["capitals", "/eu-capitals.html?lang=cs"],
  ["international municipalities", "/municipalities/?lang=cs"],
  ["Czech municipalities", "/municipalities/czechia/?lang=cs"],
  ["Polish municipalities", "/municipalities/poland/?lang=cs"],
  ["Norwegian municipalities", "/municipalities/norway/?lang=en"],
  ["Dutch municipalities", "/municipalities/netherlands/?lang=en"],
  ["Finnish municipalities", "/municipalities/finland/?lang=en"],
  ["deep dives", "/deep-dives/?lang=cs"],
  ["transportation deep dive", "/deep-dives/transportation/?code=CZE&lang=cs"],
  ["health deep dive", "/deep-dives/health/?code=CZE&lang=cs"],
  ["state-owned enterprises deep dive", "/deep-dives/state-owned-enterprises/?lang=cs"],
  ["state budget", "/cesky-rozpocet.html?lang=cs"],
  ["municipality", "/cz/municipalities/praha/?lang=cs"],
  ["region", "/cz/kraje/praha/?lang=cs"],
  ["directory", "/cz/municipalities/?lang=cs"],
  ["cities", "/cz/mesta/?lang=cs"],
];

for (const [name, path] of routes) {
  test(`${name} renders without serious accessibility or runtime failures`, async ({ page }) => {
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(message.text());
    });
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
    expect(failures).toEqual([]);
    const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    const serious = results.violations.filter((item) => ["serious", "critical"].includes(item.impact));
    expect(serious).toEqual([]);
  });
}

test("language state survives navigation", async ({ page }) => {
  await page.goto("/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/country.html?code=DEU&lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#country-name")).toContainText("Germany");
});

test("English remains selected when a municipality card is opened", async ({ page }) => {
  await page.goto("/municipalities/?lang=en", { waitUntil: "networkidle" });
  await page.locator("#country-filter").selectOption("CZE");
  await page.locator("#municipality-search").fill("Abertamy");
  const card = page.locator("#municipality-grid .municipality-card");
  await expect(card).toHaveCount(1);
  await card.click({ position: { x: 12, y: 12 } });
  await expect(page).toHaveURL(/\/cz\/municipalities\/abertamy\/\?lang=en/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("state budget translates its Czech static body on an initial English visit", async ({ page }) => {
  await page.goto("/cesky-rozpocet.html?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".budget-hero h1")).toHaveText("Czech state budget");
  await expect(page.locator(".budget-hero")).toContainText("Twenty-five years of revenue and expenditure");
  await expect(page.locator(".fiscal-perimeter-map")).toContainText("Three accounting boundaries");
  await expect(page.locator(".fiscal-perimeter-map")).not.toContainText("Tři účetní hranice");
});

test("comparison and methodology live outside the homepage", async ({ page }) => {
  await page.goto("/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#compare")).toHaveCount(0);
  await expect(page.locator("#method")).toHaveCount(0);
  await expect(page.locator(".home-hero .primary-button")).toBeVisible();
  await expect(page.locator(".glorious-footer")).toContainText("Hlidac statu, z.u.");

  await page.goto("/comparison.html?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#compare-table tr")).toHaveCount(10);
  await expect(page.locator("#fiscal-architecture-body tr")).toHaveCount(10);
  await expect(page.locator('[data-global-nav="compare"]')).toHaveClass(/active/);

  await page.goto("/methodology.html?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator(".method-grid-expanded article")).toHaveCount(6);
  await expect(page.locator(".page-hero")).toContainText("How we compare the data");
  await expect(page.locator('[data-global-nav="method"]')).toHaveClass(/active/);
});

test("homepage compares all fifteen health-system topline metrics", async ({ page }) => {
  await page.goto("/?lang=en", { waitUntil: "networkidle" });
  const comparison = page.locator("#health-performance-compare");
  await expect(comparison).toBeVisible();
  await expect(comparison.locator(".health-compare-tabs button")).toHaveCount(5);
  await expect(comparison.locator(".health-compare-matrix [data-home-health-matrix-metric]")).toHaveCount(15);
  await expect(comparison.locator(".health-compare-rank-row")).toHaveCount(10);
  await comparison.locator('[data-home-health-group="workforce"]').click();
  await expect(comparison.locator(".health-compare-cards button")).toHaveCount(2);
  await comparison.locator("#home-health-anchor").selectOption("DEU");
  await expect(comparison.locator(".health-compare-rank-row.selected")).toContainText("Germany");
  await comparison.locator('[data-home-health-group="outcomes"]').click();
  await comparison.locator('[data-home-health-metric="suicide_rate_per_100k"]').click();
  await expect(comparison.locator("#home-health-metric")).toHaveValue("suicide_rate_per_100k");
  await expect(comparison).toContainText("Suicide mortality");
});

test("about page and footer credit Hlidac statu in both languages", async ({ page }) => {
  await page.goto("/about.html?lang=cs", { waitUntil: "networkidle" });
  await expect(page.locator(".maker-showcase")).toContainText("Hlidac statu, z.u.");
  await expect(page.locator(".maker-showcase")).toContainText("nezisková organizace");
  await expect(page.locator(".glorious-footer")).toContainText("Projekt připravuje");

  await page.locator('[data-lang="en"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".maker-showcase")).toContainText("nonprofit organisation");
  await expect(page.locator(".glorious-footer")).toContainText("Created by");
  await expect(page).toHaveURL(/about\.html\?lang=en/);
});

test("stored English never paints the Czech fallback", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("psd-lang", "en"));
  await page.route("**/lib/data/sovereign-benchmark.v1.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-language-pending", "en");
  await expect(page.locator("body")).toBeHidden();
  await expect(page.locator('[data-i18n="hero1"]')).toHaveText("Public budgets.");
  await expect(page.locator("html")).not.toHaveAttribute("data-language-pending", /.+/);
  await expect(page.locator("body")).toBeVisible();
});

test("deep dives expose dedicated topic hierarchies for countries and capital cities", async ({ page }) => {
  await page.goto("/deep-dives/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator(".deep-card")).toHaveCount(5);
  await expect(page.locator(".deep-card.available")).toHaveCount(5);
  await expect(page.locator(".deep-card.available").first()).toContainText("Transportation");
  await expect(page.locator(".deep-card.available").nth(1)).toContainText("Health");
  await expect(page.locator(".deep-card.available").nth(2)).toContainText("State-owned enterprises");
  await expect(page.locator(".deep-card.available").nth(3)).toContainText("Capital cities");
  await expect(page.locator(".deep-card.available").last()).toContainText("Who actually funds the state?");
  await page.locator(".deep-dive-menu summary").click();
  await expect(page.locator(".deep-dive-menu-panel > a")).toHaveCount(5);
  await page.goto("/deep-dives/capital-cities/?city=prague-cz&lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toContainText("Capital Cities Under Pressure");
  await expect(page.locator("#capital-pressure-city")).toHaveValue("prague-cz");
  await expect(page.locator(".capital-bubble-group")).toHaveCount(28);
  await expect(page.locator("#capital-city-readout")).toContainText("Prague");
  await page.goto("/deep-dives/transportation/?code=CZE&lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#deep-dive-country")).toHaveValue("CZE");
  await expect(page.locator(".transport-network-year")).toHaveCount(10);
  await expect(page.locator(".transport-budget-detail")).toContainText("Budget anatomy");
  await expect(page.locator(".transport-budget-legend > div")).toHaveCount(6);
  await expect(page.locator(".transport-investment-trend span")).toHaveCount(10);
  await expect(page.locator(".transport-budget-detail")).toContainText("291,427 mil.");
  await expect(page.locator(".transport-comparison tbody tr")).toHaveCount(10);
  await expect(page.locator(".transport-coverage-matrix tbody tr")).toHaveCount(10);
  await expect(page.locator(".transport-coverage-audit")).toContainText("Public data and gaps");
  await expect(page.locator(".transport-comparison tr.scope-exception")).toHaveCount(2);
  await expect(page.locator(".transport-performance-audit")).toContainText("Infrastructure performance");
  await expect(page.locator(".transport-infra-kpis")).toContainText("9,514 km");
  await expect(page.locator(".transport-infra-money")).toHaveCount(4);
  await expect(page.locator(".transport-infra-comparison tbody tr")).toHaveCount(10);
  await expect(page.locator(".transport-project-list > article")).toHaveCount(3);
  await page.locator("#deep-dive-country").selectOption("POL");
  await expect(page).toHaveURL(/code=POL/);
  await expect(page.locator("#deep-dive-country-name")).toHaveText("Poland");
  await expect(page.locator(".transport-kpis")).toContainText("1,888 km");
  await expect(page.locator(".transport-budget-detail")).toContainText("125,864 mil.");
});

test("international municipality directory filters by country, year and search", async ({ page }) => {
  await page.goto("/municipalities/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#country-grid .municipal-country-card")).toHaveCount(10);
  await expect(page.locator("#country-filter + .custom-select-button")).toBeVisible();
  await expect(page.locator("#year-filter + .custom-select-button")).toBeVisible();
  await expect(page.locator("#type-filter + .custom-select-button")).toBeVisible();
  await expect(page.locator(".municipality-lang-switch button.active")).toHaveCSS("color", "rgb(250, 247, 239)");
  await expect(page.locator(".municipal-country-card footer").first()).toHaveCSS("margin-left", "0px");
  await expect(page.locator('.municipal-country-card[data-country="NOR"] footer a').first()).toHaveAttribute("href", /\/municipalities\/norway\/\?lang=en$/);
  await expect(page.locator("#total-entities")).not.toHaveText("—");
  await expect(page.locator("#type-filter option[value='all']")).toHaveText("Municipalities + capitals");
  await expect(page.locator("#municipality-grid .capital-card")).toHaveCount(27);
  await expect(page.locator("#about-project")).toContainText("Created by");
  await expect(page.locator("#about-project")).toContainText("Hlidac statu, z.u.");
  await expect(page.locator("#about-project")).toContainText("05965527");
  await page.locator("#country-filter").selectOption("DNK");
  await expect(page.locator("#directory-count")).toContainText("98 entities");
  await page.locator("#municipality-search").fill("Copenhagen");
  await expect(page.locator("#municipality-grid .municipality-card")).toHaveCount(1);
  await expect(page.locator("#municipality-grid")).toContainText("Copenhagen");
  await page.locator("#year-filter").selectOption("2024");
  await expect(page.locator("#directory-count")).toContainText("1 entities");
  await page.locator("#type-filter").selectOption("capital");
  await page.locator("#municipality-search").fill("");
  await expect(page.locator("#directory-count")).toContainText("27 entities");
  await expect(page.locator("#municipality-grid .capital-card")).toHaveCount(27);
});

test("every covered country has a municipality homepage and the navigator connects them", async ({ page, request }) => {
  const countries = ["czechia", "poland", "denmark", "france", "sweden", "england", "ukraine", "norway", "netherlands", "finland"];
  for (const slug of countries) {
    const response = await request.get(`/municipalities/${slug}/?lang=en`);
    expect(response.ok(), `${slug} municipality homepage failed`).toBeTruthy();
  }
  await page.goto("/municipalities/denmark/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#country-title")).toContainText("Budgets of Danish municipalities");
  await expect(page.locator(".dynamic-country-picker")).toContainText("Choose a country");
  await expect(page.locator(".country-picker-readout")).toContainText("Denmark");
  await expect(page.locator("#municipality-country-switch option")).toHaveCount(10);
  await expect(page.locator("#country-insight-grid article")).toHaveCount(4);
  await expect(page.locator("#country-directory-count")).toContainText("98 entities");
  await page.locator("#country-municipality-search").fill("Copenhagen");
  await expect(page.locator("#country-municipality-grid .municipality-card")).toHaveCount(1);
  await page.locator("#municipality-country-switch").selectOption("france");
  await expect(page).toHaveURL(/\/municipalities\/france\/\?lang=en/);
  await expect(page.locator("#country-title")).toContainText("Budgets of French municipalities");
});

test("country profiles expose sortable ten-year health, social and transport comparisons", async ({ page }) => {
  await page.goto("/country.html?code=CZE&lang=en", { waitUntil: "networkidle" });
  for (const id of ["healthcare", "social-system"]) {
    const section=page.locator(`#${id}`);
    await expect(section.locator(".function-bar-column")).toHaveCount(10);
    await expect(section.locator("tbody tr")).toHaveCount(10);
    await expect(section.locator(".sortable-header-button")).toHaveCount(5);
  }
  const transport=page.locator("#transportation");
  await expect(transport.locator(".function-bar-column")).toHaveCount(10);
  await expect(transport.locator(".transport-network-year")).toHaveCount(10);
  await expect(transport.locator(".transport-kpis article")).toHaveCount(5);
  await expect(transport.locator("tbody tr")).toHaveCount(10);
  await expect(transport.locator(".sortable-header-button")).toHaveCount(7);
  await expect(transport.locator(".transport-contract")).toContainText("Absolute kilometres alone are not a quality ranking");
  await expect(transport).toContainText("1,486 km");
  await expect(page.locator("#healthcare-system")).toBeVisible();
  await expect(page.locator("#provider-network")).toBeVisible();
  await page.locator("#country-switch").selectOption("DEU");
  await expect(page.locator("#healthcare-system")).toBeVisible();
  await expect(page.locator("#country-function-health-title")).toHaveText("Health spending, 2015–2024");
  await expect(transport).toContainText("13,210 km");
});

test("public-entity profiles expose broad perimeters, economics and the full searchable registry", async ({ page }) => {
  await page.goto("/country.html?code=CHE&lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#country-public-entities-title")).toHaveText("Public entities, without blind spots.");
  await expect(page.locator("#public-entities .pe-kpis")).toContainText("5,152");
  await expect(page.locator("#public-entities .pe-kpis")).toContainText("22");
  await expect(page.locator("#public-entities .pe-comparison tbody tr")).toHaveCount(10);
  await expect(page.locator("#public-entities .pe-aggregate-table tbody tr")).toHaveCount(6);
  await page.locator("[data-pe-search]").fill("Swisscom");
  await expect(page.locator("#public-entities .pe-directory tbody tr")).toHaveCount(1);
  await page.locator("#public-entities [data-record]").click();
  await expect(page.locator("#public-entities .pe-inspector")).toContainText("Swisscom");
  await expect(page.locator("#public-entities .pe-inspector")).toContainText("11036");
  await expect(page.locator("#public-entities .pe-inspector a")).toHaveAttribute("href", /efv\.admin\.ch/);
  await page.locator("#country-switch").selectOption("CZE");
  await expect(page.locator("#public-entities .pe-kpis")).toContainText("18,238");
  await expect(page.locator("#public-entities .pe-directory-meta")).toContainText("18,238 matching rows");
});

test("health deep dive keeps ten system profiles and the ten-country spending comparison", async ({ page }) => {
  await page.goto("/deep-dives/health/?code=CZE&lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#deep-dive-country option")).toHaveCount(10);
  await expect(page.locator("#country-function-health tbody tr")).toHaveCount(10);
  await expect(page.locator("#healthcare-system")).toBeVisible();
  await expect(page.locator("#hospital-benchmark")).toBeVisible();
  await expect(page.locator("#country-health-kpis article")).toHaveCount(4);
  await page.locator("[data-health-mode=provider]").click();
  await expect(page.locator(".country-health-flow-row")).toHaveCount(5);
  await page.locator("#deep-dive-country").selectOption("DEU");
  await expect(page.locator("#deep-dive-country-code")).toHaveText("DEU");
  await expect(page.locator("#country-health-architecture-copy")).toContainText("Statutory sickness funds");
  await expect(page.locator("#hospital-budget-unit")).toContainText("EUR");
});

test("country cash-in keeps municipal and company layers separate", async ({ page }) => {
  await page.goto("/country.html?code=CZE&lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#cash-in .cash-consolidated")).toContainText("The only comparable total");
  await expect(page.locator("#cash-in .cash-layer-card")).toHaveCount(4);
  await expect(page.locator("#cash-in")).toContainText("534.1 bn CZK");
  await expect(page.locator("#cash-in")).toContainText("689.5 bn CZK");
  await expect(page.locator("#cash-in .cash-nonadd")).toContainText("Do not add these cards");
  await expect(page.locator("#cash-in tbody tr")).toHaveCount(20);
  await expect(page.locator("#cash-in .sortable-header-button")).toHaveCount(5);
  await page.locator("#country-switch").selectOption("DEU");
  await expect(page.locator("#cash-in .cash-layer-card")).toHaveCount(0);
  await expect(page.locator("#cash-in .cash-loaded-grid article")).toHaveCount(3);
  await expect(page.locator("#cash-in")).toContainText("Loaded national budget");
  await expect(page.locator("#cash-in")).toContainText("Official public-sector universe");
  await expect(page.locator("#cash-in .cash-detail-missing")).toHaveCount(0);
});

test("all countries use the Czech-style dashboard chapters and loaded-data sections", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Ten-country data wiring is covered once on desktop; responsive rendering is covered by the route suite.");
  test.setTimeout(180_000);
  const countries = ["CZE", "DEU", "DNK", "FRA", "GBR", "POL", "SWE", "CHE", "UKR", "USA"];
  for (const lang of ["cs", "en"]) {
    for (const code of countries) {
      const failures = [];
      page.removeAllListeners("pageerror");
      page.removeAllListeners("console");
      page.on("pageerror", error => failures.push(error.message));
      page.on("console", message => { if (message.type() === "error") failures.push(message.text()); });
      await page.goto(`/country.html?code=${code}&lang=${lang}`, {waitUntil:"networkidle"});
      await expect(page.locator("#country-dashboard-index a")).toHaveCount(8);
      await expect(page.locator(".country-context-rail a")).toHaveCount(9);
      await expect(page.locator("#budget-map .budget-map-row").first()).toBeVisible();
      await expect(page.locator("#public-entities .pe-directory")).toBeVisible();
      await expect(page.locator("#demography .demography-year")).toHaveCount(5);
      await expect(page.locator("#data-parity")).toBeVisible();
      const order = await page.locator("main > section").evaluateAll(sections => sections.map(section => section.id));
      expect(order.indexOf("data-parity"), `${code}/${lang}: methodology belongs after insight chapters`).toBeGreaterThan(order.indexOf("demography"));
      if (code === "CZE") await expect(page.locator("#cash-in .cash-layer-card")).toHaveCount(4);
      else await expect(page.locator("#cash-in .cash-loaded-grid article")).toHaveCount(3);
      expect(failures, `${code}/${lang}: runtime errors`).toEqual([]);
    }
  }
});

test("municipal directory explains the aggregate balance in both languages", async ({ page }) => {
  await page.goto("/cz/municipalities/?lang=cs", { waitUntil: "networkidle" });
  const story = page.locator(".municipal-aggregate-story");
  await expect(story).toContainText("43,4 mld. Kč vytvořily přebytkové obce.");
  await expect(story.locator(".aggregate-cohort")).toHaveCount(3);
  await expect(story).toContainText("+14,9 mld. Kč");
  await expect(story.locator(".piggy-panel li")).toHaveCount(5);
  await expect(story).toContainText("16,9 mld. Kč");

  await page.goto("/cz/municipalities/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator(".municipal-aggregate-story")).toContainText("CZK 43.4bn generated by surplus municipalities.");
  await expect(page.locator(".piggy-panel")).toContainText("The five largest deficits reduced the result by CZK 2bn.");
});

test("nationwide municipal explorer drives the aggregate story and directory year", async ({ page }) => {
  await page.goto("/cz/municipalities/?lang=cs&year=2010", { waitUntil: "networkidle" });
  await expect(page.locator("#municipality-year")).toHaveValue("2010");
  await expect(page.locator("#municipality-year-coverage")).toContainText("6 245 obcí");
  await expect(page.locator("#nationwide-history-kpis")).toContainText("283,6 mld. Kč");
  await expect(page.locator("#nationwide-history-chart .history-line")).toHaveCount(3);
  await expect(page.locator("#spending-benchmark-summary")).toContainText("27 295 Kč / obyv.");
  await expect(page.locator("#spending-benchmark-chart article")).toHaveCount(8);
  await expect(page.locator("#municipality-count")).toContainText("6 245 s daty za 2010");
  await expect(page.locator("#municipality-grid .entity-card").first()).toContainText("2010 · IČO");

  await page.locator("#municipality-year").selectOption("2023");
  await expect(page).toHaveURL(/year=2023/);
  await expect(page.locator("#nationwide-history-kpis")).toContainText("+55,7 mld. Kč");
  await expect(page.locator("#municipality-directory-year")).toHaveText("2023");
  await expect(page.locator("#nationwide-history-table-body .selected-history-row th")).toHaveText("2023");

  await page.locator("#municipality-year").selectOption("2010");
  await page.locator("#municipality-query").fill("Poličná");
  await expect(page.locator("#municipality-count")).toContainText("0 s daty za 2010");
  await expect(page.locator("#municipality-grid .entity-card")).toContainText("—");

  await page.locator("#municipality-year").selectOption("2025");
  await page.locator("#municipality-query").fill("Abertamy");
  await expect(page.locator("#municipality-grid .entity-card")).toContainText("822 obyvatel");
  await expect(page.locator("#municipality-grid .entity-spending-benchmark")).toContainText("38 856 Kč / obyv.");
  await page.locator("#municipality-sort").selectOption("expense_per_capita");
  await expect(page.locator("#municipality-sort")).toHaveValue("expense_per_capita");
});

test("municipal profiles expose 2010–2025 history and preserve genuine coverage gaps", async ({ page }) => {
  await page.goto("/cz/municipalities/abertamy/?lang=cs", { waitUntil: "networkidle" });
  await expect(page.locator("#history-explorer .kicker")).toHaveText("16 let / 2010–2025");
  await expect(page.locator("#history-table-body tr")).toHaveCount(16);
  await expect(page.locator("#history-kpis")).toContainText("Součet výsledků za 16 let");
  await expect(page.locator('.source-list a[href$="/data/municipal-history/00254398.json"]')).toBeVisible();

  await page.goto("/cz/municipalities/abertamy/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#history-explorer .kicker")).toHaveText("16 years / 2010-2025");
  await expect(page.locator("#history-kpis")).toContainText("16-year cumulative balance");

  await page.goto("/cz/municipalities/policna/?lang=cs", { waitUntil: "networkidle" });
  await expect(page.locator("#history-table-body tr")).toHaveCount(13);
  await expect(page.locator("#history-kpis")).toContainText("Součet výsledků za 13 let");
  await expect(page.locator("#history-table-body")).not.toContainText("2010");
});

test("municipal detail charts use meaningful units, hover values and currency recalculation", async ({ page }) => {
  await page.goto("/cz/municipalities/arnoltice/?lang=en", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle(/Arnoltice town and municipality budget/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/cz\/municipalities\/arnoltice\/$/);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_GB");
  expect(await page.locator('script[type="application\/ld\+json"]').textContent()).toContain('"inLanguage":"en"');
  await expect(page.locator("#history-kpis article").first()).toContainText("CZK 18.6m");
  await expect(page.locator("#history-kpis")).not.toContainText("CZK 0bn");
  await expect(page.locator(".history-year-hit")).toHaveCount(16);
  await page.locator(".history-year-hit").last().hover();
  await expect(page.locator(".history-tooltip")).toBeVisible();
  await expect(page.locator(".history-tooltip")).toContainText("2025");
  await expect(page.locator(".history-tooltip")).toContainText("CZK 18.6m");
  await page.locator(".municipal-currency-control select").selectOption("EUR");
  await expect(page.locator(".detail-kpis article").first()).toContainText("€769.3k");
  await expect(page.locator("#history-kpis article").first()).toContainText("€770.3k");
  await expect(page.locator("#history-chart .history-grid")).toContainText("EUR m");
});

test("all representative page menus resolve and primary navigation routes correctly", async ({ page, request }) => {
  test.setTimeout(120_000);
  for (const route of routes.map(([, path]) => path)) {
    await page.goto(route, { waitUntil: "networkidle" });
    const hrefs = await page.locator("header a[href], header nav a[href], .detail-nav a[href], .breadcrumbs a[href]").evaluateAll((links) =>
      [...new Set(links.map((link) => link.href).filter((href) => href.startsWith(location.origin)))]
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const target = new URL(href); target.hash = "";
      const response = await request.get(target.href);
      expect(response.ok(), `${route} menu target failed: ${target.href}`).toBeTruthy();
    }
  }

  await page.goto("/?lang=cs", { waitUntil: "networkidle" });
  await page.locator('[data-global-nav="cities"]').click();
  await expect(page).toHaveURL(/\/municipalities\/\?lang=cs/);
  await page.goto("/?lang=cs", { waitUntil: "networkidle" });
  await page.locator(".country-menu summary").click();
  await expect(page.locator(".country-menu-panel a")).toHaveCount(12);
  await page.locator('.country-menu-panel a[href*="code=CZE"]').click();
  await expect(page).toHaveURL(/\/country\.html\?code=CZE&lang=cs/);
});

test("every page family renders the same shared header component", async ({ page }) => {
  const representatives = [
    "/?lang=en",
    "/comparison.html?lang=en",
    "/methodology.html?lang=en",
    "/about.html?lang=en",
    "/country.html?code=CZE&lang=en",
    "/municipalities/?lang=en",
    "/deep-dives/transportation/?code=CZE&lang=en",
    "/cz/municipalities/praha/?lang=en",
    "/cz/kraje/praha/?lang=en",
    "/cz/mesta/?lang=en",
  ];
  const expectedItems = ["Home", "Compare", "Municipalities", "Country⌄", "Deep dives⌄", "Methodology", "About"];
  for (const route of representatives) {
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator("psd-site-header")).toHaveCount(1);
    await expect(page.locator("psd-site-header > .site-header")).toHaveCount(1);
    await expect(page.locator("psd-site-header .global-nav")).toBeVisible();
    await expect(page.locator('link[data-psd-site-header]')).toHaveCount(1);
    const items = await page.locator(".global-nav > a, .global-nav > details > summary").allTextContents();
    expect(items.map((item) => item.replace(/\s+/g, ""))).toEqual(expectedItems.map((item) => item.replace(/\s+/g, "")));
  }
});

test("state-owned enterprise catalogue ranks, filters and translates thirty sourced records", async ({ page }) => {
  await page.goto("/deep-dives/state-owned-enterprises/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#soe-body tr")).toHaveCount(30);
  await expect(page.locator("#soe-body tr").first()).toContainText("EDF Group");
  await expect(page.locator("#soe-body tr").first()).toContainText("€118.7 bn");
  await expect(page.locator("#soe-country-grid article")).toHaveCount(10);
  await page.locator("#soe-country").selectOption("SWE");
  await expect(page.locator("#soe-body tr")).toHaveCount(3);
  await expect(page.locator("#soe-body")).toContainText("Vattenfall");
  await page.locator("#soe-reset").click();
  await page.locator("#soe-search").fill("postal");
  await expect(page.locator("#soe-body tr")).toHaveCount(3);
  await page.locator('[data-lang="cs"]').click();
  await expect(page).toHaveURL(/lang=cs/);
  await expect(page.locator("#catalogue h2")).toHaveText("Jedna účetní řádka. Jedna měna.");
});

test("cities use the functional unified menu on desktop and mobile", async ({ page }) => {
  await page.goto("/cz/mesta/?lang=cs", { waitUntil: "networkidle" });
  const countryMenu = page.locator(".country-menu");
  await countryMenu.locator("summary").click();
  await expect(countryMenu).toHaveAttribute("open", "");
  await expect(countryMenu.locator(".country-menu-panel a")).toHaveCount(12);
  const panelBox = await countryMenu.locator(".country-menu-panel").boundingBox();
  expect(panelBox?.width).toBeLessThanOrEqual(430);
  expect(panelBox?.height).toBeLessThan(700);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".global-nav")).toBeVisible();
  await expect(page.locator('[data-global-nav="cities"]')).toBeVisible();
  await page.locator('[data-global-nav="home"]').click();
  await expect(page).toHaveURL(/\/index\.html\?lang=cs/);
});
