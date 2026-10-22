// Render route and language specific first-response HTML from the same dictionaries
// the browser translators use. This is a code build step, not a data load.
import { readFile, mkdir, writeFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { extractCopy, translateMarked, localizeMetadata } from './localized-shell-copy.mjs';

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
const written = new Set();
const write = async (name, html) => {
  written.add(name);
  const target = path.join(output, name);
  await mkdir(path.dirname(target), { recursive: true });
  // Runtime staging initially hard-links sources; replace, never truncate, a link.
  await writeFile(target + '.localized-tmp', html);
  await rename(target + '.localized-tmp', target);
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
    html = localizeMetadata(html, {language:lang, title:`${name} — Public Spending Data`, description, route:`/countries/${slug}`});
    await write(`country-shells/${slug}.${lang}.html`, html);
  }
}

// Each entry reuses the browser's own copy. Registry routes are checked below so
// publishing a report without a first-response language contract fails staging.
const reportAdapters = {
  funding:['funding-deep-dive.js','data-fund-copy'], education:['education-deep-dive.js','data-edu-copy'],
  health:['deep-dives.js','data-deep-copy','copy',true], transportation:['deep-dives.js','data-deep-copy','copy',true],
  defense:['defense-deep-dive.js','data-defense-copy'], redistribution:['deep-dives.js','data-deep-copy','copy',true],
  revenue:['revenue-deep-dive.js','data-revenue-copy'], 'tax-burden':['deep-dives.js','data-deep-copy','copy',true],
  'eu-budget':['eu-budget-deep-dive.js','data-eu-copy'], 'job-market':['job-market.js','data-copy','copy',true],
  economy:['economy-deep-dive.js','data-econ-copy'], industry:['industry-explorer.js','data-copy','copy',true],
  trade:['trade-deep-dive.js','data-trade-copy'], 'product-markets':['trade-product-intelligence.js','data-product-copy'],
  'digital-spillover':['digital-spillover.js','data-digital-copy'], ageing:['deep-dives.js','data-deep-copy','copy',true],
  migration:['migration-deep-dive.js','data-migration-copy'], 'european-politics':['european-politics.js','data-copy','copy',true],
  'state-owned-enterprises':['state-owned-enterprises.js','data-copy'], 'capital-cities':['capital-cities-deep-dive.js','data-cap-copy'],
  'budget-planner':['budget-planner.js','data-budget-copy'], 'public-employment':['public-employment.js','data-emp-copy'],
  'money-cze':['money-report.js','data-money-copy'], 'money-usa':['money-report.js','data-money-copy'],
  'plzen-contracts':['plzen-contract-timeline.js','data-ct-copy'], rosling:['rosling-tribute.js','data-rosling-copy'],
  // These carry both languages in HTML or already have an English source body.
  'water-resilience':null, 'industrial-diagnostics':null, 'energy-trade':null, 'russia-trade':null, automotive:null, 'economic-flows':null,
};
const sourceCopies = new Map();
async function applyAdapter(html, [file, attribute, name='copy', htmlValues=false], language='en') {
  const key = `${file}:${name}:${language}`;
  if (!sourceCopies.has(key)) sourceCopies.set(key,extractCopy(await read(file),name,language));
  const copy = sourceCopies.get(key);
  html = translateMarked(html,attribute,copy,htmlValues);
  for (const attr of ['data-placeholder','data-i18n-placeholder']) {
    html = html.replace(new RegExp(`<[^>]+\\b${attr}="([^"]+)"[^>]*>`, 'g'), (tag,key) => {
      if(typeof copy[key] !== 'string') throw new Error(`Missing ${attr}: ${file}:${key}`);
      return tag.replace(/\splaceholder="[^"]*"/,` placeholder="${escape(copy[key])}"`);
    });
  }
  return html;
}
const literalCopy = {};
for (const adapter of [...Object.values(reportAdapters).filter(Boolean), ['health-budget.js','','T'], ['trade-services.js',''], ['municipalities.js','','C'], ['municipalities-czechia.js','','C'], ['eu-capitals.js','','I'], ['map-view.js','']]) {
  const [file,,name='copy'] = adapter, source=await read(file);
  const cs=extractCopy(source,name,'cs'), en=extractCopy(source,name,'en');
  for(const [key,value] of Object.entries(cs)) if(typeof value==='string' && typeof en[key]==='string') literalCopy[value]=en[key];
}
for(const names of Object.values(countries)) literalCopy[names[0]]=names[1];
Object.assign(literalCopy, JSON.parse(await read('scripts/localized-shell-literals.json')));
function translateLiterals(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<span\b[^>]*(?:data-lang-copy="cs"|class="wr-cs")[^>]*>[\s\S]*?<\/span>|<[^>]+>|[^<]+/gi, token => {
    if(/^<(?:script|style|span\b[^>]*(?:data-lang-copy="cs"|class="wr-cs"))/i.test(token)) return token;
    if(token.startsWith('<')) return token.replace(/(placeholder|aria-label|title)="([^"]*)"/g,(all,attr,value)=>literalCopy[value]?`${attr}="${escape(literalCopy[value])}"`:all);
    const trimmed=token.trim(); return literalCopy[trimmed] ? token.replace(trimmed,escape(literalCopy[trimmed])) : token;
  });
}
const routes = [];
async function publishPair(file, english, title, description) {
  const route = '/' + file.replace(/index\.html$/,'');
  const original = await read(file);
  const csTitle = original.match(/<title>([\s\S]*?)<\/title>/)?.[1];
  const sourceLanguage = original.match(/<html[^>]*lang="([^"]+)"/)?.[1] || 'cs';
  const cs = localizeMetadata(original,{language:sourceLanguage,route,title:csTitle});
  const en = localizeMetadata(translateLiterals(english),{language:'en',route,title,description});
  const englishFile = file.replace(/\.html$/,'.en.html');
  await write(file,cs); await write(englishFile,en);
  routes.push({route,file,englishFile});
}
for (const report of JSON.parse(await read('deep-dives/reports.json')).reports) {
  if (!(report.slug in reportAdapters)) throw new Error(`Missing first-response contract: ${report.slug}`);
  const file = report.navPath.split('?')[0].replace(/\/$/,'/index.html');
  let html = await read(file);
  if(reportAdapters[report.slug]) html = await applyAdapter(html,reportAdapters[report.slug]);
  if(html.includes('data-deep-copy=') && reportAdapters[report.slug]?.[1] !== 'data-deep-copy') html = translated(html,'data-deep-copy',reportsCopy.en);
  if(html.includes('data-health-key=')) html = translated(html,'data-health-key',healthCopy.en,true);
  if(report.slug==='plzen-contracts') html = await applyAdapter(html,['plzen-contracts-2026.js','data-cy-copy']);
  // data-en is the browser adapter's own literal translation (already escaped).
  html = html.replace(/(<([a-z][\w-]*)\b[^>]*\bdata-en="([^"]*)"[^>]*>)[\s\S]*?(<\/\2\s*>)/gi,(_,opening,tag,value,closing)=>opening+value+closing);
  await publishPair(file,html,`${report.title.en} — Public Spending Data`,report.card.en);
}
for (const [file,adapter,title,description] of [
  ['comparison.html',['homepage-v2.js','data-i18n','I'],'Compare public finances — Public Spending Data','Compare countries using consistent fiscal measures and visible accounting boundaries.'],
  ['map.html',['map-view.js','data-map-copy'],'The public spending map — Public Spending Data','Compare public spending across countries, categories and fiscal measures.'],
  ['municipalities/index.html',['municipalities.js','data-copy','C',true],'Municipality budgets — Public Spending Data','Find a municipality, check available years and open its budget profile.'],
  ['municipalities/czechia/index.html',['municipalities-czechia.js','data-copy','C',true],'Czech municipalities — Public Spending Data','National results, long-run municipal budgets and the complete Czech municipal directory.'],
  ['eu-capitals.html',['eu-capitals.js','data-i18n','I'],'European capital cities — Public Spending Data','Official capital-city budget plans alongside population, tourism and separate fiscal actuals.'],
]) {
  let html = await applyAdapter(await read(file),adapter);
  if(file==='map.html') html = translated(html,'data-surface-copy',{...surfaceCopy.en,eyebrow:'Published on PSD'});
  await publishPair(file,html,title,description);
}
const municipalitySource = await read('municipalities-country.js');
const municipalityProfiles = extractCopy(municipalitySource,'profiles');
for(const entry of await readdir(path.join(root,'municipalities'),{withFileTypes:true})) {
  if(!entry.isDirectory() || entry.name==='czechia') continue;
  const file=`municipalities/${entry.name}/index.html`;
  let original;
  try { original=await read(file); } catch(error) { if(error.code==='ENOENT') continue; throw error; }
  const code=original.match(/data-country-code="([^"]+)"/)?.[1];
  const profile=municipalityProfiles[code];
  if(!profile) throw new Error(`Missing municipality profile copy: ${file}`);
  let html=await applyAdapter(original,['municipalities-country.js','data-copy']);
  for(const [id,key] of [['country-eyebrow','eyebrow'],['country-title','title'],['country-intro','intro'],['insights-title','insights'],['insights-copy','copy']]) {
    html=html.replace(new RegExp(`(<([a-z][\\w-]*)\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(<\\/\\2\\s*>)`,'i'),(_,opening,tag,closing)=>opening+profile[key]+closing);
  }
  await publishPair(file,html,`${profile.title.replace(/<[^>]*>/g,' ')} — Public Spending Data`,profile.intro);
}
// The full Czech budget stays intact: translate text nodes and accessible labels,
// retaining every section, chart mount, control, source and original number.
const budgetSource = await read('budget-i18n.js');
const budgetDictionary = extractCopy(budgetSource,'csToEn');
const translateBudgetText = (text) => {
  const trimmed = text.trim();
  if(!trimmed) return text;
  const exact = budgetDictionary[trimmed] || budgetDictionary[trimmed.replace(/\s+/g,' ')];
  if(exact) return text.replace(trimmed,escape(exact));
  const number = /\d+(?:[   ,.]\d+)*/g;
  const template = budgetDictionary[trimmed.replace(number,'{n}')];
  if(!template) return text;
  const numbers = trimmed.match(number) || []; let index=0;
  return text.replace(trimmed,escape(template.replace(/\{n\}/g,()=>{
    const token = numbers[index++];
    if(/^\d+$/.test(token)) return token;
    const normalized = /,\d+$/.test(token) ? token.replace(/[   ]/g,'').replace(',','.') : token.replace(/[   ,]/g,'');
    return Number(normalized).toLocaleString('en-GB',{minimumFractionDigits:(normalized.split('.')[1]||'').length,maximumFractionDigits:(normalized.split('.')[1]||'').length});
  })));
};
let budget = await applyAdapter(await read('cesky-rozpocet.html'),['health-budget.js','data-health-key','T',true]);
budget = budget.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<[^>]+>|[^<]+/gi, token => {
  if(/^<(?:script|style)\b/i.test(token)) return token;
  if(token.startsWith('<')) return token.replace(/(placeholder|aria-label|title)="([^"]*)"/g,(all,attr,value)=>`${attr}="${budgetDictionary[value]?escape(budgetDictionary[value]):value}"`);
  return translateBudgetText(token);
});
budget=budget.replace(/<body\b/, '<body data-rendered-language="en"');
await publishPair('cesky-rozpocet.html',budget,'Public Spending Data — Czech budget over time','Czech public revenue and expenditure over time, detailed budget purposes, public entities and demographic scenarios.');
let log = await read('process/log/index.html');
const logCopy = extractCopy(await read('run-log.js'),'COPY');
log = log.replace(/(<main\b[^>]*>)/,`$1<h1>${escape(logCopy.title)}</h1><p>${escape(logCopy.lede)}</p><p role="status">${escape(logCopy.loading)}</p>`);
await publishPair('process/log/index.html',log,'Data processing and release log — Public Spending Data',logCopy.lede);
// Upgrade the existing core shells to the same canonical/alternate contract.
for (const [file,html,title,description] of [
  ['index.html',home,'Public Spending Data — public budgets in context','Compare national finances, inspect municipal budgets and open the original sources.'],
  ['about.html',about,'About — Public Spending Data','About Public Spending Data and the nonprofit organisation Hlidac statu, z.u.'],
  ['methodology.html',methodology,'Coverage — Public Spending Data','What we publish by country, section, period and primary source.'],
  ['deep-dives/index.html',reports,'Reports — Public Spending Data','Explore public budgets, infrastructure and public-service capacity by topic.'],
]) await publishPair(file,html,title,description);
await write('localized-shells.json',JSON.stringify({routes,files:[...written].sort()},null,2)+'\n');
console.log(`Localized shells: ${routes.length} route pairs and ${Object.keys(countries).length * 2} country pages`);
