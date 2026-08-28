(() => {
  "use strict";
  const roots = [...document.querySelectorAll("[data-oecd-chart]")];
  if (!roots.length) return;

  const NAMES = {
    CZE:["Česko","Czechia"],DEU:["Německo","Germany"],DNK:["Dánsko","Denmark"],FIN:["Finsko","Finland"],FRA:["Francie","France"],GBR:["Spojené království","United Kingdom"],POL:["Polsko","Poland"],SWE:["Švédsko","Sweden"],CHE:["Švýcarsko","Switzerland"],UKR:["Ukrajina","Ukraine"],USA:["Spojené státy","United States"],BRA:["Brazílie","Brazil"],ESP:["Španělsko","Spain"],JPN:["Japonsko","Japan"],NLD:["Nizozemsko","Netherlands"],NOR:["Norsko","Norway"],GRC:["Řecko","Greece"]
  };
  const C = {
    cs:{source:"Zdroj a definice",year:"rok",missing:"OECD údaj pro tuto zemi není k dispozici.",loaded:"načtených zemí",market:"Před daněmi a transfery",disposable:"Po daních a transferech",reduction:"pokles nerovnosti",autonomous:"Vlastní rozhodování",shared:"Sdílené daně",central:"Centrálně určené / jiné",income:"Příjem vůči průměrné mzdě",wedge:"Daňový klín",single:"Jednotlivec bez dětí",family:"Pár, dvě děti, jeden příjem",parent:"Samoživitel/ka, dvě děti",total:"Celkem",publicSocial:"veřejné sociální výdaje",pensionIncome:"Příjem před důchodem vůči průměrné mzdě",replacement:"Čistá náhradová míra"},
    en:{source:"Source and definition",year:"year",missing:"No OECD value is available for this country.",loaded:"loaded countries",market:"Before taxes and transfers",disposable:"After taxes and transfers",reduction:"inequality reduction",autonomous:"Own discretion",shared:"Tax sharing",central:"Centrally set / other",income:"Income relative to average wage",wedge:"Tax wedge",single:"Single, no children",family:"Couple, two children, one earner",parent:"Single parent, two children",total:"Total",publicSocial:"public social spending",pensionIncome:"Pre-retirement earnings relative to average wage",replacement:"Net replacement rate"}
  };
  const PROGRAMMES = {
    old_age_survivors:["Stáří a pozůstalí","Old age and survivors","#192e2a"],incapacity:["Invalidita","Incapacity","#7b6b8d"],health:["Zdraví","Health","#287158"],family:["Rodina","Family","#a8b63f"],unemployment:["Nezaměstnanost","Unemployment","#c74c2f"],housing:["Bydlení","Housing","#8e7d68"],other:["Ostatní","Other","#8b8d83"]
  };
  let data=null;
  let code=document.body.dataset.countryCode || new URLSearchParams(location.search).get("code") || "CZE";
  let lang=(window.PSDLanguage&&window.PSDLanguage.current()) || (document.documentElement.lang==="en"?"en":"cs");
  const t=()=>C[lang], locale=()=>lang==="en"?"en-GB":"cs-CZ";
  const esc=v=>String(v==null?"":v).replace(/[&<>\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const name=c=>NAMES[c]?.[lang==="en"?1:0]||c;
  const fmt=(v,d=1)=>Number.isFinite(v)?v.toLocaleString(locale(),{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
  const obs=(c,key)=>data?.countries?.[c]?.comparison?.[key]||null;
  const country=()=>data?.countries?.[code];
  const header=(kicker,title,copy)=>`<header><div><span>${esc(kicker)}</span><h3>${esc(title)}</h3></div><p>${esc(copy)}</p></header>`;
  const empty=root=>{root.innerHTML=`<p class="oecd-chart-empty">${esc(t().missing)}</p>`;};

  function renderTaxWedge(root){
    const scenarios=country()?.tax?.labour?.scenarios||[];
    const singles=scenarios.filter(s=>s.household_type==="S_C0"&&s.spouse_income==="_Z"&&Number.isFinite(s.metrics.av_tw)).sort((a,b)=>Number(a.principal_income.slice(2))-Number(b.principal_income.slice(2)));
    if(!singles.length){empty(root);return;}
    const W=820,H=330,L=62,R=28,T=25,B=56,maxY=Math.max(55,...singles.map(s=>s.metrics.mr_tw_pe||0));
    const xs={AW67:L,AW100:L+(W-L-R)/2,AW167:W-R};
    const y=v=>T+(maxY-v)/(maxY)*(H-T-B);
    const line=singles.map(s=>`${xs[s.principal_income]},${y(s.metrics.av_tw)}`).join(" ");
    const marginal=singles.map(s=>`${xs[s.principal_income]},${y(s.metrics.mr_tw_pe)}`).join(" ");
    const grids=[0,10,20,30,40,50].map(v=>`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L-10}" y="${y(v)+3}" text-anchor="end">${v}%</text>`).join("");
    const labels=singles.map(s=>`<text class="axis" x="${xs[s.principal_income]}" y="${H-22}" text-anchor="middle">${s.principal_income.slice(2)}%</text>`).join("");
    const points=(metric,klass)=>singles.map(s=>`<circle class="${klass}" cx="${xs[s.principal_income]}" cy="${y(s.metrics[metric])}" r="6"><title>${fmt(s.metrics[metric])}%</title></circle><text class="value-label" x="${xs[s.principal_income]}" y="${y(s.metrics[metric])-12}" text-anchor="middle">${fmt(s.metrics[metric])}%</text>`).join("");
    const family=scenarios.find(s=>s.household_type==="C_C2"&&s.principal_income==="AW100"&&s.spouse_income==="NOEARN_UNEMP");
    const parent=scenarios.find(s=>s.household_type==="S_C2"&&s.principal_income==="AW67");
    root.innerHTML=`<section class="oecd-chart-block">${header("OECD Taxing Wages",lang==="en"?"How the labour tax wedge changes with earnings.":"Jak se daňový klín mění s výdělkem.",lang==="en"?"Average and marginal wedges for a single worker without children. Household examples below use the OECD model, not an individual tax calculation.":"Průměrný a mezní klín jednotlivce bez dětí. Příklady domácností níže používají model OECD, nikoli individuální daňový výpočet.")}<div class="oecd-chart-canvas"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t().wedge)}">${grids}<polyline class="series" points="${line}"/><polyline class="series-alt" points="${marginal}"/>${points("av_tw","point")}${points("mr_tw_pe","point-alt")}${labels}<text class="axis-title" x="${W/2}" y="${H-2}" text-anchor="middle">${esc(t().income)}</text></svg><div class="oecd-chart-callouts"><article><span>${esc(t().single)} · 100%</span><strong>${fmt(singles.find(s=>s.principal_income==="AW100")?.metrics.av_tw)} %</strong><small>${esc(t().wedge)}</small></article><article><span>${esc(t().family)} · 100%</span><strong>${fmt(family?.metrics.av_tw)} %</strong><small>${esc(t().wedge)}</small></article><article><span>${esc(t().parent)} · 67%</span><strong>${fmt(parent?.metrics.av_tw)} %</strong><small>${esc(t().wedge)}</small></article></div></div><p class="oecd-chart-note">${esc(t().year)} ${singles[0].year} · ${esc(data.metrics.labour_tax_wedge_single[`boundary_${lang}`])}</p></section>`;
  }

  function renderBridge(root){
    const market=country()?.distribution?.market_gini, disposable=country()?.distribution?.disposable_gini;
    if(!market||!disposable){empty(root);return;}
    const reduction=market.value-disposable.value, pct=reduction/market.value*100, max=.65;
    root.innerHTML=`<section class="oecd-chart-block">${header("OECD Income Distribution Database",lang==="en"?"What taxes and transfers change.":"Co změní daně a transfery.",lang==="en"?"The bridge compares market-income inequality with disposable-income inequality. It describes redistribution, not the quality of any individual programme.":"Most porovnává nerovnost tržních a disponibilních příjmů. Popisuje přerozdělení, nikoli kvalitu jednotlivých programů.")}<div class="oecd-chart-canvas"><div class="oecd-bridge"><div class="oecd-bridge-column"><i style="--height:${market.value/max*100}%"></i><span>${esc(t().market)}</span><strong>${fmt(market.value,3)}</strong><small>${market.year}</small></div><div class="oecd-bridge-change"><span>${esc(t().reduction)}</span><strong>−${fmt(reduction,3)}</strong><small>−${fmt(pct)} %</small></div><div class="oecd-bridge-column"><i style="--height:${disposable.value/max*100}%"></i><span>${esc(t().disposable)}</span><strong>${fmt(disposable.value,3)}</strong><small>${disposable.year}</small></div></div></div><p class="oecd-chart-note">${esc(data.metrics.disposable_gini[`boundary_${lang}`])}</p></section>`;
  }

  function renderSocx(root){
    const social=country()?.social;if(!social?.total){empty(root);return;}
    const entries=Object.entries(PROGRAMMES).map(([key,meta])=>({key,meta,obs:social[key]})).filter(x=>x.obs&&Number.isFinite(x.obs.value));
    const sum=entries.reduce((s,x)=>s+x.obs.value,0)||1;
    root.innerHTML=`<section class="oecd-chart-block">${header("OECD SOCX",lang==="en"?"What public social spending contains.":"Co obsahují veřejné sociální výdaje.",lang==="en"?"Programme values use their latest available observations. The total can have a newer year, so components are not forced to reconcile to it.":"Programy používají svůj poslední dostupný rok. Celkový údaj může být novější, proto složky násilně nesrovnáváme s celkem.")}<div class="oecd-chart-canvas"><div class="oecd-stack" role="img">${entries.map(x=>`<i style="width:${x.obs.value/sum*100}%;background:${x.meta[2]}" title="${esc(x.meta[lang==="en"?1:0])}: ${fmt(x.obs.value)}% HDP">${x.obs.value/sum>0.1?fmt(x.obs.value):""}</i>`).join("")}</div><ul class="oecd-stack-legend">${entries.map(x=>`<li><i style="--color:${x.meta[2]}"></i><span>${esc(x.meta[lang==="en"?1:0])} <small>· ${x.obs.year}</small></span><b>${fmt(x.obs.value)} %</b></li>`).join("")}</ul><div class="oecd-chart-callouts"><article><span>${esc(t().total)}</span><strong>${fmt(social.total.value)} % HDP</strong><small>${social.total.year} · ${esc(t().publicSocial)}</small></article></div></div><p class="oecd-chart-note">${esc(data.metrics.social_spending[`boundary_${lang}`])}</p></section>`;
  }

  function renderPension(root){
    const p=country()?.pensions;const points=[[50,p?.net_replacement_aw50],[100,p?.net_replacement_aw100],[200,p?.net_replacement_aw200]].filter(([,o])=>o);
    if(points.length<2){empty(root);return;}
    const W=820,H=300,L=62,R=30,T=25,B=55,maxY=Math.max(100,...points.map(([,o])=>o.value));const x=v=>L+(v-50)/150*(W-L-R),y=v=>T+(maxY-v)/maxY*(H-T-B);
    const grids=[0,20,40,60,80,100].map(v=>`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L-10}" y="${y(v)+3}" text-anchor="end">${v}%</text>`).join("");
    root.innerHTML=`<section class="oecd-chart-block">${header("OECD Pensions at a Glance",lang==="en"?"Replacement falls as modelled earnings rise.":"S vyšším modelovým příjmem náhrada klesá.",lang==="en"?"Net mandatory pension replacement rates for a modelled male worker. This is a policy-model result, not the average pension actually paid.":"Čisté náhradové míry povinného důchodu pro modelového pracovníka. Jde o výsledek modelu pravidel, nikoli průměrně vyplacený důchod.")}<div class="oecd-chart-canvas"><svg viewBox="0 0 ${W} ${H}" role="img">${grids}<polyline class="series" points="${points.map(([v,o])=>`${x(v)},${y(o.value)}`).join(" ")}"/>${points.map(([v,o])=>`<circle class="point" cx="${x(v)}" cy="${y(o.value)}" r="7"/><text class="value-label" x="${x(v)}" y="${y(o.value)-13}" text-anchor="middle">${fmt(o.value)}%</text><text class="axis" x="${x(v)}" y="${H-22}" text-anchor="middle">${v}%</text>`).join("")}<text class="axis-title" x="${W/2}" y="${H-2}" text-anchor="middle">${esc(t().pensionIncome)}</text></svg></div><p class="oecd-chart-note">${esc(data.metrics.pension_replacement_aw100[`boundary_${lang}`])} · ${points[0][1].year}</p></section>`;
  }

  function autonomyRows(){return Object.entries(data.countries).map(([c,p])=>({code:c,row:p.tax?.autonomy?.local})).filter(x=>x.row&&Number.isFinite(x.row.autonomous_share_pct)).sort((a,b)=>b.row.autonomous_share_pct-a.row.autonomous_share_pct);}
  function renderAutonomy(root){
    const rows=autonomyRows();
    if(root.dataset.hideWhenMissing==="true"&&!country()?.tax?.autonomy?.local){root.closest("section")?.setAttribute("hidden","");document.querySelector("#tax-autonomy-nav")?.setAttribute("hidden","");return;}
    root.closest("section")?.removeAttribute("hidden");document.querySelector("#tax-autonomy-nav")?.removeAttribute("hidden");
    if(!rows.length){empty(root);return;}
    root.innerHTML=`<section class="oecd-chart-block">${header("OECD Fiscal Decentralisation Database",lang==="en"?"How much of local taxation is locally controlled?":"Kolik místních daní místní vláda skutečně ovládá?",lang==="en"?"The spectrum separates discretion over the tax rate or base, shared taxes, and taxes effectively set by central government. It measures authority, not revenue size.":"Spektrum odděluje rozhodování o sazbě či základu, sdílené daně a daně fakticky určené centrem. Měří pravomoc, nikoli velikost příjmů.")}<div class="oecd-chart-canvas"><div class="oecd-spectrum">${rows.map(x=>`<div class="oecd-spectrum-row${x.code===code?" is-selected":""}"><span>${esc(name(x.code))}</span><div class="oecd-spectrum-track" title="${x.row.year}"><i style="width:${x.row.autonomous_share_pct}%"></i><i style="width:${x.row.shared_share_pct}%"></i><i style="width:${x.row.other_or_central_share_pct}%"></i></div><b>${fmt(x.row.autonomous_share_pct)} %</b></div>`).join("")}</div><div class="oecd-spectrum-key"><span><i></i>${esc(t().autonomous)}</span><span><i></i>${esc(t().shared)}</span><span><i></i>${esc(t().central)}</span></div></div><p class="oecd-chart-note">${esc(data.metrics.local_tax_autonomy[`boundary_${lang}`])}</p></section>`;
  }

  const scenarioValue=(c,key)=>data.countries[c]?.tax?.labour?.scenarios?.find(s=>`${s.household_type}|${s.principal_income}|${s.spouse_income}`===key)?.metrics?.av_tw;
  function renderTaxMatrix(root){
    const scenarioDefs=[["S_C0|AW67|_Z",lang==="en"?"Single · 67%":"Jednotlivec · 67 %"],["S_C0|AW100|_Z",lang==="en"?"Single · 100%":"Jednotlivec · 100 %"],["S_C0|AW167|_Z",lang==="en"?"Single · 167%":"Jednotlivec · 167 %"],["C_C2|AW100|NOEARN_UNEMP",lang==="en"?"Family · one earner":"Rodina · jeden příjem"]];
    const rows=Object.keys(data.countries).filter(c=>scenarioDefs.some(([k])=>Number.isFinite(scenarioValue(c,k))));
    root.innerHTML=`<section class="oecd-chart-block">${header("OECD Taxing Wages",lang==="en"?"The household changes the ranking.":"Domácnost mění pořadí.",lang==="en"?"The same country can move materially when children, a second earner or the earnings level changes.":"Stejná země se může výrazně posunout podle dětí, druhého příjmu nebo úrovně výdělku.")}<div class="oecd-chart-canvas oecd-matrix-wrap"><table class="oecd-data-table"><thead><tr><th>${lang==="en"?"Country":"Země"}</th>${scenarioDefs.map(([,l])=>`<th>${esc(l)}</th>`).join("")}</tr></thead><tbody>${rows.map(c=>`<tr class="${c===code?"is-selected":""}"><td>${esc(name(c))}</td>${scenarioDefs.map(([k])=>`<td>${fmt(scenarioValue(c,k))}${Number.isFinite(scenarioValue(c,k))?" %":""}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  }

  function renderCorporate(root){
    const rows=Object.entries(data.countries).map(([c,p])=>({c,s:p.tax?.corporate?.statutory_combined,e:p.tax?.corporate?.eatr,m:p.tax?.corporate?.emtr})).filter(x=>x.s||x.e||x.m).sort((a,b)=>(b.s?.value||-Infinity)-(a.s?.value||-Infinity));
    root.innerHTML=`<section class="oecd-chart-block">${header("OECD Corporate Tax Statistics",lang==="en"?"Headline and modelled corporate rates are different questions.":"Zákonná a modelová firemní sazba jsou jiné otázky.",lang==="en"?"The statutory rate describes the law. EATR models a profitable investment; EMTR models an investment at the break-even margin.":"Zákonná sazba popisuje právo. EATR modeluje ziskovou investici; EMTR investici na hraně rentability.")}<div class="oecd-chart-canvas oecd-corporate-wrap"><table class="oecd-data-table"><thead><tr><th>${lang==="en"?"Country":"Země"}</th><th>${lang==="en"?"Statutory":"Zákonná"}</th><th>EATR</th><th>EMTR</th></tr></thead><tbody>${rows.map(x=>`<tr class="${x.c===code?"is-selected":""}"><td>${esc(name(x.c))}</td><td>${fmt(x.s?.value)} % <small>${x.s?.year||""}</small></td><td>${fmt(x.e?.value)} % <small>${x.e?.year||""}</small></td><td>${fmt(x.m?.value)} % <small>${x.m?.year||""}</small></td></tr>`).join("")}</tbody></table></div></section>`;
  }

  function renderCarbonAutonomy(root){
    const ranks=(key)=>Object.keys(data.countries).map(c=>({c,o:obs(c,key)})).filter(x=>x.o).sort((a,b)=>b.o.value-a.o.value);
    const list=(rows,key,max)=>`<ol class="oecd-rank-list">${rows.map((x,i)=>`<li class="${x.c===code?"is-selected":""}"><span>${String(i+1).padStart(2,"0")}</span><strong>${esc(name(x.c))}</strong><i style="width:${Math.max(1,x.o.value/max*100)}%"></i><b>${fmt(x.o.value)}${key==="net_carbon_rate"?" €":" %"}</b></li>`).join("")}</ol>`;
    const carbon=ranks("net_carbon_rate"), autonomy=autonomyRows().map(x=>({c:x.code,o:{value:x.row.autonomous_share_pct,year:x.row.year}}));
    root.innerHTML=`<section class="oecd-chart-block">${header("OECD tax architecture",lang==="en"?"Carbon pricing and local discretion.":"Cena uhlíku a místní pravomoc.",lang==="en"?"Two separate policy instruments: the net price attached to emissions and the share of local tax revenue whose rate or base is locally controlled.":"Dva oddělené nástroje: čistá cena spojená s emisemi a podíl místních daní, jejichž sazbu či základ ovládá místní úroveň.")}<div class="oecd-chart-canvas oecd-dual-grid"><div>${list(carbon,"net_carbon_rate",Math.max(...carbon.map(x=>x.o.value)))}</div><div>${list(autonomy,"local_tax_autonomy",100)}</div></div></section>`;
  }

  function scatterSvg(xKey,yKey,selected=code){
    const points=Object.keys(data.countries).map(c=>({c,x:obs(c,xKey),y:obs(c,yKey)})).filter(p=>p.x&&p.y);
    if(points.length<3)return `<p class="oecd-chart-empty">${esc(t().missing)}</p>`;
    const W=820,H=420,L=72,R=50,T=34,B=62,xv=points.map(p=>p.x.value),yv=points.map(p=>p.y.value),xmin=Math.min(...xv),xmax=Math.max(...xv),ymin=Math.min(...yv),ymax=Math.max(...yv),pad=(a,b)=>(b-a||1)*.08;
    const xa=xmin-pad(xmin,xmax),xb=xmax+pad(xmin,xmax),ya=ymin-pad(ymin,ymax),yb=ymax+pad(ymin,ymax),sx=v=>L+(v-xa)/(xb-xa)*(W-L-R),sy=v=>T+(yb-v)/(yb-ya)*(H-T-B);
    const grids=[0,.25,.5,.75,1].map(q=>{const xx=L+q*(W-L-R),yy=T+q*(H-T-B),vx=xa+q*(xb-xa),vy=yb-q*(yb-ya);return `<line class="grid" x1="${xx}" x2="${xx}" y1="${T}" y2="${H-B}"/><line class="grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="axis" x="${xx}" y="${H-B+20}" text-anchor="middle">${fmt(vx,xKey.includes("gini")?2:1)}</text><text class="axis" x="${L-10}" y="${yy+3}" text-anchor="end">${fmt(vy,yKey.includes("gini")?2:1)}</text>`}).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${grids}${points.map(p=>`<circle class="${p.c===selected?"is-selected":""}" cx="${sx(p.x.value)}" cy="${sy(p.y.value)}" r="${p.c===selected?7:5}"><title>${esc(name(p.c))}: ${fmt(p.x.value)} / ${fmt(p.y.value)}</title></circle><text class="country" x="${sx(p.x.value)+8}" y="${sy(p.y.value)-7}">${p.c}</text>`).join("")}<text class="axis-title" x="${W/2}" y="${H-8}" text-anchor="middle">${esc(data.metrics[xKey]?.[`label_${lang}`]||xKey)}</text><text class="axis-title" transform="translate(16 ${H/2}) rotate(-90)" text-anchor="middle">${esc(data.metrics[yKey]?.[`label_${lang}`]||yKey)}</text></svg>`;
  }
  function renderPageScatter(root){const x=root.dataset.x||"social_spending",y=root.dataset.y||"poverty_rate";root.innerHTML=`<section class="oecd-chart-block">${header("OECD cross-country view",data.metrics[y]?.[`label_${lang}`]||y,lang==="en"?"Association is not causation. Hover a country to inspect its two dated observations.":"Souvislost není příčina. Po najetí na zemi uvidíte její dvě datovaná pozorování.")}<div class="oecd-scatter-chart">${scatterSvg(x,y)}</div></section>`;}

  function renderOutcomes(root){
    const keys=["disposable_gini","poverty_rate","social_spending","pension_replacement_aw100","housing_affordability","life_satisfaction","pisa_math","road_deaths"];
    root.innerHTML=`<section class="oecd-chart-block">${header("OECD outcomes",lang==="en"?"One scorecard, no composite score.":"Jeden přehled, žádné složené skóre.",lang==="en"?"Each outcome stays in its own unit and year. The table avoids a synthetic league table that would hide value judgements.":"Každý výsledek zůstává ve své jednotce a roce. Tabulka se vyhýbá syntetickému žebříčku, který by skrýval hodnotové soudy.")}<div class="oecd-chart-canvas oecd-outcomes-wrap"><table class="oecd-data-table"><thead><tr><th>${lang==="en"?"Country":"Země"}</th>${keys.map(k=>`<th>${esc(data.metrics[k]?.[`label_${lang}`]||k)}</th>`).join("")}</tr></thead><tbody>${Object.keys(data.countries).map(c=>`<tr class="${c===code?"is-selected":""}"><td>${esc(name(c))}</td>${keys.map(k=>{const o=obs(c,k),unit=data.metrics[k]?.[`unit_${lang}`]||"";return `<td>${o?`${fmt(o.value,k.includes("gini")?3:1)} ${esc(unit)} <small>${o.year}</small>`:"—"}</td>`}).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  }

  function renderDeepKpis(root){
    const keys=(root.dataset.keys||"").split(",").filter(Boolean);
    root.className="oecd-deep-kpis";
    root.innerHTML=keys.map(key=>{const o=obs(code,key),m=data.metrics[key],unit=m?.[`unit_${lang}`]||"";return `<article><span>${esc(m?.[`label_${lang}`]||key)}</span><strong>${o?`${fmt(o.value,key.includes("gini")?3:1)} ${esc(unit)}`:"—"}</strong><small>${o?`${esc(t().year)} ${o.year}`:esc(t().missing)}</small></article>`}).join("");
  }
  function renderSources(root){
    const ids=(root.dataset.sources||"").split(",").filter(Boolean);root.className="oecd-source-grid";
    root.innerHTML=ids.map(id=>{const source=data.sources[id];return source?`<a href="${esc(source.url)}" target="_blank" rel="noreferrer"><span>OECD</span><strong>${esc(source.title)}</strong><small>${lang==="en"?"Open original source ↗":"Otevřít původní zdroj ↗"}</small></a>`:""}).join("");
  }

  const RENDERERS={tax_wedge:renderTaxWedge,redistribution_bridge:renderBridge,socx_composition:renderSocx,pension_curve:renderPension,autonomy_spectrum:renderAutonomy,tax_matrix:renderTaxMatrix,corporate_rates:renderCorporate,carbon_autonomy:renderCarbonAutonomy,page_scatter:renderPageScatter,outcomes_table:renderOutcomes,deep_kpis:renderDeepKpis,source_grid:renderSources};
  function render(){if(!data)return;roots.forEach(root=>RENDERERS[root.dataset.oecdChart]?.(root));}
  addEventListener("countryprofilechange",event=>{code=event.detail.code;lang=event.detail.lang;render()});
  addEventListener("psdlanguagechange",event=>{lang=event.detail?.lang||lang;render()});
  fetch("/data/oecd-key-metrics.v1.json").then(r=>{if(!r.ok)throw new Error(`OECD charts HTTP ${r.status}`);return r.json()}).then(payload=>{data=payload;render()}).catch(error=>{console.error(error);roots.forEach(empty)});
})();
