(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "";
  if (!document.querySelector('script[data-sortable-tables]')) {
    const sortable = document.createElement("script");
    sortable.src = `${assetRoot}sortable-tables.js`;
    sortable.defer = true;
    sortable.dataset.sortableTables = "true";
    document.head.append(sortable);
  }
  const countries = [
    ["CZE","Česko","Czechia"],["DEU","Německo","Germany"],["DNK","Dánsko","Denmark"],
    ["FRA","Francie","France"],["GBR","Spojené království","United Kingdom"],["POL","Polsko","Poland"],
    ["SWE","Švédsko","Sweden"],["CHE","Švýcarsko","Switzerland"],["UKR","Ukrajina","Ukraine"],
    ["USA","Spojené státy","United States"]
  ];
  const flags = {CZE:"cz",DEU:"de",DNK:"dk",FRA:"fr",GBR:"gb",POL:"pl",SWE:"se",CHE:"ch",UKR:"ua",USA:"us"};
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  const copy = {
    cs:{home:"Domů",compare:"Srovnání",cities:"Obce a kraje",country:"Země",capitals:"EU města",method:"Metodika",all:"Všechny profily",czechBudget:"Český státní rozpočet"},
    en:{home:"Home",compare:"Compare",cities:"Municipalities & regions",country:"Country",capitals:"EU cities",method:"Methodology",all:"All profiles",czechBudget:"Czech state budget"}
  };
  function render() {
    const lang = language(), t = copy[lang], page = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".global-nav").forEach(nav => {
      const countryHref = code => `${assetRoot}country.html?code=${code}&lang=${lang}`;
      const capitalsLink = `<a href="${assetRoot}eu-capitals.html?lang=${lang}" data-global-nav="capitals">${t.capitals}</a>`;
      nav.innerHTML = `<a href="${assetRoot}index.html?lang=${lang}" data-global-nav="home">${t.home}</a><a href="${assetRoot}index.html?lang=${lang}#compare" data-global-nav="compare">${t.compare}</a><a href="${assetRoot}cz/obce/?lang=${lang}" data-global-nav="cities">${t.cities}</a>${capitalsLink}<details class="country-menu"><summary>${t.country}<span aria-hidden="true">⌄</span></summary><div class="country-menu-panel"><div class="country-menu-head"><span>${t.country}</span><a href="${assetRoot}index.html?lang=${lang}#countries">${t.all} →</a></div><a class="capital-menu-feature" href="${assetRoot}cesky-rozpocet.html?lang=${lang}"><b>CZ+</b><span>${t.czechBudget}</span></a>${countries.map(([code,cs,en])=>`<a href="${countryHref(code)}"><img src="${assetRoot}assets/flags/${flags[code]}.svg" alt=""><b>${code}</b><span>${lang === "en" ? en : cs}</span></a>`).join("")}</div></details><a href="${assetRoot}index.html?lang=${lang}#method" data-global-nav="method">${t.method}</a>`;
      const active = location.pathname.includes("/cz/mesta/") || location.pathname.includes("/cz/obce/") || location.pathname.includes("/cz/kraje/") ? "cities" : page === "eu-capitals.html" ? "capitals" : page === "country.html" || page === "cesky-rozpocet.html" ? "country" : location.hash === "#compare" ? "compare" : location.hash === "#method" ? "method" : page === "index.html" || page === "" ? "home" : "";
      nav.querySelector(`[data-global-nav="${active}"]`)?.classList.add("active");
      if (active === "country") nav.querySelector(".country-menu")?.classList.add("active");
      const details = nav.querySelector("details");
      details?.addEventListener("toggle", () => {
        if (!details.open) return;
        const close = event => { if (!details.contains(event.target)) { details.open = false; document.removeEventListener("pointerdown", close); } };
        setTimeout(() => document.addEventListener("pointerdown", close), 0);
      });
    });
  }
  document.addEventListener("click", event => {
    if (event.target.closest("[data-lang],[data-budget-lang]")) setTimeout(render, 0);
  });
  new MutationObserver(() => {
    if (document.documentElement.lang !== document.documentElement.dataset.navLang) {
      document.documentElement.dataset.navLang = document.documentElement.lang; render();
    }
  }).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  document.documentElement.dataset.navLang = document.documentElement.lang;
  render();
  const railLinks = [...document.querySelectorAll(".context-rail a[href^='#']")];
  if (railLinks.length) {
    const sections = railLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
    const updateRail = () => {
      const current = [...sections].reverse().find((section) => section.getBoundingClientRect().top <= 150) || sections[0];
      railLinks.forEach((link) => link.toggleAttribute("aria-current", link.getAttribute("href") === `#${current?.id}`));
    };
    addEventListener("scroll", updateRail, { passive: true }); updateRail();
  }
})();
