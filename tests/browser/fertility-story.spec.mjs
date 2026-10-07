import {test,expect} from '@playwright/test';
const route='/stories/the-world-is-having-fewer-children/';
test('worldwide story provides bilingual charts, exact tables, filters and persistent comparisons',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // The component gate serves static assets only. Exercise the adapter with a
  // deterministic response, just as other API-backed component tests do.
  await page.route('**/api/v1/demography/worldwide',r=>r.fulfill({json:fertilityFixture()}));
  await page.goto(route+'?lang=en');
  await expect(page.locator('#fertility-story')).toHaveAttribute('data-ready','true');
  await expect(page.locator('#fertility-story [data-chart-slug]')).toHaveCount(8);
  await page.locator('#world-fertility [data-action="table"]').click();
  await expect(page.locator('#world-fertility .psd-chart-panel')).toContainText('2.18831256131236');
  await page.locator('#fertility-search input').fill('Czech');
  await expect(page.locator('#fertility-table tbody tr')).toHaveCount(1);
  await page.locator('#fertility-metric select').selectOption('birth_rate');
  await expect(page).toHaveURL(/metric=birth_rate/);
  await page.reload();
  await expect(page.locator('#fertility-metric select')).toHaveValue('birth_rate');
  await expect(page.locator('#fertility-search input')).toHaveValue('Czech');
  await page.locator('psd-site-header [data-lang="cs"]').click();
  await expect(page.locator('h1')).toContainText('Ve světě se rodí méně dětí');
  await expect(page.locator('#country-selection-history figcaption')).toHaveText('Vybrané historické řady · 1960–2024');
  const download=page.waitForEvent('download');await page.locator('#world-fertility [data-action="csv"]').click();expect((await download).suggestedFilename()).toBe('world-fertility.csv');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  expect(errors).toEqual([]);
});
test('story remains readable when snapshot is unavailable',async({page})=>{await page.route('**/api/v1/demography/worldwide',r=>r.fulfill({status:503,body:'{}'}));await page.goto(route+'?lang=en');await expect(page.locator('#fertility-status')).toContainText('unavailable');await expect(page.locator('#fertility-evidence')).toContainText('2.18831256131236');});

// Synthetic UI fixture only; never publish these series as source observations.
function fertilityFixture() {
  const years = Array.from({length:65}, (_, i) => 1960 + i);
  const countries = Object.fromEntries([
    ['CZE','Czechia','Europe & Central Asia'],
    ['DEU','Germany','Europe & Central Asia'],
    ['POL','Poland','Europe & Central Asia'],
    ['FRA','France','Europe & Central Asia'],
    ['KOR','Korea, Rep.','East Asia & Pacific'],
    ['IND','India','South Asia'],
    ['BRA','Brazil','Latin America & Caribbean'],
    ['NGA','Nigeria','Sub-Saharan Africa'],
  ].map(([code,name,region], index) => [code, {name,region,
    fertility:years.map((_, i) => i === 0 ? null : (1 + index / 2 + (64 - i) / 40).toFixed(4)),
    birth_rate:years.map((_, i) => i === 0 ? null : (8 + index * 3 + (64 - i) / 5).toFixed(4)),
  }]));
  return {
    schema_version:'worldwide-demography-story.v1',
    synthetic:true, release_id:'synthetic-fertility-ui',
    acquired_at:'2026-10-07T00:00:00Z', source_vintage:'Synthetic UI test',
    source_urls:{fertility:'https://example.org/synthetic-fertility',birth_rate:'https://example.org/synthetic-birth-rate'},
    years,countries,
    // The long decimal exercises the existing exact-value export assertion.
    aggregates:{WLD:{fertility:years.map(()=>'2.18831256131236'),birth_rate:years.map(()=>'16.0000')}},
    distribution:years.map((year,i) => ({year,denominator:i ? 8 : 0,
      below1:0,one_to_1_5:i ? 1 : 0,one_5_to_2_1:i ? 2 : 0,two_1_to_4:i ? 4 : 0,at_least4:i ? 1 : 0})),
  };
}
