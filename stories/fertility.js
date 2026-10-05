/* Country/period semantics only. PSDPlot owns geometry and accessible marks. */
window.PSDFertilityReady = (async () => {
  const root = document.querySelector('#fertility-story');
  if (!root) return false;
  const status = root.querySelector('#fertility-status');
  const lang = () => document.documentElement.lang === 'cs' ? 'cs' : 'en';
  const tr = (en,cs) => lang() === 'cs' ? cs : en;
  await import('/chart-runtime.js');
  const plot = await window.PSDPlotReady;
  const response = await fetch('/api/v1/demography/worldwide');
  if (!response.ok) throw new Error('snapshot unavailable');
  const data = await response.json();
  if (data.schema_version !== 'worldwide-demography-story.v1') throw new Error('snapshot schema');
  const q = new URLSearchParams(location.search);
  let year = Math.max(1960,Math.min(2024,Number(q.get('year')) || 2024));
  year = Math.trunc(year);
  let metric = q.get('metric') === 'birth_rate' ? 'birth_rate' : 'fertility';
  const regions = [...new Set(Object.values(data.countries).map(c=>c.region))].sort();
  let region = regions.includes(q.get('region')) ? q.get('region') : '';
  let search = q.get('search') || '';
  let selected = (q.get('countries') || 'CZE,KOR,IND,NGA').split(',').filter(code=>data.countries[code]);
  selected = [...new Set(selected)].slice(0,4);
  if (!selected.length) selected = ['CZE'];
  const regionCs = {'East Asia & Pacific':'Východní Asie a Pacifik','Europe & Central Asia':'Evropa a Střední Asie','Latin America & Caribbean':'Latinská Amerika a Karibik','Middle East, North Africa, Afghanistan & Pakistan':'Blízký východ, severní Afrika, Afghánistán a Pákistán','North America':'Severní Amerika','South Asia':'Jižní Asie','Sub-Saharan Africa':'Subsaharská Afrika'};
  const namesCs = {CZE:'Česko',DEU:'Německo',FRA:'Francie',POL:'Polsko',KOR:'Jižní Korea',IND:'Indie',NGA:'Nigérie',BRA:'Brazílie',IRN:'Írán',ISR:'Izrael',CHN:'Čína',JPN:'Japonsko',USA:'Spojené státy',TCD:'Čad',SOM:'Somálsko',COD:'Demokratická republika Kongo',NER:'Niger',MAC:'Macao',HKG:'Hongkong',PRI:'Portoriko',SGP:'Singapur',UKR:'Ukrajina'};
  const name = code => lang()==='cs' ? (namesCs[code] || data.countries[code].name) : data.countries[code].name;
  const number = value => value === null || value === undefined ? null : Number(value);
  const format = value => value === null ? tr('Missing','Chybí') : Number(value).toLocaleString(lang(),{maximumFractionDigits:2});
  const unit = field => field === 'fertility' ? tr('births per woman','děti na ženu') : tr('live births per 1,000 people','živě narození na 1 000 obyvatel');
  const controllers = new Map();
  function chart(id,spec,field='fertility') {
    const figure = root.querySelector('#'+id), host = root.querySelector('#'+id+'-plot');
    controllers.get(id)?.destroy?.();
    figure.querySelectorAll(':scope > .psd-chart-rail,:scope > .psd-chart-panel,:scope > .psd-chart-drawer').forEach(el=>el.remove());
    const controller = plot.render(host,{height:330,...spec});
    controllers.set(id,controller);
    figure.querySelector('figcaption').textContent = spec.title;
    window.PSDChart.register({el:figure,slug:id,title:spec.title,accessor:controller.accessor,exports:['csv','png'],embeddable:false,
      source:{name:'World Bank · World Development Indicators',url:data.source_urls[field],table:field==='fertility'?'SP.DYN.TFRT.IN':'SP.DYN.CBRT.IN',
        extracted:data.acquired_at,edition:data.source_vintage,definition:unit(field),
        caveat:tr('Reported and estimated values. Source decimals retained; chart labels rounded. Missing values remain missing. Countries and territories; no population weighting in country counts.','Vykázané a odhadované hodnoty. Desetinné zápisy zdroje zachovány; popisky zaokrouhleny. Chybějící údaje zůstávají chybějící. Země i území; počty zemí nejsou váženy populací.'),vintage:'outturn'}});
  }
  function history(id,codes,field,title) {
    const rows = data.years.map((y,i)=>{const row={label:String(y)};codes.forEach(code=>{const country=code==='WLD'?data.aggregates.WLD:data.countries[code];row[code]=number(country[field][i]);row[code+'_exact']=country[field][i];});return row;});
    const fields = codes.map((code,i)=>({key:code,label:code==='WLD'?tr('World','Svět'):name(code),color:plot.palette[i],format:value=>format(value)}));
    chart(id,{type:'line',title,unit:unit(field),rows,fields,
      referenceLines:field==='fertility'?[{value:2.1,label:tr('≈2.1 replacement reference','≈2,1 reference prosté reprodukce')}]:[],
      tableColumns:[{key:'label',label:tr('Year','Rok')},...fields.map(f=>({key:f.key+'_exact',label:f.label+' · '+unit(field)}))]},field);
  }
  function persist() {
    const url = new URL(location.href);
    Object.entries({lang:lang(),year,metric,region,search,countries:selected.join(',')}).forEach(([key,value])=>value?url.searchParams.set(key,value):url.searchParams.delete(key));
    historyState(url);
  }
  function historyState(url) { window.history.replaceState(null,'',url); }
  const controls = root.querySelector('#fertility-explorer');
  const yearInput = controls.querySelector('#fertility-year input'), metricInput = controls.querySelector('#fertility-metric select'), regionInput = controls.querySelector('#fertility-region select'), searchInput = controls.querySelector('#fertility-search input');
  function picker() {
    const host = controls.querySelector('#fertility-country-picker');host.replaceChildren();
    selected.forEach(code=>{const button=document.createElement('button');button.type='button';button.textContent=name(code)+' ×';button.setAttribute('aria-label',tr('Remove ','Odebrat ')+name(code));button.onclick=()=>{if(selected.length===1)return;selected=selected.filter(c=>c!==code);renderExplorer();persist();};host.append(button);});
    const add=document.createElement('select');add.setAttribute('aria-label',tr('Add country or territory','Přidat zemi nebo území'));
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=tr('Add a comparison…','Přidat srovnání…');add.append(placeholder);
    Object.keys(data.countries).filter(code=>!selected.includes(code)).sort((a,b)=>name(a).localeCompare(name(b),lang())).forEach(code=>{const option=document.createElement('option');option.value=code;option.textContent=name(code);add.append(option);});
    add.disabled=selected.length>=4;add.onchange=()=>{if(add.value && selected.length<4){selected.push(add.value);renderExplorer();persist();}};host.append(add);
  }
  function renderExplorer() {
    yearInput.value=year;controls.querySelector('output').value=year;metricInput.value=metric;searchInput.value=search;
    regionInput.replaceChildren();['',...regions].forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value?(lang()==='cs'?(regionCs[value]||value):value):tr('All regions','Všechny regiony');regionInput.append(option);});regionInput.value=region;
    picker();
    const i=year-1960;
    const codes=Object.keys(data.countries).filter(code=>(!region||data.countries[code].region===region)&&(!search||[name(code),data.countries[code].name,code].some(s=>s.toLocaleLowerCase().includes(search.toLocaleLowerCase()))));
    const rows=codes.map(code=>({code,label:name(code),value:number(data.countries[code][metric][i]),exact:data.countries[code][metric][i],fertility:data.countries[code].fertility[i],birth_rate:data.countries[code].birth_rate[i]})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)||a.label.localeCompare(b.label));
    const available=rows.filter(row=>row.value!==null);
    controls.querySelector('#fertility-coverage').textContent=tr(`${available.length} available / ${rows.length} matching countries and territories · ${year} · ${unit(metric)}`,`${available.length} dostupných / ${rows.length} odpovídajících zemí a území · ${year} · ${unit(metric)}`);
    chart('country-ranking',{type:'bar',title:tr(`Highest ${metric==='fertility'?'fertility':'birth rates'} · ${year} · first 16 available`, `Nejvyšší ${metric==='fertility'?'plodnost':'porodnost'} · ${year} · prvních 16 dostupných`),height:560,unit:unit(metric),rows:available.slice(0,16),fields:[{key:'value',label:unit(metric),format}],valueLabels:true,
      tableColumns:[{key:'label',label:tr('Country / territory','Země / území')},{key:'exact',label:unit(metric)}]},metric);
    history('country-selection-history',selected,metric,tr('Selected histories · 1960–2024','Vybrané historické řady · 1960–2024'));
    const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent=tr(`All matching geographies · ${year} · exact source values`, `Všechna odpovídající území · ${year} · přesné hodnoty zdroje`);table.append(caption);
    const header=document.createElement('thead'),hr=document.createElement('tr');[tr('Country / territory','Země / území'),tr('Fertility · births per woman','Plodnost · děti na ženu'),tr('Birth rate · per 1,000 people','Porodnost · na 1 000 obyvatel')].forEach(label=>{const th=document.createElement('th');th.scope='col';th.textContent=label;hr.append(th);});header.append(hr);table.append(header);
    const body=document.createElement('tbody');rows.forEach(row=>{const trEl=document.createElement('tr');[row.label,row.fertility??tr('Missing','Chybí'),row.birth_rate??tr('Missing','Chybí')].forEach((value,index)=>{const cell=document.createElement(index===0?'th':'td');if(index===0)cell.scope='row';cell.textContent=value;trEl.append(cell);});body.append(trEl);});table.append(body);root.querySelector('#fertility-table').replaceChildren(table);
    const scatterRows=Object.keys(data.countries).map(code=>({label:name(code),x:number(data.countries[code].fertility[i]),y:number(data.countries[code].birth_rate[i]),exactX:data.countries[code].fertility[i],exactY:data.countries[code].birth_rate[i]})).filter(row=>row.x!==null&&row.y!==null);
    chart('fertility-birth-scatter',{type:'scatter',title:tr(`Two rates · all countries and territories · ${year}`,`Dvě míry · všechny země a území · ${year}`),yearLabel:year,rows:scatterRows,fields:[{key:'x',label:unit('fertility'),format},{key:'y',label:unit('birth_rate'),format}],xLabel:unit('fertility'),yLabel:unit('birth_rate'),tableColumns:[{key:'label',label:tr('Country / territory','Země / území')},{key:'exactX',label:unit('fertility')},{key:'exactY',label:unit('birth_rate')}]});
  }
  function render() {
    history('world-fertility',['WLD'],'fertility',tr('World fertility · 1960–2024','Světová plodnost · 1960–2024'));
    history('world-birth',['WLD'],'birth_rate',tr('World crude birth rate · 1960–2024','Světová hrubá míra porodnosti · 1960–2024'));
    history('country-histories',['KOR','IND','BRA','NGA'],'fertility',tr('Four paths through the transition','Čtyři cesty demografickou proměnou'));
    const keys=['below1','one_to_1_5','one_5_to_2_1','two_1_to_4','at_least4'],labels=['<1','1–<1.5','1.5–<2.1','2.1–<4','≥4'];
    chart('fertility-distribution',{type:'stacked',stackMode:'absolute',title:tr('Countries and territories by fertility band · available coverage','Země a území podle pásma plodnosti · dostupné pokrytí'),unit:tr('countries / territories','země / území'),rows:data.distribution.filter(row=>row.year%10===0||row.year===2024).map(row=>({...row,label:String(row.year)})),fields:keys.map((key,i)=>({key,label:labels[i],color:plot.palette[i%plot.palette.length]})),tableColumns:[{key:'label',label:tr('Year','Rok')},{key:'denominator',label:tr('Available denominator','Dostupný jmenovatel')},...keys.map((key,i)=>({key,label:labels[i]}))]});
    chart('czech-comparison',{type:'bar',title:tr('Fertility · same 2024 source vintage','Plodnost · stejná verze zdroje za rok 2024'),unit:unit('fertility'),rows:['CZE','DEU','POL','FRA'].map(code=>({label:name(code),value:number(data.countries[code].fertility[64]),exact:data.countries[code].fertility[64]})),fields:[{key:'value',label:unit('fertility'),format}],valueLabels:true,tableColumns:[{key:'label',label:tr('Country','Země')},{key:'exact',label:unit('fertility')}]});
    renderExplorer();
  }
  yearInput.addEventListener('change',()=>{year=Number(yearInput.value);renderExplorer();persist();});
  yearInput.addEventListener('input',()=>{controls.querySelector('output').value=yearInput.value;});
  metricInput.addEventListener('change',()=>{metric=metricInput.value;renderExplorer();persist();});
  regionInput.addEventListener('change',()=>{region=regionInput.value;renderExplorer();persist();});
  searchInput.addEventListener('input',()=>{search=searchInput.value;renderExplorer();persist();});
  window.addEventListener('psdlanguagechange',()=>{render();persist();});
  render();controls.hidden=false;status.hidden=true;root.dataset.ready='true';return true;
})().catch(error=>{console.error('Fertility explorer unavailable',error);const status=document.querySelector('#fertility-status');if(status)status.textContent=document.documentElement.lang==='cs'?'Interaktivní snímek není dostupný. Text, přesná tabulka a zdroje zůstávají dostupné.':'The interactive snapshot is unavailable. The narrative, exact table and sources remain available.';return false;});
