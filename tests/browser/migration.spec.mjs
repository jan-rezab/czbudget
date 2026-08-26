import { expect, test } from "@playwright/test";

test("EU migration deep dive renders all countries and linked views", async ({ page }) => {
  const response = await page.goto("/deep-dives/migration/?lang=en", { waitUntil: "networkidle" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("h1")).toContainText("Europe");
  await expect(page.locator("#migration-map path[data-country]")).toHaveCount(27);
  await expect(page.locator("#migration-country option")).toHaveCount(28);
  await expect(page.locator("#migration-table-body tr")).toHaveCount(27);
  await expect(page.locator("#hero-immigration")).not.toHaveText("—");

  await page.locator("#migration-country").selectOption("CZE");
  await expect(page.locator("#migration-map-readout h3")).toHaveText("Czechia");
  await expect(page.locator("#migration-line-detail")).toContainText("Immigration");

  await page.locator("#migration-year").evaluate((input) => { input.value = "2022"; input.dispatchEvent(new Event("input", { bubbles:true })); });
  await expect(page.locator("#migration-year-output")).toHaveText("2022");
  await expect(page).toHaveURL(/year=2022/);
});
