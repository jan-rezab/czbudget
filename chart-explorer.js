(function () {
  'use strict';
  const slug = 'explorer-government-finances';
  const keys = ['metric', 'countries', 'start', 'end', 'year', 'mode', 'view'];
  const root = document.querySelector('.explorer-workspace');
  const M = window.PSDExplorerModel;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const number = value => value === null ? 'Not reported' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 }).format(value);
  const signed = value => value === null ? 'Not comparable' : `${value > 0 ? '+' : ''}${number(value)}`;
  const swatch = field => `<i class="explorer-swatch ${field.dash ? 'dashed' : ''}" style="--series-color:${field.color}" aria-hidden="true"></i>`;
  let dataset, state, controller, chart, focus = null;

  function fromURL() {
    const query = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
    return Object.fromEntries(keys.map(key => [key, hash.get(`${slug}.${key}`) ?? query.get(key)]).filter(([, value]) => value !== null));
  }
  function update(patch) {
    state = M.normalize({ ...state, ...patch }, dataset);
    render();
    controller.writeState({ ...state, countries: state.countries.join(',') });
  }
  function render() {
    const active = document.activeElement;
    const restoreID = root.contains(active) ? active.id : null;
    const restorePoint = root.contains(active) ? active.dataset?.point : undefined;
    chart?.destroy();
    const data = M.build(dataset, state), metric = M.metrics[state.metric];
    const years = Array.from({ length: dataset.period.end_year - dataset.period.start_year + 1 }, (_, i) => dataset.period.start_year + i);
    const options = selected => years.map(year => `<option${selected === year ? ' selected' : ''}>${year}</option>`).join('');
    const usable = data.snapshot.filter(row => row.plotted !== null);
    const high = usable[0], low = usable.at(-1);
    const difference = usable.length > 1 ? Number((high.plotted - low.plotted).toFixed(6)) : null;
    const viewButton = (value, label) => `<button id="view-${value}" data-view="${value}" aria-pressed="${state.view === value}">${label}</button>`;
    const modeButton = (value, label) => `<button id="mode-${value}" data-mode="${value}" aria-pressed="${state.mode === value}">${label}</button>`;
    root.innerHTML = `
      <div class="explorer-chart-head"><div><span class="explorer-eyebrow">${state.mode === 'change' ? `CHANGE FROM ${state.start} · PERCENTAGE POINTS` : 'ANNUAL SERIES · SHARE OF GDP'}</span><h2>${metric.title}${state.mode === 'level' ? ' as a share of GDP' : ': change over time'}</h2><p>${metric.description}</p></div><label class="explorer-metric" for="explorer-metric">Explore another measure<select id="explorer-metric">${Object.entries(M.metrics).map(([key, item]) => `<option value="${key}"${key === state.metric ? ' selected' : ''}>${item.title}</option>`).join('')}</select></label></div>
      <div class="explorer-toolbar"><div class="explorer-segment" role="group" aria-label="Chart view">${viewButton('line', 'Trend')}${viewButton('bar', 'Ranking')}${viewButton('table', 'Table')}</div><div class="explorer-segment" role="group" aria-label="Comparison measure">${modeButton('level', 'Share of GDP')}${modeButton('change', 'Change over time')}</div><button class="explorer-compare" id="explorer-compare">+ Compare countries <span aria-hidden="true">(${state.countries.length})</span></button></div>
      <div class="explorer-chips">${data.fields.map(field => `<button id="focus-${field.key}" class="explorer-chip" data-focus="${field.key}" aria-label="Emphasize ${esc(field.label)}" aria-pressed="${focus === field.key}">${swatch(field)}${esc(field.label)}</button>`).join('')}<span class="explorer-hint">Select a country name to emphasize its line</span></div>
      <div class="explorer-object"><div class="explorer-body"><div class="explorer-plot-wrap"><div id="explorer-plot" class="explorer-plot"></div><div class="explorer-table"${state.view === 'table' ? '' : ' hidden'}></div><p class="explorer-plot-note">${state.view === 'table' ? 'Exact plotted values. An empty cell means no reported or comparable value.' : 'Hover or tap to inspect · Use ← → keys on the chart · Select a year to update the comparison'}</p></div><aside class="explorer-snapshot" aria-label="Selected year comparison"><h3>COMPARE THE SAME YEAR <strong>${state.year}</strong></h3><ol class="explorer-snapshot-list">${data.snapshot.map(row => `<li><span class="explorer-snapshot-country">${swatch(row)}${esc(row.label)}</span><strong class="explorer-snapshot-value">${state.mode === 'change' ? (row.change === null ? '—' : `${signed(row.change)}<small> pp</small>`) : (row.value === null ? '—' : `${number(row.value)}<small>%</small>`)}</strong><span class="explorer-snapshot-change">${state.mode === 'change' ? (row.value === null ? 'No reported value' : `${number(row.value)}% of GDP in ${state.year}`) : (row.change === null ? `No comparable ${state.start} value` : `${signed(row.change)} pp since ${state.start}`)}</span></li>`).join('')}</ol><p class="explorer-snapshot-note">Changes are calculated in percentage points (pp), not percent growth. Country selection is not a world ranking.</p></aside></div>
      <p class="explorer-insight">${difference !== null ? `<strong>${number(difference)} percentage points</strong> separate ${esc(high.label)} and ${esc(low.label)} in ${state.year}${state.mode === 'change' ? `, comparing their changes since ${state.start}` : ''}. <span>Calculated from ${number(high.plotted)}${state.mode === 'change' ? ' pp' : '%'} − ${number(low.plotted)}${state.mode === 'change' ? ' pp' : '%'}. ${usable.length} of ${state.countries.length} selected countries have comparable values.</span>` : 'Choose at least two countries with reported values for a same-year comparison.'}</p>
      <div class="explorer-time"><div class="explorer-range-fields"><label for="explorer-start">From</label><select id="explorer-start">${options(state.start)}</select><label for="explorer-end">to</label><select id="explorer-end">${options(state.end)}</select></div><div class="explorer-presets" role="group" aria-label="Time range"><button id="range-all" data-start="${dataset.period.start_year}" aria-pressed="${state.start === dataset.period.start_year && state.end === dataset.period.end_year}">All years</button><button id="range-2010" data-start="2010" aria-pressed="${state.start === 2010 && state.end === dataset.period.end_year}">Since 2010</button><button id="range-2019" data-start="2019" aria-pressed="${state.start === 2019 && state.end === dataset.period.end_year}">Since 2019</button></div><div class="explorer-year"><label class="explorer-time-label" for="explorer-year">Compare</label><input id="explorer-year" type="range" min="${state.start}" max="${state.end}" value="${state.year}" aria-label="Comparison year"><output for="explorer-year">${state.year}</output></div></div>
      <div class="explorer-source"><span>Source: <a href="${esc(dataset.source.url)}" target="_blank" rel="noreferrer">IMF · ${esc(dataset.source.dataset)} ↗</a><br>General government · ${metric.indicator} · ${data.unit}</span><span>Published coverage: ${dataset.period.start_year}–${dataset.period.end_year}<br>Reported years only · Missing values stay visible</span></div><div class="explorer-rail"><p class="explorer-status" role="status"></p></div></div>`;
    root.setAttribute('aria-busy', 'false');
    const plotHost = root.querySelector('#explorer-plot');
    const fields = data.fields.map(field => ({ ...field, tableLabel: `${field.label} · ${metric.title} · ${data.unit}${state.mode === 'change' ? ` since ${state.start}` : ''}`, format: value => `${state.mode === 'change' ? signed(value) : number(value)}${state.mode === 'change' ? ' pp' : '%'}` }));
    const bar = state.view === 'bar';
    chart = window.PSDPlot.render(plotHost, {
      type: bar ? 'bar' : 'line', title: `${metric.title}, ${state.start}–${state.end}`, unit: data.unit,
      rows: bar ? data.snapshot.map(row => ({ label: row.label, value: row.plotted, color: row.color })) : data.rows,
      fields: bar ? [{ key: 'value', label: `${state.year} · ${data.unit}`, format: value => `${number(value)}${state.mode === 'change' ? ' pp' : '%'}` }] : fields,
      rowColor: row => row.color, endLabels: true, showPoints: false, valueLabels: true, activeField: focus,
      selectedLabel: state.year, axisFormat: value => `${number(value)}${state.mode === 'change' ? '' : '%'}`,
      height: bar ? 390 : undefined, includeZero: true,
      onSelect: row => { if (row.year) update({ year: row.year }); },
    });
    const accessor = chart.accessor;
    // Register the one shared table/export/source rail against the exact plotted model.
    controller = window.PSDChart.register({
      slug, el: root.querySelector('.explorer-object'), title: `${metric.title} · ${data.unit}${bar ? ` · ${state.year}` : ` · ${state.start}–${state.end}`}`,
      accessor, exports: state.view === 'table' ? ['csv'] : ['csv', 'png'],
      exportCaption: `${metric.title} · ${data.unit}${state.mode === 'change' ? ` since ${state.start}` : ''} · ${bar ? state.year : `${state.start}–${state.end}`}\n${data.fields.map(field => field.label).join(' · ')}\nSource: IMF ${dataset.source.dataset} · ${metric.indicator} · publicspendingdata.org`, embeddable: false, state: { keys },
      source: { name: `IMF ${dataset.source.dataset}`, url: dataset.source.url, table: metric.indicator, edition: dataset.source.dataset,
        definition: `${metric.description} Dataset: ${dataset.dataset_id}. Published artifact: /data/sovereign-benchmark-slim.v1.json. Artifact generated ${dataset.generated_at}.`,
        caveat: `Country definitions can differ. Only years classified as actual by each source series are shown. Individual observation status is unavailable in this published extract. Missing values stay empty. ${state.mode === 'change' ? `Calculated change = value in each year minus the exact ${state.start} value; a missing baseline makes the change unavailable.` : 'All displayed values preserve the published precision.'} ${state.countries.map(code => `${dataset.countries.find(c => c.country_code === code).name_en}: ${dataset.countries.find(c => c.country_code === code).imf_fiscal_metadata?.general_government_composition || 'institutional composition not supplied'}`).join(' · ')}`,
        excludes: 'Projections, years beyond each source series’ actual boundary, and separate national budget trees.' },
    });
    const railSlot = root.querySelector('.explorer-rail');
    ['.psd-chart-rail', '.psd-chart-drawer'].forEach(selector => railSlot.prepend(root.querySelector(selector)));
    root.querySelector('.explorer-table').append(root.querySelector('.psd-chart-panel'));
    const tableAction = root.querySelector('[data-action=table]');
    if (state.view === 'table') { tableAction.click(); plotHost.hidden = true; }
    tableAction.hidden = true; // The shared table is controlled by the top-level view selector.
    const link = document.createElement('button'); link.type = 'button'; link.className = 'psd-chart-action'; link.textContent = 'Copy chart link';
    link.addEventListener('click', async () => {
      controller.writeState({ ...state, countries: state.countries.join(',') });
      const status = root.querySelector('.explorer-status');
      try { await navigator.clipboard.writeText(location.href); status.textContent = 'Link copied with countries, years, measure and view.'; }
      catch { status.textContent = 'Copy the chart address: '; const input = document.createElement('input'); input.value = location.href; input.readOnly = true; input.setAttribute('aria-label', 'Chart link'); status.append(input); input.select(); }
    });
    root.querySelector('.psd-chart-rail').prepend(link);
    root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => update({ view: button.dataset.view })));
    root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => update({ mode: button.dataset.mode })));
    root.querySelectorAll('[data-start]').forEach(button => button.addEventListener('click', () => update({ start: +button.dataset.start, end: dataset.period.end_year })));
    root.querySelectorAll('[data-focus]').forEach(button => button.addEventListener('click', () => { focus = focus === button.dataset.focus ? null : button.dataset.focus; render(); }));
    root.querySelector('#explorer-metric').addEventListener('change', event => update({ metric: event.target.value }));
    root.querySelector('#explorer-start').addEventListener('change', event => update({ start: +event.target.value }));
    root.querySelector('#explorer-end').addEventListener('change', event => update({ end: +event.target.value, start: Math.min(state.start, +event.target.value), year: +event.target.value }));
    root.querySelector('#explorer-year').addEventListener('input', event => { root.querySelector('output').value = event.target.value; });
    root.querySelector('#explorer-year').addEventListener('change', event => update({ year: +event.target.value }));
    root.querySelector('#explorer-compare').addEventListener('click', chooseCountries);
    if (restoreID) document.getElementById(restoreID)?.focus({ preventScroll: true });
    if (restorePoint !== undefined && state.view !== 'table') plotHost.querySelector(`[data-point="${restorePoint}"]`)?.focus({ preventScroll: true });
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
      await window.PSDPlotReady;
      state = M.normalize({ ...M.defaults, ...fromURL() }, dataset);
      render();
      window.addEventListener('popstate', () => { state = M.normalize({ ...M.defaults, ...fromURL() }, dataset); render(); });
      window.addEventListener('hashchange', () => { state = M.normalize({ ...M.defaults, ...fromURL() }, dataset); render(); });
    } catch (error) {
      root.setAttribute('aria-busy', 'false');
      root.innerHTML = '<div class="explorer-loading"><h2>The chart could not load</h2><p>Please reload to try again. The published dataset is still available below.</p><a href="/data/sovereign-benchmark-slim.v1.json">Open source data</a></div>';
      console.error('Chart explorer:', error);
    }
  }
  init();
})();
