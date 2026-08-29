(() => {
  const ROOT=document.querySelector("#health-performance");
  if(!ROOT)return;
  const assetRoot=document.currentScript?.src?new URL(".",document.currentScript.src).href:"";
  const NAMES={CZE:["Česko","Czechia"],DEU:["Německo","Germany"],DNK:["Dánsko","Denmark"],FRA:["Francie","France"],GBR:["Spojené království","United Kingdom"],POL:["Polsko","Poland"],SWE:["Švédsko","Sweden"],CHE:["Švýcarsko","Switzerland"],UKR:["Ukrajina","Ukraine"],USA:["Spojené státy","United States"]};
  const COPY={
    cs:{
      kicker:"Lidé, provoz a výsledky",title:"Kapacita, aktivita a výsledky",intro:"Deset zemí čteme přes pracovní sílu, využití nemocnic a výsledky. Každá hodnota uvádí vlastní rok; chybějící pozorování není nula.",
      tenCountries:"10 zemí",commonSpine:"společná datová páteř",latestAvailable:"poslední dostupný rok",selected:"Vybraná země",rank:"pořadí",of:"z",median:"medián skupiny",year:"rok",missing:"není dostupné",
      life:"Naděje dožití",doctorsNurses:"Lékaři / sestry",stay:"Průměrná hospitalizace",treatable:"Léčitelná úmrtnost",ncd:"Riziko předčasného úmrtí",years:"let",days:"dne",perThousand:"na 1 000",per100k:"na 100 tis.",percent:"%",
      compare:"Porovnat deset systémů",compareCopy:"Přepněte ukazatel. Pořadí vždy respektuje jeho směr: u kapacity vyšší znamená více zdrojů, u úmrtnosti a délky pobytu pouze vyšší hodnotu — ne automaticky horší kvalitu.",
      physicians:"Praktikující lékaři",nurses:"Praktikující sestry",discharges:"Propuštění z nemocnic",occupancy:"Využití akutních lůžek",preventable:"Preventabilní úmrtnost",suicide:"Úmrtnost sebevraždou",under5:"Úmrtnost do 5 let",spendPerson:"Výdaje na obyvatele",household:"Přímé platby domácností",beds:"Nemocniční lůžka",
      outcomeMap:"Peníze versus předčasná úmrtnost",outcomeMapCopy:"Vodorovně jsou běžné výdaje na obyvatele v paritě kupní síly. Svisle je pravděpodobnost úmrtí mezi 30 a 70 lety na čtyři hlavní nepřenosná onemocnění; výše znamená nižší riziko.",lowerRisk:"nižší riziko ↑",moreSpend:"vyšší výdaje →",
      countryReading:"Čtení země",spendRank:"ve výdajích na obyvatele",lifeRank:"v naději dožití",ncdRank:"v předčasné úmrtnosti",workforceRank:"v počtu sester",storyJoin:"a",
      scorecard:"Úplný desetizemní scorecard",scorecardCopy:"Jedna tabulka drží hodnotu, rok i mezeru v pokrytí. OECD léčitelná úmrtnost zatím nemá srovnatelný údaj pro Ukrajinu.",country:"Země",doctors:"Lékaři",tableNurses:"Sestry",tableStay:"Pobyt",tableLife:"Dožití",tableNcd:"NCD riziko",tableTreatable:"Léčitelná úmrtnost",sources:"Metodika a primární zdroje",
      caveat:"Srovnání je popisné. Výsledky ovlivňuje věk populace, nemocnost, životní podmínky, válka, prevence i vykazování; nelze je připsat samotným výdajům.",worldBank:"Světová banka · harmonizované zdravotní ukazatele",oecdUse:"OECD · využití nemocnic",oecdMortality:"OECD · odvratitelná úmrtnost"
    },
    en:{
      kicker:"People, activity and outcomes",title:"Capacity, activity and outcomes",intro:"Ten countries are read through workforce, hospital use and outcomes. Every value carries its own reference year; missing observations are not zero.",
      tenCountries:"10 countries",commonSpine:"common data spine",latestAvailable:"latest available year",selected:"Selected country",rank:"rank",of:"of",median:"cohort median",year:"year",missing:"not available",
      life:"Life expectancy",doctorsNurses:"Doctors / nurses",stay:"Average hospital stay",treatable:"Treatable mortality",ncd:"Premature mortality risk",years:"years",days:"days",perThousand:"per 1,000",per100k:"per 100k",percent:"%",
      compare:"Compare ten systems",compareCopy:"Switch the measure. Ordering respects its direction: for capacity, higher means more resources; for mortality and length of stay it only means a higher value — not automatically lower quality.",
      physicians:"Practising physicians",nurses:"Practising nurses",discharges:"Hospital discharges",occupancy:"Curative-bed occupancy",preventable:"Preventable mortality",suicide:"Suicide mortality",under5:"Under-five mortality",spendPerson:"Spending per person",household:"Household payments",beds:"Hospital beds",
      outcomeMap:"Money versus premature mortality",outcomeMapCopy:"Current health spending per person at purchasing-power parity runs horizontally. The vertical measure is the probability of dying between ages 30 and 70 from four major non-communicable diseases; higher means lower risk.",lowerRisk:"lower risk ↑",moreSpend:"higher spending →",
      countryReading:"Country reading",spendRank:"for spending per person",lifeRank:"for life expectancy",ncdRank:"for premature mortality",workforceRank:"for nurse density",storyJoin:"and",
      scorecard:"Complete ten-country scorecard",scorecardCopy:"One table keeps the value, year and coverage gap together. OECD treatable mortality does not yet contain a comparable observation for Ukraine.",country:"Country",doctors:"Doctors",tableNurses:"Nurses",tableStay:"Stay",tableLife:"Life",tableNcd:"NCD risk",tableTreatable:"Treatable mortality",sources:"Method and primary sources",
      caveat:"The comparison is descriptive. Outcomes reflect population age, disease burden, living conditions, war, prevention and reporting as well as healthcare; they cannot be attributed to spending alone.",worldBank:"World Bank · harmonised health indicators",oecdUse:"OECD · hospital utilisation",oecdMortality:"OECD · avoidable mortality"
    }
  };
  const state={data:null,code:new URLSearchParams(location.search).get("code")||"CZE",lang:document.documentElement.lang==="en"?"en":"cs",metric:"life"};
  const t=key=>COPY[state.lang][key]||key;
  const locale=()=>state.lang==="en"?"en-GB":"cs-CZ";
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const number=(value,digits=1)=>Number(value).toLocaleString(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const name=code=>NAMES[code]?.[state.lang==="en"?1:0]||code;
  const valueAt=(row,path)=>path.split(".").reduce((value,key)=>value?.[key],row);
  const observation=(row,path)=>valueAt(row,path);
  const finite=observation=>Number.isFinite(observation?.value);
  const median=values=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
  const configs=()=>({
    life:{label:t("life"),path:"outcomes.life_expectancy_years",unit:t("years"),digits:1,better:"high"},
    physicians:{label:t("physicians"),path:"workforce.physicians_per_1000",unit:t("perThousand"),digits:2,better:"high"},
    nurses:{label:t("nurses"),path:"workforce.nurses_per_1000",unit:t("perThousand"),digits:1,better:"high"},
    discharges:{label:t("discharges"),path:"utilisation.discharges_per_100k",unit:t("per100k"),digits:0,better:"neutral"},
    stay:{label:t("stay"),path:"utilisation.average_length_of_stay_days",unit:t("days"),digits:1,better:"neutral"},
    occupancy:{label:t("occupancy"),path:"utilisation.curative_bed_occupancy_pct",unit:"%",digits:1,better:"neutral"},
    treatable:{label:t("treatable"),path:"outcomes.treatable_mortality_per_100k",unit:t("per100k"),digits:0,better:"low"},
    preventable:{label:t("preventable"),path:"outcomes.preventable_mortality_per_100k",unit:t("per100k"),digits:0,better:"low"},
    ncd:{label:t("ncd"),path:"outcomes.premature_ncd_mortality_pct",unit:"%",digits:1,better:"low"}
  });
  const rankFor=(rows,path,code,better="high")=>rows.filter(row=>finite(observation(row,path))).sort((a,b)=>{const av=observation(a,path).value,bv=observation(b,path).value;return better==="low"?av-bv:bv-av;}).findIndex(row=>row.code===code)+1;
  const fmt=(obs,digits=1,unit="")=>finite(obs)?`${number(obs.value,digits)}${unit?` ${unit}`:""}`:"—";
  const year=obs=>finite(obs)?String(obs.year):t("missing");

  function chooseCountry(code){const selector=document.querySelector("#deep-dive-country");if(!selector||selector.value===code)return;selector.value=code;selector.dispatchEvent(new Event("change",{bubbles:true}));}

  function renderRanking(rows){
    const config=configs()[state.metric], available=rows.filter(row=>finite(observation(row,config.path)));
    const sorted=[...available].sort((a,b)=>config.better==="low"?observation(a,config.path).value-observation(b,config.path).value:observation(b,config.path).value-observation(a,config.path).value);
    const values=available.map(row=>observation(row,config.path).value),min=Math.min(...values),max=Math.max(...values),span=max-min||1;
    return `<div class="health-performance-ranking">${sorted.map((row,index)=>{const obs=observation(row,config.path),width=14+(obs.value-min)/span*86;return `<button type="button" class="${row.code===state.code?"selected":""}" data-performance-country="${row.code}"><span>${String(index+1).padStart(2,"0")} · ${esc(name(row.code))}</span><i><b style="width:${width}%"></b></i><strong>${fmt(obs,config.digits,config.unit)}</strong><small>${obs.year}</small></button>`;}).join("")}${available.length<rows.length?`<p>${rows.filter(row=>!finite(observation(row,config.path))).map(row=>name(row.code)).join(", ")} · ${t("missing")}</p>`:""}</div>`;
  }

  function render(){
    const profile=state.data?.countries[state.code];if(!profile){ROOT.hidden=true;return;}ROOT.hidden=false;
    const rows=Object.entries(state.data.countries).map(([code,value])=>({code,...value})),countryName=name(state.code);
    const life=profile.outcomes.life_expectancy_years,doctors=profile.workforce.physicians_per_1000,nurses=profile.workforce.nurses_per_1000,stay=profile.utilisation.average_length_of_stay_days,treatable=profile.outcomes.treatable_mortality_per_100k,ncd=profile.outcomes.premature_ncd_mortality_pct;
    const spend=profile.spending.per_capita_ppp,oop=profile.spending.out_of_pocket_pct,beds=profile.capacity.beds_per_1000,under5=profile.outcomes.under5_mortality_per_1000;
    const spendRank=rankFor(rows,"spending.per_capita_ppp",state.code,"high"),lifeRank=rankFor(rows,"outcomes.life_expectancy_years",state.code,"high"),ncdRank=rankFor(rows,"outcomes.premature_ncd_mortality_pct",state.code,"low"),nurseRank=rankFor(rows,"workforce.nurses_per_1000",state.code,"high");
    const xValues=rows.map(row=>row.spending.per_capita_ppp.value),yValues=rows.map(row=>row.outcomes.premature_ncd_mortality_pct.value),xMin=Math.min(...xValues)*.9,xMax=Math.max(...xValues)*1.05,yMin=Math.min(...yValues)*.9,yMax=Math.max(...yValues)*1.05;
    const x=value=>(value-xMin)/(xMax-xMin)*100,y=value=>(yMax-value)/(yMax-yMin)*100;
    ROOT.innerHTML=`
      <div class="detail-heading"><div><span class="kicker">${t("kicker")}</span><h2>${t("title")}</h2></div><p>${t("intro")}</p></div>
      <div class="health-performance-contract"><strong>${t("tenCountries")}</strong><span>World Bank / WHO</span><span>OECD Health Statistics</span><small>${t("latestAvailable")}</small></div>
      <div class="health-performance-kpis"><article><span>${t("life")}</span><strong>${fmt(life,1,t("years"))}</strong><small>${life.year} · ${t("rank")} ${lifeRank}/${rows.length}</small></article><article><span>${t("doctorsNurses")}</span><strong>${fmt(doctors,1)} / ${fmt(nurses,1)}</strong><small>${t("perThousand")} · ${doctors.year}/${nurses.year}</small></article><article><span>${t("stay")}</span><strong>${fmt(stay,1,t("days"))}</strong><small>${year(stay)} · OECD</small></article><article><span>${finite(treatable)?t("treatable"):t("ncd")}</span><strong>${finite(treatable)?fmt(treatable,0,t("per100k")):fmt(ncd,1,"%")}</strong><small>${finite(treatable)?treatable.year:ncd.year} · ${finite(treatable)?"OECD":"WHO"}</small></article></div>
      <div class="health-performance-story"><span>${t("countryReading")}</span><p><strong>${esc(countryName)}</strong>: ${t("rank")} ${spendRank}/${rows.length} ${t("spendRank")}, ${lifeRank}/${rows.length} ${t("lifeRank")}, ${ncdRank}/${rows.length} ${t("ncdRank")} ${t("storyJoin")} ${nurseRank}/${rows.length} ${t("workforceRank")}.</p></div>
      <div class="health-performance-compare"><header><div><span>07 / ${t("compare")}</span><h3>${t("compare")}</h3></div><p>${t("compareCopy")}</p></header><div class="health-performance-modes">${Object.entries(configs()).map(([key,config])=>`<button type="button" data-performance-metric="${key}" aria-pressed="${key===state.metric}">${config.label}</button>`).join("")}</div>${renderRanking(rows)}</div>
      <div class="health-outcome-heading"><div><span>08 / ${t("outcomeMap")}</span><h3>${t("outcomeMap")}</h3></div><p>${t("outcomeMapCopy")}</p></div>
      <div class="health-outcome-layout"><div class="health-outcome-map" role="group" aria-label="${esc(t("outcomeMap"))}">${rows.map(row=>`<button type="button" class="health-outcome-dot${row.code===state.code?" selected":""}" data-performance-country="${row.code}" style="left:${x(row.spending.per_capita_ppp.value)}%;bottom:${y(row.outcomes.premature_ncd_mortality_pct.value)}%"><i></i><b>${row.code}</b></button>`).join("")}<span class="outcome-y">${t("lowerRisk")}</span><span class="outcome-x">${t("moreSpend")}</span></div><aside><span>${t("selected")}</span><strong>${esc(countryName)}</strong><div><span>${t("spendPerson")}</span><b>intl$ ${number(spend.value,0)}</b><small>${spend.year}</small></div><div><span>${t("household")}</span><b>${number(oop.value,1)} %</b><small>${oop.year}</small></div><div><span>${t("beds")}</span><b>${number(beds.value,2)}</b><small>${beds.year}</small></div><div><span>${t("under5")}</span><b>${number(under5.value,1)} ‰</b><small>${under5.year}</small></div></aside></div>
      <div class="health-scorecard-heading"><div><span>09 / ${t("scorecard")}</span><h3>${t("scorecard")}</h3></div><p>${t("scorecardCopy")}</p></div>
      <div class="health-scorecard-table"><table><thead><tr><th>${t("country")}</th><th>${t("doctors")}</th><th>${t("tableNurses")}</th><th>${t("tableStay")}</th><th>${t("tableLife")}</th><th>${t("tableNcd")}</th><th>${t("tableTreatable")}</th></tr></thead><tbody>${rows.map(row=>{const d=row.workforce.physicians_per_1000,n=row.workforce.nurses_per_1000,s=row.utilisation.average_length_of_stay_days,l=row.outcomes.life_expectancy_years,nc=row.outcomes.premature_ncd_mortality_pct,tr=row.outcomes.treatable_mortality_per_100k;return `<tr class="${row.code===state.code?"selected":""}"><td data-sort-value="${esc(name(row.code))}"><b>${esc(name(row.code))}</b><small>${row.code}</small></td><td data-sort-value="${d.value}">${number(d.value,2)}<small>${d.year}</small></td><td data-sort-value="${n.value}">${number(n.value,1)}<small>${n.year}</small></td><td data-sort-value="${s?.value??""}">${finite(s)?number(s.value,1):"—"}<small>${finite(s)?s.year:""}</small></td><td data-sort-value="${l.value}">${number(l.value,1)}<small>${l.year}</small></td><td data-sort-value="${nc.value}">${number(nc.value,1)} %<small>${nc.year}</small></td><td data-sort-value="${tr?.value??""}">${finite(tr)?number(tr.value,0):"—"}<small>${finite(tr)?tr.year:""}</small></td></tr>`;}).join("")}</tbody></table></div>
      <details class="health-performance-sources" id="health-performance-sources"><summary>${t("sources")}</summary><p>${esc(state.data.methodology[state.lang])}</p><p>${t("caveat")}</p><div><a href="https://data.worldbank.org/topic/health" target="_blank" rel="noreferrer">${t("worldBank")} ↗</a><a href="https://data-explorer.oecd.org/" target="_blank" rel="noreferrer">${t("oecdUse")} ↗</a><a href="https://data-explorer.oecd.org/" target="_blank" rel="noreferrer">${t("oecdMortality")} ↗</a></div></details>`;
    ROOT.querySelectorAll("[data-performance-metric]").forEach(button=>button.addEventListener("click",()=>{state.metric=button.dataset.performanceMetric;render();}));
    ROOT.querySelectorAll("[data-performance-country]").forEach(button=>button.addEventListener("click",()=>chooseCountry(button.dataset.performanceCountry)));
  }
  addEventListener("countryprofilechange",event=>{state.code=event.detail.code;state.lang=event.detail.lang==="en"?"en":"cs";render();});
  fetch(`${assetRoot}data/country-health-performance.v1.json`).then(response=>{if(!response.ok)throw new Error(response.status);return response.json();}).then(data=>{state.data=data;render();}).catch(error=>{console.error("health performance",error);ROOT.hidden=true;});
})();
