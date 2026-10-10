// Render route and language specific first-response HTML from the same dictionaries
// the browser translators use. This is a code build step, not a data load.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] || '.');
const output = path.resolve(process.argv[3] || root);
const read = name => readFile(path.join(root, name), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const scriptValue = (source, start, end, name) => {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  if (first < 0 || last < 0) throw new Error(`Cannot extract ${name} translation dictionary`);
  return vm.runInNewContext(`(() => { const lang = 'en'; ${source.slice(first, last)}; return ${name}; })()`, { location: { search: '' }, URLSearchParams }, { timeout: 1000 });
};
const translated = (html, attribute, dictionary, htmlValues = false) => {
  const missing = new Set();
  const pattern = new RegExp(`(<([a-z][\\w-]*)\\b[^>]*\\b${attribute}="([^"]+)"[^>]*>)([\\s\\S]*?)(<\\/\\2\\s*>)`, 'gi');
  const result = html.replace(pattern, (whole, opening, tag, key, old, closing) => {
    if (dictionary[key] === undefined) { missing.add(key); return whole; }
    return opening + (htmlValues ? String(dictionary[key]) : escape(dictionary[key])) + closing;
  });
  if (missing.size) throw new Error(`Missing ${attribute} translations: ${[...missing].join(', ')}`);
  return result;
};
const metadata = (html, { lang, title, description }) => html
  .replace(/<html lang="[^"]+"/, `<html lang="${lang}"`)
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`)
  .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escape(description)}$2`)
  .replace(/(<meta\s+name="description"\s*\n\s*content=")[^"]*(")/, `$1${escape(description)}$2`)
  .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${escape(description)}$2`);
const write = async (name, html) => {
  const target = path.join(output, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
};

const homeCopy = scriptValue(await read('homepage-v2.js'), 'const I=', 'const keys=', 'I');
const siteCopySource = await read('site-pages.js');
const siteCopy = scriptValue(siteCopySource, 'const copy =', 'const coverageCategories=', 'copy');
const statusCopy = scriptValue(siteCopySource, 'const copy =', 'const esc=value', 'statusCopy');
const reportsCopy = scriptValue(await read('deep-dives.js'), 'const copy=', 'const t=copy[lang]', 'copy');
const countryCopy = scriptValue(await read('country.js'), 'const T =', 'const flagCodes=', 'T');
const healthCopy = scriptValue(await read('country-health.js'), 'const T =', 'const modes =', 'T');
const freshnessCopy = scriptValue(await read('data-freshness.js'), 'const copy =', 'copy.cs.unavailable', 'copy');
const boundaryCopy = scriptValue(await read('coverage-accounting-boundaries.js'), 'const copy =', 'let data =', 'copy');
const surfaceCopy = scriptValue(await read('coverage-map.js'), 'const copy =', 'let t =', 'copy');
const countries = scriptValue(await read('country-names.js'), 'const countries =', 'const entry =', 'countries');
const slugs = scriptValue(await read('country-routes.js'), 'const slugs =', 'const codes =', 'slugs');

let home = translated(await read('index.html'), 'data-i18n', homeCopy.en);
home = home.replace('Načítám srovnání…', 'Loading comparison…').replace('Načítám zdravotní ukazatele…', 'Loading health indicators…');
home = metadata(home, { lang: 'en', title: 'Public Spending Data — public budgets in context', description: 'Compare national finances, inspect municipal budgets and open the original sources.' });
await write('index.en.html', home);

let about = translated(await read('about.html'), 'data-page-copy', siteCopy.en, true);
about = metadata(about, { lang: 'en', title: 'About — Public Spending Data', description: 'About Public Spending Data and the nonprofit organisation Hlidac statu, z.u.' });
await write('about.en.html', about);

let methodology = translated(await read('methodology.html'), 'data-status-copy', statusCopy.en);
methodology = translated(methodology, 'data-page-copy', siteCopy.en, true);
methodology = translated(methodology, 'data-freshness-copy', freshnessCopy.en);
methodology = translated(methodology, 'data-boundary-copy', boundaryCopy.en);
methodology = translated(methodology, 'data-surface-copy', {...surfaceCopy.en, eyebrow: 'Published on PSD'});
methodology = metadata(methodology, { lang: 'en', title: 'Coverage — Public Spending Data', description: 'What we publish by country, section, period and primary source.' });
await write('methodology.en.html', methodology);

let reports = translated(await read('deep-dives/index.html'), 'data-deep-copy', reportsCopy.en);
reports = reports.replace('5 zemí / countries', '5 countries').replace('6 zemí / countries · 2024', '6 countries · 2024').replace('7 views / pohledů', '7 views');
reports = reports.replace(/<img\b[^>]*data-report-preview="([^"]+)"[^>]*>/g, (tag, key) => tag
  .replace(/src="[^"]*"/, `src="${tag.match(/data-preview-en="([^"]+)"/)?.[1] || ''}"`)
  .replace(/alt="[^"]*"/, `alt="${escape(`${reportsCopy.en[key] || key} — headline chart preview`)}"`));
reports = metadata(reports, { lang: 'en', title: 'Reports | Public Spending Data', description: 'Cross-country reports connect public budgets with infrastructure and public-service capacity.' });
await write('deep-dives/index.en.html', reports);

const baseCountry = await read('country.html');
for (const [code, names] of Object.entries(countries)) {
  const slug = slugs[code] || code.toLowerCase();
  const canonical = `https://publicspendingdata.org/countries/${slug}`;
  for (const lang of ['cs', 'en']) {
    const name = names[lang === 'en' ? 1 : 0];
    let html = translated(baseCountry, 'data-i18n', countryCopy[lang]);
    html = translated(html, 'data-health-key', healthCopy[lang], true);
    if (lang === 'en') html = html.replace('>Překlad</a>', '>Translation</a>').replace('Příjmy / % HDP', 'Revenue / % GDP').replace('Výdaje / % HDP', 'Expenditure / % GDP');
    const description = lang === 'en'
      ? `Fiscal profile of ${name}: general-government finances, macroeconomic indicators and primary budget sources.`
      : `Fiskální profil země ${name}: veřejné finance, makroekonomické ukazatele a primární rozpočtové zdroje.`;
    html = metadata(html, { lang, title: `${name} — Public Spending Data`, description });
    html = html.replace(' data-shell-pending', '');
    html = html.replace(/(<span class="country-code-large" id="country-code">)[\s\S]*?(<\/span>)/, `$1${code}$2`);
    html = html.replace(/(<h1 id="country-name">)[\s\S]*?(<\/h1>)/, `$1${escape(name)}$2`);
    html = html.replaceAll('https://publicspendingdata.org/countries/czechia', canonical);
    const jsonld = /(<script id="country-jsonld" type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
    html = html.replace(jsonld, (_, opening, raw, closing) => {
      const data = JSON.parse(raw);
      data.name = lang === 'en' ? `${name} — public finance profile 2005–2024` : `${name} — profil veřejných financí 2005–2024`;
      data.description = description;
      data.url = canonical;
      data.spatialCoverage.name = name;
      data.inLanguage = lang;
      return opening + JSON.stringify(data).replaceAll('<', '\\u003c') + closing;
    });
    await write(`country-shells/${slug}.${lang}.html`, html);
  }
}
console.log(`Localized shells: 4 English pages and ${Object.keys(countries).length * 2} country pages`);
