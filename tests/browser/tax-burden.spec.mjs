import { expect, test } from "@playwright/test";

test("tax-wedge matrix conditionally formats each household column", async ({ page }) => {
  const response = await page.goto("/deep-dives/tax-burden/?code=GRC&lang=en", { waitUntil:"networkidle" });
  expect(response?.ok()).toBeTruthy();

  const matrix = page.locator('[data-oecd-chart="tax_matrix"]');
  await expect(matrix.locator(".oecd-heat-table")).toBeVisible();
  await expect(matrix.locator(".oecd-heat-legend")).toContainText("Lower tax wedge");
  await expect(matrix.locator("tbody tr.is-selected td:first-child")).toHaveText("Greece");

  const presentation = await matrix.locator(".oecd-heat-cell").evaluateAll((cells) => ({
    count: cells.length,
    colours: new Set(cells.map((cell) => getComputedStyle(cell).backgroundColor)).size,
  }));
  expect(presentation.count).toBeGreaterThan(40);
  expect(presentation.colours).toBeGreaterThan(5);

  const selectedOutline = await matrix.locator("tbody tr.is-selected td:first-child").evaluate((cell) => getComputedStyle(cell).boxShadow);
  expect(selectedOutline).not.toBe("none");
});
