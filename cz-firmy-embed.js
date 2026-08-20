(() => {
  const select = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const format = value => new Intl.NumberFormat("cs-CZ", {maximumFractionDigits: 0}).format(value);
  const money = value => value == null ? "—" : new Intl.NumberFormat("cs-CZ", {minimumFractionDigits: 0, maximumFractionDigits: 1}).format(value);
  const billions = value => new Intl.NumberFormat("cs-CZ", {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(value / 1000);
  const signed = value => value < 0 ? `−${format(Math.abs(value))}` : `+${format(value)}`;

  function rows(items, metric, kind) {
    const maximum = Math.max(...items.map(item => Math.abs(item.metrics[metric])));
    return items.map((item, index) => {
      const value = item.metrics[metric];
      const rowKind = value < 0 ? "loss" : kind;
      const context = metric === "total_assets"
        ? `Výsledek ${signed(item.metrics.net_result)} mil. Kč · ${format(item.metrics.employees)} zaměstnanců`
        : `Aktiva ${format(item.metrics.total_assets)} mil. Kč · obrat ${format(item.metrics.turnover)} mil. Kč`;
      return `<article class="enterprise-row ${rowKind}">
        <span class="enterprise-rank">${String(index + 1).padStart(2, "0")}</span>
        <div class="enterprise-name"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.classification?.sector_name)} · IČO ${escapeHtml(item.ico)}</small></div>
        <div class="enterprise-bar" aria-hidden="true"><i style="width:${(Math.abs(value) / maximum * 100).toFixed(1)}%"></i></div>
        <strong class="enterprise-value">${metric === "net_result" ? signed(value) : format(value)}<small>mil. Kč</small></strong>
        <p>${context}</p>
      </article>`;
    }).join("");
  }

  function renderRegistry(data) {
    const search = select("#embed-entity-search");
    const category = select("#embed-entity-category");
    const owner = select("#embed-entity-owner");
    const body = select("#embed-public-entity-rows");
    const owners = [...new Set(data.entities.map(item => item.owner_level))].sort((a, b) => a.localeCompare(b, "cs"));
    owner.insertAdjacentHTML("beforeend", owners.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(""));

    function renderTable() {
      const query = search.value.trim().toLocaleLowerCase("cs");
      const visible = data.entities.filter(item =>
        (category.value === "all" || item.category === category.value) &&
        (owner.value === "all" || item.owner_level === owner.value) &&
        (!query || `${item.name} ${item.ico}`.toLocaleLowerCase("cs").includes(query))
      );
      body.innerHTML = visible.map(item => `<tr${item.strategic_highlight ? ' class="strategic-highlight"' : ""}>
        <td><strong>${escapeHtml(item.name)}</strong><small>IČO ${escapeHtml(item.ico)} · ${escapeHtml(item.legal_form)}</small></td>
        <td><span class="entity-type">${escapeHtml(item.category)}</span></td>
        <td>${escapeHtml(item.owner_level)}</td>
        <td class="numeric">${item.revenue_mczk == null ? "—" : `${money(item.revenue_mczk)} <small>mil. Kč</small>`}</td>
        <td class="numeric ${item.net_result_mczk < 0 ? "negative" : ""}">${item.net_result_mczk == null ? "—" : `${signed(item.net_result_mczk)} <small>mil. Kč</small>`}</td>
        <td>${item.financial_source_kind ? `<span class="data-available">${escapeHtml(item.financial_source_kind)}</span>` : '<span class="data-missing">výkaz chybí</span>'}${item.strategic_highlight ? '<small class="highlight-label">TOP 38 highlight</small>' : ""}</td>
      </tr>`).join("");
      select("#embed-registry-count").textContent = `Zobrazeno ${format(visible.length)} z ${format(data.summary.entity_count)} subjektů`;
    }

    select("#embed-registry-coverage").textContent = `${format(data.summary.financial_result_count)} / ${format(data.summary.entity_count)} s výsledkem`;
    [search, category, owner].forEach(control => control.addEventListener(control === search ? "input" : "change", renderTable));
    renderTable();
  }

  Promise.all([
    fetch("data/cz-state-enterprises-2024.json"),
    fetch("data/cz-public-entities-2024.json")
  ])
    .then(async responses => {
      for (const response of responses) if (!response.ok) throw new Error(`Dataset odpověděl ${response.status}`);
      return Promise.all(responses.map(response => response.json()));
    })
    .then(([data, publicData]) => {
      const modes = {
        profit: {
          heading: "Nejziskovější",
          count: "TOP 20",
          metric: "net_result",
          kind: "profit",
          items: [...data.entities].sort((a, b) => b.metrics.net_result - a.metrics.net_result).slice(0, 20),
          note: "Pořadí podle individuálního výsledku po zdanění; ČEZ je mateřská společnost, nikoli konsolidovaná skupina."
        },
        weakest: {
          heading: "Nejslabší hospodářský výsledek",
          count: `BOTTOM 20 · ${data.summary.loss_making_count} ztrát`,
          metric: "net_result",
          kind: "loss",
          items: [...data.entities].sort((a, b) => a.metrics.net_result - b.metrics.net_result).slice(0, 20),
          note: `Záporný výsledek má jen ${data.summary.loss_making_count} subjektů. Další pozice jsou nejnižší kladné výsledky, nikoli ztráty.`
        },
        largest: {
          heading: "Největší podle aktiv",
          count: "TOP 20",
          metric: "total_assets",
          kind: "largest",
          items: [...data.entities].sort((a, b) => b.metrics.total_assets - a.metrics.total_assets).slice(0, 20),
          note: "Velikost měříme aktivy celkem, protože obrat ani počet zaměstnanců nejsou napříč energetikou, bankami a infrastrukturou srovnatelné."
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

      select("#embed-profit-sum").textContent = billions(publicData.summary.positive_net_result_sum_mczk);
      select("#embed-loss-sum").textContent = `−${billions(publicData.summary.negative_net_result_absolute_sum_mczk)}`;
      select("#embed-net-sum").textContent = billions(publicData.summary.net_result_sum_mczk);
      select("#embed-turnover-sum").textContent = billions(publicData.summary.revenue_sum_mczk);
      document.querySelectorAll("#embed-ranking-mode button").forEach(button => button.addEventListener("click", () => render(button.dataset.mode)));
      renderRegistry(publicData);
      render("profit");
    })
    .catch(error => {
      select("#embed-enterprise-list").innerHTML = `<p class="load-error">Data firem se nepodařilo načíst: ${escapeHtml(error.message)}</p>`;
      console.error(error);
    });
})();
