(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "";
  const copy = {
    cs: {
      maker: "Projekt připravuje Hlidac statu, z.u.",
      legal: "zapsaný ústav · IČO 05965527",
      about: "O projektu", methodology: "Metodika"
    },
    en: {
      maker: "Created by Hlidac statu, z.u.",
      legal: "registered institute · ID 05965527",
      about: "About", methodology: "Methodology"
    }
  };
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  function render() {
    const footer = document.querySelector("body > [data-global-footer]");
    if (!footer) return;
    const lang = language(), t = copy[lang], href = (path) => `${assetRoot}${path}?lang=${lang}`;
    footer.className = "glorious-footer";
    footer.innerHTML = `<a class="footer-brand" href="${href("index.html")}" aria-label="Public Spending Data"><img src="${assetRoot}assets/logo-lockup-dark.svg" width="190" height="48" alt="Public Spending Data"></a><div class="footer-formalities"><strong>${t.maker}</strong><span>${t.legal}</span><a href="mailto:info@hlidacstatu.cz">info@hlidacstatu.cz</a></div><a class="footer-hlidac" href="https://www.hlidacstatu.cz/" target="_blank" rel="noopener" aria-label="Hlídač státu, z. ú."><img src="${assetRoot}assets/hlidac-statu-horizontal-inverted-bw.svg" width="220" height="35" alt="Hlídač státu"></a><nav class="footer-links" aria-label="${lang === "en" ? "Project information" : "Informace o projektu"}"><a href="${href("about.html")}">${t.about}</a><a href="${href("methodology.html")}">${t.methodology}</a></nav>`;
  }
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  render();
})();
