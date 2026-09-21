import { test, expect } from "@playwright/test";

const routes = [
  ["poland", "Poland"], ["germany", "Germany"],
  ["united-kingdom", "United Kingdom"], ["france", "France"],
  ["united-states", "United States"], ["switzerland", "Switzerland"],
  ["sweden", "Sweden"], ["denmark", "Denmark"],
  ["finland", "Finland"], ["spain", "Spain"],
  ["netherlands", "Netherlands"], ["greece", "Greece"],
];

test("the twelve ready country dashboards render core sections", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [slug, name] of routes) {
    const response = await page.goto(`/national-budgets/${slug}?lang=en`, {waitUntil:"domcontentloaded"});
    expect(response?.ok(), slug).toBeTruthy();
    await expect(page.locator("#country-name")).toHaveText(name);
    await expect(page.locator("#budget-kpis article")).toHaveCount(4);
    await expect(page.locator("#health-kpis article")).toHaveCount(4);
    await expect(page.locator(".nb-plot svg")).toHaveCount(4);
    await expect(page.locator("#country-switch option")).toHaveCount(12);
    await expect(page.locator("#methodology-sources a")).not.toHaveCount(0);
    expect(errors, slug).toEqual([]);
  }
});
