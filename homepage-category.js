(() => {
  const root = document.querySelector("#category-comparison-root");
  if (!root) return;

  const names = {
    CZE:["Česko","Czechia"],DEU:["Německo","Germany"],DNK:["Dánsko","Denmark"],FIN:["Finsko","Finland"],FRA:["Francie","France"],GBR:["Spojené království","United Kingdom"],POL:["Polsko","Poland"],SWE:["Švédsko","Sweden"],CHE:["Švýcarsko","Switzerland"],UKR:["Ukrajina","Ukraine"],USA:["Spojené státy","United States"],BRA:["Brazílie","Brazil"],ESP:["Španělsko","Spain"],JPN:["Japonsko","Japan"],NLD:["Nizozemsko","Netherlands"],NOR:["Norsko","Norway"],GRC:["Řecko","Greece"]
  };
  const flags = {CZE:"cz",DEU:"de",DNK:"dk",FIN:"fi",FRA:"fr",GBR:"gb",POL:"pl",SWE:"se",CHE:"ch",UKR:"ua",USA:"us",BRA:"br",ESP:"es",JPN:"jp",NLD:"nl",NOR:"no",GRC:"gr"};
  const copy = {
    cs:{kicker:"Výdaje podle kategorií",title:"Národní výdajové kategorie ve společném pohledu.",intro:"Jedna kompaktní Top 20 pro každou kategorii. Zvolte vlastní zemi a zůstane zvýrazněná i mimo první dvacítku.",category:"Kategorie",period:"Období",current:"Aktuální",previous:"Předchozí",scale:"Měřítko",share:"Podíl rozpočtu",eur:"Částka v EUR",leader:"Nejvyšší podíl",median:"Medián zemí",coverage:"Pokrytí",profile:"Detail země",sourceLine:"zdrojová položka",mapped:"zdrojových položek",notSeparate:"ve zdroji není samostatně vidět",method:"Jak srovnání vzniká",nominal:"nominální",loading:"Načítám srovnání…",addCountry:"Přidat zemi",noExtra:"Bez další země",top20:"Top 20",sources:"Zdroje",nationalSources:"Národní rozpočtové zdroje"},
    en:{kicker:"Spending by category",title:"National spending categories in one comparable view.",intro:"One compact Top 20 for each category. Choose a country to keep it highlighted even when it falls outside the first twenty.",category:"Category",period:"Period",current:"Current",previous:"Previous",scale:"Scale",share:"Budget share",eur:"EUR amount",leader:"Highest share",median:"Country median",coverage:"Coverage",profile:"Country profile",sourceLine:"source line",mapped:"source lines",notSeparate:"not separately visible in source",method:"How the comparison is built",nominal:"nominal",loading:"Loading comparison…",addCountry:"Add a country",noExtra:"No extra country",top20:"Top 20",sources:"Sources",nationalSources:"National budget sources"}
  };
  const state = {lang:window.PSDLanguage?.current() || (document.documentElement.lang === "en" ? "en" : "cs"),category:"social_protection",period:"current",measure:"share",compare:"",data:null};
  const esc = value => String(value ?? "").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const locale = () => state.lang === "en" ? "en-GB" : "cs-CZ";
  const countryName = code => names[code]?.[state.lang === "en" ? 1 : 0] || code;
  const flag = code => `<span class="country-flag-svg"><img src="assets/flags/${flags[code]}.svg" alt="" loading="lazy"></span>`;
  const category = id => state.data.categories.find(item=>item.id===id);
  const categoryLabel = item => item[`label_${state.lang}`];
  const group = country => country.groups.find(item=>item.category_id===state.category);
  const eurAmount = (country,item) => item.amounts[state.period] / state.data.fx.local_per_eur[country.currency];
  const compact = value => new Intl.NumberFormat(locale(),{style:"currency",currency:"EUR",notation:"compact",maximumFractionDigits:2}).format(value*1e9);
  const localAmount = (country,item) => `${item.amounts[state.period].toLocaleString(locale(),{maximumFractionDigits:2})} ${state.lang === "en" ? "bn" : "mld."} ${country.currency}`;
  const pct = value => `${value.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1})} %`;
  const median = values => {const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};

  function render() {
    if (!state.data) return;
    const t=copy[state.lang],selectedCategory=category(state.category);
    const rows=state.data.countries.map(country=>{const item=group(country);return {country,item,share:item.shares_pct[state.period],eur:eurAmount(country,item)};}).sort((a,b)=>state.measure==="share"?b.share-a.share:b.eur-a.eur);
    const topRows=rows.slice(0,20),extra=state.compare&&!topRows.some(row=>row.country.code===state.compare)?rows.find(row=>row.country.code===state.compare):null,visibleRows=extra?[...topRows,{...extra,isExtra:true}]:topRows;
    const max=Math.max(...visibleRows.map(row=>state.measure==="share"?Math.max(0,row.share):Math.max(0,row.eur)),1),leader=[...rows].sort((a,b)=>b.share-a.share)[0];
    const categoryOptions=state.data.categories.map(item=>`<option value="${item.id}" ${item.id===state.category?"selected":""}>${esc(categoryLabel(item))}</option>`).join("");
    const countryOptions=state.data.countries.slice().sort((a,b)=>countryName(a.code).localeCompare(countryName(b.code),locale())).map(country=>`<option value="${esc(countryName(country.code))}">${country.code}</option>`).join("");
    const fxSources=(state.data.fx.sources||[]).map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("");

    root.innerHTML=`<header class="category-compare-heading"><div><span class="kicker">${t.kicker}</span><h2>${t.title}</h2></div><p>${t.intro}</p></header>
      <div class="category-controls"><label><span>${t.category}</span><select id="category-select">${categoryOptions}</select></label><div><span>${t.period}</span><div class="category-toggle"><button type="button" data-period="previous" aria-pressed="${state.period==="previous"}">${t.previous}</button><button type="button" data-period="current" aria-pressed="${state.period==="current"}">${t.current}</button></div></div><div><span>${t.scale}</span><div class="category-toggle"><button type="button" data-measure="share" aria-pressed="${state.measure==="share"}">${t.share}</button><button type="button" data-measure="eur" aria-pressed="${state.measure==="eur"}">${t.eur}</button></div></div></div>
      <div class="category-summary"><article><span>${t.leader}</span><strong>${leader.country.code} · ${pct(leader.share)}</strong><a href="${window.PSDCountryRoutes.href(leader.country.code,state.lang,"spending")}">${countryName(leader.country.code)} ↗</a></article><article><span>${t.median}</span><strong>${pct(median(rows.map(row=>row.share)))}</strong><small>${categoryLabel(selectedCategory)}</small></article><article><span>${t.coverage}</span><strong>${rows.length} / ${state.data.countries.length}</strong><small>${t.top20}</small></article></div>
      <div class="category-chart chart-with-source" data-psd-chart="home-category-comparison"><label class="chart-country-search"><span>${t.addCountry}</span><input id="category-country" type="search" list="category-country-options" value="${state.compare?esc(countryName(state.compare)):""}" placeholder="${t.addCountry}…" autocomplete="off"><datalist id="category-country-options">${countryOptions}</datalist></label><div class="chart-source-hover"><button type="button" aria-label="${t.sources}">${t.sources} ↗</button><div><a href="methodology.html?lang=${state.lang}">${t.nationalSources} ↗</a>${fxSources}</div></div><div class="category-ranking" aria-label="${esc(categoryLabel(selectedCategory))}">${visibleRows.map((row,index)=>{
        const raw=state.measure==="share"?row.share:row.eur,width=Math.max(0,raw)/max*100,main=state.measure==="share"?pct(row.share):compact(row.eur),sourceCount=row.item.source_rows.length,mappedLabel=sourceCount?`${sourceCount} ${sourceCount===1?t.sourceLine:t.mapped}`:t.notSeparate;
        return `<a class="category-rank-row ${row.country.code===state.compare?"selected":""} ${row.isExtra?"extra-country":""}" href="${window.PSDCountryRoutes.href(row.country.code,state.lang,"spending")}"><span class="category-rank">${row.isExtra?"+":String(index+1).padStart(2,"0")}</span><span class="category-country">${flag(row.country.code)}<strong>${esc(countryName(row.country.code))}</strong><small>${esc(row.country.periods[state.period].label)} · ${mappedLabel}</small></span><i><b style="width:${width}%"></b></i><span class="category-value"><strong>${esc(main)}</strong><small>${esc(compact(row.eur))} · ${esc(localAmount(row.country,row.item))}</small></span><span class="category-open">${t.profile} ↗</span></a>`;
      }).join("")}</div></div>
      <footer class="category-method"><span>${t.method}</span><p>${esc(state.data.method[`note_${state.lang}`])}</p><small>${t.top20} · ${t.nominal} · ${state.data.fx.reference_date}</small></footer>`;

    const countryInput=root.querySelector("#category-country"),applyCountry=()=>{const query=countryInput.value.trim().toLocaleLowerCase(locale()),match=state.data.countries.find(country=>countryName(country.code).toLocaleLowerCase(locale())===query||country.code.toLowerCase()===query);if(!query||match){state.compare=match?.code||"";render()}};countryInput.addEventListener("change",applyCountry);countryInput.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();applyCountry()}});
    root.querySelector("#category-select").addEventListener("change",event=>{state.category=event.target.value;render();});
    root.querySelectorAll("[data-period]").forEach(button=>button.addEventListener("click",()=>{state.period=button.dataset.period;render();}));
    root.querySelectorAll("[data-measure]").forEach(button=>button.addEventListener("click",()=>{state.measure=button.dataset.measure;render();}));
    registerChart(rows);
  }

  /* A1 — the comparison as an addressable object. Re-registered after each render because
     the host element is replaced; rows() closes over the freshly computed set. */
  function registerChart(currentRows){
    const host=root.querySelector('[data-psd-chart="home-category-comparison"]');
    if(!host||!window.PSDChart)return;
    const en=state.lang==="en",method=state.data.method||{};
    window.PSDChart.register({
      slug:"home-category-comparison",el:host,
      title:()=>copy[state.lang].title,
      columns:[
        {key:"code",label:"ISO"},
        {key:"country",label:en?"Country":"Země"},
        {key:"share",label:en?"% of expenditure":"% výdajů",numeric:true},
        {key:"eur",label:"EUR",numeric:true},
      ],
      rows:()=>currentRows.map(row=>({
        code:row.country.code,
        country:countryName(row.country.code),
        share:Number.isFinite(row.share)?Math.round(row.share*100)/100:null,
        eur:Number.isFinite(row.eur)?Math.round(row.eur):null,
      })),
      source:{
        name:method[`provider_${state.lang}`]||method.provider||null,
        caveat:method[`note_${state.lang}`]||null,
        edition:state.data.fx?.reference_date||null,
        url:method.url||null,
      },
    });
  }

  root.innerHTML=`<p class="category-loading">${copy[state.lang].loading}</p>`;
  fetch("data/country-spending-comparison.v1.json").then(response=>{if(!response.ok)throw new Error(`Category comparison HTTP ${response.status}`);return response.json();}).then(data=>{state.data=data;render();}).catch(error=>{console.error(error);root.innerHTML="<p class=\"category-loading\">Data could not be loaded.</p>";});
  addEventListener("psdlanguagechange",event=>{state.lang=event.detail?.lang==="en"?"en":"cs";render();});
})();
