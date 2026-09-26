// Synthetic annual fixture; never served as production data.
export const tradeExplorer = {
  kind: 'trade', dataset_id: 'synthetic-test', generated_at: '2026-09-25T00:00:00Z',
  period: { start_year: 1997, end_year: 2025 },
  countries: [{ country_code: 'CZE', name_en: 'Czechia' }, { country_code: 'DEU', name_en: 'Germany' }],
  metrics: { exports_usd: { title: 'Goods exports', indicator: 'X', description: 'Annual exports in USD.' }, imports_usd: { title: 'Goods imports', indicator: 'M', description: 'Annual imports in USD.' } },
  series: ['CZE', 'DEU'].map((country_code, i) => ({ country_code, metrics: Object.fromEntries(['exports_usd', 'imports_usd'].map((key, j) => [key, { values: Array.from({ length: 29 }, (_, n) => ({ year: 1997 + n, value: 1000000 * (n + 1) * (i + 1) + j, status: 'loaded' })).filter(p => !(country_code === 'CZE' && key === 'exports_usd' && p.year === 1997)) }])) })),
  source: { short_name: 'UN Comtrade', dataset: 'Annual goods trade', url: 'https://comtradeplus.un.org/', table: 'fixture', definition: 'Synthetic', caveat: 'Current USD · Missing years remain gaps' },
};
