// This closed set moves as one independently validated data release. Keep the image
// copies until a complete published group is available; unknown paths never resolve.
export const METADATA_PATHS = Object.freeze([
  '/data/data-quality-report.v1.json',
  '/data/data-freshness.v1.json',
  '/data/release-manifest.v1.json',
  '/data/cze-school-funding-2026-summary.v1.json',
  '/data/transport-performance.v1.json',
  '/data/country-parity.v1.json',
  '/data/european-politics.v1.json',
  '/data/cz-state-enterprises-2024.json',
  '/data/global-budget-transparency.v1.json',
  '/data/municipal-transparency.v1.json',
  '/data/cz-state-enterprise-balance-sheets-2024.v1.json',
  '/data/eu-capital-budgets.v1.json',
  '/data/politics-source-crawl.v1.json',
  '/data/defense-deep-dive.v1.json',
  '/lib/data/sovereign-benchmark.v1.json',
  '/sitemap.xml',
]);
const paths = new Set(METADATA_PATHS);
export const isMetadataPath = (pathname) => paths.has(pathname);
