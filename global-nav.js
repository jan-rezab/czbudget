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
  if (existingPortalStyles) existingPortalStyles.href = portalStylesHref;
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
    ["NOR", "Norsko", "Norway", "no"], ["GRC", "Řecko", "Greece", "gr"],
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
    ["USA", "Spojené státy", "United States", "us", ""],
  ];
  const countrySlugs = {CZE:"czechia",DEU:"germany",DNK:"denmark",FIN:"finland",FRA:"france",GBR:"united-kingdom",POL:"poland",SWE:"sweden",CHE:"switzerland",UKR:"ukraine",USA:"united-states",BRA:"brazil",ESP:"spain",JPN:"japan",NLD:"netherlands",NOR:"norway",GRC:"greece"};
  const copy = {
    cs: { home:"Domů", compare:"Srovnání", cities:"Obce a města", country:"Země", deepDives:"Reporty", method:"Pokrytí", about:"O projektu", all:"Všechny profily", allMunicipalities:"Všechny obce", allDeepDives:"Všechny reporty", education:"Školství", educationCopy:"Od ministerstva k typu školy", transport:"Doprava", transportCopy:"Rozpočty, silnice a tempo výstavby", health:"Zdraví", healthCopy:"Financování a kapacita systému", stateCompanies:"Státní podniky", stateCompaniesCopy:"30 podniků, výnosy v EUR", capitalCities:"Hlavní města", capitalCitiesCopy:"Rozpočtové plány, obyvatelé a turistický tlak", revenue:"Kdo financuje stát?", revenueCopy:"Daně, úrovně vlády a transfery", ageing:"Účet stárnutí", ageingCopy:"Projekce a demografická kalkulačka", migration:"Evropská migrace", migrationCopy:"27 zemí, příchody, odchody a saldo", economy:"Ekonomika v kontextu", economyCopy:"Dlouhé řady, hospodářský cyklus a fiskální kontext", defense:"Výdaje na obranu", defenseCopy:"17 zemí, % HDP a rozpočtové řádky", czechBudget:"Český státní rozpočet", navigation:"Hlavní navigace", language:"Jazyk", searchCountry:"Hledat zemi", searchMunicipality:"Hledat obecní zemi", searchCountryPlaceholder:"Název země…", countryMatches:"profilů", municipalityMatches:"zemí", noCountryMatches:"Žádná země neodpovídá." },
    en: { home:"Home", compare:"Compare", cities:"Municipalities", country:"Country", deepDives:"Reports", method:"Coverage", about:"About", all:"All profiles", allMunicipalities:"All municipalities", allDeepDives:"All reports", education:"Education", educationCopy:"From ministry to school type", transport:"Transportation", transportCopy:"Budgets, roads and build pace", health:"Health", healthCopy:"Funding and system capacity", stateCompanies:"State-owned enterprises", stateCompaniesCopy:"30 enterprises, revenue in EUR", capitalCities:"Capital cities", capitalCitiesCopy:"Budget plans, residents and visitor pressure", revenue:"Who funds the state?", revenueCopy:"Taxes, government levels and transfers", ageing:"The Ageing Bill", ageingCopy:"Projections and demographic calculator", migration:"European migration", migrationCopy:"27 countries, arrivals, departures and balance", economy:"Economy in context", economyCopy:"Long-run series, the economic cycle and fiscal context", defense:"Defense spending", defenseCopy:"17 countries, % of GDP and budget lines", czechBudget:"Czech state budget", navigation:"Primary navigation", language:"Language", searchCountry:"Search countries", searchMunicipality:"Search municipality countries", searchCountryPlaceholder:"Country name…", countryMatches:"profiles", municipalityMatches:"countries", noCountryMatches:"No countries match." },
  };
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  const href = (path, lang = language()) => `${assetRoot}${path}${path.includes("?") ? "&" : "?"}lang=${lang}`;
  const countryHref = (code, lang = language()) => window.PSDCountryRoutes?.href
    ? window.PSDCountryRoutes.href(code, lang)
    : `/countries/${countrySlugs[code] || String(code).toLowerCase()}?lang=${lang}`;
  const flagEmoji = (iso2) => String(iso2 || "").toUpperCase().replace(/[A-Z]/g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));

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
    if (path.includes("/deep-dives/")) return "deep-dives";
    if (path.includes("/municipalities/") || path.includes("/cz/mesta/") || path.includes("/cz/municipalities/") || path.includes("/cz/kraje/") || ["municipalities.html", "eu-capitals.html", "cz-obce.html"].includes(page)) return "cities";
    if (path.includes("/countries/") || ["country.html", "cesky-rozpocet.html", "cesko.html"].includes(page)) return "country";
    if (page === "comparison.html") return "compare";
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
    }

    renderNavigation() {
      const lang = language();
      const t = copy[lang];
      const nav = this.querySelector(".global-nav");
      if (!nav) return;
      const countryLinks = countries.map(([code, cs, en, flag]) => `<a href="${countryHref(code,lang)}" data-country-code="${code}">${flag && !flag.startsWith(":") ? `<img src="${assetRoot}assets/flags/${flag}.svg" alt="">` : `<i class="country-menu-flag-emoji" aria-hidden="true">${flagEmoji(flag.slice(1))}</i>`}<span>${lang === "en" ? en : cs}</span></a>`).join("");
      const municipalityLinks = municipalityCountries.map(([code, cs, en, flag, slug]) => {
        const destination = slug ? `${assetRoot}municipalities/${slug}/?lang=${lang}` : `${assetRoot}municipalities/?lang=${lang}&country=${code}#directory`;
        return `<a href="${destination}" data-country-code="${code}"><img src="${assetRoot}assets/flags/${flag}.svg" alt=""><span>${lang === "en" ? en : cs}</span></a>`;
      }).join("");
      const contextCountry = String(document.body.dataset.countryCode || "").toUpperCase();
      const methodologyHref = contextCountry
        ? `${href("methodology.html", lang)}&country=${encodeURIComponent(contextCountry)}#sources`
        : href("methodology.html", lang);
      nav.setAttribute("aria-label", t.navigation);
      nav.innerHTML = `<details class="country-menu" data-global-nav="country"><summary><span class="menu-label">${t.country}</span><span class="menu-chevron" aria-hidden="true">⌄</span></summary><div class="country-menu-panel"><div class="country-menu-head"><span>${t.country}</span><a href="${assetRoot}?lang=${lang}#countries">${t.all} →</a></div><label class="country-menu-search"><span>${t.searchCountry}</span><input type="search" autocomplete="off" spellcheck="false" placeholder="${t.searchCountryPlaceholder}"><output aria-live="polite">${countries.length} ${t.countryMatches}</output></label><p class="country-menu-empty" hidden>${t.noCountryMatches}</p><a class="capital-menu-feature" href="${href("cesky-rozpocet.html", lang)}"><b>CZ+</b><span>${t.czechBudget}</span></a>${countryLinks}</div></details><details class="country-menu municipality-menu" data-global-nav="cities"><summary><span class="menu-label">${t.cities}</span><span class="menu-chevron" aria-hidden="true">⌄</span></summary><div class="country-menu-panel"><div class="country-menu-head"><span>${t.cities}</span><a href="${href("municipalities/", lang)}">${t.allMunicipalities} →</a></div><label class="country-menu-search"><span>${t.searchMunicipality}</span><input type="search" autocomplete="off" spellcheck="false" placeholder="${t.searchCountryPlaceholder}"><output aria-live="polite">${municipalityCountries.length} ${t.municipalityMatches}</output></label><p class="country-menu-empty" hidden>${t.noCountryMatches}</p>${municipalityLinks}</div></details><a href="${href("comparison.html", lang)}" data-global-nav="compare">${t.compare}</a><details class="deep-dive-menu"><summary><span class="menu-label">${t.deepDives}</span><span class="menu-chevron" aria-hidden="true">⌄</span></summary><div class="deep-dive-menu-panel"><div class="country-menu-head"><span>${t.deepDives}</span><a href="${href("deep-dives/", lang)}">${t.allDeepDives} →</a></div><a href="${assetRoot}deep-dives/education/?lang=${lang}"><b>01</b><span><strong>${t.education}</strong><small>${t.educationCopy}</small></span></a><a href="${assetRoot}deep-dives/transportation/?code=CZE&lang=${lang}"><b>02</b><span><strong>${t.transport}</strong><small>${t.transportCopy}</small></span></a><a href="${assetRoot}deep-dives/health/?code=CZE&lang=${lang}"><b>03</b><span><strong>${t.health}</strong><small>${t.healthCopy}</small></span></a><a href="${href("deep-dives/state-owned-enterprises/", lang)}"><b>04</b><span><strong>${t.stateCompanies}</strong><small>${t.stateCompaniesCopy}</small></span></a><a href="${assetRoot}deep-dives/capital-cities/?city=prague-cz&lang=${lang}"><b>05</b><span><strong>${t.capitalCities}</strong><small>${t.capitalCitiesCopy}</small></span></a><a href="${assetRoot}deep-dives/revenue/?code=CZE&lang=${lang}"><b>06</b><span><strong>${t.revenue}</strong><small>${t.revenueCopy}</small></span></a><a href="${assetRoot}deep-dives/ageing/?code=CZE&lang=${lang}"><b>07</b><span><strong>${t.ageing}</strong><small>${t.ageingCopy}</small></span></a><a href="${assetRoot}deep-dives/migration/?lang=${lang}"><b>08</b><span><strong>${t.migration}</strong><small>${t.migrationCopy}</small></span></a></div></details><a href="${methodologyHref}" data-global-nav="method">${t.method}</a><a href="${href("about.html", lang)}" data-global-nav="about">${t.about}</a>`;
      nav.querySelector(".deep-dive-menu-panel")?.insertAdjacentHTML("beforeend", `<a href="${assetRoot}deep-dives/economy/?code=CZE&lang=${lang}"><b>09</b><span><strong>${t.economy}</strong><small>${t.economyCopy}</small></span></a><a href="${assetRoot}deep-dives/defense/?code=USA&lang=${lang}"><b>10</b><span><strong>${t.defense}</strong><small>${t.defenseCopy}</small></span></a>`);
      const active = activeSection(this);
      nav.querySelector(`[data-global-nav="${active}"]`)?.classList.add("active");
      if (active === "country") nav.querySelector(".country-menu")?.classList.add("active");
      if (active === "cities") nav.querySelector(".municipality-menu")?.classList.add("active");
      if (active === "deep-dives") nav.querySelector(".deep-dive-menu")?.classList.add("active");
      const fold=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase(lang==="cs"?"cs":"en");
      nav.querySelectorAll(".country-menu").forEach(menu=>{
        const search=menu.querySelector(".country-menu-search input"),output=menu.querySelector(".country-menu-search output"),empty=menu.querySelector(".country-menu-empty"),links=[...menu.querySelectorAll("a[data-country-code]")],label=menu.classList.contains("municipality-menu")?t.municipalityMatches:t.countryMatches;
        const filter=()=>{const query=fold(search?.value),visible=links.filter(link=>{const match=!query||fold(link.textContent).includes(query);link.hidden=!match;return match;});if(output)output.textContent=`${visible.length} ${label}`;if(empty)empty.hidden=visible.length!==0;return visible;};
        search?.addEventListener("input",filter);
        search?.addEventListener("keydown",event=>{if(event.key==="Enter"){const visible=filter();if(visible.length===1){event.preventDefault();visible[0].click();}}else if(event.key==="Escape"){event.preventDefault();if(search.value){search.value="";filter();}else{menu.open=false;menu.querySelector("summary")?.focus();}}});
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
      nav.querySelectorAll("details").forEach((details) => details.addEventListener("toggle", () => {
        if (!details.open) return;
        if (details.matches(".country-menu:not(.municipality-menu)")) loadCoverage();
        nav.querySelectorAll("details[open]").forEach((other) => { if (other !== details) other.open = false; });
        const close = (event) => { if (!details.contains(event.target)) { details.open = false; document.removeEventListener("pointerdown", close); } };
        setTimeout(() => document.addEventListener("pointerdown", close), 0);
      }));
      document.dispatchEvent(new CustomEvent("psd:shared-header-ready", { detail: { host: this } }));
    }
  }

  const headerStylesHref = `${assetRoot}site-header.css?v=20260827-coverage-menu`;
  const existingHeaderStyles = document.querySelector("link[data-psd-site-header]");
  if (existingHeaderStyles) {
    existingHeaderStyles.href = headerStylesHref;
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
    setTimeout(() => document.querySelectorAll(HEADER_TAG).forEach((host) => host.renderNavigation()), 0);
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
