/** Monthly automotive comparisons use one fixed set of importing markets. */
export const REGIONS = ['USA', 'EU27', 'CHN', 'ROW'];
export const SEGMENTS = ['vehicles', 'trucks', 'parts'];
export function monthlySeries(data, { market = 'ALL', metric = 'value', start, end } = {}) {
  const periods = data.periods.filter(p => (!start || p >= start) && (!end || p <= end));
  const markets = market === 'ALL' ? data.panel : data.panel.filter(code => code === market);
  return SEGMENTS.map(segment => {
    const points = periods.map(period => {
      const relevant = data.rows.filter(r => r.period === period && r.segment === segment && markets.includes(r.market));
      const complete = markets.length > 0 && markets.every(code => relevant.some(r => r.market === code));
      const values = Object.fromEntries(REGIONS.map(region => [region, complete ? relevant.reduce((sum, r) => sum + r.values[region], 0) : null]));
      const total = complete ? REGIONS.reduce((sum, region) => sum + values[region], 0) : null;
      return { period, total, values };
    });
    const base = points[0]?.values;
    return { segment, points: points.map(p => ({ ...p, displayed: Object.fromEntries(REGIONS.map(region => {
      const value = p.values[region];
      return [region, value == null ? null : metric === 'share' ? (p.total > 0 ? value / p.total * 100 : null) : metric === 'index' ? (base?.[region] > 0 ? value / base[region] * 100 : null) : value / 1e9];
    })) })) };
  });
}
export function monthLabel(period, lang = 'en') {
  return new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period.slice(0,4)}-${period.slice(4,6)}-01T00:00:00Z`));
}
