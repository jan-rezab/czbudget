import { test, expect } from "@playwright/test";

test("capital-city deep dive identifies fiscal figures as plans", async ({ page }) => {
  await page.goto("/deep-dives/capital-cities/?city=prague-cz&lang=en", { waitUntil: "networkidle" });
  await expect(page.locator(".capital-stage-guide")).toContainText("Plan and actual are separate data layers");
  await expect(page.locator(".capital-stage-guide .plan")).toContainText(/budget plan/i);
  await expect(page.locator(".capital-stage-guide .actual")).toContainText("Actual outcomes");
  await expect(page.locator("#capital-city-readout")).toContainText("Adopted plan");
  await expect(page.locator("#capital-city-readout")).toContainText("Planned expenditure per resident");
  await expect(page.locator("#capital-city-readout")).toContainText("Planned gap before financing / revenue");
  await expect(page.locator("#capital-city-readout")).toContainText("2024");
});

test("capital-city atlas keeps plan and actual sections visually separate", async ({ page }) => {
  await page.goto("/eu-capitals.html?city=prague-cz&lang=en", { waitUntil: "networkidle" });
  await expect(page.locator('[data-i18n="thBudget"]')).toHaveText("Plan expenditure");
  await expect(page.locator('[data-i18n="thBalance"]')).toHaveText("Plan balance");
  await expect(page.locator("#city-detail .stage-plan").first()).toContainText(/budget plan/i);
  await expect(page.locator("#city-detail .fiscal-kpis")).toContainText("Planned gap before financing");
  await expect(page.locator("#city-detail .stage-actual")).toContainText(/actual/i);
  await expect(page.locator("#city-detail .stage-context")).toContainText(/observed context/i);
});
