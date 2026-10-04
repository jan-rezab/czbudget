(() => {
  const section = document.getElementById('services');
  const country = document.getElementById('trade-country');
  if (!section || !country) return;
  const $ = (id) => document.getElementById(id);
  const en = new URLSearchParams(location.search).get('lang') === 'en' || document.documentElement.lang === 'en';
  const copy = en ? {
    nav: 'Services', kicker: 'Annual trade in services', title: 'Services have their own trade map',
    intro: 'Exports, imports, EBOPS categories and trading partners. Annual services are separate from monthly goods.',
    loading: 'Loading annual services…', select: 'Select a country to inspect its annual services.', absent: 'No verified annual services report is published for this country yet.',
    error: 'The verified services report is temporarily unavailable.', export: 'Exports', import: 'Imports', balance: 'Balance',
    trend: 'Annual services trend', categories: 'Largest service groups', partners: 'Largest partners',
    coverage: (a, b) => `${a} of ${b} years with a reported World total · unavailable years remain blank`,
    note: 'Source: UN Comtrade. Balance = reported World exports minus reported World imports (calculated). World totals are not sums of bilateral partners. EBOPS categories are hierarchical; a missing year is not zero.',
    none: 'No reported observations', year: 'Latest reported year'
  } : {
    nav: 'Služby', kicker: 'Roční obchod se službami', title: 'Služby mají vlastní mapu obchodu',
    intro: 'Vývoz, dovoz, kategorie EBOPS a partnerské země. Roční údaje jsou oddělené od měsíčního obchodu se zbožím.',
    loading: 'Načítání ročních služeb…', select: 'Vyberte zemi pro zobrazení ročního obchodu se službami.', absent: 'Pro tuto zemi zatím není zveřejněna ověřená roční zpráva o službách.',
    error: 'Ověřená zpráva o službách je dočasně nedostupná.', export: 'Vývoz', import: 'Dovoz', balance: 'Bilance',
    trend: 'Roční vývoj služeb', categories: 'Největší skupiny služeb', partners: 'Největší partneři',
    coverage: (a, b) => `${a} z ${b} let s hlášeným světovým součtem · chybějící roky zůstávají prázdné`,
    note: 'Zdroj: UN Comtrade. Bilance = hlášený vývoz do světa minus hlášený dovoz ze světa (výpočet). Světové součty nejsou součtem partnerů. Kategorie EBOPS tvoří hierarchii; chybějící rok není nula.',
    none: 'Žádná hlášená pozorování', year: 'Poslední hlášený rok'
  };
  const number = new Intl.NumberFormat(en ? 'en-US' : 'cs-CZ', {notation: 'compact', maximumFractionDigits: 1});
  const exact = new Intl.NumberFormat(en ? 'en-US' : 'cs-CZ', {maximumFractionDigits: 0});
  const money = value => `${number.format(value)} USD`;
  const state = {data: null, flow: 'export', serial: 0};
  const setText = (id, value) => {$(id).textContent = value;};
  setText('trade-services-nav', copy.nav);
  setText('trade-services-kicker', copy.kicker);
  setText('trade-services-title', copy.title);
  setText('trade-services-intro', copy.intro);
  setText('trade-services-trend-title', copy.trend);
  setText('trade-services-categories-title', copy.categories);
  setText('trade-services-partners-title', copy.partners);
  setText('trade-services-export-label', copy.export);
  setText('trade-services-import-label', copy.import);
  setText('trade-services-note-copy', copy.note);
  setText('trade-services-status', copy.select);
  const buttons = [...$('trade-services-flow').querySelectorAll('button')];
  buttons.forEach(button => {
    button.textContent = copy[button.dataset.flow];
    button.addEventListener('click', () => {
      state.flow = button.dataset.flow;
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      section.dataset.flow = state.flow;
      if (state.data) renderRanks(state.data);
    });
  });

  function renderRank(target, rows) {
    target.replaceChildren();
    const ranked = rows.filter(row => row.flow === state.flow && row.value_usd > 0)
      .sort((a, b) => b.value_usd - a.value_usd).slice(0, 7);
    if (!ranked.length) {const p = document.createElement('p'); p.className = 'trade-services-empty'; p.textContent = copy.none; target.append(p); return;}
    const max = ranked[0].value_usd;
    ranked.forEach(row => {
      const item = document.createElement('div'); item.className = 'trade-services-rank';
      const head = document.createElement('div'); head.className = 'trade-services-rank-head';
      const name = document.createElement('span'); name.textContent = row.name || row.code || '—';
      const amount = document.createElement('strong'); amount.textContent = money(row.value_usd);
      amount.title = `${exact.format(row.value_usd)} USD`;
      const bar = document.createElement('div'); bar.className = 'trade-services-rank-bar';
      const fill = document.createElement('i'); fill.style.width = `${Math.max(1, 100 * row.value_usd / max)}%`;
      head.append(name, amount); bar.append(fill); item.append(head, bar); target.append(item);
    });
  }
  function renderRanks(data) {
    renderRank($('trade-services-categories'), data.categories || []);
    renderRank($('trade-services-partners'), data.partners || []);
  }
  function drawTrend(data) {
    const target = $('trade-services-chart'); target.replaceChildren();
    const rows = (data.totals || []).filter(row => row.value_usd >= 0);
    const max = Math.max(1, ...rows.map(row => row.value_usd));
    const left = 42, right = 12, top = 12, bottom = 30, width = 540, height = 250;
    const x = year => left + (year - 2000) / 24 * (width - left - right);
    const y = value => top + (1 - value / max) * (height - top - bottom);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-hidden', 'true');
    const element = (type, attrs, className) => {
      const node = document.createElementNS(svg.namespaceURI, type);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
      if (className) node.setAttribute('class', className);
      svg.append(node); return node;
    };
    for (const fraction of [0, .5, 1]) {
      const yy = y(max * fraction);
      element('line', {x1:left, x2:width-right, y1:yy, y2:yy}, 'grid');
      element('text', {x:0, y:yy+4}).textContent = number.format(max * fraction);
    }
    for (const year of [2000, 2005, 2010, 2015, 2020, 2024])
      element('text', {x:x(year), y:height-4, 'text-anchor':'middle'}).textContent = year;
    for (const flow of ['export', 'import']) {
      const lookup = new Map(rows.filter(row => row.flow === flow).map(row => [row.year, row.value_usd]));
      let path = '', continuous = false;
      for (let year = 2000; year <= 2024; year++) {
        if (!lookup.has(year)) {continuous = false; continue;}
        path += `${continuous ? 'L' : 'M'}${x(year).toFixed(1)} ${y(lookup.get(year)).toFixed(1)} `;
        continuous = true;
      }
      if (path) element('path', {d:path.trim()}, `series ${flow}`);
    }
    target.append(svg);
    target.setAttribute('aria-label', `${copy.trend}, 2000–2024. ${copy.coverage(data.available_years.length, 25)}`);
  }
  function render(data) {
    state.data = data;
    $('trade-services-status').hidden = true;
    $('trade-services-content').hidden = false;
    const latest = data.latest_year;
    setText('trade-services-year', String(latest));
    setText('trade-services-coverage', copy.coverage(data.available_years.length, 25));
    const kpis = $('trade-services-kpis'); kpis.replaceChildren();
    for (const flow of ['export', 'import']) {
      const row = data.totals.find(item => item.year === latest && item.flow === flow);
      const card = document.createElement('div'); card.className = 'trade-services-kpi';
      const label = document.createElement('span'); label.textContent = `${copy[flow]} · ${latest}`;
      const value = document.createElement('strong'); value.textContent = row ? money(row.value_usd) : '—';
      if (row) value.title = `${exact.format(row.value_usd)} USD`;
      card.append(label, value); kpis.append(card);
    }
    const exports = data.totals.find(item => item.year === latest && item.flow === 'export');
    const imports = data.totals.find(item => item.year === latest && item.flow === 'import');
    if (exports && imports) {
      const difference = exports.value_usd - imports.value_usd;
      const card = document.createElement('div'); card.className = 'trade-services-kpi';
      const label = document.createElement('span'); label.textContent = `${copy.balance} · ${latest}`;
      const value = document.createElement('strong'); value.textContent = `${difference > 0 ? '+' : ''}${money(difference)}`;
      value.title = `${exact.format(difference)} USD`;
      card.append(label, value); kpis.append(card);
    }
    drawTrend(data); renderRanks(data);
  }
  async function load() {
    const code = country.value;
    if (!/^[A-Z]{3}$/.test(code)) return;
    const serial = ++state.serial;
    $('trade-services-content').hidden = true;
    const status = $('trade-services-status'); status.hidden = false; status.textContent = copy.loading;
    try {
      const response = await fetch(`/api/v1/trade/services?country=${encodeURIComponent(code)}`, {headers:{Accept:'application/json'}});
      if (!response.ok) throw Error('services_unavailable');
      const payload = await response.json();
      if (serial !== state.serial) return;
      const data = payload.data;
      if (!data || data.country !== code || !data.latest_year || !Array.isArray(data.totals) || !Array.isArray(data.available_years)) {
        status.textContent = copy.absent; return;
      }
      render(data);
    } catch {
      if (serial === state.serial) status.textContent = copy.error;
    }
  }
  country.addEventListener('change', load);
  const observer = new MutationObserver(() => {if (/^[A-Z]{3}$/.test(country.value)) {observer.disconnect(); load();}});
  observer.observe(country, {childList:true});
  if (/^[A-Z]{3}$/.test(country.value)) {observer.disconnect(); load();}
})();
