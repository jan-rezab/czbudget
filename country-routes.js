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
    GRC: "greece",
  });
  const codes = Object.freeze(Object.fromEntries(Object.entries(slugs).map(([code, slug]) => [slug, code])));

  const codeFromLocation = (fallback = "CZE") => {
    const slug = location.pathname.match(/^\/countries\/([^/]+)\/?$/i)?.[1]?.toLowerCase();
    const queryCode = new URLSearchParams(location.search).get("code")?.toUpperCase();
    return codes[slug] || (/^[a-z]{3}$/.test(slug || "") ? slug.toUpperCase() : null) || (/^[A-Z]{3}$/.test(queryCode || "") ? queryCode : fallback);
  };

  const href = (code, lang = "", hash = "") => {
    const normalizedCode = String(code || "").toUpperCase();
    const slug = slugs[normalizedCode] || (/^[A-Z]{3}$/.test(normalizedCode) ? normalizedCode.toLowerCase() : slugs.CZE);
    const language = ["cs", "en"].includes(lang) ? `?lang=${lang}` : "";
    const fragment = hash && String(hash).startsWith("#") ? hash : (hash ? `#${hash}` : "");
    return `/countries/${slug}${language}${fragment}`;
  };

  window.PSDCountryRoutes = Object.freeze({ slugs, codes, codeFromLocation, href });
})();
