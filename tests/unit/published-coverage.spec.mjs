import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context = {window: {}};
vm.runInNewContext(readFileSync(new URL('../../published-coverage.js', import.meta.url), 'utf8'), context);
const merge = (...args) => JSON.parse(JSON.stringify(context.window.PSDCoverage.merge(...args)));
const base = {generated_at:'2026-08-31T00:00:00Z', countries:[{code:'CZE'},{code:'DEU'}], modules:[{id:'sovereign'}], records:[{country_code:'CZE',module:'sovereign',latest_year:2024}], totals:{municipal_units:10}};
const trade = {data:{countries:[{code:'CZE',latest_annual_period:'2025',latest_monthly_period:'202608'},{code:'DEU',latest_annual_period:null,latest_monthly_period:'202613'},{code:'WORLD',latest_annual_period:'2025'}]}};
const jobs = {release_id:'verified-release',period:2024,series:{employment_shares:[{country_code:'CZE',sector:'services',source_value:'59.1234',source_url:'https://example.org/exact-series'}],ownership:[]}};

test('adds only proven public country coverage and keeps monthly and annual grains separate', () => {
  const result = merge(base,trade,jobs,{reports:[]});
  const annual = result.records.find(row => row.module === 'trade_annual');
  const monthly = result.records.find(row => row.module === 'trade_monthly');
  assert.equal(annual.period_label,'2025');
  assert.equal(monthly.period_label,'2026–08');
  assert.match(monthly.view_url,/freq=M/);
  assert.equal(annual.first_year,null);
  assert.equal(annual.coverage_status,'partial');
  assert.equal(annual.artifact_generated_at,null);
  assert.equal(result.records.some(row => row.country_code === 'WORLD'),false);
  assert.equal(result.records.filter(row => row.country_code === 'DEU').length,0);
  assert.equal(result.generated_at,base.generated_at);
});

test('requires a pointed job release and preserves its source and provenance', () => {
  assert.equal(merge(base,null,{...jobs,release_id:null},null).records.some(row => row.module === 'job_market'),false);
  const record = merge(base,null,jobs,null).records.find(row => row.module === 'job_market');
  assert.equal(record.release_id,'verified-release');
  assert.equal(record.row_count,1);
  assert.equal(record.source_url,'https://example.org/exact-series');
  assert.equal(record.vintage_type,'actual_estimate');
  assert.match(record.coverage_en,/People, jobs and FTE remain distinct/);
  assert.equal(jobs.series.employment_shares[0].source_value,'59.1234');
});

test('failed live checks remain explicit and cannot reuse an earlier live record', () => {
  const previous = merge(base,trade,jobs,null);
  const failed = merge(previous,null,null,null,['/api/v1/trade/countries']);
  assert.deepEqual(failed.records,base.records);
  assert.deepEqual(failed.unavailable,['/api/v1/trade/countries']);
  assert.equal(failed.totals.records,1);
  assert.equal(failed.totals.countries,1);
  assert.equal(failed.totals.municipal_units,10);
});

test('education counts observed learner coverage without summing headcounts and FTE', () => {
  const education = {generated_at:'2026-09-02T00:00:00Z',countries:[{code:'DEU',period:'2024',levels:[{learners_headcount:10,teaching_fte:2}]},{code:'CZE',period:'2024',levels:[{learners_headcount:null}]}]};
  const result = merge(base,null,null,null,[],education);
  const rows = result.records.filter(row => row.module === 'education');
  assert.equal(rows.length,1);
  assert.equal(rows[0].country_code,'DEU');
  assert.equal(rows[0].entity_count,1);
  assert.equal(rows[0].artifact_generated_at,education.generated_at);
});
