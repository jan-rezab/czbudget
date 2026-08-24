(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "";
  const copy = {
    cs: {
      maker: "Projekt připravuje Hlidac statu, z.u.",
      legal: "zapsaný ústav · IČO 05965527",
      address: "Velenovského 648, 251 64 Mnichovice",
      about: "O projektu", methodology: "Metodika", back: "Nahoru ↑"
    },
    en: {
      maker: "Created by Hlidac statu, z.u.",
      legal: "registered institute · ID 05965527",
      address: "Velenovského 648, 251 64 Mnichovice, Czechia",
      about: "About", methodology: "Methodology", back: "Back to top ↑"
    }
  };
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  function render() {
    const footer = document.querySelector("body > [data-global-footer]");
    if (!footer) return;
    const lang = language(), t = copy[lang], href = (path) => `${assetRoot}${path}?lang=${lang}`;
    footer.className = "glorious-footer";
    footer.innerHTML = `<a class="footer-brand" href="${href("index.html")}" aria-label="Public Spending Data"><img src="${assetRoot}assets/logo-lockup.svg" width="190" height="48" alt="Public Spending Data"></a><div class="footer-formalities"><strong>${t.maker}</strong><span>${t.legal}</span><span>${t.address}</span><a href="mailto:info@hlidacstatu.cz">info@hlidacstatu.cz</a></div><a class="footer-hlidac" href="https://www.hlidacstatu.cz/" target="_blank" rel="noopener" aria-label="Hlidac statu, z.u."><img src="${assetRoot}assets/hlidac-statu.png" width="288" height="138" alt=""></a><nav class="footer-links" aria-label="${lang === "en" ? "Project information" : "Informace o projektu"}"><a href="${href("about.html")}">${t.about}</a><a href="${href("methodology.html")}">${t.methodology}</a><a href="#top">${t.back}</a></nav>`;
  }
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  render();
})();
