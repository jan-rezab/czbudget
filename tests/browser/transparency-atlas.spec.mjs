import { test, expect } from "@playwright/test";

// The Budget Transparency Index is an OBS central-government score plus a municipal
// bonus worth at most 20 points. A country with no OBS survey has no scale to add the
// bonus to, and scoring it on raw municipal capability instead mixed two incompatible
// 0-100 ranges in one column: the Netherlands ranked first in the world on municipal
// evidence alone, and four unsurveyed countries printed 0 — which the atlas's own note
// says a score must never imply.

const ATLAS = "/methodology.html?lang=en";

async function atlas(page) {
  await page.goto(ATLAS, { waitUntil: "networkidle" });
  await expect(page.locator("#transparency-atlas .atlas-table tbody tr").first()).toBeVisible();
}

test("a country with no OBS survey carries no index score", async ({ page }) => {
  await atlas(page);
  const data = await page.evaluate(() =>
    fetch("data/global-budget-transparency.v1.json").then((r) => r.json()));

  const municipalOnly = data.countries.filter((c) => c.budget_transparency_index.evidence_status === "municipal_only");
  expect(municipalOnly.length).toBeGreaterThan(0);
  for (const country of municipalOnly) {
    expect(country.budget_transparency_index.score, `${country.name_en} must be unscored`).toBeNull();
  }

  // The Netherlands is the case that made this visible: a full municipal lifecycle
  // and no OBS score must not read as the most transparent budget in the world.
  const nl = page.locator("#atlas-row-nl td.atlas-score").first();
  await expect(nl).toHaveText("●");
  await expect(nl).toHaveClass(/atlas-evidence-municipal_only/);
});

test("every scored country matches its own published formula", async ({ page }) => {
  await atlas(page);
  const bad = await page.evaluate(async () => {
    const data = await fetch("data/global-budget-transparency.v1.json").then((r) => r.json());
    return data.countries
      .filter((c) => c.budget_transparency_index.score !== null)
      .filter((c) => {
        const i = c.budget_transparency_index;
        return i.score !== Math.min(100, i.obs_component + (i.municipal_bonus ?? 0));
      })
      .map((c) => `${c.name_en}: ${c.budget_transparency_index.score}`);
  });
  expect(bad, `rows that break the formula: ${bad.join(", ")}`).toHaveLength(0);
});

test("a provisional score is marked as provisional in the row", async ({ page }) => {
  await atlas(page);

  // Moldova scores 81 from the OBS survey alone, with no municipal research.
  const md = page.locator("#atlas-row-md td.atlas-score").first();
  await expect(md).toHaveText("81");
  await expect(md).toHaveClass(/atlas-evidence-national_only/);
  await expect(md).toHaveAttribute("title", /municipal review pending/);

  // Czechia has both components, so it carries no provisional marker.
  const cz = page.locator("#atlas-row-cz td.atlas-score").first();
  await expect(cz).toHaveClass(/atlas-evidence-complete/);

  await expect(page.locator("#transparency-atlas .atlas-research-notes")).toContainText("†");
});

test("the atlas explains the marker in both languages", async ({ page }) => {
  await atlas(page);
  await expect(page.locator("#transparency-atlas .atlas-research-notes")).toContainText("adds no bonus");

  await page.goto("/methodology.html?lang=cs", { waitUntil: "networkidle" });
  await expect(page.locator("#transparency-atlas .atlas-research-notes")).toContainText("nepřidává žádný bonus");
});
