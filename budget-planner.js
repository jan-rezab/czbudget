export function flattenBudget(data) {
  return data.groups.flatMap((group) => group.items.map((item) => ({ ...item, group_id: group.id, group_label_cs: group.label_cs, group_label_en: group.label_en })));
}

export function calculateScenario(data, adjustments = new Map(), revenueAdjustment = 0) {
  const adjustmentOf = (id) => adjustments instanceof Map ? Number(adjustments.get(id) || 0) : Number(adjustments[id] || 0);
  const items = flattenBudget(data).map((item) => {
    const requested = adjustmentOf(item.id);
    const adjustment = Math.max(-item.amount_2027, Number.isFinite(requested) ? requested : 0);
    return { ...item, adjustment, scenario: item.amount_2027 + adjustment };
  });
  const expenditure = items.reduce((sum, item) => sum + item.scenario, 0);
  const revenue = data.headline.revenue_2027 + (Number.isFinite(Number(revenueAdjustment)) ? Number(revenueAdjustment) : 0);
  const deficit = expenditure - revenue;
  return {
    items,
    revenue,
    expenditure,
    deficit,
    balance: revenue - expenditure,
    spendingAdjustment: expenditure - data.headline.expenditure_2027,
    revenueAdjustment: revenue - data.headline.revenue_2027,
    deficitAdjustment: deficit - data.headline.deficit_2027,
  };
}

export function encodeScenario(adjustments = new Map()) {
  return [...adjustments.entries()]
    .filter(([, value]) => Number.isFinite(Number(value)) && Math.abs(Number(value)) >= 0.0005)
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([id, value]) => `${encodeURIComponent(id)}:${Number(value).toFixed(3).replace(/\.?0+$/, "")}`)
    .join(",");
}

export function decodeScenario(value) {
  const result = new Map();
  String(value || "").split(",").forEach((entry) => {
    const [rawId, rawValue] = entry.split(":");
    const amount = Number(rawValue);
    if (!rawId || !Number.isFinite(amount) || Math.abs(amount) < 0.0005) return;
    result.set(decodeURIComponent(rawId), amount);
  });
  return result;
}

export function binaryTreemap(items, rectangle) {
  const output = [];
  const place = (nodes, rect) => {
    if (!nodes.length || rect.w <= 0 || rect.h <= 0) return;
    if (nodes.length === 1) { output.push({ ...nodes[0], rect }); return; }
    const total = nodes.reduce((sum, item) => sum + Math.max(item.weight, 0.0001), 0);
    let split = 1;
    let running = Math.max(nodes[0].weight, 0.0001);
    let best = Math.abs(total / 2 - running);
    for (let index = 2; index < nodes.length; index += 1) {
      running += Math.max(nodes[index - 1].weight, 0.0001);
      const distance = Math.abs(total / 2 - running);
      if (distance < best) { best = distance; split = index; }
    }
    const first = nodes.slice(0, split);
    const second = nodes.slice(split);
    const firstWeight = first.reduce((sum, item) => sum + Math.max(item.weight, 0.0001), 0);
    const ratio = firstWeight / total;
    if (rect.w >= rect.h) {
      const firstWidth = rect.w * ratio;
      place(first, { x: rect.x, y: rect.y, w: firstWidth, h: rect.h });
      place(second, { x: rect.x + firstWidth, y: rect.y, w: rect.w - firstWidth, h: rect.h });
    } else {
      const firstHeight = rect.h * ratio;
      place(first, { x: rect.x, y: rect.y, w: rect.w, h: firstHeight });
      place(second, { x: rect.x, y: rect.y + firstHeight, w: rect.w, h: rect.h - firstHeight });
    }
  };
  place([...items].sort((a, b) => b.weight - a.weight), rectangle);
  return output;
}

if (typeof document !== "undefined" && document.querySelector(".budget-planner-page")) {
  const lang = document.documentElement.lang === "en" ? "en" : "cs";
  const params = new URLSearchParams(location.search);
  const copy = {
    cs: {
      eyebrow:"Report / Plánovač rozpočtu",titleLead:"Rozpočet není tabulka.",titleEm:"Je to rozhodnutí.",intro:"Projděte návrh státního rozpočtu na rok 2027, změňte jednotlivé oblasti a sledujte, co vaše volby udělají s celkovými výdaji a schodkem.",stageLabel:"Stav dokumentu",stageValue:"Návrh MF",published:"Publikováno",release:"Verze",stageWarning:"Není to schválený rozpočet. Vláda a Poslanecká sněmovna mohou částky změnit.",
      snapshotNav:"Bilance",mapNav:"Kam peníze jdou",plannerNav:"Plánovač",impactNav:"Dopad",methodNav:"Metodika",snapshotKicker:"Oficiální návrh",snapshotTitle:"Výchozí bilance",snapshotIntro:"Příjmy a výdaje jsou hotovostní státní rozpočet. Schodek je jejich rozdíl; nejde o saldo celého sektoru vládních institucí.",proposal:"Návrh 2027",proposalNote:"Ministerstvo financí · zveřejněno 31. 8. 2026",futureStages:"Další fáze",futureNote:"Vláda · Poslanecká sněmovna · schválený zákon",revenue:"Příjmy",expenditure:"Výdaje",deficit:"Schodek",
      mapKicker:"Odvětvové třídění",mapTitle:"Kam rozpočet míří",mapIntro:"Plocha dlaždice odpovídá částce. Barva ukazuje změnu proti schválenému rozpočtu 2026. Vyberte oblast a upravte ji v plánovači.",mapContext:"Výdaje podle funkce",lower:"Nižší",flat:"Beze změny",higher:"Vyšší",proposal2027:"Návrh 2027",share:"Podíl výdajů",yearChange:"Změna 2027/26",editSelection:"Upravit tuto oblast ↓",
      plannerKicker:"Váš scénář",plannerTitle:"Změňte jednu věc. Uvidíte všechno.",plannerIntro:"Každá úprava se zapisuje pouze do jedné funkční oblasti. Souhrny se přepočítávají automaticky, takže stejná koruna nemůže být započtena dvakrát.",adjustment:"Úprava proti návrhu",exactAdjustment:"Přesná úprava v mld. Kč",billions:"mld. Kč",match2026:"Nastavit na úroveň 2026",clearItem:"Zrušit úpravu",liveIdentity:"Živá rozpočtová identita",scenarioResult:"Výsledek scénáře",revenueAssumption:"Úprava příjmového předpokladu",exactRevenue:"Přesná úprava příjmů",
      impactKicker:"Co se změnilo",impactTitle:"Váš rozpočet vedle návrhu",impactIntro:"Černá značka ukazuje návrh ministerstva. Barevný pruh je váš scénář. Seznam pod grafem drží přesnou stopu všech zásahů.",changeLog:"Provedené změny",resetAll:"Obnovit návrh MF",copyScenario:"Kopírovat odkaz na scénář",downloadCsv:"Stáhnout CSV",showTable:"Zobrazit úplnou tabulku scénáře",function:"Funkce",yourScenario:"Váš scénář",difference:"Rozdíl",
      methodKicker:"Jak plánovač počítá",methodTitle:"Jedna klasifikace. Žádné dvojí započtení.",methodIntro:"Plánovač mění oddíly odvětvového třídění státního rozpočtu. Kapitoly ministerstev a ekonomické druhy výdajů jsou jiné řezy stejných peněz, proto je v této verzi neupravujeme současně.",methodStageTitle:"Fáze rozpočtu",methodStageCopy:"Výchozím bodem je návrh Ministerstva financí z 31. srpna 2026, nikoli schválený zákon.",methodIdentityTitle:"Rozpočtová identita",methodIdentityCopy:"Příjmy minus výdaje se vždy rovnají saldu. Vyšší výdaj bez nového příjmu automaticky zvyšuje schodek.",methodScopeTitle:"Fiskální rozsah",methodScopeCopy:"Jde o hotovostní státní rozpočet. Poměr salda sektoru vládních institucí k HDP proto neodvozujeme prostým dělením.",source:"Zdroj",retrieved:"staženo 1. 9. 2026",
      compared2026:"oproti schválenému rozpočtu 2026",editedAreas:"upravených oblastí",openPlanner:"Otevřít v plánovači",scenario:"Scénář",official:"Návrh MF",scenarioVsProposal:"proti návrhu MF",deficitBetter:"schodek je nižší",deficitWorse:"schodek je vyšší",unchanged:"beze změny",identity:"Příjmy − výdaje = saldo",baselineDeficit:"Návrh MF",spendingChoices:"Výdajové změny",revenueChoice:"Příjmová změna",yourResult:"Váš výsledek",noChanges:"Scénář zatím odpovídá návrhu MF. Vyberte dlaždici a změňte částku.",remove:"Odstranit",linkCopied:"Odkaz na scénář byl zkopírován.",copyFailed:"Odkaz se nepodařilo zkopírovat. Zkopírujte adresu z prohlížeče.",csvName:"rozpocet-2027-scenar.csv",setTo:"Ve vašem scénáři",newArea:"nová položka",surplus:"Přebytek",total:"Celkem"
    },
    en: {
      eyebrow:"Report / Budget planner",titleLead:"A budget is not a table.",titleEm:"It is a decision.",intro:"Explore the proposed 2027 Czech state budget, change individual functions and see what your choices do to total spending and the deficit.",stageLabel:"Document stage",stageValue:"MF proposal",published:"Published",release:"Release",stageWarning:"This is not an enacted budget. The government and Chamber of Deputies may change the amounts.",
      snapshotNav:"Balance",mapNav:"Where it goes",plannerNav:"Planner",impactNav:"Impact",methodNav:"Method",snapshotKicker:"Official proposal",snapshotTitle:"Starting balance",snapshotIntro:"Revenue and expenditure are the cash-basis state budget. The deficit is their difference; it is not the balance of the full general-government sector.",proposal:"2027 proposal",proposalNote:"Ministry of Finance · published 31 August 2026",futureStages:"Later stages",futureNote:"Government · Chamber of Deputies · enacted budget",revenue:"Revenue",expenditure:"Expenditure",deficit:"Deficit",
      mapKicker:"Functional classification",mapTitle:"Where the budget goes",mapIntro:"Tile area represents the amount. Color shows the change from the approved 2026 budget. Select a function and adjust it in the planner.",mapContext:"Expenditure by function",lower:"Lower",flat:"About flat",higher:"Higher",proposal2027:"2027 proposal",share:"Share of expenditure",yearChange:"Change 2027/26",editSelection:"Edit this function ↓",
      plannerKicker:"Your scenario",plannerTitle:"Change one thing. See everything.",plannerIntro:"Every edit is written to exactly one functional category. Totals recalculate automatically, so the same money cannot be counted twice.",adjustment:"Adjustment from proposal",exactAdjustment:"Exact adjustment in CZK bn",billions:"CZK bn",match2026:"Match the 2026 level",clearItem:"Clear adjustment",liveIdentity:"Live budget identity",scenarioResult:"Scenario result",revenueAssumption:"Revenue assumption adjustment",exactRevenue:"Exact revenue adjustment",
      impactKicker:"What changed",impactTitle:"Your budget beside the proposal",impactIntro:"The black marker is the ministry proposal. The colored bar is your scenario. The log below keeps an exact record of every intervention.",changeLog:"Changes made",resetAll:"Restore MF proposal",copyScenario:"Copy scenario link",downloadCsv:"Download CSV",showTable:"Show the complete scenario table",function:"Function",yourScenario:"Your scenario",difference:"Difference",
      methodKicker:"How the planner calculates",methodTitle:"One classification. No double counting.",methodIntro:"The planner changes divisions in the state budget's functional classification. Ministry chapters and economic types are different views of the same money, so this version does not edit them simultaneously.",methodStageTitle:"Budget stage",methodStageCopy:"The starting point is the Ministry of Finance proposal published on 31 August 2026, not an enacted budget.",methodIdentityTitle:"Budget identity",methodIdentityCopy:"Revenue minus expenditure always equals the balance. Higher expenditure without new revenue automatically increases the deficit.",methodScopeTitle:"Fiscal scope",methodScopeCopy:"This is the cash-basis state budget. We therefore do not derive a general-government balance-to-GDP ratio by simple division.",source:"Source",retrieved:"retrieved 1 September 2026",
      compared2026:"from the approved 2026 budget",editedAreas:"edited functions",openPlanner:"Open in planner",scenario:"Scenario",official:"MF proposal",scenarioVsProposal:"from the MF proposal",deficitBetter:"the deficit is lower",deficitWorse:"the deficit is higher",unchanged:"unchanged",identity:"Revenue − expenditure = balance",baselineDeficit:"MF proposal",spendingChoices:"Spending choices",revenueChoice:"Revenue assumption",yourResult:"Your result",noChanges:"The scenario still matches the MF proposal. Select a tile and change its amount.",remove:"Remove",linkCopied:"The scenario link has been copied.",copyFailed:"The link could not be copied. Copy the address from your browser.",csvName:"czech-budget-2027-scenario.csv",setTo:"Your scenario sets",newArea:"new item",surplus:"Surplus",total:"Total"
    }
  }[lang];

  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[character]));
  const locale = lang === "cs" ? "cs-CZ" : "en-GB";
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits:1, maximumFractionDigits:1 });
  const percent = new Intl.NumberFormat(locale, { style:"percent", maximumFractionDigits:1, signDisplay:"exceptZero" });
  const money = (value) => lang === "cs" ? `${number.format(value)} mld. Kč` : `CZK ${number.format(value)}bn`;
  const signedMoney = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value))}`;
  const pct = (value) => Number.isFinite(value) ? percent.format(value) : "—";
  const label = (item) => item[lang === "cs" ? "label_cs" : "label_en"];

  document.querySelectorAll("[data-budget-copy]").forEach((node) => {
    const value = copy[node.dataset.budgetCopy];
    if (value) node.textContent = value;
  });
  window.psdLanguageReady?.();

  const state = {
    data: null,
    selectedId: params.get("item") || "41",
    adjustments: decodeScenario(params.get("plan")),
    revenueAdjustment: Number(params.get("rev")) || 0,
  };

  function itemById(id = state.selectedId) {
    return flattenBudget(state.data).find((item) => item.id === id) || flattenBudget(state.data)[0];
  }

  function updateURL() {
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    url.searchParams.set("item", state.selectedId);
    const encoded = encodeScenario(state.adjustments);
    encoded ? url.searchParams.set("plan", encoded) : url.searchParams.delete("plan");
    Math.abs(state.revenueAdjustment) >= 0.0005 ? url.searchParams.set("rev", Number(state.revenueAdjustment).toFixed(3).replace(/\.?0+$/, "")) : url.searchParams.delete("rev");
    history.replaceState(null, "", url);
  }

  function officialChange(value2027, value2026) {
    return value2026 ? value2027 / value2026 - 1 : null;
  }

  function scenarioAmount(item) {
    return Math.max(0, item.amount_2027 + Number(state.adjustments.get(item.id) || 0));
  }

  function renderOfficial() {
    const h = state.data.headline;
    $("#official-revenue").textContent = money(h.revenue_2027);
    $("#official-expenditure").textContent = money(h.expenditure_2027);
    $("#official-deficit").textContent = money(h.deficit_2027);
    $("#official-revenue-change").textContent = `${pct(h.revenue_2027 / h.revenue_2026 - 1)} ${copy.compared2026}`;
    $("#official-expenditure-change").textContent = `${pct(h.expenditure_2027 / h.expenditure_2026 - 1)} ${copy.compared2026}`;
    $("#official-deficit-change").textContent = `${signedMoney(h.deficit_2027 - h.deficit_2026)} ${copy.compared2026}`;
  }

  function budgetColor(change) {
    if (!Number.isFinite(change) || Math.abs(change) < 0.01) return "rgb(69,73,79)";
    const neutral = [69,73,79];
    const target = change > 0 ? [201,50,55] : [49,95,137];
    const intensity = Math.min(1, Math.abs(change) / 0.30);
    return `rgb(${neutral.map((value, index) => Math.round(value + (target[index] - value) * intensity)).join(",")})`;
  }

  function renderTreemap() {
    const host = $("#budget-treemap");
    const viewport = host.parentElement;
    const width = Math.max(320, Math.round(viewport.clientWidth || 1100));
    const height = width < 430 ? 820 : width < 760 ? 760 : 720;
    host.style.height = `${height}px`;
    const scenario = calculateScenario(state.data, state.adjustments, state.revenueAdjustment);
    const scenarioMap = new Map(scenario.items.map((item) => [item.id, item]));
    const groups = state.data.groups.map((group) => {
      const items = group.items.map((item) => ({ ...scenarioMap.get(item.id), weight: Math.max(scenarioMap.get(item.id).scenario, 0.003) }));
      return { ...group, items, weight: items.reduce((sum, item) => sum + item.weight, 0) };
    });
    const groupTiles = binaryTreemap(groups, { x:0, y:0, w:width, h:height });
    host.innerHTML = groupTiles.map((group) => {
      const { x, y, w, h } = group.rect;
      const header = Math.max(22, Math.min(30, h * 0.12));
      const itemTiles = binaryTreemap(group.items, { x:2, y:header, w:Math.max(0, w - 4), h:Math.max(0, h - header - 2) });
      const tiles = itemTiles.map((item) => {
        const rect = item.rect;
        const change = officialChange(item.scenario, item.amount_2026);
        const compact = rect.w < 104 || rect.h < 74;
        const tiny = rect.w < 58 || rect.h < 45;
        const edited = Math.abs(item.adjustment) >= 0.0005;
        const aria = `${label(item)}. ${copy.scenario}: ${money(item.scenario)}. ${copy.yearChange}: ${pct(change)}.`;
        return `<button type="button" class="budget-treemap-tile${compact ? " compact" : ""}${tiny ? " tiny" : ""}${edited ? " edited" : ""}${item.id === state.selectedId ? " selected" : ""}" data-budget-item="${escapeHTML(item.id)}" style="left:${rect.x.toFixed(2)}px;top:${rect.y.toFixed(2)}px;width:${Math.max(0,rect.w).toFixed(2)}px;height:${Math.max(0,rect.h).toFixed(2)}px;background:${budgetColor(change)}" aria-label="${escapeHTML(aria)}"><b>${escapeHTML(item.id)}</b><span>${escapeHTML(label(item))}</span><strong>${escapeHTML(money(item.scenario))}</strong><small>${escapeHTML(pct(change))} · 2026</small></button>`;
      }).join("");
      return `<section class="budget-treemap-group" style="left:${(x + 1).toFixed(2)}px;top:${(y + 1).toFixed(2)}px;width:${Math.max(0,w - 2).toFixed(2)}px;height:${Math.max(0,h - 2).toFixed(2)}px"><div class="budget-treemap-group-title"><span>${escapeHTML(group[lang === "cs" ? "label_cs" : "label_en"])}</span><b>${escapeHTML(money(group.weight))}</b></div>${tiles}</section>`;
    }).join("");
    $("#budget-map-context").textContent = `${money(scenario.expenditure)} · ${state.adjustments.size} ${copy.editedAreas}`;
    host.querySelectorAll("[data-budget-item]").forEach((button) => {
      const select = () => { state.selectedId = button.dataset.budgetItem; updateURL(); renderTreemap(); renderSelection(); renderEditor(); };
      const show = (event) => showTooltip(event, scenarioMap.get(button.dataset.budgetItem));
      button.addEventListener("click", select);
      button.addEventListener("pointerenter", show);
      button.addEventListener("pointermove", show);
      button.addEventListener("pointerleave", hideTooltip);
      button.addEventListener("focus", show);
      button.addEventListener("blur", hideTooltip);
    });
  }

  function showTooltip(event, item) {
    if (!item) return;
    const tooltip = $("#budget-map-tooltip");
    const shell = tooltip.parentElement;
    const shellRect = shell.getBoundingClientRect();
    const targetRect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || targetRect.left + targetRect.width / 2;
    const y = event.clientY || targetRect.top + targetRect.height / 2;
    const change = officialChange(item.scenario, item.amount_2026);
    tooltip.innerHTML = `<header><b>${escapeHTML(item.id)} · ${escapeHTML(item[lang === "cs" ? "group_label_cs" : "group_label_en"])}</b><span>${escapeHTML(label(item))}</span></header><dl><div><dt>${escapeHTML(copy.proposal2027)}</dt><dd>${escapeHTML(money(item.amount_2027))}</dd></div><div><dt>${escapeHTML(copy.scenario)}</dt><dd>${escapeHTML(money(item.scenario))}</dd></div><div><dt>${escapeHTML(copy.yearChange)}</dt><dd>${escapeHTML(pct(change))}</dd></div></dl><small>${escapeHTML(copy.openPlanner)} →</small>`;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(12, Math.min(shell.clientWidth - 304, x - shellRect.left + 14))}px`;
    tooltip.style.top = `${Math.max(72, Math.min(shell.clientHeight - 188, y - shellRect.top + 14))}px`;
  }

  function hideTooltip() { $("#budget-map-tooltip").hidden = true; }

  function renderSelection() {
    const item = itemById();
    const group = state.data.groups.find((entry) => entry.id === item.group_id);
    const current = scenarioAmount(item);
    $("#selection-group").textContent = `${item.id} · ${group[lang === "cs" ? "label_cs" : "label_en"]}`;
    $("#selection-name").textContent = label(item);
    $("#selection-proposal").textContent = money(item.amount_2027);
    $("#selection-share").textContent = pct(current / calculateScenario(state.data, state.adjustments, state.revenueAdjustment).expenditure);
    $("#selection-change").textContent = pct(officialChange(current, item.amount_2026));
  }

  function commitItemAdjustment(value) {
    const item = itemById();
    const adjustment = Math.max(-item.amount_2027, Number(value) || 0);
    if (Math.abs(adjustment) < 0.0005) state.adjustments.delete(item.id);
    else state.adjustments.set(item.id, adjustment);
    renderAll();
  }

  function renderEditor() {
    const item = itemById();
    state.selectedId = item.id;
    const group = state.data.groups.find((entry) => entry.id === item.group_id);
    const adjustment = Number(state.adjustments.get(item.id) || 0);
    const current = item.amount_2027 + adjustment;
    $("#editor-code").textContent = `§ ${item.id}`;
    $("#editor-group").textContent = group[lang === "cs" ? "label_cs" : "label_en"];
    $("#editor-title").textContent = label(item);
    $("#editor-2026").textContent = money(item.amount_2026);
    $("#editor-2027").textContent = money(item.amount_2027);
    $("#editor-compare-bar").style.width = `${Math.min(100, item.amount_2026 / Math.max(item.amount_2026, item.amount_2027, 0.001) * 100)}%`;
    const range = $("#budget-adjustment");
    range.min = String(-item.amount_2027);
    range.max = String(Math.max(50, item.amount_2027 * 0.5));
    range.value = String(adjustment);
    $("#budget-adjustment-number").min = String(-item.amount_2027);
    $("#budget-adjustment-number").value = adjustment.toFixed(1);
    $("#budget-adjustment-output").textContent = signedMoney(adjustment);
    const versus2026 = officialChange(current, item.amount_2026);
    $("#editor-result").textContent = `${copy.setTo} ${label(item)} ${money(current)} · ${signedMoney(adjustment)} ${copy.scenarioVsProposal} · ${item.amount_2026 ? pct(versus2026) : copy.newArea} 2027/26.`;
  }

  function renderLedger() {
    const scenario = calculateScenario(state.data, state.adjustments, state.revenueAdjustment);
    $("#scenario-revenue").textContent = money(scenario.revenue);
    $("#scenario-expenditure").textContent = money(scenario.expenditure);
    $("#scenario-deficit").previousElementSibling.textContent = scenario.deficit >= 0 ? copy.deficit : copy.surplus;
    $("#scenario-deficit").textContent = scenario.deficit >= 0 ? money(scenario.deficit) : money(Math.abs(scenario.deficit));
    $("#scenario-revenue-delta").textContent = `${signedMoney(scenario.revenueAdjustment)} ${copy.scenarioVsProposal}`;
    $("#scenario-expenditure-delta").textContent = `${signedMoney(scenario.spendingAdjustment)} ${copy.scenarioVsProposal}`;
    const deficitDirection = Math.abs(scenario.deficitAdjustment) < 0.05 ? copy.unchanged : scenario.deficitAdjustment < 0 ? copy.deficitBetter : copy.deficitWorse;
    $("#scenario-deficit-delta").textContent = `${signedMoney(scenario.deficitAdjustment)} · ${deficitDirection}`;
    $("#revenue-adjustment").value = String(Math.max(-200, Math.min(200, state.revenueAdjustment)));
    $("#revenue-adjustment-number").value = state.revenueAdjustment.toFixed(1);
    $("#revenue-adjustment-output").textContent = signedMoney(state.revenueAdjustment);
    $("#budget-identity").textContent = `${copy.identity}: ${money(scenario.revenue)} − ${money(scenario.expenditure)} = ${scenario.balance >= 0 ? "+" : "−"}${money(Math.abs(scenario.balance))}`;
    renderWaterfall(scenario);
  }

  function renderWaterfall(scenario) {
    const host = $("#budget-waterfall");
    const width = Math.max(320, Math.round(host.clientWidth || 620));
    const height = 250;
    const margin = { top:22, right:12, bottom:54, left:48 };
    const plotH = height - margin.top - margin.bottom;
    const base = state.data.headline.deficit_2027;
    const afterSpending = base + scenario.spendingAdjustment;
    const final = scenario.deficit;
    const values = [0, base, afterSpending, final];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(40, (max - min) * 0.12);
    const domainMin = Math.min(0, min - padding);
    const domainMax = Math.max(0, max + padding);
    const y = (value) => margin.top + (domainMax - value) / (domainMax - domainMin || 1) * plotH;
    const xStep = (width - margin.left - margin.right) / 4;
    const barW = Math.min(72, xStep * 0.58);
    const stages = [
      { label:copy.baselineDeficit, start:0, end:base, total:true },
      { label:copy.spendingChoices, start:base, end:afterSpending, total:false },
      { label:copy.revenueChoice, start:afterSpending, end:final, total:false },
      { label:copy.yourResult, start:0, end:final, total:true },
    ];
    const ticks = Array.from({ length:5 }, (_, index) => domainMin + (domainMax - domainMin) * index / 4);
    const grid = ticks.map((value) => `<line class="grid" x1="${margin.left}" x2="${width - margin.right}" y1="${y(value)}" y2="${y(value)}"/><text class="axis-label" x="${margin.left - 7}" y="${y(value) + 3}" text-anchor="end">${escapeHTML(number.format(value))}</text>`).join("");
    const bars = stages.map((stage, index) => {
      const x = margin.left + xStep * index + (xStep - barW) / 2;
      const top = y(Math.max(stage.start, stage.end));
      const bottom = y(Math.min(stage.start, stage.end));
      const effect = stage.end - stage.start;
      const className = stage.total ? (index === stages.length - 1 && stage.end < 0 ? "improve" : "total") : effect <= 0 ? "improve" : "worsen";
      const displayValue = stage.total ? stage.end : effect;
      const connector = index < stages.length - 1 ? `<line class="connector" x1="${x + barW}" x2="${margin.left + xStep * (index + 1) + (xStep - barW) / 2}" y1="${y(stage.end)}" y2="${y(stage.end)}"/>` : "";
      return `<rect class="bar ${className}" x="${x}" y="${top}" width="${barW}" height="${Math.max(2,bottom - top)}"/><text class="value" x="${x + barW / 2}" y="${Math.max(12,top - 6)}" text-anchor="middle">${escapeHTML(signedMoney(displayValue))}</text><text class="category" x="${x + barW / 2}" y="${height - 26}" text-anchor="middle"><tspan x="${x + barW / 2}">${escapeHTML(stage.label.split(" ")[0])}</tspan><tspan x="${x + barW / 2}" dy="12">${escapeHTML(stage.label.split(" ").slice(1).join(" "))}</tspan></text>${connector}`;
    }).join("");
    host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(`${copy.deficit}: ${money(base)}; ${copy.yourResult}: ${final >= 0 ? copy.deficit : copy.surplus} ${money(Math.abs(final))}`)}">${grid}<line class="grid" x1="${margin.left}" x2="${width - margin.right}" y1="${y(0)}" y2="${y(0)}"/>${bars}</svg>`;
  }

  function renderGroupComparison() {
    const scenario = calculateScenario(state.data, state.adjustments, state.revenueAdjustment);
    const scenarioMap = new Map(scenario.items.map((item) => [item.id, item]));
    const rows = state.data.groups.map((group) => {
      const official = group.items.reduce((sum, item) => sum + item.amount_2027, 0);
      const current = group.items.reduce((sum, item) => sum + scenarioMap.get(item.id).scenario, 0);
      return { group, official, current, delta:current - official };
    });
    const max = Math.max(...rows.flatMap((row) => [row.official,row.current]), 1);
    $("#budget-group-comparison").innerHTML = rows.map((row) => `<div class="budget-group-row${Math.abs(row.delta) >= 0.0005 ? " changed" : ""}"><div><b>${escapeHTML(row.group[lang === "cs" ? "label_cs" : "label_en"])}</b><small>${escapeHTML(pct(row.current / scenario.expenditure))} ${escapeHTML(copy.share.toLowerCase())}</small></div><div class="budget-group-track"><span class="scenario" style="width:${Math.max(0,row.current / max * 100).toFixed(2)}%"></span><i class="official" style="left:${Math.max(0,row.official / max * 100).toFixed(2)}%" aria-hidden="true"></i></div><strong>${escapeHTML(money(row.current))}<small>${escapeHTML(signedMoney(row.delta))}</small></strong></div>`).join("");
  }

  function renderChangeLog() {
    const rows = flattenBudget(state.data).filter((item) => Math.abs(Number(state.adjustments.get(item.id) || 0)) >= 0.0005);
    const count = rows.length + (Math.abs(state.revenueAdjustment) >= 0.0005 ? 1 : 0);
    $("#change-count").textContent = String(count);
    const entries = rows.map((item) => `<div class="budget-change-row"><div><b>${escapeHTML(label(item))}</b><small>§ ${escapeHTML(item.id)} · ${escapeHTML(money(scenarioAmount(item)))}</small></div><strong>${escapeHTML(signedMoney(state.adjustments.get(item.id)))}</strong><button type="button" data-remove-item="${escapeHTML(item.id)}" aria-label="${escapeHTML(`${copy.remove}: ${label(item)}`)}">×</button></div>`);
    if (Math.abs(state.revenueAdjustment) >= 0.0005) entries.unshift(`<div class="budget-change-row"><div><b>${escapeHTML(copy.revenueAssumption)}</b><small>${escapeHTML(money(state.data.headline.revenue_2027 + state.revenueAdjustment))}</small></div><strong>${escapeHTML(signedMoney(state.revenueAdjustment))}</strong><button type="button" data-remove-revenue aria-label="${escapeHTML(copy.remove)}">×</button></div>`);
    $("#budget-change-list").innerHTML = entries.length ? entries.join("") : `<p class="budget-change-empty">${escapeHTML(copy.noChanges)}</p>`;
    document.querySelectorAll("[data-remove-item]").forEach((button) => button.addEventListener("click", () => { state.adjustments.delete(button.dataset.removeItem); renderAll(); }));
    $("[data-remove-revenue]")?.addEventListener("click", () => { state.revenueAdjustment = 0; renderAll(); });
  }

  function renderTable() {
    const scenario = calculateScenario(state.data, state.adjustments, state.revenueAdjustment);
    $("#budget-table-body").innerHTML = scenario.items.map((item) => `<tr class="${Math.abs(item.adjustment) >= 0.0005 ? "changed" : ""}"><td><button type="button" data-table-item="${escapeHTML(item.id)}">${escapeHTML(label(item))}</button><br><small>§ ${escapeHTML(item.id)}</small></td><td>${escapeHTML(money(item.amount_2026))}</td><td>${escapeHTML(money(item.amount_2027))}</td><td>${escapeHTML(money(item.scenario))}</td><td>${escapeHTML(signedMoney(item.adjustment))}</td></tr>`).join("");
    document.querySelectorAll("[data-table-item]").forEach((button) => button.addEventListener("click", () => { state.selectedId = button.dataset.tableItem; updateURL(); renderTreemap(); renderSelection(); renderEditor(); $("#planner").scrollIntoView({ behavior:"smooth", block:"start" }); }));
  }

  function renderAll() {
    updateURL();
    renderTreemap();
    renderSelection();
    renderEditor();
    renderLedger();
    renderGroupComparison();
    renderChangeLog();
    renderTable();
  }

  function csvCell(value) { return `"${String(value ?? "").replaceAll('"','""')}"`; }

  function downloadCSV() {
    const scenario = calculateScenario(state.data, state.adjustments, state.revenueAdjustment);
    const rows = [[copy.function,"code","2026_CZK_bn","2027_proposal_CZK_bn","scenario_CZK_bn","adjustment_CZK_bn"], ...scenario.items.map((item) => [label(item),item.id,item.amount_2026,item.amount_2027,item.scenario,item.adjustment])];
    rows.push([copy.revenue,"revenue",state.data.headline.revenue_2026,state.data.headline.revenue_2027,scenario.revenue,scenario.revenueAdjustment]);
    rows.push([copy.deficit,"deficit",state.data.headline.deficit_2026,state.data.headline.deficit_2027,scenario.deficit,scenario.deficitAdjustment]);
    const blob = new Blob(["\ufeff", rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = copy.csvName; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function copyScenarioLink() {
    updateURL();
    try { await navigator.clipboard.writeText(location.href); $("#share-status").textContent = copy.linkCopied; }
    catch { $("#share-status").textContent = copy.copyFailed; }
  }

  function bindControls() {
    $("#edit-selection").addEventListener("click", () => $("#planner").scrollIntoView({ behavior:"smooth", block:"start" }));
    $("#budget-adjustment").addEventListener("input", (event) => commitItemAdjustment(event.target.value));
    $("#budget-adjustment-number").addEventListener("change", (event) => commitItemAdjustment(event.target.value));
    $("#match-2026").addEventListener("click", () => { const item = itemById(); commitItemAdjustment(item.amount_2026 - item.amount_2027); });
    $("#clear-item").addEventListener("click", () => commitItemAdjustment(0));
    $("#revenue-adjustment").addEventListener("input", (event) => { state.revenueAdjustment = Number(event.target.value) || 0; renderAll(); });
    $("#revenue-adjustment-number").addEventListener("change", (event) => { state.revenueAdjustment = Number(event.target.value) || 0; renderAll(); });
    $("#reset-scenario").addEventListener("click", () => { state.adjustments.clear(); state.revenueAdjustment = 0; renderAll(); });
    $("#copy-scenario").addEventListener("click", copyScenarioLink);
    $("#download-scenario").addEventListener("click", downloadCSV);
    let resizeTimer;
    addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { renderTreemap(); renderWaterfall(calculateScenario(state.data, state.adjustments, state.revenueAdjustment)); }, 120); });
  }

  async function init() {
    $("#budget-treemap").innerHTML = `<div class="budget-loading">${lang === "cs" ? "Načítám návrh rozpočtu…" : "Loading the budget proposal…"}</div>`;
    try {
      const response = await fetch("../../data/state-budget-cze-2027-proposal.v1.json");
      if (!response.ok) throw new Error(`budget ${response.status}`);
      state.data = await response.json();
      const ids = new Set(flattenBudget(state.data).map((item) => item.id));
      if (!ids.has(state.selectedId)) state.selectedId = "41";
      state.adjustments = new Map([...state.adjustments].filter(([id]) => ids.has(id)));
      renderOfficial();
      bindControls();
      requestAnimationFrame(renderAll);
    } catch (error) {
      console.error(error);
      $("#budget-treemap").innerHTML = `<div class="budget-error">${lang === "cs" ? "Data návrhu se nepodařilo načíst." : "The proposal data could not be loaded."}</div>`;
    }
  }

  init();
}
