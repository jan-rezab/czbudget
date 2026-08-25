import { test, expect } from "@playwright/test";

const languages = [
  { code: "cs", balance: "Saldo / % HDP", revenue: "Příjmy / % HDP", expenditure: "Výdaje / % HDP" },
  { code: "en", balance: "Balance / % GDP", revenue: "Revenue / % GDP", expenditure: "Expenditure / % GDP" },
];

for (const language of languages) {
  test(`country details finish their first ${language.code.toUpperCase()} render after the shared footer loads`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.route("**/lib/data/sovereign-benchmark.v1.json", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    });
    await page.goto(`/country.html?code=CZE&lang=${language.code}`, { waitUntil: "networkidle" });

    expect(errors).toEqual([]);
    await expect(page.locator("body")).not.toHaveClass(/data-error/);
    await expect(page.locator("html")).toHaveAttribute("lang", language.code);
    await expect(page.locator(`[data-lang="${language.code}"]`)).toHaveClass(/active/);
    await expect(page.locator("#scope-perimeter-grid .scope-perimeter-card")).toHaveCount(3);
    await expect(page.locator("#balance-chart svg")).toHaveCount(1);
    await expect(page.locator("#balance-chart-title")).toHaveText(language.balance);
    await expect(page.locator("#revenue-chart-title")).toHaveText(language.revenue);
    await expect(page.locator("#expenditure-chart-title")).toHaveText(language.expenditure);
  });
}
