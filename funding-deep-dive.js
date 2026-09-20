import {renderLedgers} from './funding-ledgers.js';
import {countries,sources,socialRoutes,benchmarks,vat,deltaFromCzech,countryCode,tr,reviewed} from './lib/funding-deep-dive.mjs';

const root=document.querySelector('.funding-report-page');
const $=s=>root.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lang=document.documentElement.lang==='en'?'en':'cs',code=countryCode(location.search),timers=[];
const t=v=>v[lang],say=(en,cs)=>lang==='en'?en:cs;
const fmt=(v,d=1)=>new Intl.NumberFormat(lang==='en'?'en-GB':'cs-CZ',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v);
const copy={
  exampleTitle:tr('Worked example: watch state and local money join in one school budget','Výukový příklad: jak se spojí státní a místní peníze v rozpočtu školy'),
  eyebrow:tr('FOLLOW THE MONEY / FIVE COUNTRIES','SLEDUJTE PENÍZE / PĚT ZEMÍ'),
  title:tr('How public money reaches everyday life','Jak veřejné peníze dorazí ke službám'),
  intro:tr('Who collects it. Who passes it on. Who finally pays. Follow the institutions between a tax payment and a classroom, treatment or a household benefit.','Kdo vybírá. Kdo přerozděluje. Kdo nakonec platí. Sledujte instituce mezi zaplacením daně a třídou, léčbou nebo dávkou pro domácnost.'),
  revenueRoutes:tr('Explore the routes for taxes, insurance and borrowing','Prozkoumat cesty daní, pojistného a půjček'),
  choose:tr('Choose a country','Vyberte zemi'),coverage:tr('5 countries · 4 service paths · sourced amounts','5 zemí · 4 cesty ke službám · doložené částky'),
  budgets:tr('Budgets','Rozpočty'),schools:tr('Schools','Školy'),health:tr('Healthcare','Zdravotnictví'),pensions:tr('Pensions','Důchody'),social:tr('Social support','Sociální podpora'),compare:tr('Compare','Srovnání'),method:tr('Sources & boundaries','Zdroje a hranice'),
  stepOne:tr('01 / FROM REVENUE TO BUDGETS','01 / OD PŘÍJMŮ K ROZPOČTŮM'),
  budgetTitle:tr('One economy. Several public purses.','Jedna ekonomika, více veřejných peněženek.'),
  budgetIntro:tr('National, regional and local budgets connect through shared taxes and grants. Social and health insurance can use separate accounts. Borrowing finances a deficit; it is not tax revenue.','Státní, krajské a obecní rozpočty propojují sdílené daně a dotace. Sociální a zdravotní pojištění může mít samostatné účty. Půjčky financují schodek; nejsou daňovým příjmem.'),
  vatTitle:tr('A concrete example: 100 Kč of Czech VAT','Konkrétní příklad: 100 Kč české DPH'),
  vatIntro:tr('2026 statutory allocation, before grants. The tax is collected nationally, but part belongs directly to regions and municipalities. This Czech example stays fixed when you switch countries. It does not describe all taxes or total public spending.','Zákonné rozdělení pro rok 2026, před dotacemi. Daň se vybírá celostátně, ale část patří přímo krajům a obcím. Tento český příklad se při přepnutí země nemění. Nejde o rozdělení všech daní ani celkových veřejných výdajů.'),
  transferTitle:tr('A transfer moves the same money.','Transfer přesouvá stejné peníze.'),
  transferNote:tr('A national grant can enter a local budget and then pay a school. Counting the grant and the school payment as two final services doubles the amount. The place that spends the money need not be the place that raised it.','Státní dotace může vstoupit do místního rozpočtu a poté zaplatit školu. Započítat dotaci i platbu školy jako dvě konečné služby by částku zdvojnásobilo. Úroveň, která peníze vydává, je nemusela vybrat.'),
  stepSchool:tr('02 / MONEY FOR A SCHOOL','02 / PENÍZE PRO ŠKOLU'),schoolTitle:tr('One school can have several payers.','Jednu školu může platit více úrovní.'),
  follow:tr('Follow the money →','Sledovat tok →'),
  schoolScope:tr('The institutional routes describe ordinary public primary and secondary schools. The numbered examples have their own boundaries: the Czech total also includes universities. Teachers paid by a ministry or district bring resources into classrooms even when schools never receive the cash.','Institucionální cesty popisují běžné veřejné základní a střední školy. Číselné příklady mají vlastní hranice: český součet zahrnuje i vysoké školy. Učitelé placení ministerstvem nebo školským obvodem přinášejí do tříd zdroje, i když školy peníze na účet nedostanou.'),
  educationLink:tr('Continue to education budgets, school types and capacity →','Pokračovat k rozpočtům školství, typům škol a kapacitám →'),
  stepHealth:tr('03 / PAYING FOR CARE','03 / PLATBY ZA PÉČI'),healthTitle:tr('Owning a hospital and paying for treatment are different jobs.','Vlastnit nemocnici a platit léčbu jsou různé role.'),
  healthIntro:tr('Follow the insurer or public purchaser to the provider. Buildings and equipment have a separate investment route; households may also pay directly.','Sledujte pojišťovnu nebo veřejného plátce až k poskytovateli. Budovy a vybavení mají samostatnou investiční cestu; přímo mohou platit i domácnosti.'),
  healthLink:tr('Continue to health spending, hospitals and outcomes →','Pokračovat k výdajům na zdraví, nemocnicím a výsledkům →'),
  stepPension:tr('04 / PENSIONS','04 / DŮCHODY'),pensionTitle:tr('A local office can pay a national pension.','Místní pobočka může vyplácet celostátní důchod.'),
  stepSocial:tr('05 / OTHER SOCIAL SUPPORT','05 / DALŠÍ SOCIÁLNÍ PODPORA'),socialTitle:tr('Benefits and services use different intermediaries.','Dávky a služby mají různé mezičlánky.'),
  socialLink:tr('Continue to taxes, transfers and inequality →','Pokračovat k daním, dávkám a nerovnosti →'),
  stepCompare:tr('06 / WHAT CHANGES BETWEEN COUNTRIES','06 / ROZDÍLY MEZI ZEMĚMI'),compareTitle:tr('How much spending happens below national government?','Kolik výdajů probíhá pod celostátní úrovní?'),
  compareIntro:tr('These historical snapshots compare regional and local spending with all-government spending in each category. Δ is the percentage-point difference from Czechia in the same year. A large local share does not establish local tax autonomy.','Tyto historické přehledy porovnávají krajské a místní výdaje s výdaji celého vládního sektoru v dané oblasti. Δ je rozdíl v procentních bodech proti Česku ve stejném roce. Vysoký místní podíl nedokládá samostatnost při výběru daní.'),
  methodTitle:tr('Read the flows with the right boundaries.','Čtěte toky se správnými hranicemi.'),
  moneyLink:tr('Original Czech money-flow view →','Původní pohled na české peněžní toky →'),referenceLink:tr('Institutional reference and fiscal scale →','Institucionální přehled a rozsah veřejných financí →'),
};
function sourceLinks(ids){return [...new Set(ids)].map(id=>`<a href="${esc(sources[id].url)}" target="_blank" rel="noopener">${esc(sources[id].title)} ↗</a>`).join('');}
// Original SVG drawings keep institutional actors legible at every screen size.
function artwork(kind,cls=''){
  const drawings={
    people:'<circle cx="36" cy="31" r="10"/><path d="M18 80V59q0-15 18-15t18 15v21M28 80V62m16 18V62"/><circle cx="70" cy="40" r="8"/><path d="M57 80V63q0-12 13-12t13 12v17M18 86h65"/>',
    bank:'<path d="M10 35 50 12l40 23H10Zm7 6h66M20 43v34m20-34v34m20-34v34m20-34v34M12 80h76M8 88h84"/><circle cx="50" cy="27" r="4"/>',
    local:'<path d="M18 88V42h64v46M12 42h76L50 19 12 42ZM42 88V66h16v22M28 53h8m28 0h8M28 66h8m28 0h8M50 19V6h20v10H50"/>',
    money:'<rect x="10" y="27" width="70" height="44" rx="3"/><path d="M20 78h68V39M18 37h9m36 24h9"/><circle cx="45" cy="49" r="13"/><path d="M45 41v16m-5-13h7m-7 10h7"/>',
    office:'<path d="M24 87V18h52v69M15 87h70M43 87V68h14v19M34 29h8m16 0h8M34 42h8m16 0h8M34 55h8m16 0h8"/>',
    insurance:'<path d="M50 10 82 24v25q0 26-32 41Q18 75 18 49V24L50 10Z"/><path d="M38 36h24v23H38zM50 29v37M31 47h38"/>',
    care:'<path d="M14 86V33h72v53M34 33V14h32v19M43 23h14m-7-7v14M40 86V65h20v21M24 45h10m32 0h10M24 57h10m32 0h10M7 86h86"/>',
    school:'<path d="M14 86V40h72v46M8 40l42-24 42 24M50 16V4h23v10H50M43 86V64h14v22M24 52h10m32 0h10M24 66h10m32 0h10M7 86h86"/><circle cx="50" cy="39" r="7"/>',
    pension:'<circle cx="42" cy="28" r="12"/><path d="M30 26h9m4 0h10M39 26h4M21 83V58q0-15 21-15t21 15v25M34 84V65m17 19V65M70 85V58q0-10 9-10t9 10M15 88h74"/>',
    home:'<path d="M10 45 50 12l40 33M20 39v48h60V39M13 88h74M38 88V63h24v25"/><path d="M50 41c-14-14-24 5 0 17 24-12 14-31 0-17Z"/>',
    book:'<path d="M50 27Q30 12 10 23v58q20-11 40 4 20-15 40-4V23Q70 12 50 27Zm0 0v58M21 35l18 5M21 48l18 5m22-13 18-5M61 53l18-5"/>'
  };
  return `<svg class="fund-art ${cls}" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${drawings[kind]||drawings.office}</g></svg>`;
}
function schoolArt(){return `<svg class="fund-school-art" viewBox="0 0 300 260" aria-hidden="true"><g stroke="#171918" stroke-width="2" stroke-linejoin="round"><path d="M24 214h252"/><path d="M38 214V102h224v112" fill="#f1ede3"/><path d="m22 102 128-68 128 68Z" fill="#a8b63f"/><path d="M150 34V7h48v24h-48" fill="#a8b63f"/><path d="M145 10v19"/><path d="M42 114h216v86H42Z" fill="#faf7ef"/><path d="M150 114v100M38 158h224"/><rect x="57" y="126" width="55" height="23" fill="#242724"/><path d="m65 141 8-8 8 9 8-9" stroke="#a8b63f" fill="none"/><circle cx="129" cy="134" r="6" fill="#d2ccc1"/><path d="M120 154v-10q9-6 18 0v10m-18-7-9-7" fill="none"/><path d="M54 183h78m-67 0v17m54-17v17"/><circle cx="72" cy="170" r="5" fill="#d2ccc1"/><circle cx="113" cy="170" r="5" fill="#d2ccc1"/><path d="M65 181v-5h14v5m27 0v-5h14v5" fill="#a8b63f"/><path d="M169 129h69v15h-69Z" fill="#a8b63f"/><path d="M178 129v15m10-15v15m10-15v15m10-15v15m10-15v15m10-15v15M170 173h25v25h-25ZM210 172v27m8-27v27m8-27v27m-20-22h25m-25 18h25" fill="none"/><circle cx="150" cy="79" r="11" fill="#faf7ef"/><path d="M150 71v8l6 3" fill="none"/><path d="M60 220v16m-6 0h12M236 220v16m-6 0h12"/><circle cx="60" cy="213" r="5" fill="#a8b63f"/><circle cx="236" cy="213" r="5" fill="#a8b63f"/><path d="M32 245h234" stroke="#d2ccc1"/></g></svg>`;}
function nodeArt(label,index){
  const text=label.en.toLowerCase();
  if(/household|people|worker|employer|taxpayer/.test(text))return 'people';
  if(/insur|risk|medicare|nhsu|cms/.test(text))return 'insurance';
  if(/municip|local government|founder|district|commune|département/.test(text))return 'local';
  if(/ministry|treasury|state budget|federal budget/.test(text))return 'bank';
  if(/tax|revenue|contribution|bond|funds/.test(text)&&index===0)return 'money';
  return 'office';
}
const maps=[];
function renderMap(host,routes,{school=false}={}){
  const topic=host.id.replace('fund-','').replace('-map','');
  const destination={school:say('A school, ready to teach','Škola připravená učit'),health:say('Care reaches the patient','Péče dorazí k pacientovi'),pension:say('Income in retirement','Příjem ve stáří'),social:say('Support reaches a household','Podpora dorazí do domácnosti'),budget:say('Public services & support','Veřejné služby a podpora')}[topic];
  const endArt={school:'school',health:'care',pension:'pension',social:'home',budget:'bank'}[topic];
  host.innerHTML=`<div class="fund-map fund-map-${topic}"><div class="fund-map-key"><span>${say('FOLLOW THE MONEY','SLEDUJTE PENÍZE')} / ${esc(t(countries.find(c=>c.code===code).name))}</span><span>${say('Schematic · not proportional to amounts','Schéma · bez poměru částek')}</span></div><div class="fund-stage-headings"><span>${say('WHERE IT STARTS','ODKUD PŘICHÁZÍ')}</span><span>${say('WHO PASSES IT ON','KDO JE POSÍLÁ DÁL')}</span><span>${say('WHAT IT PAYS FOR','CO ZAPLATÍ')}</span></div><div class="fund-scene"><svg class="fund-connections" aria-hidden="true"></svg><div class="fund-lanes">${routes.map((r,row)=>`<article class="fund-lane" data-route="${row}"><h3><span>${String.fromCharCode(65+row)}</span>${esc(t(r.label))}</h3><div class="fund-route-actors" style="--actors:${r.nodes.length-1}">${r.nodes.slice(0,-1).map((n,i)=>`<div class="fund-actor" data-node="${row}-${i}"><div class="fund-actor-picture">${artwork(nodeArt(n,i))}</div><div>${esc(t(n))}</div></div>`).join('')}</div></article>`).join('')}</div><div class="fund-destination"><div class="fund-destination-art">${school?schoolArt():artwork(endArt)}</div><h3>${destination}</h3><div class="fund-arrivals">${routes.map((r,row)=>`<div class="fund-arrival" data-node="end-${row}"><span>${String.fromCharCode(65+row)}</span><p>${esc(t(r.nodes.at(-1)))}</p></div>`).join('')}</div></div></div><div class="fund-route-notes">${routes.map(r=>`<details><summary>${esc(t(r.label))} <span>${say('How it works + sources','Jak to funguje + zdroje')}</span></summary><p>${esc(t(r.note))}</p>${sourceLinks(r.sources)}${r.partial?`<small>${say('Partial evidence: current implementation is not fully verified.','Částečné doložení: současné provádění není plně ověřeno.')}</small>`:''}</details>`).join('')}</div></div>`;
  const scene=host.querySelector('.fund-scene');
  const draw=()=>{
    if(!scene.getBoundingClientRect().width)return;
    const svg=scene.querySelector('.fund-connections'),bounds=scene.getBoundingClientRect(),mobile=matchMedia('(max-width:760px)').matches;
    const edges=[],point=(key,end=false)=>{const el=scene.querySelector(`[data-node="${key}"]`),r=(end?el:el.querySelector('.fund-actor-picture')).getBoundingClientRect();const target=end?scene.querySelector('.fund-destination').getBoundingClientRect():r;return {x:target.left-bounds.left,y:r.top-bounds.top,w:target.width,h:r.height};};
    routes.forEach((route,row)=>{
      for(let i=0;i<route.nodes.length-1;i++){
        const end=i===route.nodes.length-2,a=point(`${row}-${i}`),b=point(end?`end-${row}`:`${row}-${i+1}`,end);
        let path;
        if(mobile&&end){const x= bounds.width-10-row*7;path=`M${a.x+a.w},${a.y+a.h/2} H${x} V${b.y+b.h/2} H${b.x+b.w}`;}
        else {const x1=a.x+a.w+5,y1=a.y+a.h/2,x2=b.x-7,y2=b.y+b.h/2,m=(x1+x2)/2;path=`M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`;}
        edges.push({path,row,step:i});
      }
    });
    svg.setAttribute('width',bounds.width);svg.setAttribute('height',bounds.height);svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
    const markerId=`arrow-${topic}`;
    svg.innerHTML=`<defs><marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="#a8b63f" stroke-width="2"/></marker></defs>${edges.map(e=>`<path class="fund-edge" d="${e.path}" marker-end="url(#${markerId})" ${e.row%2?'stroke-dasharray="5 6"':''}/><circle class="fund-packet" data-step="${e.step}" r="5" fill="#a8b63f" opacity="0"><animateMotion begin="indefinite" dur="800ms" path="${e.path}"/></circle>`).join('')}`;
  };
  maps.push(draw);draw();
  const benchmarkId={school:'education',health:'health',social:'social',pension:'pensions'}[topic];
  const benchmark=benchmarks.find(b=>b.id===benchmarkId);
  if(benchmark)document.getElementById(`fund-${topic}-comparison`).innerHTML=benchmarkStrip(benchmark,topic);
}

function benchmarkStrip(benchmark,topic){
  const title=topic==='school'?say('Who spends the education money?','Kdo vydává peníze na vzdělávání?'):topic==='health'?say('Who spends the health money?','Kdo vydává peníze na zdravotnictví?'):topic==='social'?say('Who spends the social-protection money?','Kdo vydává peníze na sociální ochranu?'):say('How large is public pension spending?','Jak velké jsou veřejné výdaje na důchody?');
  return `<aside class="fund-benchmark-strip"><div class="fund-benchmark-heading"><h3>${title}</h3><a href="#fund-chart-${benchmark.id}">${say('Definitions & full comparison ↗','Definice a celé srovnání ↗')}</a></div><p>${topic==='pension'?say('Public old-age and survivor cash benefits, % of GDP · 2020.','Veřejné peněžní dávky ve stáří a pozůstalým, % HDP · 2020.'):say('Regional + local share of government spending in this category. Historical snapshots.','Krajský + místní podíl vládních výdajů v dané oblasti. Historické údaje.')+(topic==='school'?say(' Education includes universities.',' Vzdělávání zahrnuje vysoké školy.'):'')}</p><div class="fund-country-comparison">${benchmark.rows.map(r=>{const delta=deltaFromCzech(r,benchmark.rows[0]);return `<div class="fund-country-stat ${r.code===code?'is-selected':''}"><span>${esc(t(countries.find(c=>c.code===r.code).name))}</span><strong>${r.value===null?'—':fmt(r.value)+'<small>%</small>'}</strong><span class="fund-stat-line" aria-hidden="true"></span><small>${r.value===null?say('Unverified','Neověřeno'):r.year+' · '+(r.code==='CZE'?say('Baseline','Základ'):delta===null?say('Different year','Jiný rok'):(delta>=0?'+':'−')+fmt(Math.abs(delta))+say(' pp',' p. b.'))}</small></div>`;}).join('')}</div></aside>`;
}

function registerChart(host,slug,title,unit,rows,source){
  if(!window.PSDChart)return;
  window.PSDChart.register({slug,el:host,title:()=>title,columns:[{key:'country',label:say('Country / recipient','Země / příjemce')},{key:'year',label:say('Year','Rok')},{key:'value',label:unit,numeric:true},{key:'delta',label:say('Δ vs Czechia (pp)','Δ proti Česku (p. b.)'),numeric:true},{key:'source',label:say('Source','Zdroj')}],rows:()=>rows,exports:['csv','png'],embeddable:false,source});
  host.querySelector('.fund-source')?.addEventListener('click',()=>host.querySelector('[data-action="sources"]')?.click());
}
function chartSvg(rows,max,label,selected){
  // The container's measured width determines geometry; labels never scale down on phones.
  const w=Math.max(260,selected.width),pad=12,plot=w-2*pad,step=72,h=rows.length*step+37;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><rect width="${w}" height="${h}" fill="#faf7ef"/><g font-family="Arial,Helvetica,sans-serif" fill="#171918">${rows.map((r,i)=>{const y=18+i*step;return `<text x="${pad}" y="${y}" font-size="13" font-weight="${r.code===code?'700':'400'}">${esc(r.label)}</text><text x="${w-pad}" y="${y}" text-anchor="end" font-size="13">${r.value===null?'—':fmt(r.value,selected.decimals??1)+'%'}</text><text x="${pad}" y="${y+18}" font-size="11" fill="#55594f">${esc(r.detail)}</text>${r.value===null?'':`<rect x="${pad}" y="${y+28}" width="${plot}" height="9" fill="#e8e4d9"/><rect x="${pad}" y="${y+28}" width="${plot*r.value/max}" height="9" fill="${r.code===code?'#c93237':'#a8b63f'}"/>`}`;}).join('')}<text x="${pad}" y="${h-8}" font-size="11">0%</text><text x="${w-pad}" y="${h-8}" text-anchor="end" font-size="11">${max}%</text></g></svg>`;
}
function renderVat(){
  const host=$('#fund-vat-chart');host.classList.add('fund-chart');
  const title=t(copy.vatTitle),unit=say('% of VAT revenue · 2026','% výnosu DPH · 2026');
  const rows=vat.map(r=>({label:t(r.label),value:r.value,detail:`${fmt(r.value,2)} Kč / 100 Kč`,year:2026}));
  const w=Math.max(270,host.clientWidth),mobile=w<540,h=mobile?440:300;
  const branchX=mobile?92:155,outX=mobile?145:w*.52,startY=h/2,ys=mobile?[72,212,352]:[48,145,242];
  const splitSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}: ${rows.map(r=>esc(r.label)+' '+r.value+'%').join(', ')}"><rect width="${w}" height="${h}" fill="#171918"/><g font-family="Arial,Helvetica,sans-serif">${rows.map((r,i)=>`<path d="M${branchX-15},${startY} C${outX-25},${startY} ${branchX},${ys[i]} ${outX},${ys[i]}" fill="none" stroke="${i===0?'#a8b63f':i===1?'#8b8d83':'#d2ccc1'}" stroke-width="${r.value*.55}"/><circle cx="${outX}" cy="${ys[i]}" r="4" fill="#faf7ef"/><text x="${outX+15}" y="${ys[i]-5}" fill="#faf7ef" font-size="${mobile?27:34}" font-weight="500">${fmt(r.value,2)}<tspan font-size="14"> Kč</tspan></text><text x="${outX+15}" y="${ys[i]+20}" fill="#d2ccc1" font-size="12">${esc(r.label)}</text>`).join('')}<rect x="0" y="${startY-40}" width="${branchX-12}" height="82" rx="2" fill="#a8b63f"/><text x="${(branchX-12)/2}" y="${startY-2}" text-anchor="middle" fill="#171918" font-size="${mobile?26:38}">100</text><text x="${(branchX-12)/2}" y="${startY+22}" text-anchor="middle" fill="#171918" font-size="13">Kč ${say('VAT','DPH')}</text></g></svg>`;
  host.innerHTML=`<div class="fund-chart-unit">${unit}</div>${splitSvg}<button class="fund-source" type="button">${esc(sources.czVat.title)} · ${say('definition & data','definice a data')} ↗</button>`;
  registerChart(host,'funding-guide-czech-vat-allocation',title,unit,rows.map(r=>({country:r.label,year:2026,value:r.value,delta:null,source:sources.czVat.url})),{name:sources.czVat.title,url:sources.czVat.url,definition:t(copy.vatIntro),excludes:say('Other taxes, insurance contributions and later transfers.','Ostatní daně, pojistné a následné transfery.'),caveat:say('Revenue allocation is not final spending.','Rozdělení příjmů není konečným výdajem.'),table:'Schéma rozpočtového určení daní od 1. 1. 2026 · DPH',edition:'2026',extracted:'2026-09-19',vintage:'plan'});
}
function renderBenchmarks(){
  const parent=$('#fund-benchmarks');parent.innerHTML=benchmarks.map(b=>`<article class="fund-chart" id="fund-chart-${b.id}"></article>`).join('');
  for(const b of benchmarks){
    const host=$(`#fund-chart-${b.id}`),title=t(b.title),pension=b.denominator==='gdp';
    const unit=pension?say('Public old-age + survivor cash benefits · % GDP · 2020','Veřejné peněžní dávky ve stáří a pozůstalým · % HDP · 2020'):say('Regional + local share of government spending in this category (%)','Krajský + místní podíl vládních výdajů v této oblasti (%)');
    const rows=b.rows.map(r=>{const delta=deltaFromCzech(r,b.rows[0]);return {...r,label:t(countries.find(c=>c.code===r.code).name),delta,detail:r.value===null?say('Comparable figure unverified','Srovnatelný údaj neověřen'):r.year+' · '+(r.code==='CZE'?say('Czech baseline','Český základ'):delta===null?say('No matched-year Δ','Bez Δ pro shodný rok'):(delta>=0?'+':'−')+fmt(Math.abs(delta))+say(' pp vs Czechia',' p. b. proti Česku'))};});
    const caveat=pension?say('A different denominator: GDP, not a national/local split. Pensions already belong to social protection.','Jiný jmenovatel: HDP, nikoli poměr státu a samospráv. Důchody jsou již součástí sociální ochrany.'):say('Historical snapshots: overall 2020; functions 2019, except Ukraine 2020 before the full-scale invasion. Ratios as published; no national remainder inferred.','Historické přehledy: celkem 2020; oblasti 2019, Ukrajina 2020 před plnou invazí. Publikované poměry; nedopočítáváme zbytek pro stát.');
    host.innerHTML=`<h3>${esc(title)}</h3><div class="fund-chart-unit">${unit}</div>${chartSvg(rows,pension?20:100,title,{width:host.clientWidth})}<button class="fund-source" type="button">${pension?'OECD · Pensions at a Glance 2025 · Table 8.2':'OECD/UCLG · SNG-WOFI · 2022 profiles'} · ${say('sources & data','zdroje a data')} ↗</button><p class="fund-chart-unit">${caveat}</p>`;
    registerChart(host,`funding-guide-${b.id}-comparison`,title,unit,rows.map(r=>({country:r.label,year:r.year,value:r.value,delta:r.delta,source:r.source?sources[r.source].url:say('Unverified','Neověřeno')})),{name:pension?sources.pensionSize.title:'OECD/UCLG · SNG-WOFI',url:pension?sources.pensionSize.url:'https://www.sng-wofi.org/data/',definition:unit,excludes:pension?say('Private pensions and non-cash benefits.','Soukromé důchody a nepeněžní dávky.'):say('Private spending. No measure of local tax autonomy or service quality. Education includes universities.','Soukromé výdaje. Neměří daňovou autonomii ani kvalitu služeb. Vzdělávání zahrnuje vysoké školy.'),caveat,table:pension?'Table 8.2 · 2020 column':`Country profiles · ${b.id==='all'?'expenditure by economic classification · Total expenditure':'expenditure by functional classification · '+b.id} · % general government`,edition:pension?'Pensions at a Glance 2025':'SNG-WOFI 2022',extracted:'2026-09-19',vintage:'outturn'});
  }
}
function renderMethod(){
  const blocks=[
    [tr('Current spending versus capital','Běžné versus kapitálové výdaje'),tr('Pensions, benefits, salaries and routine treatment are mostly current spending. Capital spending builds or buys long-lived assets such as classrooms, hospital buildings and equipment.','Důchody, dávky, mzdy a běžná léčba jsou převážně běžné výdaje. Kapitálové výdaje vytvářejí nebo pořizují dlouhodobý majetek, například učebny, budovy nemocnic a vybavení.')],
    [tr('Location is not government level','Adresa není úroveň vlády'),tr('A national agency may have a local office. A hospital may be owned by a region and paid by an insurer. In the US, “state” means a subnational government; in Czechia and France, regions are included in the subnational comparison.','Státní úřad může mít místní pobočku. Nemocnici může vlastnit kraj a platit pojišťovna. V USA znamená „state“ úroveň pod federací; české a francouzské regiony jsou zahrnuty do srovnání samospráv.')],
    [tr('Amounts, allocations and institutional routes','Částky, příděly a institucionální cesty'),tr('Numbered diagrams distinguish outturn, plans, accounting categories and derived differences. They cover named programmes, not always a whole sector. Dashed arrows identify plans, calculations or missing amounts. The additional institutional maps show structure only. Different years and scopes do not form one reconciled account.','Číselná schémata rozlišují skutečnost, plány, účetní kategorie a odvozené rozdíly. Pokrývají uvedené programy, ne vždy celé odvětví. Přerušované šipky značí plány, dopočty nebo chybějící částky. Doplňkové institucionální mapy ukazují pouze strukturu. Různé roky a rozsahy netvoří jeden sladěný účet.')],
    [tr('Gaps stay visible','Mezery zůstávají viditelné'),tr('Russia’s current execution is only partially verified. Ukraine’s 2020 observations describe a pre-invasion system. Missing amounts are not zero; different years receive no Czech delta. Pension spending is a subset of social protection, not an extra amount to add.','Současné provádění v Rusku je ověřeno jen částečně. Údaje Ukrajiny za rok 2020 popisují systém před plnou invazí. Chybějící částky nejsou nuly; různé roky nemají českou deltu. Důchody jsou součástí sociální ochrany, nikoli další částkou k přičtení.')],
  ];
  $('#fund-method').innerHTML=blocks.map(([a,b])=>`<article><h3>${esc(t(a))}</h3><p>${esc(t(b))}</p></article>`).join('')+`<article><h3>${say('Benchmark source profiles','Zdrojové profily srovnání')}</h3><p>${sourceLinks(['wofiCZE','wofiUSA','wofiFRA','wofiUKR','pensionSize'])}</p><p>${say('Editorial review','Redakční kontrola')}: ${reviewed}</p></article>`;
}
function stop(){timers.forEach(clearTimeout);timers=[];$('#fund-follow').disabled=false;$('#fund-school-map').classList.remove('fund-following');$('#fund-school-map').querySelectorAll('.fund-packet').forEach(p=>p.setAttribute('opacity','0'));}
function render(){
  stop();maps.length=0;
  root.querySelectorAll('[data-fund-copy]').forEach(el=>{el.textContent=t(copy[el.dataset.fundCopy]);});
  document.title=t(copy.title)+' — Public Spending Data';document.querySelector('meta[name="description"]').content=t(copy.intro);
  const country=countries.find(c=>c.code===code);
  $('#fund-country').innerHTML=countries.map(c=>`<option value="${c.code}" ${c.code===code?'selected':''}>${esc(t(c.name))}</option>`).join('');
  $('#fund-code').textContent=code;$('#fund-name').textContent=t(country.name);
  $('#fund-status').textContent=t(country.name)+' · '+(code==='RUS'?say('Partial verification; comparable percentages missing.','Částečné ověření; srovnatelná procenta chybějí.'):code==='UKR'?say('Wartime routes simplified; comparison data are pre-invasion.','Válečné cesty zjednodušeny; srovnání používá předválečná data.'):say('Reported programme amounts; scope and year are shown on every diagram.','Vykázané částky programů; rozsah a rok jsou uvedeny u každého schématu.'));
  $('#fund-school-caption').textContent=t(country.headline);
  renderMap($('#fund-budget-map'),country.routes.funding);
  renderMap($('#fund-school-map'),country.routes.schools,{school:true});
  renderMap($('#fund-health-map'),country.routes.health);
  renderMap($('#fund-pension-map'),socialRoutes[code].pensions);
  renderMap($('#fund-social-map'),socialRoutes[code].social);
  renderVat();renderBenchmarks();renderMethod();renderLedgers(code,lang);
  root.querySelectorAll('[data-route-summary]').forEach(el=>el.textContent=say('Explore all institutional routes + intermediaries','Prozkoumat všechny institucionální cesty + mezičlánky'));
  root.querySelectorAll('[data-related]').forEach(a=>{const url=new URL(a.dataset.related,location.origin);url.searchParams.set('lang',lang);if(url.pathname.startsWith('/deep-dives/'))url.searchParams.set('code',code);a.href=url.href;});
}
function updateUrl(push){const url=new URL(location.href);url.searchParams.set('code',code);url.searchParams.delete('country');url.searchParams.set('lang',lang);history[push?'pushState':'replaceState'](null,'',url);}
$('#fund-country').addEventListener('change',e=>{code=e.target.value;updateUrl(true);render();});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-lang]');
  if(button&&['cs','en'].includes(button.dataset.lang))window.PSDLanguage?.set(button.dataset.lang,{persist:true});
});
$('#fund-follow').addEventListener('click',()=>{
  stop();if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  $('#fund-follow').disabled=true;$('#fund-school-map').classList.add('fund-following');
  const packets=[...$('#fund-school-map').querySelectorAll('.fund-packet')];
  packets.forEach(packet=>{const delay=Number(packet.dataset.step)*800;timers.push(setTimeout(()=>{packet.setAttribute('opacity','1');packet.querySelector('animateMotion').beginElement();},delay));timers.push(setTimeout(()=>packet.setAttribute('opacity','0'),delay+800));});
  timers.push(setTimeout(stop,Math.max(2700,...packets.map(p=>(Number(p.dataset.step)+1)*800+100))));
});
addEventListener('psdlanguagechange',()=>{lang=document.documentElement.lang==='en'?'en':'cs';updateUrl(false);render();});
addEventListener('popstate',()=>{code=countryCode(location.search);const requested=new URLSearchParams(location.search).get('lang');if(['cs','en'].includes(requested)&&requested!==lang&&window.PSDLanguage){window.PSDLanguage.set(requested,{persist:false});}else render();});
root.querySelectorAll('.fund-more-routes,.fund-route-details').forEach(el=>el.addEventListener('toggle',()=>maps.forEach(draw=>draw())));
let lastWidth=0,resizeFrame;
new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)<2)return;lastWidth=width;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{stop();maps.forEach(draw=>draw());renderVat();renderBenchmarks();});}).observe($('#funding-content'));
render();
