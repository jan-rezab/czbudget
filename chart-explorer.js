(function () {
  'use strict';
  let slug = 'explorer-government-finances';
  const keys = ['metric', 'countries', 'start', 'end', 'year', 'mode', 'view', 'scale'];
  const root = document.querySelector('.explorer-workspace');
  const M = window.PSDExplorerModel;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const formatter = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 });
  const number = value => value === null ? 'Not reported' : formatter.format(value);
  const signed = value => value === null ? 'Not comparable' : `${value > 0 ? '+' : ''}${number(value)}`;
  const swatch = field => `<i class="explorer-swatch ${field.dash ? 'dashed' : ''}" style="--series-color:${field.color}" aria-hidden="true"></i>`;
  const $ = selector => root.querySelector(selector);
  let dataset, state, controller, chart, navigator, currentData, focus = null, frame = 0, navigatorKey = '', legendKey = '';
  const trade = () => dataset.kind === 'trade';
  const compactUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
  const valueLabel = (value, change = false) => value === null ? '—' : trade()
    ? `${change && value > 0 ? '+' : ''}${compactUSD.format(value)}`
    : `${change ? signed(value) : number(value)}${change ? ' pp' : '%'}`;
  const sourceName = () => `${dataset.source.short_name || 'IMF'} ${dataset.source.dataset}`;

  function fromURL() {
    const query = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
    return Object.fromEntries(keys.map(key => [key, hash.get(`${slug}.${key}`) ?? query.get(key)]).filter(([, value]) => value !== null));
  }
  function writeURL() { controller?.writeState({ ...state, countries: state.countries.join(',') }); }
  function update(patch, options = {}) {
    state = M.normalize({ ...state, ...patch }, dataset);
    cancelAnimationFrame(frame);
    if (options.live && !document.hidden) frame = requestAnimationFrame(() => paint({ live: true, animate: false }));
    else paint({ live: !!options.live, animate: options.animate !== false });
    if (!options.live) writeURL();
  }
  function rangeCommit(range) {
    cancelAnimationFrame(frame);
    state = M.normalize({ ...state, ...range }, dataset);
    paint({ animate: true }); writeURL();
    $('.explorer-status').textContent = '';
  }
  function resetRange() { update({ start: dataset.period.start_year, end: dataset.period.end_year, year: dataset.period.end_year }); }
  function mount() {
    const years = Array.from({ length: dataset.period.end_year - dataset.period.start_year + 1 }, (_, i) => dataset.period.start_year + i);
    const options = years.map(year => `<option>${year}</option>`).join('');
    root.innerHTML = `
      <div class="explorer-chart-head"><div><h1 id="explorer-title"></h1><p id="explorer-description"></p></div><label class="explorer-metric" for="explorer-metric"><span>Measure</span><select data-custom-select="true" id="explorer-metric" aria-label="Chart measure">${Object.entries(M.metricsFor(dataset)).map(([key, item]) => `<option value="${key}">${item.title}</option>`).join('')}</select></label></div>
      <div class="explorer-toolbar"><div class="explorer-segment" role="group" aria-label="Chart view"><button id="view-line" data-view="line">Trend</button><button id="view-bar" data-view="bar">Bars</button><button id="view-table" data-view="table">Table</button></div><div class="explorer-segment explorer-measure-toggle" role="group" aria-label="Comparison measure"><button id="mode-level" data-mode="level">${trade() ? 'Trade value' : 'Share of GDP'}</button><button id="mode-change" data-mode="change">Change</button></div><button class="explorer-scale" id="explorer-scale" title="Fit the vertical axis to the visible values. Bars always start at zero.">↕ Fit y-axis</button><button class="explorer-compare" id="explorer-compare">+ Countries</button></div>
      <div class="explorer-readout"><div class="explorer-chips"></div><div class="explorer-inspect-year"><span>Year</span><select data-custom-select="true" id="explorer-year" aria-label="Comparison year">${options}</select><span id="explorer-hover-year" hidden></span></div></div>
      <div class="explorer-object"><div class="explorer-body"><div class="explorer-plot-wrap"><div id="explorer-plot" class="explorer-plot"></div><div class="explorer-table" hidden></div></div></div>
      <div class="explorer-time"><div class="explorer-range-fields"><label for="explorer-start">From</label><select data-custom-select="true" id="explorer-start">${options}</select><span aria-hidden="true">—</span><label class="explorer-sr-only" for="explorer-end">To year</label><select data-custom-select="true" id="explorer-end">${options}</select><span class="explorer-range-count"></span></div><div class="explorer-presets" role="group" aria-label="Time range"><button id="range-all" data-years="all">All</button><button id="range-10" data-years="10">10Y</button><button id="range-5" data-years="5">5Y</button><button id="range-3" data-years="3">3Y</button></div></div>
      <div id="explorer-navigator" aria-label="Zoom and move the visible year range"></div>
      <div class="explorer-source"><span>Source: <a href="${esc(dataset.source.url)}" target="_blank" rel="noreferrer">${esc(dataset.source.short_name || 'IMF')} · ${esc(dataset.source.dataset)} ↗</a><span id="explorer-source-unit"></span></span><span class="explorer-source-coverage">${dataset.period.start_year}–${dataset.period.end_year} · Reported years only</span></div><div class="explorer-rail"><p class="explorer-status" role="status"></p></div></div>`;
    $('.explorer-toolbar').append($('.explorer-inspect-year'));
    root.setAttribute('aria-busy', 'false');
    root.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.view) update({ view: button.dataset.view });
      else if (button.dataset.mode) update({ mode: button.dataset.mode });
      else if (button.dataset.years) {
        const end = dataset.period.end_year;
        update({ start: button.dataset.years === 'all' ? dataset.period.start_year : Math.max(dataset.period.start_year, end - Number(button.dataset.years) + 1), end, year: end });
      } else if (button.dataset.focus) {
        focus = focus === button.dataset.focus ? null : button.dataset.focus;
        root.querySelectorAll('[data-focus]').forEach(item => item.setAttribute('aria-pressed', String(focus === item.dataset.focus)));
        chart.emphasize(focus, true);
      } else if (button.id === 'explorer-scale') update({ scale: state.scale === 'fit' ? 'zero' : 'fit' });
      else if (button.id === 'explorer-compare') chooseCountries();
    });
    root.addEventListener('click', event => { if (event.target.closest('[data-action=png]')) chart.finish(); }, true);
    root.addEventListener('pointerover', event => { const chip = event.target.closest('[data-focus]'); if (chip) chart.emphasize(chip.dataset.focus); });
    root.addEventListener('pointerout', event => { if (event.target.closest('[data-focus]') && !event.relatedTarget?.closest?.('[data-focus]')) chart.emphasize(focus); });
    root.addEventListener('focusin', event => { const chip = event.target.closest('[data-focus]'); if (chip) chart.emphasize(chip.dataset.focus); });
    root.addEventListener('focusout', event => { if (event.target.closest('[data-focus]')) chart.emphasize(focus); });
    $('#explorer-metric').addEventListener('change', event => update({ metric: event.target.value }));
    $('#explorer-start').addEventListener('change', event => update({ start: +event.target.value }));
    $('#explorer-end').addEventListener('change', event => update({ end: +event.target.value, start: Math.min(state.start, +event.target.value), year: +event.target.value }));
    $('#explorer-year').addEventListener('change', event => selectYear(+event.target.value));
  }
  function selectYear(year) {
    state = M.normalize({ ...state, year }, dataset);
    if (state.view === 'bar') paint();
    else { chart.select(state.year); readout(state.year); $('#explorer-year').value = state.year; }
    writeURL();
  }
  function readout(year = state.year) {
    if (!currentData) return;
    for (const field of currentData.fields) {
      const value = M.observation(dataset, field.key, state.metric, year);
      const base = M.observation(dataset, field.key, state.metric, state.start);
      const change = value === null || base === null ? null : Number((value - base).toFixed(6));
      const chip = $(`[data-focus="${field.key}"]`);
      chip.querySelector('.explorer-chip-value').textContent = valueLabel(state.mode === 'change' ? change : value, state.mode === 'change');
      chip.querySelector('.explorer-chip-change').textContent = state.mode === 'change' ? (value === null ? 'Not reported' : valueLabel(value)) : (change === null ? 'Not comparable' : valueLabel(change, true));
    }
    const hovering = year !== state.year;
    $('#explorer-year').hidden = hovering; $('#explorer-hover-year').hidden = !hovering; $('#explorer-hover-year').textContent = year;
    root.dataset.inspectedYear = year;
  }
  function paint({ live = false, animate = true } = {}) {
    const started = performance.now();
    currentData = M.build(dataset, state);
    const data = currentData, metric = M.metricsFor(dataset)[state.metric], bar = state.view === 'bar';
    $('#explorer-title').textContent = `${metric.title}${state.mode === 'level' ? (trade() ? ' · annual' : ' as a share of GDP') : ': change since ' + state.start}`;
    $('#explorer-description').textContent = metric.description;
    $('#explorer-metric').value = state.metric;
    root.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    root.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    $('#explorer-scale').setAttribute('aria-pressed', String(state.scale === 'fit' && !bar)); $('#explorer-scale').disabled = state.view !== 'line';
    $('#explorer-compare').textContent = `+ Countries (${state.countries.length})`;
    const nextLegend = state.countries.join(',');
    if (nextLegend !== legendKey) {
      $('.explorer-chips').innerHTML = data.fields.map(field => `<button id="focus-${field.key}" class="explorer-chip" data-focus="${field.key}" aria-label="Emphasize ${esc(field.label)}" aria-pressed="false"><span class="explorer-chip-name">${swatch(field)}${esc(field.label)}</span><span class="explorer-chip-numbers"><strong class="explorer-chip-value"></strong><small class="explorer-chip-change" title="Calculated ${trade() ? 'USD' : 'percentage-point'} change from the first visible year"></small></span></button>`).join('');
      legendKey = nextLegend;
    }
    root.querySelectorAll('[data-focus]').forEach(button => button.setAttribute('aria-pressed', String(focus === button.dataset.focus)));
    readout();
    $('#explorer-start').value = state.start; $('#explorer-end').value = state.end; $('#explorer-year').value = state.year;
    [...$('#explorer-year').options].forEach(option => { option.disabled = +option.value < state.start || +option.value > state.end; });
    $('.explorer-range-count').textContent = `${state.end - state.start + 1} years`;
    root.querySelectorAll('[data-years]').forEach(button => button.setAttribute('aria-pressed', String(state.end === dataset.period.end_year && state.start === (button.dataset.years === 'all' ? dataset.period.start_year : dataset.period.end_year - Number(button.dataset.years) + 1))));
    $('#explorer-source-unit').textContent = ` · ${metric.indicator} · ${data.unit}`;
    const plotHost = $('#explorer-plot'), wasHidden = plotHost.hidden;
    plotHost.hidden = state.view === 'table'; $('.explorer-table').hidden = state.view !== 'table';
    const fields = data.fields.map(field => ({ ...field, tableLabel: `${field.label} · ${metric.title} · ${data.unit}${state.mode === 'change' ? ` since ${state.start}` : ''}`, format: value => valueLabel(value, state.mode === 'change') }));
    chart = window.PSDPlot.render(plotHost, {
      type: bar ? 'bar' : 'line', title: `${metric.title}, ${state.start}–${state.end}`, unit: data.unit,
      rows: bar ? data.snapshot.map(row => ({ label: row.label, value: row.plotted, color: row.color })) : data.rows,
      fields: bar ? [{ key: 'value', label: `${metric.title} · ${state.year} · ${data.unit}`, format: value => valueLabel(value, state.mode === 'change') }] : fields,
      rowColor: row => row.color, endLabels: true, showPoints: false, valueLabels: true, activeField: focus,
      selectedLabel: state.year, axisFormat: value => trade() ? compactUSD.format(value) : `${number(value)}${state.mode === 'change' ? '' : '%'}`,
      height: plotHost.clientWidth < 600 ? 250 : 300, compact: true,
      contextRows: bar ? undefined : data.contextRows,
      includeZero: bar || state.scale === 'zero', animate: animate && !live && !wasHidden && state.view !== 'table' ? 280 : false,
      onSelect: row => { if (row.year) selectYear(row.year); },
      onInspect: row => readout(row?.year ?? state.year),
      onRangeSelect: bar ? undefined : range => update({ start: +range.start, end: +range.end, year: +range.end }),
      onResetRange: resetRange,
    });
    const nextNavigator = `${state.metric}:${state.countries.join(',')}`;
    if (nextNavigator !== navigatorKey) {
      navigator?.destroy();
      const overview = M.build(dataset, { ...state, start: dataset.period.start_year, end: dataset.period.end_year, mode: 'level' });
      navigator = window.PSDPlot.renderRange($('#explorer-navigator'), {
        rows: overview.rows, fields: overview.fields, start: state.start, end: state.end,
        onChange: (range, viewport) => {
          $('#explorer-start').value = range.start; $('#explorer-end').value = range.end;
          $('.explorer-range-count').textContent = `${range.end - range.start + 1} years`;
          chart.viewport(viewport.start, viewport.end);
        },
        onCommit: rangeCommit,
        onCancel: () => { cancelAnimationFrame(frame); paint({ animate: false }); writeURL(); },
      });
      navigatorKey = nextNavigator;
    } else navigator.set(state.start, state.end);
    if (!live) refreshRail(data, metric, bar);
    root.dataset.renderMs = (performance.now() - started).toFixed(2);
  }
  function refreshRail(data, metric, bar) {
    const drawerOpen = $('.psd-chart-drawer') && !$('.psd-chart-drawer').hidden;
    root.querySelectorAll('.psd-chart-rail,.psd-chart-panel,.psd-chart-drawer').forEach(node => node.remove());
    controller = window.PSDChart.register({
      slug, el: $('.explorer-object'), title: `${metric.title} · ${data.unit}${bar ? ` · ${state.year}` : ` · ${state.start}–${state.end}`}`,
      accessor: chart.accessor, exports: state.view === 'table' ? ['csv'] : ['csv', 'png'],
      exportCaption: `${metric.title} · ${data.unit}${state.mode === 'change' ? ` since ${state.start}` : ''} · ${bar ? state.year : `${state.start}–${state.end}`}\n${data.fields.map(field => field.label).join(' · ')}\nSource: ${sourceName()} · ${metric.indicator} · publicspendingdata.org`, embeddable: false, state: { keys },
      source: trade() ? {
        name: sourceName(), url: dataset.source.url, table: dataset.source.table, edition: dataset.generated_at,
        definition: `${metric.description} ${dataset.source.definition}`,
        caveat: dataset.source.caveat,
        excludes: 'Services, monthly records, partner groups, duplicate HS aggregates and unclassified goods outside the loaded HS6 records.'
      } : { name: `IMF ${dataset.source.dataset}`, url: dataset.source.url, table: metric.indicator, edition: dataset.source.dataset,
        definition: `${metric.description} Dataset: ${dataset.dataset_id}. Published artifact: /data/sovereign-benchmark-slim.v1.json. Artifact generated ${dataset.generated_at}.`,
        caveat: `Country definitions can differ. Only years classified as actual by each source series are shown. Individual observation status is unavailable in this published extract. Missing values stay empty. ${state.mode === 'change' ? `Calculated change = value in each year minus the exact ${state.start} value; a missing baseline makes the change unavailable.` : `Changes beside the values are calculated as the selected year's value minus its ${state.start} value, in percentage points. All values preserve the published precision.`} ${state.countries.map(code => `${dataset.countries.find(c => c.country_code === code).name_en}: ${dataset.countries.find(c => c.country_code === code).imf_fiscal_metadata?.general_government_composition || 'institutional composition not supplied'}`).join(' · ')}`,
        excludes: 'Projections, years beyond each source series’ actual boundary, and separate national budget trees.' },
    });
    const railSlot = $('.explorer-rail');
    ['.psd-chart-rail', '.psd-chart-drawer'].forEach(selector => railSlot.prepend($(selector)));
    $('.explorer-table').append($('.psd-chart-panel'));
    const tableAction = $('[data-action=table]');
    if (state.view === 'table') tableAction.click();
    tableAction.hidden = true;
    if (drawerOpen) $('[data-action=sources]').click();
    const link = document.createElement('button'); link.type = 'button'; link.className = 'psd-chart-action'; link.textContent = 'Copy link';
    link.addEventListener('click', async () => {
      writeURL(); const status = $('.explorer-status');
      try { await window.navigator.clipboard.writeText(location.href); status.textContent = 'Link copied with your current view and zoom.'; }
      catch { status.textContent = 'Copy this address: '; const input = document.createElement('input'); input.value = location.href; input.readOnly = true; input.setAttribute('aria-label', 'Chart link'); status.append(input); input.select(); }
    });
    $('.psd-chart-rail').prepend(link);
  }
  function chooseCountries() {
    const selected = new Set(state.countries), dialog = document.createElement('dialog');
    dialog.className = 'explorer-dialog'; dialog.setAttribute('aria-labelledby', 'countries-title');
    dialog.innerHTML = `<header><h2 id="countries-title">Choose your comparison</h2><button class="explorer-dialog-close" aria-label="Close country selection">×</button></header><p>Compare up to four countries. Fewer lines are easier to follow.</p><label for="country-search" class="explorer-eyebrow">Find a country</label><input id="country-search" type="search" placeholder="Search name or country code" autocomplete="off"><div class="explorer-country-list"></div><footer><span class="explorer-status" role="status"></span><button class="explorer-dialog-apply">Apply comparison</button></footer>`;
    document.body.append(dialog);
    function list() {
      const query = dialog.querySelector('input[type=search]').value.toLowerCase();
      const countries = dataset.countries.filter(c => `${c.name_en} ${c.country_code}`.toLowerCase().includes(query)).sort((a, b) => Number(selected.has(b.country_code)) - Number(selected.has(a.country_code)) || a.name_en.localeCompare(b.name_en));
      dialog.querySelector('.explorer-country-list').innerHTML = countries.length ? countries.map(c => `<label><input type="checkbox" value="${c.country_code}"${selected.has(c.country_code) ? ' checked' : ''}${selected.size >= 4 && !selected.has(c.country_code) ? ' disabled' : ''}>${esc(c.name_en)}<small>${c.country_code}</small></label>`).join('') : '<p>No countries match your search.</p>';
      dialog.querySelector('.explorer-status').textContent = `${selected.size} of 4 selected${selected.size === 4 ? ' · Remove one to add another' : ''}`;
      dialog.querySelector('.explorer-dialog-apply').disabled = selected.size === 0;
    }
    dialog.querySelector('input[type=search]').addEventListener('input', list);
    dialog.querySelector('.explorer-country-list').addEventListener('change', event => { const code = event.target.value; event.target.checked ? selected.add(code) : selected.delete(code); list(); dialog.querySelector(`input[value="${code}"]`)?.focus(); });
    dialog.querySelector('.explorer-dialog-close').addEventListener('click', () => dialog.close());
    dialog.querySelector('.explorer-dialog-apply').addEventListener('click', () => { dialog.close(); focus = null; update({ countries: [...selected] }); });
    dialog.addEventListener('close', () => { dialog.remove(); root.querySelector('#explorer-compare').focus(); });
    list(); dialog.showModal(); dialog.querySelector('input[type=search]').focus();
  }
  async function init() {
    try {
      const embedded = document.getElementById('explorer-dataset');
      if (embedded) dataset = JSON.parse(embedded.textContent);
      else {
        const response = await fetch('/data/sovereign-benchmark-slim.v1.json');
        if (!response.ok) throw new Error(`Data request failed (${response.status})`);
        dataset = await response.json();
      }
      if (trade()) {
        slug = 'explorer-un-trade';
        document.title = 'UN trade history — Public Spending Data';
        document.querySelector('.explorer-footnote').textContent = dataset.source.caveat;
      }
      await window.PSDPlotReady;
      state = M.normalize({ ...M.defaults, ...fromURL() }, dataset);
      mount(); paint({ animate: false });
      const restore = () => { state = M.normalize({ ...M.defaults, ...fromURL() }, dataset); paint(); };
      window.addEventListener('popstate', restore); window.addEventListener('hashchange', restore);
    } catch (error) {
      root.setAttribute('aria-busy', 'false');
      root.innerHTML = '<div class="explorer-loading"><h2>The chart could not load</h2><p>Please reload to try again.</p><a href="/data/sovereign-benchmark-slim.v1.json">Open published data</a></div>';
      console.error('Chart explorer:', error);
    }
  }
  init();
})();
