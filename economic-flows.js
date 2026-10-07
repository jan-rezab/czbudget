import {createEconomicOverview} from '/economic-atlas-overview.js?v=d1b95de4d7107c48d23c862449e94f91e8eb2a7c780f8ea8bb0b95e8c7cae878';
import {METRICS, TRANSACTIONS, BALANCE_VIEWS, balanceBridge, validateRelease, observation, borderModel, sectorModel, availableYears, preferredYear, ledgerRows, bopReconciliation, annualLedgerRows, serializeLedgerCSV} from '/lib/economic-flow-model.mjs?v=229b6094272a86ed77eed36d4fce09eec2e24055ab9bf8454374c83a43c5a62b';

// This adapter owns accounting labels and observations. PSDPlot owns geometry.
window.PSDEconomicAtlasReady = (async () => {
  const root = document.querySelector('#economic-atlas');
  if (!root) return false;
  const $ = id => document.getElementById(id);
  const lang = () => document.documentElement.lang === 'cs' ? 'cs' : 'en';
  const tr = (en, cs) => lang() === 'cs' ? cs : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label = item => item[lang()];
  const billion = value => Number.isFinite(value) ? new Intl.NumberFormat(lang(), {maximumFractionDigits: 1}).format(value / 1000) : '—';
  const exact = value => Number.isFinite(value) ? new Intl.NumberFormat(lang(), {maximumFractionDigits: 10}).format(value) : '—';
  const calculated = value => Number.isFinite(value) ? new Intl.NumberFormat(lang(), {maximumFractionDigits: 6}).format(value) : '—';
  const unit = () => tr('CZK bn', 'mld. Kč');
  const groups = {all:['All measures','Všechny ukazatele'],production:['Production & expenditure','Produkce a výdaje'],external:['Rest of the world','Zahraničí'],income:['Income & saving','Důchody a úspory'],government:['Government','Vláda'],finance:['Financial accounts','Finanční účty'],money:['Money stocks','Peněžní zásoba'],payments:['Payment activity','Platební provoz']};
  const bases = {accrual:['Annual · accrual','Roční · akruální'],net_financial:['Annual · net flow','Roční · čistý tok'],stock:['Year-end stock','Stav ke konci roku'],payment:['Annual · payments','Roční · platby'],settlement:['Annual · settlement','Roční · vypořádání']};
  const basis = key => tr(...(bases[key] || bases.accrual));
  const originals = new Map([...document.querySelectorAll('[data-copy]')].map(el => [el.dataset.copy,el.textContent]));
  const cs = {
    viewCircuit:'Ekonomické vztahy',viewCircuitText:'Sektory a vzájemné vazby',viewAnnual:'Roční toky',viewAnnualText:'Vykázané částky a jejich měřítko',viewBalance:'Stavy a změny',viewBalanceText:'Od počátečního ke konečnému stavu',balanceTitle:'Co změnilo rozvahu?',balanceIntro:'Propojte dva koncové stavy s transakcemi během roku. Výdaje, finanční transakce a změny hodnoty majetku měří různé věci.',balanceSelect:'Finanční rozvaha',balanceCoverage:'Celá ekonomika S1 · nekonsolidované účty · včetně pohledávek mezi rezidentskými sektory · miliardy Kč',balanceCaption:'Sloupce stavů začínají na nule. Plovoucí sloupce ukazují změny; přerušované čáry propojují navazující úrovně. Výpočet z údajů Eurostatu, nikoli součet plateb.',detailCoverageTitle:'Kam až lze jít do detailu?',countryDetailTitle:'Zahraniční protistrany',countryDetailText:'Tento atlas rozlišuje druh toku a finanční nástroj. Úplné rozdělení podle partnerských zemí zde zatím není publikováno.',industryDetailTitle:'Odvětví a dodavatelské řetězce',industryDetailText:'Tabulky FIGARO propojují země a odvětví. Měří produkční vazby a přidanou hodnotu, nikoli jednotlivé peněžní platby.',figaroLink:'Prozkoumat tabulky FIGARO ↗',researchTitle:'Východiska vizualizace',researchText:'Ekonomické vztahy, vykázané toky a rozvahy mají samostatná měřítka. Uspořádání navazuje na sektorové účty ONS a propojení stavů a toků Statistics Canada.',currencyNote:'Částky jsou vyjádřeny v Kč. Jde o společnou vykazovací jednotku, nikoli rozdělení plateb vypořádaných v korunách, eurech či dolarech. Původní jednotky a případný přepočet jsou uvedeny u každého pozorování.',skip:'Přejít k ekonomickým tokům',sourcesAccounts:'ČSÚ · národní a sektorové účty ↗',sourcesCNB:'ČNB · platební bilance ↗',sourcesEuro:'Eurostat · harmonizované české účty ↗',crossFinanceTitle:'Zahraniční financování a aktiva v zahraničí',crossFinanceIntro:'Zahraniční investoři pořizují česká aktiva; čeští rezidenti pořizují aktiva v zahraničí. Tyto položky finančního účtu měří čisté transakce v jednotlivých nástrojích, nikoli hrubé hotovostní platby.',investmentCaption:'Vlevo závazky vůči nerezidentům; vpravo aktiva v zahraničí. Záporné hodnoty znamenají čistý úbytek. Diagram nepropojuje konkrétní investice.',eyebrow:'EKONOMICKÝ ATLAS',country:'Česko',title:'Roční peněžní toky Česka',titleEm:'Celá ekonomika v souvislostech.',intro:'Roční příjmy, výdaje, produkce a financování se zdroji a účetním základem u každého údaje.',year:'Účetní rok',prices:'Roční údaje · běžné ceny · české koruny',borderNav:'Přes hranice',domesticNav:'Uvnitř ekonomiky',financeNav:'Finance a peníze',evidenceNav:'Všechny ukazatele',borderKicker:'02 / HRANICE ZEMĚ',borderTitle:'Peněžní toky přes české hranice',borderIntro:'Zboží a služby jsou jen začátek. Hranice překračují také mzdy, investiční důchody a transfery. To jsou čtyři části běžného účtu.',flowUnit:'Miliardy Kč za rok',pause:'Pozastavit pohyb',flowCaption:'Šířka každého kladného pásu odpovídá vykázané částce ve společném měřítku. Příjmy a výdaje jsou nezávislé; nespojujeme konkrétní platby. Nula nemá pás, chybějící či záporná částka nemá poměrný pás. Na mobilu lze diagram posouvat do stran. Vyberte popisek pro přesný zdroj.',externalMore:'Za běžným účtem: kapitál, investice a rezervy',domesticKicker:'03 / DOMÁCÍ OBĚH',domesticTitle:'Výdaje a příjmy jednotlivých sektorů',domesticIntro:'Mzda je výdajem zaměstnavatele a příjmem domácnosti. Vyberte transakci a zobrazte účtované výdaje a příjmy jednotlivých sektorů včetně zahraničí.',productionTitle:'Podnikové vstupy a přidaná hodnota',productionIntro:'Podniky nakupují vstupy od jiných podniků. HDP odstraňuje toto opakované započítání produkce; nesčítá všechny platby.',gdpCaption:'Výdajové složky HDP · miliardy Kč · dovoz odečítá zahraniční produkci.',financeKicker:'04 / PENÍZE, FINANCE A PLATBY',financeTitle:'Peněžní zásoba, financování a platby',financeIntro:'Peněžní zásoba, finanční transakce a platební obrat odpovídají na různé otázky. Jejich součty se překrývají a musí zůstat oddělené.',stockLabel:'KE KONCI ROKU',moneyTitle:'Peněžní zásoba',moneyIntro:'M1 je součástí M2 a M2 je součástí M3. Jde o postupně širší definice držených peněz.',netLabel:'BĚHEM ROKU · ČISTÉ TOKY',fundingTitle:'Financování ekonomiky',fundingIntro:'Pořízení finančních aktiv a vznik závazků se účtují odděleně. Čisté toky neukazují každé čerpání a splátku.',paymentLabel:'BĚHEM ROKU · HRUBÉ TOKY',paymentsTitle:'Platební systém',paymentsIntro:'Úhrady a karty zahrnují i podnikové platby. Obrat vypořádání se překrývá s klientskými platbami; výběry hotovosti neměří hotovostní nákupy.',evidenceKicker:'06 / OTEVŘETE ÚČTY',evidenceTitle:'Ukazatele a zdroje',evidenceIntro:'Úplný seznam zahrnuje i chybějící pozorování. Otevřete ukazatel pro přesnou hodnotu zdroje, jednotku, období a definici.',metricGroup:'Skupina ukazatelů',download:'Stáhnout roční přehled ↓',methodTitle:'Účetní metodika',methodCopy:'Národní účty a platební bilance používají akruální účetnictví. Finanční toky jsou zpravidla čisté; platební statistiky hrubé; stavy se vztahují k určitému datu. Chybějící hodnoty zůstávají chybějící. Žádné odhadnuté dvoustranné platby, žádný umělý vyrovnávací tok a žádný součet napříč těmito vrstvami.',sourcesTitle:'Primární zdroje',footer:'Český ekonomický atlas · Hodnoty zdrojů zachovány'
  };
  const q = new URLSearchParams(location.search);
  let data = null, loadFailed = false;
  let transaction = TRANSACTIONS.some(t => t.id === q.get('transaction')) ? q.get('transaction') : 'D1';
  let group = Object.hasOwn(groups,q.get('group')) ? q.get('group') : 'all';
  let balance = BALANCE_VIEWS.some(v=>v.id===q.get('balance'))?q.get('balance'):'assets';
  let selected = null, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const controllers = new Map();
  const plot = await window.PSDPlotReady;
  try {
    const response = await fetch('/api/v1/economy/czech-flows', {signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('Economic release unavailable');
    data = validateRelease(await response.json());
  } catch { loadFailed = true; }
  const years = availableYears(data);
  let year = years.includes(Number(q.get('year'))) ? Number(q.get('year')) : preferredYear(data);
  const get = id => observation(data,id,year);
  const definition = id => METRICS.find(m => m.id === id);
  const missing = () => tr('Not available in this release','V této verzi není dostupné');
  const columns = () => [
    {key:'label',label:tr('Measure / sector','Ukazatel / sektor')}, {key:'direction',label:tr('Direction','Směr')},
    {key:'year',label:tr('Year','Rok')}, {key:'value',label:tr('Normalised · CZK million','Přepočet · mil. Kč')},
    {key:'source_value',label:tr('Exact source value','Přesná hodnota zdroje')}, {key:'source_unit',label:tr('Source unit','Jednotka zdroje')},
    {key:'basis',label:tr('Basis','Účetní základ')}, {key:'source_url',label:tr('Source','Zdroj')}, {key:'calculation',label:tr('Calculation / inputs','Výpočet / vstupy')}
  ];
  function tableRow(name,row,direction='') {return {label:name,direction,year:year??'',value:row?.value??null,source_value:row?.source_value??'',source_unit:row?.source_unit??row?.unit??'',basis:row?.basis??'accrual',source_url:row?.source_url??row?.inputs?.map(r=>r.source_url).join(' | ')??'',calculation:row?.calculation??''};}
  function detail(row) {
    if (!row || row.value === null) return `<p>${esc(row?.missing_reason || missing())}</p>`;
    if(row.calculation)return `<p>${esc(tr('Calculated remainder: services imports minus residents’ travel abroad. The two branches replace total services imports; they are not added to it.','Vypočtený zbytek: dovoz služeb minus cesty rezidentů do zahraničí. Obě větve nahrazují celkový dovoz služeb; nepřičítají se k němu.'))}</p><p>${esc(row.calculation)}</p>${row.inputs.map(input=>`<details><summary>${esc(label(definition(input.id)))}</summary>${detail(input)}</details>`).join('')}`;
    const fields = [
      [tr('Period / geography','Období / území'),`${row.reference_date || row.year} · ${row.geography || 'Czechia (CZE)'}`],
      [tr('Source observation','Pozorování zdroje'),`${row.source_value} ${row.source_unit || row.unit}`],
      [tr('Normalised value','Přepočtená hodnota'),`${exact(row.value)} ${tr('CZK million','mil. Kč')}`],
      [tr('Accounting basis','Účetní základ'),basis(row.basis)],
      [tr('Coverage / definition','Rozsah / definice'),row.coverage || row.definition || tr('See the source series definition.','Viz definice zdrojové řady.')],
      [tr('Series / dataset','Řada / datová sada'),`${row.source_code} · ${row.source_dataset}`],
      [tr('Source flags','Příznaky zdroje'),row.status || tr('None reported','Neuvedeny')],
      ...(row.normalization ? [[tr('Conversion','Přepočet'),row.normalization]] : [])
    ];
    return `<dl>${fields.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl><a href="${esc(row.source_url)}" target="_blank" rel="noopener">${esc(tr('Open exact source ↗','Otevřít přesný zdroj ↗'))}</a>`;
  }
  function chart(figureId,hostId,spec,rows) {
    const figure=$(figureId),host=$(hostId);
    controllers.get(hostId)?.destroy?.();
    figure.querySelectorAll(':scope > .psd-chart-rail,:scope > .psd-chart-panel,:scope > .psd-chart-drawer').forEach(el=>el.remove());
    const controller=plot.render(host,{locale:lang(),playing,tableColumns:columns(),rows,...spec});
    controllers.set(hostId,controller);
    for(const side of ['source','recipient']){const lane=host.querySelector(`[data-flow-lane="${side}"]`);if(lane)lane.dataset.laneTitle=spec.labels?.[side]||'';}
    window.PSDChart.register({el:figure,slug:hostId,title:spec.title,accessor:controller.accessor,exports:['csv'],embeddable:false,
      source:{name:tr('Czech economic accounts · sources attached to each row','České ekonomické účty · zdroje u každého řádku'),url:location.origin+'/deep-dives/economic-flows/#evidence',table:tr('See the source column in the data table.','Viz sloupec zdroj v datové tabulce.'),extracted:data?.acquired_at || '',edition:data?.release_id || missing(),definition:spec.sourceDefinition||tr('Annual values in CZK million; visual labels in CZK billion.','Roční hodnoty v mil. Kč; popisky v mld. Kč.'),caveat:tr('Accrual accounts are not bank payments. Missing observations are not zero.','Akruální účty nejsou bankovní platby. Chybějící pozorování nejsou nuly.'),vintage:'outturn',...(spec.source||{})}});
  }
  const overview=createEconomicOverview({data,year:()=>year,chart,detail,onMetric:id=>{group='all';renderLedger();$('atlas-filter').value='all';const row=$('atlas-ledger').querySelector(`[data-metric="${id}"]`);if(row){row.open=true;row.scrollIntoView({behavior:'smooth',block:'center'});}persist();}});
  function persist() {
    const url=new URL(location.href);
    for(const [key,value] of Object.entries({lang:lang(),year,transaction,group,balance}))value===null?url.searchParams.delete(key):url.searchParams.set(key,value);
    history.replaceState(null,'',url);
  }
  function mini(ids) {return ids.map(id=>`<div class="atlas-mini-row"><span>${esc(label(definition(id)))}<small>${esc(basis(definition(id).basis))}</small></span><strong>${billion(get(id)?.value)} <small>${unit()}</small></strong></div>`).join('');}
  function inspect(id) {
    const model=borderModel(data,year),item=[...model.incoming,...model.outgoing].find(row=>row.id===id);
    selected=item?id:null;
    $('atlas-inspector').innerHTML=item?`<strong>${esc(label(item))}</strong>${detail(item.observation)}`:'';
    $('atlas-border-flow').querySelectorAll('[data-flow-key]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.flowKey===id)));
  }
  function renderBorder() {
    const model=borderModel(data,year);
    const node=(row,side)=>({id:row.id,nodeId:side+'-'+row.id,label:label(row),amount:row.observation?.value==null?null:row.observation.value/1000,unit:unit(),meta:row.id==='imports_travel'?tr('Personal & business trips · services','Soukromé a služební cesty · služby'):row.observation?.calculation?tr('Services less travel · calculated','Služby bez cest · výpočet'):tr('Current account · accrued','Běžný účet · akruální'),selected:selected===row.id});
    const sources=model.incoming.map(r=>node(r,'in')),recipients=model.outgoing.map(r=>node(r,'out'));
    chart('atlas-border-figure','atlas-border-flow',{type:'funding-flow',proportional:true,title:tr('Across the Czech border','Přes české hranice'),sources,recipients,routeNodes:[{nodeId:'czechia',id:'czechia',label:tr('Czechia','Česko'),meta:tr('Resident economy\nHouseholds · businesses · government · finance','Rezidentská ekonomika\nDomácnosti · podniky · vláda · finance')}],
      edges:[...sources.map(n=>({from:n.nodeId,to:'czechia',kind:'contribution'})),...recipients.map(n=>({from:'czechia',to:n.nodeId,kind:'transfer'}))],labels:{source:tr('Receipts from abroad','Příjmy ze zahraničí'),route:tr('Country boundary','Hranice země'),recipient:tr('Payments to abroad','Výdaje do zahraničí'),share:''},onSelect:(_kind,id)=>inspect(id),onClear:()=>{selected=null;$('atlas-inspector').replaceChildren();}},
      [...model.incoming.map(r=>tableRow(label(r),r.observation,'credit')),...model.outgoing.map(r=>tableRow(label(r),r.observation,'debit'))]);
    const stats=[[tr('Current-account receipts','Příjmy běžného účtu'),model.totalIn],[tr('Current-account payments','Výdaje běžného účtu'),model.totalOut],[tr('Reported current-account balance','Vykázané saldo běžného účtu'),model.reported]];
    let note=tr('Receipts less payments = current-account balance. It is not the change in the money supply. Totals above are calculated only when all four components are present.','Příjmy minus výdaje = saldo běžného účtu. Nejde o změnu peněžní zásoby. Součty výše počítáme pouze při dostupnosti všech čtyř složek.');
    note+=' '+(model.travelSplit?tr('Services imports are split into residents’ travel abroad and other services. Travel includes personal and business visits: accommodation, meals, local transport and shopping. International passenger fares remain in other services. Residence, not citizenship, defines this measure.','Dovoz služeb je rozdělen na cesty rezidentů do zahraničí a ostatní služby. Cesty zahrnují soukromé i služební pobyty: ubytování, stravování, místní dopravu a nákupy. Mezinárodní jízdné zůstává v ostatních službách. Rozhoduje rezidentství, nikoli občanství.'):tr('A verified travel breakdown is not available for this year; services imports remain combined.','Pro tento rok není dostupné ověřené členění cest; dovoz služeb zůstává sloučený.'));
    if(model.computed!==null&&model.reported!==null)note+=' '+tr('Calculated balance: ','Vypočtené saldo: ')+billion(model.computed)+' '+unit()+tr('; difference from reported: ','; rozdíl proti vykázanému: ')+calculated(model.computed-model.reported)+' '+tr('CZK million.','mil. Kč.');
    $('atlas-current-account').innerHTML=stats.map(([name,value])=>`<div><small>${esc(name)}</small><strong>${billion(value)}</strong><small>${unit()}</small></div>`).join('')+`<p>${esc(note)}</p>`;
    $('atlas-external-finance').innerHTML=`<p>${esc(tr('Financial-account values follow BPM6: net acquisition of assets less net incurrence of liabilities. Positive balances mean net lending abroad. Financial transactions are separate from the current account; a negative net figure is not a gross inflow. Reserve transactions exclude valuation changes.','Finanční účet používá BPM6: čisté pořízení aktiv minus čistý vznik závazků. Kladné saldo znamená čisté půjčky do zahraničí. Finanční transakce jsou oddělené od běžného účtu; záporná čistá hodnota není hrubým přílivem. Transakce s rezervami nezahrnují přecenění.'))}</p>`+mini(['capital_received','capital_paid','capital_account','financial_account','direct_investment','portfolio_investment','financial_derivatives','other_investment','reserve_assets','errors_omissions','external_assets','external_liabilities','net_external_position']);
    if(selected)inspect(selected);
  }
  function renderInvestment() {
    const reconciliation=bopReconciliation(data,year);
    $('atlas-bop-identity').innerHTML=`<strong>${esc(tr('The balance-of-payments identity','Rovnice platební bilance'))}</strong><p>${esc(tr('Current account + capital account + net errors and omissions = financial account.','Běžný účet + kapitálový účet + čisté chyby a opomenutí = finanční účet.'))}</p><p>${reconciliation.values.map(billion).join(' · ')} ${unit()} · ${esc(tr('Reconciliation difference: ','Rozdíl při ověření: '))}${calculated(reconciliation.gap)} ${esc(tr('CZK million','mil. Kč'))}</p>`;
    const incoming=['direct_liabilities','portfolio_liabilities','derivative_liabilities','other_liabilities'];
    const outgoing=['direct_assets','portfolio_assets','derivative_assets','other_assets','reserve_assets'];
    const shortNames={direct:['Direct investment','Přímé investice'],portfolio:['Portfolio investment','Portfoliové investice'],derivative:['Derivatives','Deriváty'],other:['Other investment','Ostatní investice'],reserve:['Reserve assets','Rezervní aktiva']};
    const node=id=>({id,nodeId:'financial-'+id,label:tr(...shortNames[id.split('_')[0]]),amount:get(id)?.value==null?null:get(id).value/1000,unit:unit(),meta:tr('Net transactions · signed','Čisté transakce · se znaménkem')});
    const sources=incoming.map(node),recipients=outgoing.map(node);
    chart('atlas-investment-figure','atlas-investment-flow',{type:'funding-flow',title:tr('Cross-border financing','Přeshraniční financování'),sources,recipients,routeNodes:[{nodeId:'financial-account',id:'financial-account',label:tr('Financing','Financování'),meta:tr('Assets − liabilities = financial-account balance','Aktiva − pasiva = saldo finančního účtu')}],edges:[...sources.map(n=>({from:n.nodeId,to:'financial-account',kind:'contribution'})),...recipients.map(n=>({from:'financial-account',to:n.nodeId,kind:'transfer'}))],labels:{source:tr('Net liability transactions','Čisté transakce s pasivy'),route:tr('Czech resident economy','Česká rezidentská ekonomika'),recipient:tr('Net asset transactions','Čisté transakce s aktivy'),share:''},onSelect:(_kind,id)=>{$('atlas-investment-flow').querySelector('.psd-funding-inspection').innerHTML=`<strong>${esc(label(definition(id)))}</strong>${detail(get(id))}`;}},[...incoming.map(id=>tableRow(label(definition(id)),get(id),'net liabilities')),...outgoing.map(id=>tableRow(label(definition(id)),get(id),'net assets'))]);
  }
  function renderDomestic() {
    $('atlas-transactions').innerHTML=TRANSACTIONS.map(t=>`<button type="button" data-transaction="${t.id}" aria-pressed="${t.id===transaction}">${esc(label(t))}</button>`).join('');
    const model=sectorModel(data,year,transaction),title=label(TRANSACTIONS.find(t=>t.id===transaction));
    const node=(row,direction)=>({id:row.id,nodeId:direction+'-'+row.id,label:label(row),amount:row.observation?.value==null?null:row.observation.value/1000,unit:unit(),meta:tr(direction==='uses'?'Recorded use':'Recorded resource',direction==='uses'?'Účtované užití':'Účtovaný zdroj')});
    const sources=model.uses.map(r=>node(r,'uses')),recipients=model.resources.map(r=>node(r,'resources'));
    chart('atlas-domestic-figure','atlas-domestic-flow',{type:'funding-flow',proportional:true,title,sources,recipients,routeNodes:[{nodeId:'transaction',id:'transaction',label:transaction,meta:title}],edges:[...sources.map(n=>({from:n.nodeId,to:'transaction',kind:'contribution'})),...recipients.map(n=>({from:'transaction',to:n.nodeId,kind:'transfer'}))],labels:{source:tr('Uses · payer sectors','Užití · platící sektory'),route:tr('Transaction account','Účet transakce'),recipient:tr('Resources · receiving sectors','Zdroje · přijímající sektory'),share:''},onSelect:(kind,id)=>{
      const row=(kind==='source'?model.uses:model.resources).find(r=>r.id===id);
      const host=$('atlas-domestic-flow').querySelector('.psd-funding-inspection');
      host.innerHTML=`<strong>${esc(label(row))} · ${esc(title)}</strong>${detail(row.observation)}`;
    }},[...model.uses.map(r=>tableRow(label(r),r.observation,'uses')),...model.resources.map(r=>tableRow(label(r),r.observation,'resources'))]);
    $('atlas-domestic-caption').textContent=tr('Band widths share one scale and show each sector’s reported total. Sector accounts do not identify which sector paid each recipient. The centre pools one transaction; arrows do not imply bilateral amounts. Uses and resources include the rest of the world. Accrued or imputed entries need not be cash payments.','Šířky pásů mají společné měřítko a ukazují vykázaný součet každého sektoru. Účty neurčují, který sektor zaplatil konkrétnímu příjemci. Střed spojuje jednu transakci; šipky nevyjadřují dvoustranné částky. Užití a zdroje zahrnují zahraničí. Akruální nebo imputované položky nemusí představovat hotovostní platby.')+(model.difference===null?'':tr(' Recorded uses less resources: ',' Vykázaná užití minus zdroje: ')+exact(model.difference)+' '+tr('CZK million.','mil. Kč.'));
  }
  function renderProduction() {
    $('atlas-production-equation').innerHTML=['output','intermediate','gva'].map(id=>`<div><small>${esc(label(definition(id)))}</small><strong>${billion(get(id)?.value)}</strong><small>${unit()}</small></div>`).join('');
    const ids=['household_consumption','government_consumption','investment','exports','imports'];
    const rows=ids.map(id=>({...tableRow(label(definition(id)),get(id)),plot:get(id)?.value==null?null:get(id).value/1000*(id==='imports'?-1:1)}));
    chart('atlas-gdp-figure','atlas-gdp-chart',{type:'bar',title:tr('GDP = consumption + government + investment + exports − imports','HDP = spotřeba + vláda + investice + vývoz − dovoz'),unit:unit(),height:320,fields:[{key:'plot',label:unit(),color:'#61763a',format:value=>value==null?'—':new Intl.NumberFormat(lang(),{maximumFractionDigits:1}).format(value)}],valueLabels:true},rows);
  }
  function renderBalance() {
    const model=balanceBridge(data,year,balance),names=[tr('Opening balance','Počáteční stav'),tr('Transactions','Transakce'),tr('Other changes','Ostatní změny'),tr('Closing balance','Konečný stav')];
    $('atlas-balance-select').innerHTML=BALANCE_VIEWS.map(v=>`<option value="${v.id}"${v.id===balance?' selected':''}>${esc(label(v))}</option>`).join('');
    const values=[model.opening?.value??null,model.transactions?.value??null,model.residual,model.closing?.value??null];
    const rows=values.map((value,i)=>({...tableRow(names[i],[model.opening,model.transactions,null,model.closing][i]),year:i===0?(year?year-1:''):year??'',value,source_value:i===2?'':([model.opening,model.transactions,null,model.closing][i]?.source_value??''),basis:i===2?'calculated residual':i===0||i===3?'stock':'net_financial',source_url:i===2?'':([model.opening,model.transactions,null,model.closing][i]?.source_url??''),plot:model.complete?value/1000:null,start:model.complete?(i===1?values[0]/1000:i===2?(values[0]+values[1])/1000:0):null,step:i}));
    $('atlas-balance-equation').innerHTML=rows.map((row,i)=>`<div class="${i===2?'is-derived':''}"><small>${esc(names[i])}</small><strong>${billion(row.value)}</strong><span>${esc(i===0?`${year?year-1:'—'} · ${tr('year end','konec roku')}`:i===3?`${year??'—'} · ${tr('year end','konec roku')}`:i===2?tr('Calculated residual','Vypočtené reziduum'):tr('Published annual net flow','Vykázaný roční čistý tok'))}</span></div>`).join('');
    $('atlas-balance-status').textContent=model.complete?tr('Opening + net transactions + other changes = closing. The residual is calculated as closing − opening − transactions; it includes revaluations, other volume changes and any statistical differences. It is not a payment flow.','Počáteční stav + čisté transakce + ostatní změny = konečný stav. Reziduum je vypočteno jako konečný stav − počáteční stav − transakce; zahrnuje přecenění, ostatní změny objemu a případné statistické rozdíly. Nejde o platební tok.'):tr('This bridge needs the previous year’s closing balance and both current-year observations. Missing inputs leave the bridge incomplete.','Tento přehled vyžaduje konečný stav předchozího roku a obě pozorování běžného roku. Chybějící vstupy zůstávají chybějící.');
    const show=i=>{$('atlas-balance-detail').innerHTML=i===2?`<h3>${esc(tr('Other changes · calculated','Ostatní změny · výpočet'))}</h3><p>${esc(tr('Inputs in CZK million:','Vstupy v mil. Kč:'))} ${exact(values[3])} − (${exact(values[0])}) − (${exact(values[1])}) = ${exact(model.residual)}.</p><p>${esc(tr('Select the opening balance, transactions or closing balance for each exact source observation.','Vyberte počáteční stav, transakce nebo konečný stav a zobrazte přesné pozorování zdroje.'))}</p>`:`<h3>${esc(names[i])}</h3>${detail([model.opening,model.transactions,null,model.closing][i])}`;};
    chart('atlas-balance-figure','atlas-balance-chart',{type:'column',title:label(model.view),baseKey:'start',unit:unit(),height:330,fields:[{key:'plot',label:tr('Amount','Částka'),color:'#819644',format:v=>v==null?'—':new Intl.NumberFormat(lang(),{maximumFractionDigits:1}).format(v)+' '+unit()}],rowColor:row=>row.step===2?'#ae8fbd':row.step===1?'#a2b955':'#334b3a',emptyLabel:tr('A complete bridge is not available for this year','Úplný přehled pro tento rok není dostupný'),onSelect:row=>show(row.step),sourceDefinition:tr('Czech total economy S1, non-consolidated financial accounts. Includes claims between resident sectors. Other changes are calculated from the three cited observations.','Celá česká ekonomika S1, nekonsolidované finanční účty. Včetně pohledávek mezi rezidentskými sektory. Ostatní změny jsou výpočtem ze tří citovaných pozorování.')},rows);
    show(3);
  }
  function renderLedger() {
    const all=ledgerRows(data,year),rows=all.filter(m=>group==='all'||m.group===group),count=all.filter(m=>Number.isFinite(m.observation?.value)).length;
    $('atlas-coverage').textContent=tr(`${count} / ${all.length} measures available · ${year??'—'}`,`${count} / ${all.length} dostupných ukazatelů · ${year??'—'}`);
    $('atlas-ledger').innerHTML=rows.map(m=>`<details class="atlas-ledger-row${Number.isFinite(m.observation?.value)?'':' is-missing'}" data-metric="${m.id}"><summary><span>${esc(label(m))}</span><span class="atlas-ledger-value">${billion(m.observation?.value)} <small>${unit()}</small></span><span class="atlas-ledger-basis">${esc(basis(m.basis))}</span></summary><div class="atlas-ledger-detail">${detail(m.observation)}</div></details>`).join('');
  }
  function render() {
    document.querySelectorAll('[data-copy]').forEach(el=>{el.textContent=lang()==='cs'?(cs[el.dataset.copy]||originals.get(el.dataset.copy)):originals.get(el.dataset.copy);});
    document.querySelector('.atlas-nav').setAttribute('aria-label',tr('Atlas sections','Oddíly atlasu'));
    $('atlas-transactions').setAttribute('aria-label',tr('Transaction type','Druh transakce'));
    document.title=tr('Czech annual money flows — Public Spending Data','Roční peněžní toky Česka — Public Spending Data');
    $('atlas-status').textContent=loadFailed?tr('No verified annual release is available yet. This view shows the accounting structure; dashes mean missing observations, never zero.','Ověřená roční datová verze zatím není dostupná. Zobrazení ukazuje účetní strukturu; pomlčky znamenají chybějící pozorování, nikdy nulu.'):data?.synthetic?tr('TEST FIXTURE · invented numbers for interface verification. Not Czech economic observations.','TESTOVACÍ DATA · smyšlená čísla pro ověření rozhraní. Nejde o údaje české ekonomiky.'):tr(`Verified release · ${year} · ${data.release_id}`,`Ověřená verze · ${year} · ${data.release_id}`);
    $('atlas-year').innerHTML=years.length?years.map(y=>`<option value="${y}"${y===year?' selected':''}>${y}</option>`).join(''):'<option>—</option>';
    $('atlas-year').disabled=!years.length;
    const border=borderModel(data,year);
    const headlines=[{name:tr('Receipts from abroad','Příjmy ze zahraničí'),value:border.totalIn,note:tr('Current account · calculated sum','Běžný účet · vypočtený součet')},{name:tr('Payments abroad','Výdaje do zahraničí'),value:border.totalOut,note:tr('Current account · calculated sum','Běžný účet · vypočtený součet')},...['gdp','m3'].map(id=>({name:label(definition(id)),value:get(id)?.value,note:basis(definition(id).basis)}))];
    $('atlas-headlines').innerHTML=headlines.map(h=>`<div><small>${esc(h.name)}</small><strong>${billion(h.value)}</strong><span class="atlas-headline-basis">${unit()} · ${esc(h.note)}</span></div>`).join('');
    renderBorder();renderInvestment();renderDomestic();renderProduction();renderBalance();overview.render();
    $('atlas-money').innerHTML=['m3','m2','m1'].map(id=>`<div><small>${esc(label(definition(id)))}</small><strong>${billion(get(id)?.value)} <small>${unit()}</small></strong></div>`).join('');
    $('atlas-financing').innerHTML=mini(['asset_transactions','liability_transactions','net_lending']);
    $('atlas-payments').innerHTML=mini(['credit_transfers','direct_debits','card_payments','emoney','cash_withdrawals','certis']);
    $('atlas-filter').innerHTML=Object.entries(groups).map(([key,names])=>`<option value="${key}"${key===group?' selected':''}>${esc(tr(...names))}</option>`).join('');
    $('atlas-release').textContent=data?`${tr('Release','Verze')}: ${data.release_id} · ${data.acquired_at||''}`:tr('No data release published.','Datová verze není publikována.');
    $('atlas-download').disabled=!data;renderLedger();motion();root.dataset.ready='true';
  }
  function motion(){controllers.forEach(c=>c.setPlaying?.(playing));$('atlas-motion').textContent=playing?tr('Pause motion','Pozastavit pohyb'):tr('Play motion','Spustit pohyb');$('atlas-motion').setAttribute('aria-pressed',String(!playing));}
  $('atlas-motion').addEventListener('click',()=>{playing=!playing;motion();});
  $('atlas-balance-select').addEventListener('change',e=>{balance=e.target.value;renderBalance();persist();});
  $('atlas-year').addEventListener('change',event=>{year=Number(event.target.value);render();persist();});
  $('atlas-filter').addEventListener('change',event=>{group=event.target.value;renderLedger();persist();});
  $('atlas-transactions').addEventListener('click',event=>{const button=event.target.closest('[data-transaction]');if(button){transaction=button.dataset.transaction;renderDomestic();persist();$('atlas-transactions').querySelector(`[data-transaction="${transaction}"]`).focus();}});
  $('atlas-download').addEventListener('click',()=>{
    const csv=serializeLedgerCSV(annualLedgerRows(data,year,lang()));
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`czech-economic-atlas-${year}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  window.addEventListener('psdlanguagechange',()=>{render();persist();});
  window.addEventListener('pagehide',()=>controllers.forEach(c=>c.destroy?.()),{once:true});
  render();persist();return true;
})().catch(error=>{
  console.error('Economic atlas unavailable',error);
  document.getElementById('atlas-status').textContent=document.documentElement.lang==='cs'?'Interaktivní atlas není dostupný. Zdroje jsou uvedeny níže.':'The interactive atlas is unavailable. Primary sources are listed below.';
  return false;
});
