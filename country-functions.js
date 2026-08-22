(() => {
  const state={code:new URLSearchParams(location.search).get("code")||"CZE",lang:document.documentElement.lang==="en"?"en":"cs",data:null};
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const locale=()=>state.lang==="en"?"en-GB":"cs-CZ";
  const copy={
    cs:{
      health:{number:"05",kicker:"Rozpočet zdravotnictví",title:"Deset let zdraví.",copy:"Kolik veřejné rozpočty vydávají na zdravotnictví a jak se pozice země změnila od roku 2015."},
      social:{number:"07",kicker:"Sociální systém",title:"Ochrana v rozpočtu.",copy:"Starobní a pozůstalostní důchody, rodina, nezaměstnanost, nemoc, bydlení a sociální vyloučení v jedné funkční řadě."},
      transport:{number:"08",kicker:"Rozpočty dopravy",title:"Desetiletí pohybu.",copy:"Silnice, železnice, veřejná doprava a další dopravní výdaje v letech 2015–2024."},
      latest:"Poslední rok",change:"Změna 2015–2024",average:"Průměr 10 let",scope:"Rozsah dat",trend:"Vývoj vybrané země",comparison:"Srovnání 10 zemí",country:"Země",value:"% HDP",dataYear:"Rok dat",method:"Metodika a rozsah",source:"Primární zdroje",pp:"p. b.",general:"Vládní instituce",consolidated:"Konsolidovaný rozpočet",mixed:"Vládní instituce / federální doprava",selected:"Vybraná země",year:"Rok",amount:"Podíl na HDP"
    },
    en:{
      health:{number:"05",kicker:"Health budget",title:"Ten years of health.",copy:"How much public budgets spend on health and how the country's position has changed since 2015."},
      social:{number:"07",kicker:"Social system",title:"Protection in the budget.",copy:"Old age and survivors, family, unemployment, sickness, housing and social exclusion in one functional series."},
      transport:{number:"08",kicker:"Transport budgets",title:"A decade of movement.",copy:"Road, rail, public transport and other transport expenditure from 2015 to 2024."},
      latest:"Latest year",change:"Change 2015–2024",average:"10-year average",scope:"Data scope",trend:"Selected-country trend",comparison:"10-country comparison",country:"Country",value:"% GDP",dataYear:"Data year",method:"Method and scope",source:"Primary sources",pp:"pp",general:"General government",consolidated:"Consolidated budget",mixed:"General government / federal transport",selected:"Selected country",year:"Year",amount:"Share of GDP"
    }
  };
  const scopeLabel=(country,category)=>{
    const t=copy[state.lang];
    if(country.scope==="consolidated_budget")return t.consolidated;
    if(country.scope==="mixed_by_category"&&category==="transport")return state.lang==="en"?"Federal budget":"Federální rozpočet";
    return t.general;
  };
  const number=(value,digits=1)=>Number(value).toLocaleString(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const signed=value=>`${value>0?"+":""}${number(value)} ${copy[state.lang].pp}`;
  const seriesFor=(code,category)=>state.data.countries[code].categories[category];
  const latest=(code,category)=>seriesFor(code,category).at(-1);
  function bars(series,category){
    const max=Math.max(...series.map(point=>point.pct_gdp));
    return `<div class="function-bars" role="img" aria-label="${esc(copy[state.lang][category].kicker)} 2015–2024">${series.map(point=>`<div class="function-bar-column"><span class="function-bar-value">${number(point.pct_gdp)}%</span><i style="height:${Math.max(5,point.pct_gdp/max*100)}%" title="${point.year}: ${number(point.pct_gdp)}%"></i><b>${point.year}</b></div>`).join("")}</div>`;
  }
  function renderCategory(category){
    const root=$(`#country-function-${category}`); if(!root)return;
    const t=copy[state.lang], meta=t[category], country=state.data.countries[state.code], series=seriesFor(state.code,category), first=series[0], last=series.at(-1), change=last.pct_gdp-first.pct_gdp, average=series.reduce((sum,point)=>sum+point.pct_gdp,0)/series.length;
    const rows=Object.entries(state.data.countries).map(([code,item])=>({code,item,last:latest(code,category),change:latest(code,category).pct_gdp-seriesFor(code,category)[0].pct_gdp})).sort((a,b)=>b.last.pct_gdp-a.last.pct_gdp);
    root.innerHTML=`
      <div class="detail-heading"><div><span class="kicker">${meta.number} / ${esc(meta.kicker)}</span><h2 id="country-function-${category}-title">${esc(meta.title)}</h2></div><p>${esc(meta.copy)}</p></div>
      <div class="function-kpis"><article><span>${t.latest} · ${last.year}</span><strong>${number(last.pct_gdp)}%</strong><small>${t.value}</small></article><article><span>${t.change}</span><strong class="${change>=0?"positive":"negative"}">${signed(change)}</strong><small>${first.year} → ${last.year}</small></article><article><span>${t.average}</span><strong>${number(average)}%</strong><small>2015–2024</small></article><article><span>${t.scope}</span><strong>${esc(scopeLabel(country,category))}</strong><small>${esc(country.currency)}</small></article></div>
      <div class="function-grid"><article class="function-trend"><header><span>${t.trend}</span><strong>${esc(country[`name_${state.lang}`])}</strong></header>${bars(series,category)}</article>
      <article class="function-ranking"><header><span>${t.comparison}</span><strong>${last.year}</strong></header><div class="function-table-wrap"><table><thead><tr><th>${t.country}</th><th>${t.value}</th><th>${t.change}</th><th>${t.scope}</th><th>${t.dataYear}</th></tr></thead><tbody>${rows.map(row=>`<tr class="${row.code===state.code?"selected":""}"><td data-sort-value="${esc(row.item[`name_${state.lang}`])}"><b>${esc(row.item[`name_${state.lang}`])}</b>${row.code===state.code?`<small>${t.selected}</small>`:""}</td><td data-sort-value="${row.last.pct_gdp}">${number(row.last.pct_gdp)}%</td><td data-sort-value="${row.change}">${signed(row.change)}</td><td>${esc(scopeLabel(row.item,category))}</td><td data-sort-value="${row.last.year}">${row.last.year}</td></tr>`).join("")}</tbody></table></div></article></div>
      <details class="function-method"><summary>${t.method}</summary><p>${esc(state.data.methodology[state.lang])}</p><div>${state.data.sources.filter(source=>source.id!=="us-omb"||category==="transport").map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("")}</div></details>`;
  }
  function render(){if(!state.data||!state.data.countries[state.code])return;["health","social","transport"].forEach(renderCategory)}
  addEventListener("countryprofilechange",event=>{state.code=event.detail.code;state.lang=event.detail.lang==="en"?"en":"cs";render()});
  fetch("data/country-functional-budgets.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json()}).then(data=>{state.data=data;render()}).catch(error=>console.error("Country functional budgets",error));
})();
