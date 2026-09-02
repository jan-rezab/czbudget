(() => {
  const assetRoot = new URL(".", document.currentScript?.src || location.href);
  const root = document.querySelector("#smlouvy-2026");
  if (!root) return;

  const lang = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "cs";
  const copy = {
    cs: { kicker:"Detail roku 2026", title:"Všech 4 215 smluv zveřejněných v roce 2026", intro:"Vyhledávejte předmět, dodavatele, IČO, interní kód investiční akce nebo číslo SAP objednávky.", search:"Hledat", identifier:"Identifikátor", all:"Všechny smlouvy", projectOnly:"S kódem akce", sapOnly:"Se SAP objednávkou", sort:"Řazení", newest:"Nejnovější", largest:"Nejvyšší hodnota", date:"Datum", contract:"Smlouva a identifikátory", supplier:"Dodavatel", classification:"Klasifikace", value:"Hodnota", more:"Načíst dalších 50", warning:"Výběr roku používá datum zveřejnění v registru; ve sloupci Datum je datum uzavření. Kódy akce a SAP objednávky jsou rozpoznané z textu smlouvy. Rozpočtová položka zůstává odhadem; nejde o účetní spárování platby.", contracts:"smluv", shown:"zobrazeno", known:"se známou hodnotou", suppliers:"dodavatelů", project:"kód akce", sap:"SAP", unmatched:"Bez spolehlivého přiřazení", empty:"Žádné smlouvy neodpovídají filtrům.", loading:"Načítám detail…", error:"Detail smluv se nepodařilo načíst." },
    en: { kicker:"2026 detail", title:"All 4,215 contracts published in 2026", intro:"Search subjects, suppliers, registration IDs, internal investment-project codes or SAP order numbers.", search:"Search", identifier:"Identifier", all:"All contracts", projectOnly:"With project code", sapOnly:"With SAP order", sort:"Sort", newest:"Newest", largest:"Highest value", date:"Date", contract:"Contract and identifiers", supplier:"Supplier", classification:"Classification", value:"Value", more:"Load 50 more", warning:"The year is based on register publication date; the Date column retains the signature date. Project and SAP identifiers are detected in contract text. The budget line remains an estimate, not an accounting reconciliation.", contracts:"contracts", shown:"shown", known:"with known value", suppliers:"suppliers", project:"project", sap:"SAP", unmatched:"No reliable match", empty:"No contracts match the filters.", loading:"Loading detail…", error:"Contract detail could not be loaded." }
  }[lang];
  root.querySelectorAll("[data-cy-copy]").forEach(node => { const value = copy[node.dataset.cyCopy]; if (value) node.textContent = value; });

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const money = value => value == null ? "—" : new Intl.NumberFormat(lang === "en" ? "en-GB" : "cs-CZ", {style:"currency",currency:"CZK",maximumFractionDigits:0}).format(value);
  const date = value => value ? new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "cs-CZ").format(new Date(value)) : "—";
  const number = value => new Intl.NumberFormat(lang === "en" ? "en-GB" : "cs-CZ").format(value);
  const state = {data:null, query:"", identifier:"all", sort:"newest", shown:50};
  const body = root.querySelector("#contract-year-body");
  const result = root.querySelector("#contract-year-result");
  const more = root.querySelector("#contract-year-more");

  function rows() {
    const query = state.query.trim().toLocaleLowerCase();
    const filtered = state.data.contracts.filter(item => {
      if (state.identifier === "project" && !item.project_codes.length) return false;
      if (state.identifier === "sap" && !item.sap_orders.length) return false;
      if (!query) return true;
      const haystack = [item.subject, ...item.project_codes, ...item.sap_orders, ...item.suppliers.flatMap(s => [s.name, s.ico])].join(" ").toLocaleLowerCase();
      return haystack.includes(query);
    });
    if (state.sort === "value") filtered.sort((a,b) => (b.value_czk ?? -Infinity) - (a.value_czk ?? -Infinity));
    else filtered.sort((a,b) => String(b.signed_at || "").localeCompare(String(a.signed_at || "")) || String(b.published_at || "").localeCompare(String(a.published_at || "")));
    return filtered;
  }

  function render() {
    const filtered = rows();
    const visible = filtered.slice(0, state.shown);
    result.textContent = `${number(visible.length)} ${copy.shown} · ${number(filtered.length)} ${copy.contracts}`;
    body.innerHTML = visible.length ? visible.map(item => {
      const ids = [
        ...item.project_codes.map(code => `<span class="contract-id project-id"><b>${esc(copy.project)}</b>${esc(code)}</span>`),
        ...item.sap_orders.map(code => `<span class="contract-id sap-id"><b>${esc(copy.sap)}</b>${esc(code)}</span>`)
      ].join("");
      const suppliers = item.suppliers.map(s => `<span><strong>${esc(s.name)}</strong>${s.ico ? `<small>IČO ${esc(s.ico)}</small>` : ""}</span>`).join("");
      const match = item.budget_match || {};
      const classification = match.codes?.length ? `<strong>${esc(match.codes.join(" / "))}</strong><span>${esc((match.labels || []).join(" / "))}</span><small>${esc(match.confidence || "")}</small>` : `<span>${esc(copy.unmatched)}</span>`;
      return `<tr><td><time>${esc(date(item.signed_at))}</time><small>${esc(date(item.published_at))}</small></td><td><a href="${esc(item.source_url)}" target="_blank" rel="noopener"><strong>${esc(item.subject)}</strong></a><div class="contract-identifiers">${ids || "—"}</div>${item.parent_contract_id ? `<small class="contract-parent">↳ ${esc(item.parent_contract_id)}</small>` : ""}</td><td><div class="contract-suppliers">${suppliers || "—"}</div></td><td><div class="contract-classification">${classification}</div></td><td><strong>${esc(money(item.value_czk))}</strong></td></tr>`;
    }).join("") : `<tr><td colspan="5">${esc(copy.empty)}</td></tr>`;
    more.hidden = state.shown >= filtered.length;
  }

  fetch(new URL("data/contracts/00075370.2026.v1.json", assetRoot)).then(response => {
    if (!response.ok) throw new Error(response.status);
    return response.json();
  }).then(data => {
    state.data = data;
    const summary = data.summary;
    root.querySelector("#contract-year-summary").innerHTML = [
      [number(summary.contracts), copy.contracts],
      [`${(summary.known_value_contracts / summary.contracts * 100).toLocaleString(lang === "en" ? "en-GB" : "cs-CZ", {maximumFractionDigits:1})} %`, copy.known],
      [number(summary.suppliers), copy.suppliers],
      [number(summary.with_project_code), copy.project],
      [number(summary.with_sap_order), copy.sap]
    ].map(([value,label]) => `<article><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join("");
    render();
  }).catch(() => { body.innerHTML = `<tr><td colspan="5">${esc(copy.error)}</td></tr>`; more.hidden = true; });

  root.querySelector("#contract-year-query").addEventListener("input", event => { state.query = event.target.value; state.shown = 50; render(); });
  root.querySelector("#contract-year-identifier").addEventListener("change", event => { state.identifier = event.target.value; state.shown = 50; render(); });
  root.querySelector("#contract-year-sort").addEventListener("change", event => { state.sort = event.target.value; state.shown = 50; render(); });
  more.addEventListener("click", () => { state.shown += 50; render(); });
})();
