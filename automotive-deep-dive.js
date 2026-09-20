import { REGIONS, monthlySeries, monthLabel } from './lib/automotive.mjs';
const $ = id => document.getElementById(id);
const lang = document.documentElement.lang === 'en' ? 'en' : 'cs';
const tr = (cs,en) => lang === 'en' ? en : cs;
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names = { USA:tr('USA','United States'),EU27:tr('Evropská unie','European Union'),CHN:tr('Čína','China'),ROW:tr('Zbytek světa','Rest of world') };
const styles = { USA:{color:'#8b8d83',dash:'7 4'},EU27:{color:'#171918',dash:''},CHN:{color:'#a8b63f',dash:''},ROW:{color:'#8b8d83',dash:'2 5'} };
const titles = { vehicles:tr('Osobní a lehká vozidla','Passenger & light vehicles'),trucks:tr('Těžká nákladní vozidla','Heavy trucks'),parts:tr('Autodíly','Auto parts') };
const definitions = { vehicles:tr('HS 8703 + lehká nákladní vozidla do 5 t','HS 8703 + light goods vehicles up to 5 t'),trucks:tr('Silniční tahače + nákladní vozidla nad 5 t','Road tractors + goods vehicles over 5 t'),parts:tr('Základní skupina dílů a příslušenství · HS 8708','Core parts & accessories · HS 8708') };
const units = {value:tr('mld. běžných USD','Current USD, billions'),share:tr('% sledovaného obchodu','% of observed trade'),index:tr('První zobrazený měsíc = 100','First displayed month = 100')};
const fmt = (value,digits=1) => value == null ? '—' : new Intl.NumberFormat(lang,{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value);
let data;
const params = new URLSearchParams(location.search);
let state = {market:params.get('market') || 'ALL',metric:params.get('metric') || 'value',start:params.get('start'),end:params.get('end')};
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
  const values=points.flatMap(p=>Object.values(p.displayed)).filter(v=>v!=null&&Number.isFinite(v));
  if(!values.length)return `<p class="auto-empty">${tr('Pro tento výběr nejsou dostupné srovnatelné údaje.','No comparable observations are available for this selection.')}</p>`;
  const compact=window.matchMedia('(max-width:800px)').matches;
  const W=compact?360:1080,H=compact?240:290,L=compact?38:58,R=compact?16:154,T=18,B=44;
  const rawMax=Math.max(...values,1);
  const magnitude=10**Math.floor(Math.log10(rawMax));
  const max=state.metric==='share'?100:Math.ceil(rawMax/magnitude*2)/2*magnitude;
  const x=i=>L+i*(W-L-R)/Math.max(points.length-1,1),y=v=>T+(H-T-B)*(1-v/max);
  let svg=`<svg class="auto-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titles[segment]+' · '+units[state.metric])}"><title>${esc(titles[segment])}</title>`;
  for(let tick=0;tick<=4;tick++){const v=max*tick/4;svg+=`<line class="auto-grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-12}" y="${y(v)+4}" text-anchor="end">${fmt(v,v<10?1:0)}</text>`;}
  const tickStep=Math.max(1,Math.ceil(points.length/(compact?3:6)));
  points.forEach((p,i)=>{if(i%tickStep===0||i===points.length-1)svg+=`<text x="${x(i)}" y="${H-14}" text-anchor="middle">${esc(monthLabel(p.period,lang))}</text>`;});
  const labels=[];
  REGIONS.forEach(region=>{
    const {color,dash}=styles[region];let path='',previous=null;
    points.forEach((p,i)=>{const value=p.displayed[region];if(value==null){previous=null;return;}
      const sequential=previous!=null && (Number(p.period.slice(0,4))*12+Number(p.period.slice(4))) - (Number(previous.slice(0,4))*12+Number(previous.slice(4))) === 1;
      path+=`${sequential?'L':'M'}${x(i).toFixed(2)},${y(value).toFixed(2)} `;previous=p.period;
    });
    svg+=`<path class="auto-line" data-region="${region}" d="${path}" stroke="${color}" stroke-dasharray="${dash}"/>`;
    points.forEach((p,i)=>{const value=p.displayed[region];if(value==null)return;const desc=`${monthLabel(p.period,lang)} · ${names[region]}: ${fmt(value)} · ${units[state.metric]}`;
      svg+=`<circle class="auto-point" data-region="${region}" data-period="${p.period}" cx="${x(i)}" cy="${y(value)}" r="4" fill="${color}" tabindex="0" role="button" aria-label="${esc(desc)}"><title>${esc(desc)}</title></circle>`;
    });
    const last=points.at(-1)?.displayed[region];if(last!=null)labels.push({region,value:last,actualY:y(last),labelY:y(last)});
  });
  labels.sort((a,b)=>a.labelY-b.labelY).forEach((l,i)=>{if(i)l.labelY=Math.max(l.labelY,labels[i-1].labelY+19);});
  const overflow=Math.max(0,(labels.at(-1)?.labelY || 0)-(H-B));
  if(!compact)labels.forEach(l=>{l.labelY-=overflow;const color=styles[l.region].color;svg+=`<path d="M${W-R+5},${l.actualY} L${W-R+15},${l.labelY}" stroke="${color}" fill="none"/><text x="${W-R+21}" y="${l.labelY+4}" style="fill:#171918;font-weight:700">${esc(names[l.region])}</text>`;});
  return svg+'</svg>';
}
function tableRows(series){return series.points.flatMap(p=>REGIONS.map(region=>({period:p.period,origin:names[region],market:state.market,trade_usd:p.values[region],value:p.displayed[region],unit:units[state.metric],status:p.values[region]==null?tr('Chybí','Missing'):tr('Vykázáno','Reported')})));}
function draw(){
  const series=monthlySeries(data,state);
  $('auto-charts').replaceChildren();
  series.forEach((s,i)=>{
    const latest=s.points.at(-1);const card=document.createElement('article');card.className='auto-chart-card';card.id=`automotive-${s.segment}-origins-monthly`;
    card.innerHTML=`<header class="auto-card-heading"><div><h3><span class="auto-card-number">0${i+1}</span>${titles[s.segment]}</h3><p>${definitions[s.segment]}</p></div><span class="auto-unit">${units[state.metric]}</span></header>${plot(s.points,s.segment)}<p class="auto-selected">${tr('Vyberte bod nebo použijte tabulku pro přesná čísla.','Select a point or use the table for exact figures.')}</p><div class="auto-latest">${REGIONS.map(region=>`<div><span>${names[region]}</span><strong>${fmt(latest?.displayed[region])}${state.metric==='share'?'%':''}</strong><span>${monthLabel(latest.period,lang)} · ${state.metric==='value'?tr('mld. USD','USD bn'):state.metric==='share'?tr('podíl','share'):tr('index','index')}</span></div>`).join('')}</div><p class="auto-source-line">${tr('Zdroj','Source')}: <a href="#method">UN Comtrade · ${tr('dovoz podle původu','imports by origin')}</a> · ${tr('Obchod uvnitř EU vyloučen','Intra-EU trade excluded')} · ${tr('Staženo','Retrieved')} ${esc(data.source.retrieved_at.slice(0,10))}</p>`;
    $('auto-charts').append(card);
    const showPoint=point=>{const p=s.points.find(p=>p.period===point.dataset.period);card.querySelector('.auto-selected').textContent=`${monthLabel(p.period,lang)} · ${names[point.dataset.region]}: ${fmt(p.displayed[point.dataset.region])} · ${units[state.metric]}`;};
    card.querySelectorAll('.auto-point').forEach(point=>{point.addEventListener('focus',()=>showPoint(point));point.addEventListener('pointerenter',()=>showPoint(point));point.addEventListener('click',()=>showPoint(point));point.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showPoint(point);}});});
    window.PSDChart.register({el:card,slug:card.id,title:titles[s.segment]+' · '+units[state.metric],rows:()=>tableRows(s),embeddable:false,exports:['csv','png'],columns:[{key:'period',label:tr('Měsíc','Month')},{key:'origin',label:tr('Původ','Origin')},{key:'market',label:tr('Trh','Market')},{key:'trade_usd',label:'USD',numeric:true},{key:'value',label:tr('Zobrazená hodnota','Displayed value'),numeric:true},{key:'unit',label:tr('Jednotka','Unit')},{key:'status',label:tr('Stav','Status')}],source:{name:'UN Comtrade',url:data.source.url,table:data.source.table,extracted:data.source.retrieved_at,vintage:'outturn',edition:data.source.archive_id,definition:definitions[s.segment],excludes:tr('Vnitrounijní obchod; kódy mimo uvedenou definici.','Intra-EU trade; codes outside the stated definition.'),caveat:tr('Stálá skupina dovozních trhů, běžné USD (CIF), bez sezónního očištění. Zbytek světa obsahuje neurčený původ.','Fixed importing-market panel, current USD (CIF), no seasonal adjustment. Rest of world includes unspecified origins.')}});
  });
  const n=state.market==='ALL'?data.panel.length:1;
  $('auto-status').textContent=`${n} ${tr('dovozních trhů','importing market'+(n===1?'':'s'))} · ${monthLabel(state.start,lang)} – ${monthLabel(state.end,lang)} · ${tr('Měsíčně · bez sezónního očištění','Monthly · not seasonally adjusted')}`;
}
async function init(){
  translate();
  const response=await fetch('/data/trade/automotive-monthly.v1.json?v=20260920');if(!response.ok)throw new Error(`HTTP ${response.status}`);
  data=await response.json();if(data.schema_version!=='automotive-monthly.v1'||!data.periods.length)throw new Error('Invalid automotive snapshot');
  if(!data.panel.includes(state.market))state.market='ALL';
  if(!Object.keys(units).includes(state.metric))state.metric='value';
  if(!data.periods.includes(state.start))state.start=data.periods[0];if(!data.periods.includes(state.end))state.end=data.periods.at(-1);if(state.start>state.end)state.end=state.start;
  $('auto-market').innerHTML=`<option value="ALL">${tr('Všechny sledované trhy','All reporting markets')} (${data.panel.length})</option>`+data.markets.map(m=>`<option value="${esc(m.code)}">${esc(m.name)} (${esc(m.code)})</option>`).join('');
  for(const id of ['start','end'])$('auto-'+id).innerHTML=data.periods.map(p=>`<option value="${p}">${monthLabel(p,lang)}</option>`).join('');
  for(const [key,value] of Object.entries(state)){$('auto-'+key).value=value;$('auto-'+key).disabled=false;}
  $('auto-legend').innerHTML=REGIONS.map(r=>`<span><svg viewBox="0 0 32 12" aria-hidden="true"><path d="M0 6H32" stroke="${styles[r].color}" stroke-width="3" stroke-dasharray="${styles[r].dash}"/></svg>${names[r]}</span>`).join('');
  $('auto-vintage').textContent=`${monthLabel(data.periods[0],lang)} — ${monthLabel(data.periods.at(-1),lang)}`;
  $('auto-coverage-copy').textContent=tr(`Srovnání zahrnuje ${data.panel.length} dovozních trhů se stejným pokrytím původu v ${data.periods.length} měsících. Všechny zdrojové odpovědi byly ověřeny proti kontrolním součtům archivu.`,`The comparison covers ${data.panel.length} importing markets with consistent origin coverage across ${data.periods.length} months. All source responses were verified against the archive’s checksums.`);
  $('auto-market-list').textContent=data.markets.map(m=>`${m.name} (${m.code})`).join(' · ');
  $('auto-controls').addEventListener('submit',e=>e.preventDefault());
  $('auto-controls').addEventListener('change',e=>{const key=e.target.name;if(!(key in state))return;state[key]=e.target.value;if(state.start>state.end){if(key==='start')state.end=state.start;else state.start=state.end;}$('auto-start').value=state.start;$('auto-end').value=state.end;syncURL();draw();});
  syncURL();draw();
}
init().catch(error=>{console.error(error);$('auto-status').textContent=tr('Měsíční data se nepodařilo načíst. Zkuste stránku obnovit.','Monthly data could not be loaded. Please reload the page.');});

document.addEventListener('click',event=>{const button=event.target.closest('[data-deep-lang]');if(!button)return;const url=new URL(location.href);url.searchParams.set('lang',button.dataset.deepLang);location.href=url.href;});

let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(data)draw();},100);});
