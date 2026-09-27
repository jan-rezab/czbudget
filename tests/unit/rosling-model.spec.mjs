import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../../lib/rosling-model.js';
import plots from '../../lib/chart-renderer.js';

test('journey joins exact years, preserves estimates and never carries population forward',()=>{
  const b={countries:[{country_code:'CZE'}],series:[{country_code:'CZE',metrics:{gdp_per_capita_ppp:{values:[{year:2023,value:50000,status:'estimate'}]}}}]};
  const h={countries:{CZE:{outcomes:{life_expectancy_years:{series:[{year:2023,value:79.1}]}}}}};
  const w={countries:{CZE:{wpp:[{year:2022,population_thousands:10000,kind:'estimate'}]}}};
  const row=model.journey(b,h,w,2023)[0];
  assert.equal(row.x,50000);assert.equal(row.y,79.1);assert.equal(row.population,null);assert.equal(row.gdpStatus,'estimate');
  assert.equal(model.journey(b,h,w,2022)[0].population,10000000);
  assert.equal(model.journey(b,h,w,2022)[0].x,null);
});
test('spending comparisons exclude unmatched years instead of joining latest observations',()=>{
  const h={countries:{CZE:{spending:{per_capita_ppp:{series:[{year:2024,value:5000}]}},outcomes:{life_expectancy_years:{series:[{year:2023,value:80}]}}}}};
  assert.deepEqual(model.spending(h,2024)[0],{code:'CZE',year:2024,x:5000,y:null});
});
test('payment shares reconcile to source counts, preserve unequal bands and open tail',()=>{
  const n={date:'2025-12-31',distribution:{total:{all:{count:100,bands:[{lower:1,upper:4999,count:30},{lower:5000,upper:null,count:70}]}}}};
  const rows=model.pensionRows(n);assert.equal(rows.reduce((sum,r)=>sum+r.share,0),100);assert.equal(rows[1].upper,null);assert.equal(rows[0].denominator,100);assert.equal(rows[0].geography,'CZE');
});
test('pyramid aggregates exact sex counts and retains grouped oldest ages',()=>{
  const d={rows:[[2025,0,0,10,20,30],[2025,1,1,30,40,70],[2025,100,null,5,6,11],[2026,0,0,999,999,1998]]};
  assert.deepEqual(model.ageBands(d,2025),[{lower:100,upper:null,male:5,female:6,year:2025,label:'100+'},{lower:0,upper:4,male:40,female:60,year:2025,label:'0–4'}]);
  assert.throws(()=>model.ageBands({rows:[[2025,0,0,null,10,10]]},2025),/Incomplete/);
});
test('change calculations skip missing endpoints but retain negative and zero observations',()=>{
  assert.equal(model.change([{year:2015,value:3},{year:2016,value:null},{year:2024,value:0}]).delta,-3);
  assert.equal(model.change([{year:2015,value:3}]),null);
});
test('spatial chart tables preserve positive sex counts and null axes',()=>{
  const pyramid=plots.model({type:'pyramid',rows:[{label:'0–4',male:100,female:110}],fields:[{key:'male'},{key:'female'}]});
  assert.deepEqual(pyramid.accessor.rows(),[{label:'0–4',male:100,female:110}]);
  const scatter=plots.model({type:'scatter',rows:[{label:'Missing',x:null,y:80}],fields:[{key:'x'},{key:'y'}]});
  assert.deepEqual(scatter.rows[0].values,[null,80]);
});

test('fictional block generations preserve four entering units and show momentum',()=>{
  const totals=Array.from({length:4},(_,i)=>model.generations(i).reduce((a,r)=>a+r.blocks,0));
  assert.deepEqual(totals,[6,8,10,12]);
  for(let i=1;i<4;i++){
    const now=model.generations(i),before=model.generations(i-1);
    assert.equal(now[0].blocks,4);assert.equal(now[1].blocks,before[0].blocks);assert.equal(now[2].blocks,before[1].blocks);
    assert.ok(now.every(r=>r.scenario));
  }
});
test('washing-machine scenario measures active time, never negative savings',()=>{
  assert.equal(model.timeFreed(60,10,4),10/3);
  assert.equal(model.timeFreed(10,60,4),0);
  assert.equal(model.timeFreed(60,10,0),0);
});

test('population totals use all source rows beyond the manifest window and do not split age boundaries',()=>{
  assert.deepEqual(model.populationSummary({rows:[[2100,20,64,20,30,50],[2100,65,null,10,5,15]]},2100),{total:65,old_age_dependency_per_100_working_age:30});
  assert.equal(model.populationSummary({rows:[[2100,60,69,20,30,50]]},2100).old_age_dependency_per_100_working_age,null);
  assert.equal(model.populationSummary({rows:[]},2100),null);
});
test('published ranges ignore null values and retain earlier dates',()=>{
  assert.deepEqual(model.years([{year:1980,value:2},{year:1980,value:3},{year:1970,value:null},{year:2024,value:4}]),[1980,2024]);
  assert.deepEqual(model.spendingYears({countries:{CZE:{spending:{per_capita_ppp:{series:[{year:2000,value:2}]}}}}}),[2000]);
});

test('native population people take precedence over a converted thousands field',()=>{
  const b={countries:[{country_code:'CZE'}],series:[]},h={countries:{}},w={countries:{CZE:{wpp:[{year:1980,population_thousands:12345.6789,source_population_persons:12345679,kind:'estimate'}]}}};
  assert.equal(model.journey(b,h,w,1980)[0].population,12345679);
});
