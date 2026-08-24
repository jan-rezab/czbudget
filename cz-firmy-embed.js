(() => {
  const select = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const language = document.documentElement.lang === "en" ? "en" : "cs";
  const english = language === "en", locale = english ? "en-GB" : "cs-CZ";
  const format = value => new Intl.NumberFormat(locale, {maximumFractionDigits: 0}).format(value);
  const money = value => value == null ? "—" : new Intl.NumberFormat(locale, {minimumFractionDigits: 0, maximumFractionDigits: 1}).format(value);
  const percent = value => value == null ? "—" : `${new Intl.NumberFormat(locale, {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(value)} %`;
  const billions = value => new Intl.NumberFormat(locale, {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(value / 1000);
  const signed = value => value < 0 ? `−${format(Math.abs(value))}` : `+${format(value)}`;
  const signedMoney = value => value < 0 ? `−${money(Math.abs(value))}` : `+${money(value)}`;
  const translations={
    category:{Firma:"Company",Nemocnice:"Hospital","Vysoká škola":"University","Zdravotní pojišťovna":"Health insurer"},
    owner:{"Jiný veřejný vlastník":"Other public owner",Obec:"Municipality",Kraj:"Region",Stát:"State",DSO:"Municipal association","Územní veřejná úroveň":"Territorial public tier","Stát / ústřední úroveň":"State / central tier","Veřejné zdravotní pojištění":"Public health insurance"},
    sector:{Energetika:"Energy","Doprava a infrastruktura":"Transport and infrastructure","Finance a rozvoj":"Finance and development","Reality a cestovní ruch":"Real estate and tourism","Digitální a veřejné služby":"Digital and public services","Obrana a strategický průmysl":"Defence and strategic industry","Přírodní zdroje a sanace":"Natural resources and remediation","Zemědělství a potraviny":"Agriculture and food","Vodní hospodářství":"Water management"},
    topLine:{obrat:"turnover",výnosy:"revenue"},source:{"MF strategické subjekty":"Ministry of Finance strategic entities","ČSÚIS VZZ":"CSUIS income statement"}
  };
  const tr=(group,value)=>english?(translations[group]?.[value]||value):value;

  function rows(items, metric, kind) {
    const maximum = Math.max(...items.map(item => Math.abs(item.metrics[metric])));
    return items.map((item, index) => {
      const value = item.metrics[metric];
      const rowKind = value < 0 ? "loss" : kind;
      const context = metric === "total_assets"
        ? `${english ? "Result" : "Výsledek"} ${signed(item.metrics.net_result)} ${english ? "CZK m" : "mil. Kč"} · ${format(item.metrics.employees)} ${english ? "employees" : "zaměstnanců"}`
        : `${english ? "Assets" : "Aktiva"} ${format(item.metrics.total_assets)} ${english ? "CZK m" : "mil. Kč"} · ${english ? "turnover" : "obrat"} ${format(item.metrics.turnover)} ${english ? "CZK m" : "mil. Kč"}`;
      return `<article class="enterprise-row ${rowKind}">
        <span class="enterprise-rank">${String(index + 1).padStart(2, "0")}</span>
        <div class="enterprise-name"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(tr("sector",item.classification?.sector_name))} · ${english ? "ID" : "IČO"} ${escapeHtml(item.ico)}</small></div>
        <div class="enterprise-bar" aria-hidden="true"><i style="width:${(Math.abs(value) / maximum * 100).toFixed(1)}%"></i></div>
        <strong class="enterprise-value">${metric === "net_result" ? signed(value) : format(value)}<small>${english ? "CZK m" : "mil. Kč"}</small></strong>
        <p>${context}</p>
      </article>`;
    }).join("");
  }

  function renderRegistry(data) {
    const search = select("#embed-entity-search");
    const owner = select("#embed-entity-owner");
    const sort = select("#embed-entity-sort");
    const body = select("#embed-public-entity-rows");
    const tabs = [...document.querySelectorAll("#embed-entity-tabs button")];
    let activeCategory = "all";
    const owners = [...new Set(data.entities.map(item => item.owner_level))].sort((a, b) => tr("owner",a).localeCompare(tr("owner",b),locale));
    owner.insertAdjacentHTML("beforeend", owners.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(tr("owner",value))}</option>`).join(""));

    const tabCounts = {
      all: "#embed-tab-all",
      Firma: "#embed-tab-companies",
      "Vysoká škola": "#embed-tab-universities",
      Nemocnice: "#embed-tab-hospitals",
      "Zdravotní pojišťovna": "#embed-tab-health-insurers"
    };
    Object.entries(tabCounts).forEach(([key, selector]) => {
      const group = data.summary.groups[key];
      select(selector).textContent = `${format(group.entity_count)} · ${format(group.financial_result_count)} ${english ? "with results" : "s výsledkem"}`;
    });

    function updateSummary() {
      const group = data.summary.groups[activeCategory];
      const label = english ? (activeCategory === "all" ? "all entities" : activeCategory === "Firma" ? "companies" : activeCategory === "Vysoká škola" ? "universities" : activeCategory === "Nemocnice" ? "hospitals" : "health insurers") : (activeCategory === "all" ? "všechny subjekty" : activeCategory === "Firma" ? "firmy" : activeCategory === "Vysoká škola" ? "vysoké školy" : activeCategory === "Nemocnice" ? "nemocnice" : "zdravotní pojišťovny");
      const hasFinancials = group.financial_result_count > 0;
      select("#embed-profit-sum").textContent = hasFinancials ? billions(group.positive_net_result_sum_mczk) : "—";
      select("#embed-loss-sum").textContent = hasFinancials ? `−${billions(group.negative_net_result_absolute_sum_mczk)}` : "—";
      select("#embed-net-sum").textContent = hasFinancials ? billions(group.net_result_sum_mczk) : "—";
      select("#embed-turnover-sum").textContent = hasFinancials ? billions(group.revenue_sum_mczk) : "—";
      select("#embed-aggregate-scope").textContent = english ? `Totals for ${label}: ${format(group.financial_result_count)} of ${format(group.entity_count)} entities have an available 2024 result.` : `Součty za ${label}: ${format(group.financial_result_count)} z ${format(group.entity_count)} subjektů s dostupným výsledkem za rok 2024.`;
      select("#embed-registry-coverage").textContent = `${format(group.financial_result_count)} / ${format(group.entity_count)} ${english ? "with results" : "s výsledkem"}`;
    }

    function renderTable() {
      const query = search.value.trim().toLocaleLowerCase("cs");
      const visible = data.entities.filter(item =>
        (activeCategory === "all" || item.category === activeCategory) &&
        (owner.value === "all" || item.owner_level === owner.value) &&
        (!query || `${item.name} ${item.ico}`.toLocaleLowerCase("cs").includes(query))
      );
      visible.sort((a, b) => {
        if (sort.value === "name") return a.name.localeCompare(b.name, "cs");
        const field = sort.value === "result" ? "net_result_mczk" : sort.value === "margin" ? "net_margin_pct" : "value_mczk";
        const left = a.top_line[field];
        const right = b.top_line[field];
        if (left == null && right == null) return a.name.localeCompare(b.name, "cs");
        if (left == null) return 1;
        if (right == null) return -1;
        return right - left || a.name.localeCompare(b.name, "cs");
      });
      body.innerHTML = visible.map(item => `<tr${item.strategic_highlight ? ' class="strategic-highlight"' : ""}>
        <td><strong>${escapeHtml(item.name)}</strong><small>${english ? "ID" : "IČO"} ${escapeHtml(item.ico)} · ${escapeHtml(item.legal_form)}</small></td>
        <td><span class="entity-type">${escapeHtml(tr("category",item.category))}</span></td>
        <td>${escapeHtml(tr("owner",item.owner_level))}</td>
        <td class="numeric">${item.top_line.value_mczk == null ? "—" : `${money(item.top_line.value_mczk)} <small>${english ? "CZK m" : "mil. Kč"} · ${escapeHtml(tr("topLine",item.top_line.definition))}</small>`}</td>
        <td class="numeric ${item.top_line.net_result_mczk < 0 ? "negative" : ""}">${item.top_line.net_result_mczk == null ? "—" : `${signedMoney(item.top_line.net_result_mczk)} <small>${english ? "CZK m" : "mil. Kč"}</small>`}</td>
        <td class="numeric ${item.top_line.net_margin_pct < 0 ? "negative" : ""}">${percent(item.top_line.net_margin_pct)}</td>
        <td>${item.financial_source_kind ? `<span class="data-available">${escapeHtml(tr("source",item.financial_source_kind))}</span>` : item.category === "Zdravotní pojišťovna" ? `<span class="data-missing">${english ? "special statement outside the income-statement dataset" : "speciální výkaz mimo VZZ"}</span>` : `<span class="data-missing">${english ? "statement unavailable" : "výkaz chybí"}</span>`}${item.strategic_highlight ? '<small class="highlight-label">TOP 38 highlight</small>' : ""}</td>
      </tr>`).join("");
      select("#embed-registry-count").textContent = english ? `Showing ${format(visible.length)} of ${format(data.summary.groups[activeCategory].entity_count)} entities in this tab` : `Zobrazeno ${format(visible.length)} z ${format(data.summary.groups[activeCategory].entity_count)} subjektů v záložce`;
    }

    tabs.forEach(tab => tab.addEventListener("click", () => {
      activeCategory = tab.dataset.category;
      tabs.forEach(item => item.setAttribute("aria-selected", String(item === tab)));
      updateSummary();
      renderTable();
    }));
    [search, owner, sort].forEach(control => control.addEventListener(control === search ? "input" : "change", renderTable));
    updateSummary();
    renderTable();
  }

  Promise.all([
    fetch("data/cz-state-enterprises-2024.json?v=20260820-3"),
    fetch("data/cz-public-entities-2024.json?v=20260822-1")
  ])
    .then(async responses => {
      for (const response of responses) if (!response.ok) throw new Error(`Dataset odpověděl ${response.status}`);
      return Promise.all(responses.map(response => response.json()));
    })
    .then(([data, publicData]) => {
      const modes = {
        profit: {
          heading: english ? "Most profitable" : "Nejziskovější",
          count: "TOP 20",
          metric: "net_result",
          kind: "profit",
          items: [...data.entities].sort((a, b) => b.metrics.net_result - a.metrics.net_result).slice(0, 20),
          note: english ? "Ranked by each entity's individual result after tax; ČEZ is the parent company, not the consolidated group." : "Pořadí podle individuálního výsledku po zdanění; ČEZ je mateřská společnost, nikoli konsolidovaná skupina."
        },
        weakest: {
          heading: english ? "Weakest financial result" : "Nejslabší hospodářský výsledek",
          count: `BOTTOM 20 · ${data.summary.loss_making_count} ${english ? "losses" : "ztrát"}`,
          metric: "net_result",
          kind: "loss",
          items: [...data.entities].sort((a, b) => a.metrics.net_result - b.metrics.net_result).slice(0, 20),
          note: english ? `Only ${data.summary.loss_making_count} entities report a loss. The remaining positions are the lowest positive results, not losses.` : `Záporný výsledek má jen ${data.summary.loss_making_count} subjektů. Další pozice jsou nejnižší kladné výsledky, nikoli ztráty.`
        },
        largest: {
          heading: english ? "Largest by assets" : "Největší podle aktiv",
          count: "TOP 20",
          metric: "total_assets",
          kind: "largest",
          items: [...data.entities].sort((a, b) => b.metrics.total_assets - a.metrics.total_assets).slice(0, 20),
          note: english ? "Scale is measured by total assets because neither turnover nor employee count is comparable across energy, banking and infrastructure." : "Velikost měříme aktivy celkem, protože obrat ani počet zaměstnanců nejsou napříč energetikou, bankami a infrastrukturou srovnatelné."
        }
      };

      function render(modeName) {
        const mode = modes[modeName];
        select("#embed-ranking-heading").textContent = mode.heading;
        select("#embed-ranking-count").textContent = mode.count;
        select("#embed-ranking-note").textContent = mode.note;
        select("#embed-enterprise-list").innerHTML = rows(mode.items, mode.metric, mode.kind);
        document.querySelectorAll("#embed-ranking-mode button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === modeName)));
      }

      document.querySelectorAll("#embed-ranking-mode button").forEach(button => button.addEventListener("click", () => render(button.dataset.mode)));
      renderRegistry(publicData);
      render("profit");
    })
    .catch(error => {
      select("#embed-enterprise-list").innerHTML = `<p class="load-error">${english ? "Company data could not be loaded" : "Data firem se nepodařilo načíst"}: ${escapeHtml(error.message)}</p>`;
      console.error(error);
    });
})();
