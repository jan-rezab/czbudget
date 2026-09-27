import { test, expect } from '@playwright/test';
const obs=(period,hub,flow,partner,product,value)=>({period,reporter_iso3:hub,flow_code:flow,partner_iso3:partner,partner_area_code:partner==='WORLD'?0:1,product_code:product,value_usd:value,reported_value_usd:String(value),product_count:1,classifications:'H6',release_ids:'synthetic'});
const sample=(frequency='A',product='TOTAL')=>({frequency,product,countries:[{iso3:'DEU',iso2:'de',name:'Germany'},{iso3:'CHN',iso2:'cn',name:'China'}],source:{url:'https://comtradeplus.un.org/',table:'synthetic',release_ids:['synthetic'],method:'Synthetic fixture',release_note:'Test only'},suppliers:[],observations:(frequency==='A'?['2014','2019','2021','2022','2025']:['202401','202403']).flatMap((p,slot)=>{const i=frequency==='A'?({'2014':0,'2019':0,'2021':1,'2022':1,'2025':2}[p]):slot;return ['KAZ','KGZ'].flatMap((h,j)=>[obs(p,h,'M','WORLD',product,100*(i+1)),obs(p,h,'X','RUS',product,20*(i+1)),obs(p,h,'M','DEU',product,60*(i+1)),obs(p,h,'M','CHN',product,40*(i+1)),obs(p,h,'M','WORLD','84',20*(i+1)**2),obs(p,h,'M','WORLD','85',10*(i+1)),obs(p,h,'X','RUS','84',5*(i+1)**2)]);})});
test.beforeEach(async({page})=>{
 await page.route('**/api/v1/trade/russia-aggregate?**',route=>{const u=new URL(route.request().url());return route.fulfill({json:{data:sample(u.searchParams.get('frequency'),u.searchParams.get('product'))}});});
 await page.route('**/data/world-map.v1.json',route=>route.fulfill({json:{viewBox:'0 0 1000 600',locations:[{id:'de',path:'M100 200h40v40h-40z'},{id:'cn',path:'M600 350h80v60h-80z'},{id:'kg',path:'M520 350h20v20h-20z'},{id:'kz',path:'M450 300h80v60h-80z'},{id:'ru',path:'M700 100h150v100h-150z'}]}}));
});
test('defaults to annual all suppliers and both hubs even from an old country-pair link',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en&exporter=DEU&via=KAZ&product=854231&period=202604');await expect(page.locator('#rt-month')).toHaveText('2025');await expect(page.locator('#rt-product')).toHaveValue('TOTAL');await expect(page.locator('.rt-leg')).toHaveCount(2);await expect(page.locator('#rt-suppliers tbody tr')).toHaveCount(2);await expect(page.locator('[data-edge]')).toHaveCount(6);await expect(page).toHaveURL(/frequency=A/);expect(new URL(page.url()).searchParams.has('exporter')).toBe(false);
});
test('monthly gaps stay missing and annual history remains one click away',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en');await expect(page.locator('#rt-month')).toHaveText('2025');await page.locator('[data-frequency=M]').click();await expect(page.locator('#rt-month')).toHaveText('Mar 2024');await page.locator('#rt-prev').click();await expect(page.locator('#rt-month')).toHaveText('Feb 2024');await expect(page.locator('.rt-leg strong')).toHaveText(['—','—','—','—']);await page.locator('[data-chapter=before]').click();await expect(page.locator('#rt-month')).toHaveText('2019');
});
test('map keyboard, touch, Escape and chart table use the same values',async({page,isMobile})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en&period=2019');const mark=page.locator('[data-edge="0"]');await mark.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-edge="1"]')).toBeFocused();await expect(page.locator('.psd-route-detail')).toContainText('40 USD');await page.keyboard.press('Escape');await expect(page.locator('.psd-route-detail')).toContainText('Separate declarations');
 await page.locator('#rt-map').scrollIntoViewIfNeeded();const point=await page.locator('[data-edge="5"] .psd-route-hit').evaluate(path=>{const p=path.getPointAtLength(path.getTotalLength()*.65);const q=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());return {x:q.x,y:q.y};});if(isMobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);await expect(page.locator('.psd-route-detail')).toContainText('20 USD');await page.locator('#rt-trend-wrapper [data-action="table"]').click();await expect(page.locator('#rt-trend-wrapper .psd-chart-panel')).toContainText('2019');
});
test('playback advances annual frames and pauses',async({page})=>{await page.clock.install();await page.goto('/deep-dives/russia-trade/?lang=en&period=2019');await expect(page.locator('#rt-play')).toBeEnabled();await page.locator('#rt-play').click();await page.clock.runFor(1600);await expect(page.locator('#rt-month')).toHaveText('2021');await page.locator('#rt-play').click();await page.clock.runFor(3000);await expect(page.locator('#rt-month')).toHaveText('2021');});
test('failed replacement clears stale evidence and offers retry',async({page})=>{await page.goto('/deep-dives/russia-trade/?lang=en');await expect(page.locator('.rt-leg')).toHaveCount(2);await page.route('**/api/v1/trade/russia-aggregate?**',r=>r.fulfill({status:503,json:{error:'offline'}}));await page.locator('#rt-product').selectOption('84');await expect(page.locator('#rt-status')).toContainText('could not be loaded');await expect(page.locator('#rt-legs')).toBeEmpty();await expect(page.locator('#rt-retry')).toBeVisible();await expect(page.locator('#rt-play')).toBeDisabled();});
test('Czech view and narrow layout remain usable',async({page})=>{await page.goto('/deep-dives/russia-trade/?lang=cs');await expect(page.locator('h1')).toContainText('Obchod si hledá');await expect(page.locator('#rt-month')).toHaveText('2025');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);});

test('category stacks show annual dollar values, fixed groups and separate onward exports',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en');
 await expect(page.locator('#rt-growth-year')).toHaveValue('2025');
 await expect(page.locator('#rt-growth-KAZ [data-chart-component="stacked"]')).toBeVisible();
 await expect(page.locator('#rt-growth-KAZ')).toHaveAttribute('data-chart-slug','russia-category-growth-kaz');
 await expect(page.locator('#rt-growth-KGZ')).toHaveAttribute('data-chart-slug','russia-category-growth-kgz');
 await expect(page.locator('#rt-growth-key-KAZ')).toContainText('Machinery');
 await page.locator('#rt-growth-KAZ [data-action="table"]').click();
 await expect(page.locator('#rt-growth-KAZ .psd-chart-panel')).toContainText('180');
 await expect(page.locator('#rt-growth-KAZ .psd-chart-panel')).toContainText('90');
 await page.locator('#rt-growth-flow').selectOption('X');
 await expect(page.locator('#rt-growth-key-KAZ')).toContainText('Machinery');
 await page.locator('#rt-growth-KAZ [data-action="table"]').click();
 await expect(page.locator('#rt-growth-KAZ .psd-chart-panel')).toContainText('45');
 await page.locator('[data-frequency=M]').click();
 await expect(page.locator('#rt-month')).toHaveText('Mar 2024');
 await expect(page.locator('#rt-growth-year')).toHaveValue('2025');
 await page.locator('#rt-growth-base').selectOption('2014');
 await page.locator('#rt-growth-year').selectOption('2021');
 await expect(page.locator('#rt-growth-status')).toContainText('2014 → 2021');
 await expect(page.locator('#rt-growth-key-KAZ')).toContainText('against 2014');
});

test('research supplier chart preserves annual reporting side and country shortcuts',async({page})=>{
 await page.route('**/api/v1/trade/russia-aggregate?**',route=>{const u=new URL(route.request().url()),data=sample(u.searchParams.get('frequency'),u.searchParams.get('product'));data.suppliers=['2019','2022','2025'].flatMap((period,i)=>['KOR','GEO','DEU','TUR','ITA'].map((reporter_iso3,j)=>({period,reporter_iso3,partner_iso3:'KGZ',value_usd:100*(i+1)*(j+1)})));return route.fulfill({json:{data}});});
 await page.goto('/deep-dives/russia-trade/?lang=en');
 await expect(page.locator('#rt-lead-chart')).toHaveAttribute('data-chart-slug','russia-research-suppliers');
 await expect(page.locator('#rt-lead-values')).toContainText('South Korea');
 await expect(page.locator('#rt-lead-status')).toContainText('Annual exporter declarations');
 await page.locator('#rt-lead-chart [data-action="table"]').click();
 await expect(page.locator('#rt-lead-chart .psd-chart-panel')).toContainText('2019');
 await page.getByRole('button',{name:'Find Georgia',exact:true}).click();
 await expect(page.locator('#rt-search')).toHaveValue('GEO');
 await expect(page.locator('#rt-suppliers tbody tr')).toHaveCount(1);
 await page.locator('[data-frequency=M]').click();
 await expect(page.locator('#rt-lead-status')).toContainText('Annual exporter declarations');
 await expect(page.locator('#rt-lead-chart')).toHaveAttribute('data-chart-slug','russia-research-suppliers');
});
