const historyRoot = document.querySelector("#history-explorer");
if (historyRoot) {
  const source=historyRoot.dataset.source,fixedIco=historyRoot.dataset.fixedIco;
  // An explicit ?lang= wins; otherwise take the language language-bootstrap.js
  // resolved. Never OR the two together — that lets a stored "en" beat ?lang=cs.
  const requestedLang=new URLSearchParams(location.search).get("lang");
  const english=(requestedLang==="en"||requestedLang==="cs"?requestedLang:document.documentElement.lang)==="en";
  const select=historyRoot.querySelector("#history-city"),chart=historyRoot.querySelector("#history-chart"),tableBody=historyRoot.querySelector("#history-table-body"),tableHead=historyRoot.querySelector(".history-table thead tr"),kpis=historyRoot.querySelector("#history-kpis"),legend=historyRoot.querySelector(".history-legend");
  chart.tabIndex=0;
  const locale=english?"en-GB":"cs-CZ",fmt=new Intl.NumberFormat(locale,{maximumFractionDigits:1}),integer=new Intl.NumberFormat(locale,{maximumFractionDigits:0});
  const currency=()=>window.MunicipalCurrency||{current:"CZK",convert:value=>value,format:value=>Number.isFinite(value)?`${english?"CZK ":""}${fmt.format(value/1e6)}${english?"m":" mil. Kč"}`:"—"};
  const compact=value=>Number.isFinite(Number(value))?currency().format(Number(value),{adaptive:true}):"—";
  const perCapita=value=>Number.isFinite(Number(value))?`${currency().format(Number(value),{adaptive:true})} / ${english?"person":"obyv."}`:"—";
  const svgEscape=value=>String(value).replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const labels=english?{
    views:{overview:"Overview",execution:"Plan vs actual",structure:"Budget structure",perCapita:"Per person"},focus:"Measure",revenue:"Revenue",expense:"Expenditure",revenueActual:"Actual revenue",expenseActual:"Actual expenditure",cash:"Cash and deposits",balance:"Balance",approved:"Approved",adjusted:"Amended",actual:"Actual",tax:"Tax",nontax:"Non-tax",capitalRevenue:"Capital",transfers:"Transfers",currentExpense:"Current",capitalExpense:"Capital",population:"Population",expensePc:"Expenditure per person",table:"Annual data in a table",surplus:"years in surplus",executionRate:"Actual / amended",capitalShare:"Capital share",latestMix:"latest-year share",unitBn:"CZK bn",noData:"No historical records are available for this municipality."
  }:{
    views:{overview:"Přehled",execution:"Plán a skutečnost",structure:"Struktura rozpočtu",perCapita:"Na obyvatele"},focus:"Ukazatel",revenue:"Příjmy",expense:"Výdaje",revenueActual:"Skutečné příjmy",expenseActual:"Skutečné výdaje",cash:"Stav účtů",balance:"Výsledek",approved:"Schválený",adjusted:"Upravený",actual:"Skutečnost",tax:"Daňové",nontax:"Nedaňové",capitalRevenue:"Kapitálové",transfers:"Transfery",currentExpense:"Běžné",capitalExpense:"Kapitálové",population:"Počet obyvatel",expensePc:"Výdaje na obyvatele",table:"Roční data v tabulce",surplus:"let v přebytku",executionRate:"Skutečnost / upravený",capitalShare:"Podíl kapitálových",latestMix:"podíl v posledním roce",unitBn:"mld. Kč",noData:"Pro tuto obec nejsou dostupné historické záznamy."
  };
  const colors={revenue_actual:"#47735c",expense_actual:"#d2674d",cash_current:"#315ba6",tax_revenue:"#91a83d",nontax_revenue:"#e49855",capital_revenue:"#8298d8",transfer_revenue:"#62a6c2",current_expense:"#171a19",capital_expense:"#47735c",expense_per_capita:"#c93237"};
  let activeCity=null,view="overview",focus="revenue";

  const controls=document.createElement("div");controls.className="history-view-controls";
  controls.innerHTML=`<div class="history-view-tabs" role="tablist">${Object.entries(labels.views).map(([key,label])=>`<button type="button" data-history-view="${key}" role="tab" aria-selected="${key==="overview"}">${label}</button>`).join("")}</div><label class="history-focus" hidden><span>${labels.focus}</span><select><option value="revenue">${labels.revenue}</option><option value="expense">${labels.expense}</option></select></label>`;
  kpis.before(controls);
  const focusLabel=controls.querySelector(".history-focus"),focusSelect=focusLabel.querySelector("select");
  controls.querySelectorAll("[data-history-view]").forEach(button=>button.addEventListener("click",()=>{view=button.dataset.historyView;controls.querySelectorAll("[data-history-view]").forEach(item=>item.setAttribute("aria-selected",String(item===button)));render(activeCity);}));
  focusSelect.addEventListener("change",()=>{focus=focusSelect.value;render(activeCity);});

  const niceAxis=(domainMax,targetSteps=4)=>{if(!Number.isFinite(domainMax)||domainMax<=0)return {max:1,ticks:[0,1]};const roughStep=domainMax/targetSteps,power=10**Math.floor(Math.log10(roughStep)),fraction=roughStep/power,multiplier=[1,2,2.5,5,10].find(candidate=>candidate>=fraction)||10,step=multiplier*power,max=Math.ceil(domainMax/step)*step;return {max,ticks:Array.from({length:Math.round(max/step)+1},(_,index)=>index*step)};};
  const card=(label,value,note="",className="")=>`<article><span>${label}</span><strong class="${className}">${value}</strong>${note?`<small>${note}</small>`:""}</article>`;
  const setTable=(headers,rows)=>{if(tableHead)tableHead.innerHTML=headers.map(header=>`<th>${header}</th>`).join("");tableBody.innerHTML=rows;const summary=historyRoot.querySelector(".history-table summary");if(summary)summary.textContent=labels.table;};
  const setLegend=items=>{legend.innerHTML=items.map(item=>`<span><i style="background:${item.color}"></i>${item.label}</span>`).join("");};

  function lineChart(series,fields){
    const width=1120,height=460,left=72,right=26,top=30,bottom=54,values=series.flatMap(row=>fields.map(field=>row[field.key])).filter(Number.isFinite).map(currency().convert),sourceMax=Math.max(...values),axis=niceAxis(sourceMax*1.04),max=axis.max;
    const divisor=max>=1e9?1e9:max>=1e6?1e6:max>=1e3?1e3:1,suffix=divisor===1e9?(english?"bn":"mld."):divisor===1e6?(english?"m":"mil."):divisor===1e3?(english?"k":"tis."):"",chartUnit=`${currency().current}${suffix?` ${suffix}`:""}`;
    const x=index=>left+(index+.5)*((width-left-right)/series.length),y=value=>top+(max-currency().convert(value))/max*(height-top-bottom);
    const grid=axis.ticks.map(value=>`<line x1="${left}" x2="${width-right}" y1="${top+(max-value)/max*(height-top-bottom)}" y2="${top+(max-value)/max*(height-top-bottom)}"/><text x="${left-12}" y="${top+(max-value)/max*(height-top-bottom)+4}" text-anchor="end">${fmt.format(value/divisor)}</text>`).join("");
    const paths=fields.map(field=>{let drawing=false;const d=series.map((row,index)=>{if(!Number.isFinite(row[field.key])){drawing=false;return "";}const command=drawing?"L":"M";drawing=true;return `${command}${x(index).toFixed(1)},${y(row[field.key]).toFixed(1)}`;}).join(" ");const points=series.map((row,index)=>Number.isFinite(row[field.key])?`<circle cx="${x(index)}" cy="${y(row[field.key])}" r="3"><title>${row.year}: ${field.format(row[field.key])}</title></circle>`:"").join("");return `<g class="history-series" style="--series-color:${field.color}"><path class="history-line" d="${d}"/>${points}</g>`;}).join("");
    const years=series.map((row,index)=>index%2===0||index===series.length-1?`<text x="${x(index)}" y="${height-24}" text-anchor="middle">${row.year}</text>`:"").join("");
    const hitWidth=(width-left-right)/series.length,interactions=series.map((row,index)=>{const available=fields.filter(field=>Number.isFinite(row[field.key])),label=`${row.year}. ${available.map(field=>`${field.label}: ${field.format(row[field.key])}`).join(". ")}.`,dots=available.map(field=>`<circle class="history-hover-dot" style="stroke:${field.color}" cx="${x(index)}" cy="${y(row[field.key])}" r="6"/>`).join("");return `<g class="history-year-interaction" data-index="${index}"><rect class="history-year-hit" x="${x(index)-hitWidth/2}" y="${top}" width="${hitWidth}" height="${height-top-bottom}" tabindex="0" role="img" aria-label="${svgEscape(label)}"/><line class="history-year-guide" x1="${x(index)}" x2="${x(index)}" y1="${top}" y2="${height-bottom}"/>${dots}</g>`;}).join("");
    const chartLabel=fields.map(field=>field.label).join(", ");
    chart.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${chartLabel}"><g class="history-grid">${grid}${years}<text x="18" y="22">${chartUnit}</text></g>${paths}${interactions}</svg><div class="history-tooltip" role="status" aria-live="polite" hidden></div>`;
    const tooltip=chart.querySelector(".history-tooltip"),showTooltip=(target,clientX)=>{const row=series[Number(target.closest(".history-year-interaction")?.dataset.index)];if(!row)return;tooltip.innerHTML=`<strong>${row.year}</strong>${fields.filter(field=>Number.isFinite(row[field.key])).map(field=>`<span><i style="background:${field.color}"></i>${field.label}<b>${field.format(row[field.key])}</b></span>`).join("")}`;tooltip.hidden=false;const rect=chart.getBoundingClientRect(),anchor=Number.isFinite(clientX)?clientX-rect.left:x(series.indexOf(row))*rect.width/width;tooltip.style.left=`${Math.max(8,Math.min(rect.width-228,anchor+14))}px`;tooltip.style.top="48px";};
    chart.onmouseover=event=>{if(event.target.closest(".history-year-hit"))showTooltip(event.target,event.clientX);};
    chart.onmousemove=event=>{if(event.target.closest(".history-year-interaction"))showTooltip(event.target,event.clientX);};
    chart.onfocusin=event=>{if(event.target.closest(".history-year-hit"))showTooltip(event.target);};
    chart.onmouseleave=()=>{tooltip.hidden=true;};chart.onfocusout=event=>{if(!chart.contains(event.relatedTarget))tooltip.hidden=true;};
  }

  function stackedChart(series,fields){
    const width=1120,height=450,left=58,right=24,top=28,bottom=58,plotHeight=height-top-bottom,step=(width-left-right)/series.length,bar=Math.min(34,step*.62);
    const bars=series.map((row,index)=>{const total=fields.reduce((sum,field)=>sum+(Number(row[field.key])||0),0);let offset=0;const pieces=fields.map(field=>{const share=total>0?Math.max(0,Number(row[field.key])||0)/total:0,h=share*plotHeight,y=top+plotHeight-offset-h;offset+=h;return `<rect x="${left+index*step+(step-bar)/2}" y="${y}" width="${bar}" height="${h}" fill="${field.color}"><title>${row.year} · ${field.label}: ${fmt.format(share*100)} % · ${compact(row[field.key])}</title></rect>`;}).join("");return `${pieces}<text x="${left+(index+.5)*step}" y="${height-25}" text-anchor="middle">${index%2===0||index===series.length-1?row.year:""}</text>`;}).join("");
    const chartLabel=fields.map(field=>field.label).join(", ");
    chart.innerHTML=`<svg class="history-stack-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${chartLabel}"><g class="history-grid"><line x1="${left}" x2="${width-right}" y1="${top}" y2="${top}"/><line x1="${left}" x2="${width-right}" y1="${top+plotHeight/2}" y2="${top+plotHeight/2}"/><line x1="${left}" x2="${width-right}" y1="${top+plotHeight}" y2="${top+plotHeight}"/><text x="${left-10}" y="${top+4}" text-anchor="end">100 %</text><text x="${left-10}" y="${top+plotHeight/2+4}" text-anchor="end">50 %</text><text x="${left-10}" y="${top+plotHeight+4}" text-anchor="end">0 %</text>${bars}</g></svg>`;
  }

  function render(city){
    activeCity=city;if(!city)return;
    const series=city.series.filter(row=>Number.isFinite(row.revenue_actual)&&Number.isFinite(row.expense_actual));
    if(!series.length){kpis.innerHTML=`<p>${labels.noData}</p>`;chart.innerHTML="";tableBody.innerHTML="";return;}
    const latest=series.at(-1),reverse=[...series].reverse();
    focusLabel.hidden=!(view==="execution"||view==="structure");
    if(view==="overview"){
      const cumulative=series.reduce((sum,row)=>sum+(Number(row.budget_balance)||0),0),surplusYears=series.filter(row=>row.budget_balance>=0).length;
      kpis.innerHTML=card(`${labels.revenue} ${latest.year}`,compact(latest.revenue_actual))+card(`${labels.balance} ${latest.year}`,compact(latest.budget_balance),"",latest.budget_balance>=0?"positive":"negative")+card(`${labels.cash} ${latest.year}`,compact(latest.cash_current))+card(english?`${series.length}-year cumulative balance`:`Součet výsledků za ${series.length} let`,compact(cumulative),`${surplusYears} / ${series.length} ${labels.surplus}`,cumulative>=0?"positive":"negative");
      const fields=[{key:"revenue_actual",label:labels.revenueActual,color:colors.revenue_actual,format:compact},{key:"expense_actual",label:labels.expenseActual,color:colors.expense_actual,format:compact},{key:"cash_current",label:labels.cash,color:colors.cash_current,format:compact}];setLegend(fields);lineChart(series,fields);
      setTable([english?"Year":"Rok",labels.revenue,labels.expense,labels.balance,labels.cash],reverse.map(row=>`<tr><th>${row.year}</th><td>${compact(row.revenue_actual)}</td><td>${compact(row.expense_actual)}</td><td class="${row.budget_balance>=0?"positive":"negative"}">${compact(row.budget_balance)}</td><td>${compact(row.cash_current)}</td></tr>`));
    } else if(view==="execution"){
      const prefix=focus==="revenue"?"revenue":"expense",actual=latest[`${prefix}_actual`],adjusted=latest[`${prefix}_adjusted`],approved=latest[`${prefix}_approved`],rate=adjusted?actual/adjusted*100:null;
      kpis.innerHTML=card(`${labels.approved} ${latest.year}`,compact(approved))+card(`${labels.adjusted} ${latest.year}`,compact(adjusted))+card(`${labels.actual} ${latest.year}`,compact(actual))+card(labels.executionRate,Number.isFinite(rate)?`${fmt.format(rate)} %`:"—");
      const fields=[{key:`${prefix}_approved`,label:labels.approved,color:prefix==="revenue"?"#9aa49e":"#bda99f",format:compact},{key:`${prefix}_adjusted`,label:labels.adjusted,color:prefix==="revenue"?"#47735c":"#a94331",format:compact},{key:`${prefix}_actual`,label:labels.actual,color:prefix==="revenue"?"#91a83d":"#d2674d",format:compact}];setLegend(fields);lineChart(series,fields);
      setTable([english?"Year":"Rok",labels.approved,labels.adjusted,labels.actual,labels.executionRate],reverse.map(row=>{const amended=row[`${prefix}_adjusted`],execution=amended?row[`${prefix}_actual`]/amended*100:null;return `<tr><th>${row.year}</th><td>${compact(row[`${prefix}_approved`])}</td><td>${compact(amended)}</td><td>${compact(row[`${prefix}_actual`])}</td><td>${Number.isFinite(execution)?`${fmt.format(execution)} %`:"—"}</td></tr>`;}));
    } else if(view==="structure"){
      const fields=focus==="revenue"?[{key:"tax_revenue",label:labels.tax,color:colors.tax_revenue},{key:"transfer_revenue",label:labels.transfers,color:colors.transfer_revenue},{key:"nontax_revenue",label:labels.nontax,color:colors.nontax_revenue},{key:"capital_revenue",label:labels.capitalRevenue,color:colors.capital_revenue}]:[{key:"current_expense",label:labels.currentExpense,color:colors.current_expense},{key:"capital_expense",label:labels.capitalExpense,color:colors.capital_expense}];
      const total=fields.reduce((sum,field)=>sum+(Number(latest[field.key])||0),0),shares=fields.map(field=>({field,share:total?latest[field.key]/total*100:0}));
      kpis.innerHTML=shares.slice(0,4).map(item=>card(`${item.field.label} · ${latest.year}`,compact(latest[item.field.key]),`${fmt.format(item.share)} % · ${labels.latestMix}`)).join("");setLegend(fields);stackedChart(series,fields);
      setTable([english?"Year":"Rok",...fields.map(field=>field.label)],reverse.map(row=>`<tr><th>${row.year}</th>${fields.map(field=>`<td>${compact(row[field.key])}</td>`).join("")}</tr>`));
    } else {
      const first=series.find(row=>Number.isFinite(row.expense_per_capita)),pcSeries=series.filter(row=>Number.isFinite(row.expense_per_capita)),change=first&&latest.expense_per_capita?(latest.expense_per_capita/first.expense_per_capita-1)*100:null,capitalShare=latest.expense_actual?latest.capital_expense/latest.expense_actual*100:null;
      kpis.innerHTML=card(`${labels.expensePc} ${latest.year}`,perCapita(latest.expense_per_capita))+card(`${labels.population} ${latest.year}`,integer.format(latest.population_mid_year||0))+card(`${english?"Change since":"Změna od"} ${first?.year||"—"}`,Number.isFinite(change)?`${change>=0?"+":""}${fmt.format(change)} %`:"—")+card(`${labels.capitalShare} ${latest.year}`,Number.isFinite(capitalShare)?`${fmt.format(capitalShare)} %`:"—");
      const fields=[{key:"expense_per_capita",label:labels.expensePc,color:colors.expense_per_capita,format:perCapita}];setLegend(fields);lineChart(pcSeries,fields);
      setTable([english?"Year":"Rok",labels.expensePc,labels.population,labels.currentExpense,labels.capitalExpense],reverse.map(row=>`<tr><th>${row.year}</th><td>${perCapita(row.expense_per_capita)}</td><td>${Number.isFinite(row.population_mid_year)?integer.format(row.population_mid_year):"—"}</td><td>${compact(row.current_expense)}</td><td>${compact(row.capital_expense)}</td></tr>`));
    }
  }

  window.addEventListener("municipal-currency-change",()=>render(activeCity));
  fetch(source).then(response=>{if(!response.ok)throw new Error(`History source returned ${response.status}`);return response.json();}).then(data=>{
    const cities=data.cities||[{...data.municipality,series:data.series}];
    if(select){select.innerHTML=cities.map(city=>`<option value="${city.national_id}">${city.name}</option>`).join("");select.value=fixedIco||cities.find(city=>city.name==="Praha")?.national_id||cities[0].national_id;select.addEventListener("change",()=>render(cities.find(city=>city.national_id===select.value)));}
    render(cities.find(city=>city.national_id===(fixedIco||select?.value))||cities[0]);
  }).catch(error=>{console.error("Municipal history integration failed",error);kpis.innerHTML=`<p>${english?"Historical data could not be loaded.":"Historická data se nepodařilo načíst."}</p>`;});
}
