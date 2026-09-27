(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PrahaBudgetMath = api;
}(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const finite = value => typeof value === "number" && Number.isFinite(value);

  // A duplicate calendar year is ambiguous evidence. Do not silently choose a row.
  function annualValues(rows, valueFor) {
    const values = new Map(), duplicates = new Set();
    for (const row of rows || []) {
      if (!Number.isInteger(row?.year)) continue;
      if (values.has(row.year)) duplicates.add(row.year);
      values.set(row.year, valueFor(row));
    }
    for (const year of duplicates) values.delete(year);
    return values;
  }

  function associateAnnualChanges(history, points, options = {}) {
    const budgetKey = options.budgetKey || "expense_actual";
    const lag = options.lag ?? 0;
    if (!Number.isInteger(lag) || lag < 0) throw new RangeError("Outcome lag must be a non-negative number of calendar years");
    const minPairs = options.minPairs ?? 5;
    if (!Number.isInteger(minPairs) || minPairs < 2) throw new RangeError("Correlation needs a minimum of at least two pairs");
    const budgets = annualValues(history, row => {
      const value = row[budgetKey];
      if (!finite(value)) return null;
      if (!options.perCapita) return value;
      return finite(row.population_mid_year) && row.population_mid_year > 0 ? value / row.population_mid_year : null;
    });
    const outcomes = annualValues(points, row => finite(row.value) ? row.value : null);
    const endYear = options.endYear ?? Math.max(...budgets.keys());
    const pairs = [];
    for (const year of [...budgets.keys()].sort((a, b) => a - b)) {
      const value = budgets.get(year), previous = budgets.get(year - 1);
      const outcomeYear = year + lag;
      const outcome = outcomes.get(outcomeYear), previousOutcome = outcomes.get(outcomeYear - 1);
      if (year > endYear || outcomeYear > endYear || ![value, previous, outcome, previousOutcome].every(finite) || previous <= 0 || previousOutcome <= 0) continue;
      const budgetChange = 100 * (value / previous - 1), outcomeChange = 100 * (outcome / previousOutcome - 1);
      if (finite(budgetChange) && finite(outcomeChange)) pairs.push({ year, outcomeYear, budgetChange, outcomeChange });
    }
    if (pairs.length < minPairs) return { pairs, r: null, reason: "sample" };
    const n = pairs.length;
    const budgetMean = pairs.reduce((sum, row) => sum + row.budgetChange, 0) / n;
    const outcomeMean = pairs.reduce((sum, row) => sum + row.outcomeChange, 0) / n;
    let covariance = 0, budgetVariance = 0, outcomeVariance = 0;
    for (const row of pairs) {
      const x = row.budgetChange - budgetMean, y = row.outcomeChange - outcomeMean;
      covariance += x * y; budgetVariance += x * x; outcomeVariance += y * y;
    }
    // Constant growth can acquire tiny floating-point deviations. Those numerical
    // artefacts do not provide the variation required for a correlation coefficient.
    const noiseFloor = values => Number.EPSILON ** 2 * Math.max(1, ...values.map(Math.abs)) ** 2 * n * 64;
    if (budgetVariance <= noiseFloor(pairs.map(row => row.budgetChange)) || outcomeVariance <= noiseFloor(pairs.map(row => row.outcomeChange))) return { pairs, r: null, reason: "variation" };
    const r = covariance / Math.sqrt(budgetVariance * outcomeVariance);
    return finite(r) ? { pairs, r: Math.max(-1, Math.min(1, r)), reason: null } : { pairs, r: null, reason: "variation" };
  }
  // Editorial navigation groups, each defined by disjoint native paragraph prefixes.
  // Keep unknown codes visible; never fill a missing amount with zero.
  const services = [
    ['transport', ['22'], 'Transport', 'Doprava', 'Public transport, roads and other transport services', 'Veřejná doprava, silnice a další dopravní služby'],
    ['education', ['31', '32'], 'Schools & education', 'Školy a vzdělávání', 'Schools, school meals and other education services', 'Školy, školní stravování a další vzdělávací služby'],
    ['housing', ['36'], 'Housing & public space', 'Bydlení a veřejný prostor', 'Housing, street lighting, local infrastructure and development', 'Bydlení, veřejné osvětlení, místní infrastruktura a rozvoj'],
    ['environment', ['23', '37'], 'Environment & water', 'Životní prostředí a voda', 'Water management, waste, green space and environmental protection', 'Vodní hospodářství, odpady, zeleň a ochrana životního prostředí'],
    ['social', ['41', '42', '43'], 'Care & social support', 'Péče a sociální podpora', 'Social services, care and social support programmes', 'Sociální služby, péče a sociální podpora'],
    ['culture', ['33'], 'Culture & heritage', 'Kultura a památky', 'Culture, heritage, libraries, museums and media', 'Kultura, památky, knihovny, muzea a média'],
    ['sport', ['34'], 'Sport & leisure', 'Sport a volný čas', 'Sport, recreation and other leisure activities', 'Sport, rekreace a další volnočasové aktivity'],
    ['health', ['35'], 'Health', 'Zdravotnictví', 'Healthcare and other health services', 'Zdravotní péče a další zdravotnické služby'],
    ['safety', ['51', '52', '53', '55'], 'Safety & emergency services', 'Bezpečnost a záchranné služby', 'Public safety, fire protection and emergency preparedness', 'Veřejná bezpečnost, požární ochrana a krizová připravenost'],
    ['government', ['61', '62'], 'City administration', 'Správa města', 'Public administration, elections and other public functions', 'Veřejná správa, volby a další veřejné funkce'],
    ['economy', ['10', '21', '24', '25', '38', '39'], 'Economy & other services', 'Hospodářství a další služby', 'Agriculture, industry and other reported economic or public services', 'Zemědělství, průmysl a další vykázané hospodářské či veřejné služby'],
    ['finance', ['63', '64'], 'Financial operations & other spending', 'Finanční operace a ostatní výdaje', 'Financial operations and spending classified outside the service groups', 'Finanční operace a výdaje vykázané mimo skupiny služeb'],
    ['unclassified', [], 'Other reported purposes', 'Další vykázané účely', 'Native purposes without an assigned navigation group', 'Původní účely bez přiřazené skupiny v navigaci'],
  ].map(([id, prefixes, en, cs, description_en, description_cs]) => ({id, prefixes, en, cs, description_en, description_cs}));
  const serviceFor = code => services.find(group => group.prefixes.includes(String(code).slice(0, 2))) || services.at(-1);
  const amountTotal = rows => rows.length && rows.every(row => finite(row.amount)) ? rows.reduce((sum, row) => sum + row.amount, 0) : null;
  function serviceGroups(rows, year, stage) {
    const selected = (rows || []).filter(row => row.year === year && row.stage === stage && row.dimension === 'functional' && row.side === 'expenditure');
    return services.map(group => {
      const children = selected.filter(row => serviceFor(row.code).id === group.id).sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0));
      return {...group, rows: children, amount: amountTotal(children)};
    }).filter(group => group.rows.length).sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0));
  }
  function purposeEvidence(accounting, payments, year, code) {
    const inPurpose = row => row.year === year && String(row.paragraphCode) === String(code);
    const relevant = (accounting || []).filter(row => inPurpose(row) && (row.expenditure !== 0 || row.budgetExpenditure !== 0));
    function grouped(key, label) {
      const groups = new Map();
      for (const row of relevant) {
        const id = String(row[key] || '');
        if (!groups.has(id)) groups.set(id, {code: id, name: row[label] || id, records: []});
        groups.get(id).records.push(row);
      }
      return [...groups.values()].map(group => ({...group, amount: amountTotal(group.records.map(row => ({amount: row.expenditure})))})).sort((a,b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0));
    }
    return {accounting: relevant, items: grouped('itemCode','itemName'), projects: grouped('event','eventName'), payments: (payments || []).filter(inPurpose)};
  }

  const itCodes = ['5042','5168','5172','6111','6125'];
  function itEvidence(items, rows, selectedCode = 'it', search = '') {
    const selected = code => selectedCode === 'it' ? itCodes.includes(String(code)) : String(code) === selectedCode;
    const selectedItems = (items || []).filter(row => selected(row.code));
    const term = search.trim().toLocaleLowerCase();
    const payments = (rows || []).filter(row => selected(row.itemCode) && (!term || [row.counterparty, row.counterpartyId, row.description, row.eventName, row.id].join(' ').toLocaleLowerCase().includes(term)));
    const totalCents = (values, field) => values.length && values.every(row => Number.isSafeInteger(row[field])) ? values.reduce((sum,row) => sum + row[field], 0) / 100 : null;
    const vendors = new Map();
    for (const [index,row] of payments.entries()) {
      // Exact reported supplier identifiers group aliases. Missing IDs are kept
      // as separate records: a shared display name does not prove an identity.
      const key = row.counterpartyId ? 'id:' + row.counterpartyId : 'unresolved:' + index;
      if (!vendors.has(key)) vendors.set(key, {key, id:row.counterpartyId, name:row.counterparty, rows:[]});
      vendors.get(key).rows.push(row);
    }
    return { items: selectedItems, payments, budget: totalCents(selectedItems,'budgetCents'), actual: totalCents(selectedItems,'actualCents'), invoiceAmount: totalCents(payments,'expenditureCents'), vendors: [...vendors.values()].map(vendor => ({...vendor, amount:totalCents(vendor.rows,'expenditureCents')})).sort((a,b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0)) };
  }
  return { associateAnnualChanges, serviceGroups, serviceFor, purposeEvidence, itEvidence };
}));
