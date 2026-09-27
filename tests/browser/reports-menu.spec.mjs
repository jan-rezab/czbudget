import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const catalogue = JSON.parse(readFileSync(new URL("../../deep-dives/reports.json", import.meta.url), "utf8"));

test("reports navigation opens the reports view in one click", async ({ page }) => {
  await page.goto("/about.html?lang=en", { waitUntil: "networkidle" });
  const reports = page.locator('psd-site-header [data-global-nav="deep-dives"]');
  await expect(reports).toHaveText("Reports");
  await expect(page.locator("psd-site-header .deep-dive-menu")).toHaveCount(0);
  await reports.click();
  await expect(page).toHaveURL(/\/deep-dives\/\?lang=en$/);
  await expect(page.locator(".deep-card").first()).toBeVisible();
  await expect(page.locator('psd-site-header [data-global-nav="deep-dives"]')).toHaveClass(/active/);
});

test("report search filters the catalogue and restores every topic when cleared", async ({ page }) => {
  await page.goto("/deep-dives/?lang=en", { waitUntil: "networkidle" });
  const search = page.getByRole("searchbox", { name: "Find a report" });
  await expect(search).toBeVisible();
  await expect(page.locator(".deep-card:visible")).toHaveCount(catalogue.reports.length);
  await search.fill("hospital");
  await expect(page.locator(".deep-card:visible")).toHaveCount(1);
  await expect(page.locator("#health")).toBeVisible();
  await expect(page.locator("#regional")).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("Reports found: 1");
  await search.fill("no-matching-report");
  await expect(page.locator(".reports-empty")).toBeVisible();
  await expect(page.locator(".deep-card:visible")).toHaveCount(0);
  await search.fill("");
  await expect(page.locator(".deep-card:visible")).toHaveCount(catalogue.reports.length);
  await expect(page.locator(".reports-empty")).toBeHidden();
  await expect(page.locator(".reports-topics")).toBeVisible();
  await page.locator('.reports-topics a[href="#topic-cz"]').click();
  await expect(page).toHaveURL(/#topic-cz$/);
  await expect(page.locator("#topic-cz")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Czech catalogue supports accent-insensitive search and keeps report language", async ({ page }) => {
  await page.goto("/deep-dives/?lang=cs", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toHaveText("Rozpočty podle témat");
  await page.getByRole("searchbox", { name: "Najít report" }).fill("skolstvi");
  await expect(page.locator(".deep-card:visible")).toHaveCount(1);
  await expect(page.locator("#education")).toHaveAttribute("href", /lang=cs/);
  await expect(page.locator(".reports-feature")).toHaveAttribute("href", /lang=cs/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
