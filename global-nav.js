(() => {
  const sharedComponents = window.PSDSharedComponents ||= {};
  if (sharedComponents.navigation?.refresh) {
    sharedComponents.navigation.refresh();
    return;
  }
  const scriptUrl = document.currentScript?.src || new URL("global-nav.js", location.href).href;
  const assetRoot = new URL(".", scriptUrl).href;
  function ensureSharedFooter() {
    const existing = document.querySelector("body > footer[data-global-footer]");
    if (existing) return existing;
    const legacyFooters = [...document.querySelectorAll("body > footer:not([data-global-footer])")];
    const footer = document.createElement("footer");
    footer.setAttribute("data-global-footer", "");
    legacyFooters.forEach((legacy) => {
      legacy.hidden = true;
      legacy.dataset.sharedComponentLegacy = "footer";
    });
    const anchor = legacyFooters.at(-1);
    if (anchor) anchor.insertAdjacentElement("afterend", footer);
    else document.body.append(footer);
    return footer;
  }
  const globalFooter = ensureSharedFooter();
  globalFooter.dataset.sharedComponent = "footer";
  const compactFooterStyles = `${assetRoot}global-footer.css?v=20260825-shared-lifecycle`;
  const existingFooterStyles = document.querySelector('link[href*="global-footer.css"]');
  if (existingFooterStyles) existingFooterStyles.href = compactFooterStyles;
  else {
    const footerStyles = document.createElement("link");
    footerStyles.rel = "stylesheet";
    footerStyles.href = compactFooterStyles;
    document.head.append(footerStyles);
  }
  const loadCompactFooter = () => {
    if (sharedComponents.footer?.render) {
      sharedComponents.footer.render();
      return;
    }
    if (document.querySelector('script[src*="global-footer.js"]')) return;
    const footerScript = document.createElement("script");
    footerScript.src = `${assetRoot}global-footer.js?v=20260825-shared-lifecycle`;
    footerScript.dataset.sharedComponentLoader = "footer";
    document.head.append(footerScript);
  };
  loadCompactFooter();
  const portalStylesHref = `${assetRoot}portal-ui.css?v=20260824-logo-120`;
  const existingPortalStyles = document.querySelector("link[data-portal-ui]");
  if (existingPortalStyles) { if (new URL(existingPortalStyles.getAttribute("href"), location.href).href !== new URL(portalStylesHref, location.href).href) existingPortalStyles.href = portalStylesHref; }
  else { const styles = document.createElement("link"); styles.rel = "stylesheet"; styles.href = portalStylesHref; styles.dataset.portalUi = "true"; document.head.append(styles); }
  if (!document.querySelector("script[data-portal-ui]")) { const script = document.createElement("script"); script.src = `${assetRoot}portal-ui.js?v=20260823`; script.defer = true; script.dataset.portalUi = "true"; document.head.append(script); }
  if (!document.querySelector("link[data-ux-refinements]")) { const styles = document.createElement("link"); styles.rel = "stylesheet"; styles.href = `${assetRoot}ux-refinements.css?v=20260827`; styles.dataset.uxRefinements = "true"; document.head.append(styles); }
  const HEADER_TAG = "psd-site-header";
  let countries = [
    ["CZE", "Česko", "Czechia", "cz"], ["DEU", "Německo", "Germany", "de"],
    ["DNK", "Dánsko", "Denmark", "dk"], ["FIN", "Finsko", "Finland", "fi"], ["FRA", "Francie", "France", "fr"],
    ["GBR", "Spojené království", "United Kingdom", "gb"], ["POL", "Polsko", "Poland", "pl"],
    ["SWE", "Švédsko", "Sweden", "se"], ["CHE", "Švýcarsko", "Switzerland", "ch"],
    ["UKR", "Ukrajina", "Ukraine", "ua"], ["USA", "Spojené státy", "United States", "us"],
    ["BRA", "Brazílie", "Brazil", "br"], ["ESP", "Španělsko", "Spain", "es"],
    ["JPN", "Japonsko", "Japan", "jp"], ["NLD", "Nizozemsko", "Netherlands", "nl"],
    ["NOR", "Norsko", "Norway", "no"], ["GRC", "Řecko", "Greece", "gr"]
  ];
  const municipalityCountries = [
    ["BOL", "Bolívie", "Bolivia", "bo", "bolivia"], ["BRA", "Brazílie", "Brazil", "br", "brazil"],
    ["CHL", "Chile", "Chile", "cl", "chile"], ["COL", "Kolumbie", "Colombia", "co", "colombia"],
    ["CRI", "Kostarika", "Costa Rica", "cr", "costa-rica"], ["CZE", "Česko", "Czechia", "cz", "czechia"],
    ["DNK", "Dánsko", "Denmark", "dk", "denmark"], ["SLV", "Salvador", "El Salvador", "sv", "el-salvador"],
    ["GBR", "Anglie", "England", "gb", "england"], ["FIN", "Finsko", "Finland", "fi", "finland"],
    ["FRA", "Francie", "France", "fr", "france"], ["GEO", "Gruzie", "Georgia", "ge", "georgia"],
    ["DEU", "Německo", "Germany", "de", "germany"], ["GTM", "Guatemala", "Guatemala", "gt", "guatemala"],
    ["ITA", "Itálie", "Italy", "it", "italy"], ["JPN", "Japonsko", "Japan", "jp", "japan"],
    ["MEX", "Mexiko", "Mexico", "mx", "mexico"], ["NLD", "Nizozemsko", "Netherlands", "nl", "netherlands"],
    ["NOR", "Norsko", "Norway", "no", "norway"], ["PER", "Peru", "Peru", "pe", "peru"],
    ["POL", "Polsko", "Poland", "pl", "poland"], ["KOR", "Jižní Korea", "South Korea", "kr", "south-korea"],
    ["ESP", "Španělsko", "Spain", "es", "spain"], ["SWE", "Švédsko", "Sweden", "se", "sweden"],
    ["CHE", "Švýcarsko", "Switzerland", "ch", ""], ["UKR", "Ukrajina", "Ukraine", "ua", "ukraine"],
    ["USA", "Spojené státy", "United States", "us", ""]
  ];
  const countrySlugs = {CZE:"czechia",DEU:"germany",DNK:"denmark",FIN:"finland",FRA:"france",GBR:"united-kingdom",POL:"poland",SWE:"sweden",CHE:"switzerland",UKR:"ukraine",USA:"united-states",BRA:"brazil",ESP:"spain",JPN:"japan",NLD:"netherlands",NOR:"norway",GRC:"greece"};
  const copy = {
    cs: { home:"Domů", compare:"Srovnání", map:"Mapa", cities:"Obce a města", country:"Země", deepDives:"Reporty", stories:"Příběhy", method:"Pokrytí", about:"O projektu", all:"Všechny profily", allMunicipalities:"Všechny obce", allDeepDives:"Všechny reporty",                                 czechBudget:"Český státní rozpočet", navigation:"Hlavní navigace", language:"Jazyk", searchCountry:"Hledat zemi", searchMunicipality:"Hledat obecní zemi", searchCountryPlaceholder:"Název země…", countryMatches:"profilů", municipalityMatches:"zemí", noCountryMatches:"Žádná země neodpovídá." },
    en: { home:"Home", compare:"Compare", map:"Map", cities:"Municipalities", country:"Country", deepDives:"Reports", stories:"Stories", method:"Coverage", about:"About", all:"All profiles", allMunicipalities:"All municipalities", allDeepDives:"All reports",                                 czechBudget:"Czech state budget", navigation:"Primary navigation", language:"Language", searchCountry:"Search countries", searchMunicipality:"Search municipality countries", searchCountryPlaceholder:"Country name…", countryMatches:"profiles", municipalityMatches:"countries", noCountryMatches:"No countries match." }
  };
  Object.assign(copy.cs,{coverageDepth:"Hloubka dat",depthDirectory:"Adresář",depthHeadline:"Souhrnné finance",depthItemized:"Položkový rozpočet"});
  Object.assign(copy.en,{coverageDepth:"Data depth",depthDirectory:"Directory",depthHeadline:"Headline finance",depthItemized:"Itemized budget"});
  /* BEGIN GENERATED REPORT MENU */
  const reportMenuGroups = [{"id":"spend","title":{"cs":"Kam peníze jdou","en":"Where the money goes"},"reports":[{"slug":"education","path":"deep-dives/education/","title":{"cs":"Školství","en":"Education"}},{"slug":"health","path":"deep-dives/health/?code=CZE","title":{"cs":"Zdraví","en":"Health"}},{"slug":"transportation","path":"deep-dives/transportation/?code=CZE","title":{"cs":"Doprava","en":"Transportation"}},{"slug":"defense","path":"deep-dives/defense/?code=USA","title":{"cs":"Výdaje na obranu","en":"Defense spending"}},{"slug":"redistribution","path":"deep-dives/redistribution/?code=CZE","title":{"cs":"Daně, transfery a příjmová nerovnost","en":"Taxes, transfers and income inequality"}}]},{"id":"raise","title":{"cs":"Odkud peníze jsou","en":"Where the money comes from"},"reports":[{"slug":"funding","path":"deep-dives/funding/","title":{"cs":"Jak peníze dorazí ke službám","en":"How money reaches services"}},{"slug":"revenue","path":"deep-dives/revenue/?code=CZE","title":{"cs":"Odkud stát bere peníze","en":"Where the state gets its money"}},{"slug":"tax-burden","path":"deep-dives/tax-burden/?code=CZE","title":{"cs":"Daňové zatížení","en":"Tax burden"}},{"slug":"eu-budget","path":"deep-dives/eu-budget/?code=CZE","title":{"cs":"Peníze mezi zeměmi a EU","en":"Money between countries and the EU"}}]},{"id":"economy","title":{"cs":"Ekonomika, průmysl a obchod","en":"Economy, industry and trade"},"reports":[{"slug":"job-market","path":"deep-dives/job-market/?country=USA","title":{"cs":"Kde lidé pracují a kdo je zaměstnává","en":"Where people work and who employs them"}},{"slug":"economy","path":"deep-dives/economy/?code=CZE","title":{"cs":"Ekonomika v kontextu","en":"Economy in context"}},{"slug":"industry","path":"deep-dives/industry/?code=CZE&channel=eurostat","title":{"cs":"Průmysl měsíc po měsíci","en":"Industry month by month"}},{"slug":"industrial-diagnostics","path":"deep-dives/industry/diagnostics/","title":{"cs":"Uvnitř průmyslu","en":"Inside industry"}},{"slug":"trade","path":"deep-dives/trade/?code=DEU","title":{"cs":"Zahraniční obchod","en":"Foreign trade"}},{"slug":"energy-trade","path":"deep-dives/energy-trade/","title":{"cs":"Světový obchod s ropou a plynem","en":"World oil and gas trade"}},{"slug":"russia-trade","path":"deep-dives/russia-trade/","title":{"cs":"Obchod kolem Ruska","en":"Trade around Russia"}},{"slug":"automotive","path":"deep-dives/automotive/","title":{"cs":"Automobilový průmysl","en":"Automotive"}},{"slug":"product-markets","path":"deep-dives/product-markets/","title":{"cs":"Globální produktové trhy","en":"Global product markets"}},{"slug":"digital-spillover","path":"deep-dives/digital-spillover/","title":{"cs":"Kdo si ponechá digitální ekonomiku?","en":"Who keeps the digital economy?"}}]},{"id":"society","title":{"cs":"Společnost a stát","en":"Society and the state"},"reports":[{"slug":"ageing","path":"deep-dives/ageing/?code=CZE","title":{"cs":"Stárnutí populace","en":"Population ageing"}},{"slug":"migration","path":"deep-dives/migration/","title":{"cs":"Evropská migrace","en":"European migration"}},{"slug":"european-politics","path":"deep-dives/european-politics/?code=CZE","title":{"cs":"Evropská politika","en":"European politics"}},{"slug":"state-owned-enterprises","path":"deep-dives/state-owned-enterprises/","title":{"cs":"Státní podniky","en":"State-owned enterprises"}},{"slug":"capital-cities","path":"deep-dives/capital-cities/?city=prague-cz","title":{"cs":"Hlavní města","en":"Capital cities"}},{"slug":"rosling","path":"deep-dives/rosling/","title":{"cs":"Pocta Hansi Roslingovi","en":"A tribute to Hans Rosling"}}]},{"id":"cz","title":{"cs":"Česko","en":"Czechia"},"reports":[{"slug":"budget-planner","path":"deep-dives/budget-planner/","title":{"cs":"Plánovač rozpočtu 2027","en":"2027 budget planner"}},{"slug":"public-employment","path":"deep-dives/public-employment/","title":{"cs":"Veřejná zaměstnanost","en":"Public employment"}},{"slug":"money-cze","path":"deep-dives/money/cze/","title":{"cs":"Kam šly peníze? Česko","en":"Where did the money go? Czechia"}},{"slug":"plzen-contracts","path":"deep-dives/plzen-contracts/","title":{"cs":"Plzeň: smlouvy a skutečné platby","en":"Plzeň: contracts and actual payments"}}]},{"id":"us","title":{"cs":"Spojené státy","en":"United States"},"reports":[{"slug":"money-usa","path":"deep-dives/money/usa/","title":{"cs":"Kam šly peníze? Spojené státy","en":"Where did the money go? United States"}}]}];
/* END GENERATED REPORT MENU */
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  const href = (path, lang = language()) => `${assetRoot}${path}${path.includes("?") ? "&" : "?"}lang=${lang}`;
  const countryHref = (code, lang = language()) => window.PSDCountryRoutes?.href
    ? window.PSDCountryRoutes.href(code, lang)
    : `/countries/${countrySlugs[code] || String(code).toLowerCase()}?lang=${lang}`;
  const flagEmoji = (iso2) => String(iso2 || "").toUpperCase().replace(/[A-Z]/g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
  // These levels mirror the published municipal contracts: a searchable directory,
  // municipality-level headline finance, and native itemized budget lines.
  const itemizedMunicipalities = new Set(["BOL","BRA","CHL","CZE","DNK","SLV","FIN","FRA","GEO","GTM","ITA","JPN","MEX","NLD","NOR","PER","ESP"]);
  const headlineMunicipalities = new Set(["COL","CRI","DEU","KOR","USA"]);
  const municipalityDepth = (code) => itemizedMunicipalities.has(code) ? 3 : headlineMunicipalities.has(code) ? 2 : 1;
  const depthIcon = (depth, t, legend = false) => {
    const labels = [t.depthDirectory, t.depthHeadline, t.depthItemized];
    return `<span class="municipal-depth municipal-depth-${depth}${legend ? " municipal-depth-legend" : ""}" aria-label="${labels[depth - 1]}" title="${labels[depth - 1]}"><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i>${legend ? `<em>${labels[depth - 1]}</em>` : ""}</span>`;
  };

  let coverageLoaded = false;
  // The coverage contract is 765 KB and only fills the country dropdown, so it loads once
  // the menu is first opened rather than on every page view, and stays cacheable.
  function loadCoverage() {
    if (coverageLoaded) return;
    coverageLoaded = true;
    fetch(`${assetRoot}data/country-parity.v1.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Country coverage ${response.status}`);
        return response.json();
      })
      .then((coverage) => {
        if (!Array.isArray(coverage.countries) || !coverage.countries.length) return;
        const flags = Object.fromEntries(countries.map(([code,,,flag]) => [code, flag]));
        countries = coverage.countries.map((country) => [country.country_code, country.name_cs, country.name_en, flags[country.country_code] || `:${country.iso2 || ""}`]);
        const menu = document.querySelector(`${HEADER_TAG} .country-menu:not(.municipality-menu)`);
        const open = Boolean(menu?.open), query = menu?.querySelector(".country-menu-search input")?.value || "";
        refresh();
        if (!open) return;
        const reopened = document.querySelector(`${HEADER_TAG} .country-menu:not(.municipality-menu)`);
        if (!reopened) return;
        reopened.open = true;
        const search = reopened.querySelector(".country-menu-search input");
        if (!search) return;
        search.value = query;
        search.dispatchEvent(new Event("input"));
        search.focus();
      })
      .catch(() => { coverageLoaded = false; });
  }

  function activeSection(host) {
    if (host.dataset.section) return host.dataset.section;
    const path = location.pathname;
    const page = path.split("/").pop() || "index.html";
    if (path.includes("/stories/")) return "stories";
    if (path.includes("/deep-dives/")) return "deep-dives";
    if (path.includes("/municipalities/") || path.includes("/cz/mesta/") || path.includes("/cz/municipalities/") || path.includes("/cz/kraje/") || ["municipalities.html", "eu-capitals.html", "cz-obce.html"].includes(page)) return "cities";
    if (path.includes("/countries/") || ["country.html", "cesky-rozpocet.html", "money-flow.html", "cesko.html"].includes(page)) return "country";
    if (page === "comparison.html") return "compare";
    if (page === "map.html") return "map";
    if (page === "methodology.html") return "method";
    if (page === "about.html") return "about";
    return "home";
  }

  class PsdSiteHeader extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = "true";
      this.renderShell();
      this.renderNavigation();
    }

    renderShell() {
      const municipal = document.body.classList.contains("cz-budget-page");
      const budget = location.pathname.endsWith("/cesky-rozpocet.html");
      this.innerHTML = `<header class="site-header compact-header has-global-nav${municipal ? " cz-header" : ""}">
        <a class="brand" id="${budget ? "budget-home-link" : "home-link"}" href="${href("")}" aria-label="Public Spending Data"><img class="brand-logo" src="${assetRoot}assets/logo-lockup.svg?v=20260824-archivo-lockup" width="190" height="48" alt="" aria-hidden="true"></a>
        <nav class="global-nav" aria-label=""></nav>
        <div class="lang-switch municipality-lang-switch municipal-lang-switch" role="group" aria-label=""><button type="button" data-lang="cs" data-budget-lang="cs" data-deep-lang="cs" aria-pressed="false">CS</button><span aria-hidden="true">/</span><button type="button" data-lang="en" data-budget-lang="en" data-deep-lang="en" aria-pressed="false">EN</button></div>
      </header>`;
      this.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        const menu = this.querySelector(".global-nav > details[open]");
        if (!menu) return;
        event.preventDefault();
        menu.open = false;
        menu.querySelector("summary")?.focus();
      });
    }

    renderNavigation() {
      const lang = language();
      const t = copy[lang];
      const nav = this.querySelector(".global-nav");
      if (!nav) return;
      const countryLinks = [...countries].sort((a,b)=>a[lang === "en" ? 2 : 1].localeCompare(b[lang === "en" ? 2 : 1],lang)).map(([code, cs, en, flag]) => `<a href="${countryHref(code,lang)}" data-country-code="${code}">${flag && !flag.startsWith(":") ? `<img src="${assetRoot}assets/flags/${flag}.svg" alt="" loading="lazy" decoding="async">` : `<i class="country-menu-flag-emoji" aria-hidden="true">${flagEmoji(flag.slice(1))}</i>`}<span>${lang === "en" ? en : cs}</span></a>`).join("");
      const municipalityLinks = municipalityCountries.map(([code, cs, en, flag, slug]) => {
        const destination = slug ? `${assetRoot}municipalities/${slug}/?lang=${lang}` : `${assetRoot}municipalities/?lang=${lang}&country=${code}#directory`;
        return `<a href="${destination}" data-country-code="${code}"><img src="${assetRoot}assets/flags/${flag}.svg" alt="" loading="lazy" decoding="async"><span>${lang === "en" ? en : cs}</span>${depthIcon(municipalityDepth(code), t)}</a>`;
      }).join("");
      const municipalityLegend = `<div class="municipal-depth-key"><strong>${t.coverageDepth}</strong>${depthIcon(1,t,true)}${depthIcon(2,t,true)}${depthIcon(3,t,true)}</div>`;
      const escapeText = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const reportGroups = reportMenuGroups.map(group => `<details class="report-menu-group" data-report-topic="${group.id}" open><summary><span>${escapeText(group.title[lang])}</span><span class="report-topic-count">${group.reports.length}</span><span class="menu-chevron" aria-hidden="true">⌄</span></summary><ul>${group.reports.map(report => `<li><a data-report-slug="${report.slug}" href="${href(report.path, lang)}">${escapeText(report.title[lang])}</a></li>`).join("")}</ul></details>`).join("");
      const reportsMenu = `<details class="reports-menu" data-global-nav="deep-dives"><summary><span class="menu-label">${t.deepDives}</span><span class="menu-chevron" aria-hidden="true">⌄</span></summary><div class="reports-menu-panel"><div class="reports-menu-head"><div><span>${lang === "cs" ? "Knihovna reportů" : "The report library"}</span><p>${lang === "cs" ? "Prozkoumejte veřejné peníze" : "Explore public money"}</p></div><a class="reports-menu-all" href="${href("deep-dives/", lang)}">${t.allDeepDives}<span aria-hidden="true">↗</span></a></div><div class="reports-menu-groups">${reportGroups}</div></div></details>`;
      const contextCountry = String(document.body.dataset.countryCode || "").toUpperCase();
      const methodologyHref = contextCountry
        ? `${href("methodology.html", lang)}&country=${encodeURIComponent(contextCountry)}#sources`
        : href("methodology.html", lang);
      nav.setAttribute("aria-label", t.navigation);
      nav.innerHTML = `<details class="country-menu" data-global-nav="country"><summary><span class="menu-label">${t.country}</span><span class="menu-chevron" aria-hidden="true">⌄</span></summary><div class="country-menu-panel"><div class="country-menu-head"><span>${t.country}</span><a href="${assetRoot}?lang=${lang}#countries">${t.all} →</a></div><label class="country-menu-search"><span>${t.searchCountry}</span><input type="search" autocomplete="off" spellcheck="false" placeholder="${t.searchCountryPlaceholder}"><output aria-live="polite">${countries.length} ${t.countryMatches}</output></label><p class="country-menu-empty" hidden>${t.noCountryMatches}</p><a class="capital-menu-feature" href="${href("cesky-rozpocet.html", lang)}"><b>CZ+</b><span>${t.czechBudget}</span></a><a class="capital-menu-feature" href="${href("money-flow.html", lang)}"><b>↗</b><span>${lang === "cs" ? "Sledujte tok peněz" : "Follow the money"}</span></a>${countryLinks}</div></details><details class="country-menu municipality-menu" data-global-nav="cities"><summary><span class="menu-label">${t.cities}</span><span class="menu-chevron" aria-hidden="true">⌄</span></summary><div class="country-menu-panel"><div class="country-menu-head"><span>${t.cities}</span><a href="${href("municipalities/", lang)}">${t.allMunicipalities} →</a></div><label class="country-menu-search"><span>${t.searchMunicipality}</span><input type="search" autocomplete="off" spellcheck="false" placeholder="${t.searchCountryPlaceholder}"><output aria-live="polite">${municipalityCountries.length} ${t.municipalityMatches}</output></label>${municipalityLegend}<p class="country-menu-empty" hidden>${t.noCountryMatches}</p>${municipalityLinks}</div></details><a href="${href("comparison.html", lang)}" data-global-nav="compare">${t.compare}</a><a href="${href("map.html", lang)}" data-global-nav="map">${t.map}</a>${reportsMenu}<a href="${href("stories/", lang)}" data-global-nav="stories">${t.stories}</a><a href="${methodologyHref}" data-global-nav="method">${t.method}</a><a href="${href("about.html", lang)}" data-global-nav="about">${t.about}</a>`;
      const active = activeSection(this);
      const activeItem = nav.querySelector(`[data-global-nav="${active}"]`);
      activeItem?.classList.add("active");
      if (activeItem?.matches("a")) activeItem.setAttribute("aria-current", "page");
      if (active === "country") nav.querySelector(".country-menu")?.classList.add("active");
      if (active === "cities") nav.querySelector(".municipality-menu")?.classList.add("active");
      const fold=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase(lang==="cs"?"cs":"en");
      nav.querySelectorAll(".country-menu").forEach(menu=>{
        const search=menu.querySelector(".country-menu-search input"),output=menu.querySelector(".country-menu-search output"),empty=menu.querySelector(".country-menu-empty"),links=[...menu.querySelectorAll("a[data-country-code]")],label=menu.classList.contains("municipality-menu")?t.municipalityMatches:t.countryMatches;
        const filter=()=>{const query=fold(search?.value),visible=links.filter(link=>{const match=!query||fold(link.textContent).includes(query);link.hidden=!match;return match;});if(output)output.textContent=`${visible.length} ${label}`;if(empty)empty.hidden=visible.length!==0;return visible;};
        search?.addEventListener("input",filter);
        search?.addEventListener("keydown",event=>{if(event.key==="Enter"){const visible=filter();if(visible.length===1){event.preventDefault();visible[0].click();}}else if(event.key==="Escape"){event.preventDefault();if(search.value){search.value="";filter();}else{menu.open=false;menu.querySelector("summary")?.focus();}}});
      });
      // Topic accordions keep a small-screen menu short; the desktop menu shows all links.
      this.reportMedia?.removeEventListener("change", this.syncReportTopics);
      this.reportMedia = matchMedia("(max-width: 600px)");
      this.syncReportTopics = () => nav.querySelectorAll(".report-menu-group").forEach(group => { group.open = !this.reportMedia.matches; });
      this.syncReportTopics();
      this.reportMedia.addEventListener("change", this.syncReportTopics);
      const currentPath = location.pathname.replace(/index\.html$/, "");
      nav.querySelectorAll(".reports-menu-panel a").forEach(link => {
        if (new URL(link.href).pathname.replace(/index\.html$/, "") === currentPath) link.setAttribute("aria-current", "page");
      });
      this.querySelector(".lang-switch")?.setAttribute("aria-label", t.language);
      const languagePending = document.documentElement.hasAttribute("data-language-pending");
      this.querySelectorAll("[data-lang]").forEach((button) => {
        const selected = button.dataset.lang === lang;
        // The paint guard treats an active language control as proof that the
        // page translator has finished. Do not claim readiness on its behalf.
        button.classList.toggle("active", selected && !languagePending);
        button.setAttribute("aria-pressed", String(selected));
      });
      this.querySelector(".brand")?.setAttribute("href", href("", lang));
      nav.querySelectorAll(":scope > details").forEach((details) => details.addEventListener("toggle", () => {
        if (!details.open) return;
        if (details.matches(".country-menu:not(.municipality-menu)")) loadCoverage();
        nav.querySelectorAll(":scope > details[open]").forEach((other) => { if (other !== details) other.open = false; });
        const close = (event) => { if (!details.contains(event.target)) { details.open = false; document.removeEventListener("pointerdown", close); } };
        setTimeout(() => document.addEventListener("pointerdown", close), 0);
      }));
      document.dispatchEvent(new CustomEvent("psd:shared-header-ready", { detail: { host: this } }));
    }
  }

  const headerStylesHref = `${assetRoot}site-header.css?v=20260927-report-submenus`;
  const existingHeaderStyles = document.querySelector("link[data-psd-site-header]") || document.querySelector('link[rel="stylesheet"][href*="site-header.css"]');
  if (existingHeaderStyles) {
    // Older open pages can still reference the old header CSS. Upgrade its cache key
    // when the new navigation loads; preserve staging's content-addressed URLs.
    existingHeaderStyles.dataset.psdSiteHeader = "true";
    const version = new URL(existingHeaderStyles.href).searchParams.get("v") || "";
    if (!/^[a-f0-9]{16,}$/.test(version) && version !== "20260927-report-submenus") existingHeaderStyles.href = headerStylesHref;
  } else {
    const styles = document.createElement("link");
    styles.rel = "stylesheet";
    styles.href = headerStylesHref;
    styles.dataset.psdSiteHeader = "true";
    document.head.append(styles);
  }
  if (!customElements.get(HEADER_TAG)) customElements.define(HEADER_TAG, PsdSiteHeader);

  function ensureSharedHeader() {
    const existing = document.querySelector(HEADER_TAG);
    if (existing) return existing;
    const legacy = document.querySelector("body > header.site-header.has-global-nav, body > header.site-header.cz-header");
    const host = document.createElement(HEADER_TAG);
    if (legacy) {
      legacy.hidden = true;
      legacy.dataset.sharedComponentLegacy = "header";
      legacy.insertAdjacentElement("beforebegin", host);
    } else {
      const main = document.querySelector("body > main");
      if (main) main.insertAdjacentElement("beforebegin", host);
      else document.body.prepend(host);
    }
    return host;
  }
  ensureSharedHeader();
  const refresh = () => {
    ensureSharedFooter();
    ensureSharedHeader();
    document.querySelectorAll(HEADER_TAG).forEach((host) => host.renderNavigation());
    sharedComponents.footer?.render?.();
  };
  document.addEventListener("click", (event) => {
    const languageControl = event.target.closest("[data-lang],[data-budget-lang],[data-deep-lang]");
    if (!languageControl) return;
    if (location.pathname.startsWith("/cz/") && languageControl.dataset.lang) {
      try { localStorage.setItem("psd-lang", languageControl.dataset.lang); } catch {}
      const next = new URL(location.href);
      next.searchParams.set("lang", languageControl.dataset.lang);
      location.href = `${next.pathname}${next.search}${next.hash}`;
      return;
    }
    setTimeout(() => {
      const requested = languageControl.dataset.lang || languageControl.dataset.budgetLang || languageControl.dataset.deepLang;
      // Older pages translate in their own click handlers. Pages that only listen
      // for language events still need a working toggle: load their translated
      // page while retaining its selected country, filters and section.
      if (["cs", "en"].includes(requested) && language() !== requested) {
        try { localStorage.setItem("psd-lang", requested); } catch {}
        const next = new URL(location.href);
        next.searchParams.set("lang", requested);
        location.href = `${next.pathname}${next.search}${next.hash}`;
        return;
      }
      document.querySelectorAll(HEADER_TAG).forEach((host) => host.renderNavigation());
    }, 0);
  });
  const languageObserver = new MutationObserver(() => {
    if (document.documentElement.lang === document.documentElement.dataset.navLang) return;
    document.documentElement.dataset.navLang = document.documentElement.lang;
    document.querySelectorAll(HEADER_TAG).forEach((host) => host.renderNavigation());
  });
  languageObserver.observe(document.documentElement, { attributes:true, attributeFilter:["lang"] });
  document.documentElement.dataset.navLang = document.documentElement.lang;
  sharedComponents.navigation = { refresh, observer: languageObserver, loadCoverage };

  const contextRail = document.querySelector(".context-rail");
  if (contextRail) {
    // The country dashboard replaces the rail markup after this script runs, so the
    // spy re-binds whenever the rail is regenerated and marks the active link with the
    // aria-current value the stylesheet matches.
    let targets = [];
    const updateRail = () => {
      const current = [...targets].reverse().find(({ section }) => section.getBoundingClientRect().top <= 150) || targets[0];
      targets.forEach(({ link, section }) => {
        if (section === current?.section) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const bindRail = () => {
      targets = [...contextRail.querySelectorAll("a")]
        .map((link) => ({ link, section: link.hash ? document.getElementById(link.hash.slice(1)) : null }))
        .filter(({ section }) => section);
      updateRail();
    };
    bindRail();
    new MutationObserver(bindRail).observe(contextRail, { childList:true });
    addEventListener("scroll", updateRail, { passive:true });
  }
})();
