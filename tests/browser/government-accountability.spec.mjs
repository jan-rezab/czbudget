import { test, expect } from "@playwright/test";


async function openAccountability(page, language = "cs") {
  await page.goto(`/cz/kraje/accountability/?lang=${language}`);
  await expect(page.locator("#coverage-integrity")).toHaveText(language === "en" ? "PASSED" : "PROŠLO");
}


test("regional accountability renders complete Czech coverage", async ({ page }) => {
  await openAccountability(page);
  await expect(page.locator("#coverage-entities")).toHaveText("14 / 14");
  await expect(page.locator("#coverage-functions")).toHaveText("10");
  await expect(page.locator("#coverage-assignments")).toHaveText("93");
  await expect(page.locator("#region-select option")).toHaveCount(14);
  await expect(page.locator("#funding-bars .funding-bar")).toHaveCount(4);
  await expect(page.locator("#mechanism-grid .mechanism-card")).toHaveCount(6);
  await expect(page.locator("#archetype-grid .archetype-card")).toHaveCount(8);
  await expect(page.locator("#coverage-checks .coverage-check")).toHaveCount(8);
});


test("service selection changes the atomic responsibility chain", async ({ page }) => {
  await openAccountability(page);
  await expect(page.locator("#function-select option")).toHaveCount(10);
  await expect(page.locator("#role-grid")).toContainText("Veřejné zdravotní pojišťovny");
  await page.locator("#function-select").selectOption("secondary_and_vocational_education");
  await expect(page.locator("#role-grid")).toContainText("Vláda a ústřední orgány");
  await expect(page.locator("#role-grid")).toContainText("Zastupitelstvo kraje");
  await expect(page.locator("#role-grid")).toContainText("poskytuje službu");
});


test("region selector preserves Prague dual-role warning", async ({ page }) => {
  await openAccountability(page);
  await page.locator("#region-select").selectOption("CZ:00064581");
  await expect(page.locator("#funding-entity-name")).toHaveText("Praha");
  await expect(page.locator("#funding-entity-type")).toHaveText("Obecní i krajská role");
  await expect(page.locator("#funding-total")).toHaveText("148,1 mld. Kč");
});


test("accountability page is bilingual and removes the paint guard", async ({ page }) => {
  await openAccountability(page, "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).not.toHaveAttribute("data-language-pending", "en");
  await expect(page.locator(".accountability-hero h1")).toContainText("Who decides");
  await expect(page.locator(".accountability-verdict strong")).toHaveText("Region ≠ sum of municipalities");
  await expect(page.locator("#role-grid")).toContainText("Public health insurers");
  await expect(page.locator("#risk-grid")).toContainText("A high transfer share is a structural signal");
});


test("regional directory links to the accountability layer", async ({ page }) => {
  await page.goto("/cz/kraje/?accountability-test=1");
  const link = page.locator('.accountability-entry a[href*="/cz/kraje/accountability/"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/cz\/kraje\/accountability\/(?:\?lang=cs)?$/);
  await expect(page.locator("#coverage-integrity")).toHaveText("PROŠLO");
});


test("published contract keeps unknown transfers non-matchable", async ({ request }) => {
  const response = await request.get("/data/accountability/cze-regions.v1.json");
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.integrity.status).toBe("passed");
  expect(data.regional_entities).toHaveLength(14);
  for (const entity of data.regional_entities) {
    expect(entity.transfer_observation.sender_entity_id).toBeNull();
    expect(entity.transfer_observation.quality_flags).toContain("not_matchable_for_consolidation");
  }
});
