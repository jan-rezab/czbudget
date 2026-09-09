import {test,expect} from '@playwright/test';

test('PAQ municipality keeps source values, history and geographic scope',async({page})=>{
  await page.goto('/paq.html?level=obec&code=554791&lang=cs');
  await expect(page.locator('#paq-root h1')).toHaveText('Plzeň · Data o území');
  await page.locator('[data-query]').fill('suma_vyplacene_prispevky_na_bydleni');
  const row=page.locator('[data-table] > .paq-table-scroll > table > tbody > tr');
  await expect(row).toHaveCount(1);await expect(row).toContainText('328');await expect(row).toContainText('104');
  await row.locator('summary').click();await expect(row.locator('.paq-history')).toContainText('2023');
  await expect(row).toContainText('ASZ');await expect(page.getByRole('link',{name:'ORP: Plzeň',exact:true})).toHaveAttribute('href','/paq.html?level=orp&code=3209&lang=cs');
  const download=page.waitForEvent('download');await page.locator('[data-download]').click();expect((await download).suggestedFilename()).toBe('paq-obec-554791.json');
});

test('PAQ national panel retains respondent groups and original periods',async({page})=>{
  await page.goto('/paq.html?level=stat&code=CZ&lang=en');
  await expect(page.locator('#paq-root h1')).toHaveText('Česko · Territory data');
  await expect(page.locator('.paq-panel')).toHaveCount(30);
  const panel=page.locator('.paq-panel').filter({hasText:'Jaké jsou příjmy domácností a kolik jim zbývá po nutných výdajích'});
  await panel.locator('summary').click();await expect(panel.locator('[data-panel-table]')).toContainText('11. 5. 2026');
  await panel.locator('select').selectOption({index:1});await expect(panel.locator('caption')).toContainText('Vzdělání');
  await expect(panel.getByRole('link')).toHaveAttribute('href','https://data.irozhlas.cz/zivot/prijmy/');
});

test('Czech budget profile exposes its own PAQ territory',async({page})=>{
  await page.goto('/cz/municipalities/plzen/?lang=cs');
  const context=page.locator('#paq-context');
  await expect(context).toContainText('Plzeň');await expect(context).toContainText('554791');
  await context.getByRole('button').click();await expect(context.locator('tbody > tr')).toHaveCount(6);
  await expect(context.getByRole('link',{name:/Všechny ukazatele/})).toHaveAttribute('href','/paq.html?level=obec&code=554791&lang=cs');
});
