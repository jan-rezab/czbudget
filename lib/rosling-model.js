/* Educational adapters over published releases. Never ingest or impute observations. */
(function(root){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const at=(series,year)=>series?.find(row=>row.year===Number(year)&&finite(row.value)) || null;
  const health=(data,code,group,key,year)=>at(data.countries[code]?.[group]?.[key]?.series,year);
  function journey(sovereign,performance,pressure,year){
    return sovereign.countries.map(country=>{
      const code=country.country_code;
      const gdp=at(sovereign.series.find(s=>s.country_code===code)?.metrics.gdp_per_capita_ppp?.values,year);
      const life=health(performance,code,'outcomes','life_expectancy_years',year);
      const pop=pressure.countries[code]?.wpp.find(r=>r.year===Number(year));
      return {code,year:Number(year),x:gdp?.value??null,y:life?.value??null,population:finite(pop?.population_thousands)?pop.population_thousands*1000:null,gdpStatus:gdp?.status??'missing',populationStatus:pop?.kind??'missing',lifeStatus:life?'reported':'missing'};
    });
  }
  function spending(performance,year,metric='life_expectancy_years'){
    return Object.keys(performance.countries).map(code=>({code,year:Number(year),x:health(performance,code,'spending','per_capita_ppp',year)?.value??null,y:health(performance,code,'outcomes',metric,year)?.value??null}));
  }
  function pensionRows(national,sex='total',kind='all'){
    const d=national.distribution[sex]?.[kind];if(!d)return [];
    return d.bands.map(b=>({lower:b.lower,upper:b.upper,count:b.count,share:d.count>0?b.count/d.count*100:null,denominator:d.count,date:national.date,unit:'CZK/month',geography:'CZE'}));
  }
  function ageBands(detail,year){
    // Preserve the source-native oldest-age tail; never split a grouped band.
    const bands=new Map();
    for(const row of detail.rows.filter(r=>r[0]===Number(year))){
      const [,start,end,male,female]=row;
      const nativeGrouped=end===null || end>start;
      const low=nativeGrouped?start:Math.floor(start/5)*5, high=nativeGrouped?end:low+4;
      const key=`${low}:${high}`;
      const band=bands.get(key)||{lower:low,upper:high,male:0,female:0,year:Number(year)};
      if(!finite(male)||!finite(female))throw new Error('Incomplete age/sex projection');
      band.male+=male;band.female+=female;bands.set(key,band);
    }
    return [...bands.values()].sort((a,b)=>b.lower-a.lower).map(b=>({...b,label:b.upper===null?`${b.lower}+`:b.lower===b.upper?String(b.lower):`${b.lower}–${b.upper}`}));
  }
  function change(series){
    const rows=(series||[]).filter(r=>finite(r.value)).sort((a,b)=>a.year-b.year);
    if(rows.length<2)return null;
    const first=rows[0],last=rows.at(-1);return {first,last,delta:last.value-first.value};
  }
  const api={finite,at,health,journey,spending,pensionRows,ageBands,change};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDRoslingModel=api;
})(typeof window==='undefined'?globalThis:window);
