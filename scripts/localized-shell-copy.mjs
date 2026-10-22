// Read only explicit copy declarations/updates from browser source. Never execute
// its DOM, fetch, storage or chart code while packaging the first HTML response.
import vm from 'node:vm';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statement = (source, start) => {
  for (let end = source.indexOf(';', start); end >= 0; end = source.indexOf(';', end + 1)) {
    const candidate = source.slice(start, end + 1);
    try { new vm.Script(candidate); return candidate; } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  }
  throw new Error('Unterminated translation declaration');
};
export function extractCopy(source, name = 'copy', language = 'en') {
  const match = new RegExp(`\\bconst\\s+${name}\\s*=`).exec(source);
  if (!match) throw new Error(`Missing translation declaration: ${name}`);
  const context = vm.createContext({lang: language, en: language === 'en', tr: (en,cs) => ({en,cs}), location: {search: `?lang=${language}`}, URLSearchParams});
  vm.runInContext(statement(source, match.index), context, {timeout:1000});
  const updates = new RegExp(`Object\\.assign\\(\\s*${name}(?=[.,\\s])|\\b${name}\\.(?:en\\.|cs\\.)?\\w+\\s*=(?!=)`, 'g');
  updates.lastIndex = match.index;
  for (let update; (update = updates.exec(source));) {
    const code = statement(source, update.index);
    vm.runInContext(code, context, {timeout:1000});
    updates.lastIndex = update.index + code.length;
  }
  const copy = vm.runInContext(name, context);
  const values = copy[language] || copy;
  return Object.fromEntries(Object.entries(values).map(([key,value]) => [key, value && typeof value === 'object' && language in value ? value[language] : value]));
}
export function translateMarked(html, attribute, copy, htmlValues = false) {
  const missing = new Set();
  const result = html.replace(new RegExp(`(<([a-z][\\w-]*)\\b[^>]*\\b${attribute}="([^"]+)"[^>]*>)([\\s\\S]*?)(<\\/\\2\\s*>)`, 'gi'), (whole,opening,tag,key,old,closing) => {
    if (typeof copy[key] !== 'string') { missing.add(key); return whole; }
    return opening + (htmlValues ? copy[key] : escapeHtml(copy[key])) + closing;
  });
  if (missing.size) throw new Error(`Missing ${attribute} translations: ${[...missing].join(', ')}`);
  return result;
}
export function localizeMetadata(html, {language, title, description, route}) {
  const base = `https://publicspendingdata.org${route}`;
  const localized = `${base}?lang=${language}`;
  html = html.replace(/<html\b[^>]*>/i, tag => tag.replace(/\blang="[^"]*"/, `lang="${language}"`).replace(/\sdata-shell-pending/, ''));
  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  const setMeta = (type,key,value) => {
    const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${type}="${key}")[^>]*>`, 'i');
    const tag = `<meta ${type}="${key}" content="${escapeHtml(value)}">`;
    html = pattern.test(html) ? html.replace(pattern,old => old.replace(/content="[^"]*"/,`content="${escapeHtml(value)}"`)) : html.replace('</head>', `  ${tag}\n</head>`);
  };
  if(description) {setMeta('name','description',description);setMeta('property','og:description',description);setMeta('name','twitter:description',description);}
  if(title) {setMeta('property','og:title',title);setMeta('name','twitter:title',title);}
  setMeta('property','og:url',localized);
  setMeta('property','og:locale',language==='en'?'en_GB':'cs_CZ');
  // Preserve IDs consumed by country.js; each language has a self canonical.
  html = html.replace(/<link\b(?=[^>]*\brel="(?:canonical|alternate)")(?=[^>]*(?:\bhreflang=|\brel="canonical"))[^>]*>\s*/gi,'');
  const links = `<link id="canonical-url" rel="canonical" href="${localized}">\n`+
    `<link id="alternate-cs" rel="alternate" hreflang="cs" href="${base}?lang=cs">\n`+
    `<link id="alternate-en" rel="alternate" hreflang="en" href="${base}?lang=en">\n`+
    `<link id="alternate-default" rel="alternate" hreflang="x-default" href="${base}">\n`;
  return html.replace('</head>',links+'</head>');
}
