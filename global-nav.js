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
    cs:{home:"Domů",compare:"Srovnání",cities:"Obce a města",country:"Země",deepDives:"Hloubkové profily",method:"Metodika",about:"O projektu",all:"Všechny profily",allDeepDives:"Všechny profily",transport:"Doprava",transportCopy:"Rozpočty, silnice a tempo výstavby",health:"Zdraví",healthCopy:"Financování a kapacita systému",coming:"Připravujeme",czechBudget:"Český státní rozpočet"},
    en:{home:"Home",compare:"Compare",cities:"Municipalities",country:"Country",deepDives:"Deep dives",method:"Methodology",about:"About",all:"All profiles",allDeepDives:"All deep dives",transport:"Transportation",transportCopy:"Budgets, roads and build pace",health:"Health",healthCopy:"Funding and system capacity",coming:"Coming next",czechBudget:"Czech state budget"}
  };
  function render() {
    const lang = language(), t = copy[lang], page = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("a.brand").forEach(link => link.setAttribute("aria-label", "Public Spending Data"));
    document.querySelectorAll(".global-nav").forEach(nav => {
      const countryHref = code => `${assetRoot}country.html?code=${code}&lang=${lang}`;
      nav.innerHTML = `<a href="${assetRoot}index.html?lang=${lang}" data-global-nav="home">${t.home}</a><a href="${assetRoot}comparison.html?lang=${lang}" data-global-nav="compare">${t.compare}</a><a href="${assetRoot}municipalities/?lang=${lang}" data-global-nav="cities">${t.cities}</a><details class="country-menu"><summary>${t.country}<span aria-hidden="true">⌄</span></summary><div class="country-menu-panel"><div class="country-menu-head"><span>${t.country}</span><a href="${assetRoot}index.html?lang=${lang}#countries">${t.all} →</a></div><a class="capital-menu-feature" href="${assetRoot}cesky-rozpocet.html?lang=${lang}"><b>CZ+</b><span>${t.czechBudget}</span></a>${countries.map(([code,cs,en])=>`<a href="${countryHref(code)}"><img src="${assetRoot}assets/flags/${flags[code]}.svg" alt=""><b>${code}</b><span>${lang === "en" ? en : cs}</span></a>`).join("")}</div></details><details class="deep-dive-menu"><summary>${t.deepDives}<span aria-hidden="true">⌄</span></summary><div class="deep-dive-menu-panel"><div class="country-menu-head"><span>${t.deepDives}</span><a href="${assetRoot}deep-dives/?lang=${lang}">${t.allDeepDives} →</a></div><a href="${assetRoot}deep-dives/transportation/?code=CZE&lang=${lang}"><b>01</b><span><strong>${t.transport}</strong><small>${t.transportCopy}</small></span></a><a href="${assetRoot}deep-dives/health/?code=CZE&lang=${lang}"><b>02</b><span><strong>${t.health}</strong><small>${t.healthCopy}</small></span></a></div></details><a href="${assetRoot}methodology.html?lang=${lang}" data-global-nav="method">${t.method}</a><a href="${assetRoot}about.html?lang=${lang}" data-global-nav="about">${t.about}</a>`;
      const active = location.pathname.includes("/deep-dives/") ? "deep-dives" : page === "municipalities.html" || location.pathname.includes("/municipalities/") || page === "eu-capitals.html" || location.pathname.includes("/cz/mesta/") || location.pathname.includes("/cz/obce/") || location.pathname.includes("/cz/kraje/") ? "cities" : page === "country.html" || page === "cesky-rozpocet.html" ? "country" : page === "comparison.html" ? "compare" : page === "methodology.html" ? "method" : page === "about.html" ? "about" : page === "index.html" || page === "" ? "home" : "";
      nav.querySelector(`[data-global-nav="${active}"]`)?.classList.add("active");
      if (active === "country") nav.querySelector(".country-menu")?.classList.add("active");
      if (active === "deep-dives") nav.querySelector(".deep-dive-menu")?.classList.add("active");
      nav.querySelectorAll("details").forEach(details=>details.addEventListener("toggle", () => {
        if (!details.open) return;
        nav.querySelectorAll("details[open]").forEach(other=>{if(other!==details)other.open=false});
        const close = event => { if (!details.contains(event.target)) { details.open = false; document.removeEventListener("pointerdown", close); } };
        setTimeout(() => document.addEventListener("pointerdown", close), 0);
      }));
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
