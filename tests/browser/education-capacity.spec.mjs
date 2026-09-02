import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const dataset = JSON.parse(await readFile("data/education-capacity-international.v1.json", "utf8"));

test("education capacity loads every core country from the comparable source layer", async ({ page }) => {
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });

  await page.goto("/deep-dives/education/?lang=en#capacity", { waitUntil: "networkidle" });

  await expect(page.locator("#capacity-body tr")).toHaveCount(7);
  await expect(page.locator("[data-capacity-country]")).toHaveCount(dataset.country_count);
  await expect(page.locator("#capacity-country-body tr")).toHaveCount(dataset.level_count);
  await expect(page.locator("#capacity-country-title")).toHaveText("CZE · Czechia · 2024");
  await expect(page.locator("#capacity-country-summary")).toContainText("5/5");

  await page.getByRole("button", { name: /Switzerland/ }).click();
  await expect(page.locator("#capacity-country-title")).toHaveText("CHE · Switzerland · 2024");
  await expect(page.locator("#capacity-country-body")).toContainText("556,945");
  await expect(page.locator("#capacity-country-body")).toContainText("35,999");
  await expect(page.locator("#capacity-country-body")).toContainText("national adapter pending");
  await expect(page.locator("#capacity-country-body")).toContainText("not reported");

  await page.getByRole("button", { name: /Sweden/ }).click();
  await expect(page.locator("#capacity-country-title")).toHaveText("SWE · Sweden · 2024");
  await expect(page.locator("#capacity-country-body")).toContainText("859,847");
  expect(await page.evaluate(() => document.body.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test("international education-capacity source preserves coverage and missingness", async () => {
  expect(dataset.country_count).toBe(6);
  expect(dataset.level_count).toBe(5);
  expect(dataset.countries.every((country) => country.coverage.learners_headcount === 5)).toBe(true);
  expect(dataset.countries.every((country) => country.coverage.teaching_fte === 5)).toBe(true);
  expect(dataset.countries.every((country) => country.coverage.schools_or_institutions === 0)).toBe(true);
  expect(dataset.countries.find((country) => country.code === "CHE").coverage.learners_per_teaching_fte).toBe(0);
});
