import { defineConfig, devices } from "@playwright/test";

// Every test runs on desktop. On mobile the release gate runs the tests about layout,
// viewport, touch, navigation or legibility (by title or spec file name);
// PSD_MOBILE_SCOPE=all (the preview verifier, or a deeper run on request) runs all of them.
const MOBILE_LAYOUT = /(?<![\w-])mobile(?!-chromium)|layout|viewport|overflow|responsive|narrow|phone|touch|\btap|swipe|\bfits?\b|width|scroll|menu|nav|drawer|wrap|overlap|crop|clip|legib|readable|contrast|visual|geometry|floor|in line|align|footer|header|sticky/i;
const mobileScope = process.env.PSD_MOBILE_SCOPE === "all" ? {} : { grep: MOBILE_LAYOUT };

export default defineConfig({
  testDir: "tests/browser",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, ...mobileScope },
  ],
  webServer: {
    command: "node scripts/test-server.mjs",
    port: Number(process.env.PORT || 4173),
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
