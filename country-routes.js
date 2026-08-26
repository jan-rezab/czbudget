(() => {
  const slugs = Object.freeze({
    CZE: "czechia",
    DEU: "germany",
    DNK: "denmark",
    FIN: "finland",
    FRA: "france",
    GBR: "united-kingdom",
    POL: "poland",
    SWE: "sweden",
    CHE: "switzerland",
    UKR: "ukraine",
    USA: "united-states",
    BRA: "brazil",
    ESP: "spain",
    JPN: "japan",
    NLD: "netherlands",
    NOR: "norway",
  });
  const codes = Object.freeze(Object.fromEntries(Object.entries(slugs).map(([code, slug]) => [slug, code])));

  const codeFromLocation = (fallback = "CZE") => {
    const slug = location.pathname.match(/^\/countries\/([^/]+)\/?$/i)?.[1]?.toLowerCase();
    const queryCode = new URLSearchParams(location.search).get("code")?.toUpperCase();
    return codes[slug] || (slugs[queryCode] ? queryCode : fallback);
  };

  const href = (code, lang = "", hash = "") => {
    const normalizedCode = String(code || "").toUpperCase();
    const slug = slugs[normalizedCode] || slugs.CZE;
    const language = ["cs", "en"].includes(lang) ? `?lang=${lang}` : "";
    const fragment = hash && String(hash).startsWith("#") ? hash : (hash ? `#${hash}` : "");
    return `/countries/${slug}${language}${fragment}`;
  };

  window.PSDCountryRoutes = Object.freeze({ slugs, codes, codeFromLocation, href });
})();
