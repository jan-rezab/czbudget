/* Dataset adapter for the explorer. Financial semantics stay outside PSDPlot. */
(function (root) {
  'use strict';
  const metrics = Object.freeze({
    expenditure_pct_gdp: { title: 'Government spending', indicator: 'GGX_NGDP', description: 'Total general government expenditure, including interest, as a share of GDP.' },
    revenue_pct_gdp: { title: 'Government revenue', indicator: 'GGR_NGDP', description: 'Total general government revenue as a share of GDP.' },
    balance_pct_gdp: { title: 'Budget balance', indicator: 'GGXCNL_NGDP', description: 'General government net lending (+) or borrowing (−) as a share of GDP.' },
    gross_debt_pct_gdp: { title: 'Government debt', indicator: 'GGXWDG_NGDP', description: 'General government gross debt, a stock measured as a share of annual GDP.' },
  });
  const defaults = { metric: 'expenditure_pct_gdp', countries: ['CZE', 'DEU', 'GBR', 'USA'], start: 2005, end: 2024, year: 2024, mode: 'level', view: 'line' };
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function normalize(input, dataset) {
    const available = new Set(dataset.countries.map(country => country.country_code));
    const requested = Array.isArray(input.countries) ? input.countries : String(input.countries || defaults.countries).split(',');
    const countries = [...new Set(requested.filter(code => available.has(code)))].slice(0, 4);
    const clamp = value => Math.max(dataset.period.start_year, Math.min(dataset.period.end_year, Number.isInteger(Number(value)) ? Number(value) : dataset.period.end_year));
    const start = clamp(input.start ?? dataset.period.start_year);
    const end = Math.max(start, clamp(input.end ?? dataset.period.end_year));
    return { metric: Object.hasOwn(metrics, input.metric) ? input.metric : defaults.metric, countries: countries.length ? countries : dataset.countries.slice(0, 1).map(c => c.country_code), start, end, year: Math.max(start, Math.min(end, clamp(input.year ?? end))), mode: input.mode === 'change' ? 'change' : 'level', view: ['line', 'bar', 'table'].includes(input.view) ? input.view : 'line' };
  }
  function observation(dataset, code, metric, year) {
    const series = dataset.series.find(row => row.country_code === code)?.metrics[metric];
    const point = series?.values.find(row => row.year === year);
    // This compact artifact omits per-observation status. Never imply that a
    // point is actual when the series' actual-year boundary cannot support it.
    return series && finite(series.latest_actual_year) && year <= series.latest_actual_year && finite(point?.value) ? point.value : null;
  }
  function build(dataset, input) {
    const state = normalize(input, dataset);
    const fields = state.countries.map((code, index) => ({ key: code, label: dataset.countries.find(c => c.country_code === code).name_en, color: ['#a8b63f', '#171918', '#8b8d83', '#171918'][index], dash: ['', '', '6 4', '2 5'][index] }));
    const rows = Array.from({ length: state.end - state.start + 1 }, (_, i) => {
      const year = state.start + i;
      return Object.fromEntries([['year', year], ...fields.map(field => {
        const value = observation(dataset, field.key, state.metric, year);
        const base = observation(dataset, field.key, state.metric, state.start);
        return [field.key, state.mode === 'change' ? (value === null || base === null ? null : Number((value - base).toFixed(6))) : value];
      })]);
    });
    const snapshot = fields.map(field => {
      const value = observation(dataset, field.key, state.metric, state.year);
      const base = observation(dataset, field.key, state.metric, state.start);
      return { ...field, value, base, change: value === null || base === null ? null : Number((value - base).toFixed(6)), plotted: rows.find(row => row.year === state.year)[field.key] };
    }).sort((a, b) => (b.plotted ?? -Infinity) - (a.plotted ?? -Infinity));
    return { state, fields, rows, snapshot, unit: state.mode === 'change' ? 'Percentage-point change' : '% of GDP' };
  }
  const api = Object.freeze({ metrics, defaults, normalize, observation, build });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PSDExplorerModel = api;
})(typeof window === 'undefined' ? globalThis : window);
