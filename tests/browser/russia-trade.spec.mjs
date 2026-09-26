import { test, expect } from '@playwright/test';
const sample=()=>({schema_version:'russia-trade-routes.v1',exporter:'DEU',via:'KAZ',product:'854231',end_period:'202403',source:{url:'https://comtradeplus.un.org/',table:'budget_detail.trade_observations',release_ids:['synthetic-fixture'],retrieved_at:'2026-09-26'},observations:[['202401','DEU','RUS',100],['202401','DEU','KAZ',50],['202401','KAZ','RUS',20],['202403','DEU','RUS',0],['202403','DEU','KAZ',200]].map(([period,reporter_iso3,partner_iso3,value_usd])=>({period,reporter_iso3,partner_iso3,value_usd,reported_value_usd:String(value_usd),classification_code:'H6',ingestion_run_id:'synthetic-fixture'}))});
test.beforeEach(async({page})=>{
 await page.route('**/api/v1/trade/russia-routes?**',route=>route.fulfill({json:{data:sample()}}));
 // Deliberately small synthetic geometry; no live warehouse or map download in tests.
 await page.route('**/data/world-map.v1.json',route=>route.fulfill({json:{viewBox:'0 0 1000 600',locations:[{id:'de',path:'M100 200h40v40h-40z'},{id:'kz',path:'M450 300h80v60h-80z'},{id:'ru',path:'M700 100h150v100h-150z'}]}}));
});
test('missing baseline is explicit and a missing month clears all route values',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en');await expect(page.locator('#rt-month')).toHaveText('January 2024');await expect(page.locator('#rt-status')).toContainText('Pre-invasion baseline is incomplete');await expect(page.locator('#rt-delta strong')).toHaveText(['—','—','—']);
 await page.locator('#rt-next').click();await expect(page.locator('#rt-month')).toHaveText('February 2024');await expect(page.locator('.rt-leg strong')).toHaveText(['—','—','—']);await expect(page.locator('.psd-route-line.is-missing')).toHaveCount(3);
 await page.locator('#rt-next').click();await expect(page.locator('.rt-leg strong').first()).toHaveText(/0/);await expect(page).toHaveURL(/period=202403/);
});
test('map supports keyboard, touch-equivalent click, Escape and table values',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en');const mark=page.locator('[data-edge="0"]');await mark.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-edge="1"]')).toBeFocused();await expect(page.locator('.psd-route-detail')).toContainText('50 USD');await page.keyboard.press('Escape');await expect(page.locator('.psd-route-detail')).toContainText('Three independent');const point=await page.locator('[data-edge="2"] .psd-route-hit').evaluate(path=>{const p=path.getPointAtLength(path.getTotalLength()/2);const screen=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());return {x:screen.x,y:screen.y};});await page.mouse.click(point.x,point.y);await expect(page.locator('.psd-route-detail')).toContainText('20 USD');await page.locator('#rt-trend-wrapper [data-action="table"]').click();await expect(page.locator('.psd-chart-panel')).toContainText('2024-01');
});
test('playback advances one month, pauses and respects direct links to the baseline',async({page})=>{
 await page.clock.install();await page.goto('/deep-dives/russia-trade/?lang=en&period=202401');await expect(page.locator('#rt-play')).toBeEnabled();await page.locator('#rt-play').click();await page.clock.runFor(1250);await expect(page.locator('#rt-month')).toHaveText('February 2024');await page.locator('#rt-play').click();await page.clock.runFor(2400);await expect(page.locator('#rt-month')).toHaveText('February 2024');await page.locator('[data-chapter="before"]').click();await expect(page.locator('#rt-month')).toHaveText('February 2019');await expect(page.locator('.rt-leg strong')).toHaveText(['—','—','—']);
});
test('a failed replacement selection clears old evidence and offers retry',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en');await expect(page.locator('.rt-leg')).toHaveCount(3);await page.route('**/api/v1/trade/russia-routes?**',route=>route.fulfill({status:503,json:{error:'offline'}}));await page.locator('#rt-via').selectOption('ARM');await expect(page.locator('#rt-status')).toContainText('could not be loaded');await expect(page.locator('#rt-legs')).toBeEmpty();await expect(page.locator('#rt-retry')).toBeVisible();await expect(page.locator('#rt-play')).toBeDisabled();
});
test('Czech translation and mobile layout stay usable',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=cs');await expect(page.locator('h1')).toHaveText('Cíl se změnil. A co obchod?');await expect(page.locator('#rt-status')).toContainText('Předválečný základ');const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);expect(overflow).toBe(false);
});
