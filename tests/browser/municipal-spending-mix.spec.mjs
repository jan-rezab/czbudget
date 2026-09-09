import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const snapshot = JSON.parse(await readFile(new URL("../../data/municipal-snapshot.v1.json", import.meta.url), "utf8"));
const totals = snapshot.municipalities.reduce((sum, municipality) => {
  sum.current += Number(municipality.amounts?.current_expense) || 0;
  sum.capital += Number(municipality.amounts?.capital_expense) || 0;
  return sum;
}, { current: 0, capital: 0 });
const total = totals.current + totals.capital;
const share = (value, locale) => `${(value / total * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

test("Czech municipality overview publishes the official current and capital expenditure split", async ({ page }) => {
  await page.goto("/municipalities/czechia/?lang=cs", { waitUntil: "networkidle" });

  const section = page.locator("#spending-mix");
  await expect(section).toContainText("Běžné versus kapitálové výdaje");
  await expect(section.locator(".municipal-spending-summary .current")).toContainText(share(totals.current, "cs-CZ"));
  await expect(section.locator(".municipal-spending-summary .capital")).toContainText(share(totals.capital, "cs-CZ"));
  await expect(section).toContainText("Není to rozdělení na mandatorní a volitelné výdaje");
  await expect(section.locator(".municipal-spending-bar")).toHaveAttribute("role", "img");

  await page.evaluate(() => {
    localStorage.setItem("psd-lang", "en");
    location.href = "/municipalities/czechia/?lang=en#spending-mix";
  });
  await page.waitForLoadState("networkidle");
  await expect(section).toContainText("Current versus capital expenditure");
  await expect(section.locator(".municipal-spending-summary .current")).toContainText(share(totals.current, "en-GB"));
  await expect(section.locator(".municipal-spending-summary .capital")).toContainText(share(totals.capital, "en-GB"));
  await expect(section).toContainText("not a mandatory-versus-discretionary split");
});
