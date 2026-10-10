import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readDataJSON } from "../../scripts/lib/static-asset-source.mjs";

// Checkout first; the snapshot is served from the static-asset packs.
const snapshot = await readDataJSON("data/municipal-snapshot.v1.json", { root: fileURLToPath(new URL("../..", import.meta.url)) });
const totals = snapshot.municipalities.reduce((sum, municipality) => {
  sum.current += Number(municipality.amounts?.current_expense) || 0;
  sum.capital += Number(municipality.amounts?.capital_expense) || 0;
  return sum;
}, { current: 0, capital: 0 });
const total = totals.current + totals.capital;
const share = (value, locale) => `${(value / total * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const largest = [...snapshot.municipalities]
  .filter((municipality) => Number.isFinite(municipality.amounts?.expense_actual) && Number.isFinite(municipality.amounts?.budget_balance))
  .sort((a, b) => b.amounts.expense_actual - a.amounts.expense_actual)
  .slice(0, 13);
const budgetAmount = (value, locale) => new Intl.NumberFormat(locale, {
  style: "currency", currency: "CZK", notation: "compact", maximumFractionDigits: 1,
}).format(value);

test("Czech municipality overview publishes the official current and capital expenditure split", async ({ page }) => {
  await page.goto("/municipalities/czechia/?lang=cs", { waitUntil: "networkidle" });

  const section = page.locator("#spending-mix");
  await expect(section).toContainText("Běžné versus kapitálové výdaje");
  await expect(section.locator(".municipal-spending-summary .current")).toContainText(share(totals.current, "cs-CZ"));
  await expect(section.locator(".municipal-spending-summary .capital")).toContainText(share(totals.capital, "cs-CZ"));
  await expect(section).toContainText("Není to rozdělení na mandatorní a volitelné výdaje");
  await expect(section.locator(".municipal-spending-bar")).toHaveAttribute("role", "img");

  const ranked = page.locator("#municipal-ranking-grid .municipal-ranking-card.scale li");
  await expect(ranked).toHaveCount(13);
  for (let index = 0; index < largest.length; index++) {
    await expect(ranked.nth(index).locator(".municipal-rank-name strong")).toHaveText(largest[index].short_name);
  }
  await expect(ranked.first()).toContainText(budgetAmount(largest[0].amounts.current_expense, "cs-CZ"));
  await expect(ranked.first()).toContainText(budgetAmount(largest[0].amounts.capital_expense, "cs-CZ"));
  await expect(ranked.first().locator(".municipal-budget-bar b")).toHaveCount(2);

  await page.evaluate(() => {
    localStorage.setItem("psd-lang", "en");
    location.href = "/municipalities/czechia/?lang=en#spending-mix";
  });
  await page.waitForLoadState("networkidle");
  await expect(section).toContainText("Current versus capital expenditure");
  await expect(section.locator(".municipal-spending-summary .current")).toContainText(share(totals.current, "en-GB"));
  await expect(section.locator(".municipal-spending-summary .capital")).toContainText(share(totals.capital, "en-GB"));
  await expect(section).toContainText("not a mandatory-versus-discretionary split");
  await expect(ranked).toHaveCount(13);
  await expect(ranked.first()).toContainText(`Opex ${budgetAmount(largest[0].amounts.current_expense, "en-GB")}`);
  await expect(ranked.first()).toContainText(`Capex ${budgetAmount(largest[0].amounts.capital_expense, "en-GB")}`);
});
