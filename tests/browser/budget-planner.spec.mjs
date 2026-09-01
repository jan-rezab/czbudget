import { expect, test } from "@playwright/test";

test("the 2027 planner reconciles scenario choices and restores the proposal", async ({ page }) => {
  const response = await page.goto("/deep-dives/budget-planner/?lang=en", { waitUntil:"networkidle" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("h1")).toContainText("A budget is not a table");
  await expect(page.locator(".budget-treemap-tile")).toHaveCount(26);
  await expect(page.locator("#scenario-deficit")).toHaveText("CZK 389.0bn");

  await page.locator('[data-budget-item="22"]').click();
  await expect(page.locator("#editor-title")).toHaveText("Transport");
  await page.locator("#budget-adjustment-number").fill("20");
  await page.locator("#budget-adjustment-number").blur();
  await expect(page.locator("#scenario-deficit")).toHaveText("CZK 409.0bn");
  await expect(page.locator("#change-count")).toHaveText("1");
  await expect(page).toHaveURL(/plan=22%3A20/);

  await page.locator("#revenue-adjustment-number").fill("30");
  await page.locator("#revenue-adjustment-number").blur();
  await expect(page.locator("#scenario-deficit")).toHaveText("CZK 379.0bn");
  await expect(page.locator("#change-count")).toHaveText("2");

  await page.locator("#reset-scenario").click();
  await expect(page.locator("#scenario-deficit")).toHaveText("CZK 389.0bn");
  await expect(page.locator("#change-count")).toHaveText("0");
  await expect(page).not.toHaveURL(/(?:plan|rev)=/);
});

test("the planner does not overflow a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.goto("/deep-dives/budget-planner/?lang=en", { waitUntil:"networkidle" });
  const widths = await page.evaluate(() => ({ viewport:document.documentElement.clientWidth, document:document.documentElement.scrollWidth }));
  expect(widths.document).toBe(widths.viewport);
  await expect(page.locator("#budget-adjustment-number")).toBeVisible();
  await expect(page.locator("#budget-waterfall svg")).toBeVisible();
});
