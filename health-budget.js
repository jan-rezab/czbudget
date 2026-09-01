(() => {
  const T = {
    cs: {
      navHealth:"Zdravotnictví",navHealthFlow:"Tok peněz",navHospitals:"Nemocnice",navHospitalBench:"Benchmark 2024",
      flowKicker:"06 / Zdravotnictví",flowTitle:"Tok peněz<br>ve zdravotnictví",flowIntro:"Zdravotnictví není jediná rozpočtová kapitola. Pojistné, státní platby, úhrady pojišťoven a hospodaření nemocnic jsou propojené, ale každý celek má jiný rozsah i účetní rok.",
      scopeLead:"Pozor na rozsah:",scopeCopy:"pojišťovny spravují veřejné zdravotní pojištění. Nemocnice mají různé zřizovatele a právní formy; nejsou jednou veřejnou institucí.",
      modeSystem:"Celý systém · 2023",modeInsurers:"Pojišťovny · 2024",modeSector:"Nemocnice · 2022",flowIn:"Zdroje / výnosy",flowOut:"Příjemci / náklady",bnPerYear:"mld. Kč za rok",
      benchKicker:"07 / Benchmark nemocnic",benchTitle:"Nemocnice ve srovnání<br>s podobnými zařízeními",benchIntro:"Vyberte veřejně ovládanou nemocnici s dostupným výkazem za rok 2024. Výsledek porovnáváme s podobně velkými organizacemi nebo se stejnou úrovní zřizovatele.",
      registeredHospitals:"Evidované nemocniční subjekty",publicControl:"veřejná kontrola",comparableHospitals:"Srovnatelné výkazy 2024",positiveStatements:"kladné výnosy a náklady",medianRevenue:"Medián výnosů",comparableSample:"srovnatelný vzorek",medianMargin:"Medián marže",resultOverRevenue:"výsledek / výnosy",coverageNote:"Srovnatelný vzorek tvoří 97 příspěvkových organizací s dostupným individuálním výkazem VZZ. Akciové společnosti bez srovnatelného otevřeného výkazu v benchmarku nejsou; chybějící data nejsou nula.",
      selectHospital:"Vybraná nemocnice",peerGroup:"Srovnávací skupina",peerSize:"Podobná velikost",peerOwner:"Stejný zřizovatel",peerAll:"Všech 97 výkazů",hundredTitle:"Ze 100 Kč výnosů",costCzk:"Kč nákladů",
      benchCaveatLead:"Co benchmark neříká:",benchCaveat:"vyšší marže sama o sobě neznamená lepší péči. Mix pacientů, centrová léčiva, investiční dotace i role fakultní nemocnice zásadně mění ekonomiku. Srovnání je finanční orientace, ne žebříček kvality.",
      systemLabel:"Výdaje na zdravotní péči",insurerLabel:"Veřejné zdravotní pojištění",sectorLabel:"Nemocniční sektor",balanced:"vyrovnáno",surplus:"přebytek",missing:"chybí",
      totalSystem:"Celkové výdaje",hospitalShare:"Podíl nemocnic",publicShare:"Veřejné financování",householdShare:"Platby domácností",
      insurerCount:"Pojišťoven",insured:"Pojištěnců",careShare:"Výdaje na služby",reserves:"Rezervy fondů",
      providerCount:"Sledovaných nemocnic",insurerRevenueShare:"Výnosy od pojišťoven",staffShare:"Osobní náklady",sectorResult:"Výsledek / náklady",
      sources:"Primární zdroje",flowEditable:"Podtržené částky lze přepsat. Součty a saldo se přepočítají okamžitě.",
      revenue:"Výnosy",costs:"Náklady",result:"Výsledek",margin:"Marže",peerMedian:"Medián skupiny",percentile:"percentil",lower:"nižší",higher:"vyšší",
      peerHospitals:"srovnatelných nemocnic",sameSize:"stejný velikostní kvartil",sameOwner:"stejná úroveň zřizovatele",allSample:"celý srovnatelný vzorek",
      perHundredPositive:"Po nákladech zbývá {value} Kč.",perHundredNegative:"Náklady převyšují výnosy o {value} Kč.",ico:"IČO",loadError:"Data zdravotnického benchmarku se nepodařilo načíst.",
      state:"Stát",region:"Kraj",municipality:"Obec",central:"Stát / ústřední úroveň",territorial:"Územní veřejná úroveň",contributory:"Příspěvková organizace"
    },
    en: {
      navHealth:"Healthcare",navHealthFlow:"Money flow",navHospitals:"Hospitals",navHospitalBench:"2024 benchmark",
      flowKicker:"06 / Healthcare",flowTitle:"Money flow<br>in the health system",flowIntro:"Healthcare is not a single budget chapter. Premiums, state payments, insurer reimbursements and hospital accounts are connected, but each layer has a different scope and reporting year.",
      scopeLead:"Mind the scope:",scopeCopy:"health insurers administer public health insurance. Hospitals have different founders and legal forms; they are not one public institution.",
      modeSystem:"Whole system · 2023",modeInsurers:"Insurers · 2024",modeSector:"Hospitals · 2022",flowIn:"Sources / revenue",flowOut:"Recipients / costs",bnPerYear:"CZK bn per year",
      benchKicker:"07 / Hospital benchmark",benchTitle:"Hospitals compared<br>with similar peers",benchIntro:"Select a publicly controlled hospital with an available 2024 statement. Compare it with organisations of a similar size or with the same level of public owner.",
      registeredHospitals:"Registered hospital entities",publicControl:"public control",comparableHospitals:"Comparable 2024 statements",positiveStatements:"positive revenue and costs",medianRevenue:"Median revenue",comparableSample:"comparable sample",medianMargin:"Median margin",resultOverRevenue:"result / revenue",coverageNote:"The comparable sample contains 97 contributory organisations with an available individual VZZ statement. Joint-stock companies without a comparable open statement are not benchmarked; missing data is not zero.",
      selectHospital:"Selected hospital",peerGroup:"Peer group",peerSize:"Similar size",peerOwner:"Same public owner",peerAll:"All 97 statements",hundredTitle:"Out of CZK 100 revenue",costCzk:"CZK of costs",
      benchCaveatLead:"What this benchmark does not say:",benchCaveat:"a higher margin does not by itself mean better care. Patient mix, specialised medicines, capital grants and a teaching-hospital role materially change the economics. This is financial orientation, not a quality ranking.",
      systemLabel:"Healthcare expenditure",insurerLabel:"Public health insurance",sectorLabel:"Hospital sector",balanced:"balanced",surplus:"surplus",missing:"shortfall",
      totalSystem:"Total expenditure",hospitalShare:"Hospital share",publicShare:"Public funding",householdShare:"Household payments",
      insurerCount:"Insurers",insured:"People insured",careShare:"Spent on services",reserves:"Fund reserves",
      providerCount:"Hospitals covered",insurerRevenueShare:"Revenue from insurers",staffShare:"Personnel costs",sectorResult:"Result / costs",
      sources:"Primary sources",flowEditable:"Edit any underlined amount. Totals and the balance update instantly.",
      revenue:"Revenue",costs:"Costs",result:"Result",margin:"Margin",peerMedian:"Peer median",percentile:"percentile",lower:"lower",higher:"higher",
      peerHospitals:"peer hospitals",sameSize:"same revenue quartile",sameOwner:"same level of public owner",allSample:"full comparable sample",
      perHundredPositive:"CZK {value} remains after costs.",perHundredNegative:"Costs exceed revenue by CZK {value}.",ico:"Company ID",loadError:"The healthcare benchmark data could not be loaded.",
      state:"State",region:"Region",municipality:"Municipality",central:"State / central level",territorial:"Territorial public level",contributory:"Contributory organisation"
    }
  };

  const colors = ["#47735c","#315ba6","#7f8f2e","#d2674d","#855d9b","#b59f32","#2a7d83"];
  let data;
  let lang = document.documentElement.lang === "en" ? "en" : "cs";
  let flowMode = "system";
  let flowState = {};

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const tr = (key) => T[lang][key] ?? key;
  const number = (value, digits = 1) => new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const bn = (value) => lang === "cs" ? `${number(value,1)} mld. Kč` : `CZK ${number(value,1)}bn`;
  const million = (value) => lang === "cs" ? `${number(value,1)} mil. Kč` : `CZK ${number(value,1)}m`;
  const pct = (value) => `${number(value,1)} %`;
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  const median = (values) => {
    const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
  };
  const percentile = (values, selected) => {
    const finite = values.filter(Number.isFinite).sort((a,b) => a-b);
    return finite.length ? Math.round(100 * finite.filter(value => value <= selected).length / finite.length) : 50;
  };
  const ownerLabel = (owner) => ({"Stát":tr("state"),"Kraj":tr("region"),"Obec":tr("municipality"),"Stát / ústřední úroveň":tr("central"),"Územní veřejná úroveň":tr("territorial")})[owner] || owner;
  const legalLabel = (legal) => legal === "Příspěvková organizace" ? tr("contributory") : legal;

  function applyStaticLanguage() {
    document.querySelectorAll("[data-health-key]").forEach((element) => {
      const value = tr(element.dataset.healthKey);
      if (value.includes("<br>")) element.innerHTML = value; else element.textContent = value;
    });
  }

  function modeData(mode) {
    if (mode === "system") return { input:data.system_2023.sources, output:data.system_2023.destinations, label:tr("systemLabel") };
    if (mode === "insurers") return { input:data.insurers_2024.revenues, output:data.insurers_2024.expenses, label:tr("insurerLabel") };
    return { input:data.hospital_sector_2022.revenues, output:data.hospital_sector_2022.expenses, label:tr("sectorLabel") };
  }

  function ensureFlowState(mode) {
    if (flowState[mode]) return;
    const current = modeData(mode);
    flowState[mode] = { input:current.input.map(item => item.value_bn), output:current.output.map(item => item.value_bn) };
  }

  function flowRows(items, side) {
    const values = flowState[flowMode][side];
    const max = Math.max(...values, 1);
    return items.map((item,index) => `<div class="health-flow-row" style="--flow-color:${colors[index % colors.length]};--flow-share:${Math.max(1.5,values[index]/max*100).toFixed(1)}%"><label for="health-${flowMode}-${side}-${index}">${esc(item[lang])}</label><span class="health-flow-value"><input id="health-${flowMode}-${side}-${index}" type="number" min="0" step="0.1" value="${values[index].toFixed(3)}" data-side="${side}" data-index="${index}" aria-label="${esc(item[lang])}"><small>${lang === "cs" ? "mld." : "bn"}</small></span></div>`).join("");
  }

  function flowFacts() {
    if (flowMode === "system") {
      const total = data.system_2023.total_bn;
      const publicValue = sum(data.system_2023.sources.slice(0,3).map(item => item.value_bn));
      return [[tr("totalSystem"),bn(total),"2023"],[tr("hospitalShare"),pct(100*288.19/total),"2023"],[tr("publicShare"),pct(100*publicValue/total),"2023"],[tr("householdShare"),pct(100*93.711/total),"2023"]];
    }
    if (flowMode === "insurers") return [[tr("insurerCount"),String(data.insurers_2024.insurer_count),"2024"],[tr("insured"),`${number(data.insurers_2024.insured_people/1e6,2)} mil.`,"2024"],[tr("careShare"),pct(97.5),"2024"],[tr("reserves"),bn(data.insurers_2024.reserves_bn),"2024"]];
    return [[tr("providerCount"),String(data.hospital_sector_2022.provider_count),"2022"],[tr("insurerRevenueShare"),pct(85.2),"2022"],[tr("staffShare"),pct(50.0),"2022"],[tr("sectorResult"),pct(2.9),"2022"]];
  }

  function updateFlowTotals() {
    const inputTotal = sum(flowState[flowMode].input), outputTotal = sum(flowState[flowMode].output), difference = inputTotal-outputTotal;
    $("#health-in-total").textContent = bn(inputTotal);
    $("#health-out-total").textContent = bn(outputTotal);
    $("#health-center-total").textContent = number(outputTotal,1);
    const balance = $("#health-center-balance");
    balance.className = difference < -.05 ? "negative" : difference > .05 ? "positive" : "";
    balance.textContent = Math.abs(difference) <= .05 ? tr("balanced") : `${difference > 0 ? tr("surplus") : tr("missing")} ${difference > 0 ? "+" : "−"}${number(Math.abs(difference),1)} mld.`;
    ["input","output"].forEach(side => {
      const values = flowState[flowMode][side], max = Math.max(...values,1);
      document.querySelectorAll(`#health-flow-${side === "input" ? "in" : "out"} .health-flow-row`).forEach((row,index) => row.style.setProperty("--flow-share",`${Math.max(1.5,values[index]/max*100).toFixed(1)}%`));
    });
  }

  function renderFlow() {
    ensureFlowState(flowMode);
    const current = modeData(flowMode);
    $("#health-flow-in").innerHTML = flowRows(current.input,"input");
    $("#health-flow-out").innerHTML = flowRows(current.output,"output");
    $("#health-center-label").textContent = current.label;
    $("#health-flow-facts").innerHTML = flowFacts().map(item => `<article><span>${esc(item[0])}</span><strong>${esc(item[1])}</strong><small>${esc(item[2])}</small></article>`).join("");
    $("#health-flow-sources").innerHTML = `<span class="sr-only">${tr("sources")}</span>${data.sources.slice(0,3).map(source => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("")}<span class="health-editable-note">${tr("flowEditable")}</span>`;
    document.querySelectorAll(".health-flow-row input").forEach(input => input.addEventListener("input", () => {
      flowState[flowMode][input.dataset.side][Number(input.dataset.index)] = Math.max(0, Number(input.value) || 0);
      updateFlowTotals();
    }));
    updateFlowTotals();
  }

  function benchmarkPeers(selected, mode) {
    const hospitals = data.hospital_benchmark_2024.hospitals;
    if (mode === "all") return hospitals;
    if (mode === "owner") return hospitals.filter(hospital => hospital.owner_level === selected.owner_level);
    const ordered = [...hospitals].sort((a,b) => a.revenue_mczk-b.revenue_mczk);
    const index = ordered.findIndex(hospital => hospital.ico === selected.ico);
    const quartile = Math.min(3, Math.floor(index / Math.ceil(ordered.length/4)));
    const start = quartile * Math.ceil(ordered.length/4), end = Math.min(ordered.length,(quartile+1)*Math.ceil(ordered.length/4));
    return ordered.slice(start,end);
  }

  function peerBar(label, value, peerValues, formatter) {
    const position = Math.min(98,Math.max(2,percentile(peerValues,value))), peerMedian = median(peerValues);
    return `<div class="peer-row"><div><span>${label}</span><strong>${formatter(value)}</strong></div><div class="peer-track"><i style="left:${position}%"></i></div><small><span>${tr("lower")}</span><b>${tr("peerMedian")}: ${formatter(peerMedian)}</b><span>${tr("higher")}</span></small></div>`;
  }

  function renderBenchmark() {
    const benchmark = data.hospital_benchmark_2024;
    const select = $("#hospital-select");
    if (!select.options.length) {
      select.innerHTML = benchmark.hospitals.map(hospital => `<option value="${esc(hospital.ico)}">${esc(hospital.name)}</option>`).join("");
      const motol = benchmark.hospitals.find(hospital => hospital.ico === "00064203");
      if (motol) select.value = motol.ico;
    }
    $("#hospital-registered").textContent = number(benchmark.registered_count,0);
    $("#hospital-comparable").textContent = number(benchmark.comparable_count,0);
    $("#hospital-median-revenue").textContent = bn(benchmark.medians.revenue_mczk/1000);
    $("#hospital-median-margin").textContent = pct(benchmark.medians.margin_pct);
    const selected = benchmark.hospitals.find(hospital => hospital.ico === select.value) || benchmark.hospitals[0];
    if (select.value !== selected.ico) select.value = selected.ico;
    const peerMode = $("#hospital-peer-mode").value;
    const peers = benchmarkPeers(selected,peerMode);
    const peerLabel = peerMode === "size" ? tr("sameSize") : peerMode === "owner" ? tr("sameOwner") : tr("allSample");
    $("#hospital-meta").textContent = `${ownerLabel(selected.owner_level)} · ${legalLabel(selected.legal_form)} · ${tr("ico")} ${selected.ico}`;
    $("#hospital-name").textContent = selected.name;
    $("#hospital-peer-count").textContent = `${peers.length} ${tr("peerHospitals")} · ${peerLabel}`;
    const resultClass = selected.result_mczk < 0 ? "negative" : "positive";
    $("#hospital-kpis").innerHTML = [
      [tr("revenue"),bn(selected.revenue_mczk/1000),`${tr("percentile")} ${percentile(peers.map(h=>h.revenue_mczk),selected.revenue_mczk)}`,""],
      [tr("costs"),bn(selected.cost_mczk/1000),`${tr("percentile")} ${percentile(peers.map(h=>h.cost_mczk),selected.cost_mczk)}`,""],
      [tr("result"),million(selected.result_mczk),`${tr("peerMedian")}: ${million(median(peers.map(h=>h.result_mczk)))}`,resultClass],
      [tr("margin"),pct(selected.margin_pct),`${tr("peerMedian")}: ${pct(median(peers.map(h=>h.margin_pct)))}`,resultClass]
    ].map(item => `<article><span>${esc(item[0])}</span><strong class="${item[3]}">${esc(item[1])}</strong><small>${esc(item[2])}</small></article>`).join("");
    const costPerHundred = selected.cost_mczk/selected.revenue_mczk*100;
    const remainder = Math.abs(100-costPerHundred);
    $("#hospital-cost-per-100").textContent = number(costPerHundred,1);
    $("#hospital-hundred-ring").style.setProperty("--cost-angle",`${Math.min(100,costPerHundred)*3.6}deg`);
    $("#hospital-hundred-note").textContent = tr(costPerHundred <= 100 ? "perHundredPositive" : "perHundredNegative").replace("{value}",number(remainder,1));
    $("#hospital-peer-bars").innerHTML = `<div class="peer-heading"><span>${tr("peerGroup")}</span><small>${esc(peerLabel)} · n = ${peers.length}</small></div>${peerBar(tr("revenue"),selected.revenue_mczk,peers.map(h=>h.revenue_mczk),value=>bn(value/1000))}${peerBar(tr("result"),selected.result_mczk,peers.map(h=>h.result_mczk),million)}${peerBar(tr("margin"),selected.margin_pct,peers.map(h=>h.margin_pct),pct)}`;
    $("#hospital-benchmark-sources").innerHTML = data.sources.slice(2).map(source => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("");
  }

  function renderAll() {
    applyStaticLanguage();
    renderFlow();
    renderBenchmark();
  }

  document.querySelectorAll("#health-flow-mode button").forEach(button => button.addEventListener("click", () => {
    flowMode = button.dataset.mode;
    document.querySelectorAll("#health-flow-mode button").forEach(item => item.setAttribute("aria-selected",String(item === button)));
    renderFlow();
  }));
  $("#hospital-select")?.addEventListener("change",renderBenchmark);
  $("#hospital-peer-mode")?.addEventListener("change",renderBenchmark);
  addEventListener("budgetlanguagechange", (event) => {
    lang = event.detail?.lang === "en" ? "en" : "cs";
    renderAll();
  });

  fetch("data/cz-health-budget.v1.json")
    .then(response => { if (!response.ok) throw new Error(response.status); return response.json(); })
    .then(payload => { data = payload; renderAll(); })
    .catch(() => {
      ["#health-flow-board","#hospital-profile"].forEach(selector => { const target=$(selector); if(target) target.innerHTML=`<div class="health-load-error">${tr("loadError")}</div>`; });
    });
})();
