(async function () {
  'use strict';
  // The budget viewer for any Czech municipality, keyed by IČO (data-ico on #budget-app,
  // or ?ico=). Sections appear only when the municipality publishes their data:
  //   every municipality  -> overview, where the money goes, life in the city, sources
  //   CityVizor profile   -> published records (statements, projects, ledger, IT)
  //   an extension entry  -> districts, contracts, city companies (extensions registry)
  const app = document.querySelector('#budget-app');
  const query = new URLSearchParams(location.search);
  const lang = ['en', 'cs'].includes(query.get('lang')) ? query.get('lang') : document.documentElement.lang === 'cs' ? 'cs' : 'en';
  document.documentElement.lang = lang;
  const T = (en, cs) => lang === 'cs' ? cs : en;
  const reloadIn = next => { if (['en', 'cs'].includes(next) && next !== lang) { const url = new URL(location.href); url.searchParams.set('lang', next); location.href = url.href; } };
  window.addEventListener('psdlanguagechange', event => reloadIn(event.detail?.lang));
  document.addEventListener('click', event => { const control = event.target.closest('[data-lang]'); if (control) { event.preventDefault(); reloadIn(control.dataset.lang); } });
  const locale = lang === 'cs' ? 'cs-CZ' : 'en-GB';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = selector => app.querySelector(selector);
  const number = (value, digits = 0) => Number.isFinite(value) ? new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value) : '—';
  const exact = value => Number.isFinite(value) ? `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${T('CZK', 'Kč')}` : `— ${T('CZK', 'Kč')}`;
  const short = value => !Number.isFinite(value) ? '—' : Math.abs(value) >= 1e9 ? `${number(value / 1e9, 1)} ${T('bn', 'mld.')}` : Math.abs(value) >= 1e6 ? `${number(value / 1e6, 1)} ${T('m', 'mil.')}` : number(value);
  const money = value => `${short(value)} ${T('CZK', 'Kč')}`;
  const signed = value => `${value > 0 ? '+' : ''}${money(value)}`;
  const percent = value => Number.isFinite(value) ? `${number(value, 1)}%` : '—';
  const safeLink = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? esc(url.href) : ''; } catch { return ''; } };
  const link = (url, label) => safeLink(url) ? `<a href="${safeLink(url)}" target="_blank" rel="noreferrer">${esc(label)}</a>` : esc(label);
  const Data = window.MunicipalBudgetData, Labels = window.CzBudgetLabels, Math2 = window.PrahaBudgetMath, Spending = window.PrahaSpending;
  const ico = app.dataset.ico || query.get('ico') || '';

  function fatal(title, body) {
    app.setAttribute('aria-busy', 'false');
    app.innerHTML = `<div class="pb-shell pb-fatal"><h1>${title}</h1><p>${body}</p><p><a class="pb-button" href="/cz-obce.html">${T('Find a municipality', 'Najít obec')}</a></p></div>`;
  }
  if (!Data.validIco(ico)) { fatal(T('Choose a municipality', 'Vyberte obec'), T('This page needs the municipality’s eight-digit IČO, for example ?ico=00064581.', 'Stránka potřebuje osmimístné IČO obce, například ?ico=00064581.')); return; }

  const client = Data.createClient({ ico });
  const monitor = year => Data.monitorUrl(ico, year);
  const views = ['services', 'cost', 'revenue'], recordTabs = ['statements', 'projects', 'ledger', 'it', 'companies'];
  const state = { year: Number(query.get('year')) || null, unit: query.get('unit') === 'per-capita' ? 'per-capita' : 'total', currency: ['EUR', 'USD'].includes(query.get('currency')) ? query.get('currency') : 'CZK', trend: query.get('trend') === 'split' ? 'split' : 'balance', stage: 'actual', view: views.includes(query.get('view')) ? query.get('view') : 'services', group: query.get('group') || '', purpose: query.get('purpose') || null, records: recordTabs.includes(query.get('records')) ? query.get('records') : 'statements', ledgerPurpose: null, ledgerKind: 'payments', ledgerPage: 0, projectService: 'all', project: query.get('project') || null, projectTab: 'invoices', projectVendor: null, detail: null, payments: null, context: null, livingCost: null, overview: null, request: 0 };
  const itState = { profiles: [], key: null, item: 'it', result: null, loaded: false, loading: false, vendor: null, page: 0, request: 0, error: null, started: false };
  const itLabels = { 'it': ['All identified IT · five codes', 'Veškeré doložitelné IT · pět položek'], '5168': ['Data processing & ICT services', 'Zpracování dat a ICT služby'], '5042': ['Software usage fees', 'Odměny za užití programů'], '5172': ['Small software purchases', 'Programové vybavení pod limitem'], '6111': ['Software capital assets', 'Programové vybavení · investice'], '6125': ['Computing equipment', 'Výpočetní technika'], '5162': ['Telecommunications · separate', 'Elektronické komunikace · samostatně'] };
  const chartControllers = new Map();
  let chartReady = false, statements = null, nodes = [], fxData = null;

  const city = () => state.overview.city, ext = () => state.overview.extension, records = () => state.overview.records;
  const name = row => lang === 'cs' ? row.name_cs || row.name || row.code : row.name_en || (row.dimension === 'economic' && Labels?.economic[row.code]) || (row.dimension === 'functional' && Labels?.purpose[row.code]) || row.name_cs || row.name || row.code;
  const projectName = row => lang === 'en' && ext()?.projectNames?.[row.code] || row.name || T('Project not identified', 'Akce neurčena');
  const yearRow = () => state.overview.history.find(row => row.year === state.year);
  const fxFactor = year => {
    if (state.currency === 'CZK') return 1;
    const localPerUsd = fxData?.rates?.CZE?.years?.[year]?.local_per_usd;
    const euroPerUsd = fxData?.eur_per_usd?.[year];
    return Number.isFinite(localPerUsd) && localPerUsd > 0 && Number.isFinite(euroPerUsd) && euroPerUsd > 0
      ? (state.currency === 'EUR' ? euroPerUsd : 1) / localPerUsd : null;
  };
  const budgetValue = (value, year = state.year) => Number.isFinite(value) && fxFactor(year) !== null ? value * fxFactor(year) : null;
  const currencyLabel = () => state.currency === 'CZK' && lang === 'cs' ? 'Kč' : state.currency;
  const budgetMoney = value => `${short(value)} ${currencyLabel()}`;
  const budgetExact = (value, year = state.year) => Number.isFinite(budgetValue(value, year)) ? `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(budgetValue(value, year))} ${currencyLabel()}` : `— ${currencyLabel()}`;
  const shownValue = (value, row = yearRow()) => state.unit === 'per-capita' ? Number.isFinite(value) && row?.population_mid_year > 0 ? budgetValue(value, row.year) / row.population_mid_year : null : budgetValue(value, row?.year);
  const unit = () => state.unit === 'per-capita' ? `${currencyLabel()} ${T('per resident', 'na obyvatele')}` : `${currencyLabel()} · ${T('nominal', 'běžné ceny')}`;
  const shownMoney = value => budgetMoney(shownValue(value));
  const displayedExact = value => `${Number.isFinite(value) ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) : '—'} ${currencyLabel()}${state.unit === 'per-capita' ? T(' / resident', ' / obyv.') : ''}`;
  const budgetSigned = value => `${value > 0 ? '+' : ''}${budgetMoney(value)}`;
  const stageLabel = stage => ({ actual: T('Actual', 'Skutečnost'), approved: T('Approved budget', 'Schválený rozpočet'), adjusted: T('Revised budget', 'Upravený rozpočet') })[stage];
  function writeURL() {
    const url = new URL(location.href);
    const set = (key, value, fallback) => { if (value && value !== fallback) url.searchParams.set(key, value); else url.searchParams.delete(key); };
    url.searchParams.set('year', state.year); url.searchParams.set('lang', lang);
    set('unit', state.unit, 'total'); set('currency', state.currency, 'CZK'); set('trend', state.trend, 'balance'); set('view', state.view, 'services'); set('group', state.group); set('purpose', state.purpose); set('records', records() ? state.records : '', 'statements'); set('project', state.records === 'projects' ? state.project : '');
    history.replaceState(null, '', url);
  }
  function plot(id, spec, source) {
    const host = $(id); if (!chartReady || !host) return;
    chartControllers.get(id)?.destroy?.();
    host.replaceChildren(); const plotHost = document.createElement('div'); plotHost.className = 'pb-plot'; host.append(plotHost);
    const controller = window.PSDPlot.render(plotHost, { locale, animate: false, ...spec });
    chartControllers.set(id, controller);
    window.PSDChart.register({ el: host, slug: id.slice(1), title: spec.title, accessor: controller.accessor, exports: [], embeddable: false, source });
    // A reading view: tables and provenance, no raw-download controls.
    host.querySelector('[data-action="csv"]')?.remove();
  }
  const clearCharts = ids => { for (const id of ids) { chartControllers.get(id)?.destroy?.(); chartControllers.delete(id); } };
  const metric = (label, value, note, attrs = '') => `<div class="pb-metric"><span>${label}</span><strong ${attrs}>${value}</strong><small>${note}</small></div>`;
  const section = (id, title, lead, body) => `<section class="pb-section" id="${id}" aria-labelledby="${id}-title"><div class="pb-shell"><header class="pb-section-head"><h2 id="${id}-title">${title}</h2>${lead ? `<p>${lead}</p>` : ''}</header>${body}</div></section>`;
  const typeLabel = type => ({ capital_city: T('Capital city', 'Hlavní město'), statutory_city: T('Statutory city', 'Statutární město'), town: T('Town', 'Město'), city: T('City', 'Město'), market_town: T('Market town', 'Městys'), municipality: T('Municipality', 'Obec') })[type] || T('Municipality', 'Obec');

  // ---------------------------------------------------------------- shell
  function shell() {
    const c = city(), hasRecords = !!records(), years = state.overview.history.map(row => row.year);
    const navItems = [['overview', T('Overview', 'Přehled')], ['spending', T('Where the money goes', 'Kam jdou peníze')], ...(hasRecords ? [['records', T('Records', 'Záznamy')]] : []), ...(ext()?.connectedResults ? [['connections', T('Connections and coverage', 'Vazby a pokrytí')]] : []), ['outcomes', T('Local life', 'Místní život')], ['evidence', T('Sources', 'Zdroje')]];
    const scopeNote = ext()?.scopeNote?.[lang] || T('The municipality’s own budget as reported to the Ministry of Finance, after consolidation.', 'Vlastní rozpočet obce vykázaný Ministerstvu financí, po konsolidaci.');
    app.innerHTML = `
      <header class="pb-head"><div class="pb-shell">
        <nav class="pb-crumbs" aria-label="${T('Breadcrumb', 'Drobečková navigace')}"><a href="/cz-obce.html">${T('Czech municipalities', 'České obce')}</a><span aria-hidden="true">/</span>${c.profilePath ? `<a href="${esc(c.profilePath)}">${esc(c.name)}</a>` : esc(c.name)}<span aria-hidden="true">/</span><span>${T('Budget', 'Rozpočet')}</span></nav>
        <h1>${esc(c.name)} <span>${T('budget', 'rozpočet')}</span></h1>
        <p class="pb-sub">${[typeLabel(c.type), c.region, `IČO ${esc(c.ico)}`, Number.isFinite(c.population) ? `${number(c.population)} ${T('residents', 'obyvatel')}` : null].filter(Boolean).map(esc).join(' · ')}</p>
      </div></header>
      <div class="pb-bar"><div class="pb-shell pb-bar-inner">
        <label class="pb-control"><span>${T('Year', 'Rok')}</span><select id="budget-year">${years.slice().reverse().map(year => `<option value="${year}">${year}</option>`).join('')}</select></label>
        <label class="pb-control"><span>${T('Show', 'Zobrazit')}</span><select id="budget-unit"><option value="total">${T('Total', 'Celkem')}</option><option value="per-capita">${T('Per resident', 'Na obyvatele')}</option></select></label>
        <label class="pb-control"><span>${T('Budget currency', 'Měna rozpočtu')}</span><select id="budget-currency"><option value="CZK">CZK</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
        <nav class="pb-nav" aria-label="${T('Sections', 'Části stránky')}">${navItems.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}</nav>
      </div></div>
      ${section('overview', T('Overview', 'Přehled'), esc(scopeNote), `
        <p class="pb-note" id="budget-currency-note"></p>
        <div class="pb-metrics" id="headline-metrics"></div>
        <details class="pb-disclosure" id="exact-figures"><summary>${T('Exact figures and definitions', 'Přesné částky a definice')}</summary><div id="exact-figures-body"></div></details>
        <div class="pb-card">
          <div class="pb-card-head"><h3 id="trajectory-title"></h3><div class="pb-segmented" role="group" aria-label="${T('Chart series', 'Řady grafu')}"><button type="button" data-trend="balance">${T('Revenue and spending', 'Příjmy a výdaje')}</button><button type="button" data-trend="split">${T('Operating and capital', 'Běžné a kapitálové')}</button></div></div>
          <div id="trajectory-chart"></div>
          <p class="pb-note" id="change-story"></p>
        </div>`)}
      ${section('spending', T('Where the money goes', 'Kam jdou peníze'), T('Choose an area to see the budget lines inside it. Every line is one reported classification code; the areas add up to the total.', 'Vyberte oblast a uvidíte rozpočtové řádky uvnitř. Každý řádek je jeden vykázaný kód klasifikace; oblasti dávají dohromady celek.'), `
        <div class="pb-toolbar">
          <div class="pb-segmented" role="group" aria-label="${T('Split the budget by', 'Rozdělit rozpočet podle')}" id="spending-view">${[['services', T('By service', 'Podle služeb')], ['cost', T('By type of cost', 'Podle druhu výdaje')], ['revenue', T('Revenue', 'Příjmy')]].map(([id, label]) => `<button type="button" data-view="${id}">${label}</button>`).join('')}</div>
          <label class="pb-field"><span>${T('Stage', 'Fáze')}</span><select id="budget-stage"><option value="actual">${stageLabel('actual')}</option><option value="approved">${stageLabel('approved')}</option><option value="adjusted">${stageLabel('adjusted')}</option></select></label>
          <label class="pb-field pb-field-grow"><span>${T('Find a line', 'Hledat řádek')}</span><input id="budget-search" type="search" placeholder="${T('Schools, roads, 3113…', 'Školy, silnice, 3113…')}"></label>
        </div>
        <div class="pb-path"><nav id="spending-path" aria-label="${T('Current selection', 'Aktuální výběr')}"></nav><p id="budget-status" role="status"></p></div>
        <div class="pb-explorer">
          <div id="spending-map" class="pb-map"></div>
          <div class="pb-list"><table class="pb-table" id="budget-table"><thead><tr><th>${T('Line', 'Řádek')}</th><th>${T('Amount', 'Částka')}</th><th>${T('Share', 'Podíl')}</th></tr></thead><tbody></tbody></table></div>
        </div>
        <div id="purpose-detail" class="pb-panel" hidden></div>${ext()?.connectedResults ? `<div id="source-comparison" class="pb-card"></div>` : ''}`)}
      ${hasRecords ? recordsShell() : ''}
      ${ext()?.connectedResults ? connectionsShell() : ''}
      ${section('outcomes', T(`Life in ${c.name}`, `Život v obci ${c.name}`), T('Local conditions next to the budget. A correlation is a question to investigate, not proof that spending caused the change.', 'Místní podmínky vedle rozpočtu. Korelace je otázka k prověření, nikoli důkaz, že změnu způsobily výdaje.'), `
        <div class="pb-toolbar"><label class="pb-field pb-field-grow"><span>${T('Indicator', 'Ukazatel')}</span><select id="context-series"><option>${T('Loading…', 'Načítání…')}</option></select></label><label class="pb-field"><span>${T('Compare with', 'Porovnat s')}</span><select id="context-budget"><option value="expense_actual">${T('Total spending', 'Celkové výdaje')}</option><option value="capital_expense">${T('Capital spending', 'Kapitálové výdaje')}</option><option value="current_expense">${T('Operating spending', 'Běžné výdaje')}</option></select></label><label class="pb-field"><span>${T('Lag', 'Zpoždění')}</span><select id="context-lag"><option value="0">${T('Same year', 'Stejný rok')}</option><option value="1">${T('One year later', 'O rok později')}</option></select></label></div>
        <div class="pb-outcome-grid"><div class="pb-card"><h3 class="pb-card-title" id="context-title"></h3><div id="context-chart"></div></div><aside class="pb-context-detail" id="context-detail"><p role="status">${T('Loading published observations…', 'Načítání publikovaných pozorování…')}</p></aside></div>${ext()?.livingCostApi ? `<div class="pb-card" id="living-cost"><p role="status">${T('Loading living-cost context…', 'Načítání nákladů na život…')}</p></div>` : ''}`)}
      ${section('evidence', T('Sources and limits', 'Zdroje a omezení'), '', `<div class="pb-sources" id="evidence-list"></div>
        <ul class="pb-rules">${[T('Amounts are nominal CZK. Per resident divides by that year’s mid-year population.', 'Částky jsou v běžných Kč. Na obyvatele dělí populací daného roku k 1. 7.'), T('Missing values stay missing; they are never shown as zero.', 'Chybějící hodnoty zůstávají chybějícími; nikdy je neukazujeme jako nulu.'), T('Services, types of cost and records are different views of the same money. Never add them together.', 'Služby, druhy výdajů a záznamy jsou různé pohledy na tytéž peníze. Nikdy je nesčítejte.'), T('The budget is not a balance sheet of the whole local economy, and it excludes city-owned companies.', 'Rozpočet není rozvahou celé místní ekonomiky a nezahrnuje městské firmy.')].map(item => `<li>${item}</li>`).join('')}</ul>`)}
      <dialog id="record-dialog" class="pb-dialog"><div class="pb-dialog-head"><h2 id="record-title"></h2><button type="button" id="record-close" aria-label="${T('Close details', 'Zavřít detail')}">×</button></div><div class="pb-dialog-body" id="record-body"></div></dialog>`;
    bind();
    $('#source-comparison')?.addEventListener('click', event => {
      const row=event.target.closest('[data-source-node]');
      if(row) activate(nodes[Number(row.dataset.sourceNode)]);
      if(event.target.closest('[data-source-load]')) loadPayments();
    });
  }

  function recordsShell() {
    const profile = records();
    const tabs = [['statements', T('Annual statements', 'Roční výkazy')], ['projects', T('Projects and suppliers', 'Akce a dodavatelé')], ['ledger', T('All records', 'Všechny záznamy')], ['it', T('Technology', 'Technologie')], ...(ext()?.companies ? [['companies', T('City companies', 'Městské firmy')]] : [])];
    const sourceUrl = profile.profile_url || ext()?.recordsUrl;
    return section('records', T('Published records', 'Publikované záznamy'), `${T(`${esc(profile.name)} publishes its accounting and invoice allocations on CityVizor. The records are partial and overlap the budget above, so they are never added to it.`, `${esc(profile.name)} zveřejňuje účetnictví a fakturační alokace na CityVizoru. Záznamy jsou dílčí a překrývají se s rozpočtem výše, proto se k němu nikdy nepřičítají.`)} ${link(sourceUrl, 'CityVizor')}`, `
      <div class="pb-tabs" role="tablist" aria-label="${T('Record views', 'Pohledy na záznamy')}">${tabs.map(([id, label]) => `<button type="button" role="tab" id="records-tab-${id}" data-records-tab="${id}" aria-controls="records-${id}">${label}</button>`).join('')}</div>
      <div class="pb-tabpanel" id="records-statements" role="tabpanel" aria-labelledby="records-tab-statements"></div>
      <div class="pb-tabpanel" id="records-projects" role="tabpanel" aria-labelledby="records-tab-projects" hidden>
        <div class="pb-toolbar"><label class="pb-field"><span>${T('Service', 'Služba')}</span><select id="project-service"></select></label><label class="pb-field pb-field-grow"><span>${T('Find a project or supplier', 'Hledat akci nebo dodavatele')}</span><input id="project-search" type="search" placeholder="${T('Project, supplier, IČO…', 'Akce, dodavatel, IČO…')}"></label></div>
        <div class="pb-workspace"><div class="pb-projects"><p class="pb-note" id="project-count"></p><div id="project-list"></div></div><div id="project-inspector" class="pb-inspector" aria-live="polite"></div></div>
      </div>
      <div class="pb-tabpanel" id="records-ledger" role="tabpanel" aria-labelledby="records-tab-ledger" hidden>
        <div class="pb-toolbar"><label class="pb-field"><span>${T('Record type', 'Typ záznamu')}</span><select id="ledger-kind"><option value="payments">${T('Invoice allocations', 'Fakturační alokace')}</option><option value="accounting">${T('Accounting rows', 'Účetní řádky')}</option><option value="projects">${T('Named projects', 'Pojmenované akce')}</option></select></label><label class="pb-field pb-field-grow"><span>${T('Search', 'Hledat')}</span><input id="ledger-search" type="search" placeholder="${T('Supplier, IČO, project, code…', 'Dodavatel, IČO, akce, kód…')}"></label><button id="ledger-load" class="pb-button" type="button">${T('Load invoice records', 'Načíst fakturační záznamy')}</button></div>
        <div id="ledger-purpose-filter" class="pb-filter-chip" hidden></div><p class="pb-note" id="ledger-status" role="status"></p>
        <div class="pb-table-wrap"><table id="ledger-table" class="pb-table"><thead></thead><tbody></tbody></table></div><div class="pb-pagination" id="ledger-pagination"></div>
      </div>
      <div class="pb-tabpanel" id="records-it" role="tabpanel" aria-labelledby="records-tab-it" hidden>
        <div class="pb-toolbar"><label class="pb-field"><span>${T('Authority', 'Úřad')}</span><select id="it-profile" disabled><option>${T('Loading…', 'Načítání…')}</option></select></label><label class="pb-field"><span>${T('IT category', 'IT kategorie')}</span><select id="it-item">${Object.entries(itLabels).map(([code, labels]) => `<option value="${code}">${T(...labels)}</option>`).join('')}</select></label><button type="button" id="it-load" class="pb-button" disabled>${T('Show suppliers and invoices', 'Zobrazit dodavatele a faktury')}</button></div>
        <p class="pb-note" id="it-status" role="status"></p><div id="it-metrics" class="pb-metrics"></div>
        <details class="pb-disclosure"><summary>${T('Which accounting items count as IT?', 'Které účetní položky se počítají jako IT?')}</summary><div id="it-codes" class="pb-table-wrap"></div></details>
        <div id="it-results" hidden><label class="pb-field pb-field-grow"><span>${T('Find a supplier, system or description', 'Hledat dodavatele, systém nebo popis')}</span><input id="it-search" type="search" placeholder="${T('GINIS, software, supplier…', 'GINIS, software, dodavatel…')}"></label>
          <div class="pb-it-grid"><div><h4>${T('Suppliers', 'Dodavatelé')}</h4><div class="pb-table-wrap pb-scroll"><table id="it-vendors" class="pb-table"><thead><tr><th>${T('Supplier', 'Dodavatel')}</th><th>${T('Amount', 'Částka')}</th></tr></thead><tbody></tbody></table></div></div>
          <div><div class="pb-it-record-heading"><h4 id="it-record-heading">${T('Invoice allocations', 'Fakturační alokace')}</h4><button type="button" id="it-clear-vendor" class="pb-button secondary" hidden>${T('All suppliers', 'Všichni dodavatelé')}</button></div><div class="pb-table-wrap"><table id="it-invoices" class="pb-table"><thead><tr><th>${T('Date / what was bought', 'Datum / co bylo pořízeno')}</th><th>${T('Amount', 'Částka')}</th></tr></thead><tbody></tbody></table></div><div class="pb-pagination" id="it-pagination"></div></div></div></div>
      </div>
      ${ext()?.companies ? `<div class="pb-tabpanel" id="records-companies" role="tabpanel" aria-labelledby="records-tab-companies" hidden><p>${T('Payments the city recorded to companies it owns, identified by exact IČO. Company revenue, costs and profit come from each company’s own accounts and are not part of the city budget.', 'Platby, které město vykázalo vlastním firmám, určeným přesným IČO. Výnosy, náklady a zisk firem pocházejí z jejich vlastních účtů a nejsou součástí rozpočtu města.')}</p><button type="button" id="company-load" class="pb-button">${T('Load invoice records', 'Načíst fakturační záznamy')}</button><div id="company-lines" aria-live="polite"></div></div>` : ''}`);
  }

  function bind() {
    $('#budget-year').value = state.year; $('#budget-unit').value = state.unit; $('#budget-currency').value = state.currency;
    $('#budget-year').addEventListener('change', event => selectYear(Number(event.target.value)));
    $('#budget-unit').addEventListener('change', event => { state.unit = event.target.value; writeURL(); renderOverview(); renderSpending(); renderContext(); });
    $('#budget-currency').addEventListener('change', event => { state.currency = event.target.value; writeURL(); renderOverview(); renderSpending(); if (ext()?.connectedResults) renderConnections(); });
    app.addEventListener('click', event => { const trend = event.target.closest('[data-trend]'); if (trend) { state.trend = trend.dataset.trend; writeURL(); renderTrajectory(); } });
    $('#spending-view').addEventListener('click', event => { const view = event.target.closest('[data-view]'); if (view) { state.view = view.dataset.view; state.group = ''; state.purpose = null; writeURL(); renderSpending(); } });
    $('#budget-stage').addEventListener('change', event => { state.stage = event.target.value; renderSpending(); });
    $('#budget-search').addEventListener('input', () => renderSpending());
    $('#spending-path').addEventListener('click', event => { const up = event.target.closest('[data-path]'); if (up) { state.group = up.dataset.path === 'root' ? '' : state.group; state.purpose = null; $('#budget-search').value = ''; writeURL(); renderSpending(); } });
    $('#budget-table').addEventListener('click', event => { const row = event.target.closest('[data-node]'); if (row) activate(nodes[Number(row.dataset.node)]); });
    $('#purpose-detail').addEventListener('click', event => {
      if (event.target.closest('[data-purpose-close]')) { state.purpose = null; writeURL(); renderPurposeDetail(); renderSpendingList(); }
      if (event.target.closest('[data-purpose-invoices]')) inspectPurposeRecords('payments');
      if (event.target.closest('[data-purpose-accounting]')) inspectPurposeRecords('accounting');
    });
    ['#context-series', '#context-budget', '#context-lag'].forEach(id => $(id).addEventListener('change', renderContext));
    $('#record-close').addEventListener('click', () => $('#record-dialog').close());
    $('#record-dialog').addEventListener('click', event => { if (event.target === $('#record-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
    $('#record-body').addEventListener('click', event => { const b = event.target.closest('[data-invoice-peer]'); if (b) { const r = invoiceContext?.peers[Number(b.dataset.invoicePeer)]; if (r) openInvoice(r, invoiceContext.context); } });
    $('#record-body').addEventListener('submit', event => { if (event.target.id === 'related-contract-form') { event.preventDefault(); loadRelatedContracts(event.target); } });
    if (records()) bindRecords();
    if (ext()?.connectedResults) bindConnections();
  }

  // ---------------------------------------------------------------- overview
  function renderOverview() {
    const row = yearRow(), previous = state.overview.history.find(item => item.year === state.year - 1);
    const rate = fxData?.rates?.CZE?.years?.[state.year]?.local_per_usd;
    const sourceUrl = fxData?.sources?.find(source => source.provider === 'ECB')?.url;
    $('#budget-currency-note').innerHTML = !fxData
      ? T('Budget amounts are reported in CZK. Currency conversion is unavailable because annual rates could not be loaded.', 'Rozpočtové částky jsou vykázány v Kč. Přepočet měn není dostupný, protože se nepodařilo načíst roční kurzy.')
      : state.currency === 'CZK'
      ? T('Budget amounts are reported in CZK. EUR and USD views use each year’s annual exchange rate. Published records remain in source CZK.', 'Rozpočtové částky jsou vykázány v Kč. Pohledy v EUR a USD používají roční kurz daného roku. Publikované záznamy zůstávají v původních Kč.')
      : `${T('Budget amounts are converted from CZK using each year’s ECB annual average.', 'Rozpočtové částky jsou přepočteny z Kč ročním průměrným kurzem ECB pro každý rok.')} ${state.year}: 1 ${state.currency} ≈ ${number(state.currency === 'EUR' ? rate / fxData.eur_per_usd[state.year] : rate, 2)} CZK. ${T('Published records remain in source CZK.', 'Publikované záznamy zůstávají v původních Kč.')} ${link(sourceUrl, 'ECB ↗')}`;
    $('#exact-figures summary').textContent = state.currency === 'CZK' ? T('Exact figures and definitions', 'Přesné částky a definice') : T('Converted figures and definitions', 'Přepočtené částky a definice');
    const perPerson = state.unit === 'per-capita' ? '' : ` · ${budgetMoney(budgetValue(row.expense_actual / row.population_mid_year))} ${T('per resident', 'na obyvatele')}`;
    $('#headline-metrics').innerHTML =
      metric(T('Revenue', 'Příjmy'), shownMoney(row.revenue_actual), `${state.year} · ${unit()}`) +
      metric(T('Spending', 'Výdaje'), shownMoney(row.expense_actual), `${Number.isFinite(row.expense_adjusted) && row.expense_adjusted > 0 ? `${percent(row.expense_actual / row.expense_adjusted * 100)} ${T('of revised plan', 'upraveného plánu')}` : unit()}${perPerson}`, 'id="kpi-spending"') +
      metric(T('Balance', 'Saldo'), `${shownValue(row.budget_balance) > 0 ? '+' : ''}${shownMoney(row.budget_balance)}`, T('Revenue minus spending', 'Příjmy minus výdaje'), `class="${row.budget_balance < 0 ? 'pb-negative' : ''}"`) +
      metric(T('Cash and deposits', 'Peníze a vklady'), shownMoney(row.cash_current), `${T('31 December', '31. prosince')} ${state.year} · ${T('a year-end stock', 'stav ke konci roku')}`);
    const cashChange = [row.cash_current, row.cash_previous].every(Number.isFinite) ? row.cash_current - row.cash_previous : null;
    $('#exact-figures-body').innerHTML = `<div class="pb-table-wrap"><table class="pb-table"><tbody>${[[T('Revenue', 'Příjmy'), row.revenue_actual], [T('Spending', 'Výdaje'), row.expense_actual], [T('Operating spending', 'Běžné výdaje'), row.current_expense], [T('Capital spending', 'Kapitálové výdaje'), row.capital_expense], [T('Balance (revenue minus spending)', 'Saldo (příjmy minus výdaje)'), row.budget_balance], [`${T('Cash and deposits, 31 December', 'Peníze a vklady k 31. prosinci')} ${state.year}`, row.cash_current], [T('Cash at the previous year-end', 'Peníze ke konci předchozího roku'), row.cash_previous], [T('Change in cash', 'Změna peněz'), cashChange], [T('Mid-year population', 'Počet obyvatel k 1. 7.'), null, number(row.population_mid_year)]].map(([label, value, text]) => `<tr><th scope="row">${label}</th><td class="pb-currency">${text ?? budgetExact(value)}</td></tr>`).join('')}</tbody></table></div><p class="pb-note">${T('Cash is a year-end stock, not annual revenue or spendable reserves; its change need not equal the balance. From 2012 it sums balance-sheet accounts 068, 231, 236, 241, 244, 261 and 262 (2010–2011: current-account balances).', 'Peníze jsou stav ke konci roku, nikoli roční příjmy ani volné rezervy; jejich změna se nemusí rovnat saldu. Od roku 2012 jde o součet rozvahových účtů 068, 231, 236, 241, 244, 261 a 262 (2010–2011: zůstatky běžných účtů).')} ${link(Data.balanceSheetUrl(ico, state.year), T('MONITOR balance sheet', 'Rozvaha v MONITORU'))}</p>`;
    if (previous) {
      const total = row.expense_actual - previous.expense_actual, current = row.current_expense - previous.current_expense, capital = row.capital_expense - previous.capital_expense;
      $('#change-story').textContent = T(`In source CZK, spending changed by ${signed(total)} (${percent((row.expense_actual / previous.expense_actual - 1) * 100)}) from ${previous.year}: operating ${signed(current)}, capital ${signed(capital)}. Nominal, not adjusted for inflation.`, `V původních Kč se výdaje oproti roku ${previous.year} změnily o ${signed(total)} (${percent((row.expense_actual / previous.expense_actual - 1) * 100)}): běžné ${signed(current)}, kapitálové ${signed(capital)}. V běžných cenách, bez očištění o inflaci.`);
    } else $('#change-story').textContent = T('The previous year is outside the published history.', 'Předchozí rok není v publikované historii.');
    renderTrajectory();
  }
  function renderTrajectory() {
    app.querySelectorAll('[data-trend]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.trend === state.trend)));
    const years = state.overview.history, span = `${years[0].year}–${years.at(-1).year}`;
    const fields = state.trend === 'split'
      ? [{ key: 'current_expense', label: T('Operating spending', 'Běžné výdaje'), color: '#a8b63f', value: item => shownValue(item.current_expense, item) }, { key: 'capital_expense', label: T('Capital spending', 'Kapitálové výdaje'), color: '#171918', value: item => shownValue(item.capital_expense, item) }]
      : [{ key: 'revenue_actual', label: T('Revenue', 'Příjmy'), color: '#a8b63f', value: item => shownValue(item.revenue_actual, item) }, { key: 'expense_actual', label: T('Spending', 'Výdaje'), color: '#c93237', value: item => shownValue(item.expense_actual, item) }, { key: 'expense_adjusted', label: T('Revised spending plan', 'Upravený plán výdajů'), color: '#8b8d83', value: item => shownValue(item.expense_adjusted, item) }];
    $('#trajectory-title').textContent = `${state.trend === 'split' ? T('Operating and capital spending', 'Běžné a kapitálové výdaje') : T('Revenue and spending', 'Příjmy a výdaje')} · ${span}`;
    plot('#trajectory-chart', { type: 'line', rows: years, fields, title: `${city().name} · ${span} · ${unit()}`, unit: unit(), height: 320, endLabels: false, selectedLabel: String(state.year), format: displayedExact, axisFormat: budgetMoney, onSelect: item => selectYear(item.year) }, { name: 'Ministerstvo financí · MONITOR · FIN 2-12 M', url: monitor(state.year), table: state.overview.evidence[0]?.datasetId, edition: state.overview.evidence[0]?.generatedAt, definition: T('Annual revenue and spending after consolidation. Per resident divides each year by its mid-year population.', 'Roční příjmy a výdaje po konsolidaci. Na obyvatele dělí každý rok populací k 1. 7.'), caveat: state.currency === 'CZK' ? T('Nominal CZK, no inflation adjustment. City-owned companies are outside the budget.', 'Běžné Kč bez očištění o inflaci. Městské firmy nejsou součástí rozpočtu.') : T('Source amounts are nominal CZK; each year is converted at its annual ECB average. No inflation adjustment. City-owned companies are outside the budget.', 'Zdrojové částky jsou v běžných Kč; každý rok je přepočten ročním průměrným kurzem ECB. Bez očištění o inflaci. Městské firmy nejsou součástí rozpočtu.') });
  }
  async function selectYear(year) {
    if (!state.overview.history.some(row => row.year === year)) return;
    state.year = year; $('#budget-year').value = year; $('#budget-year').dispatchEvent(new Event('input', { bubbles: true }));
    state.detail = null; state.payments = null; state.ledgerPage = 0; state.project = null;
    writeURL(); renderOverview(); renderSpending(); renderContext(); renderLivingCost(); renderEvidence();
    if (ext()?.connectedResults) { organizationState.request++; organizationState.result = null; organizationState.error = null; organizationState.loading = false; renderConnections(); }
    if (records()) { statements?.select(year); renderRecords(); if (itState.started) selectIT(); }
    const token = ++state.request;
    try { const detail = await client.loadYearDetail(year); if (token !== state.request) return; state.detail = detail; }
    catch (error) { if (token !== state.request) return; state.detail = { year, rows: [], accountingRows: [], events: [], error: error.message, coverage: {} }; }
    renderSpending(); renderEvidence(); if (ext()?.connectedResults) renderConnections(); if (records()) renderRecords();
  }

  // ---------------------------------------------------------------- where the money goes
  const sumOf = rows => rows.length && rows.every(row => Number.isFinite(row.amount)) ? rows.reduce((total, row) => total + row.amount, 0) : null;
  const costClasses = [['opex', '5', T('Operating spending', 'Běžné výdaje'), T('Staff, services, maintenance and operating transfers', 'Zaměstnanci, služby, údržba a provozní transfery')], ['capex', '6', T('Capital spending', 'Kapitálové výdaje'), T('Construction, long-lived assets and investment transfers', 'Stavby, dlouhodobý majetek a investiční transfery')], ['other', '', T('Other', 'Ostatní'), T('Codes outside classes 5 and 6', 'Kódy mimo třídy 5 a 6')]];
  const revenueClasses = [['tax', '1', T('Taxes', 'Daně'), T('Shared and local taxes', 'Sdílené a místní daně')], ['nontax', '2', T('Fees and other income', 'Poplatky a ostatní příjmy'), T('Rents, fees, fines and other non-tax income', 'Nájmy, poplatky, pokuty a další nedaňové příjmy')], ['capital', '3', T('Asset sales', 'Prodej majetku'), T('Capital income from selling property and assets', 'Kapitálové příjmy z prodeje majetku')], ['transfers', '4', T('Grants received', 'Přijaté dotace'), T('Transfers from the state, region and EU', 'Transfery od státu, kraje a EU')], ['other', '', T('Other', 'Ostatní'), T('Codes outside classes 1 to 4', 'Kódy mimo třídy 1 až 4')]];
  function explorerModel() {
    const rows = (state.detail?.rows || []).filter(row => row.year === state.year), term = ($('#budget-search')?.value || '').trim().toLocaleLowerCase(locale);
    const leafNode = row => ({ id: row.code, code: row.code, label: name(row), value: row.amount, kind: row.dimension === 'functional' ? 'purpose' : 'item', row, detail: `${row.code}${name(row) !== row.name ? ' · ' + row.name : ''}` });
    let groups, target, rootLabel;
    if (state.view === 'services') {
      groups = Math2.serviceGroups(rows, state.year, state.stage).map(group => ({ id: group.id, label: T(group.en, group.cs), detail: T(group.description_en, group.description_cs), rows: group.rows, value: group.amount }));
      target = yearRow()?.[`expense_${state.stage}`]; rootLabel = T('All services', 'Všechny služby');
    } else {
      const revenue = state.view === 'revenue', classes = revenue ? revenueClasses : costClasses, prefixes = classes.map(([, prefix]) => prefix).filter(Boolean);
      const leaves = rows.filter(row => row.dimension === 'economic' && row.side === (revenue ? 'revenue' : 'expenditure') && row.stage === state.stage);
      groups = classes.map(([id, prefix, label, detail]) => { const members = leaves.filter(row => prefix ? row.code.startsWith(prefix) : !prefixes.includes(row.code[0])).sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0)); return { id, label, detail, rows: members, value: sumOf(members) }; }).filter(group => group.rows.length);
      target = yearRow()?.[`${revenue ? 'revenue' : 'expense'}_${state.stage}`]; rootLabel = revenue ? T('All revenue', 'Všechny příjmy') : T('All spending', 'Všechny výdaje');
    }
    const leaves = groups.flatMap(group => group.rows), total = sumOf(leaves);
    const group = groups.find(item => item.id === state.group) || null;
    let list;
    if (term) list = leaves.filter(row => `${row.code} ${row.name} ${name(row)}`.toLocaleLowerCase(locale).includes(term)).map(leafNode);
    else if (group) list = group.rows.map(leafNode);
    else list = groups.map(item => ({ ...item, kind: 'group', count: item.rows.length }));
    list.sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0));
    return { groups, group, list, total, target, rootLabel, term, leaves };
  }
  function activate(node) {
    if (!node) return;
    if (node.kind === 'group') { state.group = node.id; state.purpose = null; writeURL(); renderSpending(); $('#spending-path button:last-of-type, #spending-path span:last-child')?.focus?.({ preventScroll: true }); return; }
    if (node.kind === 'purpose') { state.purpose = node.code; writeURL(); renderSpendingList(); renderPurposeDetail(); $('#purpose-detail').scrollIntoView({ block: 'nearest' }); $('#purpose-title')?.focus({ preventScroll: true }); return; }
    budgetRecord(node.row);
  }
  function renderSpending() {
    if (!$('#spending')) return;
    app.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    const model = explorerModel(), status = $('#budget-status'), detailYears = state.overview.coverage.detailYears;
    nodes = model.list;
    $('#spending-path').innerHTML = `<button type="button" data-path="root" ${model.group || model.term ? '' : 'aria-current="true"'}>${model.rootLabel}</button>${model.group && !model.term ? `<span aria-hidden="true">/</span><span aria-current="true">${esc(model.group.label)}</span>` : ''}${model.term ? `<span aria-hidden="true">/</span><span aria-current="true">${T('Search results', 'Výsledky hledání')}</span>` : ''}`;
    if (!model.leaves.length) {
      clearCharts(['#spending-map']);
      const latest = detailYears.at(-1);
      $('#spending-map').innerHTML = `<div class="pb-empty">${!state.detail ? T('Loading the breakdown…', 'Načítání rozpadu…') : state.detail.error ? T('The breakdown could not be loaded. Nothing has been substituted.', 'Rozpad se nepodařilo načíst. Nic nebylo dosazeno.') : latest ? `${T(`The line-by-line breakdown is published for ${detailYears.join(', ')}. The totals for ${state.year} are in the overview above.`, `Rozpad po řádcích je publikován pro rok ${detailYears.join(', ')}. Součty za rok ${state.year} jsou v přehledu výše.`)} <button type="button" class="pb-button secondary" data-goto-year="${latest}">${T(`Show ${latest}`, `Zobrazit ${latest}`)}</button>` : T('No line-by-line breakdown is published for this municipality.', 'Pro tuto obec není publikován rozpad po řádcích.')}</div>`;
      $('#spending-map').querySelector('[data-goto-year]')?.addEventListener('click', event => selectYear(Number(event.target.dataset.gotoYear)));
      $('#budget-table tbody').innerHTML = ''; status.textContent = ''; $('#purpose-detail').hidden = true; renderSourceComparison(model);
      return;
    }
    const reconciles = Number.isFinite(model.total) && Number.isFinite(model.target) && Math.abs(model.total - model.target) < .02;
    status.className = reconciles ? '' : 'pb-warning';
    status.textContent = reconciles ? `${stageLabel(state.stage)} · ${T('the lines add up to the reported total of', 'řádky dávají dohromady vykázaný celek')} ${budgetExact(model.total)}` : `${stageLabel(state.stage)} · ${T('the lines add up to', 'součet řádků je')} ${budgetExact(model.total)}; ${T('reported total', 'vykázaný celek')} ${budgetExact(model.target)}`;
    const title = model.term ? T('Search results', 'Výsledky hledání') : model.group ? model.group.label : model.rootLabel;
    plot('#spending-map', { type: 'treemap', title: `${title} · ${stageLabel(state.stage)} · ${state.year}`, rows: nodes.map(node => ({ ...node, value: shownValue(node.value) })), fields: [{ key: 'value', label: stageLabel(state.stage) }], unit: unit(), valueFormat: budgetMoney, format: displayedExact, height: 440, onSelect: activate }, { name: 'MONITOR · FIN 2-12 M', url: monitor(state.year), table: state.overview.evidence[0]?.datasetId, edition: state.overview.evidence[0]?.generatedAt, definition: T('Native budget classification of the selected stage. Groups are navigation labels built from the codes; each code appears once.', 'Původní rozpočtová klasifikace vybrané fáze. Skupiny jsou navigační štítky sestavené z kódů; každý kód je zahrnut jednou.'), caveat: T('Services and types of cost classify the same money two ways. Never add the views together.', 'Služby a druhy výdajů třídí tytéž peníze dvěma způsoby. Pohledy nikdy nesčítejte.') });
    renderSpendingList(model);
    renderPurposeDetail();
    renderSourceComparison(model);
  }
  function renderSourceComparison(model = explorerModel()) {
    const host=$('#source-comparison'); if(!host) return;
    const source=state.detail?.sourceReconciliation, overviewScope=$('#overview .pb-section-head p');
    if(overviewScope) overviewScope.textContent=source?.status==='available'&&source.scope_verified===true?T(source.scope_note_en,source.scope_note_cs):ext()?.scopeNote?.[lang]||'';
    if(!state.detail || !model.leaves.length) { host.innerHTML=`<h3>${T('Spending across sources', 'Výdaje napříč zdroji')}</h3><p class="pb-empty">${T('Comparable annual detail is not available for this selection.', 'Pro tento výběr není dostupný srovnatelný roční detail.')}</p>`; return; }
    const dimension=state.view==='services'?'functional':'economic', side=state.view==='revenue'?'revenue':'expenditure';
    const accountingAvailable=state.detail.coverage.accounting?.status==='available', paymentsAvailable=!!state.payments&&!state.payments.error;
    const controls=Spending.reconcileAccounting(state.detail);
    const rows=nodes.map((node,index)=>{
      const codes=(node.rows||[node.row]).filter(Boolean).map(row=>row.code);
      const accounting=Spending.comparePublication(state.detail.accountingRows,{year:state.year,dimension,codes,side,available:accountingAvailable});
      const invoices=Spending.comparePublication(state.payments?.rows||[],{year:state.year,dimension,codes,side,available:paymentsAvailable});
      return `<tr><td><button type="button" data-source-node="${index}">${esc(node.label)}</button><small>${esc(codes.join(', '))}</small></td><td class="pb-currency">${displayedExact(shownValue(node.value))}</td><td class="pb-currency">${accounting.amount===null?'—':displayedExact(shownValue(accounting.amount))}<small>${accounting.matchedRows} ${T('matched-code rows','řádků se shodným kódem')}</small></td><td class="pb-currency">${invoices.amount===null?'—':displayedExact(shownValue(invoices.amount))}<small>${paymentsAvailable?invoices.matchedRows+' '+T('allocations','alokací'):T('Load to inspect','Načtěte k prověření')}</small></td></tr>`;
    });
    const allCodes=state.detail.rows.filter(row=>row.year===state.year&&row.stage===state.stage&&row.side===side&&row.dimension===dimension).map(row=>row.code);
    const outside=Spending.unmatchedPublication(state.detail.accountingRows,{year:state.year,dimension,codes:allCodes,side});
    const unmatched=accountingAvailable?`<p class="pb-note" id="source-unmatched">${T('Accounting rows with a code outside this published budget classification (including missing codes)','Účetní řádky s kódem mimo tuto publikovanou rozpočtovou klasifikaci (včetně chybějících kódů)')}: ${outside.matchedRows} · ${outside.amount===null?'—':displayedExact(shownValue(outside.amount))}. ${T('This is a subset of CityVizor, not a residual of the city budget. The complete accounting rows remain available in Records.','Jde o podmnožinu CityVizoru, nikoli o nevysvětlený zbytek rozpočtu města. Úplné účetní řádky jsou k dispozici v Záznamech.')}</p>`:'';
    const official=source?.status==='available'?`<p class="pb-note">${T('Official source reconciliation', 'Odsouhlasení oficiálních zdrojů')} · ${esc(source.release_id)}</p><div class="pb-table-wrap"><table class="pb-table" id="official-reconciliation-table"><thead><tr><th>${T('Official observation and scope','Oficiální údaj a rozsah')}</th><th>${T('Reported amount','Vykázaná částka')}</th><th>${T('Evidence','Doklad')}</th></tr></thead><tbody>${source.observations.map(o=>{const evidence=source.sources.find(s=>s.id===o.source_id);return `<tr><td>${esc(T(o.label_en||o.label,o.label_cs||o.label))}<small>${esc(T(o.scope_en||o.scope,o.scope_cs||o.scope))} · ${o.year}</small></td><td class="pb-currency">${exact(Number(o.amount_exact))}<small>${esc(o.original_value)} ${esc(o.original_unit)}</small></td><td>${link(evidence.url,T('Official account','Oficiální účet'))} · ${T('page','strana')} ${esc(o.page)}</td></tr>`;}).join('')}</tbody></table></div><p class="pb-note" id="official-reconciliation-status">${esc(T(source.summary_en||'',source.summary_cs||''))}</p>`:`<p class="pb-note" id="official-reconciliation-status">${T('The official final-account reconciliation has not yet been published here. The city/district boundary is still being verified.', 'Odsouhlasení oficiálního závěrečného účtu zde ještě není publikováno. Rozsah města a městských částí se stále ověřuje.')}</p>`;
    host.innerHTML=`<h3>${T('Spending across sources','Výdaje napříč zdroji')}</h3><p class="pb-note">${state.year} · ${unit()} · ${T('MONITOR keeps the selected budget stage. CityVizor columns are published actuals from the magistrate, matched by exact classification code. These sources have different unverified scopes: amounts are not added and no unmatched spending or coverage percentage is inferred from their difference.', 'MONITOR zachovává vybranou fázi rozpočtu. Sloupce CityVizoru jsou publikované skutečné částky magistrátu, propojené přesným kódem klasifikace. Zdroje mají odlišné neověřené rozsahy: částky se nesčítají a z rozdílu neodvozujeme nevysvětlené výdaje ani procento pokrytí.')}</p><div class="pb-table-wrap"><table class="pb-table" id="source-comparison-table"><thead><tr><th>${T('Purpose or cost','Účel nebo druh výdaje')}</th><th>MONITOR · ${stageLabel(state.stage)}</th><th>CityVizor · ${T('accounting actual','účetní skutečnost')}</th><th>CityVizor · ${T('invoice allocations','fakturační alokace')}</th></tr></thead><tbody>${rows.join('')}</tbody></table></div><p class="pb-note" id="source-control-status">${T('CityVizor publication controls','Zdrojové kontroly CityVizoru')}: ${controls.status==='reconciled'?T('all four controls reconcile to loaded accounting rows','všechny čtyři kontroly souhlasí s načtenými účetními řádky'):T('not verified for this selection','pro tento výběr neověřeno')} · ${T('source valid to','platnost zdroje')} ${esc(state.detail.sourceValidity||'—')} · ${link(records()?.profile_url||ext().recordsUrl,'CityVizor')} · ${link(monitor(state.year),'MONITOR')}</p>${!paymentsAvailable&&records()?`<button type="button" class="pb-button" data-source-load>${T('Load invoice allocations for comparison','Načíst fakturační alokace pro porovnání')}</button>`:''}${unmatched}${official}`;
  }
  function renderSpendingList(model = explorerModel()) {
    const base = Number.isFinite(model.total) && model.total !== 0 ? model.total : null;
    $('#budget-table tbody').innerHTML = nodes.map((node, index) => `<tr data-node="${index}" ${node.kind === 'purpose' && node.code === state.purpose ? 'aria-selected="true"' : ''}><td><button type="button">${esc(node.label)}</button><small>${node.kind === 'group' ? `${node.count} ${node.count === 1 ? T('line', 'řádek') : node.count < 5 ? T('lines', 'řádky') : T('lines', 'řádků')}` : esc(node.detail)}</small></td><td class="pb-currency">${shownMoney(node.value)}</td><td class="pb-currency">${base && Number.isFinite(node.value) ? percent(node.value / base * 100) : '—'}</td></tr>`).join('') || `<tr><td colspan="3">${T('No matching lines.', 'Žádné odpovídající řádky.')}</td></tr>`;
  }
  function renderPurposeDetail() {
    const host = $('#purpose-detail');
    const row = state.view === 'services' && state.detail?.rows.find(item => item.code === state.purpose && item.dimension === 'functional' && item.side === 'expenditure' && item.stage === 'actual' && item.year === state.year);
    host.hidden = !row;
    if (!row) return;
    const stages = ['approved', 'adjusted', 'actual'].map(stage => state.detail.rows.find(item => item.code === row.code && item.dimension === 'functional' && item.side === 'expenditure' && item.stage === stage)?.amount);
    const group = Math2.serviceFor(row.code), accounting = state.detail.coverage.accounting?.status === 'available';
    const joint = state.detail.jointCoverage?.status === 'reconciled' ? (state.detail.jointRows || []).filter(item => item.functional_code === row.code && item.side === 'expenditure' && item.stage === state.stage) : [];
    const jointBlock = joint.length ? `<h4>${T('Budget purpose → type of cost', 'Účel rozpočtu → druh výdaje')} · ${stageLabel(state.stage)}</h4><p class="pb-note">${T('Both codes are reported on the same budget facts. This is a decomposition of the budget line, not an additional amount.', 'Oba kódy jsou vykázány na stejných rozpočtových faktech. Jde o rozpad rozpočtového řádku, nikoli další částku.')}</p><div class="pb-table-wrap"><table class="pb-table"><thead><tr><th>${T('Cost code', 'Kód výdaje')}</th><th>${T('Amount', 'Částka')}</th></tr></thead><tbody>${joint.map(item => `<tr><td>${esc(item.economic_code)} · ${esc(lang === 'en' ? item.itemName : item.name_cs || item.name_native || item.economic_code)}</td><td class="pb-currency">${budgetExact(item.amount)}</td></tr>`).join('')}</tbody></table></div>` : '';
    let recordsBlock = '';
    if (records()) {
      const evidence = Math2.purposeEvidence(state.detail.accountingRows, state.payments?.rows, state.year, row.code);
      const rowsTable = (items, heading, label) => items.length ? `<div><h4>${heading}</h4><div class="pb-table-wrap"><table class="pb-table"><tbody>${items.slice(0, 8).map(item => `<tr><td>${esc(label(item) || T('Not assigned', 'Nepřiřazeno'))}<small>${esc(item.code || '—')} · ${item.records.length} ${T('rows', 'řádků')}</small></td><td class="pb-currency">${exact(item.amount)}</td></tr>`).join('')}</tbody></table></div>${items.length > 8 ? `<p class="pb-note">${T(`${items.length - 8} more in All records.`, `Dalších ${items.length - 8} ve Všech záznamech.`)}</p>` : ''}</div>` : '';
      recordsBlock = `<div class="pb-panel-records"><h4>${T(`In ${esc(records().name)}’s published records`, `V publikovaných záznamech: ${esc(records().name)}`)}</h4>${!accounting ? `<p class="pb-note">${T('No published accounting rows for this year.', 'Pro tento rok nejsou publikovány účetní řádky.')}</p>` : evidence.accounting.length ? `<p class="pb-note">${T('Rows with exactly this code in a separate publication. Their scope is not reconciled to the amount above and they are never added to it.', 'Řádky s přesně tímto kódem v samostatné publikaci. Jejich rozsah není odsouhlasen s částkou výše a nikdy se k ní nepřičítají.')}</p><div class="pb-panel-grid">${rowsTable(evidence.items, T('Types of cost', 'Druhy výdajů'), item => lang === 'en' && Labels?.economic[item.code] || item.name)}${rowsTable(evidence.projects.filter(item => item.code), T('Named projects', 'Pojmenované akce'), item => projectName(item))}</div>` : `<p class="pb-note">${T('No accounting rows with this code are published. That does not mean nothing was spent.', 'Nejsou publikovány účetní řádky s tímto kódem. Neznamená to, že se nic neutratilo.')}</p>`}<p class="pb-actions"><button type="button" class="pb-button" data-purpose-invoices>${T('Invoices for this line', 'Faktury k tomuto řádku')}</button> <button type="button" class="pb-button secondary" data-purpose-accounting>${T('Accounting rows', 'Účetní řádky')}</button></p></div>`;
    }
    host.innerHTML = `<div class="pb-panel-head"><div><p class="pb-kicker">${esc(T(group.en, group.cs))} · ${T('line', 'paragraf')} ${esc(row.code)} · ${state.year}</p><h3 id="purpose-title" tabindex="-1">${esc(name(row))}</h3>${lang === 'en' && name(row) !== row.name ? `<p class="pb-note">${esc(row.name)}</p>` : ''}</div><button type="button" class="pb-icon-button" data-purpose-close aria-label="${T('Close', 'Zavřít')}">×</button></div>
      <div class="pb-metrics pb-metrics-3">${stages.map((amount, index) => metric([stageLabel('approved'), stageLabel('adjusted'), stageLabel('actual')][index], shownMoney(amount), displayedExact(shownValue(amount)))).join('')}</div>
      <p class="pb-note">${Number.isFinite(stages[2]) && Number.isFinite(stages[1]) ? `${T('Actual minus revised plan', 'Skutečnost minus upravený plán')}: ${budgetSigned(budgetValue(stages[2] - stages[1]))}.` : ''} ${link(monitor(state.year), T('Official accounts', 'Oficiální výkaz'))}</p>${jointBlock}${recordsBlock}`;
  }
  function budgetRecord(row) {
    const related = state.detail.rows.filter(item => item.code === row.code && item.dimension === row.dimension && item.side === row.side);
    openRecord(`${row.code} · ${name(row)}`, [[T('Year', 'Rok'), state.year], [T('Code', 'Kód'), row.code], [T('Source label', 'Název ve zdroji'), row.name], ...['approved', 'adjusted', 'actual'].map(stage => [stageLabel(stage), exact(related.find(item => item.stage === stage)?.amount)]), [T('Source', 'Zdroj'), 'MONITOR · FIN 2-12 M']], T('One line of the published budget classification.', 'Jeden řádek publikované rozpočtové klasifikace.'), link(monitor(state.year), T('Official accounts', 'Oficiální výkaz')));
  }
  async function inspectPurposeRecords(kind) {
    state.ledgerPurpose = state.purpose; state.ledgerKind = kind; state.ledgerPage = 0;
    $('#ledger-kind').value = kind; $('#ledger-search').value = '';
    showRecordsTab('ledger'); $('#records').scrollIntoView({ block: 'start' });
    if (kind === 'payments' && (!state.payments || state.payments.error)) await loadPayments();
  }

  // ---------------------------------------------------------------- records (CityVizor)
  function bindRecords() {
    $('#records').querySelector('.pb-tabs').addEventListener('click', event => { const tab = event.target.closest('[data-records-tab]'); if (tab) { showRecordsTab(tab.dataset.recordsTab); writeURL(); } });
    $('#records').querySelector('.pb-tabs').addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; const tabs = [...app.querySelectorAll('[data-records-tab]')], index = tabs.findIndex(tab => tab.dataset.recordsTab === state.records), next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; showRecordsTab(next.dataset.recordsTab); writeURL(); next.focus(); });
    $('#project-service').addEventListener('change', event => { state.projectService = event.target.value; state.project = null; renderProjects(); });
    $('#project-search').addEventListener('input', renderProjectList);
    $('#records-projects').addEventListener('click', async event => {
      const project = event.target.closest('[data-project]'), tab = event.target.closest('[data-inspector-tab]'), vendor = event.target.closest('[data-vendor]'), invoice = event.target.closest('[data-explore-invoice]');
      if (project) { state.project = project.dataset.project; state.projectVendor = null; writeURL(); renderProjectList(); renderInspector(); if (innerWidth < 800) $('#project-inspector').scrollIntoView({ block: 'start' }); }
      if (tab) { state.projectTab = tab.dataset.inspectorTab; state.projectVendor = null; renderInspector(); }
      if (vendor) { state.projectVendor = vendor.dataset.vendor; state.projectTab = 'invoices'; renderInspector(); }
      if (event.target.closest('[data-clear-vendor]')) { state.projectVendor = null; renderInspector(); }
      if (event.target.closest('[data-explore-load]')) { const button = event.target.closest('button'); button.disabled = true; button.textContent = T('Loading…', 'Načítání…'); await loadPayments(); }
      if (invoice) { const p = investigation().projects.find(item => item.key === state.project), row = p?.invoices[Number(invoice.dataset.exploreInvoice)]; if (row) openInvoice(row, state.payments); }
    });
    $('#ledger-purpose-filter').addEventListener('click', () => { state.ledgerPurpose = null; state.ledgerPage = 0; renderLedger(); });
    $('#ledger-kind').addEventListener('change', event => { state.ledgerKind = event.target.value; state.ledgerPage = 0; renderLedger(); });
    $('#ledger-search').addEventListener('input', () => { state.ledgerPage = 0; renderLedger(); });
    $('#ledger-load').addEventListener('click', loadPayments);
    $('#ledger-table').addEventListener('click', event => { if (event.target.closest('a')) return; const row = event.target.closest('[data-record]'); if (row) ledgerRecord(Number(row.dataset.record)); });
    $('#ledger-pagination').addEventListener('click', event => { const control = event.target.closest('[data-page]'); if (control) { state.ledgerPage += Number(control.dataset.page); renderLedger(); } });
    $('#it-profile').addEventListener('change', event => { itState.key = event.target.value; selectIT(); });
    $('#it-item').addEventListener('change', event => { itState.item = event.target.value; itState.vendor = null; itState.page = 0; renderIT(); });
    $('#it-load').addEventListener('click', loadITInvoices);
    $('#it-search').addEventListener('input', () => { itState.vendor = null; itState.page = 0; renderIT(); });
    $('#it-vendors').addEventListener('click', event => { const control = event.target.closest('[data-it-vendor]'); if (control) { itState.vendor = control.dataset.itVendor; itState.page = 0; renderIT(); } });
    $('#it-clear-vendor').addEventListener('click', () => { itState.vendor = null; itState.page = 0; renderIT(); });
    $('#it-pagination').addEventListener('click', event => { const control = event.target.closest('[data-it-page]'); if (control) { itState.page += Number(control.dataset.itPage); renderIT(); } });
    $('#it-invoices').addEventListener('click', event => { const control = event.target.closest('[data-it-record]'); if (control) { const row = itState.result?.rows?.[Number(control.dataset.itRecord)]; if (row) openInvoice(row, itState.result); } });
    if (ext()?.companies) {
      $('#company-load').addEventListener('click', loadPayments);
      $('#company-lines').addEventListener('click', event => { const b = event.target.closest('[data-company-invoice]'); if (b) { const row = state.payments?.rows?.[Number(b.dataset.companyInvoice)]; if (row) openInvoice(row, state.payments); } });
    }
    statements = window.MunicipalStatements.mount($('#records-statements'), { T, esc, money, exact, number, percent, plot, openRecord, link, name, profile: records(), release: state.overview.coverage.cityvizor.release, recordsUrl: ext()?.recordsUrl, loadStatement: client.loadStatement, clearCharts: () => clearCharts(['#statement-categories-chart', '#statement-history-chart']) });
    showRecordsTab(state.records);
  }
  function showRecordsTab(id) {
    if (!app.querySelector(`[data-records-tab="${id}"]`)) id = 'statements';
    state.records = id;
    app.querySelectorAll('[data-records-tab]').forEach(tab => { const active = tab.dataset.recordsTab === id; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    app.querySelectorAll('#records .pb-tabpanel').forEach(panel => { panel.hidden = panel.id !== `records-${id}`; });
    if (id === 'it' && !itState.started) initIT();
    renderRecords();
  }
  function renderRecords() {
    if (!records()) return;
    if (state.records === 'projects') renderProjects();
    if (state.records === 'ledger') renderLedger();
    if (state.records === 'companies') renderCompanies();
  }
  const investigation = () => Spending.investigate(state.detail, state.payments, state.year, state.projectService);
  function renderProjects() {
    const groups = Math2.serviceGroups(state.detail?.rows, state.year, 'actual'), select = $('#project-service');
    select.innerHTML = `<option value="all">${T('All services', 'Všechny služby')}</option>${groups.map(group => `<option value="${group.id}">${esc(T(group.en, group.cs))}</option>`).join('')}`;
    if (![...select.options].some(option => option.value === state.projectService)) state.projectService = 'all';
    select.value = state.projectService;
    const data = investigation();
    if (state.detail && !data.projects.some(p => p.key === state.project)) state.project = data.projects[0]?.key || null;
    renderProjectList(); renderInspector();
  }
  function renderProjectList() {
    const data = investigation(), term = $('#project-search').value.trim().toLocaleLowerCase(locale), projects = data.projects.filter(p => [projectName(p), p.name, p.code, ...p.vendors.map(v => v.name + ' ' + v.ico)].join(' ').toLocaleLowerCase(locale).includes(term));
    $('#project-count').textContent = state.detail ? `${number(projects.length)} ${T('of', 'z')} ${number(data.projects.length)} ${T('projects · recorded spending', 'akcí · vykázané výdaje')}` : '';
    $('#project-list').innerHTML = projects.length ? projects.map(p => `<button type="button" data-project="${esc(p.key)}" aria-pressed="${p.key === state.project}"><span>${esc(projectName(p))}<small>${p.code ? `${T('Project', 'Akce')} ${esc(p.code)}` : T('No project code', 'Bez kódu akce')}</small></span><strong>${money(p.amount)}</strong></button>`).join('') : `<p class="pb-empty">${!state.detail ? T('Loading records…', 'Načítání záznamů…') : state.detail.coverage.accounting?.status === 'not_published' ? T(`${records().name} has not published records for ${state.year}.`, `${records().name} nepublikoval záznamy za rok ${state.year}.`) : T('No matching projects in the published records.', 'V publikovaných záznamech nejsou odpovídající akce.')}</p>`;
  }
  function renderInspector() {
    const p = investigation().projects.find(item => item.key === state.project), host = $('#project-inspector');
    if (!p) { host.innerHTML = `<p class="pb-empty">${T('Choose a project to see its suppliers and invoice allocations.', 'Vyberte akci a uvidíte její dodavatele a fakturační alokace.')}</p>${state.detail && (!state.payments || state.payments.error) ? `<button type="button" data-explore-load class="pb-button">${T('Load invoice records', 'Načíst fakturační záznamy')}</button>` : ''}`; return; }
    const loaded = !!state.payments && !state.payments.error, contracts = state.overview.coverage.contracts;
    const tabs = [['invoices', T('Invoices', 'Faktury')], ['suppliers', T('Suppliers', 'Dodavatelé')], ...(contracts ? [['contracts', T('Contracts', 'Smlouvy')]] : [])];
    if (!tabs.some(([id]) => id === state.projectTab)) state.projectTab = 'invoices';
    host.innerHTML = `<div class="pb-inspector-head"><h3>${esc(projectName(p))}</h3><p class="pb-note">${esc(p.name)}${p.code ? ' · ' + esc(p.code) : ''} · ${state.year}</p><div class="pb-metrics pb-metrics-3">${metric(T('Recorded spending', 'Vykázané výdaje'), money(p.amount), exact(p.amount))}${metric(T('Invoice allocations', 'Fakturační alokace'), loaded ? number(p.invoices.length) : '—', loaded ? exact(p.invoiceAmount) : T('Not loaded', 'Nenačteno'))}${metric(T('Suppliers', 'Dodavatelé'), loaded ? number(p.vendors.filter(v => v.ico).length) : '—', T('by reported IČO', 'podle IČO'))}</div></div><div class="pb-tabs pb-tabs-small">${tabs.map(([id, label]) => `<button type="button" data-inspector-tab="${id}" aria-pressed="${id === state.projectTab}">${label}</button>`).join('')}</div><div id="inspector-content"></div>`;
    const content = $('#inspector-content');
    if (state.projectTab === 'contracts') { content.innerHTML = `<p>${T(`${number(contracts.acceptedRows)} contracts with this payer are held from the register of contracts. A verified link between a contract and this project’s invoices is not published; open an invoice to look up contracts with the same supplier.`, `Z registru smluv je uloženo ${number(contracts.acceptedRows)} smluv s tímto plátcem. Ověřená vazba smlouvy na faktury této akce není publikována; otevřete fakturu a vyhledejte smlouvy se stejným dodavatelem.`)}</p><p>${link('https://www.hlidacstatu.cz/hledat?Q=' + encodeURIComponent('icoPlatce:' + ico), 'Hlídač státu')} · ${link('https://smlouvy.gov.cz/', T('Register of contracts', 'Registr smluv'))}</p>`; return; }
    if (!loaded) { content.innerHTML = `<div class="pb-unlock"><p>${T('Load the published invoice allocations to see suppliers, amounts and dates.', 'Načtěte publikované fakturační alokace a uvidíte dodavatele, částky a data.')}</p><button type="button" data-explore-load class="pb-button">${state.payments?.error ? T('Retry', 'Zkusit znovu') : T('Load invoice records', 'Načíst fakturační záznamy')}</button></div>`; return; }
    if (state.projectTab === 'suppliers') { content.innerHTML = p.vendors.length ? p.vendors.map(v => `<button class="pb-row-button" type="button" data-vendor="${esc(v.key)}"><span><strong>${esc(v.name || T('Name missing', 'Chybí název'))}</strong><small>${v.ico ? 'IČO ' + esc(v.ico) : T('No IČO', 'Bez IČO')} · ${v.rows.length} ${T('allocations', 'alokací')}</small></span><b>${exact(v.amount)}</b></button>`).join('') : `<p class="pb-empty">${T('No suppliers in this selection.', 'Ve výběru nejsou dodavatelé.')}</p>`; return; }
    const vendor = p.vendors.find(v => v.key === state.projectVendor), rows = p.invoices.map((row, index) => ({ row, index })).filter(({ row }) => !vendor || vendor.rows.includes(row)).sort((a, b) => String(b.row.date).localeCompare(String(a.row.date)));
    content.innerHTML = `${vendor ? `<p class="pb-filter-chip">${esc(vendor.name)} <button type="button" data-clear-vendor>${T('Clear', 'Zrušit')} ×</button></p>` : ''}${rows.length ? rows.map(({ row, index }) => `<button type="button" class="pb-row-button" data-explore-invoice="${index}"><time>${esc(row.date || '—')}</time><span><strong>${esc(row.counterparty || T('Supplier missing', 'Dodavatel chybí'))}</strong><small>${esc(row.description || (lang === 'en' && Labels?.economic[row.itemCode]) || row.itemName || row.itemCode)}</small></span><b>${exact(row.expenditure)}</b></button>`).join('') : `<p class="pb-empty">${T('No invoice allocations for this project. That does not prove there were none.', 'K této akci nejsou fakturační alokace. To nedokládá, že žádné nebyly.')}</p>`}`;
  }
  async function loadPayments() {
    const year = state.year, token = state.request, button = $('#ledger-load'); button.disabled = true; button.textContent = T('Loading…', 'Načítání…');
    try { const payments = await client.loadPayments(year); if (token !== state.request) return; state.payments = payments; }
    catch (error) { if (token !== state.request) return; state.payments = { rows: [], error: error.message }; }
    if (token === state.request) { renderLedger(); renderRecords(); renderPurposeDetail(); renderEvidence(); renderSourceComparison(); }
  }
  function ledgerRows() {
    if (state.ledgerKind === 'payments') return state.payments?.rows || [];
    if (state.ledgerKind !== 'projects') return state.detail?.accountingRows || [];
    if (!state.ledgerPurpose) return state.detail?.events || [];
    return Math2.purposeEvidence(state.detail?.accountingRows, [], state.year, state.ledgerPurpose).projects.map(row => ({ code: row.code, name: row.name, expenditure: row.amount }));
  }
  function renderLedger() {
    if (!$('#ledger-table')) return;
    const status = $('#ledger-status'), button = $('#ledger-load'), isPayments = state.ledgerKind === 'payments', projects = state.ledgerKind === 'projects';
    button.hidden = !isPayments || !!state.payments && !state.payments.error; button.disabled = !state.detail; button.textContent = state.payments?.error ? T('Retry', 'Zkusit znovu') : T('Load invoice records', 'Načíst fakturační záznamy');
    const purposeFilter = $('#ledger-purpose-filter'); purposeFilter.hidden = !state.ledgerPurpose;
    purposeFilter.innerHTML = state.ledgerPurpose ? `<span>${T('Budget line', 'Paragraf')} <strong>${esc(state.ledgerPurpose)}</strong> · ${state.year}</span><button type="button">${T('Show all', 'Zobrazit vše')} ×</button>` : '';
    const projectCodes = new Set((state.detail?.accountingRows || []).filter(row => row.paragraphCode === state.ledgerPurpose && row.year === state.year).map(row => row.event));
    const all = ledgerRows(), term = $('#ledger-search').value.trim().toLocaleLowerCase(locale), rows = all.map((row, index) => ({ row, index })).filter(({ row }) => (!state.ledgerPurpose || (projects ? projectCodes.has(row.code) : row.paragraphCode === state.ledgerPurpose && row.year === state.year)) && Object.values(row).join(' ').toLocaleLowerCase(locale).includes(term)).sort((a, b) => (b.row.expenditure || 0) - (a.row.expenditure || 0)), pages = Math.max(1, Math.ceil(rows.length / 25));
    state.ledgerPage = Math.max(0, Math.min(state.ledgerPage, pages - 1));
    status.className = 'pb-note';
    if (!state.detail) status.textContent = T('Checking what is published for this year…', 'Ověřování, co je za tento rok publikováno…');
    else if (!isPayments && state.detail.coverage.accounting?.status !== 'available') status.textContent = state.detail.coverage.accounting?.status === 'not_published' ? T(`No accounting rows are published for ${state.year}.`, `Za rok ${state.year} nejsou publikovány účetní řádky.`) : T('The accounting records are unavailable. Nothing has been substituted.', 'Účetní záznamy nejsou dostupné. Nic nebylo dosazeno.');
    else if (isPayments && !state.payments) { const count = state.detail.invoiceSummary?.rows; status.textContent = Number.isFinite(count) ? T(`${number(count)} invoice allocations are published for ${state.year}. They are allocations, not proof of bank payment.`, `Za rok ${state.year} je publikováno ${number(count)} fakturačních alokací. Jde o alokace, nikoli doklad bankovní platby.`) : T('Invoice availability for this year is not declared.', 'Dostupnost faktur za tento rok není uvedena.'); }
    else if (state.payments?.error && isPayments) { status.className = 'pb-note pb-warning'; status.textContent = T('The invoice records could not be loaded. Nothing has been substituted.', 'Fakturační záznamy se nepodařilo načíst. Nic nebylo dosazeno.'); }
    else { const dates = isPayments ? all.map(row => row.date).filter(Boolean).sort() : []; const missing = isPayments ? all.filter(row => !row.description).length : 0; status.textContent = `${number(all.length)} ${T('records', 'záznamů')} · ${T('source valid to', 'platnost zdroje')} ${state.detail.sourceValidity || '—'}${isPayments ? ` · ${dates[0] || '—'} – ${dates.at(-1) || '—'} · ${number(missing)} ${T('without a description. Allocations are not proof of bank payment and are not added to the budget.', 'bez popisu. Alokace nejsou dokladem bankovní platby a nepřičítají se k rozpočtu.')}` : ` · ${T('not added to the budget total', 'nepřičítá se k rozpočtu')}`}`; }
    $('#ledger-table thead').innerHTML = `<tr><th>${isPayments ? T('Date', 'Datum') : T('Code', 'Kód')}</th><th>${isPayments ? T('Supplier / description', 'Dodavatel / popis') : projects ? T('Project', 'Akce') : T('Classification / project', 'Klasifikace / akce')}</th><th>${T('Spending', 'Výdaje')}</th></tr>`;
    $('#ledger-table tbody').innerHTML = rows.slice(state.ledgerPage * 25, state.ledgerPage * 25 + 25).map(({ row, index }) => `<tr data-record="${index}"><td>${esc(isPayments ? row.date || '—' : projects ? row.code : `${row.paragraphCode} / ${row.itemCode}`)}</td><td><button type="button">${esc(isPayments ? row.counterparty || T('Supplier not reported', 'Dodavatel neuveden') : projects ? row.name || row.code : row.eventName || row.paragraphName)}</button><small>${esc(isPayments ? `${row.counterpartyId || T('no IČO', 'bez IČO')} · ${row.description || T('no description', 'bez popisu')}` : projects ? T('Named project', 'Pojmenovaná akce') : `${row.paragraphName} · ${row.itemName}`)}</small></td><td class="pb-currency">${exact(row.expenditure)}</td></tr>`).join('');
    $('#ledger-pagination').innerHTML = rows.length > 25 ? `<span>${number(rows.length)} ${T('records', 'záznamů')} · ${state.ledgerPage + 1}/${pages}</span><div><button type="button" data-page="-1" ${state.ledgerPage === 0 ? 'disabled' : ''}>${T('Previous', 'Předchozí')}</button> <button type="button" data-page="1" ${state.ledgerPage >= pages - 1 ? 'disabled' : ''}>${T('Next', 'Další')}</button></div>` : rows.length ? `<span>${number(rows.length)} ${T('records', 'záznamů')}</span>` : '';
  }
  function ledgerRecord(index) {
    const row = ledgerRows()[index]; if (!row) return;
    if (state.ledgerKind === 'payments') { openInvoice(row, state.payments); return; }
    const keys = state.ledgerKind === 'projects' ? ['code', 'name', 'income', 'expenditure', 'budgetIncome', 'budgetExpenditure'] : ['id', 'year', 'type', 'paragraphCode', 'paragraphName', 'itemCode', 'itemName', 'event', 'eventName', 'organizationUnit', 'income', 'expenditure', 'budgetIncome', 'budgetExpenditure'];
    const evidence = state.detail.evidence?.cityvizor;
    openRecord(row.name || row.eventName || row.id, [...keys.map(key => [key, ['income', 'expenditure', 'budgetIncome', 'budgetExpenditure'].includes(key) ? exact(row[key]) : row[key] === '' || row[key] == null ? T('Not reported', 'Neuvedeno') : row[key]]), [T('Published release', 'Publikované vydání'), evidence?.releaseId], [T('Source SHA-256', 'SHA-256 zdroje'), evidence?.sourceSha256], [T('Source validity', 'Platnost zdroje'), state.detail.sourceValidity]], T('A partial publication. A project name does not prove completion, and no contract or bank payment is inferred.', 'Dílčí publikace. Název akce nedokládá dokončení a neodvozujeme smlouvu ani bankovní platbu.'), link(evidence?.sourceUrl, `CityVizor · ${records().name}`));
  }
  async function initIT() {
    itState.started = true;
    try {
      const directory = await client.loadAuthorities();
      itState.profiles = directory.profiles.sort((a, b) => a.name.localeCompare(b.name, 'cs', { numeric: true }));
      const preferred = ext()?.authorities?.defaultKey || records().key;
      itState.key = itState.profiles.some(profile => profile.key === preferred) ? preferred : itState.profiles[0]?.key;
      $('#it-profile').innerHTML = itState.profiles.map(profile => `<option value="${esc(profile.key)}">${esc(profile.name)}</option>`).join('');
      $('#it-item').value = itState.item;
      $('#it-profile').value = itState.key; $('#it-profile').disabled = itState.profiles.length < 2;
      await selectIT();
    } catch { itState.error = T('The list of published authorities is unavailable.', 'Seznam publikujících úřadů není dostupný.'); renderIT(); }
  }
  async function selectIT() {
    const token = ++itState.request;
    itState.result = null; itState.loaded = false; itState.loading = true; itState.error = null; itState.vendor = null; itState.page = 0; $('#it-search').value = '';
    renderIT();
    try { const result = await client.loadAuthoritySummary(itState.key, state.year); if (token !== itState.request) return; itState.result = result; }
    catch { if (token !== itState.request) return; itState.error = T('This authority has not published accounting for the selected year. No other authority or year has been substituted.', 'Tento úřad nepublikoval účetnictví za vybraný rok. Jiný úřad ani rok nebyl dosazen.'); }
    itState.loading = false; renderIT();
  }
  async function loadITInvoices() {
    const token = ++itState.request;
    itState.loading = true; itState.error = null; renderIT();
    try { const result = await client.loadAuthorityPayments(itState.key, state.year); if (token !== itState.request) return; itState.result = result; itState.loaded = true; }
    catch { if (token !== itState.request) return; itState.error = T('The invoice records could not be loaded or verified.', 'Fakturační záznamy se nepodařilo načíst nebo ověřit.'); }
    itState.loading = false; renderIT();
  }
  function renderIT() {
    const result = itState.result, evidence = Math2.itEvidence(result?.items, result?.rows, itState.item, $('#it-search').value), scope = ext()?.authorities;
    const published = itState.profiles.filter(profile => profile.key !== records().key && profile.available_years.includes(state.year)).length;
    $('#it-load').disabled = itState.loading || !result; $('#it-load').hidden = itState.loaded;
    $('#it-load').textContent = itState.loading ? T('Loading…', 'Načítání…') : T('Show suppliers and invoices', 'Zobrazit dodavatele a faktury');
    const validity = result?.sourceValidity?.slice(0, 10), incomplete = !validity || validity < `${state.year}-12-31`;
    $('#it-status').className = itState.error ? 'pb-note pb-warning' : 'pb-note';
    $('#it-status').textContent = itState.error || (itState.loading ? T('Loading…', 'Načítání…') : result ? `${result.profile.name} · ${state.year} · ${T('valid to', 'platnost do')} ${validity || '—'}${incomplete ? T(' · full year not established', ' · úplný rok není doložen') : ''}. ${scope ? T(`${published} of ${scope.districtCount} districts published ${state.year}. `, `Rok ${state.year} publikovalo ${published} z ${scope.districtCount} městských částí. `) : ''}${T('Explicit IT codes only: staff and technology booked elsewhere are excluded.', 'Pouze výslovné IT položky: zaměstnanci a technologie účtované jinde nejsou zahrnuty.')}` : '');
    $('#it-metrics').innerHTML = [metric(T('Budget · IT items', 'Rozpočet · IT položky'), money(evidence.budget), exact(evidence.budget)), metric(T('Spent · IT items', 'Utraceno · IT položky'), money(evidence.actual), exact(evidence.actual)), metric(T('Invoice allocations', 'Fakturační alokace'), itState.loaded ? money(evidence.invoiceAmount) : '—', itState.loaded ? `${number(evidence.payments.length)} ${T('records', 'záznamů')}` : T('Not loaded', 'Nenačteno'))].join('');
    $('#it-codes').innerHTML = evidence.items.length ? `<table class="pb-table"><thead><tr><th>${T('Item', 'Položka')}</th><th>${T('Budget', 'Rozpočet')}</th><th>${T('Spent', 'Utraceno')}</th></tr></thead><tbody>${evidence.items.map(row => `<tr><td>${esc(row.code)} · ${esc(T(...(itLabels[row.code] || [row.name, row.name])))}</td><td class="pb-currency">${exact(row.budget)}</td><td class="pb-currency">${exact(row.amount)}</td></tr>`).join('')}</tbody></table>` : `<p class="pb-empty">${T('No IT item is reported in this selection. That is not evidence of zero spending.', 'Ve výběru není vykázána IT položka. Nejde o důkaz nulových výdajů.')}</p>`;
    $('#it-results').hidden = !itState.loaded;
    if (!itState.loaded) return;
    $('#it-vendors tbody').innerHTML = evidence.vendors.map(vendor => `<tr><td><button type="button" data-it-vendor="${esc(vendor.key)}" aria-pressed="${itState.vendor === vendor.key}">${esc(vendor.name || T('Supplier not reported', 'Dodavatel neuveden'))}</button><small>${esc(vendor.id || T('no IČO', 'bez IČO'))} · ${vendor.rows.length} ${T('allocations', 'alokací')}</small></td><td class="pb-currency">${exact(vendor.amount)}</td></tr>`).join('') || `<tr><td colspan="2">${T('No matching invoice allocations.', 'Žádné odpovídající fakturační alokace.')}</td></tr>`;
    const vendor = evidence.vendors.find(row => row.key === itState.vendor), list = vendor ? vendor.rows : evidence.payments;
    const pages = Math.max(1, Math.ceil(list.length / 20)); itState.page = Math.max(0, Math.min(itState.page, pages - 1));
    $('#it-record-heading').textContent = vendor ? vendor.name || T('Unidentified supplier', 'Neidentifikovaný dodavatel') : T('Invoice allocations', 'Fakturační alokace');
    $('#it-clear-vendor').hidden = !vendor;
    $('#it-invoices tbody').innerHTML = list.slice(itState.page * 20, itState.page * 20 + 20).map(row => `<tr><td><button type="button" data-it-record="${result.rows.indexOf(row)}">${esc(row.description || T('No description', 'Bez popisu'))}</button><small>${esc(row.date || '—')} · ${esc(row.counterparty || T('Supplier not reported', 'Dodavatel neuveden'))} · ${T('item', 'položka')} ${esc(row.itemCode)}</small></td><td class="pb-currency">${exact(row.expenditure)}${/^\d{8}$/.test(row.counterpartyId) ? `<small>${link('https://www.hlidacstatu.cz/subjekt/' + row.counterpartyId, 'Hlídač státu')}</small>` : ''}</td></tr>`).join('');
    $('#it-pagination').innerHTML = list.length > 20 ? `<span>${list.length} ${T('allocations', 'alokací')} · ${itState.page + 1}/${pages}</span><div><button type="button" data-it-page="-1" ${itState.page === 0 ? 'disabled' : ''}>${T('Previous', 'Předchozí')}</button> <button type="button" data-it-page="1" ${itState.page === pages - 1 ? 'disabled' : ''}>${T('Next', 'Další')}</button></div>` : '';
  }
  function renderCompanies() {
    const host = $('#company-lines'); if (!host) return;
    const loaded = state.payments && !state.payments.error; $('#company-load').hidden = !!loaded;
    if (!loaded) { host.innerHTML = state.payments?.error ? `<p class="pb-note pb-warning">${T('The invoice records could not be loaded.', 'Fakturační záznamy se nepodařilo načíst.')}</p>` : ''; return; }
    const result = window.PrahaCompanies.group(state.payments.rows);
    host.innerHTML = `<div class="pb-table-wrap"><table class="pb-table"><thead><tr><th>${T('Company', 'Firma')}</th><th>${T('City allocations', 'Alokace města')}</th><th>${T('Sources', 'Zdroje')}</th></tr></thead><tbody>${result.companies.map(c => `<tr><td><strong>${esc(c.name)}</strong><small>IČO ${esc(c.ico)} · ${T('ownership evidence', 'doklad vlastnictví')}: ${link(c.sourceUrl, c.evidencePeriod)}</small></td><td class="pb-currency">${exact(c.amount)}<small>${c.rows.length} ${T('allocations', 'alokací')}</small></td><td>${link('https://www.hlidacstatu.cz/subjekt/' + c.ico, 'Hlídač státu')}<br>${link(c.annualReportsUrl, T('Annual reports', 'Výroční zprávy'))}</td></tr>`).join('') || `<tr><td colspan="3">${T('No allocations to a reviewed company this year.', 'Letos žádné alokace vůči prověřené firmě.')}</td></tr>`}</tbody></table></div>${result.companies.map(c => `<details class="pb-disclosure pb-company-line"><summary>${esc(c.name)} · ${c.rows.length} ${T('allocations', 'alokací')}</summary><div class="pb-table-wrap"><table class="pb-table"><tbody>${c.rows.map(r => `<tr><td><button type="button" data-company-invoice="${state.payments.rows.indexOf(r)}">${esc(r.date || '—')} · ${esc(r.eventName || r.description || r.itemName || r.itemCode)}</button></td><td class="pb-currency">${exact(r.expenditure)}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}<p class="pb-note">${T(`A reviewed partial list. ${result.unreviewed.length} other allocations go to counterparties whose ownership has not been reviewed; they are not classified as private.`, `Prověřený dílčí seznam. ${result.unreviewed.length} dalších alokací směřuje k protistranám, jejichž vlastnictví nebylo prověřeno; nejsou označeny jako soukromé.`)}</p>`;
  }

  // ---------------------------------------------------------------- dialogs
  let invoiceContext = null;
  const relatedContractCache = new Map();
  function openInvoice(row, context) {
    const c = { ...context };
    invoiceContext = { row, context: c, peers: window.PrahaInvoiceView.describe(row, c).peers };
    $('#record-title').textContent = row.counterparty || T('Invoice allocation', 'Fakturační alokace');
    $('#record-body').innerHTML = window.PrahaInvoiceView.render(row, { T, esc, exact, money, number, link, context: c, contracts: !!state.overview.coverage.contracts && (c.profile?.ico || records()?.ico) === ico });
    if (!$('#record-dialog').open) $('#record-dialog').showModal();
    $('#record-dialog').scrollTop = 0; $('#record-close').focus({ preventScroll: true });
    const form = $('#related-contract-form'); if (form) loadRelatedContracts(form);
  }
  async function loadRelatedContracts(form) {
    const active = invoiceContext, host = $('#related-contract-results'), button = form.querySelector('button'), contracts = state.overview.coverage.contracts;
    if (!active || !host || !contracts) return;
    button.disabled = true; host.textContent = T('Looking up the exact payer and supplier…', 'Vyhledávání přesného plátce a dodavatele…');
    try {
      const params = new URLSearchParams({ payer: ico, supplier: active.row.counterpartyId, date: active.row.date || '', term: form.querySelector('input').value.trim() });
      const key = params.toString();
      let cached = relatedContractCache.get(key);
      if (!cached || Date.now() - cached.createdAt > 60000) {
        const pending = (async () => { const response = await fetch(`${contracts.api}?${params}`, { signal: AbortSignal.timeout(25000) }); if (!response.ok) throw new Error('lookup unavailable'); return response.json(); })();
        cached = { createdAt: Date.now(), pending }; relatedContractCache.set(key, cached);
        if (relatedContractCache.size > 64) relatedContractCache.delete(relatedContractCache.keys().next().value);
        pending.catch(() => { if (relatedContractCache.get(key) === cached) relatedContractCache.delete(key); });
      }
      const data = await cached.pending;
      if (data.cityvizor_source_release_id !== active.context.evidence?.releaseId || data.release_id !== contracts.warehouseReleaseId || data.payer_ico !== ico || data.supplier_ico !== active.row.counterpartyId || data.match_status !== 'not_verified' || !Array.isArray(data.rows) || data.rows.length > 50) throw new Error('lookup identity mismatch');
      if (active === invoiceContext && $('#record-dialog').open) host.innerHTML = window.PrahaInvoiceView.renderContracts(data, { T, esc, link });
    } catch {
      if (active === invoiceContext && $('#record-dialog').open) host.textContent = T('The related-contract service is unavailable. No missing contract or confirmed match is inferred.', 'Služba souvisejících smluv není dostupná. Neodvozujeme chybějící smlouvu ani potvrzenou vazbu.');
    } finally { if (active === invoiceContext) button.disabled = false; }
  }
  function openRecord(title, pairs, note, source) {
    $('#record-title').textContent = title;
    $('#record-body').innerHTML = `<dl class="pb-record">${pairs.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value ?? '—')}</dd>`).join('')}</dl><p class="pb-note">${esc(note)}</p><p class="pb-note">${source || ''}</p>`;
    if (!$('#record-dialog').open) $('#record-dialog').showModal();
  }

  // ---------------------------------------------------------------- life in the town
  function renderLivingCost() {
    const target = $('#living-cost');
    if (!target) return;
    const data = state.livingCost;
    const observation = data?.status === 'available' ? data.observations.filter(o => o.year <= state.year).sort((a, b) => b.year - a.year)[0] : null;
    const heading = `<h3 class="pb-card-title">${T('Cost of living · housing', 'Náklady na život · bydlení')}</h3>`;
    if (!observation) { target.innerHTML = heading + `<p role="status">${T('No verified Prague housing-cost average is published here for the selected year or earlier.', 'Pro vybraný rok ani dřívější roky zde není publikován ověřený průměr nákladů pražských domácností na bydlení.')}</p>`; return; }
    const source = data.sources.find(s => s.id === observation.source_id);
    target.innerHTML = heading + `<p class="pb-kicker">${T('Average monthly housing expenditure', 'Průměrné měsíční výdaje na bydlení')}</p><div class="pb-outcome-value">${number(Number(observation.amount_exact), 0)} <span>${T('CZK / household / month', 'Kč / domácnost / měsíc')}</span></div><p class="pb-note">${observation.year} · ${T('Prague · all households · official survey', 'Praha · všechny domácnosti · oficiální šetření')} · ${link(source.url, 'ČSÚ')}</p><p>${T('Includes rent or housing charges, energy, water and other housing services across tenants and owners. This is housing spending, one component of living costs. Food, transport and other spending are outside this figure.', 'Zahrnuje nájemné nebo úhrady za užívání bytu, energie, vodu a další služby spojené s bydlením u nájemníků i vlastníků. Jde o výdaje na bydlení, jednu složku životních nákladů. Potraviny, doprava a další výdaje v této částce nejsou.')}</p><p class="pb-note">${T('The household survey average stays per household when the budget view switches to per resident.', 'Průměr ze šetření zůstává na domácnost i při přepnutí rozpočtu na obyvatele.')}</p>`;
  }
  function renderContext() {
    if (!state.context?.series?.length) return;
    const series = state.context.series.find(item => item.id === $('#context-series').value) || state.context.series[0], points = series.points.filter(row => row.year <= state.year), latest = points.filter(row => row.value !== null).at(-1), title = name(series), nativeUnit = series.unit || T('source units', 'jednotky zdroje'), displayDigits = Math.min(series.decimals ?? 1, 1);
    $('#context-title').textContent = `${title} · ${nativeUnit}`;
    plot('#context-chart', { type: 'line', rows: points, fields: [{ key: 'value', label: title, color: '#a8b63f' }], title: `${title} · ${city().name} · ${nativeUnit}`, unit: nativeUnit, height: 300, format: value => `${number(value, displayDigits)} ${nativeUnit}`, axisFormat: value => number(value, 1), selectedLabel: String(state.year), includeZero: true }, { name: 'PAQ Research · DataPAQ', url: latest?.sourceUrl || state.context.evidence.sourceUrl, edition: state.context.snapshot, table: series.id, definition: series.definition, caveat: T(`Municipality ${city().territoryCode} only. Missing years are not interpolated.`, `Pouze obec ${city().territoryCode}. Chybějící roky nejsou dopočítávány.`) });
    const result = Math2.associateAnnualChanges(state.overview.history, series.points, { budgetKey: $('#context-budget').value, lag: Number($('#context-lag').value), endYear: state.year, perCapita: state.unit === 'per-capita' });
    $('#context-detail').innerHTML = `<p class="pb-kicker">${T('Latest observation', 'Poslední pozorování')}</p><div class="pb-outcome-value">${latest ? number(latest.value, displayDigits) : '—'} <span>${esc(nativeUnit)}</span></div><p class="pb-note">${latest ? `${latest.year} · ${link(latest.sourceUrl, 'DataPAQ')}` : T('No observation up to the selected year.', 'Do vybraného roku není pozorování.')}</p><details class="pb-disclosure"><summary>${T('Definition', 'Definice')}</summary><p>${esc(series.definition)}</p></details><div class="pb-association" id="association-status"><p class="pb-kicker">${T('Correlation of annual changes', 'Korelace meziročních změn')}</p><p><strong>${result.r !== null ? `r = ${number(result.r, 1)}` : T('Not enough data', 'Nedostatek dat')}</strong></p><p class="pb-note">${result.r !== null ? T(`Across ${result.pairs.length} matched years. An association, not a causal effect.`, `Z ${result.pairs.length} párových let. Souvislost, nikoli příčinný účinek.`) : T(`${result.pairs.length} matched years; at least five with some variation are needed.`, `${result.pairs.length} párových let; je třeba alespoň pět s určitou variabilitou.`)}</p><details class="pb-disclosure"><summary>${T('How it is calculated', 'Jak se počítá')}</summary><p>${T('Each change = 100 × (value / previous year − 1). Budget year t is matched with outcome year t + lag, using observed consecutive years only. No adjustment for inflation or other factors.', 'Každá změna = 100 × (hodnota / předchozí rok − 1). Rozpočtový rok t se páruje s ukazatelem v roce t + zpoždění, pouze z pozorovaných navazujících let. Bez očištění o inflaci a další vlivy.')}</p><div class="pb-table-wrap"><table class="pb-table"><thead><tr><th>${T('Years', 'Roky')}</th><th>${T('Budget Δ', 'Rozpočet Δ')}</th><th>${T('Outcome Δ', 'Ukazatel Δ')}</th></tr></thead><tbody>${result.pairs.map(row => `<tr><td>${row.year} → ${row.outcomeYear}</td><td>${percent(row.budgetChange)}</td><td>${percent(row.outcomeChange)}</td></tr>`).join('')}</tbody></table></div></details></div>`;
  }

  // ------------------------------------------------ connected Prague results
  const organizationState = { result: null, key: null, kind: 'plans', page: 0, request: 0, error: null, loading: false };
  function connectionsShell() {
    return section('connections', T('Connections and coverage', 'Vazby a pokrytí'), T('Partly connected. Every available figure keeps its source and scope; missing records and unverified links remain visible.', 'Částečně propojeno. Každá dostupná částka zachovává zdroj a rozsah; chybějící záznamy a neověřené vazby zůstávají viditelné.'), `
      <div id="connection-status" aria-live="polite"></div>
      <details class="pb-disclosure"><summary>${T('All audit findings · 5 October 2026', 'Všechny výsledky auditu · 5. října 2026')}</summary><div id="connection-audit"></div></details>
      <details class="pb-disclosure"><summary>${T('Financing · every published line and stage', 'Financování · každý publikovaný řádek a fáze')}</summary><div id="connection-financing"></div></details>
      <details class="pb-disclosure" id="organization-directory"><summary>${T('City-linked organisations · coverage and records', 'Organizace napojené na město · pokrytí a záznamy')}</summary>
        <p class="pb-note" id="organization-coverage"></p>
        <label class="pb-field"><span>${T('Find an organisation or IČO', 'Hledat organizaci nebo IČO')}</span><input type="search" id="organization-search"></label>
        <div class="pb-table-wrap"><table class="pb-table" id="organization-table"><thead><tr><th>${T('Organisation', 'Organizace')}</th><th>${T('Published years', 'Publikované roky')}</th><th>${T('Selected year', 'Vybraný rok')}</th></tr></thead><tbody></tbody></table></div>
        <div id="organization-records" aria-live="polite"></div>
      </details>
      <details class="pb-disclosure"><summary>${T('How to connect the remaining numbers', 'Jak propojit zbývající čísla')}</summary><ol class="pb-rules">
        <li>${T('Verify the city/district reporting boundary; retain both purpose and cost on each budget fact and the year-valid classifications.', 'Ověřit vykazovaný rozsah města a městských částí; zachovat účel i druh výdaje na každém rozpočtovém faktu a klasifikaci platnou pro daný rok.')}</li>
        <li>${T('Load district returns and match city-to-district transfers on both sides. Eliminate only verified internal flows in the selected scope.', 'Načíst výkazy městských částí a spárovat převody z města na obou stranách. Vyloučit pouze ověřené vnitřní toky ve zvoleném rozsahu.')}</li>
        <li>${T('Extend the entity list to district organisations and direct/indirect companies, using dated founder and ownership evidence. Connect full accounts, cash, debt, assets, liabilities and guarantees.', 'Rozšířit seznam subjektů o organizace městských částí a přímo i nepřímo vlastněné firmy s datovanými doklady zřizovatele a vlastnictví. Propojit úplné výkazy, peníze, dluh, aktiva, závazky a záruky.')}</li>
        <li>${T('Recover original contract numbers and amendment chains. Connect tender, contract, order, invoice, payment and delivery only where identifiers or documents supply evidence.', 'Obnovit původní čísla smluv a řetězce dodatků. Propojit zakázku, smlouvu, objednávku, fakturu, platbu a dodání pouze tam, kde identifikátory nebo dokumenty poskytují důkaz.')}</li>
        <li>${T('For each comparable total: identified components + explicitly unresolved remainder = the reported total. Preserve source values, dates, units, calculation inputs and missing coverage.', 'Pro každý srovnatelný celek: doložené složky + výslovně nevysvětlený zbytek = vykázaný součet. Zachovat zdrojové hodnoty, data, jednotky, vstupy výpočtů a chybějící pokrytí.')}</li>
      </ol><p class="pb-links">${link('https://monitor.statnipokladna.gov.cz/datovy-katalog/webova-sluzba', T('MONITOR district, statement and loan reports', 'MONITOR: výkazy městských částí, účetnictví a půjčky'))} · ${link('https://opendata-storage.praha.eu/OVO_seznam_organizaci_hmp/Seznam_organizaci_HMP_dokumentace.html', T('Official organisation directory and exclusions', 'Oficiální seznam organizací a omezení'))}</p></details>`);
  }
  function bindConnections() {
    $('#organization-search').addEventListener('input', renderOrganizations);
    $('#organization-table').addEventListener('click', event => { const button = event.target.closest('[data-organization]'); if (button) { organizationState.key = button.dataset.organization; organizationState.kind = 'plans'; loadOrganization(); } });
    $('#organization-records').addEventListener('click', event => {
      const kind = event.target.closest('[data-organization-kind]'), page = event.target.closest('[data-organization-page]'), record = event.target.closest('[data-organization-row]');
      if (kind) { organizationState.kind = kind.dataset.organizationKind; loadOrganization(); }
      if (page) { organizationState.page += Number(page.dataset.organizationPage); renderOrganizationRecords(); }
      if (record) {
        const result = organizationState.result, row = result?.rows[Number(record.dataset.organizationRow)]; if (!row) return;
        openRecord(result.profile.name, [[T('Year', 'Rok'), result.year], ['IČO', result.profile.ico], [T('Profile', 'Profil'), result.profile.key], [T('Release', 'Vydání'), result.releaseId], [T('Source valid to', 'Platnost zdroje'), result.summary.source_validity], ['SHA-256', result.summary.source_bulk_export?.sha256], ...Object.entries(row).map(([key, value]) => [key, typeof value === 'object' && value !== null ? JSON.stringify(value) : value])], T('Original fields of one published organisation record. Amount fields ending in _cents are CZK cents; no contract or bank payment is inferred.', 'Původní pole jednoho publikovaného záznamu organizace. Částky v polích končících _cents jsou v haléřích; neodvozujeme smlouvu ani bankovní platbu.'), link(result.profile.profile_url, 'CityVizor'));
      }
    });
  }
  function renderConnections() {
    const host = $('#connection-status'); if (!host) return;
    const detail = state.detail, joint = detail?.jointCoverage;
    const rows = [
      [T('Annual budget totals', 'Roční rozpočtové součty'), `${state.overview.coverage.budgetYears[0]}–${state.overview.coverage.budgetYears.at(-1)}`, T('Published; budget arithmetic checked for 2010–2025 in the audit.', 'Publikováno; rozpočtová aritmetika za roky 2010–2025 prověřena auditem.')],
      [T('Purpose → type of cost', 'Účel → druh výdaje'), joint?.status === 'reconciled' ? T('Connected · reconciled', 'Propojeno · odsouhlaseno') : !detail ? T('Loading', 'Načítání') : T('Not verified for this year', 'Pro tento rok neověřeno'), T('Open a service budget line for its native cost breakdown. It is shown only when all nine marginal checks agree.', 'Otevřete rozpočtový paragraf pro jeho původní druhové členění. Zobrazuje se pouze při shodě všech devíti kontrol.')],
      [T('Financing', 'Financování'), detail?.rows?.some(row => row.side === 'financing') ? T('Published below', 'Publikováno níže') : T('Not published for this year', 'Pro tento rok nepublikováno'), T('Separate from revenue and expenditure. The bridge to cash and debt is not yet reconciled.', 'Odděleno od příjmů a výdajů. Vazba na peníze a dluh zatím není odsouhlasena.')],
      [T('CityVizor records', 'Záznamy CityVizoru'), T('Partial · separate scope', 'Dílčí · samostatný rozsah'), T('Accounting, projects and invoice allocations overlap. They are not added to the budget or to each other.', 'Účetnictví, akce a fakturační alokace se překrývají. Nepřičítají se k rozpočtu ani vzájemně.')],
      [T('Districts and transfers', 'Městské části a převody'), T('Incomplete', 'Neúplné'), T('Audit: 18 district profiles; 17 have 2025 data, out of 57 expected districts. Both-sided transfer reconciliation remains missing.', 'Audit: 18 profilů městských částí; 17 má data za rok 2025 z očekávaných 57 částí. Chybí oboustranné odsouhlasení převodů.')],
      [T('Organisations', 'Organizace'), T('Directory and held records below', 'Seznam a uložené záznamy níže'), T('Published parent relationships, with coverage by year and layer. No automatic full-group consolidation.', 'Publikované vazby na zřizovatele s pokrytím podle roku a vrstvy. Bez automatické konsolidace celé skupiny.')],
      [T('City companies', 'Městské firmy'), T('Four reviewed recipients', 'Čtyři prověření příjemci'), T('City invoice allocations are linked to reviewed recipients; their own full financial accounts and indirect subsidiaries remain missing.', 'Fakturační alokace města jsou propojeny s prověřenými příjemci; chybí jejich vlastní úplné účetní výkazy a nepřímé dceřiné firmy.')],
      [T('Contracts → invoices → payments', 'Smlouvy → faktury → platby'), T('Links unverified', 'Vazby neověřeny'), T('Exact-party contract lookup is available. It does not verify invoice matches, settlement or delivery.', 'Je dostupné vyhledání smluv podle přesných smluvních stran. Nedokládá spárování faktur, úhradu ani dodání.')],
      [T('Assets, debt and delivery', 'Aktiva, dluh a dodání'), T('Connections missing', 'Vazby chybí'), T('Published cash is shown, but complete statements, debt movements, guarantees and project delivery need further source records.', 'Publikované peníze jsou zobrazeny, ale úplné výkazy, pohyby dluhu, záruky a dodání projektů vyžadují další zdrojové záznamy.')],
      [T('Current-year and historical detail', 'Detail aktuálního roku a historie'), T('Coverage gap', 'Mezera v pokrytí'), T('Native annual detail is connected for 2025. Older years have totals; the 2026 budget/interim returns are not connected here.', 'Původní roční detail je propojen za rok 2025. Starší roky mají součty; rozpočet a průběžné výkazy 2026 zde nejsou propojeny.')],
    ];
    host.innerHTML = `<div class="pb-table-wrap"><table class="pb-table"><thead><tr><th>${T('Layer', 'Vrstva')}</th><th>${T('Status', 'Stav')}</th><th>${T('Meaning and remaining gap', 'Význam a zbývající mezera')}</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const audit = [
      T('2025 native detail: nine exact checks passed, covering approved/revised/actual expense by purpose, expense by cost and revenue by type. This verifies arithmetic, not complete transaction coverage.', 'Původní detail 2025: prošlo devět přesných kontrol schválených/upravených/skutečných výdajů podle účelu a druhu a příjmů podle druhu. Ověřuje to aritmetiku, nikoli úplnost transakcí.'),
      T('All sixteen annual rows, 2010–2025: revenue − expenditure = balance; operating + capital = expenditure.', 'Všech šestnáct ročních řádků 2010–2025: příjmy − výdaje = saldo; běžné + kapitálové výdaje = výdaje.'),
      T('Magistrate 2025 publication: 2,679 accounting rows, 991 project/event rows and 756 invoice allocations; four source controls agree. Recorded invoice dates extend into 2026 and remain separate from the fiscal year.', 'Publikace magistrátu 2025: 2 679 účetních řádků, 991 řádků akcí a 756 fakturačních alokací; čtyři zdrojové kontroly souhlasí. Data záznamu faktur zasahují do roku 2026 a zůstávají oddělena od účetního roku.'),
      T('All 756 allocations lack descriptions; 13 lack usable counterparty IČOs; eight lack supplier names and recorded dates. Original invoice numbers/documents, item quantities, VAT, order/contract references and bank proof are not supplied in this publication.', 'Všem 756 alokacím chybí popis; 13 chybí použitelné IČO protistrany; osmi chybí jméno dodavatele a datum záznamu. Publikace neposkytuje původní čísla/dokumenty faktur, množství položek, DPH, odkazy na objednávky/smlouvy ani bankovní doklady.'),
      T('18 district profiles were held, with 17 publishing 2025 data. Praha 18 ends in 2020; the held Praha 14 profile lacks an IČO. Missing CityVizor coverage is not evidence that official district accounts do not exist.', 'Uloženo bylo 18 profilů městských částí, z toho 17 publikuje rok 2025. Praha 18 končí rokem 2020; uloženému profilu Praha 14 chybí IČO. Chybějící pokrytí CityVizoru není důkazem neexistence oficiálních výkazů.'),
      T('Contracts: 115,429 held observations for payer IČO 00064581, first/last publication 5 July 2016 / 18 September 2026. This is not a census of district/company contracts or a deduplicated spending total. Original contract numbers exist in sampled raw records but were omitted from the compact projection.', 'Smlouvy: 115 429 uložených pozorování pro plátce IČO 00064581, první/poslední publikace 5. července 2016 / 18. září 2026. Nejde o soupis smluv městských částí/firem ani součet výdajů bez duplicit. Původní čísla smluv existují ve vzorku zdrojových záznamů, ale byla vypuštěna ze zkrácené projekce.'),
      T('Reviewed companies: OICT, TSK, DPP and Pražské služby. In the 2025 allocation sample, 42 rows go to these recipients; 714 remain outside this reviewed ownership list. Their own accounts are not represented by city allocations.', 'Prověřené firmy: OICT, TSK, DPP a Pražské služby. Ve vzorku alokací 2025 jde 42 řádků těmto příjemcům; 714 zůstává mimo prověřený seznam vlastnictví. Alokace města nenahrazují vlastní výkazy firem.'),
      T('Prague scope metadata conflicts: the previous page described city-and-district consolidation while native facts use standalone_accounting_unit. The entity boundary remains under verification, despite matching financial totals.', 'Metadata rozsahu Prahy si odporují: předchozí stránka uváděla konsolidaci města a městských částí, zatímco původní fakta používají standalone_accounting_unit. Rozsah subjektů se ověřuje i přes shodné finanční součty.'),
      T('Organisation profile years do not guarantee current accounts: the two inspected 2025 organisation profiles report source validity 31 March 2024. Their held plan/account rows retain that stale validity date.', 'Rok profilu organizace nezaručuje aktuální výkazy: dva prověřené profily organizací za rok 2025 uvádějí platnost zdroje 31. března 2024. Jejich uložené plánové/účetní řádky toto starší datum zachovávají.'),
      T('The audit identified an IT selector/total mismatch, an unconditional completeness badge and missing detail-source metadata. This publication aligns the selector and exposes the actual coverage and source lineage.', 'Audit zjistil nesoulad IT výběru a součtu, nepodmíněný štítek úplnosti a chybějící metadata zdroje detailu. Toto vydání sjednocuje výběr a zobrazuje skutečné pokrytí a původ dat.'),
      T('Local context has 18 selected PAQ series. These are contextual observations and associations, not project delivery or causal effects. Desktop English/Czech checks passed; the initial audit did not certify mobile layout. One of 44 focused tests failed on contract-warning wording; the wording is corrected in this publication.', 'Místní kontext obsahuje 18 vybraných řad PAQ. Jde o kontextová pozorování a souvislosti, nikoli dodání projektů či příčinné účinky. Kontroly anglické/české desktopové verze prošly; počáteční audit neověřil mobilní rozložení. Jeden ze 44 cílených testů selhal na znění smluvního upozornění; toto vydání jej opravuje.'),
    ];
    $('#connection-audit').innerHTML = `<p class="pb-note">${T('Snapshot audit for 2025, checked 5 October 2026; these counts are dated audit observations, not current-year completeness claims.', 'Audit snímku 2025 provedený 5. října 2026; tyto počty jsou datovaná pozorování auditu, nikoli tvrzení o úplnosti aktuálního roku.')} ${link(ext().recordsUrl, T('CityVizor source profile; source controls are displayed in Annual statements', 'Zdrojový profil CityVizoru; zdrojové kontroly jsou zobrazeny v Ročních výkazech'))} · ${link(monitor(2025), T('Official 2025 budget source; lineage is displayed with the breakdown', 'Oficiální rozpočtový zdroj 2025; původ dat je zobrazen u členění'))}</p><ul class="pb-rules">${audit.map(text => `<li>${text}</li>`).join('')}</ul>`;
    const financing = (detail?.rows || []).filter(row => row.side === 'financing');
    const codes = [...new Set(financing.map(row => row.code))].sort();
    $('#connection-financing').innerHTML = financing.length ? `<p class="pb-note">${state.year} · ${T('CZK; source signed financing lines, shown independently from expenditure. Summary code 8000, if present, is not added to its components.', 'Kč; zdrojové financující položky se znaménkem, odděleně od výdajů. Souhrnný kód 8000, pokud je přítomen, se nepřičítá ke složkám.')} ${link(monitor(state.year), 'MONITOR')}</p><div class="pb-table-wrap"><table class="pb-table"><thead><tr><th>${T('Code', 'Kód')}</th>${['approved', 'adjusted', 'actual'].map(stage => `<th>${stageLabel(stage)}</th>`).join('')}</tr></thead><tbody>${codes.map(code => `<tr><td>${esc(code)} · ${esc(name(financing.find(row => row.code === code)))}</td>${['approved', 'adjusted', 'actual'].map(stage => `<td class="pb-currency">${exact(financing.find(row => row.code === code && row.stage === stage)?.amount)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="pb-empty">${T('No financing detail is published in this viewer for the selected year. Missing is not zero.', 'Pro vybraný rok není v tomto prohlížeči publikován detail financování. Chybějící není nula.')}</p>`;
    renderOrganizations(); renderOrganizationRecords();
  }
  function renderOrganizations() {
    const host = $('#organization-table tbody'); if (!host) return;
    const profiles = state.overview.cityvizor?.organizations || [], year = state.year, term = $('#organization-search').value.trim().toLocaleLowerCase(locale);
    const available = profiles.filter(profile => profile.available_years?.includes(year)), payments = profiles.filter(profile => profile.payment_years?.includes(year));
    $('#organization-coverage').textContent = state.overview.coverage.cityvizor.status === 'unavailable' ? T('The organisation directory could not be loaded. Coverage is unknown.', 'Seznam organizací se nepodařilo načíst. Pokrytí je neznámé.') : T(`${profiles.length} city-linked profiles; ${available.length} have some ${year} data; ${payments.length} advertise ${year} payments. This held directory excludes a verified census of district organisations and companies. Source release: ${state.overview.cityvizor?.release_id || '—'}.`, `${profiles.length} profilů napojených na město; ${available.length} má nějaká data za ${year}; ${payments.length} uvádí platby za ${year}. Tento uložený seznam není ověřeným soupisem organizací městských částí a firem. Zdrojové vydání: ${state.overview.cityvizor?.release_id || '—'}.`);
    host.innerHTML = profiles.filter(profile => !term || `${profile.name} ${profile.ico || ''}`.toLocaleLowerCase(locale).includes(term)).sort((a, b) => a.name.localeCompare(b.name, 'cs')).map(profile => `<tr><td>${esc(profile.name)}<small>IČO ${esc(profile.ico || T('not reported', 'neuvedeno'))} · ${link(profile.profile_url, 'CityVizor')}</small></td><td>${(profile.available_years || []).map(esc).join(', ') || '—'}</td><td>${profile.available_years?.includes(year) ? `<button type="button" class="pb-button secondary" data-organization="${esc(profile.key)}">${T('Open records', 'Otevřít záznamy')} · ${year}</button>` : esc(T('Not published', 'Nepublikováno'))}</td></tr>`).join('') || `<tr><td colspan="3">${T('No matching organisation profiles. This is not evidence of no organisations.', 'Žádné odpovídající profily organizací. Nejde o důkaz neexistence organizací.')}</td></tr>`;
  }
  async function loadOrganization() {
    const token = ++organizationState.request;
    organizationState.loading = true; organizationState.error = null; organizationState.result = null; organizationState.page = 0; renderOrganizationRecords();
    try { const result = await client.loadOrganizationRecords(organizationState.key, state.year, organizationState.kind); if (token !== organizationState.request) return; organizationState.result = result; }
    catch { if (token !== organizationState.request) return; organizationState.error = T('This organisation layer could not be loaded or verified. No other year or organisation has been substituted.', 'Tuto vrstvu organizace se nepodařilo načíst nebo ověřit. Jiný rok ani organizace nebyly dosazeny.'); }
    organizationState.loading = false; renderOrganizationRecords();
  }
  function renderOrganizationRecords() {
    const host = $('#organization-records'); if (!host) return;
    if (organizationState.loading) { host.innerHTML = `<p role="status">${T('Loading organisation records…', 'Načítání záznamů organizace…')}</p>`; return; }
    if (organizationState.error) { host.innerHTML = `<p class="pb-warning">${esc(organizationState.error)}</p>`; return; }
    const result = organizationState.result; if (!result) { host.replaceChildren(); return; }
    const pages = Math.max(1, Math.ceil(result.rows.length / 25)); organizationState.page = Math.max(0, Math.min(organizationState.page, pages - 1));
    const amount = (row, keys) => { const key = keys.find(key => Number.isFinite(Data.number(row[key]))); return key ? exact(Number(row[key]) / 100) : '—'; };
    host.innerHTML = `<h3>${esc(result.profile.name)} · ${result.year}</h3><p class="pb-note">${result.rows.length} ${T('published rows', 'publikovaných řádků')} · ${T('valid to', 'platnost do')} ${esc(result.summary.source_validity || '—')} · ${T('release', 'vydání')} ${esc(result.releaseId)} · ${link(result.profile.profile_url, 'CityVizor')}</p><p class="pb-note">${T('The source may label a profile year while its validity date is older. These are overlapping account/plan/record layers, not verified full-year cash payments; never add the layers together.', 'Zdroj může uvádět rok profilu, i když datum platnosti je starší. Jde o překrývající se účetní/plánové/záznamové vrstvy, nikoli ověřené celoroční peněžní platby; vrstvy nikdy nesčítejte.')}</p><div class="pb-segmented"><button type="button" data-organization-kind="plans" aria-pressed="${result.kind === 'plans'}">${T('Account plans and reported actuals', 'Plány účtů a vykázaná skutečnost')}</button><button type="button" data-organization-kind="accounting" aria-pressed="${result.kind === 'accounting'}">${T('Accounting rows', 'Účetní řádky')}</button><button type="button" data-organization-kind="payments" aria-pressed="${result.kind === 'payments'}" ${result.profile.payment_years?.includes(result.year) ? '' : 'disabled'}>${T('Invoice allocations', 'Fakturační alokace')}</button><button type="button" data-organization-kind="events" aria-pressed="${result.kind === 'events'}">${T('Projects/events', 'Akce')}</button><button type="button" data-organization-kind="pbo_payment_source_rows" aria-pressed="${result.kind === 'pbo_payment_source_rows'}" ${result.summary.alternate_pbo_payment_source_view ? '' : 'disabled'}>${T('Alternate source rows · overlap', 'Alternativní zdrojové řádky · překryv')}</button></div><div class="pb-table-wrap"><table class="pb-table"><thead><tr><th>${T('Record', 'Záznam')}</th><th>${T('Income · budget', 'Výnosy · plán')}</th><th>${T('Income · actual', 'Výnosy · skutečnost')}</th><th>${T('Cost · budget', 'Náklady · plán')}</th><th>${T('Cost · actual', 'Náklady · skutečnost')}</th></tr></thead><tbody>${result.rows.slice(organizationState.page * 25, organizationState.page * 25 + 25).map((row, index) => `<tr><td><button type="button" data-organization-row="${organizationState.page * 25 + index}">${esc(row.description || row.counterparty_name || row.row_id || row.analytic_label || row.synthetic_account || row.event || row.item || T('Original record fields', 'Původní pole záznamu'))}</button><small>${esc(row.date || '')} · ${esc(row.paragraph || '')} · ${esc(row.item || '')}</small></td><td class="pb-currency">${amount(row, ['income_budget_cents'])}</td><td class="pb-currency">${amount(row, ['income_actual_cents', 'income_cents'])}</td><td class="pb-currency">${amount(row, ['expenditure_budget_cents'])}</td><td class="pb-currency">${amount(row, ['expenditure_actual_cents', 'expenditure_cents'])}</td></tr>`).join('') || `<tr><td colspan="5">${T('This publication declares zero rows in this layer.', 'Tato publikace deklaruje nula řádků v této vrstvě.')}</td></tr>`}</tbody></table></div><p>${organizationState.page + 1}/${pages} <button type="button" data-organization-page="-1" ${organizationState.page === 0 ? 'disabled' : ''}>${T('Previous', 'Předchozí')}</button> <button type="button" data-organization-page="1" ${organizationState.page === pages - 1 ? 'disabled' : ''}>${T('Next', 'Další')}</button></p>`;
  }

  // ---------------------------------------------------------------- sources
  function renderEvidence() {
    const overview = state.overview, receipt = overview.evidence[0], detail = state.detail, profile = records(), contracts = overview.coverage.contracts, context = state.context;
    const source = (title, status, body, pairs, links) => `<article class="pb-source"><header><h3>${title}</h3><span class="pb-status-chip">${status}</span></header><p>${body}</p><p class="pb-links">${links}</p><details class="pb-disclosure"><summary>${T('Fingerprints', 'Otisky zdroje')}</summary><dl>${pairs.map(([key, value]) => `<dt>${key}</dt><dd>${esc(value ?? '—')}</dd>`).join('')}</dl></details></article>`;
    const years = overview.coverage.budgetYears;
    $('#evidence-list').innerHTML = [
      source(T('Budget', 'Rozpočet'), detail?.coverage?.fullBudgetBreakdown ? T('Published detail · check totals below', 'Publikovaný detail · součty ověřte výše') : T('Annual totals · detail missing for this year', 'Roční součty · detail pro tento rok chybí'), T(`Annual totals for ${years[0]}–${years.at(-1)} and the line-by-line breakdown for ${overview.coverage.detailYears.join(', ') || '—'}, from the Ministry of Finance’s FIN 2-12 M returns.`, `Roční součty ${years[0]}–${years.at(-1)} a rozpad po řádcích za ${overview.coverage.detailYears.join(', ') || '—'} z výkazů FIN 2-12 M Ministerstva financí.`), [[T('Dataset', 'Datová sada'), receipt?.datasetId], [T('Snapshot', 'Snímek'), receipt?.generatedAt], [T('Reporting unit', 'Účetní jednotka'), `IČO ${ico} · FIN 2-12 M`], [T('Detail source', 'Zdroj detailu'), detail?.evidence?.monitor?.source_id], [T('Detail ingestion', 'Zpracování detailu'), detail?.evidence?.monitor?.ingestion_id]], link(monitor(state.year), 'MONITOR') + (ext()?.consolidationUrl ? ' · ' + link(ext().consolidationUrl, T('Consolidation note', 'Konsolidace')) : '')),
      profile ? source(T('Published records', 'Publikované záznamy'), T('Partial', 'Dílčí'), T(`Accounting rows, projects and invoice allocations published by ${profile.name} on CityVizor. Publication does not prove a complete year or a bank payment.`, `Účetní řádky, akce a fakturační alokace publikované subjektem ${profile.name} na CityVizoru. Publikace nedokládá úplný rok ani bankovní platbu.`), [[T('Profile', 'Profil'), profile.key], [T('Release', 'Vydání'), detail?.evidence?.cityvizor?.releaseId || overview.coverage.cityvizor.release], [T('Source valid to', 'Platnost zdroje'), detail?.sourceValidity], [T('Accounting rows', 'Účetní řádky'), detail?.accountingRows?.length], ['SHA-256', detail?.evidence?.cityvizor?.sourceSha256], ...(ext()?.warehouse ? [[T('Warehouse release', 'Vydání datového skladu'), ext().warehouse.releaseId], [T('Archive', 'Archiv'), ext().warehouse.note[lang]]] : [])], link(profile.profile_url || ext()?.recordsUrl, `CityVizor · ${profile.name}`)) : '',
      contracts ? source(T('Contracts', 'Smlouvy'), T('Held · links unverified', 'Uloženo · vazby neověřeny'), T('Contracts from the register of contracts with this payer, held in a private warehouse. Opening an invoice looks up contracts with the same supplier; that is a lead, not a verified link.', 'Smlouvy z registru smluv s tímto plátcem, uložené v neveřejném datovém skladu. Otevřením faktury se vyhledají smlouvy se stejným dodavatelem; jde o podnět, nikoli ověřenou vazbu.'), [[T('Contracts held', 'Uložené smlouvy'), `${number(contracts.acceptedRows)} · ${contracts.completedAt.slice(0, 10)} · ${contracts.sourceQuery}`], [T('Warehouse release', 'Vydání datového skladu'), contracts.warehouseReleaseId], [T('Published', 'Publikováno'), contracts.warehousePublishedAt], [T('Receipt SHA-256', 'SHA-256 potvrzení'), contracts.warehouseReceiptSha256], [T('Snapshot fingerprint', 'Otisk snímku'), contracts.normalizedSha256]], link('https://www.hlidacstatu.cz/hledat?Q=' + encodeURIComponent('icoPlatce:' + ico), 'Hlídač státu') + ' · ' + link('https://smlouvy.gov.cz/', T('Register of contracts', 'Registr smluv'))) : '',
      source(T('Local conditions', 'Místní podmínky'), context?.series ? T('Published', 'Publikováno') : context?.unavailable ? T('Unavailable', 'Nedostupné') : T('Loading', 'Načítání'), T('Municipal indicators from PAQ Research, joined by the exact municipality code and year.', 'Ukazatele obcí od PAQ Research, spojené přesným kódem obce a rokem.'), [[T('Series', 'Řady'), context?.series ? `${context.series.length} · obec:${city().territoryCode}` : '—'], [T('Snapshot', 'Snímek'), context?.snapshot], [T('Licence', 'Licence'), context?.license || 'CC BY-NC 4.0']], link('https://datapaq.cz/?g=obec&vis=table', 'PAQ Research · DataPAQ')),
    ].join('');
  }

  // ---------------------------------------------------------------- start
  try {
    const overview = await client.loadOverview(); state.overview = overview;
    if (!overview.history.length) throw new Error('No published history');
    if (!overview.history.some(row => row.year === state.year)) state.year = overview.latest.year;
    try {
      const response = await fetch('/data/municipal-fx-rates.v1.json');
      if (response.ok) {
        const rates = await response.json();
        if (overview.history.every(row => Number.isFinite(rates.rates?.CZE?.years?.[row.year]?.local_per_usd) && Number.isFinite(rates.eur_per_usd?.[row.year]))) fxData = rates;
      }
    } catch { /* The source CZK view stays available when exchange rates cannot load. */ }
    if (!fxData) state.currency = 'CZK';
    document.title = T(`${overview.city.name} budget — Public Spending Data`, `Rozpočet: ${overview.city.name} — Public Spending Data`);
    await window.PSDPlotReady; chartReady = true; shell(); if (!fxData) { $('#budget-currency option[value="EUR"]').disabled = true; $('#budget-currency option[value="USD"]').disabled = true; } renderOverview(); renderSpending(); renderEvidence(); writeURL();
    app.setAttribute('aria-busy', 'false'); app.dataset.ready = 'true';
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    const detail = selectYear(state.year);
    const context = client.loadContext().then(value => { state.context = value; $('#context-series').innerHTML = value.series.map(series => `<option value="${esc(series.id)}">${esc(name(series))}</option>`).join(''); renderContext(); renderEvidence(); }).catch(() => { $('#context-series').innerHTML = `<option>${T('Unavailable', 'Nedostupné')}</option>`; $('#context-series').disabled = true; state.context = { unavailable: true }; $('#context-detail').innerHTML = `<p id="association-status" role="status">${T('Local indicators are unavailable for this municipality. No other place or estimate has been substituted.', 'Místní ukazatele pro tuto obec nejsou dostupné. Jiné místo ani odhad nebyl dosazen.')}</p>`; renderEvidence(); });
    const livingCost = ext()?.livingCostApi ? client.loadLivingCost().then(value => { state.livingCost = value; renderLivingCost(); }).catch(() => { state.livingCost = { status: 'unavailable' }; renderLivingCost(); }) : Promise.resolve();
    await Promise.allSettled([detail, context, livingCost]); app.dataset.loaded = 'true';
    let resizeTimer; window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { renderTrajectory(); renderSpending(); renderContext(); }, 160); });
  } catch (error) {
    fatal(T('This budget could not be opened.', 'Rozpočet se nepodařilo otevřít.'), `${T('The published data is unavailable for this IČO. Nothing old, partial or invented has been substituted.', 'Publikovaná data pro toto IČO nejsou dostupná. Nic starého, neúplného ani vymyšleného nebylo dosazeno.')} ${link(`https://monitor.statnipokladna.gov.cz/ucetni-jednotka/${ico}/prehled`, T('Official accounts', 'Oficiální výkazy'))}`);
  }
}());
