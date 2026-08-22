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
      indexEyebrow:"Hloubkové profily / napříč zeměmi",indexTitle:"Jedno téma. Deset zemí. Celý příběh.",indexIntro:"Tematické profily propojují rozpočty s výsledky a fyzickou kapacitou. Každý profil používá stejný filtr země a vždy zachovává srovnání se všemi zeměmi.",available:"Dostupné nyní",transport:"Doprava",transportCopy:"Výdaje, délka silniční a dálniční sítě, desetiletý vývoj a čistá meziroční změna.",open:"Otevřít profil",next:"Další profil",health:"Zdraví",healthCopy:"Financování, zdroje plateb, poskytovatelé, lůžka a kapacita systému.",preparing:"Připravujeme",contract:"Společná struktura",contractTitle:"Každý hluboký profil odpovídá na stejné otázky.",contractCopy:"Kolik země vydává? Co za to systém poskytuje? Jak se vyvíjí? A jak si stojí proti stejnému okruhu zemí?",topic:"Téma",country:"Vybraná země",history:"Historie",comparison:"Srovnání",method:"Metodika",transportEyebrow:"Hloubkový profil / Doprava",transportTitle:"Peníze, síť a tempo výstavby.",transportIntro:"Vyberte zemi. Celý profil se přepočítá, zatímco srovnávací tabulka zachová všech deset zemí.",selectCountry:"Filtrovat podle země",countryProfile:"Otevřít celý profil země",overview:"Přehled",analysis:"Analýza",allCountries:"10 zemí",sources:"Zdroje"
    },
    en:{
      indexEyebrow:"Deep dives / across countries",indexTitle:"One topic. Ten countries. The whole story.",indexIntro:"Topic profiles connect budgets with outcomes and physical capacity. Every profile uses the same country filter and always keeps the full-country comparison visible.",available:"Available now",transport:"Transportation",transportCopy:"Spending, road and motorway scale, ten-year history and annual net change.",open:"Open deep dive",next:"Next deep dive",health:"Health",healthCopy:"Funding, financing sources, providers, beds and system capacity.",preparing:"In preparation",contract:"Shared structure",contractTitle:"Every deep dive answers the same questions.",contractCopy:"How much does the country spend? What capacity does the system provide? How is it changing? And how does it compare with the same group of countries?",topic:"Topic",country:"Selected country",history:"History",comparison:"Comparison",method:"Method",transportEyebrow:"Deep dive / Transportation",transportTitle:"Money, network and build pace.",transportIntro:"Choose a country. The entire profile updates while the comparison table keeps all ten countries visible.",selectCountry:"Filter by country",countryProfile:"Open full country profile",overview:"Overview",analysis:"Analysis",allCountries:"10 countries",sources:"Sources"
    }
  };
  const t=copy[lang];
  const name=(code)=>{const row=countries.find(item=>item[0]===code);return row?.[lang==="en"?2:1]??code};
  function translate(){
    document.querySelectorAll("[data-deep-copy]").forEach(node=>{const value=t[node.dataset.deepCopy];if(value)node.textContent=value});
    document.querySelectorAll("[data-deep-lang]").forEach(button=>button.classList.toggle("active",button.dataset.deepLang===lang));
    document.querySelectorAll("[data-deep-link]").forEach(link=>{const url=new URL(link.getAttribute("href"),location.href);url.searchParams.set("lang",lang);link.href=url.href});
  }
  function setCountry(code){
    const selected=countries.some(item=>item[0]===code)?code:"CZE";
    const selector=document.querySelector("#deep-dive-country");if(selector)selector.value=selected;
    const title=document.querySelector("#deep-dive-country-name");if(title)title.textContent=name(selected);
    const badge=document.querySelector("#deep-dive-country-code");if(badge)badge.textContent=selected;
    const profile=document.querySelector("#deep-dive-country-profile");if(profile)profile.href=`../../country.html?code=${selected}&lang=${lang}`;
    dispatchEvent(new CustomEvent("countryprofilechange",{detail:{code:selected,lang}}));
  }
  addEventListener("DOMContentLoaded",()=>{
    translate();
    const selector=document.querySelector("#deep-dive-country");
    if(selector){
      selector.innerHTML=countries.map(([code,cs,en])=>`<option value="${code}">${lang==="en"?en:cs}</option>`).join("");
      setCountry(params.get("code")||"CZE");
      selector.addEventListener("change",()=>{const url=new URL(location.href);url.searchParams.set("code",selector.value);url.searchParams.set("lang",lang);history.replaceState({},"",url);setCountry(selector.value)});
    }
    document.querySelectorAll("[data-deep-lang]").forEach(button=>button.addEventListener("click",()=>{const url=new URL(location.href);url.searchParams.set("lang",button.dataset.deepLang);location.href=url.href}));
  });
})();
