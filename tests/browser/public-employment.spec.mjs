import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const dataset = JSON.parse(await readFile("data/cz-public-employment.v1.json", "utf8"));
const latest = dataset.history.at(-1);
const number = (value) => new Intl.NumberFormat("en-GB", {maximumFractionDigits: 0}).format(value);

test("public-employment report reconciles the control total and source layers", async ({ page }) => {
  const runtimeErrors = [];
  const datasetRequests = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  page.on("request", (request) => {
    if (request.url().includes("cz-public-employment.v1.json")) datasetRequests.push(request.url());
  });

  await page.goto("/deep-dives/public-employment/?lang=en", {waitUntil: "networkidle"});

  await expect(page.locator("h1")).toContainText("Who works");
  await expect(page.locator(".employment-hero-total")).toBeVisible();
  await expect(page.locator("#employment-hero-total")).toHaveText(number(latest.public_sector_fte));
  await expect(page.locator("#employment-history-body tr")).toHaveCount(dataset.history.length);
  await expect(page.locator("#europe")).toBeVisible();
  await expect(page.locator("#employment-benchmark")).toContainText(/17\.8\s%/);
  await expect(page.locator("#employment-benchmark")).toContainText(/18\.4\s%/);
  await expect(page.locator("#employment-benchmark")).toContainText("Nordic four average");
  await expect(page.locator(".employment-benchmark-row")).toHaveCount(11);
  await expect(page.locator(".employment-benchmark-row.is-czech")).toContainText("Czechia");
  await expect(page.locator(".employment-benchmark-row.is-czech")).toContainText("14");
  await expect(page.locator(".employment-benchmark-reading")).toContainText(/24\.2\s%/);
  await expect(page.locator(".employment-benchmark-reading")).toContainText(/17\.8\s%/);
  await expect(page.locator("#growth")).toBeVisible();
  await expect(page.locator("#employment-growth-split")).toContainText(number(dataset.growth.general_government_change_fte));
  await expect(page.locator("#employment-growth-split")).toContainText(number(dataset.growth.public_corporations_change_fte));
  await expect(page.locator(".employment-growth-limit")).toContainText("This is where the exact 121,744-FTE breakdown ends");
  await expect(page.locator(".employment-growth-limit")).toContainText("independent returns");
  await expect(page.locator("#employment-school-growth")).toContainText(number(dataset.growth.regional_education_evidence.change_fte));
  await expect(page.locator("#employment-regulated-growth .employment-growth-row")).toHaveCount(dataset.growth.state_regulated_comparison.components.length);
  await expect(page.locator("#employment-regulated-growth")).toContainText("+64,633");
  await expect(page.locator("#employment-regulated-growth")).toContainText("+58,347");
  await expect(page.locator("#employment-regulated-growth")).toContainText("-2,130");
  await expect(page.locator("#employment-profession-growth .employment-profession-row")).toHaveCount(dataset.growth.education_profession_comparison.components.length);
  await expect(page.locator("#employment-profession-growth")).toContainText("Teaching assistants");
  await expect(page.locator("#employment-profession-growth")).toContainText("+9,139.2");
  await expect(page.locator("#employment-cost-kpis")).toContainText(number(dataset.compensation.headline.average_monthly_cost_2024_czk));
  await expect(page.locator("#employment-cost-chart svg")).toBeVisible();
  await expect(page.locator("#employment-function-growth .employment-cost-function-rows > article")).toHaveCount(dataset.compensation.change_by_function.length);
  await expect(page.locator("#employment-function-growth .employment-cost-stack-row")).toHaveCount(2);
  await expect(page.locator("#employment-salary-comparison > article")).toHaveCount(dataset.growth.state_regulated_comparison.salary_comparison.length);
  await expect(page.locator("#employment-reconciliation")).toContainText("Previously unexplained block");
  await expect(page.locator("#employment-reconciliation")).toContainText(number(dataset.headline.public_sector_fte));
  await expect(page.locator(".recon-pie path")).toHaveCount(dataset.compensation.change_by_function.length + 1);
  await expect(page.locator(".recon-row")).toHaveCount(dataset.compensation.change_by_function.length + 1);
  await expect(page.locator(".recon-stack-row")).toHaveCount(2);
  await expect(page.locator(".recon-method")).toContainText("complete, non-duplicated estimate");
  await expect(page.locator("#employment-entity-status")).toContainText(number(dataset.entity_resolution.registered_entities));
  await expect(page.locator("#employment-entity-status")).toContainText(number(dataset.entity_resolution.entities_with_employee_observation));
  expect(latest.public_sector_fte).toBe(latest.general_government_fte + latest.public_corporations_combined_fte);
  expect(dataset.growth.public_sector_change_fte).toBe(dataset.growth.general_government_change_fte + dataset.growth.public_corporations_change_fte);
  expect(dataset.growth.state_regulated_comparison.components.reduce((sum, row) => sum + row.change_employees, 0)).toBe(dataset.growth.state_regulated_comparison.change_employees);
  expect(dataset.compensation.change_by_function.reduce((sum, row) => sum + row.change_czk_m, 0)).toBe(dataset.compensation.headline.change_czk_m);
  expect(dataset.compensation.history.every((row) => row.compensation_employees_czk_m === row.wages_salaries_czk_m + row.employer_social_contributions_czk_m)).toBe(true);
  expect(datasetRequests).toHaveLength(1);
  expect(new URL(datasetRequests[0]).searchParams.get("v")).toBe(dataset.schema_version);
  expect(runtimeErrors).toEqual([]);
});

test("public-employment reconciliation exposes the complete non-duplicated model", async ({ page }) => {
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });

  await page.goto("/deep-dives/public-employment/?lang=en", {waitUntil: "networkidle"});
  const explorer = page.locator("#explorer");
  await expect(explorer).toBeVisible();
  await expect(page.locator(".recon-summary")).toContainText("661,235");
  await expect(page.locator(".recon-summary")).toContainText("286,643");
  await expect(page.locator(".recon-summary")).toContainText("164,412");
  await expect(page.locator(".recon-stack-row").first()).toContainText("990,546 FTE");
  await expect(page.locator(".recon-stack-row").last()).toContainText("1,112,290 FTE");
  await page.locator('.recon-row[data-recon-id="public_corporations"]').click();
  await expect(page.locator("#recon-selected")).toContainText("Public corporations · exact");
  await expect(page.locator("#recon-direct-copy")).toContainText("exact comparable public-corporation series");
  await page.locator('.recon-row[data-recon-id="education"]').click();
  await expect(page.locator("#recon-selected")).toContainText("Education · modelled");
  await expect(page.locator("#recon-direct-copy")).toContainText("235,149 → 301,048 FTE");
  expect(await page.evaluate(() => document.body.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test("every employment explorer tree reconciles within its declared scope", async () => {
  const visit = (node) => {
    if (!node.children?.length) return;
    const childrenTotal = node.children.reduce((sum, child) => sum + child.value, 0);
    expect(Math.abs(childrenTotal - node.value)).toBeLessThanOrEqual(0.11);
    node.children.forEach(visit);
  };
  dataset.employment_explorer.scopes.forEach((scope) => visit(scope.root));
});

test("European employment benchmark is ranked and keeps the OECD boundary separate", async () => {
  const benchmark = dataset.international_benchmark;
  const czechia = benchmark.countries.find((row) => row.country_code === "CZE");
  expect(benchmark.country_count).toBe(29);
  expect(benchmark.czech_rank).toBe(14);
  expect(czechia.latest_value_pct).toBe(17.78);
  expect(benchmark.oecd_average.latest_value_pct).toBe(18.41);
  expect(benchmark.countries.every((row, index, rows) => index === 0 || rows[index - 1].latest_value_pct >= row.latest_value_pct)).toBe(true);
  expect(benchmark.metric).toBe("general_government_employment_as_pct_total_employment");
});

test("public-employment English shell releases the paint guard immediately", async ({ page }) => {
  await page.goto("/deep-dives/public-employment/?lang=en", {waitUntil: "domcontentloaded"});
  await expect.poll(
    () => page.locator("html").getAttribute("data-language-pending"),
    { timeout: 1500 },
  ).toBeNull();
  await expect(page.locator("#growth h2")).toBeVisible();
});

test("public-employment report is discoverable from the Czech budget and report index", async ({ page }) => {
  await page.goto("/cesky-rozpocet.html?lang=en", {waitUntil: "networkidle"});
  const bridge = page.locator(".public-employment-bridge");
  await expect(bridge).toBeVisible();
  await expect(bridge).toContainText("New complete employment boundary");
  await expect(bridge).toHaveAttribute("href", /\/deep-dives\/public-employment\/\?lang=en$/);

  await page.goto("/deep-dives/?lang=en", {waitUntil: "networkidle"});
  await expect(page.locator("#public-employment")).toBeVisible();
  await expect(page.locator("#public-employment")).toContainText("Public employment");
});
