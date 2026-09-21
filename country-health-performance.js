(() => {
  const assetRoot=document.currentScript?.src?new URL(".",document.currentScript.src).href:"";
  const metrics={
    health_gdp_pct:{group:"spending",cs:"Výdaje na zdraví / HDP",en:"Health spending / GDP",unit:"%",digits:1},
    per_capita_ppp:{group:"spending",cs:"Výdaje na obyvatele",en:"Spending per person",unit:"intl$",digits:0},
    out_of_pocket_pct:{group:"spending",cs:"Přímé platby domácností",en:"Out-of-pocket spending",unit:"%",digits:1},
    physicians_per_1000:{group:"workforce",cs:"Lékaři na 1 000 obyvatel",en:"Physicians per 1,000",unit:"/ 1 000",digits:2},
    nurses_per_1000:{group:"workforce",cs:"Sestry na 1 000 obyvatel",en:"Nurses per 1,000",unit:"/ 1 000",digits:2},
    beds_per_1000:{group:"capacity",cs:"Lůžka na 1 000 obyvatel",en:"Beds per 1,000",unit:"/ 1 000",digits:2},
    discharges_per_100k:{group:"utilisation",cs:"Propuštění z nemocnic",en:"Hospital discharges",unit:"/ 100 000",digits:0},
    average_length_of_stay_days:{group:"utilisation",cs:"Průměrná délka pobytu",en:"Average length of stay",unit:{cs:"dní",en:"days"},digits:1},
    curative_bed_occupancy_pct:{group:"utilisation",cs:"Využití akutních lůžek",en:"Curative-bed occupancy",unit:"%",digits:1},
    life_expectancy_years:{group:"outcomes",cs:"Naděje dožití",en:"Life expectancy",unit:{cs:"let",en:"years"},digits:1},
    premature_ncd_mortality_pct:{group:"outcomes",cs:"Riziko předčasného úmrtí na NCD",en:"Premature NCD mortality risk",unit:"%",digits:1},
    suicide_rate_per_100k:{group:"outcomes",cs:"Úmrtnost sebevraždou",en:"Suicide mortality",unit:"/ 100 000",digits:1},
    under5_mortality_per_1000:{group:"outcomes",cs:"Úmrtnost do pěti let",en:"Under-five mortality",unit:"/ 1 000",digits:1},
    treatable_mortality_per_100k:{group:"outcomes",cs:"Léčitelná úmrtnost",en:"Treatable mortality",unit:"/ 100 000",digits:0},
    preventable_mortality_per_100k:{group:"outcomes",cs:"Preventabilní úmrtnost",en:"Preventable mortality",unit:"/ 100 000",digits:0}
  };
  const text={
    cs:{kicker:"06C / Kapacita, využití a výsledky",title:"Co systém za své peníze poskytuje.",lead:"Patnáct ukazatelů propojuje výdaje, personál, kapacitu, využití nemocnic a zdravotní výsledky. Každá hodnota ukazuje vlastní poslední dostupný rok.",groups:{spending:"Výdaje",workforce:"Personál",capacity:"Kapacita",utilisation:"Využití",outcomes:"Výsledky"},trend:"Vývoj země",peers:"Poslední hodnota v 17 zemích",latest:"poslední rok",noData:"Pro tento ukazatel nejsou data.",method:"Různé referenční roky nejsou dopočítány ani nahrazeny nulou.",sources:"Primární datové zdroje"},
    en:{kicker:"06C / Capacity, use and outcomes",title:"What the system delivers for its spending.",lead:"Fifteen indicators connect spending, workforce, capacity, hospital use and health outcomes. Every value carries its own latest available year.",groups:{spending:"Spending",workforce:"Workforce",capacity:"Capacity",utilisation:"Utilisation",outcomes:"Outcomes"},trend:"Country trend",peers:"Latest value across 17 countries",latest:"latest year",noData:"No data are available for this indicator.",method:"Different reference years are neither imputed nor treated as zero.",sources:"Primary data sources"}
  };
  const names={CZE:"Czechia",DEU:"Germany",DNK:"Denmark",FIN:"Finland",FRA:"France",GBR:"United Kingdom",POL:"Poland",SWE:"Sweden",CHE:"Switzerland",USA:"United States",UKR:"Ukraine",BRA:"Brazil",ESP:"Spain",JPN:"Japan",NLD:"Netherlands",NOR:"Norway",GRC:"Greece"};
  const state={data:null,code:window.PSDCountryRoutes.codeFromLocation(),lang:document.documentElement.lang==="en"?"en":"cs",group:"outcomes",metric:"life_expectancy_years"};
  const esc=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const locale=()=>state.lang==="en"?"en-GB":"cs-CZ";
  const fmt=(value,digits=1)=>Number.isFinite(Number(value))?new Intl.NumberFormat(locale(),{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(Number(value)):"—";
  const profile=()=>state.data?.countries?.[state.code];
  const entry=(country,key)=>country?.[metrics[key].group]?.[key];
  const label=key=>metrics[key]?.[state.lang]||key;
  const unit=key=>{const value=metrics[key]?.unit;return typeof value==="object"&&value?value[state.lang]||value.en:value||"";};
  const notes={per_capita_ppp:{cs:"Světová banka · HDP PPP",en:"World Bank · GDP PPP"}};
  const note=key=>notes[key]?.[state.lang]||"";

  function lineChart(host,series,meta){
    if(!series?.length){host.innerHTML=`<p class="health-performance-empty">${text[state.lang].noData}</p>`;return;}
    const metric=state.metric,language=state.lang;
    window.PSDPlotReady.then(plot=>{
      if(!host.isConnected)return;
      plot.render(host,{type:"line",rows:series.map(item=>({label:item.year,value:Number(item.value)})),fields:[{key:"value",label:metrics[metric][language],format:value=>fmt(value,meta.digits)}],title:metrics[metric][language],unit:unit(metric),locale:language==="en"?"en-GB":"cs-CZ",height:250});
    }).catch(error=>{if(host.isConnected)host.textContent=`Chart error: ${error.message}`;});
  }

  function peerBars(key){
    const meta=metrics[key],rows=Object.entries(state.data.countries).map(([code,country])=>({code,...entry(country,key)})).filter(row=>Number.isFinite(Number(row.value))).sort((a,b)=>b.value-a.value);
    if(!rows.length)return `<p class="health-performance-empty">${text[state.lang].noData}</p>`;
    const max=Math.max(...rows.map(row=>Number(row.value)));
    return `<div class="health-peer-bars">${rows.map(row=>`<div class="health-peer-row ${row.code===state.code?"selected":""}"><b>${esc(row.code)}</b><span><i style="width:${Math.max(2,row.value/max*100)}%"></i></span><strong>${fmt(row.value,meta.digits)} <small>${esc(unit(key))} · ${row.year}</small></strong></div>`).join("")}</div>`;
  }

  function render(){
    const root=document.querySelector("#country-health-performance-root"),section=document.querySelector("#health-performance"),country=profile();
    if(!root||!section||!country){if(section)section.hidden=true;return;}
    section.hidden=false;
    const t=text[state.lang],available=Object.keys(metrics).filter(key=>entry(country,key));
    if(!available.some(key=>metrics[key].group===state.group))state.group=metrics[available[0]]?.group||"outcomes";
    const groupMetrics=available.filter(key=>metrics[key].group===state.group);
    if(!groupMetrics.includes(state.metric))state.metric=groupMetrics[0];
    const selected=entry(country,state.metric),meta=metrics[state.metric];
    root.innerHTML=`<header class="health-performance-head"><div><span class="kicker">${t.kicker}</span><h2 id="health-performance-title">${t.title}</h2></div><p>${t.lead}</p></header>
      <div class="health-performance-tabs" role="tablist">${Object.keys(t.groups).map(group=>`<button type="button" role="tab" data-health-performance-group="${group}" aria-selected="${group===state.group}">${t.groups[group]}</button>`).join("")}</div>
      <div class="health-performance-cards">${groupMetrics.map(key=>{const value=entry(country,key),item=metrics[key];return `<button type="button" data-health-performance-metric="${key}" class="${key===state.metric?"selected":""}"><span>${esc(label(key))}</span><strong>${fmt(value.value,item.digits)} <small>${esc(unit(key))}</small></strong><b>${value.year}</b></button>`}).join("")}</div>
      <div class="health-performance-detail"><article><header><span>${t.trend}</span><h3>${esc(label(state.metric))}</h3><small>${state.code} · ${esc(names[state.code]||state.code)}${note(state.metric)?` · ${esc(note(state.metric))}`:""}</small></header><div data-health-trend></div></article><article><header><span>${t.peers}</span><h3>${esc(label(state.metric))}</h3><small>${t.latest}${note(state.metric)?` · ${esc(note(state.metric))}`:""}</small></header>${peerBars(state.metric)}</article></div>
      <footer class="health-performance-method"><p>${esc(state.data.methodology?.[state.lang]||t.method)}</p><div><b>${t.sources}</b>${(state.data.sources||[]).map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("")}</div></footer>`;
    root.querySelectorAll("[data-health-performance-group]").forEach(button=>button.addEventListener("click",()=>{state.group=button.dataset.healthPerformanceGroup;state.metric=available.find(key=>metrics[key].group===state.group);render();}));
    root.querySelectorAll("[data-health-performance-metric]").forEach(button=>button.addEventListener("click",()=>{state.metric=button.dataset.healthPerformanceMetric;render();}));
    lineChart(root.querySelector("[data-health-trend]"),selected.series,meta);
  }

  addEventListener("countryprofilechange",event=>{state.code=event.detail.code;state.lang=event.detail.lang==="en"?"en":"cs";render();});
  fetch(`${assetRoot}data/country-health-performance.v1.json`).then(response=>{if(!response.ok)throw new Error(response.status);return response.json();}).then(data=>{state.data=data;render();}).catch(error=>console.error("Country health performance data",error));
})();
