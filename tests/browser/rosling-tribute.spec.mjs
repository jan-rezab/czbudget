import {test,expect} from '@playwright/test';

async function fixtures(page,{delay=0}={}){
  const years=Array.from({length:10},(_,i)=>2015+i),series=(from,step)=>years.map((year,i)=>({year,value:from+i*step}));
  const health={schema_version:'fixture',generated_at:'2026-09-08',countries:Object.fromEntries(['CZE','USA'].map((code,i)=>[code,{spending:{per_capita_ppp:{value:5000+i*6000,year:2024,series:series(3000+i*6000,100)},out_of_pocket_pct:{value:15,year:2024,series:series(16,-.1)}},outcomes:{life_expectancy_years:{value:80-i*3,year:2024,series:series(78-i*3,.2)},under5_mortality_per_1000:{value:3+i*2,year:2024,series:series(4+i*2,-.1)},premature_ncd_mortality_pct:{series:series(12,-.1)},suicide_rate_per_100k:{series:series(10,-.1)}},workforce:{physicians_per_1000:{value:4,year:2022,series:series(3,.1)},nurses_per_1000:{value:9,year:2023,series:series(8,.1)}}}]))};
  const sovereign={dataset_id:'fixture-sovereign',generated_at:'2026-09-08',source:{url:'https://example.org/imf-ppppc'},countries:['CZE','USA'].map(country_code=>({country_code})),series:['CZE','USA'].map((country_code,i)=>({country_code,metrics:{gdp_per_capita_ppp:{values:series(30000+i*20000,1000).map(r=>({...r,status:'estimate'}))}}}))};
  const pressure={contract:'fixture-wpp',generated_at:'2026-09-08',sources:{un_wpp:{url:'https://example.org/wpp'}},countries:Object.fromEntries(['CZE','USA'].map((code,i)=>[code,{wpp:Array.from({length:74},(_,j)=>({year:1950+j,kind:'estimate',population_thousands:10000+i*200000,total_fertility_rate:3-j*.02}))}]))};
  const oecd={dataset_id:'fixture-oecd',generated_at:'2026-09-08',countries:Object.fromEntries(['CZE','USA'].map(code=>[code,{distribution:{market_gini:{value:.429,year:2023},disposable_gini:{value:.242,year:2023},poverty_rate:{value:5.517,year:2023}},wellbeing:{pisa_math:{value:488.6,year:2022},housing_cost_overburden:{value:6.414,year:2024}}}]))};
  const distribution=Object.fromEntries(['total','male','female'].map((sex,i)=>[sex,Object.fromEntries(['all','regular','early'].map(kind=>[kind,{count:100,mean:21094+i*1000,median_band:{lower:21000,upper:21499},bands:[{lower:1,upper:4999,count:10},{lower:5000,upper:9999,count:20},{lower:10000,upper:null,count:70}]}]))]));
  const pensions={extracted_at:'2026-09-08',sources:{cssz:{url:'https://example.org/cssz',table:'07.03'}},countries:{CZE:{national:{date:'2025-12-31',distribution}}}};
  const source={dataset:'Official national projection',url:'https://example.org/projection'};
  const demography={contract:'fixture-demography',generated_at:'2026-09-08',countries:Object.fromEntries(['CZE','USA'].map(code=>[code,{projection:'Middle variant',reference_date:'1 January',detail:`data/countries/${code.toLowerCase()}/demography.v1.json`,years:Array.from({length:21},(_,i)=>({year:2025+i,total:1000000+i*1000,old_age_dependency_per_100_working_age:30+i}))}]))};
  const detail={contract:'fixture-detail',generated_at:'2026-09-08',source,rows:Array.from({length:21},(_,i)=>[[2025+i,0,0,10000,11000,21000],[2025+i,1,1,10000,11000,21000],[2025+i,100,null,100+i,200+i,300+2*i]]).flat()};
  const systems={countries:Object.fromEntries(['CZE','USA'].map(code=>[code,{architecture_en:'Documented health insurance system.',architecture_cs:'Doložený systém zdravotního pojištění.',official_url:'https://example.org/health',official_title:'Official health system'}]))};
  const data={'/lib/data/sovereign-benchmark.v1.json':sovereign,'/data/country-health-performance.v1.json':health,'/data/europe-demographic-pressure.v1.json':pressure,'/data/oecd-key-metrics.v1.json':oecd,'/data/pensions-today.v1.json':pensions,'/data/country-demography.v1.json':demography,'/data/country-health.v1.json':systems,'/data/countries/cze/demography.v1.json':detail,'/data/countries/usa/demography.v1.json':detail};
  for(const [path,payload] of Object.entries(data))await page.route(`**${path}`,async route=>{if(delay)await new Promise(r=>setTimeout(r,delay));await route.fulfill({json:payload});});
}
const ready=page=>expect(page.locator('#rosling-stage')).toHaveAttribute('aria-busy','false');

test('all seven educational views work with tables, source rails and attribution',async({page})=>{
  await fixtures(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/deep-dives/rosling/?lang=en');await ready(page);
  await expect(page.locator('#rosling-health-wealth [data-chart-component]')).toHaveAttribute('data-chart-component','scatter');
  await page.locator('#rosling-health-wealth [data-action=table]').click();await expect(page.locator('#rosling-health-wealth .psd-chart-table')).toContainText('estimate');
  await page.locator('[data-view=spending]').click();await ready(page);await page.locator('#rosling-outcome').selectOption('under5_mortality_per_1000');await expect(page.locator('#rosling-spending-outcomes')).toContainText('Under-five');
  await page.locator('[data-view=distribution]').click();await ready(page);await expect(page.locator('#rosling-payment-distribution')).toContainText('standalone');
  await page.locator('#rosling-sex').selectOption('male');await ready(page);await expect(page.locator('.rosling-stat-row')).toContainText('22,094');
  await page.locator('#rosling-distribution-mode').selectOption('inequality');await ready(page);await page.locator('#rosling-income-inequality [data-action=table]').click();await expect(page.locator('#rosling-income-inequality .psd-chart-table')).toContainText('2023');
  await page.locator('[data-view=population]').click();await ready(page);await expect(page.locator('#rosling-population-pyramid [data-chart-component]')).toHaveAttribute('data-chart-component','pyramid');
  await page.locator('#rosling-year').evaluate(el=>{el.value='2040';el.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('#rosling-population-summary')).toContainText('2040');
  await page.locator('[data-view=progress]').click();await ready(page);await expect(page.locator('.rosling-grid [data-chart-slug]')).toHaveCount(4);
  await page.locator('[data-view=services]').click();await ready(page);await expect(page.locator('.rosling-service')).toHaveCount(3);await expect(page.getByRole('link',{name:'Visit real homes on Dollar Street ↗'})).toHaveAttribute('href','https://www.gapminder.org/dollar-street');
  await page.locator('[data-view=quiz]').click();await ready(page);await page.locator('[data-answer="0"]').click();await expect(page.locator('#rosling-quiz-reveal')).toBeVisible();await expect(page.locator('#rosling-quiz-evidence')).toBeVisible();
  await expect(page.locator('#rosling-credits')).toContainText('Ola Rosling');await expect(page.locator('#rosling-credits')).toContainText('Anna Rosling Rönnlund');expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('bubble keyboard, Escape, population table and URL restore use the same values',async({page})=>{
  await fixtures(page);await page.goto('/deep-dives/rosling/?lang=en&view=journey&country=USA&year=2018');await ready(page);
  const hit=page.locator('#rosling-health-wealth [data-point]').first();await hit.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#rosling-health-wealth .psd-plot-tooltip')).toContainText('United States');await page.keyboard.press('Escape');await expect(page.locator('#rosling-health-wealth .psd-plot-tooltip')).toBeHidden();
  await page.locator('[data-view=population]').click();await ready(page);await page.locator('#rosling-population-pyramid [data-action=table]').click();await expect(page.locator('#rosling-population-pyramid .psd-chart-table')).toContainText('100+');await expect(page.locator('#rosling-population-pyramid .psd-chart-table')).toContainText('20000');
  await page.reload();await ready(page);await expect(page.locator('[data-view=population]')).toHaveAttribute('aria-current','page');await expect(page.locator('#rosling-country')).toHaveValue('USA');
});

test('slow old view cannot overwrite the latest selection and Czech copy remains available',async({page})=>{
  await fixtures(page,{delay:200});await page.goto('/deep-dives/rosling/?lang=cs');
  await page.locator('[data-view=population]').click();await page.locator('[data-view=services]').click();await ready(page);
  await expect(page.locator('#rosling-stage h2')).toHaveText('Co služby znamenají pro lidi?');await expect(page.locator('#rosling-credits')).toContainText('Pocta Hansi Roslingovi');await expect(page.locator('.rosling-service')).toHaveCount(3);
});

test('failed source load keeps selection and retry recovers',async({page})=>{
  await fixtures(page);let failed=true;
  await page.route('**/data/country-health-performance.v1.json',route=>failed?route.fulfill({status:503,body:'Unavailable'}):route.fallback());
  await page.goto('/deep-dives/rosling/?lang=en&view=progress&country=USA');await expect(page.locator('.rosling-error')).toBeVisible();await expect(page.locator('#rosling-country')).toHaveValue('USA');failed=false;await page.locator('#rosling-retry').click();await ready(page);await expect(page.locator('.rosling-grid [data-chart-slug]')).toHaveCount(4);
});

test('guided stories, population blocks, time reveal and equal-mean lesson work',async({page})=>{
  await fixtures(page);await page.goto('/deep-dives/rosling/?lang=en');await ready(page);
  await expect(page.locator('.rosling-chapters button')).toHaveCount(3);
  await page.locator('[data-chapter="0"]').click();await expect(page.locator('#rosling-year-value')).toHaveText('2015');
  await expect(page.locator('.psd-plot-year')).toHaveText('2015');
  await page.locator('.rosling-present').click();await expect(page.locator('body')).toHaveClass(/rosling-presenting/);await expect(page).toHaveURL(/present=1/);
  await page.keyboard.press('Escape');await expect(page.locator('body')).not.toHaveClass(/rosling-presenting/);
  await page.locator('[data-view=population]').click();await ready(page);
  await expect(page.locator('#rosling-cohort-blocks .psd-plot-unit-block')).toHaveCount(6);
  for(let i=0;i<3;i++)await page.locator('#rosling-block-next').click();
  await expect(page.locator('#rosling-block-total')).toContainText('total 12');await expect(page.locator('#rosling-block-next')).toBeDisabled();
  await page.locator('[data-chapter="2"]').click();await expect(page.locator('#rosling-cohort-blocks .psd-plot-unit-block')).toHaveCount(12);
  await page.locator('#rosling-cohort-blocks [data-action=table]').click();await expect(page.locator('#rosling-cohort-blocks .psd-chart-table')).toContainText('4');
  await page.locator('[data-view=services]').click();await ready(page);
  await expect(page.locator('#rosling-time-result')).toBeHidden();await page.locator('#rosling-time-reveal').click();await expect(page.locator('#rosling-time-result')).toContainText('3.33');
  await page.locator('#rosling-manual').evaluate(el=>{el.value='10';el.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('#rosling-time-result strong')).toContainText('0 hours');
  await page.locator('[data-view=distribution]').click();await ready(page);await page.locator('#rosling-share-switch').click();await expect(page.locator('#rosling-share-summary')).toContainText('Mean: 2');
  await page.locator('#rosling-same-average [data-action=table]').click();await expect(page.locator('#rosling-same-average .psd-chart-table')).toContainText('0.5');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
