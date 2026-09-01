import { COUNTRIES as LINE_SERVED } from "./municipal-lines.mjs";

const countryNames = {
  BOL: "Bolivia", BRA: "Brazil", CHL: "Chile", COL: "Colombia", CRI: "Costa Rica", CZE: "Czechia",
  DNK: "Denmark", ESP: "Spain", FIN: "Finland", GEO: "Georgia", GTM: "Guatemala", ITA: "Italy",
  JPN: "Japan", KOR: "South Korea", MEX: "Mexico", NLD: "Netherlands", NOR: "Norway", PER: "Peru", SLV: "El Salvador",
};

export function municipalityPage({ route, release_id, history }) {
  const name = escapeHTML(route.entity_name);
  const country = escapeHTML(countryNames[route.country_code] || route.country_code);
  const canonicalPath = escapeHTML(route.path);
  const profileEndpoint = `/public-data/municipality-profile?path=${encodeURIComponent(route.path)}`;
  // Only Czech entities carry a history payload of their own; everywhere else the history is
  // inside the profile and the endpoint correctly answers 404. Advertising it regardless put a
  // rejecting fetch in the page's Promise.all and took the whole profile down with it.
  const historyAttribute = history === null || history === undefined
    ? ""
    : ` data-history-url="/public-data/municipality-history?path=${encodeURIComponent(route.path)}"`;
  // Where a static page carries its country and code in the profile URL it fetches, a
  // snapshot-served page fetches by canonical path, so the code below can no longer read them
  // out of it. Name them outright. Only for countries /public-data/municipality-lines actually
  // serves — the roster is imported rather than restated so the two cannot drift.
  const warehouse = LINE_SERVED[route.country_code]
    ? ` data-warehouse-country="${escapeHTML(route.country_code)}"`
      + ` data-warehouse-code="${escapeHTML(route.entity_code)}"`
    : "";
  const title = `${name} municipal finances — Public Spending Data`;
  const description = `Official municipality-level finance profile for ${name}, ${country}.`;
  return `<!doctype html>
<html lang="en">
  <head>
    <script src="/language-bootstrap.js?v=20260822-no-language-flash"></script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="https://publicspendingdata.org${canonicalPath}" />
    <link rel="alternate" hreflang="cs" href="https://publicspendingdata.org${canonicalPath}?lang=cs" />
    <link rel="alternate" hreflang="en" href="https://publicspendingdata.org${canonicalPath}?lang=en" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/site-header.css?v=20260824-header-lockup" data-psd-site-header />
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/chart-system.css" />
    <link rel="stylesheet" href="/municipalities.css" />
    <link rel="stylesheet" href="/municipal-benchmark-profile.css" />
    <link rel="stylesheet" href="/municipal-expanded-profile.css?v=20260828-snapshot-serving" />
    <link rel="stylesheet" href="/global-footer.css" />
    <script src="/global-nav.js?v=20260827-country-methodology" defer></script>
    <script src="/municipal-expanded-profile.js?v=20260901-pol-execution" defer></script>
    <script src="/global-footer.js?v=20260825-footer-align" defer></script>
  </head>
  <body class="municipalities-page benchmark-profile expanded-profile cz-budget-page detail-page international-municipality-profile" data-profile-url="${profileEndpoint}"${historyAttribute} data-snapshot-release="${escapeHTML(release_id)}"${warehouse}>
    <psd-site-header data-section="cities"></psd-site-header>
    <nav class="context-rail municipal-context-rail international-context-rail" aria-label="Page sections"><a href="#overview">Overview</a><a href="#history-explorer">Trend</a><a href="#rozpocet">Budget</a><a href="#native-detail">Detail</a><a href="#metodika">Sources</a></nav>
    <main><nav class="breadcrumbs"><a href="/municipalities/">Municipalities</a><span>›</span><strong>${name}</strong></nav><section class="detail-hero" id="overview"><div><span class="eyebrow"><i class="live-dot"></i>${country} · official municipal finance</span><h1>${name}</h1><p>Loading the current audited profile…</p></div></section></main>
    <footer data-global-footer></footer>
  </body>
</html>`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}
