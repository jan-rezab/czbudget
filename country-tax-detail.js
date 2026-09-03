(() => {
  const section=document.querySelector("#tax-detail"),root=document.querySelector("#country-tax-detail-root");
  if(!section||!root)return;
  let dataset=null,current={code:window.PSDCountryRoutes?.codeFromLocation?.()||"CZE",lang:document.documentElement.lang==="en"?"en":"cs"};
  const text={
    cs:{kicker:"Daňový mix / OECD",title:"Ze kterých daní příjmy pocházejí",copy:"Srovnatelná klasifikace rozděluje 100 % daňových příjmů sektoru vládních institucí. Nejde o národní státní rozpočet.",personalIncome:"Daň z příjmů fyzických osob",corporateIncome:"Daň z příjmů právnických osob",vat:"DPH",excise:"Spotřební daně",social:"Sociální příspěvky",property:"Majetkové daně",other:"Ostatní",chartLabel:"detail daňových příjmů",source:"Zdroj: OECD Global Revenue Statistics",open:"Otevřít celý příjmový report →"},
    en:{kicker:"Tax mix / OECD",title:"Which taxes revenue comes from",copy:"The comparable classification splits 100% of general-government tax revenue. This is not the national state budget.",personalIncome:"Personal income tax",corporateIncome:"Corporate income tax",vat:"VAT",excise:"Excise taxes",social:"Social-security contributions",property:"Property taxes",other:"Other",chartLabel:"tax revenue detail",source:"Source: OECD Global Revenue Statistics",open:"Open the full revenue report →"}
  };
  function render(){
    const profile=dataset?.countries?.[current.code],t=text[current.lang];
    if(!profile?.tax_detail){section.hidden=true;return}
    section.hidden=false;
    root.innerHTML=`<div class="detail-heading"><div><span class="kicker">${t.kicker}</span><h2 id="tax-detail-title">${t.title}</h2></div><p>${t.copy}</p></div><div id="country-tax-detail-chart"></div><div class="country-tax-detail-source"><span>${t.source}</span><a href="/deep-dives/revenue/?lang=${current.lang}&code=${current.code}">${t.open}</a></div>`;
    window.PSDTaxDetail.render(document.querySelector("#country-tax-detail-chart"),profile.tax_detail,{labels:t,year:profile.latest_year,country:current.code,lang:current.lang});
  }
  addEventListener("countryprofilechange",event=>{current={...current,...event.detail};render()});
  fetch("/data/country-revenue.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json()}).then(value=>{dataset=value;render()}).catch(error=>{console.error("country tax detail",error);section.hidden=true});
})();
