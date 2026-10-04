
(async () => {
 await window.PSDPlotReady;
 const root=document.getElementById('oil-atlas');
 const sets={annual:JSON.parse(document.getElementById('oa-data').textContent),monthly:JSON.parse(document.getElementById('oa-months').textContent)};
 let mode=new URL(location.href).searchParams.get('view')==='monthly'?'monthly':'annual',data=sets[mode];
 const topology=JSON.parse(document.getElementById('oa-geometry').textContent),countries=topojson.feature(topology,topology.objects.features).features,byId=new Map(countries.map(d=>[d.properties.id,d]));
 const euIds=new Set(["AUT", "BEL", "BGR", "CYP", "CZE", "DEU", "DNK", "ESP", "EST", "FIN", "FRA", "GRC", "HRV", "HUN", "IRL", "ITA", "LTU", "LUX", "LVA", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "SWE"]);
 const euFeature=topojson.merge(topology,topology.objects.features.geometries.filter(g=>euIds.has(g.properties.id)));
 const point=id=>d3.geoCentroid(byId.get(id));
 const routeDefs=[{key:'eu',id:'EU',name:'EU-27',color:'var(--oa-germany)',coord:d3.geoCentroid(euFeature)},{key:'china',id:'CHN',name:'China',color:'var(--oa-china)',coord:point('CHN')},{key:'india',id:'IND',name:'India',color:'var(--oa-india)',coord:point('IND')}];
 // Annual extensions read only the independently published data plane.
 function annualObservation(payload){
  if(payload?.frequency!=='A'||payload.period!=='2025'||payload.product?.code!=='270900'||!Array.isArray(payload.routes))throw Error('Unexpected annual oil dataset');
  const routes=payload.routes.filter(r=>r.origin.code==='RUS'),days=365,estimated=[];
  const weight=r=>r.net_weight_kg==null?null:Number(r.net_weight_kg);
  if(routes.some(r=>weight(r)!=null&&(!Number.isFinite(weight(r))||weight(r)<0)))throw Error('Invalid annual route weight');
  const observation={year:'2025',period:'2025',frequency:'A',days,markets:payload.totals.reporting_markets,estimated,source:payload.source};
  const subtotal=(key,selected)=>{
   const available=selected.filter(r=>weight(r)!=null);
   if(available.some(r=>r.net_weight_is_estimated))estimated.push(key);
   return available.length?available.reduce((sum,r)=>sum+weight(r),0)/days/1000000:null;
  };
  for(const [key,code] of [['china','CHN'],['india','IND'],['germany','DEU'],['netherlands','NLD'],['poland','POL']])observation[key]=subtotal(key,routes.filter(r=>r.market.code===code));
  observation.eu=subtotal('eu',routes.filter(r=>euIds.has(r.market.code)));
  observation.rest=subtotal('rest',routes.filter(r=>euIds.has(r.market.code)&&!['DEU','NLD','POL'].includes(r.market.code)));
  observation.euRoutes=routes.filter(r=>euIds.has(r.market.code)&&weight(r)!=null).length;
  observation.euReporting=new Set(payload.routes.filter(r=>euIds.has(r.market.code)).map(r=>r.market.code)).size;
  return observation;
 }
 try{
  const response=await fetch('/api/v1/trade/energy/flows?product=petroleum&frequency=A&period=2025',{signal:AbortSignal.timeout(8000)});
  if(response.ok){const observation=annualObservation((await response.json()).data);if(observation.india!=null||observation.china!=null)sets.annual.push(observation);}
 }catch(error){console.warn('2025 annual data unavailable; verified history retained.',error.message);}
 data=sets[mode];
 const annualEdition=()=>sets.annual[0].year+'–'+sets.annual.at(-1).year;
 const existing=null;
 let index=existing?.design==='oil-charts'&&Number.isInteger(existing.observation)?Math.max(0,Math.min(data.length-1,existing.observation)):0;
 let selected=existing?.design==='oil-charts'&&['china','india','eu'].includes(existing.destination)?existing.destination:null,compare=false,playing=false,raf=0,timer=0,current={...data[index]},rotation=[],W=0,H=0,moving=false,map,projection,geo,land,grid,flows=[],ghosts=[],underlays=[],nodes=[],labels=[],particles=[],arrows=[],leaders=[],worldLand,halo;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),$=id=>root.querySelector('#'+id),design={flowScale:12,texture:true};
 // A single frame clock owns camera, flow morphs, particles, holds and pause.
 let phase=null,running=false,lastFrame=0,hold=0,motionTime=0,pose={x:0,y:0,z:1,lon:-35,lat:-24},routeCurves=[],basePoints=[],projectionKey=null;
 const annualShots=[{x:0,y:0,z:1,lon:-35,lat:-24},{x:0,y:0,z:1.015,lon:-43,lat:-26},{x:0,y:0,z:1.035,lon:-54,lat:-29},{x:0,y:0,z:1.05,lon:-66,lat:-31},{x:0,y:0,z:1.025,lon:-77,lat:-29}];
 const makeShots=()=>mode==='annual'?data.map((d,i)=>annualShots[i]||{...annualShots.at(-1),lon:-77-(i-4)*8}):data.map((d,i)=>({x:0,y:0,z:1.025+i*.001,lon:-77+i*.8,lat:-29+i*.45}));
 let shots=makeShots();pose={...shots[index]};
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};

 const maximum=d3.max([...sets.annual,...sets.monthly].flatMap(d=>routeDefs.map(r=>d[r.key])).filter(v=>v!=null));
 const widthScale=()=>28/maximum*design.flowScale/12;
 const fmt=v=>v==null?'—':v===0?'0':v<.1?v.toFixed(3):v<10?v.toFixed(1):Math.round(v).toLocaleString('en-US');
 const valueLabel=(d,k)=>fmt(d[k])+(d.estimated.includes(k)?'*':'');
 const period=i=>data[i].year;
 const modeLabel=i=>data[i].frequency==='A'?'ANNUAL DAILY AVERAGE':'MONTHLY DAILY AVERAGE';
 const statusLabel=i=>period(i)+' · '+modeLabel(i);
 const sessionToken=Date.now().toString(36);let writeSequence=0;
 function persist(){localInteraction=true;const url=new URL(location.href);url.searchParams.set('view',mode);url.searchParams.set('period',data[index].period);history.replaceState(null,'',url);}
 function setIcon(isPlaying){root.querySelector('.oa-play-icon').textContent=isPlaying?'Ⅱ':'▶';}
 function modeControls(){
  root.setAttribute('data-view',mode);$('oa-monthly').checked=mode==='monthly';
  $('oa-time').max=data.length-1;
  root.querySelector('.oa-years').innerHTML=data.map((d,i)=>`<button type="button" class="cursor-interaction" data-year="${i}" style="--oa-tick:${data.length>1?i/(data.length-1):0}" aria-label="${d.year}, ${d.frequency==='A'?'annual':'monthly'} observation" aria-pressed="${i===index}">${d.year}</button>`).join('');
  root.querySelectorAll('[data-year]').forEach(b=>b.addEventListener('click',()=>choose(+b.dataset.year)));
  $('oa-source-rows').innerHTML=data.map((d,i)=>`<tr><td><a href="https://publicspendingdata.org/api/v1/trade/energy/flows?product=petroleum&amp;frequency=${d.frequency}&amp;period=${d.period}" target="_blank" rel="noopener">${period(i)}</a></td>${routeDefs.map(r=>`<td>${d[r.key]==null?'—':d[r.key].toFixed(3)+(d.estimated.includes(r.key)?'*':'')}</td>`).join('')}<td>${d.markets}</td></tr>`).join('');
  buildTrends();
 }
 function setMode(next,save=true){
  if(!sets[next])return;stop();phase=null;mode=next;data=sets[mode];index=0;playhead=0;anchorPosition=0;current={...data[0]};shots=makeShots();pose={...shots[0]};selected=null;compare=false;motionTime=0;hold=0;
  modeControls();render();syncText();paintReadouts();playerLabel();if(save)persist();
 }
 function changeView(next,resume=playing){
  const origin={position:0,values:{...current},camera:{...pose},label:period(index),motion:motionTime};
  setMode(next,false);go(0,true,origin);playing=resume;playerLabel();persist();
 }
 $('oa-monthly').addEventListener('change',e=>changeView(e.target.checked?'monthly':'annual'));
 $('oa-continue-monthly').addEventListener('click',()=>changeView('monthly',true));
 function syncText(){
  const d=data[index],monthly=mode==='monthly';
  const heads=['Before the<br>great pivot.','The old pattern<br>holds.','India’s imports<br>accelerate.','A new balance<br>takes shape.','The pivot<br>is established.','The pivot holds<br>in 2025.'];
  const copies=['The EU-27 reported subtotal exceeds China’s imports. India is still a small buyer.','One final annual view before the sharp change in India’s imports.','India’s average daily intake rises sharply compared with the previous year.','India’s reported crude imports approach China’s. The EU-27 reported subtotal falls sharply.','China and India lead this comparison. Open EU-27 to see the original major buyers and the rest of the bloc.','China and India remain the major buyers in 2025. Their reported daily averages are below 2024; the available EU-27 subtotal falls again.'];
  $('oa-chapter-number').textContent=String(index+1).padStart(2,'0')+' / '+String(data.length).padStart(2,'0')+' — '+(monthly?'MONTHLY INDIA':'ANNUAL HISTORY');
  $('oa-chapter-title').innerHTML=monthly?'The monthly<br>pulse.':heads[index]||'The latest<br>annual picture.';
  $('oa-chapter-copy').textContent=monthly?'Russian-origin crude reported by India, month by month. China and EU figures are unavailable for this monthly comparison.':copies[index]||'Published annual imports for 2025. EU-27 is the available reported subtotal; missing destinations remain unavailable.';
  $('oa-map-year').textContent=period(index);$('oa-observation').textContent=statusLabel(index);$('oa-time').value=index;$('oa-time').setAttribute('aria-valuetext',period(index)+' '+modeLabel(index).toLowerCase());
  root.style.setProperty('--oa-progress',(index/(data.length-1)*100)+'%');root.querySelectorAll('[data-year]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.year===index)));
  routeDefs.forEach(r=>{$('oa-'+r.key+'-value').textContent=valueLabel(d,r.key);const b=root.querySelector('[data-country="'+r.key+'"]');b.disabled=d[r.key]==null;});
  updateDetail();
 }
 function updateDetail(){
  const panel=$('oa-inspection');panel.hidden=!selected;root.querySelectorAll('[data-country]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.country===selected)));
  let detail=panel.querySelector('[data-eu-detail]');if(!detail){detail=document.createElement('div');detail.setAttribute('data-eu-detail','');panel.append(detail);}detail.hidden=selected!=='eu';
  if(selected){const r=routeDefs.find(d=>d.key===selected),d=data[index],v=d[selected],change=v==null?null:(v/data[0][selected]-1)*100;
   $('oa-inspect-country').textContent=r.name+(selected==='eu'?' · reported subtotal':'')+' · '+period(index);
   $('oa-inspect-value').textContent=v==null?'No published route weight':valueLabel(d,selected)+' thousand tonnes/day';
   $('oa-inspect-change').textContent=selected==='eu'?'Fixed EU-27 membership · available reported weights':change==null?'Missing reporting is not zero trade':(change>=0?'+':'')+Math.round(change).toLocaleString('en-US')+'% vs '+period(0)+' daily average';
   if(selected==='eu')detail.innerHTML='<div class="oa-eu-breakdown">'+[['germany','Germany'],['netherlands','Netherlands'],['poland','Poland'],['rest','Rest of EU (24)']].map(([k,n])=>'<div><span>'+n+'</span><strong>'+valueLabel(d,k)+'</strong></div>').join('')+'<span class="oa-eu-note">Top three fixed by 2020 reported weight · thousand tonnes/day · — = no published route weight · rest is the observed subtotal</span></div>';
  }paintScene(moving);
 }
 let globe=null;
 function render(){if(!globe)globe=window.PSDPlot.globe($('oa-map'),{features:countries,origin:point('RUS'),originLabel:'RUSSIA',routes:routeDefs,groupFor:f=>f.properties.id==='RUS'?'russia':euIds.has(f.properties.id)?'germany':({CHN:'china',IND:'india'}[f.properties.id]||''),maximum,onSelect:key=>{if(data[index][key]==null)return;selected=selected===key?null:key;updateDetail();persist();}});globe.resize();paintScene(moving);}
 function drawGeometry(){root.setAttribute('data-globe-longitude',pose.lon.toFixed(3));root.setAttribute('data-motion-phase',moving?'transition':running?'playing':'still');}
 function paintWidths(){}
 function paintReadouts(){paintScene(moving);}
 function animateParticles(){}
 // Monotone Hermite interpolation passes through every observation without
 // overshoot or forcing the velocity to zero at each intermediate year.
 function through(values,i,t){
  const a=values[i],b=values[i+1];if(a==null||b==null)return null;
  const slope=j=>{if(j===0||j===values.length-1)return 0;const p=values[j]-values[j-1],q=values[j+1]-values[j];return p*q<=0?0:2*p*q/(p+q);};
  const m=slope(i),n=slope(i+1),t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*a+(t3-2*t2+t)*m+(-2*t3+3*t2)*b+(t3-t2)*n;
 }
 // Compact historical charts share the map's playhead and source observations.
 let trendPanels=[];
 function trendValue(values,position){
  const i=Math.min(values.length-1,Math.max(0,Math.floor(position)));
  return i===values.length-1?values[i]:through(values,i,position-i);
 }
 function buildTrends(){
  const host=$('oa-trend-grid');if(!host)return;
  trendPanels.forEach(c=>c.plot.destroy());host.replaceChildren();trendPanels=[];
  // One export rail covers the three small multiples; each panel stays a focused chart.
  const set=document.createElement('div');set.className='oa-trend-set';host.append(set);
  const series=mode==='monthly'?routeDefs.filter(r=>r.key==='india'):routeDefs;
  series.forEach(r=>{
   const panel=document.createElement('section');panel.className='oa-trend-panel';panel.dataset.series=r.key;
   const heading=document.createElement('div');heading.className='oa-trend-panel-head';const label=document.createElement('h3');label.textContent=r.name+(r.key==='eu'?' · reported subtotal':'');const value=document.createElement('span');value.className='oa-trend-value';heading.append(label,value);panel.append(heading);
   const chart=document.createElement('div');chart.className='oa-trend-plot';panel.append(chart);set.append(panel);
   const plot=window.PSDPlot.render(chart,{type:'line',height:230,title:r.name+' · Russian-origin crude imports',unit:'Thousand tonnes / day',yDomain:{min:0,max:400,ticks:[0,100,200,300,400]},rows:data.map(d=>({...d,label:d.year})),fields:[{key:r.key,label:r.name,color:r.color,format:(v,row)=>v.toFixed(3)+(row.estimated.includes(r.key)?'*':'')}],playhead:0,onSelect:row=>choose(data.findIndex(d=>d.period===row.period))});
    trendPanels.push({r,value,plot,panel});
  });
  window.PSDChart.register({slug:'oil-pivot-'+mode,el:host,title:'Russian-origin crude imports',accessor:window.PSDPlot.model({type:'line',rows:data.map(d=>({...d,label:d.year})),fields:series.map(r=>({key:r.key,label:r.name}))}).accessor,source:{name:'Published UN Comtrade observations',url:'https://publicspendingdata.org/api/v1/trade/energy/flows?product=petroleum&frequency='+data[0].frequency+'&period='+data[0].period,table:'HS 270900 · importer-reported Russian origin',extracted:mode==='annual'&&sets.annual.at(-1).source?.snapshot_as_of?sets.annual.at(-1).source.snapshot_as_of.slice(0,10):'2026-09-21',edition:mode==='annual'?annualEdition():'October 2025–July 2026',definition:'Net weight kg / calendar days / 1,000,000; thousand tonnes per day.',caveat:'EU-27 is an available-route subtotal. Missing is not zero. * denotes source-estimated weight. Monthly is India only; August is excluded.',vintage:'outturn'},exports:['csv','png'],embeddable:false});
  $('oa-trend-scope').textContent=mode==='annual'?'Three destinations · one scale':'India only · monthly observations';paintTrends();
 }
 function paintTrends(){
  if(!trendPanels.length)return;const p=Math.max(0,Math.min(data.length-1,playhead)),i=Math.floor(p),fraction=p-i;
  $('oa-trend-date').textContent=phase?`Moving to ${period(phase.to)}`:fraction>.001&&i<data.length-1?`${period(i)} → ${period(i+1)}`:period(i);
  trendPanels.forEach(c=>{c.plot.setPlayhead(p);c.value.textContent=phase?'→ '+valueLabel(data[phase.to],c.r.key):fraction>.001?'≈ '+fmt(current[c.r.key]):valueLabel(data[i],c.r.key);c.panel.dataset.playhead=p.toFixed(4);});
 }
 const segmentDuration=()=>mode==='annual'?5000:3000;
 let playhead=index,anchorPosition=index,startedAt=0,localInteraction=false;
 function playerLabel(){
  $('oa-play-label').textContent=playing?'Pause':phase||playhead>index?'Resume':index===data.length-1?'Replay':'Play entire story';
  $('oa-play-status').textContent=(mode==='annual'?annualEdition()+' · '+((sets.annual.length-1)*5)+' seconds':'Oct 2025–Jul 2026 · 27 seconds')+(reduced.matches?' · reduced camera motion':'');
  setIcon(playing);root.toggleAttribute('data-playing',playing);$('oa-next').hidden=mode!=='annual'||index!==data.length-1||playing||!!phase;
 }
 function stop(){playing=false;running=false;cancelAnimationFrame(raf);playerLabel();drawGeometry();}
 function liveReadouts(approximate){
  const value=k=>(approximate&&current[k]!=null?'≈ ':'')+fmt(current[k]);
  routeDefs.forEach((r,i)=>{

   $('oa-'+r.key+'-value').textContent=approximate?value(r.key):valueLabel(data[index],r.key);
  });
 }
 function paintScene(approximate){
  drawGeometry();liveReadouts(approximate);paintTrends();
  globe?.update({pose,values:current,labels:routeDefs.map(r=>phase?.modeChange&&(data[phase.to][r.key]==null||phase.values[r.key]==null)?'—':(approximate&&current[r.key]!=null?'≈ ':'')+fmt(current[r.key])+(approximate?'':data[index].estimated.includes(r.key)?'*':'')),selected,motionTime,animate:running&&!reduced.matches});
 }
 function renderPosition(position){
  playhead=Math.max(0,Math.min(data.length-1,position));
  const nextIndex=Math.floor(playhead),t=playhead-nextIndex,atEnd=nextIndex===data.length-1;
  if(index!==nextIndex){index=nextIndex;syncText();paintReadouts();}
  moving=!atEnd&&t>0;
  routeDefs.forEach(r=>current[r.key]=atEnd?data[index][r.key]:through(data.map(d=>d[r.key]),index,t));
  for(const k of ['x','y','z','lon','lat'])pose[k]=reduced.matches?shots[0][k]:atEnd?shots[index][k]:through(shots.map(s=>s[k]),index,t);
  root.style.setProperty('--oa-progress',(playhead/(data.length-1)*100)+'%');
  $('oa-observation').textContent=moving?period(index)+' → '+period(index+1)+' · TRANSITION':statusLabel(index);
  motionTime=playhead*segmentDuration();paintScene(moving);
 }
 function renderSeek(elapsed){
  phase.elapsed=Math.max(0,elapsed);const t=Math.min(1,phase.elapsed/phase.duration),e=smooth(t),target=data[phase.to];
  playhead=phase.from+(phase.to-phase.from)*e;
  routeDefs.forEach(r=>{
   const a=phase.values[r.key],b=target[r.key];
   // A disappearing unavailable route fades away; it is never presented as zero.
   current[r.key]=a==null&&b==null?null:t===1?b:(a??0)+((b??0)-(a??0))*e;
  });
  for(const k of ['x','y','z','lon','lat'])pose[k]=reduced.matches?shots[0][k]:phase.camera[k]+(shots[phase.to][k]-phase.camera[k])*e;
  moving=t<1;
  root.style.setProperty('--oa-progress',(playhead/(data.length-1)*100)+'%');
  $('oa-observation').textContent=phase.fromLabel+' → '+period(phase.to)+' · TRANSITION';
  motionTime=phase.motionStart+phase.elapsed;paintScene(true);
  if(phase.modeChange)routeDefs.forEach(r=>{if(target[r.key]==null||phase.values[r.key]==null)$('oa-'+r.key+'-value').textContent='—';});
  return t===1;
 }
 function tick(){
  if(!running)return;
  if(phase){
   const completedAt=phase.startedAt+phase.duration;
   if(!renderSeek(Date.now()-phase.startedAt)){raf=requestAnimationFrame(tick);return;}
   const target=phase.to;phase=null;index=target;syncText();paintReadouts();updateDetail();renderPosition(target);
   if(!playing){running=false;playerLabel();drawGeometry();paintScene(moving);persist();return;}
   anchorPosition=target;startedAt=completedAt;
  }
  if(playing){
   renderPosition(anchorPosition+Math.max(0,Date.now()-startedAt)/segmentDuration());
   if(playhead>=data.length-1){stop();paintScene(moving);persist();return;}
  }else{running=false;return;}
  raf=requestAnimationFrame(tick);
 }
 function run(){cancelAnimationFrame(raf);running=true;raf=requestAnimationFrame(tick);}
 function go(next,animate=true,origin=null){
  cancelAnimationFrame(raf);running=false;
  const start=origin||{position:playhead,values:{...current},camera:{...pose},label:period(index),motion:motionTime};
  phase=null;
  if(!animate||(!origin&&Math.abs(playhead-next)<.00001)){renderPosition(next);syncText();paintReadouts();playerLabel();return;}
  phase={from:start.position,to:next,values:start.values,camera:start.camera,fromLabel:start.label,motionStart:start.motion,modeChange:!!origin,duration:1800,elapsed:0,startedAt:Date.now()};
  // Start at the currently rendered geometry, even when reversing an unfinished move.
  renderSeek(0);run();
 }
 function choose(i){
  localInteraction=true;const continuePlaying=playing;stop();go(i,true);playing=continuePlaying;
  if(playing&&!phase){anchorPosition=playhead;startedAt=Date.now();run();}
  playerLabel();persist();
 }
 function play(){
  localInteraction=true;
  if(playing){
   if(phase)renderSeek(Date.now()-phase.startedAt);else renderPosition(anchorPosition+Math.max(0,Date.now()-startedAt)/segmentDuration());
   stop();persist();return;
  }
  if(phase){phase.startedAt=Date.now()-phase.elapsed;}
  else if(playhead>=data.length-1)go(0,true);
  playing=true;anchorPosition=playhead;startedAt=Date.now();playerLabel();run();persist();
 }
 $('oa-play').addEventListener('click',play);

 $('oa-time').addEventListener('input',e=>choose(+e.target.value));
 root.querySelectorAll('[data-country]').forEach(b=>b.addEventListener('click',()=>{selected=selected===b.dataset.country?null:b.dataset.country;updateDetail();persist();}));
 root.querySelector('.oa-inspection .oa-close').addEventListener('click',()=>{selected=null;updateDetail();persist();});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=null;updateDetail();persist();}});

 // The browser may suspend frames in a hidden iframe; elapsed time keeps advancing.
 document.addEventListener('visibilitychange',()=>{if(running&&!document.hidden){cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);}});
 reduced.addEventListener('change',()=>{if(phase)renderSeek(phase.elapsed);else renderPosition(playhead);playerLabel();});
 const requestedPeriod=new URL(location.href).searchParams.get('period');const requestedIndex=data.findIndex(d=>String(d.period)===requestedPeriod);if(requestedIndex>=0){index=requestedIndex;playhead=index;current={...data[index]};pose={...shots[index]};}
 const description=$('oa-map-desc');if(description)description.textContent=description.textContent.replace('2020–2024',annualEdition());
 const edition=document.querySelector('.story-edition');if(edition&&sets.annual.length>5)edition.textContent='Updated 4 October 2026 · Annual: '+annualEdition()+' · EU-27 reported subtotal · Monthly India: October 2025–July 2026.';
 modeControls();

 new ResizeObserver(()=>render()).observe(root.querySelector('.oa-map-frame'));render();syncText();paintReadouts();playerLabel();

 const expand=$('oa-expand');
 function expanded(value){root.classList.toggle('is-expanded',value);document.body.classList.toggle('oil-expanded',value);expand.setAttribute('aria-expanded',String(value));expand.textContent=value?'Close ×':'Expand ↗';if(!value)expand.focus();}
 expand.addEventListener('click',()=>expanded(!root.classList.contains('is-expanded')));
 root.addEventListener('keydown',e=>{if(!root.classList.contains('is-expanded'))return;if(e.key==='Escape'){expanded(false);return;}if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button:not(:disabled),input,a[href]')].filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 root.dataset.ready='true';
})().catch(error=>{console.error('Oil story unavailable; source evidence remains readable.',error);document.getElementById('oa-play-status').textContent='Animation unavailable · source table below';});
