(() => {
  const assetRoot=document.currentScript?.src?new URL(".",document.currentScript.src).href:"";
  const T = {
    cs:{
      flowKicker:"Zdravotní systém",flowTitle:"Financování zdravotnictví",flowCopy:"Přehled ukazuje, kdo zdravotnictví financuje a kam peníze směřují.",architecture:"Jak systém funguje",financeView:"Kdo platí",providerView:"Kam peníze míří",editable:"Podtržené podíly lze upravit; celkový tok se přepočítá okamžitě.",reset:"Obnovit data",
      benchKicker:"Benchmark nemocnic",benchTitle:"Srovnání rozpočtu nemocnice",benchCopy:"Zadejte roční rozpočet a počet lůžek. Model porovná výdaje na lůžko s národním benchmarkem.",budgetInput:"Roční provozní rozpočet",bedsInput:"Dostupná lůžka",beds:"lůžek",yourSpendBed:"Váš rozpočet na lůžko",halfBenchmark:"½ benchmarku",doubleBenchmark:"2× benchmark",
      healthGdp:"Zdravotnictví / HDP",perCapita:"Výdaje na obyvatele",publicShare:"Veřejné + povinné",hospitalShare:"Podíl nemocnic",publicCompulsory:"Veřejné a povinné systémy",voluntaryOther:"Dobrovolné a ostatní",outOfPocket:"Přímé platby domácností",hospitals:"Nemocnice",residentialLtc:"Rezidenční dlouhodobá péče",ambulatory:"Ambulantní péče",retailers:"Lékárny a zdravotnické zboží",other:"Ostatní poskytovatelé",currentHealth:"Běžné výdaje",flowBalanced:"tok uzavřen",flowOver:"nad 100 %",flowUnder:"do 100 % chybí",openOfficial:"Otevřít národní zdroj ↗",source:"Zdroj",nationalBenchmark:"Národní benchmark",above:"nad benchmarkem",below:"pod benchmarkem",atBenchmark:"na benchmarku",bedsDensity:"Lůžka / 1 000 obyvatel",spendPerBed:"Odhad na lůžko",dataYear:"Rok dat",estimated:"odhad OECD",breakSeries:"zlom řady",sourcesKickerShort:"05 / Primární zdroje"
    },
    en:{
      flowKicker:"Healthcare system",flowTitle:"How healthcare is funded",flowCopy:"This overview shows who funds healthcare and where the money goes.",architecture:"How the system works",financeView:"Who pays",providerView:"Where money goes",editable:"Edit any underlined share; the total flow recalculates instantly.",reset:"Reset data",
      benchKicker:"Hospital benchmark",benchTitle:"Hospital budget comparison",benchCopy:"Enter an annual budget and staffed beds to compare spending per bed with the national benchmark.",budgetInput:"Annual operating budget",bedsInput:"Available beds",beds:"beds",yourSpendBed:"Your budget per bed",halfBenchmark:"½ benchmark",doubleBenchmark:"2× benchmark",
      healthGdp:"Health / GDP",perCapita:"Spending per person",publicShare:"Public + compulsory",hospitalShare:"Hospital share",publicCompulsory:"Government and compulsory schemes",voluntaryOther:"Voluntary and other schemes",outOfPocket:"Household out-of-pocket",hospitals:"Hospitals",residentialLtc:"Residential long-term care",ambulatory:"Ambulatory care",retailers:"Retailers and medical goods",other:"Other providers",currentHealth:"Current health spending",flowBalanced:"flow closes",flowOver:"above 100%",flowUnder:"missing to 100%",openOfficial:"Open national source ↗",source:"Source",nationalBenchmark:"National benchmark",above:"above benchmark",below:"below benchmark",atBenchmark:"at benchmark",bedsDensity:"Beds / 1,000 people",spendPerBed:"Estimated per bed",dataYear:"Data year",estimated:"OECD estimate",breakSeries:"series break",sourcesKickerShort:"05 / Primary sources"
    }
  };

  const modes = {
    finance:["public_compulsory","voluntary_other","out_of_pocket"],
    provider:["hospitals","residential_ltc","ambulatory","retailers","other"]
  };
  const labels = {public_compulsory:"publicCompulsory",voluntary_other:"voluntaryOther",out_of_pocket:"outOfPocket",hospitals:"hospitals",residential_ltc:"residentialLtc",ambulatory:"ambulatory",retailers:"retailers",other:"other"};
  const colors = ["#496f5a","#c6b13f","#d66b52","#315ba6","#855d9b"];
  const state = {data:null,code:window.PSDCountryRoutes.codeFromLocation(),lang:document.documentElement.lang==="en"?"en":"cs",mode:"finance",edited:{},hospitals:{}};
  const $ = selector => document.querySelector(selector);
  const tr = key => T[state.lang][key]||key;
  const locale = () => state.lang==="en"?"en-GB":"cs-CZ";
  const number = (value,digits=1) => new Intl.NumberFormat(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
  const money = (value,currency,compact=false) => new Intl.NumberFormat(locale(),{style:"currency",currency,maximumFractionDigits:0,notation:compact?"compact":"standard"}).format(value);
  const esc = value => String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const country = () => state.data?.countries[state.code];

  function translateStatic() {
    document.querySelectorAll("[data-health-key]").forEach(element=>{
      const text=tr(element.dataset.healthKey);
      if(text.includes("<br>")) element.innerHTML=text; else element.textContent=text;
    });
  }

  function defaults(profile,mode) {
    return Object.fromEntries(modes[mode].map(key=>[key,profile[mode==="finance"?"financing":"providers"][key]]));
  }

  function values(profile,mode=state.mode) {
    state.edited[state.code] ||= {};
    state.edited[state.code][mode] ||= defaults(profile,mode);
    return state.edited[state.code][mode];
  }

  function status(total) {
    const difference=total-100;
    if(Math.abs(difference)<.05) return {className:"balanced",text:tr("flowBalanced")};
    return difference>0?{className:"over",text:`+${number(difference)} % · ${tr("flowOver")}`}:{className:"under",text:`−${number(Math.abs(difference))} % · ${tr("flowUnder")}`};
  }

  function updateFlow() {
    const profile=country(), current=values(profile), total=Object.values(current).reduce((sum,value)=>sum+value,0), flowStatus=status(total);
    $("#country-health-total").textContent=`${number(total)} %`;
    $("#country-health-status").textContent=flowStatus.text;
    $("#country-health-status").className=flowStatus.className;
    document.querySelectorAll(".country-health-flow-row").forEach(row=>row.style.setProperty("--share",`${Math.min(100,Math.max(1,Number(current[row.dataset.key])||0))}%`));
  }

  function renderFlow() {
    const profile=country(), current=values(profile), keys=modes[state.mode];
    $("#country-health-flow").innerHTML=`<div class="country-health-flow-list">${keys.map((key,index)=>`<div class="country-health-flow-row" data-key="${key}" style="--color:${colors[index%colors.length]};--share:${current[key]}%"><label for="country-health-${key}">${esc(tr(labels[key]))}</label><span><input id="country-health-${key}" type="number" min="0" max="100" step="0.1" value="${Number(current[key]).toFixed(1)}" data-key="${key}"><b>%</b></span></div>`).join("")}</div><div class="country-health-pool"><span>${tr("currentHealth")} · ${profile.year}</span><strong id="country-health-total">100 %</strong><b id="country-health-status" class="balanced">${tr("flowBalanced")}</b></div>`;
    document.querySelectorAll(".country-health-flow-row input").forEach(input=>input.addEventListener("input",()=>{current[input.dataset.key]=Math.max(0,Number(input.value)||0);updateFlow()}));
    updateFlow();
  }

  function renderKpis(profile) {
    $("#country-health-kpis").innerHTML=[
      [tr("healthGdp"),`${number(profile.health_gdp_pct)} %`,String(profile.year)],
      [tr("perCapita"),`intl$ ${number(profile.per_capita_ppp,0)}`,"PPP · OECD"],
      [tr("publicShare"),`${number(profile.financing.public_compulsory)} %`,"SHA · HF.1"],
      [tr("hospitalShare"),`${number(profile.providers.hospitals)} %`,"SHA · HP.1"]
    ].map(([label,value,note])=>`<article><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
  }

  function hospitalState(profile) {
    const national=profile.per_capita_local*(profile.providers.hospitals/100)*1000/profile.beds_per_1000;
    if(!state.hospitals[state.code]) {
      const beds=400, budget=Math.max(1,Math.round(national*beds/1e6));
      state.hospitals[state.code]={beds,budget};
    }
    return {national,...state.hospitals[state.code]};
  }

  function updateHospital() {
    const profile=country(), values=hospitalState(profile), saved=state.hospitals[state.code];
    saved.budget=Math.max(1,Number($("#hospital-budget").value)||1);
    saved.beds=Math.max(1,Number($("#hospital-beds").value)||1);
    $("#hospital-budget-range").value=Math.min(Number($("#hospital-budget-range").max),saved.budget);
    $("#hospital-beds-range").value=Math.min(Number($("#hospital-beds-range").max),saved.beds);
    const actual=saved.budget*1e6/saved.beds, ratio=actual/values.national, delta=(ratio-1)*100;
    $("#hospital-spend-bed").textContent=money(actual,profile.currency,true);
    $("#hospital-national-benchmark").textContent=`${tr("nationalBenchmark")}: ${money(values.national,profile.currency,true)}`;
    $("#hospital-spend-delta").className=Math.abs(delta)<1?"neutral":delta>0?"above":"below";
    $("#hospital-spend-delta").textContent=Math.abs(delta)<1?tr("atBenchmark"):`${delta>0?"+":"−"}${number(Math.abs(delta),0)} % ${tr(delta>0?"above":"below")}`;
    $("#hospital-benchmark-marker").style.left=`${Math.max(0,Math.min(100,(ratio-.5)/1.5*100))}%`;
  }

  function renderHospital(profile) {
    const values=hospitalState(profile), controls=state.hospitals[state.code];
    const referenceBudget=Math.max(100,Math.ceil(values.national*2000/1e6/100)*100);
    $("#hospital-budget-unit").textContent=state.lang==="en"?`${profile.currency} m`:`mil. ${profile.currency}`;
    $("#hospital-budget").value=controls.budget; $("#hospital-budget-range").value=controls.budget; $("#hospital-budget-range").max=referenceBudget;
    $("#hospital-beds").value=controls.beds; $("#hospital-beds-range").value=controls.beds;
    $("#hospital-system-facts").innerHTML=[
      [tr("bedsDensity"),number(profile.beds_per_1000,2),String(profile.bed_year)],
      [tr("hospitalShare"),`${number(profile.providers.hospitals)} %`,"HP.1"],
      [tr("spendPerBed"),money(values.national,profile.currency,true),profile.currency],
      [tr("perCapita"),money(profile.per_capita_local,profile.currency,true),String(profile.year)]
    ].map(([label,value,note])=>`<article><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
    const flag=profile.bed_status==="E"?` · ${tr("estimated")}`:profile.bed_status==="B"?` · ${tr("breakSeries")}`:"";
    $("#country-hospital-method").textContent=`${state.data.methodology[state.lang]} ${tr("dataYear")}: ${profile.year}; ${tr("bedsDensity")}: ${profile.bed_year}${flag}.`;
    updateHospital();
  }

  function render() {
    if(!state.data) return;
    const profile=country(), supported=Boolean(profile);
    $("#healthcare-system").hidden=!supported; $("#hospital-benchmark").hidden=!supported;
    if(!supported) {
      const sourceKicker=document.querySelector('[data-i18n="sourcesKicker"]');
      if(sourceKicker) sourceKicker.textContent=tr("sourcesKickerShort");
      return;
    }
    translateStatic(); renderKpis(profile);
    $("#country-health-architecture-copy").textContent=profile[`architecture_${state.lang}`];
    $("#country-health-official").href=profile.official_url; $("#country-health-official").textContent=`${profile.official_title} ↗`;
    document.querySelectorAll("[data-health-mode]").forEach(button=>button.setAttribute("aria-selected",String(button.dataset.healthMode===state.mode)));
    renderFlow(); renderHospital(profile);
    $("#country-health-sources").innerHTML=state.data.sources.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("");
  }

  document.querySelectorAll("[data-health-mode]").forEach(button=>button.addEventListener("click",()=>{state.mode=button.dataset.healthMode;render()}));
  $("#country-health-reset")?.addEventListener("click",()=>{delete state.edited[state.code];delete state.hospitals[state.code];render()});
  [["#hospital-budget","#hospital-budget-range"],["#hospital-beds","#hospital-beds-range"]].forEach(([numberInput,rangeInput])=>{
    $(numberInput)?.addEventListener("input",()=>{$(rangeInput).value=$(numberInput).value;updateHospital()});
    $(rangeInput)?.addEventListener("input",()=>{$(numberInput).value=$(rangeInput).value;updateHospital()});
  });
  addEventListener("countryprofilechange",event=>{state.code=event.detail.code;state.lang=event.detail.lang==="en"?"en":"cs";render()});

  fetch(`${assetRoot}data/country-health.v1.json`)
    .then(response=>{if(!response.ok)throw new Error(response.status);return response.json()})
    .then(data=>{state.data=data;state.code=window.PSDCountryRoutes.codeFromLocation(state.code);state.lang=document.documentElement.lang==="en"?"en":"cs";render()})
    .catch(error=>console.error("Country healthcare data",error));
})();
