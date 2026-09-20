(() => {
  const $ = selector => document.querySelector(selector);
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
  const form = $('#report-form');
  let reports = [], cursor = '', author = {}, topic = '', view = 'published', current = null, dirty = false, storageConfigured = false;
  const field = name => form.elements.namedItem(name);
  const split = value => value.split(',').map(s => s.trim()).filter(Boolean);
  const format = (value, unit) => `${new Intl.NumberFormat('en', { maximumFractionDigits: 2, minimumFractionDigits: unit === '%' ? 2 : 0 }).format(value)}${unit === '%' ? '%' : ''}`;
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function infographic(report) {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    const lines = (text, width) => {
      const result = []; let line = '';
      for (const word of text.split(/\s+/)) { if (line && ctx.measureText(`${line} ${word}`).width > width) { result.push(line); line = ''; } line += `${line ? ' ' : ''}${word}`; }
      if (line) result.push(line); return result;
    };
    ctx.font = 'bold 32px Arial'; const title = lines(report.title, 860);
    ctx.font = '15px Arial'; const sourceLines = lines(`Sources: ${report.sources.map(s => s.label).join('; ') || 'Not yet supplied'}`, 860);
    const hasScenario = report.chart.rows.some(r => /\bscenario\b/i.test(r.note));
    const chartY = 155 + title.length * 40;
    const height = chartY + 32 * report.chart.rows.length + 110 + sourceLines.length * 20 + (hasScenario ? 28 : 0);
    canvas.width = 1920; canvas.height = height * 2; ctx.scale(2, 2);
    ctx.fillStyle = '#171918'; ctx.fillRect(0, 0, 960, height); ctx.fillStyle = '#faf7ef';
    ctx.font = '13px Arial'; ctx.fillText('PUBLIC SPENDING DATA  /  MINI REPORTS', 50, 40);
    ctx.font = 'bold 32px Arial'; title.forEach((line, i) => ctx.fillText(line, 50, 95 + i * 40));
    ctx.font = '15px Arial'; ctx.fillText(`${report.authorName || 'Unassigned draft'} · ${report.status === 'published' ? 'Private feed' : 'Unpublished draft'} · ${report.chart.unit}`, 50, chartY - 55);
    const columns = report.chart.comparisonLabel ? [{key:'value',label:report.chart.label,start:270,end:545},{key:'comparisonValue',label:report.chart.comparisonLabel,start:590,end:910}] : [{key:'value',label:report.chart.label,start:270,end:910}];
    ctx.font = '13px Arial'; ctx.fillText('Place', 50, chartY - 18);
    for (const col of columns) { ctx.fillText(col.label, col.start, chartY - 18, col.end - col.start); col.max = Math.max(...report.chart.rows.map(row => row[col.key]), .000001); }
    report.chart.rows.forEach((row, i) => {
      const y = chartY + i * 32, scenario = /\bscenario\b/i.test(row.note);
      ctx.fillStyle = '#faf7ef'; ctx.font = '14px Arial'; ctx.fillText(row.label + (scenario ? ' †' : ''), 50, y + 18, 205);
      for (const col of columns) {
        ctx.fillStyle = scenario ? '#c93237' : col.key === 'value' ? '#a8b63f' : '#8b8d83';
        ctx.fillRect(col.start, y + 7, (col.end - col.start - 85) * row[col.key] / col.max, 12);
        ctx.fillStyle = '#faf7ef'; ctx.textAlign = 'right'; ctx.fillText(format(row[col.key], report.chart.unit), col.end, y + 18); ctx.textAlign = 'left';
      }
    });
    let y = chartY + report.chart.rows.length * 32 + 35; ctx.font = '14px Arial';
    if (hasScenario) { ctx.fillText('† Scenario assumption, not an observed local tax rate.', 50, y); y += 28; }
    ctx.font = '15px Arial'; sourceLines.forEach((line, i) => ctx.fillText(line, 50, y + i * 20));
    ctx.font = '12px Arial'; ctx.fillText('See the report for definitions, valuation differences and row-level notes.', 50, height - 25);
    canvas.toBlob(blob => { if (blob) download(blob, `mini-report-${report.id || 'preview'}.png`); }, 'image/png');
  }
  async function api(path = '', options = {}) {
    const response = await fetch(`/api/mini-reports${path}`, { ...options, headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
    if (response.status === 401) { location.assign('/developers/login?next=/mini-reports'); throw new Error('Please sign in again.'); }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Unable to load Mini Reports.');
    return data;
  }
  function setView(value) {
    view = value;
    $('#feed-tab').setAttribute('aria-pressed', String(view === 'published'));
    $('#draft-tab').setAttribute('aria-pressed', String(view === 'draft'));
    render();
  }
  function filterTag(value, type) {
    const button = el('button', value); button.type = 'button';
    button.onclick = () => { if (type === 'topic') topic = value; else $(`#${type}`).value = value; render(); };
    return button;
  }
  function card(report, preview = false) {
    const article = el('article', undefined, 'report-card');
    const byline = el('div', undefined, 'byline');
    const name = report.authorName || 'Awaiting an author';
    byline.append(el('span', report.authorName ? name.split(/\s+/).map(p => p[0]).slice(0, 2).join('') : '—', 'avatar'));
    const person = el('div'); person.append(el('p', name));
    const date = report.publishedAt ? new Date(report.publishedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Draft · unpublished';
    person.append(el('p', `${date} · Mini Report`, 'meta')); byline.append(person, el('span', report.status === 'published' ? 'Private feed' : 'Draft', 'status'));
    article.append(byline, el('h2', report.title), el('p', report.summary, 'summary'));
    const tags = el('div', undefined, 'tag-list');
    for (const t of report.topics) tags.append(filterTag(t, 'topic'));
    for (const c of report.countries) tags.append(filterTag(c, 'country'));
    article.append(tags);
    const chart = el('div', undefined, `chart${report.chart.comparisonLabel ? ' two' : ''}`);
    chart.dataset.chartSlug = `mini-report-${report.id || 'new'}${preview ? '-preview' : ''}`;
    chart.setAttribute('role', 'figure'); chart.setAttribute('aria-label', `${report.title}; values also available in the data table below.`);
    chart.append(el('h3', report.chart.label), el('p', `${report.chart.unit} · ${report.chart.rows.length} observations`, 'chart-unit'));
    const head = el('div', undefined, 'chart-head'); head.append(el('span', 'Place'), el('span', report.chart.label));
    if (report.chart.comparisonLabel) head.append(el('span', report.chart.comparisonLabel)); chart.append(head);
    const max = Math.max(...report.chart.rows.map(r => r.value), 0.000001);
    const secondMax = Math.max(...report.chart.rows.map(r => r.comparisonValue || 0), 0.000001);
    function mark(value, ceiling, second) {
      const wrap = el('span', undefined, `mark${second ? ' second' : ''}`), track = el('span', undefined, 'track'), bar = el('span', undefined, 'bar');
      bar.style.width = `${value / ceiling * 100}%`; track.append(bar); wrap.append(track, el('strong', format(value, report.chart.unit))); return wrap;
    }
    for (const row of report.chart.rows) {
      const scenario = /\bscenario\b/i.test(row.note);
      const line = el('div', undefined, `chart-row${scenario ? ' scenario' : ''}`);
      line.append(el('span', row.label + (scenario ? ' †' : ''), 'chart-label'), mark(row.value, max));
      if (report.chart.comparisonLabel) line.append(mark(row.comparisonValue, secondMax, true));
      chart.append(line);
    }
    article.append(chart);
    if (report.chart.rows.some(r => /\bscenario\b/i.test(r.note))) article.append(el('p', '† Scenario assumption; not an observed local property-tax rate.', 'source-line'));
    const sourceLine = el('div', undefined, 'source-line'); sourceLine.append(el('span', 'Sources: '));
    report.sources.forEach((source, i) => { if (i) sourceLine.append(document.createTextNode(' · ')); const a = el('a', source.label); a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; sourceLine.append(a); });
    if (!report.sources.length) sourceLine.append(document.createTextNode('Not yet added')); article.append(sourceLine);
    const details = el('details'); details.append(el('summary', 'Method, places & data'), el('p', report.methodology || 'Methodology has not been added.', 'method'));
    const cities = el('div', undefined, 'tag-list'); for (const city of report.cities) cities.append(filterTag(city, 'city')); details.append(cities);
    const table = el('table'), thead = el('thead'), tr = el('tr');
    for (const heading of ['Place', report.chart.label, ...(report.chart.comparisonLabel ? [report.chart.comparisonLabel] : []), 'Note']) { const th = el('th', heading); th.scope = 'col'; tr.append(th); } thead.append(tr); table.append(thead);
    const tbody = el('tbody');
    for (const row of report.chart.rows) { const tr = el('tr'); for (const value of [row.label, format(row.value, report.chart.unit), ...(report.chart.comparisonLabel ? [format(row.comparisonValue, report.chart.unit)] : []), row.note]) tr.append(el('td', value)); tbody.append(tr); }
    table.append(tbody); details.append(table); article.append(details);
    if (!preview) {
      const actions = el('div', undefined, 'report-actions');
      if (!report.authorId || report.authorId === author.id) { const edit = el('button', report.authorId ? 'Edit report' : 'Review & add your byline'); edit.onclick = () => editReport(report); actions.append(edit); }
      const csv = el('button', 'Download data'); csv.onclick = () => {
        const cell = v => { let s = String(v ?? ''); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
        const rows = [['Place', report.chart.label, ...(report.chart.comparisonLabel ? [report.chart.comparisonLabel] : []), 'Note'], ...report.chart.rows.map(r => [r.label, r.value, ...(report.chart.comparisonLabel ? [r.comparisonValue] : []), r.note])];
        download(new Blob([rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `mini-report-${report.id || 'preview'}.csv`);
      }; actions.append(csv);
      const png = el('button', 'Save infographic'); png.onclick = () => infographic(report); actions.append(png);
      const cite = el('button', 'Copy citation'); cite.onclick = async () => {
        try { await navigator.clipboard.writeText(`${name}. ${report.title}. Public Spending Data, Mini Reports (private ${report.status}). ${report.publishedAt || 'Unpublished draft'}. Sources: ${report.sources.map(s => `${s.label}: ${s.url}`).join('; ')}`); cite.textContent = 'Citation copied'; }
        catch { $('#notice').textContent = 'Clipboard is unavailable. Source links are listed below the chart.'; }
      }; actions.append(cite); article.append(actions);
    }
    return article;
  }
  function render() {
    for (const button of $('#topics').children) button.setAttribute('aria-pressed', String(button.dataset.topic === topic));
    const visible = reports.filter(r => r.status === view && (!topic || r.topics.includes(topic)) && (!$('#country').value || r.countries.includes($('#country').value)) && (!$('#city').value || r.cities.includes($('#city').value))).sort((a, b) => (b.publishedAt || b.updatedAt || '').localeCompare(a.publishedAt || a.updatedAt || ''));
    $('#count').textContent = `${visible.length} ${visible.length === 1 ? 'report' : 'reports'}`;
    $('#feed').replaceChildren(...visible.map(r => card(r)));
    if (!visible.length) {
      const empty = el('div', undefined, 'empty');
      empty.append(el('h2', topic || $('#city').value || $('#country').value ? 'No reports match these filters' : view === 'draft' ? 'Your next idea starts here' : 'The first story is yours to tell'), el('p', view === 'published' ? 'Review a draft or write a report to start the private feed.' : 'Create a short report with a chart, context and sources.'));
      if (view === 'published') { const drafts = el('button', 'Open your drafts'); drafts.onclick = () => setView('draft'); empty.append(drafts); }
      $('#feed').append(empty);
    }
  }
  function options(id, key, label) {
    const select = $(id), value = select.value;
    select.replaceChildren(); const all = el('option', label); all.value = ''; select.append(all);
    for (const tag of [...new Set(reports.flatMap(r => r[key]))].sort()) { const option = el('option', tag); option.value = tag; select.append(option); }
    select.value = [...select.options].some(o => o.value === value) ? value : '';
  }
  async function load(next = false) {
    $('#more').disabled = true;
    try {
      const initial = !reports.length;
      const data = await api(next ? `?cursor=${encodeURIComponent(cursor)}` : '');
      reports = next ? [...new Map([...reports, ...data.reports].map(r => [r.id, r])).values()] : data.reports;
      author = data.author; storageConfigured = data.storageConfigured; cursor = data.nextPageToken; $('#more').hidden = !cursor;
      options('#country', 'countries', 'All countries'); options('#city', 'cities', 'All cities');
      $('#topics').replaceChildren();
      for (const name of ['', ...data.topics]) { const button = el('button', name || 'All topics'); button.dataset.topic = name; button.onclick = () => { topic = name; render(); }; $('#topics').append(button); }
      if (!$('#editor-topics').children.length) {
        for (const name of data.topics) { const label = el('label'), checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.name = 'topic'; checkbox.value = name; label.append(checkbox, document.createTextNode(name)); $('#editor-topics').append(label); }
      }
      $('#notice').textContent = storageConfigured ? '' : 'Private preview: publishing storage is not configured. You can edit and preview the starter report, but saving is unavailable.';
      if (initial && reports.length && !reports.some(r => r.status === 'published')) setView('draft'); else render();
    } catch (error) { $('#notice').textContent = error.message; }
    finally { $('#more').disabled = false; }
  }
  function editReport(report = null) {
    if (dirty && !confirm('Discard your unsaved changes?')) return;
    current = report; form.reset();
    const content = report || { title: '', authorName: author.name || '', summary: '', countries: [], cities: [], topics: [], methodology: '', sources: [], chart: { label: '', unit: '%', comparisonLabel: '', rows: [] } };
    for (const name of ['title', 'summary', 'methodology']) field(name).value = content[name];
    field('authorName').value = content.authorName || author.name || '';
    for (const name of ['countries', 'cities']) field(name).value = content[name].join(', ');
    for (const checkbox of form.querySelectorAll('[name="topic"]')) checkbox.checked = content.topics.includes(checkbox.value);
    field('measure').value = content.chart.label; field('unit').value = content.chart.unit; field('comparisonLabel').value = content.chart.comparisonLabel;
    field('rows').value = content.chart.rows.map(r => `${r.label} | ${r.value} | ${r.comparisonValue ?? ''} | ${r.note}`).join('\n');
    field('sources').value = content.sources.map(s => `${s.label} | ${s.url}`).join('\n');
    $('#editor-title').textContent = report ? 'Edit Mini Report' : 'Write a Mini Report';
    $('#save-notice').textContent = ''; $('#preview-card').replaceChildren(); $('#editor').hidden = false; dirty = false;
    $('#editor').scrollIntoView({ behavior: 'smooth', block: 'start' }); field('title').focus({ preventScroll: true });
  }
  function payload(status = 'draft') {
    const rows = field('rows').value.split('\n').filter(s => s.trim()).map((line, index) => {
      const [label, value, second, ...notes] = line.split('|').map(s => s.trim());
      if (!label || value === undefined || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0 || (field('comparisonLabel').value.trim() && (!second || !Number.isFinite(Number(second)) || Number(second) < 0))) throw new Error(`Check the numbers on chart row ${index + 1}.`);
      return { label, value: Number(value), comparisonValue: second ? Number(second) : undefined, note: notes.join(' | ') };
    });
    if (!rows.length || rows.length > 40) throw new Error('Add 1–40 chart rows.');
    const sources = field('sources').value.split('\n').filter(s => s.trim()).map(line => {
      const separator = line.indexOf('|'); if (separator < 1) throw new Error('Use source title | https://… for each source.');
      const label = line.slice(0, separator).trim(), url = line.slice(separator + 1).trim();
      let parsed; try { parsed = new URL(url); } catch { /* rejected below */ }
      if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Source links must use HTTPS.'); return { label, url };
    });
    const topics = [...form.querySelectorAll('[name="topic"]:checked')].map(c => c.value);
    if (!topics.length || topics.length > 4) throw new Error('Choose one to four topics.');
    return { title: field('title').value.trim(), authorName: field('authorName').value.trim(), summary: field('summary').value.trim(), topics, countries: split(field('countries').value), cities: split(field('cities').value), methodology: field('methodology').value.trim(), sources, chart: { label: field('measure').value.trim(), unit: field('unit').value.trim(), comparisonLabel: field('comparisonLabel').value.trim(), rows }, reviewed: field('reviewed').checked, status, updateTime: current?.updateTime };
  }
  $('#preview').onclick = () => { if (!form.reportValidity()) return; try { $('#preview-card').replaceChildren(card(payload(), true)); $('#save-notice').textContent = 'Preview only. Your report has not been saved.'; } catch (error) { $('#save-notice').textContent = error.message; } };
  form.onsubmit = async event => {
    event.preventDefault(); const buttons = [...form.querySelectorAll('button')];
    try {
      if (!storageConfigured) throw new Error('Publishing storage is not configured. Your changes remain in this editor and have not been saved.');
      const body = payload(event.submitter?.value || 'draft');
      buttons.forEach(b => b.disabled = true); $('#save-notice').textContent = 'Saving…';
      const result = await api(current ? `/${current.id}` : '', { method: 'POST', body: JSON.stringify(body) });
      current = result.report; reports = [current, ...reports.filter(r => r.id !== current.id)]; dirty = false;
      options('#country', 'countries', 'All countries'); options('#city', 'cities', 'All cities');
      setView(current.status); $('#save-notice').textContent = current.status === 'published' ? 'Published to the private feed. Only invited authors can read it.' : 'Draft saved. It is not in the published feed.';
      $('#preview-card').replaceChildren(card(current, true));
    } catch (error) { $('#save-notice').textContent = error.message; }
    finally { buttons.forEach(b => b.disabled = false); }
  };
  form.addEventListener('input', event => { dirty = true; if (event.target !== field('reviewed')) field('reviewed').checked = false; });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  $('#new-report').onclick = () => editReport();
  $('#close-editor').onclick = () => { if (!dirty || confirm('Discard your unsaved changes?')) { $('#editor').hidden = true; dirty = false; } };
  $('#feed-tab').onclick = () => setView('published'); $('#draft-tab').onclick = () => setView('draft');
  $('#country').onchange = render; $('#city').onchange = render;
  $('#clear-filters').onclick = () => { topic = ''; $('#country').value = ''; $('#city').value = ''; render(); };
  $('#more').onclick = () => load(true);
  load();
})();
