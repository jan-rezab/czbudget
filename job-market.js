(() => {
  const countryNames = {USA:['Spojené státy','United States'],CZE:['Česko','Czechia'],DEU:['Německo','Germany'],FRA:['Francie','France'],GBR:['Spojené království','United Kingdom'],POL:['Polsko','Poland']};
  const sectionNames = {
    G:['Velkoobchod a maloobchod','Wholesale and retail trade'],H:['Doprava a skladování','Transportation and storage'],I:['Ubytování a stravování','Accommodation and food'],J:['Informace a komunikace','Information and communication'],K:['Finance a pojištění','Finance and insurance'],L:['Nemovitosti','Real estate'],M:['Odborné a vědecké činnosti','Professional and scientific services'],N:['Administrativní a podpůrné činnosti','Administrative and support services'],O:['Veřejná správa a obrana','Public administration and defence'],P:['Vzdělávání','Education'],Q:['Zdravotní a sociální péče','Health and social work'],R:['Umění, zábava a rekreace','Arts, entertainment and recreation'],S:['Ostatní služby','Other services']
  };
  const divisionNames = {
    G45:['Motorová vozidla','Motor vehicles'],G46:['Velkoobchod','Wholesale trade'],G47:['Maloobchod','Retail trade'],H49:['Pozemní doprava','Land transport'],H50:['Vodní doprava','Water transport'],H51:['Letecká doprava','Air transport'],H52:['Skladování a podpora dopravy','Warehousing and transport support'],H53:['Pošta a kurýři','Postal and courier'],I55:['Ubytování','Accommodation'],I56:['Stravování','Food and beverage'],J58:['Vydavatelství','Publishing'],J59:['Film, video a hudba','Film, video and music'],J60:['Vysílání','Broadcasting'],J61:['Telekomunikace','Telecommunications'],J62:['Programování a IT poradenství','Computer programming and IT consultancy'],J63:['Informační služby','Information services'],K64:['Finanční služby','Financial services'],K65:['Pojištění a penze','Insurance and pensions'],K66:['Podpora finančních služeb','Financial support services'],L68:['Činnosti v nemovitostech','Real estate activities'],M69:['Právo a účetnictví','Legal and accounting'],M70:['Řízení podniků a poradenství','Head offices and management consulting'],M71:['Architektura a inženýrství','Architecture and engineering'],M72:['Výzkum a vývoj','Research and development'],M73:['Reklama a průzkum trhu','Advertising and market research'],M74:['Ostatní odborné činnosti','Other professional activities'],M75:['Veterinární činnosti','Veterinary activities'],N77:['Pronájem a leasing','Rental and leasing'],N78:['Zprostředkování práce','Employment activities'],N79:['Cestovní kanceláře','Travel agencies'],N80:['Bezpečnostní činnosti','Security activities'],N81:['Správa budov a úklid','Building services and cleaning'],N82:['Kancelářské a podpůrné činnosti','Office and business support'],O84:['Veřejná správa a obrana','Public administration and defence'],P85:['Vzdělávání','Education'],Q86:['Zdravotní péče','Human health'],Q87:['Pobytová sociální péče','Residential care'],Q88:['Ambulantní sociální péče','Social work'],R90:['Tvůrčí a umělecké činnosti','Creative and performing arts'],R91:['Knihovny, archivy a muzea','Libraries, archives and museums'],R92:['Hazardní hry','Gambling and betting'],R93:['Sport a rekreace','Sports and recreation'],S94:['Členské organizace','Membership organisations'],S95:['Opravy počítačů a zboží','Repair of computers and goods'],S96:['Ostatní osobní služby','Other personal services']
  };
  const copy = {
    cs:{eyebrow:'Trh práce / 2024',title:'Kde lidé pracují.<br><em>Kdo je zaměstnává.</em>',intro:'Šest zemí, tři velká odvětví a úplný rozpad 45 druhů služeb. Veřejné zaměstnavatele a lidi mimo pracovní sílu měříme odděleně.',market:'Země',how:'Jak číst čísla ↓',compareTitle:'Šest trhů vedle sebe',compareNote:'Podíl služeb mezi zaměstnanými, podíl veřejných zaměstnavatelů mezi všemi zaměstnanými a míra nezaměstnanosti používají tři různé řady. Chybějící veřejný podíl není nula.',structureTitle:'Tři velká odvětví',structureNote:'Podíl všech zaměstnaných. Modelované odhady ILO přes World Bank WDI.',servicesTitle:'Všech 45 druhů služeb',servicesNote:'Pozorovaná šetření ILOSTAT, sekce G–S klasifikace ISIC Rev. 4. Procenta v kruhu jsou podíly pouze mezi těmito vykázanými druhy služeb.',division:'Oddíl',people:'Zaměstnaní, tisíce',ofListed:'Podíl vykázaných služeb',quality:'Kvalita',serviceCaveat:'Součet 45 oddílů není totožný s modelovaným podílem služeb výše. Jde o jiný zdroj a metodu; řady nesčítáme dohromady.',ownershipTitle:'Kdo zaměstnává: veřejný, nebo soukromý sektor?',ownershipNote:'Podíl veřejných zaměstnavatelů mezi zaměstnanými v daném odvětví. Veřejný sektor ILO zahrnuje vládní jednotky i podniky s nejméně 50% státním vlastnictvím; tyto dvě skupiny zdroj nerozděluje.',statusTitle:'Zaměstnaní, nezaměstnaní a ostatní',statusNote:'Tři podíly používají jako základ populaci v produktivním věku podle národního šetření. Míra nezaměstnanosti má jiný základ: pouze pracovní sílu.',methodTitle:'Zdroje a hranice srovnání',methodIntro:'Přesné hodnoty, jejich jednotky a odkazy jsou zachované v publikovaném datovém vydání.',allReports:'Všechny reporty',agriculture:'Zemědělství',industry:'Průmysl a stavebnictví',services:'Služby',listed:'vykázaných služeb',public:'Veřejní zaměstnavatelé',private:'Soukromí zaměstnavatelé',all:'Všichni zaměstnaní',opq:'Veřejná správa + vzdělávání + zdraví',noOwnership:'ILOSTAT pro tuto zemi nezveřejňuje rozpad podle odvětví × vlastníka v roce 2024. Národní celkový údaj je níže; není dosazen do chybějících odvětví.',fte:'přepočtených pracovních míst',snapshot:'tisíc osob · stav 30. června 2024',annual:'ročně',employed:'Zaměstnaní',unemployed:'Nezaměstnaní',outside:'Mimo pracovní sílu',rate:'Míra nezaměstnanosti',labour:'pracovní síly',population:'populace ve sledovaném věku',source:'Přesný zdroj',unreliable:'U · nízká spolehlivost',reported:'vykázáno',loading:'Načítání publikovaných dat…',failed:'Data se nepodařilo načíst.',share:'Podíl',of:'z',calculated:'vypočteno',modelled:'Modelovaný podíl',observed:'Pozorovaný počet',national:'Národní veřejná zaměstnanost',nationalWarning:'Národní řada používá jinou jednotku a metodiku než ILO rozpad. Německý veřejný počet je červnový stav, celková zaměstnanost roční průměr; jejich podíl je pouze orientační.',sourceValues:'Zdrojové hodnoty',coverage:'Pokrytí',usaAge:'USA: věk 16+; ostatní země: národní šetření 15+.',sectors:'sekcí',total:'Celkem',note:'Metodika',release:'Datové vydání'},
    en:{eyebrow:'Labour market / 2024',title:'Where people work.<br><em>Who employs them.</em>',intro:'Six countries, three broad sectors and the complete breakdown of 45 service divisions. Public employers and people outside the labour force are measured separately.',market:'Country',how:'How to read the figures ↓',compareTitle:'Six markets side by side',compareNote:'Services among the employed, public employers among all employed and the unemployment rate are three distinct series. A missing public share is not zero.',structureTitle:'Three broad sectors',structureNote:'Share of all employed people. ILO modelled estimates via World Bank WDI.',servicesTitle:'All 45 service divisions',servicesNote:'Observed ILOSTAT surveys, ISIC Rev. 4 sections G–S. Pie percentages use only the sum of these reported service divisions.',division:'Division',people:'Employed, thousands',ofListed:'Share of listed services',quality:'Quality',serviceCaveat:'The sum of 45 divisions does not equal the modelled services share above. They come from different sources and methods and are not combined.',ownershipTitle:'Who employs workers: public or private?',ownershipNote:'Public employers as a share of employment in each industry. ILO public sector includes government units and enterprises at least 50% state owned; this source does not split those groups.',statusTitle:'Employed, unemployed and others',statusNote:'The three shares use the surveyed working-age population as denominator. The unemployment rate uses a different denominator: the labour force alone.',methodTitle:'Sources and comparison limits',methodIntro:'Exact source values, units and URLs are preserved in the published data release.',allReports:'All reports',agriculture:'Agriculture',industry:'Industry and construction',services:'Services',listed:'of listed services',public:'Public employers',private:'Private employers',all:'All employed',opq:'Public administration + education + health',noOwnership:'ILOSTAT does not publish the 2024 industry × owner split for this country. A national total appears below and is not used to fill missing industries.',fte:'full-time-equivalent jobs',snapshot:'thousand people · 30 June 2024 snapshot',annual:'annual',employed:'Employed',unemployed:'Unemployed',outside:'Outside labour force',rate:'Unemployment rate',labour:'of labour force',population:'of surveyed age population',source:'Exact source',unreliable:'U · low reliability',reported:'reported',loading:'Loading published data…',failed:'Could not load data.',share:'Share',of:'of',calculated:'calculated',modelled:'Modelled share',observed:'Observed count',national:'National public employment',nationalWarning:'The national series has a different unit and method from the ILO industry split. Germany’s public count is a June snapshot and total employment an annual average; their ratio is indicative only.',sourceValues:'Source values',coverage:'Coverage',usaAge:'US: age 16+; other countries: national age-15+ surveys.',sectors:'sections',total:'Total',note:'Method',release:'Data release'}
  };
  const order = ['USA','CZE','DEU','FRA','GBR','POL'];
  const colors = ['#bf4a35','#e28b3b','#f0bd64','#d9a31b','#879b69','#478978','#2e6f72','#35768f','#555c99','#886c9e','#a65a80','#bd6b55','#7a8271'];
  let data, lang, country = 'USA', selectedSection = null;
  const $ = id => document.getElementById(id);
  const val = row => Number(String(row?.source_value ?? row?.persons_thousands ?? 0).replace(/,/g,''));
  const number = (value, digits=1) => new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
  const pct = value => `${number(value,1)} %`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const sourceLink = (url,label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  const loc = pair => pair?.[lang === 'cs' ? 0 : 1] || '';
  const c = () => copy[lang];

  function renderComparison() {
    $('jm-comparison').innerHTML=`<div class="jm-compare-head"><span>${esc(c().market)}</span><span>${esc(c().services)} / ${esc(c().all)}</span><span>${esc(c().public)} / ${esc(c().all)}</span><span>${esc(c().rate)}</span></div>${order.map(code=>{
      const services=data.series.employment_shares.find(row=>row.country_code===code&&row.sector==='services');
      const ownership=data.series.ownership.filter(row=>row.country_code===code&&row.isic_section==='TOTAL');
      const publicRow=ownership.find(row=>row.employer_sector==='public'),totalRow=ownership.find(row=>row.employer_sector==='total');
      const rate=data.series.labour_status.find(row=>row.country_code===code&&row.metric==='unemployment_rate');
      const serviceValue=services?Number(services.source_value):null;
      const publicValue=publicRow&&totalRow?val(publicRow)/val(totalRow)*100:null;
      return `<button type="button" class="jm-compare-row ${code===country?'active':''}" data-country="${code}" aria-pressed="${code===country}"><b>${esc(loc(countryNames[code]))}</b><span><i class="jm-mini-track"><i style="width:${serviceValue??0}%"></i></i><strong>${serviceValue===null?'—':pct(serviceValue)}</strong></span><span>${publicValue===null?'—':pct(publicValue)}</span><span>${rate?pct(val(rate)):'—'}</span></button>`;
    }).join('')}<p class="jm-footnote">${esc(c().compareNote)} ${sourceLink(data.series.employment_shares.find(row=>row.sector==='services').source_url,c().services)} · ${sourceLink(data.series.ownership.find(row=>row.isic_section==='TOTAL').source_url,c().public)} · ${sourceLink(data.series.labour_status.find(row=>row.metric==='unemployment_rate').source_url,c().rate)}. ${esc(c().public)}: ${esc(c().calculated)} = ${esc(c().public)} ÷ ${esc(c().all)}.</p>`;
    $('jm-comparison').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{country=button.dataset.country;selectedSection=null;render();$('jm-comparison').querySelector(`[data-country="${country}"]`)?.focus();history.replaceState(null,'',`?lang=${lang}&country=${country}`);}));
  }

  function renderBroad() {
    const rows = data.series.employment_shares.filter(row => row.country_code === country);
    const names = {agriculture:c().agriculture,industry:c().industry,services:c().services};
    $('jm-broad').innerHTML = rows.map(row => `<article><span>${esc(names[row.sector])}</span><strong>${pct(Number(row.source_value))}</strong><div class="jm-track"><i style="width:${Math.max(0,Math.min(100,Number(row.source_value)))}%"></i></div><small>${esc(c().modelled)} · ${esc(row.source_value)} %</small>${sourceLink(row.source_url,c().source)}</article>`).join('');
  }

  function renderServices() {
    const rows = data.series.service_divisions.filter(row => row.country_code === country).sort((a,b) => a.isic_division.localeCompare(b.isic_division));
    const total = rows.reduce((sum,row) => sum + Number(row.persons_thousands),0);
    const sections = Object.keys(sectionNames).map((section,index) => ({section,index,rows:rows.filter(row => row.isic_section === section)})).map(group => ({...group,value:group.rows.reduce((sum,row) => sum + Number(row.persons_thousands),0)}));
    let angle=0;
    const segments = sections.map(group => {const start=angle;angle+=group.value/total*360;return `${colors[group.index]} ${start}deg ${angle}deg`;});
    const active = sections.find(group => group.section === selectedSection);
    $('jm-pie').innerHTML = `<div class="jm-pie" role="img" aria-label="${esc(c().share)}: ${esc(sections.map(g=>`${loc(sectionNames[g.section])} ${pct(g.value/total*100)}`).join(', '))}" style="background:conic-gradient(${segments.join(',')})"><div><small>${esc(active ? loc(sectionNames[active.section]) : c().services)}</small><strong>${pct((active?.value ?? total)/total*100)}</strong><span>${esc(c().listed)}</span></div></div><p>${esc(c().observed)} · ${number(total,3)} ${lang==='cs'?'tisíc osob':'thousand people'} · ${sections.length} ${esc(c().sectors)} / 45 ${esc(c().division.toLowerCase())}</p>`;
    $('jm-service-sections').innerHTML = sections.map(group => `<button type="button" class="jm-section-button ${selectedSection===group.section?'active':''}" data-section="${group.section}" aria-pressed="${selectedSection===group.section}"><i style="background:${colors[group.index]}"></i><b>${group.section}</b><span>${esc(loc(sectionNames[group.section]))}</span><strong>${pct(group.value/total*100)}</strong></button>`).join('');
    $('jm-service-sections').querySelectorAll('button').forEach(button => {
      button.addEventListener('click',()=>{const section=button.dataset.section;selectedSection=selectedSection===section?null:section;renderServices();$('jm-service-sections').querySelector(`[data-section="${section}"]`)?.focus();});
      button.addEventListener('keydown',event=>{
        if(event.key==='Escape'){selectedSection=null;renderServices();$('jm-service-sections').querySelector(`[data-section="${button.dataset.section}"]`)?.focus();return;}
        if(!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(event.key))return;
        event.preventDefault();
        const buttons=[...$('jm-service-sections').querySelectorAll('button')],index=buttons.indexOf(button),step=['ArrowDown','ArrowRight'].includes(event.key)?1:-1;
        buttons[(index+step+buttons.length)%buttons.length].focus();
      });
    });
    $('jm-divisions').innerHTML = rows.map(row => `<tr class="${selectedSection && selectedSection!==row.isic_section?'dim':''}"><th scope="row"><b>${esc(row.isic_division)}</b> ${esc(loc(divisionNames[row.isic_division]))}</th><td>${number(Number(row.persons_thousands),3)}</td><td>${pct(Number(row.persons_thousands)/total*100)}</td><td>${row.obs_status==='U'?`<span class="jm-flag">${esc(c().unreliable)}</span>`:esc(c().reported)}</td></tr>`).join('');
  }

  function renderOwnership() {
    const rows = data.series.ownership.filter(row => row.country_code === country);
    const root = $('jm-ownership');
    if (!rows.length) {
      const national = data.series.national_public.filter(row => row.country_code === country);
      const metric = name => national.find(row => row.metric === name);
      let summary = '';
      if (country==='CZE') {
        const publicRow=metric('public_sector_fte'), total=metric('total_economy_fte'), gov=metric('general_government_fte'), share=metric('reported_public_sector_share');
        const corporations=val(publicRow)-val(gov);
        summary = `<strong>${esc(share.source_value)} %</strong><p>${esc(publicRow.source_value)} ${esc(c().fte)} ${esc(c().of)} ${esc(total.source_value)} · 2024 ${esc(c().annual)}. ${esc(gov.source_value)} ${esc(c().fte)}: ${lang==='cs'?'vládní instituce':'general government'}. ${number(corporations,0)} ${esc(c().fte)}: ${lang==='cs'?'veřejné korporace (vypočteno: veřejný sektor minus vládní instituce)':'public corporations (calculated: public sector minus general government)'}.</p>${sourceLink(publicRow.source_url,c().source)}`;
      } else if (country==='DEU') {
        const publicRow=metric('public_employers_total_persons'),total=metric('total_employed_persons'),core=metric('public_service_persons'),entities=metric('majority_public_private_law_entities_persons');
        summary = `<strong>${esc(publicRow.source_value)} ${lang==='cs'?'tisíc':'thousand'}</strong><p>${esc(core.source_value)} + ${esc(entities.source_value)} ${lang==='cs'?'tisíc osob u veřejných zaměstnavatelů':'thousand people at public employers'} · ${esc(c().snapshot)}. ${esc(total.source_value)} ${lang==='cs'?'tisíc zaměstnaných':'thousand employed'} · 2024 ${esc(c().annual)}. ${esc(c().calculated)}: ${esc(publicRow.source_value)} / ${esc(total.source_value)} = ${pct(val(publicRow)/val(total)*100)} ${lang==='cs'?'orientačně':'indicative'}.</p>${sourceLink(publicRow.source_url,c().source)} · ${sourceLink(total.source_url,lang==='cs'?'Roční jmenovatel':'Annual denominator')}`;
      }
      root.innerHTML=`<div class="jm-unavailable"><p>${esc(c().noOwnership)}</p><article><span>${esc(c().national)}</span>${summary}<small>${esc(c().nationalWarning)}</small></article></div>`;
      return;
    }
    const by = (section,sector) => rows.find(row=>row.isic_section===section&&row.employer_sector===sector);
    const ratio = section => {const a=by(section,'public'),b=by(section,'total');return a&&b?{public:a,total:b,value:val(a)/val(b)*100}:null;};
    const overall=ratio('TOTAL');
    const opq=['O','P','Q'].map(ratio);
    const opqPublic=opq.reduce((sum,item)=>sum+val(item.public),0),opqTotal=opq.reduce((sum,item)=>sum+val(item.total),0);
    root.innerHTML=`<div class="jm-ownership-kpis"><article><span>${esc(c().public)} / ${esc(c().all)}</span><strong>${pct(overall.value)}</strong><small>${esc(c().calculated)}: ${esc(overall.public.source_value)} / ${esc(overall.total.source_value)} ${lang==='cs'?'tisíc osob':'thousand people'}</small></article><article><span>${esc(c().public)} / O+P+Q</span><strong>${pct(opqPublic/opqTotal*100)}</strong><small>${esc(c().calculated)}: ${number(opqPublic,3)} / ${number(opqTotal,3)} ${lang==='cs'?'tisíc osob':'thousand people'}</small></article></div><div class="jm-ownership-list">${Object.keys(sectionNames).map(section=>{const item=ratio(section);return item?`<div><span><b>${section}</b> ${esc(loc(sectionNames[section]))}</span><div class="jm-track"><i style="width:${Math.max(0,Math.min(100,item.value))}%"></i></div><strong>${pct(item.value)}</strong><small>${esc(item.public.source_value)} / ${esc(item.total.source_value)} ${lang==='cs'?'tisíc':'thousand'}</small></div>`:''}).join('')}</div><p class="jm-footnote">${sourceLink(overall.public.source_url,c().source)} · ${esc(c().ownershipNote)}</p>`;
  }

  function renderLabour() {
    const rows=data.series.labour_status.filter(row=>row.country_code===country);
    const metric=name=>rows.find(row=>row.metric===name);
    const labour=val(metric('labour_force')), outside=val(metric('outside_labour_force')), population=labour+outside;
    const parts=[['employed',c().employed,'#627f5c'],['unemployed',c().unemployed,'#c75b49'],['outside_labour_force',c().outside,'#beb7a6']];
    $('jm-labour').innerHTML=`<div class="jm-labour-bar">${parts.map(([name,label,color])=>`<div style="width:${val(metric(name))/population*100}%;background:${color}" title="${esc(label)} ${pct(val(metric(name))/population*100)}"></div>`).join('')}</div><div class="jm-labour-grid">${parts.map(([name,label,color])=>{const row=metric(name);return `<article><i style="background:${color}"></i><span>${esc(label)}</span><strong>${pct(val(row)/population*100)}</strong><small>${esc(row.source_value)} ${lang==='cs'?'tisíc osob':'thousand people'} · ${esc(c().population)}</small>${sourceLink(row.source_url,c().source)}</article>`}).join('')}<article class="jm-rate"><span>${esc(c().rate)}</span><strong>${pct(val(metric('unemployment_rate')))}</strong><small>${esc(metric('unemployment_rate').source_value)} % · ${esc(c().labour)}</small>${sourceLink(metric('unemployment_rate').source_url,c().source)}</article></div><p class="jm-footnote">${esc(c().usaAge)} ${esc(c().calculated)}: ${esc(c().employed)} / ${esc(c().unemployed)} / ${esc(c().outside)} ÷ (${esc(c().sourceValues)} ${esc(c().labour)} + ${esc(c().outside)}).</p>`;
  }

  function renderSources() {
    const series=data.series;
    const sample=(key)=>series[key].find(row=>row.country_code===country);
    const items=[['employment_shares',c().modelled],['service_divisions',c().observed],['ownership',c().ownershipTitle],['labour_status',c().statusTitle],['national_public',c().national]];
    $('jm-sources').innerHTML=`<div class="jm-source-grid">${items.map(([key,label])=>{const row=sample(key);return row?`<article><span>${esc(label)}</span><b>${esc(data.releases[key])}</b><p>${esc(row.source_name||row.source_code||row.source_id||'National statistical office')} · 2024</p>${sourceLink(row.source_url,c().source)}</article>`:''}).join('')}</div><p>${esc(c().serviceCaveat)} ${esc(c().nationalWarning)}</p><small>${esc(c().release)}: ${esc(data.release_id)} · ${esc(c().coverage)}: 6 ${lang==='cs'?'zemí':'countries'}, 45 ${lang==='cs'?'oddílů služeb':'service divisions'} / ${lang==='cs'?'zemi':'country'}.</small>`;
  }

  function render() {
    document.documentElement.lang=lang;
    document.querySelectorAll('[data-copy]').forEach(element=>{const value=c()[element.dataset.copy];if(value)element.innerHTML=value;});
    $('jm-country').innerHTML=order.map(code=>`<option value="${code}" ${code===country?'selected':''}>${esc(loc(countryNames[code]))}</option>`).join('');
    renderComparison();renderBroad();renderServices();renderOwnership();renderLabour();renderSources();
  }
  async function init() {
    lang=document.documentElement.lang==='en'?'en':'cs';
    $('jm-status').textContent=c().loading;
    $('jm-country').addEventListener('change',event=>{country=event.target.value;selectedSection=null;render();history.replaceState(null,'',`?lang=${lang}&country=${country}`);});
    const selected=new URLSearchParams(location.search).get('country');if(order.includes(selected))country=selected;
    try {const response=await fetch('/api/v1/job-market/2024');if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();render();$('jm-status').textContent='';}
    catch(error){$('jm-status').textContent=c().failed;console.error(error);}
    window.addEventListener('psdlanguagechange',event=>{lang=event.detail?.lang==='en'?'en':'cs';if(data)render();});
  }
  init();
})();
