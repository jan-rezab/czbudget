import { test, expect } from '@playwright/test';

test('shared references, selected period and row colors preserve page semantics',async({page})=>{
  await page.goto('/tests/fixtures/charts/?type=line');
  await page.evaluate(()=>window.PSDPlot.render(document.querySelector('#plot'),{type:'line',rows:[{label:'2024',value:1.9},{label:'2025',value:2.3}],fields:[{key:'value',label:'Fertility'}],referenceLines:[{value:2.1,label:'Replacement'}],selectedLabel:'2025'}));
  await expect(page.locator('#plot .psd-plot-reference-label')).toHaveText('Replacement');
  await expect(page.locator('#plot .psd-plot-selected-label')).toHaveText('2025');
  await page.evaluate(()=>window.PSDPlot.render(document.querySelector('#plot'),{type:'bar',rows:[{label:'A',value:10,selected:true},{label:'B',value:20}],fields:[{key:'value',label:'Value'}],rowColor:row=>row.selected?'#c93237':undefined}));
  await expect(page.locator('#plot rect[fill="#c93237"]')).toHaveCount(1);
});

for (const type of ['line', 'column', 'stacked', 'bar']) {
  test(`${type}: hover, keyboard, dismissal, missing values and safe rerender`, async ({ page }) => {
    await page.goto(`/tests/fixtures/charts/?type=${type}`);
    const plot = page.locator('#plot'), hits = plot.locator('[data-point]'), tooltip = plot.locator('.psd-plot-tooltip');
    await expect(plot).toHaveAttribute('data-chart-component', type);
    await hits.first().hover(); await expect(tooltip).toContainText('100 EUR');
    const figure=page.locator('#chart-object');
    await figure.locator('[data-action="table"]').click();
    await expect(figure.locator('.psd-chart-table')).toContainText('2022');
    await expect(figure.locator('.psd-chart-table')).toContainText('100');
    expect(await page.evaluate(()=>window.chartObject.csv())).toContain('2022,100,70');
    await figure.locator('[data-action="table"]').click();
    await hits.first().focus(); await page.keyboard.press('ArrowRight');
    await expect(tooltip).toContainText('2023'); await expect(tooltip).toContainText('—');
    await page.keyboard.press('End'); await expect(tooltip).toContainText('-20 EUR');
    await page.keyboard.press('Escape'); await expect(tooltip).toBeHidden();
    await hits.first().click(); await expect(tooltip).toBeVisible();
    await page.getByRole('heading').click(); await expect(tooltip).toBeHidden();
    await expect(page.locator('body')).not.toHaveJSProperty('scrollWidth', 0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await page.evaluate(() => window.PSDPlot.render(document.querySelector('#plot'), {rows:[{year:'<script>bad</script>',v:5}],fields:[{key:'v',label:'<img src=x onerror=alert(1)>'}],onSelect:row=>{document.body.dataset.selectedValue=String(row.v);}}));
    await plot.locator('[data-point]').focus();
    await expect(plot.locator('img,script')).toHaveCount(0);
    await expect(plot.locator('.psd-plot-tooltip')).toContainText('<script>bad</script>');
    await page.setViewportSize({width:600,height:800});
    await plot.locator('[data-point]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-selected-value','5');
  });
}

test('municipal profile adapter uses the shared renderer without losing original values', async ({ page }) => {
  await page.route('**/fixture-profile.json', route => route.fulfill({json:{country:'DNK',code:'fixture',name:'Fixture municipality',currency:'DKK',source_url:'https://example.org/source',years:[2024,2025],history:[{year:2024,revenue:100,expenditure:90,cash:25},{year:2025,revenue:150,expenditure:140,cash:30}],detail:[]}}));
  await page.route('**/data/**', route => route.fulfill({status:404,body:'No fixture'}));
  await page.goto('/tests/fixtures/charts/profile.html?lang=en');
  const plot=page.locator('#profile-history-chart');
  await expect(plot).toHaveAttribute('data-chart-component','line');
  await expect(plot.locator('.psd-plot-line')).toHaveCount(3);
  await plot.locator('[data-point]').last().focus();
  await expect(plot.locator('.psd-plot-tooltip')).toContainText('150');
  await expect(page.locator('h1')).toHaveText('Fixture municipality');
});

test('Czech history adapter shares line and composition primitives and retains its table',async({page})=>{
  await page.route('**/fixture-history.json',route=>route.fulfill({json:{cities:[{national_id:'fixture',name:'Fixture city',series:[2024,2025].map(year=>({year,revenue_actual:2500000,expense_actual:2000000,cash_current:500000,budget_balance:500000,revenue_approved:2000000,revenue_adjusted:2300000,tax_revenue:1500000,transfer_revenue:500000,nontax_revenue:300000,capital_revenue:200000,current_expense:1500000,capital_expense:500000,population_mid_year:1000,expense_per_capita:2000}))}]}}));
  await page.goto('/tests/fixtures/charts/czech-history.html?lang=en');
  const chart=page.locator('#history-chart');
  await expect(chart).toHaveAttribute('data-chart-component','line');
  await expect(chart.locator('.psd-plot-line')).toHaveCount(3);
  await page.getByRole('tab',{name:'Plan vs actual'}).click();
  await expect(chart.locator('.psd-plot-line')).toHaveCount(3);
  await page.getByRole('tab',{name:'Budget structure'}).click();
  await expect(chart).toHaveAttribute('data-chart-component','stacked');
  await chart.locator('[data-point]').first().focus();
  await expect(chart.locator('.psd-plot-tooltip')).toContainText('60%');
  await expect(page.locator('#history-table-body tr')).toHaveCount(2);
});
