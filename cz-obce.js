const state = { data: null, level: "municipality", selectedId: "CZ:00064581", metric: "cash_to_expense", query: "", expanded: false };
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

const metrics = {
  cash_to_expense: { label: "Krytí výdajů hotovostí", short: "Krytí hotovostí", kind: "percent", value: (e) => e.ratios.cash_to_expense || 0 },
  cash_current: { label: "Peníze a vklady", short: "Hotovost", kind: "money", value: (e) => e.amounts.cash_current },
  revenue_actual: { label: "Skutečné příjmy", short: "Příjmy", kind: "money", value: (e) => e.amounts.revenue_actual },
  capital_expense_share: { label: "Podíl kapitálových výdajů", short: "Investiční podíl", kind: "percent", value: (e) => e.ratios.capital_expense_share || 0 },
  transfer_revenue_share: { label: "Podíl transferů na příjmech", short: "Závislost na transferech", kind: "percent", value: (e) => e.ratios.transfer_revenue_share || 0 },
  balance_to_revenue: { label: "Saldo vůči příjmům", short: "Saldo / příjmy", kind: "percent", value: (e) => e.ratios.balance_to_revenue || 0 },
};

const money = (value) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", notation: "compact", maximumFractionDigits: 1 }).format(value);
const percent = (value, digits = 1) => new Intl.NumberFormat("cs-CZ", { style: "percent", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const formatMetric = (value, kind) => kind === "money" ? money(value) : percent(value);
const median = (values) => { const sorted = [...values].sort((a,b)=>a-b); const m = Math.floor(sorted.length/2); return sorted.length%2 ? sorted[m] : (sorted[m-1]+sorted[m])/2; };
const percentile = (value, values) => Math.round(((values.filter((v)=>v<value).length + .5*values.filter((v)=>v===value).length) / values.length) * 100);

function cohort() {
  return state.data.entities.filter((entity) => entity.administrative_levels.includes(state.level));
}
function selected() {
  return cohort().find((entity) => entity.entity_id === state.selectedId) || cohort()[0];
}
function sorted() {
  const metric = metrics[state.metric];
  return [...cohort()].sort((a,b)=>metric.value(b)-metric.value(a));
}
function selectEntity(id) {
  state.selectedId = id;
  render();
}

function renderContext() {
  const entities = cohort();
  const isRegion = state.level === "region";
  const totals = entities.reduce((sum,e)=>({
    revenue: sum.revenue + e.amounts.revenue_actual,
    expense: sum.expense + e.amounts.expense_actual,
    cash: sum.cash + e.amounts.cash_current,
  }), {revenue:0,expense:0,cash:0});
  $("#level-kicker").textContent = isRegion ? "Všech 14 krajů včetně Prahy" : "Všech 27 statutárních měst včetně Prahy";
  $("#hero-copy").textContent = isRegion
    ? "Daňové a nedaňové příjmy, transfery, výdaje a peníze na účtech všech 14 krajů."
    : "Příjmy, výdaje a peníze na účtech 27 statutárních měst v jednom srovnatelném pohledu.";
  $("#hero-count").textContent = entities.length;
  $("#total-revenue").textContent = money(totals.revenue);
  $("#total-revenue-note").textContent = `${entities.length} subjektů · skutečnost`;
  $("#total-expense").textContent = money(totals.expense);
  $("#total-expense-note").textContent = `${percent(totals.expense/totals.revenue)} příjmů`;
  $("#total-cash").textContent = money(totals.cash);
  $("#total-cash-note").textContent = `${percent(totals.cash/totals.expense)} ročních výdajů`;
  $("#coverage").textContent = `${entities.length} / ${entities.length}`;
  $("#table-title").textContent = isRegion ? "Všechny kraje" : "Všechna statutární města";
  $("#entity-column").textContent = isRegion ? "Kraj" : "Město";
  $("#risk-column").textContent = isRegion ? "Typ" : "K–Index";
  $("#cohort-code").textContent = isRegion ? "CZ_REGIONS_2025" : "CZ_STATUTORY_2025";
}

function renderRanking() {
  const metric = metrics[state.metric], entities = sorted(), max = Math.max(...entities.map(metric.value),1);
  $("#ranking-title").textContent = metric.short;
  $("#ranking-count").textContent = `TOP ${Math.min(10,entities.length)} / ${entities.length}`;
  $("#rank-list").innerHTML = entities.slice(0,10).map((entity,index)=>{
    const value=metric.value(entity);
    return `<button class="rank-row${entity.entity_id===state.selectedId?" active":""}" data-id="${esc(entity.entity_id)}"><span class="position">${String(index+1).padStart(2,"0")}</span><strong>${esc(entity.short_name)}</strong><span class="rank-track"><i style="width:${Math.max(3,value/max*100)}%"></i></span><span class="rank-value">${esc(formatMetric(value,metric.kind))}</span></button>`;
  }).join("");
  document.querySelectorAll(".rank-row").forEach((row)=>row.addEventListener("click",()=>selectEntity(row.dataset.id)));
}

function renderProfile() {
  const entity=selected(), entities=cohort(), metric=metrics[state.metric], value=metric.value(entity), values=entities.map(metric.value), rank=percentile(value,values), isRegion=state.level==="region";
  $("#entity-select").innerHTML=[...entities].sort((a,b)=>a.short_name.localeCompare(b.short_name,"cs")).map((e)=>`<option value="${esc(e.entity_id)}">${esc(e.short_name)}</option>`).join("");
  $("#entity-select").value=entity.entity_id;
  $("#detail-title").textContent=`${entity.short_name} pod lupou`;
  const badge=isRegion
    ? `<div class="risk-badge region-badge"><span>Úroveň</span><strong>KRAJ</strong><small>krajský rozpočet</small></div>`
    : `<div class="risk-badge"><span>K–Index</span><strong>${esc(entity.risk.grade||"—")}</strong><small>${entity.risk.score==null?"bez skóre":esc(entity.risk.score.toLocaleString("cs-CZ"))}</small></div>`;
  $("#entity-profile").innerHTML=`
    <div class="city-title"><div><span class="country-flag">CZ</span><h3>${esc(entity.short_name)}</h3><p>IČO ${esc(entity.national_id)} · ${isRegion?"kraj":"statutární město"}</p></div>${badge}</div>
    <div class="city-kpis">
      <div><span>Příjmy</span><strong>${money(entity.amounts.revenue_actual)}</strong><small>${percent(entity.ratios.revenue_execution||0)} upraveného rozpočtu</small></div>
      <div><span>Výdaje</span><strong>${money(entity.amounts.expense_actual)}</strong><small>${percent(entity.ratios.expense_execution||0)} upraveného rozpočtu</small></div>
      <div><span>Peníze a vklady</span><strong>${money(entity.amounts.cash_current)}</strong><small class="${(entity.ratios.cash_yoy||0)<0?"negative":"positive"}">${percent(entity.ratios.cash_yoy||0)} meziročně</small></div>
      <div><span>Saldo</span><strong class="${entity.amounts.budget_balance<0?"negative":"positive"}">${money(entity.amounts.budget_balance)}</strong><small>${percent(entity.ratios.balance_to_revenue||0)} příjmů</small></div>
    </div>
    <div class="percentile-callout"><div><span>Percentil v metrice</span><strong>${rank}.</strong></div><div class="percentile-track"><span style="width:${rank}%"></span></div><p>${esc(metric.label)}: <b>${esc(formatMetric(value,metric.kind))}</b>. Medián kohorty je ${esc(formatMetric(median(values),metric.kind))}.</p></div>`;
}

function renderBenchmarks() {
  const entity=selected(), entities=cohort();
  const rows=[
    ["Krytí výdajů hotovostí",entity.ratios.cash_to_expense||0,entities.map(e=>e.ratios.cash_to_expense||0)],
    ["Podíl kapitálových výdajů",entity.ratios.capital_expense_share||0,entities.map(e=>e.ratios.capital_expense_share||0)],
    ["Podíl transferů na příjmech",entity.ratios.transfer_revenue_share||0,entities.map(e=>e.ratios.transfer_revenue_share||0)],
    ["Saldo vůči příjmům",entity.ratios.balance_to_revenue||0,entities.map(e=>e.ratios.balance_to_revenue||0)],
  ];
  $("#benchmark-bars").innerHTML=rows.map(([label,value,values])=>{const rank=percentile(value,values);return `<div class="benchmark-row"><div><strong>${esc(label)}</strong><span>${percent(value)}</span></div><div class="benchmark-track"><i class="q1"></i><i class="median-line"></i><b style="left:calc(${rank}% - 6px)"></b></div><small>${rank}. percentil</small></div>`;}).join("");
}

function renderMix() {
  const entity=selected();
  const mix=[
    {label:"Daňové",value:entity.amounts.tax_revenue,color:"#b8ff5a"},
    {label:"Transfery",value:entity.amounts.transfer_revenue,color:"#86b6ff"},
    {label:"Nedaňové",value:entity.amounts.nontax_revenue,color:"#ffb36b"},
    {label:"Kapitálové",value:entity.amounts.capital_revenue,color:"#8298d8"},
  ], total=mix.reduce((s,i)=>s+i.value,0);
  let running=0;
  const gradient=mix.map((item)=>{const start=running/total*100;running+=item.value;return `${item.color} ${start}% ${running/total*100}%`;}).join(",");
  const cap=entity.ratios.capital_expense_share||0;
  $("#mix-total").textContent=money(total);
  $("#mix-content").innerHTML=`<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${gradient})"><div><span>Transfery</span><strong>${percent(entity.ratios.transfer_revenue_share||0)}</strong></div></div><div class="mix-legend">${mix.map(i=>`<div><i style="background:${i.color}"></i><span>${esc(i.label)}</span><strong>${percent(i.value/total)}</strong><small>${money(i.value)}</small></div>`).join("")}</div></div><div class="expense-strip"><div><span>Běžné výdaje</span><strong>${money(entity.amounts.current_expense)}</strong></div><div><span>Kapitálové výdaje</span><strong>${money(entity.amounts.capital_expense)}</strong></div><div class="expense-bar"><span style="width:${(1-cap)*100}%;background:var(--ink)"></span><span style="width:${cap*100}%;background:var(--acid)"></span></div></div>`;
}

function renderScatter() {
  const entities=cohort(), entity=selected(), width=900,height=410,m={top:32,right:34,bottom:58,left:68};
  const xv=entities.map(e=>e.ratios.capital_expense_share||0),yv=entities.map(e=>e.ratios.cash_to_expense||0),xmax=Math.max(...xv)*1.12,ymax=Math.max(...yv)*1.12;
  const x=(v)=>m.left+v/xmax*(width-m.left-m.right), y=(v)=>height-m.bottom-v/ymax*(height-m.top-m.bottom);
  const grid=[0,.25,.5,.75,1].map(t=>`<g><line x1="${m.left}" x2="${width-m.right}" y1="${y(ymax*t)}" y2="${y(ymax*t)}" class="grid-line"></line><text x="${m.left-12}" y="${y(ymax*t)+4}" text-anchor="end" class="axis-label">${percent(ymax*t,0)}</text></g>`).join("");
  const labels=[0,.25,.5,.75,1].map(t=>`<text x="${x(xmax*t)}" y="${height-26}" text-anchor="middle" class="axis-label">${percent(xmax*t,0)}</text>`).join("");
  const points=entities.map(e=>{const active=e.entity_id===state.selectedId,cx=x(e.ratios.capital_expense_share||0),cy=y(e.ratios.cash_to_expense||0);return `<g class="scatter-city${active?" active":""}" data-id="${esc(e.entity_id)}"><circle cx="${cx}" cy="${cy}" r="${active?9:5.5}"><title>${esc(e.short_name)}</title></circle>${active?`<text x="${cx+13}" y="${cy-10}">${esc(e.short_name)}</text>`:""}</g>`;}).join("");
  $("#scatter-wrap").innerHTML=`<svg viewBox="0 0 ${width} ${height}">${grid}${labels}<line x1="${x(median(xv))}" x2="${x(median(xv))}" y1="${m.top}" y2="${height-m.bottom}" class="median-guide"></line><line x1="${m.left}" x2="${width-m.right}" y1="${y(median(yv))}" y2="${y(median(yv))}" class="median-guide"></line><text x="${width/2}" y="${height-4}" text-anchor="middle" class="axis-title">Podíl kapitálových výdajů →</text>${points}</svg><div class="scatter-insight"><span>Vybraný subjekt</span><strong>${esc(entity.short_name)}</strong><div><span>Krytí výdajů</span><b>${percent(entity.ratios.cash_to_expense||0)}</b></div><div><span>Investiční podíl</span><b>${percent(entity.ratios.capital_expense_share||0)}</b></div><small>Přerušované čáry = medián kohorty</small></div>`;
  document.querySelectorAll(".scatter-city").forEach((point)=>point.addEventListener("click",()=>selectEntity(point.dataset.id)));
}

function renderTable() {
  const metric=metrics[state.metric],query=state.query.toLocaleLowerCase("cs"),filtered=sorted().filter(e=>e.short_name.toLocaleLowerCase("cs").includes(query)),visible=state.expanded||query?filtered:filtered.slice(0,10),isRegion=state.level==="region";
  $("#sort-label").textContent=metric.label; $("#metric-column").textContent=metric.short;
  $("#entity-table").innerHTML=visible.map((e,index)=>`<tr class="${e.entity_id===state.selectedId?"selected-row":""}" data-id="${esc(e.entity_id)}"><td>${String(index+1).padStart(2,"0")}</td><td><strong>${esc(e.short_name)}</strong><small>${isRegion?"kraj":"statutární město"}</small></td><td>${esc(e.national_id)}</td><td>${money(e.amounts.revenue_actual)}</td><td>${money(e.amounts.expense_actual)}</td><td>${money(e.amounts.cash_current)}</td><td><strong>${formatMetric(metric.value(e),metric.kind)}</strong></td><td>${isRegion?"kraj":esc(e.risk.grade||"—")}<small>${!isRegion&&e.risk.score!=null?esc(e.risk.score.toLocaleString("cs-CZ")):""}</small></td></tr>`).join("");
  document.querySelectorAll("#entity-table tr").forEach(row=>row.addEventListener("click",()=>selectEntity(row.dataset.id)));
  $("#expand-button").hidden=Boolean(query)||filtered.length<=10;
  $("#expand-button").textContent=state.expanded?"Zobrazit TOP 10 ↑":`Zobrazit všech ${filtered.length} ↓`;
}

function render() { renderContext(); renderRanking(); renderProfile(); renderBenchmarks(); renderMix(); renderScatter(); renderTable(); }

fetch("data/benchmark.v1.json").then(r=>{if(!r.ok)throw new Error("Dataset není dostupný");return r.json();}).then(data=>{
  state.data=data;
  $("#schema-version").textContent=data.schema_version;
  $("#metric-select").innerHTML=Object.entries(metrics).map(([key,m])=>`<option value="${key}">${esc(m.label)}</option>`).join("");
  $("#level-select").addEventListener("change",(event)=>{state.level=event.target.value;if(!cohort().some(e=>e.entity_id===state.selectedId))state.selectedId=cohort()[0].entity_id;state.expanded=false;render();});
  $("#metric-select").addEventListener("change",(event)=>{state.metric=event.target.value;render();});
  $("#entity-select").addEventListener("change",(event)=>selectEntity(event.target.value));
  $("#search-input").addEventListener("input",(event)=>{state.query=event.target.value;renderTable();});
  $("#expand-button").addEventListener("click",()=>{state.expanded=!state.expanded;renderTable();});
  render();
}).catch(error=>{document.body.classList.add("data-error");$("#hero-copy").textContent="Data se nepodařilo načíst.";console.error(error);});
