(() => {
  const root = document.querySelector("#homepage-health-performance-root");
  if (!root) return;

  const metrics = {
    health_gdp_pct:{group:"spending",cs:"Výdaje na zdraví / HDP",en:"Health spending / GDP",unit:"%",digits:1},
    per_capita_ppp:{group:"spending",cs:"Výdaje na obyvatele",en:"Spending per person",unit:"intl$",digits:0},
    out_of_pocket_pct:{group:"spending",cs:"Přímé platby domácností",en:"Out-of-pocket spending",unit:"%",digits:1},
    physicians_per_1000:{group:"workforce",cs:"Lékaři na 1 000 obyvatel",en:"Physicians per 1,000",unit:"/ 1 000",digits:2},
    nurses_per_1000:{group:"workforce",cs:"Sestry na 1 000 obyvatel",en:"Nurses per 1,000",unit:"/ 1 000",digits:2},
    beds_per_1000:{group:"capacity",cs:"Lůžka na 1 000 obyvatel",en:"Beds per 1,000",unit:"/ 1 000",digits:2},
    discharges_per_100k:{group:"utilisation",cs:"Propuštění z nemocnic",en:"Hospital discharges",unit:"/ 100 000",digits:0},
    average_length_of_stay_days:{group:"utilisation",cs:"Průměrná délka pobytu",en:"Average length of stay",unit:"dní",unitEn:"days",digits:1},
    curative_bed_occupancy_pct:{group:"utilisation",cs:"Využití akutních lůžek",en:"Curative-bed occupancy",unit:"%",digits:1},
    life_expectancy_years:{group:"outcomes",cs:"Naděje dožití",en:"Life expectancy",unit:"let",unitEn:"years",digits:1},
    premature_ncd_mortality_pct:{group:"outcomes",cs:"Riziko předčasného úmrtí na NCD",en:"Premature NCD mortality risk",unit:"%",digits:1},
    suicide_rate_per_100k:{group:"outcomes",cs:"Úmrtnost sebevraždou",en:"Suicide mortality",unit:"/ 100 000",digits:1},
    under5_mortality_per_1000:{group:"outcomes",cs:"Úmrtnost do pěti let",en:"Under-five mortality",unit:"/ 1 000",digits:1},
    treatable_mortality_per_100k:{group:"outcomes",cs:"Léčitelná úmrtnost",en:"Treatable mortality",unit:"/ 100 000",digits:0},
    preventable_mortality_per_100k:{group:"outcomes",cs:"Preventabilní úmrtnost",en:"Preventable mortality",unit:"/ 100 000",digits:0}
  };
  const groups = ["spending","workforce","capacity","utilisation","outcomes"];
  const countries = ["CZE","DEU","DNK","FRA","GBR","POL","SWE","CHE","USA","UKR"];
  const names = {
    CZE:["Česko","Czechia"],DEU:["Německo","Germany"],DNK:["Dánsko","Denmark"],FRA:["Francie","France"],
    GBR:["Spojené království","United Kingdom"],POL:["Polsko","Poland"],SWE:["Švédsko","Sweden"],CHE:["Švýcarsko","Switzerland"],
    USA:["Spojené státy","United States"],UKR:["Ukrajina","Ukraine"]
  };
  const flags = {CZE:"cz",DEU:"de",DNK:"dk",FRA:"fr",GBR:"gb",POL:"pl",SWE:"se",CHE:"ch",USA:"us",UKR:"ua"};
  const copy = {
    cs:{kicker:"03B / Výkon zdravotních systémů",title:"Co systém za své peníze poskytuje.",intro:"Patnáct ukazatelů propojuje výdaje, personál, kapacitu, využití nemocnic a zdravotní výsledky. Vyberte ukazatel a porovnejte poslední dostupnou hodnotu v deseti zemích.",groups:{spending:"Výdaje",workforce:"Personál",capacity:"Kapacita",utilisation:"Využití",outcomes:"Výsledky"},metric:"Ukazatel",anchor:"Srovnávaná země",sort:"Řazení",highLow:"Od nejvyšší hodnoty",selected:"Vybraná země",median:"Medián zemí",coverage:"Pokrytí",countries:"zemí",profile:"Detail země",matrix:"Všech patnáct ukazatelů",matrixCopy:"Každá buňka zachovává vlastní poslední dostupný rok. Kliknutím na ukazatel změníte hlavní srovnání.",method:"Jak srovnání číst",methodCopy:"Hodnoty řadíme od nejvyšší po nejnižší. Pořadí není celkové skóre: u úmrtnosti nebo délky pobytu může být nižší hodnota příznivější. Různé referenční roky nedopočítáváme ani nenahrazujeme nulou.",latest:"poslední dostupný rok",noData:"Bez dat",loading:"Načítám zdravotní ukazatele…",source:"Zdroje"},
    en:{kicker:"03B / Health-system performance",title:"What the system delivers for its spending.",intro:"Fifteen indicators connect spending, workforce, capacity, hospital use and health outcomes. Choose a metric to compare the latest available value across ten countries.",groups:{spending:"Spending",workforce:"Workforce",capacity:"Capacity",utilisation:"Utilisation",outcomes:"Outcomes"},metric:"Metric",anchor:"Compared country",sort:"Sort",highLow:"Highest value first",selected:"Selected country",median:"Country median",coverage:"Coverage",countries:"countries",profile:"Country profile",matrix:"All fifteen indicators",matrixCopy:"Every cell retains its own latest available year. Select an indicator to update the main comparison.",method:"How to read the comparison",methodCopy:"Values are sorted from highest to lowest. The order is not an overall score: for mortality or length of stay, a lower value may be preferable. Different reference years are neither imputed nor treated as zero.",latest:"latest available year",noData:"No data",loading:"Loading health indicators…",source:"Sources"}
  };
  const state = {data:null,lang:document.documentElement.lang === "en" || new URLSearchParams(location.search).get("lang") === "en" ? "en" : "cs",group:"outcomes",metric:"life_expectancy_years",anchor:"CZE"};
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const locale = () => state.lang === "en" ? "en-GB" : "cs-CZ";
  const label = key => metrics[key]?.[state.lang] || key;
  const unit = key => state.lang === "en" && metrics[key]?.unitEn ? metrics[key].unitEn : metrics[key]?.unit;
  const countryName = code => names[code]?.[state.lang === "en" ? 1 : 0] || code;
  const entry = (code,key) => state.data?.countries?.[code]?.[metrics[key].group]?.[key];
  const finiteEntry = item => Number.isFinite(Number(item?.value));
  const number = (value,digits) => new Intl.NumberFormat(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(value));
  const valueLabel = (item,key) => finiteEntry(item) ? `${number(item.value,metrics[key].digits)} ${unit(key)}` : "—";
  const flag = code => `<span class="health-compare-flag"><img src="assets/flags/${flags[code]}.svg" alt="" loading="lazy"><b>${code}</b></span>`;
  const profileUrl = code => `country.html?code=${code}&lang=${state.lang}#health-performance`;
  const median = values => {
    const sorted = [...values].sort((a,b)=>a-b),middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
  };

  function rankingRows(key) {
    return countries.map(code => ({code,item:entry(code,key)})).filter(row => finiteEntry(row.item)).sort((a,b)=>Number(b.item.value)-Number(a.item.value));
  }

  function render() {
    if (!state.data) return;
    const t = copy[state.lang],groupMetrics = Object.keys(metrics).filter(key => metrics[key].group === state.group);
    if (!groupMetrics.includes(state.metric)) state.metric = groupMetrics[0];
    const rows = rankingRows(state.metric),max = Math.max(...rows.map(row=>Number(row.item.value)),1);
    const anchor = entry(state.anchor,state.metric),middle = rows.length ? median(rows.map(row=>Number(row.item.value))) : null;
    const metricOptions = groupMetrics.map(key=>`<option value="${key}" ${key===state.metric?"selected":""}>${esc(label(key))}</option>`).join("");
    const countryOptions = countries.map(code=>`<option value="${code}" ${code===state.anchor?"selected":""}>${esc(countryName(code))}</option>`).join("");

    root.innerHTML = `<header class="health-compare-heading"><div><span class="kicker">${t.kicker}</span><h2>${t.title}</h2></div><p>${t.intro}</p></header>
      <div class="health-compare-tabs" role="tablist" aria-label="${esc(t.kicker)}">${groups.map(group=>`<button type="button" role="tab" data-home-health-group="${group}" aria-selected="${group===state.group}">${t.groups[group]}</button>`).join("")}</div>
      <div class="health-compare-cards">${groupMetrics.map(key=>{const item=entry(state.anchor,key);return `<button type="button" data-home-health-metric="${key}" class="${key===state.metric?"selected":""}"><span>${esc(label(key))}</span><strong>${finiteEntry(item)?number(item.value,metrics[key].digits):"—"} <small>${esc(unit(key))}</small></strong><b>${finiteEntry(item)?item.year:t.noData}</b></button>`}).join("")}</div>
      <div class="health-compare-controls"><label><span>${t.metric}</span><select id="home-health-metric">${metricOptions}</select></label><label><span>${t.anchor}</span><select id="home-health-anchor">${countryOptions}</select></label><div><span>${t.sort}</span><strong>${t.highLow}</strong><small>${esc(unit(state.metric))} · ${t.latest}</small></div></div>
      <div class="health-compare-summary"><article><span>${t.selected}</span><strong>${esc(valueLabel(anchor,state.metric))}</strong><a href="${profileUrl(state.anchor)}">${esc(countryName(state.anchor))} · ${finiteEntry(anchor)?anchor.year:t.noData} ↗</a></article><article><span>${t.median}</span><strong>${middle===null?"—":esc(`${number(middle,metrics[state.metric].digits)} ${unit(state.metric)}`)}</strong><small>${esc(label(state.metric))}</small></article><article><span>${t.coverage}</span><strong>${rows.length} / ${countries.length}</strong><small>${t.countries} · ${t.latest}</small></article></div>
      <div class="health-compare-ranking" aria-label="${esc(label(state.metric))}">${rows.map((row,index)=>`<a class="health-compare-rank-row ${row.code===state.anchor?"selected":""}" href="${profileUrl(row.code)}"><span class="health-compare-rank">${String(index+1).padStart(2,"0")}</span><span class="health-compare-country">${flag(row.code)}<strong>${esc(countryName(row.code))}</strong><small>${row.item.year} · ${t.latest}</small></span><i><b style="width:${Math.max(2,Number(row.item.value)/max*100)}%"></b></i><span class="health-compare-value"><strong>${esc(valueLabel(row.item,state.metric))}</strong><small>${row.code===state.anchor?t.selected:t.profile}</small></span><span class="health-compare-open">${t.profile} ↗</span></a>`).join("")}</div>
      <div class="health-compare-matrix-head"><div><span>${t.matrix}</span><p>${t.matrixCopy}</p></div><small>15 × ${countries.length} · ${t.latest}</small></div>
      <div class="health-compare-matrix-wrap"><table class="health-compare-matrix" data-no-sort="true"><thead><tr><th>${t.metric}</th>${countries.map(code=>`<th><a href="${profileUrl(code)}" aria-label="${t.profile}: ${esc(countryName(code))}"><img src="assets/flags/${flags[code]}.svg" alt="">${code}</a></th>`).join("")}</tr></thead><tbody>${groups.map(group=>`<tr class="health-compare-group-row"><th colspan="${countries.length+1}">${t.groups[group]}</th></tr>${Object.keys(metrics).filter(key=>metrics[key].group===group).map(key=>{const available=countries.map(code=>entry(code,key)).filter(finiteEntry),metricMax=Math.max(...available.map(item=>Number(item.value)),1);return `<tr class="${key===state.metric?"selected":""}"><th><button type="button" data-home-health-matrix-metric="${key}">${esc(label(key))}<small>${esc(unit(key))}</small></button></th>${countries.map(code=>{const item=entry(code,key),heat=finiteEntry(item)?Math.min(.72,.08+Number(item.value)/metricMax*.52):0;return `<td class="${code===state.anchor?"anchor":""}" style="--heat:${heat}"><strong>${finiteEntry(item)?number(item.value,metrics[key].digits):"—"}</strong><small>${finiteEntry(item)?item.year:t.noData}</small></td>`}).join("")}</tr>`}).join("")}`).join("")}</tbody></table></div>
      <footer class="health-compare-method"><span>${t.method}</span><p>${t.methodCopy}</p><div><b>${t.source}</b>${(state.data.sources||[]).map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("")}</div></footer>`;

    root.querySelectorAll("[data-home-health-group]").forEach(button=>button.addEventListener("click",()=>{state.group=button.dataset.homeHealthGroup;state.metric=Object.keys(metrics).find(key=>metrics[key].group===state.group);render();}));
    root.querySelectorAll("[data-home-health-metric]").forEach(button=>button.addEventListener("click",()=>{state.metric=button.dataset.homeHealthMetric;render();}));
    root.querySelector("#home-health-metric").addEventListener("change",event=>{state.metric=event.target.value;render();});
    root.querySelector("#home-health-anchor").addEventListener("change",event=>{state.anchor=event.target.value;render();});
    root.querySelectorAll("[data-home-health-matrix-metric]").forEach(button=>button.addEventListener("click",()=>{state.metric=button.dataset.homeHealthMatrixMetric;state.group=metrics[state.metric].group;render();root.scrollIntoView({behavior:"smooth",block:"start"});}));
  }

  root.innerHTML = `<p class="health-compare-loading">${copy[state.lang].loading}</p>`;
  fetch("data/country-health-performance.v1.json")
    .then(response=>{if(!response.ok)throw new Error(`Health comparison HTTP ${response.status}`);return response.json();})
    .then(data=>{state.data=data;render();})
    .catch(error=>{console.error(error);root.innerHTML="<p class=\"health-compare-loading\">Data could not be loaded.</p>";});
  document.querySelectorAll("[data-lang]").forEach(button=>button.addEventListener("click",()=>{state.lang=button.dataset.lang;setTimeout(render,0);}));
})();
