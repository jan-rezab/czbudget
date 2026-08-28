(()=>{
const root=document.querySelector("#country-parity-root");
if(!root)return;
const state={data:null,itemized:null,code:window.PSDCountryRoutes.codeFromLocation(),lang:new URLSearchParams(location.search).get("lang")||localStorage.getItem("psd-lang")||"cs"};
const labels={
 cs:{kicker:"Datový kontrakt / úplnost",title:"Co je skutečně načtené.",copy:"Každá vrstva drží vlastní rozsah, klasifikaci a fiskální fázi. Chybějící údaj není nula.",loaded:"Načteno",missing:"Chybí",modules:"datových vrstev",download:"Stáhnout profil JSON ↗",municipal:"Otevřít obecní adresář ↗",warehouse:"validovaných finančních řádků",names:{sovereign:"Makro a veřejné finance",revenue:"Příjmy",administrative_spending:"Národní výdajová osnova",common_spending:"Srovnatelné kategorie",functional_spending:"Funkční výdaje",transport:"Doprava",health:"Zdravotnictví",providers:"Síť poskytovatelů",municipalities:"Obce",public_entities:"Veřejné subjekty",demography:"Demografie"}},
 en:{kicker:"Data contract / completeness",title:"What is actually loaded.",copy:"Every layer retains its own scope, classification and fiscal stage. A missing observation is not zero.",loaded:"Loaded",missing:"Missing",modules:"data layers",download:"Download profile JSON ↗",municipal:"Open municipal directory ↗",warehouse:"validated financial rows",names:{sovereign:"Macro and public finance",revenue:"Revenue",administrative_spending:"Native spending classification",common_spending:"Comparable categories",functional_spending:"Functional spending",transport:"Transport",health:"Health",providers:"Provider network",municipalities:"Municipalities",public_entities:"Public entities",demography:"Demography"}}
};
const fmt=value=>Number(value).toLocaleString(state.lang==="en"?"en-GB":"cs-CZ");
// The profile is served from /countries/<slug>, so the document-relative paths the parity
// contract carries have to be rooted before they become hrefs.
const rooted=path=>/^(?:[a-z]+:)?\//i.test(path)?path:`/${path}`;
function render(){
 if(!state.data)return;
 const country=state.data.countries.find(item=>item.country_code===state.code)||state.data.countries[0],t=labels[state.lang];
 const modules=Object.entries(country.modules);
 const itemized=state.itemized?.countries?.find(item=>item.code===country.country_code);
 const warehouseRows=(Number(itemized?.line_fact_count)||0)+(Number(itemized?.balance_fact_count)||0)||(Number(itemized?.line_item_count)||0);
 root.innerHTML=`<div class="detail-heading"><div><span class="kicker">${t.kicker}</span><h2 id="country-parity-title">${t.title}</h2></div><p>${t.copy}</p></div><div class="parity-summary"><strong>${country.coverage.loaded_modules} / ${country.coverage.total_modules}</strong><span>${t.modules}</span>${warehouseRows?`<b>${fmt(warehouseRows)} ${t.warehouse}</b>`:""}</div><div class="parity-grid">${modules.map(([key,module])=>`<article class="${module.status}"><header><span>${module.status==="loaded"?t.loaded:t.missing}</span><i aria-hidden="true"></i></header><h3>${t.names[key]||key}</h3><p>${module.coverage}</p>${module.missing_dimensions.length?`<small>${module.missing_dimensions.join(" · ")}</small>`:""}</article>`).join("")}</div><div class="parity-actions"><a href="${rooted(country.profile)}">${t.download}</a>${country.modules.municipalities.directory?`<a href="${rooted(country.modules.municipalities.directory)}">${t.municipal}</a>`:""}</div>`;
}
addEventListener("countryprofilechange",event=>{state.code=event.detail.code;state.lang=event.detail.lang;render()});
Promise.all([
 fetch("/data/country-parity.v1.json").then(response=>{if(!response.ok)throw new Error(`Parity ${response.status}`);return response.json()}),
 fetch("/data/municipal-itemized-coverage.v1.json").then(response=>{if(!response.ok)throw new Error(`Itemized coverage ${response.status}`);return response.json()})
]).then(([data,itemized])=>{state.data=data;state.itemized=itemized;render()}).catch(error=>{console.error(error);root.textContent="Data contract unavailable."});
})();
