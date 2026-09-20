import {test,expect} from '@playwright/test';

for(const code of ['CZE','USA','FRA','RUS','UKR'])test(`funding: ${code} routes preserve evidence and fit the viewport`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`/deep-dives/funding/?lang=en&code=${code}`);
 await expect(page.locator('[data-ledger]')).toHaveCount(5);
 await expect(page.locator('#fund-code')).toHaveText(code);
 await expect(page.locator('.ledger-evidence')).toHaveCount(5);
 await expect(page.locator('#fund-school-comparison')).toContainText('Historical');
 if(code==='RUS'){await expect(page.locator('#fund-school-ledger .ledger-eyebrow')).toContainText('Amounts not verified');await expect(page.locator('#fund-school-ledger .ledger-play')).toBeDisabled();}
 if(code==='UKR')await expect(page.locator('#fund-school-ledger .ledger-eyebrow')).toContainText('Budget plan');
 if(code==='USA')await expect(page.locator('.ledger-balance')).toContainText('$11.2bn');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);
});
test('funding: URL units, Czech language, and table retain the same underlying observations',async({page})=>{
 await page.goto('/deep-dives/funding/?lang=cs&code=USA&unit=100');
 const school=page.locator('#fund-school-ledger');await expect(school.locator('[data-ledger]')).toHaveCount(1);
 await expect(school).toContainText('Tři zdroje');
 await school.getByRole('button',{name:'Tabulka',exact:true}).click();
 await expect(school.locator('table')).toContainText('Federální');
 await expect(school.locator('table')).toContainText('2024');
 await expect(school.locator('.ledger-svg')).toHaveAttribute('aria-labelledby',/us-school/);
});
test('original money-flow view links to the new report',async({page})=>{
 await page.goto('/money-flow.html?lang=en');
 await expect(page.locator('.funding-views a').last()).toHaveAttribute('href',/deep-dives\/funding\/\?lang=en/);
});
