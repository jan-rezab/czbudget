import { test, expect } from "@playwright/test";

test("revenue comparison makes cross-country differences visible", async ({ page }) => {
  await page.goto("/deep-dives/revenue/?code=CZE&lang=en", { waitUntil: "networkidle" });

  const cells = page.locator("#revenue-comparison-body .revenue-heat[data-heat]");
  await expect(page.locator("#revenue-heat-legend")).toContainText("Lower share → Higher share");
  await expect(cells).toHaveCount(102);
  await expect(page.locator('.revenue-heat[data-heat="low"]')).not.toHaveCount(0);
  await expect(page.locator('.revenue-heat[data-heat="mid"]')).not.toHaveCount(0);
  await expect(page.locator('.revenue-heat[data-heat="high"]')).not.toHaveCount(0);
  await expect(page.locator("#revenue-comparison-body tr.selected")).toContainText("Czechia");
  await expect(page.locator("#revenue-comparison-body tr.selected .revenue-heat")).toHaveCount(6);

  const fillWidths = await cells.evaluateAll(nodes => new Set(nodes.map(node => node.style.getPropertyValue("--heat"))).size);
  expect(fillWidths).toBeGreaterThan(12);
});
