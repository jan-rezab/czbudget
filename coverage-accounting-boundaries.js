(() => {
  const body = document.querySelector("#fiscal-architecture-body");
  if (!body) return;

  const copy = {
    cs: {
      kicker: "Hloubka pokrytí / účetní hranice",
      title: "Účetní hranice v každé zemi",
      intro: "U každé pokryté země oddělujeme národní rozpočet, samosprávy, další veřejné účty a korporace. Tabulka ukazuje rozsah, který umíme doložit; není to další součet příjmů.",
      country: "Země",
      nationalBudget: "Národní rozpočet",
      municipalBudgets: "Obce a regiony",
      otherAccounts: "Další veřejné účty",
      stateCompanies: "Veřejné korporace",
      separate: "Vlastní rozpočty · oddělené",
      profile: "Profil →",
      failed: "Rozsah účetního pokrytí se nepodařilo načíst.",
    },
    en: {
      kicker: "Coverage depth / accounting boundaries",
      title: "Accounting boundaries in each country",
      intro: "For every covered country, we distinguish the national budget, subnational governments, other public accounts and corporations. The table shows the scope we can document; it is not another revenue total.",
      country: "Country",
      nationalBudget: "National budget",
      municipalBudgets: "Municipalities and regions",
      otherAccounts: "Other public accounts",
      stateCompanies: "Public corporations",
      separate: "Own budgets · separate",
      profile: "Profile →",
      failed: "The accounting-coverage detail could not be loaded.",
    },
  };

  let data = null;
  let lang = (window.PSDLanguage && window.PSDLanguage.current()) ||
    (document.documentElement.lang === "en" ? "en" : "cs");

  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"]/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));

  function profileHref(code) {
    return window.PSDCountryRoutes
      ? window.PSDCountryRoutes.href(code, lang)
      : `country.html?code=${encodeURIComponent(code)}&lang=${lang}`;
  }

  function render() {
    const t = copy[lang];
    document.querySelectorAll("[data-boundary-copy]").forEach((node) => {
      const value = t[node.dataset.boundaryCopy];
      if (value) node.textContent = value;
    });
    if (!data) return;
    const suffix = lang === "en" ? "en" : "cs";
    body.innerHTML = data.countries.map((country) => {
      const architecture = country.fiscal_architecture || {};
      const name = country[`name_${suffix}`] || country.name_en || country.country_code;
      const flag = country.iso2 ? `<span class="country-flag-svg"><img src="assets/flags/${esc(country.iso2.toLowerCase())}.svg" alt="" loading="lazy"><b>${esc(country.country_code)}</b></span>` : "";
      return `<tr>
        <td>${flag}<strong>${esc(name)}</strong></td>
        <td>${esc(architecture[`national_budget_label_${suffix}`] || "—")}</td>
        <td><span class="scope-status">${esc(t.separate)}</span></td>
        <td>${esc(architecture[`architecture_${suffix}`] || "—")}</td>
        <td>${esc(architecture[`corporation_note_${suffix}`] || "—")}</td>
        <td><a href="${esc(profileHref(country.country_code))}">${esc(t.profile)}</a></td>
      </tr>`;
    }).join("");
  }

  window.addEventListener("psdlanguagechange", (event) => {
    lang = (event.detail && event.detail.lang) || lang;
    render();
  });

  fetch("data/sovereign-benchmark-slim.v1.json")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      data = payload;
      render();
    })
    .catch((error) => {
      console.error(error);
      body.innerHTML = `<tr><td colspan="6">${esc(copy[lang].failed)}</td></tr>`;
    });
})();
