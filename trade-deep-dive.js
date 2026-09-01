(() => {
  const params = new URLSearchParams(location.search);
  const lang = params.get("lang") === "en" || document.documentElement.lang === "en" ? "en" : "cs";
  document.documentElement.lang = lang;

  const copy = {
    cs: {
      eyebrow: "Report / Zahraniční obchod", titleLead: "Obchodní trh", titleEm: "na jednom plátně",
      intro: "Velikost ukazuje hodnotu obchodu, barva přebytek nebo deficit. Klikněte na sektor a potom na zboží — zobrazí se jeho partneři.", countryLabel: "Země",
      pulseNav: "Bilance", matrixNav: "Mapa trhu", trendNav: "Vývoj", compositionNav: "Žebříčky", methodNav: "Metodika",
      pulseKicker: "Vybrané období", pulseTitle: "Obchodní bilance na první pohled", pulseIntro: "Vývoz minus dovoz. Červená znamená deficit, zelená přebytek.",
      matrixKicker: "Struktura posledního roku", matrixTitle: "Trh zboží jako portfolio", matrixIntro: "Každá dlaždice je kapitola HS. Plocha ukazuje hodnotu, barva obchodní bilanci. Kliknutím otevřete sektor a partnery.",
      trendKicker: "Vývoj v čase", trendTitle: "Dovoz a vývoz v čase", trendIntro: "Přejeďte po grafu nebo klikněte na bod. Vybrané období se propíše do horních metrik i detailu pod grafem.",
      annual: "Ročně", monthly: "Měsíčně", exports: "Vývoz", imports: "Dovoz", chartNote: "Hodnoty jsou v běžných USD. Mezery v řadě jsou chybějící data, nikoli nuly.",
      compositionKicker: "Žebříčky posledního roku", compositionTitle: "Největší partneři a kapitoly", compositionIntro: "Přepněte dovoz nebo vývoz. Kliknutí na kapitolu otevře stejný detail partnerů jako mapa trhu.",
      partnersTitle: "Největší obchodní partneři", productsTitle: "Největší kapitoly zboží",
      methodKicker: "Jak číst data", methodTitle: "Jedna bilance, dvě oceňovací báze", methodIntro: "UN Comtrade obvykle oceňuje dovoz včetně pojištění a dopravy (CIF), zatímco vývoz na hranici vývozce (FOB). Bilance je proto orientační analytický rozdíl, ne národní účet.",
      sourceCopy: "Zdrojové hlášení země, bez zrcadlového doplňování chybějících hodnot.", grainTitle: "Zachované dimenze", grainCopy: "Období, reportér, tok, partner a šestimístný HS kód. Grafy sčítají pouze jednu nejjemnější dostupnou úroveň.", coverageTitle: "Pokrytí není nula", coverageCopy: "Nezveřejněný měsíc nebo partner se nezobrazuje jako nulový obchod. Dostupnost se vede odděleně od faktů.", sourceLabel: "Zdroj",
      balance: "Bilance", surplus: "Přebytek", deficit: "Deficit", turnover: "Obrat", ratio: "Krytí dovozu vývozem", period: "Období", share: "Podíl na vybraném toku", opposite: "Protisměrný tok", value: "Hodnota", currentUsd: "běžné USD",
      sizeBy: "Velikost podle", deepDeficit: "Silný deficit", balanced: "Vyrovnané", deepSurplus: "Silný přebytek", allSectors: "Všechny sektory", chapters: "kapitol HS", backAll: "Zpět na všechny sektory", openSector: "Otevřít sektor", openProduct: "Otevřít partnery kapitoly", productPartners: "Obchodní partneři kapitoly", leadingPartners: "Největší partneři", close: "Zavřít", noPartners: "Pro tuto kapitolu nejsou partnerští data dostupná.", partnerError: "Partnery kapitoly se nepodařilo načíst.",
      noData: "Pro tuto frekvenci zatím nejsou načtena data.", noRanking: "Pro tento řez zatím nejsou načtena detailní data.", loading: "Načítám UN Comtrade…", loadError: "Obchodní data se teď nepodařilo načíst. Zkuste stránku obnovit.",
    },
    en: {
      eyebrow: "Report / Foreign trade", titleLead: "The trade market", titleEm: "on one screen",
      intro: "Size shows trade value; color shows surplus or deficit. Click a sector, then a product to reveal its partners.", countryLabel: "Country",
      pulseNav: "Balance", matrixNav: "Market map", trendNav: "Trend", compositionNav: "Rankings", methodNav: "Method",
      pulseKicker: "Selected period", pulseTitle: "The trade balance at a glance", pulseIntro: "Exports minus imports. Red means a deficit; green a surplus.",
      matrixKicker: "Latest annual structure", matrixTitle: "The goods market as a portfolio", matrixIntro: "Every tile is an HS chapter. Area shows value and color shows trade balance. Click through to sectors and partners.",
      trendKicker: "Change over time", trendTitle: "Imports and exports over time", trendIntro: "Hover over the chart or click a point. The selected period updates the headline metrics and detail below the chart.",
      annual: "Annual", monthly: "Monthly", exports: "Exports", imports: "Imports", chartNote: "Values are current USD. Gaps are missing data, not zeroes.",
      compositionKicker: "Latest annual rankings", compositionTitle: "Largest partners and chapters", compositionIntro: "Switch imports or exports. Clicking a chapter opens the same partner detail as the market map.",
      partnersTitle: "Largest trade partners", productsTitle: "Largest goods chapters",
      methodKicker: "How to read the data", methodTitle: "One balance, two valuation bases", methodIntro: "UN Comtrade generally values imports including insurance and freight (CIF), while exports are valued at the exporter’s border (FOB). The balance is therefore an analytical difference, not a national account.",
      sourceCopy: "The reporter country’s own submission, without mirror-filling missing values.", grainTitle: "Dimensions retained", grainCopy: "Period, reporter, flow, partner and six-digit HS code. Charts sum one finest available level only.", coverageTitle: "Coverage is not zero", coverageCopy: "An unpublished month or partner is not shown as zero trade. Availability is tracked separately from facts.", sourceLabel: "Source",
      balance: "Balance", surplus: "Surplus", deficit: "Deficit", turnover: "Turnover", ratio: "Exports/imports cover", period: "Period", share: "Share of selected flow", opposite: "Opposite flow", value: "Value", currentUsd: "current USD",
      sizeBy: "Size by", deepDeficit: "Deep deficit", balanced: "Balanced", deepSurplus: "Strong surplus", allSectors: "All sectors", chapters: "HS chapters", backAll: "Back to all sectors", openSector: "Open sector", openProduct: "Open chapter partners", productPartners: "Chapter trade partners", leadingPartners: "Leading partners", close: "Close", noPartners: "No partner data are available for this chapter.", partnerError: "Chapter partners could not be loaded.",
      noData: "No loaded data are available for this frequency yet.", noRanking: "No detailed data are loaded for this cut yet.", loading: "Loading UN Comtrade…", loadError: "Trade data could not be loaded. Please refresh the page.",
    },
  }[lang];

  const groups = [
    ["animals", 1, 5, "Živá zvířata", "Live animals"], ["vegetable", 6, 15, "Rostliny a zemědělství", "Vegetable products"],
    ["food", 16, 24, "Potraviny, nápoje a tabák", "Food, drinks & tobacco"], ["energy", 25, 27, "Nerosty a energie", "Minerals & energy"],
    ["chemicals", 28, 38, "Chemie", "Chemicals"], ["plastics", 39, 40, "Plasty a kaučuk", "Plastics & rubber"],
    ["leather", 41, 43, "Kůže a kožešiny", "Leather & hides"], ["wood", 44, 49, "Dřevo, papír a tisk", "Wood, paper & print"],
    ["textiles", 50, 63, "Textil a oděvy", "Textiles & apparel"], ["footwear", 64, 67, "Obuv a doplňky", "Footwear & accessories"],
    ["stone", 68, 71, "Sklo, kámen a drahé kovy", "Stone, glass & precious metals"], ["metals", 72, 83, "Kovy", "Metals"],
    ["machinery", 84, 85, "Stroje a elektronika", "Machinery & electronics"], ["transport", 86, 89, "Doprava", "Transport equipment"],
    ["precision", 90, 92, "Přístroje a optika", "Precision instruments"], ["arms", 93, 93, "Zbraně", "Arms"],
    ["manufacturing", 94, 96, "Ostatní výroba", "Misc. manufacturing"], ["special", 97, 99, "Umění a zvláštní položky", "Art & special items"],
  ].map(([id, min, max, cs, en]) => ({ id, min, max, name: lang === "cs" ? cs : en }));

  document.querySelectorAll("[data-trade-copy]").forEach((node) => {
    const value = copy[node.dataset.tradeCopy];
    if (value) node.textContent = value;
  });

  const $ = (selector) => document.querySelector(selector);
  const state = {
    country: (params.get("code") || "DEU").toUpperCase(), frequency: params.get("freq") === "M" ? "M" : "A",
    flow: params.get("flow") === "import" ? "import" : "export", period: params.get("period") || null,
    size: ["turnover", "export", "import"].includes(params.get("size")) ? params.get("size") : "turnover",
    sector: groups.some((group) => group.id === params.get("sector")) ? params.get("sector") : null,
    selectedKind: null, selectedCode: null, selectedProduct: /^\d{2}$/.test(params.get("product") || "") ? params.get("product") : null,
    drawerFlow: params.get("flow") === "import" ? "import" : "export", drawerPartner: null,
    profile: null, partnerCache: new Map(), productRequest: 0,
  };
  const money = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { notation: "compact", maximumFractionDigits: 2, style: "currency", currency: "USD" });
  const percent = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const fmt = (value) => Number.isFinite(value) ? money.format(value) : "—";
  const signed = (value) => Number.isFinite(value) ? `${value > 0 ? "+" : ""}${money.format(value)}` : "—";
  const periodLabel = (period) => period?.length === 6 ? `${period.slice(0, 4)}–${period.slice(4)}` : period || "—";
  const pairRows = (rows) => {
    const map = new Map();
    rows.forEach((row) => {
      const entry = map.get(row.period) || { period: row.period, period_start: row.period_start, import: null, export: null };
      entry[row.flow] = row.value_usd;
      map.set(row.period, entry);
    });
    return [...map.values()].sort((a, b) => String(a.period).localeCompare(String(b.period)));
  };
  const updateURL = () => {
    const url = new URL(location.href);
    url.searchParams.set("code", state.country); url.searchParams.set("freq", state.frequency); url.searchParams.set("flow", state.flow); url.searchParams.set("size", state.size); url.searchParams.set("lang", lang);
    state.period ? url.searchParams.set("period", state.period) : url.searchParams.delete("period");
    state.sector ? url.searchParams.set("sector", state.sector) : url.searchParams.delete("sector");
    state.selectedProduct ? url.searchParams.set("product", state.selectedProduct) : url.searchParams.delete("product");
    history.replaceState(null, "", url);
  };

  function productRows() {
    const map = new Map();
    (state.profile?.products || []).forEach((row) => {
      const entry = map.get(row.code) || { code: row.code, name: row.name, year: row.year, import: null, export: null };
      entry[row.flow] = row.value_usd;
      if (row.name) entry.name = row.name;
      entry.year = Math.max(entry.year || 0, row.year || 0);
      map.set(row.code, entry);
    });
    return [...map.values()].map((row) => {
      const known = [row.import, row.export].filter(Number.isFinite);
      const turnover = known.length ? known.reduce((sum, value) => sum + value, 0) : null;
      const balance = Number.isFinite(row.export) && Number.isFinite(row.import) ? row.export - row.import : null;
      return { ...row, turnover, balance, balanceRatio: Number.isFinite(balance) && turnover > 0 ? balance / turnover : null, group: groups.find((group) => Number(row.code) >= group.min && Number(row.code) <= group.max) };
    }).filter((row) => row.group && Number.isFinite(row.turnover) && row.turnover > 0);
  }

  function binaryTreemap(items, rectangle) {
    const output = [];
    const place = (nodes, rect) => {
      if (!nodes.length || rect.w <= 0 || rect.h <= 0) return;
      if (nodes.length === 1) { output.push({ ...nodes[0], rect }); return; }
      const total = nodes.reduce((sum, item) => sum + Math.max(item.weight, 0.0001), 0);
      let split = 1; let running = Math.max(nodes[0].weight, 0.0001); let best = Math.abs(total / 2 - running);
      for (let index = 2; index < nodes.length; index += 1) {
        running += Math.max(nodes[index - 1].weight, 0.0001);
        const distance = Math.abs(total / 2 - running);
        if (distance < best) { best = distance; split = index; }
      }
      const first = nodes.slice(0, split); const second = nodes.slice(split);
      const firstWeight = first.reduce((sum, item) => sum + Math.max(item.weight, 0.0001), 0); const ratio = firstWeight / total;
      if (rect.w >= rect.h) {
        const firstWidth = rect.w * ratio;
        place(first, { x: rect.x, y: rect.y, w: firstWidth, h: rect.h }); place(second, { x: rect.x + firstWidth, y: rect.y, w: rect.w - firstWidth, h: rect.h });
      } else {
        const firstHeight = rect.h * ratio;
        place(first, { x: rect.x, y: rect.y, w: rect.w, h: firstHeight }); place(second, { x: rect.x, y: rect.y + firstHeight, w: rect.w, h: rect.h - firstHeight });
      }
    };
    place([...items].sort((a, b) => b.weight - a.weight), rectangle);
    return output;
  }

  function balanceColor(ratio) {
    if (!Number.isFinite(ratio)) return "rgb(68,73,84)";
    const amount = Math.min(1, Math.abs(ratio) * 3.1); const neutral = [65, 70, 79]; const target = ratio >= 0 ? [24, 170, 80] : [238, 51, 61];
    return `rgb(${neutral.map((value, index) => Math.round(value + (target[index] - value) * amount)).join(",")})`;
  }

  async function init() {
    $("#trade-chart").innerHTML = `<div class="trade-loading">${escapeHTML(copy.loading)}</div>`;
    $("#trade-matrix").innerHTML = `<div class="trade-loading">${escapeHTML(copy.loading)}</div>`;
    try {
      const catalogResponse = await fetch("/api/v1/trade/countries");
      if (!catalogResponse.ok) throw new Error("catalog");
      const catalog = (await catalogResponse.json()).data; const countries = catalog.countries || [];
      if (!countries.some((country) => country.code === state.country) && countries[0]) state.country = countries[0].code;
      $("#trade-country").innerHTML = countries.map((country) => `<option value="${escapeHTML(country.code)}">${escapeHTML(country.name)} (${escapeHTML(country.code)})</option>`).join("");
      $("#trade-country").value = state.country;
      $("#trade-country").addEventListener("change", () => { state.country = $("#trade-country").value; state.period = null; state.sector = null; closeProduct(); loadProfile(); });
      document.querySelectorAll("#trade-frequency button").forEach((button) => button.addEventListener("click", () => { state.frequency = button.dataset.frequency; state.period = null; render(); }));
      document.querySelectorAll("#trade-flow-tabs button").forEach((button) => button.addEventListener("click", () => { state.flow = button.dataset.flow; state.drawerFlow = state.flow; state.selectedKind = null; state.selectedCode = null; renderComposition(); if (state.selectedProduct) renderProductDrawer(); updateURL(); }));
      document.querySelectorAll("#trade-size-metric button").forEach((button) => button.addEventListener("click", () => { state.size = button.dataset.size; renderMatrix(); updateURL(); }));
      $("#trade-matrix-back").addEventListener("click", () => { state.sector = null; renderMatrix(); updateURL(); });
      let resizeTimer; addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => state.profile && renderMatrix(), 120); });
      await loadProfile();
    } catch (error) { showError(error); }
  }

  async function loadProfile() {
    $("#trade-status").hidden = true; $("#trade-chart").innerHTML = `<div class="trade-loading">${escapeHTML(copy.loading)}</div>`; $("#trade-matrix").innerHTML = `<div class="trade-loading">${escapeHTML(copy.loading)}</div>`;
    try {
      const response = await fetch(`/api/v1/trade?country=${encodeURIComponent(state.country)}`);
      if (!response.ok) throw new Error(`profile ${response.status}`);
      state.profile = (await response.json()).data;
      const selected = $("#trade-country").selectedOptions[0];
      $("#trade-country-code").textContent = state.country; $("#trade-country-name").textContent = selected?.textContent.replace(/\s\([A-Z]{3}\)$/, "") || state.country;
      $("#trade-data-vintage").textContent = `UN Comtrade · ${String(state.profile.source.retrieved_at || "—").slice(0, 10)}`;
      render();
      if (state.selectedProduct && productRows().some((row) => row.code === state.selectedProduct)) openProduct(state.selectedProduct);
    } catch (error) { showError(error); }
  }

  function showError(error) {
    console.error(error); $("#trade-status").hidden = false; $("#trade-status").textContent = copy.loadError;
    $("#trade-chart").innerHTML = `<div class="trade-loading">${escapeHTML(copy.loadError)}</div>`; $("#trade-matrix").innerHTML = `<div class="trade-loading">${escapeHTML(copy.loadError)}</div>`;
    $("#trade-kpis").innerHTML = ""; $("#trade-selected-period").innerHTML = ""; $("#trade-partners").innerHTML = ""; $("#trade-products").innerHTML = "";
  }

  function render() {
    document.querySelectorAll("#trade-frequency button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.frequency === state.frequency)));
    const periods = pairRows(state.profile.totals.filter((row) => row.frequency === state.frequency));
    if (!periods.length) {
      $("#trade-chart").innerHTML = `<div class="trade-loading">${escapeHTML(copy.noData)}</div>`;
      const fallback = pairRows(state.profile.totals.filter((row) => row.frequency === "A")).at(-1);
      renderKPIs(fallback); renderSelected(fallback); renderMatrix(); renderComposition(); updateURL(); return;
    }
    if (!state.period || !periods.some((row) => row.period === state.period)) state.period = periods.at(-1).period;
    const selected = periods.find((row) => row.period === state.period) || periods.at(-1);
    renderKPIs(selected); renderMatrix(); renderChart(periods); renderSelected(selected); renderComposition(); updateURL();
  }

  function renderKPIs(row) {
    const imports = row?.import; const exports = row?.export; const balance = Number.isFinite(exports) && Number.isFinite(imports) ? exports - imports : null;
    const turnover = Number.isFinite(exports) && Number.isFinite(imports) ? exports + imports : null; const ratio = imports > 0 && Number.isFinite(exports) ? exports / imports : null;
    $("#trade-period-context").textContent = `${copy.period}: ${periodLabel(row?.period)} · ${copy.pulseIntro}`;
    $("#trade-kpis").innerHTML = [
      [copy.imports, fmt(imports), "CIF", "import"], [copy.exports, fmt(exports), "FOB", "export"],
      [balance >= 0 ? copy.surplus : copy.deficit, signed(balance), copy.balance, `balance ${balance >= 0 ? "surplus" : "deficit"}`],
      [copy.ratio, ratio === null ? "—" : new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { style: "percent", maximumFractionDigits: 1 }).format(ratio), `${copy.turnover}: ${fmt(turnover)}`, "cover"],
    ].map(([label, value, note, className]) => `<article class="${className}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></article>`).join("");
  }

  function renderMatrix() {
    const host = $("#trade-matrix"); const viewport = host.parentElement; const rows = productRows();
    document.querySelectorAll("#trade-size-metric button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.size === state.size)));
    if (!rows.length) { host.innerHTML = `<div class="trade-loading">${escapeHTML(copy.noRanking)}</div>`; return; }
    const selectedGroup = groups.find((group) => group.id === state.sector); const visibleRows = selectedGroup ? rows.filter((row) => row.group.id === selectedGroup.id) : rows;
    const year = Math.max(...visibleRows.map((row) => row.year || 0));
    $("#trade-matrix-title").textContent = selectedGroup?.name || copy.allSectors;
    const sizeLabel = state.size === "turnover" ? copy.turnover : state.size === "export" ? copy.exports : copy.imports;
    $("#trade-matrix-meta").textContent = `${year} · ${visibleRows.length} ${copy.chapters} · ${copy.sizeBy.toLowerCase()} ${sizeLabel.toLowerCase()}`;
    $("#trade-matrix-back").hidden = !selectedGroup; $("#trade-matrix-back").setAttribute("aria-label", copy.backAll);
    const width = Math.max(980, viewport.clientWidth || 1120); const height = selectedGroup ? 640 : 690; host.style.width = `${width}px`; host.style.height = `${height}px`;
    const grouped = (selectedGroup ? [selectedGroup] : groups).map((group) => {
      const items = visibleRows.filter((row) => row.group.id === group.id).map((row) => ({ ...row, weight: Math.max(Number(row[state.size]) || 0, 1) }));
      return { ...group, items, weight: items.reduce((sum, item) => sum + item.weight, 0) };
    }).filter((group) => group.items.length && group.weight > 0);
    const groupTiles = binaryTreemap(grouped, { x: 0, y: 0, w: width, h: height });
    host.innerHTML = groupTiles.map((groupTile) => {
      const { x, y, w, h } = groupTile.rect; const showHeader = Boolean(selectedGroup) || h >= 38; const headerHeight = selectedGroup ? 34 : showHeader ? Math.max(20, Math.min(28, h * 0.13)) : 0;
      const itemTiles = binaryTreemap(groupTile.items, { x: 2, y: headerHeight + 1, w: Math.max(0, w - 4), h: Math.max(0, h - headerHeight - 3) });
      const header = !showHeader ? "" : selectedGroup ? `<div class="trade-matrix-group-title"><span>${escapeHTML(groupTile.name)}</span><b>${groupTile.items.length} ${escapeHTML(copy.chapters)}</b></div>` : `<button type="button" class="trade-matrix-group-title" data-sector="${escapeHTML(groupTile.id)}" aria-label="${escapeHTML(`${copy.openSector}: ${groupTile.name}`)}"><span>${escapeHTML(groupTile.name)}</span><b>${groupTile.items.length}</b></button>`;
      const cells = itemTiles.map((item) => {
        const rect = item.rect; const compact = rect.w < 92 || rect.h < 65; const tiny = rect.w < 57 || rect.h < 42; const ratioLabel = Number.isFinite(item.balanceRatio) ? percent.format(item.balanceRatio) : "—";
        const label = `HS ${item.code} · ${item.name} · ${copy.exports} ${fmt(item.export)} · ${copy.imports} ${fmt(item.import)} · ${copy.balance} ${signed(item.balance)}`;
        return `<button type="button" class="trade-matrix-tile${compact ? " compact" : ""}${tiny ? " tiny" : ""}" data-product="${escapeHTML(item.code)}" style="left:${rect.x.toFixed(2)}px;top:${rect.y.toFixed(2)}px;width:${Math.max(0, rect.w).toFixed(2)}px;height:${Math.max(0, rect.h).toFixed(2)}px;background:${balanceColor(item.balanceRatio)}" aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}"><b>HS ${escapeHTML(item.code)}</b><span>${escapeHTML(item.name)}</span><strong>${escapeHTML(ratioLabel)}</strong></button>`;
      }).join("");
      return `<section class="trade-matrix-group${selectedGroup ? " zoomed" : ""}" data-sector="${escapeHTML(groupTile.id)}" style="left:${(x + 1).toFixed(2)}px;top:${(y + 1).toFixed(2)}px;width:${Math.max(0, w - 2).toFixed(2)}px;height:${Math.max(0, h - 2).toFixed(2)}px">${header}${cells}</section>`;
    }).join("");
    host.querySelectorAll("button[data-sector]").forEach((button) => button.addEventListener("click", () => { state.sector = button.dataset.sector; renderMatrix(); updateURL(); }));
    host.querySelectorAll("button[data-product]").forEach((button) => {
      const showTooltip = (event) => renderMatrixTooltip(event, rows.find((row) => row.code === button.dataset.product));
      button.addEventListener("pointerenter", showTooltip); button.addEventListener("pointermove", showTooltip); button.addEventListener("pointerleave", () => { $("#trade-market-tooltip").hidden = true; });
      button.addEventListener("focus", showTooltip); button.addEventListener("blur", () => { $("#trade-market-tooltip").hidden = true; }); button.addEventListener("click", () => openProduct(button.dataset.product));
    });
  }

  function renderMatrixTooltip(event, item) {
    if (!item) return;
    const tooltip = $("#trade-market-tooltip"); const shell = tooltip.parentElement; const shellRect = shell.getBoundingClientRect(); const sourceRect = event.currentTarget.getBoundingClientRect();
    const clientX = event.clientX || sourceRect.left + sourceRect.width / 2; const clientY = event.clientY || sourceRect.top + sourceRect.height / 2;
    tooltip.innerHTML = `<header><b>HS ${escapeHTML(item.code)}</b><span>${escapeHTML(item.name)}</span></header><dl><div><dt>${escapeHTML(copy.exports)}</dt><dd>${escapeHTML(fmt(item.export))}</dd></div><div><dt>${escapeHTML(copy.imports)}</dt><dd>${escapeHTML(fmt(item.import))}</dd></div><div><dt>${escapeHTML(copy.balance)}</dt><dd class="${item.balance >= 0 ? "positive" : "negative"}">${escapeHTML(signed(item.balance))}</dd></div></dl><small>${escapeHTML(copy.openProduct)} →</small>`;
    tooltip.hidden = false; tooltip.style.left = `${Math.max(12, Math.min(shell.clientWidth - 304, clientX - shellRect.left + 14))}px`; tooltip.style.top = `${Math.max(82, Math.min(shell.clientHeight - 174, clientY - shellRect.top + 14))}px`;
  }

  async function openProduct(code) {
    const item = productRows().find((row) => row.code === code); if (!item) return;
    state.selectedProduct = code; state.selectedKind = "product"; state.selectedCode = code; state.drawerPartner = null;
    $("#trade-market-tooltip").hidden = true; renderProductDrawer(); updateURL(); renderComposition();
    if (state.partnerCache.has(`${state.country}:${code}`)) return;
    const requestID = ++state.productRequest;
    try {
      const response = await fetch(`/api/v1/trade/product-partners?country=${encodeURIComponent(state.country)}&product=${encodeURIComponent(code)}`);
      if (!response.ok) throw new Error(`partners ${response.status}`);
      const data = (await response.json()).data;
      if (requestID !== state.productRequest || state.selectedProduct !== code) return;
      state.partnerCache.set(`${state.country}:${code}`, data); renderProductDrawer();
    } catch (error) {
      console.error(error);
      if (requestID === state.productRequest && state.selectedProduct === code) { state.partnerCache.set(`${state.country}:${code}`, { error: true, partners: [] }); renderProductDrawer(); }
    }
  }

  function closeProduct() {
    state.productRequest += 1; state.selectedProduct = null; state.selectedKind = null; state.selectedCode = null; state.drawerPartner = null; $("#trade-market-drawer").hidden = true; updateURL();
  }

  function renderProductDrawer() {
    const drawer = $("#trade-market-drawer"); const item = productRows().find((row) => row.code === state.selectedProduct); if (!item) { drawer.hidden = true; return; }
    const data = state.partnerCache.get(`${state.country}:${item.code}`); const rows = (data?.partners || []).filter((row) => row.flow === state.drawerFlow).slice(0, 12); const max = Math.max(...rows.map((row) => row.value_usd), 1);
    const partnerContent = !data ? `<div class="trade-drawer-loading">${escapeHTML(copy.loading)}</div>` : data.error ? `<div class="trade-drawer-loading error">${escapeHTML(copy.partnerError)}</div>` : rows.length ? rows.map((row, index) => `<button type="button" class="trade-partner-row${state.drawerPartner === row.code ? " selected" : ""}" data-partner="${escapeHTML(row.code)}"><span><b>${index + 1}</b><strong>${escapeHTML(row.name)}</strong></span><i><em style="width:${Math.max(2, row.value_usd / max * 100).toFixed(1)}%"></em></i><small>${escapeHTML(fmt(row.value_usd))}</small></button>`).join("") : `<div class="trade-drawer-loading">${escapeHTML(copy.noPartners)}</div>`;
    drawer.hidden = false;
    drawer.innerHTML = `<header><span>${escapeHTML(copy.productPartners)}</span><button type="button" data-close aria-label="${escapeHTML(copy.close)}">×</button><b>HS ${escapeHTML(item.code)}</b><h3>${escapeHTML(item.name)}</h3><small>${escapeHTML(String(item.year))} · ${escapeHTML(copy.currentUsd)}</small></header><div class="trade-drawer-metrics"><div><span>${escapeHTML(copy.exports)}</span><strong>${escapeHTML(fmt(item.export))}</strong></div><div><span>${escapeHTML(copy.imports)}</span><strong>${escapeHTML(fmt(item.import))}</strong></div><div class="${item.balance >= 0 ? "positive" : "negative"}"><span>${escapeHTML(copy.balance)}</span><strong>${escapeHTML(signed(item.balance))}</strong></div></div><div class="trade-drawer-tabs"><span>${escapeHTML(copy.leadingPartners)}</span><div><button type="button" data-drawer-flow="export" aria-pressed="${state.drawerFlow === "export"}">${escapeHTML(copy.exports)}</button><button type="button" data-drawer-flow="import" aria-pressed="${state.drawerFlow === "import"}">${escapeHTML(copy.imports)}</button></div></div><div class="trade-drawer-partners">${partnerContent}</div>`;
    drawer.querySelector("[data-close]").addEventListener("click", closeProduct);
    drawer.querySelectorAll("[data-drawer-flow]").forEach((button) => button.addEventListener("click", () => { state.drawerFlow = button.dataset.drawerFlow; state.flow = state.drawerFlow; renderProductDrawer(); renderComposition(); updateURL(); }));
    drawer.querySelectorAll("[data-partner]").forEach((button) => button.addEventListener("click", () => { state.drawerPartner = button.dataset.partner; renderProductDrawer(); }));
  }

  function renderSelected(row) {
    const balance = Number.isFinite(row?.export) && Number.isFinite(row?.import) ? row.export - row.import : null;
    $("#trade-selected-period").innerHTML = `<b>${escapeHTML(copy.period)} · ${escapeHTML(periodLabel(row?.period))}</b><span>${escapeHTML(copy.exports)}<strong>${escapeHTML(fmt(row?.export))}</strong></span><span>${escapeHTML(copy.imports)}<strong>${escapeHTML(fmt(row?.import))}</strong></span><span>${escapeHTML(copy.balance)}<strong class="${balance >= 0 ? "positive" : "negative"}">${escapeHTML(signed(balance))}</strong></span>`;
  }

  function renderChart(periods) {
    const host = $("#trade-chart"); const width = Math.max(620, host.clientWidth || 900); const height = matchMedia("(max-width:700px)").matches ? 330 : 420; const margin = { top: 25, right: 28, bottom: 36, left: 78 }; const plotW = width - margin.left - margin.right; const plotH = height - margin.top - margin.bottom;
    const values = periods.flatMap((row) => [row.import, row.export]).filter(Number.isFinite); const max = Math.max(...values, 1); const yMax = max * 1.08; const x = (index) => margin.left + (periods.length === 1 ? plotW / 2 : index / (periods.length - 1) * plotW); const y = (value) => margin.top + plotH - (value / yMax) * plotH;
    const path = (flow) => { let started = false; return periods.map((row, index) => { if (!Number.isFinite(row[flow])) { started = false; return ""; } const command = started ? "L" : "M"; started = true; return `${command}${x(index).toFixed(1)},${y(row[flow]).toFixed(1)}`; }).filter(Boolean).join(" "); };
    const grid = Array.from({ length: 5 }, (_, index) => { const value = yMax * (1 - index / 4); const yy = margin.top + plotH * index / 4; return `<line class="grid" x1="${margin.left}" y1="${yy}" x2="${width - margin.right}" y2="${yy}"/><text class="axis-label" x="${margin.left - 10}" y="${yy + 4}" text-anchor="end">${escapeHTML(money.format(value))}</text>`; }).join("");
    const labelEvery = Math.max(1, Math.ceil(periods.length / 6)); const labels = periods.map((row, index) => index % labelEvery === 0 || index === periods.length - 1 ? `<text class="axis-label" x="${x(index)}" y="${height - 11}" text-anchor="middle">${escapeHTML(periodLabel(row.period))}</text>` : "").join("");
    const points = ["export", "import"].flatMap((flow) => periods.map((row, index) => Number.isFinite(row[flow]) ? `<circle class="point ${flow} ${row.period === state.period ? "selected" : ""}" data-period="${escapeHTML(row.period)}" cx="${x(index)}" cy="${y(row[flow])}" r="${row.period === state.period ? 7 : 4}" tabindex="0"><title>${escapeHTML(`${periodLabel(row.period)} · ${flow === "export" ? copy.exports : copy.imports}: ${fmt(row[flow])}`)}</title></circle>` : "")).join("");
    host.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(`${copy.imports}, ${copy.exports}`)}">${grid}<path class="series export" d="${path("export")}"/><path class="series import" d="${path("import")}"/>${points}${labels}<line class="crosshair" hidden y1="${margin.top}" y2="${margin.top + plotH}"/></svg><div class="trade-chart-tooltip" hidden></div>`;
    const tooltip = host.querySelector(".trade-chart-tooltip"); const crosshair = host.querySelector(".crosshair");
    const pick = (event, commit = false) => { const rect = host.querySelector("svg").getBoundingClientRect(); const svgX = (event.clientX - rect.left) / rect.width * width; const index = Math.max(0, Math.min(periods.length - 1, Math.round((svgX - margin.left) / plotW * (periods.length - 1)))); const row = periods[index]; crosshair.hidden = false; crosshair.setAttribute("x1", x(index)); crosshair.setAttribute("x2", x(index)); tooltip.hidden = false; tooltip.innerHTML = `<b>${escapeHTML(periodLabel(row.period))}</b>${escapeHTML(copy.exports)}: ${escapeHTML(fmt(row.export))}<br>${escapeHTML(copy.imports)}: ${escapeHTML(fmt(row.import))}`; tooltip.style.left = `${Math.min(host.clientWidth - 185, Math.max(8, event.clientX - host.getBoundingClientRect().left + 12))}px`; tooltip.style.top = `${Math.max(8, event.clientY - host.getBoundingClientRect().top - 70)}px`; if (commit) { state.period = row.period; render(); } };
    host.querySelector("svg").addEventListener("pointermove", (event) => pick(event)); host.querySelector("svg").addEventListener("click", (event) => pick(event, true)); host.querySelector("svg").addEventListener("pointerleave", () => { tooltip.hidden = true; crosshair.hidden = true; });
    host.querySelectorAll(".point").forEach((point) => point.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); state.period = point.dataset.period; render(); } }));
  }

  function renderComposition() {
    document.querySelectorAll("#trade-flow-tabs button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.flow === state.flow)));
    renderRanking("partner", state.profile.partners || [], $("#trade-partners")); renderRanking("product", state.profile.products || [], $("#trade-products")); renderDetail();
  }

  function renderRanking(kind, allRows, host) {
    const rows = allRows.filter((row) => row.flow === state.flow).slice(0, 12); const max = Math.max(...rows.map((row) => row.value_usd), 1);
    if (!rows.length) { host.innerHTML = `<p class="empty">${escapeHTML(copy.noRanking)}</p>`; return; }
    host.innerHTML = rows.map((row) => `<button type="button" data-kind="${kind}" data-code="${escapeHTML(row.code)}" class="${state.selectedKind === kind && state.selectedCode === row.code ? "selected" : ""}"><b title="${escapeHTML(row.name)}">${escapeHTML(row.name)}</b><i><span style="width:${Math.max(2, row.value_usd / max * 100).toFixed(1)}%"></span></i><strong>${escapeHTML(fmt(row.value_usd))}</strong></button>`).join("");
    host.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.kind === "product") { openProduct(button.dataset.code); return; }
      state.selectedKind = button.dataset.kind; state.selectedCode = button.dataset.code; renderComposition();
    }));
  }

  function renderDetail() {
    if (!state.selectedKind || !state.selectedCode || state.selectedKind === "product") { $("#trade-detail").innerHTML = ""; $("#trade-detail").hidden = true; return; }
    const rows = state.profile.partners; const selected = rows.find((row) => row.code === state.selectedCode && row.flow === state.flow); if (!selected) return;
    const oppositeFlow = state.flow === "export" ? "import" : "export"; const opposite = rows.find((row) => row.code === state.selectedCode && row.flow === oppositeFlow); const total = state.profile.totals.find((row) => row.frequency === "A" && row.year === selected.year && row.flow === state.flow); const share = total?.value_usd ? selected.value_usd / total.value_usd : null;
    $("#trade-detail").hidden = false; $("#trade-detail").innerHTML = `<div><span>${escapeHTML(copy.partnersTitle)}</span><strong>${escapeHTML(selected.name)}</strong></div><div><span>${escapeHTML(copy.value)}</span><strong>${escapeHTML(fmt(selected.value_usd))}</strong></div><div><span>${escapeHTML(copy.share)}</span><strong>${share === null ? "—" : escapeHTML(percent.format(share).replace("+", ""))}</strong></div><div><span>${escapeHTML(copy.opposite)}</span><strong>${escapeHTML(fmt(opposite?.value_usd))}</strong></div>`;
  }

  init();
})();
