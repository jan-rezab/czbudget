/* Shared PSD plotting primitives. Adapters supply semantics; this file owns geometry
 * and interaction. No page-specific selectors, network data or accounting rules. */
(function (root) {
  'use strict';
  const palette = ['#a8b63f', '#c93237', '#8b8d83', '#171918'];
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function domain(values, includeZero = true) {
    const valid = values.filter(finite);
    const low = Math.min(...(includeZero ? [0, ...valid] : valid.length ? valid : [0]));
    const high = Math.max(...(includeZero ? [0, ...valid] : valid.length ? valid : [0]));
    const rough = (high - low || 1) / 4;
    const power = 10 ** Math.floor(Math.log10(rough));
    const step = ([1, 2, 2.5, 5, 10].find(n => n >= rough / power) || 10) * power;
    let min = Math.floor(low / step) * step, max = Math.ceil(high / step) * step || step;
    if (min === max) { min -= step; max += step; }
    return { min, max, ticks: Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step) };
  }
  function labelPositions(items, min, max, gap = 27) {
    const labels = items.map(item => ({ ...item })).sort((a, b) => a.y - b.y);
    labels.forEach((label, index) => { label.labelY = Math.max(label.y, index ? labels[index - 1].labelY + gap : min); });
    if (labels.length) {
      labels[labels.length - 1].labelY = Math.min(max, labels[labels.length - 1].labelY);
      for (let i = labels.length - 2; i >= 0; i--) labels[i].labelY = Math.min(labels[i].labelY, labels[i + 1].labelY - gap);
    }
    return labels;
  }
  function model(spec) {
    if (!['line', 'column', 'stacked', 'bar'].includes(spec.type || 'line')) throw new Error('Unsupported shared chart type');
    const fields = spec.fields.map((field, i) => ({ ...field, color: field.color || palette[i % palette.length] }));
    const rows = spec.rows.map(row => ({ label: String(row.label ?? row.year ?? ''), values: fields.map(field => {
      const raw = field.value ? field.value(row) : row[field.key];
      return finite(raw) ? raw : null;
    }), raw: row }));
    // A percentage stack is undefined if any component is missing or negative.
    // Never silently turn missing data into zero or normalize a partial return.
    for (const row of rows) {
      const complete = row.values.every(value => finite(value) && value >= 0);
      const total = complete ? row.values.reduce((a, b) => a + b, 0) : null;
      row.shares = total > 0 ? row.values.map(value => value / total * 100) : row.values.map(() => null);
    }
    const keys=fields.map((field,index)=>field.key || `series_${index + 1}`);
    const columns=[{key:'label',label:spec.labelTitle || 'Period'},...fields.map((field,index)=>({key:keys[index],label:field.tableLabel || field.label || keys[index],numeric:true}))];
    const tableRows=rows.map(row=>Object.fromEntries([['label',row.label],...keys.map((key,index)=>[key,row.values[index]])]));
    return { fields, rows, columns, tableRows, accessor:Object.freeze({columns,rows:()=>tableRows}), axis: spec.type === 'stacked' ? { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] } : domain(rows.flatMap(row => row.values), spec.includeZero !== false) };
  }
  function render(host, spec) {
    if (!host) return;
    const focusedPoint = host.contains(document.activeElement) ? document.activeElement.dataset?.point : undefined;
    host.__psdChartCleanup?.();
    const abort = new AbortController();
    host.__psdChartCleanup = () => abort.abort();
    const on = (node, event, callback) => node.addEventListener(event, callback, { signal: abort.signal });
    if (!document.querySelector('link[data-shared-charts]')) {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/shared-charts.css';
      css.dataset.sharedCharts = ''; document.head.append(css);
    }
    const data = model(spec), { fields, rows, axis } = data;
    host.__psdChartAccessor = data.accessor;
    host.classList.add('psd-shared-plot'); host.dataset.chartComponent = spec.type || 'line';
    const width = Math.max(300, Math.min(1120, host.clientWidth - 8));
    const height = spec.height || (spec.type === 'bar' ? Math.max(260, rows.length * 48 + 90) : width < 600 ? 300 : 430);
    const directLabels = spec.endLabels && (!spec.type || spec.type === 'line') && width >= 680;
    const left = spec.type === 'bar' ? (width < 600 ? 100 : 170) : (width < 600 ? 58 : 82), right = directLabels ? 155 : spec.type === 'bar' && spec.valueLabels ? 75 : 22, top = 38, bottom = 52;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const x = i => left + (i + .5) * plotWidth / Math.max(rows.length, 1);
    const y = value => top + (axis.max - value) / (axis.max - axis.min) * plotHeight;
    const format = (value, field, row) => value === null ? '—' : String(field.format ? field.format(value, row.raw) : spec.format ? spec.format(value, row.raw) : value);
    const number = new Intl.NumberFormat(spec.locale || 'en-GB', { maximumFractionDigits: 1, notation: 'compact' });
    const axisFormat = value => escape(spec.axisFormat ? spec.axisFormat(value) : number.format(value));
    const grid = axis.ticks.map(value => `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 12}" y="${y(value) + 4}" text-anchor="end">${axisFormat(value)}${spec.type === 'stacked' ? '%' : ''}</text>`).join('');
    const tickEvery = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(plotWidth / 85))));
    const years = rows.map((row, i) => i % tickEvery === 0 && (i < rows.length - Math.ceil(tickEvery / 2) || i === rows.length - 1) || i === rows.length - 1 ? `<text x="${x(i)}" y="${height - 20}" text-anchor="middle">${escape(row.label)}</text>` : '').join('');
    let marks = '';
    if (!spec.type || spec.type === 'line') {
      marks = fields.map((field, f) => {
        let drawing = false;
        const d = rows.map((row, i) => {
          if (row.values[f] === null) { drawing = false; return ''; }
          const command = drawing ? 'L' : 'M'; drawing = true;
          return `${command}${x(i)},${y(row.values[f])}`;
        }).join(' ');
        const opacity = spec.activeField && spec.activeField !== field.key ? .18 : 1;
        return `<g opacity="${opacity}"><path class="psd-plot-line" stroke="${escape(field.color)}" stroke-dasharray="${escape(field.dash || '')}" d="${d}"/>` + (rows.map((row, i) => row.values[f] === null || (spec.showPoints === false && i !== rows.length - 1 && (rows[i - 1]?.values[f] != null || rows[i + 1]?.values[f] != null)) ? '' : `<circle fill="${escape(field.color)}" cx="${x(i)}" cy="${y(row.values[f])}" r="3.5"/>`).join('')) + '</g>';
      }).join('');
    } else if (spec.type !== 'bar') {
      const step = plotWidth / Math.max(rows.length, 1), barWidth = Math.min(42, step * .7);
      marks = rows.map((row, i) => {
        let offset = 0;
        return fields.map((field, f) => {
          const value = spec.type === 'stacked' ? row.shares[f] : row.values[f];
          if (value === null) return '';
          const a = spec.type === 'stacked' ? offset : 0, b = a + value; offset = b;
          const w = spec.type === 'stacked' ? barWidth : barWidth / fields.length;
          const bx = x(i) - barWidth / 2 + (spec.type === 'stacked' ? 0 : f * w);
          return `<rect x="${bx}" y="${Math.min(y(a), y(b))}" width="${w}" height="${Math.abs(y(a) - y(b))}" fill="${escape(field.color)}"/>`;
        }).join('');
      }).join('');
    }
    if (directLabels && rows.length) {
      const labels = labelPositions(fields.flatMap((field, f) => {
        // Only label the selected range endpoint: no silent carry-forward of stale values.
        const last = rows.at(-1);
        return last.values[f] === null ? [] : [{ field, value: last.values[f], y: y(last.values[f]) }];
      }), top + 12, height - bottom - 16, 38);
      marks += `<text class="psd-plot-end-label" x="${width - right + 18}" y="${top - 12}">${escape(rows.at(-1).label)}</text>`;
      marks += labels.map(({ field, value, y: pointY, labelY }) => `<g opacity="${spec.activeField && spec.activeField !== field.key ? .18 : 1}"><path d="M${x(rows.length - 1)},${pointY} L${width - right + 5},${labelY} L${width - right + 12},${labelY}" fill="none" stroke="${escape(field.color)}"/><text class="psd-plot-end-label" x="${width - right + 18}" y="${labelY - 3}">${escape(String(field.label).length > 20 ? String(field.label).slice(0, 19) + '…' : field.label)}<tspan x="${width - right + 18}" dy="15">${escape(format(value, field, rows.at(-1)))}</tspan></text></g>`).join('');
    }
    const describe = row => `${row.label}. ${fields.map((field, f) => `${field.label}: ${format(row.values[f], field, row)}${spec.type === 'stacked' && row.shares[f] !== null ? ` (${number.format(row.shares[f])}%)` : ''}`).join('. ')}`;
    let hits = rows.map((row, i) => `<rect class="psd-plot-hit" data-point="${i}" x="${left + i * plotWidth / rows.length}" y="${top}" width="${plotWidth / rows.length}" height="${plotHeight}" tabindex="${i ? -1 : 0}" role="button" aria-label="${escape(describe(row))}"/>`).join('');
    let axes = `<g class="psd-plot-grid">${grid}${years}<text x="${left}" y="20">${escape(spec.unit || '')}</text></g>`;
    if (spec.type === 'bar') {
      const rowHeight = plotHeight / Math.max(1, rows.length);
      const bx = value => left + (value - axis.min) / (axis.max - axis.min) * plotWidth;
      const maxLabel = Math.floor((left - 16) / 8);
      marks = rows.map((row, i) => `<text x="${left - 12}" y="${top + i * rowHeight + 22}" text-anchor="end">${escape(row.label.length > maxLabel ? row.label.slice(0, maxLabel - 1) + '…' : row.label)}</text>` + fields.map((field, f) => row.values[f] === null ? '' : `<rect x="${Math.min(bx(0), bx(row.values[f]))}" y="${top + i * rowHeight + f * 28 / fields.length}" width="${Math.abs(bx(row.values[f]) - bx(0))}" height="${26 / fields.length}" fill="${escape(spec.rowColor?.(row.raw, field) || (row.values[f] < 0 ? '#c93237' : field.color))}"/>${spec.valueLabels ? `<text class="psd-plot-bar-value" x="${width - 5}" y="${top + i * rowHeight + f * 28 / fields.length + 18}" text-anchor="end">${escape(format(row.values[f], field, row))}</text>` : ''}`).join('')).join('');
      axes = `<g class="psd-plot-grid">${axis.ticks.filter((_,i)=>i%Math.ceil(axis.ticks.length/(width<500?3:5))===0).map(value=>`<line x1="${bx(value)}" x2="${bx(value)}" y1="${top}" y2="${height-bottom}"/><text x="${bx(value)}" y="${height-20}" text-anchor="middle">${axisFormat(value)}</text>`).join('')}<text x="${left}" y="20">${escape(spec.unit || '')}</text></g>`;
      hits = rows.map((row, i) => `<rect class="psd-plot-hit" data-point="${i}" x="0" y="${top + i * rowHeight}" width="${width}" height="${rowHeight}" tabindex="${i ? -1 : 0}" role="button" aria-label="${escape(describe(row))}"/>`).join('');
    }
    const empty = !rows.some(row => row.values.some(finite));
    const references = spec.type === 'bar' ? '' : (spec.referenceLines || []).filter(line => finite(line.value)).map(line => `<line class="psd-plot-reference" x1="${left}" x2="${width - right}" y1="${y(line.value)}" y2="${y(line.value)}"/><text class="psd-plot-reference-label" x="${left + 4}" y="${y(line.value) - 5}">${escape(line.label || String(line.value))}</text>`).join('');
    const selectedIndex = rows.findIndex(row => row.label === String(spec.selectedLabel));
    const marker = spec.type === 'bar' || selectedIndex < 0 ? '' : `<line class="psd-plot-selected" x1="${x(selectedIndex)}" x2="${x(selectedIndex)}" y1="${top}" y2="${height - bottom}"/><text class="psd-plot-selected-label" x="${x(selectedIndex)}" y="${top - 8}" text-anchor="middle">${escape(rows[selectedIndex].label)}</text>`;
    host.innerHTML = `${empty ? `<p class="psd-chart-empty">${escape(spec.emptyLabel || 'No reported values')}</p>` : ''}<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${escape(spec.title || fields.map(f => f.label).join(', '))}">${axes}${references}${marker}${marks}<line class="psd-plot-guide" y1="${top}" y2="${height - bottom}" hidden/>${hits}</svg><div class="psd-plot-tooltip" role="status" aria-live="polite" hidden></div>`;
    const tooltip = host.querySelector('.psd-plot-tooltip'), guide = host.querySelector('.psd-plot-guide');
    let pinned = false;
    function hide() { tooltip.hidden = true; guide.setAttribute('hidden', ''); }
    function show(hit, clientX) {
      const i = Number(hit.dataset.point), row = rows[i]; if (!row) return;
      tooltip.innerHTML = `<strong>${escape(row.label)}</strong>${fields.map((field, f) => `<span><i style="background:${escape(field.color)}"></i><span>${escape(field.label)}</span><b>${escape(format(row.values[f], field, row))}${spec.type === 'stacked' && row.shares[f] !== null ? `<small>${escape(number.format(row.shares[f]))}%</small>` : ''}</b></span>`).join('')}`;
      tooltip.hidden = false;
      const box = host.getBoundingClientRect(), point = Number.isFinite(clientX) ? clientX - box.left : x(i) / width * box.width;
      tooltip.style.left = `${Math.max(4, Math.min(box.width - tooltip.offsetWidth - 4, point + 14))}px`;
      tooltip.style.top = `${Math.min(48, box.height / 4)}px`;
      if (spec.type !== 'bar') { guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.removeAttribute('hidden'); }
    }
    on(host, 'pointermove', e => { const hit = e.target.closest('[data-point]'); if (hit && !pinned) show(hit, e.clientX); });
    on(host, 'focusin', e => { const hit = e.target.closest('[data-point]'); if (hit) show(hit); });
    function activate(hit, clientX) {
      pinned = !pinned;
      if (pinned) show(hit, clientX); else hide();
      if (typeof spec.onSelect === 'function') spec.onSelect(spec.rows[Number(hit.dataset.point)]);
    }
    on(host, 'click', e => { const hit = e.target.closest('[data-point]'); if (hit) activate(hit, e.clientX); });
    on(host, 'pointerleave', () => { if (!pinned && !host.contains(document.activeElement)) hide(); });
    on(host, 'focusout', e => { if (!host.contains(e.relatedTarget)) { pinned = false; hide(); } });
    on(document, 'pointerdown', e => { if (!host.contains(e.target)) { pinned = false; hide(); } });
    on(host, 'keydown', e => {
      if (e.key === 'Escape') { pinned = false; hide(); return; }
      const current = e.target.closest('[data-point]'); if (!current) return;
      // SVG marks are not HTMLElements and do not expose HTMLElement.click().
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(current); return; }
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); const index = Number(current.dataset.point);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (e.key === 'ArrowLeft' ? -1 : 1)));
      current.tabIndex = -1; const target = host.querySelector(`[data-point="${next}"]`); target.tabIndex = 0; target.focus();
    });
    const resize = new ResizeObserver(() => {
      const nextWidth = Math.max(300, Math.min(1120, host.clientWidth - 8));
      if (Math.abs(nextWidth - width) > 1) render(host, spec);
    });
    resize.observe(host);
    host.__psdChartCleanup = () => { abort.abort(); resize.disconnect(); };
    // Responsive redraw must not drop keyboard focus between a focus/Enter
    // pair, or when an already-focused chart changes width on orientation.
    if (focusedPoint !== undefined) host.querySelectorAll('[data-point]')[Number(focusedPoint)]?.focus();
    return { data, accessor:data.accessor, destroy: host.__psdChartCleanup };
  }
  const api = Object.freeze({ render, model, domain, palette, labelPositions });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PSDPlot = api;
})(typeof window === 'undefined' ? globalThis : window);
