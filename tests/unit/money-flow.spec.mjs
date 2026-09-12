import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMoneyFlow, layoutFlows, sum, withFlowDetail, indexFlowTree, learningOverview } from '../../lib/money-flow-model.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../../data/${name}`, import.meta.url)));
const budget = read('czech-budget.v1.json');
const spending = read('cz-spending-2026.v1.json');
const detail = read('money-flow-detail-2026.v1.json');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('both sides conserve the approved total, with financing separate from revenue', () => {
  const model = buildMoneyFlow(budget, spending);
  close(sum(model.incoming), model.total);
  close(sum(model.outgoing), model.total);
  close(model.revenue + model.deficit, model.total);
  close(model.revenue, budget.rows.find(row => row[0] === 2026).slice(1, 4).reduce((a, b) => a + b, 0));
  assert.equal(model.incoming.filter(row => row.id === 'deficit').length, 1);
  close(sum(model.outgoing.map(row => ({ value: row.value / model.total * 100 }))), 100);
});

test('each source purpose is assigned once, and rounding is visible', () => {
  const model = buildMoneyFlow(budget, spending);
  const children = model.outgoing.flatMap(row => row.children);
  for (const source of spending.functional) {
    const matches = children.filter(row => row.id === source.code);
    assert.equal(matches.length, 1);
    close(matches[0].value, source.amount_czk_bn);
  }
  for (const row of model.outgoing) close(sum(row.children), row.value);
  close(children.find(row => row.id === 'rounding').value, 0.1);
});

test('ribbon widths share a scale and converge without gaps or overlaps', () => {
  const model = buildMoneyFlow(budget, spending);
  for (const items of [model.incoming, model.outgoing]) {
    const rows = layoutFlows(items, model.total);
    close(sum(rows.map(row => ({ value: row.width }))), 350);
    rows.forEach((row, i) => {
      close(row.width / row.value, 350 / model.total);
      if (i) close(row.pooledY - row.width / 2, rows[i - 1].pooledY + rows[i - 1].width / 2);
    });
  }
});

test('mismatched vintages, unknown purposes and significant reconciliation gaps fail closed', () => {
  assert.throws(() => buildMoneyFlow(budget, { ...spending, fiscal_year: 2025 }));
  assert.throws(() => buildMoneyFlow(budget, { ...spending, total_expenditure_including_eu_fm_czk: 3e12 }));
  assert.throws(() => buildMoneyFlow(budget, { ...spending, functional: [...spending.functional, { code: 'unknown', group: 'unknown', amount_czk_bn: 1 }] }));
});

test('detailed budget reconciles all 134 leaf items without adding subtotals twice', () => {
  const model = withFlowDetail(buildMoneyFlow(budget, spending), detail);
  close(model.deficit, 310);
  close(sum(model.incoming), model.total);
  close(sum(model.outgoing), model.total);
  const items = model.outgoing.flatMap(group => group.children.flatMap(purpose => purpose.children));
  assert.equal(items.length, 134);
  assert.equal(new Set(items.map(item => item.source_code)).size, 134);
  close(sum(items), model.total);
  const visit = item => {
    if (item.children) { close(sum(item.children), item.value); item.children.forEach(visit); }
  };
  [...model.incoming, ...model.outgoing].forEach(visit);
});

test('stable navigation paths resolve deep spending and revenue branches', () => {
  const tree = indexFlowTree(withFlowDetail(buildMoneyFlow(budget, spending), detail));
  assert.equal(tree.get('out:economy/transport/224').label_en, 'Rail transport');
  assert.equal(tree.get('out:security/legal_protection/544').label_en, 'Prisons');
  assert.equal(tree.get('in:personal_income_tax/1111').value, 153.9);
  assert.equal(tree.get('out:economy/transport/224').parent, 'out:economy/transport');
});

test('wrong detailed vintage and an unbalanced child fail closed', () => {
  const base = buildMoneyFlow(budget, spending);
  assert.throws(() => withFlowDetail(base, {...detail, year: 2027}));
  const broken = structuredClone(detail);
  broken.revenue_children.personal_income_tax[0].value += 1;
  assert.throws(() => withFlowDetail(base, broken));
});


test('learning overview groups taxes without losing detailed amounts or navigation', () => {
  const detailed = withFlowDetail(buildMoneyFlow(budget, spending), detail);
  const overview = learningOverview(detailed);
  assert.equal(overview.incoming.length, 4);
  assert.equal(overview.outgoing.length, 8);
  close(sum(overview.incoming), overview.total);
  assert.equal(overview.incoming[0].children.length, 5);
  const tree = indexFlowTree(overview);
  assert.equal(tree.get('in:taxes/personal_income_tax/1111').value, 153.9);
  assert.equal(tree.get('out:economy/transport/224').label_en, 'Rail transport');
  assert.equal(detailed.incoming.length, 8);
});
