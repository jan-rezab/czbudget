(() => {
  const state={data:null,code:window.PSDCountryRoutes.codeFromLocation(),lang:document.documentElement.lang==="en"?"en":"cs",query:"",region:""};
  const $=selector=>document.querySelector(selector), esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const copy={cs:{kicker:"06C / Síť poskytovatelů",title:"Od systému k nemocnici.",intro:"Aktuální registr lůžkových míst propojuje národní tok s konkrétní sítí poskytovatelů.",facilities:"Místa lůžkové péče",providers:"Poskytovatelé",regions:"Kraje",search:"Hledat zařízení, poskytovatele nebo obec",all:"Všechny kraje",facility:"Zařízení",provider:"Poskytovatel",type:"Typ",place:"Místo",care:"Obory péče",showing:"Zobrazeno",source:"Otevřený registr",payments:"Úhrady poskytovatelům",loading:"Načítám národní registr…"},en:{kicker:"06C / Provider network",title:"From system to hospital.",intro:"The current inpatient-location register connects the national flow to the actual provider network.",facilities:"Inpatient locations",providers:"Providers",regions:"Regions",search:"Search facility, provider or municipality",all:"All regions",facility:"Facility",provider:"Provider",type:"Type",place:"Location",care:"Care fields",showing:"Showing",source:"Open register",payments:"Provider payments",loading:"Loading the national register…"}};
  async function loadCountry(){
    const country=state.data?.countries[state.code],section=$("#provider-network"),root=$("#country-provider-root"),t=copy[state.lang];
    if(!country?.records){section.hidden=true;return}
    section.hidden=false;
    if(Array.isArray(country.facilities)){render();return}
    root.textContent=t.loading;
    const requested=state.code;
    // The register path arrives document-relative from the network file; the profile is
    // served from /countries/<slug>, so root it before requesting the shard.
    try{const response=await fetch(/^(?:[a-z]+:)?\//i.test(country.records)?country.records:`/${country.records}`);if(!response.ok)throw new Error(response.status);const shard=await response.json();country.facilities=shard.facilities;if(state.code===requested)render()}
    catch(error){console.error("Country provider shard",error);if(state.code===requested)root.textContent="Provider register unavailable."}
  }
  function render(){
    const section=$("#provider-network"),root=$("#country-provider-root"),country=state.data?.countries[state.code],t=copy[state.lang],supported=Array.isArray(country?.facilities);
    section.hidden=!supported;if(!supported)return;
    const regions=Object.keys(country.regions).sort((a,b)=>a.localeCompare(b,state.lang)),needle=state.query.toLocaleLowerCase(state.lang);
    const filtered=country.facilities.filter(item=>(!state.region||item.region===state.region)&&(!needle||[item.name,item.provider_name,item.municipality,item.facility_type,...item.care_fields].join(" ").toLocaleLowerCase(state.lang).includes(needle)));
    root.innerHTML=`<div class="detail-heading"><div><span class="kicker">${t.kicker}</span><h2>${t.title}</h2></div><p>${t.intro}</p></div><div class="provider-kpis"><article><span>${t.facilities}</span><strong>${country.facility_count.toLocaleString()}</strong></article><article><span>${t.providers}</span><strong>${country.provider_count.toLocaleString()}</strong></article><article><span>${t.regions}</span><strong>${regions.length}</strong></article></div><div class="provider-toolbar"><input id="provider-search" type="search" value="${esc(state.query)}" placeholder="${t.search}" aria-label="${t.search}"><select id="provider-region" aria-label="${t.regions}"><option value="">${t.all}</option>${regions.map(region=>`<option ${region===state.region?"selected":""}>${esc(region)}</option>`).join("")}</select></div><div class="provider-table-wrap" tabindex="0"><table><thead><tr><th>${t.facility}</th><th>${t.provider}</th><th>${t.type}</th><th>${t.place}</th><th>${t.care}</th></tr></thead><tbody>${filtered.slice(0,150).map(item=>`<tr><td><strong>${esc(item.name)}</strong></td><td>${esc(item.provider_name)}</td><td>${esc(item.facility_type)}</td><td>${esc(item.municipality)}<small>${esc(item.region)}</small></td><td>${esc(item.care_fields.slice(0,3).join(" · "))}</td></tr>`).join("")}</tbody></table></div><p class="provider-method">${t.showing}: ${Math.min(150,filtered.length).toLocaleString()} / ${filtered.length.toLocaleString()} · ${esc(state.data.methodology[state.lang])} <a href="${esc(country.source.url)}" target="_blank" rel="noreferrer">${t.source} ↗</a><br><b>${t.payments}:</b> ${esc(country.payments[`note_${state.lang}`])}</p>`;
    $("#provider-search").addEventListener("input",event=>{state.query=event.target.value;render()});
    $("#provider-region").addEventListener("change",event=>{state.region=event.target.value;render()});
  }
  addEventListener("countryprofilechange",event=>{state.code=event.detail.code;state.lang=event.detail.lang==="en"?"en":"cs";state.query="";state.region="";loadCountry()});
  fetch("/data/country-provider-networks.v1.json").then(response=>response.json()).then(data=>{state.data=data;loadCountry()}).catch(error=>console.error("Country provider network",error));
})();
