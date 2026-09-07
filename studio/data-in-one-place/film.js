(() => {
  'use strict';
  const d=window.PSD_SOURCE_NETWORK,coverage=window.PSD_COVERAGE;
  const $=id=>document.getElementById(id), canvas=$('network-canvas'),ctx=canvas.getContext('2d'),stage=$('film-stage');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=n=>Math.round(n).toLocaleString('en-US'),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}, mix=(a,b,t)=>a+(b-a)*t;
  const hash=n=>((Math.sin(n*127.1+311.7)*43758.5453)%1+1)%1;
  const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const money=n=>n>=1e9?`${(n/1e9).toFixed(1)}bn CZK`:`${(n/1e6).toFixed(1)}m CZK`;
  const families={municipal:'Municipal budgets',state:'Ministries & state budgets',statistics:'National statistics',international:'International institutions',services:'Health, education & transport',registers:'Registers & public entities'};
  const scenes=[
    {at:0,name:'Every municipality',kicker:'Czech municipalities',title:'Start with every town.',sub:'Prague, Brno, and thousands more. Real municipalities. Real published budgets.',number:6254,label:'Czech municipalities',note:'One dot per municipal profile · arranged for readability, not geographic location.'},
    {at:10,name:'Ministries & state',kicker:'Ministries and state budgets',title:'Then the state behind it.',sub:'Education. Health. Transport. Defence. Fourteen ministries, within 47 budget chapters.',number:47,label:'state-budget chapters · 14 ministries',note:'One tile per chapter · Ministry of Finance, approved 2026 budget, excluding EU/FM · ministries highlighted in red.'},
    {at:20,name:'Go global',kicker:'National and international institutions',title:'Bring the world in.',sub:'UN Comtrade. UN population data. IMF. OECD. World Bank. Eurostat. The context crosses borders.',number:coverage.national.length,label:'countries with national observations',note:'National coverage: IMF WEO snapshot · 27 countries also appear in the municipal directory; itemized depth varies.'},
    {at:30,name:'Bring it together',kicker:'The source network',title:'Hundreds of sources. One place.',sub:'Budgets, statistical series, registers and publications, connected with their original source references.',number:d.references.length,label:'distinct cited source URLs',note:'One moving point per cited source URL · each retains its original reference in the source explorer below.'},
    {at:42,name:'Show the scale',kicker:'The volume behind the view',title:'Millions of rows. Kept in context.',sub:'A source network large enough to explore public money from a town budget to the global economy.',number:null,label:'',note:'Separate measures from the 30 Aug 2026 release · cumulative processing can include overlapping historical versions.'},
    {at:52,name:'Filter the network',kicker:'Make the network yours',title:'From the world to your question.',sub:'Narrow the source network. Czech institutions, global organisations, or a single source family.',number:d.references.length,label:'source references · world view',note:`All ${d.references.length} cited references, 6,254 municipalities and 47 chapters are searchable below.`}
  ];
  let manualElapsed=0,entityRows=null;
  let time=0,playing=!reduced.matches,last=performance.now(),w=0,h=0,mobile=false,current=-1,labelKey='',labelNodes=[],raf=0,filtered=d.references,manual=false,pageLimit=48;
  let mapData=null,worldPaths=[],worldCanvas=null;
  $('film-chapters').innerHTML=scenes.map((s,i)=>`<button type="button" data-film-scene="${i}" aria-pressed="false"><small>${String(s.at).padStart(2,'0')}s</small>${s.name}</button>`).join('');
  $('network-methodology').textContent=d.methodology;
  const volumeMetrics=[['cumulative_structured_rows_processed','Rows processed','Cumulative · historical versions can overlap'],['current_validated_financial_facts','Validated financial facts','Current deduplicated inventory'],['current_published_line_items','Published municipal lines','Itemized municipal profiles']];
  $('film-volumes').innerHTML=volumeMetrics.map(([key,title,note])=>`<div class="film-volume"><div class="volume-fill"></div><strong data-volume="${key}">0</strong><span>${title}</span><small>${note}</small></div>`).join('');

  function sourceRows(){const origin=$('network-origin').value,family=$('network-family').value,q=fold($('network-search').value);return d.references.filter(r=>(origin==='all'||r.origin===origin)&&(family==='all'||r.family===family)&&(!q||fold([r.title,r.provider,r.host,r.topics.join(' ')].join(' ')).includes(q)));}
  function renderRegistry(animate=false){
    document.querySelectorAll('[data-network-origin]').forEach(b=>b.setAttribute('aria-pressed',String($('network-kind').value==='sources'&&$('network-origin').value===b.dataset.networkOrigin)));
    const kind=$('network-kind').value,q=fold($('network-search').value);
    $('network-origin').disabled=kind!=='sources';$('network-family').disabled=kind!=='sources';
    let rows=[];
    if(kind==='sources'){
      entityRows=null;filtered=sourceRows();rows=filtered.map(r=>({url:r.url,name:r.provider,body:r.title,meta:`${families[r.family]} · ${r.artifacts.length} published artifact${r.artifacts.length===1?'':'s'} · ${r.host}`}));
      $('network-count').textContent=`${fmt(rows.length)} of ${fmt(d.references.length)} source references`;
      $('network-scope').textContent=`${new Set(filtered.map(r=>r.provider)).size} source groups · original links retained`;
    }else{
      entityRows=(kind==='municipalities'?d.municipalities:d.chapters).filter(r=>!q||fold([r.name,r.alias,r.name_cs,r.region,r.id].join(' ')).includes(q));
      rows=entityRows.map(r=>({url:r.url,name:r.name,body:kind==='municipalities'?`${r.region} · ${money(r.amount)} actual expenditure`:`${r.ministry?'Ministry':'State-budget chapter'} · ${money(r.amount)} approved expenditure`,meta:`${kind==='municipalities'?'Municipal ID':'Chapter'} ${r.id} · ${kind==='municipalities'?'2025 actuals':'2026 approved · excluding EU/FM'}`}));
      $('network-count').textContent=`${fmt(rows.length)} ${kind==='municipalities'?'Czech municipalities':'state-budget chapters'}`;
      $('network-scope').textContent='Entities reported in official datasets; not a count of independent feeds.';
    }
    $('network-grid').innerHTML=rows.slice(0,pageLimit).map(r=>`<a class="network-card" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(r.name)}</strong><span>${esc(r.body)}</span><small>${esc(r.meta)} ↗</small></a>`).join('')||( '<p>No sources match these filters.</p>');
    $('network-more').hidden=rows.length<=pageLimit;
    $('network-more').textContent=`Show more · ${fmt(Math.max(0,rows.length-pageLimit))} remaining`;
    if(animate){manual=true;manualElapsed=0;playing=false;time=kind==='municipalities'?5:kind==='chapters'?15:35;current=-1;labelKey='';renderFrame();syncControls();}
  }
  function syncControls(){
    $('film-play').textContent=playing?'Pause':time>=60?'Replay':'Play';
    $('film-time').textContent=`${String(Math.min(60,Math.floor(time))).padStart(2,'0')} / 60`;
    $('film-seek').value=String(time);
  }
  function phaseIndex(){return Math.max(0,scenes.findLastIndex(s=>time>=s.at));}
  function sceneSourceRows(index){
    if(manual)return filtered;
    if(index===5){const step=time>=60?'all':time>=57?'international':time>=55?'czech':'all';return d.references.filter(r=>step==='all'||r.origin===step);}
    return d.references;
  }
  function setCopy(index,rows){
    if(index===5&&!manual){const origin=time>=60?'all':time>=57?'international':time>=55?'czech':'all';if($('network-origin').value!==origin){$('network-kind').value='sources';$('network-origin').value=origin;$('network-family').value='all';$('network-search').value='';pageLimit=48;renderRegistry();}}
    const s=scenes[index];$('film-kicker').textContent=`${String(index+1).padStart(2,'0')} / 06 · ${s.kicker.toUpperCase()}`;
    $('film-title').textContent=manual&&index===3?'Follow the sources you choose.':s.title;
    $('film-subtitle').textContent=s.sub;$('film-number-label').textContent=s.label;$('film-note').textContent=s.note;
    $('film-number').parentElement.hidden=s.number===null;
    $('film-hub').hidden=![3,5].includes(index);$('film-volumes').hidden=index!==4;
    document.querySelectorAll('[data-film-scene]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.filmScene)===index)));
    if(index===5||manual&&index===3){$('film-number-label').textContent=`cited source URLs · ${manual?'your selection':time>=60?'world view':time>=57?'international institutions':time>=55?'Czech sources':'world view'}`;}
    if(index!==4){const elapsed=time-s.at;const count=manual&&entityRows?entityRows.length:index>=3?rows.length:s.number;$('film-number').textContent=fmt(count);}
  }
  const named=(name)=>d.providers.find(p=>p.name===name);
  function labelsFor(index,rows){
    const count=mobile?6:12;
    if(manual&&entityRows&&index<=1){$('film-number-label').textContent=index===0?'matching municipal profiles':'matching budget chapters';}
    if(index===0){const offset=Math.min(5,Math.floor((time%10)/3))*4;return (manual&&entityRows?entityRows:d.municipalities).slice(manual?0:offset,(manual?0:offset)+(mobile?4:8)).map(r=>({name:r.name,note:`2025 actuals · ${money(r.amount)}`,url:r.url,origin:'czech'}));}
    if(index===1){const all=manual&&entityRows?entityRows:d.chapters.filter(c=>c.ministry);return (mobile?all.slice(Math.floor((time-10)/3.4)*5,Math.floor((time-10)/3.4)*5+5):all.slice(0,14)).map(r=>({name:r.name,note:`Chapter ${r.id} · ${money(r.amount)}`,url:r.url,origin:'czech'}));}
    if(index===2)return ['UN Comtrade','UN Population Division','IMF · World Economic Outlook','OECD','World Bank','Eurostat / European Commission','European Central Bank','NATO','US Census Bureau','Brazil · National Treasury','Japan · e-Stat','France · DGFiP accounts','Denmark · Statistics Denmark'].slice(0,count).map(named).filter(Boolean).map(p=>({...p,note:`${p.references.length} cited reference${p.references.length===1?'':'s'}`}));
    if(index===4)return [];
    const present=new Set(rows.map(r=>r.provider));
    const providers=d.providers.filter(p=>present.has(p.name));
    // Rotate through actual provider groups; every cited URL also has its own point.
    const offset=manual?0:Math.floor((time-scenes[index].at)/3)*count;
    return providers.length?Array.from({length:Math.min(count,providers.length)},(_,i)=>providers[(offset+i)%providers.length]).map(p=>({...p,note:`${rows.filter(r=>r.provider===p.name).length} cited source URL${p.references.length===1?'':'s'}`})):[];
  }
  function positions(index,n){
    return Array.from({length:n},(_,i)=>{
      if(index===1){const cols=mobile?2:4,rows=Math.ceil(n/cols);return{x:(i%cols+.5)/cols,y:mobile?.43+Math.floor(i/cols)*.175:.36+Math.floor(i/cols)*.15};}
      if(index===2){const cols=mobile?2:4;return{x:(i%cols+.5)/cols,y:mobile?.43+Math.floor(i/cols)*.16:.37+Math.floor(i/cols)*.20};}
      const per=Math.ceil(n/2);return{x:i<per?(mobile?.20:.13):(mobile?.80:.87),y:(mobile?.43:.34)+(i%per)*(mobile?.145:.10)};
    });
  }
  function renderLabels(index,rows){
    const labels=labelsFor(index,rows), key=index+labels.map(r=>r.name).join('|')+w;
    if(key!==labelKey){
      labelKey=key;const pos=positions(index,labels.length);
      $('film-labels').innerHTML=labels.map((r,i)=>`<a class="film-node ${r.origin==='czech'?'cz':''}" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" style="left:${pos[i].x*100}%;top:${pos[i].y*100}%"><span>${esc(r.name)}</span><small>${esc(r.note||'Source reference')}</small></a>`).join('');
      labelNodes=Array.from($('film-labels').children).map((el,i)=>({el,...pos[i]}));
    }
    labelNodes.forEach((r,i)=>{const drift=reduced.matches?0:Math.sin(time*1.5+i*.9)*2.8;r.el.style.transform=`translate(-50%,calc(-50% + ${drift}px))`;});
  }
  function bezier(a,b,t,bend=0){const q=1-t;return{x:q*q*q*a.x+3*q*q*t*(a.x+(b.x-a.x)*.45)+3*q*t*t*(a.x+(b.x-a.x)*.6)+t*t*t*b.x,y:q*q*q*a.y+3*q*q*t*(a.y+bend)+3*q*t*t*(b.y-bend)+t*t*t*b.y};}
  function dot(x,y,r,color,alpha=1){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(x-r,y-r,r*2,r*2);}
  function base(){
    ctx.clearRect(0,0,w,h);ctx.strokeStyle='#a8b63f0b';ctx.lineWidth=.6;
    for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,190);ctx.lineTo(x,h);ctx.stroke();}
    for(let y=190;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  }
  function municipalities(){
    const entries=manual&&entityRows?entityRows:d.municipalities;
    const cols=Math.max(1,Math.min(mobile?74:125,Math.ceil(Math.sqrt(entries.length*2.2)))),rows=Math.max(1,Math.ceil(entries.length/cols)), area={x:w*.19,y:h*(mobile?.37:.34),w:w*.62,h:h*(mobile?.49:.54)};
    const cell=Math.min(area.w/cols,area.h/rows),left=w/2-cols*cell/2,top=area.y+(area.h-rows*cell)/2;
    entries.forEach((m,i)=>{
      const p=ease((time-hash(i)*1.8)/3.2),tx=left+(i%cols)*cell,ty=top+Math.floor(i/cols)*cell;
      dot(mix(hash(i+4)*w,tx,p),mix(h*.35+hash(i+9)*h*.58,ty,p),Math.max(.55,Math.min(4,cell*.27)),i<14?'#c93237':'#a8b63f',.25+p*.7);
    });
    ctx.globalAlpha=1;
  }
  function chapters(){
    const entries=manual&&entityRows?entityRows:d.chapters;
    const cols=Math.max(1,Math.min(mobile?7:12,entries.length)),rows=Math.max(1,Math.ceil(entries.length/cols)),cell=Math.min(w*.77/cols,h*.40/rows),left=(w-cols*cell)/2,top=h*(mobile?.40:.43);
    entries.forEach((c,i)=>{const p=ease((time-10-hash(i)*1.2)/2);const x=mix(w*.5,left+(i%cols)*cell,p),y=mix(h*.8,top+Math.floor(i/cols)*cell,p);ctx.globalAlpha=.35+.6*p;ctx.fillStyle=c.ministry?'#c93237':'#a8b63f';ctx.fillRect(x,y,cell*.78,cell*.68);ctx.globalAlpha=1;ctx.fillStyle='#171918';ctx.font=`${Math.max(8,cell*.18)}px monospace`;ctx.fillText(c.id,x+5,y+cell*.39);});
  }
  function drawMap(){
    if(!worldCanvas)return;
    const scale=Math.min(w*.97/mapData.viewBox[2],h*.61/mapData.viewBox[3]);
    const mw=mapData.viewBox[2]*scale,mh=mapData.viewBox[3]*scale,x=(w-mw)/2,y=h*(mobile?.34:.29);
    const arrival=ease((time-20)/3.4),zoom=mix(2.2,1,arrival);
    ctx.save();ctx.translate(w/2,y+mh/2);ctx.scale(zoom,zoom);ctx.globalAlpha=.45+.5*arrival;ctx.drawImage(worldCanvas,-mw/2,-mh/2,mw,mh);ctx.restore();
    const points=worldPaths.filter(p=>p.covered);const hub={x:w*.51,y:y+mh*.40};
    points.forEach((p,i)=>{const target={x:x+p.cx*scale,y:y+p.cy*scale};const progress=((time-20)*.23+hash(i))%1;const at=bezier(target,hub,progress,(i%2?1:-1)*25);dot(at.x,at.y,1.2,i%12===0?'#c93237':'#a8b63f',.35);});ctx.globalAlpha=1;
  }
  function network(index,rows){
    const hub={x:w*.5,y:h*.61};const anchors=labelNodes.map(r=>({x:r.x*w,y:r.y*h}));
    ctx.lineWidth=.9;
    anchors.forEach((a,i)=>{ctx.strokeStyle='#a8b63f35';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(mix(a.x,hub.x,.45),a.y,mix(a.x,hub.x,.6),hub.y,hub.x,hub.y);ctx.stroke();});
    const elapsed=manual?manualElapsed:time-scenes[index].at;
    rows.forEach((r,i)=>{
      const angle=hash(r.id)*Math.PI*2;const origin=anchors[i%Math.max(1,anchors.length)]||{x:w*.5+Math.cos(angle)*w*.4,y:h*.6+Math.sin(angle)*h*.3};
      const progress=(elapsed*.20+hash(r.id)*.9)%1;const at=bezier(origin,hub,progress,(hash(r.id+55)-.5)*75);
      // Each moving point corresponds to one actual reference; density is not a byte-rate claim.
      dot(at.x,at.y,mobile?1.45:1.9,r.origin==='czech'?'#c93237':'#a8b63f',.65+.35*Math.sin(progress*Math.PI));
    });
    ctx.globalAlpha=1;
    $('film-hub-note').textContent=`${fmt(rows.length)} references · one explorable view`;
  }
  function volumes(){
    const p=ease((time-42)/3.2),max=d.coverage.metrics.cumulative_structured_rows_processed;
    volumeMetrics.forEach(([key],i)=>{const v=d.coverage.metrics[key],box=$('film-volumes').children[i];box.querySelector('strong').textContent=fmt(v*p);const fill=box.querySelector('.volume-fill');fill.style.height=`${v/max*p*100}%`;fill.style.width=mobile?`${v/max*p*100}%`:'100%';});
    for(let i=0;i<280;i++){const x=hash(i)*w,y=h*.34+((hash(i+2)+(time-42)*.17)%1)*h*.54;dot(x,y,1,'#a8b63f',.18);}
    ctx.globalAlpha=1;
  }
  function renderFrame(){
    const index=phaseIndex(),rows=sceneSourceRows(index);if(index!==current){current=index;labelKey='';}
    setCopy(index,rows);renderLabels(index,rows);base();
    if(index===0)municipalities();else if(index===1)chapters();else if(index===2)drawMap();else if(index===4)volumes();else network(index,rows);
    syncControls();
  }
  function resize(){
    const rect=stage.getBoundingClientRect();w=rect.width;h=rect.height;mobile=w<550;
    const dpr=Math.min(2,devicePixelRatio||1);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);labelKey='';renderFrame();
  }
  function tick(now){const dt=Math.min((now-last)/1000,.1);last=now;if(playing){time=Math.min(60,time+dt);if(time>=60)playing=false;renderFrame();}else if(manual&&manualElapsed<4&&!reduced.matches){manualElapsed+=dt;renderFrame();}raf=requestAnimationFrame(tick);}
  function jump(t){manual=false;time=t;current=-1;playing=!reduced.matches;renderFrame();}
  $('film-play').addEventListener('click',()=>{if(time>=60){manual=false;time=0;}playing=!playing;syncControls();});
  $('film-restart').addEventListener('click',()=>jump(0));
  $('film-seek').addEventListener('input',()=>{manual=false;playing=false;time=Number($('film-seek').value);renderFrame();});
  document.querySelectorAll('[data-film-scene]').forEach(b=>b.addEventListener('click',()=>jump(scenes[Number(b.dataset.filmScene)].at+.05)));
  $('film-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('source-film').requestFullscreen();}catch{ /* Native fullscreen may be unavailable inside an embedded browser. */ }});
  document.querySelectorAll('[data-network-origin]').forEach(b=>b.addEventListener('click',()=>{$('network-kind').value='sources';$('network-origin').value=b.dataset.networkOrigin;$('network-family').value='all';$('network-search').value='';pageLimit=48;renderRegistry(true);}));
  for(const id of ['network-kind','network-origin','network-family'])$(id).addEventListener('change',()=>{pageLimit=48;renderRegistry(true);});
  $('network-search').addEventListener('input',()=>{pageLimit=48;renderRegistry(true);});
  $('network-more').addEventListener('click',()=>{pageLimit+=48;renderRegistry();});
  reduced.addEventListener('change',()=>{if(reduced.matches){playing=false;time=5;}renderFrame();});
  new ResizeObserver(resize).observe(stage);
  if(reduced.matches)time=5;
  renderRegistry();resize();raf=requestAnimationFrame(tick);
  fetch('/data/world-map.v1.json').then(r=>{if(!r.ok)throw new Error('Map unavailable');return r.json();}).then(map=>{
    const vb=typeof map.viewBox==='string'?map.viewBox.split(/\s+/).map(Number):map.viewBox;mapData={viewBox:vb};
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden';svg.setAttribute('aria-hidden','true');document.body.append(svg);
    const covered=new Set(coverage.national.map(c=>c.iso2));
    worldPaths=map.locations.map(p=>{const el=document.createElementNS(ns,'path');el.setAttribute('d',p.path);svg.append(el);const box=el.getBBox();return{path:new Path2D(p.path),id:p.id,cx:box.x+box.width/2,cy:box.y+box.height/2,covered:covered.has(p.id)};});svg.remove();
    worldCanvas=document.createElement('canvas');worldCanvas.width=vb[2]*2;worldCanvas.height=vb[3]*2;const c=worldCanvas.getContext('2d');c.scale(2,2);c.lineWidth=.35;worldPaths.forEach(p=>{c.fillStyle=p.id==='cz'?'#c93237':p.covered?'#778a3f':'#333b30';c.strokeStyle='#171918';c.fill(p.path);c.stroke(p.path);});renderFrame();
  }).catch(()=>{$('film-note').textContent='World-map geometry is unavailable. All source references remain available below.';});
})();
