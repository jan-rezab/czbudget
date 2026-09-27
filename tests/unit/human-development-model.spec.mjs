import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {rowsFor}=createRequire(import.meta.url)('../../lib/human-development-model.js');
test('declared missing periods restore interior gaps and preserve measured zero',()=>{
  const chart={fields:[{key:'value'}],rows:[{country:'CZE',period:'2020',value:0},{country:'CZE',period:'2023',value:2}],missing_periods_by_country:{CZE:[{start:2021,end:2022}],DEU:[{start:2019,end:2023}]}};
  assert.deepEqual(rowsFor(chart,'CZE').map(r=>[r.period,r.value]),[['2020',0],['2021',null],['2022',null],['2023',2]]);
  assert.equal(chart.rows.length,2);
});
test('unknown gaps remain unknown and nonannual missing periods remain source literals',()=>{
  const chart={fields:[{key:'value'}],rows:[{country:'WLD',period:'2020-01',value:1},{country:'WLD',period:'2020-04',value:2}],missing_period_values_by_country:{WLD:['2020-02']}};
  assert.deepEqual(rowsFor(chart,'CZE').map(r=>r.period),['2020-01','2020-02','2020-04']);
});
test('invalid and unbounded ranges fail before expansion',()=>{
  for(const range of [{start:2022,end:2021},{start:1,end:10000},{start:2020.5,end:2022}])assert.throws(()=>rowsFor({fields:[],rows:[],missing_periods_by_country:{CZE:[range]}},'CZE'));
});
test('restores retained coordinates before selection without inheriting a default year into gaps',()=>{
  const chart={fields:[{key:'value'}],rows:[{value:0}],row_defaults:{country:'CZE',year:2023},annual_period_encoding:'year_integer; original period strings preserved in chart_details',missing_periods_by_country:{CZE:[{start:2020,end:2022}],DEU:[{start:2020,end:2022}]}};
  assert.deepEqual(rowsFor(chart,'CZE').map(r=>[r.country,r.year,r.value]),[['CZE',2020,null],['CZE',2021,null],['CZE',2022,null],['CZE',2023,0]]);
  assert.deepEqual(rowsFor(chart,'DEU').map(r=>r.country),['DEU','DEU','DEU']);
  assert.deepEqual(chart.rows,[{value:0}]);
});
test('omitted compact null cells remain missing while measured zero remains exact',()=>{
  const chart={fields:[{key:'value'},{key:'other'}],rows:[{year:2023,value:0}],row_defaults:{country:'CZE'}};
  assert.deepEqual(rowsFor(chart,'CZE'),[{country:'CZE',year:2023,value:0,other:null}]);
  assert.deepEqual(chart.rows,[{year:2023,value:0}]);
});
