import { test, expect } from "@playwright/test";

test("Czech budget exposes the global top-five continent cohorts and requested section order", async ({ page }) => {
  await page.goto("/cesky-rozpocet.html?lang=en#benchmark", { waitUntil: "networkidle" });

  const continentCodes = {
    europe: ["DEU", "GBR", "FRA", "ITA", "RUS"],
    asia: ["CHN", "JPN", "IND", "KOR", "IDN"],
    africa: ["ZAF", "EGY", "DZA", "NGA", "ETH"],
    northAmerica: ["USA", "CAN", "MEX", "DOM", "GTM"],
    southAmerica: ["BRA", "ARG", "COL", "CHL", "PER"],
    oceania: ["AUS", "NZL", "PNG", "FJI", "SLB"],
  };
  const expectedCodes = ["CZE", ...Object.values(continentCodes).flat()];

  await expect(page.locator("#rank-list .rank-row")).toHaveCount(expectedCodes.length);
  await expect(page.locator("#scatter-wrap .scatter-city")).toHaveCount(expectedCodes.length);
  await expect(page.locator("#country-select option")).toHaveCount(expectedCodes.length);

  const optionCodes = await page.locator("#country-select option").evaluateAll(options => options.map(option => option.value));
  expect(new Set(optionCodes)).toEqual(new Set(expectedCodes));

  for (const [continent, codes] of Object.entries(continentCodes)) {
    await page.locator("#benchmark-region").selectOption(continent);
    await expect(page.locator("#rank-list .rank-row")).toHaveCount(codes.length + 1);
    const filteredCodes = await page.locator("#country-select option").evaluateAll(options => options.map(option => option.value));
    expect(new Set(filteredCodes)).toEqual(new Set(["CZE", ...codes]));
  }

  const sectionOrder = await page.locator(".budget-workspace-content > section[id]").evaluateAll(sections => sections.map(section => section.id));
  expect(sectionOrder).toEqual([
    "cesko",
    "rozpocet-v-case",
    "utraceni",
    "benchmark",
    "demografie",
    "zdravotni-system",
    "nemocnice-benchmark",
    "statni-firmy",
    "metodika",
  ]);

  await expect(page.locator("#benchmark h2")).toHaveText("Comparison of benchmark countries");
});
