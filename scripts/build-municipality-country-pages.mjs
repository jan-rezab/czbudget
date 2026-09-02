import { mkdir, readFile, writeFile } from "node:fs/promises";

const origin="https://publicspendingdata.org";
const pages={
  germany:{code:"DEU",title:"German municipalities",description:"2025 adjusted receipts, payments and balances for all 10,756 German municipal core budgets."},
  poland:{code:"POL",title:"Polish municipalities",description:"Coverage, accounting stages and a searchable directory of all Polish gminas."},
  denmark:{code:"DNK",title:"Danish municipalities",description:"Budgets, final accounts and a searchable directory of all 98 Danish municipalities."},
  france:{code:"FRA",title:"French municipalities",description:"2025 revenue, expenditure, surplus and deficit rankings with a budget-sized directory of all 34,875 French communes."},
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
  const france=page.code==="FRA";
  const rankingNav=france?'<a href="#budget-rankings" data-copy="navRankings">Rozpočtové žebříčky</a>':'';
  const rankingSection=france?`\n    <section id="budget-rankings" class="municipal-section municipal-budget-rankings" aria-labelledby="budget-rankings-title"><div class="section-heading"><div><span class="kicker" data-copy="rankingsKicker">Rozpočtové žebříčky</span><h2 id="budget-rankings-title" data-copy="rankingsTitle">Největší rozpočty, přebytky a schodky</h2></div><p data-copy="rankingsCopy">Skutečné výdaje ukazují velikost rozpočtu. Přebytek a schodek jsou příjmy minus výdaje za jediný rok, nikoli známka kvality vedení.</p></div><div class="municipal-balance-split" id="municipal-balance-split" aria-live="polite"></div><div class="municipal-ranking-grid" id="municipal-ranking-grid" aria-live="polite"></div><p class="france-ranking-note" data-copy="rankingsNote">„Dobré“ a „špatné“ zde znamená pouze přebytek nebo schodek v jediném roce. Schodek může financovat plánovanou investici z dřívějších úspor.</p></section>`:'';
  const directoryControls=france?`<div class="france-search-lead"><label for="country-municipality-search" data-copy="searchLabel">Hledat obec</label><div><input id="country-municipality-search" type="search" autocomplete="off" data-placeholder="franceSearchPlaceholder" placeholder="Název, region nebo kód INSEE…"><button id="country-reset" type="button" data-copy="resetShort">Vymazat</button></div></div><div class="municipal-controls country-directory-controls france-directory-controls"><label><span data-copy="profileYear">Rok v profilu</span><select id="country-year-filter"></select></label><label><span data-copy="balanceFilter">Výsledek</span><select id="country-balance-filter"><option value="all" data-copy="allBalances">Přebytky i schodky</option><option value="surplus" data-copy="surplusOnly">Přebytky</option><option value="deficit" data-copy="deficitOnly">Schodky</option></select></label><label><span data-copy="sort">Řazení</span><select id="country-sort"><option value="expenditure" data-copy="sortBudget">Podle velikosti rozpočtu</option><option value="revenue" data-copy="sortRevenue">Podle příjmů</option><option value="balance" data-copy="sortBalance">Podle výsledku</option><option value="population" data-copy="sortPopulation">Podle počtu obyvatel</option><option value="name" data-copy="sortName">Podle názvu</option></select></label></div><p class="france-directory-order" data-copy="directoryOrderNote">Bez hledání jsou obce seřazené od největšího rozpočtu podle skutečných výdajů.</p>`:`<div class="municipal-controls country-directory-controls"><label><span data-copy="search">Hledat</span><input id="country-municipality-search" type="search" autocomplete="off" data-placeholder="searchPlaceholder" placeholder="Název nebo národní kód…"></label><label><span data-copy="year">Rok</span><select id="country-year-filter"></select></label><button id="country-reset" type="button" data-copy="reset">Vymazat filtry</button></div>`;
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
  <link rel="stylesheet" href="../../municipalities-navigator.css?v=20260902-searchable-picker">
  <link rel="stylesheet" href="../../oecd-charts.css?v=20260829-oecd-reports">
  <script src="../../municipality-country-picker.js?v=20260902-searchable-picker" defer></script>
  <script src="../../municipalities-country.js?v=20260902-searchable-picker" defer></script>
  <script src="../../oecd-charts.js?v=20260829-oecd-reports" defer></script>
  <meta property="og:image" content="https://publicspendingdata.org/assets/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Public Spending Data">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://publicspendingdata.org/assets/og.png">
</head>
<body class="municipalities-page country-municipalities-page${france?' france-municipalities-page':''}" data-country-code="${page.code}" data-country-slug="${slug}">
  <psd-site-header></psd-site-header>
  <main id="top">
    <nav class="municipality-switch" aria-label="Municipality views"><a href="../?lang=cs" data-view-link="europe" data-copy="viewEurope">Evropa</a><label class="active"><span data-copy="countryHomepage">Stránka země</span><select id="municipality-country-switch" aria-label="Stránka obcí podle země"></select></label></nav>
    <section class="municipal-hero${france?' france-hero':''}"><div><span class="eyebrow"><i class="live-dot"></i><span id="country-eyebrow">—</span></span><h1 id="country-title">—</h1><p id="country-intro">—</p></div><div class="municipal-hero-stat"><span data-copy="covered">Pokryté místní jednotky</span><strong id="country-total">—</strong><small id="country-coverage">—</small></div></section>
    <nav class="municipal-rail"><a href="#insights" data-copy="navInsights">Co data říkají</a>${rankingNav}<a id="budget-structure-nav" href="#budget-structure" data-copy="navStructure" hidden>Struktura rozpočtu</a><a id="tax-autonomy-nav" href="#tax-autonomy" data-copy="taxAutonomy">OECD · daňová pravomoc</a><a href="#directory" data-copy="navDirectory">Adresář</a><a href="#context" data-copy="navContext">Kontext a zdroj</a></nav>
    <section id="insights" class="municipal-section${france?' france-national-summary':''}"><div class="section-heading"><div><span class="kicker" data-copy="insightsKicker">Datový profil</span><h2 id="insights-title">—</h2></div><p id="insights-copy">—</p></div><div id="country-insight-grid" class="insight-grid"></div></section>
    ${rankingSection}
    <section id="budget-structure" class="municipal-section municipal-budget-structure" hidden><div class="section-heading"><div><span class="kicker" data-copy="structureKicker">Průměrný místní rozpočet</span><h2 data-copy="structureTitle">Složení průměrného místního rozpočtu</h2></div><p data-copy="structureCopy">Každý místní rozpočet má stejnou váhu, takže největší města nepřehluší okresní a menší obecní rozpočty.</p></div><div id="budget-structure-content"></div></section>
    <section id="tax-autonomy" class="municipal-section" hidden><div data-oecd-chart="autonomy_spectrum" data-hide-when-missing="true"></div></section>
    <section id="directory" class="municipal-section${france?' france-directory':''}"><div class="section-heading"><div><span class="kicker" data-copy="directoryKicker">${france?'Všech 34 875 obcí':'Místní úroveň'}</span><h2 data-copy="directoryTitle">Najděte obec</h2></div>${france?'<div class="france-directory-intro"><p data-copy="directoryIntro">Hledejte podle názvu, regionu nebo kódu INSEE. Každý výsledek vede na úplný finanční profil obce.</p><strong id="country-directory-count">—</strong></div>':'<p id="country-directory-count">—</p>'}</div>${directoryControls}<div id="country-municipality-grid" class="municipality-grid"></div><button id="country-load-more" class="load-more" type="button" data-copy="more">Načíst další</button></section>
    <section id="context" class="municipal-section"><div class="section-heading"><div><span class="kicker" data-copy="contextKicker">Co je uvnitř</span><h2 data-copy="contextTitle">Zdroj a rozsah dat</h2></div><p data-copy="contextCopy">U každého čísla uvádíme národní zdroj a účetní hranici.</p></div><div id="country-context-grid" class="country-context-grid"></div></section>
  </main>
  <footer data-global-footer></footer>
  <script src="../../global-footer.js?v=20260823-footer" defer></script>
</body>
</html>`;
  await mkdir(new URL(`../municipalities/${slug}/`,import.meta.url),{recursive:true});
  await writeFile(new URL(`../municipalities/${slug}/index.html`,import.meta.url),html);
}

async function refreshPickerAssets(path,depth,hostScript,oldVersion){
  const url=new URL(path,import.meta.url);
  let html=await readFile(url,"utf8");
  const prefix="../".repeat(depth);
  if(!html.includes("municipality-country-picker.js"))html=html.replace(`<script src="${prefix}${hostScript}`,`<script src="${prefix}municipality-country-picker.js?v=20260902-searchable-picker" defer></script>\n  <script src="${prefix}${hostScript}`);
  html=html.replace(/municipalities-navigator\.css\?v=[^"]+/,"municipalities-navigator.css?v=20260902-searchable-picker").replace(`${hostScript}?v=${oldVersion}`,`${hostScript}?v=20260902-searchable-picker`);
  await writeFile(url,html);
}

await refreshPickerAssets("../municipalities/czechia/index.html",2,"municipalities-czechia.js","20260827-history-currency");
await refreshPickerAssets("../municipalities/index.html",1,"municipalities.js","20260827-germany-routes");

const germanProfile=`<!doctype html><html lang="cs"><head><script src="/language-bootstrap.js?v=20260822-no-language-flash"></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>German municipal finances — Public Spending Data</title><meta name="description" content="Official 2025 municipal finance profile for a German municipality."><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="https://publicspendingdata.org/municipalities/germany/profile/"><link rel="alternate" hreflang="cs" href="https://publicspendingdata.org/municipalities/germany/profile/?lang=cs"><link rel="alternate" hreflang="en" href="https://publicspendingdata.org/municipalities/germany/profile/?lang=en"><meta property="og:type" content="website"><meta property="og:site_name" content="Public Spending Data"><meta property="og:title" content="German municipal finances — Public Spending Data"><meta property="og:description" content="Official 2025 municipal finance profile for a German municipality."><meta property="og:url" content="https://publicspendingdata.org/municipalities/germany/profile/"><meta property="og:image" content="https://publicspendingdata.org/assets/og.png"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":"German municipal finances","description":"Official 2025 municipality-level adjusted receipts, payments and fiscal balance.","url":"https://publicspendingdata.org/municipalities/germany/profile/","inLanguage":"cs","spatialCoverage":{"@type":"Country","name":"Germany"},"distribution":{"@type":"DataDownload","encodingFormat":"application/json","contentUrl":"../../../data/international-municipalities/DEU.v1.json"}}</script><link rel="icon" href="../../../assets/favicon.svg"><link rel="stylesheet" href="../../../site-header.css?v=20260824-header-lockup" data-psd-site-header><link rel="stylesheet" href="../../../styles.css"><link rel="stylesheet" href="../../../chart-system.css"><link rel="stylesheet" href="../../../municipalities.css"><link rel="stylesheet" href="../../../municipal-benchmark-profile.css"><link rel="stylesheet" href="../../../municipal-expanded-profile.css?v=20260828-fx-currency"><link rel="stylesheet" href="../../../global-footer.css"><script src="../../../global-nav.js?v=20260824-logo-120" defer></script><script src="../../../municipal-expanded-profile.js?v=20260828-fx-currency" defer></script><script src="../../../global-footer.js" defer></script></head><body class="municipalities-page benchmark-profile expanded-profile cz-budget-page detail-page international-municipality-profile" data-profile-url="../../../data/international-municipalities/DEU.v1.json" data-source="https://www.regionalstatistik.de/genesis/online?operation=table&amp;code=71717-Z-01"><psd-site-header data-section="cities"></psd-site-header><nav class="context-rail municipal-context-rail international-context-rail" aria-label="Sekce stránky"><a href="#overview">Přehled</a><a href="#metodika">Rozsah a zdroj</a></nav><main><nav class="breadcrumbs"><a href="../../">Obce</a><span>›</span><a href="../">Německo</a><span>›</span><strong>Profil obce</strong></nav><section class="detail-hero" id="overview"><div><span class="eyebrow"><i class="live-dot"></i>Německo · obecní finance</span><h1>Profil německé obce</h1><p>Vrstva za rok 2025 obsahuje očištěné příjmy a výdaje bez financování. Položkový městský rozpočet z těchto souhrnů nedopočítáváme.</p><div class="detail-actions"><a class="primary-button" href="#metodika">Rozsah dat <b>↓</b></a><a href="../../../data/international-municipalities/DEU.v1.json">Strojová data</a></div></div><aside class="detail-score"><span>Rozsah profilu</span><strong>2025</strong><small>souhrnné hodnoty</small></aside></section><section class="data-contract" id="metodika"><div><span class="kicker">Rozsah a zdroj</span><h2>Souhrnná data bez položkového detailu</h2><p>Konkrétní obec vybere parametr odkazu. Po načtení se zobrazí jen dostupné příjmy, výdaje a saldo; chybějící položky se neodhadují.</p></div><div class="source-list"><a href="https://www.regionalstatistik.de/genesis/online?operation=table&amp;code=71717-Z-01" target="_blank" rel="noopener"><span>Oficiální zdroj</span><strong>Otevřít ↗</strong></a><a href="../../../data/international-municipalities/DEU.v1.json"><span>Strojová data</span><strong>JSON ↗</strong></a></div></section></main><footer data-global-footer></footer></body></html>`;
await mkdir(new URL("../municipalities/germany/profile/",import.meta.url),{recursive:true});
await writeFile(new URL("../municipalities/germany/profile/index.html",import.meta.url),germanProfile);

const frenchProfile=germanProfile
  .replaceAll("German municipal finances","French municipal finances")
  .replaceAll("German municipality","French commune")
  .replaceAll("municipalities/germany/profile","municipalities/france/profile")
  .replaceAll("Germany","France")
  .replaceAll("Německo","Francie")
  .replaceAll("německé","francouzské")
  .replaceAll("2025 municipality-level adjusted receipts, payments and fiscal balance","2024–2025 OFGL main-budget revenue, expenditure, balance, operating accounts, savings and debt")
  .replaceAll("Official 2025 municipal finance profile","Official 2024–2025 OFGL finance profile")
  .replaceAll('contentUrl":"../../../data/international-municipalities/DEU.v1.json"','contentUrl":"../../../data/france-municipal-profiles/"')
  .replaceAll('municipal-expanded-profile.css?v=20260828-fx-currency','municipal-expanded-profile.css?v=20260829-france-lines')
  .replaceAll('municipal-expanded-profile.js?v=20260828-fx-currency','municipal-expanded-profile.js?v=20260829-france-lines')
  .replace('data-profile-url="../../../data/international-municipalities/DEU.v1.json"','data-profile-root="../../../data/france-municipal-profiles/"')
  .replace('data-source="https://www.regionalstatistik.de/genesis/online?operation=table&amp;code=71717-Z-01"','data-source="https://data.ofgl.fr/explore/dataset/ofgl-base-communes/"')
  .replaceAll("Vrstva za rok 2025 obsahuje očištěné příjmy a výdaje bez financování. Položkový městský rozpočet z těchto souhrnů nedopočítáváme.","OFGL publikuje skutečné účty hlavního rozpočtu za roky 2024–2025. Provozní souhrny, úspory a dluh zobrazujeme bez domýšlení položkového detailu.")
  .replaceAll("Profil německé obce","Profil francouzské obce");
await mkdir(new URL("../municipalities/france/profile/",import.meta.url),{recursive:true});
await writeFile(new URL("../municipalities/france/profile/index.html",import.meta.url),frenchProfile);

console.log(`Built ${selectedPages.length} municipality country pages`);
