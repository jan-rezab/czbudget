/* Page adapter only: drawing, axes and accessible tooltips live in PSDPlot. */
window.PSDStoryChartsReady = (async () => {
 await import('/chart-runtime.js');
 const plot=await window.PSDPlotReady;
 const root=document.getElementById('psd-clear-tariffs');
 if(!root)return;
 const D=JSON.parse(document.getElementById('psd-clear-data').textContent);
 const fmt=(v,n=1)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:n,maximumFractionDigits:n});
 const tradeSeries=[{key:'imports',label:'U.S. imports'},{key:'exports',label:'U.S. exports'}];
 const rateSeries=[{key:'us',label:'U.S. on partner goods'},{key:'foreign',label:'Partner on U.S. goods'}];
 const allowed=['trade-imports','trade-exports','rates-us','rates-foreign'];
 const hidden=Object.fromEntries((new URLSearchParams(location.search).get('hiddenSeries')||'').split(',').filter(key=>allowed.includes(key)).map(key=>[key,true]));
 const month=date=>new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',year:'2-digit',timeZone:'UTC'});
 function legend(id,series,prefix){
   const host=root.querySelector('#'+id);host.replaceChildren();
   series.forEach((field,i)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed',String(!hidden[prefix+field.key]));
     const swatch=document.createElement('i');swatch.style.background=plot.palette[i];button.append(swatch,document.createTextNode(field.label));
     button.onclick=()=>{hidden[prefix+field.key]=!hidden[prefix+field.key];const url=new URL(location.href),keys=Object.keys(hidden).filter(key=>hidden[key]);if(keys.length)url.searchParams.set('hiddenSeries',keys.join(','));else url.searchParams.delete('hiddenSeries');history.replaceState(null,'',url);render();};host.append(button);
   });
 }
 function render(){
   legend('trade-legend',tradeSeries,'trade-');legend('rates-legend',rateSeries,'rates-');
   plot.render(root.querySelector('#trade-chart'),{type:'line',height:300,title:'Monthly imports and exports, four U.S. trading partners',unit:'USD bn',rows:D.trade.map(row=>({...row,label:month(row.date)})),fields:tradeSeries.map((field,i)=>({...field,color:plot.palette[i],format:value=>'$'+fmt(value)+'bn'})).filter(field=>!hidden['trade-'+field.key])});
   plot.render(root.querySelector('#cash-chart'),{type:'bar',height:350,title:'Monthly net customs receipts',unit:'USD bn · net',rows:D.cash.slice(-6).map(row=>({...row,label:month(row.date)})),fields:[{key:'net',label:'Net receipts',format:(value,row)=>'$'+fmt(value,2)+'bn (gross '+fmt(row.gross)+' − refunds '+fmt(row.refunds)+')'}]});
   const names={CHN:'China',EU27:'EU27',MEX:'Mexico',CAN:'Canada'};
   plot.render(root.querySelector('#rates-chart'),{type:'bar',height:340,title:'Trade-weighted applied tariff estimates',unit:'%',rows:[...D.rates].sort((a,b)=>b.us-a.us).map(row=>({...row,label:names[row.partner]||row.partner})),fields:rateSeries.map((field,i)=>({...field,color:plot.palette[i],format:value=>fmt(value,2)+'%'})).filter(field=>!hidden['rates-'+field.key])});
 }
 render();
 return true;
})().catch(error => { console.error('Story charts unavailable; source tables remain visible.', error); return false; });
