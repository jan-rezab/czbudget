import { expect, test } from "@playwright/test";

test("EU migration deep dive renders all countries and linked views", async ({ page }) => {
  const response = await page.goto("/deep-dives/migration/?lang=en", { waitUntil: "networkidle" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("h1")).toContainText("Europe");
  await expect(page.locator("#migration-map path[data-country]")).toHaveCount(33);
  await expect(page.locator("#migration-country option")).toHaveCount(34);
  await expect(page.locator("#migration-table-body tr")).toHaveCount(33);
  await expect(page.locator("#hero-immigration")).not.toHaveText("—");
  await expect(page.locator("#protection-year")).toHaveText("2025");
  await expect(page.locator("#protection-total")).not.toHaveText("—");
  await expect(page.locator("#protection-types article")).toHaveCount(3);
  await expect(page.locator("#migration-protection-chart rect.refugee").first()).toBeVisible();

  await page.locator("#migration-country").selectOption("CZE");
  await expect(page.locator("#migration-map-readout h3")).toHaveText("Czechia");
  await expect(page.locator("#migration-line-detail")).toContainText("Immigration");
  await expect(page.locator("#protection-country-name")).toHaveText("Czechia");

  await page.locator("#migration-country").selectOption("CHE");
  await expect(page.locator("#migration-map-readout h3")).toHaveText("Switzerland");
  await expect(page.locator("#protection-country-name")).toHaveText("Switzerland");

  await page.locator("#migration-year").evaluate((input) => { input.value = "2022"; input.dispatchEvent(new Event("input", { bubbles:true })); });
  await expect(page.locator("#migration-year-output")).toHaveText("2022");
  await expect(page).toHaveURL(/year=2022/);
});
