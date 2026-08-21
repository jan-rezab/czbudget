(() => {
  const countries = [
    ["CZE","Česko","Czechia"],["DEU","Německo","Germany"],["DNK","Dánsko","Denmark"],
    ["FRA","Francie","France"],["GBR","Spojené království","United Kingdom"],["POL","Polsko","Poland"],
    ["SWE","Švédsko","Sweden"],["CHE","Švýcarsko","Switzerland"],["UKR","Ukrajina","Ukraine"],
    ["USA","Spojené státy","United States"]
  ];
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  const copy = {
    cs:{home:"Domů",compare:"Srovnání",cities:"Obce a kraje",country:"Země",capitals:"EU města",method:"Metodika",all:"Všechny profily"},
    en:{home:"Home",compare:"Compare",cities:"Municipalities & regions",country:"Country",capitals:"EU cities",method:"Methodology",all:"All profiles"}
  };
  function render() {
    const lang = language(), t = copy[lang], page = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".global-nav").forEach(nav => {
      const countryHref = code => code === "CZE" ? `cesky-rozpocet.html?lang=${lang}` : `country.html?code=${code}&lang=${lang}`;
      const capitalsLink = `<a href="eu-capitals.html?lang=${lang}" data-global-nav="capitals">${t.capitals}</a>`;
      nav.innerHTML = `<a href="index.html?lang=${lang}" data-global-nav="home">${t.home}</a><a href="index.html?lang=${lang}#compare" data-global-nav="compare">${t.compare}</a><a href="cz/obce/?lang=${lang}" data-global-nav="cities">${t.cities}</a>${capitalsLink}<details class="country-menu"><summary>${t.country}<span aria-hidden="true">⌄</span></summary><div class="country-menu-panel"><div class="country-menu-head"><span>${t.country}</span><a href="index.html?lang=${lang}#countries">${t.all} →</a></div><a class="capital-menu-feature" href="eu-capitals.html?lang=${lang}"><b>EU27+</b><span>${t.capitals}</span></a>${countries.map(([code,cs,en])=>`<a href="${countryHref(code)}"><b>${code}</b><span>${lang === "en" ? en : cs}</span></a>`).join("")}</div></details><a href="index.html?lang=${lang}#method" data-global-nav="method">${t.method}</a>`;
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
})();
