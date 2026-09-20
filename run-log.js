const LANG = () => window.PSDLanguage?.current?.() ?? (document.documentElement.lang === 'en' ? 'en' : 'cs');
const PAGE = 60;
const COPY = {
  en: {
    title: 'Process log', lede: 'A public timeline of data ingestion, data releases and application deployments.',
    method: 'Read the coverage and architecture methodology →', type: 'Event type', all: 'All events',
    ingestion: 'Data ingestion', data_release: 'Data release', deployment: 'Application deployment',
    country: 'Country', allCountries: 'All countries', noCountry: 'No country', search: 'Search', searchPh: 'source, build or SHA…',
    count: (n, total) => `${n} of ${total} events`, empty: 'No event matches.', more: 'Load more',
    evidence: 'Evidence', outcome: 'Outcome', volume: 'Volume', git: 'Git SHA', pr: 'Pull request', build: 'Cloud Build ID',
    digest: 'Image digest', releases: 'Data-release IDs', checker: 'Checker', approver: 'Approved by', notRecorded: 'not recorded',
    where: 'Where the data appears', artifact: 'Evidence file', permalink: 'Link to this event', deployed: 'deployed', skipped: 'skipped', published: 'published',
    limitsTitle: 'Coverage and limits',
    limits: [
      'Historical ingestion rows are reconstructed from warehouse load records and declared retrievals. They prove an event was recorded, not that a checker or person approved it.',
      'Deployment receipts begin with this log. Older deployments are not reconstructed, and absent PR metadata is displayed as not recorded.',
      'A skipped deployment means Cloud Build produced an immutable image, but that commit was not the current main commit at deployment time.',
    ],
  },
  cs: {
    title: 'Provozní deník', lede: 'Veřejná časová osa příjmu dat, datových vydání a nasazení aplikace.',
    method: 'Metodika pokrytí a architektury →', type: 'Typ události', all: 'Všechny události',
    ingestion: 'Příjem dat', data_release: 'Datové vydání', deployment: 'Nasazení aplikace',
    country: 'Země', allCountries: 'Všechny země', noCountry: 'Bez země', search: 'Hledat', searchPh: 'zdroj, build nebo SHA…',
    count: (n, total) => `${n} z ${total} událostí`, empty: 'Žádná událost neodpovídá.', more: 'Načíst další',
    evidence: 'Podklad', outcome: 'Výsledek', volume: 'Objem', git: 'Git SHA', pr: 'Pull request', build: 'Cloud Build ID',
    digest: 'Otisk obrazu', releases: 'ID datových vydání', checker: 'Kontrola', approver: 'Schválil', notRecorded: 'nezaznamenáno',
    where: 'Kde se data zobrazují', artifact: 'Soubor s podkladem', permalink: 'Odkaz na událost', deployed: 'nasazeno', skipped: 'přeskočeno', published: 'vydáno',
    limitsTitle: 'Pokrytí a omezení',
    limits: [
      'Historické příjmy jsou zpětně odvozené ze záznamů skladu a deklarovaných stažení. Dokládají záznam události, ne schválení kontrolorem nebo člověkem.',
      'Potvrzení o nasazení začínají tímto deníkem. Starší nasazení nerekonstruujeme a chybějící PR uvádíme jako nezaznamenané.',
      'Přeskočené nasazení znamená, že Cloud Build vytvořil neměnný obraz, ale daný commit nebyl v okamžiku nasazení aktuálním commitem větve main.',
    ],
  },
};

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.filter(Boolean)); return node;
};
const fmt = new Intl.NumberFormat('en-GB');
const volume = (value = {}) => Object.entries(value).map(([key, amount]) => `${fmt.format(amount)} ${key.replaceAll('_', ' ')}`).join(' · ');
const date = (event, lang) => new Date(event.timestamp || `${event.date}T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'cs-CZ', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
const absent = (value, t) => value == null || value === '' ? t.notRecorded : String(value);
const deploymentToEvent = (event) => ({...event, run_id: event.event_id, date: event.timestamp.slice(0, 10), record_kind: 'native', evidence: 'Cloud Build deployment receipt', source_id: 'czbudget-public', publisher: 'Public Spending Data', country_codes: [], sections: ['/'], artifacts: [], volume: {}});

const mount = document.querySelector('[data-run-log]');
let payload; let shown = PAGE; let open = new URLSearchParams(location.search).get('event');
const filters = {type: '', country: '', query: ''};
const textOf = (event) => [event.source_id, event.publisher, event.git_sha, event.cloud_build_id, event.image_digest, ...(event.data_release_ids || [])].filter(Boolean).join(' ').toLowerCase();
const matches = (event) => (!filters.type || event.event_type === filters.type)
  && (!filters.country || (filters.country === '__none' ? !event.country_codes.length : event.country_codes.includes(filters.country)))
  && (!filters.query || textOf(event).includes(filters.query.toLowerCase()));

function detail(event, t) {
  const cell = (label, value, isAbsent = false) => el('div', {}, el('dt', {text: label}), el('dd', {class: isAbsent ? 'is-absent' : '', text: value}));
  const cells = [cell(t.evidence, event.evidence), cell(t.outcome, t[event.outcome] || event.outcome), cell(t.volume, volume(event.volume) || '—')];
  if (event.event_type === 'deployment' || event.event_type === 'data_release') {
    cells.push(cell(t.git, absent(event.git_sha, t), !event.git_sha), cell(t.pr, absent(event.pr_number, t), !event.pr_number));
    cells.push(cell(t.build, absent(event.cloud_build_id, t), !event.cloud_build_id), cell(t.digest, absent(event.image_digest, t), !event.image_digest));
    cells.push(cell(t.releases, event.data_release_ids?.join(' · ') || t.notRecorded, !event.data_release_ids?.length));
  } else cells.push(cell(t.checker, t.notRecorded, true), cell(t.approver, t.notRecorded, true));
  const where = event.sections?.length ? el('ul', {}, ...event.sections.map((href) => el('li', {}, el('a', {href, text: href})))) : el('p', {class: 'run-log__empty', text: t.notRecorded});
  return el('div', {class: `run-log__detail run-log__detail--${event.outcome}`}, el('dl', {class: 'run-log__kv'}, ...cells),
    el('div', {class: 'run-log__where-list'}, el('h3', {text: t.where}), where),
    el('p', {class: 'run-log__links'}, el('a', {href: `?event=${encodeURIComponent(event.run_id)}`, text: t.permalink}), event.artifacts?.[0] ? el('a', {href: `/${event.artifacts[0]}`, text: t.artifact}) : null));
}

function render() {
  const t = COPY[LANG()]; const all = payload.runs; const list = all.filter(matches); const page = list.slice(0, shown);
  document.title = `${t.title} — Public Spending Data`;
  const type = el('select', {'aria-label': t.type}, el('option', {value: '', text: t.all}), ...['ingestion', 'data_release', 'deployment'].map((value) => el('option', {value, text: t[value]})));
  type.value = filters.type; type.onchange = () => { filters.type = type.value; shown = PAGE; render(); };
  const country = el('select', {'aria-label': t.country}, el('option', {value: '', text: t.allCountries}), ...payload.facets.countries.map((item) => el('option', {value: item.value, text: `${item.value} (${item.runs})`})), el('option', {value: '__none', text: t.noCountry}));
  country.value = filters.country; country.onchange = () => { filters.country = country.value; shown = PAGE; render(); };
  const search = el('input', {type: 'search', value: filters.query, placeholder: t.searchPh, 'aria-label': t.search});
  search.oninput = () => { filters.query = search.value; shown = PAGE; render(); };
  const ledger = el('div', {class: 'run-log__ledger'});
  for (const event of page) {
    const isOpen = open === event.run_id;
    const row = el('button', {class: 'run-log__row', type: 'button', 'aria-expanded': String(isOpen)},
      el('span', {class: 'run-log__d', text: date(event, LANG())}), el('span', {class: `run-log__badge run-log__badge--${event.event_type}`, text: t[event.event_type]}),
      el('span', {class: 'run-log__src'}, document.createTextNode(event.source_id), event.publisher && event.publisher !== event.source_id ? el('i', {class: 'run-log__pub', text: event.publisher}) : null),
      el('span', {class: `run-log__outcome run-log__outcome--${event.outcome}`, text: t[event.outcome] || event.outcome}),
      el('span', {class: event.country_codes.length ? 'run-log__cc' : 'run-log__cc run-log__cc--none', text: event.country_codes.join(' ') || '—'}));
    row.onclick = () => { open = isOpen ? null : event.run_id; const url = new URL(location.href); open ? url.searchParams.set('event', open) : url.searchParams.delete('event'); history.replaceState(null, '', url); render(); };
    ledger.append(row); if (isOpen) ledger.append(detail(event, t));
  }
  if (!page.length) ledger.append(el('p', {class: 'run-log__empty', text: t.empty}));
  const more = shown < list.length ? el('button', {class: 'run-log__more', type: 'button', text: t.more}) : null;
  if (more) more.onclick = () => { shown += PAGE; render(); };
  const totals = ['ingestion', 'data_release', 'deployment'].map((kind) => [kind, all.filter((event) => event.event_type === kind).length]);
  mount.replaceChildren(
    el('header', {class: 'run-log__head'}, el('h1', {text: t.title}), el('p', {class: 'run-log__lede'}, document.createTextNode(`${t.lede} `), el('a', {href: '/methodology.html#release-architecture', text: t.method})),
      el('div', {class: 'run-log__types'}, ...totals.map(([kind, count]) => el('div', {}, el('b', {text: fmt.format(count)}), el('span', {text: t[kind]}))))),
    el('div', {class: 'run-log__filters'}, el('label', {text: t.type}), type, el('label', {text: t.country}), country, el('label', {text: t.search}), search, el('span', {class: 'run-log__spacer'}), el('span', {class: 'run-log__count', text: t.count(list.length, all.length)})),
    ledger, more || document.createTextNode(''), el('section', {class: 'run-log__limits'}, el('h2', {text: t.limitsTitle}), ...t.limits.map((value) => el('p', {text: value}))));
}

payload = await (await fetch('/data/registry/run-log.v1.json')).json();
try {
  const response = await fetch('/api/v1/process-log/deployments');
  if (response.ok) {
    const live = await response.json(); payload.runs.push(...(live.data?.events || []).map(deploymentToEvent));
    payload.runs.sort((a, b) => String(b.timestamp || b.date).localeCompare(String(a.timestamp || a.date)));
  }
} catch { /* Static hosting still exposes ingestion and data-release history. */ }
render(); addEventListener('psdlanguagechange', render);
