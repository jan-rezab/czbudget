export const CODES = ['280530', '284610', '284690'];
export function selectedRows(rows, product = 'ALL') {
  return rows.filter(row => CODES.includes(row.product_code) && (product === 'ALL' || row.product_code === product));
}
export function amount(rows, unit = 'usd') {
  if (!rows.length) return null;
  const field = unit === 'tonnes' ? 'net_weight_kg' : 'value_usd';
  // A missing weight must not become a zero or an apparently complete tonnage.
  if (rows.some(row => row[field] === null || row[field] === undefined || !Number.isFinite(Number(row[field])))) return null;
  return rows.reduce((sum, row) => sum + Number(row[field]), 0) / (unit === 'tonnes' ? 1000 : 1);
}
export function pair(rows, unit = 'usd', expectedProducts = CODES.length) {
  const exports = rows.filter(row => row.flow === 'export');
  const imports = rows.filter(row => row.flow === 'import');
  const exportCount = new Set(exports.map(row => row.product_code)).size;
  const importCount = new Set(imports.map(row => row.product_code)).size;
  const outgoing = amount(exports, unit), incoming = amount(imports, unit);
  return { export: outgoing, import: incoming, exportCount, importCount,
    balance: outgoing !== null && incoming !== null && exportCount === expectedProducts && importCount === expectedProducts ? outgoing - incoming : null,
    estimated: rows.some(row => row.weight_estimated === true) };
}
export function partners(rows, product = 'ALL', unit = 'usd') {
  const groups = new Map();
  for (const row of selectedRows(rows, product)) {
    const code = row.partner_iso3 || String(row.partner_area_code);
    if (!groups.has(code)) groups.set(code, { code, name: row.partner_name || code, rows: [] });
    groups.get(code).rows.push(row);
  }
  return [...groups.values()].map(group => ({ ...group, ...pair(group.rows, unit, product === 'ALL' ? 3 : 1) }));
}
export function timeline(totals, product, unit, frequency) {
  const selected = selectedRows(totals, product);
  const periods = [...new Set(totals.map(row => row.period))].sort();
  if (!periods.length) return [];
  let cursor = periods[0];
  const filled = [];
  while (cursor <= periods.at(-1) && filled.length < 1000) {
    filled.push({ period: cursor, ...pair(selected.filter(row => row.period === cursor), unit, product === 'ALL' ? 3 : 1) });
    if (frequency === 'A') cursor = String(Number(cursor) + 1);
    else { const date = new Date(`${cursor.slice(0, 4)}-${cursor.slice(4)}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); cursor = date.toISOString().slice(0, 7).replace('-', ''); }
  }
  return filled;
}
export function treemap(items, rect) {
  const nodes = items.filter(row => row.weight > 0).sort((a, b) => b.weight - a.weight);
  if (!nodes.length) return [];
  if (nodes.length === 1) return [{ ...nodes[0], ...rect }];
  const total = nodes.reduce((sum, row) => sum + row.weight, 0);
  let split = 1, sum = nodes[0].weight;
  while (split < nodes.length - 1 && Math.abs(total / 2 - sum - nodes[split].weight) < Math.abs(total / 2 - sum)) sum += nodes[split++].weight;
  const ratio = sum / total;
  const horizontal = rect.w >= rect.h;
  const first = horizontal ? { ...rect, w: rect.w * ratio } : { ...rect, h: rect.h * ratio };
  const second = horizontal ? { ...rect, x: rect.x + first.w, w: rect.w - first.w } : { ...rect, y: rect.y + first.h, h: rect.h - first.h };
  return [...treemap(nodes.slice(0, split), first), ...treemap(nodes.slice(split), second)];
}
