// Values stay in CZK billions. Do not mix state-budget cash flows with general-government accounts.
export const sum = rows => rows.reduce((total, row) => total + row.value, 0);

export function buildMoneyFlow(budget, spending) {
  const year = spending.fiscal_year;
  const row = budget.rows.find(row => row[0] === year);
  const taxRow = budget.tax_detail.rows.find(row => row[0] === year);
  if (!row || !taxRow || budget.stages[year] !== 'approved_budget' || spending.stage !== 'approved_budget') {
    throw new Error('The flow needs matching approved-budget vintages.');
  }
  const values = Object.fromEntries(budget.columns.map((key, index) => [key, row[index]]));
  const taxes = Object.fromEntries(budget.tax_detail.columns.map((key, index) => [key, taxRow[index]]));
  const income = [
    { id: 'insurance', value: values.insurance },
    ...['vat', 'corporate_income_tax', 'personal_income_tax', 'excise_and_energy_taxes'].map(id => ({ id, value: taxes[id] })),
    { id: 'other_income', value: values.other_income },
    { id: 'other_taxes', value: values.taxes - taxes.vat - taxes.corporate_income_tax - taxes.personal_income_tax - taxes.excise_and_energy_taxes },
  ];
  const total = spending.total_expenditure_including_eu_fm_czk / 1e9;
  const revenue = sum(income);
  const deficit = total - revenue;
  if (deficit < 0) throw new Error('This edition requires a deficit; surplus needs a separate destination.');
  const groups = [
    ['pensions', item => item.code === 'pensions'],
    ['social', item => item.group === 'social' && item.code !== 'pensions'],
    ['education', item => item.code === 'education'],
    ['security', item => item.group === 'security'],
    ['health', item => item.code === 'health'],
    ['economy', item => item.group === 'economy'],
    ['government', item => item.group === 'government'],
    ['other', item => item.group === 'agriculture' || (item.group === 'services' && !['education', 'health'].includes(item.code))],
  ];
  const assigned = new Set();
  const outgoing = groups.map(([id, matches]) => {
    const children = spending.functional.filter(matches).map(item => {
      if (assigned.has(item.code)) throw new Error('Overlapping spending groups.');
      assigned.add(item.code);
      return { id: item.code, value: item.amount_czk_bn, label_cs: item.label_cs, label_en: item.label_en };
    });
    return { id, value: sum(children), children };
  });
  if (assigned.size !== spending.functional.length) throw new Error('Unassigned spending category.');
  const rounding = Math.round((total - sum(outgoing)) * 1e8) / 1e8;
  if (Math.abs(rounding) > 0.2) throw new Error('Spending does not reconcile within published rounding.');
  if (rounding) {
    outgoing.at(-1).children.push({ id: 'rounding', value: rounding, label_cs: 'Rozdíl ze zaokrouhlení', label_en: 'Published rounding adjustment' });
    outgoing.at(-1).value += rounding;
  }
  const incoming = [...income, { id: 'deficit', value: deficit }];
  if ([...incoming, ...outgoing].some(item => !Number.isFinite(item.value) || item.value < 0)) throw new Error('Invalid flow value.');
  return { year, total, revenue, deficit, incoming, outgoing, rounding, sources: spending.sources };
}

// One scale on both sides: equal amounts have equal ribbon widths.
export function layoutFlows(items, total, { height = 350, gap = 18, top = 94 } = {}) {
  const scale = height / total;
  let start = top;
  let pooled = top + gap * (items.length - 1) / 2;
  return items.map(item => {
    const width = item.value * scale;
    const positioned = { ...item, width, y: start + width / 2, pooledY: pooled + width / 2 };
    start += width + gap;
    pooled += width;
    return positioned;
  });
}

export function withFlowDetail(base, detail) {
  if (detail.year !== base.year || detail.stage !== 'approved_budget') throw new Error('Mismatched detailed budget vintage.');
  const model = structuredClone(base);
  model.total = detail.total;
  model.revenue = detail.revenue;
  model.deficit = detail.total - detail.revenue;
  model.rounding = 0;
  model.detailSource = detail.source;
  model.outgoing.forEach(group => {
    group.children = group.children.filter(item => item.id !== 'rounding').map(item => {
      const leaves = detail.purposes[item.id];
      if (!leaves?.length) throw new Error(`Missing detailed purpose: ${item.id}`);
      return { ...item, value: sum(leaves), children: structuredClone(leaves) };
    });
    group.value = sum(group.children);
  });
  model.incoming.forEach(item => {
    item.value = item.id === 'deficit' ? model.deficit : detail.income_values[item.id];
    if (detail.revenue_children[item.id]) item.children = structuredClone(detail.revenue_children[item.id]);
  });
  const validate = items => items.forEach(item => {
    if (!Number.isFinite(item.value) || item.value < 0) throw new Error('Invalid detailed amount.');
    if (item.children) {
      if (Math.abs(sum(item.children) - item.value) > 1e-6) throw new Error(`Unbalanced detail: ${item.id}`);
      validate(item.children);
    }
  });
  validate([...model.incoming, ...model.outgoing]);
  if (Math.abs(sum(model.incoming) - model.total) > 1e-6 || Math.abs(sum(model.outgoing) - model.total) > 1e-6) throw new Error('Unbalanced detailed budget.');
  return model;
}

export function indexFlowTree(model) {
  const index = new Map();
  const visit = (item, side, parent = '') => {
    const key = parent ? `${parent}/${item.id}` : `${side}:${item.id}`;
    const entry = { ...item, key, side, parent };
    index.set(key, entry);
    item.children?.forEach(child => visit(child, side, key));
  };
  model.incoming.forEach(item => visit(item, 'in'));
  model.outgoing.forEach(item => visit(item, 'out'));
  return index;
}

// Level 1 is deliberately small. Tax types remain available behind the Taxes branch.
export function learningOverview(model) {
  const taxIds = new Set(['vat', 'corporate_income_tax', 'personal_income_tax', 'excise_and_energy_taxes', 'other_taxes']);
  const taxes = model.incoming.filter(item => taxIds.has(item.id));
  return {
    ...model,
    incoming: [
      { id: 'taxes', value: sum(taxes), children: taxes },
      ...model.incoming.filter(item => !taxIds.has(item.id)),
    ],
  };
}
