(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "";
  const copy = {
    cs: {
      statement: "Veřejné rozpočty na jednom místě.",
      description: "Data, zdroje a metodika pro státní, krajské i obecní rozpočty.",
      explore: "Prozkoumat", compare: "Srovnání zemí", municipalities: "Obce a města", methodology: "Metodika", about: "O projektu",
      madeBy: "Projekt připravuje", nonprofit: "nezávislá nezisková organizace", visit: "Navštívit Hlidac statu, z.u. ↗",
      identity: "Hlidac statu, z.u. · IČO 05965527", address: "Velenovského 648, 251 64 Mnichovice", back: "Nahoru ↑"
    },
    en: {
      statement: "Public budgets in one place.",
      description: "Data, sources and methods for national, regional and municipal budgets.",
      explore: "Explore", compare: "Compare countries", municipalities: "Municipalities", methodology: "Methodology", about: "About the project",
      madeBy: "Created by", nonprofit: "an independent nonprofit organisation", visit: "Visit Hlidac statu, z.u. ↗",
      identity: "Hlidac statu, z.u. · ID 05965527", address: "Velenovského 648, 251 64 Mnichovice, Czechia", back: "Back to top ↑"
    }
  };
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  function render() {
    const footer = document.querySelector("[data-global-footer]");
    if (!footer) return;
    const lang = language(), t = copy[lang], href = (path) => `${assetRoot}${path}?lang=${lang}`;
    footer.className = "glorious-footer";
    footer.innerHTML = `<div class="footer-statement"><span>Public Spending Data</span><h2>${t.statement}</h2><p>${t.description}</p></div><div class="footer-grid"><nav aria-label="${t.explore}"><strong>${t.explore}</strong><a href="${href("comparison.html")}">${t.compare}</a><a href="${href("municipalities/")}">${t.municipalities}</a><a href="${href("methodology.html")}">${t.methodology}</a><a href="${href("about.html")}">${t.about}</a></nav><section class="footer-maker"><div><span>${t.madeBy}</span><strong>Hlidac statu, z.u.</strong><small>${t.nonprofit}</small></div><img src="${assetRoot}assets/hlidac-statu.png" alt="Hlidac statu, z.u."><a href="https://www.hlidacstatu.cz/" target="_blank" rel="noopener">${t.visit}</a></section></div><div class="footer-base"><span>${t.identity}</span><span>${t.address}</span><a href="#top">${t.back}</a></div>`;
  }
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  render();
})();
