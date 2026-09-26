import { createHash } from 'node:crypto';

// Read only committed, fully loaded annual datasets. Never combine World with
// bilateral records, or HS6 values with parent aggregates or monthly records.
export const TRADE_EXPLORER_SQL = `
SELECT o.ref_year AS year, o.reporter_iso3, ANY_VALUE(o.reporter_name) AS reporter_name,
  o.flow_code, SUM(o.primary_value_usd) AS value_usd, COUNT(*) AS source_rows,
  ARRAY_AGG(DISTINCT o.classification_code) AS classifications, MAX(o.loaded_at) AS latest_load
FROM \`czbudget-janrezab.budget_detail.trade_observations\` o
WHERE o.period_start BETWEEN DATE '1997-01-01' AND @end_date
  AND o.frequency = 'A' AND o.product_type = 'C'
  AND o.reporter_iso3 IN (@country0, @country1, @country2, @country3)
  AND o.flow_code IN ('M', 'X') AND o.partner_area_code = 0
  AND o.aggregation_level = 6 AND o.is_original_classification
  AND (o.customs_code IS NULL OR o.customs_code = 'C00')
  AND (o.mode_of_transport_code IS NULL OR o.mode_of_transport_code = 0)
  AND (o.partner2_area_code IS NULL OR o.partner2_area_code = 0)
  AND EXISTS (
    SELECT 1 FROM \`czbudget-janrezab.budget_detail.trade_dataset_coverage\` c
    WHERE c.period_start BETWEEN DATE '1997-01-01' AND @end_date
      AND c.period_start = o.period_start AND c.reporter_iso3 = o.reporter_iso3
      AND c.frequency = 'A' AND c.product_type = 'C'
      AND c.classification_code = o.classification_code AND c.crawl_status = 'loaded'
  )
GROUP BY o.ref_year, o.reporter_iso3, o.flow_code
ORDER BY o.reporter_iso3, o.flow_code, year`;

export function tradeExplorerDataset(rows, countries, endYear) {
  const viewID = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const names = { CZE: 'Czechia', DEU: 'Germany', GBR: 'United Kingdom', USA: 'United States' };
  const timestamp = value => value && Number.isFinite(Number(value)) ? new Date(Number(value) * 1000).toISOString() : value;
  const latestLoad = rows.map(r => r.latest_load).filter(Boolean).sort().at(-1) || null;
  const metrics = Object.fromEntries([['exports_usd', 'exports', 'X'], ['imports_usd', 'imports', 'M']].map(([key, label, flow]) => [key, {
    title: `Goods ${label}`, indicator: `HS6 · ${flow} · World`,
    description: `Annual goods ${label} in current US dollars. Sum of loaded six-digit product records reported against World.`,
  }]));
  return {
    kind: 'trade', dataset_id: 'un-comtrade-annual-explorer', view_id: viewID, generated_at: timestamp(latestLoad),
    period: { start_year: 1997, end_year: endYear, year_count: endYear - 1997 + 1 }, metrics,
    countries: countries.map(code => ({ country_code: code, name_en: names[code] || rows.find(r => r.reporter_iso3 === code)?.reporter_name || code })),
    series: countries.map(code => ({ country_code: code, metrics: Object.fromEntries([['exports_usd', 'X'], ['imports_usd', 'M']].map(([key, flow]) => [key, {
      values: rows.filter(r => r.reporter_iso3 === code && r.flow_code === flow).map(r => ({
        year: Number(r.year), value: r.value_usd === null ? null : Number(r.value_usd), source_value_usd: r.value_usd,
        status: 'loaded', source_rows: Number(r.source_rows), classifications: (r.classifications || []).map(item => typeof item === 'string' ? item : item.v), loaded_at: timestamp(r.latest_load),
      })),
    }])) })),
    source: { short_name: 'UN Comtrade', dataset: 'Annual goods trade', url: 'https://comtradeplus.un.org/',
      table: 'budget_detail.trade_observations', view_id: viewID,
      definition: 'Calculated sums of committed, loaded annual HS6 goods observations, original classification, World partner 0, all customs procedures and transport modes. World totals are never added to bilateral records. Imports are generally CIF; exports FOB.',
      caveat: 'Current USD · Not inflation-adjusted · Loaded HS6 goods only; coverage can vary · Missing years remain gaps',
    },
  };
}
