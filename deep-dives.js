(() => {
  const params=new URLSearchParams(location.search);
  const requestedLanguage=params.get("lang");
  const lang=["cs","en"].includes(requestedLanguage)?requestedLanguage:(document.documentElement.lang==="en"?"en":"cs");
  document.documentElement.lang=lang;
  const countries=[
    ["CZE","Česko","Czechia"],["DEU","Německo","Germany"],["DNK","Dánsko","Denmark"],
    ["FIN","Finsko","Finland"],["FRA","Francie","France"],["GBR","Spojené království","United Kingdom"],["POL","Polsko","Poland"],
    ["SWE","Švédsko","Sweden"],["CHE","Švýcarsko","Switzerland"],["UKR","Ukrajina","Ukraine"],
    ["USA","Spojené státy","United States"],["BRA","Brazílie","Brazil"],["ESP","Španělsko","Spain"],
    ["JPN","Japonsko","Japan"],["NLD","Nizozemsko","Netherlands"],["NOR","Norsko","Norway"],["GRC","Řecko","Greece"]
  ];
  const copy={
    cs:{
      indexEyebrow:"Hloubkové profily / napříč zeměmi",indexTitle:"Rozpočty podle témat",indexIntro:"Každý report sleduje jedno téma napříč zeměmi: kolik se vydává, co za to je a odkud čísla pocházejí. Filtr země funguje ve všech reportech stejně.",available:"Dostupné nyní",transport:"Doprava",transportCopy:"Výdaje, délka silniční a dálniční sítě, desetiletý vývoj a čistá meziroční změna.",open:"Otevřít profil",next:"Další profil",health:"Zdraví",healthCopy:"Financování, zdroje plateb, poskytovatelé, lůžka a kapacita systému.",preparing:"Připravujeme",contract:"Společná struktura",contractTitle:"Co v každém reportu najdete",contractCopy:"Výdaje země, kapacitu a výsledky systému, vývoj v čase a srovnání se stejnou skupinou zemí. Pořadí sekcí je ve všech reportech stejné.",topic:"Téma",country:"Vybraná země",history:"Historie",comparison:"Srovnání",method:"Metodika",transportEyebrow:"Report / Doprava",transportTitle:"Výdaje na dopravu a dopravní síť",transportIntro:"Vyberte zemi. Celý profil se přepočítá, zatímco srovnávací tabulka zachová všech deset zemí.",healthEyebrow:"Report / Zdraví",healthTitle:"Financování a kapacita zdravotnictví",healthIntro:"Devět zemí sdílí harmonizovaný profil financování, poskytovatelů a lůžek. Srovnání veřejných výdajů zachovává všech deset zemí.",selectCountry:"Filtrovat podle země",countryProfile:"Otevřít celý profil země",overview:"Přehled",analysis:"Analýza",spending:"Výdaje",system:"Tok systému",benchmark:"Benchmark",allCountries:"10 zemí",healthCountries:"9 zemí",sources:"Zdroje"
    },
    en:{
      indexEyebrow:"Deep dives / across countries",indexTitle:"Budgets by topic",indexIntro:"Each report follows one topic across countries: what is spent, what it buys and where the figures come from. The country filter works the same way in every report.",available:"Available now",transport:"Transportation",transportCopy:"Spending, road and motorway scale, ten-year history and annual net change.",open:"Open deep dive",next:"Next deep dive",health:"Health",healthCopy:"Funding, financing sources, providers, beds and system capacity.",preparing:"In preparation",contract:"Shared structure",contractTitle:"What every report covers",contractCopy:"Country spending, system capacity and outcomes, change over time, and a comparison against the same group of countries, in the same order in every report.",topic:"Topic",country:"Selected country",history:"History",comparison:"Comparison",method:"Method",transportEyebrow:"Report / Transportation",transportTitle:"Transport spending and the road network",transportIntro:"Choose a country. The entire profile updates while the comparison table keeps all ten countries visible.",healthEyebrow:"Report / Health",healthTitle:"Health-care funding and capacity",healthIntro:"Nine countries share a harmonised profile of financing, providers and beds. The public-spending comparison retains all ten countries.",selectCountry:"Filter by country",countryProfile:"Open full country profile",overview:"Overview",analysis:"Analysis",spending:"Spending",system:"System flow",benchmark:"Benchmark",allCountries:"10 countries",healthCountries:"9 countries",sources:"Sources"
    }
  };
  Object.assign(copy.cs,{transportCopy:"Výdaje, jejich investiční a provozní skladba, úrovně vlády, síť a desetiletý vývoj.",transportTitle:"Výdaje na dopravu po vrstvách",transportIntro:"Skutečné výdaje v členění na investice, provoz, mzdy, dotace a transfery, k tomu deset let vývoje silniční sítě a srovnání zemí.",budget:"Rozpočet",insights:"Insighty",performance:"Výkon",healthCopy:"Výdaje, pracovní síla, využití nemocnic a zdravotní výsledky.",healthIntro:"Deset zemí propojuje výdaje s pracovní silou, využitím nemocnic a výsledky. Detailní tok financování je dostupný pro devět systémů."});
  Object.assign(copy.en,{transportCopy:"Spending, its investment and operating mix, government levels, network scale and ten-year history.",transportTitle:"Transport spending, layer by layer",transportIntro:"Actual spending is split into investment, operations, payroll, subsidies and transfers, alongside ten years of network history and cross-country context.",budget:"Budget",insights:"Insights",performance:"Performance",healthCopy:"Spending, workforce, hospital use and health outcomes.",healthIntro:"Ten countries connect spending with workforce, hospital use and outcomes. Detailed financing flows are available for nine systems."});
  Object.assign(copy.cs,{stateCompanies:"Státní podniky",stateCompaniesCopy:"Katalog třiceti největších celostátně ovládaných podniků, s výnosy přepočtenými na eura."});
  Object.assign(copy.en,{stateCompanies:"State-owned enterprises",stateCompaniesCopy:"A catalogue of the thirty largest nationally controlled enterprises, with revenue converted to euros."});
  Object.assign(copy.cs,{capitalCities:"Hlavní města",capitalCitiesCopy:"Rozpočtové plány hlavních měst, návštěvnost a srovnání ve skupinách podobných měst."});
  Object.assign(copy.en,{capitalCities:"Capital cities",capitalCitiesCopy:"Capital-city budget plans, visitor numbers and comparisons within groups of similar cities."});
  Object.assign(copy.cs,{revenue:"Odkud stát bere peníze",revenueCopy:"Daňový mix, úrovně vlády, vývoj v krizích a cesta k obecním transferům."});
  Object.assign(copy.en,{revenue:"Where the state gets its money",revenueCopy:"The tax mix, government levels, behaviour in downturns and the path to municipal transfers."});
  Object.assign(copy.cs,{ageing:"Stárnutí populace",ageingCopy:"Oficiální populační projekce, věková struktura a demografická kalkulačka; fiskální předpovědi neděláme.",ageingEyebrow:"Report / Stárnutí",ageingTitle:"Stárnutí populace",ageingIntro:"Oficiální populační projekce a demografická aritmetika, která z nich plyne. Náklady ani daně nepředpovídáme.",projectionStats:"Projekce",calculator:"Kalkulačka"});
  Object.assign(copy.en,{ageing:"Population ageing",ageingCopy:"Official population projections, age structure and a demographic calculator; we do not forecast fiscal outcomes.",ageingEyebrow:"Report / Ageing",ageingTitle:"Population ageing",ageingIntro:"Official population projections and the demographic arithmetic that follows from them. We do not forecast costs or taxes.",projectionStats:"Projection",calculator:"Calculator"});
  Object.assign(copy.cs,{economy:"Ekonomika v kontextu",economyCopy:"Globální dlouhé řady, hospodářský cyklus, pokrytí a datový kontrakt pro další ekonometrické reporty."});
  Object.assign(copy.en,{economy:"Economy in context",economyCopy:"Global long-run series, the economic cycle, coverage and a reusable contract for econometric reporting."});
  Object.assign(copy.cs,{migration:"Evropská migrace",migrationCopy:"Přistěhování, vystěhování a migrační saldo všech 27 zemí EU v letech 2000–2024.",indexCoverage:"až 27 zemí"});
  Object.assign(copy.en,{migration:"European migration",migrationCopy:"Immigration, emigration and migration balance across all 27 EU countries from 2000 to 2024.",indexCoverage:"up to 27 countries"});
  Object.assign(copy.cs,{defense:"Výdaje na obranu",defenseCopy:"Výdaje vůči HDP, závazek NATO a nejpodrobnější dostupné řádky národních rozpočtů."});
  Object.assign(copy.en,{defense:"Defense spending",defenseCopy:"Spending relative to GDP, the NATO commitment and the most detailed available national budget lines."});
  Object.assign(copy.cs,{taxBurden:"Daňové zatížení",taxBurdenCopy:"Zdanění práce, firem a uhlíku a daňová pravomoc obcí podle definic OECD.",redistribution:"Přerozdělení a výsledky",redistributionCopy:"Nerovnost před transfery a po nich, sociální výdaje a důchody."});
  Object.assign(copy.en,{taxBurden:"Tax burden",taxBurdenCopy:"Taxes on labour, business and carbon, plus municipal taxing power, under OECD definitions.",redistribution:"Redistribution and outcomes",redistributionCopy:"Inequality before and after transfers, social spending and pensions."});
  Object.assign(copy.cs,{education:"Školství",educationCopy:"Celý tok od ministerstva přes kraje a obce až k typům škol, bez dvojího započtení transferů.",indexCoverage:"až 48 zemí"});
  Object.assign(copy.en,{education:"Education",educationCopy:"The full flow from ministry through regions and municipalities to school types, without double-counting transfers.",indexCoverage:"up to 48 countries"});
  Object.assign(copy.cs,{indexEyebrow:"Reporty napříč zeměmi",open:"Otevřít report",next:"Další report",contractTitle:"Co v každém reportu najdete"});
  Object.assign(copy.en,{indexEyebrow:"Reports across countries",open:"Open report",next:"Next report",contractTitle:"What every report covers"});
  const t=copy[lang];
  const name=(code)=>{const row=countries.find(item=>item[0]===code);return row?.[lang==="en"?2:1]??code};
  function translate(){
    document.querySelectorAll("[data-deep-copy]").forEach(node=>{const value=t[node.dataset.deepCopy];if(value)node.textContent=value});
    document.querySelectorAll("[data-deep-lang]").forEach(button=>button.classList.toggle("active",button.dataset.deepLang===lang));
    document.querySelectorAll("[data-deep-link]").forEach(link=>{const url=new URL(link.getAttribute("href"),location.href);url.searchParams.set("lang",lang);link.href=url.href});
  }
  function setCountry(code){
    const selector=document.querySelector("#deep-dive-country");
    const available=selector?[...selector.options].map(option=>option.value):countries.map(item=>item[0]);
    const selected=available.includes(code)?code:"CZE";
    if(selector)selector.value=selected;
    const title=document.querySelector("#deep-dive-country-name");if(title)title.textContent=name(selected);
    const badge=document.querySelector("#deep-dive-country-code");if(badge)badge.textContent=selected;
    const profile=document.querySelector("#deep-dive-country-profile");if(profile)profile.href=window.PSDCountryRoutes.href(selected,lang);
    dispatchEvent(new CustomEvent("countryprofilechange",{detail:{code:selected,lang}}));
  }
  function setupStickyFilter(){
    const rail=document.querySelector(".deep-topic-rail[data-sticky-filter]");
    if(!rail)return;
    const source=document.querySelector(rail.dataset.stickyFilter);
    if(!source)return;
    const kind=rail.dataset.stickyFilterKind==="city"?"city":"country";
    const label=document.createElement("label");
    label.className="deep-sticky-filter";
    const labelText=document.createElement("span");
    labelText.textContent=kind==="city"?(lang==="en"?"City":"Město"):(lang==="en"?"Country":"Země");
    const select=document.createElement("select");
    select.setAttribute("aria-label",kind==="city"?(lang==="en"?"Compare another city":"Porovnat jiné město"):(lang==="en"?"Compare another country":"Porovnat jinou zemi"));
    label.append(labelText,select);
    const links=document.createElement("div");
    links.className="deep-topic-links";
    [...rail.children].forEach(node=>links.append(node));
    rail.append(links,label);
    rail.classList.add("has-sticky-filter");
    let optionsSignature="";
    const sync=()=>{
      const nextSignature=[...source.options].map(option=>`${option.value}:${option.textContent}`).join("|");
      if(nextSignature!==optionsSignature){
        select.replaceChildren(...[...source.options].map(option=>option.cloneNode(true)));
        optionsSignature=nextSignature;
      }
      select.value=source.value;
      select.disabled=source.disabled;
      label.hidden=source.options.length===0;
    };
    select.addEventListener("change",()=>{
      source.value=select.value;
      source.dispatchEvent(new Event("change",{bubbles:true}));
      sync();
    });
    source.addEventListener("change",sync);
    addEventListener("deepfilterchange",sync);
    new MutationObserver(sync).observe(source,{attributes:true,childList:true,subtree:true});
    sync();
  }
  addEventListener("DOMContentLoaded",()=>{
    translate();
    const selector=document.querySelector("#deep-dive-country");
    if(selector){
      const allowed=(selector.dataset.countryCodes||countries.map(item=>item[0]).join(",")).split(",");
      selector.innerHTML=countries.filter(([code])=>allowed.includes(code)).map(([code,cs,en])=>`<option value="${code}">${lang==="en"?en:cs}</option>`).join("");
      setCountry(params.get("code")||"CZE");
      selector.addEventListener("change",()=>{const url=new URL(location.href);url.searchParams.set("code",selector.value);url.searchParams.set("lang",lang);history.replaceState({},"",url);setCountry(selector.value)});
    }
    setupStickyFilter();
    document.querySelectorAll("[data-deep-lang]").forEach(button=>button.addEventListener("click",()=>{const url=new URL(location.href);url.searchParams.set("lang",button.dataset.deepLang);location.href=url.href}));
  });
})();
