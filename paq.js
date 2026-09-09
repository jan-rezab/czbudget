const BASE = '/data/paq/';
const copy = {
  cs: { title:'Data o území', intro:'Vzdělávání, sociální podmínky, bydlení, samosprávy a další ukazatele PAQ Research.', level:'Územní úroveň', find:'Vyhledat území', query:'Vyhledat ukazatel', category:'Téma', all:'Všechna témata', indicator:'Ukazatel a historie', value:'Hodnota', period:'Období', sources:'Zdroje', missing:'Neuvedeno', prev:'Předchozí', next:'Další', download:'Stáhnout data tohoto území (JSON)', profile:'Rozpočtový profil', original:'Otevřít v DataPAQ', notice:'Údaje patří pouze zvolenému území. Chybějící hodnota není nula. Modelové odhady, skutečné výdaje a různé druhy období zůstávají oddělené podle původní definice.', license:'Zpracování PAQ Research / DataPAQ: CC BY-NC 4.0 (uveďte původ, neužívejte komerčně). Platí také podmínky jednotlivých původních zdrojů.', native:'Názvy a metodické popisy jsou zachované v původní češtině.', loading:'Načítání…', failure:'Data se nepodařilo načíst. Zkuste stránku obnovit.', open:'Prohlédnout ukazatele tohoto území', full:'Všechny ukazatele a historie', empty:'Pro tento výběr nejsou dostupné údaje.', snapshot:'Snímek dat', groups:'řad', history:'Historie', scope:'Kompletní veřejný katalog DataPAQ; nejde o respondentní mikrodata ani o všechny datové podklady jednotlivých studií PAQ.' },
  en: { title:'Territory data', intro:'Education, social conditions, housing, local government and other PAQ Research indicators.', level:'Geographic level', find:'Find a territory', query:'Find an indicator', category:'Topic', all:'All topics', indicator:'Indicator and history', value:'Value', period:'Period', sources:'Sources', missing:'Not reported', prev:'Previous', next:'Next', download:'Download this territory (JSON)', profile:'Budget profile', original:'Open in DataPAQ', notice:'Values refer only to the selected territory. Missing is not zero. Model estimates, actual expenditure and different period types retain their original definitions.', license:'PAQ Research / DataPAQ processing: CC BY-NC 4.0 (attribution, noncommercial use). Individual original source terms also apply.', native:'Indicator names and methodology retain the original Czech wording.', loading:'Loading…', failure:'Unable to load data. Please refresh the page.', open:'Explore indicators for this territory', full:'All indicators and history', empty:'No data is available for this selection.', snapshot:'Data snapshot', groups:'series', history:'History', scope:'Complete public DataPAQ catalogue; this does not include respondent microdata or every underlying dataset used in PAQ studies.' }
};
const levels = {cs:{obec:'Obec',orp:'ORP',okres:'Okres',kraj:'Kraj',stat:'Stát'},en:{obec:'Municipality',orp:'Administrative district (ORP)',okres:'District',kraj:'Region',stat:'Country'}};
export const language = () => document.documentElement.lang === 'en' ? 'en' : 'cs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = html => new DOMParser().parseFromString(String(html ?? ''), 'text/html').body.textContent || '';
let indexPromise, catalogPromise;
const pendingMounts = new WeakMap();
async function json(file, gzip = false) {
  const response = await fetch(BASE + file); if (!response.ok) throw Error(`DataPAQ ${response.status}`);
  if (!gzip) return response.json();
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
}
export const index = () => indexPromise ||= json('index.json');
const catalog = () => catalogPromise ||= json('catalog.json.gz', true);
const url = key => {const [level,code] = key.split(':');return `/paq.html?level=${encodeURIComponent(level)}&code=${encodeURIComponent(code)}&lang=${language()}`;};
function number(value, field, lang) {
  if (value === null || value === undefined) return copy[lang].missing;
  const label = field.display_categorical_labels?.[value];
  if (label !== undefined) return String(label);
  if (typeof value !== 'number') return typeof value === 'object' ? JSON.stringify(value) : String(value);
  return new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {maximumFractionDigits:Math.max(0,Math.min(10,field.display_decimal_digits ?? 2))}).format(value) + (field.display_unit ? ` ${field.display_unit}` : '');
}
function periodRank(field) {
  const years = String(field.period_key).match(/(?:19|20)\d{2}/g);
  return years ? Math.max(...years.map(Number)) : 0;
}
function groupsFor(values, fields) {
  const groups = new Map();
  for (const [id, record] of Object.entries(values)) {
    const field = fields[id]; if (!field) throw Error('Missing field metadata');
    const key = `${field.variable_key}:${field.values_type_key}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({id,field,record});
  }
  return [...groups.values()].map(rows => rows.sort((a,b) => periodRank(b.field)-periodRank(a.field) || String(b.field.period_key).localeCompare(String(a.field.period_key),'cs',{numeric:true})));
}
export async function mount(root, key, compact = false) {
  const token = {}; pendingMounts.set(root,token);
  const lang = language(), t = copy[lang]; root.textContent = t.loading;
  try {
    const [idx, cat] = await Promise.all([index(), catalog()]);
    const region = idx.regions[key]; if (!region?.shard) throw Error('Unknown territory');
    const shard = await json(region.shard, true), values = shard[key]; if (!values) throw Error('Missing territory');
    if (pendingMounts.get(root)!==token) return;
    const groups = groupsFor(values,cat.fields).sort((a,b) => cat.variables[a[0].field.variable_key].name.localeCompare(cat.variables[b[0].field.variable_key].name,'cs'));
    const topics = cat.categories.filter(c=>c.parent_id === null); let page = 0, query = '', category = '';
    const sourceRegion = region.source_region || {};
    const related = new Set([region.parent, ...['orp','okres','kraj'].map(level=>sourceRegion[`${level}_code`] && `${level}:${sourceRegion[`${level}_code`]}`),'stat:CZ']); related.delete(key);
    root.innerHTML = `<div class="paq-eyebrow">PAQ Research · DataPAQ · ${esc(levels[lang][region.level])}</div><h${compact?2:1}>${esc(region.name)} · ${t.title}</h${compact?2:1}><p>${t.intro}</p><p class="paq-muted">${t.snapshot}: ${esc(idx.completed_at.slice(0,10))} · ${groups.length} ${t.groups} · ${esc(region.code)}</p><div class="paq-links">${[...related].filter(k=>idx.regions[k]?.shard).map(k=>`<a href="${url(k)}">${esc(levels[lang][idx.regions[k].level])}: ${esc(idx.regions[k].name)}</a>`).join('')}${region.profile ? `<a href="${esc(region.profile)}?lang=${lang}">${t.profile}</a>`:''}</div><p class="paq-notice">${t.notice}</p>${compact?'':`<p class="paq-muted">${t.native}</p><div class="paq-controls"><label>${t.query}<input data-query type="search"></label><label>${t.category}<select data-topic><option value="">${t.all}</option>${topics.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label></div>`}<div data-table></div><div class="paq-links">${compact?`<a href="${url(key)}">${t.full} →</a>`:`<button data-download>${t.download}</button>`}<a href="https://datapaq.cz/?g=${encodeURIComponent(region.level)}&vis=table">DataPAQ ↗</a></div><p class="paq-muted">${t.license} <a href="${esc(idx.license_url)}">CC BY-NC 4.0</a></p>`;
    function draw() {
      const selectedCategory = topics.find(c=>String(c.id)===category);
      const filtered = groups.filter(rows=>{
        const variable = cat.variables[rows[0].field.variable_key];
        return (!selectedCategory || selectedCategory.variable_ids.includes(variable.id)) && `${variable.name} ${variable.key} ${rows[0].field.values_type_name}`.toLocaleLowerCase('cs').includes(query.toLocaleLowerCase('cs'));
      });
      const size = compact ? 6 : 30, slice = filtered.slice(page*size,(page+1)*size);
      const table = root.querySelector('[data-table]');
      table.innerHTML = `<p class="paq-count">${filtered.length} ${t.groups}</p><div class="paq-table-scroll"><table class="paq-table"><thead><tr><th>${t.indicator}</th><th>${t.value}</th><th>${t.period}</th></tr></thead><tbody>${slice.map(rows=>{
        const {field,record} = rows[0], variable = cat.variables[field.variable_key];
        const sourceText = plain(variable.sources_rendered || (typeof variable.sources==='object' ? variable.sources?.text : variable.sources) || '');
        return `<tr><td><details><summary>${esc(variable.name)}<small>${esc(field.values_type_name)}</small></summary><p>${esc(plain(variable.description))}</p><p><b>${t.sources}:</b> ${esc((field.sources||[]).join('; '))} ${esc(sourceText)}</p><a href="https://datapaq.cz/?g=${region.level}&v1=${encodeURIComponent(field.variable_key)}&v1t=${encodeURIComponent(field.values_type_key)}&v1p=${encodeURIComponent(field.period_key)}&vis=table">${t.original} ↗</a><table class="paq-table paq-history"><caption>${t.history}</caption><thead><tr><th>${t.period}</th><th>${t.value}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.field.period_name)}</td><td>${esc(number(r.record.value,r.field,lang))}${r.record.value===null && r.field.too_little_data_explanation?`<small>${esc(plain(r.field.too_little_data_explanation))}</small>`:''}</td></tr>`).join('')}</tbody></table></details></td><td>${esc(number(record.value,field,lang))}</td><td>${esc(field.period_name)}</td></tr>`;
      }).join('')}</tbody></table></div>${slice.length?'':`<p>${t.empty}</p>`}${compact?'':`<div class="paq-pagination"><button data-prev ${page===0?'disabled':''}>${t.prev}</button><span>${page+1} / ${Math.max(1,Math.ceil(filtered.length/size))}</span><button data-next ${(page+1)*size>=filtered.length?'disabled':''}>${t.next}</button></div>`}`;
      table.querySelector('[data-prev]')?.addEventListener('click',()=>{page--;draw();});
      table.querySelector('[data-next]')?.addEventListener('click',()=>{page++;draw();});
    }
    draw();
    root.querySelector('[data-query]')?.addEventListener('input',e=>{query=e.target.value;page=0;draw();});
    root.querySelector('[data-topic]')?.addEventListener('change',e=>{category=e.target.value;page=0;draw();});
    root.querySelector('[data-download]')?.addEventListener('click',()=>{
      const usedFields = Object.fromEntries(Object.keys(values).map(id=>[id,cat.fields[id]]));
      const usedVariables = Object.fromEntries([...new Set(Object.values(usedFields).map(f=>f.variable_key))].map(k=>[k,cat.variables[k]]));
      const data = {source:idx.source,license:idx.license,license_url:idx.license_url,attribution:idx.attribution,snapshot:idx.completed_at,region,fields:usedFields,variables:usedVariables,values};
      const objectURL = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const anchor=document.createElement('a');anchor.href=objectURL;anchor.download=`paq-${region.level}-${region.code}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(objectURL),1000);
    });
    if(key==='stat:CZ' && !compact) {
      const section=document.createElement('section');root.append(section);panels(section,lang);
    }
  } catch(error) {if(pendingMounts.get(root)===token)root.textContent=t.failure;console.error(error);}
}
async function panels(root,lang) {
  const t=copy[lang];
  try {
    const payload=await json('panels.json');
    root.innerHTML=`<h2>${lang==='cs'?'Život domácností · národní průzkumy':'Household conditions · national surveys'}</h2><p class="paq-notice">${lang==='cs'?'Agregované výsledky výběrových šetření PAQ Research a NMS. Údaje za skupiny respondentů nejsou odhadem pro obec, ORP ani kraj. Definice, velikost vzorku a metodické změny jsou u původního zdroje.':'Aggregated PAQ Research / NMS survey results. Respondent groups are not estimates for municipalities, districts or regions. Definitions, sample sizes and methodology changes are documented by the original source.'}</p><p class="paq-muted">${payload.charts.length} ${lang==='cs'?'přehledů':'datasets'} · ${t.snapshot}: ${esc(payload.retrieved_at.slice(0,10))}</p><div data-panels></div><div class="paq-links"><a href="/data/paq/panels.json" download>${lang==='cs'?'Stáhnout všechna národní panelová data (JSON)':'Download all national panel data (JSON)'}</a></div><p class="paq-muted">${lang==='cs'?'Zdrojové podmínky partnerských projektů platí samostatně; licence DataPAQ se na ně automaticky nepřenáší.':'Partner project source terms apply separately; the DataPAQ licence is not automatically assigned to these datasets.'}</p>`;
    const container=root.querySelector('[data-panels]');
    payload.charts.sort((a,b)=>`${a.project}${a.title}`.localeCompare(`${b.project}${b.title}`,'cs')).forEach(chart=>{
      const details=document.createElement('details');details.className='paq-panel';
      details.innerHTML=`<summary>${esc(chart.title)}<small class="paq-muted"> · ${esc(chart.project)}</small></summary><div data-panel></div>`;container.append(details);
      details.addEventListener('toggle',()=>{
        if(!details.open || details.dataset.loaded)return;details.dataset.loaded='true';
        const data=chart.data, groups=[{title:lang==='cs'?'Celý výzkumný vzorek':'Full survey sample',record:data.total}];
        for(const group of data.groups||[])for(const item of group.data||[])groups.push({title:`${group.title}: ${item.title}`,record:item});
        const pane=details.querySelector('[data-panel]');pane.innerHTML=`<p>${esc(chart.attribution)} · ${esc(data.yLabel)}</p><div class="paq-controls"><label>${lang==='cs'?'Skupina respondentů':'Respondent group'}<select>${groups.map((g,i)=>`<option value="${i}">${esc(g.title)}</option>`).join('')}</select></label></div><div data-panel-table></div><a href="${esc(chart.methodology_url)}">${lang==='cs'?'Původní graf, definice a metodika':'Original chart, definitions and methodology'} ↗</a>`;
        const draw=()=>{
          const group=groups[Number(pane.querySelector('select').value)], rows=group.record.lines||[];
          pane.querySelector('[data-panel-table]').innerHTML=`<p class="paq-muted">${esc(group.record.subtitle||'')}</p><div class="paq-table-scroll"><table class="paq-table"><caption>${esc(group.title)} · ${esc(data.yLabel)}</caption><thead><tr><th>${t.period}</th>${data.titles.map(v=>`<th>${esc(plain(v))}</th>`).join('')}</tr></thead><tbody>${(data.ticks||[]).map((period,i)=>({period,i})).reverse().map(({period,i})=>`<tr><td>${esc(period)}</td>${rows.map(values=>`<td>${esc(number(values[i],{display_decimal_digits:2},lang))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        };pane.querySelector('select').addEventListener('change',draw);draw();
      });
    });
  }catch(error){root.textContent=t.failure;console.error(error);}
}
export async function context(root, key) {
  const lang=language(), t=copy[lang], idx=await index(), region=idx.regions[key]; if(!region?.shard)return;
  root.innerHTML=`<div class="paq-eyebrow">PAQ Research · DataPAQ</div><h2>${t.title}: ${esc(region.name)}</h2><p>${t.intro}</p><p class="paq-muted">${esc(levels[lang][region.level])} · ${esc(region.code)}</p><button>${t.open}</button><div class="paq-links"><a href="${url(key)}">${t.full} →</a></div>`;
  root.querySelector('button').addEventListener('click',()=>mount(root,key,true));
}
async function page() {
  const root=document.querySelector('#paq-root');if(!root)return;
  const lang=language(), t=copy[lang];
  try {
    const idx=await index(), params=new URLSearchParams(location.search);
    let selectedLevel=params.get('level')||'stat', selectedKey=`${selectedLevel}:${params.get('code')||'CZ'}`;
    const picker=document.createElement('section');picker.innerHTML=`<div class="paq-eyebrow">Public Spending Data · DataPAQ</div><div class="paq-controls"><label>${t.level}<select data-level>${Object.entries(levels[lang]).map(([k,v])=>`<option value="${k}" ${k===selectedLevel?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label>${t.find}<input type="search" data-region placeholder="${lang==='cs'?'Název nebo kód':'Name or code'}"></label></div><ul class="paq-results" data-results></ul><p class="paq-muted">${idx.variables} ${lang==='cs'?'ukazatelů':'indicators'} · ${new Intl.NumberFormat(lang).format(idx.non_null_observations)} ${lang==='cs'?'vyplněných hodnot':'reported values'}. ${t.scope}</p>`;
    document.querySelector('[data-paq-picker]')?.remove();picker.dataset.paqPicker='true';root.before(picker);let search='';
    function find(){const rows=Object.values(idx.regions).filter(r=>r.shard&&r.level===selectedLevel&&`${r.name} ${r.code}`.toLocaleLowerCase('cs').includes(search.toLocaleLowerCase('cs'))).slice(0,12);const target=picker.querySelector('[data-results]');target.innerHTML=rows.map(r=>`<li><button data-key="${esc(r.key)}">${esc(r.name)} · ${esc(r.code)}</button></li>`).join('');target.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{selectedKey=b.dataset.key;history.replaceState(null,'',url(selectedKey));mount(root,selectedKey);}));}
    picker.querySelector('[data-level]').addEventListener('change',e=>{selectedLevel=e.target.value;find();});picker.querySelector('[data-region]').addEventListener('input',e=>{search=e.target.value;find();});find();await mount(root,selectedKey);
  }catch(error){root.textContent=t.failure;console.error(error);}
}
page();
let currentLanguage=language();
if(document.querySelector('#paq-root')) new MutationObserver(()=>{if(language()!==currentLanguage){currentLanguage=language();page();}}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
