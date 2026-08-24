(() => {
  const params=new URLSearchParams(location.search);
  const requestedLanguage=params.get("lang");
  const lang=["cs","en"].includes(requestedLanguage)?requestedLanguage:(document.documentElement.lang==="en"?"en":"cs");
  document.documentElement.lang=lang;
  const countries=[
    ["CZE","Česko","Czechia"],["DEU","Německo","Germany"],["DNK","Dánsko","Denmark"],
    ["FRA","Francie","France"],["GBR","Spojené království","United Kingdom"],["POL","Polsko","Poland"],
    ["SWE","Švédsko","Sweden"],["CHE","Švýcarsko","Switzerland"],["UKR","Ukrajina","Ukraine"],
    ["USA","Spojené státy","United States"]
  ];
  const copy={
    cs:{
      indexEyebrow:"Hloubkové profily / napříč zeměmi",indexTitle:"Jedno téma. Více zemí. Celý příběh.",indexIntro:"Tematické profily propojují rozpočty s výsledky a fyzickou kapacitou. Každý profil používá stejný filtr země a vždy zachovává srovnání se všemi zeměmi.",available:"Dostupné nyní",transport:"Doprava",transportCopy:"Výdaje, délka silniční a dálniční sítě, desetiletý vývoj a čistá meziroční změna.",open:"Otevřít profil",next:"Další profil",health:"Zdraví",healthCopy:"Financování, zdroje plateb, poskytovatelé, lůžka a kapacita systému.",preparing:"Připravujeme",contract:"Společná struktura",contractTitle:"Každý hluboký profil odpovídá na stejné otázky.",contractCopy:"Kolik země vydává? Co za to systém poskytuje? Jak se vyvíjí? A jak si stojí proti stejnému okruhu zemí?",topic:"Téma",country:"Vybraná země",history:"Historie",comparison:"Srovnání",method:"Metodika",transportEyebrow:"Hloubkový profil / Doprava",transportTitle:"Peníze, síť a tempo výstavby.",transportIntro:"Vyberte zemi. Celý profil se přepočítá, zatímco srovnávací tabulka zachová všech deset zemí.",healthEyebrow:"Hloubkový profil / Zdraví",healthTitle:"Peníze, péče a kapacita systému.",healthIntro:"Devět zemí sdílí harmonizovaný profil financování, poskytovatelů a lůžek. Srovnání veřejných výdajů zachovává všech deset zemí.",selectCountry:"Filtrovat podle země",countryProfile:"Otevřít celý profil země",overview:"Přehled",analysis:"Analýza",spending:"Výdaje",system:"Tok systému",benchmark:"Benchmark",allCountries:"10 zemí",healthCountries:"9 zemí",sources:"Zdroje"
    },
    en:{
      indexEyebrow:"Deep dives / across countries",indexTitle:"One topic. More countries. The whole story.",indexIntro:"Topic profiles connect budgets with outcomes and physical capacity. Every profile uses the same country filter and always keeps the full-country comparison visible.",available:"Available now",transport:"Transportation",transportCopy:"Spending, road and motorway scale, ten-year history and annual net change.",open:"Open deep dive",next:"Next deep dive",health:"Health",healthCopy:"Funding, financing sources, providers, beds and system capacity.",preparing:"In preparation",contract:"Shared structure",contractTitle:"Every deep dive answers the same questions.",contractCopy:"How much does the country spend? What capacity does the system provide? How is it changing? And how does it compare with the same group of countries?",topic:"Topic",country:"Selected country",history:"History",comparison:"Comparison",method:"Method",transportEyebrow:"Deep dive / Transportation",transportTitle:"Money, network and build pace.",transportIntro:"Choose a country. The entire profile updates while the comparison table keeps all ten countries visible.",healthEyebrow:"Deep dive / Health",healthTitle:"Money, care and system capacity.",healthIntro:"Nine countries share a harmonised profile of financing, providers and beds. The public-spending comparison retains all ten countries.",selectCountry:"Filter by country",countryProfile:"Open full country profile",overview:"Overview",analysis:"Analysis",spending:"Spending",system:"System flow",benchmark:"Benchmark",allCountries:"10 countries",healthCountries:"9 countries",sources:"Sources"
    }
  };
  Object.assign(copy.cs,{transportCopy:"Výdaje, jejich investiční a provozní skladba, úrovně vlády, síť a desetiletý vývoj.",transportTitle:"Rozpočet dopravy, rozebraný do poslední vrstvy.",transportIntro:"Skutečné výdaje členíme na investice, provoz, mzdy, dotace a transfery; vedle toho držíme desetiletou historii sítě a srovnání zemí.",budget:"Rozpočet",insights:"Insighty",performance:"Výkon",healthCopy:"Výdaje, pracovní síla, využití nemocnic a zdravotní výsledky.",healthIntro:"Deset zemí propojuje výdaje s pracovní silou, využitím nemocnic a výsledky. Detailní tok financování je dostupný pro devět systémů."});
  Object.assign(copy.en,{transportCopy:"Spending, its investment and operating mix, government levels, network scale and ten-year history.",transportTitle:"The transport budget, layer by layer.",transportIntro:"Actual spending is split into investment, operations, payroll, subsidies and transfers, alongside ten years of network history and cross-country context.",budget:"Budget",insights:"Insights",performance:"Performance",healthCopy:"Spending, workforce, hospital use and health outcomes.",healthIntro:"Ten countries connect spending with workforce, hospital use and outcomes. Detailed financing flows are available for nine systems."});
  Object.assign(copy.cs,{stateCompanies:"Státní podniky",stateCompaniesCopy:"Katalog třiceti největších celostátně ovládaných podniků, s výnosy přepočtenými na eura."});
  Object.assign(copy.en,{stateCompanies:"State-owned enterprises",stateCompaniesCopy:"A catalogue of the thirty largest nationally controlled enterprises, with revenue converted to euros."});
  Object.assign(copy.cs,{capitalCities:"Hlavní města",capitalCitiesCopy:"Rozpočet na obyvatele, turistický tlak, salda a pět srovnatelných skupin."});
  Object.assign(copy.en,{capitalCities:"Capital cities",capitalCitiesCopy:"Budget per resident, visitor pressure, balances and five comparable city clusters."});
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
    const profile=document.querySelector("#deep-dive-country-profile");if(profile)profile.href=`../../country.html?code=${selected}&lang=${lang}`;
    dispatchEvent(new CustomEvent("countryprofilechange",{detail:{code:selected,lang}}));
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
    document.querySelectorAll("[data-deep-lang]").forEach(button=>button.addEventListener("click",()=>{const url=new URL(location.href);url.searchParams.set("lang",button.dataset.deepLang);location.href=url.href}));
  });
})();
