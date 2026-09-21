import { REGIONS, monthlySeries, monthLabel, tradeRoutes, diagramRoutes } from './lib/automotive.mjs?v=20260920-scope';
const $ = id => document.getElementById(id);
const lang = document.documentElement.lang === 'en' ? 'en' : 'cs';
const tr = (cs,en) => lang === 'en' ? en : cs;
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names = { USA:tr('USA','United States'),EU27:tr('Evropská unie','European Union'),CHN:tr('Čína','China'),ROW:tr('Zbytek světa','Rest of world') };
const styles = { USA:{color:'#8b8d83',dash:'7 4'},EU27:{color:'#171918',dash:''},CHN:{color:'#a8b63f',dash:''},ROW:{color:'#8b8d83',dash:'2 5'} };
const titles = { vehicles:tr('Osobní a lehká vozidla','Passenger & light vehicles'),trucks:tr('Těžká nákladní vozidla','Heavy trucks'),parts:tr('Autodíly','Auto parts') };
const definitions = { vehicles:tr('HS 8703 + lehká nákladní vozidla do 5 t','HS 8703 + light goods vehicles up to 5 t'),trucks:tr('Silniční tahače + nákladní vozidla nad 5 t','Road tractors + goods vehicles over 5 t'),parts:tr('Základní skupina dílů a příslušenství · HS 8708','Core parts & accessories · HS 8708') };
const units = {value:tr('mld. běžných USD','Current USD, billions'),share:tr('% sledovaného obchodu','% of observed trade'),index:tr('První zobrazený měsíc = 100','First displayed month = 100')};
const scopeName = () => state.scope === 'all' ? tr('Veškerý přeshraniční obchod','All cross-border trade') : tr('Srovnatelný vnější obchod','Comparable external trade');
const scopeQualifier = () => state.scope === 'all' ? tr('Obchod uvnitř EU zahrnut','Intra-EU trade included') : tr('Obchod uvnitř EU vyloučen','Intra-EU trade excluded');
const scopeExcludes = () => state.scope === 'all' ? tr('Domácí prodeje; kódy mimo uvedenou definici.','Domestic sales; codes outside the stated definition.') : tr('Vnitrounijní obchod, domácí prodeje a kódy mimo uvedenou definici.','Intra-EU trade, domestic sales and codes outside the stated definition.');
const scopeCaveat = () => state.scope === 'all' ? tr('Zahrnuje dodávky mezi zeměmi EU. Comtrade nemá srovnatelné domácí prodeje pro USA, Čínu ani jednotlivé země EU.','Includes deliveries between EU countries. Comtrade has no comparable domestic sales for the US, China or individual EU countries.') : tr('Obchod uvnitř EU je vyloučen, protože Comtrade nezachycuje srovnatelné domácí prodeje v USA nebo Číně.','Intra-EU trade is excluded because Comtrade does not capture comparable domestic US or Chinese sales.');
const scopeNote = () => state.scope === 'all' ? tr('Zahrnuje přeshraniční dodávky mezi zeměmi EU. Tato volba ukazuje větší část výrobní a dodavatelské sítě EU, ale nemá obdobu pro domácí prodeje v USA nebo Číně. Hodnota obchodu není totéž co tržby.','Includes cross-border deliveries between EU countries. This shows more of the EU production and supply network, but has no equivalent for domestic US or Chinese sales. Trade value is not the same as revenue.') : tr('Vylučuje dodávky mezi zeměmi EU, aby srovnání bloků nepřidávalo EU přeshraniční obchod, zatímco domácí prodeje v USA a Číně v Comtrade chybějí.','Excludes deliveries between EU countries so the bloc comparison does not add EU cross-border trade while domestic US and Chinese sales are absent from Comtrade.');
const fmt = (value,digits=1) => value == null ? '—' : new Intl.NumberFormat(lang,{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value);
let data;
const params = new URLSearchParams(location.search);
let state = {market:params.get('market') || 'ALL',metric:params.get('metric') || 'value',scope:params.get('scope') || 'external',start:params.get('start'),end:params.get('end'),segment:params.get('segment') || 'vehicles',flowPeriod:params.get('flowPeriod'),geography:params.get('geography') || 'regions',origin:params.get('origin') || 'ALL'};
function translate(){
  document.querySelectorAll('[data-cs][data-en]').forEach(node=>node.textContent=node.dataset[lang]);
  document.title=tr('Automobilový průmysl','Automotive')+' — Public Spending Data';
  document.querySelector('meta[name=description]').content=tr('Měsíční automobilový obchod: USA, EU, Čína a zbytek světa. Vozidla, těžká nákladní auta a autodíly z UN Comtrade.','Monthly automotive trade: US, EU, China and rest of world. Vehicles, heavy trucks and auto parts from UN Comtrade.');
  document.querySelectorAll('a[href^="../"]').forEach(a=>{const u=new URL(a.href);u.searchParams.set('lang',lang);a.href=u.href;});
}
function syncURL(){
  const url=new URL(location.href);
  for(const [key,value] of Object.entries(state))url.searchParams.set(key,value);
  history.replaceState(null,'',url);
}
function plot(points,segment){
  if(!points.some(p=>REGIONS.some(region=>Number.isFinite(p.displayed[region]))))return `<p class="auto-empty">${tr('Pro tento výběr nejsou dostupné srovnatelné údaje.','No comparable observations are available for this selection.')}</p>`;
  return '<div class="auto-plot" data-auto-plot></div>';
}
function renderSharedPlot(card,series){
  const host=card.querySelector('[data-auto-plot]');if(!host)return;
  const metric=state.metric,segment=series.segment;
  window.PSDPlotReady.then(renderer=>{
    if(!host.isConnected)return;
    renderer.render(host,{type:'line',rows:series.points.map(point=>({label:monthLabel(point.period,lang),period:point.period,...point.displayed})),fields:REGIONS.map(region=>({key:region,label:names[region],color:styles[region].color,format:value=>`${fmt(value)}${metric==='share'?'%':''}`})),title:titles[segment],unit:units[metric],locale:lang==='en'?'en-GB':'cs-CZ',height:window.matchMedia('(max-width:800px)').matches?270:330,onSelect:row=>{state.flowPeriod=row.period;state.segment=segment;syncURL();drawFlows();}});
  }).catch(error=>{if(host.isConnected)host.textContent=`Chart error: ${error.message}`;});
}
function tableRows(series){return series.points.flatMap(p=>REGIONS.map(region=>({period:p.period,scope:scopeName(),origin:names[region],market:state.market,trade_usd:p.values[region],value:p.displayed[region],unit:units[state.metric],status:p.values[region]==null?tr('Chybí','Missing'):tr('Vykázáno','Reported')})));}
function draw(){
  const series=monthlySeries(data,state);
  $('auto-scope-note').textContent=scopeNote();
  $('auto-charts').replaceChildren();
  series.forEach((s,i)=>{
    const latest=s.points.at(-1);const card=document.createElement('article');card.className='auto-chart-card';card.id=`automotive-${s.segment}-origins-monthly`;
    card.innerHTML=`<header class="auto-card-heading"><div><h3><span class="auto-card-number">0${i+1}</span>${titles[s.segment]}</h3><p>${definitions[s.segment]}</p></div><span class="auto-unit">${units[state.metric]}</span></header>${plot(s.points,s.segment)}<p class="auto-selected">${tr('Přejeďte přes měsíc pro všechny čtyři regiony. Kliknutím zobrazíte jeho obchodní toky.','Hover a month to compare all four regions. Click to explore its trade flows.')}</p><div class="auto-latest">${REGIONS.map(region=>`<div><span>${names[region]}</span><strong>${fmt(latest?.displayed[region])}${state.metric==='share'?'%':''}</strong><span>${monthLabel(latest.period,lang)} · ${state.metric==='value'?tr('mld. USD','USD bn'):state.metric==='share'?tr('podíl','share'):tr('index','index')}</span></div>`).join('')}</div><p class="auto-source-line">${tr('Zdroj','Source')}: <a href="#method">UN Comtrade · ${tr('dovoz podle původu','imports by origin')}</a> · ${scopeQualifier()} · ${tr('Staženo','Retrieved')} ${esc(data.source.retrieved_at.slice(0,10))}</p>`;
    $('auto-charts').append(card);
    renderSharedPlot(card,s);
    window.PSDChart.register({el:card,slug:card.id,title:titles[s.segment]+' · '+units[state.metric],rows:()=>tableRows(s),embeddable:false,exports:['csv','png'],columns:[{key:'period',label:tr('Měsíc','Month')},{key:'scope',label:tr('Rozsah obchodu','Trade scope')},{key:'origin',label:tr('Původ','Origin')},{key:'market',label:tr('Trh','Market')},{key:'trade_usd',label:'USD',numeric:true},{key:'value',label:tr('Zobrazená hodnota','Displayed value'),numeric:true},{key:'unit',label:tr('Jednotka','Unit')},{key:'status',label:tr('Stav','Status')}],source:{name:'UN Comtrade',url:data.source.url,table:data.source.table,extracted:data.source.retrieved_at,vintage:'outturn',edition:data.source.archive_id,definition:definitions[s.segment],excludes:scopeExcludes(),caveat:scopeCaveat()+' '+tr('Stálá skupina dovozních trhů, běžné USD (CIF), bez sezónního očištění. Zbytek světa obsahuje neurčený původ.','Fixed importing-market panel, current USD (CIF), no seasonal adjustment. Rest of world includes unspecified origins.')}});
  });
  drawFlows();
  const n=state.market==='ALL'?data.panel.length:1;
  $('auto-status').textContent=`${n} ${tr('dovozních trhů','importing market'+(n===1?'':'s'))} · ${monthLabel(state.start,lang)} – ${monthLabel(state.end,lang)} · ${scopeName()} · ${tr('Měsíčně · bez sezónního očištění','Monthly · not seasonally adjusted')}`;
}
function originName(code){
  if(code==='OTHER_ORIGINS')return tr('Ostatní původy','Other origins');
  if(code==='UNALLOCATED')return tr('Nerozlišený původ','Unallocated origin');
  return names[code] || data.origins?.find(o=>o.code===code)?.name || code;
}
function marketName(code){return code==='OTHER_MARKETS'?tr('Ostatní trhy','Other markets'):data.markets.find(m=>m.code===code)?.name || code;}
function money(value){return new Intl.NumberFormat(lang,{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value);}
function initFlows(){
  if(!Object.hasOwn(titles,state.segment))state.segment='vehicles';
  if(!['regions','countries'].includes(state.geography))state.geography='regions';
  if(!data.periods.includes(state.flowPeriod)||state.flowPeriod<state.start||state.flowPeriod>state.end)state.flowPeriod=state.end;
  $('auto-segment').innerHTML=Object.entries(titles).map(([code,label])=>`<option value="${code}">${label}</option>`).join('');
  $('auto-flow-controls').addEventListener('submit',event=>event.preventDefault());
  $('auto-flow-controls').addEventListener('change',event=>{
    const key=event.target.name;if(!['segment','flowPeriod','geography','origin'].includes(key))return;
    state[key]=event.target.value;if(key==='geography')state.origin='ALL';syncURL();drawFlows();
  });
  $('auto-flow-reset').addEventListener('click',()=>{state.market='ALL';state.origin='ALL';$('auto-market').value='ALL';syncURL();draw();});
}
function drawFlows(){
  const periods=data.periods.filter(p=>p>=state.start&&p<=state.end);
  $('auto-flowPeriod').innerHTML=periods.map(p=>`<option value="${p}">${monthLabel(p,lang)}</option>`).join('');
  const originCodes=state.geography==='regions'?REGIONS:(data.origins || []).map(o=>o.code).sort((a,b)=>originName(a).localeCompare(originName(b),lang));
  if(state.origin!=='ALL'&&!originCodes.includes(state.origin)){state.origin='ALL';syncURL();}
  $('auto-origin').innerHTML=`<option value="ALL">${tr('Všechny původy','All origins')}</option>`+originCodes.map(code=>`<option value="${esc(code)}">${esc(originName(code))}</option>`).join('');
  for(const key of ['segment','flowPeriod','geography','origin']){$('auto-'+key).value=state[key];$('auto-'+key).disabled=false;}
  const routes=tradeRoutes(data,{segment:state.segment,period:state.flowPeriod,market:state.market,geography:state.geography,origin:state.origin,scope:state.scope});
  const total=routes.reduce((sum,r)=>sum+r.value,0);
  const scope=state.market==='ALL'?`${data.panel.length} ${tr('dovozních trhů','importing markets')}`:marketName(state.market);
  $('auto-flow-context').textContent=`${titles[state.segment]} · ${monthLabel(state.flowPeriod,lang)} · ${scope} · ${scopeName()} · ${money(total)}`;
  const old=$('automotive-trade-origin-destination'),card=document.createElement('article');card.id=old.id;card.className='auto-chart-card auto-flow-card';old.replaceWith(card);
  card.innerHTML=`<div class="auto-flow-headings"><span>${tr('Země původu / dodavatel','Country of origin / supplier')}</span><span>${tr('Dovozní trh / odběratel','Import market / buyer')}</span></div><div class="auto-flow-plot"></div><p class="auto-flow-detail" role="status">${tr('Přejeďte přes tok pro hodnotu a podíl. Kliknutím na zemi zúžíte výběr.','Hover a route for its value and share. Click a country to narrow the view.')}</p><p class="auto-source-line">${tr('Zdroj','Source')}: <a href="#method">UN Comtrade · ${tr('dovoz podle původu','imports by origin')}</a> · ${scopeQualifier()} · ${tr('Staženo','Retrieved')} ${esc(data.source.retrieved_at.slice(0,10))}</p>`;
  if(total>0)drawFlowDiagram(card,diagramRoutes(routes),total);
  else card.querySelector('.auto-flow-plot').innerHTML=`<p class="auto-empty">${tr('Pro tento výběr nejsou dostupné vykázané toky.','No reported routes are available for this selection.')}</p>`;
  window.PSDChart.register({el:card,slug:card.id,title:tr('Kdo komu dodává','Who sells to whom')+' · '+titles[state.segment],embeddable:false,exports:['csv','png'],rows:()=>routes.map(r=>({period:state.flowPeriod,scope:scopeName(),origin:originName(r.origin),origin_code:r.origin,market:marketName(r.market),market_code:r.market,value_usd:r.value,share_percent:total?r.value/total*100:null})),columns:[{key:'period',label:tr('Měsíc','Month')},{key:'scope',label:tr('Rozsah obchodu','Trade scope')},{key:'origin',label:tr('Původ','Origin')},{key:'origin_code',label:tr('Kód původu','Origin code')},{key:'market',label:tr('Cílový trh','Destination market')},{key:'market_code',label:tr('Kód trhu','Market code')},{key:'value_usd',label:'USD',numeric:true},{key:'share_percent',label:'%',numeric:true}],source:{name:'UN Comtrade',url:data.source.url,table:data.source.table,extracted:data.source.retrieved_at,vintage:'outturn',edition:data.source.archive_id,definition:definitions[state.segment],excludes:scopeExcludes(),caveat:scopeCaveat()+' '+tr('Diagram slučuje menší původy a trhy; tabulka a CSV zachovávají všechny vybrané toky.','The diagram combines smaller origins and markets; the table and CSV retain every selected route.')}});
}
function drawFlowDiagram(card,edges,total){
  const W=960,H=520,L=182,R=748,T=22,B=22,nodeWidth=12,padding=26;
  const nodes=dimension=>{
    const sums=new Map();for(const edge of edges)sums.set(edge[dimension],(sums.get(edge[dimension]) || 0)+edge.value);
    return [...sums].map(([code,value])=>({code,value,offset:0})).sort((a,b)=>Number(a.code.startsWith('OTHER_'))-Number(b.code.startsWith('OTHER_')) || b.value-a.value);
  };
  const origins=nodes('origin'),markets=nodes('market');
  const scale=(H-T-B-padding*(Math.max(origins.length,markets.length)-1))/total;
  for(const group of [origins,markets]){let y=T+(H-T-B-group.reduce((s,n)=>s+n.value*scale,0)-padding*(group.length-1))/2;group.forEach((node,index)=>{node.y=y;node.height=node.value*scale;node.index=index;y+=node.height+padding;});}
  const originMap=new Map(origins.map(n=>[n.code,n])),marketMap=new Map(markets.map(n=>[n.code,n]));
  edges.sort((a,b)=>originMap.get(a.origin).index-originMap.get(b.origin).index || marketMap.get(a.market).index-marketMap.get(b.market).index);
  for(const edge of edges){const node=originMap.get(edge.origin);edge.width=edge.value*scale;edge.sy=node.y+node.offset+edge.width/2;node.offset+=edge.width;}
  edges.sort((a,b)=>marketMap.get(a.market).index-marketMap.get(b.market).index || originMap.get(a.origin).index-originMap.get(b.origin).index);
  for(const edge of edges){const node=marketMap.get(edge.market);edge.ty=node.y+node.offset+edge.width/2;node.offset+=edge.width;}
  const color=code=>styles[code]?.color || styles[data.origins?.find(o=>o.code===code)?.region]?.color || '#8b8d83';
  let svg=`<svg class="auto-flow-svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(tr('Obchodní toky podle původu a cílového trhu','Trade routes by origin and destination market'))}">`;
  edges.sort((a,b)=>b.value-a.value).forEach((edge,index)=>{
    const d=`M${L+nodeWidth},${edge.sy} C${(L+R)/2},${edge.sy} ${(L+R)/2},${edge.ty} ${R},${edge.ty}`;
    const label=`${originName(edge.origin)} → ${marketName(edge.market)}: ${money(edge.value)} · ${fmt(edge.value/total*100)}%`;
    svg+=`<g class="auto-flow-route" data-route="${index}" tabindex="0" role="button" aria-label="${esc(label)}"><path class="auto-flow-link" d="${d}" stroke="${color(edge.origin)}" stroke-width="${Math.max(.5,edge.width)}"/><path class="auto-flow-hit" d="${d}" stroke-width="${Math.max(8,edge.width)}"/><title>${esc(label)}</title></g>`;
  });
  const labelNodes=(list,side)=>list.map(node=>{
    const origin=side==='origin',x=origin?L:R,name=origin?originName(node.code):marketName(node.code),label=name.length>25?name.slice(0,23)+'…':name;
    const aggregate=node.code.startsWith('OTHER_');
    return `<g class="auto-flow-node" data-side="${side}" data-code="${esc(node.code)}" ${aggregate?'':`tabindex="0" role="button"`} aria-label="${esc(name+': '+money(node.value))}"><rect x="${x}" y="${node.y}" width="${nodeWidth}" height="${Math.max(1,node.height)}" fill="${origin?color(node.code):'#171918'}"/><text x="${origin?x-10:x+nodeWidth+10}" y="${node.y+node.height/2-3}" text-anchor="${origin?'end':'start'}">${esc(label)}</text><text class="auto-flow-value" x="${origin?x-10:x+nodeWidth+10}" y="${node.y+node.height/2+13}" text-anchor="${origin?'end':'start'}">${money(node.value)}</text><title>${esc(name)}</title></g>`;
  }).join('');
  svg+=labelNodes(origins,'origin')+labelNodes(markets,'market')+'</svg>';
  card.querySelector('.auto-flow-plot').innerHTML=svg;
  const detail=card.querySelector('.auto-flow-detail');
  card.querySelectorAll('.auto-flow-route').forEach(target=>{
    const edge=edges[Number(target.dataset.route)];
    const show=()=>{card.querySelectorAll('.auto-flow-route').forEach(r=>r.classList.toggle('is-active',r===target));detail.innerHTML=`<strong>${esc(originName(edge.origin))} → ${esc(marketName(edge.market))}</strong><span>${money(edge.value)} · ${fmt(edge.value/total*100)}% ${tr('z výběru','of selected trade')}</span>`;};
    target.addEventListener('pointerenter',show);target.addEventListener('focus',show);target.addEventListener('click',show);target.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show();}});
  });
  card.querySelectorAll('.auto-flow-node[role=button]').forEach(target=>{
    const select=()=>{if(target.dataset.side==='origin')state.origin=target.dataset.code;else{state.market=target.dataset.code;$('auto-market').value=state.market;}syncURL();draw();};
    target.addEventListener('click',select);target.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}});
  });
}

async function init(){
  translate();
  const response=await fetch('/data/trade/automotive-monthly.v1.json?v=20260920-scope');if(!response.ok)throw new Error(`HTTP ${response.status}`);
  data=await response.json();if(data.schema_version!=='automotive-monthly.v1'||!data.periods.length)throw new Error('Invalid automotive snapshot');
  if(!data.panel.includes(state.market))state.market='ALL';
  if(!Object.keys(units).includes(state.metric))state.metric='value';
  if(!['external','all'].includes(state.scope))state.scope='external';
  if(!data.periods.includes(state.start))state.start=data.periods[0];if(!data.periods.includes(state.end))state.end=data.periods.at(-1);if(state.start>state.end)state.end=state.start;
  $('auto-market').innerHTML=`<option value="ALL">${tr('Všechny sledované trhy','All reporting markets')} (${data.panel.length})</option>`+data.markets.map(m=>`<option value="${esc(m.code)}">${esc(m.name)} (${esc(m.code)})</option>`).join('');
  for(const id of ['start','end'])$('auto-'+id).innerHTML=data.periods.map(p=>`<option value="${p}">${monthLabel(p,lang)}</option>`).join('');
  for(const key of ['market','metric','scope','start','end']){$('auto-'+key).value=state[key];$('auto-'+key).disabled=false;}
  initFlows();
  $('auto-legend').innerHTML=REGIONS.map(r=>`<span><svg viewBox="0 0 32 12" aria-hidden="true"><path d="M0 6H32" stroke="${styles[r].color}" stroke-width="3" stroke-dasharray="${styles[r].dash}"/></svg>${names[r]}</span>`).join('');
  $('auto-vintage').textContent=`${monthLabel(data.periods[0],lang)} — ${monthLabel(data.periods.at(-1),lang)}`;
  $('auto-coverage-copy').textContent=tr(`Srovnání zahrnuje ${data.panel.length} dovozních trhů se stejným pokrytím původu v ${data.periods.length} měsících. Všechny zdrojové odpovědi byly ověřeny proti kontrolním součtům archivu.`,`The comparison covers ${data.panel.length} importing markets with consistent origin coverage across ${data.periods.length} months. All source responses were verified against the archive’s checksums.`);
  $('auto-market-list').textContent=data.markets.map(m=>`${m.name} (${m.code})`).join(' · ');
  $('auto-controls').addEventListener('submit',e=>e.preventDefault());
  $('auto-controls').addEventListener('change',e=>{const key=e.target.name;if(!['market','metric','scope','start','end'].includes(key))return;state[key]=e.target.value;if(state.start>state.end){if(key==='start')state.end=state.start;else state.start=state.end;}$('auto-start').value=state.start;$('auto-end').value=state.end;if(state.flowPeriod<state.start||state.flowPeriod>state.end)state.flowPeriod=state.end;syncURL();draw();});
  syncURL();draw();
}
init().catch(error=>{console.error(error);$('auto-status').textContent=tr('Měsíční data se nepodařilo načíst. Zkuste stránku obnovit.','Monthly data could not be loaded. Please reload the page.');});

document.addEventListener('click',event=>{const button=event.target.closest('[data-deep-lang]');if(!button)return;const url=new URL(location.href);url.searchParams.set('lang',button.dataset.deepLang);location.href=url.href;});

let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(data)draw();},100);});
