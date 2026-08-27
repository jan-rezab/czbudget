import { mkdir, writeFile } from "node:fs/promises";

const origin="https://publicspendingdata.org";
const pages={
  germany:{code:"DEU",title:"German municipalities",description:"2025 adjusted receipts, payments and balances for all 10,756 German municipal core budgets."},
  poland:{code:"POL",title:"Polish municipalities",description:"Coverage, accounting stages and a searchable directory of all Polish gminas."},
  denmark:{code:"DNK",title:"Danish municipalities",description:"Budgets, final accounts and a searchable directory of all 98 Danish municipalities."},
  france:{code:"FRA",title:"French municipalities",description:"Coverage, accounting scope and a searchable directory of French communes."},
  sweden:{code:"SWE",title:"Swedish municipalities",description:"Costs, income, balance sheets and a searchable directory of all 290 Swedish municipalities."},
  england:{code:"GBR",title:"English local authorities",description:"Revenue outturn coverage and a searchable directory of English councils and the GLA."},
  ukraine:{code:"UKR",title:"Ukrainian municipalities",description:"Complete 2024–2025 coverage and a searchable directory of 1,467 Ukrainian territorial communities."},
  norway:{code:"NOR",title:"Norwegian municipalities",description:"Official municipal accounts and a searchable directory of Norwegian municipalities."},
  netherlands:{code:"NLD",title:"Dutch municipalities",description:"Official budget data and a searchable directory of Dutch municipalities."},
  finland:{code:"FIN",title:"Finnish municipalities",description:"Official municipal accounts and a searchable directory of Finnish municipalities."},
  brazil:{code:"BRA",title:"Brazilian municipalities",description:"SICONFI budget execution and a searchable directory of Brazilian municipalities."},
  spain:{code:"ESP",title:"Spanish municipalities",description:"CONPREL adopted budgets, liquidations and a searchable directory of Spanish municipalities."},
  japan:{code:"JPN",title:"Japanese municipalities",description:"Official e-Stat local public-finance settlements and a searchable directory of Japanese municipalities."},
  colombia:{code:"COL",title:"Colombian municipalities",description:"CUIPO municipal budgets, execution and a searchable directory of Colombian municipalities."},
  georgia:{code:"GEO",title:"Georgian municipalities",description:"Official municipal accounts and a searchable directory of Georgian municipalities."},
  italy:{code:"ITA",title:"Italian municipalities",description:"SIOPE cash receipts, payments and a searchable directory of Italian municipalities."},
  bolivia:{code:"BOL",title:"Bolivian local governments",description:"Official municipal budgets, execution and a searchable directory of Bolivian local governments."},
  "el-salvador":{code:"SLV",title:"Salvadoran municipalities",description:"SAFIM municipal budgets, execution and a searchable directory of Salvadoran municipalities."},
  mexico:{code:"MEX",title:"Mexican municipalities",description:"INEGI EFIPEM definitive annual municipal finances and a searchable directory of reporting Mexican municipalities."},
  "costa-rica":{code:"CRI",title:"Costa Rican municipalities",description:"CGR SIPP municipal revenue, spending and a searchable directory of all Costa Rican municipalities."},
  guatemala:{code:"GTM",title:"Guatemalan municipalities",description:"MINFIN SICOINGL municipal budgets, execution and a searchable directory of all Guatemalan municipalities."},
  peru:{code:"PER",title:"Peruvian municipalities",description:"MEF Consulta Amigable budgets, execution and a searchable directory of all Peruvian local governments."},
  "south-korea":{code:"KOR",title:"South Korean local governments",description:"Local Finance 365 settlements and a searchable directory of all South Korean local governments."},
  chile:{code:"CHL",title:"Chilean municipalities",description:"SINIM municipal revenue, expenditure and a searchable directory of all Chilean municipalities."}
};

const requested=new Set(process.argv.slice(2));
const selectedPages=Object.entries(pages).filter(([slug])=>requested.size===0||requested.has(slug));
for(const [slug,page] of selectedPages){
  const canonical=`${origin}/municipalities/${slug}/`;
  const html=`<!doctype html>
<html lang="cs">
<head>
  <script src="/language-bootstrap.js?v=20260822-no-language-flash"></script>
  <link rel="stylesheet" href="../../site-header.css?v=20260824-header-lockup" data-psd-site-header>
  <script src="../../global-nav.js?v=20260824-logo-120" defer></script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${page.title} — Public Spending Data</title>
  <meta name="description" content="${page.description}">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="cs" href="${canonical}?lang=cs">
  <link rel="alternate" hreflang="en" href="${canonical}?lang=en">
  <link rel="icon" href="../../assets/favicon.svg">
  <link rel="stylesheet" href="../../styles.css?v=20260822-brand">
  <link rel="stylesheet" href="../../chart-system.css?v=20260822-country-municipalities">
  <link rel="stylesheet" href="../../municipalities.css?v=20260823-layout-fix">
  <link rel="stylesheet" href="../../municipalities-navigator.css?v=20260826-budget-structure">
  <script src="../../municipalities-country.js?v=20260827-germany-routes" defer></script>
  <meta property="og:image" content="https://publicspendingdata.org/assets/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Public Spending Data">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://publicspendingdata.org/assets/og.png">
</head>
<body class="municipalities-page country-municipalities-page" data-country-code="${page.code}" data-country-slug="${slug}">
  <psd-site-header></psd-site-header>
  <main id="top">
    <nav class="municipality-switch" aria-label="Municipality views"><a href="../?lang=cs" data-view-link="europe" data-copy="viewEurope">Evropa</a><label class="active"><span data-copy="countryHomepage">Stránka země</span><select id="municipality-country-switch" aria-label="Stránka obcí podle země"></select></label></nav>
    <section class="municipal-hero"><div><span class="eyebrow"><i class="live-dot"></i><span id="country-eyebrow">—</span></span><h1 id="country-title">—</h1><p id="country-intro">—</p></div><div class="municipal-hero-stat"><span data-copy="covered">Pokryté místní jednotky</span><strong id="country-total">—</strong><small id="country-coverage">—</small></div></section>
    <nav class="municipal-rail"><a href="#insights" data-copy="navInsights">Co data říkají</a><a id="budget-structure-nav" href="#budget-structure" data-copy="navStructure" hidden>Struktura rozpočtu</a><a href="#directory" data-copy="navDirectory">Adresář</a><a href="#context" data-copy="navContext">Kontext a zdroj</a></nav>
    <section id="insights" class="municipal-section"><div class="section-heading"><div><span class="kicker" data-copy="insightsKicker">01 / Datový profil</span><h2 id="insights-title">—</h2></div><p id="insights-copy">—</p></div><div id="country-insight-grid" class="insight-grid"></div></section>
    <section id="budget-structure" class="municipal-section municipal-budget-structure" hidden><div class="section-heading"><div><span class="kicker" data-copy="structureKicker">02 / Průměrný místní rozpočet</span><h2 data-copy="structureTitle">Kam míří každých 100.</h2></div><p data-copy="structureCopy">Každý místní rozpočet má stejnou váhu, takže největší města nepřehluší okresní a menší obecní rozpočty.</p></div><div id="budget-structure-content"></div></section>
    <section id="directory" class="municipal-section"><div class="section-heading"><div><span class="kicker" data-copy="directoryKicker">03 / Místní úroveň</span><h2 data-copy="directoryTitle">Najděte konkrétní obec.</h2></div><p id="country-directory-count">—</p></div><div class="municipal-controls country-directory-controls"><label><span data-copy="search">Hledat</span><input id="country-municipality-search" type="search" autocomplete="off" data-placeholder="searchPlaceholder" placeholder="Název nebo národní kód…"></label><label><span data-copy="year">Rok</span><select id="country-year-filter"></select></label><button id="country-reset" type="button" data-copy="reset">Vymazat filtry</button></div><div id="country-municipality-grid" class="municipality-grid"></div><button id="country-load-more" class="load-more" type="button" data-copy="more">Načíst další</button></section>
    <section id="context" class="municipal-section"><div class="section-heading"><div><span class="kicker" data-copy="contextKicker">04 / Co je uvnitř</span><h2 data-copy="contextTitle">Rozsah zůstává viditelný.</h2></div><p data-copy="contextCopy">Národní zdroj a účetní hranice jsou součástí výsledku, ne poznámka pod čarou.</p></div><div id="country-context-grid" class="country-context-grid"></div></section>
  </main>
  <footer data-global-footer></footer>
  <script src="../../global-footer.js?v=20260823-footer" defer></script>
</body>
</html>`;
  await mkdir(new URL(`../municipalities/${slug}/`,import.meta.url),{recursive:true});
  await writeFile(new URL(`../municipalities/${slug}/index.html`,import.meta.url),html);
}

const germanProfile=`<!doctype html><html lang="cs"><head><script src="/language-bootstrap.js?v=20260822-no-language-flash"></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>German municipal finances — Public Spending Data</title><meta name="description" content="Official 2025 municipal finance profile for a German municipality."><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="https://publicspendingdata.org/municipalities/germany/profile/"><link rel="alternate" hreflang="cs" href="https://publicspendingdata.org/municipalities/germany/profile/?lang=cs"><link rel="alternate" hreflang="en" href="https://publicspendingdata.org/municipalities/germany/profile/?lang=en"><meta property="og:type" content="website"><meta property="og:site_name" content="Public Spending Data"><meta property="og:title" content="German municipal finances — Public Spending Data"><meta property="og:description" content="Official 2025 municipal finance profile for a German municipality."><meta property="og:url" content="https://publicspendingdata.org/municipalities/germany/profile/"><meta property="og:image" content="https://publicspendingdata.org/assets/og.png"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":"German municipal finances","description":"Official 2025 municipality-level adjusted receipts, payments and fiscal balance.","url":"https://publicspendingdata.org/municipalities/germany/profile/","inLanguage":"cs","spatialCoverage":{"@type":"Country","name":"Germany"},"distribution":{"@type":"DataDownload","encodingFormat":"application/json","contentUrl":"../../../data/international-municipalities/DEU.v1.json"}}</script><link rel="icon" href="../../../assets/favicon.svg"><link rel="stylesheet" href="../../../site-header.css?v=20260824-header-lockup" data-psd-site-header><link rel="stylesheet" href="../../../styles.css"><link rel="stylesheet" href="../../../chart-system.css"><link rel="stylesheet" href="../../../municipalities.css"><link rel="stylesheet" href="../../../municipal-benchmark-profile.css"><link rel="stylesheet" href="../../../municipal-expanded-profile.css?v=20260827-germany-summary"><link rel="stylesheet" href="../../../global-footer.css"><script src="../../../global-nav.js?v=20260824-logo-120" defer></script><script src="../../../municipal-expanded-profile.js?v=20260827-germany-summary" defer></script><script src="../../../global-footer.js" defer></script></head><body class="municipalities-page benchmark-profile expanded-profile" data-profile-url="../../../data/international-municipalities/DEU.v1.json" data-source="https://www.regionalstatistik.de/genesis/online?operation=table&amp;code=71717-Z-01"><psd-site-header data-section="cities"></psd-site-header><main><section class="municipal-profile-loading" aria-live="polite">Loading municipal profile…</section></main><footer data-global-footer></footer></body></html>`;
await mkdir(new URL("../municipalities/germany/profile/",import.meta.url),{recursive:true});
await writeFile(new URL("../municipalities/germany/profile/index.html",import.meta.url),germanProfile);

console.log(`Built ${selectedPages.length} municipality country pages`);
