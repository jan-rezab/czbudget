(() => {
  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "/";
  const profileUrl = document.body.dataset.profileUrl;
  const requested = new URLSearchParams(location.search).get("lang");
  let lang = requested === "cs" || requested === "en" ? requested : (document.documentElement.lang === "en" ? "en" : "cs");
  let profile;
  let detailQuery="",detailStage="all",detailShown=400;
  const copy = {
    cs:{europe:"Evropa",municipalities:"Obce",official:"oficiální obecní finance",code:"Národní kód",latest:"Poslední období",revenue:"Příjmy",expenditure:"Výdaje",balance:"Saldo",debt:"Dluh",historyKicker:"Historie",detailKicker:"Původní detail",history:"Rozpočtová historie",historyCopy:"Nominální místní měna. Fáze a původní klasifikace zůstávají oddělené.",year:"Rok",detail:"Položkový detail",detailCopy:"Původní kódy a názvy z národního zdroje; bez skrytého přemapování.",stage:"Fáze",allStages:"Všechny fáze",side:"Strana",account:"Kód / položka",amount:"Částka",search:"Hledat položku",searchPlaceholder:"Kód nebo název…",shown:"zobrazeno",more:"Načíst další položky",source:"Oficiální zdroj ↗",noValue:"Není v načtené národní vrstvě"},
    en:{europe:"Europe",municipalities:"Municipalities",official:"official municipal finance",code:"National code",latest:"Latest period",revenue:"Revenue",expenditure:"Expenditure",balance:"Balance",debt:"Debt",historyKicker:"History",detailKicker:"Native detail",history:"Budget history",historyCopy:"Nominal local currency. Stages and native classifications remain separate.",year:"Year",detail:"Item-level detail",detailCopy:"Original codes and labels from the national source, without hidden remapping.",stage:"Stage",allStages:"All stages",side:"Side",account:"Code / item",amount:"Amount",search:"Search items",searchPlaceholder:"Code or label…",shown:"shown",more:"Load more items",source:"Official source ↗",noValue:"Not available in the loaded national layer"}
  };
  const countries={DNK:{cs:"Dánsko",en:"Denmark",slug:"denmark"},BRA:{cs:"Brazílie",en:"Brazil",slug:"brazil"},ESP:{cs:"Španělsko",en:"Spain",slug:"spain"},JPN:{cs:"Japonsko",en:"Japan",slug:"japan"}};
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const money=value=>Number.isFinite(Number(value))?new Intl.NumberFormat(lang==="cs"?"cs-CZ":"en-GB",{style:"currency",currency:profile.currency,notation:"compact",maximumFractionDigits:2}).format(Number(value)):"—";
  function renderDetail(){
    if(!profile)return;
    const t=copy[lang],query=detailQuery.trim().toLocaleLowerCase(),rows=profile.detail.filter(row=>(detailStage==="all"||row.stage===detailStage)&&(!query||[row.code,row.name,row.column,row.table_title,row.side].some(value=>String(value||"").toLocaleLowerCase().includes(query))));
    document.querySelector("#profile-detail").innerHTML=`<thead><tr><th>${t.year}</th><th>${t.stage}</th><th>${t.side}</th><th>${t.account}</th><th>${t.amount}</th></tr></thead><tbody>${rows.slice(0,detailShown).map(row=>`<tr><td>${row.year}</td><td>${esc(row.stage)}</td><td>${esc(row.side||row.table_title||"")}</td><td><b>${esc(row.code)}</b><small>${esc(row.name||row.column||"")}</small></td><td>${money(row.amount)}</td></tr>`).join("")}</tbody>`;
    document.querySelector("#profile-detail-count").textContent=`${new Intl.NumberFormat(lang==="cs"?"cs-CZ":"en-GB").format(Math.min(detailShown,rows.length))} / ${new Intl.NumberFormat(lang==="cs"?"cs-CZ":"en-GB").format(rows.length)} ${t.shown}`;
    const more=document.querySelector("#profile-detail-more");more.textContent=t.more;more.hidden=detailShown>=rows.length;
  }
  function render(){
    const t=copy[lang],country=countries[profile.country],latest=profile.history.find(row=>row.year===Math.max(...profile.history.map(item=>item.year)))||profile.history.at(-1)||{};
    document.documentElement.lang=lang; document.title=`${profile.name} — ${country[lang]} — Public Spending Data`;
    document.querySelectorAll("[data-lang]").forEach(button=>{const active=button.dataset.lang===lang;button.classList.toggle("active",active);button.setAttribute("aria-pressed",active)});
    document.querySelector("#profile-breadcrumbs").innerHTML=`<a href="${assetRoot}municipalities/?lang=${lang}">${t.europe}</a><span>›</span><a href="${assetRoot}municipalities/${country.slug}/?lang=${lang}">${country[lang]}</a><span>›</span><strong>${esc(profile.name)}</strong>`;
    document.querySelector("#profile-hero").innerHTML=`<div><span class="eyebrow"><i class="live-dot"></i>${esc(country[lang])} · ${t.official}</span><h1>${esc(profile.name)}</h1><p>${t.code} ${esc(profile.code)}${profile.region?` · ${esc(profile.region)}`:""}</p></div><aside><span>${t.latest}</span><strong>${latest.year||"—"}</strong><small>${esc(profile.currency)}</small></aside>`;
    document.querySelector("#profile-kpis").innerHTML=[[t.revenue,latest.revenue],[t.expenditure,latest.expenditure],[t.balance,latest.balance],[t.debt,latest.debt]].map(([label,value])=>`<article><span>${label}</span><strong>${money(value)}</strong><small>${Number.isFinite(Number(value))?latest.year:t.noValue}</small></article>`).join("");
    document.querySelector("#profile-history-kicker").textContent=t.historyKicker; document.querySelector("#profile-detail-kicker").textContent=t.detailKicker; document.querySelector("#profile-history-title").textContent=t.history; document.querySelector("#profile-history-copy").textContent=t.historyCopy;
    document.querySelector("#profile-history").innerHTML=`<thead><tr><th>${t.year}</th><th>${t.revenue}</th><th>${t.expenditure}</th><th>${t.balance}</th><th>${t.debt}</th></tr></thead><tbody>${[...profile.history].reverse().map(row=>`<tr><th>${row.year}</th><td>${money(row.revenue)}</td><td>${money(row.expenditure)}</td><td>${money(row.balance)}</td><td>${money(row.debt)}</td></tr>`).join("")}</tbody>`;
    document.querySelector("#profile-detail-title").textContent=t.detail; document.querySelector("#profile-detail-copy").textContent=t.detailCopy;
    document.querySelector("#profile-detail-search-label").textContent=t.search;const search=document.querySelector("#profile-detail-search");search.placeholder=t.searchPlaceholder;search.value=detailQuery;
    document.querySelector("#profile-detail-stage-label").textContent=t.stage;const stage=document.querySelector("#profile-detail-stage"),stages=[...new Set(profile.detail.map(row=>row.stage).filter(Boolean))];stage.innerHTML=`<option value="all">${t.allStages}</option>${stages.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join("")}`;stage.value=detailStage;
    renderDetail();
    const source=document.querySelector("#profile-source"); source.href=document.body.dataset.source; source.textContent=t.source;
  }
  document.querySelectorAll("[data-lang]").forEach(button=>button.addEventListener("click",()=>{lang=button.dataset.lang;history.replaceState(null,"",`?lang=${lang}`);render()}));
  document.querySelector("#profile-detail-search").addEventListener("input",event=>{detailQuery=event.target.value;detailShown=400;renderDetail()});
  document.querySelector("#profile-detail-stage").addEventListener("change",event=>{detailStage=event.target.value;detailShown=400;renderDetail()});
  document.querySelector("#profile-detail-more").addEventListener("click",()=>{detailShown+=400;renderDetail()});
  fetch(profileUrl).then(response=>{if(!response.ok)throw new Error(response.status);return response.json()}).then(data=>{profile=data;render()}).catch(error=>{console.error(error);document.querySelector("#profile-hero").textContent="Profile data could not be loaded."});
})();
