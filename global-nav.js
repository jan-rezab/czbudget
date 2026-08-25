(() => {
  const scriptUrl = document.currentScript?.src || new URL("global-nav.js", location.href).href;
  const assetRoot = new URL(".", scriptUrl).href;
  let globalFooter = document.querySelector("body > footer");
  if (!globalFooter) {
    globalFooter = document.createElement("footer");
    document.body.append(globalFooter);
  }
  globalFooter.setAttribute("data-global-footer", "");
  const compactFooterStyles = `${assetRoot}global-footer.css?v=20260825-inverted-lockup`;
  const existingFooterStyles = document.querySelector('link[href*="global-footer.css"]');
  if (existingFooterStyles) existingFooterStyles.href = compactFooterStyles;
  else {
    const footerStyles = document.createElement("link");
    footerStyles.rel = "stylesheet";
    footerStyles.href = compactFooterStyles;
    document.head.append(footerStyles);
  }
  const loadCompactFooter = () => {
    if (document.querySelector('script[data-compact-footer]')) return;
    const footerScript = document.createElement("script");
    footerScript.src = `${assetRoot}global-footer.js?v=20260825-inverted-lockup`;
    footerScript.dataset.compactFooter = "true";
    document.head.append(footerScript);
  };
  const existingFooterScript = document.querySelector('script[src*="global-footer.js"]');
  if (!existingFooterScript) loadCompactFooter();
  else if (!existingFooterScript.src.includes("20260825-inverted-lockup")) {
    if (document.readyState === "complete") loadCompactFooter();
    else window.addEventListener("load", loadCompactFooter, { once: true });
  }
  const portalStylesHref = `${assetRoot}portal-ui.css?v=20260824-logo-120`;
  const existingPortalStyles = document.querySelector("link[data-portal-ui]");
  if (existingPortalStyles) existingPortalStyles.href = portalStylesHref;
  else { const styles = document.createElement("link"); styles.rel = "stylesheet"; styles.href = portalStylesHref; styles.dataset.portalUi = "true"; document.head.append(styles); }
  if (!document.querySelector("script[data-portal-ui]")) { const script = document.createElement("script"); script.src = `${assetRoot}portal-ui.js?v=20260823`; script.defer = true; script.dataset.portalUi = "true"; document.head.append(script); }
  const HEADER_TAG = "psd-site-header";
  const countries = [
    ["CZE", "Česko", "Czechia", "cz"], ["DEU", "Německo", "Germany", "de"],
    ["DNK", "Dánsko", "Denmark", "dk"], ["FRA", "Francie", "France", "fr"],
    ["GBR", "Spojené království", "United Kingdom", "gb"], ["POL", "Polsko", "Poland", "pl"],
    ["SWE", "Švédsko", "Sweden", "se"], ["CHE", "Švýcarsko", "Switzerland", "ch"],
    ["UKR", "Ukrajina", "Ukraine", "ua"], ["USA", "Spojené státy", "United States", "us"],
  ];
  const municipalityCountries = [
    ["CZE", "Česko", "Czechia", "cz", "czechia"], ["POL", "Polsko", "Poland", "pl", "poland"],
    ["DNK", "Dánsko", "Denmark", "dk", "denmark"], ["FRA", "Francie", "France", "fr", "france"],
    ["SWE", "Švédsko", "Sweden", "se", "sweden"], ["GBR", "Anglie", "England", "gb", "england"],
    ["UKR", "Ukrajina", "Ukraine", "ua", "ukraine"], ["NOR", "Norsko", "Norway", "no", "norway"],
    ["NLD", "Nizozemsko", "Netherlands", "nl", "netherlands"], ["FIN", "Finsko", "Finland", "fi", "finland"],
  ];
  const countrySlugs = {CZE:"czechia",DEU:"germany",DNK:"denmark",FRA:"france",GBR:"united-kingdom",POL:"poland",SWE:"sweden",CHE:"switzerland",UKR:"ukraine",USA:"united-states"};
  const copy = {
    cs: { home:"Domů", compare:"Srovnání", cities:"Obce a města", country:"Země", deepDives:"Hloubkové profily", method:"Metodika", about:"O projektu", all:"Všechny profily", allMunicipalities:"Všechny obce", allDeepDives:"Všechny profily", transport:"Doprava", transportCopy:"Rozpočty, silnice a tempo výstavby", health:"Zdraví", healthCopy:"Financování a kapacita systému", stateCompanies:"Státní podniky", stateCompaniesCopy:"30 podniků, výnosy v EUR", capitalCities:"Hlavní města", capitalCitiesCopy:"Rozpočtové plány, obyvatelé a turistický tlak", revenue:"Kdo financuje stát?", revenueCopy:"Daně, úrovně vlády a transfery", ageing:"Účet stárnutí", ageingCopy:"Projekce a demografická kalkulačka", czechBudget:"Český státní rozpočet", navigation:"Hlavní navigace", language:"Jazyk" },
    en: { home:"Home", compare:"Compare", cities:"Municipalities", country:"Country", deepDives:"Deep dives", method:"Methodology", about:"About", all:"All profiles", allMunicipalities:"All municipalities", allDeepDives:"All deep dives", transport:"Transportation", transportCopy:"Budgets, roads and build pace", health:"Health", healthCopy:"Funding and system capacity", stateCompanies:"State-owned enterprises", stateCompaniesCopy:"30 enterprises, revenue in EUR", capitalCities:"Capital cities", capitalCitiesCopy:"Budget plans, residents and visitor pressure", revenue:"Who funds the state?", revenueCopy:"Taxes, government levels and transfers", ageing:"The Ageing Bill", ageingCopy:"Projections and demographic calculator", czechBudget:"Czech state budget", navigation:"Primary navigation", language:"Language" },
  };
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  const href = (path, lang = language()) => `${assetRoot}${path}${path.includes("?") ? "&" : "?"}lang=${lang}`;

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
      const countryLinks = countries.map(([code, cs, en, flag]) => `<a href="/countries/${countrySlugs[code]}?lang=${lang}"><img src="${assetRoot}assets/flags/${flag}.svg" alt=""><b>${code}</b><span>${lang === "en" ? en : cs}</span></a>`).join("");
      const municipalityLinks = municipalityCountries.map(([code, cs, en, flag, slug]) => `<a href="${assetRoot}municipalities/${slug}/?lang=${lang}"><img src="${assetRoot}assets/flags/${flag}.svg" alt=""><b>${code}</b><span>${lang === "en" ? en : cs}</span></a>`).join("");
      nav.setAttribute("aria-label", t.navigation);
      nav.innerHTML = `<details class="country-menu" data-global-nav="country"><summary><span class="menu-label">${t.country}</span><span class="menu-chevron" aria-hidden="true">⌄</span></summary><div class="country-menu-panel"><div class="country-menu-head"><span>${t.country}</span><a href="${assetRoot}?lang=${lang}#countries">${t.all} →</a></div><a class="capital-menu-feature" href="${href("cesky-rozpocet.html", lang)}"><b>CZ+</b><span>${t.czechBudget}</span></a>${countryLinks}</div></details><details class="country-menu municipality-menu" data-global-nav="cities"><summary><span class="menu-label">${t.cities}</span><span class="menu-chevron" aria-hidden="true">⌄</span></summary><div class="country-menu-panel"><div class="country-menu-head"><span>${t.cities}</span><a href="${href("municipalities/", lang)}">${t.allMunicipalities} →</a></div>${municipalityLinks}</div></details><a href="${href("comparison.html", lang)}" data-global-nav="compare">${t.compare}</a><details class="deep-dive-menu"><summary><span class="menu-label">${t.deepDives}</span><span class="menu-chevron" aria-hidden="true">⌄</span></summary><div class="deep-dive-menu-panel"><div class="country-menu-head"><span>${t.deepDives}</span><a href="${href("deep-dives/", lang)}">${t.allDeepDives} →</a></div><a href="${assetRoot}deep-dives/transportation/?code=CZE&lang=${lang}"><b>01</b><span><strong>${t.transport}</strong><small>${t.transportCopy}</small></span></a><a href="${assetRoot}deep-dives/health/?code=CZE&lang=${lang}"><b>02</b><span><strong>${t.health}</strong><small>${t.healthCopy}</small></span></a><a href="${href("deep-dives/state-owned-enterprises/", lang)}"><b>03</b><span><strong>${t.stateCompanies}</strong><small>${t.stateCompaniesCopy}</small></span></a><a href="${assetRoot}deep-dives/capital-cities/?city=prague-cz&lang=${lang}"><b>04</b><span><strong>${t.capitalCities}</strong><small>${t.capitalCitiesCopy}</small></span></a><a href="${assetRoot}deep-dives/revenue/?code=CZE&lang=${lang}"><b>05</b><span><strong>${t.revenue}</strong><small>${t.revenueCopy}</small></span></a><a href="${assetRoot}deep-dives/ageing/?code=CZE&lang=${lang}"><b>06</b><span><strong>${t.ageing}</strong><small>${t.ageingCopy}</small></span></a></div></details><a href="${href("methodology.html", lang)}" data-global-nav="method">${t.method}</a><a href="${href("about.html", lang)}" data-global-nav="about">${t.about}</a>`;
      const active = activeSection(this);
      nav.querySelector(`[data-global-nav="${active}"]`)?.classList.add("active");
      if (active === "country") nav.querySelector(".country-menu")?.classList.add("active");
      if (active === "cities") nav.querySelector(".municipality-menu")?.classList.add("active");
      if (active === "deep-dives") nav.querySelector(".deep-dive-menu")?.classList.add("active");
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
        nav.querySelectorAll("details[open]").forEach((other) => { if (other !== details) other.open = false; });
        const close = (event) => { if (!details.contains(event.target)) { details.open = false; document.removeEventListener("pointerdown", close); } };
        setTimeout(() => document.addEventListener("pointerdown", close), 0);
      }));
    }
  }

  const headerStylesHref = `${assetRoot}site-header.css?v=20260824-logo-120`;
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

  document.querySelectorAll("header.site-header.has-global-nav, header.site-header.cz-header").forEach((legacy) => {
    if (legacy.closest(HEADER_TAG)) return;
    const host = document.createElement(HEADER_TAG);
    legacy.replaceWith(host);
  });
  document.addEventListener("click", (event) => {
    const languageControl = event.target.closest("[data-lang],[data-budget-lang],[data-deep-lang]");
    if (!languageControl) return;
    if (location.pathname.startsWith("/cz/") && languageControl.dataset.lang) {
      localStorage.setItem("psd-lang", languageControl.dataset.lang);
      const next = new URL(location.href);
      next.searchParams.set("lang", languageControl.dataset.lang);
      location.href = `${next.pathname}${next.search}${next.hash}`;
      return;
    }
    setTimeout(() => document.querySelectorAll(HEADER_TAG).forEach((host) => host.renderNavigation()), 0);
  });
  new MutationObserver(() => {
    if (document.documentElement.lang === document.documentElement.dataset.navLang) return;
    document.documentElement.dataset.navLang = document.documentElement.lang;
    document.querySelectorAll(HEADER_TAG).forEach((host) => host.renderNavigation());
  }).observe(document.documentElement, { attributes:true, attributeFilter:["lang"] });
  document.documentElement.dataset.navLang = document.documentElement.lang;

  const railLinks = [...document.querySelectorAll(".context-rail a[href^='#']")];
  if (railLinks.length) {
    const sections = railLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
    const updateRail = () => {
      const current = [...sections].reverse().find((section) => section.getBoundingClientRect().top <= 150) || sections[0];
      railLinks.forEach((link) => link.toggleAttribute("aria-current", link.getAttribute("href") === `#${current?.id}`));
    };
    addEventListener("scroll", updateRail, { passive:true });
    updateRail();
  }
})();
