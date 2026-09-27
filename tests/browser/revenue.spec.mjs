import { test, expect } from "@playwright/test";

test("revenue comparison makes cross-country differences visible", async ({ page, request }) => {
  const response = await request.get('/api/v1/revenue/current');
  expect(response.ok()).toBe(true);
  const data = await response.json();
  const codes = Object.keys(data.countries).filter(code => data.availability.countries[code]?.eligible === true);
  const categories = ['personal_income','corporate_income','vat','excise','social_security','property'];
  const reportedCells = codes.reduce((count,code) => count + categories.filter(key => Number.isFinite(data.countries[code].tax_detail[key])).length, 0);
  await page.goto("/deep-dives/revenue/?code=CZE&lang=en", { waitUntil: "domcontentloaded" });

  const cells = page.locator("#revenue-comparison-body .revenue-heat");
  const formattedCells = page.locator("#revenue-comparison-body .revenue-heat[data-heat]");
  await expect(page.locator("#revenue-heat-legend")).toContainText("Lower share → Higher share");
  // Assert the rendered data contract, not unrelated background-network silence.
  await expect(page.locator('#revenue-comparison-body tr')).toHaveCount(codes.length);
  await expect(cells).toHaveCount(codes.length * categories.length, {timeout:20_000});
  await expect(formattedCells).toHaveCount(reportedCells);
  await expect(page.locator('.revenue-heat[data-heat="low"]')).not.toHaveCount(0);
  await expect(page.locator('.revenue-heat[data-heat="mid"]')).not.toHaveCount(0);
  await expect(page.locator('.revenue-heat[data-heat="high"]')).not.toHaveCount(0);
  await expect(page.locator("#revenue-comparison-body tr.selected")).toContainText("Czechia");
  await expect(page.locator("#revenue-comparison-body tr.selected .revenue-heat")).toHaveCount(6);

  const fillWidths = await formattedCells.evaluateAll(nodes => new Set(nodes.map(node => node.style.getPropertyValue("--heat"))).size);
  expect(fillWidths).toBeGreaterThan(12);
});
