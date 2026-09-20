import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'tests/release',timeout:20_000,retries:0,workers:2,reporter:'line',
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure'},
  webServer:{command:'node scripts/release-image-proxy.mjs',url:'http://127.0.0.1:4173/healthz',timeout:30_000,reuseExistingServer:false},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 7']}}],
});
