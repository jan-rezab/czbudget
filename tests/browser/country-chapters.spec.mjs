import { test, expect } from "@playwright/test";

const chapterHrefs = [
  "#scope", "#trend", "#spending", "#public-entities",
  "#healthcare", "#social-system", "#transportation", "#data-parity",
];

test("country chapters stay separate from national budget links", async ({ page }) => {
  test.setTimeout(75_000);
  for (const lang of ["cs", "en"]) {
    for (const [code, budgetSlug] of [["CZE", null], ["DEU", "germany"], ["UKR", null]]) {
      await page.goto(`/country.html?code=${code}&lang=${lang}`, { waitUntil: "domcontentloaded" });
      const chapters = page.locator("#country-dashboard-index > div > a");
      await expect(chapters).toHaveCount(chapterHrefs.length);
      expect(await chapters.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual(chapterHrefs);
      const budgetLink = page.locator("#country-dashboard-index > header .country-national-budget-link");
      if (budgetSlug) await expect(budgetLink).toHaveAttribute("href", `/national-budgets/${budgetSlug}?lang=${lang}`);
      else await expect(budgetLink).toHaveCount(0);
    }
  }
});
