/* Charts consume one verified cloud release; drawing and export stay shared. */
(() => {
  'use strict';
  const root = document.getElementById('human-development-root');
  if (!root) return;
  const copy = {
    en: {kicker:'Human development / original sources',title:'Human development and artificial intelligence',intro:'Charts based on the original sources behind the Human Development Report 2025, updated where newer comparable observations exist. Every chart shows its actual period; the coverage ledger identifies original figures still awaiting recreation.',country:'Country',print:'Save report as PDF',coverageLink:'Coverage and missing data ↓',coverageTitle:'Coverage and missing data',coverageIntro:'A missing series is not zero. Historical findings, withdrawn studies and charts requiring a clearer definition remain listed separately.',allReports:'All reports',loading:'Loading the verified data release…',failed:'The verified report is not available yet. The charts will appear when the data release is published.',retry:'Try again',release:'Report release',generated:'Report generated',observed:'Latest observed period',sourcePeriod:'Latest source period',vintage:'Source edition',unknown:'Not supplied',ready:'Available',historical:'Historical source',withdrawn:'Withdrawn study',needs_definition:'Definition required',unavailable:'Unavailable',noCountry:'No observations are available for this country in this chart.',global:'Global series',method:'Method',denominator:'Denominator / coverage',source:'Sources',original:'Original report reference',sources:'Source files',gaps:'Unavailable sources',figures:'Original report figures',chart:'Chart',status:'Status',reason:'Coverage and method',printNote:'Choose “Save as PDF” in the print dialog. The report includes the selected country and the displayed source dates.',chapters:'Chapters',renderFailed:'This chart could not be displayed. Its release and source information remain below.',pending:'No verified chart release has been loaded.',noSources:'Source access remains unresolved.',showSources:'Source availability ledger',national:'Country coverage',data:'Data release'},
    cs: {kicker:'Lidský rozvoj / původní zdroje',title:'Lidský rozvoj a umělá inteligence',intro:'Grafy založené na původních zdrojích zprávy Human Development Report 2025, aktualizované tam, kde existují novější srovnatelné údaje. U každého grafu je uvedené skutečné období; přehled pokrytí označuje původní grafy čekající na reprodukci.',country:'Země',print:'Uložit report jako PDF',coverageLink:'Pokrytí a chybějící údaje ↓',coverageTitle:'Pokrytí a chybějící údaje',coverageIntro:'Chybějící řada není nula. Historická zjištění, stažené studie a grafy vyžadující přesnější definici zůstávají uvedené samostatně.',allReports:'Všechny reporty',loading:'Načítání ověřeného datového vydání…',failed:'Ověřený report zatím není dostupný. Grafy se zobrazí po zveřejnění datového vydání.',retry:'Zkusit znovu',release:'Vydání reportu',generated:'Report sestaven',observed:'Poslední období pozorování',sourcePeriod:'Poslední období zdroje',vintage:'Vydání zdroje',unknown:'Neuvedeno',ready:'Dostupné',historical:'Historický zdroj',withdrawn:'Stažená studie',needs_definition:'Je nutná přesnější definice',unavailable:'Nedostupné',noCountry:'Pro tuto zemi nejsou v grafu dostupná pozorování.',global:'Globální řada',method:'Metoda',denominator:'Základ / pokrytí',source:'Zdroje',original:'Odkaz do původní zprávy',sources:'Zdrojové soubory',gaps:'Nedostupné zdroje',figures:'Grafy původní zprávy',chart:'Graf',status:'Stav',reason:'Pokrytí a metoda',printNote:'V tiskovém dialogu zvolte „Uložit jako PDF“. Report obsahuje vybranou zemi a zobrazená období zdrojů.',chapters:'Kapitoly',renderFailed:'Graf se nepodařilo zobrazit. Informace o vydání a zdroji zůstávají uvedené níže.',pending:'Ověřené vydání grafů zatím nebylo načteno.',noSources:'Přístup ke zdroji zatím není vyřešený.',showSources:'Přehled dostupnosti zdrojů',national:'Pokrytí zemí',data:'Datové vydání'}
  };
  let payload, loading = false, failed = false, controllers = [], generation = 0;
  let country = new URLSearchParams(location.search).get('code') || 'CZE';
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'cs';
  const t = key => copy[lang()][key] || key;
  const local = value => value && typeof value === 'object' ? value[lang()] || value.en || value.cs || '' : String(value ?? '');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const node = id => document.getElementById(id);
  const globalCodes = new Set(['World', 'WLD', 'GLOBAL', 'OWID_WRL']);
  const applicable = row => row.country == null || globalCodes.has(row.country) || row.country === country;
  const number = value => value.toLocaleString(lang() === 'en' ? 'en-GB' : 'cs-CZ', {maximumFractionDigits: 6});
  function translateShell() {
    document.querySelectorAll('[data-hd-copy]').forEach(el => { el.textContent = t(el.dataset.hdCopy); });
    document.title = `${t('title')} — Public Spending Data`;
    node('hd-country').setAttribute('aria-label', t('country'));
    node('hd-chapter-nav').setAttribute('aria-label', t('chapters'));
  }
  const refLink = ref => `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.table || ref.url)}</a>`;
  const originalText = refs => (refs || []).map(ref => typeof ref === 'string' ? ref : [ref.figure || ref.id, ref.page != null ? `p. ${ref.page}` : null].filter(Boolean).join(' · ')).join('; ');
  function sourceLine(chart) {
    return `<p class="hd-source-line">${t('source')}: ${chart.source_refs.length ? chart.source_refs.map(refLink).join(' · ') : esc(t('noSources'))}</p>`;
  }
  function chartHTML(chart) {
    const slug = `human-development-${chart.id}`;
    const rows = chart.rows.filter(applicable);
    const plot = ['ready','historical'].includes(chart.status) && rows.some(row => chart.fields.some(field => Number.isFinite(row[field.key])));
    const selectedPeriods = rows.filter(row => chart.fields.some(field => Number.isFinite(row[field.key]))).map(row => row.period ?? row.year).filter(value => value != null).map(String).sort();
    const latest = selectedPeriods.at(-1) || t('unknown');
    const vintage = [...new Set(chart.source_refs.map(ref => ref.vintage))].join(' · ') || t('unknown');
    return `<figure class="hd-figure" id="${esc(slug)}" data-hd-chart="${esc(chart.id)}"><span class="hd-status-badge hd-status-${chart.status}">${t(chart.status)}</span><h3>${esc(local(chart.title))}</h3><p class="hd-unit">${esc(chart.unit)}</p><p class="hd-freshness">${t('observed')}: <strong>${esc(latest)}</strong> · ${t('sourcePeriod')}: ${esc(chart.latest_period ?? t('unknown'))} · ${t('vintage')}: ${esc(vintage)}</p>${plot ? '<div class="hd-plot"></div>' : `<p class="hd-gap-note">${esc(['ready','historical'].includes(chart.status) ? t('noCountry') : local(chart.method) || t(chart.status))}</p>`}${sourceLine(chart)}<p class="hd-method"><strong>${t('method')}:</strong> ${esc(local(chart.method))}<br><strong>${t('denominator')}:</strong> ${esc(local(chart.denominator))}</p>${chart.original_refs?.length ? `<p class="hd-original">${t('original')}: ${esc(originalText(chart.original_refs))}</p>` : ''}</figure>`;
  }
  function coverageHTML() {
    const c = payload.coverage;
    const count = value => Array.isArray(value) ? value.length : Number.isFinite(value) ? value : t('unknown');
    const gaps = payload.charts.filter(chart => chart.status !== 'ready' || !chart.rows.filter(applicable).some(row => chart.fields.some(field => Number.isFinite(row[field.key]))));
    return `<div class="hd-coverage-counts"><div><strong>${count(c.source_count)}</strong>${t('sources')}</div><div><strong>${count(c.unavailable_sources)}</strong>${t('gaps')}</div><div><strong>${count(c.original_figures)}</strong>${t('figures')}</div></div><div class="hd-table-scroll"><table><thead><tr><th>${t('chart')}</th><th>${t('status')}</th><th>${t('reason')}</th></tr></thead><tbody>${gaps.map(chart => `<tr><th scope="row"><a href="#human-development-${esc(chart.id)}">${esc(local(chart.title))}</a></th><td>${chart.status === 'ready' ? t('noCountry') : t(chart.status)}</td><td>${esc(local(chart.method))}<br>${esc(local(chart.denominator))}</td></tr>`).join('')}</tbody></table></div>${c.unavailable_sources.length ? `<details><summary>${t('showSources')}</summary><ul>${c.unavailable_sources.map(source => `<li>${esc(typeof source === 'string' ? source : local(source.name || source.source_id || source.id))}${source.reason ? `: ${esc(local(source.reason))}` : ''}</li>`).join('')}</ul></details>` : ''}<p class="hd-print-note">${t('printNote')}</p>`;
  }
  async function drawCharts(currentGeneration) {
    try {
      await window.PSDPlotReady;
      if (generation !== currentGeneration) return;
      for (const chart of payload.charts) {
        const figure = document.getElementById(`human-development-${chart.id}`), host = figure?.querySelector('.hd-plot');
        if (!host) continue;
        const rows = chart.rows.filter(applicable).map(row => ({...row, label: local(row.label ?? row.period ?? row.year)}));
        const fields = chart.fields.map(field => ({...field, label:local(field.label), format:number}));
        const controller = window.PSDPlot.render(host, {type:chart.chart_type, rows, fields, title:local(chart.title), unit:chart.unit, labelTitle:t('observed'), locale:lang() === 'en' ? 'en-GB' : 'cs-CZ'});
        controllers.push(controller);
        const first = chart.source_refs[0];
        window.PSDChart.register({el:figure, slug:`human-development-${chart.id}`, title:local(chart.title), accessor:controller.accessor, exports:['csv','png'], embeddable:false,
          source:{name:t('source'),url:first?.url,table:chart.source_refs.map(ref => `${ref.table} (${ref.vintage})`).join('; '),edition:chart.source_refs.map(ref => ref.release_id || ref.vintage).join('; '),extracted:payload.generated_at,vintage:chart.status === 'historical' ? t('historical') : 'outturn',definition:`${local(chart.method)}\n${t('denominator')}: ${local(chart.denominator)}`,caveat:originalText(chart.original_refs)}});
      }
    } catch {
      if (generation !== currentGeneration) return;
      root.querySelectorAll('.hd-plot').forEach(host => { if (!host.dataset.chartComponent) host.textContent = t('renderFailed'); });
    }
  }
  function render() {
    translateShell();
    if (!payload) {
      node('hd-status').textContent = loading ? t('loading') : failed ? t('failed') : t('pending');
      if (failed) { const retry = document.createElement('button'); retry.type='button'; retry.className='hd-retry'; retry.textContent=t('retry'); retry.addEventListener('click', load); node('hd-status').append(' ', retry); }
      return;
    }
    controllers.forEach(controller => controller?.destroy()); controllers=[];
    const thisGeneration = ++generation;
    if (!payload.geographies.some(g => g.code === country)) country = payload.geographies[0]?.code || 'World';
    node('hd-country').innerHTML = payload.geographies.map(g => `<option value="${esc(g.code)}"${g.code === country ? ' selected' : ''}>${esc(local(g.name))}</option>`).join('');
    node('hd-country').disabled = !payload.geographies.length;
    node('hd-print').disabled = false;
    node('hd-status').textContent = '';
    node('hd-release').textContent = `${t('release')}: ${payload.release_id} · ${t('generated')}: ${payload.generated_at}`;
    const downloadLabels = lang() === 'en' ? {core_csv:'All core observations (CSV)',annex_csv:'Full statistical annex (CSV)',chart_csv:'Chart observations (CSV)'} : {core_csv:'Všechna základní pozorování (CSV)',annex_csv:'Úplná statistická příloha (CSV)',chart_csv:'Pozorování grafů (CSV)'};
    node('hd-downloads').innerHTML = `<a href="/api/v1/human-development/reports" target="_blank" rel="noopener">${lang() === 'en' ? 'Report data (JSON)' : 'Data reportu (JSON)'}</a>` + Object.entries(downloadLabels).filter(([key]) => payload.download_access?.[key] === 'verified_anonymous_head_200' && payload.downloads?.[key]?.startsWith(`https://storage.googleapis.com/czbudget-janrezab-public-snapshots/static-assets/human-development/releases/${payload.release_id}/`)).map(([key,label]) => ` · <a href="${esc(payload.downloads[key])}" target="_blank" rel="noopener">${label}</a>`).join('');
    node('hd-chapter-nav').innerHTML = payload.chapters.map(chapter => `<a href="#hd-chapter-${esc(chapter.id)}">${esc(local(chapter.title))}</a>`).join('');
    node('hd-chapters').innerHTML = payload.chapters.map(chapter => `<section class="hd-section" id="hd-chapter-${esc(chapter.id)}"><h2>${esc(local(chapter.title))}</h2>${payload.charts.filter(chart => chart.chapter === chapter.id).map(chartHTML).join('')}</section>`).join('');
    node('hd-coverage-content').innerHTML = coverageHTML();
    drawCharts(thisGeneration);
  }
  async function load() {
    if (loading) return;
    loading=true; failed=false; render();
    try {
      const response = await fetch('/api/v1/human-development/reports', {signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error('release unavailable');
      const next = await response.json();
      if (next.schema_version !== '1.0.0' || !Array.isArray(next.charts) || !Array.isArray(next.chapters)) throw new Error('invalid release');
      payload = next;
    } catch { failed=true; }
    finally { loading=false; render(); }
  }
  node('hd-country').addEventListener('change', event => {
    country=event.target.value;
    const url=new URL(location.href);url.searchParams.set('code',country);history.replaceState({},'',url);
    render(); node('hd-country').focus();
  });
  node('hd-print').addEventListener('click', () => window.print());
  new MutationObserver(() => render()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  load();
})();
