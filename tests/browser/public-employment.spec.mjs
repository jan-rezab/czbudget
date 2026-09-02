import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const dataset = JSON.parse(await readFile("data/cz-public-employment.v1.json", "utf8"));
const latest = dataset.history.at(-1);
const number = (value) => new Intl.NumberFormat("en-GB", {maximumFractionDigits: 0}).format(value);

test("public-employment report reconciles the control total and source layers", async ({ page }) => {
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });

  await page.goto("/deep-dives/public-employment/?lang=en", {waitUntil: "networkidle"});

  await expect(page.locator("h1")).toContainText("Who works");
  await expect(page.locator(".employment-hero-total")).toBeVisible();
  await expect(page.locator("#employment-hero-total")).toHaveText(number(latest.public_sector_fte));
  await expect(page.locator("#employment-history-body tr")).toHaveCount(dataset.history.length);
  await expect(page.locator("#employment-boundary-equation")).toContainText(number(latest.general_government_fte));
  await expect(page.locator("#employment-boundary-equation")).toContainText(number(latest.public_corporations_combined_fte));
  await expect(page.locator("#employment-layer-grid > article")).toHaveCount(dataset.evidence_layers.length);
  await expect(page.locator("#employment-layer-grid")).toContainText("do not add");
  await expect(page.locator("#employment-entity-status")).toContainText(number(dataset.entity_resolution.registered_entities));
  await expect(page.locator("#employment-entity-status")).toContainText(number(dataset.entity_resolution.entities_with_employee_observation));
  expect(latest.public_sector_fte).toBe(latest.general_government_fte + latest.public_corporations_combined_fte);
  expect(runtimeErrors).toEqual([]);
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
