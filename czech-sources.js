(() => {
  const en = document.documentElement.lang === 'en';
  const t = (cs, english) => en ? english : cs;
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const set = (id, cs, english) => { document.getElementById(id).textContent = t(cs, english); };
  const fmt = n => Number(n).toLocaleString(en ? 'en-GB' : 'cs-CZ');
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const link = (text, url) => { const a = el('a', text); a.href = url; return a; };
  const language = en ? 'en' : 'cs';
  // Reviewed coverage evidence, not a new data export or live warehouse query.
  // BQ metadata: budget_detail, checked 2026-09-27; inventory run below is 2026-09-20.
  const audit = { date: '2026-09-27', hlidacValid: 9165077, inventoryCities: 100, inventoryMatches: 875563,
    inventorySamples: 2455, matchRows: 0, inventoryRun: 'a21640de-86b0-4ad7-8330-8472b7d99074',
    plzenHeld: 2000, plzenSourceAtCapture: 48558, plzenCaptured: '2026-09-01' };
  const inventory = new Map([
    ['00064581', ['Praha', 115429]], ['44992785', ['Brno', 85305]], ['00845451', ['Ostrava', 63520]],
    ['00075370', ['Plzeň', 48781]], ['00284891', ['Hodonín', 18075]], ['00283924', ['Zlín', 16896]],
    ['00300535', ['Opava', 16730]], ['00299308', ['Olomouc', 14969]], ['00286010', ['Jihlava', 14746]], ['00274046', ['Pardubice', 13676]]
  ]);
  document.title = t('České zdroje a pokrytí', 'Czech sources and coverage') + ' — Public Spending Data';
  set('source-eyebrow', 'Public Spending Data · Česko / CZE', 'Public Spending Data · Czechia / CZE');
  set('source-title', 'Co víme o českých městech', 'What we know about Czech places');
  set('source-intro', 'Od rozpočtů a smluv k životu obyvatel. Kde máme dost dat pro skutečně podrobný pohled — a kde teprve známe dostupný zdroj.', 'From budgets and contracts to residents’ lives. Find places with enough evidence for a detailed view, and distinguish them from sources still awaiting ingestion.');
  for (const text of [t('Dostupné u zdroje', 'Available at source'), t('Uchované a zpracované', 'Held and processed'), t('Ověřeno v databázi', 'Verified in database')]) document.getElementById('source-legend').append(el('span', text));
  set('coverage-eyebrow', '01 / Datová stopa', '01 / Data footprint');
  set('coverage-title', 'Dostupné u zdroje. Ověřené u nás.', 'Available at source. Verified with us.');
  set('coverage-date', 'Kontrola datové stopy: ' + audit.date, 'Footprint review: ' + audit.date);
  set('coverage-definition', 'Počty ukazatelů, pozorování, smluv a účetních řádků měří různé věci. Nesčítáme je ani z nich nevytváříme společné procento pokrytí. Uchovaný snapshot není automaticky načtená databáze.', 'Indicators, observations, contracts and accounting rows measure different things. They are not added or converted into a common coverage percentage. A held snapshot is not automatically a loaded database.');
  set('coverage-caption', 'České zdroje podle země, dostupnosti a skutečně ověřeného uložení', 'Czech sources by country, availability and verified storage');
  for (const [id, cs, english] of [['head-source','Zdroj','Source'],['head-country','Země','Country'],['head-available','Dostupné u zdroje','Available at source'],['head-held','U nás / zpracované','Held / processed'],['head-database','Databáze / BigQuery','Database / BigQuery']]) set(id, cs, english);
  set('coverage-other', 'Tyto vrstvy pokrývají Česko. Pokrytí jiných zemí jimi není doloženo; není vykázáno jako nula. „Neověřeno“ znamená chybějící reconciliaci, nikoli chybějící data.', 'These layers cover Czechia. Other-country coverage is outside their documented scope, rather than reported as zero. “Not reconciled” means missing verification, not missing data.');
  set('city-eyebrow', '02 / Výběr míst', '02 / Choose a place');
  set('city-title', 'Kde začít s podrobným pohledem', 'Where a deeper view can begin');
  set('city-definition', 'Řadíme podle počtu uchovaných fakturačních řádků Cityvizoru za všechna dostupná období. Jde o objem detailu, nikoli úplnost výdajů. Obec, městská část, kraj a příspěvková organizace zůstávají oddělené. Územní propojení PAQ vyžaduje odpovídající rozsah.', 'Ranked by held Cityvizor invoice-view rows across all available periods. This measures detail volume, not spending completeness. Cities, districts, regions and contributory organizations keep their own scope. PAQ links require matching territories.');
  set('city-search-label', 'Název nebo IČO', 'Name or organization ID');
  set('city-kind-label', 'Typ profilu', 'Profile type');
  set('city-fresh-label', 'Fakturační období', 'Invoice period');
  const kindSelect = document.getElementById('city-kind');
  for (const [value, cs, english] of [['municipality','Města a městské části','Cities and districts'],['region','Kraje','Regions'],['pbo','Příspěvkové organizace','Contributory organizations'],['all','Všechny profily','All profiles']]) { const o = el('option', t(cs, english)); o.value = value; kindSelect.append(o); }
  const freshSelect = document.getElementById('city-fresh');
  for (const [value, cs, english] of [['all','Všechna období','All periods'],['2026','Řádky za rok 2026','Rows in 2026'],['older','Pouze starší nebo žádné','Older or no invoice rows']]) { const o = el('option', t(cs, english)); o.value = value; freshSelect.append(o); }
  for (const [id, cs, english] of [['city-head-name','Místo / organizace','Place / organization'],['city-head-paq','PAQ / území','PAQ / territory'],['city-head-hlidac','Hlídač / smlouvy','Hlídač / contracts'],['city-head-records','Fakturační řádky','Invoice-view rows'],['city-head-years','Poslední období','Latest period']]) set(id, cs, english);
  set('city-caption', 'Objem uchovaného detailu; vrstvy ani nadřazené a podřízené profily se nesčítají', 'Held detail volume; layers and parent/child profiles are not added');
  set('city-more', 'Zobrazit dalších 30', 'Show 30 more');
  set('city-download-note', 'Datum stažení není datum platnosti. Rok 2026 může být neúplný. Chybějící propojení nebo faktury neznamenají nulové výdaje. Údaj Hlídače označený „Inventář“ je dostupnost u zdroje, nikoli načtené smlouvy.', 'Retrieval date is not source validity. 2026 can be partial. Missing links or invoices do not mean zero spending. Hlídač counts labelled “Inventory” describe source availability, not loaded contracts.');
  set('research-eyebrow', '03 / Pro výzkumníky', '03 / For researchers');
  set('research-title', 'Integrita a původ dat', 'Integrity and provenance');
  set('research-intro', 'Čitelná kontrolní stopa: rozsah, období, ověření a známé mezery. Tato stránka neposkytuje exporty zdrojových řádků ani stahování archivů.', 'Read-only evidence: scope, periods, verification and known gaps. This page provides no source-row exports or archive downloads.');
  set('datasets-title', 'Další české vrstvy', 'More Czech layers');
  set('datasets-definition', 'Další kontext pro propojené pohledy. Každá vrstva zachovává vlastní finanční fázi a metodiku.', 'Additional context for connected views. Each layer keeps its own financial stage and methodology.');
  set('coverage-back', 'Pokrytí a metodika', 'Coverage and methodology');
  function card(name, number, label, status, note, fraction) {
    const article = el('article', undefined, 'coverage-card'); article.append(el('h3', name), el('strong', fmt(number), 'coverage-number'), el('span', label, 'coverage-label'));
    if (fraction) { const m = document.createElement('meter'); m.min = 0; m.max = fraction[1]; m.value = fraction[0]; m.setAttribute('aria-label', status); article.append(m); }
    article.append(el('p', status, 'coverage-state'), el('p', note, 'czech-note')); document.getElementById('source-overview').append(article);
  }
  function coverageRow(name, available, held, database) {
    const row = el('tr'); row.append(el('th', name), el('td', 'CZE · ' + t('Česko', 'Czechia')));
    row.firstChild.scope = 'row';
    for (const [value, note] of [available, held, database]) { const cell = el('td'); cell.append(el('strong', value), el('small', note)); row.append(cell); }
    document.getElementById('coverage-rows').append(row);
  }
  function evidence(title, paragraphs, refs = []) {
    const d = el('details'); d.append(el('summary', title)); for (const text of paragraphs) d.append(el('p', text));
    for (const [label, value] of refs) { const p = el('p', label + ': '); p.append(el('code', value)); d.append(p); }
    document.getElementById('research-evidence').append(d);
  }
  function sourceLink(name, href) { const p = el('p'); p.append(link(name, href)); return p; }
  card('Hlídač státu', audit.hlidacValid, t('platných smluv u zdroje · celé Česko', 'valid contracts at source · Czechia-wide'), t('100 měst v inventáři · 0 řádků v tabulce smluv', '100 inventoried cities · 0 rows in contract table'), t('Zdroj prověřen 27. 9. 2026. Inventář z 20. 9.; smlouvy nejsou účetní výdaje.', 'Source checked 27 Sep 2026. Inventory from 20 Sep; contracts are not accounting expenditure.'));
  coverageRow('Hlídač státu', [fmt(audit.hlidacValid), t('Platné smlouvy, celý registr, kontrola 27. 9. 2026.', 'Valid contracts, whole register, checked 27 Sep 2026.')], [fmt(audit.plzenHeld) + ' · Plzeň', t('Kompaktní snapshot z 1. 9.: 2 000 z 48 558 výsledků daného dotazu. Nejde o celostátní import.', 'Compact 1 Sep snapshot: 2,000 of 48,558 query matches. This is not a nationwide import.')], ['100 / 0', t('100 obcí v inventáři; 0 řádků v hlidac_municipality_contract_matches. Inventář není datová tabulka smluv.', '100 municipalities in inventory; 0 rows in hlidac_municipality_contract_matches. Inventory is not a contract-record table.')]);
  evidence('Hlídač státu · ' + t('dostupnost versus načtení', 'availability versus ingestion'), [t('Inventář z 20. 9. 2026: 100 různých obecních IČO, součet 875 563 zdrojových shod a 2 455 záznamů označených jako vzorkované. Shody se mohou mezi obcemi překrývat; součet není počet unikátních smluv.', '20 Sep 2026 inventory: 100 distinct municipal IDs, 875,563 source-query matches summed across them, and 2,455 records described as sampled. Matches may overlap between municipalities; the sum is not a unique-contract count.'), t('Dne 27. 9. ověřeno: tabulka shod má 0 řádků. Vzorkovací údaj v inventáři nedokládá uložení těchto záznamů do tabulky smluv. Samostatný veřejný snapshot Plzně má 2 000 smluv.', 'Checked 27 Sep: the matches table has 0 rows. The inventory’s sampling count does not prove those records were stored in the contract table. The separate public Plzeň snapshot holds 2,000 contracts.')], [['Inventory table','czbudget-janrezab.budget_detail.hlidac_municipality_contract_inventory'],['Contract table','czbudget-janrezab.budget_detail.hlidac_municipality_contract_matches'],['Inventory run',audit.inventoryRun]]);
  document.getElementById('research-evidence').lastChild.append(sourceLink(t('Původní statistika smluv', 'Original contract statistics'), 'https://www.hlidacstatu.cz/report/7'));
  let city, paq, limit = 30;
  const regionIds = new Set(['70889546','70891168','70891095','60609460']);
  const kind = p => p.type === 'pbo' ? 'pbo' : regionIds.has(p.ico) || /kraj$/i.test(p.name.trim()) ? 'region' : 'municipality';
  const paymentCount = p => p.type === 'pbo' ? p.pbo_payment_rows : p.years.reduce((n, y) => n + y.records.payments, 0);
  const lastYear = p => Math.max(0, ...p.years.filter(y => y.records.payments > 0).map(y => y.year));
  const scopeLabel = p => kind(p) === 'pbo' ? t('Příspěvková organizace', 'Contributory organization') : kind(p) === 'region' ? t('Kraj', 'Region') : /praha\s*\d|praha-|praha -|ostrava -|brno -/i.test(p.name) ? t('Městská část / obvod', 'City district') : t('Zdrojový profil samosprávy', 'Source self-government profile');
  const paqRegion = p => {
    if (!paq || !p.ico || kind(p) === 'pbo') return null;
    return Object.values(paq.regions).find(r => r.ico === p.ico && r.level === 'obec' && (norm(r.name) === norm(p.name) || (p.ico === '00064581' && norm(r.name) === 'praha' && p.name === 'Hlavní město Praha'))) || null;
  };
  function render() {
    if (!city) return;
    const query = norm(document.getElementById('city-search').value);
    const rows = city.profiles.filter(p => (kindSelect.value === 'all' || kind(p) === kindSelect.value) && norm(p.name + ' ' + (p.ico || '')).includes(query) && (freshSelect.value === 'all' || (freshSelect.value === '2026' ? lastYear(p) === 2026 : lastYear(p) !== 2026))).sort((a,b) => paymentCount(b) - paymentCount(a) || a.name.localeCompare(b.name));
    set('city-result-count', 'Nalezeno: ' + fmt(rows.length) + ' profilů', fmt(rows.length) + ' matching profiles');
    const body = document.getElementById('city-rows'); body.replaceChildren();
    for (const p of rows.slice(0, limit)) {
      const row = el('tr'), name = el('td'), context = el('td'), contracts = el('td'), count = el('td'), years = el('td');
      name.append(link(p.name, '/cityvizor/?profile=' + encodeURIComponent(p.key) + '&lang=' + language), el('small', scopeLabel(p) + ' · ' + (p.ico || t('IČO chybí', 'ID missing'))));
      const territory = paqRegion(p);
      context.append(territory ? link(t('Obecní kontext', 'Municipal context'), '/paq.html?level=' + territory.level + '&code=' + encodeURIComponent(territory.code) + '&lang=' + language) : el('span', paq ? t('Propojení neověřeno', 'Join not verified') : t('PAQ nelze ověřit', 'PAQ unavailable'), 'coverage-status'));
      if (!territory) context.append(el('small', t('Bez přiřazení údajů vyššího území.', 'No higher-territory values assigned.')));
      const footprint = inventory.get(p.ico);
      if (p.ico === '00075370') contracts.append(el('strong', fmt(audit.plzenHeld)), el('small', t('Uchované smlouvy · snapshot 1. 9.', 'Held contracts · 1 Sep snapshot')));
      else if (footprint) contracts.append(el('strong', fmt(footprint[1])), el('small', t('Inventář zdroje · ' + footprint[0] + ' · 20. 9.; nikoli načtené smlouvy.', 'Source inventory · ' + footprint[0] + ' · 20 Sep; not loaded contracts.')));
      else contracts.append(el('span', t('Neověřeno pro tento profil', 'Not verified for this profile'), 'coverage-status'));
      count.append(el('strong', fmt(paymentCount(p))), el('small', t('Rozúčtování, ne unikátní faktury.', 'Allocations, not unique invoices.')));
      const year = lastYear(p), latest = p.years.find(y => y.year === year);
      years.append(el('strong', year ? String(year) : t('Bez řádků', 'No rows')), el('small', latest?.source_validity ? t('Platnost: ', 'Validity: ') + latest.source_validity.slice(0,10) : t('Datum platnosti neuvedeno', 'Validity date not supplied')));
      row.append(name, context, contracts, count, years); body.append(row);
    }
    document.getElementById('city-more').hidden = limit >= rows.length;
  }
  function priority(title, value, unit, note, url) { const c = el('article', undefined, 'priority-card'); c.append(el('p', t('Kandidát pro propojený pohled', 'Candidate for a connected view'), 'eyebrow'), el('h3')); c.lastChild.append(link(title, url)); c.append(el('strong', fmt(value)), el('p', unit), el('p', note, 'czech-note')); document.getElementById('priority-cards').append(c); }
  priority('Plzeň', audit.plzenHeld, t('uchovaných smluv', 'held contracts'), t('PAQ + rozpočty + projekty. V inventáři zdroje 48 781 smluv; úplný import není ověřen.', 'PAQ + budgets + projects. Source inventory: 48,781 contracts; complete ingestion is not verified.'), '/deep-dives/plzen-contracts/?lang=' + language);
  for (const input of [document.getElementById('city-search'), kindSelect, freshSelect]) input.addEventListener('input', () => { limit = 30; render(); });
  document.getElementById('city-more').addEventListener('click', () => { limit += 30; render(); });
  document.getElementById('city-search').value = new URLSearchParams(location.search).get('ico') || '';
  async function read(path) { const r = await fetch(path); if (!r.ok) throw new Error(String(r.status)); return r.json(); }
  document.getElementById('city-result-count').append(el('span', t('Načítám ověřené pokrytí…', 'Loading verified coverage…'), 'source-loading'));
  read('/data/cityvizor-catalogue.v1.json').then(d => {
    if (!d.complete || !Array.isArray(d.profiles)) throw new Error('Incomplete catalogue'); city = d;
    card('Cityvizor', d.profiles_with_payment_rows, t('profilů s fakturačními řádky z ' + fmt(d.profile_count), 'profiles with invoice-view rows out of ' + fmt(d.profile_count)), t('Uchováno ' + fmt(d.profile_count) + ' zdrojových profilů', fmt(d.profile_count) + ' source profiles held'), t('Snapshot ', 'Snapshot ') + d.snapshot_completed_at.slice(0,10) + t(' · dobrovolné a nestejně aktuální pokrytí.', ' · voluntary coverage, uneven freshness.'), [d.profiles_with_payment_rows,d.profile_count]);
    coverageRow('Cityvizor', [fmt(d.profile_count) + ' ' + t('profilů', 'profiles'), t('Veřejný adresář národní a pražské instance ve snapshotu 9. 9.; nikoli všechna česká města.', 'Public national/Prague directories in the 9 Sep snapshot; not all Czech cities.')], [fmt(d.preferred_payment_view_rows) + ' ' + t('řádků', 'rows'), t('Fakturační pohled, ', 'Invoice view, ') + fmt(d.profiles_with_payment_rows) + t(' profilů; účetnictví a plány jsou samostatné překrývající se vrstvy.', ' profiles; accounting and plans are separate overlapping layers.')], [t('Cloudový snapshot', 'Cloud snapshot'), t('Normalizovaná zpracovaná verze je publikována. BigQuery pro tuto vrstvu není reconciliováno.', 'Normalized processed release is published. BigQuery storage for this layer is not reconciled.')]);
    evidence('Cityvizor · ' + t('kontroly a omezení', 'controls and limitations'), [fmt(d.verification.control_count) + t(' kontrol; ', ' controls; ') + fmt(d.verification.source_control_exceptions.length) + t(' zdrojových kontrolních výjimek. Uchovaný snapshot je ověřen proti zdrojovým kontrolám, nikoli proti všem účetním knihám.', ' source-control exceptions. The held snapshot is verified against source controls, not all underlying ledgers.'), t('Uherský Brod 2021: vadný CSV text obnoven z původního JSON API se shodnými částkami. Fakturační řádek není unikátní faktura ani potvrzení bankovní úhrady. Nadřazené a podřízené profily se mohou překrývat.', 'Uherský Brod 2021: malformed CSV text recovered through the native JSON API with matching amounts. An invoice-view row is not a unique invoice or bank-settlement proof. Parent and child profiles can overlap.'), t('Brno–Medlánky používá IČO města Brna; území se nesmějí zaměnit. Neznámé datum platnosti zůstává neznámé.', 'Brno–Medlánky uses Brno’s city ID; these territories must not be conflated. Unknown validity dates remain unknown.')], [['Release','20260909-2294793cff54'],['Verification SHA-256','5cf6590fdbeb1529461a35bb9b3c0d055e62f31276835d6efb093203a8d12ebe']]);
    for (const ico of ['00064581','00294900']) { const p = d.profiles.find(p => p.ico === ico); if (p) priority(p.name, paymentCount(p), t('uchovaných fakturačních rozúčtování', 'held invoice allocations'), t('Poslední fakturační rok ', 'Latest invoice year ') + lastYear(p) + t('. Před porovnáním ověřte období a rozsah organizací.', '. Verify reporting period and organizational scope before comparing.'), '/cityvizor/?profile=' + encodeURIComponent(p.key) + '&lang=' + language); }
    render();
  }).catch(() => { const p = el('p', t('Cityvizor se nepodařilo ověřit. Chybějící kontrolu nevykazujeme jako nulu.', 'Cityvizor verification is unavailable. Missing verification is not reported as zero.'), 'load-error'); document.getElementById('city-result-count').replaceChildren(p); document.getElementById('source-overview').append(p.cloneNode(true)); });
  Promise.all([read('/data/paq/index.json'), read('/data/paq/coverage-audit.json')]).then(([d, control]) => {
    if (!d.regions || !Number.isFinite(d.variables) || !Number.isFinite(control.expected) || !Array.isArray(control.missing)) throw new Error('Invalid PAQ catalogue'); paq = d;
    const complete = control.received === control.expected && control.missing.length === 0;
    card('PAQ Research', d.variables, t('ukazatelů ve veřejném katalogu', 'indicators in the public catalogue'), fmt(control.received) + ' / ' + fmt(control.expected) + t(' kombinací zachyceno', ' combinations captured'), t('Snapshot ', 'Snapshot ') + d.completed_at.slice(0,10) + t(' · úplnost katalogu, ne úplnost každé hodnoty.', ' · catalogue completeness, not completeness of every value.'), [control.received,control.expected]);
    coverageRow('PAQ / DataPAQ', [fmt(d.variables) + ' ' + t('ukazatelů', 'indicators'), fmt(d.region_counts.obec) + t(' obecních území; ', ' municipal territories; ') + fmt(d.region_counts.orp) + ' ORP · ' + fmt(d.region_counts.okres) + t(' okresů · ', ' districts · ') + fmt(d.region_counts.kraj) + t(' krajů. Veřejný katalog ve snapshotu.', ' regions. Public catalogue at snapshot time.')], [fmt(d.observations) + ' ' + t('buněk', 'cells'), fmt(d.non_null_observations) + t(' neprázdných. ', ' non-null. ') + fmt(control.received) + ' / ' + fmt(control.expected) + t(' kombinací; ', ' combinations; ') + (complete ? t('katalog úplný.', 'catalogue complete.') : t('katalog částečný.', 'catalogue partial.'))], [t('Neověřeno v BigQuery', 'Not reconciled in BigQuery'), t('Zpracovaný cloudový snapshot je dostupný. V 90 tabulkách budget_detail nebyla nalezena tabulka pojmenovaná pro PAQ; to nedokládá nulový obsah jiných tabulek.', 'Processed cloud snapshot is available. No PAQ-named table was found among 90 budget_detail tables; this does not prove zero content in other tables.')]);
    evidence('PAQ Research · ' + t('území a metodika', 'territories and methods'), [t('Úplný veřejný katalog ve snapshotu 9. 9. 2026; jednotlivé hodnoty mohou chybět. Školní roky, kalendářní roky, modely a predikce zachovávají původní význam. Vyšší územní celky se nepřiřazují obcím.', 'Complete public catalogue in the 9 Sep 2026 snapshot; individual values can be missing. School years, calendar years, models and projections retain their source meaning. Higher-level territories are not assigned to municipalities.'), t('Národní panelové grafy jsou agregované průzkumy, ne obecní odhady ani mikrodata. Databázové načtení je třeba doložit samostatnou reconciliací.', 'National panel charts are aggregated surveys, not municipal estimates or microdata. Database ingestion requires separate reconciliation.'), 'PAQ Research / DataPAQ · ' + d.license + t(' · původní zdroje a jejich podmínky zůstávají zachovány.', ' · original sources and their terms remain attached.')], [['Raw manifest SHA-256',d.raw_manifest_sha256],['Catalogue capture',d.completed_at]]);
    document.getElementById('research-evidence').lastChild.append(sourceLink(t('Metodika a nástroje PAQ', 'PAQ methods and tools'), 'https://www.paqresearch.cz/datove-nastroje/'));
    render();
  }).catch(() => { const p = el('p', t('PAQ se nepodařilo ověřit. Pokrytí zůstává neznámé.', 'PAQ verification is unavailable. Coverage remains unknown.'), 'load-error'); document.getElementById('source-overview').append(p); render(); });
  const datasets=[

    ['Kontrola obecních součtů','Municipal reconciliation','czech-municipal-reconciliation.v1.json','Kontrola všech obcí vůči čerstvému exportu MONITOR včetně zdrojových rozdílů.','All municipalities checked against a fresh MONITOR export, including source discrepancies.'],
    ['Měsíční rozpočet MF','MF monthly budget','czech-mf-monthly-2026.v1.json','Kumulované plnění roku 2026; budoucí měsíce zůstávají prázdné.','Cumulative 2026 execution; future months remain missing.'],
    ['Zaměstnanci státu','State employees','czech-mf-employment-2025.v1.json','Skutečnost 2025 a původní rozpočtové fáze; rozsah státem regulovaných platů.','2025 actuals and native budget stages; state-regulated-pay perimeter.'],
    ['Rozpočty MF','MF budgets','czech-mf-budget-detail.v1.json','Skutečnost, schválený rozpočet a návrh odděleně; původní přílohy.','Actuals, approved budget and proposal kept separate; native annexes.'],
    ['Účetní závěrky ČEZ 2025','ČEZ 2025 financial statements','cez-issuer-2025.v1.json','Skupinové a individuální účetní závěrky odděleně; původní ESEF kontexty.','Group and individual financial statements kept separate; native ESEF contexts.'],
    ['Historie okruhu konsolidace','Consolidation perimeter history','czech-mf-perimeter-history.v1.json','Skutečný seznam 2020, deklarované registry 2016–2023 a změny odděleně; mezery přiznány.','Actual 2020 list, declared 2016–2023 registers and changes kept separate; gaps disclosed.'],
    ['Konsolidované účty','Consolidated accounts','czech-consolidated-accounts.v1.json','Účetní výkazy 2016–2024 a původní okruh konsolidace 2024.','2016–2024 financial statements and the native 2024 consolidation perimeter.'],
    ['MONITOR 2026','MONITOR 2026','czech-monitor-2026.v1.json','FINM2026 včetně partnerů transferů; nejde o všeobecný registr faktur.','FINM2026 including transfer partners; not a universal invoice register.'],
    ['Dotace MONITOR','MONITOR grants','czech-monitor-grants.v1.json','Měsíční záznamy vyplacených dotací a návratných výpomocí.','Monthly paid grants and repayable assistance records.'],
    ['DotaceEU','DotaceEU','czech-dotaceeu-operations.v1.json','Projekty a zakázky; stejné projekty se mohou opakovat.','Projects and procurements; project rows may repeat.'],
    ['IS ReD','IS ReD','czech-isred-grants.v1.json','Pět hlavních tabulek: příjemci, dotace, rozhodnutí, období a poskytovatelé.','Five core tables: recipients, grants, decisions, annual periods and providers.'],
    ['Školy 2026','Schools 2026','cze-school-funding-2026-summary.v1.json','Přidělené prostředky podle RED_IZO; nikoli konečné výdaje.','Allocated funding by RED_IZO; not final spending.'],
    ['Důchody ČSSZ','ČSSZ pensions','cze-pension-tables-2025.v1.json','Všech 14 sešitů s původními tabulkami a souřadnicemi buněk.','All 14 workbooks with native tables and cell locations.'],
    ['Úhrady léčiv','Medicine reimbursements','cze-medicine-reimbursements-summary.v1.json','Pouze vymezený soubor NR-04-17; pacienti se mezi skupinami nesčítají.','Scoped NR-04-17 dataset; patient counts are not additive across groups.'],
    ['Průmysl ČSÚ','ČSÚ industry','industry/CZE.json','Měsíční a čtvrtletní historie, původní jednotky a klasifikace.','Monthly and quarterly history, native units and classifications.'],
    ['Peníze ČNB ARAD','ČNB ARAD money','money-reports/cze-arad-native.v1.json','Stavy, tempa růstu a transakční toky odděleně.','Levels, growth rates and transaction flows kept separate.'],
    ['Vymezení obranných výdajů','Defense expenditure definitions','czech-defense-definitions.v1.json','NATO včetně označených odhadů a skutečné výdaje kapitoly 307 jako oddělené řady.','NATO including flagged estimates and chapter 307 actual expenditure as separate series.'],
    ['Obrana SIPRI','SIPRI defense','czech-sipri-military-expenditure.v1.json','Přímá revidovaná řada SIPRI do roku 2025.','Direct revised SIPRI series through 2025.'],
    ['Příspěvek na státní správu','State administration grants','mv-administration-grants.v1.json','Původní tabulky MV za roky 2006–2025.','Native Ministry of Interior tables for 2006–2025.'],
    ['Investice a silniční mapa','Investment and road geography','czech-project-geography.v1.json','Původní záznamy investiční mapy Plzně a majetku ŘSD; geometrie není finanční plnění.','Native Plzeň investment-map and ŘSD asset records; geometry does not establish spending.'],
    ['Projekty SFDI','SFDI projects','czech-sfdi-financing.v1.json','Upravený rozpočet a uvolněné prostředky; nikoli faktury dodavatelů.','Revised budget and released funds; not supplier invoices.'],
    ['Rozpočty SFDI','SFDI budgets','czech-sfdi-budget-tables.v1.json','Původní přílohy rozpočtů a výhledů.','Native budget and outlook annexes.'],
    ['Registr smluv','Official contract registry','contracts/official-registry/lineage.v1.json','Historie verzí smluv Plzně, ŘSD a Správy železnic z oficiálních měsíčních souborů; nejde o všechny zadavatele.','Contract version history for Plzeň, ŘSD and Správa železnic from official monthly dumps; not all buyers.'],
    ['Kontroly NKÚ','NKÚ audits','czech-nku.v1.json','Výběrové kontroly a kontrolované osoby; nikoli plošná míra pochybení.','Selective audits and audited entities; not a national wrongdoing rate.']
  ];
  const cards=document.getElementById('source-datasets');
  for(const [cs,english,path,csNote,enNote] of datasets){const article=el('article'); article.append(el('h3',t(cs,english)),el('p',t(csNote,enNote))); cards.append(article);}
})();
