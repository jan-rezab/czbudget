import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const nginx = readFileSync("nginx.conf.template", "utf8");
const injectedHead = nginx.match(/map \$host \$psd_head_inject\s*\{\s*default '([^']+)';/)[1];

for (const [pageUrl, resource, ready] of [
  ["/comparison.html?lang=en", "**/data/compare-metrics.v1.json", "#compare-result .cmp-row"],
  ["/map.html?lang=en", "**/data/world-map.v1.json", ".map-canvas svg"],
  ["/deep-dives/education/?lang=en", "**/data/education-deep-dive.v1.json*", "#capacity-body tr"],
]) {
  test(`${pageUrl} renders while the production analytics script is stalled`, async ({ page }) => {
    let releaseAnalytics;
    const stalled = new Promise(resolve => { releaseAnalytics = resolve; });
    await page.route("https://cloud.umami.is/script.js", async route => {
      await stalled;
      await route.fulfill({ contentType: "text/javascript", body: "" });
    });
    await page.route(`**${pageUrl}`, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace("<head>", injectedHead) });
    });
    try {
      await page.goto(pageUrl, { waitUntil: "commit" });
      await expect(page.locator("html")).not.toHaveAttribute("data-language-pending", /.+/, { timeout: 2000 });
      await expect(page.locator(ready).first()).toBeVisible({ timeout: 5000 });
    } finally {
      releaseAnalytics();
    }
  });

  test(`${pageUrl} recovers after a transient data response`, async ({ page }) => {
    let requests = 0;
    await page.route(resource, route => ++requests === 1
      ? route.fulfill({ status: 503, body: "Temporarily unavailable" })
      : route.continue());
    await page.goto(pageUrl);
    await expect(page.locator(ready).first()).toBeVisible();
    expect(requests).toBe(2);
  });
}

test("education exposes a working retry when data remains unavailable", async ({ page }) => {
  const resource = "**/data/education-deep-dive.v1.json*";
  await page.route(resource, route => route.fulfill({ status: 503, body: "Temporarily unavailable" }));
  await page.goto("/deep-dives/education/?lang=en");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.unroute(resource);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#capacity-body tr")).toHaveCount(7);
});
