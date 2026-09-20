import { countries, sources, parseState, tr } from './lib/funding-systems.mjs';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let lang = document.documentElement.lang === 'cs' ? 'cs' : 'en';
let state = parseState(location.search);
let benchmark = null, benchmarkFailed = false;
const t = value => typeof value === 'object' ? value[lang] : value;
const text = (en, cs) => lang === 'cs' ? cs : en;
const format = value => new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
const topics = { funding: tr('Funding the state', 'Financování státu'), schools: tr('Schools', 'Školy'), health: tr('Healthcare', 'Zdravotnictví') };
const copy = {
  skip: tr('Skip to funding routes', 'Přeskočit k cestám financování'),
  eyebrow: tr('FOLLOW THE MONEY / FIVE FUNDING SYSTEMS', 'SLEDUJTE PENÍZE / PĚT SYSTÉMŮ FINANCOVÁNÍ'),
  title: tr('How does the money<br>actually arrive?', 'Jak peníze<br>skutečně dorazí?'),
  intro: tr('A tax payment is only the beginning. Follow the institutions between your contribution and a classroom, a doctor or a hospital.', 'Zaplacením daně to teprve začíná. Sledujte instituce mezi vaším příspěvkem a třídou, lékařem či nemocnicí.'),
  heroNote: tr('Who collects it.<br>Who passes it on.<br>Who finally pays.', 'Kdo vybírá.<br>Kdo přeposílá.<br>Kdo nakonec platí.'),
  jump: tr('Compare all five countries ↓', 'Porovnat všech pět zemí ↓'),
  mapKey: tr('SOURCE → INTERMEDIARIES → DELIVERY', 'ZDROJ → MEZIČLÁNKY → SLUŽBA'),
  schematic: tr('Institutional routes · widths do not represent amounts', 'Institucionální cesty · šířky nevyjadřují částky'),
  mapHint: tr('Open a route for the payment mechanism and sources.', 'Otevřete cestu a prohlédněte si mechanismus plateb a zdroje.'),
  expand: tr('Explain every route +', 'Vysvětlit všechny cesty +'),
  evidence: tr('What we know, and what is missing', 'Co víme a co chybí'),
  reviewed: tr('Routes reviewed 19 September 2026 · source vintages vary', 'Cesty ověřeny 19. září 2026 · stáří zdrojů se liší'),
  practicalLabel: tr('THE PRACTICAL PART', 'JAK TO FUNGUJE V PRAXI'),
  principlesTitle: tr('One service.<br> More than one payer.', 'Jedna služba.<br> Více plátců.'),
  compareLabel: tr('SIDE BY SIDE / INSTITUTIONS', 'SROVNÁNÍ / INSTITUCE'),
  compareTitle: tr('Same need. Different routes.', 'Stejná potřeba. Různé cesty.'),
  compareNote: tr('Compare responsibilities and payment mechanisms. More intermediaries do not, by themselves, mean more waste.', 'Porovnejte odpovědnost a platební mechanismy. Více mezičlánků samo o sobě neznamená více plýtvání.'),
  scopeNote: tr('Schools: ordinary public primary and secondary education, excluding universities. Healthcare: main financing routes, including private payments where relevant. These are structural comparisons, not efficiency rankings.', 'Školy: běžné veřejné základní a střední vzdělávání bez vysokých škol. Zdravotnictví: hlavní cesty financování včetně relevantních soukromých plateb. Jde o srovnání struktury, nikoli žebříček efektivity.'),
  fiscalLabel: tr('SIDE BY SIDE / FISCAL SCALE', 'SROVNÁNÍ / ROZSAH VEŘEJNÝCH FINANCÍ'),
  fiscalTitle: tr('How much of the economy passes through government?', 'Jak velká část ekonomiky prochází veřejnými rozpočty?'),
  fiscalIntro: tr('One year, one definition: consolidated general government in 2024, as a share of GDP.', 'Jeden rok, jedna definice: konsolidovaný sektor vládních institucí v roce 2024, v procentech HDP.'),
  loading: tr('Loading the fiscal benchmark…', 'Načítání fiskálního srovnání…'),
  fiscalNote: tr('These are all-government totals, not school or health budgets. They consolidate transfers between government units. Revenue includes grants; borrowing is financing. Private insurance premiums and direct household spending are outside this government perimeter. Ukraine’s wartime expenditure and grants make peacetime comparisons difficult. Figures alone do not measure service quality.', 'Jde o součty celého vládního sektoru, nikoli rozpočty škol či zdravotnictví. Transfery mezi vládními jednotkami jsou konsolidovány. Příjmy zahrnují dotace; půjčky jsou financováním. Soukromé pojistné a přímé platby domácností jsou mimo tento vládní rámec. Válečné výdaje a dotace Ukrajiny ztěžují mírové srovnání. Samotná čísla neměří kvalitu služeb.'),
  methodTitle: tr('Read the map with the right boundaries.', 'Čtěte mapu se správně vymezenými hranicemi.'),
  sourcesTitle: tr('Sources for this country and topic', 'Zdroje pro tuto zemi a téma'),
  download: tr('Download the fiscal benchmark (JSON) ↗', 'Stáhnout fiskální srovnání (JSON) ↗'),
};
const principlePacks = {
  funding: [
    [tr('Revenue is earned or received.', 'Příjmy se vybírají nebo přijímají.'), tr('Taxes, compulsory contributions, fees, grants and remitted dividends enter different public accounts. Revenue is broader than taxes.', 'Daně, povinné odvody, poplatky, dotace a odvedené dividendy vstupují do různých veřejných účtů. Příjmy jsou širší než daně.')],
    [tr('Borrowing covers a financing need.', 'Půjčky pokrývají potřebu financování.'), tr('A deficit is spending above revenue. Gross borrowing also refinances old debt; it is not all new spending. Reserves can also be used.', 'Schodek je rozdíl výdajů nad příjmy. Hrubé půjčky také refinancují starý dluh; nejde jen o nové výdaje. Lze využít i rezervy.')],
    [tr('A transfer is the same money moving.', 'Transfer přesouvá stejné peníze.'), tr('A ministry pays a municipality, then the municipality pays a school. Adding both payments as final spending would count the transfer twice.', 'Ministerstvo pošle peníze obci a obec škole. Součet obou plateb jako konečných výdajů by započetl transfer dvakrát.')],
  ],
  schools: [
    [tr('Teaching and buildings can be split.', 'Výuka a budovy mohou mít různé plátce.'), tr('The teacher’s salary may come from the state while heating, repairs and support staff come from the school’s local founder.', 'Plat učitele může financovat stát, zatímco vytápění, opravy a podpůrný personál místní zřizovatel školy.')],
    [tr('The school does not always receive the cash.', 'Peníze ne vždy přijdou na účet školy.'), tr('A state or district can pay staff directly. A funding map must include resources delivered to a school, not just deposits in its bank account.', 'Stát či školský obvod může platit zaměstnance přímo. Mapa musí zahrnovat i zdroje poskytnuté škole, nejen platby na její účet.')],
    [tr('A formula allocates; a budget pays.', 'Vzorec rozděluje; rozpočet platí.'), tr('Pupil counts, teaching needs and equalisation rules can determine allocations. The intermediary then passes funds on or pays the costs itself.', 'Počty žáků, potřeby výuky a vyrovnávací pravidla mohou určovat příděly. Mezičlánek pak peníze přepošle nebo náklady zaplatí sám.')],
  ],
  health: [
    [tr('The owner is not necessarily the payer.', 'Vlastník nemusí být plátcem.'), tr('A city can own the hospital while an insurer or national purchaser pays for treatment. The owner may separately fund a new building.', 'Město může vlastnit nemocnici, zatímco pojišťovna či národní plátce hradí léčbu. Vlastník může zvlášť financovat novou budovu.')],
    [tr('Pooling comes before purchasing.', 'Sdružení peněz předchází nákupu péče.'), tr('Taxes or premiums are pooled across people. A purchaser then pays for care through contracts: per patient, per service, per case or through a budget.', 'Daně či pojistné se sdružují za více lidí. Plátce pak smluvně hradí péči: za pacienta, výkon, případ nebo prostřednictvím rozpočtu.')],
    [tr('Coverage does not mean zero household cost.', 'Krytí neznamená nulové náklady domácností.'), tr('Co-payments, medicines and uncovered services can leave a household bill. That private spending is outside a government-budget comparison.', 'Spoluúčast, léky a nehrazené služby mohou zatížit domácnosti. Tyto soukromé výdaje jsou mimo srovnání vládních rozpočtů.')],
  ],
};

function sourceLink(id) {
  const source = sources[id];
  return `<a href="${escape(source.url)}" target="_blank" rel="noopener">${escape(source.title)} ↗</a>`;
}

function render() {
  const country = countries.find(c => c.code === state.country);
  document.title = text('How public money reaches schools and healthcare', 'Jak veřejné peníze dorazí do škol a zdravotnictví') + ' — Public Spending Data';
  document.querySelector('meta[name="description"]').content = t(copy.intro);
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(copy[el.dataset.i18n]); });
  $('#country-picker').setAttribute('aria-label', text('Country', 'Země'));
  $('#topic-picker').setAttribute('aria-label', text('Funding topic', 'Téma financování'));
  $('.systems-table-scroll').setAttribute('aria-label', text('Country comparison', 'Srovnání zemí'));
  $('#country-picker').innerHTML = countries.map(c => `<button type="button" data-country="${c.code}" aria-pressed="${c.code === state.country}" aria-controls="system-map"><img src="assets/flags/${c.flag}.svg" alt="" width="25" height="18"><span>${escape(t(c.name))}</span><small>${c.code}</small></button>`).join('');
  $('#topic-picker').innerHTML = Object.entries(topics).map(([id, label], i) => `<button type="button" data-topic="${id}" aria-pressed="${id === state.topic}" aria-controls="routes"><span>0${i + 1}</span> ${escape(t(label))}</button>`).join('');
  $('#map-country').textContent = `${country.code} / ${t(country.name)}`;
  $('#map-title').textContent = state.topic === 'schools' ? t(country.headline) : state.topic === 'health' ? text('Who pays for care?', 'Kdo platí péči?') : text('Where public money comes from.', 'Odkud přicházejí veřejné peníze.');
  $('#map-summary').textContent = t(country.summary);
  const routes = country.routes[state.topic];
  $('#routes').innerHTML = routes.map((route, index) => `<details class="systems-route${route.partial ? ' is-partial' : ''}" data-route="${route.id}"><summary><span class="systems-route-heading"><span><small>0${index + 1}</small> ${escape(t(route.label))}</span><span class="systems-route-status">${route.partial ? text('Partial evidence', 'Částečné doložení') : text('Documented route', 'Doložená cesta')} <b aria-hidden="true">+</b></span></span><span class="systems-chain" style="--nodes:${route.nodes.length}">${route.nodes.map((node, i) => `<span class="systems-node${i === 0 ? ' is-source' : i === route.nodes.length - 1 ? ' is-destination' : ''}"><small>${i === 0 ? text('SOURCE', 'ZDROJ') : i === route.nodes.length - 1 ? text('ARRIVES AT', 'DORAZÍ K') : text('VIA', 'PŘES')}</small><span>${escape(t(node))}</span></span>`).join('')}</span></summary><div class="systems-route-detail"><p>${escape(t(route.note))}</p><div>${route.sources.map(sourceLink).join('')}</div>${route.partial ? `<small>${text('Structural outline; current execution is not fully verified.', 'Strukturální přehled; současné provádění není plně ověřeno.')}</small>` : ''}</div></details>`).join('');
  $('#country-gap').textContent = t(country.gap);
  $('.systems-evidence').classList.toggle('is-partial', country.code === 'RUS');
  $('#principles').innerHTML = principlePacks[state.topic].map(([title, body], i) => `<article><span>0${i + 1}</span><div><h3>${escape(t(title))}</h3><p>${escape(t(body))}</p></div></article>`).join('');
  const headings = {
    funding: [tr('What funds it', 'Co jej financuje'), tr('Where it is pooled', 'Kde se peníze sdružují'), tr('What connects the levels', 'Co propojuje úrovně')],
    schools: [tr('Who funds teaching', 'Kdo financuje výuku'), tr('The local intermediary / owner', 'Místní mezičlánek / vlastník'), tr('How resources reach the school', 'Jak zdroje dorazí do školy')],
    health: [tr('Main funding sources', 'Hlavní zdroje financování'), tr('Who buys or pays for care', 'Kdo nakupuje nebo hradí péči'), tr('The last payment step', 'Poslední platební krok')],
  };
  $('#comparison-table').innerHTML = `<caption>${escape(t(topics[state.topic]))} · ${text('institutional benchmark', 'institucionální srovnání')}</caption><thead><tr><th scope="col">${text('Country', 'Země')}</th>${headings[state.topic].map(h => `<th scope="col">${escape(t(h))}</th>`).join('')}</tr></thead><tbody>${countries.map(c => `<tr class="${c.code === state.country ? 'is-selected' : ''}"><th scope="row"><button type="button" data-country="${c.code}" aria-pressed="${c.code === state.country}">${escape(t(c.name))} <span aria-hidden="true">↗</span></button>${c.code === 'RUS' ? `<small>${text('Partial evidence', 'Částečné doložení')}</small>` : ''}</th>${c.compare[state.topic].map(cell => `<td>${escape(t(cell))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  $('#country-sources').innerHTML = [...new Set(routes.flatMap(route => route.sources))].map(id => `<li>${sourceLink(id)}<small>${escape(sources[id].vintage)}</small></li>`).join('');
  $('#method-copy').innerHTML = `<p>${text('The routes are an editorial synthesis of the linked institutional sources. Boxes group institutions with the same role; arrows show the direction of funding or a resource paid for on the recipient’s behalf. They do not trace individual tax payments, measure cash amounts or count administrative overhead.', 'Cesty jsou redakční syntézou odkazovaných institucionálních zdrojů. Bloky sdružují instituce se stejnou rolí; šipky ukazují směr financování nebo zdroj uhrazený za příjemce. Nesledují jednotlivé daňové platby, neměří objem peněz ani režijní náklady.')}</p><p>${text('Where measured transfer data are missing, we fill in the documented institutional mechanism. We leave amounts unquantified and mark partially verified routes. The original Czech 2026 central-budget view remains separate from the 2024 all-government fiscal benchmark below.', 'Kde chybějí naměřená data o transferech, doplňujeme doložený institucionální mechanismus. Částky nevyčíslujeme a částečně ověřené cesty označujeme. Původní český státní rozpočet 2026 zůstává oddělený od fiskálního srovnání celého vládního sektoru za rok 2024.')}</p>`;
  $('#selection-status').textContent = `${t(country.name)} · ${t(topics[state.topic])} · ${routes.length} ${text('funding routes', 'cesty financování')}`;
  renderFiscal();
}

function renderFiscal() {
  const host = $('#fiscal-chart');
  if (!benchmark) {
    host.innerHTML = `<p role="status">${benchmarkFailed ? text('The fiscal figures could not be loaded. The institutional maps remain available. Reload to retry, or use the JSON link below.', 'Fiskální údaje se nepodařilo načíst. Institucionální mapy zůstávají dostupné. Obnovte stránku nebo použijte odkaz na JSON níže.') : t(copy.loading)}</p>`;
    return;
  }
  const rows = benchmark.rows;
  const max = Math.ceil(Math.max(...rows.flatMap(r => [r.revenue?.value || 0, r.spending?.value || 0])) / 10) * 10;
  const left = 175, width = 510, top = 70, step = 69;
  const scaled = value => value / max * width;
  const revenue = text('Revenue', 'Příjmy'), spending = text('Spending', 'Výdaje'), balance = text('Balance', 'Saldo');
  const svg = `<svg viewBox="0 0 870 472" role="img" aria-labelledby="fiscal-svg-title fiscal-svg-desc" xmlns="http://www.w3.org/2000/svg"><title id="fiscal-svg-title">${escape(t(copy.fiscalTitle))}</title><desc id="fiscal-svg-desc">${escape(t(copy.fiscalIntro))} ${text('Use the table below for exact values.', 'Přesné hodnoty najdete v tabulce níže.')}</desc><rect width="870" height="472" fill="#faf7ef"/><g font-family="Arial,Helvetica,sans-serif" fill="#171918"><rect x="175" y="12" width="14" height="10" fill="#a8b63f"/><text x="197" y="22" font-size="12">${revenue}</text><rect x="305" y="12" width="14" height="10" fill="#8b8d83"/><text x="327" y="22" font-size="12">${spending}</text><text x="850" y="22" text-anchor="end" font-size="12">${balance} · % ${text('GDP', 'HDP')}</text>${Array.from({length: max / 20 + 1}, (_, i) => i * 20).filter(v => v <= max).map(v => `<line x1="${left + scaled(v)}" y1="48" x2="${left + scaled(v)}" y2="407" stroke="#d2ccc1"/><text x="${left + scaled(v)}" y="436" text-anchor="middle" font-size="11">${v}</text>`).join('')}${rows.map((r, i) => { const y = top + i * step; return `<g>${r.code === state.country ? `<rect x="0" y="${y - 11}" width="3" height="49" fill="#c93237"/>` : ''}<text x="155" y="${y + 12}" text-anchor="end" font-size="14" font-weight="${r.code === state.country ? 700 : 400}">${escape(t(r.name))}</text>${['revenue', 'spending'].map((key, j) => r[key] ? `<rect x="${left}" y="${y - 8 + j * 20}" width="${scaled(r[key].value)}" height="13" fill="${j ? '#8b8d83' : '#a8b63f'}"/><text x="${left + scaled(r[key].value) + 7}" y="${y + 3 + j * 20}" font-size="12">${format(r[key].value)}</text>` : '').join('')}<text x="850" y="${y + 12}" text-anchor="end" fill="${r.balance?.value < 0 ? '#c93237' : '#171918'}" font-size="16">${r.balance ? format(r.balance.value) : '—'}</text></g>`; }).join('')}<text x="430" y="461" text-anchor="middle" font-size="12">% ${text('of GDP · 2024 · general government', 'HDP · 2024 · vládní instituce')}</text></g></svg>`;
  host.innerHTML = `<div class="systems-fiscal-plot">${svg}</div><button type="button" class="systems-source-line" id="fiscal-source">${text('Source: IMF WEO, April 2026 · 2024 observations · definition & data ↗', 'Zdroj: IMF WEO, duben 2026 · pozorování 2024 · definice a data ↗')}</button>`;
  if (window.PSDChart) window.PSDChart.register({
    slug: 'funding-systems-fiscal-scale', el: host, title: () => t(copy.fiscalTitle),
    columns: [{key: 'country', label: text('Country', 'Země')}, {key: 'year', label: text('Year', 'Rok')}, {key: 'revenue', label: `${revenue} (% GDP)`, numeric: true}, {key: 'spending', label: `${spending} (% GDP)`, numeric: true}, {key: 'balance', label: `${balance} (% GDP)`, numeric: true}, {key: 'status', label: text('Source status', 'Stav zdroje')}],
    rows: () => rows.map(r => ({country: t(r.name), year: r.year, revenue: r.revenue?.value ?? null, spending: r.spending?.value ?? null, balance: r.balance?.value ?? null, status: [...new Set([r.revenue, r.spending, r.balance].filter(Boolean).map(p => p.status))].join(' / ')})),
    exports: ['csv', 'png'], embeddable: false,
    source: { name: 'IMF · World Economic Outlook, April 2026', url: benchmark.source.download_page || benchmark.source.url, definition: t(copy.fiscalIntro), excludes: text('Private insurance, household direct spending and market public corporations. Not a central-budget or sector-spending comparison.', 'Soukromé pojištění, přímé výdaje domácností a tržní veřejné podniky. Nejde o srovnání státních rozpočtů či výdajů odvětví.'), caveat: t(copy.fiscalNote), table: benchmark.source_table, edition: 'WEO April 2026 · 2024', extracted: text('Source extraction not separately recorded. Local dataset generated: ', 'Stažení zdroje není samostatně zaznamenáno. Místní dataset vytvořen: ') + benchmark.source_generated_at, vintage: rows.every(r => [r.revenue, r.spending, r.balance].every(p => p?.status === 'actual')) ? 'actual' : 'mixed' },
  });
  $('#fiscal-source').addEventListener('click', () => host.querySelector('[data-action="sources"]')?.click());
}

function select(next, target) {
  state = { ...state, ...next };
  const url = new URL(location.href);
  url.searchParams.set('country', state.country);
  url.searchParams.set('topic', state.topic);
  url.searchParams.set('lang', lang);
  history.pushState(null, '', url);
  render();
  // Preserve keyboard focus when controls are rebuilt.
  if (target) document.querySelector(target)?.focus({ preventScroll: true });
}
document.addEventListener('click', event => {
  const country = event.target.closest('[data-country]');
  if (country) {
    const inTable = Boolean(country.closest('table'));
    select({country: country.dataset.country}, `${inTable ? '#comparison-table' : '#country-picker'} [data-country="${country.dataset.country}"]`);
    if (inTable) $('#system-map').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  const topic = event.target.closest('[data-topic]');
  if (topic) select({topic: topic.dataset.topic}, `[data-topic="${topic.dataset.topic}"]`);
  if (event.target.closest('#expand-routes')) {
    const expand = [...document.querySelectorAll('.systems-route')].some(route => !route.open);
    document.querySelectorAll('.systems-route').forEach(route => { route.open = expand; });
    $('#expand-routes').textContent = expand ? text('Collapse explanations −', 'Sbalit vysvětlení −') : t(copy.expand);
  }
  const language = event.target.closest('[data-lang]');
  if (language && ['en', 'cs'].includes(language.dataset.lang)) {
    const url = new URL(location.href);
    url.searchParams.set('lang', language.dataset.lang);
    history.replaceState(null, '', url);
    window.PSDLanguage?.set(language.dataset.lang, {persist: true});
  }
});
addEventListener('psdlanguagechange', () => { lang = document.documentElement.lang === 'cs' ? 'cs' : 'en'; render(); });
addEventListener('popstate', () => {
  state = parseState(location.search);
  const requested = new URLSearchParams(location.search).get('lang');
  if (['cs', 'en'].includes(requested) && requested !== lang && window.PSDLanguage) window.PSDLanguage.set(requested, {persist: false});
  else render();
});
render();
try {
  const response = await fetch('data/funding-systems-benchmark.v1.json');
  if (!response.ok) throw new Error(`Benchmark: ${response.status}`);
  const data = await response.json();
  if (data.year !== 2024 || data.scope !== 'general_government' || data.rows?.length !== 5 || countries.some(c => !data.rows.find(r => r.code === c.code))) throw new Error('Unexpected benchmark scope');
  benchmark = data;
} catch (error) {
  console.error(error);
  benchmarkFailed = true;
}
renderFiscal();
