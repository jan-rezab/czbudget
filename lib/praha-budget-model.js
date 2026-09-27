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
  return { associateAnnualChanges };
}));
