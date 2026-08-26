(() => {
  if (window.__psdLanguageBootstrap) return;
  window.__psdLanguageBootstrap = true;

  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "/";
  if (!document.querySelector('link[data-portal-ui]')) {
    const portalStyles = document.createElement("link");
    portalStyles.rel = "stylesheet";
    portalStyles.href = `${assetRoot}portal-ui.css?v=20260824-header-lockup-2`;
    portalStyles.dataset.portalUi = "true";
    document.head.append(portalStyles);
  }
  if (!document.querySelector('script[data-portal-ui]')) {
    const portalScript = document.createElement("script");
    portalScript.src = `${assetRoot}portal-ui.js?v=20260823`;
    portalScript.defer = true;
    portalScript.dataset.portalUi = "true";
    document.head.append(portalScript);
  }

  const supported = new Set(["cs", "en"]);
  const requested = new URLSearchParams(location.search).get("lang");
  let stored = null;
  try { stored = localStorage.getItem("psd-lang"); } catch {}

  const initial = document.documentElement.lang || "cs";
  const isHomepage = location.pathname === "/" || location.pathname === "/index.html";
  const defaultLanguage = isHomepage ? "en" : (supported.has(initial) ? initial : "cs");
  const language = supported.has(requested) ? requested : (supported.has(stored) ? stored : defaultLanguage);
  document.documentElement.lang = language;

  // This is the single language authority for independently rendered modules.
  // Page scripts should read the resolved document language instead of
  // re-resolving URL, storage and fallback rules on their own.
  const current = () => document.documentElement.lang === "en" ? "en" : "cs";
  const set = (next, { persist = false } = {}) => {
    if (!supported.has(next)) return current();
    document.documentElement.lang = next;
    if (persist) {
      try { localStorage.setItem("psd-lang", next); } catch {}
    }
    dispatchEvent(new CustomEvent("psdlanguagechange", { detail: { lang: next } }));
    return next;
  };
  window.PSDLanguage = Object.freeze({ current, set, defaultLanguage });

  // Keep the document metadata bilingual as well as the visible page. Most of
  // the site is static HTML enhanced by page-specific translators, so without
  // this layer the English UI could still publish a Czech title/description
  // and vice versa. Social cards deliberately use language-neutral artwork.
  const metadata = {
    "/": {
      cs: ["Public Spending Data — veřejné rozpočty v souvislostech", "Porovnejte finance zemí, projděte rozpočty obcí a otevřete původní zdroje."],
      en: ["Public Spending Data — public budgets in context", "Compare national finances, inspect municipal budgets and open the original sources."],
    },
    "/index.html": {
      cs: ["Public Spending Data — veřejné rozpočty v souvislostech", "Porovnejte finance zemí, projděte rozpočty obcí a otevřete původní zdroje."],
      en: ["Public Spending Data — public budgets in context", "Compare national finances, inspect municipal budgets and open the original sources."],
    },
    "/comparison.html": {
      cs: ["Srovnání veřejných rozpočtů — Public Spending Data", "Porovnejte dvacet let harmonizovaných ukazatelů veřejných financí deseti zemí."],
      en: ["Compare public budgets — Public Spending Data", "Compare twenty years of harmonised public-finance indicators across ten countries."],
    },
    "/methodology.html": {
      cs: ["Stav dat — Public Spending Data", "Pokrytí podle země, období a primárního zdroje."],
      en: ["Data status — Public Spending Data", "Coverage by country, period and primary source."],
    },
    "/about.html": {
      cs: ["O projektu — Public Spending Data", "O projektu Public Spending Data a neziskové organizaci Hlidac statu, z.u."],
      en: ["About — Public Spending Data", "About Public Spending Data and the nonprofit organisation Hlidac statu, z.u."],
    },
    "/country.html": {
      cs: [null, "Detailní fiskální profil země, makroekonomické ukazatele a primární rozpočtové zdroje."],
      en: [null, "A detailed country fiscal profile, macroeconomic indicators and primary budget sources."],
    },
    "/eu-capitals.html": {
      cs: ["Evropská hlavní města — rozpočty, obyvatelé a cestovní ruch", "Rozpočty 27 hlavních měst EU a Londýna v eurech i místních měnách, doplněné o počet obyvatel a statistiky cestovního ruchu."],
      en: ["European capitals — budgets, population and tourism", "Budgets of the 27 EU capitals and London in euros and local currencies, with population and tourism statistics."],
    },
    "/municipalities/": {
      cs: ["Rozpočty obcí v Evropě — Public Spending Data", "Prozkoumejte rozpočty obcí v Evropě, detail českých obcí a adresář hlavních měst EU."],
      en: ["Municipality budgets across Europe — Public Spending Data", "Explore municipal budgets across Europe, Czech municipality detail and the directory of EU capitals."],
    },
    "/municipalities/czechia/": {
      cs: ["České obce — Public Spending Data", "Přehledy, dlouhé rozpočtové řady měst a úplný adresář všech 6 254 českých obcí."],
      en: ["Czech municipalities — Public Spending Data", "Insights, long-run city budgets and a complete directory of all 6,254 Czech municipalities."],
    },
    "/deep-dives/": {
      cs: ["Hloubkové profily — Public Spending Data", "Tematické profily propojují veřejné rozpočty s infrastrukturou a kapacitou veřejných služeb."],
      en: ["Deep dives — Public Spending Data", "Cross-country deep dives connect public budgets with infrastructure and public-service capacity."],
    },
    "/deep-dives/transportation/": {
      cs: ["Hloubkový profil dopravy — Public Spending Data", "Srovnání výdajů na dopravu, silnic, dálnic a růstu sítě v deseti zemích."],
      en: ["Transportation deep dive — Public Spending Data", "Compare transportation spending, roads, motorways and network growth across ten countries."],
    },
    "/deep-dives/health/": {
      cs: ["Hloubkový profil zdraví — Public Spending Data", "Srovnání výdajů na zdraví, financování, poskytovatelů, lůžek a kapacity systému v deseti zemích."],
      en: ["Health deep dive — Public Spending Data", "Compare health spending, financing, providers, hospital beds and system capacity across ten countries."],
    },
    "/deep-dives/state-owned-enterprises/": {
      cs: ["Největší státní podniky — Public Spending Data", "Zdrojovaný katalog největších státem ovládaných podniků v deseti zemích s výnosy za rok 2024 v eurech."],
      en: ["Largest state-owned enterprises — Public Spending Data", "A sourced catalogue of the largest state-controlled companies across ten countries, with 2024 revenue converted to euros."],
    },
    "/deep-dives/ageing/": {
      cs: ["Účet stárnutí — Public Spending Data", "Oficiální populační projekce a transparentní kalkulačka demografické závislosti pro deset zemí. Bez fiskální prognózy."],
      en: ["The Ageing Bill — Public Spending Data", "Official population projections and a transparent demographic dependency calculator for ten countries. No fiscal forecast."],
    },
    "/deep-dives/capital-cities/": {
      cs: ["Hlavní města pod tlakem — Public Spending Data", "Rozpočty na obyvatele, turistická intenzita a rozpočtové saldo 27 hlavních měst EU a Londýna v porovnatelných skupinách."],
      en: ["Capital Cities Under Pressure — Public Spending Data", "Budgets per resident, visitor pressure and fiscal balances across the 27 EU capitals and London in comparable groups."],
    },
    "/deep-dives/revenue/": {
      cs: ["Kdo skutečně financuje stát? — Public Spending Data", "Sledujte každých 100 jednotek daňových příjmů od práce, kapitálu, spotřeby a majetku k jednotlivým úrovním vlády."],
      en: ["Who actually funds the state? — Public Spending Data", "Follow every 100 units of tax revenue from income, payroll, consumption and property to each level of government."],
    },
    "/deep-dives/migration/": {
      cs: ["Evropská migrace v čase — Public Spending Data", "Přistěhování, vystěhování a migrační saldo všech 27 zemí EU v letech 2000–2024 podle Eurostatu."],
      en: ["European migration over time — Public Spending Data", "Immigration, emigration and migration balance across all 27 EU countries from 2000 to 2024, based on Eurostat."],
    },
    "/deep-dives/economy/": {
      cs: ["Ekonomika v kontextu — Public Spending Data", "Dlouhé ekonomické řady, hospodářský cyklus a fiskální kontext v globální datové vrstvě."],
      en: ["Economy in context — Public Spending Data", "Long-run economic series, the business cycle and fiscal context in a global data layer."],
    },
    "/deep-dives/defense/": {
      cs: ["Výdaje na obranu — Public Spending Data", "Vojenské výdaje vůči HDP, závazek NATO a nejjemnější dostupné rozpočtové řádky pro 17 zemí."],
      en: ["Defense spending — Public Spending Data", "Military expenditure relative to GDP, the NATO commitment and the finest available budget lines for 17 countries."],
    },
    "/cesky-rozpocet.html": {
      cs: ["Public Spending Data — český rozpočet v čase", "Státní rozpočet ČR 2001–2026, tok peněz ve zdravotnictví, benchmark nemocnic, účelové oblasti, kapitoly a demografický tlak do roku 2045."],
      en: ["Public Spending Data — Czech budget over time", "The Czech state budget for 2001–2026, health-system money flows, hospital benchmarks, spending purposes, budget chapters and demographic pressure to 2045."],
    },
    "/cesko.html": {
      cs: ["Stát jako vlastník — Public Spending Data", "Nejziskovější a nejztrátovější státní firmy v Česku a jejich skutečné odvody do státního rozpočtu."],
      en: ["The state as owner — Public Spending Data", "Czech state-owned companies, their financial results and the payments they actually make to the state budget."],
    },
    "/cz/obce/": {
      cs: ["Rozpočty obcí a krajů ČR — Public Spending Data", "Historický vývoj příjmů, výdajů, výsledku hospodaření, stavu účtů a výdajů na obyvatele všech 6 254 obcí."],
      en: ["Czech municipal and regional budgets — Public Spending Data", "Historical revenue, expenditure, fiscal balance, cash and per-capita spending for all 6,254 Czech municipalities."],
    },
    "/cz/municipalities/": {
      cs: ["Rozpočty obcí a krajů ČR — Public Spending Data", "Historický vývoj příjmů, výdajů, výsledku hospodaření, stavu účtů a výdajů na obyvatele všech 6 254 obcí."],
      en: ["Czech municipal and regional budgets — Public Spending Data", "Historical revenue, expenditure, fiscal balance, cash and per-capita spending for all 6,254 Czech municipalities."],
    },
    "/cz/mesta/": {
      cs: ["Rozpočty velkých měst 2006–2025 — Public Spending Data", "Dvacetiletý trend příjmů, výdajů, výsledku hospodaření a stavu účtů 27 velkých českých měst."],
      en: ["Large Czech city budgets, 2006–2025 — Public Spending Data", "Twenty-year revenue, expenditure, fiscal-balance and cash trends for 27 large Czech cities."],
    },
  };
  const socialImage = location.pathname.endsWith("/cesky-rozpocet.html")
    ? "https://publicspendingdata.org/assets/og-budget.png"
    : (location.pathname.endsWith("/cesko.html") || location.pathname.includes("/state-owned-enterprises/"))
      ? "https://publicspendingdata.org/assets/og-cesko.png"
      : "https://publicspendingdata.org/assets/og.png";
  const ensureMeta = (selector, attributes) => {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
      document.head.append(node);
    }
    return node;
  };
  const descriptionNode = () => ensureMeta('meta[name="description"]', { name: "description" });
  const setContent = (node, value) => { if (node.content !== value) node.content = value; };
  const applyMetadata = () => {
    const lang = document.documentElement.lang === "en" ? "en" : "cs";
    const page = metadata[location.pathname];
    if (page) {
      const [title, description] = page[lang];
      if (title && document.title !== title) document.title = title;
      setContent(descriptionNode(), description);
    }
    const description = descriptionNode().content;
    setContent(ensureMeta('meta[property="og:type"]', { property: "og:type" }), "website");
    setContent(ensureMeta('meta[property="og:site_name"]', { property: "og:site_name" }), "Public Spending Data");
    setContent(ensureMeta('meta[property="og:locale"]', { property: "og:locale" }), lang === "en" ? "en_GB" : "cs_CZ");
    setContent(ensureMeta('meta[property="og:title"]', { property: "og:title" }), document.title);
    setContent(ensureMeta('meta[property="og:description"]', { property: "og:description" }), description);
    setContent(ensureMeta('meta[property="og:image"]', { property: "og:image" }), socialImage);
    setContent(ensureMeta('meta[property="og:image:width"]', { property: "og:image:width" }), "1200");
    setContent(ensureMeta('meta[property="og:image:height"]', { property: "og:image:height" }), "630");
    setContent(ensureMeta('meta[property="og:image:alt"]', { property: "og:image:alt" }), lang === "en" ? "Public Spending Data editorial data visualisation" : "Datová vizualizace Public Spending Data");
    setContent(ensureMeta('meta[name="twitter:card"]', { name: "twitter:card" }), "summary_large_image");
    setContent(ensureMeta('meta[name="twitter:title"]', { name: "twitter:title" }), document.title);
    setContent(ensureMeta('meta[name="twitter:description"]', { name: "twitter:description" }), description);
    setContent(ensureMeta('meta[name="twitter:image"]', { name: "twitter:image" }), socialImage);
  };
  let metadataQueued = false;
  const queueMetadata = () => {
    if (metadataQueued) return;
    metadataQueued = true;
    queueMicrotask(() => { metadataQueued = false; applyMetadata(); });
  };
  const startMetadataSync = () => {
    applyMetadata();
    new MutationObserver(queueMetadata).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    new MutationObserver(queueMetadata).observe(document.head, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["content"] });
    addEventListener("budgetlanguagechange", queueMetadata);
    addEventListener("psdlanguagechange", queueMetadata);
  };
  // Some generated pages load this bootstrap as the first child of <head>.
  // Wait until the parser has seen their authored metadata; creating fallback
  // tags earlier would leave a duplicate, empty description before the real one.
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", startMetadataSync, { once: true });
  else startMetadataSync();

  // The static HTML is Czech. When English is preferred, keep it out of the
  // first paint until the page-specific translator marks EN as active.
  if (language === initial) return;
  document.documentElement.dataset.languagePending = language;

  const style = document.createElement("style");
  style.id = "language-paint-guard";
  style.textContent = "html[data-language-pending] { visibility: hidden; }";
  document.head.append(style);

  const activeSelector = [
    `[data-lang="${language}"].active`,
    `[data-budget-lang="${language}"].active`,
    `[data-deep-lang="${language}"].active`,
    `[href*="lang=${language}"][aria-current="true"]`,
  ].join(",");

  let observer;
  let timeout;
  const reveal = () => {
    if (!document.documentElement.hasAttribute("data-language-pending")) return;
    document.documentElement.removeAttribute("data-language-pending");
    style.remove();
    observer?.disconnect();
    clearTimeout(timeout);
  };
  const revealWhenReady = () => {
    if (document.documentElement.lang === language && document.querySelector(activeSelector)) reveal();
  };

  window.psdLanguageReady = reveal;
  observer = new MutationObserver(revealWhenReady);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "aria-current", "aria-pressed"] });
  addEventListener("psdlanguageready", reveal);
  timeout = setTimeout(reveal, 5000);
  queueMicrotask(revealWhenReady);
})();
