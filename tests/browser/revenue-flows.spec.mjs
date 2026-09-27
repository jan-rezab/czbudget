import {test,expect} from '@playwright/test';import {fixture} from '../fixtures/revenue/fixture.mjs';
test.beforeEach(async({page})=>{await page.route('**/api/v1/revenue/current',route=>route.fulfill({json:fixture}));});
test('VAT, country selection, missing routes, keyboard and motion retain source boundaries',async({page})=>{
 await page.goto('/deep-dives/revenue/?code=CZE&lang=en');
 await expect(page.locator('#hundred-flow')).toHaveAttribute('data-chart-component','funding-flow');
 await page.locator('[data-flow-key="vat"]').click();await expect(page.locator('[data-flow-node="recipient-municipal"]')).toContainText('146.56');
 await page.locator('[data-flow-key="vat"]').focus();await page.keyboard.press('ArrowDown');await expect(page.locator('[data-flow-key="national"]')).toBeFocused();await page.keyboard.press('Escape');
 await page.selectOption('#deep-dive-country','DEU');await page.locator('[data-flow-key="vat"]').click();await expect(page.locator('[data-flow-node="recipient-local"]')).toContainText('2.8');
 await page.selectOption('#deep-dive-country','AUS');await page.locator('[data-flow-key="vat"]').click();await expect(page.locator('[data-flow-node="recipient-local"]')).toContainText('—');
 await expect(page.locator('#revenue-coverage')).toContainText('Partial coverage');await page.locator('#revenue-motion').click();await expect(page.locator('#hundred-flow')).toHaveAttribute('data-flow-motion','paused');
 await page.locator('#revenue-flow-values summary').click();await expect(page.locator('#revenue-flow-values table')).toContainText('2023');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('excluded URL receives an explicit notice and only eligible options are offered',async({page})=>{
 await page.goto('/deep-dives/revenue/?code=USA&lang=en');await expect(page.locator('#revenue-coverage')).toContainText('insufficient');await expect(page.locator('#deep-dive-country option[value="USA"]')).toHaveCount(0);
});
test('reduced motion pauses money particles',async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/deep-dives/revenue/?lang=en');await expect(page.locator('#hundred-flow')).toHaveAttribute('data-flow-motion','paused');});
