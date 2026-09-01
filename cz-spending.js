(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const state = {data:null, group:"all", expenseGroup:"social", chapterQuery:"", chapterSort:"amount"};
  const lang = () => document.documentElement.lang === "en" ? "en" : "cs";
  const label = item => item[`label_${lang()}`] || item.label_cs;
  const locale = () => lang() === "en" ? "en-GB" : "cs-CZ";
  const bn = value => lang() === "en" ? `CZK ${Number(value).toLocaleString(locale(), {minimumFractionDigits:value < 1 ? 2 : 1, maximumFractionDigits:value < 1 ? 2 : 1})}bn` : `${Number(value).toLocaleString(locale(), {minimumFractionDigits:value < 1 ? 2 : 1, maximumFractionDigits:value < 1 ? 2 : 1})} mld. Kč`;
  const pct = value => `${Number(value).toLocaleString(locale(), {minimumFractionDigits:1,maximumFractionDigits:1})} %`;
  const copy = () => lang() === "en" ? {
    all:"All purposes", search:"Search a ministry or chapter", noRows:"No chapter matches this search.",
    ofBudget:"of all expenditure", each100:"CZK out of every CZK 100", more:"more than 2025", less:"less than 2025",
    groups:"Purpose groups", amount:"2026 amount", change:"Change vs 2025", chapter:"Chapter", showAll:"All 47 chapters"
  } : {
    all:"Všechny účely", search:"Hledat ministerstvo nebo kapitolu", noRows:"Tomuto hledání neodpovídá žádná kapitola.",
    ofBudget:"ze všech výdajů", each100:"Kč z každých 100 Kč", more:"více než 2025", less:"méně než 2025",
    groups:"Skupiny účelů", amount:"Částka 2026", change:"Změna proti 2025", chapter:"Kapitola", showAll:"Všech 47 kapitol"
  };

  function renderPurpose() {
    const d=state.data, total=d.total_expenditure_including_eu_fm_czk/1e9, groups=new Map(d.functional_groups.map(g=>[g.id,g]));
    const rows=d.functional.filter(row=>state.group==="all"||row.group===state.group).sort((a,b)=>b.amount_czk_bn-a.amount_czk_bn);
    const max=Math.max(...rows.map(row=>row.amount_czk_bn),1);
    const groupTotals=d.functional_groups.map(group=>({group,value:d.functional.filter(row=>row.group===group.id).reduce((sum,row)=>sum+row.amount_czk_bn,0)}));
    $("#spending-domain-strip").innerHTML=groupTotals.map(({group,value})=>`<button type="button" data-spending-group="${group.id}" style="--share:${value/total*100}%;--group:${group.color}" title="${esc(label(group))}: ${bn(value)}"><span>${esc(label(group))}</span><b>${pct(value/total*100)}</b></button>`).join("");
    $("#spending-group-tabs").innerHTML=`<button type="button" data-group="all" aria-pressed="${state.group==="all"}">${copy().all}</button>${d.functional_groups.map(group=>`<button type="button" data-group="${group.id}" aria-pressed="${state.group===group.id}"><i style="background:${group.color}"></i>${esc(label(group))}</button>`).join("")}`;
    $("#spending-purpose-rows").innerHTML=rows.map((row,index)=>{const group=groups.get(row.group),share=row.amount_czk_bn/total*100;return `<button type="button" class="spending-row" data-purpose="${row.code}"><span class="spending-rank">${String(index+1).padStart(2,"0")}</span><span class="spending-name">${esc(label(row))}<small>${esc(label(group))}</small></span><span class="spending-track"><i style="width:${row.amount_czk_bn/max*100}%;background:${group.color}"></i></span><strong>${bn(row.amount_czk_bn)}</strong><em>${pct(share)}</em></button>`}).join("");
    document.querySelectorAll("[data-group]").forEach(button=>button.onclick=()=>{state.group=button.dataset.group;renderPurpose()});
    document.querySelectorAll("[data-spending-group]").forEach(button=>button.onclick=()=>{state.group=button.dataset.spendingGroup;renderPurpose()});
    document.querySelectorAll("[data-purpose]").forEach(button=>button.onclick=()=>renderPurposeDetail(button.dataset.purpose));
    renderPurposeDetail(rows[0]?.code);
  }

  function renderPurposeDetail(code) {
    const row=state.data.functional.find(item=>item.code===code); if(!row)return;
    const total=state.data.total_expenditure_including_eu_fm_czk/1e9, share=row.amount_czk_bn/total*100;
    $("#spending-purpose-detail").innerHTML=`<span>${esc(label(row))}</span><strong>${bn(row.amount_czk_bn)}</strong><p><b>${pct(share)}</b> ${copy().ofBudget} · ${share.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1})} ${copy().each100}</p>`;
    document.querySelectorAll("[data-purpose]").forEach(button=>button.classList.toggle("active",button.dataset.purpose===code));
  }

  function renderChapters() {
    const total=state.data.chapter_total_excluding_eu_fm_czk, q=state.chapterQuery.trim().toLocaleLowerCase(locale());
    let rows=state.data.chapters.map(row=>({...row,delta:row.amount_2026_czk-row.amount_2025_czk,deltaPct:row.amount_2025_czk?(row.amount_2026_czk/row.amount_2025_czk-1)*100:0})).filter(row=>!q||`${row.code} ${label(row)}`.toLocaleLowerCase(locale()).includes(q));
    rows.sort(state.chapterSort==="change"?(a,b)=>Math.abs(b.delta)-Math.abs(a.delta):(a,b)=>b.amount_2026_czk-a.amount_2026_czk);
    const max=Math.max(...rows.map(row=>row.amount_2026_czk),1);
    $("#spending-chapter-rows").innerHTML=rows.length?rows.map((row,index)=>`<button type="button" class="chapter-row" data-chapter="${row.code}"><span class="chapter-rank">${String(index+1).padStart(2,"0")}</span><span class="chapter-name"><b>${row.code}</b>${esc(label(row))}</span><span class="chapter-pair"><i class="chapter-2025" style="width:${row.amount_2025_czk/max*100}%"></i><i class="chapter-2026" style="width:${row.amount_2026_czk/max*100}%"></i></span><strong>${bn(row.amount_2026_czk/1e9)}</strong><em class="${row.delta>=0?"up":"down"}">${row.delta>=0?"+":"−"}${bn(Math.abs(row.delta)/1e9)}</em></button>`).join(""):`<p class="spending-empty">${copy().noRows}</p>`;
    $("#spending-chapter-count").textContent=`${rows.length} / ${state.data.chapters.length}`;
    document.querySelectorAll("[data-chapter]").forEach(button=>button.onclick=()=>renderChapterDetail(+button.dataset.chapter));
    renderChapterDetail(rows[0]?.code);
  }

  function renderChapterDetail(code) {
    const row=state.data.chapters.find(item=>item.code===code); if(!row)return;
    const delta=row.amount_2026_czk-row.amount_2025_czk, share=row.amount_2026_czk/state.data.chapter_total_excluding_eu_fm_czk*100;
    $("#spending-chapter-detail").innerHTML=`<span>${row.code} · ${esc(label(row))}</span><strong>${bn(row.amount_2026_czk/1e9)}</strong><p>${pct(share)} ${copy().ofBudget} ${lang()==="en"?"excluding EU funds":"bez EU/FM"} · <b class="${delta>=0?"up":"down"}">${delta>=0?"+":"−"}${bn(Math.abs(delta)/1e9)}</b> ${delta>=0?copy().more:copy().less}</p>`;
    document.querySelectorAll("[data-chapter]").forEach(button=>button.classList.toggle("active",+button.dataset.chapter===code));
  }

  function renderSummary() {
    const d=state.data,total=d.total_expenditure_including_eu_fm_czk/1e9,sorted=[...d.functional].sort((a,b)=>b.amount_czk_bn-a.amount_czk_bn),top5=sorted.slice(0,5).reduce((sum,row)=>sum+row.amount_czk_bn,0),pensions=d.functional.find(row=>row.code==="pensions").amount_czk_bn,gap=total-d.chapter_total_excluding_eu_fm_czk/1e9;
    $("#spending-total").textContent=bn(total); $("#spending-pension").textContent=bn(pensions); $("#spending-pension-share").textContent=pct(pensions/total*100); $("#spending-top5").textContent=pct(top5/total*100); $("#spending-eu").textContent=bn(gap);
  }

  function renderExpenditurePie() {
    if (!window.PSDBudgetStructure?.renderFinanceDonut) return;
    const d=state.data,total=d.total_expenditure_including_eu_fm_czk/1e9;
    const slices=d.functional_groups.map(group=>({
      key:group.id,label:label(group),color:group.color,
      value:d.functional.filter(row=>row.group===group.id).reduce((sum,row)=>sum+row.amount_czk_bn,0),
    }));
    const english=lang()==="en";
    window.PSDBudgetStructure.renderFinanceDonut({
      containerId:"expenditure-pie-chart",legendId:"expenditure-pie-legend",detailId:"expenditure-pie-detail",
      slices,total,selectedKey:state.expenseGroup,totalUnit:english?"CZK bn":"mld. Kč",
      source:english?"Source: Czech Ministry of Finance":"Zdroj: MF ČR",
      formatAmount:bn,
      onSelect:key=>{state.expenseGroup=key;renderExpenditurePie()},
      detailHTML:(slice,budgetTotal)=>{
        const purposes=d.functional.filter(row=>row.group===slice.key).sort((a,b)=>b.amount_czk_bn-a.amount_czk_bn);
        const rows=purposes.map(row=>`<button type="button" data-overview-purpose="${esc(row.code)}" data-overview-group="${esc(row.group)}"><span>${esc(label(row))}</span><b>${bn(row.amount_czk_bn)}</b><small>${pct(row.amount_czk_bn/budgetTotal*100)}</small></button>`).join("");
        return `<div class="finance-detail-head"><i style="background:${slice.color}"></i><div><span>${esc(slice.label)}</span><strong>${bn(slice.value)}</strong></div><b>${pct(slice.value/budgetTotal*100)}</b></div><p>${english?`${purposes.length} of the 30 expenditure purposes. Choose a line to open it in the complete ledger.`:`${purposes.length} z 30 výdajových účelů. Vyberte řádek a otevřete jej v úplném přehledu.`}</p><div class="finance-purpose-list">${rows}</div><a href="#utraceni">${english?"Open all 30 purposes ↓":"Otevřít všech 30 účelů ↓"}</a>`;
      },
    });
    document.querySelectorAll("[data-overview-purpose]").forEach(button=>button.onclick=()=>{
      state.group=button.dataset.overviewGroup;
      renderPurpose();
      renderPurposeDetail(button.dataset.overviewPurpose);
      document.getElementById("utraceni")?.scrollIntoView({behavior:"smooth"});
    });
  }

  function render() { if(!state.data)return; renderSummary(); renderExpenditurePie(); renderPurpose(); renderChapters(); }
  fetch("data/cz-spending-2026.v1.json").then(response=>{if(!response.ok)throw new Error("Czech spending data failed to load");return response.json()}).then(data=>{
    state.data=data;
    const search=$("#spending-chapter-search"),sort=$("#spending-chapter-sort");
    search.placeholder=copy().search; search.oninput=()=>{state.chapterQuery=search.value;renderChapters()};
    sort.onchange=()=>{state.chapterSort=sort.value;renderChapters()}; render();
    new MutationObserver(()=>{search.placeholder=copy().search;render()}).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  }).catch(error=>{console.error(error);$("#spending-purpose-rows").innerHTML=`<p class="spending-empty">${esc(error.message)}</p>`});
})();
