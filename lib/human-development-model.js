/* Expand only source-declared missing periods; never fill unknown coverage. */
(function(root){
  'use strict';
  const globalCodes=new Set(['World','WLD','GLOBAL','OWID_WRL']);
  function rowsFor(chart,country){
    const applies=code=>code==null||code===country||globalCodes.has(code);
    const rows=chart.rows.map(row=>({...chart.row_defaults,...row})).filter(row=>applies(row.country));
    const missing=[];
    const add=(code,period,annual=false)=>missing.push({country:code,...(annual&&chart.annual_period_encoding?{year:Number(period)}:{period}),...Object.fromEntries(chart.fields.map(field=>[field.key,null]))});
    for(const [code,ranges] of Object.entries(chart.missing_periods_by_country||{})){
      if(!applies(code))continue;
      for(const range of ranges){
        if(!Number.isSafeInteger(range.start)||!Number.isSafeInteger(range.end)||range.end<range.start||range.end-range.start>1000)throw new Error('Invalid declared missing range');
        for(let year=range.start;year<=range.end;year++)add(code,String(year),true);
      }
    }
    for(const [code,periods] of Object.entries(chart.missing_period_values_by_country||{}))if(applies(code))for(const period of periods)add(code,period);
    return missing.length?[...rows,...missing].sort((a,b)=>String(a.period??a.year).localeCompare(String(b.period??b.year))):rows;
  }
  const api={rowsFor};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDHumanDevelopmentModel=api;
})(typeof window==='undefined'?globalThis:window);
