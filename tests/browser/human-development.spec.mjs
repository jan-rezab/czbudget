import {test,expect} from '@playwright/test';
const source={url:'https://example.org/synthetic-source',vintage:'Synthetic 2026 edition',table:'Synthetic table',release_id:'synthetic-source-release'};
const base={chapter:'development',unit:'index',chart_type:'line',fields:[{key:'value',label:{en:'Index',cs:'Index'}}],source_refs:[source],method:{en:'Synthetic fixture, not published observations',cs:'Testovací příklad, nikoli publikovaná pozorování'},denominator:{en:'Synthetic denominator',cs:'Testovací základ'},original_refs:['Synthetic Figure1'],latest_period:2023};
const fixture={schema_version:'1.0.0',release_id:'569ea124-a61b-4616-ac86-9061ea684998',generated_at:'2026-09-27T00:00:00Z',source_releases:['synthetic'],geographies:[{code:'CZE',name:{en:'Czechia',cs:'Česko'}},{code:'DEU',name:{en:'Germany',cs:'Německo'}},{code:'WLD',name:{en:'World',cs:'Svět'}}],chapters:[{id:'development',title:{en:'Development',cs:'Rozvoj'}}],charts:[{...base,id:'reported-index',title:{en:'Reported index',cs:'Vykázaný index'},status:'ready',rows:[{country:'CZE',year:2022,value:0},{country:'CZE',year:2023,value:null}]},{...base,id:'global-trend',title:{en:'Global trend',cs:'Globální řada'},status:'historical',rows:[{country:'WLD',period:'2022-01',value:1.1},{country:'WLD',period:'2023-01',value:1.2}]},{...base,id:'withdrawn-study',title:{en:'Withdrawn study',cs:'Stažená studie'},status:'withdrawn',rows:[]},{...base,id:'unavailable-study',title:{en:'Unavailable study',cs:'Nedostupná studie'},status:'unavailable',rows:[]}],coverage:{source_count:1,unavailable_sources:[{id:'restricted',reason:{en:'Restricted data',cs:'Omezený přístup'}}],original_figures:4}};
async function open(page,lang='en') {
  const compact=structuredClone(fixture);
  const global=compact.charts.find(chart=>chart.id==='global-trend');
  global.row_defaults={country:'WLD'};
  global.rows=global.rows.map(({country,...row})=>row);
  await page.route('**/api/v1/human-development/reports',route=>route.fulfill({json:compact}));
  await page.goto(`/deep-dives/human-development/?lang=${lang}&code=CZE`);
}
test('uses shared charts/rails with exact zero, missing value, source vintage and gap ledger',async({page})=>{
  await open(page);
  const figure=page.locator('#human-development-reported-index'),plot=figure.locator('.hd-plot');
  await expect(plot).toHaveAttribute('data-chart-component','line');
  await expect(figure).toContainText('Latest observed period: 2022');
  await expect(figure).toContainText('Synthetic 2026 edition');
  await figure.locator('[data-action="table"]').click();
  await expect(figure.locator('.psd-chart-table')).toContainText('2022');
  await expect(figure.locator('.psd-chart-table tbody tr').first()).toContainText('0');
  await figure.locator('[data-action="table"]').click();
  await plot.locator('[data-point]').first().focus();await page.keyboard.press('ArrowRight');
  await expect(plot.locator('.psd-plot-tooltip')).toContainText('—');await page.keyboard.press('Escape');
  await expect(plot.locator('.psd-plot-tooltip')).toBeHidden();
  await figure.locator('[data-action="sources"]').click();
  await expect(figure.locator('.psd-chart-drawer')).toContainText('Synthetic denominator');
  await expect(figure.locator('[data-action="png"]')).toBeVisible();
  const download=page.waitForEvent('download');await figure.locator('[data-action="csv"]').click();
  expect((await download).suggestedFilename()).toBe('human-development-reported-index.csv');
  await expect(page.locator('#human-development-withdrawn-study .hd-plot')).toHaveCount(0);
  await expect(page.locator('#hd-coverage-content')).toContainText('Withdrawn study');
});
test('country and language changes retain global series and expose national gaps',async({page})=>{
  await open(page,'cs');await expect(page.locator('h1')).toContainText('Lidský rozvoj');
  await page.selectOption('#hd-country','DEU');await expect(page).toHaveURL(/code=DEU/);
  await expect(page.locator('#human-development-reported-index')).toContainText('Pro tuto zemi');
  await expect(page.locator('#human-development-global-trend .hd-plot')).toHaveAttribute('data-chart-component','line');
  await page.evaluate(()=>{document.documentElement.lang='en';});
  await expect(page.locator('h1')).toContainText('Human development');
  await expect(page.locator('#human-development-reported-index')).toContainText('No observations');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('a missing release shows a retry message without demonstration charts',async({page})=>{
  await page.route('**/api/v1/human-development/reports',route=>route.fulfill({status:503,json:{error:'publication pending'}}));
  await page.goto('/deep-dives/human-development/?lang=en');
  await expect(page.locator('#hd-status')).toContainText('not available yet');
  await expect(page.locator('.hd-plot')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Try again'})).toBeVisible();
});
