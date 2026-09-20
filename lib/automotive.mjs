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

/** Importer-reported routes, at a single monthly grain; no World totals. */
export function tradeRoutes(data, { segment = 'vehicles', period, market = 'ALL', geography = 'regions', origin = 'ALL' } = {}) {
  const origins = new Map((data.origins || []).map(o => [o.code, o]));
  const totals = new Map();
  for (const row of data.routes || []) {
    if (row.segment !== segment || row.period !== period || (market !== 'ALL' && row.market !== market)) continue;
    const code = geography === 'regions' ? origins.get(row.origin)?.region : row.origin;
    if (!code || (origin !== 'ALL' && code !== origin)) continue;
    const key = `${code}:${row.market}`;
    const previous = totals.get(key) || { origin:code, market:row.market, value:0 };
    previous.value += row.value;
    totals.set(key, previous);
  }
  return [...totals.values()].filter(r => r.value > 0).sort((a,b) => b.value - a.value || a.origin.localeCompare(b.origin) || a.market.localeCompare(b.market));
}

/** Collapse only the diagram, retaining every route in its table and export. */
export function diagramRoutes(routes, limit = 7) {
  const top = dimension => {
    const sums = new Map();
    for (const r of routes) sums.set(r[dimension], (sums.get(r[dimension]) || 0) + r.value);
    const selected=new Set([...sums].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,limit).map(([code]) => code));
    if(dimension==='origin' && sums.has('UNALLOCATED')) selected.add('UNALLOCATED');
    return selected;
  };
  const origins=top('origin'), markets=top('market'), combined=new Map();
  for (const r of routes) {
    const origin=origins.has(r.origin)?r.origin:'OTHER_ORIGINS', market=markets.has(r.market)?r.market:'OTHER_MARKETS';
    const key=`${origin}:${market}`, value=combined.get(key) || {origin,market,value:0};
    value.value+=r.value;combined.set(key,value);
  }
  return [...combined.values()];
}
