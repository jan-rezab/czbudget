import { expect, test } from '@playwright/test';

const codes=['280530','284610','284690'];
const totals=['2022','2024'].flatMap((period,year)=>codes.flatMap((product_code,i)=>[
 {period,product_code,flow:'export',value_usd:(year+1)*(i+1)*1e6,net_weight_kg:(i+1)*1000,weight_estimated:true},
 {period,product_code,flow:'import',value_usd:(year+1)*(i+1)*5e5,net_weight_kg:(i+1)*500,weight_estimated:false},
]));
const partners=codes.flatMap((product_code,i)=>[
 {product_code,flow:'export',partner_iso3:'JPN',partner_name:'Japan',value_usd:(i+1)*1e6,net_weight_kg:(i+1)*500},
 {product_code,flow:'import',partner_iso3:'USA',partner_name:'United States',value_usd:(i+1)*5e5,net_weight_kg:i===1?null:(i+1)*500},
]);
function profile(url){const monthly=url.searchParams.get('frequency')==='M';return {data:{country:url.searchParams.get('country'),frequency:monthly?'M':'A',period:url.searchParams.get('period')||(monthly?null:'2024'),periods:monthly?[]:['2022','2024'],totals:monthly?[]:totals,partners:monthly?[]:partners,coverage:monthly?[]:[{period:'2024',crawl_status:'loaded'}],source:{retrieved_at:'2026-09-20T00:00:00Z'}}};}
test.beforeEach(async({page})=>{
 await page.route('**/api/v1/trade/countries',route=>route.fulfill({json:{data:{countries:[{code:'CHN',name:'China'},{code:'USA',name:'United States'}]}}}));
 await page.route('**/api/v1/trade/rare-earths?*',route=>route.fulfill({json:profile(new URL(route.request().url()))}));
});
test('rare-earth flows share country, period, product and unit state',async({page})=>{
 await page.goto('/deep-dives/rare-earths/?lang=en');
 await expect(page.locator('#re-kpis')).toContainText('$12M');
 await expect(page.locator('#re-kpis')).toContainText('6/6');
 await expect(page.locator('#re-export-chart svg')).toHaveCount(1);
 await page.getByRole('button',{name:'Rare-earth metals',exact:true}).click();
 await expect(page).toHaveURL(/product=280530/);
 await expect(page.locator('#re-kpis')).toContainText('$2M');
 await page.getByRole('button',{name:'Tonnes',exact:true}).click();
 await expect(page.locator('#re-kpis')).toContainText('1 t');
 await expect(page.locator('#re-coverage')).toContainText('source-estimated weights');
 await page.locator('#re-export-chart [data-partner="JPN"]').click();
 await expect(page.locator('#re-partner-detail')).toContainText('Japan');
 await expect(page).toHaveURL(/partner=JPN/);
 await page.locator('#re-period').selectOption('2022',{force:true});
 await expect(page).toHaveURL(/period=2022/);
 await expect(page.locator('#re-controls')).not.toHaveAttribute('aria-busy','true');
});
test('monthly absence clears annual charts and never labels the gap zero',async({page})=>{
 await page.goto('/deep-dives/rare-earths/?lang=en');
 await expect(page.locator('#re-kpis')).toContainText('$12M');
 await page.getByRole('button',{name:'Monthly',exact:true}).click();
 await expect(page.locator('#re-status')).toContainText('No data');
 await expect(page.locator('#re-kpis .export strong')).toHaveText('—');
 await expect(page.locator('#re-trend-chart svg')).toHaveCount(0);
 await expect(page).toHaveURL(/freq=M/);
});
test('tables, source drawers and CSV expose chart rows and missing weights',async({page})=>{
 await page.goto('/deep-dives/rare-earths/?lang=en&unit=tonnes');
 await expect(page.locator('#re-import-chart')).toContainText('Weight coverage is incomplete');
 await page.locator('#re-trend-chart [data-action="table"]').click();
 await expect(page.locator('#re-trend-chart table')).toContainText('2023');
 const missing=page.locator('#re-trend-chart tr').filter({hasText:'2023'});
 await expect(missing.locator('td').nth(1)).toHaveText('');
 await page.locator('#re-products-chart [data-action="sources"]').click();
 await expect(page.locator('#re-products-chart .psd-chart-drawer')).toContainText('Excludes ores');
 const download=page.waitForEvent('download');
 await page.locator('#re-trend-chart [data-action="csv"]').click();
 expect((await download).suggestedFilename()).toBe('rare-earths-trade-history.csv');
});
test('country comparisons preserve the chosen year and Czech translation works',async({page})=>{
 await page.goto('/deep-dives/rare-earths/?lang=en&period=2022');
 await expect(page.locator('#re-kpis')).toContainText('$6M');
 await page.locator('#re-country').selectOption('USA',{force:true});
 await expect(page).toHaveURL(/code=USA/);await expect(page).toHaveURL(/period=2022/);
 await expect(page.locator('#re-controls')).not.toHaveAttribute('aria-busy','true');
 await page.locator('psd-site-header [data-lang="cs"]').click();
 await expect(page).toHaveTitle('Obchod se vzácnými zeminami — Public Spending Data');
 await expect(page.locator('#overview h1')).toContainText('Vzácné zeminy');
 await expect(page.locator('#method')).toContainText('Nezahrnuje rudy');
});
test('errors remove old values and offer retry',async({page})=>{
 await page.goto('/deep-dives/rare-earths/?lang=en');await expect(page.locator('#re-kpis')).toContainText('$12M');
 await page.route('**/api/v1/trade/rare-earths?*',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
 await page.getByRole('button',{name:'Monthly',exact:true}).click();
 await expect(page.locator('#re-retry')).toBeVisible();
 await expect(page.locator('#re-kpis')).toBeEmpty();
 await page.unroute('**/api/v1/trade/rare-earths?*');
 await page.route('**/api/v1/trade/rare-earths?*',route=>route.fulfill({json:profile(new URL(route.request().url()))}));
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.locator('#re-status')).toContainText('No data');
});
test('mobile layout keeps controls and charts inside the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/deep-dives/rare-earths/?lang=en');await expect(page.locator('#re-kpis')).toContainText('$12M');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('#re-export-chart svg')).toBeVisible();
});
