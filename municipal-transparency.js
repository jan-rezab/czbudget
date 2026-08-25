(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "../";
  const root = document.querySelector("#transparency-atlas");
  if (!root) return;
  let registry;
  let geometry;
  const copy = {
    en: {
      assessed: "countries assessed", full: "Full national lifecycle", paired: "Budget + final accounts",
      accounts: "Final accounts / execution only", decentralized: "No single national item-level budget dataset found",
      unassessed: "Not yet assessed", stages: ["Approved", "Revised", "In-year", "Final", "Function", "Economic", "API / bulk"],
      status: {loaded:"Loaded",loaded_partial:"Partly loaded",upgrading:"Detail upgrade running",crawling:"Crawl started",candidate:"Recommended next",assessed:"Assessed"},
      source: "Official source ↗", caveat: "Important: grey means not assessed. The hatched category does not mean municipalities publish nothing—it means we found no single national, comparable, item-level budget lifecycle.",
      targetTitle: "The requested crawl queue", gapTitle: "Where adopted budgets remain decentralized", tableTitle: "Evidence matrix",
      yes: "Published", no: "Not in the national layer", unknown: "Needs verification"
    },
    cs: {
      assessed: "posouzených zemí", full: "Úplný národní životní cyklus", paired: "Rozpočet + závěrečné účty",
      accounts: "Jen skutečnost / plnění", decentralized: "Nenalezen jednotný národní položkový rozpočet",
      unassessed: "Zatím neposouzeno", stages: ["Schválený", "Upravený", "Během roku", "Skutečnost", "Funkce", "Ekonomika", "API / bulk"],
      status: {loaded:"Načteno",loaded_partial:"Částečně načteno",upgrading:"Běží detailní upgrade",crawling:"Crawl spuštěn",candidate:"Doporučený další",assessed:"Posouzeno"},
      source: "Oficiální zdroj ↗", caveat: "Důležité: šedá znamená neposouzeno. Šrafovaná kategorie neříká, že obce nic nezveřejňují—říká, že jsme nenalezli jednotný národní, srovnatelný položkový životní cyklus rozpočtu.",
      targetTitle: "Požadovaná fronta crawlů", gapTitle: "Kde schválené rozpočty zůstávají decentralizované", tableTitle: "Matice důkazů",
      yes: "Zveřejněno", no: "Není v národní vrstvě", unknown: "Nutno ověřit"
    }
  };
  const categoryOrder = ["full_lifecycle", "budget_and_accounts", "accounts_only", "decentralized"];
  const categoryLabel = (category, t) => ({full_lifecycle:t.full,budget_and_accounts:t.paired,accounts_only:t.accounts,decentralized:t.decentralized,unassessed:t.unassessed})[category];
  const language = () => document.documentElement.lang === "en" ? "en" : "cs";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const symbol = (value) => value === true ? "✓" : value === false ? "—" : "?";
  const symbolClass = (value) => value === true ? "yes" : value === false ? "no" : "unknown";
  const flag = (iso2) => [...iso2.toUpperCase()].map((character) => String.fromCodePoint(127397 + character.charCodeAt(0))).join("");

  function render() {
    if (!registry || !geometry) return;
    const lang = language(), t = copy[lang], byIso = new Map(registry.countries.map((country) => [country.iso2, country]));
    const counts = Object.fromEntries(categoryOrder.map((category) => [category, registry.countries.filter((country) => country.category === category).length]));
    const paths = geometry.locations.map((location) => {
      const country = byIso.get(location.id), category = country?.category || "unassessed";
      const label = country ? `${country[`name_${lang}`]}: ${categoryLabel(category, t)}` : `${location.name}: ${t.unassessed}`;
      return `<path class="atlas-country atlas-${category}" d="${location.path}" tabindex="${country ? "0" : "-1"}" data-iso="${location.id}" aria-label="${esc(label)}"><title>${esc(label)}</title></path>`;
    }).join("");
    const legend = categoryOrder.map((category) => `<li><i class="atlas-${category}"></i><span>${esc(categoryLabel(category,t))}</span><b>${counts[category]}</b></li>`).join("") + `<li><i class="atlas-unassessed"></i><span>${esc(t.unassessed)}</span><b>—</b></li>`;
    const targets = registry.countries.filter((country) => ["NLD","BRA","DNK","ESP","NOR","JPN","KOR"].includes(country.iso3));
    const targetCards = targets.map((country) => `<article class="atlas-target" id="atlas-${country.iso3}"><header><span class="atlas-flag" aria-hidden="true">${flag(country.iso2)}</span><div><small>${country.iso3}</small><h3>${esc(country[`name_${lang}`])}</h3></div><b class="pipeline-${country.pipeline}">${esc(t.status[country.pipeline])}</b></header><p>${esc(country[`note_${lang}`])}</p><a href="${esc(country.source)}" target="_blank" rel="noopener">${esc(t.source)}</a></article>`).join("");
    const gaps = registry.countries.filter((country) => country.category === "decentralized").map((country) => `<li><span class="atlas-flag" aria-hidden="true">${flag(country.iso2)}</span><span><b>${esc(country[`name_${lang}`])}</b><small>${esc(country[`note_${lang}`])}</small></span></li>`).join("");
    const featureKeys = ["enacted","revised","execution","actual","function","economic","api"];
    const rows = [...registry.countries].sort((a,b) => categoryOrder.indexOf(a.category)-categoryOrder.indexOf(b.category) || a[`name_${lang}`].localeCompare(b[`name_${lang}`], lang)).map((country) => `<tr id="atlas-row-${country.iso2}"><th><span class="atlas-flag" aria-hidden="true">${flag(country.iso2)}</span><span>${esc(country[`name_${lang}`])}<small>${esc(categoryLabel(country.category,t))}</small></span></th>${featureKeys.map((key) => `<td class="${symbolClass(country.features[key])}" title="${esc(country.features[key] === true ? t.yes : country.features[key] === false ? t.no : t.unknown)}">${symbol(country.features[key])}</td>`).join("")}</tr>`).join("");
    root.innerHTML = `<div class="atlas-kpis"><article><strong>${registry.countries.length}</strong><span>${esc(t.assessed)}</span></article><article><strong>${counts.full_lifecycle}</strong><span>${esc(t.full)}</span></article><article><strong>${counts.budget_and_accounts}</strong><span>${esc(t.paired)}</span></article><article><strong>${counts.decentralized}</strong><span>${esc(t.decentralized)}</span></article></div>
      <div class="atlas-map-panel"><div class="atlas-map-wrap"><svg class="atlas-map" viewBox="${geometry.viewBox}" role="img" aria-label="${esc(t.assessed)}"><defs><pattern id="atlas-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#d2ccc1"></rect><line x1="0" y1="0" x2="0" y2="8" stroke="#8b8d83" stroke-width="2"></line></pattern></defs>${paths}</svg></div><ol class="atlas-legend">${legend}</ol></div>
      <p class="atlas-caveat">${esc(t.caveat)}</p>
      <h3 class="atlas-subtitle">${esc(t.targetTitle)}</h3><div class="atlas-targets">${targetCards}</div>
      <div class="atlas-lower"><section><h3>${esc(t.gapTitle)}</h3><ul class="atlas-gap-list">${gaps}</ul></section><section><h3>${esc(t.tableTitle)}</h3><div class="atlas-table-wrap" tabindex="0"><table class="atlas-table"><thead><tr><th>Country</th>${t.stages.map((label) => `<th>${esc(label)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></section></div>`;
    root.querySelectorAll(".atlas-country[tabindex='0']").forEach((path) => {
      const activate = () => { const row = root.querySelector(`#atlas-row-${path.dataset.iso}`); row?.scrollIntoView({behavior:"smooth",block:"center"}); row?.classList.add("is-highlighted"); setTimeout(() => row?.classList.remove("is-highlighted"), 1800); };
      path.addEventListener("click", activate); path.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") activate(); });
    });
  }

  Promise.all([
    fetch(`${assetRoot}data/municipal-transparency.v1.json`).then((response) => response.json()),
    fetch(`${assetRoot}data/world-map.v1.json`).then((response) => response.json())
  ]).then(([data, map]) => { registry = data; geometry = map; render(); }).catch((error) => { console.error(error); root.textContent = "Transparency atlas could not be loaded."; });
  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => setTimeout(render)));
})();
