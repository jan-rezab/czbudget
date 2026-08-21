import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  ["homepage", "/?lang=cs"],
  ["country", "/country.html?code=CZE&lang=cs"],
  ["capitals", "/eu-capitals.html?lang=cs"],
  ["state budget", "/cesky-rozpocet.html?lang=cs"],
  ["municipality", "/cz/obce/praha/?lang=cs"],
  ["directory", "/cz/obce/?lang=cs"],
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

test("municipal directory explains the aggregate balance in both languages", async ({ page }) => {
  await page.goto("/cz/obce/?lang=cs", { waitUntil: "networkidle" });
  const story = page.locator(".municipal-aggregate-story");
  await expect(story).toContainText("43,4 mld. Kč vytvořily přebytkové obce.");
  await expect(story.locator(".aggregate-cohort")).toHaveCount(3);
  await expect(story).toContainText("+14,9 mld. Kč");
  await expect(story.locator(".piggy-panel li")).toHaveCount(5);
  await expect(story).toContainText("16,9 mld. Kč");

  await page.goto("/cz/obce/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator(".municipal-aggregate-story")).toContainText("Surplus municipalities generated CZK 43.4bn.");
  await expect(page.locator(".piggy-panel")).toContainText("Five “bad piggies” took away CZK 2.0bn.");
});

test("all representative page menus resolve and primary navigation routes correctly", async ({ page, request }) => {
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
  await page.locator('[data-global-nav="capitals"]').click();
  await expect(page).toHaveURL(/\/eu-capitals\.html\?lang=cs/);
  await page.goto("/?lang=cs", { waitUntil: "networkidle" });
  await page.locator(".country-menu summary").click();
  await expect(page.locator(".country-menu-panel a")).toHaveCount(12);
  await page.locator('.country-menu-panel a[href*="code=CZE"]').click();
  await expect(page).toHaveURL(/\/country\.html\?code=CZE&lang=cs/);
});
