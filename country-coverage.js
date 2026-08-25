(() => {
  const code = document.body.dataset.countryCode;
  const profiles = {
    BRA:{slug:"brazil",flag:"br",municipal:"brazil"}, ESP:{slug:"spain",flag:"es",municipal:"spain"},
    JPN:{slug:"japan",flag:"jp",municipal:"japan"}, NLD:{slug:"netherlands",flag:"nl",municipal:"netherlands"},
    NOR:{slug:"norway",flag:"no",municipal:"norway"},
  };
  const routes = {
    CZE:["czechia","Česko","Czechia"],DEU:["germany","Německo","Germany"],DNK:["denmark","Dánsko","Denmark"],FRA:["france","Francie","France"],GBR:["united-kingdom","Spojené království","United Kingdom"],POL:["poland","Polsko","Poland"],SWE:["sweden","Švédsko","Sweden"],CHE:["switzerland","Švýcarsko","Switzerland"],UKR:["ukraine","Ukrajina","Ukraine"],USA:["united-states","Spojené státy","United States"],BRA:["brazil","Brazílie","Brazil"],ESP:["spain","Španělsko","Spain"],JPN:["japan","Japonsko","Japan"],NLD:["netherlands","Nizozemsko","Netherlands"],NOR:["norway","Norsko","Norway"],
  };
  const copy = {
    cs:{back:"Všechny země",eyebrow:"Profil země · obecní finance",lead:"Tento profil publikuje ověřenou obecní fiskální vrstvu. Národní moduly, které zatím nejsou načtené, zůstávají výslovně označené jako chybějící.",change:"Změnit zemi",entities:"Obce v adresáři",itemized:"Položkové profily",period:"Publikované období",lifecycle:"Životní cyklus",coverage:"Co je načtené",coverageTitle:"Publikovaná datová vrstva",coverageCopy:"Každá položka níže popisuje skutečně publikovaný rozsah. Chybějící národní vrstva není nahrazena obecním součtem.",module:"Datový modul",status:"Stav",detail:"Rozsah",loaded:"Načteno",missing:"Chybí",municipal:"Obecní rozpočty",macro:"Harmonizované národní makro",national:"Národní výdajová osnova",health:"Zdravotní systém",transport:"Národní doprava",municipalDetail:"Otevřít obce",method:"Otevřít metodiku",source:"Primární zdroj",limits:"Hranice profilu",limitsCopy:"Obecní účty a rozpočty nejsou náhradou za konsolidovaný národní rozpočet. Tento profil je v kategorii Země proto, aby bylo vidět, co o zemi skutečně máme, a co ještě chybí.",stages:"fází",complete:"úplné",partial:"částečné",lifecycleKicker:"Rozpočtový životní cyklus",lifecycleTitle:"Publikované fáze a detail",lifecycleCopy:"Národní posouzení dostupnosti obecních rozpočtových dat.",feature:"Prvek",evidence:"Doklad",scopeKicker:"Rozsah"},
    en:{back:"All countries",eyebrow:"Country profile · municipal finance",lead:"This profile publishes the verified municipal fiscal layer. National modules that are not loaded remain explicitly marked as missing.",change:"Change country",entities:"Municipalities in directory",itemized:"Itemized profiles",period:"Published period",lifecycle:"Budget lifecycle",coverage:"What is loaded",coverageTitle:"Published data layer",coverageCopy:"Every row below describes the scope actually published. A missing national layer is never replaced by a municipal total.",module:"Data module",status:"Status",detail:"Coverage",loaded:"Loaded",missing:"Missing",municipal:"Municipal budgets",macro:"Harmonised national macro",national:"National spending classification",health:"Health system",transport:"National transport",municipalDetail:"Open municipalities",method:"Open methodology",source:"Primary source",limits:"Profile boundary",limitsCopy:"Municipal accounts and budgets are not a substitute for a consolidated national budget. This profile appears under Countries so readers can see exactly what we have for the country—and what is still missing.",stages:"stages",complete:"complete",partial:"partial",lifecycleKicker:"Budget lifecycle",lifecycleTitle:"Published stages and detail",lifecycleCopy:"National availability assessment for municipal budget data.",feature:"Feature",evidence:"Evidence",scopeKicker:"Scope"},
  };
  let lang = window.PSDLanguage?.current() || (document.documentElement.lang === "en" ? "en" : "cs");
  let directory, itemized, transparency;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const locale = () => lang === "en" ? "en-GB" : "cs-CZ";
  const number = value => Number(value).toLocaleString(locale());
  const featureLabel = feature => ({enacted:lang==="en"?"Adopted budget":"Schválený rozpočet",revised:lang==="en"?"Revised budget":"Upravený rozpočet",execution:lang==="en"?"In-year execution":"Průběžné plnění",actual:lang==="en"?"Final accounts":"Závěrečný účet",function:lang==="en"?"Functional detail":"Funkční detail",economic:lang==="en"?"Economic detail":"Ekonomický detail",api:lang==="en"?"API / bulk":"API / bulk"})[feature];
  function render(){
    const t=copy[lang],profile=profiles[code],country=directory.countries.find(row=>row.code===code),coverage=itemized.countries.find(row=>row.code===code),assessment=transparency.countries.find(row=>row.iso3===code);
    document.documentElement.lang=lang;
    const countryName=lang==="en"?country.name_en:country.name_cs,description=lang==="en"?`Verified municipal public-finance coverage and explicit national data gaps for ${country.name_en}.`:`Ověřené pokrytí obecních financí a výslovně uvedené mezery národních dat pro zemi ${country.name_cs}.`;
    document.title=`${countryName} — Public Spending Data`;
    document.querySelector('meta[name="description"]')?.setAttribute("content",description);
    document.querySelector('meta[property="og:locale"]')?.setAttribute("content",lang==="en"?"en_GB":"cs_CZ");
    document.querySelector('meta[property="og:title"]')?.setAttribute("content",document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content",description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content",document.title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content",description);
    $("#coverage-back").textContent=`← ${t.back}`; $("#coverage-back").href=`/?lang=${lang}#countries`;
    $("#coverage-flag").src=`assets/flags/${profile.flag}.svg`; $("#coverage-code").textContent=code;
    $("#coverage-eyebrow").textContent=t.eyebrow; $("#coverage-name").textContent=lang==="en"?country.name_en:country.name_cs; $("#coverage-lead").textContent=t.lead;
    $("#country-profile-switch-label").textContent=t.change;
    $("#country-profile-switch").innerHTML=Object.entries(routes).map(([routeCode,[slug,cs,en]])=>`<option value="${routeCode}" ${routeCode===code?"selected":""}>${esc(lang==="en"?en:cs)}</option>`).join("");
    const years=country.years||[],period=years.length>1?`${years[0]}–${years.at(-1)}`:`${years[0]||"—"}`;
    $("#coverage-kpis").innerHTML=[[t.entities,number(country.directory_count),country.currency],[t.itemized,`${number(coverage.profile_count)} / ${number(coverage.municipal_scope)}`,coverage[`detail_kind_${lang}`]],[t.period,period,(country.stages||[]).join(" · ")],[t.lifecycle,assessment.category.replaceAll("_"," "),`${Object.values(assessment.features).filter(Boolean).length} / 7 ${t.stages}`]].map(([label,value,note])=>`<article><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`).join("");
    $("#coverage-kicker").textContent=t.coverage; $("#coverage-title").textContent=t.coverageTitle; $("#coverage-copy").textContent=t.coverageCopy;
    const rows=[[t.municipal,true,country[`coverage_${lang}`]],[t.macro,false,lang==="en"?"Not yet loaded into the sovereign benchmark":"Zatím není načteno do národního benchmarku"],[t.national,false,lang==="en"?"No national line-item classification published on this page yet":"Národní položková osnova na této stránce zatím není"],[t.health,false,lang==="en"?"Country health module not loaded":"Národní zdravotní modul není načten"],[t.transport,false,lang==="en"?"Country transport module not loaded":"Národní dopravní modul není načten"]];
    $("#coverage-table").innerHTML=`<thead><tr><th>${t.module}</th><th>${t.status}</th><th>${t.detail}</th></tr></thead><tbody>${rows.map(([name,loaded,detail])=>`<tr><th>${esc(name)}</th><td><span class="coverage-status ${loaded?"loaded":"missing"}">${loaded?t.loaded:t.missing}</span></td><td>${esc(detail)}</td></tr>`).join("")}</tbody>`;
    $("#coverage-lifecycle-kicker").textContent=t.lifecycleKicker; $("#coverage-lifecycle-title").textContent=t.lifecycleTitle; $("#coverage-lifecycle-copy").textContent=t.lifecycleCopy;
    $("#coverage-feature-heading").textContent=t.feature; $("#coverage-feature-status-heading").textContent=t.status; $("#coverage-evidence-heading").textContent=t.evidence; $("#coverage-scope-kicker").textContent=t.scopeKicker;
    $("#coverage-feature-list").innerHTML=Object.entries(assessment.features).map(([key,loaded])=>`<tr><th>${esc(featureLabel(key))}</th><td><span class="coverage-status ${loaded?"loaded":"missing"}">${loaded?t.loaded:t.missing}</span></td><td>${loaded?"✓":"—"}</td></tr>`).join("");
    $("#coverage-note").textContent=assessment[`note_${lang}`]; $("#coverage-limits-title").textContent=t.limits; $("#coverage-limits-copy").textContent=t.limitsCopy;
    $("#coverage-municipal-link").textContent=`${t.municipalDetail} ↗`; $("#coverage-municipal-link").href=`municipalities/${profile.municipal}/?lang=${lang}`;
    $("#coverage-method-link").textContent=`${t.method} ↗`; $("#coverage-method-link").href=`methodology.html?lang=${lang}#municipal-transparency`;
    $("#coverage-source").textContent=`${t.source} ↗`; $("#coverage-source").href=country.source;
    document.querySelectorAll("[data-lang]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.lang===lang)));
  }
  $("#country-profile-switch")?.addEventListener("change",event=>{const [slug]=routes[event.target.value];location.href=`/countries/${slug}?lang=${lang}`});
  document.addEventListener("click",event=>{const button=event.target.closest("[data-lang]");if(!button)return;lang=button.dataset.lang;window.PSDLanguage?.set(lang,{persist:true});history.replaceState(null,"",`?lang=${lang}`);render()});
  Promise.all([
    fetch("data/international-municipalities.v1.json?v=20260825-country-expansion").then(r=>r.json()),
    fetch("data/municipal-itemized-coverage.v1.json?v=20260825-country-expansion").then(r=>r.json()),
    fetch("data/municipal-transparency.v1.json?v=20260825-country-expansion").then(r=>r.json()),
  ]).then(values=>{[directory,itemized,transparency]=values;render()}).catch(error=>{$("#country-coverage-root").innerHTML=`<p class="coverage-error">${esc(error.message)}</p>`});
})();
