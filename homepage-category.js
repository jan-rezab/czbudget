(() => {
  const root = document.querySelector("#category-comparison-root");
  if (!root) return;

  const names = {
    CZE:["Česko","Czechia"], DEU:["Německo","Germany"], DNK:["Dánsko","Denmark"], FRA:["Francie","France"],
    GBR:["Spojené království","United Kingdom"], POL:["Polsko","Poland"], SWE:["Švédsko","Sweden"], CHE:["Švýcarsko","Switzerland"],
    UKR:["Ukrajina","Ukraine"], USA:["Spojené státy","United States"], BRA:["Brazílie","Brazil"],
    ESP:["Španělsko","Spain"], JPN:["Japonsko","Japan"], NLD:["Nizozemsko","Netherlands"], NOR:["Norsko","Norway"],
  };
  const flags = {CZE:"cz",DEU:"de",DNK:"dk",FIN:"fi",FRA:"fr",GBR:"gb",POL:"pl",SWE:"se",CHE:"ch",UKR:"ua",USA:"us",BRA:"br",ESP:"es",JPN:"jp",NLD:"nl",NOR:"no"};
  const flag = code => `<span class="country-flag-svg"><img src="assets/flags/${flags[code]}.svg" alt="" loading="lazy"><b>${code}</b></span>`;
  const copy = {
    cs:{kicker:"02 / Výdaje podle kategorií",title:"Stejná otázka. Deset rozpočtů.",intro:"Vyberte společnou kategorii a porovnejte její podíl v národních rozpočtech. Každý řádek zároveň zachovává částku v místní měně i orientační přepočet do EUR.",category:"Kategorie",period:"Období",current:"Aktuální",previous:"Předchozí",scale:"Měřítko",share:"Podíl rozpočtu",eur:"Částka v EUR",leader:"Nejvyšší podíl",median:"Medián zemí",coverage:"Pokrytí",countries:"10 zemí",matrix:"Celá mapa kategorií",matrixCopy:"Podíl kategorie na součtu publikovaného národního členění. Kliknutím na řádek změníte hlavní srovnání.",profile:"Detail země",sourceLine:"zdrojová položka",mapped:"zdrojových položek",notSeparate:"ve zdroji není samostatně vidět",method:"Jak srovnání vzniká",local:"místní měna",nominal:"nominální",loading:"Načítám srovnání…"},
    en:{kicker:"02 / Spending by category",title:"One question. Ten budgets.",intro:"Choose a common category and compare its share of national budgets. Every row also retains the local-currency amount and an indicative EUR conversion.",category:"Category",period:"Period",current:"Current",previous:"Previous",scale:"Scale",share:"Budget share",eur:"EUR amount",leader:"Highest share",median:"Country median",coverage:"Coverage",countries:"10 countries",matrix:"The complete category map",matrixCopy:"Category share of each published national classification total. Select a row to update the main comparison.",profile:"Country profile",sourceLine:"source line",mapped:"source lines",notSeparate:"not separately visible in source",method:"How the comparison is built",local:"local currency",nominal:"nominal",loading:"Loading comparison…"},
  };
  const state = {lang:window.PSDLanguage?.current() || (document.documentElement.lang === "en" ? "en" : "cs"), category:"social_protection", period:"current", measure:"share", data:null};
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const locale = () => state.lang === "en" ? "en-GB" : "cs-CZ";
  const category = id => state.data.categories.find(item => item.id === id);
  const categoryLabel = item => item[`label_${state.lang}`];
  const countryName = code => names[code]?.[state.lang === "en" ? 1 : 0] || code;
  const group = country => country.groups.find(item => item.category_id === state.category);
  const eurAmount = (country, item) => item.amounts[state.period] / state.data.fx.local_per_eur[country.currency];
  const compact = (value, currency) => new Intl.NumberFormat(locale(), {style:"currency",currency,notation:"compact",maximumFractionDigits:2}).format(value * 1e9);
  const localAmount = (country, item) => `${item.amounts[state.period].toLocaleString(locale(), {maximumFractionDigits:2})} ${state.lang === "en" ? "bn" : "mld."} ${country.currency}`;
  const pct = value => `${value.toLocaleString(locale(), {minimumFractionDigits:1,maximumFractionDigits:1})} %`;
  const periodLabel = country => country.periods[state.period].label;

  function render() {
    if (!state.data) return;
    const t = copy[state.lang], selectedCategory = category(state.category);
    const rows = state.data.countries.map(country => {
      const item = group(country);
      return {country,item,share:item.shares_pct[state.period],eur:eurAmount(country,item)};
    }).sort((a,b) => (state.measure === "share" ? b.share-a.share : b.eur-a.eur));
    const max = Math.max(...rows.map(row => state.measure === "share" ? Math.max(0,row.share) : Math.max(0,row.eur)), 1);
    const shares = rows.map(row => row.share).sort((a,b)=>a-b);
    const median = (shares[4] + shares[5]) / 2;
    const leader = [...rows].sort((a,b)=>b.share-a.share)[0];
    const categoryOptions = state.data.categories.map(item => `<option value="${item.id}" ${item.id === state.category ? "selected" : ""}>${esc(categoryLabel(item))}</option>`).join("");

    root.innerHTML = `<div class="category-compare-heading"><div><span class="kicker">${t.kicker}</span><h2>${t.title}</h2></div><p>${t.intro}</p></div>
      <div class="category-controls">
        <label><span>${t.category}</span><select id="category-select">${categoryOptions}</select></label>
        <div><span>${t.period}</span><div class="category-toggle"><button type="button" data-period="previous" aria-pressed="${state.period === "previous"}">${t.previous}</button><button type="button" data-period="current" aria-pressed="${state.period === "current"}">${t.current}</button></div></div>
        <div><span>${t.scale}</span><div class="category-toggle"><button type="button" data-measure="share" aria-pressed="${state.measure === "share"}">${t.share}</button><button type="button" data-measure="eur" aria-pressed="${state.measure === "eur"}">${t.eur}</button></div></div>
      </div>
      <div class="category-summary"><article><span>${t.leader}</span><strong>${leader.country.code} · ${pct(leader.share)}</strong><a href="${window.PSDCountryRoutes.href(leader.country.code,state.lang,"spending")}">${countryName(leader.country.code)} ↗</a></article><article><span>${t.median}</span><strong>${pct(median)}</strong><small>${categoryLabel(selectedCategory)}</small></article><article><span>${t.coverage}</span><strong>10 / 10</strong><small>${t.countries}</small></article></div>
      <div class="category-ranking" aria-label="${esc(categoryLabel(selectedCategory))}">${rows.map((row,index) => {
        const raw = state.measure === "share" ? row.share : row.eur;
        const width = Math.max(0,raw) / max * 100;
        const main = state.measure === "share" ? pct(row.share) : compact(row.eur,"EUR");
        const sourceCount = row.item.source_rows.length;
        const mappedLabel = sourceCount ? `${sourceCount} ${sourceCount === 1 ? t.sourceLine : t.mapped}` : t.notSeparate;
        return `<a class="category-rank-row" href="${window.PSDCountryRoutes.href(row.country.code,state.lang,"spending")}"><span class="category-rank">${String(index+1).padStart(2,"0")}</span><span class="category-country">${flag(row.country.code)}<strong>${esc(countryName(row.country.code))}</strong><small>${esc(periodLabel(row.country))} · ${mappedLabel}</small></span><i><b style="width:${width}%"></b></i><span class="category-value"><strong>${esc(main)}</strong><small>${esc(compact(row.eur,"EUR"))} · ${esc(localAmount(row.country,row.item))}</small></span><span class="category-open">${t.profile} ↗</span></a>`;
      }).join("")}</div>
      <div class="category-matrix-head"><div><span>${t.matrix}</span><p>${t.matrixCopy}</p></div><small>${t.share} · ${state.period === "current" ? t.current : t.previous}</small></div>
      <div class="category-matrix-wrap"><table class="category-matrix" data-no-sort="true"><thead><tr><th>${t.category}</th>${state.data.countries.map(country => `<th><a href="${window.PSDCountryRoutes.href(country.code,state.lang,"spending")}" aria-label="${t.profile}: ${esc(countryName(country.code))}"><img src="assets/flags/${flags[country.code]}.svg" alt="">${country.code}</a></th>`).join("")}</tr></thead><tbody>${state.data.categories.map(item => `<tr class="${item.id === state.category ? "selected" : ""}" data-category-row="${item.id}"><th><button type="button" data-category="${item.id}">${esc(categoryLabel(item))}</button></th>${state.data.countries.map(country => { const value=country.groups.find(group=>group.category_id===item.id).shares_pct[state.period]; const alpha=Math.min(.78,.08+Math.max(0,value)/55); return `<td style="--heat:${alpha}">${esc(pct(value))}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
      <div class="category-method"><span>${t.method}</span><p>${esc(state.data.method[`note_${state.lang}`])}</p><small>${t.nominal} · ${state.data.fx.reference_date} · ${t.local} + EUR</small></div>`;

    root.querySelector("#category-select").addEventListener("change", event => { state.category=event.target.value; render(); });
    root.querySelectorAll("[data-period]").forEach(button => button.addEventListener("click",()=>{state.period=button.dataset.period;render();}));
    root.querySelectorAll("[data-measure]").forEach(button => button.addEventListener("click",()=>{state.measure=button.dataset.measure;render();}));
    root.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click",()=>{state.category=button.dataset.category;render();root.scrollIntoView({behavior:"smooth",block:"start"});}));
  }

  root.innerHTML = `<p class="category-loading">${copy[state.lang].loading}</p>`;
  fetch("data/country-spending-comparison.v1.json")
    .then(response => { if (!response.ok) throw new Error(`Category comparison HTTP ${response.status}`); return response.json(); })
    .then(data => { state.data=data; render(); })
    .catch(error => { console.error(error); root.innerHTML="<p class=\"category-loading\">Data could not be loaded.</p>"; });
  addEventListener("psdlanguagechange", event => { state.lang=event.detail?.lang === "en" ? "en" : "cs"; render(); });
})();
