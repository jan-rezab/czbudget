import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const data = require('../../lib/municipal-budget-data.js');
const labels = require('../../lib/cz-budget-labels.js');
const PRAHA = '00064581';
const json = value => ({ ok: true, json: async () => value });

test('a client needs an exact eight-digit IČO and derives every path from it', () => {
  for (const ico of ['', '123', '0006458', '000645811', '00064581 ', null]) assert.throws(() => data.createClient({ ico, fetch: async () => json({}) }), /IČO/);
  const client = data.createClient({ ico: '00254398', fetch: async () => json({}) });
  assert.deepEqual(client.paths, { history: '/data/municipal-history/00254398.json', entity: '/data/entities/00254398.json', integration: '/public-data/municipality-cityvizor?ico=00254398' });
  assert.equal(client.extension, null);
  assert.equal(data.createClient({ ico: PRAHA, fetch: async () => json({}) }).extension.cityvizorKey, 'cityvizor.praha.eu/4');
  assert.match(data.monitorUrl('00254398', 2025), /ucetni-jednotka\/00254398\/.*obdobi=2512/);
});

test('history keeps missing amounts, source stages, nominal units and actual population denominator', () => {
  const [row] = data.normalizeHistory({ municipality: { national_id: PRAHA }, series: [{ year: 2025, expense_actual: 120, expense_approved: 100, population_mid_year: 2, cash_current: null, expense_per_capita: 60 }] }, PRAHA);
  assert.equal(row.expense_actual, 120);
  assert.equal(row.expense_approved, 100);
  assert.equal(row.cash_current, null);
  assert.equal(row.revenue_actual, null);
  assert.equal(row.expense_per_capita, 60);
  assert.equal(row.priceBasis, 'nominal');
  assert.throws(() => data.normalizeHistory({ municipality: { national_id: '44992785' }, series: [] }, PRAHA), /identity/);
});

test('parallel budget classifications and source stages remain separate instead of additive', () => {
  const rows = data.normalizeBreakdown({ national_id: PRAHA, budget_breakdown: { fiscal_year: 2025, stages: { enacted: { purpose_expenditure: [['3113', 100]], economic_expenditure: [['5331', 100]] }, actual: { purpose_expenditure: [['3113', 80]], economic_expenditure: [['5331', 80]] } } } }, { dimensions: { purpose: { '3113': { cs: 'Základní školy' } }, economic: { '5331': { cs: 'Příspěvky' } } } }, PRAHA, labels);
  assert.equal(rows.filter(r => r.stage === 'actual' && r.dimension === 'functional').reduce((a, r) => a + r.amount, 0), 80);
  assert.equal(rows.filter(r => r.stage === 'approved' && r.dimension === 'economic')[0].amount, 100);
  assert.equal(rows[0].name, 'Základní školy');
  assert.equal(rows[0].name_en, 'Primary schools', 'shared English labels apply to every municipality');
  assert.deepEqual(data.normalizeBreakdown({ national_id: '44992785', budget_breakdown: { fiscal_year: 2025, stages: {} } }, null, PRAHA), [], 'another entity never enters the breakdown');
});

test('invoice allocations preserve signed cents, zero, missing date and identifiers without bank-payment claims', () => {
  const [row] = data.normalizePayments([{ row_id: 'allocation-1', income_cents: 0, expenditure_cents: -125, date: null, counterparty_id: '00012345', paragraph: '3113', item: '5169' }], 2025, null);
  assert.equal(row.income, 0);
  assert.equal(row.expenditure, -1.25);
  assert.equal(row.counterpartyId, '00012345');
  assert.equal(row.date, null);
  assert.equal(row.recordClass, 'invoice_allocation');
  const [missing] = data.normalizePayments([{}], 2025, null);
  assert.equal(missing.income, null);
  assert.equal(missing.expenditure, null);
});

test('PAQ context accepts only the exact municipality and real annual periods, preserving gaps and units', () => {
  const city = { ico: PRAHA, territoryCode: '554782', name: 'Praha' };
  const index = { regions: { 'obec:554782': { key: 'obec:554782', code: '554782', level: 'obec', ico: PRAHA } } };
  const fields = {}; const values = {};
  ['2020', '2022', '2023', '2024', '2020–2023'].forEach((period, id) => { fields[id] = { variable_key: 'podil_lidi_v_nezamestnanosti', values_type_key: 'hodnoty', period_key: period, period_name: period, display_unit: '%', sources: ['MPSV'] }; values[id] = { value: id === 1 ? null : 3 + id }; });
  const catalog = { fields, variables: { podil_lidi_v_nezamestnanosti: { name: 'Nezaměstnanost', description: '<p>Reported administrative unemployment.</p>' } } };
  const result = data.normalizeContext(index, catalog, { 'obec:554782': values }, city);
  assert.equal(result.series.length, 1);
  assert.deepEqual(result.series[0].points.map(p => p.year), [2020, 2021, 2022, 2023, 2024]);
  assert.equal(result.series[0].points[1].value, null);
  assert.equal(result.series[0].points[1].recordStatus, 'not_reported');
  assert.equal(result.series[0].points[2].recordStatus, 'reported_missing');
  assert.deepEqual(result.series[0].observedYears, [2020, 2023, 2024]);
  assert.equal(result.series[0].geography.code, '554782');
  assert.throws(() => data.normalizeContext({ regions: { 'obec:554782': { ...index.regions['obec:554782'], level: 'kraj' } } }, catalog, { 'obec:554782': values }, city), /identity/);
  assert.throws(() => data.normalizeContext(index, catalog, { 'obec:554782': values }, { ...city, ico: '00254398' }), /identity/, 'a territory published under another IČO is rejected');
});

test('records attach only to the municipality’s own profile, never to a district sharing its IČO', () => {
  const integration = profiles => ({ municipality_profiles: profiles.map((name, index) => ({ key: `cityvizor.cz/${index}`, name, ico: '44992785', type: 'municipality' })) });
  assert.equal(data.resolveRecordsProfile(integration(['Brno - Medlánky']), '44992785', null, ['Brno', 'Statutární město Brno']), null);
  assert.equal(data.resolveRecordsProfile(integration(['Město Kolín']), '44992785', null, ['Kolín'])?.name, 'Město Kolín');
  assert.equal(data.resolveRecordsProfile(integration(['Kolín', 'Kolín']), '44992785', null, ['Kolín']), null, 'two candidates are ambiguous');
  assert.equal(data.resolveRecordsProfile({ municipality_profiles: [{ key: 'cityvizor.cz/9', name: 'Kolín', ico: '00235440', type: 'municipality' }] }, '44992785', null, ['Kolín']), null, 'a different IČO never matches');
  const praha = { municipality_profiles: [{ key: 'cityvizor.praha.eu/4', name: 'Hlavní město Praha', ico: PRAHA, type: 'municipality' }, { key: 'cityvizor.praha.eu/9', name: 'Praha', ico: PRAHA, type: 'municipality' }] };
  assert.equal(data.resolveRecordsProfile(praha, PRAHA, { cityvizorKey: 'cityvizor.praha.eu/4' }, ['Praha'])?.key, 'cityvizor.praha.eu/4', 'an extension pins its profile');
});

test('a municipality without records loads its overview and reports records as not published', async () => {
  const ico = '00254398', calls = [];
  const client = data.createClient({ ico, fetch: async url => {
    calls.push(url);
    if (url.includes('/municipal-history/')) return json({ dataset_id: 'fixture', municipality: { national_id: ico, name: 'Abertamy' }, series: [{ year: 2025, expense_actual: 10 }] });
    if (url.includes('/entities/')) return json({ entity: { national_id: ico, short_name: 'Abertamy', territory: { municipality_code: 554979 }, budget_breakdown: { fiscal_year: 2025, stages: { actual: { purpose_expenditure: [['3113', 10]] } } } } });
    if (url.includes('municipality-cityvizor')) return json({ release_id: 'r1', municipality_profiles: [] });
    return json({ dimensions: {} });
  } });
  const overview = await client.loadOverview();
  assert.equal(overview.records, null);
  assert.equal(overview.coverage.cityvizor.status, 'not_published');
  assert.equal(overview.city.territoryCode, '554979');
  assert.equal(overview.extension, null);
  assert.equal(overview.coverage.contracts, null);
  const detail = await client.loadYearDetail(2025);
  assert.equal(detail.rows[0].amount, 10);
  assert.equal(detail.coverage.accounting.status, 'not_published');
  assert.equal(calls.some(url => url.includes('/cityvizor/profile')), false, 'no profile is requested for a municipality that publishes none');
  await assert.rejects(() => client.loadPayments(2025), /no records profile/);
});

test('a failed detail publication remains unavailable, while the full-year published breakdown survives', async () => {
  const client = data.createClient({ ico: PRAHA, fetch: async url => {
    if (url.includes('/municipal-history/')) return json({ municipality: { national_id: PRAHA }, series: [{ year: 2025 }] });
    if (url.includes('/entities/')) return json({ entity: { national_id: PRAHA, budget_breakdown: { fiscal_year: 2025, stages: { actual: { purpose_expenditure: [['3113', 80]] } }, lineage: { source_id: 'fixture' } } } });
    if (url.includes('municipality-cityvizor')) return json({ release_id: 'r1', municipality_profiles: [{ key: 'cityvizor.praha.eu/4', ico: PRAHA, type: 'municipality', available_years: [2025] }] });
    if (url === data.PATHS.codebook) return json({ dimensions: {} });
    return { ok: false, status: 503 };
  } });
  const result = await client.loadYearDetail(2025);
  assert.equal(result.rows[0].amount, 80);
  assert.equal(result.coverage.fullBudgetBreakdown, true);
  assert.equal(result.coverage.accounting.status, 'unavailable');
  assert.deepEqual(result.accountingRows, []);
});

test('a published shard from a different profile is rejected before it can enter the ledger', async () => {
  const client = data.createClient({ ico: PRAHA, fetch: async url => {
    if (url.includes('/municipal-history/')) return json({ municipality: { national_id: PRAHA }, series: [{ year: 2025 }] });
    if (url.includes('/entities/')) return json({ entity: { national_id: PRAHA } });
    if (url.includes('municipality-cityvizor')) return json({ release_id: 'r1', municipality_profiles: [{ key: 'cityvizor.praha.eu/4', ico: PRAHA, type: 'municipality', available_years: [2025] }] });
    if (url === data.PATHS.codebook) return json({ dimensions: {} });
    if (url.includes('/profile?')) return json({ profile: { key: 'cityvizor.praha.eu/4', ico: PRAHA }, years: [{ year: 2025, payments: { rows: 1 }, events: { rows: 0 }, assets: { payments: [{ part: 1 }], events: [] } }] });
    return json({ profile_key: 'cityvizor.cz/45', year: 2025, kind: 'payments', columns: ['row_id'], rows: [['wrong-place']] });
  } });
  await assert.rejects(() => client.loadPayments(2025), /scope/);
});

test('district IT loader preserves exact identity, allocation amounts and missing invoice numbers', async () => {
  const profile = { key: 'cityvizor.praha.eu/6', ico: '00063517', name: 'Praha 3', instance: 'https://cityvizor.praha.eu', type: 'municipality', available_years: [2025], profile_url: 'https://cityvizor.praha.eu/praha3' };
  const calls = [];
  const client = data.createClient({ ico: PRAHA, fetch: async url => {
    calls.push(url);
    if (url.includes('/municipal-history/')) return json({ municipality: { national_id: PRAHA }, series: [{ year: 2025 }] });
    if (url.includes('/entities/')) return json({ entity: { national_id: PRAHA } });
    if (url.includes('municipality-cityvizor')) return json({ release_id: 'test-release', municipality_profiles: [] });
    if (url.endsWith('/index')) return json({ complete: true, release_id: 'test-release', profiles: [profile, { ...profile, key: 'cityvizor.cz/6', instance: 'https://cityvizor.cz' }] });
    if (url === data.PATHS.codebook) return json({ dimensions: {} });
    if (url.includes('/profile?')) return json({ release_id: 'test-release', profile, years: [{ year: 2025, source_validity: '2025-12-31', accounting: { by_item: [{ key: '5168', expenditure_actual_cents: 10000, expenditure_budget_cents: 12000 }] }, payments: { rows: 3 }, events: { rows: 0 }, assets: { payments: [{ part: 1 }], events: [] } }] });
    return json({ profile_key: profile.key, year: 2025, kind: 'payments', columns: ['row_id', 'item', 'expenditure_cents', 'counterparty_id', 'counterparty_name', 'description'], rows: [['one', '5168', 10000, '00001234', 'Vendor', 'Support'], ['correction', '5168', -1000, '00001234', 'Vendor renamed', 'Correction'], ['non-it', '5169', 8000, '00001234', 'Vendor', 'Other service']] });
  } });
  const summary = await client.loadAuthoritySummary(profile.key, 2025);
  assert.equal(summary.items[0].amount, 100);
  assert.equal(calls.some(url => url.includes('/shard?')), false, 'invoice records must remain lazy');
  const result = await client.loadAuthorityPayments(profile.key, 2025);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1].expenditure, -10);
  assert.equal(result.rows[0].invoiceNumber, null);
  assert.equal(result.rows[0].profileKey, profile.key);
  await assert.rejects(() => client.loadAuthoritySummary('cityvizor.cz/6', 2025), /not published/);
  await assert.rejects(() => client.loadAuthoritySummary(profile.key, 2024), /not published/);
});

test('without an extension, the authorities are the municipality’s own profiles only', async () => {
  const ico = '00294900', own = { key: 'cityvizor.cz/1', name: 'Nové Město na Moravě', ico, type: 'municipality', available_years: [2025] };
  const calls = [];
  const client = data.createClient({ ico, fetch: async url => {
    calls.push(url);
    if (url.includes('/municipal-history/')) return json({ municipality: { national_id: ico, name: 'Nové Město na Moravě' }, series: [{ year: 2025 }] });
    if (url.includes('/entities/')) return json({ entity: { national_id: ico, short_name: 'Nové Město na Moravě' } });
    if (url.includes('municipality-cityvizor')) return json({ release_id: 'r1', municipality_profiles: [own, { ...own, key: 'cityvizor.cz/2', ico: '12345678' }] });
    return json({});
  } });
  assert.equal((await client.loadOverview()).records.key, 'cityvizor.cz/1');
  const directory = await client.loadAuthorities();
  assert.deepEqual(directory.profiles.map(profile => profile.key), ['cityvizor.cz/1']);
  assert.equal(calls.some(url => url.endsWith('/cityvizor/index')), false, 'the national directory is only read for an extension');
});

test('annual statements pin fiscal year and publication without fetching raw shards', async () => {
  const calls = [];
  const client = data.createClient({ ico: PRAHA, fetch: async url => {
    calls.push(url);
    if (url.includes('/municipal-history/')) return json({ municipality: { national_id: PRAHA }, series: [{ year: 2025 }] });
    if (url.includes('/entities/')) return json({ entity: { national_id: PRAHA } });
    if (url.includes('municipality-cityvizor')) return json({ release_id: 'r1', municipality_profiles: [{ key: 'cityvizor.praha.eu/4', ico: PRAHA, type: 'municipality', available_years: [2025] }] });
    return json({ release_id: 'r1', profile: { key: 'cityvizor.praha.eu/4', ico: PRAHA }, years: [{ year: 2025, accounting: { rows: 0 } }] });
  } });
  const result = await client.loadStatement(2025, 'r1');
  assert.equal(result.summary.year, 2025);
  assert.ok(calls.some(url => url.includes('year=2025')));
  await assert.rejects(() => client.loadStatement(2025, 'r2'), /Publication changed/);
  await assert.rejects(() => client.loadStatement(2024, 'r1'), /year/);
  assert.equal(calls.some(url => url.includes('/shard?')), false);
});

test('joint facts retain both codes and original decimals; wrong scope and incorrect purpose allocations fail', () => {
  const native = { year: 2025, dimension: 'joint', stage: 'actual', side: 'expenditure', reporting_scope: 'standalone_accounting_unit', functional_code: '3113', economic_code: '5331', amount: 80, amount_exact: '80.000000000', currency: 'CZK' };
  const payload = { country: 'CZE', entity_code: PRAHA, joint_lines: [native] };
  const joint = data.normalizeJoint(payload, PRAHA, 2025, null, labels);
  assert.equal(joint[0].functional_code, '3113'); assert.equal(joint[0].economic_code, '5331'); assert.equal(joint[0].amount_exact, '80.000000000');
  assert.throws(() => data.normalizeJoint({ ...payload, entity_code: '00254398' }, PRAHA, 2025), /identity/);
  assert.throws(() => data.normalizeJoint({ ...payload, joint_lines: [{ ...native, reporting_scope: 'other' }] }, PRAHA, 2025), /scope/);
  const cells = [], marginal = [];
  for (const stage of ['approved', 'adjusted', 'actual']) {
    cells.push({ ...joint[0], stage }, { ...joint[0], stage, side: 'revenue', functional_code: null, economic_code: '1111' });
    marginal.push({ stage, side: 'expenditure', dimension: 'functional', code: '3113', amount: 80 }, { stage, side: 'expenditure', dimension: 'economic', code: '5331', amount: 80 }, { stage, side: 'revenue', dimension: 'economic', code: '1111', amount: 80 });
  }
  assert.equal(data.reconcileJoint(cells, marginal).status, 'reconciled');
  assert.equal(data.reconcileJoint(cells.map(row => row.stage === 'actual' && row.side === 'expenditure' ? { ...row, functional_code: '3111' } : row), marginal).status, 'unreconciled');
  assert.equal(data.reconcileJoint([], marginal).status, 'not_published');
});

test('organisation records enforce parent, year, payment coverage, release and layer count', async () => {
  const profile = { key: 'cityvizor.praha.eu/81', name: 'School', ico: '63831708', parent_profile_key: 'cityvizor.praha.eu/4', available_years: [2024], payment_years: [] };
  let release = 'release-1', declaredRows = 1;
  const client = data.createClient({ ico: PRAHA, fetch: async url => {
    if (url.includes('/municipal-history/')) return json({ municipality: { national_id: PRAHA }, series: [{ year: 2025 }] });
    if (url.includes('/entities/')) return json({ entity: { national_id: PRAHA } });
    if (url.includes('municipality-cityvizor')) return json({ release_id: 'release-1', municipality_profiles: [{ key: 'cityvizor.praha.eu/4', ico: PRAHA, type: 'municipality' }], organizations: [profile] });
    if (url.includes('/profile?')) return json({ release_id: release, profile, years: [{ year: 2024, accounting: { rows: declaredRows }, assets: { accounting: [{ part: 1 }] } }] });
    if (url.includes('/shard?')) return json({ profile_key: profile.key, year: 2024, kind: 'accounting', rows: [{ income_actual_cents: 10000 }] });
    throw new Error('Unexpected request');
  } });
  assert.equal((await client.loadOrganizationRecords(profile.key, 2024, 'accounting')).rows[0].income_actual_cents, 10000);
  await assert.rejects(() => client.loadOrganizationRecords(profile.key, 2025), /year/);
  await assert.rejects(() => client.loadOrganizationRecords(profile.key, 2024, 'payments'), /payments/);
  await assert.rejects(() => client.loadOrganizationRecords('cityvizor.praha.eu/999', 2024), /parent/);
  client.clearCache(); release = 'other'; await assert.rejects(() => client.loadOrganizationRecords(profile.key, 2024, 'accounting'), /Publication changed/);
  client.clearCache(); release = 'release-1'; declaredRows = 2; await assert.rejects(() => client.loadOrganizationRecords(profile.key, 2024, 'accounting'), /row count/);
});
