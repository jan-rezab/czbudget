(() => {
  const ROOT = document.querySelector("#health-insights");
  if (!ROOT) return;

  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "";
  const NAMES = {
    CZE:["Česko","Czechia"], DEU:["Německo","Germany"], DNK:["Dánsko","Denmark"],
    FRA:["Francie","France"], GBR:["Spojené království","United Kingdom"], POL:["Polsko","Poland"],
    SWE:["Švédsko","Sweden"], CHE:["Švýcarsko","Switzerland"], USA:["Spojené státy","United States"]
  };
  const COPY = {
    cs: {
      kicker:"03 / Co čísla odhalují", title:"Profil systému, ne jen součet.",
      intro:"Čtyři srovnatelné signály ukazují, jak se vybraná země liší od mediánu devíti systémů. Pořadí popisuje velikost ukazatele — není hodnocením kvality péče.",
      fiscal:"Fiskální intenzita", protection:"Finanční ochrana", setting:"Model poskytování", capacity:"Lůžková kapacita",
      gdpSpend:"výdajů na zdraví vůči HDP", perPerson:"na obyvatele v paritě kupní síly", publicFunding:"veřejné a povinné financování", household:"přímé platby domácností", hospitalCare:"výdajů míří k nemocnicím", ambulatoryCare:"míří k ambulantním poskytovatelům", beds:"lůžka na 1 000 obyvatel", estimatedBed:"odhad běžných výdajů nemocnic na lůžko",
      rank:"pořadí", of:"z", median:"medián", above:"nad", below:"pod", near:"na úrovni", pp:"p. b.", intl:"intl$",
      mapKicker:"05 / Mapa systémů", mapTitle:"Více peněz neznamená automaticky více lůžek.",
      mapCopy:"Vodorovně jsou celkové běžné výdaje na zdraví vůči HDP, svisle nemocniční lůžka na 1 000 obyvatel. Čáry označují medián sledované skupiny.",
      spendAxis:"Výdaje na zdraví / HDP", bedsAxis:"Lůžka / 1 000", takeaway:"Čtení vybrané země", and:"a",
      caveat:"Kapacita, financování a struktura poskytovatelů neříkají samy o sobě nic o kvalitě, dostupnosti ani výsledcích péče. Odhad na lůžko dělí výdaje připadající nemocnicím vykázanou hustotou lůžek; nejde o rozpočet konkrétní nemocnice.",
      fiscalHigh:"patří k výdajově intenzivnějším systémům", fiscalLow:"vydává vůči ekonomice méně než typická země skupiny", protectionHigh:"přenáší na domácnosti vyšší přímou zátěž", protectionLow:"drží přímé platby domácností pod mediánem", hospitalLed:"směřuje relativně více peněz do nemocnic než do ambulantní péče", ambulatoryLed:"má vyrovnanější nebo ambulantněji orientovaný mix poskytovatelů", bedHigh:"kombinuje nadmediánovou lůžkovou kapacitu", bedLow:"funguje s podmediánovou lůžkovou kapacitou"
    },
    en: {
      kicker:"03 / What the numbers reveal", title:"A system profile, not just a total.",
      intro:"Four comparable signals show how the selected country differs from the median of nine systems. Ranks describe the level of each metric — they are not quality scores.",
      fiscal:"Fiscal intensity", protection:"Financial protection", setting:"Delivery model", capacity:"Bed capacity",
      gdpSpend:"of GDP spent on health", perPerson:"per person at purchasing-power parity", publicFunding:"public and compulsory financing", household:"household out-of-pocket payments", hospitalCare:"of spending goes to hospitals", ambulatoryCare:"goes to ambulatory providers", beds:"beds per 1,000 people", estimatedBed:"estimated current hospital spending per bed",
      rank:"rank", of:"of", median:"median", above:"above", below:"below", near:"at", pp:"pp", intl:"intl$",
      mapKicker:"05 / System map", mapTitle:"More money does not automatically mean more beds.",
      mapCopy:"Total current health spending as a share of GDP runs horizontally; hospital beds per 1,000 people run vertically. The rules mark the cohort medians.",
      spendAxis:"Health spending / GDP", bedsAxis:"Beds / 1,000", takeaway:"Reading the selected country", and:"and",
      caveat:"Capacity, financing and provider mix do not by themselves measure quality, access or outcomes. Spending per bed is an estimate that divides the hospital share of current spending by reported bed density; it is not an individual hospital budget.",
      fiscalHigh:"is among the more spending-intensive systems", fiscalLow:"spends less relative to its economy than the typical country in the cohort", protectionHigh:"places a higher direct payment burden on households", protectionLow:"keeps household out-of-pocket payments below the median", hospitalLed:"directs relatively more money to hospitals than to ambulatory care", ambulatoryLed:"has a more balanced or ambulatory-oriented provider mix", bedHigh:"combines this with above-median bed capacity", bedLow:"operates with below-median bed capacity"
    }
  };

  const state = {data:null, code:new URLSearchParams(location.search).get("code") || "CZE", lang:document.documentElement.lang === "en" ? "en" : "cs"};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const t = key => COPY[state.lang][key];
  const locale = () => state.lang === "en" ? "en-GB" : "cs-CZ";
  const number = (value, digits=1) => Number(value).toLocaleString(locale(), {minimumFractionDigits:digits, maximumFractionDigits:digits});
  const median = values => { const sorted=[...values].sort((a,b)=>a-b), mid=Math.floor(sorted.length/2); return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2; };
  const rank = (rows, getter, code) => [...rows].sort((a,b)=>getter(b)-getter(a)).findIndex(row=>row.code===code)+1;
  const deltaText = (value, middle, suffix=t("pp")) => {
    const delta=value-middle;
    if (Math.abs(delta)<0.05) return `${t("near")} ${t("median")}`;
    return `${number(Math.abs(delta))} ${suffix} ${t(delta>0?"above":"below")} ${t("median")}`;
  };
  const metric = (label, value, note, width) => `<div class="health-insight-metric"><div><span>${esc(label)}</span><strong>${value}</strong></div><div class="health-insight-track"><i style="width:${Math.max(2,Math.min(100,width))}%"></i></div><small>${esc(note)}</small></div>`;

  function render() {
    const profiles=state.data?.countries;
    const profile=profiles?.[state.code];
    if (!profile) { ROOT.hidden=true; return; }
    ROOT.hidden=false;
    const rows=Object.entries(profiles).map(([code,value])=>({code,...value}));
    const max=getter=>Math.max(...rows.map(getter));
    const med={
      gdp:median(rows.map(row=>row.health_gdp_pct)), ppp:median(rows.map(row=>row.per_capita_ppp)),
      public:median(rows.map(row=>row.financing.public_compulsory)), oop:median(rows.map(row=>row.financing.out_of_pocket)),
      hospital:median(rows.map(row=>row.providers.hospitals)), ambulatory:median(rows.map(row=>row.providers.ambulatory)),
      beds:median(rows.map(row=>row.beds_per_1000))
    };
    const spendPerBed=row=>row.per_capita_ppp*(row.providers.hospitals/100)*1000/row.beds_per_1000;
    med.perBed=median(rows.map(spendPerBed));
    const countryName=NAMES[state.code]?.[state.lang==="en"?1:0]||state.code;
    const rankLabel=getter=>`${t("rank")} ${rank(rows,getter,state.code)} ${t("of")} ${rows.length}`;
    const fiscalSignal=profile.health_gdp_pct>=med.gdp?t("fiscalHigh"):t("fiscalLow");
    const protectionSignal=profile.financing.out_of_pocket>=med.oop?t("protectionHigh"):t("protectionLow");
    const settingSignal=(profile.providers.hospitals-profile.providers.ambulatory)>=(med.hospital-med.ambulatory)?t("hospitalLed"):t("ambulatoryLed");
    const bedSignal=profile.beds_per_1000>=med.beds?t("bedHigh"):t("bedLow");
    const xMin=Math.min(...rows.map(row=>row.health_gdp_pct))-0.6, xMax=Math.max(...rows.map(row=>row.health_gdp_pct))+0.6;
    const yMin=Math.max(0,Math.min(...rows.map(row=>row.beds_per_1000))-0.7), yMax=Math.max(...rows.map(row=>row.beds_per_1000))+0.7;
    const x=value=>(value-xMin)/(xMax-xMin)*100;
    const y=value=>(value-yMin)/(yMax-yMin)*100;
    const insightCards=[
      `<article><header><span>01</span><h3>${t("fiscal")}</h3></header>${metric(t("gdpSpend"),`${number(profile.health_gdp_pct)} %`,`${rankLabel(row=>row.health_gdp_pct)} · ${deltaText(profile.health_gdp_pct,med.gdp)}`,profile.health_gdp_pct/max(row=>row.health_gdp_pct)*100)}${metric(t("perPerson"),`${t("intl")} ${number(profile.per_capita_ppp,0)}`,`${rankLabel(row=>row.per_capita_ppp)} · ${number(med.ppp,0)} ${t("median")}`,profile.per_capita_ppp/max(row=>row.per_capita_ppp)*100)}</article>`,
      `<article><header><span>02</span><h3>${t("protection")}</h3></header>${metric(t("publicFunding"),`${number(profile.financing.public_compulsory)} %`,`${rankLabel(row=>row.financing.public_compulsory)} · ${deltaText(profile.financing.public_compulsory,med.public)}`,profile.financing.public_compulsory)}${metric(t("household"),`${number(profile.financing.out_of_pocket)} %`,`${rankLabel(row=>row.financing.out_of_pocket)} · ${deltaText(profile.financing.out_of_pocket,med.oop)}`,profile.financing.out_of_pocket/max(row=>row.financing.out_of_pocket)*100)}</article>`,
      `<article><header><span>03</span><h3>${t("setting")}</h3></header>${metric(t("hospitalCare"),`${number(profile.providers.hospitals)} %`,`${rankLabel(row=>row.providers.hospitals)} · ${deltaText(profile.providers.hospitals,med.hospital)}`,profile.providers.hospitals/max(row=>row.providers.hospitals)*100)}${metric(t("ambulatoryCare"),`${number(profile.providers.ambulatory)} %`,`${rankLabel(row=>row.providers.ambulatory)} · ${number(med.ambulatory)} % ${t("median")}`,profile.providers.ambulatory/max(row=>row.providers.ambulatory)*100)}</article>`,
      `<article><header><span>04</span><h3>${t("capacity")}</h3></header>${metric(t("beds"),number(profile.beds_per_1000,2),`${rankLabel(row=>row.beds_per_1000)} · ${deltaText(profile.beds_per_1000,med.beds,"/ 1 000")}`,profile.beds_per_1000/max(row=>row.beds_per_1000)*100)}${metric(t("estimatedBed"),`${t("intl")} ${number(spendPerBed(profile),0)}`,`${rankLabel(spendPerBed)} · ${t("median")} ${number(med.perBed,0)}`,spendPerBed(profile)/max(spendPerBed)*100)}</article>`
    ];
    ROOT.innerHTML=`
      <div class="detail-heading"><div><span class="kicker">${t("kicker")}</span><h2>${t("title")}</h2></div><p>${t("intro")}</p></div>
      <div class="health-insight-summary"><span>${esc(countryName)}</span><p><strong>${esc(countryName)}</strong> ${fiscalSignal}; ${protectionSignal}, ${settingSignal} ${t("and")} ${bedSignal}.</p></div>
      <div class="health-insight-grid">${insightCards.join("")}</div>
      <div class="health-map-heading"><div><span>${t("mapKicker")}</span><h3>${t("mapTitle")}</h3></div><p>${t("mapCopy")}</p></div>
      <div class="health-system-map-wrap">
        <div class="health-system-map" role="group" aria-label="${esc(t("mapTitle"))}">
          <i class="health-map-median vertical" style="left:${x(med.gdp)}%"><span>${number(med.gdp)}% ${t("median")}</span></i>
          <i class="health-map-median horizontal" style="bottom:${y(med.beds)}%"><span>${number(med.beds,2)} ${t("median")}</span></i>
          ${rows.map(row=>`<button type="button" class="health-map-dot${row.code===state.code?" selected":""}" data-code="${row.code}" style="left:${x(row.health_gdp_pct)}%;bottom:${y(row.beds_per_1000)}%" aria-label="${esc(NAMES[row.code]?.[state.lang==="en"?1:0]||row.code)}: ${number(row.health_gdp_pct)}%, ${number(row.beds_per_1000,2)} ${t("bedsAxis")}"><i></i><b>${row.code}</b></button>`).join("")}
          <span class="health-map-y">${t("bedsAxis")} ↑</span><span class="health-map-x">${t("spendAxis")} →</span>
        </div>
        <aside><span>${t("takeaway")}</span><strong>${esc(countryName)}</strong><p>${number(profile.health_gdp_pct)} % · ${number(profile.beds_per_1000,2)} ${t("bedsAxis").toLocaleLowerCase(locale())}</p><small>${t("caveat")}</small></aside>
      </div>`;
    ROOT.querySelectorAll(".health-map-dot").forEach(button=>button.addEventListener("click",()=>{
      const selector=document.querySelector("#deep-dive-country");
      if (!selector || selector.value===button.dataset.code) return;
      selector.value=button.dataset.code;
      selector.dispatchEvent(new Event("change",{bubbles:true}));
    }));
  }

  addEventListener("countryprofilechange", event=>{state.code=event.detail.code;state.lang=event.detail.lang==="en"?"en":"cs";render();});
  fetch(`${assetRoot}data/country-health.v1.json`)
    .then(response=>{if(!response.ok)throw new Error(response.status);return response.json();})
    .then(data=>{state.data=data;render();})
    .catch(error=>{console.error("health insights",error);ROOT.hidden=true;});
})();
