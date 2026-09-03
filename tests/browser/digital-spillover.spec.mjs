import { expect, test } from "@playwright/test";

test("digital value deep dive keeps sourced data separate from scenario controls", async ({ page }) => {
  const response = await page.goto("/deep-dives/digital-spillover/?lang=en", { waitUntil:"networkidle" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("h1")).toContainText("Who keeps");
  await expect(page.locator("#digital-country-bars .digital-country-row")).toHaveCount(10);
  await expect(page.locator("#digital-table-body tr")).toHaveCount(10);
  await expect(page.locator("#digital-capacity-chart svg")).toBeVisible();
  await expect(page.locator("#digital-sensitivity-chart svg")).toBeVisible();

  const before = await page.locator('#digital-table-body tr[data-country="CZE"] .leak-cell').innerText();
  await page.locator("#foreign-share").evaluate((input) => {
    input.value = "85";
    input.dispatchEvent(new Event("input", { bubbles:true }));
  });
  await expect(page.locator("#foreign-share-output")).toHaveText("85%");
  await expect(page).toHaveURL(/foreign=85/);
  await expect(page.locator('#digital-table-body tr[data-country="CZE"] .leak-cell')).not.toHaveText(before);

  await page.locator("#digital-country-select").selectOption("CHN");
  await expect(page.locator("#digital-selected-summary")).toContainText("China");
  await expect(page).toHaveURL(/country=CHN/);
});

test("digital value deep dive contains mobile overflow inside its data views", async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.goto("/deep-dives/digital-spillover/?lang=cs", { waitUntil:"networkidle" });
  const widths = await page.evaluate(() => ({ viewport:document.documentElement.clientWidth, document:document.documentElement.scrollWidth }));
  expect(widths.document).toBe(widths.viewport);
  await expect(page.locator("#digital-country-bars .digital-country-row")).toHaveCount(10);
  await expect(page.locator("#digital-table-body tr")).toHaveCount(10);
});
