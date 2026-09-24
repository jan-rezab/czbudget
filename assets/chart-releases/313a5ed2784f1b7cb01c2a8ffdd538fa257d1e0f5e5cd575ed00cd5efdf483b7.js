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
  let chartID = 0;
  function rangeFromPixels(a, b, left, width, count) {
    const at = value => Math.max(0, Math.min(count - 1, Math.floor((value - left) / width * count)));
    return [Math.min(at(a), at(b)), Math.max(at(a), at(b))];
  }
  function moveRange(start, end, delta, min, max) {
    const shift = Math.max(min - start, Math.min(max - end, delta));
    return [start + shift, end + shift];
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
    const previous = host.__psdGeometry;
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
    const clipID = `psd-plot-clip-${++chartID}`;
    const geometry = { type: spec.type || 'line', series: {}, projection: { left, plotWidth, top, plotHeight, axis, first: Number(rows[0]?.label), last: Number(rows.at(-1)?.label), count: rows.length } };
    let marks = '', endLabels = '';
    if (!spec.type || spec.type === 'line') {
      marks = fields.map((field, f) => {
        let drawing = false;
        const points = [];
        const d = rows.map((row, i) => {
          if (row.values[f] === null) { drawing = false; return ''; }
          const command = drawing ? 'L' : 'M'; drawing = true;
          points.push({ label: row.label, x: x(i), y: y(row.values[f]), value: row.values[f], command });
          return `${command}${x(i)},${y(row.values[f])}`;
        }).join(' ');
        geometry.series[field.key || f] = points;
        const opacity = spec.activeField && spec.activeField !== field.key ? .18 : 1;
        return `<g opacity="${opacity}" clip-path="url(#${clipID})"><path data-series="${escape(field.key || f)}" class="psd-plot-line" stroke="${escape(field.color)}" stroke-dasharray="${escape(field.dash || '')}" d="${d}"/>` + (rows.map((row, i) => row.values[f] === null || (spec.showPoints === false && i !== rows.length - 1 && (rows[i - 1]?.values[f] != null || rows[i + 1]?.values[f] != null)) ? '' : `<circle data-series-point="${escape(field.key || f)}" data-label="${escape(row.label)}" fill="${escape(field.color)}" cx="${x(i)}" cy="${y(row.values[f])}" r="3.5"/>`).join('')) + '</g>';
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
      endLabels += labels.map(({ field, value, y: pointY, labelY }) => `<g opacity="${spec.activeField && spec.activeField !== field.key ? .18 : 1}"><path d="M${x(rows.length - 1)},${pointY} L${width - right + 5},${labelY} L${width - right + 12},${labelY}" fill="none" stroke="${escape(field.color)}"/><text class="psd-plot-end-label" x="${width - right + 18}" y="${labelY - 3}">${escape(String(field.label).length > 20 ? String(field.label).slice(0, 19) + '…' : field.label)}<tspan x="${width - right + 18}" dy="15">${escape(format(value, field, rows.at(-1)))}</tspan></text></g>`).join('');
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
    host.innerHTML = `${empty ? `<p class="psd-chart-empty">${escape(spec.emptyLabel || 'No reported values')}</p>` : ''}<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${escape(spec.title || fields.map(f => f.label).join(', '))}"><defs><clipPath id="${clipID}"><rect x="${left - 4}" y="${top - 4}" width="${plotWidth + 8}" height="${plotHeight + 8}"/></clipPath></defs>${axes}${references}${marker}${marks}${endLabels}<rect class="psd-plot-brush" y="${top}" height="${plotHeight}" hidden/><line class="psd-plot-guide" y1="${top}" y2="${height - bottom}" hidden/>${hits}</svg><div class="psd-plot-tooltip" role="status" aria-live="polite" hidden></div>`;
    const tooltip = host.querySelector('.psd-plot-tooltip'), guide = host.querySelector('.psd-plot-guide');
    let pinned = false, dragging = null;
    const brush = host.querySelector('.psd-plot-brush');
    const zoomable = spec.type !== 'bar' && typeof spec.onRangeSelect === 'function';
    host.toggleAttribute('data-zoomable', zoomable);
    function hide() { tooltip.hidden = true; guide.setAttribute('hidden', ''); spec.onInspect?.(null); }
    function localX(clientX) { const box = host.querySelector('svg').getBoundingClientRect(); return (clientX - box.left) / box.width * width; }
    function cancelDrag() {
      if (dragging && host.hasPointerCapture?.(dragging.id)) host.releasePointerCapture(dragging.id);
      dragging = null; brush.setAttribute('hidden', ''); host.removeAttribute('data-brushing');
    }
    if (zoomable) {
      on(host, 'pointerdown', e => {
        if (e.button !== 0 || !e.isPrimary) return;
        const hit = e.target.closest('[data-point]'); if (!hit) return;
        dragging = { id: e.pointerId, start: localX(e.clientX), x: e.clientX, y: e.clientY, hit, moved: false };
        host.setPointerCapture(e.pointerId);
      });
      on(host, 'pointermove', e => {
        if (!dragging || e.pointerId !== dragging.id) return;
        const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
        if (!dragging.moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { cancelDrag(); return; }
        if (Math.abs(dx) < 6 && !dragging.moved) return;
        dragging.moved = true; pinned = false; hide();
        host.setAttribute('data-brushing', '');
        const a = Math.max(left, Math.min(width - right, dragging.start)), b = Math.max(left, Math.min(width - right, localX(e.clientX)));
        brush.setAttribute('x', Math.min(a, b)); brush.setAttribute('width', Math.max(1, Math.abs(a - b))); brush.removeAttribute('hidden');
      });
      on(host, 'pointerup', e => {
        if (!dragging || e.pointerId !== dragging.id) return;
        const drag = dragging, range = rangeFromPixels(drag.start, localX(e.clientX), left, plotWidth, rows.length);
        host.__psdIgnoreClickUntil = performance.now() + 350;
        cancelDrag();
        if (drag.moved && range[0] !== range[1]) spec.onRangeSelect({ start: rows[range[0]].label, end: rows[range[1]].label });
        else if (!drag.moved) activate(drag.hit, e.clientX);
      });
      on(host, 'pointercancel', cancelDrag);
      on(host, 'lostpointercapture', () => { if (dragging) cancelDrag(); });
      on(host, 'dblclick', e => { e.preventDefault(); spec.onResetRange?.(); });
    }
    function show(hit, clientX) {
      const i = Number(hit.dataset.point), row = rows[i]; if (!row) return;
      tooltip.innerHTML = `<strong>${escape(row.label)}</strong>${fields.map((field, f) => `<span><i style="background:${escape(field.color)}"></i><span>${escape(field.label)}</span><b>${escape(format(row.values[f], field, row))}${spec.type === 'stacked' && row.shares[f] !== null ? `<small>${escape(number.format(row.shares[f]))}%</small>` : ''}</b></span>`).join('')}`;
      tooltip.hidden = false;
      spec.onInspect?.(row.raw);
      const box = host.getBoundingClientRect(), point = Number.isFinite(clientX) ? clientX - box.left : x(i) / width * box.width;
      tooltip.style.left = `${Math.max(4, Math.min(box.width - tooltip.offsetWidth - 4, point + 14))}px`;
      tooltip.style.top = `${Math.min(48, box.height / 4)}px`;
      if (spec.type !== 'bar') { guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.removeAttribute('hidden'); }
    }
    on(host, 'pointermove', e => { const hit = e.target.closest('[data-point]'); if (hit && !pinned && !dragging?.moved) show(hit, e.clientX); });
    on(host, 'focusin', e => { const hit = e.target.closest('[data-point]'); if (hit) show(hit); });
    function activate(hit, clientX) {
      pinned = !pinned;
      if (pinned) show(hit, clientX); else hide();
      if (typeof spec.onSelect === 'function') spec.onSelect(spec.rows[Number(hit.dataset.point)]);
    }
    on(host, 'click', e => { if (performance.now() < (host.__psdIgnoreClickUntil || 0)) return; const hit = e.target.closest('[data-point]'); if (hit) activate(hit, e.clientX); });
    on(host, 'pointerleave', () => { if (!pinned && !host.contains(document.activeElement)) hide(); });
    on(host, 'focusout', e => { if (!host.contains(e.relatedTarget)) { pinned = false; hide(); } });
    on(document, 'pointerdown', e => { if (!host.contains(e.target)) { pinned = false; hide(); } });
    on(host, 'keydown', e => {
      if (e.key === 'Escape') { cancelDrag(); pinned = false; hide(); return; }
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
    let animationFrame = 0;
    const animate = spec.animate && previous && !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    host.__psdGeometry = geometry;
    if (animate && previous.type !== geometry.type) host.querySelector('svg').animate([{ opacity: .35 }, { opacity: 1 }], { duration: 140 });
    if (animate && Object.keys(geometry.series).length) {
      const paths = [...host.querySelectorAll('[data-series]')], dots = [...host.querySelectorAll('[data-series-point]')];
      const startAt = performance.now(), duration = typeof spec.animate === 'number' ? spec.animate : 200;
      const origins = {};
      for (const [key, points] of Object.entries(geometry.series)) {
        const old = new Map((previous.series[key] || []).map(point => [point.label, point]));
        const p = previous.projection;
        origins[key] = points.map(point => {
          if (old.has(point.label)) return old.get(point.label);
          if (!previous.series[key] || !Number.isFinite(+point.label) || p.last === p.first) return point;
          return { ...point, x: p.left + ((+point.label - p.first) / (p.last - p.first) * (p.count - 1) + .5) * p.plotWidth / p.count, y: p.top + (p.axis.max - point.value) / (p.axis.max - p.axis.min) * p.plotHeight };
        });
      }
      function frame(now) {
        const progress = Math.min(1, (now - startAt) / duration), eased = 1 - (1 - progress) ** 3;
        const current = { ...geometry, series: {} };
        for (const [key, points] of Object.entries(geometry.series)) current.series[key] = points.map((point, i) => ({ ...point, x: origins[key][i].x + (point.x - origins[key][i].x) * eased, y: origins[key][i].y + (point.y - origins[key][i].y) * eased }));
        for (const path of paths) path.setAttribute('d', current.series[path.dataset.series].map(point => `${point.command}${point.x},${point.y}`).join(' '));
        for (const dot of dots) { const point = current.series[dot.dataset.seriesPoint].find(point => point.label === dot.dataset.label); if (point) { dot.setAttribute('cx', point.x); dot.setAttribute('cy', point.y); } }
        host.__psdGeometry = current;
        if (progress < 1) animationFrame = requestAnimationFrame(frame);
      }
      frame(startAt);
    }
    host.__psdChartCleanup = () => { abort.abort(); resize.disconnect(); cancelAnimationFrame(animationFrame); cancelDrag(); };
    // Responsive redraw must not drop keyboard focus between a focus/Enter
    // pair, or when an already-focused chart changes width on orientation.
    if (focusedPoint !== undefined) host.querySelectorAll('[data-point]')[Number(focusedPoint)]?.focus();
    return { data, accessor:data.accessor, destroy: host.__psdChartCleanup,
      select(label) {
        spec.selectedLabel = label;
        const index = rows.findIndex(row => row.label === String(label));
        const line = host.querySelector('.psd-plot-selected'), text = host.querySelector('.psd-plot-selected-label');
        if (index >= 0 && line && text) { line.setAttribute('x1', x(index)); line.setAttribute('x2', x(index)); text.setAttribute('x', x(index)); text.textContent = label; }
      }
    };
  }
  function renderRange(host, spec) {
    host.__psdRangeCleanup?.();
    const abort = new AbortController();
    const on = (node, name, handler) => node.addEventListener(name, handler, { signal: abort.signal });
    const data = model({ ...spec, includeZero: false });
    const min = Number(data.rows[0]?.label), max = Number(data.rows.at(-1)?.label);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;
    let start = spec.start ?? min, end = spec.end ?? max, drag = null;
    const width = 1000, height = 50, y = value => 43 - (value - data.axis.min) / (data.axis.max - data.axis.min) * 34;
    const x = year => (Number(year) - min) / (max - min) * width;
    const lines = data.fields.map((field, f) => {
      let drawing = false;
      const path = data.rows.map(row => {
        if (row.values[f] === null) { drawing = false; return ''; }
        const command = drawing ? 'L' : 'M'; drawing = true;
        return `${command}${x(row.label)},${y(row.values[f])}`;
      }).join(' ');
      return `<path d="${path}" fill="none" stroke="${escape(field.color)}" stroke-dasharray="${escape(field.dash || '')}" vector-effect="non-scaling-stroke"/>`;
    }).join('');
    host.classList.add('psd-range');
    host.innerHTML = `<div class="psd-range-track"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg><div class="psd-range-shade psd-range-before"></div><div class="psd-range-shade psd-range-after"></div><div class="psd-range-window" data-drag="window" role="slider" tabindex="0" aria-label="Move selected year range"></div><button type="button" class="psd-range-handle" data-drag="start" role="slider" aria-label="Start year"></button><button type="button" class="psd-range-handle" data-drag="end" role="slider" aria-label="End year"></button></div><div class="psd-range-extents"><span>${min}</span><span>Drag edges to zoom · Drag selection to move</span><span>${max}</span></div>`;
    const track = host.querySelector('.psd-range-track'), selection = host.querySelector('.psd-range-window');
    const handles = { start: host.querySelector('[data-drag=start]'), end: host.querySelector('[data-drag=end]') };
    function draw() {
      const a = (start - min) / (max - min) * 100, b = (end - min) / (max - min) * 100;
      selection.style.left = start === end ? `calc(${a}% - 14px)` : `${a}%`; selection.style.width = start === end ? '28px' : `${b - a}%`;
      host.querySelector('.psd-range-before').style.width = `${a}%`;
      host.querySelector('.psd-range-after').style.width = `${100 - b}%`;
      for (const [key, value] of [['start', start], ['end', end]]) {
        const handle = handles[key], percent = (value - min) / (max - min) * 100;
        handle.style.left = start === end ? `calc(${percent}% + ${key === 'start' ? -14 : 14}px)` : `${percent}%`;
        handle.setAttribute('aria-valuemin', key === 'start' ? min : start);
        handle.setAttribute('aria-valuemax', key === 'start' ? end : max);
        handle.setAttribute('aria-valuenow', value); handle.setAttribute('aria-valuetext', String(value));
      }
      selection.setAttribute('aria-valuemin', min); selection.setAttribute('aria-valuemax', max - (end - start));
      selection.setAttribute('aria-valuenow', start); selection.setAttribute('aria-valuetext', `${start} to ${end}`);
      host.dataset.start = start; host.dataset.end = end;
    }
    function set(a, b, emit = false) {
      start = Math.max(min, Math.min(max, Math.round(a))); end = Math.max(start, Math.min(max, Math.round(b)));
      draw(); if (emit) spec.onChange?.({ start, end });
    }
    function finish(cancel = false) {
      if (!drag) return;
      const previous = drag; drag = null;
      if (host.hasPointerCapture?.(previous.id)) host.releasePointerCapture(previous.id);
      host.removeAttribute('data-dragging');
      if (cancel) { set(previous.start, previous.end, true); spec.onCancel?.(); }
      else spec.onCommit?.({ start, end }, { start: previous.start, end: previous.end });
    }
    on(host, 'pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary || !event.target.closest('.psd-range-track')) return;
      const mode = event.target.closest('[data-drag]')?.dataset.drag || 'jump';
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start, end, mode, moved: false };
      host.setPointerCapture(event.pointerId); host.setAttribute('data-dragging', '');
      if (mode === 'jump') {
        const box = track.getBoundingClientRect(), year = min + (event.clientX - box.left) / box.width * (max - min);
        set(...moveRange(start, end, Math.round(year - (start + end) / 2), min, max), true);
      }
    });
    on(host, 'pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { finish(true); return; }
      if (Math.abs(dx) > 3) drag.moved = true;
      if (!drag.moved) return;
      const delta = Math.round(dx / track.getBoundingClientRect().width * (max - min));
      if (drag.mode === 'start') set(Math.min(drag.end, drag.start + delta), drag.end, true);
      else if (drag.mode === 'end') set(drag.start, Math.max(drag.start, drag.end + delta), true);
      else set(...moveRange(drag.start, drag.end, delta, min, max), true);
    });
    on(host, 'pointerup', () => finish());
    on(host, 'pointercancel', () => finish(true));
    on(host, 'lostpointercapture', () => { if (drag) finish(true); });
    on(host, 'keydown', event => {
      if (event.key === 'Escape') { finish(true); return; }
      const mode = event.target.dataset.drag;
      if (!mode || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const old = { start, end }, step = event.shiftKey ? 5 : 1;
      const delta = event.key === 'ArrowLeft' ? -step : step;
      if (mode === 'start') set(event.key === 'Home' ? min : event.key === 'End' ? end : Math.min(end, start + delta), end, true);
      else if (mode === 'end') set(start, event.key === 'Home' ? start : event.key === 'End' ? max : Math.max(start, end + delta), true);
      else set(...moveRange(start, end, event.key === 'Home' ? min - start : event.key === 'End' ? max - end : delta, min, max), true);
      spec.onCommit?.({ start, end }, old);
    });
    draw(); host.__psdRangeCleanup = () => { abort.abort(); if (drag && host.hasPointerCapture?.(drag.id)) host.releasePointerCapture(drag.id); drag = null; };
    return { set, destroy: host.__psdRangeCleanup };
  }
  const api = Object.freeze({ render, model, domain, palette, labelPositions, rangeFromPixels, moveRange, renderRange });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PSDPlot = api;
})(typeof window === 'undefined' ? globalThis : window);
