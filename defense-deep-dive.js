(() => {
  const lang = document.documentElement.lang === "en" ? "en" : "cs";
  const copy = {
    cs:{eyebrow:"Report / Obrana",titleLead:"Výdaje",titleEm:"na obranu",intro:"Všech 32 členů NATO vedle Ruska, Číny a Ukrajiny. V dolarech, v podílu na HDP a v čase od roku 1990.",countryLabel:"Země",countryProfile:"Otevřít celý profil země",blocksNav:"Bloky",compareNav:"Žebříček",trajectoryNav:"Vývoj",detailNav:"Detail země",linesNav:"Rozpočtové řádky",methodNav:"Metodika",
      blocksKicker:"Kolik to je",blocksTitle:"Jeden blok je jedna miliarda dolarů",blocksIntro:"Vojenské výdaje za zvolený rok v běžných cenách a tržních kurzech. Uvnitř NATO je vidět každý členský stát jako vlastní úsek.",yearLabel:"Rok",playLabel:"Přehrát roky",pauseLabel:"Zastavit",includeUS:"Počítat i Spojené státy",
      blocksNote:"Jeden blok odpovídá miliardě dolarů v běžných cenách a tržních kurzech daného roku. Odstíny modré oddělují sousední země, identitu nese popisek a legenda. Součet bloků je zaokrouhlený, čísla v záhlaví jsou přesná.",exchangeNote:"Tržní kurzy podhodnocují nákupní sílu zemí s nižšími cenami. Ruské a čínské výdaje by v paritě kupní síly byly výrazně vyšší; SIPRI takový přepočet nezveřejňuje.",
      natoLabel:"NATO",allNato:"Všichni členové NATO",natoNoUS:"Členové NATO bez USA",natoNoUSShort:"NATO bez USA",shareNav:"Podíl USA",shareKicker:"Podíl USA",shareTitle:"Kolik z výdajů NATO připadá na Spojené státy",shareIntro:"Rozdělení celkových vojenských výdajů aliance mezi Spojené státy a zbývající členské státy, rok po roce.",usShareLabel:"Podíl USA",usSpendLabel:"Spojené státy",othersLabel:"Ostatní členové",shareHigh:"Nejvyšší podíl",shareNote:"Běžné ceny a tržní kurzy. Součet je vždy sto procent výdajů aliance v daném roce; osa proto vede od nuly do sta.",ofNato:"z NATO",blockUnit:"bloků",otherMembers:"Ostatní členové",underOneBlock:"pod jednu miliardu dolarů",memberStates:"členských států",legendTitle:"Členské státy NATO, od největšího",legendTitleNoUS:"Členské státy NATO bez USA, od největšího",selectedCountry:"Vybraná země",
      compareKicker:"Žebříček zemí",compareTitle:"Všech 32 členů NATO a čtyři země mimo alianci",compareIntro:"Přepněte měřítko. Podíl na HDP nese závazky NATO, absolutní částky ukazují váhu, přepočet na obyvatele a podíl na výdajích státu ukazují zátěž.",
      trajectoryKicker:"Od roku 1990",trajectoryTitle:"NATO, Rusko, Čína a Ukrajina v čase",trajectoryIntro:"Stálé ceny roku 2024 odstraňují inflaci i pohyb kurzů, takže roky jsou srovnatelné mezi sebou. Vybraná země se přidá jako samostatná linka.",trajectoryNote:"Agregáty NATO počítají dnešních 32 členů zpětně.",completeFrom:"Všech 32 zemí vykazuje od roku",hiddenSeries:"Vypnuto v legendě, aby ostatní linky zůstaly čitelné:",mConst:"Stálé ceny",
      detailKicker:"Detail země",detailTitle:"v čase a v rozpočtu",trendKicker:"Historie",trendTitle:"Vojenské výdaje jako % HDP",trendNote:"Změna v čase používá jednu harmonizovanou řadu. Mezery nejsou nuly.",
      linesKicker:"Původní rozpočet",linesTitle:"Rozpočtové řádky až do nejnižší dostupné úrovně",searchLabel:"Hledat v rozpočtu",shownLabel:"Zobrazeno",codeHeader:"Kód",parentHeader:"Program / kapitola",lineHeader:"Rozpočtový řádek",classHeader:"Klasifikace",amountHeader:"Částka",
      methodKicker:"Co lze srovnávat",methodTitle:"Harmonizované srovnání a národní detail",methodIntro:"Mezinárodní grafy stojí na jediném zdroji, takže jsou srovnatelné mezi zeměmi i mezi roky. Detailní tabulky zachovávají národní rozsah, rok, měnu i klasifikaci a proto se mezi zeměmi nesčítají řádek po řádku.",
      methodCompare:"Databáze vojenských výdajů, vydání z dubna 2026. Pět ukazatelů pro 1949–2025; pracujeme s roky od 1990.",methodNato:"Hagský závazek: 3,5 % HDP na jádrové obranné potřeby a až 1,5 % na širší bezpečnost do roku 2035.",nationalTitle:"Národní rozpočty",methodNational:"Nejjemnější legálně a veřejně dostupná strojově čitelná vrstva, kterou máme pro danou zemi staženou.",
      natoMembers:"Členové NATO",otherCountries:"Mimo NATO",targetLabel:"NATO 3,5 %",chartNote:"SIPRI a NATO používají odlišné definice; cílové čáry jsou kontext, nikoli verdikt o plnění.",
      axisCapped:"Osa je kvůli čitelnosti zastropovaná; hodnoty nad strop jsou vypsané celé.",gdpShare:"vojenské výdaje / HDP",budgetTotal:"součet zobrazených řádků",budgetPeriod:"období rozpočtu",noLines:"Žádný řádek neodpovídá hledání.",loadError:"Data obranného profilu se nepodařilo načíst.",nato:"NATO",notNato:"mimo NATO",noBudget:"Pro tuto zemi zatím nemáme stažený strojově čitelný rozpočtový zdroj. Mezinárodní ukazatele výše platí i tak.",
      mGdp:"% HDP",mAbs:"Dolary",mCapita:"Na obyvatele",mGovt:"% výdajů státu",perPerson:"na obyvatele",ofGovt:"z výdajů státu",
      estimate:"odhad SIPRI",uncertain:"vysoce nejistý údaj",since:"v NATO od",noArmy:"Island nemá stálou armádu; SIPRI vykazuje nulu.",
      caveatsTitle:"Co tato čísla neříkají",caveat1Title:"Kurzy, ne kupní síla",caveat2Title:"Definice se liší",caveat2:"SIPRI počítá vojenské výdaje po své vlastní definici. NATO, národní rozpočty a zákon o státním rozpočtu se s ní nekryjí. Číslo z jedné vrstvy nelze dosadit do druhé.",caveat3Title:"Odhady jsou označené",caveat3:"Modře tištěné hodnoty ve zdroji jsou odhady SIPRI, červeně tištěné jsou vysoce nejisté. Označení cestuje s čísly až do grafů a popisků.",caveat4Title:"Výdaje nejsou schopnosti",caveat4:"Rozpočet neměří výcvik, zásoby munice, stav techniky ani to, co armáda dokáže. Stejná částka koupí v každé zemi jiné množství sil."},
    en:{eyebrow:"Report / Defense",titleLead:"Defense",titleEm:"spending",intro:"All 32 NATO members next to Russia, China and Ukraine. In dollars, as a share of GDP, and over time since 1990.",countryLabel:"Country",countryProfile:"Open full country profile",blocksNav:"Blocks",compareNav:"Ranking",trajectoryNav:"Over time",detailNav:"Country detail",linesNav:"Budget lines",methodNav:"Method",
      blocksKicker:"The size of it",blocksTitle:"One block is one billion dollars",blocksIntro:"Military spending in the selected year, at current prices and market exchange rates. Inside NATO every member state is its own visible section.",yearLabel:"Year",playLabel:"Play the years",pauseLabel:"Stop",includeUS:"Count the United States",
      blocksNote:"One block is a billion dollars at the prices and market exchange rates of that year. The blue steps separate neighbouring countries; identity comes from the labels and the legend. Block counts are rounded, the figures in the headers are exact.",exchangeNote:"Market exchange rates understate what a dollar buys in cheaper economies. Russian and Chinese spending would be markedly higher at purchasing-power parity, which SIPRI does not publish.",
      natoLabel:"NATO",allNato:"All NATO members",natoNoUS:"NATO members without the US",natoNoUSShort:"NATO without the US",shareNav:"US share",shareKicker:"The American share",shareTitle:"How much of NATO spending is the United States",shareIntro:"The alliance\u2019s whole military budget split between the United States and the other member states, year by year.",usShareLabel:"US share",usSpendLabel:"United States",othersLabel:"Other members",shareHigh:"Highest share",shareNote:"Current prices and market exchange rates. The two bands always sum to the whole alliance budget for that year, which is why the axis runs from zero to a hundred.",ofNato:"of NATO",blockUnit:"blocks",otherMembers:"Other members",underOneBlock:"under one billion dollars",memberStates:"member states",legendTitle:"NATO member states, largest first",legendTitleNoUS:"NATO member states without the US, largest first",selectedCountry:"Selected country",
      compareKicker:"Country ranking",compareTitle:"All 32 NATO members and four countries outside the alliance",compareIntro:"Switch the measure. The GDP share carries the NATO commitments, absolute dollars show weight, per-person and government-share figures show the burden.",
      trajectoryKicker:"Since 1990",trajectoryTitle:"NATO, Russia, China and Ukraine over time",trajectoryIntro:"Constant 2024 prices strip out inflation and exchange-rate moves, so the years can be compared with each other. The selected country joins as its own line.",trajectoryNote:"NATO aggregates apply today's 32 members backwards.",completeFrom:"All 32 report from",hiddenSeries:"Switched off in the legend so the other lines stay readable:",mConst:"Constant prices",
      detailKicker:"Country detail",detailTitle:"over time and in the budget",trendKicker:"History",trendTitle:"Military expenditure as % of GDP",trendNote:"The time series uses one harmonised measure. Gaps are not zeroes.",
      linesKicker:"Native budget",linesTitle:"Budget lines down to the lowest available level",searchLabel:"Search the budget",shownLabel:"Showing",codeHeader:"Code",parentHeader:"Programme / chapter",lineHeader:"Budget line",classHeader:"Classification",amountHeader:"Amount",
      methodKicker:"What is comparable",methodTitle:"The harmonised comparison and the national detail",methodIntro:"The international charts rest on a single source, so they compare across countries and across years. Detail tables preserve national scope, year, currency and classification, so their rows should not be compared line by line across countries.",
      methodCompare:"The military expenditure database, April 2026 edition. Five measures covering 1949–2025; we use the years from 1990.",methodNato:"The Hague commitment: 3.5% of GDP for core defense and up to 1.5% for broader security by 2035.",nationalTitle:"National budgets",methodNational:"The finest legal, public and machine-readable layer currently downloaded for each country.",
      natoMembers:"NATO members",otherCountries:"Outside NATO",targetLabel:"NATO 3.5%",chartNote:"SIPRI and NATO use different definitions; the markers are context, not a compliance ruling.",
      axisCapped:"The axis is capped for readability; values above the cap are printed in full.",gdpShare:"military expenditure / GDP",budgetTotal:"sum of displayed lines",budgetPeriod:"budget period",noLines:"No budget line matches the search.",loadError:"Defense profile data could not be loaded.",nato:"NATO",notNato:"non-NATO",noBudget:"No machine-readable budget source is downloaded for this country yet. The international measures above still apply.",
      mGdp:"% of GDP",mAbs:"Dollars",mCapita:"Per person",mGovt:"% of state spending",perPerson:"per person",ofGovt:"of state spending",
      estimate:"SIPRI estimate",uncertain:"highly uncertain figure",since:"in NATO since",noArmy:"Iceland has no standing army; SIPRI reports zero.",
      caveatsTitle:"What these figures do not say",caveat1Title:"Exchange rates, not purchasing power",caveat2Title:"The definitions differ",caveat2:"SIPRI counts military spending on its own definition. NATO, national budgets and the budget act do not line up with it. A number from one layer cannot be dropped into another.",caveat3Title:"Estimates are flagged",caveat3:"Values printed blue in the source are SIPRI estimates, red ones are highly uncertain. The flag travels with the number into the charts and readouts.",caveat4Title:"Spending is not capability",caveat4:"A budget does not measure training, ammunition stocks, the state of the equipment or what an army can do. The same sum buys a different force in every country."}
  }[lang];
  document.querySelectorAll("[data-defense-copy]").forEach(node => { const value = copy[node.dataset.defenseCopy]; if (value) node.textContent = value; });

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const locale = lang === "en" ? "en-US" : "cs-CZ";
  const number = (value, digits = 1) => new Intl.NumberFormat(locale, {maximumFractionDigits:digits, minimumFractionDigits:digits}).format(value);
  const compact = value => new Intl.NumberFormat(locale, {notation:"compact", maximumFractionDigits:1}).format(value);
  const integer = value => new Intl.NumberFormat(locale, {maximumFractionDigits:0}).format(value);
  // SIPRI money arrives in US$ millions; every readout on this page speaks billions.
  const usd = millions => {
    const bn = millions / 1000;
    const digits = bn === 0 || Math.abs(bn) >= 100 ? 0 : Math.abs(bn) >= 10 ? 1 : 2;
    return lang === "en" ? `$${number(bn, digits)}bn` : `${number(bn, digits)} mld. $`;
  };
  const dollars = value => lang === "en" ? `$${integer(value)}` : `${integer(value)} $`;
  const percent = (value, digits = 2) => lang === "en" ? `${number(value, digits)}%` : `${number(value, digits)} %`;

  // Validated with the dataviz palette checker against this page's paper surface (#f1ede3):
  // four blocs all-pairs, and the NATO section ramp as an ordinal single-hue scale.
  const BLOC_COLOUR = {nato:"#0b6aad", china:"#b3840d", russia:"#ad2f2f", ukraine:"#0f8f74"};
  const NATO_RAMP = ["#1b6aa4", "#4689c0", "#74a7cf"];
  const US_COLOUR = "#0a4c78";
  const OTHER_COLOUR = "#96a39b";
  const BLOCK_VALUE = 1000;          // US$ millions represented by one block
  const MEASURES = ["gdp_share", "current_usd", "per_capita", "govt_share"];
  const MEASURE_LABEL = {gdp_share:copy.mGdp, current_usd:copy.mAbs, per_capita:copy.mCapita, govt_share:copy.mGovt, constant_usd:copy.mConst};
  const CAP = {gdp_share:6, govt_share:22};
  const TRAJECTORY_MEASURES = ["constant_usd", "gdp_share"];

  let comparison, detail;
  const state = {code:"USA", year:2025, measure:"gdp_share", trajectory:"constant_usd", includeUS:true, search:"", hidden:{constant_usd:new Set(), gdp_share:new Set(["UKR"])}, playing:null};

  const byCode = code => comparison.countries.find(item => item.code === code);
  const aggregate = id => comparison.aggregates.find(item => item.id === id);
  const name = item => item[lang === "en" ? "name_en" : "name_cs"];
  const label = item => item[lang === "en" ? "label_en" : "label_cs"];
  const yearIndex = year => comparison.years.indexOf(year);
  const valueAt = (item, measure, year) => item.series[measure]?.[yearIndex(year)] ?? null;
  const statusAt = (item, measure, year) => ({e:copy.estimate, u:copy.uncertain}[item.flags?.[measure]?.[yearIndex(year)]] || "");
  const formatMeasure = (measure, value) => value == null ? "—"
    : measure === "current_usd" || measure === "constant_usd" ? usd(value)
    : measure === "per_capita" ? dollars(value)
    : percent(value);

  /* ---------------------------------------------------------------- tooltip */
  const tooltip = $("#defense-tooltip");
  function showTooltip(event, rows) {
    tooltip.replaceChildren(...rows.map(row => {
      const line = document.createElement("div");
      line.className = row.head ? "tip-head" : "tip-row";
      if (row.colour) { const key = document.createElement("i"); key.style.background = row.colour; line.append(key); }
      const text = document.createElement("span");
      text.textContent = row.label;                       // source labels stay untrusted text
      const value = document.createElement("strong");
      value.textContent = row.value ?? "";
      line.append(text, value);
      return line;
    }));
    tooltip.hidden = false;
    const width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    const x = Math.min(Math.max(12, event.clientX + 16), innerWidth - width - 12);
    const y = event.clientY - height - 14 < 12 ? event.clientY + 20 : event.clientY - height - 14;
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }
  const hideTooltip = () => { tooltip.hidden = true; };
  addEventListener("scroll", hideTooltip, {passive:true});

  function countryTooltip(item, year) {
    const rows = [{head:true, label:`${name(item)} · ${year}`, value:""}];
    for (const measure of MEASURES) {
      const flag = statusAt(item, measure, year);
      rows.push({label:MEASURE_LABEL[measure] + (flag ? ` (${flag})` : ""), value:formatMeasure(measure, valueAt(item, measure, year))});
    }
    if (item.nato_member) rows.push({label:copy.since, value:String(item.nato_since)});
    return rows;
  }

  /* ----------------------------------------------------------- block chart */
  // Cumulative rounding keeps the sum of the country blocks equal to the rounded
  // bloc total, so no country is inflated to a full block and none silently vanishes.
  function allocate(entries) {
    let running = 0, placed = 0;
    return entries.map(entry => {
      running += entry.value;
      const end = Math.round(running / BLOCK_VALUE);
      const blocks = Math.max(0, end - placed);
      placed = end;
      return {...entry, blocks};
    });
  }

  function blocConfig() {
    const members = aggregate(state.includeUS ? "nato_total" : "nato_europe_canada");
    const natoEntries = members.members
      .map(code => byCode(code))
      .map(item => ({code:item.code, label:name(item), value:valueAt(item, "current_usd", state.year) || 0, item}))
      .filter(entry => entry.value > 0)
      .sort((a, b) => b.value - a.value);
    const single = (code, key) => {
      const item = byCode(code);
      const value = valueAt(item, "current_usd", state.year) || 0;
      return {id:key, label:name(item), total:value, colour:BLOC_COLOUR[key],
        entries:[{code, label:name(item), value, item}]};
    };
    // Ukraine sits next to the alliance it is supplied by; Russia and China follow.
    return [
      {id:"nato", label:state.includeUS ? copy.allNato : copy.natoNoUS, colour:BLOC_COLOUR.nato,
       total:natoEntries.reduce((sum, entry) => sum + entry.value, 0), entries:natoEntries},
      single("UKR", "ukraine"), single("RUS", "russia"), single("CHN", "china"),
    ];
  }

  // The four grids share a block size and a row count, so they stand side by side and their
  // widths carry the comparison. Both are searched rather than estimated: the largest block
  // that lets the whole cluster fit the row without passing the height budget, counting the
  // width each caption needs under a narrow column.
  function blockGeometry(counts, width, blocs, gutter, captionMin, maxHeight) {
    const total = Math.max(1, counts.reduce((sum, count) => sum + count, 0));
    const usable = Math.max(200, width - gutter * (blocs - 1) - 6);
    const rowWidth = (cell, rows) => counts.reduce((sum, count) =>
      sum + Math.max(Math.max(1, Math.ceil(count / rows)) * cell - 2, captionMin), 0);
    for (let cell = 13; cell >= 4; cell -= 1) {
      const maxRows = Math.max(8, Math.floor(maxHeight / cell));
      for (let rows = Math.max(8, Math.ceil(total * cell / usable)); rows <= maxRows; rows += 1) {
        if (rowWidth(cell, rows) <= usable) return {cell, rows};
      }
    }
    return {cell:4, rows:Math.max(8, Math.floor(maxHeight / 4))};
  }

  function renderBlocks() {
    const blocs = blocConfig();
    const natoTotal = blocs[0].total;
    let natoRuns = [];
    const host = $("#defense-blocks");
    const padding = getComputedStyle(host);
    // clientWidth still carries the card's padding; the grids only get what is inside it.
    const width = Math.max(220, (host.clientWidth || 900)
      - parseFloat(padding.paddingLeft || 0) - parseFloat(padding.paddingRight || 0));
    const gutter = width >= 900 ? 26 : 14;
    const captionMin = width >= 620 ? 74 : 56;
    const maxHeight = width >= 900 ? 430 : width >= 620 ? 370 : 320;
    const counts = blocs.map(bloc => Math.round(bloc.total / BLOCK_VALUE));
    const {cell, rows} = blockGeometry(counts, width, blocs.length, gutter, captionMin, maxHeight);
    const size = Math.max(2, cell - (cell >= 8 ? 2 : 1));
    host.replaceChildren();
    host.style.gap = `${gutter}px`;

    const highlight = (code, scope) => {
      const marks = scope ? scope.querySelectorAll("path") : host.querySelectorAll("path");
      [...marks, ...$("#blocks-legend").querySelectorAll("button")]
        .forEach(node => node.classList.toggle("dimmed", Boolean(code) && node.dataset.code !== code));
    };

    for (const [position, bloc] of blocs.entries()) {
      const allocated = allocate(bloc.entries);
      const cols = Math.max(1, Math.ceil(counts[position] / rows));
      const figure = document.createElement("figure");
      figure.className = "defense-bloc";

      let cursor = 0, shade = 0;
      const runs = [];
      for (const entry of allocated) {
        if (!entry.blocks) continue;
        const segments = [];
        for (let block = 0; block < entry.blocks; block += 1, cursor += 1) {
          const x = Math.floor(cursor / rows) * cell, y = (rows - 1 - (cursor % rows)) * cell;
          segments.push(`M${x},${y}h${size}v${size}h-${size}z`);
        }
        runs.push({...entry, start:cursor - entry.blocks, end:cursor, d:segments.join(""),
          colour: bloc.id !== "nato" ? bloc.colour
            : entry.code === "USA" ? US_COLOUR : NATO_RAMP[shade++ % NATO_RAMP.length]});
      }
      const viewWidth = cols * cell - 2, viewHeight = rows * cell - 2;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`);
      svg.setAttribute("width", viewWidth);
      svg.setAttribute("height", viewHeight);
      svg.setAttribute("class", "defense-bloc-grid");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `${bloc.label} ${state.year}: ${usd(bloc.total)}`);
      for (const run of runs) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", run.d);
        path.setAttribute("fill", run.colour);
        path.dataset.code = run.code;
        svg.append(path);
      }
      // One direct label, on the band wide enough to hold it without covering its neighbours.
      // Every other member is named in the legend directly below, so identity never rests on hue.
      const widest = runs.length > 1
        ? runs.reduce((best, run) => run.blocks > (best?.blocks ?? 0) ? run : best, null) : null;
      if (widest && widest.blocks >= rows * 4) {
        const caption = `${widest.label} ${usd(widest.value)}`;
        const captionWidth = caption.length * 6.1;          // 10px monospace
        const bandStart = Math.floor(widest.start / rows) * cell;
        const bandEnd = Math.ceil(widest.end / rows) * cell;
        if (captionWidth <= bandEnd - bandStart) {
          const centre = (bandStart + bandEnd) / 2;
          const plate = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          plate.setAttribute("x", centre - captionWidth / 2 - 6);
          plate.setAttribute("y", viewHeight / 2 - 10);
          plate.setAttribute("width", captionWidth + 12);
          plate.setAttribute("height", 19);
          plate.setAttribute("class", "defense-bloc-plate");
          const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
          text.setAttribute("x", centre);
          text.setAttribute("y", viewHeight / 2 + 4);
          text.setAttribute("class", "defense-bloc-label");
          text.textContent = caption;
          svg.append(plate, text);
        }
      }

      const caption = document.createElement("figcaption");
      const swatch = document.createElement("b"); swatch.style.background = bloc.colour;
      const title = document.createElement("strong"); title.textContent = bloc.label;
      const value = document.createElement("span"); value.textContent = usd(bloc.total);
      const ratio = document.createElement("small");
      ratio.textContent = bloc.id === "nato"
        ? `${aggregate(state.includeUS ? "nato_total" : "nato_europe_canada").member_count} ${copy.memberStates}` : "";
      caption.append(swatch, title, value, ratio);
      figure.style.width = `${Math.max(viewWidth, captionMin)}px`;
      figure.append(svg, caption);
      host.append(figure);
      if (bloc.id === "nato") natoRuns = runs;

      svg.addEventListener("pointermove", event => {
        const box = svg.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width * viewWidth;
        const y = (event.clientY - box.top) / box.height * viewHeight;
        const column = Math.floor(x / cell), row = Math.floor(y / cell);
        const index = column * rows + (rows - 1 - row);
        const run = column >= 0 && column < cols
          ? runs.find(item => index >= item.start && index < item.end) : null;
        if (!run) { hideTooltip(); highlight(null, svg); return; }
        highlight(run.code, svg);
        showTooltip(event, [
          {head:true, label:`${run.label} · ${state.year}`, value:""},
          {colour:run.colour, label:MEASURE_LABEL.current_usd, value:usd(run.value)},
          {label:copy.blockUnit, value:integer(run.blocks)},
          {label:copy.ofNato, value:percent(run.value / natoTotal * 100, 1)},
          {label:MEASURE_LABEL.gdp_share, value:formatMeasure("gdp_share", valueAt(run.item, "gdp_share", state.year))},
        ]);
      });
      svg.addEventListener("pointerleave", () => { hideTooltip(); highlight(null, svg); });
    }

    renderBlocksMeta(blocs);
    renderBlocksLegend(blocs[0], natoRuns, highlight);
    $("#blocks-note").textContent = `${copy.blocksNote} ${copy.exchangeNote}`;
  }

  function renderBlocksMeta(blocs) {
    const meta = $("#blocks-meta");
    meta.replaceChildren(...[
      {value:String(state.year), label:copy.yearLabel},
      ...blocs.map(bloc => ({value:usd(bloc.total), label:bloc.label})),
    ].map(cell => {
      const box = document.createElement("div");
      const value = document.createElement("strong"); value.textContent = cell.value;
      const text = document.createElement("span"); text.textContent = cell.label;
      box.append(value, text);
      return box;
    }));
  }

  function renderBlocksLegend(nato, runs, highlight) {
    const legend = $("#blocks-legend");
    const heading = document.createElement("h3");
    heading.textContent = state.includeUS ? copy.legendTitle : copy.legendTitleNoUS;
    legend.replaceChildren(heading, ...runs.map(run => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.code = run.code;
      const swatch = document.createElement("i");
      swatch.style.background = run.colour;
      const text = document.createElement("span"); text.textContent = run.label;
      const value = document.createElement("strong"); value.textContent = usd(run.value);
      button.append(swatch, text, value);
      button.addEventListener("pointerenter", () => highlight(run.code));
      button.addEventListener("focus", () => highlight(run.code));
      button.addEventListener("pointerleave", () => highlight(null));
      button.addEventListener("blur", () => highlight(null));
      button.addEventListener("click", () => selectCountry(run.code, true));
      return button;
    }));
    const rest = nato.entries.length - runs.length;
    if (rest > 0) {
      const note = document.createElement("small");
      note.textContent = `${copy.otherMembers}: ${rest} — ${copy.underOneBlock}`;
      legend.append(note);
    }
  }

  function renderYearStrip() {
    const strip = $("#blocks-year-strip");
    const nato = aggregate("nato_total").series.current_usd;
    const peak = Math.max(...nato.filter(Number.isFinite));
    strip.replaceChildren(...comparison.years.map((year, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "defense-year-tick";
      button.style.setProperty("--h", `${Math.max(4, (nato[index] || 0) / peak * 100)}%`);
      button.setAttribute("aria-label", `${year}: ${usd(nato[index] || 0)}`);
      button.setAttribute("aria-pressed", String(year === state.year));
      if (year % 5 === 0 || year === comparison.years.at(-1)) button.dataset.year = String(year);
      button.addEventListener("click", () => setYear(year));
      return button;
    }));
  }

  function setYear(year) {
    state.year = Math.min(Math.max(year, comparison.years[0]), comparison.years.at(-1));
    $("#blocks-year").value = String(state.year);
    $("#blocks-year-value").textContent = String(state.year);
    $("#blocks-year-strip").querySelectorAll("button").forEach((button, index) =>
      button.setAttribute("aria-pressed", String(comparison.years[index] === state.year)));
    renderBlocks();
    renderRanking();
  }

  function togglePlay() {
    const button = $("#blocks-play");
    if (state.playing) {
      clearInterval(state.playing);
      state.playing = null;
      button.setAttribute("aria-pressed", "false");
      button.firstElementChild.textContent = copy.playLabel;
      return;
    }
    if (state.year >= comparison.years.at(-1)) setYear(comparison.years[0]);
    button.setAttribute("aria-pressed", "true");
    button.firstElementChild.textContent = copy.pauseLabel;
    state.playing = setInterval(() => {
      if (state.year >= comparison.years.at(-1)) return togglePlay();
      setYear(state.year + 1);
    }, 420);
  }

  /* --------------------------------------------------------------- ranking */
  function renderModes(host, measures, current, onPick) {
    host.replaceChildren(...measures.map(measure => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = MEASURE_LABEL[measure];
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(measure === current));
      button.addEventListener("click", () => onPick(measure));
      return button;
    }));
  }

  function rankingRow(item, measure, scale, cap) {
    const value = valueAt(item, measure, state.year);
    const flag = statusAt(item, measure, state.year);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `defense-rank-row${item.nato_member ? " nato" : ""}${item.code === state.code ? " selected" : ""}`;
    row.dataset.code = item.code;
    const identity = document.createElement("span");
    identity.className = "defense-rank-name";
    const flagImage = document.createElement("img");
    flagImage.src = `../../assets/flags/${item.flag}.svg`;
    flagImage.alt = "";
    const text = document.createElement("span"); text.textContent = name(item);
    const code = document.createElement("small"); code.textContent = item.code;
    identity.append(flagImage, text, code);
    const track = document.createElement("span");
    track.className = "defense-rank-track";
    const fill = document.createElement("i");
    const over = cap && value != null && value > cap;
    fill.style.width = `${Math.min(100, (value || 0) / scale * 100)}%`;
    if (value > 0) fill.classList.add("nonzero");
    if (over) fill.classList.add("over");
    track.append(fill);
    if (measure === "gdp_share") {
      for (const [marker, name_] of [[comparison.commitments.legacy_nato_floor_pct_gdp, "floor"], [comparison.commitments.nato_core_pct_gdp_2035, "target"]]) {
        const tick = document.createElement("b");
        tick.className = `defense-target-tick ${name_}`;
        tick.style.left = `${marker / scale * 100}%`;
        track.append(tick);
      }
    }
    const readout = document.createElement("strong");
    readout.textContent = formatMeasure(measure, value);
    if (flag) readout.classList.add("flagged");
    row.append(identity, track, readout);
    const show = event => showTooltip(event, countryTooltip(item, state.year));
    row.addEventListener("pointermove", show);
    row.addEventListener("pointerleave", hideTooltip);
    row.addEventListener("focus", event => show({clientX:row.getBoundingClientRect().left + 120, clientY:row.getBoundingClientRect().top}));
    row.addEventListener("blur", hideTooltip);
    row.addEventListener("click", () => selectCountry(item.code, true));
    return row;
  }

  function renderRanking() {
    const measure = state.measure;
    const cap = CAP[measure];
    const values = comparison.countries.map(item => valueAt(item, measure, state.year)).filter(value => value != null);
    const scale = cap || Math.max(...values) || 1;
    const sort = (a, b) => (valueAt(b, measure, state.year) ?? -1) - (valueAt(a, measure, state.year) ?? -1);
    const host = $("#defense-comparison-chart");
    host.replaceChildren();
    for (const [title, members] of [
      [copy.natoMembers, comparison.countries.filter(item => item.nato_member).sort(sort)],
      [copy.otherCountries, comparison.countries.filter(item => !item.nato_member).sort(sort)],
    ]) {
      const group = document.createElement("section");
      group.className = "defense-rank-group";
      const header = document.createElement("header");
      const left = document.createElement("span"); left.textContent = title;
      const right = document.createElement("span"); right.textContent = MEASURE_LABEL[measure];
      header.append(left, right);
      group.append(header, ...members.map(item => rankingRow(item, measure, scale, cap)));
      host.append(group);
    }
    const capped = cap && values.some(value => value > cap);
    $("#comparison-note").textContent = `${copy.chartNote}${capped ? ` ${copy.axisCapped}` : ""} ${copy.noArmy}`;
    renderRankingMeta();
  }

  function renderRankingMeta() {
    const nato = aggregate("nato_total"), europe = aggregate("nato_europe_canada");
    const index = yearIndex(state.year);
    $("#ranking-meta").replaceChildren(...[
      {value:String(state.year), label:copy.yearLabel},
      {value:percent(nato.series.gdp_share[index] ?? 0, 2), label:`${copy.natoLabel} · ${copy.mGdp}`},
      {value:percent(europe.series.gdp_share[index] ?? 0, 2), label:`${copy.natoNoUSShort} · ${copy.mGdp}`},
      {value:percent(comparison.commitments.nato_core_pct_gdp_2035, 1), label:copy.targetLabel},
    ].map(cell => {
      const box = document.createElement("div");
      const value = document.createElement("strong"); value.textContent = cell.value;
      const text = document.createElement("span"); text.textContent = cell.label;
      box.append(value, text);
      return box;
    }));
  }

  /* ------------------------------------------------------------ trajectory */
  function trajectorySeries() {
    const measure = state.trajectory;
    const series = [
      {id:"nato_total", label:label(aggregate("nato_total")), colour:BLOC_COLOUR.nato, values:aggregate("nato_total").series[measure], dash:""},
      {id:"nato_europe_canada", label:label(aggregate("nato_europe_canada")), colour:BLOC_COLOUR.nato, values:aggregate("nato_europe_canada").series[measure], dash:"7 5"},
      {id:"CHN", label:name(byCode("CHN")), colour:BLOC_COLOUR.china, values:byCode("CHN").series[measure], dash:""},
      {id:"RUS", label:name(byCode("RUS")), colour:BLOC_COLOUR.russia, values:byCode("RUS").series[measure], dash:""},
      {id:"UKR", label:name(byCode("UKR")), colour:BLOC_COLOUR.ukraine, values:byCode("UKR").series[measure], dash:""},
    ];
    const selected = byCode(state.code);
    if (selected && !series.some(line => line.id === selected.code)) {
      series.push({id:selected.code, label:`${name(selected)} · ${copy.selectedCountry}`, colour:"#171918", values:selected.series[measure], dash:"2 4"});
    }
    const hidden = state.hidden[measure];
    return series.map(line => ({...line, hidden:hidden.has(line.id)}));
  }

  function renderTrajectory() {
    const series = trajectorySeries();
    const visible = series.filter(line => !line.hidden);
    const years = comparison.years;
    const W = 960, H = 380, pad = {l:66, r:26, t:22, b:34};
    const peak = Math.max(...visible.flatMap(line => line.values.filter(Number.isFinite)), 1);
    const step = Math.pow(10, Math.floor(Math.log10(peak)));
    const maxY = Math.ceil(peak / step * 2) / 2 * step;
    const x = year => pad.l + (year - years[0]) / (years.at(-1) - years[0]) * (W - pad.l - pad.r);
    const y = value => pad.t + (maxY - value) / maxY * (H - pad.t - pad.b);
    const axisLabel = value => state.trajectory === "gdp_share" ? percent(value, value && value < 1 ? 1 : 0) : usd(value);

    const parts = [];
    for (const ratio of [0, .25, .5, .75, 1]) {
      const value = maxY * ratio;
      parts.push(`<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}"></line>`);
      parts.push(`<text class="axis" x="${pad.l - 10}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end">${esc(axisLabel(value))}</text>`);
    }
    for (const year of years.filter(item => item % 5 === 0).concat(years.at(-1))) {
      parts.push(`<text class="axis" x="${x(year).toFixed(1)}" y="${H - 11}" text-anchor="middle">${year}</text>`);
    }
    for (const line of visible) {
      let path = "", open = false;
      line.values.forEach((value, index) => {
        if (!Number.isFinite(value)) { open = false; return; }
        path += `${open ? "L" : "M"}${x(years[index]).toFixed(1)},${y(value).toFixed(1)}`;
        open = true;
      });
      if (path) parts.push(`<path class="traj-line" d="${path}" stroke="${line.colour}" stroke-dasharray="${line.dash}"></path>`);
    }
    parts.push(`<g class="traj-cursor off"><line y1="${pad.t}" y2="${H - pad.b}"></line></g>`);
    const host = $("#defense-trajectory");
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="defense-trajectory-svg" role="img" aria-label="${esc(copy.trajectoryTitle)}">${parts.join("")}</svg>`;

    const svg = host.querySelector("svg");
    const cursor = svg.querySelector(".traj-cursor");
    const cursorLine = cursor.querySelector("line");
    svg.addEventListener("pointermove", event => {
      const box = svg.getBoundingClientRect();
      const position = (event.clientX - box.left) / box.width * W;
      const year = years.reduce((best, item) => Math.abs(x(item) - position) < Math.abs(x(best) - position) ? item : best, years[0]);
      const index = yearIndex(year);
      cursor.classList.remove("off");
      cursorLine.setAttribute("x1", x(year)); cursorLine.setAttribute("x2", x(year));
      cursor.querySelectorAll("circle").forEach(node => node.remove());
      for (const line of visible) {
        const value = line.values[index];
        if (!Number.isFinite(value)) continue;
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", x(year)); dot.setAttribute("cy", y(value)); dot.setAttribute("r", 5);
        dot.setAttribute("fill", line.colour);
        cursor.append(dot);
      }
      showTooltip(event, [{head:true, label:String(year), value:""}, ...visible
        .map(line => ({colour:line.colour, label:line.label, value:formatMeasure(state.trajectory, line.values[index])}))
        .sort((a, b) => (b.value === "—") - (a.value === "—"))]);
    });
    svg.addEventListener("pointerleave", () => { cursor.classList.add("off"); hideTooltip(); });

    const legend = $("#trajectory-legend");
    legend.replaceChildren(...series.map(line => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `traj-key${line.hidden ? " off" : ""}`;
      button.setAttribute("aria-pressed", String(!line.hidden));
      const key = document.createElement("i");
      key.style.background = line.dash
        ? `repeating-linear-gradient(90deg, ${line.colour} 0 5px, transparent 5px 9px)`
        : line.colour;
      const text = document.createElement("span"); text.textContent = line.label;
      button.append(key, text);
      button.addEventListener("click", () => {
        const hidden = state.hidden[state.trajectory];
        hidden.has(line.id) ? hidden.delete(line.id) : hidden.add(line.id);
        renderTrajectory();
      });
      return button;
    }));
    const measureNote = comparison.measures[state.trajectory][lang === "en" ? "note_en" : "note_cs"];
    const off = series.filter(line => line.hidden).map(line => line.label);
    $("#trajectory-note").textContent = `${measureNote} ${copy.trajectoryNote} ${copy.completeFrom} ${aggregate("nato_total").complete_from}.`
      + (off.length ? ` ${copy.hiddenSeries} ${off.join(", ")}.` : "");
  }

  /* -------------------------------------------------- the American share */
  // A 100% stacked area: the alliance's whole military budget split between the United States
  // and the other members, year by year. The question is the split, so the axis runs 0–100.
  function renderUsShare() {
    const years = comparison.years;
    const nato = aggregate("nato_total").series.current_usd;
    const us = byCode("USA").series.current_usd;
    const rows = years.map((year, index) => {
      const total = nato[index], american = us[index];
      return Number.isFinite(total) && Number.isFinite(american) && total > 0
        ? {year, total, american, others:total - american, share:american / total * 100} : null;
    }).filter(Boolean);
    if (rows.length < 2) return;

    const W = 960, H = 460, pad = {l:56, r:26, t:22, b:34};
    const x = year => pad.l + (year - rows[0].year) / (rows.at(-1).year - rows[0].year) * (W - pad.l - pad.r);
    const y = value => pad.t + (100 - value) / 100 * (H - pad.t - pad.b);
    // The other members hold the floor and the United States sits on top of them.
    const seam = row => 100 - row.share;
    const boundary = rows.map((row, index) => `${index ? "L" : "M"}${x(row.year).toFixed(1)},${y(seam(row)).toFixed(1)}`).join("");
    const parts = [
      `<path class="share-area others" d="${boundary} L${x(rows.at(-1).year)},${H - pad.b} L${x(rows[0].year)},${H - pad.b} Z"></path>`,
      `<path class="share-area us" d="${boundary} L${x(rows.at(-1).year)},${pad.t} L${x(rows[0].year)},${pad.t} Z"></path>`,
      `<path class="share-line" d="${boundary}"></path>`,
    ];
    for (const ratio of [0, 25, 50, 75, 100]) {
      parts.push(`<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(ratio).toFixed(1)}" y2="${y(ratio).toFixed(1)}"></line>`);
      parts.push(`<text class="axis" x="${pad.l - 10}" y="${(y(ratio) + 4).toFixed(1)}" text-anchor="end">${esc(percent(ratio, 0))}</text>`);
    }
    for (const year of years.filter(item => item % 5 === 0).concat(rows.at(-1).year)) {
      if (year < rows[0].year) continue;
      parts.push(`<text class="axis" x="${x(year).toFixed(1)}" y="${H - 11}" text-anchor="middle">${year}</text>`);
    }
    parts.push(`<g class="traj-cursor off"><line y1="${pad.t}" y2="${H - pad.b}"></line></g>`);
    const host = $("#defense-share");
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="defense-share-svg" role="img" aria-label="${esc(copy.shareTitle)}">${parts.join("")}</svg>`;

    const svg = host.querySelector("svg");
    const cursor = svg.querySelector(".traj-cursor");
    svg.addEventListener("pointermove", event => {
      const box = svg.getBoundingClientRect();
      const position = (event.clientX - box.left) / box.width * W;
      const row = rows.reduce((best, item) => Math.abs(x(item.year) - position) < Math.abs(x(best.year) - position) ? item : best, rows[0]);
      cursor.classList.remove("off");
      cursor.querySelector("line").setAttribute("x1", x(row.year));
      cursor.querySelector("line").setAttribute("x2", x(row.year));
      cursor.querySelectorAll("circle").forEach(node => node.remove());
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", x(row.year)); dot.setAttribute("cy", y(seam(row))); dot.setAttribute("r", 5);
      dot.setAttribute("fill", US_COLOUR);
      cursor.append(dot);
      showTooltip(event, [
        {head:true, label:String(row.year), value:""},
        {colour:US_COLOUR, label:copy.usShareLabel, value:percent(row.share, 1)},
        {colour:US_COLOUR, label:copy.usSpendLabel, value:usd(row.american)},
        {colour:NATO_RAMP[1], label:copy.othersLabel, value:usd(row.others)},
        {label:copy.natoLabel, value:usd(row.total)},
      ]);
    });
    svg.addEventListener("pointerleave", () => { cursor.classList.add("off"); hideTooltip(); });

    const latest = rows.at(-1), first = rows[0];
    const peak = rows.reduce((best, row) => row.share > best.share ? row : best, rows[0]);
    $("#share-meta").replaceChildren(...[
      {value:percent(latest.share, 1), label:`${copy.usShareLabel} · ${latest.year}`},
      {value:percent(peak.share, 1), label:`${copy.shareHigh} · ${peak.year}`},
      {value:percent(first.share, 1), label:`${copy.usShareLabel} · ${first.year}`},
      {value:usd(latest.total - latest.american), label:`${copy.othersLabel} · ${latest.year}`},
    ].map(cell => {
      const box = document.createElement("div");
      const value = document.createElement("strong"); value.textContent = cell.value;
      const text = document.createElement("span"); text.textContent = cell.label;
      box.append(value, text);
      return box;
    }));
    $("#share-legend").replaceChildren(...[
      [US_COLOUR, copy.usSpendLabel, usd(latest.american)],
      [NATO_RAMP[1], copy.othersLabel, usd(latest.others)],
    ].map(([colour, text, value]) => {
      const key = document.createElement("div");
      key.className = "share-key";
      const swatch = document.createElement("i"); swatch.style.background = colour;
      const label_ = document.createElement("span"); label_.textContent = text;
      const amount = document.createElement("strong"); amount.textContent = value;
      key.append(swatch, label_, amount);
      return key;
    }));
    $("#share-note").textContent = copy.shareNote;
  }

  /* ---------------------------------------------------- country detail rows */
  function trendChart(item) {
    const years = comparison.years;
    const values = item.series.gdp_share;
    const points = years.map((year, index) => [year, values[index]]).filter(([, value]) => Number.isFinite(value));
    if (points.length < 2) return `<p class="defense-empty">—</p>`;
    const W = 900, H = 300, pad = {l:58, r:24, t:25, b:35};
    const maxY = Math.max(4, Math.ceil(Math.max(...points.map(row => row[1]))));
    const x = year => pad.l + (year - points[0][0]) / (points.at(-1)[0] - points[0][0]) * (W - pad.l - pad.r);
    const y = value => pad.t + (maxY - value) / maxY * (H - pad.t - pad.b);
    const line = points.map((row, index) => `${index ? "L" : "M"}${x(row[0]).toFixed(1)},${y(row[1]).toFixed(1)}`).join(" ");
    const area = `${line} L${x(points.at(-1)[0])},${H - pad.b} L${x(points[0][0])},${H - pad.b} Z`;
    const grid = [0, .25, .5, .75, 1].map(ratio => {
      const value = maxY * ratio;
      return `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(value)}" y2="${y(value)}"></line><text x="${pad.l - 9}" y="${y(value) + 4}" text-anchor="end">${number(value, 0)} %</text>`;
    }).join("");
    const ticks = [points[0][0], 2000, 2010, 2020, points.at(-1)[0]]
      .filter((value, index, all) => value >= points[0][0] && value <= points.at(-1)[0] && all.indexOf(value) === index)
      .map(value => `<text x="${x(value)}" y="${H - 10}" text-anchor="middle">${value}</text>`).join("");
    const dots = points.map(([year, value]) =>
      `<circle class="trend-dot" cx="${x(year).toFixed(1)}" cy="${y(value).toFixed(1)}" r="9" data-year="${year}" data-value="${value}"></circle>`).join("");
    return `<svg class="defense-trend-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name(item))} · ${esc(copy.gdpShare)}"><path class="area" d="${area}"></path>${grid}<path class="line" d="${line}"></path>${ticks}${dots}</svg>`;
  }

  function renderLines(item) {
    const budget = detail.countries.find(row => row.code === item.code)?.budget;
    const section = $("#budget-lines");
    section.hidden = !budget;
    if (!budget) return;
    const query = state.search.trim().toLocaleLowerCase(lang);
    const rows = budget.items.filter(row => !query || [row.id, row.parent, row.label_native, row.label_en, row.classification]
      .some(value => String(value || "").toLocaleLowerCase(lang).includes(query)));
    const unit = budget.unit.startsWith("billion")
      ? (lang === "en" ? `${budget.currency} bn` : `mld. ${budget.currency}`)
      : (lang === "en" ? `${budget.currency} mn` : `mil. ${budget.currency}`);
    $("#line-count").textContent = `${rows.length} / ${budget.item_count}`;
    $("#defense-lines-body").innerHTML = rows.length
      ? rows.map(row => `<tr><td>${esc(row.id)}</td><td>${esc(row.parent)}</td><td>${esc((lang === "en" && row.label_en) || row.label_native)}</td><td>${esc(row.classification || row.subfunction || "—")}</td><td>${number(row.amount, Math.abs(row.amount) < 1 ? 2 : 1)} ${esc(unit)}</td></tr>`).join("")
      : `<tr><td colspan="5" class="defense-empty">${esc(copy.noLines)}</td></tr>`;
    $("#coverage-note").textContent = budget[lang === "en" ? "coverage_note_en" : "coverage_note_cs"];
    $("#detail-scope").textContent = budget[lang === "en" ? "scope_en" : "scope_cs"];
  }

  function renderCountry() {
    const item = byCode(state.code);
    const record = detail.countries.find(row => row.code === state.code);
    const budget = record?.budget;
    const latestYear = item.latest_year;
    $("#detail-country-name").textContent = name(item);
    if (!budget) { $("#detail-scope").textContent = copy.noBudget; $("#coverage-note").textContent = ""; }

    const cards = [
      {label:copy.gdpShare, value:formatMeasure("gdp_share", valueAt(item, "gdp_share", latestYear)),
       note:`${latestYear} · ${item.nato_member ? `${copy.nato} ${item.nato_since}` : copy.notNato}`},
      {label:MEASURE_LABEL.current_usd, value:formatMeasure("current_usd", valueAt(item, "current_usd", latestYear)), note:String(latestYear)},
      {label:copy.perPerson, value:formatMeasure("per_capita", valueAt(item, "per_capita", latestYear)), note:String(latestYear)},
      {label:copy.ofGovt, value:formatMeasure("govt_share", valueAt(item, "govt_share", latestYear)), note:String(latestYear)},
    ];
    if (budget) cards.push(
      {label:copy.budgetTotal, value:compact(budget.total_amount), note:budget.unit.startsWith("billion") ? `${budget.currency} bn` : `${budget.currency} mn`},
      {label:copy.budgetPeriod, value:budget.period, note:budget[lang === "en" ? "status_en" : "status_cs"]});
    $("#defense-kpis").replaceChildren(...cards.map(card => {
      const article = document.createElement("article");
      const label_ = document.createElement("span"); label_.textContent = card.label;
      const value = document.createElement("strong"); value.textContent = card.value;
      const note = document.createElement("small"); note.textContent = card.note;
      article.append(label_, value, note);
      return article;
    }));

    $("#trend-latest").textContent = `${formatMeasure("gdp_share", valueAt(item, "gdp_share", latestYear))} · ${latestYear}`;
    $("#defense-trend").innerHTML = trendChart(item);
    $("#defense-trend").querySelectorAll(".trend-dot").forEach(dot => {
      const year = Number(dot.dataset.year);
      dot.addEventListener("pointerenter", event => showTooltip(event, countryTooltip(item, year)));
      dot.addEventListener("pointerleave", hideTooltip);
    });

    const sources = $("#national-sources");
    sources.replaceChildren(...(budget?.sources || []).map(source => {
      const link = document.createElement("a");
      link.href = source.url; link.target = "_blank"; link.rel = "noopener";
      link.textContent = `${source.title} ↗`;
      return link;
    }));
    const definition = record?.definition_detail;
    // Kept from the previous page: the two Czech measures next to each other, so nobody
    // reads a NATO-core estimate and a chapter outturn as the same number.
    let definitionNote = $("#definition-note");
    if (!definitionNote) {
      definitionNote = document.createElement("p");
      definitionNote.id = "definition-note";
      definitionNote.className = "defense-definition-note";
      $("#coverage-note").after(definitionNote);
    }
    definitionNote.textContent = definition ? (lang === "en"
      ? `Separate measures: NATO core defence ${definition.nato_latest.year} estimate ${number(definition.nato_latest.total_current_million_czk / 1000, 2)} CZK bn; chapter 307 reported outturn ${definition.chapter_latest.year} ${number(definition.chapter_latest.total / 1e6, 2)} CZK bn. Their definitions and budget stages differ.`
      : `Samostatné ukazatele: odhad jádrových výdajů NATO ${definition.nato_latest.year} ${number(definition.nato_latest.total_current_million_czk / 1000, 2)} mld. Kč; vykázaná skutečnost kapitoly 307 za ${definition.chapter_latest.year} ${number(definition.chapter_latest.total / 1e6, 2)} mld. Kč. Definice i rozpočtová fáze se liší.`) : "";
    definitionNote.hidden = !definition;
    if (definition) sources.insertAdjacentHTML("beforeend",
      `<a href="../../${esc(definition.artifact)}">${lang === "en" ? "Czech NATO categories and chapter outturn (JSON)" : "České kategorie NATO a skutečnost kapitoly (JSON)"} ↗</a><a href="${esc(definition.nato_source.url)}" target="_blank" rel="noopener">NATO 2026 ↗</a><a href="${esc(definition.chapter_source.url)}" target="_blank" rel="noopener">MO 2025 ↗</a>`);
    if (item.source_note) {
      const note = document.createElement("small");
      note.className = "defense-source-note";
      note.textContent = `SIPRI — ${sourceNoteText(item.source_note)}`;
      sources.append(note);
    }

    renderLines(item);
    renderRanking();
    renderTrajectory();
  }

  function sourceNoteText(marker) {
    const symbols = comparison.footnotes.symbols || {};
    const numbered = comparison.footnotes.numbered || {};
    const parts = [];
    for (const character of marker) if (symbols[character]) parts.push(symbols[character]);
    for (const digits of marker.match(/\d+/g) || []) if (numbered[digits]) parts.push(numbered[digits]);
    return parts.join(" ");
  }

  function renderCaveats() {
    const host = $("#defense-caveats");
    const title = document.createElement("h3");
    title.textContent = copy.caveatsTitle;
    const grid = document.createElement("div");
    grid.className = "defense-caveat-grid";
    for (const [heading, body] of [
      [copy.caveat1Title, copy.exchangeNote], [copy.caveat2Title, copy.caveat2],
      [copy.caveat3Title, copy.caveat3], [copy.caveat4Title, copy.caveat4],
    ]) {
      const article = document.createElement("article");
      const label_ = document.createElement("strong"); label_.textContent = heading;
      const text = document.createElement("p"); text.textContent = body;
      article.append(label_, text);
      grid.append(article);
    }
    host.replaceChildren(title, grid);
  }

  function selectCountry(code, updateUrl = false) {
    if (!byCode(code)) return;
    state.code = code;
    state.search = "";
    $("#defense-line-search").value = "";
    const select = $("#deep-dive-country");
    if (select && select.value !== code) { select.value = code; select.dispatchEvent(new Event("change", {bubbles:true})); }
    else renderCountry();
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set("code", code);
      url.searchParams.set("lang", lang);
      history.replaceState({}, "", url);
    }
  }

  function syncSelector() {
    const select = $("#deep-dive-country");
    if (![...select.options].some(option => option.value === state.code)) return;
    select.value = state.code;
    $("#deep-dive-country-code").textContent = state.code;
    $("#deep-dive-country-name").textContent = name(byCode(state.code));
    $("#deep-dive-country-profile").href = window.PSDCountryRoutes.href(state.code, lang);
  }

  Promise.all([
    fetch("../../data/defense-comparison.v1.json?v=20260918-blocks").then(response => response.json()),
    fetch("../../data/defense-deep-dive.v1.json").then(response => response.json()),
  ]).then(([comparisonPayload, detailPayload]) => {
    comparison = comparisonPayload;
    detail = detailPayload;
    state.year = comparison.years.at(-1);
    const requested = new URLSearchParams(location.search).get("code")?.toUpperCase();
    state.code = byCode(requested) ? requested : "USA";

    const yearInput = $("#blocks-year");
    yearInput.min = String(comparison.years[0]);
    yearInput.max = String(comparison.years.at(-1));
    yearInput.value = String(state.year);
    $("#blocks-year-value").textContent = String(state.year);
    yearInput.addEventListener("input", () => setYear(Number(yearInput.value)));
    $("#blocks-play").addEventListener("click", togglePlay);
    $("#blocks-include-us").addEventListener("change", event => { state.includeUS = event.target.checked; renderBlocks(); });
    const pickMeasure = measure => {
      state.measure = measure;
      renderModes($("#ranking-modes"), MEASURES, measure, pickMeasure);
      renderRanking();
    };
    const pickTrajectory = measure => {
      state.trajectory = measure;
      renderModes($("#trajectory-modes"), TRAJECTORY_MEASURES, measure, pickTrajectory);
      renderTrajectory();
    };
    renderModes($("#ranking-modes"), MEASURES, state.measure, pickMeasure);
    renderModes($("#trajectory-modes"), TRAJECTORY_MEASURES, state.trajectory, pickTrajectory);

    const select = $("#deep-dive-country");
    syncSelector();
    select.dispatchEvent(new Event("change", {bubbles:true}));
    select.addEventListener("change", () => { state.code = select.value; syncSelector(); renderCountry(); });
    $("#defense-line-search").addEventListener("input", event => { state.search = event.target.value; renderLines(byCode(state.code)); });
    $("#comparison-source").href = comparison.source.url;
    $("#comparison-source").textContent = `${comparison.source.provider} ↗`;
    $("#nato-source").href = comparison.commitments.source_url;

    renderYearStrip();
    renderCaveats();
    renderBlocks();
    renderUsShare();
    renderCountry();
    let width = innerWidth;
    addEventListener("resize", () => { if (Math.abs(innerWidth - width) < 60) return; width = innerWidth; renderBlocks(); });
  }).catch(error => {
    console.error("defense deep dive", error);
    $("main").insertAdjacentHTML("afterbegin", `<p class="defense-load-error">${esc(copy.loadError)}</p>`);
  });
})();
