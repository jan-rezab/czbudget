import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { benchmarkRows, countries, sources, parseState } from '../../lib/funding-systems.mjs';

test('all five systems have bilingual, sourced routes and no invented flow amounts', () => {
  assert.deepEqual(countries.map(c => c.code), ['CZE', 'USA', 'FRA', 'RUS', 'UKR']);
  for (const country of countries) {
    for (const topic of ['funding', 'schools', 'health']) {
      const routes = country.routes[topic];
      assert.ok(routes.length >= 2);
      assert.equal(new Set(routes.map(r => r.id)).size, routes.length);
      for (const route of routes) {
        assert.ok(route.sources.length);
        for (const id of route.sources) assert.ok(sources[id]?.url.startsWith('https://'), id);
        for (const label of [country.name, country.gap, route.label, route.note, ...route.nodes, ...country.compare[topic]]) {
          assert.ok(label.en?.trim());
          assert.ok(label.cs?.trim());
        }
        assert.equal('amount' in route, false);
        if (country.code === 'RUS') assert.equal(route.partial, true, 'Russia must retain the evidence limitation');
      }
    }
  }
});

test('benchmark preserves exact source values, status, common year and accounting perimeter', () => {
  const original = JSON.parse(readFileSync(new URL('../../lib/data/sovereign-benchmark.v1.json', import.meta.url)));
  const artifact = JSON.parse(readFileSync(new URL('../../data/funding-systems-benchmark.v1.json', import.meta.url)));
  assert.equal(artifact.year, 2024);
  assert.equal(artifact.scope, 'general_government');
  assert.deepEqual(artifact.rows, benchmarkRows(original, 2024));
  for (const row of artifact.rows) {
    assert.ok(Math.abs(row.revenue.value - row.spending.value - row.balance.value) < 0.003);
    for (const metric of [row.revenue, row.spending, row.balance]) assert.ok(['actual', 'estimate'].includes(metric.status));
  }
});

test('missing observations remain null and estimates never become actuals', () => {
  const rows = benchmarkRows({series: [{country_code: 'CZE', metrics: {
    revenue_pct_gdp: {latest_actual_year: 2023, values: [{year: 2024, value: 0, status: 'estimate'}]},
    expenditure_pct_gdp: {latest_actual_year: 2023, values: [{year: 2024, value: 5}]},
  }}]});
  assert.deepEqual(rows[0].revenue, {value: 0, status: 'estimate'});
  assert.deepEqual(rows[0].spending, {value: 5, status: 'estimate'});
  assert.equal(rows[0].balance, null);
  assert.equal(rows[1].revenue, null);
});

test('shareable selection accepts only supported country and topic IDs', () => {
  assert.deepEqual(parseState('?country=UKR&topic=health'), {country: 'UKR', topic: 'health'});
  assert.deepEqual(parseState('?country=%3Cscript%3E&topic=anything'), {country: 'CZE', topic: 'schools'});
});
