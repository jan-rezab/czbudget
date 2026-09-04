import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const origin = "http://127.0.0.1:4173";

test("shared dropdown values remain readable in page-specific labels", async ({ page }) => {
  for (const route of ["/?lang=en", "/comparison.html?lang=en"]) {
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator(".custom-select-value").first()).toBeVisible();
    const audit = await new AxeBuilder({ page }).include(".custom-select-button").withRules(["color-contrast"]).analyze();
    expect(audit.violations).toEqual([]);
  }
});

function collectRuntimeFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  return failures;
}

test("shared loaders are idempotent across duplicate execution and language renders", async ({ page }) => {
  const failures = collectRuntimeFailures(page);
  await page.goto("/?lang=en", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__initialSharedNavigation = window.PSDSharedComponents.navigation;
    window.__initialSharedFooter = window.PSDSharedComponents.footer;
  });

  await page.addScriptTag({ url: `${origin}/global-nav.js?duplicate-loader-test` });
  await page.addScriptTag({ url: `${origin}/global-footer.js?duplicate-loader-test` });
  await page.evaluate(() => { document.documentElement.lang = "cs"; });

  await expect(page.locator("psd-site-header")).toHaveCount(1);
  await expect(page.locator("body > footer[data-global-footer]")).toHaveCount(1);
  await expect(page.locator(".glorious-footer .footer-links")).toContainText("O projektu");
  const singletonState = await page.evaluate(() => ({
    navigation: window.PSDSharedComponents.navigation === window.__initialSharedNavigation,
    footer: window.PSDSharedComponents.footer === window.__initialSharedFooter,
  }));
  expect(singletonState).toEqual({ navigation: true, footer: true });
  expect(failures).toEqual([]);
});

test("shared components preserve legacy DOM while installing owned replacements", async ({ page }) => {
  const failures = collectRuntimeFailures(page);
  await page.goto(`${origin}/global-nav.js`, { waitUntil: "domcontentloaded" });
  await page.setContent(`<!doctype html><html lang="en"><head></head><body>
    <header class="site-header has-global-nav"><a id="legacy-header-control" href="#legacy">Legacy header</a></header>
    <main><h1>Lifecycle fixture</h1></main>
    <footer><small id="legacy-footer-control">Legacy footer</small></footer>
  </body></html>`);
  await page.addScriptTag({ url: `${origin}/global-nav.js?legacy-preservation-test` });

  await expect(page.locator("psd-site-header > .site-header")).toHaveCount(1);
  await expect(page.locator("body > footer[data-global-footer].glorious-footer")).toHaveCount(1);
  await expect(page.locator('body > header[data-shared-component-legacy="header"]')).toHaveAttribute("hidden", "");
  await expect(page.locator('body > footer[data-shared-component-legacy="footer"]')).toHaveAttribute("hidden", "");
  await expect(page.locator("#legacy-header-control")).toHaveText("Legacy header");
  await expect(page.locator("#legacy-footer-control")).toHaveText("Legacy footer");
  const connected = await page.evaluate(() => ({
    header: document.querySelector("#legacy-header-control")?.isConnected,
    footer: document.querySelector("#legacy-footer-control")?.isConnected,
  }));
  expect(connected).toEqual({ header: true, footer: true });
  expect(failures).toEqual([]);
});

test("country interactions survive delayed shared-footer rendering", async ({ page }) => {
  const failures = collectRuntimeFailures(page);
  await page.route("**/global-footer.js*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.goto("/country.html?code=CZE&lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("body > footer[data-global-footer].glorious-footer")).toHaveCount(1);
  await page.locator("#country-switch").selectOption("DEU");
  await expect(page.locator("#country-name")).toHaveText("Germany");
  await expect(page).toHaveURL(/\/countries\/germany\?lang=en$/);
  expect(failures).toEqual([]);
});
