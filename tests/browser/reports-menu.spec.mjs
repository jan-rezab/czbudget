import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const catalogue = JSON.parse(readFileSync(new URL("../../deep-dives/reports.json", import.meta.url), "utf8"));

for (const lang of ["en", "cs"]) test(`${lang} report cards show their own lightweight chart previews`, async ({ page }) => {
  await page.goto(`/deep-dives/?lang=${lang}`, { waitUntil: "networkidle" });
  for (const report of catalogue.reports) {
    const card = page.locator(`#${report.slug}`);
    if (report.preview.unavailable) {
      await expect(card.locator('.preview-unavailable')).toHaveText(catalogue.chrome.previewUnavailable[lang]);
      continue;
    }
    const image = card.locator('img[data-report-preview]');
    await expect(image).toHaveAttribute('src', new RegExp(report.preview[lang].replaceAll('.', '\\.')));
    await expect(image).toHaveAttribute('loading', 'lazy');
    await expect(image).toHaveAttribute('alt', `${report.title[lang]} — ${catalogue.chrome.headlinePreview[lang]}`);
  }
  const education = page.locator('#education img');
  await education.scrollIntoViewIfNeeded();
  await expect.poll(() => education.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.locator('#education').click();
  await expect(page).toHaveURL(new RegExp(`/deep-dives/education/\\?lang=${lang}$`));
});


test("Reports opens generated topic submenus and links to the complete catalogue", async ({ page }) => {
  await page.goto("/about.html?lang=en", { waitUntil: "networkidle" });
  const reports = page.locator('psd-site-header [data-global-nav="deep-dives"]');
  await expect(reports.locator(":scope > summary")).toContainText("Reports");
  await reports.locator(":scope > summary").click();
  await expect(reports).toHaveAttribute("open", "");
  await expect(page).toHaveURL(/about\.html\?lang=en$/);
  await expect(reports.locator(".report-menu-group")).toHaveCount(catalogue.shelves.flatMap(s => s.clusters).length);
  await expect(reports.locator("a[data-report-slug]")).toHaveCount(catalogue.reports.length);
  for (const report of catalogue.reports) {
    const link = reports.locator(`[data-report-slug="${report.slug}"]`);
    await expect(link).toHaveText(report.title.en);
    const expected = new URL(report.navPath, "https://publicspendingdata.org/");
    expected.searchParams.set("lang", "en");
    expect(new URL(await link.getAttribute("href"), page.url()).pathname + new URL(await link.getAttribute("href"), page.url()).search).toBe(expected.pathname + expected.search);
  }
  await reports.locator(".reports-menu-all").click();
  await expect(page).toHaveURL(/\/deep-dives\/\?lang=en$/);
  await expect(page.locator(".deep-card").first()).toBeVisible();
  await expect(page.locator('psd-site-header [data-global-nav="deep-dives"]')).toHaveClass(/active/);
});

test("Reports topics work on mobile, preserve Czech and close with Escape or another menu", async ({ page }) => {
  await page.setViewportSize({width: 390, height: 720});
  await page.goto("/deep-dives/?lang=cs", { waitUntil: "networkidle" });
  const reports = page.locator(".reports-menu");
  const summary = reports.locator(":scope > summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(reports).toHaveAttribute("open", "");
  await expect(reports.locator(".report-menu-group[open]")).toHaveCount(0);
  const group = reports.locator('[data-report-topic="spend"]');
  await group.locator("summary").click();
  await expect(group.locator('[data-report-slug="education"]')).toBeVisible();
  await expect(group.locator('[data-report-slug="education"]')).toHaveAttribute("href", /lang=cs/);
  const box = await reports.locator(".reports-menu-panel").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(720);
  await group.locator("summary").press("Escape");
  await expect(reports).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
  await summary.click();
  await page.locator('.municipality-menu > summary').click();
  await expect(reports).not.toHaveAttribute("open", "");
  await summary.click();
  await group.locator('[data-report-slug="education"]').click();
  await expect(page).toHaveURL(/deep-dives\/education\/\?.*lang=cs/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
