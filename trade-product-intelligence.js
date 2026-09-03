(() => {
  const root = document.querySelector("#product-intelligence");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const lang = params.get("lang") === "en" || document.documentElement.lang === "en" ? "en" : "cs";
  const copy = {
    cs: {
      nav: "Produktové trhy", kicker: "Produktová inteligence / HS6", title: "Kdo dodává. Kdo nakupuje. Kam se trh přesouvá.",
      intro: "Pět obchodně důležitých oblastí ve stejné metodice. Země původu je proxy nabídky; reportující dovozní trh je proxy poptávky.",
      pageTitle: "Globální produktové trhy — Public Spending Data", pageDescription: "Globální obchodní toky podle produktů HS6: kdo dodává, které trhy nakupují a jak se obchod mění v čase.",
      heroEyebrow: "Report / Globální produktové trhy", heroTitleLead: "Sledujte produkt", heroTitleEm: "napříč světem", heroIntro: "Začněte produktem místo zemí. Uvidíte vykázaný původ, dovozní trhy, bilaterální toky a dostupný roční vývoj.", heroAsideKicker: "Datová úroveň", heroAsideCopy: "Šestimístné produktové kódy propojené s reportujícími dovozními trhy a zeměmi původu.", heroAsideLink: "Jak číst data ↓",
      overviewNav: "Přehled", positionsNav: "Pozice", flowNav: "Toky", historyNav: "Vývoj", methodNav: "Metodika",
      areaLabel: "Obchodní oblast", geographyLabel: "Geografie", periodLabel: "Roční období", euOption: "EU-27 jako jeden blok", countryOption: "Jednotlivé země",
      originsTitle: "Hlavní země původu", originsCopy: "Proxy nabídky podle původu, který uvedl dovozní trh.", marketsTitle: "Hlavní dovozní trhy", marketsCopy: "Proxy poptávky podle reportujícího dovozního trhu.",
      flowKicker: "Tok produktu", flowTitle: "Od vykázaného původu k dovoznímu trhu", supplyProxy: "Původ / proxy nabídky", demandProxy: "Dovozní trh / proxy poptávky", flowHint: "Přejeďte nebo klikněte na tok pro přesnou hodnotu.",
      historyKicker: "Roční řada", historyTitle: "Pozorovaná hodnota v čase", euNote: "Agregace EU-27 zachovává vnitrounijní obchod jako samostatný tok EU-27 → EU-27.", coverageNote: "Pokrytí je pozorovaný výřez načtených reportujících trhů, nikoli úplný světový součet. Chybějící data nejsou nuly.",
      observedValue: "Pozorovaná bilaterální hodnota", observedCoverage: "Pozorované pokrytí", productDefinition: "Definice produktu", routes: "tras země–země", originCountries: "zemí původu", importMarkets: "dovozních trhů", completeMarkets: "úplných", partialMarkets: "částečný",
      importerReported: "hlášeno dovozními trhy", annualPoint: "načtený roční bod", annualPoints: "načtené roční body", sourceRelease: "vydání zdroje", share: "podíl", counterparties: "protistran", otherOrigins: "Ostatní původy", otherMarkets: "Ostatní pozorované trhy", eu27: "Evropská unie (EU-27)", loading: "Načítám produktové trhy z BigQuery snapshotu…", loadError: "Produktovou inteligenci se nepodařilo načíst.",
      methodKicker: "Jak číst produktový trh", methodTitle: "Původ není totéž co výrobce", methodIntro: "Toky jsou hlášeny dovozními trhy. Země původu proto slouží jako konzistentní proxy nabídky, ne jako důkaz sídla značky nebo výrobní firmy.", methodProductTitle: "Definice HS6", methodProductCopy: "Každá obchodní oblast je transparentní sada šestimístných kódů Harmonizovaného systému.", methodFlowTitle: "Bilaterální tok", methodFlowCopy: "Každý spoj vede od vykázané země původu k reportujícímu dovoznímu trhu.", methodCoverageTitle: "Chybějící není nula", methodCoverageCopy: "Součty popisují načtené reportující trhy a dostupná období; nezveřejněná data nedoplňujeme nulou.", sourceLabel: "Zdroj",
      areas: { SMARTPHONES:"Chytré telefony", PASSENGER_VEHICLES:"Osobní vozidla", MEDICAMENTS:"Léčiva", INTEGRATED_CIRCUITS:"Integrované obvody", ELECTRIC_BATTERIES:"Elektrické baterie" },
    },
    en: {
      nav: "Product markets", kicker: "Product intelligence / HS6", title: "Who supplies. Who buys. Where the market is moving.",
      intro: "Five business-critical product areas under one method. Reported origin is a supply proxy; the reporting import market is a demand proxy.",
      pageTitle: "Global product markets — Public Spending Data", pageDescription: "Global HS6 product flows: who supplies, which markets buy, and how observed trade changes over time.",
      heroEyebrow: "Report / Global product markets", heroTitleLead: "Follow a product", heroTitleEm: "across the world", heroIntro: "Start with the product rather than the country. See reported origins, import markets, bilateral flows, and the available annual history.", heroAsideKicker: "Data grain", heroAsideCopy: "Six-digit product codes connected to reporting import markets and reported countries of origin.", heroAsideLink: "How to read the data ↓",
      overviewNav: "Overview", positionsNav: "Positions", flowNav: "Flows", historyNav: "History", methodNav: "Method",
      areaLabel: "Business area", geographyLabel: "Geography", periodLabel: "Annual period", euOption: "EU-27 as one bloc", countryOption: "Individual countries",
      originsTitle: "Leading origins", originsCopy: "Supply proxy based on the origin reported by importing markets.", marketsTitle: "Leading import markets", marketsCopy: "Demand proxy based on the reporting importing market.",
      flowKicker: "Product flow", flowTitle: "From reported origin to import market", supplyProxy: "Origin / supply proxy", demandProxy: "Import market / demand proxy", flowHint: "Hover or click a flow for its exact value.",
      historyKicker: "Annual series", historyTitle: "Observed value over time", euNote: "EU-27 aggregation retains intra-EU trade as a separate EU-27 → EU-27 flow.", coverageNote: "Coverage is the observed slice of loaded reporting markets, not a complete world total. Missing data are not zeroes.",
      observedValue: "Observed bilateral value", observedCoverage: "Observed coverage", productDefinition: "Product definition", routes: "country-to-country routes", originCountries: "origin countries", importMarkets: "import markets", completeMarkets: "complete", partialMarkets: "partial",
      importerReported: "importer-reported", annualPoint: "annual point loaded", annualPoints: "annual points loaded", sourceRelease: "source release", share: "share", counterparties: "counterparties", otherOrigins: "Other origins", otherMarkets: "Other observed markets", eu27: "European Union (EU-27)", loading: "Loading product markets from the BigQuery snapshot…", loadError: "Product intelligence could not be loaded.",
      methodKicker: "How to read a product market", methodTitle: "Origin is not the same as manufacturer", methodIntro: "Flows are reported by importing markets. Country of origin is therefore a consistent supply proxy, not evidence of a brand's headquarters or a specific manufacturer.", methodProductTitle: "HS6 definition", methodProductCopy: "Each business area is a transparent set of six-digit Harmonized System product codes.", methodFlowTitle: "Bilateral flow", methodFlowCopy: "Each connection runs from the reported country of origin to the reporting import market.", methodCoverageTitle: "Missing is not zero", methodCoverageCopy: "Totals describe loaded reporting markets and available periods; unreleased data are never filled with zero.", sourceLabel: "Source",
      areas: { SMARTPHONES:"Smartphones", PASSENGER_VEHICLES:"Passenger vehicles", MEDICAMENTS:"Medicaments", INTEGRATED_CIRCUITS:"Integrated circuits", ELECTRIC_BATTERIES:"Electric batteries" },
    },
  }[lang];

  root.querySelectorAll("[data-product-copy]").forEach((node) => {
    const value = copy[node.dataset.productCopy];
    if (value) node.textContent = value;
  });
  if (document.body.classList.contains("product-markets-page")) {
    document.title = copy.pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute("content", copy.pageDescription);
    window.psdLanguageReady?.();
    document.addEventListener("click", (event) => {
      const control = event.target.closest("[data-lang],[data-deep-lang],[data-budget-lang]");
      const nextLanguage = control?.dataset.lang || control?.dataset.deepLang || control?.dataset.budgetLang;
      if (!nextLanguage || nextLanguage === lang) return;
      try { localStorage.setItem("psd-lang", nextLanguage); } catch {}
      const url = new URL(location.href);
      url.searchParams.set("lang", nextLanguage);
      location.href = url.href;
    });
  }

  const areaSelect = root.querySelector("#product-area");
  const geographySelect = root.querySelector("#product-geography");
  const periodSelect = root.querySelector("#product-period");
  const status = root.querySelector("#product-intelligence-status");
  const kpis = root.querySelector("#product-intelligence-kpis");
  const origins = root.querySelector("#product-origins");
  const markets = root.querySelector("#product-markets");
  const flow = root.querySelector("#product-flow");
  const flowContext = root.querySelector("#product-flow-context");
  const flowDetail = root.querySelector("#product-flow-detail");
  const historyChart = root.querySelector("#product-history");
  const historyContext = root.querySelector("#product-history-context");
  const money = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { style:"currency", currency:"USD", notation:"compact", maximumFractionDigits:1 });
  const percent = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { style:"percent", maximumFractionDigits:1 });
  const integer = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US");
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[character]));
  const svgNS = "http://www.w3.org/2000/svg";
  const state = { data:null, area:null, period:null, geography: params.get("geo") === "COUNTRY" ? "COUNTRY" : "EU27_AGGREGATED" };

  function translatedName(code, name) {
    if (code === "OTHER_ORIGINS") return copy.otherOrigins;
    if (code === "OTHER_MARKETS") return copy.otherMarkets;
    if (code === "EU27") return copy.eu27;
    return name || code;
  }

  function selectedArea() { return state.data?.business_areas.find((area) => area.code === state.area); }
  function selectedPeriod() { return selectedArea()?.periods.find((period) => period.period === state.period); }
  function selectedGeography() { return selectedPeriod()?.geographies[state.geography]; }

  function updateURL() {
    const url = new URL(location.href);
    url.searchParams.set("area", state.area);
    url.searchParams.set("geo", state.geography);
    url.searchParams.set("product_period", state.period);
    history.replaceState(null, "", url);
  }

  function renderRankings(container, rows, kind) {
    container.classList.toggle("product-markets", kind === "markets");
    const max = Math.max(...rows.map((row) => row.primary_value_usd), 1);
    container.innerHTML = rows.slice(0, 6).map((row, index) => `
      <div class="product-rank-row">
        <span><b>${index + 1}</b><strong title="${escapeHTML(translatedName(row.code, row.name))}">${escapeHTML(translatedName(row.code, row.name))}</strong></span>
        <i aria-hidden="true"><em style="width:${Math.max(1, row.primary_value_usd / max * 100).toFixed(2)}%"></em></i>
        <small>${escapeHTML(money.format(row.primary_value_usd))}<span>${escapeHTML(percent.format(row.observed_value_share))}</span></small>
      </div>`).join("");
  }

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(svgNS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function drawFlow() {
    const area = selectedArea();
    const period = selectedPeriod();
    const geography = selectedGeography();
    if (!area || !period || !geography) return;
    const width = Math.max(flow.clientWidth, 720);
    const height = 520;
    const top = 20;
    const bottom = 20;
    const leftX = 170;
    const rightX = width - 184;
    const nodeWidth = 14;
    const nodePadding = 10;
    const total = period.primary_value_usd;
    const originMap = new Map();
    const marketMap = new Map();
    geography.flows.forEach((edge) => {
      const origin = originMap.get(edge.origin_code) || { code:edge.origin_code, name:edge.origin_name, value:0, links:[] };
      const market = marketMap.get(edge.market_code) || { code:edge.market_code, name:edge.market_name, value:0, links:[] };
      origin.value += edge.primary_value_usd;
      market.value += edge.primary_value_usd;
      originMap.set(edge.origin_code, origin);
      marketMap.set(edge.market_code, market);
    });
    const sortNodes = (a, b) => {
      if (a.code.startsWith("OTHER")) return 1;
      if (b.code.startsWith("OTHER")) return -1;
      return b.value - a.value;
    };
    const originNodes = [...originMap.values()].sort(sortNodes);
    const marketNodes = [...marketMap.values()].sort(sortNodes);
    const maxCount = Math.max(originNodes.length, marketNodes.length);
    const scale = (height - top - bottom - nodePadding * (maxCount - 1)) / total;
    const placeNodes = (nodes, x) => {
      const used = nodes.reduce((sum, node) => sum + node.value * scale, 0) + nodePadding * (nodes.length - 1);
      let y = top + Math.max(0, (height - top - bottom - used) / 2);
      nodes.forEach((node, index) => {
        node.index = index;
        node.x = x;
        node.y0 = y;
        node.y1 = y + node.value * scale;
        node.offset = 0;
        y = node.y1 + nodePadding;
      });
    };
    placeNodes(originNodes, leftX);
    placeNodes(marketNodes, rightX);
    const originIndex = new Map(originNodes.map((node) => [node.code, node]));
    const marketIndex = new Map(marketNodes.map((node) => [node.code, node]));
    const edges = geography.flows.map((edge) => ({ ...edge, source:originIndex.get(edge.origin_code), target:marketIndex.get(edge.market_code) }))
      .sort((a, b) => a.source.index - b.source.index || a.target.index - b.target.index || b.primary_value_usd - a.primary_value_usd);
    const targetOffsets = new Map(marketNodes.map((node) => [node.code, 0]));
    edges.forEach((edge) => {
      edge.width = Math.max(.7, edge.primary_value_usd * scale);
      edge.sy = edge.source.y0 + edge.source.offset + edge.width / 2;
      edge.source.offset += edge.width;
    });
    edges.sort((a, b) => a.target.index - b.target.index || a.source.index - b.source.index || b.primary_value_usd - a.primary_value_usd)
      .forEach((edge) => {
        const offset = targetOffsets.get(edge.target.code);
        edge.ty = edge.target.y0 + offset + edge.width / 2;
        targetOffsets.set(edge.target.code, offset + edge.width);
      });

    const svg = svgElement("svg", { viewBox:`0 0 ${width} ${height}`, role:"img", "aria-label":`${copy.areas[area.code]}, ${period.period}: ${copy.flowTitle}` });
    const linksGroup = svgElement("g");
    edges.sort((a, b) => b.width - a.width).forEach((edge) => {
      const middle = (leftX + nodeWidth + rightX) / 2;
      const path = svgElement("path", {
        class:"flow-link",
        d:`M ${leftX + nodeWidth} ${edge.sy} C ${middle} ${edge.sy}, ${middle} ${edge.ty}, ${rightX} ${edge.ty}`,
        "stroke-width":edge.width,
        tabindex:"0",
        role:"button",
        "aria-label":`${translatedName(edge.origin_code, edge.origin_name)} → ${translatedName(edge.market_code, edge.market_name)}: ${money.format(edge.primary_value_usd)}`,
      });
      const show = () => {
        svg.querySelectorAll(".flow-link.selected").forEach((node) => node.classList.remove("selected"));
        path.classList.add("selected");
        flowDetail.innerHTML = `<strong>${escapeHTML(translatedName(edge.origin_code, edge.origin_name))} → ${escapeHTML(translatedName(edge.market_code, edge.market_name))}</strong> · ${escapeHTML(money.format(edge.primary_value_usd))} · ${escapeHTML(percent.format(edge.primary_value_usd / total))} ${escapeHTML(copy.share)}`;
      };
      path.addEventListener("mouseenter", show);
      path.addEventListener("focus", show);
      path.addEventListener("click", show);
      linksGroup.append(path);
    });
    svg.append(linksGroup);

    const drawNodes = (nodes, kind) => {
      const group = svgElement("g");
      nodes.forEach((node) => {
        group.append(svgElement("rect", { x:node.x, y:node.y0, width:nodeWidth, height:Math.max(1, node.y1 - node.y0), rx:"2", class:kind === "origin" ? "flow-origin-node" : "flow-market-node" }));
        const anchor = kind === "origin" ? "end" : "start";
        const x = kind === "origin" ? node.x - 8 : node.x + nodeWidth + 8;
        const label = svgElement("text", { x, y:(node.y0 + node.y1) / 2 - 3, "text-anchor":anchor, class:"flow-label" });
        label.textContent = translatedName(node.code, node.name).replace("European Union (EU-27)", "EU-27").replace("Evropská unie (EU-27)", "EU-27");
        const value = svgElement("text", { x, y:(node.y0 + node.y1) / 2 + 12, "text-anchor":anchor, class:"flow-value" });
        value.textContent = money.format(node.value);
        group.append(label, value);
      });
      svg.append(group);
    };
    drawNodes(originNodes, "origin");
    drawNodes(marketNodes, "market");
    flow.replaceChildren(svg);
  }

  function drawHistory() {
    const area = selectedArea();
    if (!area) return;
    const rows = area.periods.map((period) => ({ year:Number(period.period.slice(0, 4)), value:period.primary_value_usd, period:period.period }));
    const width = Math.max(historyChart.clientWidth, 340);
    const height = 250;
    const margin = { top:30, right:28, bottom:42, left:74 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const max = Math.max(...rows.map((row) => row.value), 1) * 1.15;
    const x = (year) => rows.length === 1 ? margin.left + plotWidth / 2 : margin.left + (year - rows[0].year) / (rows.at(-1).year - rows[0].year) * plotWidth;
    const y = (value) => margin.top + plotHeight - value / max * plotHeight;
    const svg = svgElement("svg", { viewBox:`0 0 ${width} ${height}`, role:"img", "aria-label":`${copy.areas[area.code]}: ${copy.historyTitle}` });
    svg.append(svgElement("rect", { x:margin.left, y:margin.top, width:plotWidth, height:plotHeight, class:"history-frame" }));
    [0, .5, 1].forEach((fraction) => {
      const value = max * fraction;
      const lineY = y(value);
      svg.append(svgElement("line", { x1:margin.left, x2:width - margin.right, y1:lineY, y2:lineY, class:"history-grid" }));
      const label = svgElement("text", { x:margin.left - 8, y:lineY + 4, "text-anchor":"end", class:"history-axis" });
      label.textContent = money.format(value);
      svg.append(label);
    });
    if (rows.length > 1) {
      const path = rows.map((row, index) => `${index ? "L" : "M"} ${x(row.year)} ${y(row.value)}`).join(" ");
      svg.append(svgElement("path", { d:path, class:"history-line" }));
    }
    rows.forEach((row) => {
      const point = svgElement("circle", { cx:x(row.year), cy:y(row.value), r:"6", class:"history-point", tabindex:"0", "aria-label":`${row.period}: ${money.format(row.value)}` });
      const year = svgElement("text", { x:x(row.year), y:height - 16, "text-anchor":"middle", class:"history-axis" });
      year.textContent = row.period;
      const value = svgElement("text", { x:x(row.year), y:y(row.value) - 13, "text-anchor":"middle", class:"history-value" });
      value.textContent = money.format(row.value);
      point.addEventListener("click", () => { state.period = row.period; periodSelect.value = row.period; updateURL(); render(); });
      svg.append(point, year, value);
    });
    historyChart.replaceChildren(svg);
    historyContext.textContent = `${rows.length} ${rows.length === 1 ? copy.annualPoint : copy.annualPoints}`;
  }

  function render() {
    const area = selectedArea();
    const period = selectedPeriod();
    const geography = selectedGeography();
    if (!area || !period || !geography) return;
    const coverage = state.data.scope.coverage.find((row) => row.period === period.period);
    const coverageDetail = coverage ? `${coverage.loaded_market_count} ${copy.completeMarkets} + ${coverage.partial_market_count} ${copy.partialMarkets}` : `${period.observed_market_count} ${copy.importMarkets}`;
    kpis.innerHTML = `
      <article><span>${escapeHTML(copy.observedValue)}</span><strong>${escapeHTML(money.format(period.primary_value_usd))}</strong><small>${escapeHTML(period.period)} · ${escapeHTML(copy.importerReported)}</small></article>
      <article><span>${escapeHTML(copy.observedCoverage)}</span><strong>${integer.format(period.observed_origin_count)} → ${integer.format(period.observed_market_count)}</strong><small>${escapeHTML(copy.originCountries)} → ${escapeHTML(copy.importMarkets)} · ${escapeHTML(coverageDetail)}</small></article>
      <article><span>${escapeHTML(copy.productDefinition)}</span><strong>HS ${escapeHTML(area.hs)}</strong><small>${integer.format(period.observed_route_count)} ${escapeHTML(copy.routes)}</small></article>`;
    renderRankings(origins, geography.origins, "origins");
    renderRankings(markets, geography.markets, "markets");
    flowContext.textContent = `${copy.areas[area.code]} · HS ${area.hs} · ${period.period} · ${copy.importerReported}`;
    flowDetail.innerHTML = `<span>${escapeHTML(copy.flowHint)}</span>`;
    drawFlow();
    drawHistory();
  }

  function populate() {
    areaSelect.innerHTML = state.data.business_areas.map((area) => `<option value="${escapeHTML(area.code)}">${escapeHTML(copy.areas[area.code] || area.label)} · HS ${escapeHTML(area.hs)}</option>`).join("");
    const requestedArea = params.get("area");
    state.area = state.data.business_areas.some((area) => area.code === requestedArea) ? requestedArea : "SMARTPHONES";
    areaSelect.value = state.area;
    geographySelect.value = state.geography;
    const availablePeriods = state.data.scope.available_periods;
    periodSelect.innerHTML = [...availablePeriods].reverse().map((period) => `<option value="${escapeHTML(period)}">${escapeHTML(period)}</option>`).join("");
    const requestedPeriod = params.get("product_period");
    state.period = availablePeriods.includes(requestedPeriod) ? requestedPeriod : availablePeriods.at(-1);
    periodSelect.value = state.period;
  }

  areaSelect.addEventListener("change", () => {
    state.area = areaSelect.value;
    const periods = selectedArea().periods.map((row) => row.period);
    if (!periods.includes(state.period)) state.period = periods.at(-1);
    periodSelect.value = state.period;
    updateURL(); render();
  });
  geographySelect.addEventListener("change", () => { state.geography = geographySelect.value; updateURL(); render(); });
  periodSelect.addEventListener("change", () => { state.period = periodSelect.value; updateURL(); render(); });

  status.hidden = false;
  status.textContent = copy.loading;
  fetch("/data/trade/product-intelligence.v1.json?v=20260902-product-intelligence")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      if (data.contract !== "trade-product-intelligence.v1" || !data.business_areas?.length) throw new Error("Invalid product-intelligence contract");
      state.data = data;
      populate();
      status.hidden = true;
      render();
      let frame;
      new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { drawFlow(); drawHistory(); }); }).observe(root);
    })
    .catch((error) => {
      console.error(error);
      status.textContent = copy.loadError;
    });
})();
