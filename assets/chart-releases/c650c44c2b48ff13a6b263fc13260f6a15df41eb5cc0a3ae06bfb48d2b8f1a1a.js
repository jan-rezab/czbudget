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
  function rangeFromPixels(a, b, left, width, count, endpointAligned = false) {
    const at = value => Math.max(0, Math.min(count - 1, endpointAligned ? Math.round((value - left) / width * (count - 1)) : Math.floor((value - left) / width * count)));
    return [Math.min(at(a), at(b)), Math.max(at(a), at(b))];
  }
  function moveRange(start, end, delta, min, max) {
    const shift = Math.max(min - start, Math.min(max - end, delta));
    return [start + shift, end + shift];
  }
  // Fractional years are viewport coordinates, never interpolated observations.
  function timeX(year, projection) {
    const span = Math.max(1, projection.last - projection.first), center = (projection.first + projection.last) / 2;
    return projection.left + (.5 + (Number(year) - center) / span) * projection.plotWidth;
  }
  function valueY(value, projection) {
    return projection.top + (projection.axis.max - value) / (projection.axis.max - projection.axis.min) * projection.plotHeight;
  }
  function mixProjection(from, to, t) {
    const mix = (a, b) => a + (b - a) * t;
    return { ...to, ...Object.fromEntries(['left', 'plotWidth', 'top', 'plotHeight', 'first', 'last'].map(key => [key, mix(from[key], to[key])])), axis: { ...to.axis, min: mix(from.axis.min, to.axis.min), max: mix(from.axis.max, to.axis.max) } };
  }
  function model(spec) {
    if (!['line', 'column', 'stacked', 'bar', 'scatter', 'pyramid', 'donut', 'treemap'].includes(spec.type || 'line')) throw new Error('Unsupported shared chart type');
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
      row.stackValues = complete ? row.values.slice() : row.values.map(() => null);
      row.stackTotal = total;
      row.shares = total > 0 ? row.values.map(value => value / total * 100) : row.values.map(() => null);
    }
    if(spec.type==='donut'){if(fields.length!==1)throw new Error('Donuts require one nonnegative value per row');const complete=rows.every(row=>finite(row.values[0])&&row.values[0]>=0),total=complete?rows.reduce((sum,row)=>sum+row.values[0],0):null;for(const row of rows)row.shares=[total>0?row.values[0]/total*100:null];}
    const keys=fields.map((field,index)=>field.key || `series_${index + 1}`);
    const columns=spec.tableColumns || [{key:'label',label:spec.labelTitle || 'Period'},...fields.map((field,index)=>({key:keys[index],label:field.tableLabel || field.label || keys[index],numeric:true}))];
    const tableRows=spec.tableColumns?rows.map(row=>Object.fromEntries(columns.map(c=>[c.key,row.raw[c.key]??null]))):rows.map(row=>Object.fromEntries([['label',row.label],...keys.map((key,index)=>[key,row.values[index]])]));
    return { fields, rows, columns, tableRows, accessor:Object.freeze({columns,rows:()=>tableRows}), axis: spec.yDomain || (spec.type === 'stacked' ? (spec.stackMode === 'absolute' ? domain(rows.map(row => row.stackTotal)) : { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] }) : domain(rows.flatMap(row => row.values), spec.includeZero !== false)) };
  }
  function render(host, spec) {
    if (!host) return;
    if (spec.type === 'circuit') return renderCircuit(host, spec);
    if (spec.type === 'treemap') return renderTreemap(host, spec);
    if (spec.type === 'funding-flow') return renderFundingFlow(host, spec);
    if (spec.type === 'donut') return renderDonut(host,spec);
    if (spec.type === 'route-map') return renderRoutes(host, spec);
    if (spec.type === 'scatter' || spec.type === 'pyramid') return renderSpecial(host, spec);
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
    const height = spec.compact && width < 600 ? Math.min(spec.height || 250, 250) : spec.height || (spec.type === 'bar' ? Math.max(260, rows.length * 48 + 90) : width < 600 ? 300 : 430);
    const directLabels = spec.endLabels && (!spec.type || spec.type === 'line') && width >= 680;
    const timeSeries = spec.contextRows && (!spec.type || spec.type === 'line');
    const context = timeSeries ? model({ ...spec, rows: spec.contextRows }) : data;
    const left = spec.type === 'bar' ? (width < 600 ? 100 : 170) : (spec.compact ? (width < 600 ? 42 : 48) : width < 600 ? 58 : 82), right = directLabels ? (spec.compact ? 185 : 155) : spec.type === 'bar' && spec.valueLabels ? 75 : 22, top = spec.compact ? 24 : 38, bottom = spec.compact ? 30 : 52;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const x = i => timeSeries ? (rows.length === 1 ? left + plotWidth / 2 : left + i * plotWidth / (rows.length - 1)) : left + (i + .5) * plotWidth / Math.max(rows.length, 1);
    const y = value => top + (axis.max - value) / (axis.max - axis.min) * plotHeight;
    const format = (value, field, row) => value === null ? '—' : String(field.format ? field.format(value, row.raw) : spec.format ? spec.format(value, row.raw) : value);
    const number = new Intl.NumberFormat(spec.locale || 'en-GB', { maximumFractionDigits: 1, notation: 'compact' });
    const axisFormat = value => escape(spec.axisFormat ? spec.axisFormat(value) : number.format(value));
    const displayTicks = timeSeries && spec.animate && previous ? [...new Set([...axis.ticks, ...previous.projection.axis.ticks])].sort((a, b) => a - b) : axis.ticks;
    const grid = displayTicks.map(value => `<g data-y-tick="${value}"><line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${axisFormat(value)}${spec.type === 'stacked' && spec.stackMode !== 'absolute' ? '%' : ''}</text></g>`).join('');
    const tickEvery = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(plotWidth / 85))));
    const yearRows = timeSeries ? context.rows : rows;
    const years = yearRows.map((row, i) => timeSeries || i % tickEvery === 0 && (i < rows.length - Math.ceil(tickEvery / 2) || i === rows.length - 1) || i === rows.length - 1 ? `<text data-x-tick="${escape(row.label)}" x="${x(i)}" y="${height - (spec.compact ? 8 : 20)}" text-anchor="middle">${escape(row.label)}</text>` : '').join('');
    const clipID = `psd-plot-clip-${++chartID}`;
    const geometry = { type: spec.type || 'line', series: {}, projection: { left, plotWidth, top, plotHeight, axis, first: Number(rows[0]?.label), last: Number(rows.at(-1)?.label), count: rows.length } };
    let marks = '', endLabels = '';
    if (!spec.type || spec.type === 'line') {
      marks = fields.map((field, f) => {
        let drawing = false;
        const points = [];
        const d = context.rows.map((row, i) => {
          if (row.values[f] === null) { drawing = false; return ''; }
          const command = drawing ? 'L' : 'M'; drawing = true;
          const px = timeSeries ? timeX(row.label, geometry.projection) : x(i);
          points.push({ label: row.label, x: px, y: y(row.values[f]), value: row.values[f], command });
          return `${command}${px},${y(row.values[f])}`;
        }).join(' ');
        geometry.series[field.key || f] = points;
        const opacity = spec.activeField && spec.activeField !== field.key ? .18 : 1;
        return `<g data-mark-series="${escape(field.key || f)}" opacity="${opacity}" clip-path="url(#${clipID})"><path data-series="${escape(field.key || f)}" class="psd-plot-line" stroke="${escape(field.color)}" stroke-dasharray="${escape(field.dash || '')}" d="${d}"/>` + (rows.map((row, i) => row.values[f] === null || (spec.showPoints === false && i !== rows.length - 1 && (rows[i - 1]?.values[f] != null || rows[i + 1]?.values[f] != null)) ? '' : `<circle data-series-point="${escape(field.key || f)}" data-label="${escape(row.label)}" fill="${escape(field.color)}" cx="${x(i)}" cy="${y(row.values[f])}" r="3.5"/>`).join('')) + '</g>';
      }).join('');
    } else if (spec.type !== 'bar') {
      const step = plotWidth / Math.max(rows.length, 1), barWidth = Math.min(42, step * .7);
      marks = rows.map((row, i) => {
        let offset = 0;
        return fields.map((field, f) => {
          const value = spec.type === 'stacked' ? (spec.stackMode === 'absolute' ? row.stackValues[f] : row.shares[f]) : row.values[f];
          if (value === null) return '';
          const a = spec.type === 'stacked' ? offset : 0, b = a + value; offset = b;
          const w = spec.type === 'stacked' ? barWidth : barWidth / fields.length;
          const bx = x(i) - barWidth / 2 + (spec.type === 'stacked' ? 0 : f * w);
          if(spec.type==='column' && finite(spec.unitStep) && spec.unitStep>0 && value>=0 && Number.isInteger(value/spec.unitStep) && value/spec.unitStep<=100){
            return Array.from({length:value/spec.unitStep},(_,j)=>`<rect class="psd-plot-unit-block" x="${bx}" y="${y((j+1)*spec.unitStep)+2}" width="${w}" height="${Math.max(1,y(j*spec.unitStep)-y((j+1)*spec.unitStep)-4)}" fill="${escape(spec.rowColor?.(row.raw,field) || field.color)}"/>`).join('');
          }
          return `<rect x="${bx}" y="${Math.min(y(a), y(b))}" width="${w}" height="${Math.abs(y(a) - y(b))}" fill="${escape(field.color)}"/>`;
        }).join('');
      }).join('');
    }
    if (directLabels && rows.length) {
      const labels = labelPositions(fields.flatMap((field, f) => {
        // Only label the selected range endpoint: no silent carry-forward of stale values.
        const last = rows.at(-1);
        return last.values[f] === null ? [] : [{ field, value: last.values[f], y: y(last.values[f]) }];
      }), top + 12, height - bottom - 10, spec.compact ? 25 : 38);
      endLabels += labels.map(({ field, value, y: pointY, labelY }) => {
        const name = String(field.label), wrap = spec.compact && name.length > 18;
        const split = wrap ? Math.max(1, name.lastIndexOf(' ', 18)) : 0;
        const first = wrap ? name.slice(0, split) : name;
        const rest = name.slice(split + 1), second = rest.length > 20 ? rest.slice(0, 19) + '…' : rest;
        const lx = width - right + 19;
        return `<g data-end-series="${escape(field.key)}" data-label-wrap="${wrap}" opacity="${spec.activeField && spec.activeField !== field.key ? .18 : 1}" aria-label="${escape(name)}"><title>${escape(name)}</title><path d="M${x(rows.length - 1)},${pointY} L${width - right + 6},${labelY} L${width - right + 13},${labelY}" fill="none" stroke="${escape(field.color)}"/><text class="psd-plot-end-label" x="${lx}" y="${labelY + (spec.compact && !wrap ? 4 : -3)}">${escape(first)}${wrap ? `<tspan x="${lx}" dy="13">${escape(second)}</tspan>` : ''}<tspan class="psd-plot-end-value" x="${spec.compact ? width - 3 : lx}" ${spec.compact ? `y="${labelY + 4}" text-anchor="end"` : 'dy="15"'}>${escape(format(value, field, rows.at(-1)))}</tspan></text></g>`;
      }).join('');
    }
    const describe = row => `${row.label}. ${fields.map((field, f) => `${field.label}: ${format(row.values[f], field, row)}${spec.type === 'stacked' && row.shares[f] !== null ? ` (${number.format(row.shares[f])}%)` : ''}`).join('. ')}`;
    let hits = rows.map((row, i) => `<rect class="psd-plot-hit" data-point="${i}" x="${timeSeries ? (i ? (x(i - 1) + x(i)) / 2 : left) : left + i * plotWidth / rows.length}" y="${top}" width="${timeSeries ? (i === rows.length - 1 ? width - right : (x(i) + x(i + 1)) / 2) - (i ? (x(i - 1) + x(i)) / 2 : left) : plotWidth / rows.length}" height="${plotHeight}" tabindex="${i ? -1 : 0}" role="button" aria-label="${escape(describe(row))}"/>`).join('');
    let axes = `<g class="psd-plot-grid">${grid}${years}<text x="${left}" y="20">${escape(spec.unit || '')}</text></g>`;
    if (spec.type === 'bar') {
      const rowHeight = plotHeight / Math.max(1, rows.length);
      const bx = value => left + (value - axis.min) / (axis.max - axis.min) * plotWidth;
      const maxLabel = Math.floor((left - 16) / 8);
      marks = rows.map((row, i) => `<text x="${left - 12}" y="${top + i * rowHeight + 22}" text-anchor="end">${escape(row.label.length > maxLabel ? row.label.slice(0, maxLabel - 1) + '…' : row.label)}</text>` + fields.map((field, f) => row.values[f] === null ? '' : `<rect x="${Math.min(bx(0), bx(row.values[f]))}" y="${top + i * rowHeight + f * 28 / fields.length}" width="${Math.abs(bx(row.values[f]) - bx(0))}" height="${26 / fields.length}" fill="${escape(spec.rowColor?.(row.raw, field) || (row.values[f] < 0 ? '#c93237' : field.color))}"/>${spec.valueLabels ? `<text class="psd-plot-bar-value" x="${width - 5}" y="${top + i * rowHeight + f * 28 / fields.length + 18}" text-anchor="end">${escape(spec.valueLabelFormat?spec.valueLabelFormat(row.values[f],row.raw):format(row.values[f], field, row))}</text>` : ''}`).join('')).join('');
      axes = `<g class="psd-plot-grid">${axis.ticks.filter((_,i)=>i%Math.ceil(axis.ticks.length/(width<500?3:5))===0).map(value=>`<line x1="${bx(value)}" x2="${bx(value)}" y1="${top}" y2="${height-bottom}"/><text x="${bx(value)}" y="${height-20}" text-anchor="middle">${axisFormat(value)}</text>`).join('')}<text x="${left}" y="20">${escape(spec.unit || '')}</text></g>`;
      hits = rows.map((row, i) => `<rect class="psd-plot-hit" data-point="${i}" x="0" y="${top + i * rowHeight}" width="${width}" height="${rowHeight}" tabindex="${i ? -1 : 0}" role="button" aria-label="${escape(describe(row))}"/>`).join('');
    }
    const empty = !rows.some(row => row.values.some(finite));
    const references = spec.type === 'bar' ? '' : (spec.referenceLines || []).filter(line => finite(line.value)).map(line => `<line class="psd-plot-reference" x1="${left}" x2="${width - right}" y1="${y(line.value)}" y2="${y(line.value)}"/><text class="psd-plot-reference-label" x="${left + 4}" y="${y(line.value) - 5}">${escape(line.label || String(line.value))}</text>`).join('');
    const selectedIndex = rows.findIndex(row => row.label === String(spec.selectedLabel));
    const marker = spec.type === 'bar' || selectedIndex < 0 ? '' : `<line class="psd-plot-selected" x1="${x(selectedIndex)}" x2="${x(selectedIndex)}" y1="${top}" y2="${height - bottom}"/><text class="psd-plot-selected-label" x="${x(selectedIndex)}" y="${top - 8}" text-anchor="middle">${escape(rows[selectedIndex].label)}</text>`;
    const inspectionBelow = spec.inspectionPlacement === 'below';
    host.innerHTML = `${empty ? `<p class="psd-chart-empty">${escape(spec.emptyLabel || 'No reported values')}</p>` : ''}<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${escape(spec.title || fields.map(f => f.label).join(', '))}"><defs><clipPath id="${clipID}"><rect x="${left - 4}" y="${top - 4}" width="${plotWidth + 8}" height="${plotHeight + 8}"/></clipPath></defs>${axes}${references}${marker}${marks}${endLabels}<line class="psd-plot-playhead" y1="${top}" y2="${height-bottom}" stroke="currentColor" stroke-opacity=".5" hidden/><rect class="psd-plot-brush" y="${top}" height="${plotHeight}" hidden/><line class="psd-plot-guide" y1="${top}" y2="${height - bottom}" hidden/>${hits}</svg>${inspectionBelow ? `<div class="psd-plot-inspection" style="--inspection-rows:${Math.ceil(fields.length / 2)};--inspection-fields:${fields.length}">` : ''}<div class="psd-plot-tooltip" role="status" aria-live="polite" hidden></div>${inspectionBelow ? '</div>' : ''}`;
    function emphasize(key = spec.activeField, persist = false) {
      if (persist) spec.activeField = key;
      for (const group of host.querySelectorAll('[data-mark-series],[data-end-series]')) {
        const own = group.dataset.markSeries || group.dataset.endSeries;
        group.style.opacity = key && own !== key ? '.14' : '1';
        const line = group.querySelector('.psd-plot-line');
        if (line) line.style.strokeWidth = key === own ? '3' : '';
      }
    }
    on(host, 'pointerover', event => { const label = event.target.closest('[data-end-series]'); if (label) emphasize(label.dataset.endSeries); });
    on(host, 'pointerout', event => { if (event.target.closest('[data-end-series]') && !event.relatedTarget?.closest?.('[data-end-series]')) emphasize(); });
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
        const drag = dragging, range = rangeFromPixels(drag.start, localX(e.clientX), left, plotWidth, rows.length, !!timeSeries);
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
      if (!inspectionBelow) {
        tooltip.style.left = `${Math.max(4, Math.min(box.width - tooltip.offsetWidth - 4, point + 14))}px`;
        tooltip.style.top = `${Math.min(48, box.height / 4)}px`;
      }
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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = spec.animate && previous && !document.hidden && !reduced;
    const paths = [...host.querySelectorAll('[data-series]')], dots = [...host.querySelectorAll('[data-series-point]')];
    const yTicks = [...host.querySelectorAll('[data-y-tick]')], xTicks = [...host.querySelectorAll('[data-x-tick]')];
    const labelNodes = [...host.querySelectorAll('[data-end-series]')];
    const selectedLine = host.querySelector('.psd-plot-selected'), selectedText = host.querySelector('.psd-plot-selected-label');
    const oldValues = Object.fromEntries(Object.entries(previous?.series || {}).map(([key, points]) => [key, new Map(points.map(point => [point.label, point.value]))]));
    function drawGeometry(projection, progress = 1, preview = false) {
      const current = { ...geometry, projection, series: {} };
      for (const [key, points] of Object.entries(geometry.series)) {
        current.series[key] = points.map(point => {
          const before = oldValues[key]?.get(point.label) ?? point.value;
          const value = before + (point.value - before) * progress;
          return { ...point, value, x: timeSeries ? timeX(point.label, projection) : point.x, y: valueY(value, projection) };
        });
      }
      for (const path of paths) {
        path.setAttribute('d', current.series[path.dataset.series].map(point => `${point.command}${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(' '));
        path.style.visibility = timeSeries && Math.abs(projection.last - projection.first) < .001 ? 'hidden' : '';
      }
      for (const dot of dots) {
        const point = current.series[dot.dataset.seriesPoint]?.find(point => point.label === dot.dataset.label);
        if (point) { dot.setAttribute('cx', point.x); dot.setAttribute('cy', point.y); }
      }
      for (const tick of yTicks) {
        const py = valueY(Number(tick.dataset.yTick), projection);
        tick.querySelector('line').setAttribute('y1', py); tick.querySelector('line').setAttribute('y2', py);
        tick.querySelector('text').setAttribute('y', py + 4);
        const value = Number(tick.dataset.yTick), target = axis.ticks.includes(value) ? 1 : 0;
        const origin = previous?.projection.axis.ticks.includes(value) ? 1 : 0;
        tick.style.opacity = py < top - 1 || py > height - bottom + 1 ? '0' : String(origin + (target - origin) * progress);
      }
      if (timeSeries) for (const tick of xTicks) {
        const px = timeX(tick.dataset.xTick, projection); tick.setAttribute('x', px);
        const year = Number(tick.dataset.xTick), every = Math.max(1, Math.ceil((projection.last - projection.first + 1) / Math.max(2, Math.floor(plotWidth / 85))));
        const show = year === Math.round(projection.first) || year === Math.round(projection.last) || year % every === 0;
        const nearEnd = year !== Math.round(projection.last) && Math.abs(year - projection.last) < every * .65;
        const nearStart = year !== Math.round(projection.first) && Math.abs(year - projection.first) < every * .65;
        tick.style.opacity = px < left || px > width - right || !show || nearEnd || nearStart ? '0' : '1';
      }
      const endYear = timeSeries ? projection.last : Number(rows.at(-1)?.label);
      const labels = labelPositions(fields.flatMap(field => {
        const points = current.series[field.key];
        let point = points?.find(item => Number(item.label) === endYear);
        if (!point && timeSeries) {
          const a = points?.find(item => Number(item.label) === Math.floor(endYear));
          const b = points?.find(item => Number(item.label) === Math.ceil(endYear));
          // Interpolate the leader's position along the drawn segment only. Gaps stay gaps.
          if (a && b && b.command !== 'M') { const t = endYear - Math.floor(endYear); point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
        }
        return point ? [{ field, point, y: point.y }] : [];
      }), top + 9, height - bottom - 10, spec.compact ? 25 : 38);
      for (const node of labelNodes) {
        const label = labels.find(item => item.field.key === node.dataset.endSeries);
        node.style.visibility = label ? '' : 'hidden'; if (!label) continue;
        const { point, labelY } = label;
        const anchorX = Math.max(left, Math.min(width - right, point.x));
        node.querySelector('path').setAttribute('d', `M${anchorX},${point.y} L${width - right + 6},${labelY} L${width - right + 13},${labelY}`);
        node.querySelector('text').setAttribute('y', labelY + (spec.compact && node.dataset.labelWrap !== 'true' ? 4 : -3));
        if (spec.compact) node.querySelector('.psd-plot-end-value').setAttribute('y', labelY + 4);
        // Keep exact published values in the DOM; never print interpolated animation values.
        node.querySelector('.psd-plot-end-value').style.visibility = preview ? 'hidden' : '';
        node.querySelector('.psd-plot-end-value').style.opacity = String(progress);
      }
      if (selectedLine && selectedText && timeSeries) {
        const px = timeX(spec.selectedLabel, projection);
        selectedLine.setAttribute('x1', px); selectedLine.setAttribute('x2', px); selectedText.setAttribute('x', px);
        selectedLine.style.visibility = selectedText.style.visibility = preview || px < left || px > width - right ? 'hidden' : '';
      }
      host.__psdGeometry = current;
    }
    host.__psdGeometry = geometry;
    if (animate && previous.type !== geometry.type) host.querySelector('svg').animate([{ opacity: .35 }, { opacity: 1 }], { duration: 180 });
    if (animate && Object.keys(geometry.series).length && previous.type === geometry.type) {
      const startAt = performance.now(), duration = typeof spec.animate === 'number' ? spec.animate : 280;
      function frame(now) {
        const progress = Math.min(1, (now - startAt) / duration), eased = 1 - (1 - progress) ** 3;
        drawGeometry(mixProjection(previous.projection, geometry.projection, eased), eased);
        host.dataset.motionProgress = progress.toFixed(3);
        if (progress < 1) animationFrame = requestAnimationFrame(frame);
      }
      frame(startAt);
    } else { drawGeometry(geometry.projection); host.dataset.motionProgress = '1'; }

    host.__psdChartCleanup = () => { abort.abort(); resize.disconnect(); cancelAnimationFrame(animationFrame); cancelDrag(); };
    // Responsive redraw must not drop keyboard focus between a focus/Enter
    // pair, or when an already-focused chart changes width on orientation.
    if (focusedPoint !== undefined) host.querySelectorAll('[data-point]')[Number(focusedPoint)]?.focus();
    const setPlayhead=position=>{spec.playhead=position;const line=host.querySelector('.psd-plot-playhead');if(!line)return;if(!finite(position)){line.setAttribute('hidden','');return;}line.removeAttribute('hidden');const px=x(Math.max(0,Math.min(rows.length-1,position)));line.setAttribute('x1',px);line.setAttribute('x2',px);};
    host.__psdSetPlayhead=setPlayhead;
    setPlayhead(spec.playhead);
    return { data, accessor:data.accessor, emphasize, setPlayhead:position=>host.__psdSetPlayhead?.(position), destroy: () => host.__psdChartCleanup?.(),
      finish() { cancelAnimationFrame(animationFrame); drawGeometry(geometry.projection); host.dataset.motionProgress = '1.000'; },
      viewport(start, end) {
        if (!timeSeries) return;
        cancelAnimationFrame(animationFrame);
        host.dataset.previewStart = start; host.dataset.previewEnd = end;
        hide();
        drawGeometry({ ...geometry.projection, first: start, last: end }, 1, true);
      },
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
    host.innerHTML = `<div class="psd-range-track"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg><div class="psd-range-shade psd-range-before"></div><div class="psd-range-shade psd-range-after"></div><div class="psd-range-window" data-drag="window" role="slider" tabindex="0" aria-label="Move selected year range"></div><button type="button" class="psd-range-handle" data-drag="start" role="slider" aria-label="Start year"></button><button type="button" class="psd-range-handle" data-drag="end" role="slider" aria-label="End year"></button></div><div class="psd-range-extents"><span>${min}</span><span>${max}</span></div>`;
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
        handle.setAttribute('aria-valuemin', key === 'start' ? min : Math.round(start));
        handle.setAttribute('aria-valuemax', key === 'start' ? Math.round(end) : max);
        handle.setAttribute('aria-valuenow', Math.round(value)); handle.setAttribute('aria-valuetext', String(Math.round(value)));
      }
      selection.setAttribute('aria-valuemin', min); selection.setAttribute('aria-valuemax', Math.round(max - (end - start)));
      selection.setAttribute('aria-valuenow', Math.round(start)); selection.setAttribute('aria-valuetext', `${Math.round(start)} to ${Math.round(end)}`);
      host.dataset.start = start; host.dataset.end = end;
    }
    function set(a, b, emit = false) {
      start = Math.max(min, Math.min(max, a)); end = Math.max(start, Math.min(max, b));
      draw(); if (emit) spec.onChange?.({ start: Math.round(start), end: Math.round(end) }, { start, end });
    }
    function finish(cancel = false) {
      if (!drag) return;
      const previous = drag; drag = null;
      if (host.hasPointerCapture?.(previous.id)) host.releasePointerCapture(previous.id);
      host.removeAttribute('data-dragging'); host.removeAttribute('data-drag-mode');
      if (cancel) { set(previous.original.start, previous.original.end, true); spec.onCancel?.(); }
      else { set(Math.round(start), Math.round(end)); spec.onCommit?.({ start, end }, previous.original); }
    }
    on(host, 'pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary || !event.target.closest('.psd-range-track')) return;
      const mode = event.target.closest('[data-drag]')?.dataset.drag || 'jump';
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start, end, original: { start, end }, mode, moved: false };
      host.setPointerCapture(event.pointerId); host.setAttribute('data-dragging', ''); host.dataset.dragMode = mode;
      if (mode === 'jump') {
        const box = track.getBoundingClientRect(), year = min + (event.clientX - box.left) / box.width * (max - min);
        set(...moveRange(start, end, Math.round(year - (start + end) / 2), min, max), true);
        drag.start = start; drag.end = end;
      }
    });
    on(host, 'pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { finish(true); return; }
      if (Math.abs(dx) > 3) drag.moved = true;
      if (!drag.moved) return;
      const delta = dx / track.getBoundingClientRect().width * (max - min);
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
    draw(); host.__psdRangeCleanup = () => { abort.abort(); if (drag && host.hasPointerCapture?.(drag.id)) host.releasePointerCapture(drag.id); drag = null; host.removeAttribute('data-dragging'); host.removeAttribute('data-drag-mode'); };
    return { set, destroy: host.__psdRangeCleanup };
  }
  // Reusable geographic flow renderer. The adapter owns periods, units and narrative.
  // D3 is supplied by the consumer; no dataset or country identity is hardcoded here.
  function globe(element, spec) {
    const d3=root.d3, svg=d3.select(element), frame=element.parentElement;
    let w=0,h=0,projection,geo,land,grid,lines=[],backs=[],labels=[],leaders=[],dots=[],particles=[],state=null;
    const curve=(c,t)=>{const u=1-t;return [u*u*c[0][0]+2*u*t*c[1][0]+t*t*c[2][0],u*u*c[0][1]+2*u*t*c[1][1]+t*t*c[2][1]];};
    function resize(){
      const nextW=frame.clientWidth,nextH=frame.clientHeight;if(w===nextW&&h===nextH)return;
      w=nextW;h=nextH;svg.attr('viewBox',`0 0 ${w} ${h}`);svg.selectAll('g,defs,ellipse').remove();
      projection=d3.geoOrthographic().scale(Math.min(w,h)*.43).translate([w*.5,h*.48]).clipAngle(90).precision(.8);geo=d3.geoPath(projection);
      const defs=svg.append('defs'),shade=defs.append('radialGradient').attr('id',element.id+'-shade').attr('cx','30%').attr('cy','25%').attr('r','75%');
      shade.append('stop').attr('offset','40%').attr('stop-color','var(--oa-ink)').attr('stop-opacity',0);shade.append('stop').attr('offset','100%').attr('stop-color','var(--oa-ink)').attr('stop-opacity',.24);
      const shadow=defs.append('radialGradient').attr('id',element.id+'-shadow');shadow.append('stop').attr('stop-color','var(--oa-ink)').attr('stop-opacity',.2);shadow.append('stop').attr('offset','100%').attr('stop-color','var(--oa-ink)').attr('stop-opacity',0);
      svg.append('ellipse').attr('cx',w*.5).attr('cy',h*.48+projection.scale()+12).attr('rx',projection.scale()*.8).attr('ry',13).attr('fill',`url(#${element.id}-shadow)`);
      const map=svg.append('g');map.append('circle').attr('cx',w*.5).attr('cy',h*.48).attr('r',projection.scale()).attr('fill','var(--oa-ocean)').attr('stroke','var(--oa-line)');
      grid=map.append('path').datum(d3.geoGraticule().step([15,15])()).attr('class','oa-graticule');
      land=map.append('g').selectAll('path').data(spec.features).join('path').attr('class',f=>'oa-country'+(spec.groupFor(f)?' oa-country-'+spec.groupFor(f):''));
      map.append('circle').attr('cx',w*.5).attr('cy',h*.48).attr('r',projection.scale()).attr('fill',`url(#${element.id}-shade)`).attr('pointer-events','none');
      lines=[];backs=[];labels=[];leaders=[];dots=[];particles=[];
      spec.routes.forEach((r,i)=>{backs.push(map.append('path').attr('class','oa-flow-underlay'));lines.push(map.append('path').attr('class','oa-flow').attr('stroke',r.color));const hit=map.append('path').attr('class','oa-route-hit').attr('data-route',i);hit.on('click',()=>spec.onSelect?.(r.key));for(let j=0;j<7;j++)particles.push({route:i,offset:j/7,node:map.append('circle').attr('r',1.6).attr('fill','var(--oa-paper)').attr('pointer-events','none')});});
      [spec.origin,...spec.routes.map(r=>r.coord)].forEach((_,i)=>{dots.push(map.append('circle').attr('class','oa-node').attr('r',i?3:4));leaders.push(svg.append('g').append('path').attr('class','oa-leader'));const group=svg.append('g');group.append('text').attr('class','oa-map-label').text(i?spec.routes[i-1].name.toUpperCase():(spec.originLabel||'ORIGIN'));if(i)group.append('text').attr('class','oa-map-value').attr('y',22);labels.push(group);});
      if(state)update(state);
    }
    function update(next){
      state=next;if(!projection)return;projection.rotate([next.pose.lon,next.pose.lat]);land.attr('d',geo);grid.attr('d',geo);
      const points=[projection(spec.origin),...spec.routes.map(r=>projection(r.coord))];
      const curves=spec.routes.map((r,i)=>{const a=points[0],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],bend=i===1?-.19:.18,c=[a,[(a[0]+b[0])/2-dy*bend,(a[1]+b[1])/2+dx*bend],b];const path=`M${a} Q${c[1]} ${b}`,v=next.values[r.key],width=28*(v||0)/spec.maximum,opacity=next.selected&&next.selected!==r.key?.2:.86;
        lines[i].attr('d',path).attr('stroke-width',width).attr('opacity',opacity).attr('visibility',v==null||v===0?'hidden':'visible');backs[i].attr('d',path).attr('stroke-width',width+2).attr('visibility',v==null||v===0?'hidden':'visible');svg.select(`[data-route="${i}"]`).attr('d',path);return c;});
      points.forEach((p,i)=>{dots[i].attr('cx',p[0]).attr('cy',p[1]);const anchor=i===2?'start':i?'end':'middle',lw=i===1?116:96;let x=p[0]+(i===2?16:i?-17:0),y=p[1]+(i===0?-34:i===2?-14:34);x=anchor==='start'?Math.min(w-lw-5,x):anchor==='end'?Math.max(lw+5,x):Math.max(lw/2+5,Math.min(w-lw/2-5,x));y=Math.max(22,Math.min(h-(i?46:26),y));labels[i].attr('transform',`translate(${x},${y})`).attr('text-anchor',anchor);if(i)labels[i].select('.oa-map-value').text(next.labels[i-1]);leaders[i].attr('d',`M${p} L${x},${y+(i===0?15:-5)}`);});
      particles.forEach(p=>{const t=(next.motionTime/4800+p.offset)%1,q=curve(curves[p.route],t),v=next.values[spec.routes[p.route].key];p.node.attr('cx',q[0]).attr('cy',q[1]).attr('opacity',next.animate&&v>0?Math.min(1,t*9,(1-t)*9)*.8:0);});
    }
    resize();return {resize,update,destroy:()=>svg.selectAll('g,defs,ellipse').remove()};
  }

  // A geographic relationship view. Values are independent reported edges;
  // drawing never infers transit or conserves amounts between them.
  function renderRoutes(host, spec) {
    host.__psdChartCleanup?.();
    const abort = new AbortController();
    const geometry = spec.geometry;
    const focusedEdge=host.contains(document.activeElement)?document.activeElement.dataset?.edge:undefined;
    const markerId='psd-route-arrow-'+Math.random().toString(36).slice(2);
    const highlighted = new Set(spec.nodes.map(node => (node.iso2||'').toLowerCase()));
    host.innerHTML = `<svg viewBox="${escape(geometry.viewBox)}" role="group" aria-label="${escape(spec.title)}"><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs><g class="psd-route-land">${geometry.locations.map(location => `<path d="${escape(location.path)}" class="${highlighted.has(location.id) ? 'is-involved' : ''}"/>`).join('')}</g><g class="psd-route-edges"></g><g class="psd-route-nodes"></g></svg><p class="psd-route-detail" aria-live="polite"></p>`;
    const svg=host.querySelector('svg'), points=new Map();
    // Anchor coordinates use the same map projection as the published geometry.
    for(const node of spec.nodes) {
      const index=geometry.locations.findIndex(location=>location.id===(node.iso2||'').toLowerCase());
      const path=svg.querySelector('.psd-route-land').children[index];
      if(!path) continue;
      const box=path.getBBox(); points.set(node.id,{x:box.x+box.width/2,y:box.y+box.height/2});
    }
    const max=spec.maxValue || 1;
    svg.querySelector('.psd-route-edges').innerHTML=spec.edges.map((edge,i)=>{
      const a=points.get(edge.from),b=points.get(edge.to); if(!a||!b)return '';
      const known=finite(edge.value), width=known && edge.value>0 ? .5+7*Math.sqrt(edge.value/max) : 1;
      const bend=Math.min(100,Math.hypot(b.x-a.x,b.y-a.y)*.25)*(i%2 ? -1 : 1);
      const d=`M${a.x},${a.y} Q${(a.x+b.x)/2},${(a.y+b.y)/2-bend} ${b.x},${b.y}`;
      return `<g tabindex="${i===0?0:-1}" role="button" data-edge="${i}" aria-label="${escape(edge.label)}"><path class="psd-route-hit" d="${d}"/><path class="psd-route-line ${known?'':'is-missing'} ${edge.value>0?'has-value':''}" d="${d}" style="stroke:${escape(edge.color||palette[0])};stroke-width:${width}" ${known && edge.value>0?`marker-end="url(#${markerId})"`:""}/></g>`;
    }).join('');
    svg.querySelector('.psd-route-nodes').innerHTML=spec.nodes.map(node=>{
      const p=points.get(node.id);return p?`<g><circle cx="${p.x}" cy="${p.y}" r="${node.quiet?1.7:4}"/>${node.quiet?'':`<text x="${p.x}" y="${p.y-12}" text-anchor="middle">${escape(node.label)}</text>`}</g>`:'';
    }).join('');
    // Zoom to the selected relationship; Russia remains the destination.
    if(points.size && !spec.worldView) {const coords=[...points.values()],xs=coords.map(p=>p.x),ys=coords.map(p=>p.y);const w=Math.max(260,Math.max(...xs)-Math.min(...xs)+180),h=Math.max(210,Math.max(...ys)-Math.min(...ys)+150);svg.setAttribute('viewBox',`${(Math.max(...xs)+Math.min(...xs)-w)/2} ${(Math.max(...ys)+Math.min(...ys)-h)/2} ${w} ${h}`);}
    const detail=host.querySelector('.psd-route-detail');detail.textContent=spec.note;
    const show=e=>{const mark=e.target.closest('[data-edge]');if(mark) detail.textContent=spec.edges[Number(mark.dataset.edge)].label;};
    for(const event of ['pointerover','focusin','click']) host.addEventListener(event,show,{signal:abort.signal});
    host.addEventListener('keydown',e=>{
      if(e.key==='Escape'){detail.textContent=spec.note;return;}
      const mark=e.target.closest('[data-edge]');if(!mark)return;
      if(e.key==='Enter'||e.key===' '){e.preventDefault();show(e);return;}
      if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
        e.preventDefault();const marks=[...host.querySelectorAll('[data-edge]')],i=marks.indexOf(mark);const next=e.key==='Home'?0:e.key==='End'?marks.length-1:(i+(e.key==='ArrowLeft'?-1:1)+marks.length)%marks.length;mark.tabIndex=-1;marks[next].tabIndex=0;marks[next].focus();
      }
    },{signal:abort.signal});
    host.__psdChartCleanup=()=>abort.abort();
    if(focusedEdge!==undefined){const mark=host.querySelector(`[data-edge="${focusedEdge}"]`);if(mark){host.querySelector('[data-edge="0"]')?.setAttribute('tabindex','-1');mark.tabIndex=0;mark.focus();}}
    return {destroy:host.__psdChartCleanup};
  }

  // Institutional funding routes. Adapters supply every amount, boundary and
  // allocation; geometry and motion never manufacture a source/recipient split.
  function renderFundingFlow(host, spec) {
    const focused=host.contains(document.activeElement)?document.activeElement.dataset?.flowNode:null;
    host.__psdChartCleanup?.();
    const abort=new AbortController(), on=(target,event,fn)=>target.addEventListener(event,fn,{signal:abort.signal});
    const columns=spec.tableColumns||[], accessor=Object.freeze({columns,rows:()=>spec.rows||[]});
    host.__psdChartAccessor=accessor;host.classList.add('psd-shared-plot');host.dataset.chartComponent='funding-flow';
    const nodes=[...spec.sources,...spec.routeNodes,...spec.recipients];
    const format=value=>value==null?'—':new Intl.NumberFormat(spec.locale||'en-GB',{maximumFractionDigits:6}).format(Number(value));
    const card=(node,kind)=>`<${kind==='route'?'div':'button type="button"'} class="psd-funding-node psd-funding-${kind}${node.muted?' is-muted':''}" data-flow-node="${escape(node.nodeId)}" ${kind==='route'?'':`data-flow-kind="${kind}" data-flow-key="${escape(node.id)}" aria-pressed="${Boolean(node.selected)}"`}><strong>${escape(node.label)}</strong>${kind==='route'?'':`<span class="psd-funding-amount">${escape(format(node.amount))} <small>${escape(node.unit||'')}</small></span>`}<span class="psd-funding-meta">${escape(node.meta||'')}</span>${finite(node.share)?`<span class="psd-funding-share">${escape(format(node.share))}% <small>${escape(spec.labels.share)}</small></span><span class="psd-funding-track" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,node.share))}%"></i></span>`:''}</${kind==='route'?'div':'button'}>`;
    host.innerHTML=`<div class="psd-funding-heads"><span>01 / ${escape(spec.labels.source)}</span><span>02 / ${escape(spec.labels.route)}</span><span>03 / ${escape(spec.labels.recipient)}</span></div><div class="psd-funding-map"><svg class="psd-funding-paths" aria-hidden="true"></svg><div class="psd-funding-lane" data-flow-lane="source">${spec.sources.map(n=>card(n,'source')).join('')}</div><div class="psd-funding-lane psd-funding-routing">${spec.routeNodes.map(n=>card(n,'route')).join('')}</div><div class="psd-funding-lane" data-flow-lane="recipient">${spec.recipients.map(n=>card(n,'recipient')).join('')}</div></div><div class="psd-funding-inspection" role="status" aria-live="polite"></div>`;
    const map=host.querySelector('.psd-funding-map'), svg=host.querySelector('svg'), inspection=host.querySelector('.psd-funding-inspection');
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let visible=true,playing=spec.playing!==false;
    function syncMotion(){const run=playing&&!reduced.matches&&!document.hidden&&visible;host.dataset.flowMotion=run?'playing':'paused';if(run)svg.unpauseAnimations?.();else svg.pauseAnimations?.();}
    function draw(){
      const box=map.getBoundingClientRect();if(!box.width||!box.height)return;
      svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
      const rects=new Map(nodes.map(n=>[n.nodeId,host.querySelector(`[data-flow-node="${n.nodeId}"]`).getBoundingClientRect()]));
      const marker='psd-funding-arrow-'+(++chartID);
      svg.innerHTML=`<defs><marker id="${marker}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="context-stroke"/></marker></defs>`+spec.edges.map((edge,i)=>{
        const a=rects.get(edge.from),b=rects.get(edge.to);if(!a||!b)return '';
        const vertical=Math.abs(a.left-b.left)<2;
        const x1=(vertical?a.left+a.width*.5:a.right)-box.left,y1=(vertical?a.bottom:a.top+a.height*.5)-box.top;
        const x2=(vertical?b.left+b.width*.5:b.left-4)-box.left,y2=(vertical?b.top-4:b.top+b.height*.5)-box.top;
        const bend=Math.max(18,(x2-x1)*.48),d=vertical?`M${x1},${y1} L${x2},${y2}`:`M${x1},${y1} C${x1+bend},${y1} ${x2-bend},${y2} ${x2},${y2}`;
        const active=edge.active!==false;
        return `<g class="psd-funding-edge ${active?'is-active':'is-quiet'} is-${escape(edge.kind||'tax')}"><path d="${d}" marker-end="url(#${marker})"/>${active?[0,1,2].map(j=>`<circle class="psd-funding-particle" r="${j===0?3:2}" aria-hidden="true"><animateMotion path="${d}" dur="4.8s" begin="${-j*1.6-i*.13}s" repeatCount="indefinite"/></circle>`).join(''):''}</g>`;
      }).join('');syncMotion();
    }
    const describe=mark=>{const n=nodes.find(n=>n.nodeId===mark.dataset.flowNode);if(n)inspection.textContent=[n.label,n.amount==null?'—':format(n.amount)+' '+(n.unit||''),n.meta,finite(n.share)?format(n.share)+'%':''].filter(Boolean).join(' · ');};
    on(host,'pointerover',e=>{const mark=e.target.closest('[data-flow-kind]');if(mark)describe(mark);});
    on(host,'focusin',e=>{const mark=e.target.closest('[data-flow-kind]');if(mark)describe(mark);});
    on(host,'pointerleave',()=>{if(!host.contains(document.activeElement))inspection.textContent='';});
    on(host,'click',e=>{const mark=e.target.closest('[data-flow-kind]');if(mark)spec.onSelect?.(mark.dataset.flowKind,mark.dataset.flowKey);});
    on(host,'keydown',e=>{
      if(e.key==='Escape'){inspection.textContent='';spec.onClear?.();return;}
      const mark=e.target.closest('[data-flow-kind]');if(!mark||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
      e.preventDefault();const all=[...host.querySelectorAll('[data-flow-kind]')],same=all.filter(n=>n.dataset.flowKind===mark.dataset.flowKind),index=same.indexOf(mark);
      let next;if(e.key==='Home')next=same[0];else if(e.key==='End')next=same.at(-1);else if(e.key==='ArrowLeft'||e.key==='ArrowRight')next=all.find(n=>n.dataset.flowKind!==mark.dataset.flowKind);else next=same[(index+(e.key==='ArrowUp'?-1:1)+same.length)%same.length];next?.focus();
    });
    const resize=new ResizeObserver(draw);resize.observe(map);on(document,'visibilitychange',syncMotion);on(reduced,'change',syncMotion);
    const intersection=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;syncMotion();}):null;intersection?.observe(host);
    draw();if(focused)host.querySelector(`[data-flow-node="${focused}"]`)?.focus();
    host.__psdChartCleanup=()=>{abort.abort();resize.disconnect();intersection?.disconnect();svg.pauseAnimations?.();};
    return {accessor,destroy:host.__psdChartCleanup,setPlaying(value){playing=Boolean(value);syncMotion();}};
  }

  // Nonnegative part-to-whole compositions. Adapters define the denominator.
  function renderDonut(host,spec){
    const focused=host.contains(document.activeElement)?document.activeElement.dataset?.point:undefined;
    host.__psdChartCleanup?.();const abort=new AbortController(),on=(node,event,fn)=>node.addEventListener(event,fn,{signal:abort.signal});
    const data=model(spec),{rows,fields}=data,width=Math.max(300,Math.min(1120,host.clientWidth-8)),height=spec.height||310;
    host.classList.add('psd-shared-plot');host.dataset.chartComponent='donut';host.__psdChartAccessor=data.accessor;
    const cx=width/2,cy=height/2,outer=Math.min(height*.42,width*.4),inner=outer*.66,number=new Intl.NumberFormat(spec.locale||'en-GB',{maximumFractionDigits:1});
    const valid=rows.length&&rows.every(r=>r.shares[0]!==null),describe=row=>`${row.label}: ${fields[0].format?fields[0].format(row.values[0],row.raw):row.values[0]} (${spec.shareFormat?spec.shareFormat(row.shares[0],row.raw):number.format(row.shares[0])+'%'})`;
    let angle=-Math.PI/2,marks='',point=0;
    if(valid)for(const row of rows){if(row.values[0]<=0)continue;const end=angle+row.shares[0]/100*Math.PI*2,finish=Math.min(end,angle+Math.PI*2-.000001),xy=(a,r)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r],a=xy(angle,outer),b=xy(finish,outer),c=xy(finish,inner),d=xy(angle,inner),large=finish-angle>Math.PI?1:0;
      marks+=`<path class="psd-donut-slice" data-point="${point}" data-row="${rows.indexOf(row)}" d="M${a} A${outer},${outer} 0 ${large} 1 ${b} L${c} A${inner},${inner} 0 ${large} 0 ${d} Z" fill="${escape(spec.rowColor?.(row.raw)||palette[point%palette.length])}" tabindex="${point?-1:0}" role="button" aria-label="${escape(describe(row))}"/>`;angle=end;point++;}
    host.innerHTML=`${valid?'':`<p class="psd-chart-empty">${escape(spec.emptyLabel||'No complete positive composition')}</p>`}<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${escape(spec.title||'')}">${marks}<text class="psd-donut-total" x="${cx}" y="${cy}" text-anchor="middle">${escape(spec.centerLabel||'')}</text><text x="${cx}" y="${cy+23}" text-anchor="middle">${escape(spec.centerSubLabel||'')}</text></svg><div class="psd-plot-inspection" style="--inspection-rows:1;--inspection-fields:1"><div class="psd-plot-tooltip" role="status" aria-live="polite" hidden></div></div>`;
    const tip=host.querySelector('.psd-plot-tooltip');let pinned=false;
    const show=hit=>{tip.textContent=describe(rows[Number(hit.dataset.row)]);tip.hidden=false;},hide=()=>{tip.hidden=true;};
    on(host,'pointermove',e=>{const hit=e.target.closest('[data-point]');if(hit&&!pinned)show(hit);});on(host,'pointerleave',()=>{if(!pinned&&!host.contains(document.activeElement))hide();});
    on(host,'focusin',e=>{const hit=e.target.closest('[data-point]');if(hit)show(hit);});on(host,'focusout',e=>{if(!host.contains(e.relatedTarget)){pinned=false;hide();}});
    const activate=hit=>{pinned=!pinned;if(pinned)show(hit);else hide();spec.onSelect?.(rows[Number(hit.dataset.row)].raw);};
    on(host,'click',e=>{const hit=e.target.closest('[data-point]');if(hit)activate(hit);});on(document,'pointerdown',e=>{if(!host.contains(e.target)){pinned=false;hide();}});
    on(host,'keydown',e=>{if(e.key==='Escape'){pinned=false;hide();return;}const hit=e.target.closest('[data-point]');if(!hit)return;if(['Enter',' '].includes(e.key)){e.preventDefault();activate(hit);return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const all=[...host.querySelectorAll('[data-point]')],i=all.indexOf(hit),next=e.key==='Home'?0:e.key==='End'?all.length-1:Math.max(0,Math.min(all.length-1,i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)));hit.tabIndex=-1;all[next].tabIndex=0;all[next].focus();});
    const resize=new ResizeObserver(()=>{if(Math.abs(Math.max(300,Math.min(1120,host.clientWidth-8))-width)>1)render(host,spec);});resize.observe(host);host.__psdChartCleanup=()=>{abort.abort();resize.disconnect();};if(focused!==undefined){const selected=host.querySelector(`[data-point="${focused}"]`);if(selected){host.querySelector('[data-point="0"]')?.setAttribute('tabindex','-1');selected.tabIndex=0;selected.focus();}}return {data,accessor:data.accessor,destroy:host.__psdChartCleanup};
  }

  // Spatial charts share the same normalized values, interaction and export contract.
  function renderSpecial(host, spec) {
    const previousBubbles=host.__psdBubbles || new Map(),nextBubbles=new Map();
    const focused = host.contains(document.activeElement) ? document.activeElement.dataset?.point : undefined;
    host.__psdChartCleanup?.();
    const abort = new AbortController(), on = (node, event, fn) => node.addEventListener(event, fn, { signal: abort.signal });
    const data = model(spec), rows = data.rows, fields = data.fields;
    host.__psdChartAccessor = data.accessor;
    host.classList.add('psd-shared-plot'); host.dataset.chartComponent = spec.type;
    const width = Math.max(300, Math.min(1120, host.clientWidth - 8));
    const height = spec.height || (spec.type === 'pyramid' ? 600 : width < 600 ? 340 : 480);
    const left = width < 600 ? 58 : 82, right = 26, top = 35, bottom = 60, pw = width-left-right, ph=height-top-bottom;
    const number = new Intl.NumberFormat(spec.locale || 'en-GB', {maximumFractionDigits:1,notation:'compact'});
    const format = (v,f,row) => v === null ? '—' : String(f.format ? f.format(v,row.raw) : spec.format ? spec.format(v,row.raw) : number.format(v));
    const describe = row => `${row.label}. ${fields.map((f,i)=>`${f.label}: ${format(row.values[i],f,row)}`).join('. ')}`;
    let axes='', marks='', hits='';
    if (spec.type === 'scatter') {
      const xd = spec.xDomain || domain(rows.map(r=>r.values[0]),false), yd = spec.yDomain || domain(rows.map(r=>r.values[1]),false);
      const log = spec.xScale === 'log';
      const tx = v => log ? Math.log10(v) : v;
      const minX = log ? Math.max(xd.min, spec.minPositiveX || 1) : xd.min;
      const x = v => left + (tx(v)-tx(minX))/(tx(xd.max)-tx(minX))*pw;
      const y = v => top+(yd.max-v)/(yd.max-yd.min)*ph;
      const sizeMax = spec.sizeMax || Math.max(1,...rows.map(r=>finite(r.values[2])?r.values[2]:0));
      const valid = row => finite(row.values[0]) && finite(row.values[1]) && (!log || row.values[0]>0) && row.values[0]>=minX && row.values[0]<=xd.max && row.values[1]>=yd.min && row.values[1]<=yd.max;
      const xticks = log ? [1,2,5].flatMap(n=>Array.from({length:8},(_,i)=>n*10**i)).filter(v=>v>=minX&&v<=xd.max) : xd.ticks;
      axes = `<g class="psd-plot-grid">${yd.ticks.map(v=>`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-10}" y="${y(v)+4}" text-anchor="end">${escape(number.format(v))}</text>`).join('')}${xticks.map(v=>`<text x="${x(v)}" y="${height-35}" text-anchor="middle">${escape(number.format(v))}</text>`).join('')}<text x="${left}" y="20">${escape(spec.yLabel || fields[1].label)}</text><text x="${left+pw/2}" y="${height-8}" text-anchor="middle">${escape(spec.xLabel || fields[0].label)}</text></g>`;
      // Trails carry only supplied observations. A missing year breaks a path.
      marks = (spec.trails || []).map(trail=> {
        let previous=null;
        const d=trail.points.map(p=> {
          if(!finite(p.x)||!finite(p.y)||(log&&p.x<=0)){previous=null;return '';}
          const move=previous===null || (finite(p.year)&&finite(previous.year)&&p.year-previous.year>1);
          previous=p;return `${move?'M':'L'}${x(p.x)},${y(p.y)}`;
        }).join(' ');
        return `<path class="psd-plot-trail" d="${d}" stroke="${escape(trail.color || '#8b8d83')}"/>`;
      }).join('');
      rows.forEach((row,i)=> {
        if(!valid(row)) return;
        const radius=fields.length>2 && finite(row.values[2]) && row.values[2]>0 ? Math.sqrt(row.values[2]/sizeMax)*(spec.bubbleRadius || 32) : 6;
        const color=spec.rowColor?.(row.raw) || palette[i%palette.length];
        nextBubbles.set(String(row.raw.code || row.label),{x:x(row.values[0]),y:y(row.values[1]),r:radius});
        marks+=`<circle data-bubble-id="${escape(row.raw.code || row.label)}" class="psd-plot-bubble" cx="${x(row.values[0])}" cy="${y(row.values[1])}" r="${radius}" fill="${escape(color)}"/>`;
        if(row.raw.selected) marks+=`<text data-bubble-follow="${escape(row.raw.code || row.label)}" class="psd-plot-direct" x="${x(row.values[0])+radius+4}" y="${y(row.values[1])+4}">${escape(row.raw.code || row.label)}</text>`;
        hits+=`<circle data-bubble-follow="${escape(row.raw.code || row.label)}" class="psd-plot-hit" data-point="${i}" cx="${x(row.values[0])}" cy="${y(row.values[1])}" r="${Math.max(10,radius)}" tabindex="${hits?-1:0}" role="button" aria-label="${escape(describe(row))}"/>`;
      });
    } else {
      const max=spec.maxValue || Math.max(1,...rows.flatMap(r=>r.values).filter(finite));
      const center=left+pw/2, half=pw/2, step=ph/Math.max(1,rows.length);
      axes=`<g class="psd-plot-grid"><line x1="${center}" x2="${center}" y1="${top}" y2="${height-bottom}"/><text x="${left}" y="20">${escape(fields[0].label)}</text><text x="${width-right}" y="20" text-anchor="end">${escape(fields[1].label)}</text>${[-1,-.5,0,.5,1].map(v=>`<text x="${center+v*half}" y="${height-25}" text-anchor="middle">${escape(number.format(Math.abs(v)*max))}</text>`).join('')}<text x="${center}" y="${height-5}" text-anchor="middle">${escape(spec.unit || '')}</text></g>`;
      rows.forEach((row,i)=> {
        const by=top+i*step;
        row.values.slice(0,2).forEach((v,f)=> {
          if(!finite(v)||v<0)return;
          const w=v/max*half;
          marks+=`<rect x="${f?center:center-w}" y="${by+2}" width="${w}" height="${Math.max(1,step-5)}" fill="${escape(fields[f].color)}"/>`;
        });
        marks+=`<text x="${left-8}" y="${by+step/2+4}" text-anchor="end">${escape(row.label)}</text>`;
        hits+=`<rect class="psd-plot-hit" data-point="${i}" x="0" y="${by}" width="${width}" height="${step}" tabindex="${i?-1:0}" role="button" aria-label="${escape(describe(row))}"/>`;
      });
    }
    host.__psdBubbles=nextBubbles;
    const watermark=spec.type==='scatter'&&spec.yearLabel!==undefined?`<text class="psd-plot-year" x="${left+pw/2}" y="${top+ph*.6}" text-anchor="middle" aria-hidden="true">${escape(spec.yearLabel)}</text>`:'';
    host.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${escape(spec.title || '')}">${watermark}${axes}${marks}${hits}</svg><div class="psd-plot-tooltip" role="status" aria-live="polite" hidden></div>`;
    const animations=[];
    if(spec.animate&&!document.hidden&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      host.querySelectorAll('[data-bubble-id], [data-bubble-follow]').forEach(mark=>{
        const id=mark.dataset.bubbleId || mark.dataset.bubbleFollow,a=previousBubbles.get(id),b=nextBubbles.get(id);if(!a||!b)return;
        // Position tween only: tooltip/table always report the selected year's real observation.
        animations.push(mark.animate([{transform:`translate(${a.x-b.x}px,${a.y-b.y}px)`},{transform:'translate(0,0)'}],{duration:typeof spec.animate==='number'?spec.animate:700,easing:spec.animationEasing || 'ease-in-out'}));
      });
    }
    const tooltip=host.querySelector('.psd-plot-tooltip');let pinned=false;
    const hide=()=>{tooltip.hidden=true;};
    function show(hit){const row=rows[Number(hit.dataset.point)];tooltip.textContent=describe(row);tooltip.hidden=false;tooltip.style.left='8px';tooltip.style.top='38px';}
    on(host,'pointermove',e=>{const hit=e.target.closest('[data-point]');if(hit&&!pinned)show(hit);});
    on(host,'pointerleave',()=>{if(!pinned&&!host.contains(document.activeElement))hide();});
    on(host,'focusin',e=>{const hit=e.target.closest('[data-point]');if(hit)show(hit);});
    on(host,'focusout',e=>{if(!host.contains(e.relatedTarget)){pinned=false;hide();}});
    const activate=hit=>{pinned=!pinned;if(pinned)show(hit);else hide();spec.onSelect?.(rows[Number(hit.dataset.point)].raw);};
    on(host,'click',e=>{const hit=e.target.closest('[data-point]');if(hit)activate(hit);});
    on(document,'pointerdown',e=>{if(!host.contains(e.target)){pinned=false;hide();}});
    on(host,'keydown',e=>{
      if(e.key==='Escape'){pinned=false;hide();return;}
      const hit=e.target.closest('[data-point]');if(!hit)return;
      if(['Enter',' '].includes(e.key)){e.preventDefault();activate(hit);return;}
      const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];if(!keys.includes(e.key))return;
      e.preventDefault();const all=[...host.querySelectorAll('[data-point]')],i=all.indexOf(hit);
      const next=e.key==='Home'?0:e.key==='End'?all.length-1:Math.max(0,Math.min(all.length-1,i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)));
      hit.setAttribute('tabindex','-1');all[next].setAttribute('tabindex','0');all[next].focus();
    });
    const resize=new ResizeObserver(()=>{if(Math.abs(Math.max(300,Math.min(1120,host.clientWidth-8))-width)>1)render(host,spec);});resize.observe(host);
    host.__psdChartCleanup=()=>{
      // Preserve the visible position when a slider or selection interrupts a glide.
      host.querySelectorAll('[data-bubble-id]').forEach(mark=>{
        const point=nextBubbles.get(mark.dataset.bubbleId),transform=getComputedStyle(mark).transform;
        if(point && transform && transform!=='none'){
          const matrix=new DOMMatrixReadOnly(transform);point.x+=matrix.m41;point.y+=matrix.m42;
        }
      });
      animations.forEach(a=>a.cancel());abort.abort();resize.disconnect();
    };
    if(focused!==undefined)host.querySelector(`[data-point="${focused}"]`)?.focus();
    return {data,accessor:data.accessor,destroy:host.__psdChartCleanup};
  }

  // Positive values occupy their exact share of the rectangle. Signed, zero and
  // missing observations retain their original rows outside the area encoding.
  function treemapLayout(rows, options = {}) {
    const width = finite(options.width) && options.width >= 0 ? options.width : 1;
    const height = finite(options.height) && options.height >= 0 ? options.height : 1;
    const valueFor = options.value || (row => row.value);
    const positive = [], unsized = [];
    (rows || []).forEach((row, index) => {
      const value = valueFor(row);
      if (!finite(value) || value <= 0) unsized.push({ index, row, value: finite(value) ? value : null, reason: !finite(value) ? 'missing' : value < 0 ? 'negative' : 'zero' });
      else positive.push({ index, row, value });
    });
    positive.sort((a, b) => b.value - a.value || a.index - b.index);
    const scale = positive[0]?.value || 1;
    const weighted = positive.map(row => ({ ...row, weight: row.value / scale }));
    const weightTotal = weighted.reduce((sum, row) => sum + row.weight, 0);
    const tiles = [];
    function partition(items, x, y, w, h, weight) {
      if (!items.length) return;
      if (items.length === 1) { const item = items[0]; tiles.push({ index: item.index, row: item.row, value: item.value, share: item.weight / weightTotal, x, y, width: w, height: h }); return; }
      let split = 1, leftWeight = items[0].weight, sum = leftWeight;
      for (let i = 1; i < items.length - 1; i++) {
        sum += items[i].weight;
        if (Math.abs(sum - weight / 2) < Math.abs(leftWeight - weight / 2)) { split = i + 1; leftWeight = sum; }
      }
      const ratio = leftWeight / weight;
      const rightWeight = items.slice(split).reduce((sum, item) => sum + item.weight, 0);
      if (w >= h) {
        const cut = w * ratio;
        partition(items.slice(0, split), x, y, cut, h, leftWeight);
        partition(items.slice(split), x + cut, y, w - cut, h, rightWeight);
      } else {
        const cut = h * ratio;
        partition(items.slice(0, split), x, y, w, cut, leftWeight);
        partition(items.slice(split), x, y + cut, w, h - cut, rightWeight);
      }
    }
    partition(weighted, 0, 0, width, height, weightTotal);
    return { tiles, unsized, total: positive.reduce((sum, row) => sum + row.value, 0), width, height };
  }

  function renderTreemap(host, spec) {
    if (!Array.isArray(spec.fields) || spec.fields.length !== 1) throw new Error('A treemap requires exactly one area field');
    const focused = host.contains(document.activeElement) ? document.activeElement.dataset?.point : undefined;
    host.__psdChartCleanup?.();
    const abort = new AbortController(), on = (target, name, callback) => target.addEventListener(name, callback, { signal: abort.signal });
    if (!document.querySelector('link[data-shared-charts]')) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/shared-charts.css'; link.dataset.sharedCharts = ''; document.head.append(link);
    }
    const data = model(spec), field = data.fields[0], cs = String(spec.locale || '').startsWith('cs');
    const t = (en, cz) => cs ? cz : en;
    const width = Math.max(200, host.clientWidth - 8);
    const height = finite(spec.height) && spec.height > 0 ? spec.height : width < 600 ? 440 : Math.max(380, Math.min(560, width * .52));
    const layout = treemapLayout(data.rows, { width, height, value: row => row.values[0] });
    const defaultFormat = new Intl.NumberFormat(spec.locale || 'en-GB', { notation: 'compact', maximumFractionDigits: 1 });
    const format = (value, row) => value === null ? (spec.missingLabel || t('Not reported', 'Neuvedeno')) : String(spec.format ? spec.format(value, row.raw) : field.format ? field.format(value, row.raw) : spec.valueFormat ? spec.valueFormat(value, row.raw) : defaultFormat.format(value));
    const tileFormat = (value, row) => spec.valueFormat && value !== null ? String(spec.valueFormat(value, row.raw)) : format(value, row);
    const treemapPalette = ['#a8b63f', '#171918', '#8b8d83', '#d2ccc1', '#f1ede3', '#242724'];
    const percent = value => new Intl.NumberFormat(spec.locale || 'en-GB', { style: 'percent', maximumFractionDigits: 1 }).format(value);
    const reasonText = reason => ({ missing: t('Missing value — cannot size a rectangle', 'Chybějící hodnota — nelze určit velikost obdélníku'), negative: t('Negative value — cannot size a rectangle', 'Záporná hodnota — nelze určit velikost obdélníku'), zero: t('Zero value — no rectangle area', 'Nulová hodnota — nulová plocha obdélníku') })[reason];
    const safeColor = (value, fallback) => /^(?:#[\da-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i.test(String(value || '')) ? value : fallback;
    const ink = color => {
      const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color);
      if (!match) return '#171918';
      const hex = match[1].length === 3 ? [...match[1]].map(char => char + char).join('') : match[1];
      const channels = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2] > .32 ? '#171918' : '#faf7ef';
    };
    const selected = row => row.raw.selected === true || spec.selectedLabel !== undefined && String(spec.selectedLabel) === row.label;
    const areaNote = spec.areaNote || (layout.unsized.length ? t('Area shows each positive value’s share of the positive total. Zero, negative and missing values cannot be sized and remain listed below.', 'Plocha odpovídá podílu kladné hodnoty na součtu kladných hodnot. Nulové, záporné a chybějící hodnoty nelze znázornit plochou; zůstávají vypsány níže.') : t('Rectangle area shows each value’s share of the positive total. Every value is also available to keyboard users and in the data table.', 'Plocha obdélníku odpovídá podílu hodnoty na součtu kladných hodnot. Všechny hodnoty jsou dostupné také z klávesnice a v datové tabulce.'));
    const chartLabel = spec.title || field.label || t('Treemap', 'Plošný přehled');
    const allPoints = [...layout.tiles, ...layout.unsized];
    const firstIndex = allPoints[0]?.index;
    host.classList.add('psd-shared-plot'); host.dataset.chartComponent = 'treemap'; host.__psdChartAccessor = data.accessor;
    host.removeAttribute('data-zoomable');
    host.innerHTML = `<div class="psd-treemap-caption"><span>${escape(spec.unit || field.label || '')}</span><span>${escape(t('Select a tile to investigate', 'Vyberte plochu pro podrobnosti'))}</span></div><div class="psd-treemap-frame" style="height:${height}px" role="group" aria-label="${escape(chartLabel)}">${layout.tiles.map(tile => {
      const row = tile.row, color = safeColor(spec.rowColor?.(row.raw, field) || row.raw.color, treemapPalette[tile.index % treemapPalette.length]);
      const compact = tile.width < 105 || tile.height < 75, tiny = tile.width < 54 || tile.height < 39;
      const description = `${row.label}. ${field.label || ''}: ${format(tile.value, row)}. ${percent(tile.share)} ${t('of the positive total', 'ze součtu kladných hodnot')}.${row.raw.detail ? ` ${row.raw.detail}` : ''}`;
      return `<button type="button" class="psd-treemap-tile${compact ? ' is-compact' : ''}${tiny ? ' is-tiny' : ''}" data-point="${tile.index}" data-treemap-area="${tile.share}" tabindex="${tile.index === firstIndex ? 0 : -1}" aria-label="${escape(description)}" aria-pressed="${selected(row)}" style="left:${tile.x / width * 100}%;top:${tile.y / height * 100}%;width:${tile.width / width * 100}%;height:${tile.height / height * 100}%;--treemap-color:${escape(color)};--treemap-ink:${ink(color)};--treemap-value-size:${Math.max(14,Math.min(26,(tile.width-26)/7.8))}px"><span class="psd-treemap-label">${escape(row.label)}</span><strong class="psd-treemap-value">${escape(tileFormat(tile.value, row))}</strong>${!compact && row.raw.detail ? `<span class="psd-treemap-detail">${escape(row.raw.detail)}</span>` : ''}<span class="psd-treemap-share">${escape(percent(tile.share))}</span></button>`;
    }).join('')}${!layout.tiles.length ? `<p class="psd-chart-empty">${escape(spec.emptyLabel || t('No positive values can be represented by area.', 'Žádnou kladnou hodnotu nelze znázornit plochou.'))}</p>` : ''}</div><p class="psd-treemap-note">${escape(areaNote)}</p>${layout.unsized.length ? `<div class="psd-treemap-unsized"><h4>${escape(spec.unsizedTitle || t('Values without an area', 'Hodnoty bez plošného zobrazení'))}</h4><ul>${layout.unsized.map(item => `<li><button type="button" data-point="${item.index}" tabindex="${item.index === firstIndex ? 0 : -1}" aria-pressed="${selected(item.row)}"><span><strong>${escape(item.row.label)}</strong><small>${escape(reasonText(item.reason))}</small></span><b>${escape(format(item.value, item.row))}</b></button></li>`).join('')}</ul></div>` : ''}<div class="psd-plot-tooltip psd-treemap-tooltip" role="status" aria-live="polite" hidden></div>`;
    const tooltip = host.querySelector('.psd-plot-tooltip');
    let pinned = null;
    function hide() { tooltip.hidden = true; spec.onInspect?.(null); }
    function show(hit, event) {
      const index = Number(hit.dataset.point), row = data.rows[index]; if (!row) return;
      const tile = layout.tiles.find(item => item.index === index), excluded = layout.unsized.find(item => item.index === index);
      tooltip.innerHTML = `<strong>${escape(row.label)}</strong><p>${escape(field.label || '')}: <b>${escape(format(row.values[0], row))}</b></p><p>${escape(tile ? `${percent(tile.share)} ${t('of the positive total', 'ze součtu kladných hodnot')}` : reasonText(excluded.reason))}</p>${row.raw.detail ? `<p>${escape(row.raw.detail)}</p>` : ''}`;
      tooltip.hidden = false;
      const box = host.getBoundingClientRect(), target = hit.getBoundingClientRect();
      const anchorX = finite(event?.clientX) && event.pointerType !== 'touch' ? event.clientX - box.left : target.left - box.left + target.width / 2;
      const anchorY = finite(event?.clientY) && event.pointerType !== 'touch' ? event.clientY - box.top : target.top - box.top;
      tooltip.style.left = `${Math.max(4, Math.min(box.width - tooltip.offsetWidth - 4, anchorX + 12))}px`;
      tooltip.style.top = `${Math.max(4, Math.min(box.height - tooltip.offsetHeight - 4, anchorY + 14))}px`;
      spec.onInspect?.(row.raw);
    }
    const hitFor = event => event.target.closest?.('[data-point]');
    function activate(hit, event) {
      const index = Number(hit.dataset.point);
      pinned = pinned === index ? null : index;
      if (pinned === null) hide(); else show(hit, event);
      for (const button of host.querySelectorAll('[data-point]')) button.setAttribute('aria-pressed', String(Number(button.dataset.point) === index));
      spec.onSelect?.(data.rows[index].raw);
    }
    on(host, 'pointermove', event => { const hit = hitFor(event); if (hit && pinned === null && event.pointerType !== 'touch') show(hit, event); });
    on(host, 'pointerleave', () => { if (pinned === null && !host.contains(document.activeElement)) hide(); });
    on(host, 'focusin', event => { const hit = hitFor(event); if (hit) show(hit); });
    on(host, 'focusout', event => { if (!host.contains(event.relatedTarget)) { pinned = null; hide(); } });
    on(host, 'click', event => { const hit = hitFor(event); if (hit) activate(hit, event); });
    on(document, 'pointerdown', event => { if (!host.contains(event.target)) { pinned = null; hide(); } });
    on(host, 'keydown', event => {
      if (event.key === 'Escape') { pinned = null; hide(); return; }
      const hit = hitFor(event); if (!hit) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(hit); return; }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const buttons = [...host.querySelectorAll('[data-point]')], index = buttons.indexOf(hit);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1)));
      hit.tabIndex = -1; buttons[next].tabIndex = 0; buttons[next].focus();
    });
    const resize = new ResizeObserver(() => { if (Math.abs(Math.max(200, host.clientWidth - 8) - width) > 1) renderTreemap(host, spec); });
    resize.observe(host);
    host.__psdChartCleanup = () => { abort.abort(); resize.disconnect(); };
    if (focused !== undefined) { const hit = host.querySelector(`[data-point="${focused}"]`); if (hit) { host.querySelector('[tabindex="0"]')?.setAttribute('tabindex', '-1'); hit.tabIndex = 0; hit.focus(); } }
    return { data, layout, accessor: data.accessor, destroy: () => host.__psdChartCleanup?.() };
  }

  // Schematic, directed relationships. Equal path widths deliberately encode no money values.
  function circuitLayout(spec) {
    const width=1120,height=720,nodeWidth=184,nodeHeight=100;
    const nodes=(spec.nodes||[]).map(n=>({...n,x:150+96*n.column,y:78+72*n.row}));
    const indexed=new Map(nodes.map(n=>[n.id,n]));
    if(indexed.size!==nodes.length||nodes.some(n=>!Number.isFinite(n.x)||!Number.isFinite(n.y)))throw new Error('Invalid circuit nodes');
    const edges=(spec.edges||[]).map(edge=>{
      const a=indexed.get(edge.from),b=indexed.get(edge.to);
      if(!a||!b)throw new Error('Unknown circuit endpoint');
      let p,c1,c2,q;
      const lane=edge.lane||1;
      if(a===b){p=[a.x-35,a.y-nodeHeight/2];q=[a.x+35,a.y-nodeHeight/2];c1=[a.x-110,a.y-190];c2=[a.x+110,a.y-190];}
      else if(Math.abs(b.x-a.x)>Math.abs(b.y-a.y)*1.3){
        const sign=Math.sign(b.x-a.x),sweep=lane*sign,bend=Math.max(45,Math.abs(b.x-a.x)*.3);
        p=[a.x+sign*nodeWidth/2,a.y+sweep*10];q=[b.x-sign*(nodeWidth/2+5),b.y+sweep*10];
        c1=[p[0]+sign*bend,p[1]+sweep*52];c2=[q[0]-sign*bend,q[1]+sweep*52];
      }else{
        const sign=Math.sign(b.y-a.y)||1,sweep=lane*sign,bend=Math.max(45,Math.abs(b.y-a.y)*.35);
        p=[a.x+sweep*24,a.y+sign*nodeHeight/2];q=[b.x+sweep*24,b.y-sign*(nodeHeight/2+5)];
        c1=[p[0]+sweep*40,p[1]+sign*bend];c2=[q[0]+sweep*40,q[1]-sign*bend];
      }
      const midpoint=[0,1].map(axis=>(p[axis]+3*c1[axis]+3*c2[axis]+q[axis])/8+(Number(edge.labelOffset?.[axis])||0));
      return {...edge,path:`M${p} C${c1} ${c2} ${q}`,midpoint};
    });
    return {width,height,nodeWidth,nodeHeight,nodes,edges};
  }
  function renderCircuit(host,spec){
    const focused=host.contains(document.activeElement)?document.activeElement.dataset?.circuitId:null;
    host.__psdChartCleanup?.();
    const layout=circuitLayout(spec),{width,height,nodeWidth,nodeHeight,nodes,edges}=layout;
    const abort=new AbortController(),on=(target,name,fn)=>target.addEventListener(name,fn,{signal:abort.signal});
    const columns=spec.tableColumns||[],accessor=Object.freeze({columns,rows:()=>spec.rows||[]});
    const uid='circuit-'+(++chartID);
    const color=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:'#a8b63f';
    host.classList.add('psd-circuit');host.dataset.chartComponent='circuit';host.__psdChartAccessor=accessor;
    const lines=text=>String(text||'').split('\n');
    const caption=value=>String(value||'').replace(/(.{1,26})(?:\s+|$)/g,'$1\n').trim();
    const text=(value,x,y,klass)=>lines(value).map((line,i)=>`<text x="${x}" y="${y+i*16}" class="${klass}">${escape(line)}</text>`).join('');
    host.innerHTML=`<div class="psd-circuit-scroll"><svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${escape(spec.title||'Economic relationships')}"><defs><pattern id="${uid}-grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="currentColor" opacity=".15"/></pattern>${edges.map((e,i)=>`<marker id="${uid}-${i}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L6,3 L0,6" fill="${color(e.color)}"/></marker>`).join('')}</defs><rect width="1120" height="720" fill="url(#${uid}-grid)"/><rect x="24" y="24" width="808" height="664" rx="18" class="psd-circuit-boundary"/>${text(spec.boundaryLabel||'',46,52,'psd-circuit-boundary-label')}${text(spec.outsideLabel||'',892,52,'psd-circuit-boundary-label')}<line x1="853" x2="853" y1="70" y2="672" class="psd-circuit-border"/>${edges.map((e,i)=>`<g class="psd-circuit-edge${e.active===false?' is-muted':''}${e.selected?' is-selected':''}" tabindex="0" role="button" aria-pressed="${Boolean(e.selected)}" aria-label="${escape(e.label)}" data-circuit-id="${escape(e.id)}" data-circuit-kind="edge" style="--circuit-color:${color(e.color)}"><path class="psd-circuit-hit" d="${e.path}"/><path class="psd-circuit-line" d="${e.path}" marker-end="url(#${uid}-${i})"/>${e.active!==false&&(e.major||e.selected)?[0,1].map(j=>`<circle r="2.2" class="psd-circuit-particle"><animateMotion path="${e.path}" dur="${5.5+i*.08}s" begin="${-j*2.75}s" repeatCount="indefinite"/></circle>`).join(''):''}<g class="psd-circuit-edge-label${e.active!==false&&(e.major||e.selected)?' is-shown':''}" transform="translate(${e.midpoint[0]},${e.midpoint[1]})"><rect x="${-Math.min(105,e.label.length*3.2+10)}" y="-11" width="${Math.min(210,e.label.length*6.4+20)}" height="22" rx="11"/><text text-anchor="middle" y="4">${escape(e.label)}</text></g></g>`).join('')}${nodes.map((n,i)=>`<g class="psd-circuit-node${n.active===false?' is-muted':''}${n.selected?' is-selected':''}${n.id==='world'?' is-external':''}" transform="translate(${n.x-nodeWidth/2},${n.y-nodeHeight/2})" tabindex="0" role="button" aria-pressed="${Boolean(n.selected)}" aria-label="${escape(n.label+'. '+(n.caption||''))}" data-circuit-id="${escape(n.id)}" data-circuit-kind="node"><rect width="${nodeWidth}" height="${nodeHeight}" rx="7"/><text x="16" y="22" class="psd-circuit-code">${escape(n.code||String(i+1).padStart(2,'0'))}</text><circle cx="${nodeWidth-18}" cy="19" r="3" class="psd-circuit-dot"/>${text(n.label,16,49,'psd-circuit-name')}${text(caption(n.caption),16,72,'psd-circuit-caption')}</g>`).join('')}</svg></div>`;
    const svg=host.querySelector('svg'),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let playing=spec.playing!==false,visible=true;
    const sync=()=>{const run=playing&&!reduced.matches&&!document.hidden&&visible;host.dataset.flowMotion=run?'playing':'paused';if(run)svg.unpauseAnimations?.();else svg.pauseAnimations?.();};
    const activate=target=>spec.onSelect?.(target.dataset.circuitKind,target.dataset.circuitId);
    on(host,'click',event=>{const target=event.target.closest?.('[data-circuit-id]');if(target)activate(target);});
    on(host,'keydown',event=>{
      if(event.key==='Escape'){spec.onClear?.();return;}
      const target=event.target.closest?.('[data-circuit-id]');if(!target)return;
      if(['Enter',' '].includes(event.key)){event.preventDefault();activate(target);return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      event.preventDefault();const all=[...host.querySelectorAll('[data-circuit-id]')],index=all.indexOf(target);
      const next=event.key==='Home'?0:event.key==='End'?all.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+all.length)%all.length;all[next].focus();
    });
    on(document,'visibilitychange',sync);on(reduced,'change',sync);
    const intersection=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;sync();}):null;intersection?.observe(host);sync();
    host.__psdChartCleanup=()=>{abort.abort();intersection?.disconnect();svg.pauseAnimations?.();};
    if(focused)host.querySelector(`[data-circuit-id="${focused}"]`)?.focus();
    return {accessor,layout,destroy:host.__psdChartCleanup,setPlaying(value){playing=Boolean(value);sync();}};
  }

  const api = Object.freeze({ render, renderRoutes, renderTreemap, treemapLayout, circuitLayout, model, domain, palette, globe, labelPositions, rangeFromPixels, moveRange, timeX, mixProjection, renderRange });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PSDPlot = api;
})(typeof window === 'undefined' ? globalThis : window);
