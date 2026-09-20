import { CODES, selectedRows, amount, pair, partners, timeline, treemap } from './lib/rare-earth-model.mjs';

const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'en' || document.documentElement.lang === 'en' ? 'en' : 'cs';
const c = (cs, en) => lang === 'en' ? en : cs;
const copy = {
  pageTitle: c('Obchod se vzácnými zeminami', 'Rare earth trade'),
  eyebrow: c('OBCHOD / STRATEGICKÉ SUROVINY', 'TRADE / STRATEGIC MATERIALS'),
  title: c('Vzácné zeminy.', 'Rare earths.'), titleEm: c('Kdo prodává. Kdo nakupuje.', 'Who sells. Who buys.'),
  intro: c('Sledujte kovy a sloučeniny vzácných zemin přes hranice. Vývoz, dovoz a obchodní partneři v jednom pohledu.', 'Follow rare-earth metals and compounds across borders. Exports, imports and trading partners in one view.'),
  allTrade: c('← Veškerý zahraniční obchod', '← All foreign trade'), country: c('Země', 'Country'),
  balance: c('Bilance', 'Balance'), products: c('Produkty', 'Products'), routes: c('Směry obchodu', 'Trade routes'), trend: c('Vývoj', 'Trend'), method: c('Metodika', 'Method'),
  annual: c('Ročně', 'Annual'), monthly: c('Měsíčně', 'Monthly'), period: c('Období', 'Period'), product: c('Produkt', 'Product'), tonnes: c('Tuny', 'Tonnes'),
  pulseTitle: c('Obchodní bilance na první pohled', 'The trade balance at a glance'),
  pulseIntro: c('Vlastní hlášení vybrané země. Celkové hodnoty zahrnují pouze tři přesně vymezené skupiny zboží.', 'The selected country’s own reporting. Headline values cover three precisely defined product groups.'),
  loading: c('Načítám obchodní data…', 'Loading trade data…'), retry: c('Zkusit znovu', 'Try again'),
  error: c('Data se nepodařilo načíst. Zkuste to znovu.', 'Trade data could not be loaded. Please try again.'),
  noData: c('Pro tento výběr nejsou dostupná data. Chybějící údaj není nulový obchod.', 'No data are available for this selection. Missing data do not mean zero trade.'),
  noWeight: c('Hmotnost není úplná. Přepněte na USD pro dostupné obchodní hodnoty.', 'Weight coverage is incomplete. Switch to USD for available trade values.'),
  scopeKicker: c('PŘESNĚ VYMEZENÝ KOŠ', 'A DEFINED PRODUCT BASKET'), productsTitle: c('Tři skupiny. Dva směry.', 'Three groups. Two directions.'),
  productsIntro: c('Klikněte na skupinu pro její partnery a historii. Kovy a sloučeniny nejsou totéž co vytěžená ruda nebo hotové magnety.', 'Select a group to explore its partners and history. Metals and compounds are distinct from mined ores and finished magnets.'),
  routesKicker: c('OBCHODNÍ GEOGRAFIE', 'TRADE GEOGRAPHY'), routesTitle: c('Kam vývoz míří. Odkud dovoz přichází.', 'Where exports go. Where imports come from.'),
  routesIntro: c('Plocha odpovídá vybrané hodnotě. Klikněte na partnera pro přesná čísla. Mapy ukazují dostupné bilaterální toky, které se nemusí rovnat celkovému obchodu.', 'Area shows the selected measure. Select a partner for exact figures. Maps show available bilateral flows, which may not add up to total trade.'),
  exports: c('Vývoz', 'Exports'), imports: c('Dovoz', 'Imports'), destinations: c('Cílové trhy', 'Export destinations'), origins: c('Země původu', 'Import origins'),
  trendKicker: c('HISTORIE OBCHODU', 'TRADE OVER TIME'), trendTitle: c('Jak se obchod mění', 'How trade is changing'),
  trendIntro: c('Vývoz a dovoz ve stejné jednotce. Kliknutím na bod vyberete období. Mezery označují chybějící data.', 'Exports and imports in the same unit. Select a point to change the period. Gaps show missing data.'),
  methodTitle: c('Co tato čísla říkají', 'What these numbers tell us'),
  methodIntro: c('Obchod není těžba ani zpracovatelská kapacita. Tyto údaje popisují zboží překračující hranice, včetně případného zpětného vývozu.', 'Trade is distinct from mining output and refining capacity. These figures describe goods crossing borders, including possible re-exports.'),
  basketTitle: c('Kovy a sloučeniny', 'Metals and compounds'),
  basketCopy: c('280530: kovy vzácných zemin včetně skandia a yttria. 284610: sloučeniny ceru. 284690: ostatní sloučeniny vzácných zemin. Nezahrnuje rudy, permanentní magnety ani hotová zařízení. Jednotlivé prvky nelze z těchto skupin spolehlivě oddělit.', '280530: rare-earth metals, including scandium and yttrium. 284610: cerium compounds. 284690: other rare-earth compounds. Excludes ores, permanent magnets and finished equipment. Individual elements cannot reliably be separated within these groups.'),
  unitsTitle: c('Hodnota a hmotnost', 'Value and weight'),
  unitsCopy: c('Běžné USD; vývoz obvykle FOB a dovoz CIF. Tuny jsou čistá hmotnost obchodovaných výrobků, ne obsah prvku ani ekvivalent oxidu. Odhadované hmotnosti jsou označeny. Chybějící hmotnost se nedopočítává.', 'Current USD; exports generally FOB and imports CIF. Tonnes measure the net weight of traded products, not elemental content or rare-earth oxide equivalent. Estimated weights are identified. Missing weights are not filled in.'),
  coverageTitle: c('Mezera není nula', 'A gap is not zero'),
  coverageCopy: c('Roční a měsíční řady se nesčítají. Celkové hodnoty používají partnera World; bilaterální toky se zobrazují zvlášť. Chybějící hlášení se nedoplňuje zrcadlovým obchodem. Nejnovější měsíc nemusí být dostupný pro všechny země.', 'Annual and monthly series are separate. Headline figures use the World partner; bilateral flows are shown separately. Missing reports are not filled from mirror trade. The latest month is not necessarily available for every country.'),
  source: c('Zdroj', 'Source'), allProducts: c('Všechny tři skupiny', 'All three groups'),
  observed: c('Vykázané hodnoty', 'Reported values'), covered: c('Pokrytí produktů', 'Product coverage'),
  groups: c('skupin', 'groups'), unavailable: c('Nedostupné', 'Not available'),
  partner: c('Partner', 'Partner'), partnerReport: c('Otevřít tuto zemi →', 'Explore this country →'),
  other: c('Další partneři', 'Other partners'), exact: c('Přesná hodnota', 'Exact value'),
  usd: c('běžné USD', 'current USD'), weightUnit: c('t čisté hmotnosti', 'tonnes, net weight'),
  missingProducts: c('Chybějící skupiny se nedoplňují nulou. Bilance a body trendu vyžadují všechny vybrané skupiny.', 'Missing groups are not filled with zero. Balance and trend points require all selected groups.'),
  partial: c('Pokrytí tohoto hlášení není potvrzené jako úplné.', 'This reporting period is not confirmed complete.'),
  loaded: c('Hlášení za toto období je načteno.', 'The reporting dataset for this period is loaded.'),
  estimated: c('Obsahuje odhadované hmotnosti ze zdroje.', 'Includes source-estimated weights.'),
  unknownCoverage: c('Stav úplnosti není k dispozici.', 'Completeness metadata are unavailable.'),
  historyNote: c('Pouze celky se všemi vybranými skupinami. Chybějící období přerušují řadu.', 'Only totals with every selected group. Missing periods break the line.'),
  routeNote: c('Dostupné bilaterální toky. Součet nemusí odpovídat World.', 'Available bilateral flows. Their sum may differ from World totals.'),
};
const names = { '280530': c('Kovy vzácných zemin', 'Rare-earth metals'), '284610': c('Sloučeniny ceru', 'Cerium compounds'), '284690': c('Ostatní sloučeniny', 'Other rare-earth compounds') };
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const displayPeriod = value => !value ? '—' : value.length === 6 ? `${value.slice(0,4)}–${value.slice(4)}` : value;
const validProduct = value => CODES.includes(value) ? value : 'ALL';
const state = { country: /^[A-Z]{3}$/.test(params.get('code')) ? params.get('code') : 'CHN', frequency: params.get('freq') === 'M' ? 'M' : 'A', period: params.get('period') || '', product: validProduct(params.get('product')), unit: params.get('unit') === 'tonnes' ? 'tonnes' : 'usd', partner: params.get('partner') || '', profile: null };
let request = 0;
let controller;
let countries = [{code:'CHN',name:c('Čína','China')},{code:'USA',name:c('Spojené státy','United States')},{code:'DEU',name:c('Německo','Germany')},{code:'JPN',name:c('Japonsko','Japan')},{code:'CZE',name:c('Česko','Czechia')}];
const expected = () => state.product === 'ALL' ? 3 : 1;
const unitLabel = () => state.unit === 'usd' ? copy.usd : copy.weightUnit;
const compact = value => value === null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat(lang, { ...(state.unit === 'usd' ? {style:'currency',currency:'USD'} : {}), notation:'compact', maximumFractionDigits:1 }).format(value) + (state.unit === 'tonnes' ? ' t' : '');
const exact = value => value === null || !Number.isFinite(value) ? copy.unavailable : new Intl.NumberFormat(lang, {maximumFractionDigits:2}).format(value) + (state.unit === 'usd' ? ' USD' : ' t');
const productName = () => state.product === 'ALL' ? copy.allProducts : names[state.product];
function countryName() { return countries.find(row => row.code === state.country)?.name || state.country; }
function urlState() {
  const url = new URL(location.href);
  for (const [key,value] of Object.entries({code:state.country,lang,freq:state.frequency,period:state.period,product:state.product,unit:state.unit,partner:state.partner})) value ? url.searchParams.set(key,value) : url.searchParams.delete(key);
  history.replaceState(null,'',url);
  $('#re-all-trade').href = `../trade/?code=${state.country}&lang=${lang}`;
}
function renderCountries() {
  if (!countries.some(row => row.code === state.country)) countries.push({code:state.country,name:state.country});
  $('#re-country').innerHTML = countries.map(row=>`<option value="${esc(row.code)}">${esc(row.name)} (${esc(row.code)})</option>`).join('');
  $('#re-country').value = state.country;
}
function syncControls() {
  for (const [id,key,attribute] of [['re-frequency','frequency','frequency'],['re-unit','unit','unit']]) document.querySelectorAll(`#${id} button`).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset[attribute] === state[key])));
  $('#re-product').value = state.product;
  $('#re-country-code').textContent = state.country;
  $('#re-country-name').textContent = countryName();
  $('#re-context').textContent = `${countryName()} · ${displayPeriod(state.period)} · ${productName()}`;
  $('#re-chart-unit').textContent = unitLabel();
  urlState();
}
function rail(id, slug, title, rows, columns, note) {
  const host = $(id);
  const sourceDate = state.profile?.source.retrieved_at?.slice(0,10) || copy.unavailable;
  host.insertAdjacentHTML('beforeend', `<p class="re-source">UN Comtrade · ${esc(unitLabel())} · ${esc(displayPeriod(state.period))} · ${esc(note)}</p>`);
  window.PSDChart.register({ el:host, slug, title: `${title} · ${countryName()} · ${productName()} · ${displayPeriod(state.period)}`, rows, columns,
    exports: host.querySelector('svg') ? ['csv','png'] : ['csv'], embeddable:false,
    source: {name:'UN Comtrade',url:'https://comtrade.un.org/',table:'budget_detail.trade_observations',extracted:sourceDate,vintage:'outturn',edition:displayPeriod(state.period),definition:copy.pulseIntro,excludes:copy.basketCopy,caveat:`${note} ${copy.unitsCopy}`} });
}
const dataColumns = () => [{key:'period',label:copy.period},{key:'product',label:copy.product},{key:'flow',label:c('Tok','Flow')},{key:'value',label:unitLabel(),numeric:true},{key:'estimated',label:c('Odhad hmotnosti','Estimated weight')}];
function clearCharts(message) {
  for (const id of ['re-products-chart','re-export-chart','re-import-chart','re-trend-chart']) $(`#${id}`).innerHTML = `<p class="re-empty">${esc(message)}</p>`;
  $('#re-kpis').innerHTML = '';
  $('#re-partner-detail').hidden = true;
  $('#re-coverage').textContent = '';
  $('#re-export-meta').textContent = '';
  $('#re-import-meta').textContent = '';
  $('#re-vintage').textContent = 'UN Comtrade';
}
async function load() {
  const sequence = ++request;
  controller?.abort(); controller = new AbortController();
  state.profile = null;
  clearCharts(copy.loading);
  $('#re-controls').setAttribute('aria-busy','true');
  $('#re-status').classList.remove('is-error'); $('#re-status').textContent = copy.loading; $('#re-retry').hidden = true;
  syncControls();
  try {
    const query = new URLSearchParams({country:state.country,frequency:state.frequency});
    if (state.period) query.set('period',state.period);
    const response = await fetch(`/api/v1/trade/rare-earths?${query}`,{signal:controller.signal});
    if (!response.ok) throw new Error(`Trade API ${response.status}`);
    const profile = (await response.json()).data;
    if (sequence !== request) return;
    if (!profile || !Array.isArray(profile.totals) || !Array.isArray(profile.partners)) throw new Error('Invalid trade response');
    state.profile = profile; state.period = profile.period || '';
    const periods = [...new Set([...profile.periods,...(state.period ? [state.period] : [])])].sort().reverse();
    $('#re-period').innerHTML = periods.length ? periods.map(period=>`<option value="${esc(period)}">${esc(displayPeriod(period))}</option>`).join('') : '<option value="">—</option>';
    $('#re-period').value = state.period;
    render();
  } catch (error) {
    if (sequence !== request || error.name === 'AbortError') return;
    clearCharts(copy.error); $('#re-status').textContent = copy.error; $('#re-status').classList.add('is-error'); $('#re-retry').hidden = false;
  } finally { if (sequence === request) $('#re-controls').removeAttribute('aria-busy'); }
}
function render() {
  syncControls();
  if (!state.profile) return;
  const raw = state.profile.totals.filter(row=>row.period === state.period);
  const rows = selectedRows(raw,state.product);
  const totals = pair(rows,state.unit,expected());
  const fields = [['export',copy.exports,totals.export,`${totals.exportCount}/${expected()} ${copy.groups}`],['import',copy.imports,totals.import,`${totals.importCount}/${expected()} ${copy.groups}`],['balance',copy.balance,totals.balance,state.unit === 'usd' ? 'FOB − CIF' : copy.weightUnit]];
  $('#re-kpis').innerHTML = fields.map(([type,label,value,note])=>`<article class="${type}${type==='balance' ? (value===null ? '' : value<0 ? ' deficit' : ' surplus') : ''}"><span>${esc(label)}</span><strong title="${esc(exact(value))}">${esc(compact(value))}</strong><small>${esc(note)}</small></article>`).join('') + `<article class="cover"><span>${esc(copy.covered)}</span><strong>${totals.exportCount + totals.importCount}/${expected()*2}</strong><small>${esc(copy.products)} × ${esc(copy.exports)} / ${esc(copy.imports)}</small></article>`;
  $('#re-status').textContent = rows.length ? '' : copy.noData;
  const coverage = state.profile.coverage.filter(row=>row.period === state.period);
  const status = !coverage.length ? copy.unknownCoverage : coverage.every(row=>row.crawl_status==='loaded') ? copy.loaded : copy.partial;
  $('#re-coverage').textContent = [status,copy.missingProducts,state.unit === 'tonnes' && totals.estimated ? copy.estimated : '',state.frequency === 'M' ? c('Měsíční dostupnost se liší podle země.','Monthly availability varies by country.') : ''].filter(Boolean).join(' ');
  $('#re-vintage').textContent = `UN Comtrade · ${state.profile.source.retrieved_at?.slice(0,10) || '—'}`;
  renderProducts(raw); renderRoutes(); renderTrend(); renderPartnerDetail();
}
function renderProducts(raw) {
  const rows = CODES.map(code=>({code,...pair(raw.filter(row=>row.product_code===code),state.unit,1)}));
  const max = Math.max(...rows.flatMap(row=>[row.export ?? 0,row.import ?? 0]),1);
  const label = `${copy.productsTitle} · ${unitLabel()}`;
  $('#re-products-chart').innerHTML = `<svg viewBox="0 0 1140 255" role="group" aria-label="${esc(label)}"><rect width="1140" height="255" fill="#171918"/>${rows.map((row,index)=>{
    const x = index*380, active = state.product===row.code;
    return `<g role="button" tabindex="0" data-product="${row.code}" aria-pressed="${active}" aria-label="${esc(names[row.code])}"><title>${esc(names[row.code])}: ${copy.exports} ${exact(row.export)}; ${copy.imports} ${exact(row.import)}</title><rect class="re-product-bg" x="${x+1}" y="1" width="366" height="246" fill="${active ? '#242724' : '#171918'}" stroke="${active ? '#a8b63f' : '#8b8d83'}"/><text x="${x+20}" y="30" fill="#a8b63f" font-size="11" font-family="monospace">HS ${row.code}</text><text x="${x+20}" y="60" fill="#faf7ef" font-family="Arial" font-size="20" font-weight="700">${esc(names[row.code])}</text>${['export','import'].map((flow,j)=>{const y=105+j*74;return `<text x="${x+20}" y="${y}" fill="#d2ccc1" font-size="11" font-family="Arial">${esc(flow==='export'?copy.exports:copy.imports)}</text><text x="${x+344}" y="${y}" fill="#faf7ef" text-anchor="end" font-size="22" font-family="Georgia">${esc(compact(row[flow]))}</text><rect x="${x+20}" y="${y+17}" width="${row[flow]===null?0:Math.max(0,row[flow]/max*324)}" height="9" fill="${flow==='export'?'#a8b63f':'#8b8d83'}"/>`;}).join('')}</g>`;
  }).join('')}</svg>`;
  const tableRows = raw.map(row=>({period:row.period,product:`HS ${row.product_code} · ${names[row.product_code]}`,flow:row.flow==='export'?copy.exports:copy.imports,value:amount([row],state.unit),estimated:row.weight_estimated ? c('Ano','Yes') : c('Ne','No')}));
  rail('#re-products-chart','rare-earths-product-flows',copy.productsTitle,tableRows,dataColumns(),copy.observed);
}
function mapItems(rows,flow) {
  const sorted = rows.filter(row=>row[flow] !== null && row[flow]>0).sort((a,b)=>b[flow]-a[flow]);
  if (sorted.length <= 16) return sorted.map(row=>({...row,weight:row[flow]}));
  return [...sorted.slice(0,15).map(row=>({...row,weight:row[flow]})),{code:'OTHER',name:copy.other,weight:sorted.slice(15).reduce((sum,row)=>sum+row[flow],0)}];
}
function renderRoutes() {
  const rows = partners(state.profile.partners,state.product,state.unit);
  for (const flow of ['export','import']) {
    const available = rows.filter(row=>row[flow] !== null);
    const missing = rows.filter(row=>row.rows.some(item=>item.flow === flow) && row[flow] === null).length;
    $(`#re-${flow}-meta`).textContent = `${available.length} ${c('partnerů','partners')} · ${displayPeriod(state.period)} · ${unitLabel()}${missing ? ` · ${missing} ${c('bez úplné hmotnosti','with incomplete weight')}` : ''}`;
    const tiles = treemap(mapItems(rows,flow),{x:0,y:0,w:540,h:330});
    $(`#re-${flow}-chart`).innerHTML = tiles.length ? `<svg viewBox="0 0 540 330" role="group" aria-label="${esc(flow==='export'?copy.destinations:copy.origins)}"><rect width="540" height="330" fill="#171918"/>${tiles.map((row,index)=>{
      const color = row.code === state.partner ? '#c93237' : flow==='export' ? (index%2 ? '#8b8d83':'#a8b63f') : (index%2 ? '#d2ccc1':'#8b8d83');
      const textColor = row.code === state.partner ? '#faf7ef' : '#171918';
      const canLabel = row.w>70 && row.h>36;
      const name = row.w>170 ? (row.name.length>23?`${row.name.slice(0,21)}…`:row.name) : row.code==='OTHER'?copy.other:row.code;
      return `<g role="button" tabindex="0" data-partner="${esc(row.code)}" aria-label="${esc(`${row.name}: ${exact(row.weight)}`)}"><title>${esc(row.name)} · ${esc(exact(row.weight))}</title><rect x="${row.x+1}" y="${row.y+1}" width="${Math.max(0,row.w-2)}" height="${Math.max(0,row.h-2)}" fill="${color}" stroke="#171918"/>${canLabel?`<text x="${row.x+10}" y="${row.y+24}" fill="${textColor}" font-family="Arial" font-size="${row.w>170?17:13}" font-weight="700">${esc(name)}</text>${row.h>65?`<text x="${row.x+10}" y="${row.y+48}" fill="${textColor}" font-family="monospace" font-size="12">${esc(compact(row.weight))}</text>`:''}`:''}</g>`;
    }).join('')}</svg>` : `<p class="re-empty">${esc(missing?copy.noWeight:copy.noData)}</p>`;
    const table = rows.filter(row=>row.rows.some(item=>item.flow===flow)).sort((a,b)=>(b[flow]??-1)-(a[flow]??-1)).map(row=>({partner:row.name,code:row.code,period:state.period,value:row[flow],estimated:row.rows.filter(item=>item.flow===flow).some(item=>item.weight_estimated)?c('Ano','Yes'):c('Ne','No')}));
    rail(`#re-${flow}-chart`,flow==='export'?'rare-earths-export-destinations':'rare-earths-import-origins',flow==='export'?copy.destinations:copy.origins,table,[{key:'partner',label:copy.partner},{key:'code',label:'ISO'},{key:'period',label:copy.period},{key:'value',label:unitLabel(),numeric:true},{key:'estimated',label:c('Odhad hmotnosti','Estimated weight')}],copy.routeNote);
  }
}
function renderPartnerDetail() {
  const host = $('#re-partner-detail');
  const row = partners(state.profile.partners,state.product,state.unit).find(item=>item.code===state.partner);
  host.hidden = !row;
  if (!row) return;
  host.innerHTML = `<h3>${esc(row.name)}</h3><p>${esc(copy.exports)}: <b>${esc(exact(row.export))}</b><br>${esc(copy.imports)}: <b>${esc(exact(row.import))}</b></p>${/^[A-Z]{3}$/.test(row.code)?`<a href="?code=${row.code}&lang=${lang}&freq=${state.frequency}&period=${state.period}&product=${state.product}&unit=${state.unit}">${esc(copy.partnerReport)}</a>`:''}`;
}
function renderTrend() {
  const history = timeline(state.profile.totals,state.product,state.unit,state.frequency).map(row=>({...row,export:row.exportCount===expected()?row.export:null,import:row.importCount===expected()?row.import:null}));
  const hasValues = history.some(row=>row.export!==null||row.import!==null);
  if (!hasValues) $('#re-trend-chart').innerHTML = `<p class="re-empty">${esc(copy.noData)}</p>`;
  else {
    const W=1120,H=330,left=92,right=30,top=24,bottom=45;
    const max = Math.max(...history.flatMap(row=>[row.export??0,row.import??0]),1)*1.12;
    const x=i=>left+(history.length===1?(W-left-right)/2:i/(history.length-1)*(W-left-right));
    const y=value=>H-bottom-value/max*(H-top-bottom);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(copy.trendTitle)}"><rect width="${W}" height="${H}" fill="#171918"/>`;
    for (let i=0;i<5;i++) {const value=max*i/4;svg+=`<line x1="${left}" x2="${W-right}" y1="${y(value)}" y2="${y(value)}" stroke="#8b8d83" stroke-opacity=".3"/><text x="${left-12}" y="${y(value)+4}" text-anchor="end" fill="#d2ccc1" font-family="monospace" font-size="11">${esc(compact(value))}</text>`;}
    for (const flow of ['export','import']) {
      let path='',connected=false;
      history.forEach((row,i)=>{if(row[flow]===null){connected=false;return;} path+=`${connected?'L':'M'}${x(i)},${y(row[flow])} `;connected=true;});
      const color=flow==='export'?'#a8b63f':'#8b8d83';
      svg+=`<path class="re-series" data-flow="${flow}" d="${path}" stroke="${color}" fill="none" stroke-width="3"/>`;
      history.forEach((row,i)=>{if(row[flow]===null)return;svg+=`<g role="button" tabindex="0" data-period="${row.period}" aria-label="${esc(`${displayPeriod(row.period)} ${flow==='export'?copy.exports:copy.imports} ${exact(row[flow])}`)}"><title>${displayPeriod(row.period)} · ${exact(row[flow])}</title><circle cx="${x(i)}" cy="${y(row[flow])}" r="11" fill="transparent"/><circle cx="${x(i)}" cy="${y(row[flow])}" r="${row.period===state.period?6:4}" fill="${color}" stroke="#171918" stroke-width="2"/></g>`;});
    }
    history.forEach((row,i)=>{if(i===0||i===history.length-1||i%Math.max(1,Math.ceil(history.length/7))===0)svg+=`<text x="${x(i)}" y="${H-13}" text-anchor="middle" fill="#d2ccc1" font-family="monospace" font-size="11">${displayPeriod(row.period)}</text>`;});
    $('#re-trend-chart').innerHTML = svg+'</svg>';
  }
  rail('#re-trend-chart','rare-earths-trade-history',copy.trendTitle,history.map(row=>({period:displayPeriod(row.period),export:row.export,import:row.import})),[{key:'period',label:copy.period},{key:'export',label:`${copy.exports} (${unitLabel()})`,numeric:true},{key:'import',label:`${copy.imports} (${unitLabel()})`,numeric:true}],copy.historyNote);
}
function activate(event) {
  const element = event.target.closest('[data-product],[data-partner],[data-period]');
  if (!element || !state.profile || !element.closest('svg')) return;
  if (event.type==='keydown') { if(!['Enter',' '].includes(event.key))return;event.preventDefault(); }
  if (element.dataset.product) { state.product=state.product===element.dataset.product?'ALL':element.dataset.product;state.partner='';render(); }
  else if (element.dataset.period) {state.period=element.dataset.period;state.partner='';load();}
  else if (element.dataset.partner==='OTHER') { const host=element.closest('[data-chart-slug]');host.querySelector('[data-action="table"]').click(); }
  else {state.partner=state.partner===element.dataset.partner?'':element.dataset.partner;renderRoutes();renderPartnerDetail();urlState();}
}

document.documentElement.lang=lang;
document.title=`${copy.pageTitle} — Public Spending Data`;
$('meta[name="description"]').content=copy.intro;
document.querySelectorAll('[data-re]').forEach(element=>{if(copy[element.dataset.re])element.textContent=copy[element.dataset.re];});
$('.deep-topic-rail').setAttribute('aria-label',c('Sekce reportu','Report sections'));
$('#re-product').innerHTML=`<option value="ALL">${esc(copy.allProducts)}</option>`+CODES.map(code=>`<option value="${code}">${esc(names[code])} · HS ${code}</option>`).join('');
renderCountries();
$('#re-country').addEventListener('change',()=>{state.country=$('#re-country').value;state.partner='';load();});
$('#re-period').addEventListener('change',()=>{state.period=$('#re-period').value;state.partner='';load();});
$('#re-product').addEventListener('change',()=>{state.product=$('#re-product').value;state.partner='';render();});
$('#re-frequency').addEventListener('click',event=>{const button=event.target.closest('[data-frequency]');if(button&&button.dataset.frequency!==state.frequency){state.frequency=button.dataset.frequency;state.period='';state.partner='';load();}});
$('#re-unit').addEventListener('click',event=>{const button=event.target.closest('[data-unit]');if(button){state.unit=button.dataset.unit;render();}});
$('#re-retry').addEventListener('click',load);
document.addEventListener('click',activate);document.addEventListener('keydown',activate);
load();
fetch('/api/v1/trade/countries').then(response=>response.ok?response.json():Promise.reject()).then(payload=>{
  const loaded=(payload.data?.countries||[]).filter(row=>/^[A-Z]{3}$/.test(row.code)&&row.code!=='EUR');
  if(loaded.length){countries=loaded;renderCountries();syncControls();}
}).catch(()=>{});
