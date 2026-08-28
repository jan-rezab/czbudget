(() => {
  "use strict";

  const countryRoot = document.querySelector("#country-oecd-overlay-root");
  const revenueRoot = document.querySelector("#revenue-tax-rates-root");
  if (!countryRoot && !revenueRoot) return;

  const COPY = {
    cs: {
      kicker: "OECD / společné měřítko", title: "Daně, přerozdělení a výsledky v jednom rámci.",
      intro: "Každá karta používá poslední dostupný rok svého ukazatele. Medián počítáme jen ze zemí načtených na tomto webu; chybějící hodnoty nedopočítáváme.",
      tabs: { tax: "Daně a práce", distribution: "Přerozdělení", social: "Sociální stát", government: "Kapacita státu", wellbeing: "Výsledky" },
      median: "medián načtených zemí", missing: "OECD údaj není k dispozici", year: "rok",
      rateTitle: "Od zákonné sazby ke skutečnému zatížení.",
      rateIntro: "Sazba sama nestačí. OECD odděluje daňový klín zaměstnance, zákonnou a modelovou firemní sazbu, daňovou autonomii a cenu uhlíku.",
      household: "Modelová domácnost", taxWedge: "Průměrný daňový klín", marginalWedge: "Mezní daňový klín", netRate: "Čistá osobní sazba",
      methodology: "Definice OECD", source: "Otevřít zdroj ↗",
    },
    en: {
      kicker: "OECD / common benchmark", title: "Taxes, redistribution and outcomes in one frame.",
      intro: "Each card uses that indicator's latest available year. The median covers only countries loaded on this site; missing values are never estimated.",
      tabs: { tax: "Tax and work", distribution: "Redistribution", social: "Social state", government: "State capacity", wellbeing: "Outcomes" },
      median: "loaded-country median", missing: "OECD value unavailable", year: "year",
      rateTitle: "From headline rates to the effective burden.",
      rateIntro: "One rate is not enough. OECD separates the employee tax wedge, statutory and modelled corporate rates, tax autonomy and carbon pricing.",
      household: "Model household", taxWedge: "Average tax wedge", marginalWedge: "Marginal tax wedge", netRate: "Net personal rate",
      methodology: "OECD definition", source: "Open source ↗",
    },
  };

  const TOPICS = {
    tax: ["tax_to_gdp", "labour_tax_wedge_single", "labour_tax_wedge_family", "corporate_statutory_rate", "corporate_eatr", "net_carbon_rate"],
    distribution: ["market_gini", "disposable_gini", "poverty_rate"],
    social: ["social_spending", "pension_replacement_aw100"],
    government: ["government_employment", "procurement_gdp", "local_tax_autonomy"],
    wellbeing: ["housing_affordability", "life_satisfaction", "pisa_math", "road_deaths"],
  };
  const SOURCE_BY_METRIC = {
    tax_to_gdp: "oecd_revenue_statistics", labour_tax_wedge_single: "oecd_taxing_wages", labour_tax_wedge_family: "oecd_taxing_wages",
    corporate_statutory_rate: "oecd_corporate_tax_statistics", corporate_eatr: "oecd_corporate_effective_rates", corporate_emtr: "oecd_corporate_effective_rates",
    local_tax_autonomy: "oecd_tax_autonomy", net_carbon_rate: "oecd_net_effective_carbon_rates", disposable_gini: "oecd_income_distribution",
    market_gini: "oecd_income_distribution", poverty_rate: "oecd_income_distribution", social_spending: "oecd_socx",
    pension_replacement_aw100: "oecd_pensions_at_a_glance", government_employment: "oecd_government_at_a_glance", procurement_gdp: "oecd_government_at_a_glance",
    housing_affordability: "oecd_wellbeing", life_satisfaction: "oecd_wellbeing", pisa_math: "oecd_wellbeing", road_deaths: "oecd_wellbeing",
  };

  let dataset = null;
  let code = new URLSearchParams(location.search).get("code") || "CZE";
  let lang = (window.PSDLanguage && window.PSDLanguage.current()) || (document.documentElement.lang === "en" ? "en" : "cs");
  let topic = "tax";
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  const locale = () => lang === "en" ? "en-GB" : "cs-CZ";
  const t = () => COPY[lang];

  function metricValue(countryCode, metricCode) {
    return dataset?.countries?.[countryCode]?.comparison?.[metricCode] || null;
  }

  function formatValue(observation, metricCode) {
    if (!observation || !Number.isFinite(observation.value)) return "—";
    const unit = dataset.metrics[metricCode]?.[`unit_${lang}`] || "";
    const digits = unit === "0–1" ? 3 : (Math.abs(observation.value) >= 100 ? 0 : 1);
    return `${observation.value.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit === "%" ? " %" : unit ? ` ${unit}` : ""}`;
  }

  function median(metricCode) {
    const values = Object.keys(dataset.countries).map((countryCode) => metricValue(countryCode, metricCode)?.value).filter(Number.isFinite).sort((a, b) => a - b);
    if (!values.length) return null;
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  }

  function metricCard(metricCode) {
    const contract = dataset.metrics[metricCode];
    const obs = metricValue(code, metricCode);
    const middle = median(metricCode);
    const source = dataset.sources[SOURCE_BY_METRIC[metricCode]];
    if (!contract) return "";
    const medianObs = Number.isFinite(middle) ? { value: middle } : null;
    return `<article class="oecd-metric-card${obs ? "" : " is-missing"}">
      <header><span>${esc(contract[`label_${lang}`])}</span>${obs ? `<b>${esc(obs.year)}</b>` : ""}</header>
      <strong>${formatValue(obs, metricCode)}</strong>
      <div class="oecd-peer"><span>${esc(t().median)}</span><b>${formatValue(medianObs, metricCode)}</b></div>
      <details><summary>${esc(t().methodology)}</summary><p>${esc(contract[`boundary_${lang}`])}</p>${source ? `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} · ${esc(t().source)}</a>` : ""}</details>
      ${obs ? "" : `<small>${esc(t().missing)}</small>`}
    </article>`;
  }

  function renderCountry() {
    if (!countryRoot || !dataset) return;
    countryRoot.innerHTML = `<div class="detail-heading oecd-heading"><div><span class="kicker">${esc(t().kicker)}</span><h2 id="country-oecd-overlay-title">${esc(t().title)}</h2></div><p>${esc(t().intro)}</p></div>
      <div class="oecd-topic-tabs" role="tablist">${Object.keys(TOPICS).map((key) => `<button type="button" role="tab" data-oecd-topic="${key}" aria-selected="${key === topic}">${esc(t().tabs[key])}</button>`).join("")}</div>
      <div class="oecd-metric-grid" role="tabpanel">${TOPICS[topic].map(metricCard).join("")}</div>
      <p class="oecd-contract-note">OECD Data Explorer · ${esc(dataset.missing_values.replaceAll("_", " "))} · ${Object.keys(dataset.countries).length} ${lang === "en" ? "site countries" : "zemí webu"}</p>`;
    countryRoot.querySelectorAll("[data-oecd-topic]").forEach((button) => button.addEventListener("click", () => {
      topic = button.dataset.oecdTopic;
      renderCountry();
    }));
  }

  const HOUSEHOLDS = {
    cs: { "S_C0|AW67|_Z": "Jednotlivec · 67 % průměrné mzdy", "S_C0|AW100|_Z": "Jednotlivec · 100 % průměrné mzdy", "S_C0|AW167|_Z": "Jednotlivec · 167 % průměrné mzdy", "S_C2|AW67|_Z": "Samoživitel/ka · 2 děti · 67 %", "C_C2|AW100|NOEARN_UNEMP": "Pár · 2 děti · jeden příjem 100 %", "C_C2|AW100|AW67": "Pár · 2 děti · příjmy 100 % + 67 %", "C_C2|AW100|AW100": "Pár · 2 děti · příjmy 100 % + 100 %", "C_C0|AW100|AW67": "Pár bez dětí · příjmy 100 % + 67 %" },
    en: { "S_C0|AW67|_Z": "Single · 67% of average wage", "S_C0|AW100|_Z": "Single · 100% of average wage", "S_C0|AW167|_Z": "Single · 167% of average wage", "S_C2|AW67|_Z": "Single parent · 2 children · 67%", "C_C2|AW100|NOEARN_UNEMP": "Couple · 2 children · one income at 100%", "C_C2|AW100|AW67": "Couple · 2 children · incomes 100% + 67%", "C_C2|AW100|AW100": "Couple · 2 children · incomes 100% + 100%", "C_C0|AW100|AW67": "Couple without children · incomes 100% + 67%" },
  };

  function scenarioKey(item) { return `${item.household_type}|${item.principal_income}|${item.spouse_income}`; }
  function compactTaxCard(label, obs, metricCode) {
    return `<article><span>${esc(label)}</span><strong>${formatValue(obs, metricCode)}</strong><small>${obs ? `${esc(t().year)} ${obs.year}` : esc(t().missing)}</small></article>`;
  }

  function renderRevenue() {
    if (!revenueRoot || !dataset) return;
    const country = dataset.countries[code];
    if (!country) { revenueRoot.innerHTML = `<p>${esc(t().missing)}</p>`; return; }
    const scenarios = country.tax.labour?.scenarios || [];
    const selectedKey = revenueRoot.dataset.scenario && scenarios.some((item) => scenarioKey(item) === revenueRoot.dataset.scenario) ? revenueRoot.dataset.scenario : (scenarios.find((item) => scenarioKey(item) === "S_C0|AW100|_Z") ? "S_C0|AW100|_Z" : scenarioKey(scenarios[0] || {}));
    revenueRoot.dataset.scenario = selectedKey;
    const selected = scenarios.find((item) => scenarioKey(item) === selectedKey);
    const asObs = (metric) => selected?.metrics?.[metric] == null ? null : { value: selected.metrics[metric], year: selected.year };
    const corp = country.tax.corporate || {};
    const autonomy = country.tax.autonomy?.local;
    const localObs = autonomy ? { value: autonomy.autonomous_share_pct, year: autonomy.year } : null;
    revenueRoot.innerHTML = `<div class="deep-section-heading"><div><span class="kicker">02 / OECD Taxing Wages</span><h2>${esc(t().rateTitle)}</h2></div><p>${esc(t().rateIntro)}</p></div>
      <label class="oecd-household-select"><span>${esc(t().household)}</span><select>${scenarios.map((item) => `<option value="${esc(scenarioKey(item))}"${scenarioKey(item) === selectedKey ? " selected" : ""}>${esc(HOUSEHOLDS[lang][scenarioKey(item)] || scenarioKey(item))}</option>`).join("")}</select></label>
      <div class="oecd-tax-wedge-grid">${compactTaxCard(t().taxWedge, asObs("av_tw"), "labour_tax_wedge_single")}${compactTaxCard(t().marginalWedge, asObs("mr_tw_pe"), "labour_tax_wedge_single")}${compactTaxCard(t().netRate, asObs("npatr"), "labour_tax_wedge_single")}</div>
      <div class="oecd-rate-strip">${compactTaxCard(dataset.metrics.corporate_statutory_rate[`label_${lang}`], corp.statutory_combined, "corporate_statutory_rate")}${compactTaxCard(dataset.metrics.corporate_eatr[`label_${lang}`], corp.eatr, "corporate_eatr")}${compactTaxCard(dataset.metrics.corporate_emtr[`label_${lang}`], corp.emtr, "corporate_emtr")}${compactTaxCard(dataset.metrics.local_tax_autonomy[`label_${lang}`], localObs, "local_tax_autonomy")}${compactTaxCard(dataset.metrics.net_carbon_rate[`label_${lang}`], country.tax.carbon?.net_effective_rate, "net_carbon_rate")}</div>
      <p class="oecd-contract-note">${esc(dataset.metrics.labour_tax_wedge_single[`boundary_${lang}`])}</p>`;
    revenueRoot.querySelector("select")?.addEventListener("change", (event) => { revenueRoot.dataset.scenario = event.target.value; renderRevenue(); });
  }

  function render() { renderCountry(); renderRevenue(); }
  addEventListener("countryprofilechange", (event) => { code = event.detail.code; lang = event.detail.lang; render(); });
  addEventListener("psdlanguagechange", (event) => { lang = event.detail?.lang || lang; render(); });
  document.querySelector("#deep-dive-country")?.addEventListener("change", (event) => { code = event.target.value; render(); });

  fetch("/data/oecd-key-metrics.v1.json").then((response) => {
    if (!response.ok) throw new Error(`OECD overlay HTTP ${response.status}`);
    return response.json();
  }).then((payload) => { dataset = payload; render(); }).catch((error) => {
    console.error(error);
    [countryRoot, revenueRoot].filter(Boolean).forEach((root) => { root.innerHTML = `<p class="oecd-contract-note">${esc(t().missing)}</p>`; });
  });
})();
