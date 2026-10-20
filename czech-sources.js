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
    cloudHeld: 415303, cloudCities: 12, contractRun: '628f5121-6622-4dab-a99b-47fb1f3f8dd5',
    plzenHeld: 48781, plzenPublic: 2000, plzenCaptured: '2026-09-21' };
  // Completion receipts and pinned object generations reviewed 2026-09-27.
  const cloudContracts = new Map([
    ['00064581', ['Praha', 115429]], ['00075370', ['Plzeň', 48781]], ['00081531', ['Ústí nad Labem', 12938]],
    ['00234516', ['Kladno', 8860]], ['00244732', ['České Budějovice', 12617]], ['00262978', ['Liberec', 11682]],
    ['00268810', ['Hradec Králové', 10630]], ['00274046', ['Pardubice', 13676]], ['00283924', ['Zlín', 16896]],
    ['00299308', ['Olomouc', 14969]], ['00845451', ['Ostrava', 63520]], ['44992785', ['Brno', 85305]]
  ]);
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
  card('Hlídač státu', audit.hlidacValid, t('platných smluv u zdroje · celé Česko', 'valid contracts at source · Czechia-wide'), t('415 303 řádků / 12 měst v cloudu · 0 v BQ', '415,303 rows / 12 cities held in cloud · 0 in BQ'), t('Uchované i normalizované; dosud nepublikované do BQ. Součet měst může obsahovat stejné smlouvy.', 'Held and normalized; not yet published to BQ. City totals may include overlapping contracts.'));
  coverageRow('Hlídač státu', [fmt(audit.hlidacValid), t('Platné smlouvy, celý registr, kontrola 27. 9. 2026.', 'Valid contracts, whole register, checked 27 Sep 2026.')], [fmt(audit.cloudHeld) + ' / ' + audit.cloudCities + t(' měst', ' cities'), t('Cloudové řádky, stažené a normalizované do 21. 9. Součet bez deduplikace mezi městy. Veřejný výpis Plzně obsahuje jen 2 000 smluv.', 'Cloud rows downloaded and normalized by 21 Sep. Sum without deduplication between cities. The public Plzeň feed exposes only 2,000 contracts.')], ['100 / 0', t('100 obcí v inventáři; 0 řádků v hlidac_municipality_contract_matches. Cloudové soubory čekají na publikaci do BQ.', '100 municipalities in inventory; 0 rows in hlidac_municipality_contract_matches. Cloud files await BQ publication.')]);
  evidence('Hlídač státu · ' + t('zdroj → cloud → BQ', 'source → cloud → BQ'), [t('Inventář z 20. 9. 2026: 100 různých obecních IČO, součet 875 563 zdrojových shod. Shody se mohou mezi obcemi překrývat; součet není počet unikátních smluv.', '20 Sep 2026 inventory: 100 distinct municipal IDs and 875,563 source-query matches summed across them. Matches may overlap between municipalities; the sum is not a unique-contract count.'), t('12 dokončených městských receiptů z 21. 9.: 415 303 přijatých i normalizovaných řádků, 0 odmítnutých a 0 odstraněných duplicit uvnitř měst. Uchovány surové odpovědi, normalizované smlouvy i soubory pro warehouse. Každý receipt dokládá počty, SHA-256 a generaci objektů; publikace je označena not_published_individually.', '12 city completion receipts from 21 Sep: 415,303 received and normalized rows, 0 rejected and 0 duplicates removed within cities. Raw responses, normalized contracts and warehouse files are held. Each receipt records counts, SHA-256 and object generations; publication is marked not_published_individually.'), t('Dne 27. 9. ověřeny generace a velikosti uchovaných objektů. Obsah nebyl znovu stahován ani hashován. Tabulka shod má 0 řádků. Zpracování cloudových souborů a publikace do BQ jsou samostatné stavy; nula v BQ neznamená, že data nebyla stažena.', 'Held object generations and sizes checked 27 Sep. Payloads were not downloaded or rehashed. The matches table has 0 rows. Cloud-file processing and BQ publication are separate states; zero in BQ does not mean the data was never downloaded.')], [['Inventory table','czbudget-janrezab.budget_detail.hlidac_municipality_contract_inventory'],['Contract table','czbudget-janrezab.budget_detail.hlidac_municipality_contract_matches'],['Inventory run',audit.inventoryRun],['Contract run',audit.contractRun],['Campaign','top100-2025-07-01-v2'],['Praha normalized SHA-256','b96f132d6b8d23caf8267bf28ec514cd3504a4979aef35606d0486344b9c364d']]);
  document.getElementById('research-evidence').lastChild.append(sourceLink(t('Původní statistika smluv', 'Original contract statistics'), 'https://www.hlidacstatu.cz/report/7'));
  document.getElementById('research-evidence').lastChild.append(el('p', t('Dokončené cloudové vrstvy: ', 'Completed cloud layers: ') + [...cloudContracts.values()].map(([name, count]) => name + ' (' + fmt(count) + ')').join(' · ') + '.'));
  document.getElementById('research-evidence').lastChild.append(el('p', t('Celý cloudový běh skončil 21. 9. překročením časového limitu (FAILURE). Dokončené soubory těchto 12 měst zůstávají uchované; nejde o úspěšně publikovanou celou kampaň. Stažení zbývajících 88 měst inventáře není ověřeno. Worker: europe-west4, psd-data-builder, plane-data. Loader Git SHA: ', 'The overall cloud run ended on 21 Sep with a step timeout (FAILURE). Completed files for these 12 cities remain held; the whole campaign was not successfully published. Downloads for the remaining 88 inventoried cities are unverified. Worker: europe-west4, psd-data-builder, plane-data. Loader Git SHA: ') + '3a93552aeb184c7310913dd4e0fcec685c60eef6.'));
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
      const held = cloudContracts.get(p.ico);
      const heldScopeMatches = held && (norm(held[0]) === norm(p.name) || (p.ico === '00064581' && p.name === 'Hlavní město Praha'));
      if (heldScopeMatches) contracts.append(el('strong', fmt(held[1])), el('small', t('Cloud: staženo a normalizováno · 21. 9.; dosud mimo BQ.', 'Cloud: downloaded and normalized · 21 Sep; not yet in BQ.')));
      else if (footprint) contracts.append(el('strong', fmt(footprint[1])), el('small', norm(footprint[0]) === norm(p.name) ? t('Inventář zdroje · ' + footprint[0] + ' · 20. 9.; nikoli načtené smlouvy.', 'Source inventory · ' + footprint[0] + ' · 20 Sep; not loaded contracts.') : t('Inventář celého města · ' + footprint[0] + ' · 20. 9.; nejde o smlouvy této městské části.', 'Whole-city source inventory · ' + footprint[0] + ' · 20 Sep; not this district’s holdings.')));
      else contracts.append(el('span', t('Neověřeno pro tento profil', 'Not verified for this profile'), 'coverage-status'));
      count.append(el('strong', fmt(paymentCount(p))), el('small', t('Rozúčtování, ne unikátní faktury.', 'Allocations, not unique invoices.')));
      const year = lastYear(p), latest = p.years.find(y => y.year === year);
      years.append(el('strong', year ? String(year) : t('Bez řádků', 'No rows')), el('small', latest?.source_validity ? t('Platnost: ', 'Validity: ') + latest.source_validity.slice(0,10) : t('Datum platnosti neuvedeno', 'Validity date not supplied')));
      row.append(name, context, contracts, count, years); body.append(row);
    }
    document.getElementById('city-more').hidden = limit >= rows.length;
  }
  function priority(title, value, unit, note, url) { const c = el('article', undefined, 'priority-card'); c.append(el('p', t('Kandidát pro propojený pohled', 'Candidate for a connected view'), 'eyebrow'), el('h3')); c.lastChild.append(link(title, url)); c.append(el('strong', fmt(value)), el('p', unit), el('p', note, 'czech-note')); document.getElementById('priority-cards').append(c); }
  priority('Plzeň', audit.plzenHeld, t('smluvních řádků uchovaných v cloudu', 'contract rows held in cloud'), t('PAQ + rozpočty + projekty. Normalizováno 21. 9.; BQ dosud prázdné. Veřejný kompaktní výpis má 2 000 smluv.', 'PAQ + budgets + projects. Normalized 21 Sep; BQ still empty. The public compact feed holds 2,000 contracts.'), '/deep-dives/plzen-contracts/?lang=' + language);
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
