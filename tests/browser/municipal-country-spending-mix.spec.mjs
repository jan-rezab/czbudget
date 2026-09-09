import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const payload = JSON.parse(await readFile(new URL("../../data/municipal-spending-splits.v1.json", import.meta.url), "utf8"));
const split = (code) => payload.countries.find((country) => country.code === code);
const percent = (value, total, locale) => `${(value / total * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

test("France publishes its country-native operating and investment expenditure split", async ({ page }) => {
  const france = split("FRA");
  await page.goto("/municipalities/france/?lang=cs", { waitUntil: "networkidle" });

  const section = page.locator("#spending-mix");
  await expect(section).toBeVisible();
  await expect(page.locator("#spending-mix-nav")).toBeVisible();
  await expect(section).toContainText("Francie: provozní versus investiční výdaje");
  await expect(section.locator(".municipal-spending-summary .current")).toContainText(percent(france.operating_expenditure, france.classified_expenditure, "cs-CZ"));
  await expect(section.locator(".municipal-spending-summary .capital")).toContainText(percent(france.investment_expenditure, france.classified_expenditure, "cs-CZ"));
  await expect(section).toContainText("splátky jistiny dluhu");
  await expect(section.locator(".municipal-spending-bar")).toHaveAttribute("role", "img");

  await page.goto("/municipalities/france/?lang=en#spending-mix", { waitUntil: "networkidle" });
  await expect(section).toContainText("France: operating versus investment expenditure");
  await expect(section).toContainText("not identical to corporate CAPEX");
});

test("Finland publishes the available financial-statement split and unsupported countries stay hidden", async ({ page }) => {
  const finland = split("FIN");
  await page.goto("/municipalities/finland/?lang=en", { waitUntil: "networkidle" });

  const section = page.locator("#spending-mix");
  await expect(section).toBeVisible();
  await expect(section.locator(".municipal-spending-summary .current")).toContainText(percent(finland.operating_expenditure, finland.classified_expenditure, "en-GB"));
  await expect(section.locator(".municipal-spending-summary .capital")).toContainText(percent(finland.investment_expenditure, finland.classified_expenditure, "en-GB"));
  await expect(section).toContainText("neither mandatory versus discretionary spending");

  await page.goto("/municipalities/germany/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#spending-mix")).toBeHidden();
  await expect(page.locator("#spending-mix-nav")).toBeHidden();
});
