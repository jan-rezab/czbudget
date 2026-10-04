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
    none: 'No reported observations', year: 'Year', table: 'Annual values in a table'
  } : {
    nav: 'Služby', kicker: 'Roční obchod se službami', title: 'Služby mají vlastní mapu obchodu',
    intro: 'Vývoz, dovoz, kategorie EBOPS a partnerské země. Roční údaje jsou oddělené od měsíčního obchodu se zbožím.',
    loading: 'Načítání ročních služeb…', select: 'Vyberte zemi pro zobrazení ročního obchodu se službami.', absent: 'Pro tuto zemi zatím není zveřejněna ověřená roční zpráva o službách.',
    error: 'Ověřená zpráva o službách je dočasně nedostupná.', export: 'Vývoz', import: 'Dovoz', balance: 'Bilance',
    trend: 'Roční vývoj služeb', categories: 'Největší skupiny služeb', partners: 'Největší partneři',
    coverage: (a, b) => `${a} z ${b} let s hlášeným světovým součtem · chybějící roky zůstávají prázdné`,
    note: 'Zdroj: UN Comtrade. Bilance = hlášený vývoz do světa minus hlášený dovoz ze světa (výpočet). Světové součty nejsou součtem partnerů. Kategorie EBOPS tvoří hierarchii; chybějící rok není nula.',
    none: 'Žádná hlášená pozorování', year: 'Rok', table: 'Roční hodnoty v tabulce'
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
  setText('trade-services-table-title', copy.table);
  setText('trade-services-table-year', copy.year);
  setText('trade-services-table-export', `${copy.export} · USD`);
  setText('trade-services-table-import', `${copy.import} · USD`);
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
    const target = $('trade-services-chart');
    const table = $('trade-services-table-body');
    const totals = new Map((data.totals || []).map(row => [`${row.year}:${row.flow}`, row]));
    const rows = Array.from({length: 25}, (_, index) => {
      const year = 2000 + index;
      const exports = totals.get(`${year}:export`);
      const imports = totals.get(`${year}:import`);
      return {year, export: exports?.value_usd ?? null, import: imports?.value_usd ?? null,
        source_export: exports?.source_value_usd ?? null, source_import: imports?.source_value_usd ?? null};
    });
    table.replaceChildren();
    rows.slice().reverse().forEach(row => {
      const tr = document.createElement('tr');
      const year = document.createElement('th'); year.scope = 'row'; year.textContent = String(row.year); tr.append(year);
      for (const flow of ['export', 'import']) {
        const cell = document.createElement('td');
        cell.textContent = row[`source_${flow}`] == null ? '—' : `${row[`source_${flow}`]} USD`;
        tr.append(cell);
      }
      table.append(tr);
    });
    target.setAttribute('aria-label', `${copy.trend}, 2000–2024. ${copy.coverage(data.available_years.length, 25)}`);
    window.PSDPlotReady.then(plot => {
      if (state.data !== data) return;
      plot.render(target, {type:'line',rows,unit:'USD',locale:en?'en-GB':'cs-CZ',compact:true,height:250,
        title:copy.trend,showPoints:true,
        fields:[
          {key:'export',label:copy.export,color:'#17635b',format:(_value,row)=>`${row.source_export} USD`},
          {key:'import',label:copy.import,color:'#b16b44',format:(_value,row)=>`${row.source_import} USD`},
        ],
      });
    }).catch(() => {if (state.data === data) target.textContent = copy.error;});
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
