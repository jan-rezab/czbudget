import { test, expect } from '@playwright/test';

test('candidate image serves navigation and the published story',async({page})=>{
  await page.goto('/stories/?lang=en');
  await expect(page.locator('.global-nav')).toContainText('Stories');
  await page.goto('/stories/tariffs-went-up-did-america-win/?lang=en');
  await expect(page.locator('h1')).toBeVisible();
});
test('candidate image serves matching immutable chart assets and usable tooltips',async({page,request})=>{
  const response=await request.get('/assets/chart-releases/current.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-cache');
  const manifest=await response.json();
  for(const asset of [manifest.script,manifest.style]) {
    const response=await request.get(asset.url);
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('immutable');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  }
  // Route only the synthetic HTML: JS, CSS and manifest must come from the image.
  await page.route('**/chart-contract-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><div id="plot"></div><script type="module">await import("/chart-runtime.js");await window.PSDPlotReady;window.PSDPlot.render(document.querySelector("#plot"),{rows:[{year:2025,amount:42}],fields:[{key:"amount",label:"Revenue"}]});</script></main></body></html>'}));
  await page.goto('/chart-contract-fixture');
  await page.locator('[data-point]').focus();
  await expect(page.locator('.psd-plot-tooltip')).toContainText('42');
  await page.keyboard.press('Escape');
  await expect(page.locator('.psd-plot-tooltip')).toBeHidden();
});
