// Self-contained review copy: opens from disk, without a server or network data fetches.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || resolve(root, '../outputs/money-flow-review/money-flow.html'));
const read = path => readFileSync(resolve(root, path), 'utf8');
const safeScript = value => value.replace(/<\/script/gi, '<\\/script');
let html = read('money-flow.html');
html = html.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g, '');
html = html.replace(/<link rel="stylesheet" href="([^"]+)"[^>]*>/g, (_, path) => `<style>${read(path.split('?')[0])}</style>`);
const logo = `data:image/svg+xml;base64,${Buffer.from(read('assets/logo-lockup.svg')).toString('base64')}`;
html = html.replace('<psd-site-header></psd-site-header>', `<header class="review-header"><a href="https://publicspendingdata.org/"><img src="${logo}" width="190" height="48" alt="Public Spending Data"></a><span>2026 / CZECH STATE BUDGET</span><nav aria-label="Language"><button data-lang="cs">CS</button><button data-lang="en">EN</button></nav></header>`);
html = html.replace('</head>', `<style>.review-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 4vw;border-bottom:1px solid #d2ccc1}.review-header>span{font:11px monospace;letter-spacing:.08em}.review-header nav{display:flex;gap:8px}.review-header button{background:transparent;color:#171918;border:1px solid #8b8d83;padding:9px}.review-header button[aria-pressed=true]{background:#171918;color:#faf7ef}@media(max-width:650px){.review-header>span{display:none}.review-header img{width:150px;height:auto}}</style></head>`);
html = html.replace(/href="(?!https?:|data:|#)([^"]+)"/g, (_, path) => `href="https://publicspendingdata.org/${path}"`);
const bootstrap = `window.PSDLanguage={set(next){document.documentElement.lang=next;document.querySelectorAll('[data-lang]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.lang===next)));dispatchEvent(new CustomEvent('psdlanguagechange'));}};document.documentElement.lang=new URLSearchParams(location.search).get('lang')==='cs'?'cs':'en';`;
const model = read('lib/money-flow-model.mjs').replace(/^export /gm, '');
let app = read('money-flow.js').replace(/^import[^\n]+\n/, '');
const start = app.indexOf('  const [budget, spending, detail] = await Promise.all(');
const end = app.indexOf('  model = withFlowDetail', start);
if (start < 0 || end < 0) throw new Error('Review build input changed; update the snapshot extraction.');
app = app.slice(0, start) + `  const budget = ${read('data/czech-budget.v1.json')};\n  const spending = ${read('data/cz-spending-2026.v1.json')};\n  const detail = ${read('data/money-flow-detail-2026.v1.json')};\n` + app.slice(end);
app = app.replace('`cesky-rozpocet.html?lang=${language}`', '`https://publicspendingdata.org/cesky-rozpocet.html?lang=${language}`');
// File URLs cannot always update their query via history; language still switches in place.
app = app.replace("history.replaceState(null, '', next);", "try { history.replaceState(null, '', next); } catch {}");
html = html.replace('</body>', `<script>${safeScript(bootstrap)}</script><script>${safeScript(read('psd-chart.js'))}</script><script type="module">${safeScript(model + '\n' + app)}</script></body>`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(out);
