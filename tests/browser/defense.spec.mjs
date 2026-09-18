import { expect, test } from "@playwright/test";

const setYear = (page, year) => page.locator("#blocks-year").evaluate((input, value) => {
  input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}, year);

test("defense blocks compare NATO with Russia, China and Ukraine", async ({ page }) => {
  const response = await page.goto("/deep-dives/defense/?lang=en&code=CZE", { waitUntil: "networkidle" });
  expect(response?.ok()).toBeTruthy();

  await expect(page.locator(".defense-bloc")).toHaveCount(4);
  const captions = page.locator(".defense-bloc figcaption strong");
  await expect(captions).toHaveText(["All NATO members", "Ukraine", "Russia", "China"]);
  await expect(page.locator(".defense-bloc").first().locator("figcaption span")).toHaveText("$1,581bn");
  await expect(page.locator(".defense-bloc").first().locator("figcaption small")).toHaveText("32 member states");
  await expect(page.locator("#blocks-year-value")).toHaveText("2025");

  // Dropping the US is the comparison the alliance argues about; it must recompute, not re-label.
  await page.locator("#blocks-include-us").uncheck();
  await expect(captions.first()).toHaveText("NATO members without the US");
  await expect(page.locator(".defense-bloc").first().locator("figcaption small")).toHaveText("31 member states");
  await expect(page.locator(".defense-bloc").first().locator("figcaption span")).toHaveText("$627bn");
  await page.locator("#blocks-include-us").check();

  await setYear(page, 2014);
  await expect(page.locator("#blocks-year-value")).toHaveText("2014");
  await expect(page.locator(".defense-bloc").first().locator("figcaption span")).toHaveText("$962bn");
  await expect(page.locator("#ranking-meta div").first()).toContainText("2014");
});

test("every block run carries a hover readout and a legend entry", async ({ page }) => {
  await page.goto("/deep-dives/defense/?lang=en&code=CZE", { waitUntil: "networkidle" });
  const legend = page.locator("#blocks-legend button");
  await expect(legend.first()).toContainText("United States");
  await expect(legend).toHaveCount(await page.locator(".defense-bloc").first().locator("path").count());
  await expect(page.locator("#blocks-legend h3")).toContainText("member states");

  // Scrolling hides the tooltip on purpose, so let the smooth scroll settle before pointing.
  const grid = page.locator(".defense-bloc").first().locator("svg");
  await grid.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await grid.hover({ position: { x: 60, y: 20 } });
  const tooltip = page.locator("#defense-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator(".tip-head")).toContainText("2025");
  await expect(tooltip).toContainText("United States");
  await expect(tooltip.locator(".tip-row").nth(1)).toContainText("954");   // one block per billion
});

test("the ranking lists all 32 members and switches measure", async ({ page }) => {
  await page.goto("/deep-dives/defense/?lang=en&code=CZE", { waitUntil: "networkidle" });
  const groups = page.locator("#defense-comparison-chart .defense-rank-group");
  await expect(groups).toHaveCount(2);
  await expect(groups.first().locator(".defense-rank-row")).toHaveCount(32);
  await expect(groups.nth(1).locator(".defense-rank-row")).toHaveCount(6);
  await expect(groups.first().locator(".defense-rank-row").first()).toContainText("Poland");
  await expect(page.locator(".defense-target-tick")).not.toHaveCount(0);

  await page.locator("#ranking-modes button", { hasText: "Dollars" }).click();
  await expect(groups.first().locator(".defense-rank-row").first()).toContainText("United States");
  await expect(groups.first().locator(".defense-rank-row").first().locator("strong")).toHaveText("$954bn");
  // A GDP-share marker is meaningless against a dollar axis.
  await expect(page.locator(".defense-target-tick")).toHaveCount(0);
});

test("the trajectory hides Ukraine on the share axis and restores it on demand", async ({ page }) => {
  await page.goto("/deep-dives/defense/?lang=en&code=CZE", { waitUntil: "networkidle" });
  await expect(page.locator(".traj-key")).toHaveCount(6);
  await expect(page.locator(".traj-key", { hasText: "Ukraine" })).toHaveAttribute("aria-pressed", "true");

  await page.locator("#trajectory-modes button", { hasText: "% of GDP" }).click();
  await expect(page.locator(".traj-key", { hasText: "Ukraine" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#trajectory-note")).toContainText("Ukraine");

  await page.locator(".traj-key", { hasText: "Ukraine" }).click();
  await expect(page.locator(".traj-key", { hasText: "Ukraine" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".defense-trajectory-svg .traj-line")).toHaveCount(6);
});

test("countries without a downloaded budget keep the international measures", async ({ page }) => {
  await page.goto("/deep-dives/defense/?lang=en&code=RUS", { waitUntil: "networkidle" });
  await expect(page.locator("#detail-country-name")).toHaveText("Russia");
  await expect(page.locator("#budget-lines")).toBeHidden();
  await expect(page.locator("#defense-kpis article")).toHaveCount(4);
  await expect(page.locator("#detail-scope")).toContainText("No machine-readable budget source");

  await page.goto("/deep-dives/defense/?lang=en&code=CZE", { waitUntil: "networkidle" });
  await expect(page.locator("#budget-lines")).toBeVisible();
  await expect(page.locator("#defense-kpis article")).toHaveCount(6);
  await expect(page.locator("#defense-lines-body tr")).not.toHaveCount(0);
});

test("the Czech page speaks Czech end to end", async ({ page }) => {
  await page.goto("/deep-dives/defense/?lang=cs&code=CZE", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toContainText("obranu");
  await expect(page.locator("#blocks h2")).toHaveText("Jeden blok je jedna miliarda dolarů");
  await expect(page.locator(".defense-bloc figcaption strong")).toHaveText(["Všichni členové NATO", "Ukrajina", "Rusko", "Čína"]);
  await expect(page.locator(".defense-bloc").first().locator("figcaption span")).toContainText("mld.");
  await expect(page.locator("#ranking-modes button").first()).toHaveText("% HDP");
});

test("the closing chart splits the alliance budget between the US and the rest", async ({ page }) => {
  await page.goto("/deep-dives/defense/?lang=en&code=CZE", { waitUntil: "networkidle" });
  const section = page.locator("#us-share");
  await expect(section).toHaveCount(1);
  // It is the last thing on the page, after the method block.
  await expect(page.locator("main > section").last()).toHaveAttribute("id", "us-share");
  await expect(section.locator(".share-area.us")).toHaveCount(1);
  await expect(section.locator(".share-area.others")).toHaveCount(1);
  await expect(section.locator(".share-key")).toHaveText([/United States/, /Other members/]);
  await expect(section.locator("#share-meta div").first()).toContainText("US share · 2025");

  const svg = section.locator("svg");
  await svg.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const box = await svg.boundingBox();
  await svg.hover({ position: { x: box.width / 2, y: box.height / 2 } });
  const tooltip = page.locator("#defense-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("United States");
  await expect(tooltip).toContainText("NATO");
});

test("every bloc stands on the same floor with its caption rule in line", async ({ page }) => {
  await page.goto("/deep-dives/defense/?lang=en&code=CZE", { waitUntil: "networkidle" });
  const floors = await page.locator("#defense-blocks svg").evaluateAll(
    (nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().bottom)));
  expect(new Set(floors).size).toBe(1);
  const rules = await page.locator("#defense-blocks figcaption").evaluateAll(
    (nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
  expect(new Set(rules).size).toBe(1);
  // Blocks stack upward: the last column of a bloc is the one that is short at the top.
  const overflows = await page.locator("#defense-blocks").evaluate(
    (node) => node.scrollWidth > node.clientWidth + 2);
  expect(overflows).toBe(false);
});
