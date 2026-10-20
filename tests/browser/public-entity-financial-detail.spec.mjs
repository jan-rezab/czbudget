import {test, expect} from '@playwright/test';
for (const [pageName, prefix] of [['cesky-rozpocet.html','embed'], ['cesko.html','public']]) {
  for (const lang of ['cs','en']) test(`${pageName} ${lang}: company financial detail survives filtering and keyboard use`, async ({page}) => {
    const errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/${pageName}?lang=${lang}`);
    const search=page.locator(prefix==='embed'?'#embed-entity-search':'#entity-search');
    await search.fill('00002739');
    const trigger=page.locator('[data-entity-financial="00002739"]');
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await trigger.press('Enter');
    const panel=page.locator(`#${prefix}-financial-00002739`);
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded','true');
    await expect(panel).toContainText('EBITDA');
    await expect(panel).toContainText(lang==='en'?'Individual balance sheet':'Individuální rozvaha');
    await expect(panel.locator('a[href*="diamo.cz"]')).toHaveAttribute('href', /#page=105$/);
    await expect(panel).toContainText(lang==='en'?'not a planned budget':'nikoli plánovaný rozpočet');
    await panel.locator('a').first().focus();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await search.fill('70889953');
    await page.locator('[data-entity-financial="70889953"]').click();
    await expect(page.locator(`#${prefix}-financial-70889953`)).toBeVisible();
    await search.fill('00002739');
    await expect(page.locator(`#${prefix}-financial-00002739`)).toBeHidden();
    await trigger.click();
    await expect(panel).toBeVisible();
    expect(errors).toEqual([]);
  });
}
