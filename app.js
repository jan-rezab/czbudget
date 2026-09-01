const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const NS = "http://www.w3.org/2000/svg";
const fmt0 = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);
const colors = { revenue:"#a8b63f", expense:"#c93237", taxes:"#a8b63f", taxPit:"#c7d45b", taxCit:"#a7bb42", taxVat:"#dce38c", taxExcise:"#b59f32", taxOther:"#7c8d45", insurance:"#4f6030", otherIncome:"#8b8d83", social:"#c93237", wages:"#b59f32", otherExpense:"#646861", capital:"#d3d8a0", a019:"#b59f32", a2064:"#a8b63f", a6579:"#8b8d83", a80:"#8e5d60", pension:"#c93237", health:"#a8b63f", care:"#b18a64", work:"#6f7653", balance:"#9a5b5e" };
const chartMeta = {
  "budget-pair-chart": ["line", "Zdroj: MF ČR · ČSÚ"],
  "income-stack-chart": ["column", "Zdroj: MF ČR · ČSÚ"],
  "revenue-pie-chart": ["pie", "Zdroj: MF ČR"],
  "expense-stack-chart": ["column", "Zdroj: MF ČR · ČSÚ"],
  "population-chart": ["line", "Zdroj: ČSÚ · projekce obyvatelstva 2023–2100"],
  "pressure-chart": ["line", "Zdroj: ČSÚ · ČSSZ · model Public Spending Data"],
  "system-cost-chart": ["column", "Zdroj: ČSÚ · ČSSZ · model Public Spending Data"],
  "pension-chart": ["line", "Zdroj: ČSÚ · ČSSZ · model Public Spending Data"]
};
const tooltip = $("#chart-tooltip");

function node(tag, attrs = {}, text = "") {
  const element = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  if (text !== "") element.textContent = text;
  return element;
}

function chartFrame(id, height = 292) {
  const container = document.getElementById(id);
  const width = Math.max(320, Math.floor(container.clientWidth || 720));
  const svg = node("svg", { viewBox:`0 0 ${width} ${height}`, role:"img", "aria-label":container.getAttribute("aria-label") || "Datový graf" });
  const [kind, source] = chartMeta[id] || ["chart", ""];
  container.classList.add("psd-chart", `psd-chart--${kind}`);
  container.dataset.source = source;
  container.innerHTML = "";
  container.appendChild(svg);
  const margin = { top:28, right:82, bottom:30, left:52 };
  return { container, svg, width, height, margin, iw:width-margin.left-margin.right, ih:height-margin.top-margin.bottom };
}

function linear(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax-domainMin || 1;
  const scale = (value) => rangeMin + (value-domainMin)/span*(rangeMax-rangeMin);
  scale.invert = (value) => domainMin + (value-rangeMin)/(rangeMax-rangeMin)*span;
  return scale;
}

function timeScale(domainMin, domainMax, rangeMin, rangeMax, interval = 1) {
  return linear(domainMin-interval/2,domainMax+interval/2,rangeMin,rangeMax);
}

function niceAxis(domainMin, domainMax, targetSteps = 4) {
  if (!Number.isFinite(domainMin) || !Number.isFinite(domainMax)) return { min:0, max:1, ticks:[0,1] };
  if (domainMin === domainMax) {
    const pad = Math.abs(domainMin)*.1 || 1;
    domainMin -= pad; domainMax += pad;
  }
  const roughStep = Math.abs(domainMax-domainMin)/targetSteps;
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep/power;
  const multiplier = [1,2,2.5,5,10].find((candidate)=>candidate>=fraction) || 10;
  const step = multiplier*power;
  const min = Math.floor(domainMin/step)*step;
  const max = Math.ceil(domainMax/step)*step;
  const count = Math.round((max-min)/step);
  const ticks = Array.from({length:count+1},(_,index)=>Number((min+index*step).toPrecision(12)));
  return { min, max, ticks };
}

function drawAxes(frame, x, y, xTicks, yTicks, yFormat, xTitle, yTitle) {
  const { svg, margin:m, iw, ih, height } = frame;
  yTicks.forEach((tick) => {
    const yy = m.top + y(tick);
    svg.append(node("line", { x1:m.left, x2:m.left+iw, y1:yy, y2:yy, class:"chart-grid" }));
    const formattedTick = typeof yFormat === "function" ? yFormat(tick) : yFormat.format(tick);
    svg.append(node("text", { x:m.left-8, y:yy+3, "text-anchor":"end", class:"chart-axis" }, formattedTick));
  });
  xTicks.forEach((tick) => {
    const xx = m.left + x(tick);
    svg.append(node("text", { x:xx, y:m.top+ih+18, "text-anchor":"middle", class:"chart-axis" }, String(tick)));
  });
  svg.append(node("text", { x:m.left, y:12, class:"chart-axis-title" }, yTitle));
}

function endLabel(frame, x, y, item, label, value, color, dy = 0) {
  const { svg, margin:m } = frame;
  svg.append(node("circle", { cx:m.left+x(item.year), cy:m.top+y(value), r:3.5, fill:color }));
  svg.append(node("text", { x:m.left+x(item.year)+8, y:m.top+y(value)+3.5+dy, class:"chart-end-label", style:`fill:${color}` }, label));
}

function linePath(data, x, y, xValue, yValue) {
  return data.map((d, index) => `${index ? "L" : "M"}${x(xValue(d)).toFixed(2)},${y(yValue(d)).toFixed(2)}`).join(" ");
}

function areaPath(data, x, y, topValue, bottomValue = () => 0) {
  const top = data.map((d, i) => `${i ? "L" : "M"}${x(d.year).toFixed(2)},${y(topValue(d)).toFixed(2)}`).join(" ");
  const bottom = [...data].reverse().map((d) => `L${x(d.year).toFixed(2)},${y(bottomValue(d)).toFixed(2)}`).join(" ");
  return `${top} ${bottom} Z`;
}

function showTip(event, title, rows) {
  tooltip.innerHTML = `<strong>${esc(title)}</strong>${rows.map(([label,value]) => `<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join("")}`;
  tooltip.style.opacity = "1";
  moveTip(event);
}

function moveTip(event) {
  const pad = 14, width = tooltip.offsetWidth || 210, height = tooltip.offsetHeight || 130;
  let left = event.clientX + 14, top = event.clientY + 14;
  if (left + width > innerWidth - pad) left = event.clientX - width - 14;
  if (top + height > innerHeight - pad) top = event.clientY - height - 14;
  tooltip.style.left = `${left}px`; tooltip.style.top = `${top}px`;
}

function hideTip() { tooltip.style.opacity = "0"; }

function addHover(frame, xScale, data, nearest, rows, guideClass = "chart-year-guide") {
  const { svg, margin:m, iw, ih } = frame;
  const guide = node("line", { y1:m.top, y2:m.top+ih, class:guideClass, visibility:"hidden" });
  svg.append(guide);
  const hit = node("rect", { x:m.left, y:m.top, width:iw, height:ih, class:"chart-hit" });
  hit.addEventListener("pointermove", (event) => {
    const rect = svg.getBoundingClientRect();
    const px = (event.clientX-rect.left) / rect.width * frame.width - m.left;
    const item = nearest(xScale.invert(Math.max(0, Math.min(iw, px))));
    const xx = m.left + xScale(item.year);
    guide.setAttribute("x1", xx); guide.setAttribute("x2", xx); guide.setAttribute("visibility", "visible");
    showTip(event, item.proposal ? `${item.year} · schválený rozpočet` : item.year, rows(item));
  });
  hit.addEventListener("pointerleave", () => { guide.setAttribute("visibility", "hidden"); hideTip(); });
  svg.append(hit);
}

function legend(id, items) {
  const element = document.getElementById(id);
  element.innerHTML = items.map(([key,label]) => `<span><i style="background:${colors[key]}"></i>${esc(label)}</span>`).join("");
}

let budgetData, demographicData, sovereignData;
let budgetState = { price:"nominal", year:2026, structure:"amount", revenueSlice:"insurance" };
let demoState = { variant:"mid", retAge:65, wageGrowth:0, costGrowth:0 };
let benchmarkState = { year:2024, metric:"expenditure_pct_gdp", country:"CZE" };

// A5 — the headline figures are read from the budget series, not typed into the markup.
// They were hardcoded in cesky-rozpocet.html, which meant every one of them was a second
// copy of a number that also lives in data/czech-budget.v1.json, silently going stale when
// the series moved. Layout and structure are untouched; only the values are wired.
function renderHeadlineFigures() {
  if (!budgetData) return;
  const rows = budgetData.rows;
  const proposal = rows.find((row) => row.proposal) || rows[rows.length-1];
  const actual = rows.filter((row) => !row.proposal).pop();
  // Bare figures carry no surrounding words, so no dictionary entry can reach them —
  // they are formatted for the active language here. The share string keeps Czech
  // formatting because its {n} pattern is translated and reformatted by budget-i18n.js.
  const signed = (value) => `${value < 0 ? "−" : ""}${bNum(Math.abs(value), 1)}`;
  const put = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };

  if (proposal) {
    const balance = proposal.revenue - proposal.expense;
    put("hero-revenue", bNum(proposal.revenue, 1));
    put("hero-expense", bNum(proposal.expense, 1));
    put("hero-deficit", signed(balance));
    const deficitShare = Math.abs(balance)/proposal.expense*100;
    put("hero-deficit-share", `${bPct(deficitShare)} ${bLang()==="en" ? "of expenditure" : "výdajů"}`);
    put("metric-approved-deficit", signed(balance));
    put("finance-revenue-total", bNum(proposal.revenue, 1));
    put("finance-expenditure-total", bNum(proposal.expense, 1));
    put("finance-deficit-total", signed(balance));
    put("finance-deficit-share", bLang()==="en" ? `${bPct(deficitShare)} of expenditure is not covered by revenue` : `${bPct(deficitShare)} výdajů není kryto příjmy`);
    const bar = document.getElementById("hero-revenue-bar");
    if (bar) bar.style.width = `${(proposal.revenue/proposal.expense*100).toFixed(1)}%`;
  }
  if (actual) put("metric-actual-deficit", signed(actual.revenue - actual.expense));
}

function prepareBudget(raw) {
  const keys = raw.columns;
  const taxKeys = raw.tax_detail?.columns || [];
  const taxRows = new Map((raw.tax_detail?.rows || []).map((values) => {
    const row = Object.fromEntries(taxKeys.map((key,index) => [key, values[index]]));
    return [row.year, row];
  }));
  const rows = raw.rows.map((values) => Object.fromEntries(keys.map((key,index) => [key, values[index]]))).map((d) => ({
    ...d, ...(taxRows.get(d.year) || {}), proposal:d.year===raw.proposal_year,
    revenue:d.taxes+d.insurance+d.other_income,
    expense:d.social_benefits+d.wages+d.other_expense+d.capital
  }));
  const cpi = { 2000:100 };
  for (let year=2001; year<=2026; year++) cpi[year] = cpi[year-1] * (1+(raw.inflation[String(year)] || 0)/100);
  return { ...raw, rows, cpi };
}

function budgetValue(value, year) {
  if (budgetState.price === "nominal") return value;
  return value * budgetData.cpi[2025] / budgetData.cpi[year];
}

function renderBudget() {
  const rows = budgetData.rows.map((d) => ({ ...d,
    displayRevenue:budgetValue(d.revenue,d.year), displayExpense:budgetValue(d.expense,d.year),
    displayBalance:budgetValue(d.revenue-d.expense,d.year)
  }));
  const frame = chartFrame("budget-pair-chart", 310), { svg, margin:m, iw, ih } = frame;
  const x = timeScale(2001,2026,0,iw), axis = niceAxis(0,Math.max(...rows.flatMap((d) => [d.displayRevenue,d.displayExpense]))*1.04);
  const y = linear(axis.min,axis.max,ih,0);
  drawAxes(frame,x,y,[2001,2005,2010,2015,2020,2026],axis.ticks,fmt0,"rok","mld. Kč");
  const proposalX = m.left+x(2026);
  svg.append(node("rect", { x:proposalX-9, y:m.top, width:18, height:ih, fill:colors.revenue, opacity:".22" }));
  [["displayRevenue",colors.revenue,"Příjmy"],["displayExpense",colors.expense,"Výdaje"]].forEach(([key,color,label]) => {
    svg.append(node("path", { d:linePath(rows,(v)=>m.left+x(v),(v)=>m.top+y(v),(d)=>d.year,(d)=>d[key]), fill:"none", stroke:color, "stroke-width":3 }));
    endLabel(frame,x,y,rows.at(-1),label,rows.at(-1)[key],color);
  });
  const selected = rows.find((d)=>d.year===budgetState.year);
  const selectedX = m.left+x(selected.year);
  svg.append(node("line", { x1:selectedX,x2:selectedX,y1:m.top,y2:m.top+ih,class:"chart-year-guide" }));
  [selected.displayRevenue,selected.displayExpense].forEach((value,index)=>svg.append(node("circle",{cx:selectedX,cy:m.top+y(value),r:5,fill:index?colors.expense:colors.revenue,stroke:"white","stroke-width":2})));
  addHover(frame,x,rows,(year)=>rows.reduce((best,d)=>Math.abs(d.year-year)<Math.abs(best.year-year)?d:best),d=>[["Příjmy",`${fmt1.format(d.displayRevenue)} mld.`],["Výdaje",`${fmt1.format(d.displayExpense)} mld.`],["Saldo",`${fmt1.format(d.displayBalance)} mld.`]]);
  renderBudgetDetail(selected);
  renderStructure(rows);
}

function renderBudgetDetail(d) {
  $("#budget-year-label").textContent = `${d.year}${d.proposal ? " · schválený" : " · skutečnost"}`;
  const pct = Math.abs(d.displayBalance)/d.displayExpense*100;
  $("#budget-year-detail").innerHTML = [
    ["Příjmy",`${fmt1.format(d.displayRevenue)} mld.`,`daně + pojistné + ostatní`],
    ["Výdaje",`${fmt1.format(d.displayExpense)} mld.`,`běžné + kapitálové`],
    ["Saldo",`${d.displayBalance>0?"+":""}${fmt1.format(d.displayBalance)} mld.`,`${fmt1.format(pct)} % výdajů`],
    ["Sociální dávky",`${fmt1.format(budgetValue(d.social_benefits,d.year))} mld.`,`${fmt1.format(d.social_benefits/d.expense*100)} % výdajů`]
  ].map(([label,value,note])=>`<div><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join("");
}

/** Render one complete budget side as an accessible, clickable donut and aligned ledger. */
function renderFinanceDonut({ containerId, legendId, detailId, slices, total, selectedKey, totalUnit, source, onSelect, detailHTML, formatAmount }) {
  const container = document.getElementById(containerId);
  const legendNode = document.getElementById(legendId);
  const detailNode = document.getElementById(detailId);
  if (!container || !legendNode || !detailNode || !slices.length || !total) return;

  const geometryTotal = slices.reduce((sum, slice) => sum + slice.value, 0);
  const amountLabel = value => formatAmount ? formatAmount(value) : `${bNum(value,1)} ${totalUnit}`;
  const size = 286, radius = 125, inner = 72, cx = size/2, cy = size/2;
  container.classList.add("psd-chart", "psd-chart--pie", "svg-chart");
  container.dataset.source = source;
  container.innerHTML = "";
  const svg = node("svg", { viewBox:`0 0 ${size} ${size}`, role:"img",
    "aria-label":slices.map(slice => `${slice.label} ${amountLabel(slice.value)}`).join(", ") });
  let angle = -Math.PI/2;

  const select = (key) => { if (key !== selectedKey) onSelect(key); };
  slices.forEach((slice) => {
    const sweep = slice.value/geometryTotal*Math.PI*2;
    const end = angle+sweep;
    const middle = angle+sweep/2;
    const point = (r, a) => `${(cx+r*Math.cos(a)).toFixed(2)} ${(cy+r*Math.sin(a)).toFixed(2)}`;
    const selected = slice.key === selectedKey;
    const offset = selected ? 5 : 0;
    const large = sweep > Math.PI ? 1 : 0;
    const path = node("path", {
      d: `M ${point(radius,angle)} A ${radius} ${radius} 0 ${large} 1 ${point(radius,end)}`
       + ` L ${point(inner,end)} A ${inner} ${inner} 0 ${large} 0 ${point(inner,angle)} Z`,
      fill:slice.color, class:`finance-donut-slice${selected ? " is-selected" : ""}`,
      transform:`translate(${(Math.cos(middle)*offset).toFixed(2)} ${(Math.sin(middle)*offset).toFixed(2)})`,
      role:"button", tabindex:"0", "aria-pressed":String(selected),
      "aria-label":`${slice.label}: ${amountLabel(slice.value)}, ${bPct(slice.value/total*100)}`,
    });
    path.addEventListener("click", () => select(slice.key));
    path.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(slice.key); }
    });
    path.addEventListener("pointermove", (event) => showTip(event, slice.label, [[bLang()==="en" ? "Amount" : "Částka", amountLabel(slice.value)], [bLang()==="en" ? "Share" : "Podíl", bPct(slice.value/total*100)]]));
    path.addEventListener("pointerleave", hideTip);
    svg.append(path);
    angle = end;
  });

  svg.append(node("text", { x:cx, y:cy-5, "text-anchor":"middle", class:"pie-total-value" }, bNum(total,1)));
  svg.append(node("text", { x:cx, y:cy+17, "text-anchor":"middle", class:"pie-total-label" }, totalUnit));
  container.append(svg);

  legendNode.innerHTML = slices.map(slice => `<button type="button" data-finance-slice="${esc(slice.key)}" aria-pressed="${slice.key===selectedKey}" style="--slice-color:${slice.color}"><i></i><span>${esc(slice.label)}</span><b>${bNum(slice.value,1)}</b><small>${bPct(slice.value/total*100)}</small></button>`).join("");
  legendNode.querySelectorAll("[data-finance-slice]").forEach(button => button.addEventListener("click", () => select(button.dataset.financeSlice)));
  const selected = slices.find(slice => slice.key === selectedKey) || slices[0];
  detailNode.innerHTML = detailHTML(selected, total);
}

window.PSDBudgetStructure = { renderFinanceDonut };

function renderRevenuePie() {
  const latest = budgetData?.rows?.at(-1);
  if (!latest) return;
  const en = bLang() === "en";
  const labels = en ? {
    pit:["Personal income tax","Tax on earnings from employment and self-employment."],
    cit:["Corporate income tax","Tax on company profits."], vat:["VAT","Value-added tax on household and business consumption."],
    excise:["Excise & energy taxes","Excise duties and taxes on energy products."], otherTax:["Other taxes & fees","Property taxes and all remaining tax and fee revenue."],
    insurance:["Social contributions","Mandatory social-security and employment-policy contributions."],
    other:["Other revenue","Non-tax and capital revenue plus transfers received, including EU funds."],
  } : {
    pit:["Daň z příjmů fyzických osob","Daň z příjmů zaměstnanců a osob samostatně výdělečně činných."],
    cit:["Daň z příjmů právnických osob","Daň ze zisku firem."], vat:["DPH","Daň z přidané hodnoty ze spotřeby domácností a firem."],
    excise:["Spotřební a energetické daně","Spotřební daně a daně z energetických produktů."], otherTax:["Ostatní daně a poplatky","Majetkové daně a zbývající daňové a poplatkové příjmy."],
    insurance:["Sociální pojistné","Povinné pojistné na sociální zabezpečení a politiku zaměstnanosti."],
    other:["Ostatní příjmy","Nedaňové a kapitálové příjmy a přijaté transfery včetně prostředků EU."],
  };
  const slices = [
    {key:"taxPit",label:labels.pit[0],description:labels.pit[1],value:latest.personal_income_tax,color:colors.taxPit},
    {key:"taxCit",label:labels.cit[0],description:labels.cit[1],value:latest.corporate_income_tax,color:colors.taxCit},
    {key:"taxVat",label:labels.vat[0],description:labels.vat[1],value:latest.vat,color:colors.taxVat},
    {key:"taxExcise",label:labels.excise[0],description:labels.excise[1],value:latest.excise_and_energy_taxes,color:colors.taxExcise},
    {key:"taxOther",label:labels.otherTax[0],description:labels.otherTax[1],value:latest.property_taxes+latest.other_taxes_and_fees,color:colors.taxOther},
    {key:"insurance",label:labels.insurance[0],description:labels.insurance[1],value:latest.insurance,color:colors.insurance},
    {key:"otherIncome",label:labels.other[0],description:labels.other[1],value:latest.other_income,color:colors.otherIncome},
  ];
  const money = value => en ? `CZK ${bNum(value,1)}bn` : `${bNum(value,1)} mld. Kč`;
  renderFinanceDonut({
    containerId:"revenue-pie-chart", legendId:"revenue-pie-legend", detailId:"revenue-pie-detail",
    slices, total:latest.revenue, selectedKey:budgetState.revenueSlice,
    totalUnit:en ? "CZK bn" : "mld. Kč", source:en ? "Source: Czech Ministry of Finance" : "Zdroj: MF ČR",
    formatAmount:money,
    onSelect:(key) => { budgetState.revenueSlice=key; renderRevenuePie(); },
    detailHTML:(slice,total) => `<div class="finance-detail-head"><i style="background:${slice.color}"></i><div><span>${esc(slice.label)}</span><strong>${money(slice.value)}</strong></div><b>${bPct(slice.value/total*100)}</b></div><p>${esc(slice.description)}</p>`,
  });
}

function renderStructure(rows) {
  const amount = budgetState.structure === "amount";
  renderStack("income-stack-chart", rows, [
    ["taxPit","Daň z příjmů fyzických osob",d=>d.personal_income_tax],
    ["taxCit","Daň z příjmů právnických osob",d=>d.corporate_income_tax],
    ["taxVat","DPH",d=>d.vat],
    ["taxExcise","Spotřební a energetické daně",d=>d.excise_and_energy_taxes],
    ["taxOther","Ostatní daně a poplatky",d=>d.property_taxes+d.other_taxes_and_fees],
    ["insurance","Sociální pojistné",d=>d.insurance],
    ["otherIncome","Ostatní příjmy",d=>d.other_income]
  ], d=>d.revenue, amount);
  renderStack("expense-stack-chart", rows, [
    ["social","Sociální dávky",d=>d.social_benefits],["wages","Mzdy státu",d=>d.wages],["otherExpense","Ostatní výdaje",d=>d.other_expense],["capital","Investice",d=>d.capital]
  ], d=>d.expense, amount);
  legend("income-legend",[
    ["taxPit","DPFO"],["taxCit","DPPO"],["taxVat","DPH"],
    ["taxExcise","Spotřební a energetické daně"],["taxOther","Ostatní daně a poplatky"],
    ["insurance","Sociální pojistné"],["otherIncome","Ostatní příjmy"]
  ]);
  legend("expense-legend",[["social","Sociální dávky"],["wages","Mzdy"],["otherExpense","Ostatní"],["capital","Investice"]]);
  renderRevenuePie();
}

function renderStack(id, rows, definitions, total, amount) {
  const frame=chartFrame(id,280),{svg,margin:m,iw,ih}=frame,x=timeScale(2001,2026,0,iw);
  const transformed=rows.map(d=>{let sum=0;const out={...d};definitions.forEach(([key,,get])=>{const value=budgetValue(get(d),d.year);out[key]=amount?value:value/budgetValue(total(d),d.year)*100;out[key+"0"]=sum;sum+=out[key];out[key+"1"]=sum});return out});
  const axis=amount?niceAxis(0,Math.max(...transformed.map(d=>definitions.reduce((s,[key])=>s+d[key],0)))*1.03):{min:0,max:100,ticks:[0,25,50,75,100]},y=linear(axis.min,axis.max,ih,0),bar=Math.max(3,iw/transformed.length*.68);
  drawAxes(frame,x,y,[2001,2010,2020,2026],axis.ticks,amount?fmt0:(v)=>`${fmt0.format(v)} %`,"rok",amount?"mld. Kč":"podíl");
  transformed.forEach(d=>definitions.forEach(([key])=>svg.append(node("rect",{x:m.left+x(d.year)-bar/2,y:m.top+y(d[key+"1"]),width:bar,height:y(d[key+"0"])-y(d[key+"1"]),fill:colors[key],opacity:.92}))));
  svg.append(node("line",{x1:m.left+x(2026),x2:m.left+x(2026),y1:m.top,y2:m.top+ih,class:"chart-year-guide"}));
  addHover(frame,x,transformed,(year)=>transformed.reduce((best,d)=>Math.abs(d.year-year)<Math.abs(best.year-year)?d:best),d=>definitions.map(([key,label])=>[label,amount?`${fmt1.format(d[key])} mld.`:`${fmt1.format(d[key])} %`]));
}

function prepareDemography(raw) {
  const requiredBaseAmounts = ["pension_expense","pension_income","health_expense","care_allowance"];
  requiredBaseAmounts.forEach((key) => {
    if (!Number.isFinite(raw.base_2025?.[key]) || raw.base_2025[key] <= 0) {
      throw new Error(`Demografický model: neplatná výchozí hodnota ${key}`);
    }
  });
  const fields=raw.columns;
  const variants={};
  Object.entries(raw.variants).forEach(([variant,points])=>{
    const source=points.map(values=>Object.fromEntries(fields.map((key,index)=>[key,values[index]])));
    variants[variant]=[];
    for(let year=2025;year<=2045;year++){
      const left=source.filter(d=>d.year<=year).at(-1),right=source.find(d=>d.year>=year)||left,t=right.year===left.year?0:(year-left.year)/(right.year-left.year),row={year};
      fields.slice(1).forEach(key=>row[key]=left[key]+(right[key]-left[key])*t);
      row.total=row.age_0_19+row.age_20_64+row.age_65_79+row.age_80_plus;variants[variant].push(row);
    }
  });
  return {...raw,variants};
}

function modelSeries() {
  const raw=demographicData.variants[demoState.variant],b=raw[0],base=demographicData.base_2025;
  const model=demographicData.model,{pension_age_sensitive_share:pensionAgeShare,health_age_weights:healthWeights,care_age_shares:careShares,retirement_age_phase_in_years:phaseInYears}=model;
  const pensionPopulationShare=1-pensionAgeShare;
  const healthBase=healthWeights[0]*b.age_0_19+healthWeights[1]*b.age_20_64+healthWeights[2]*b.age_65_79+healthWeights[3]*b.age_80_plus;
  return raw.map(d=>{
    const t=d.year-2025,phase=Math.min(1,t/phaseInYears),target=d[`age_${demoState.retAge}_plus`],effective=d.age_65_plus-phase*(d.age_65_plus-target);
    const pensionDriver=pensionAgeShare*(effective/b.age_65_plus)+pensionPopulationShare*(d.total/b.total);
    const healthDriver=(healthWeights[0]*d.age_0_19+healthWeights[1]*d.age_20_64+healthWeights[2]*d.age_65_79+healthWeights[3]*d.age_80_plus)/healthBase;
    const careDriver=careShares[0]*((d.age_0_19+d.age_20_64)/(b.age_0_19+b.age_20_64))+careShares[1]*(d.age_65_79/b.age_65_79)+careShares[2]*(d.age_80_plus/b.age_80_plus);
    const workDriver=d.age_20_64/b.age_20_64,costFactor=(1+demoState.costGrowth/100)**t,wageFactor=(1+demoState.wageGrowth/100)**t;
    const pension=base.pension_expense*pensionDriver*costFactor,health=base.health_expense*healthDriver*costFactor,care=base.care_allowance*careDriver*costFactor,income=base.pension_income*workDriver*wageFactor;
    return {...d,pensionDriver,healthDriver,careDriver,workDriver,pension,health,care,income,expense:pension,balance:income-pension};
  });
}

function renderDemography(){const series=modelSeries(),b=series[0],e=series.at(-1),baseAnnualSystemCost=b.pension+b.health+b.care,annualSystemCost=e.pension+e.health+e.care;
  $("#model-ratio").textContent=`${fmt1.format(e.age_65_plus/e.age_20_64*100)} : 100`;$("#model-ratio-note").textContent=`z ${fmt1.format(b.age_65_plus/b.age_20_64*100)} : 100 v roce 2025`;$("#model-80").textContent=`${fmt1.format(e.age_80_plus/1e6)} mil.`;$("#model-80-note").textContent=`+${fmt0.format((e.age_80_plus/b.age_80_plus-1)*100)} % proti 2025`;$("#model-system-cost").textContent=fmt0.format(annualSystemCost);$("#model-system-cost-note").textContent=`z ${fmt0.format(baseAnnualSystemCost)} mld. Kč v roce 2025`;$("#model-pension-balance").textContent=`${e.balance>=0?"+":""}${fmt0.format(e.balance)}`;
  $("#headline-ratio").textContent=fmt1.format(e.age_65_plus/e.age_20_64*100);$("#headline-80").textContent=`+${fmt0.format((e.age_80_plus/b.age_80_plus-1)*100)} %`;
  renderPopulation(series);renderPressure(series);renderSystemCosts(series);renderPension(series);
}

function renderPopulation(series) {
  const f=chartFrame("population-chart",290),{svg,margin:m,iw,ih}=f,x=timeScale(2025,2045,0,iw);
  const defs=[["a019","0–19",d=>d.age_0_19/1e6,8],["a2064","20–64",d=>d.age_20_64/1e6,0],["a6579","65–79",d=>d.age_65_79/1e6,-8],["a80","80+",d=>d.age_80_plus/1e6,0]];
  const axis=niceAxis(0,Math.max(...series.flatMap(d=>defs.map(([, ,get])=>get(d))))*1.08),y=linear(axis.min,axis.max,ih,0);
  drawAxes(f,x,y,[2025,2030,2035,2040,2045],axis.ticks,fmt1,"rok","miliony");
  defs.forEach(([key,label,get,dy])=>{
    svg.append(node("path",{d:linePath(series,v=>m.left+x(v),v=>m.top+y(v),d=>d.year,get),fill:"none",stroke:colors[key],"stroke-width":2.7}));
    endLabel(f,x,y,series.at(-1),label,get(series.at(-1)),colors[key],dy);
  });
  addHover(f,x,series,year=>series.reduce((a,d)=>Math.abs(d.year-year)<Math.abs(a.year-year)?d:a),d=>[["0–19",`${fmt1.format(d.age_0_19/1e6)} mil.`],["20–64",`${fmt1.format(d.age_20_64/1e6)} mil.`],["65–79",`${fmt1.format(d.age_65_79/1e6)} mil.`],["80+",`${fmt1.format(d.age_80_plus/1e6)} mil.`]]);
  legend("population-legend",defs.map(([k,l])=>[k,l]));
}

function renderPressure(series) {
  const f=chartFrame("pressure-chart",280),{svg,margin:m,iw,ih}=f,x=timeScale(2025,2045,0,iw),defs=[["pension","Důchody",d=>d.pensionDriver*100],["health","Zdravotnictví",d=>d.healthDriver*100],["care","Péče",d=>d.careDriver*100],["work","Příjmová báze",d=>d.workDriver*100]],values=series.flatMap(d=>defs.map(([, ,get])=>get(d))),axis=niceAxis(Math.min(...values)*.97,Math.max(...values)*1.03,5),y=linear(axis.min,axis.max,ih,0);
  drawAxes(f,x,y,[2025,2030,2035,2040,2045],axis.ticks,fmt0,"rok","index");
  svg.append(node("line",{x1:m.left,x2:m.left+iw,y1:m.top+y(100),y2:m.top+y(100),stroke:"#ffffff88","stroke-dasharray":"4 4"}));
  defs.forEach(([key,label,get])=>{
    svg.append(node("path",{d:linePath(series,v=>m.left+x(v),v=>m.top+y(v),d=>d.year,get),fill:"none",stroke:colors[key],"stroke-width":2.7}));
    endLabel(f,x,y,series.at(-1),label,get(series.at(-1)),colors[key]);
  });
  addHover(f,x,series,year=>series.reduce((a,d)=>Math.abs(d.year-year)<Math.abs(a.year-year)?d:a),d=>defs.map(([,label,get])=>[label,fmt1.format(get(d))]));
  legend("pressure-legend",defs.map(([k,l])=>[k,l]));
}

function renderSystemCosts(series) {
  const f=chartFrame("system-cost-chart",280),{svg,margin:m,iw,ih}=f,x=timeScale(2025,2045,0,iw),defs=[["pension","Důchody",d=>d.pension],["health","Zdravotnictví",d=>d.health],["care","Péče",d=>d.care]],deficit=demographicData.base_2025.budget_deficit_2026,stackedMax=Math.max(...series.map(d=>defs.reduce((sum,[,,get])=>sum+get(d),0))),axis=niceAxis(0,Math.max(stackedMax,deficit)*1.06),y=linear(axis.min,axis.max,ih,0),bar=iw/series.length*.62;
  drawAxes(f,x,y,[2025,2030,2035,2040,2045],axis.ticks,fmt0,"rok","mld. Kč");
  series.forEach(d=>{let base=0;defs.forEach(([key,,get])=>{const value=get(d);svg.append(node("rect",{x:m.left+x(d.year)-bar/2,y:m.top+y(base+value),width:bar,height:y(base)-y(base+value),fill:colors[key],opacity:.92}));base+=value})});
  svg.append(node("line",{x1:m.left,x2:m.left+iw,y1:m.top+y(deficit),y2:m.top+y(deficit),stroke:"white","stroke-width":1.5,"stroke-dasharray":"4 3"}));
  svg.append(node("text",{x:m.left+iw-3,y:m.top+y(deficit)-7,"text-anchor":"end",class:"chart-axis"},"schodek 2026 · 310 mld."));
  addHover(f,x,series,year=>series.reduce((a,d)=>Math.abs(d.year-year)<Math.abs(a.year-year)?d:a),d=>[["Celkem",`${fmt1.format(defs.reduce((sum,[,,get])=>sum+get(d),0))} mld.`],...defs.map(([,label,get])=>[label,`${fmt1.format(get(d))} mld.`])]);
  legend("system-cost-legend",defs.map(([k,l])=>[k,l]));
}

function renderPension(series) {
  const f=chartFrame("pension-chart",300),{svg,margin:m,iw,ih}=f,x=timeScale(2025,2045,0,iw),rawMin=Math.min(-300,Math.min(...series.map(d=>d.balance))),rawMax=Math.max(...series.map(d=>Math.max(d.income,d.expense))),axis=niceAxis(rawMin*1.03,rawMax*1.03,5),y=linear(axis.min,axis.max,ih,0);
  drawAxes(f,x,y,[2025,2030,2035,2040,2045],axis.ticks,fmt0,"rok","mld. Kč");
  [["income","Příjmy",colors.work],["expense","Výdaje",colors.pension],["balance","Saldo",colors.balance]].forEach(([key,label,color])=>{
    svg.append(node("path",{d:linePath(series,v=>m.left+x(v),v=>m.top+y(v),d=>d.year,d=>d[key]),fill:"none",stroke:color,"stroke-width":key==="balance"?2.3:2.8,"stroke-dasharray":key==="balance"?"5 3":"none"}));
    endLabel(f,x,y,series.at(-1),label,series.at(-1)[key],color);
  });
  addHover(f,x,series,year=>series.reduce((a,d)=>Math.abs(d.year-year)<Math.abs(a.year-year)?d:a),d=>[["Příjmy",`${fmt1.format(d.income)} mld.`],["Výdaje",`${fmt1.format(d.expense)} mld.`],["Saldo",`${fmt1.format(d.balance)} mld.`]]);
  legend("pension-legend",[["work","Příjmy"],["pension","Výdaje"],["balance","Saldo"]]);
}

// The international-context block is rendered from data, so the exact-string
// tree walk in budget-i18n.js can never reach it. It reads the language
// language-bootstrap.js resolved and re-renders itself when that changes.
const bLang = () => (window.PSDLanguage?.current() || document.documentElement.lang) === "en" ? "en" : "cs";
const B = {
  cs: {indicator:"Ukazatel",countries:"zemí",revenue:"Příjmy",expense:"Výdaje",balance:"Saldo",debt:"Hrubý dluh",scope:"General government / sektor vládních institucí",note:"Harmonizovaný rozsah IMF zahrnuje ústřední, regionální a místní vládu i fondy sociálního zabezpečení po konsolidaci. Tržní veřejné korporace jsou mimo; řada není totožná s národním státním či federálním rozpočtem.",surplus:"Přebytek",deficit:"Schodek",ofGdp:"HDP",scatterLabel:year=>`Saldo a dluh zemí v roce ${year}`,usdBn:"mld. USD"},
  en: {indicator:"Indicator",countries:"countries",revenue:"Revenue",expense:"Expenditure",balance:"Balance",debt:"Gross debt",scope:"General government",note:"The harmonised IMF perimeter covers central, regional and local government plus social-security funds after consolidation. Market public corporations are outside it; the series is not identical to a national state or federal budget.",surplus:"Surplus",deficit:"Deficit",ofGdp:"of GDP",scatterLabel:year=>`Fiscal balance and gross debt by country in ${year}`,usdBn:"bn USD"}
};
// The benchmark dataset only ships label_cs for these metrics; English labels
// belong here rather than in a post-hoc string replacement.
const metricLabelsEn = {revenue_pct_gdp:"General-government revenue",expenditure_pct_gdp:"General-government expenditure",balance_pct_gdp:"Net lending (+) / borrowing (−)",primary_balance_pct_gdp:"Primary balance",structural_balance_pct_potential_gdp:"Structural balance",gross_debt_pct_gdp:"General-government gross debt",real_gdp_growth_pct:"Real GDP growth",inflation_pct:"CPI inflation",unemployment_pct:"Unemployment"};
const bt = () => B[bLang()];
const bNum = (value,digits) => new Intl.NumberFormat(bLang()==="en"?"en-GB":"cs-CZ",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
// Czech sets a space before the percent sign, English does not.
const bPct = (value,digits=1) => `${bNum(value,digits)}${bLang()==="en"?"":" "}%`;
const metricName = (meta) => (bLang()==="en" ? meta?.label_en||metricLabelsEn[meta?.metric_code]||meta?.label_cs : meta?.label_cs) || "";
const countryName = (meta) => (bLang()==="en" ? meta?.name_en||meta?.name_cs : meta?.name_cs) || "";

function metricValue(countryCode,metric,year){const entry=sovereignData.series.find(d=>d.country_code===countryCode);const point=entry?.metrics?.[metric]?.values?.find(d=>d.year===year);return point?.value ?? null;}
function countryMeta(code){return sovereignData.countries.find(d=>d.country_code===code)}
function metricMeta(code){return sovereignData.metrics.find(d=>d.metric_code===code)}
function formatMetric(value,metric){if(value==null)return"—";const unit=metricMeta(metric)?.unit;return unit==="usd_per_capita"?`${bNum(value,0)} USD`:unit==="usd_bn"?`${bNum(value,1)} ${bt().usdBn}`:bPct(value);}
// Keep the Czech budget page focused on the small reference cohort used for
// fiscal benchmarking. The full global dataset belongs on the comparison page;
// rendering it here turns both the ranking and scatter into an unreadable cloud.
function benchmarkCountries(){return sovereignData.countries.filter(d=>d.role==="anchor"||d.role==="responsible_benchmark")}

function fillBenchmarkSelects(){$("#metric-select").innerHTML=sovereignData.metrics.filter(m=>["revenue_pct_gdp","expenditure_pct_gdp","balance_pct_gdp","primary_balance_pct_gdp","gross_debt_pct_gdp","real_gdp_growth_pct","inflation_pct","unemployment_pct"].includes(m.metric_code)).map(m=>`<option value="${m.metric_code}" ${m.metric_code===benchmarkState.metric?"selected":""}>${esc(metricName(m))}</option>`).join("");$("#country-select").innerHTML=benchmarkCountries().map(c=>`<option value="${c.country_code}" ${c.country_code===benchmarkState.country?"selected":""}>${esc(countryName(c))}</option>`).join("");}
let benchmarkRenderedLang=null;
function syncBenchmarkLanguage(){if(!sovereignData||benchmarkRenderedLang===bLang())return;benchmarkRenderedLang=bLang();fillBenchmarkSelects();renderBenchmark();}
["budgetlanguagechange","psdlanguagechange"].forEach(name=>addEventListener(name,syncBenchmarkLanguage));
// The headline figures are numerals with no words around them, so the translator cannot
// reach them; re-render so they follow the active language's number format.
["budgetlanguagechange","psdlanguagechange"].forEach(name=>addEventListener(name,renderHeadlineFigures));
["budgetlanguagechange","psdlanguagechange"].forEach(name=>addEventListener(name,()=>{if(budgetData){renderRevenuePie();renderHeadlineFigures();}}));

function initBenchmark(){const years=Array.from({length:20},(_,i)=>2005+i);$("#year-select").innerHTML=years.reverse().map(y=>`<option ${y===2024?"selected":""}>${y}</option>`).join("");benchmarkRenderedLang=bLang();fillBenchmarkSelects();$("#year-select").addEventListener("change",e=>{benchmarkState.year=+e.target.value;renderBenchmark()});$("#metric-select").addEventListener("change",e=>{benchmarkState.metric=e.target.value;renderBenchmark()});$("#country-select").addEventListener("change",e=>{benchmarkState.country=e.target.value;renderBenchmark()});renderBenchmark();}

function renderBenchmark(){const countries=benchmarkCountries().map(c=>({...c,value:metricValue(c.country_code,benchmarkState.metric,benchmarkState.year)})).filter(d=>d.value!=null).sort((a,b)=>b.value-a.value),max=Math.max(...countries.map(d=>Math.abs(d.value)),1);$("#ranking-title").textContent=metricName(metricMeta(benchmarkState.metric))||bt().indicator;$("#ranking-count").textContent=`${countries.length} ${bt().countries}`;$("#comparison-year").textContent=benchmarkState.year;$("#rank-list").innerHTML=countries.map((d,i)=>`<button class="rank-row ${d.country_code===benchmarkState.country?"active":""}" data-country="${d.country_code}"><span class="position">${String(i+1).padStart(2,"0")}</span><strong>${esc(countryName(d))}</strong><span class="rank-track"><i style="width:${Math.abs(d.value)/max*100}%"></i></span><span class="rank-value">${formatMetric(d.value,benchmarkState.metric)}</span></button>`).join("");$$('.rank-row').forEach(button=>button.addEventListener('click',()=>{benchmarkState.country=button.dataset.country;$("#country-select").value=benchmarkState.country;renderBenchmark()}));renderCountryProfile();renderScatter();}

function renderCountryProfile(){const c=countryMeta(benchmarkState.country),y=benchmarkState.year,vals={revenue:metricValue(c.country_code,"revenue_pct_gdp",y),expense:metricValue(c.country_code,"expenditure_pct_gdp",y),balance:metricValue(c.country_code,"balance_pct_gdp",y),debt:metricValue(c.country_code,"gross_debt_pct_gdp",y)};const t=bt();$("#country-profile").innerHTML=`<div class="city-title"><div><span class="country-flag">${esc(c.country_code)}</span><h3>${esc(countryName(c))}</h3><p>${y} · ${esc(t.scope)}</p></div></div><div class="city-kpis"><div><span>${esc(t.revenue)}</span><strong>${formatMetric(vals.revenue,"revenue_pct_gdp")}</strong></div><div><span>${esc(t.expense)}</span><strong>${formatMetric(vals.expense,"expenditure_pct_gdp")}</strong></div><div><span>${esc(t.balance)}</span><strong>${formatMetric(vals.balance,"balance_pct_gdp")}</strong></div><div><span>${esc(t.debt)}</span><strong>${formatMetric(vals.debt,"gross_debt_pct_gdp")}</strong></div></div><p class="profile-note">${esc(t.note)}</p>`;}

function renderScatter(){const rows=benchmarkCountries().map(c=>({...c,balance:metricValue(c.country_code,"balance_pct_gdp",benchmarkState.year),debt:metricValue(c.country_code,"gross_debt_pct_gdp",benchmarkState.year)})).filter(d=>d.balance!=null&&d.debt!=null),container=$("#scatter-wrap"),width=Math.max(500,(container.clientWidth||900)-290),height=360,m={top:20,right:24,bottom:42,left:54},iw=width-m.left-m.right,ih=height-m.top-m.bottom,xMin=Math.floor(Math.min(...rows.map(d=>d.balance))-1),xMax=Math.ceil(Math.max(...rows.map(d=>d.balance))+1),yAxis=niceAxis(0,Math.max(...rows.map(d=>d.debt))*1.08),x=linear(xMin,xMax,0,iw),y=linear(yAxis.min,yAxis.max,ih,0),svg=node("svg",{viewBox:`0 0 ${width} ${height}`,role:"img","aria-label":bt().scatterLabel(benchmarkState.year)});yAxis.ticks.forEach(t=>{svg.append(node("line",{x1:m.left,x2:m.left+iw,y1:m.top+y(t),y2:m.top+y(t),class:"chart-grid"}));svg.append(node("text",{x:m.left-7,y:m.top+y(t)+3,"text-anchor":"end",class:"chart-axis"},bNum(t,0)))});[xMin,0,xMax].forEach(t=>svg.append(node("text",{x:m.left+x(t),y:m.top+ih+18,"text-anchor":"middle",class:"chart-axis"},bNum(t,0))));svg.append(node("line",{x1:m.left+x(0),x2:m.left+x(0),y1:m.top,y2:m.top+ih,stroke:"#6e716d","stroke-dasharray":"4 4"}));rows.forEach(d=>{const g=node("g",{class:"scatter-city"}),circle=node("circle",{cx:m.left+x(d.balance),cy:m.top+y(d.debt),r:d.country_code===benchmarkState.country?8:5,fill:d.country_code===benchmarkState.country?"#a8b63f":"#8b8d83",stroke:"#171918","stroke-width":d.country_code===benchmarkState.country?2.5:1});g.append(circle);g.append(node("text",{x:m.left+x(d.balance)+8,y:m.top+y(d.debt)-7,class:"chart-axis"},d.country_code));g.addEventListener("click",()=>{benchmarkState.country=d.country_code;$("#country-select").value=d.country_code;renderBenchmark()});svg.append(g)});const active=rows.find(d=>d.country_code===benchmarkState.country)||rows[0];container.innerHTML="";container.append(svg);const aside=document.createElement("aside");aside.className="scatter-insight";const copy=bt();aside.innerHTML=`<span>${esc(countryName(active))} · ${benchmarkState.year}</span><strong>${esc(active.balance>=0?copy.surplus:copy.deficit)} ${bPct(Math.abs(active.balance))} ${esc(copy.ofGdp)}</strong><div><span>${esc(copy.balance)}</span><b>${bPct(active.balance)}</b></div><div><span>${esc(copy.debt)}</span><b>${bPct(active.debt)}</b></div>`;container.append(aside);}

function bindControls(){$("#budget-price-mode").addEventListener("change",e=>{budgetState.price=e.target.value;renderBudget()});$("#budget-year").addEventListener("input",e=>{budgetState.year=+e.target.value;renderBudget()});$$("#structure-mode button").forEach(button=>button.addEventListener("click",()=>{budgetState.structure=button.dataset.mode;$$("#structure-mode button").forEach(b=>b.setAttribute("aria-pressed",b===button));renderBudget()}));$$("#demo-variant button").forEach(button=>button.addEventListener("click",()=>{demoState.variant=button.dataset.value;$$("#demo-variant button").forEach(b=>b.setAttribute("aria-pressed",b===button));renderDemography()}));[["ret-age","retAge","ret-age-label",v=>`${v} let`],["wage-growth","wageGrowth","wage-growth-label",v=>`${fmt1.format(v)} %`],["cost-growth","costGrowth","cost-growth-label",v=>`${fmt1.format(v)} %`]].forEach(([id,key,label,format])=>$("#"+id).addEventListener("input",e=>{demoState[key]=+e.target.value;$("#"+label).textContent=format(+e.target.value);renderDemography()}));}

Promise.all([
  fetch("data/czech-budget.v1.json").then(r=>{if(!r.ok)throw new Error("Rozpočtová data se nepodařilo načíst");return r.json()}),
  fetch("data/demography-social.v1.json").then(r=>{if(!r.ok)throw new Error("Demografická data se nepodařilo načíst");return r.json()}),
  // The benchmark panel reads countries, metric labels and eight indicator series — the
  // slim slice, not the full twenty-year payload the country profile needs.
  fetch("data/sovereign-benchmark-slim.v1.json").then(r=>{if(!r.ok)throw new Error("Mezinárodní data se nepodařilo načíst");return r.json()})
]).then(([budget,demography,sovereign])=>{budgetData=prepareBudget(budget);demographicData=prepareDemography(demography);sovereignData=sovereign;bindControls();renderBudget();renderHeadlineFigures();renderDemography();initBenchmark();let timer;new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{renderBudget();renderDemography();renderBenchmark()},120)}).observe(document.body)}).catch(error=>{document.body.classList.add("data-error");console.error(error);$(".hero-copy").textContent="Datová vrstva se nepodařila načíst. Obnovte prosím stránku."});
