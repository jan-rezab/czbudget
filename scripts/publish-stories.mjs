#!/usr/bin/env node
// Deterministic editorial publishing only. No network, warehouse or data release writes.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import catalog from '../content/stories/catalog.mjs';

const root = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const origin = 'https://publicspendingdata.org';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const published = catalog.filter(s => s.status === 'published').sort((a,b) => b.date.localeCompare(a.date));
const seen = new Set();
for (const story of catalog) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.slug) || seen.has(story.slug)) throw new Error(`Invalid/duplicate slug: ${story.slug}`);
  seen.add(story.slug);
  if (!['draft','published'].includes(story.status) || !['story','mini'].includes(story.format)) throw new Error(`Invalid state: ${story.slug}`);
  for (const field of ['title','description','date','updated','author','language','topic','takeaway']) if (!story[field]) throw new Error(`Missing ${field}: ${story.slug}`);
  for (const date of [story.date,story.updated]) if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Error(`Invalid date: ${story.slug}`);
  if (story.updated < story.date || !Number.isInteger(story.minutes) || story.minutes < 1) throw new Error(`Invalid metadata: ${story.slug}`);
}
if (published.filter(s => s.featured).length !== 1) throw new Error('Choose exactly one published lead story');
const label = s => s.format === 'mini' ? 'Mini story' : 'Data story';
const dateText = date => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const url = s => `/stories/${s.slug}/`;
const bilingual = (en,cs) => `<span data-en="${esc(en)}" data-cs="${esc(cs)}">${esc(en)}</span>`;
const outputs = new Map();
function page({title,description,path,body,article=false,schema}) {
  return `<!doctype html>
<html lang="en"><head>
<script src="/language-bootstrap.js?v=20260920-stories"></script>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Public Spending Data</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${origin}${path}"><link rel="icon" href="/assets/favicon.svg">
<meta property="og:type" content="${article?'article':'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${origin}${path}"><meta property="og:image" content="${origin}/assets/og.png"><meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/rss+xml" title="PSD Data Stories" href="/stories/feed.xml">
<link rel="stylesheet" href="/styles.css?v=20260920-stories"><link rel="stylesheet" href="/styles-v2.css?v=20260920-stories"><link rel="stylesheet" href="/site-header.css?v=20260824-header-lockup" data-psd-site-header><link rel="stylesheet" href="/global-footer.css?v=20260920-stories"><link rel="stylesheet" href="/stories/stories.css?v=20260920-stories">
${article?'<link rel="stylesheet" href="/stories/article.css?v=20260920-stories"><link rel="stylesheet" href="/psd-chart.css?v=20260920-stories"><script src="/psd-chart.js?v=20260920-stories" defer></script>':''}
<script src="/global-nav.js?v=20260920-stories" defer></script><script src="/stories/stories.js?v=20260920-stories" defer></script>
${schema?`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`:''}
</head><body class="stories-page ${article?'story-page':''}"><a class="stories-skip" href="#main">Skip to content</a><psd-site-header data-section="stories"></psd-site-header>${body}<footer data-global-footer></footer></body></html>\n`;
}
function card(s) {
  return `<article class="story-card" data-format="${s.format}" data-search="${esc(`${s.title} ${s.description} ${s.topic}`.toLowerCase())}" lang="en"><div class="story-card-meta"><span>${label(s)}</span><span>${s.minutes} min read</span></div><h3><a href="${url(s)}">${esc(s.title)}</a></h3><p>${esc(s.description)}</p><p class="story-takeaway">${esc(s.takeaway)}</p><div class="story-card-bottom"><span>${esc(s.topic)}</span><time datetime="${s.date}">${dateText(s.date)}</time></div></article>`;
}
const lead = published.find(s => s.featured);
const indexBody = `<main id="main" class="stories-index"><header class="stories-masthead"><p class="stories-eyebrow">${bilingual('The PSD journal','Datový žurnál PSD')}</p><h1>${bilingual('Data stories.','Příběhy v datech.')}</h1><p>${bilingual('Public money. Real outcomes. The story behind the numbers.','Veřejné peníze. Skutečné výsledky. Příběhy za čísly.')}</p><a href="/stories/feed.xml">RSS ↗</a></header>
<section class="story-lead" aria-labelledby="lead-heading" lang="en"><div><p class="stories-eyebrow">Featured · ${label(lead)} · ${lead.minutes} min read</p><h2 id="lead-heading"><a href="${url(lead)}">${esc(lead.title)}</a></h2><p>${esc(lead.description)}</p><a class="story-read" href="${url(lead)}">Read the story <span aria-hidden="true">→</span></a><p class="story-date">${dateText(lead.date)} · ${esc(lead.author)}</p></div><div class="story-cover" aria-label="The story follows three distinct measures: tariffs, trade flows and net customs revenue"><span>THE TRADE WAR, EXPLAINED</span><strong>Higher tariffs.<br>More revenue?<br>A better outcome?</strong><p>Rates ≠ trade ≠ welfare</p><small>Seven charts. One honest question.</small></div></section>
<section class="stories-library" aria-labelledby="library-heading"><div class="stories-library-heading"><h2 id="library-heading">${bilingual('Latest stories','Nejnovější příběhy')}</h2><p>${bilingual('Long reads and small discoveries.','Delší čtení i drobné objevy.')}</p></div><div class="stories-controls" hidden><div role="group" aria-label="Story format"><button type="button" data-filter="all" aria-pressed="true">${bilingual('All','Vše')}</button><button type="button" data-filter="story" aria-pressed="false">${bilingual('Data stories','Datové příběhy')}</button><button type="button" data-filter="mini" aria-pressed="false">${bilingual('Mini stories','Minipříběhy')}</button></div><label>${bilingual('Search stories','Hledat příběhy')}<input type="search" id="story-search" placeholder="Tariffs, revenue…"></label></div><p id="story-results" class="story-results" role="status" aria-live="polite"></p><div class="story-grid">${published.map(card).join('')}</div><p id="stories-empty" hidden>${bilingual('No stories match. Try another search or format.','Žádný příběh neodpovídá. Zkuste jiné hledání nebo formát.')}</p></section>
<aside class="stories-editorial"><h2>${bilingual('Evidence first. Conclusions second.','Nejdřív důkazy. Potom závěry.')}</h2><p>${bilingual('Every story separates observations from interpretation, dates its evidence and explains what the data cannot tell us. Articles are currently published in English.','Každý příběh odděluje pozorování od interpretace, uvádí datum zdrojů a vysvětluje, co z dat zjistit nelze. Články zatím vycházejí v angličtině.')}</p><a href="/methodology.html">${bilingual('Explore our coverage and methods →','Prozkoumat pokrytí a metodiku →')}</a></aside></main>`;
outputs.set('stories/index.html',page({title:'Data stories',description:'Full data stories and short, source-led explainers about public money and real outcomes.',path:'/stories/',body:indexBody,schema:{'@context':'https://schema.org','@type':'CollectionPage',name:'PSD Data Stories',url:`${origin}/stories/`,hasPart:published.map(s=>({'@type':'Article',headline:s.title,url:`${origin}${url(s)}`}))}}));
for (const s of published) {
  const manuscript = await readFile(resolve(root,`content/stories/${s.slug}.fragment`),'utf8');
  if (/<h1\b|file:\/\/|\.codex\/|Local editorial version|psd-trade-war-reference/i.test(manuscript)) throw new Error(`Unpublished/local markup in ${s.slug}`);
  const related = published.filter(other=>other.slug!==s.slug);
  const body = `<main id="main" class="story-main"><nav class="story-breadcrumb" aria-label="Breadcrumb"><a href="/stories/">${bilingual('← All data stories','← Všechny příběhy')}</a></nav><article lang="en"><header class="story-heading"><p class="stories-eyebrow">${label(s)} / ${esc(s.topic)}</p><h1>${esc(s.title)}</h1><p class="story-deck">${esc(s.description)}</p><p class="story-byline">${esc(s.author)} · <time datetime="${s.date}">${dateText(s.date)}</time> · ${s.minutes} min read · English</p><p class="story-edition">Editorial snapshot · Trade: July 2026 · Cash: August 2026 · Rates: 8 September 2026. Not a live tracker.</p></header><div class="story-body">${manuscript}</div></article><aside class="story-related"><h2>${bilingual('Keep reading','Čtěte dál')}</h2>${related.map(other=>`<p><a href="${url(other)}">${esc(other.title)} →</a></p>`).join('')}</aside></main>`;
  outputs.set(`stories/${s.slug}/index.html`,page({title:s.title,description:s.description,path:url(s),body,article:true,schema:{'@context':'https://schema.org','@type':'Article',headline:s.title,description:s.description,datePublished:s.date,dateModified:s.updated,inLanguage:s.language,author:{'@type':'Organization',name:s.author,url:origin},publisher:{'@type':'Organization',name:'Public Spending Data',url:origin},image:`${origin}/assets/og.png`,mainEntityOfPage:`${origin}${url(s)}`}}));
}
outputs.set('stories/feed.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>PSD Data Stories</title><link>${origin}/stories/</link><description>Source-led stories about public money and real outcomes.</description><language>en</language><atom:link href="${origin}/stories/feed.xml" rel="self" type="application/rss+xml"/>${published.map(s=>`<item><title>${esc(s.title)}</title><link>${origin}${url(s)}</link><guid isPermaLink="true">${origin}${url(s)}</guid><description>${esc(s.description)}</description><category>${esc(label(s))}</category><pubDate>${new Date(`${s.date}T00:00:00Z`).toUTCString()}</pubDate></item>`).join('')}</channel></rss>\n`);
outputs.set('stories/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/stories/</loc></url>${published.map(s=>`<url><loc>${origin}${url(s)}</loc><lastmod>${s.updated}</lastmod></url>`).join('')}</urlset>\n`);
// Fail closed on stale article directories: changing status never silently leaves a draft public.
let existing = [];
try { existing = await readdir(resolve(root,'stories'),{withFileTypes:true}); } catch(error) { if(error.code!=='ENOENT')throw error; }
for(const entry of existing.filter(e=>e.isDirectory()&&e.name!=='vendor')) if(!published.some(s=>s.slug===entry.name)) throw new Error(`Remove or redirect previously published route deliberately: stories/${entry.name}`);
for (const [file,content] of outputs) {
  const destination = resolve(root,file);
  if (check) { if (await readFile(destination,'utf8') !== content) throw new Error(`Stale editorial page: ${file}. Run npm run build:stories.`); }
  else { await mkdir(dirname(destination),{recursive:true}); await writeFile(destination,content); }
}
console.log(`${check?'Verified':'Published'} ${published.length} stories and ${outputs.size} editorial pages/feeds; no data releases changed.`);
