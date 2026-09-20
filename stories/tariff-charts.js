
(() => {
 const root=document.getElementById('psd-clear-tariffs'),D=JSON.parse(document.getElementById('psd-clear-data').textContent),tip=root.querySelector('#psd-clear-tooltip');
 const fmt=(v,n=1)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:n,maximumFractionDigits:n});
 const color=i=>`var(--viz-series-${i})`,FG='var(--foreground)',BORDER='var(--border)';
 const months=D.trade.map(d=>new Date(d.date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}));
 const tradeSeries=[{key:'imports',label:'U.S. imports',color:color(1)},{key:'exports',label:'U.S. exports',color:color(2),dash:'5 4'}];
 const rateSeries=[{key:'us',label:'U.S. on partner goods',color:color(1)},{key:'foreign',label:'Partner on U.S. goods',color:color(2)}];
 const initialHidden = new URLSearchParams(location.search).get("hiddenSeries") || "";
 let hidden=Object.fromEntries(initialHidden.split(",").filter(k=>["trade-imports","trade-exports","rates-us","rates-foreign"].includes(k)).map(k=>[k,true])),pinned=false;
 function persist(){const url=new URL(location.href),keys=Object.keys(hidden).filter(k=>hidden[k]);keys.length?url.searchParams.set("hiddenSeries",keys.join(",")):url.searchParams.delete("hiddenSeries");history.replaceState(null,"",url);}
 function legend(id,series,prefix){const el=root.querySelector('#'+id);el.replaceChildren();for(const s of series){const b=document.createElement('button');b.type='button';b.className='cursor-interaction';b.setAttribute('aria-pressed',String(!hidden[prefix+s.key]));b.innerHTML=`<i style="background:${s.color}"></i><span>${s.label}</span>`;b.onclick=()=>{hidden[prefix+s.key]=!hidden[prefix+s.key];pinned=false;tip.hidden=true;render();persist();};el.append(b);}}
 function svgFor(id,h,title){const host=root.querySelector('#'+id),w=Math.floor(host.getBoundingClientRect().width);host.replaceChildren();const s=d3.select(host).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('width',w).attr('height',h).attr('role','img').attr('aria-label',title);s.append('title').text(title);return{s,w,h};}
 function frame(s,L,T,W,H){s.append('rect').attr('data-chart-frame','').attr('x',L).attr('y',T).attr('width',W).attr('height',H).attr('fill','none').attr('stroke',BORDER);}
 function label(s,x,y,value,anchor='start',attrs={}){let t=s.append('text').attr('x',x).attr('y',y).attr('text-anchor',anchor).text(value);Object.entries(attrs).forEach(([k,v])=>t.attr(k,v));return t;}
 function axisTitles(s,w,h,yTitle,xTitle){label(s,64,14,yTitle,'start',{'class':'axis-title','data-axis':'y'});label(s,w-18,h-5,xTitle,'end',{'class':'axis-title','data-axis':'x'});}
 function showTip(svg,mx,my,html){tip.innerHTML=html;tip.hidden=false;const a=svg.node().getBoundingClientRect(),r=root.getBoundingClientRect(),tw=tip.getBoundingClientRect().width;tip.style.left=Math.max(0,Math.min(root.clientWidth-tw,a.left-r.left+mx+12))+'px';tip.style.top=(a.top-r.top+my+14)+'px';}
 function clearTip(){if(!pinned){tip.hidden=true;root.querySelectorAll('[data-chart-hover-marker],[data-chart-hover-guide]').forEach(e=>e.setAttribute('visibility','hidden'));}}
 function checkLabels(s){const a=s.selectAll('.tick text,.value-label,.axis-title').nodes().filter(n=>n.getBoundingClientRect().width);const boxes=a.map(n=>({n,r:n.getBoundingClientRect()}));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const p=boxes[i],q=boxes[j];if(p.r.left<q.r.right+4&&p.r.right+4>q.r.left&&p.r.top<q.r.bottom+4&&p.r.bottom+4>q.r.top){if(q.n.classList.contains('value-label'))q.n.style.display='none';else if(p.n.classList.contains('value-label'))p.n.style.display='none';}}}
 function drawTrade(){
  const {s,w,h}=svgFor('trade-chart',300,'Monthly imports and exports, four U.S. trading partners; billions of dollars'),L=64,R=22,T=30,B=58,W=w-L-R,H=h-T-B;
  const all=D.trade.flatMap(d=>[d.imports,d.exports]),extent=d3.extent(all),spread=extent[1]-extent[0];
  const x=d3.scaleLinear().domain([0,D.trade.length-1]).range([L+5,w-R-5]),y=d3.scaleLinear().domain([Math.max(0,extent[0]-spread*.25),extent[1]+spread*.3]).nice().range([h-B-5,T+5]);
  frame(s,L,T,W,H);axisTitles(s,w,h,'Trade value · $bn','Month');
  const ticks=w<450?[0,3,6,9]:[0,2,4,6,9];
  s.append('g').attr('transform',`translate(0,${h-B})`).call(d3.axisBottom(x).tickValues(ticks).tickFormat(i=>months[i]+(i===0?' ’25':i===3?' ’26':''))).call(g=>g.selectAll('text').attr('text-anchor',(d,i)=>i===0?'start':i===ticks.length-1?'end':'middle'));
  s.append('g').attr('transform',`translate(${L},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-W).tickPadding(10));
  const shown=tradeSeries.filter(a=>!hidden['trade-'+a.key]);
  shown.forEach(a=>{s.append('path').datum(D.trade).attr('fill','none').attr('stroke',a.color).attr('stroke-width',2.5).attr('stroke-dasharray',a.dash||null).attr('d',d3.line().x((d,i)=>x(i)).y(d=>y(d[a.key])));s.selectAll('.points-'+a.key).data(D.trade).join('circle').attr('cx',(d,i)=>x(i)).attr('cy',d=>y(d[a.key])).attr('r',3).attr('fill',a.color);label(s,x(9)-2,y(D.trade[9][a.key])-12,'$'+fmt(D.trade[9][a.key])+'bn','end',{'class':'value-label'});});
  const guide=s.append('line').attr('data-chart-hover-guide','').attr('y1',T).attr('y2',h-B).attr('stroke',FG).attr('opacity',.4).attr('visibility','hidden');
  const dots=shown.map(a=>s.append('circle').attr('data-chart-hover-marker',a.key).attr('r',4).attr('fill',a.color).attr('visibility','hidden'));
  function hover(event){const [px,py]=d3.pointer(event,s.node()),xx=Math.max(x(0),Math.min(x(9),px)),v=x.invert(xx),lo=Math.floor(v),hi=Math.min(9,lo+1),t=v-lo;guide.attr('x1',xx).attr('x2',xx).attr('visibility','visible');const values=shown.map((a,i)=>{const val=D.trade[lo][a.key]*(1-t)+D.trade[hi][a.key]*t;dots[i].attr('cx',xx).attr('cy',y(val)).attr('visibility','visible');return `${a.label}: $${fmt(val)}bn`;});showTip(s,xx,Math.min(py,160),`<div>${months[lo]}${hi!==lo?'–'+months[hi]:''} · interpolated between months</div>${values.map(v=>'<div>'+v+'</div>').join('')}`);}
  s.append('rect').attr('data-chart-hit','').attr('data-chart-hover-overlay','cross-series').attr('x',L).attr('y',T).attr('width',W).attr('height',H).attr('fill','transparent').on('pointermove',e=>{if(!pinned)hover(e);}).on('pointerleave',clearTip).on('click',e=>{pinned=!pinned;hover(e);});checkLabels(s);
 }
 function drawCash(){
  const data=D.cash.slice(-6),{s,w,h}=svgFor('cash-chart',350,'Monthly net customs receipts, March through August 2026; June minus 25.6 billion dollars'),L=64,R=22,T=32,B=52,W=w-L-R,H=h-T-B;
  const extent=d3.extent(data,d=>d.net),pad=(extent[1]-extent[0])*.18;
  const x=d3.scaleLinear().domain([extent[0]-pad,extent[1]+pad]).nice().range([L+4,w-R-4]);
  const y=d3.scaleBand().domain(data.map(d=>d.date)).range([T+4,h-B-4]).padding(.28);
  frame(s,L,T,W,H);axisTitles(s,w,h,'Month · 2026','Net receipts · $bn');
  s.append('g').attr('transform',`translate(0,${h-B})`).call(d3.axisBottom(x).ticks(w<450?3:5).tickFormat(d=>d));
  s.append('line').attr('x1',x(0)).attr('x2',x(0)).attr('y1',T).attr('y2',h-B).attr('stroke',FG).attr('opacity',.5);
  data.forEach(d=>{const yy=y(d.date)+y.bandwidth()/2,v=d.net,month=new Date(d.date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}),sign=v<0?'−':'+';label(s,L-10,yy+4,month,'end');s.append('rect').attr('x',Math.min(x(0),x(v))).attr('y',yy-7).attr('width',Math.max(1,Math.abs(x(v)-x(0)))).attr('height',14).attr('fill',color(1));label(s,x(v)+(v<0?-7:7),yy+4,sign+'$'+fmt(Math.abs(v),Math.abs(v)<.1?2:1),v<0?'end':'start',{'class':'value-label'});s.append('rect').attr('x',L).attr('y',yy-21).attr('width',W).attr('height',42).attr('fill','transparent').attr('data-chart-hit','').attr('data-tooltip',`${month} 2026: $${fmt(d.gross)}bn collected − $${fmt(d.refunds)}bn refunded = ${sign}$${fmt(Math.abs(v),Math.abs(v)<.1?2:1)}bn net`);});checkLabels(s);
 }
 function drawRates(){
  const names={CHN:'China',EU27:'EU27',MEX:'Mexico',CAN:'Canada'},data=[...D.rates].sort((a,b)=>b.us-a.us),{s,w,h}=svgFor('rates-chart',340,'Trade-weighted tariff estimates, July 2026; United States versus its trading partners'),L=64,R=56,T=30,B=52,W=w-L-R,H=h-T-B;
  const max=d3.max(data,d=>Math.max(d.us,d.foreign));const x=d3.scaleLinear().domain([0,max*1.15]).nice().range([L+3,w-R-3]);
  frame(s,L,T,W,H);axisTitles(s,w,h,'Partner','Applied tariff · %');
  s.append('g').attr('transform',`translate(0,${h-B})`).call(d3.axisBottom(x).ticks(w<450?3:5).tickFormat(d=>d+'%'));
  data.forEach((d,i)=>{const yy=T+24+i*62;label(s,L-8,yy+8,names[d.partner],'end');rateSeries.forEach((a,j)=>{if(hidden['rates-'+a.key])return;const y=yy+j*20;s.append('rect').attr('x',x(0)).attr('y',y-7).attr('width',Math.max(1,x(d[a.key])-x(0))).attr('height',10).attr('fill',a.color);label(s,x(d[a.key])+6,y+2,fmt(d[a.key],2)+'%','start',{'class':'value-label'});});s.append('rect').attr('data-chart-hit','').attr('x',L).attr('y',yy-14).attr('width',W).attr('height',46).attr('fill','transparent').attr('data-tooltip',`${names[d.partner]}: U.S. on partner goods ${fmt(d.us,2)}%; partner on U.S. goods ${fmt(d.foreign,2)}%`);});checkLabels(s);
 }
 root.addEventListener('pointermove',event=>{
   const target=event.target.closest('[data-tooltip]');
   if(!target)return;
   tip.textContent=target.getAttribute('data-tooltip');tip.hidden=false;
   const bounds=root.getBoundingClientRect(),width=tip.getBoundingClientRect().width;
   tip.style.left=Math.max(0,Math.min(root.clientWidth-width,event.clientX-bounds.left+10))+'px';
   tip.style.top=(event.clientY-bounds.top+14)+'px';
 });
 root.addEventListener('pointerout',event=>{if(event.target.closest('[data-tooltip]'))tip.hidden=true;});
 function render(){legend('trade-legend',tradeSeries,'trade-');legend('rates-legend',rateSeries,'rates-');drawTrade();drawCash();drawRates();}

 let last=0;new ResizeObserver(()=>{const w=Math.floor(root.clientWidth);if(w>0&&w!==last){last=w;render();}}).observe(root);render();
})();
