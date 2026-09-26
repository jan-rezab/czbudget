import { monthlyRows } from './lib/russia-trade-model.mjs';
const $=selector=>document.querySelector(selector);
const lang=document.documentElement.lang==='cs'?'cs':'en';
const tr=(cs,en)=>lang==='cs'?cs:en;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const locale=lang==='cs'?'cs-CZ':'en-GB';
const money=value=>value==null?'—':new Intl.NumberFormat(locale,{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value);
const exact=value=>value==null?'—':new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(value);
const label=period=>new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${period.slice(0,4)}-${period.slice(4)}-01T00:00:00Z`));
const countries={DEU:['de','Německo','Germany'],CZE:['cz','Česko','Czechia'],POL:['pl','Polsko','Poland'],FRA:['fr','Francie','France'],ITA:['it','Itálie','Italy'],NLD:['nl','Nizozemsko','Netherlands'],GBR:['gb','Spojené království','United Kingdom'],USA:['us','Spojené státy','United States'],JPN:['jp','Japonsko','Japan'],KOR:['kr','Jižní Korea','South Korea'],CHN:['cn','Čína','China'],KAZ:['kz','Kazachstán','Kazakhstan'],KGZ:['kg','Kyrgyzstán','Kyrgyzstan'],ARM:['am','Arménie','Armenia'],GEO:['ge','Gruzie','Georgia'],TUR:['tr','Turecko','Türkiye'],UZB:['uz','Uzbekistán','Uzbekistan'],ARE:['ae','Spojené arabské emiráty','United Arab Emirates'],BLR:['by','Bělorusko','Belarus'],RUS:['ru','Rusko','Russia']};
const exporters=['DEU','CZE','POL','FRA','ITA','NLD','GBR','USA','JPN','KOR','CHN','TUR'];
const intermediaries=['KAZ','KGZ','ARM','GEO','TUR','UZB','ARE','CHN','BLR'];
const products={854231:['Procesory a řadiče','Processors & controllers'],847130:['Přenosné počítače','Portable computers'],845710:['Obráběcí centra','Machining centres'],848210:['Kuličková ložiska','Ball bearings']};
const name=code=>countries[code][lang==='cs'?1:2];
const params=new URLSearchParams(location.search);
const state={exporter:exporters.includes(params.get('exporter'))?params.get('exporter'):'DEU',via:intermediaries.includes(params.get('via'))?params.get('via'):'KAZ',product:Object.hasOwn(products,params.get('product'))?params.get('product'):'854231',period:params.get('period'),rows:[],data:null,geometry:null,plot:null,playing:false,timer:null,request:0,loading:false,chart:null,map:null};
if(state.exporter===state.via)state.exporter='DEU';
const productName=()=>products[state.product][lang==='cs'?0:1];
const legs=()=>[{key:'direct',from:state.exporter,to:'RUS',color:'#8b8d83',title:tr('PŘÍMO DO RUSKA','DIRECT TO RUSSIA')},{key:'inbound',from:state.exporter,to:state.via,color:'#a8b63f',title:tr('DO ZKOUMANÉ ZEMĚ','INTO THE INTERMEDIARY')},{key:'onward',from:state.via,to:'RUS',color:'#c93237',title:tr('ODTUD DO RUSKA','FROM THERE TO RUSSIA')}];
function syncURL(){const url=new URL(location.href);for(const key of ['exporter','via','product','period'])if(state[key])url.searchParams.set(key,state[key]);url.searchParams.set('lang',lang);history.replaceState(null,'',url);}
function controls(){
 $('#rt-exporter').innerHTML=exporters.map(code=>`<option value="${code}" ${code===state.via?'disabled':''}>${name(code)}</option>`).join('');
 $('#rt-via').innerHTML=intermediaries.map(code=>`<option value="${code}" ${code===state.exporter?'disabled':''}>${name(code)}</option>`).join('');
 $('#rt-product').innerHTML=Object.entries(products).map(([code,names])=>`<option value="${code}">${names[lang==='cs'?0:1]} · HS ${code}</option>`).join('');
 for(const key of ['exporter','via','product'])$(`#rt-${key}`).value=state[key];
}
function playback(){
 const index=state.rows.findIndex(row=>row.period===state.period),ready=state.rows.length>0&&!state.loading;
 $('#rt-play').disabled=!ready;$('#rt-play').textContent=state.playing?tr('Ⅱ Pozastavit','Ⅱ Pause'):tr('▶ Přehrát','▶ Play');$('#rt-play').setAttribute('aria-pressed',String(state.playing));
 $('#rt-prev').disabled=!ready||index<=0;$('#rt-next').disabled=!ready||index>=state.rows.length-1;
 const slider=$('#rt-timeline');slider.disabled=!ready;slider.max=Math.max(0,state.rows.length-1);slider.value=Math.max(0,index);slider.setAttribute('aria-valuetext',state.period?label(state.period):'—');
 $('#rt-invasion').disabled=!ready;document.querySelectorAll('[data-chapter]').forEach(button=>button.disabled=!ready);
 $('.rt-stage').classList.toggle('routes-playing',state.playing);
}
function pause(){state.playing=false;clearTimeout(state.timer);playback();}
function tick(){clearTimeout(state.timer);if(!state.playing)return;state.timer=setTimeout(()=>{const i=state.rows.findIndex(row=>row.period===state.period);if(i>=state.rows.length-1){pause();return;}select(state.rows[i+1].period,false);tick();},1200);}
function select(period,stop=true){if(stop)pause();if(!state.rows.some(row=>row.period===period))return;state.period=period;syncURL();renderMonth();}
function renderMonth(){
 const row=state.rows.find(row=>row.period===state.period);if(!row)return;
 $('#rt-month').textContent=label(row.period);$('#rt-period-label').textContent=row.label;
 $('#rt-era').textContent=row.period<'202202'?tr('Před plnou invazí','Before the full-scale invasion'):row.period==='202202'?tr('Přechodový měsíc · invaze 24. února','Transition month · invasion on 24 February'):tr('Po plné invazi','After the full-scale invasion');
 $('#rt-product-tag').textContent=`HS ${state.product} · ${productName()}`;
 $('#rt-geography').textContent=['KAZ','CHN','BLR','GEO'].includes(state.via)?tr('Země sousedící s Ruskem','Shares a land border with Russia'):tr('Regionální / další obchodní partner · bez pozemní hranice s Ruskem','Regional / other trade partner · no land border with Russia');
 const currentLegs=legs();
 $('#rt-legs').innerHTML=currentLegs.map((leg,i)=>`<article class="rt-leg" style="--leg-color:${leg.color}"><small>0${i+1} / ${leg.title}</small><h3>${name(leg.from)} → ${name(leg.to)}</h3><strong>${money(row[leg.key])}</strong><p>${row[leg.key]==null?tr('Pozorování chybí','Observation unavailable'):tr('Vykázaný vývoz · běžné USD','Reported exports · current USD')}</p></article>`).join('');
 const values=state.rows.flatMap(item=>currentLegs.map(leg=>item[leg.key])).filter(Number.isFinite);
 state.map?.destroy();
 if(state.geometry)state.map=state.plot.render($('#rt-map'),{type:'route-map',geometry:state.geometry,title:`${productName()} · ${label(row.period)}`,maxValue:Math.max(1,...values),nodes:[state.exporter,state.via,'RUS'].map(code=>({id:code,iso2:countries[code][0],label:name(code)})),edges:currentLegs.map(leg=>({from:leg.from,to:leg.to,value:row[leg.key],color:leg.color,label:`${name(leg.from)} → ${name(leg.to)}: ${row[leg.key]==null?tr('údaj chybí','observation unavailable'):exact(row[leg.key])+' USD'} · ${label(row.period)} · HS ${state.product}`})),note:tr('Vyberte spoj pro přesnou hodnotu. Tři samostatná hlášení; návaznost zásilek není doložena.','Select a connection for the exact value. Three independent declarations; shipment continuity is unverified.')});
 const baselineMissing=currentLegs.some(leg=>row[`${leg.key}Baseline`]==null);
 const first=state.rows.find(item=>currentLegs.some(leg=>item[leg.key]!=null));
 const observed=currentLegs.filter(leg=>row[leg.key]!=null).length;
 $('#rt-status').textContent=baselineMissing?tr(`Předválečný základ není úplný. Dostupné vazby v tomto měsíci: ${observed}/3. ${first?'První pozorování ve výběru: '+label(first.period)+'. ':''}Pokles ani kompenzaci předválečného obchodu zatím nelze vyčíslit.`,`Pre-invasion baseline is incomplete. Reported legs this month: ${observed}/3. ${first?'First observation in this selection: '+label(first.period)+'. ':''}The pre-war decline and offset cannot yet be calculated.`):tr(`Dostupné vazby v tomto měsíci: ${observed}/3. Nejnovější měsíce mohou mít neúplné pokrytí.`,`Reported legs this month: ${observed}/3. Recent months may have incomplete coverage.`);
 $('#rt-delta').innerHTML=currentLegs.map(leg=>`<article><h3>${name(leg.from)} → ${name(leg.to)}<br>${tr('změna proti předválečnému měsíci','change from pre-invasion monthly baseline')}</h3><strong>${money(row[`${leg.key}Delta`])}</strong><small>${tr('Výchozí průměr','Baseline mean')}: ${money(row[`${leg.key}Baseline`])}<br>${tr('Pozorování základu','Baseline observations')}: ${row[`${leg.key}BaselineCount`]}/3${row[`${leg.key}Delta`]==null?'<br>'+tr('Nelze určit','Cannot determine'):''}</small></article>`).join('');
 playback();
}
function renderHistory(){
 state.chart?.destroy();const wrapper=$('#rt-trend-wrapper');wrapper.replaceChildren();const host=document.createElement('div');host.id='rt-trend';wrapper.append(host);
 state.chart=state.plot.render(host,{type:'line',rows:state.rows,fields:legs().map(leg=>({key:leg.key,label:`${name(leg.from)} → ${name(leg.to)}`,color:leg.color,format:value=>`${exact(value)} USD`})),title:productName(),unit:tr('Běžné USD / měsíc','Current USD / month'),height:350,locale,onSelect:row=>select(row.period)});
 window.PSDChart.register({slug:'russia-trade-monthly-routes',el:wrapper,title:productName(),accessor:state.chart.accessor,exports:['csv','png'],embeddable:false,source:{name:'UN Comtrade',url:state.data.source.url,table:state.data.source.table,extracted:state.data.source.retrieved_at||'—',vintage:'outturn',definition:tr('Měsíční vývoz, zvolený HS6, tři nezávislé vazby; běžné USD.','Monthly exports, selected HS6, three independent relationships; current USD.'),caveat:tr('Chybějící údaje nejsou nula. Vazby nejsou propojené zásilky.','Missing is not zero. Relationships are not linked shipments.')}});
 $('#rt-source').innerHTML=`<a href="${esc(state.data.source.url)}" target="_blank" rel="noopener">UN Comtrade · HS ${state.product} · X · M ↗</a> · <code>${esc(state.data.source.table)}</code> · ${tr('Staženo','Retrieved')}: ${esc(state.data.source.retrieved_at||'—')}`;
 const headings=tr(['Měsíc','Vývozce → partner','Původní USD','HS revize','Zveřejněno zdrojem','Staženo','Vydání načtení','Hash odpovědi'],['Month','Exporter → partner','Original USD','HS revision','Source released','Retrieved','Ingestion release','Response hash']);
 $('#rt-provenance').innerHTML=`<p>${tr('Čísla vydání určují jednotlivá načtení; nejde o neměnný snímek celé tabulky. Přesné původní částky zůstávají níže.','Release IDs identify contributing loads; they are not an immutable snapshot of the whole table. Exact original amounts are retained below.')}</p><div class="rt-provenance-scroll" tabindex="0"><table><thead><tr>${headings.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${state.data.observations.map(o=>`<tr><td>${esc(o.period)}</td><td>${esc(o.reporter_iso3)} → ${esc(o.partner_iso3)}</td><td>${esc(o.reported_value_usd)}</td><td>${esc(o.classification_code)}</td><td>${esc(o.source_last_released)}</td><td>${esc(o.retrieved_at)}</td><td><code>${esc(o.ingestion_run_id)}</code></td><td><code>${esc(o.source_response_sha256)}</code></td></tr>`).join('')}</tbody></table></div>`;
}
async function load(){
 pause();const request=++state.request;state.loading=true;state.rows=[];state.data=null;playback();$('#rt-status').classList.remove('is-error');$('#rt-status').textContent=tr('Načítáme vykázané obchodní vazby…','Loading reported trade relationships…');$('#rt-retry').hidden=true;$('#rt-map').setAttribute('aria-busy','true');
 state.chart?.destroy();state.map?.destroy();for(const id of ['rt-map','rt-legs','rt-delta','rt-trend-wrapper','rt-source','rt-provenance'])$('#'+id).replaceChildren();
 try{
  const response=await fetch(`/api/v1/trade/russia-routes?exporter=${state.exporter}&via=${state.via}&product=${state.product}`,{signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);const payload=await response.json();if(request!==state.request)return;
  state.data=payload.data;state.rows=monthlyRows(state.data);
  // Only expose months up to the latest actual observation; never animate future empty frames.
  const last=state.data.observations.map(o=>o.period).sort().at(-1);if(last)state.rows=state.rows.filter(row=>row.period<=last);
  if(!state.rows.some(row=>row.period===state.period))state.period=state.rows.find(row=>['direct','inbound','onward'].some(key=>row[key]!=null))?.period||'201902';
  state.loading=false;$('#rt-last-period').textContent=state.rows.at(-1)?.label||'—';syncURL();renderHistory();renderMonth();
 }catch(error){if(request!==state.request)return;state.loading=false;$('#rt-status').classList.add('is-error');$('#rt-status').textContent=tr('Obchodní data se nepodařilo načíst. Zkuste to znovu. Předchozí výběr nezobrazujeme jako aktuální.','Trade data could not be loaded. Please retry. Previous-selection values have been cleared.');$('#rt-retry').hidden=false;playback();}
 finally{if(request===state.request)$('#rt-map').setAttribute('aria-busy','false');}
}
document.querySelectorAll('[data-cs][data-en]').forEach(node=>node.textContent=node.dataset[lang]);
document.title=tr('Cíl se změnil. A co obchod?','The destination changed. Did the trade?')+' — Public Spending Data';
$('#rt-back').href=`/deep-dives/?lang=${lang}`;$('#rt-prev').ariaLabel=tr('Předchozí měsíc','Previous month');$('#rt-next').ariaLabel=tr('Další měsíc','Next month');controls();
for(const key of ['exporter','via','product'])$(`#rt-${key}`).addEventListener('change',event=>{state[key]=event.target.value;controls();load();});
$('#rt-retry').addEventListener('click',()=>state.plot?start():location.reload());
$('#rt-play').addEventListener('click',()=>{if(state.playing){pause();return;}if(state.period===state.rows.at(-1)?.period)select(state.rows[0].period);state.playing=true;playback();tick();});
$('#rt-timeline').addEventListener('input',event=>select(state.rows[Number(event.target.value)].period));
for(const [id,offset] of [['rt-prev',-1],['rt-next',1]])$('#'+id).addEventListener('click',()=>{const index=state.rows.findIndex(row=>row.period===state.period);if(state.rows[index+offset])select(state.rows[index+offset].period);});
$('#rt-invasion').addEventListener('click',()=>select('202202'));
document.querySelectorAll('[data-chapter]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.chapter==='before'?'201902':button.dataset.chapter==='break'?'202203':state.rows.find(row=>['direct','inbound','onward'].some(key=>row[key]!=null))?.period||'201902')));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});addEventListener('pagehide',pause);
async function start(){
 try{
  state.plot=await window.PSDPlotReady;
  if(!state.geometry){const response=await fetch('/data/world-map.v1.json');if(!response.ok)throw new Error('map');state.geometry=await response.json();}
  await load();
 }catch(error){$('#rt-status').textContent=tr('Mapu nebo grafy se nepodařilo načíst. Zkuste to znovu.','The map or chart assets could not be loaded. Please retry.');$('#rt-status').classList.add('is-error');$('#rt-retry').hidden=false;}
}
start();
