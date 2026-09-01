import { test, expect } from "@playwright/test";

test("Czech budget uses only the fiscal benchmark cohort and requested section order", async ({ page }) => {
  await page.goto("/cesky-rozpocet.html?lang=en#benchmark", { waitUntil: "networkidle" });

  const expectedCodes = await page.evaluate(async () => {
    const data = await fetch("/data/sovereign-benchmark-slim.v1.json").then(response => response.json());
    return data.countries
      .filter(country => country.role === "anchor" || country.role === "responsible_benchmark")
      .map(country => country.country_code);
  });

  await expect(page.locator("#rank-list .rank-row")).toHaveCount(expectedCodes.length);
  await expect(page.locator("#scatter-wrap .scatter-city")).toHaveCount(expectedCodes.length);
  await expect(page.locator("#country-select option")).toHaveCount(expectedCodes.length);

  const optionCodes = await page.locator("#country-select option").evaluateAll(options => options.map(option => option.value));
  expect(optionCodes).toEqual(expectedCodes);

  const sectionOrder = await page.locator(".budget-workspace-content > section[id]").evaluateAll(sections => sections.map(section => section.id));
  expect(sectionOrder).toEqual([
    "cesko",
    "struktura",
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
