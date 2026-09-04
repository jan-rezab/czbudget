import { COUNTRIES as LINE_SERVED } from "./municipal-lines.mjs";

const countryNames = {
  BOL: "Bolivia", BRA: "Brazil", CHL: "Chile", COL: "Colombia", CRI: "Costa Rica", CZE: "Czechia",
  DNK: "Denmark", ESP: "Spain", FIN: "Finland", GEO: "Georgia", GTM: "Guatemala", ITA: "Italy",
  JPN: "Japan", KOR: "South Korea", MEX: "Mexico", NLD: "Netherlands", NOR: "Norway", PER: "Peru", SLV: "El Salvador",
};

export function municipalityPage({ route, release_id, profile: payload, history }, requestedLanguage = "en") {
  const lang = requestedLanguage === "cs" ? "cs" : "en";
  const view = profileView(payload, history);
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
  const labels = lang === "cs" ? {
    title: `${name} — rozpočet obce, ${country} — Public Spending Data`, description: `${name}: oficiální obecní příjmy, výdaje, saldo a historie.`,
    municipalities: "Obce", official: "oficiální obecní finance", code: "Národní kód", latest: "Poslední období",
    revenue: "Příjmy", expenditure: "Výdaje", balance: "Saldo", cash: "Stav účtů", history: "Rozpočet v čase",
    budget: "Rozpočet", detail: "Zdrojové položky", sources: "Zdroje a data", sourceCopy: "Chybějící hodnoty se nedopočítávají.", machine: "Strojová data",
  } : {
    title: `${name} municipal finances — Public Spending Data`, description: `Official municipality-level finance profile for ${name}, ${country}.`,
    municipalities: "Municipalities", official: "official municipal finance", code: "National code", latest: "Latest period",
    revenue: "Revenue", expenditure: "Expenditure", balance: "Balance", cash: "Cash balance", history: "Budget over time",
    budget: "Budget", detail: "Source line items", sources: "Sources and data", sourceCopy: "Missing values are not estimated.", machine: "Machine-readable data",
  };
  const latest = view.latest || {};
  const metrics = [[labels.revenue, latest.revenue], [labels.expenditure, latest.expenditure], [labels.balance, latest.balance], [labels.cash, latest.cash ?? latest.debt]];
  const historyRows = view.history.slice().sort((a, b) => Number(b.year) - Number(a.year));
  const details = view.detail.slice(0, 12);
  const source = escapeHTML(view.sourceUrl || "https://publicspendingdata.org/methodology.html");
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "Dataset", name: labels.title.replace(" — Public Spending Data", ""),
    description: labels.description, url: `https://publicspendingdata.org${route.path}`, inLanguage: lang,
    spatialCoverage: { "@type": "AdministrativeArea", name: route.entity_name, addressCountry: countryNames[route.country_code] || route.country_code },
    distribution: { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `https://publicspendingdata.org${profileEndpoint}` } }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <script src="/language-bootstrap.js?v=20260822-no-language-flash"></script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${labels.title}</title>
    <meta name="description" content="${labels.description}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="https://publicspendingdata.org${canonicalPath}" />
    <link rel="alternate" hreflang="cs" href="https://publicspendingdata.org${canonicalPath}?lang=cs" />
    <link rel="alternate" hreflang="en" href="https://publicspendingdata.org${canonicalPath}?lang=en" />
    <script type="application/ld+json">${jsonLd}</script>
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/site-header.css?v=20260824-header-lockup" data-psd-site-header />
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/chart-system.css" />
    <link rel="stylesheet" href="/municipalities.css" />
    <link rel="stylesheet" href="/municipal-benchmark-profile.css" />
    <link rel="stylesheet" href="/municipal-expanded-profile.css?v=20260828-snapshot-serving" />
    <link rel="stylesheet" href="/global-footer.css" />
    <script src="/global-nav.js?v=20260827-country-methodology" defer></script>
    <script src="/municipal-expanded-profile.js?v=20260902-polish-labels" defer></script>
    <script src="/global-footer.js?v=20260825-footer-align" defer></script>
  </head>
  <body class="municipalities-page benchmark-profile expanded-profile cz-budget-page detail-page international-municipality-profile" data-profile-url="${profileEndpoint}"${historyAttribute} data-snapshot-release="${escapeHTML(release_id)}"${warehouse}>
    <psd-site-header data-section="cities"></psd-site-header>
    <nav class="context-rail municipal-context-rail international-context-rail" aria-label="Page sections"><a href="#overview">${labels.latest}</a><a href="#history-explorer">${labels.history}</a><a href="#rozpocet">${labels.budget}</a><a href="#native-detail">${labels.detail}</a><a href="#metodika">${labels.sources}</a></nav>
    <main><nav class="breadcrumbs"><a href="/municipalities/?lang=${lang}">${labels.municipalities}</a><span>›</span><strong>${name}</strong></nav>
      <section class="detail-hero" id="overview"><div><span class="eyebrow"><i class="live-dot"></i>${country} · ${labels.official}</span><h1>${name}</h1><p>${labels.code} ${escapeHTML(route.entity_code)}${view.region ? ` · ${escapeHTML(view.region)}` : ""}. ${labels.sourceCopy}</p></div><aside class="detail-score"><span>${labels.latest}</span><strong>${escapeHTML(latest.year || "—")}</strong><small>${escapeHTML(view.currency || "")}</small></aside></section>
      <section class="detail-kpis">${metrics.map(([label, value]) => `<article><span>${label}</span><strong>${money(value, view.currency, lang)}</strong><small>${escapeHTML(latest.year || "—")}</small></article>`).join("")}</section>
      <section class="history-explorer" id="history-explorer"><div class="directory-title"><div><span class="kicker">${labels.history}</span><h2>${labels.history}</h2></div><p>${labels.sourceCopy}</p></div><details class="history-table" open><summary>${labels.history}</summary><div class="profile-table-scroll"><table><thead><tr><th>Year</th><th>${labels.revenue}</th><th>${labels.expenditure}</th><th>${labels.balance}</th><th>${labels.cash}</th></tr></thead><tbody>${historyRows.map((row) => `<tr><th>${escapeHTML(row.year)}</th><td>${money(row.revenue, view.currency, lang, false)}</td><td>${money(row.expenditure, view.currency, lang, false)}</td><td>${money(row.balance, view.currency, lang, false)}</td><td>${money(row.cash ?? row.debt, view.currency, lang, false)}</td></tr>`).join("")}</tbody></table></div></details></section>
      <section class="detail-analysis" id="rozpocet"><div class="detail-section-title"><div><span class="kicker">${labels.budget}</span><h2>${labels.latest} ${escapeHTML(latest.year || "")}</h2></div><p>${labels.sourceCopy}</p></div><article class="detail-panel plan-panel"><dl>${metrics.slice(0, 3).map(([label, value]) => `<div><dt>${label}</dt><dd>${money(value, view.currency, lang, false)}</dd></div>`).join("")}</dl></article><section class="native-detail-explorer" id="native-detail"><div class="breakdown-heading"><div><span class="kicker">${labels.detail}</span><h2>${labels.detail}</h2></div><p>${view.detail.length ? `${view.detail.length} ${lang === "cs" ? "vykázaných řádků" : "reported rows"}` : lang === "cs" ? "Detailní položky se načítají pomocí JavaScriptu. Souhrny a historie jsou dostupné výše." : "Detailed line items load with JavaScript. Totals and history are available above."}</p></div><div class="profile-table-scroll"><table id="profile-detail"><thead><tr><th>Year</th><th>Stage</th><th>Side</th><th>Code / item</th><th>Amount</th></tr></thead><tbody>${details.map((row) => `<tr><td>${escapeHTML(row.year || "")}</td><td>${escapeHTML(row.stage || "")}</td><td>${escapeHTML(row.side || "")}</td><td><b>${escapeHTML(row.code || "")}</b><small>${escapeHTML(row.name_native || row.name || row.column || "")}</small></td><td>${money(row.amount, view.currency, lang, false)}</td></tr>`).join("")}</tbody></table></div></section></section>
      <section class="data-contract" id="metodika"><div><span class="kicker">${labels.sources}</span><h2>${labels.sources}</h2><p>${labels.sourceCopy}</p></div><div class="source-list"><a href="${source}" rel="noopener" target="_blank"><span>${labels.sources}</span><strong>Open ↗</strong></a><a href="${escapeHTML(profileEndpoint)}"><span>${labels.machine}</span><strong>JSON ↗</strong></a></div></section>
    </main>
    <footer data-global-footer></footer>
  </body>
</html>`;
}

function profileView(payload = {}, historyPayload = null) {
  if (payload.entity) {
    const entity = payload.entity;
    const amounts = entity.amounts || {};
    const rows = (historyPayload?.series || []).map((row) => ({ year: row.year, revenue: row.revenue_actual, expenditure: row.expense_actual, balance: row.budget_balance, cash: row.cash_current }));
    const latest = { year: entity.fiscal_year || payload.period?.fiscal_year, revenue: amounts.revenue_actual, expenditure: amounts.expense_actual, balance: amounts.budget_balance, cash: amounts.cash_current };
    if (!rows.some((row) => row.year === latest.year)) rows.push(latest);
    return { latest, history: rows, detail: [], currency: entity.currency_code || "CZK", region: entity.territory?.region_name,
      sourceUrl: entity.sources?.budget || payload.sources?.budget };
  }
  const sourceRows = Array.isArray(payload.history) && payload.history.length ? payload.history : (historyPayload?.series || []);
  const rows = sourceRows.map((row) => ({ ...row, revenue: row.revenue ?? row.revenue_actual,
    expenditure: row.expenditure ?? row.expense_actual, balance: row.balance ?? row.budget_balance,
    cash: row.cash ?? row.cash_current }));
  const latest = payload.latest || rows.at(-1) || { year: payload.years?.at(-1) };
  return { latest, history: rows.length ? rows : [latest], detail: payload.detail || payload.breakdown || [], currency: payload.currency,
    region: payload.region, sourceUrl: payload.source_url };
}

function money(value, currency, lang, compact = true) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  try {
    return escapeHTML(new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB", { style: "currency", currency: currency || "EUR", notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 2 : 0 }).format(amount));
  } catch {
    return escapeHTML(new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB", { notation: compact ? "compact" : "standard", maximumFractionDigits: 2 }).format(amount));
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}
