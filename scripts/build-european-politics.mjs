import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const config=JSON.parse(await fs.readFile(new URL('../pipeline/config/european_politics.v1.json',import.meta.url)));
const fiscal=JSON.parse(await fs.readFile(new URL('../lib/data/sovereign-benchmark.v1.json',import.meta.url)));
const promises=JSON.parse(await fs.readFile(new URL('../pipeline/config/politics_promises.v1.json',import.meta.url)));
const crawl=JSON.parse(await fs.readFile(new URL('../data/politics-source-crawl.v1.json',import.meta.url)));
const portraits=JSON.parse(await fs.readFile(new URL('../assets/politics/portraits.json',import.meta.url)));
for(const portrait of Object.values(portraits))portrait.data_uri='data:image/jpeg;base64,'+(await fs.readFile(new URL('../'+portrait.path,import.meta.url))).toString('base64');
for(const p of promises.promises){assert(crawl.sources[p.source_id]?.status==='extracted',`Uncrawled promise ${p.id}`);assert.equal(p.source_sha256,crawl.sources[p.source_id].sha256,`Changed manifesto needs review ${p.id}`);for(const e of p.evidence){assert(crawl.sources[e.source_id]?.status==='extracted',`Uncrawled outcome ${p.id}`);assert.equal(e.source_sha256,crawl.sources[e.source_id].sha256,`Changed outcome needs review ${p.id}`);}}
const metrics=['nominal_gdp_usd_bn','gross_debt_pct_gdp','real_gdp_growth_pct'];
const countries=config.country_order.map(code=>{
  const c=config.countries[code],meta=fiscal.countries.find(x=>x.country_code===code),series=fiscal.series.find(x=>x.country_code===code);
  assert(meta && series,`Missing benchmark country ${code}`);
  c.terms.forEach((term,i)=>{
    assert(!term.program_id || config.documents[term.program_id],`Missing program ${term.id}`);
    assert(!term.end || term.start<term.end,`Invalid dates ${term.id}`);
    if(i)assert.equal(c.terms[i-1].end,term.start);
    if(term.program_id)assert(config.documents[term.program_id].published_on<=config.as_of);
  });
  const observations=Array.from({length:config.end_year-config.start_year+1},(_,i)=>{
    const year=config.start_year+i,row={year};
    for(const metric of metrics){const obs=series.metrics[metric]?.values.find(v=>v.year===year);row[metric]=obs?.value??null;row[`${metric}_status`]=obs?.status??'unavailable';}
    row.gross_debt_usd_bn=Number.isFinite(row.nominal_gdp_usd_bn)&&Number.isFinite(row.gross_debt_pct_gdp)?row.nominal_gdp_usd_bn*row.gross_debt_pct_gdp/100:null;
    return row;
  });
  return {...c,name_en:meta.name_en,name_cs:meta.name_cs,iso2:meta.iso2,observations};
});
assert.equal(countries.length,10);
const output={...config,countries,promise_review:promises,crawl,portraits,events:[{date:'2020-03-11',title_en:'COVID-19 pandemic',title_cs:'Pandemie covidu',url:'https://www.who.int/news-room/speeches/item/who-director-general-s-opening-remarks-at-the-media-briefing-on-covid-19---11-march-2020'},{date:'2022-02-24',title_en:'Invasion of Ukraine',title_cs:'Invaze na Ukrajinu',url:'https://www.consilium.europa.eu/en/meetings/european-council/2022/02/24/'}],fiscal_source:{...fiscal.source,artifact:'lib/data/sovereign-benchmark.v1.json',generated_at:fiscal.generated_at}};
const text=JSON.stringify(output,null,2)+'\n',path=new URL('../data/european-politics.v1.json',import.meta.url);
if(process.argv.includes('--check'))assert.equal(await fs.readFile(path,'utf8'),text,'Rebuild politics data');
else await fs.writeFile(path,text);
console.log(`European politics: ${countries.length} countries, ${countries.reduce((n,c)=>n+c.terms.length,0)} periods, ${Object.keys(config.documents).length} documents`);
