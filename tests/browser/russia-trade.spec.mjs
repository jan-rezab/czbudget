import { test, expect } from '@playwright/test';
const obs=(period,hub,flow,partner,product,value)=>({period,reporter_iso3:hub,flow_code:flow,partner_iso3:partner,partner_area_code:partner==='WORLD'?0:1,product_code:product,value_usd:value,reported_value_usd:String(value),product_count:1,classifications:'H6',release_ids:'synthetic'});
const sample=(frequency='A',product='TOTAL')=>({view_id:'synthetic-published-report',frequency,product,countries:[{iso3:'DEU',iso2:'de',name:'Germany'},{iso3:'CHN',iso2:'cn',name:'China'}],source:{url:'https://comtradeplus.un.org/',table:'synthetic',release_ids:['synthetic'],method:'Synthetic fixture',release_note:'Test only'},suppliers:[],observations:(frequency==='A'?['2014','2019','2021','2022','2025']:['202401','202403']).flatMap((p,slot)=>{const i=frequency==='A'?({'2014':0,'2019':0,'2021':1,'2022':1,'2025':2}[p]):slot;return ['KAZ','KGZ'].flatMap((h,j)=>[obs(p,h,'M','WORLD',product,100*(i+1)),obs(p,h,'X','RUS',product,20*(i+1)),obs(p,h,'M','DEU',product,60*(i+1)),obs(p,h,'M','CHN',product,40*(i+1)),obs(p,h,'M','WORLD','84',20*(i+1)**2),obs(p,h,'M','WORLD','85',10*(i+1)),obs(p,h,'X','RUS','84',5*(i+1)**2)]);})});
const bilateralSample=(country='CHN')=>({frequency:'A',product:'TOTAL',country,suppliers:[],source:sample().source,observations:country==='PRK'?[]:['2014','2019','2021','2024'].flatMap((year,i)=>[obs(year,country,'X','RUS','TOTAL',100*(i+1)),obs(year,country,'M','RUS','TOTAL',200*(i+1)),obs(year,country,'X','RUS','87',20*(i+1)**2),obs(year,country,'M','RUS','27',30*(i+1)**2)])});
test.beforeEach(async({page})=>{
 await page.route('**/api/v1/trade/russia-bilateral?**',route=>route.fulfill({json:{data:bilateralSample(new URL(route.request().url()).searchParams.get('country'))}}));
 await page.route('**/api/v1/trade/russia-report?**',route=>{const u=new URL(route.request().url());return route.fulfill({json:{data:sample(u.searchParams.get('frequency'),u.searchParams.get('product'))}});});
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
test('failed replacement clears stale evidence and offers retry',async({page})=>{await page.goto('/deep-dives/russia-trade/?lang=en');await expect(page.locator('.rt-leg')).toHaveCount(2);await page.route('**/api/v1/trade/russia-report?**',r=>r.fulfill({status:503,json:{error:'offline'}}));await page.locator('#rt-product').selectOption('84');await expect(page.locator('#rt-status')).toContainText('could not be loaded');await expect(page.locator('#rt-legs')).toBeEmpty();await expect(page.locator('#rt-retry')).toBeVisible();await expect(page.locator('#rt-play')).toBeDisabled();});
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
 await page.route('**/api/v1/trade/russia-report?**',route=>{const u=new URL(route.request().url()),data=sample(u.searchParams.get('frequency'),u.searchParams.get('product'));data.suppliers=['2019','2022','2025'].flatMap((period,i)=>['KOR','GEO','DEU','TUR','ITA'].map((reporter_iso3,j)=>({period,reporter_iso3,partner_iso3:'KGZ',value_usd:100*(i+1)*(j+1)})));return route.fulfill({json:{data}});});
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

test('supplier inspection stays below the plot and does not move it during keyboard navigation',async({page})=>{
 await page.route('**/api/v1/trade/russia-report?**',route=>{const data=sample();data.suppliers=['2019','2025'].flatMap((period,i)=>['KOR','GEO','DEU','TUR','ITA'].map(reporter_iso3=>({period,reporter_iso3,partner_iso3:'KGZ',value_usd:100*(i+1)})));return route.fulfill({json:{data}});});
 await page.goto('/deep-dives/russia-trade/?lang=en');
 const host=page.locator('#rt-lead-chart'),tip=host.locator('.psd-plot-tooltip');
 await host.locator('[data-point]').first().focus();await expect(tip).toBeVisible();
 // Keyboard focus can smooth-scroll this long page. Compare both elements in one
 // frame and measure plot movement inside its host, independently of page scroll.
 const layout=()=>host.evaluate(el=>{const h=el.getBoundingClientRect(),p=el.querySelector('svg').getBoundingClientRect(),t=el.querySelector('.psd-plot-tooltip').getBoundingClientRect();return {plot:{x:p.x-h.x,y:p.y-h.y,width:p.width,height:p.height},gap:t.y-p.bottom};});
 const before=await layout();expect(before.gap).toBeGreaterThanOrEqual(0);
 await page.keyboard.press('ArrowRight');await expect(tip.locator('strong')).toHaveText('2020');
 await expect(tip).toContainText('—'); // Missing years remain selectable gaps.
 expect((await layout()).plot).toEqual(before.plot);
 await page.keyboard.press('End');await expect(tip.locator('strong')).toHaveText('2025');
 expect((await layout()).gap).toBeGreaterThanOrEqual(0);expect((await layout()).plot).toEqual(before.plot);
 await page.keyboard.press('Escape');await expect(tip).toBeHidden();expect((await layout()).plot).toEqual(before.plot);
});

test('map defaults to major suppliers and can reveal all without changing the evidence table',async({page})=>{
 const countries=Array.from({length:15},(_,i)=>({iso3:'AA'+String.fromCharCode(65+i),iso2:'a'+i,name:'Supplier '+i}));
 await page.route('**/api/v1/trade/russia-report?**',route=>{const data=sample();data.countries=countries;data.observations=data.observations.filter(o=>Number(o.partner_area_code)===0||o.flow_code==='X');data.observations.push(...countries.flatMap((c,i)=>['KAZ','KGZ'].map(h=>obs('2019',h,'M',c.iso3,'TOTAL',i+1))));return route.fulfill({json:{data}});});
 await page.route('**/data/world-map.v1.json',route=>route.fulfill({json:{viewBox:'0 0 1000 600',locations:[...countries.map((c,i)=>({id:c.iso2,path:`M${50+i*20} 100h10v10h-10z`})),{id:'kz',path:'M450 300h80v60h-80z'},{id:'kg',path:'M520 350h20v20h-20z'},{id:'ru',path:'M700 100h150v100h-150z'}]}}));
 await page.goto('/deep-dives/russia-trade/?lang=en&frequency=A&product=TOTAL&period=2019');
 await expect(page.locator('#rt-map-detail')).toHaveValue('major');await expect(page.locator('[data-edge]')).toHaveCount(18);await expect(page.locator('#rt-suppliers tbody tr')).toHaveCount(15);await expect(page.locator('#rt-map-coverage')).toContainText('16 of 30');
 await page.locator('#rt-map-detail').selectOption('all');await expect(page.locator('[data-edge]')).toHaveCount(32);await expect(page.locator('#rt-suppliers tbody tr')).toHaveCount(15);await expect(page).toHaveURL(/map=all/);
});


test('bilateral comparison switches direction, ranks categories and preserves a prewar baseline in the URL',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en');
 await expect(page.locator('#rt-bilateral-status')).toContainText('2014–2024');
 await expect(page.locator('#rt-bilateral-values')).toContainText('Vehicles');
 await expect(page.locator('#rt-bilateral-history')).toHaveAttribute('data-chart-slug','russia-bilateral-history');
 await page.locator('#rt-bilateral-flow').selectOption('M');
 await expect(page.locator('#rt-bilateral-values')).toContainText('Mineral fuels');
 await page.locator('#rt-bilateral-base').selectOption('2014');
 await page.locator('#rt-bilateral-year').selectOption('2021');
 await expect(page.locator('#rt-bilateral-status')).toContainText('2014 → 2021');
 await expect(page).toHaveURL(/bilateral_base=2014/);await expect(page).toHaveURL(/bilateral_flow=M/);
 await page.locator('#rt-bilateral-stack [data-action="table"]').click();
 await expect(page.locator('#rt-bilateral-stack .psd-chart-panel')).toContainText('2015');
 await page.reload();await expect(page.locator('#rt-bilateral-flow')).toHaveValue('M');await expect(page.locator('#rt-bilateral-base')).toHaveValue('2014');await expect(page.locator('#rt-bilateral-year')).toHaveValue('2021');
});
test('absent country declarations clear both charts and do not imply zero or missing arms transfers',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en');
 await expect(page.locator('#rt-bilateral-history svg')).toHaveCount(1);
 await page.locator('#rt-bilateral-country').selectOption('PRK');
 await expect(page.locator('#rt-bilateral-title')).toContainText('North Korea');
 await expect(page.locator('#rt-bilateral-status')).toContainText('Missing data is not zero');
 await expect(page.locator('#rt-bilateral-history')).toBeEmpty();await expect(page.locator('#rt-bilateral-stack')).toBeEmpty();await expect(page.locator('#rt-bilateral-values')).toBeEmpty();
 await expect(page.locator('#bilateral')).toContainText('MSMT');
 await page.locator('#rt-bilateral-country').selectOption('CHN');await expect(page.locator('#rt-bilateral-history svg')).toHaveCount(1);
});
test('direct supplier growth ranking keeps declines and uses country buttons to open a bilateral view',async({page})=>{
 await page.route('**/api/v1/trade/russia-report?**',route=>{const data=sample();data.suppliers=[['CHN','2019',10],['CHN','2024',30],['KOR','2019',10],['KOR','2024',5]].map(([reporter_iso3,period,value_usd])=>({reporter_iso3,period,value_usd,partner_iso3:'RUS'}));return route.fulfill({json:{data}});});
 await page.goto('/deep-dives/russia-trade/?lang=en');
 await expect(page.locator('#rt-direct-year')).toHaveValue('2024');
 await expect(page.locator('#rt-direct-rank tbody tr')).toHaveCount(2);
 await expect(page.locator('#rt-direct-rank tbody tr').last()).toContainText('-50%');
 await page.locator('#rt-direct-rank [data-bilateral="KOR"]').click();
 await expect(page.locator('#rt-bilateral-title')).toContainText('South Korea');
 await expect(page).toHaveURL(/bilateral=KOR/);
});

test('delta story separates gross positive composition, declines and the net using one year',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en&story_year=2024');
 await expect(page.locator('#rt-story-status')).toContainText('2019 → 2024');
 await expect(page.locator('#rt-story-X-donut [data-chart-component="donut"]')).toBeVisible();
 await expect(page.locator('#rt-story-X-copy')).toContainText('Donut share = category increase');
 await expect(page.locator('#rt-story-X-balance')).toContainText('Net change in observed basket');
 await page.locator('#rt-story-X-donut [data-point="0"]').focus();await expect(page.locator('#rt-story-X-donut .psd-plot-tooltip')).toContainText('100%');
 await page.keyboard.press('Escape');await expect(page.locator('#rt-story-X-donut .psd-plot-tooltip')).toBeHidden();
 await page.locator('#rt-story-X-donut [data-action="table"]').click();await expect(page.locator('#rt-story-X-donut .psd-chart-panel')).toContainText('240');
 await page.locator('[data-frequency=M]').click();await expect(page.locator('#rt-month')).toHaveText('Mar 2024');await expect(page.locator('#rt-story-status')).toContainText('2019 → 2024');
 await page.locator('#rt-story-country').selectOption('PRK');await expect(page.locator('#rt-story-country-title')).toContainText('North Korea');await expect(page.locator('#rt-story-X-donut svg')).toHaveCount(0);await expect(page.locator('#rt-story-X-balance')).toContainText('— USD');
});
test('story keeps the selected common year and exposes missing latest country endpoints',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en&story_year=2025');
 await expect(page.locator('#rt-story-year')).toHaveValue('2025');await expect(page.locator('#rt-story-X-copy')).toContainText('missing: 87');
 await expect(page.locator('#rt-story-X-donut svg')).toHaveCount(0);
 await page.locator('#rt-story-year').selectOption('2024');await expect(page.locator('#rt-story-X-donut svg')).toHaveCount(1);await expect(page).toHaveURL(/story_year=2024/);
});

test('complete delta CSV keeps all categories and missing coverage with exact endpoints',async({page})=>{
 await page.goto('/deep-dives/russia-trade/?lang=en&story_year=2024');await expect(page.locator('#rt-story-download')).toBeEnabled();const downloading=page.waitForEvent('download');await page.locator('#rt-story-download').click();const file=await (await downloading).path();const csv=await (await import('node:fs/promises')).readFile(file,'utf8');expect(csv).toContain('comparison_status');expect(csv).toContain('category,87,CHN,X,2019,2024,current USD,80,320,240,paired');expect(csv).toContain('observed_basket,TOTAL,CHN,M');expect(csv).toContain('hub_route,WORLD_IMPORTS,KAZ,M');
});
