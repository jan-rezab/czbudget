(() => {
  'use strict';
  const data=window.PSD_COVERAGE;
  const $=id=>document.getElementById(id);
  const canvas=$('flow'),ctx=canvas.getContext('2d'),pipeline=document.querySelector('.pipeline');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const state={scope:'world',layer:'municipal',country:'all',year:'all',indicator:'all',motion:!reduced.matches};
  const fmt=n=>new Intl.NumberFormat('en-US').format(n);
  const compact=n=>n>=1e6?(n/1e6).toFixed(2)+'m':n>=1e3?(n/1e3).toFixed(1)+'k':String(n);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sum=(rows,key='count')=>rows.reduce((n,r)=>n+r[key],0);
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  let selected=[],allRows=[],particles=[],anchors={},hub={x:0,y:0},field={},width=0,height=0;
  let elapsed=0,last=performance.now(),raf=null,tourStart=null,tourStep=-1;

  for(const year of data.years){const o=document.createElement('option');o.value=year;o.textContent=year;$('year').append(o);}
  data.metrics.forEach((metric,i)=>{const o=document.createElement('option');o.value=i;o.textContent=metric.label;$('indicator').append(o);});
  $('notes').innerHTML=data.notes.map(n=>'<li>'+esc(n)+'</li>').join('');

  function rowsFor(layer=state.layer,year=state.year,indicator=state.indicator){
    if(layer==='municipal')return data.municipal.map(c=>({...c,count:c.lines}));
    return data.national.map(c=>{
      const metrics=indicator==='all'?c.present:[c.present[Number(indicator)]];
      const count=metrics.reduce((n,m)=>n+(year==='all'?m.reduce((a,b)=>a+b,0):m[Number(year)-2005]),0);
      return {...c,count,sourceTitle:'IMF · World Economic Outlook',sourceUrl:data.nationalSource,period:year==='all'?'2005–2024':year};
    }).filter(c=>c.count>0);
  }
  function geoRows(rows){return rows.filter(c=>state.scope==='czech'?c.code==='CZE':state.scope==='rest'?c.code!=='CZE':true);}
  function stopTour(){tourStart=null;tourStep=-1;$('tour').textContent='Play the 60-second story';$('tour-status').textContent='Choose a filter and watch the data regroup.';}
  function change(mutator){stopTour();mutator();update();}
  function dateLabel(s){return new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
  function provider(row){try{return new URL(row.sourceUrl).hostname.replace(/^www\./,'');}catch{return 'Official publication';}}

  function update(){
    allRows=rowsFor();
    const options=geoRows(allRows).slice().sort((a,b)=>a.name.localeCompare(b.name));
    if(state.country!=='all'&&!options.some(c=>c.code===state.country))state.country='all';
    $('country').innerHTML='<option value="all">All countries</option>'+options.map(c=>`<option value="${c.code}">${esc(c.name)}</option>`).join('');
    for(const id of ['layer','country','year','indicator'])$(id).value=state[id];
    document.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===state.scope)));
    document.querySelectorAll('.national-filter').forEach(e=>e.hidden=state.layer!=='national');
    selected=options.filter(c=>state.country==='all'||c.code===state.country);
    const total=sum(selected),municipal=state.layer==='municipal';
    const geo=state.country!=='all'?selected[0]?.name||state.country:state.scope==='czech'?'Czechia':state.scope==='rest'?'Rest of covered world':'World · includes Czechia';
    $('view-label').textContent=geo.toUpperCase()+' · '+(municipal?'PUBLISHED MUNICIPAL DATA':'PUBLISHED NATIONAL DATA');
    $('count').textContent=fmt(total);$('unit').textContent=municipal?(total===1?'budget line':'budget lines'):(total===1?'observation':'observations');
    $('country-count').textContent=fmt(selected.length)+' '+(selected.length===1?'country':'countries');
    $('secondary').textContent=municipal?fmt(sum(selected,'profiles'))+' municipal profiles':(state.indicator==='all'?'15 indicators':data.metrics[Number(state.indicator)].label)+' · '+(state.year==='all'?'20 years':state.year);
    $('snapshot').textContent='Snapshot '+dateLabel(municipal?data.municipalDate:data.nationalDate);
    $('definition').textContent=municipal?'Published economic, functional or native municipal budget lines. Every country retains its own fiscal period and budget stages.':'Count of finite published country × indicator × year observations in IMF WEO, April 2026. Missing observations do not count.';
    const cz=allRows.find(c=>c.code==='CZE')?.count||0,global=sum(allRows),rest=global-cz;
    $('cz-count').textContent=fmt(cz);$('rest-count').textContent=fmt(rest);
    $('share').textContent=(global?cz/global*100:0).toFixed(1)+'% of covered '+(municipal?'budget lines':'observations')+' are Czech';
    $('cz-segment').style.width=(global?cz/global*100:0)+'%';
    document.querySelector('.split-track').setAttribute('aria-label',`Czechia ${fmt(cz)}, rest of covered world ${fmt(rest)} ${municipal?'budget lines':'observations'}`);
    const sorted=selected.slice().sort((a,b)=>(b.code==='CZE')-(a.code==='CZE')||b.count-a.count||a.name.localeCompare(b.name));
    const leading=sorted.slice(0,6),restRows=sorted.slice(6);
    $('source-list').innerHTML=leading.map(c=>`<button type="button" class="source ${c.code==='CZE'?'czech':''}" data-country="${c.code}" aria-label="Filter to ${esc(c.name)}, ${fmt(c.count)} records"><span class="name">${esc(c.name)}</span><span class="amount">${compact(c.count)}</span><span class="source-title">${esc(provider(c))} · ${esc(c.period)}</span><span class="source-volume" style="width:${c.count/Math.max(1,total)*100}%"></span></button>`).join('');
    $('source-rest').textContent=restRows.length?`+ ${restRows.length} other countries · ${compact(sum(restRows))} records`:selected.length?'Source links remain attached.':'No published observations match these filters.';
    $('source-details').innerHTML=selected.map(c=>`<p><a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.name)} · ${esc(c.sourceTitle)}</a><br>${fmt(c.count)} ${municipal?'budget lines':'observations'} · ${esc(c.period)}</p>`).join('');
    $('source-list').querySelectorAll('[data-country]').forEach(b=>b.addEventListener('click',()=>change(()=>{state.country=b.dataset.country;})));
    const unit=municipal?20000:50;
    $('particle-key').textContent=`Each light ≤ ${fmt(unit)} ${municipal?'lines':'observations'} · smaller lights = partial batches`;
    $('field').setAttribute('aria-label',`${fmt(total)} ${municipal?'published municipal lines':'national observations'} across ${selected.length} ${selected.length===1?'country':'countries'}. Each light represents up to ${unit} records.`);
    particles=[];
    for(const c of sorted){
      for(let n=0;n<Math.ceil(c.count/unit);n++){
        const weight=Math.min(unit,c.count-n*unit);
        particles.push({code:c.code,group:leading.some(r=>r.code===c.code)?c.code:'rest',weight,fraction:weight/unit,seed:(particles.length*.61803398875)%1,delay:((particles.length*137)%1500),x:0,y:0});
      }
    }
    elapsed=state.motion&&!reduced.matches?0:6000;
    $('flow-status').textContent=elapsed?'Ready to filter':'Gathering the view…';
    measure();wake();
  }

  function measure(){
    const r=pipeline.getBoundingClientRect();width=r.width;height=r.height;
    if(!width||!height)return;
    const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    const mobile=window.innerWidth<=650;
    anchors={};
    $('source-list').querySelectorAll('[data-country]').forEach(b=>{const q=b.getBoundingClientRect();anchors[b.dataset.country]={x:mobile?q.left-r.left+q.width/2:q.right-r.left,y:mobile?q.bottom-r.top:q.top-r.top+q.height/2};});
    const tail=$('source-rest').getBoundingClientRect();anchors.rest={x:mobile?tail.left-r.left+tail.width/2:tail.right-r.left,y:tail.top-r.top+tail.height/2};
    const h=$('hub').getBoundingClientRect();hub={x:h.left-r.left+h.width/2,y:h.top-r.top+h.height/2};
    const f=$('field').getBoundingClientRect();field={x:f.left-r.left,y:f.top-r.top,w:f.width,h:f.height};
    const unit=state.layer==='municipal'?20000:50;
    const capacity=rowsFor(state.layer,'all','all').reduce((n,c)=>n+Math.ceil(c.count/unit),0);
    const cols=Math.max(1,Math.floor(Math.sqrt(capacity*field.w/field.h)));
    const rows=Math.ceil(capacity/cols);const cell=Math.min(field.w/(cols+1),field.h/(rows+1));
    particles.forEach((p,i)=>{p.tx=field.x+cell*(i%cols+1);p.ty=field.y+cell*(Math.floor(i/cols)+1);p.radius=Math.min(3.3,cell*.29)*Math.sqrt(p.fraction);p.source=anchors[p.group]||anchors.rest;});
    wake();
  }
  function bezier(a,b,p,bend=0){const q=1-p;const c1={x:a.x+(b.x-a.x)*.48,y:a.y+bend},c2={x:a.x+(b.x-a.x)*.55,y:b.y-bend};return{x:q*q*q*a.x+3*q*q*p*c1.x+3*q*p*p*c2.x+p*p*p*b.x,y:q*q*q*a.y+3*q*q*p*c1.y+3*q*p*p*c2.y+p*p*p*b.y};}
  function draw(){
    if(!width||!height||!particles.every(p=>p.source))return;
    ctx.clearRect(0,0,width,height);
    ctx.lineWidth=1;ctx.strokeStyle='#717c5428';
    for(const a of Object.values(anchors)){
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(a.x+(hub.x-a.x)*.48,a.y,a.x+(hub.x-a.x)*.55,hub.y,hub.x,hub.y);ctx.stroke();
    }
    for(const p of particles){
      const phase=clamp((elapsed-p.delay)/2700);let position;
      if(phase<.48)position=bezier(p.source,hub,smooth(phase/.48),(p.seed-.5)*28);
      else position=bezier(hub,{x:p.tx,y:p.ty},smooth((phase-.48)/.52),(p.seed-.5)*38);
      p.x=position.x;p.y=position.y;
      ctx.globalAlpha=phase===0?.14:phase===1?.92:.72;ctx.fillStyle=p.code==='CZE'?'#c93237':'#a8b63f';
      ctx.beginPath();ctx.arc(position.x,position.y,p.radius,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  const story=[
    {at:0,layer:'municipal',scope:'world',year:'all',indicator:'all',line:'Many official sources. Millions of published budget lines.'},
    {at:10,layer:'municipal',scope:'czech',year:'all',indicator:'all',line:'Start with Czechia. Every filter changes the view.'},
    {at:20,layer:'municipal',scope:'rest',year:'all',indicator:'all',line:'Now add the rest of the covered world.'},
    {at:30,layer:'national',scope:'world',year:'all',indicator:'all',line:'Switch layers: 20 years of national indicators.'},
    {at:40,layer:'national',scope:'world',year:'2005',indicator:'all',line:'Narrow the time window to one year.'},
    {at:48,layer:'national',scope:'world',year:'2024',indicator:'1',line:'Then select an indicator: government expenditure.'},
    {at:55,layer:'municipal',scope:'world',year:'all',indicator:'all',line:'Many sources. One place to explore.'}
  ];
  function tick(now){
    raf=null;const dt=Math.min(now-last,100);last=now;
    if(tourStart!==null){
      const seconds=(now-tourStart)/1000;
      if(seconds>=60){stopTour();$('tour-status').textContent='The story is complete. The filters are yours.';}
      else{
        const step=story.findLastIndex(s=>seconds>=s.at);
        if(step!==tourStep){tourStep=step;const s=story[step];Object.assign(state,{scope:s.scope,layer:s.layer,country:'all',year:s.year,indicator:s.indicator});update();$('tour-status').textContent=s.line;}
        $('tour').textContent='Stop story · '+String(Math.floor(seconds)).padStart(2,'0')+' / 60';
      }
    }
    if(state.motion&&!reduced.matches)elapsed+=dt;
    draw();
    if(elapsed>=4200&&$('flow-status').textContent!=='Ready to filter')$('flow-status').textContent='Ready to filter';
    if(tourStart!==null||(state.motion&&elapsed<4300&&!reduced.matches))wake();
  }
  function wake(){if(raf===null){last=performance.now();raf=requestAnimationFrame(tick);}}

  document.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>change(()=>{state.scope=b.dataset.scope;state.country='all';})));
  $('layer').addEventListener('change',()=>change(()=>{state.layer=$('layer').value;state.country='all';state.year='all';state.indicator='all';}));
  for(const id of ['country','year','indicator'])$(id).addEventListener('change',()=>change(()=>{state[id]=$(id).value;}));
  $('replay').addEventListener('click',()=>{stopTour();elapsed=reduced.matches?6000:0;state.motion=!reduced.matches;$('motion').textContent=state.motion?'Pause motion':'Motion off';$('flow-status').textContent=state.motion?'Gathering the view…':'Ready to filter';wake();});
  $('motion').addEventListener('click',()=>{state.motion=!state.motion;$('motion').textContent=state.motion?'Pause motion':'Resume motion';wake();});
  $('tour').addEventListener('click',()=>{if(tourStart!==null){stopTour();return;}tourStart=performance.now();tourStep=-1;state.motion=!reduced.matches;$('motion').textContent=state.motion?'Pause motion':'Motion off';wake();});
  reduced.addEventListener('change',()=>{state.motion=!reduced.matches;elapsed=reduced.matches?6000:elapsed;$('motion').disabled=reduced.matches;$('motion').textContent=state.motion?'Pause motion':'Motion off';wake();});
  if(reduced.matches){$('motion').textContent='Motion off';$('motion').disabled=true;}
  new ResizeObserver(measure).observe(pipeline);
  update();
})();
