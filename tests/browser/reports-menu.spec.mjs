import { test, expect } from "@playwright/test";

test("reports navigation remains scrollable within short viewports", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/about.html?lang=en", { waitUntil: "networkidle" });
  await page.locator(".deep-dive-menu summary").click();

  const panel = page.locator(".deep-dive-menu-panel");
  await expect(panel).toBeVisible();
  const initial = await panel.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(initial.overflowY).toBe("auto");
  expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight);

  await panel.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(panel.locator(":scope > a").last()).toBeInViewport();
  await expect(panel.locator(":scope > .country-menu-head")).toBeInViewport();
});
