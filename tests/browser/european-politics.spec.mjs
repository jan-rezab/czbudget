import {test,expect} from '@playwright/test';

test('all benchmark countries connect fiscal history and government programs',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/deep-dives/european-politics/?lang=en&code=CZE');
 await expect(page.locator('#report')).toBeVisible();
 await expect(page.locator('[data-country-card]')).toHaveCount(10);
 await expect(page.locator('#program-detail')).toContainText('Petr Fiala');
 await expect(page.locator('#program-detail .program-source')).toHaveAttribute('href',/vlada/);
 for(const code of ['DEU','DNK','FRA','GBR','POL','SWE','CHE','UKR','USA']){
  await page.selectOption('#politics-country',code);
  await expect(page.locator('#politics-government option')).not.toHaveCount(0);
  await expect(page.locator('#chart-container svg')).toHaveCount(1);
 }
 await page.selectOption('#politics-country','GBR');
 await page.selectOption('#politics-government','gbr-2022-09-06');
 await expect(page.locator('#program-detail h3')).toHaveText('Liz Truss');
 await expect(page.locator('#program-detail')).toContainText('Cut taxes');
 await expect(page).toHaveURL(/government=gbr-2022-09-06/);
 await page.selectOption('#politics-view','real');
 await page.reload();
 await expect(page.locator('#program-detail h3')).toHaveText('Liz Truss');
 await expect(page.locator('#politics-view')).toHaveValue('real');
 await page.locator('#chart-container [data-action="table"]').click();
 await expect(page.locator('#chart-container .psd-chart-table tbody tr')).toHaveCount(10);
 const csv=await page.evaluate(()=>window.PSDChart.get('european-politics-economy-history').csv());
 expect(csv).toContain('Liz Truss');expect(csv).toContain('2022');
 expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('constitutional distinctions, missing documents, language and invalid states',async({page})=>{
 await page.goto('/deep-dives/european-politics/?lang=cs&code=invalid&government=bad&view=bad');
 await expect(page.locator('#politics-country')).toHaveValue('CZE');
 await expect(page.locator('#politics-view')).toHaveValue('nominal');
 await page.selectOption('#politics-country','CHE');
 await expect(page.locator('#country-note')).toContainText('kolektivně');
 await page.selectOption('#politics-country','FRA');
 await expect(page.locator('#program-detail')).toContainText('François Bayrou');
 await expect(page.locator('#program-detail')).toContainText('lednu 2025');
 await expect(page.locator('#program-detail .program-source')).toHaveCount(0);
 await page.selectOption('#politics-country','UKR');
 await expect(page.locator('#program-detail')).toContainText('parlament tento program neschválil');
 await page.goBack();
 await expect(page.locator('#politics-country')).toHaveValue('FRA');
});


test('report discovery, language switching and actual downloads',async({page})=>{
 await page.goto('/deep-dives/?lang=en');
 await page.locator('#european-politics').click();
 await expect(page.locator('#report')).toBeVisible();
 await page.locator('psd-site-header [data-lang="cs"]').click();
 await expect(page.locator('h1')).toContainText('Kdo vládl');
 await expect(page).toHaveURL(/lang=cs/);
 await page.locator('psd-site-header .deep-dive-menu summary').click();
 await expect(page.locator('psd-site-header a[href*="european-politics"]')).toHaveCount(1);
 await page.locator('psd-site-header .deep-dive-menu summary').click();
 const download=page.waitForEvent('download');
 await page.locator('#chart-container [data-action="csv"]').click();
 expect((await download).suggestedFilename()).toBe('european-politics-economy-history.csv');
 const png=page.waitForEvent('download');
 await page.locator('#chart-container [data-action="png"]').click();
 expect((await png).suggestedFilename()).toBe('european-politics-economy-history.png');
});

test('crawled party promises show evidence, matched comparisons and explicit exceptions',async({page})=>{
 await page.goto('/deep-dives/european-politics/?lang=en&code=CZE');
 await expect(page.locator('#promise-list')).toContainText('Cut employer social contributions');
 await expect(page.locator('#chart-container svg image')).not.toHaveCount(0);
 const promise=page.locator('[data-promise-id="cze-employer-contributions"]');
 await promise.locator('details summary').click();
 await expect(promise.locator('blockquote')).toContainText('2 procentní body');
 await expect(promise.locator('details a').first()).toHaveAttribute('href',/#page=9$/);
 await expect(promise.locator('.crawl-proof')).toContainText('SHA-256');
 for(const [country,phrase] of [['DEU','Not levied'],['DNK','Final target after 2024'],['FRA','Implemented'],['GBR','Breached, later reversed'],['POL','PLN'],['SWE','Abolished from January 2023'],['CHE','Party position'],['UKR','Different definitions'],['USA','Higher than 21%']]){
  await page.selectOption('#politics-country',country);await expect(page.locator('#promise-list')).toContainText(phrase);
 }
 await page.selectOption('#politics-country','UKR');
 await expect(page.locator('#promise-list [data-action="png"]')).toHaveCount(0);
 await page.locator('#promise-list [data-action="table"]').click();
 await expect(page.locator('#promise-list .psd-chart-table')).toContainText('Security + defence + guarantees');
 await page.selectOption('#politics-country','FRA');
 const csv=await page.evaluate(()=>window.PSDChart.get('fra-corporation-tax').csv());
 expect(csv).toContain('2022-01-01');expect(csv).toContain('impots.gouv.fr');
 const downloadPromise=page.waitForEvent('download');await page.locator('#promise-list [data-action="png"]').click();
 const file=await downloadPromise;expect(file.suggestedFilename()).toBe('fra-corporation-tax.png');expect(await file.failure()).toBeNull();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
