import test from 'node:test';
import assert from 'node:assert/strict';
import explorer from '../../lib/chart-explorer-model.js';
import chart from '../../lib/chart-renderer.js';

const fixture = {
  period: { start_year: 2020, end_year: 2024 },
  countries: [{ country_code: 'AAA', name_en: 'Alpha' }, { country_code: 'BBB', name_en: 'Beta' }],
  series: [
    { country_code: 'AAA', metrics: { expenditure_pct_gdp: { latest_actual_year: 2023, values: [{ year: 2020, value: 40.125 }, { year: 2021, value: null }, { year: 2022, value: 0 }, { year: 2023, value: 45.235 }, { year: 2024, value: 99 }] } } },
    { country_code: 'BBB', metrics: { expenditure_pct_gdp: { latest_actual_year: 2024, values: [{ year: 2021, value: 30 }, { year: 2023, value: '31' }, { year: 2024, value: 32 }] } } },
  ],
};
test('unknown URL state is bounded, deduplicated and restricted to known metrics', () => {
  const state = explorer.normalize({ start: 1990, end: 2099, year: 3000, countries: 'AAA,AAA,NOTREAL,BBB', metric: '__proto__', view: 'bad', mode: 'bad' }, fixture);
  assert.deepEqual(state, { start: 2020, end: 2024, year: 2024, countries: ['AAA', 'BBB'], metric: 'expenditure_pct_gdp', mode: 'level', view: 'line' });
});
test('estimates, missing years and numeric strings never become actual observations', () => {
  assert.equal(explorer.observation(fixture, 'AAA', 'expenditure_pct_gdp', 2024), null);
  assert.equal(explorer.observation(fixture, 'AAA', 'expenditure_pct_gdp', 2021), null);
  assert.equal(explorer.observation(fixture, 'AAA', 'expenditure_pct_gdp', 2022), 0);
  assert.equal(explorer.observation(fixture, 'BBB', 'expenditure_pct_gdp', 2023), null);
});
test('percentage-point changes use the exact start year and never substitute a later baseline', () => {
  const data = explorer.build(fixture, { countries: ['AAA', 'BBB'], start: 2020, end: 2023, mode: 'change' });
  assert.deepEqual(data.rows.map(row => row.AAA), [0, null, -40.125, 5.11]);
  assert.deepEqual(data.rows.map(row => row.BBB), [null, null, null, null]);
  assert.equal(data.snapshot[0].change, 5.11);
  assert.equal(data.snapshot[1].change, null);
});
test('table and CSV values use the same normalization as the trend', () => {
  const data = explorer.build(fixture, { countries: ['AAA'], start: 2020, end: 2024 });
  const plotted = chart.model({ rows: data.rows, fields: data.fields });
  assert.deepEqual(plotted.accessor.rows().map(row => row.AAA), [40.125, null, 0, 45.235, null]);
});
test('exports retain the measure and unit without changing the short plot labels', () => {
  const model = chart.model({ rows: [{ year: 2024, amount: 12.345 }], fields: [{ key: 'amount', label: 'Alpha', tableLabel: 'Alpha · Government spending · % of GDP' }] });
  assert.equal(model.fields[0].label, 'Alpha');
  assert.equal(model.accessor.columns[1].label, 'Alpha · Government spending · % of GDP');
});
test('ranking stays descending with missing values last, without a stale value fallback', () => {
  const data = explorer.build(fixture, { countries: ['AAA', 'BBB'], year: 2024 });
  assert.deepEqual(data.snapshot.map(row => [row.key, row.plotted]), [['BBB', 32], ['AAA', null]]);
});
test('direct labels remain separated when endpoints coincide near a plot edge', () => {
  const labels = chart.labelPositions([{ y: 300 }, { y: 300 }, { y: 301 }, { y: 302 }], 40, 320, 38);
  assert.ok(labels[0].labelY >= 40);
  assert.ok(labels.at(-1).labelY <= 320);
  for (let i = 1; i < labels.length; i++) assert.ok(labels[i].labelY - labels[i - 1].labelY >= 38);
});
