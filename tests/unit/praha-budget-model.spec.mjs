import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const math = require('../../lib/praha-budget-model.js');
const { associateAnnualChanges } = require('../../lib/praha-budget-model.js');

function fixtures(budgetChanges = [10,20,-5,30,5], outcomeChanges = budgetChanges) {
  let budget = 1000, outcome = 100;
  const history = [{year:2010, expense_actual:budget, population_mid_year:10}];
  const points = [{year:2010, value:outcome}];
  budgetChanges.forEach((change,index)=>{budget *= 1 + change / 100;history.push({year:2011+index,expense_actual:budget,population_mid_year:10});});
  outcomeChanges.forEach((change,index)=>{outcome *= 1 + change / 100;points.push({year:2011+index,value:outcome});});
  return {history,points};
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} should equal ${expected}`);

test('known annual changes yield positive and negative correlation, not correlation of levels', () => {
  const positive = fixtures();
  const result = associateAnnualChanges(positive.history, positive.points, {endYear:2015});
  assert.equal(result.pairs.length,5); near(result.r,1); assert.equal(result.reason,null);
  near(result.pairs[2].budgetChange,-5);
  const negative = fixtures([10,20,-5,30,5],[-10,-20,5,-30,-5]);
  near(associateAnnualChanges(negative.history,negative.points,{endYear:2015}).r,-1);
});

test('one-year lag matches outcome year t+1 and excludes an outcome beyond the selected year', () => {
  const {history,points} = fixtures();
  const delayed = points.map(row=>({...row,year:row.year+1}));
  const bounded = associateAnnualChanges(history,delayed,{lag:1,endYear:2015});
  assert.deepEqual(bounded.pairs.map(row=>[row.year,row.outcomeYear]),[[2011,2012],[2012,2013],[2013,2014],[2014,2015]]);
  assert.equal(bounded.r,null); assert.equal(bounded.reason,'sample');
  const complete = associateAnnualChanges(history,delayed,{lag:1,endYear:2016});
  near(complete.r,1); assert.equal(complete.pairs.at(-1).outcomeYear,2016);
});

test('missing calendar years are never bridged in either budget or outcome changes', () => {
  const {history,points} = fixtures([1,2,3,4,5,6,7,8]);
  const result = associateAnnualChanges(history.filter(row=>row.year!==2012),points.filter(row=>row.year!==2015),{endYear:2018});
  assert.deepEqual(result.pairs.map(row=>row.year),[2011,2014,2017,2018]);
  assert.equal(result.reason,'sample');
});

test('missing is not zero; a reported current zero is retained, while non-positive priors are excluded', () => {
  const history = [100,0,100,null,120,-50,100].map((value,index)=>({year:2010+index,expense_actual:value}));
  const points = [100,110,120,130,140,150,160].map((value,index)=>({year:2010+index,value}));
  const result=associateAnnualChanges(history,points,{endYear:2016,minPairs:2});
  assert.deepEqual(result.pairs.map(row=>row.year),[2011,2015]);
  near(result.pairs[0].budgetChange,-100);
  const outcomeMissing=points.map(row=>row.year===2011?{...row,value:null}:row);
  assert.deepEqual(associateAnnualChanges(history,outcomeMissing,{endYear:2016}).pairs.map(row=>row.year),[2015]);
});

test('per-resident changes require the population of both calendar years and preserve the denominator', () => {
  const history = [
    {year:2010,expense_actual:1000,population_mid_year:100},
    {year:2011,expense_actual:1200,population_mid_year:150},
    {year:2012,expense_actual:1400,population_mid_year:null},
    {year:2013,expense_actual:1600,population_mid_year:100},
    {year:2014,expense_actual:1800,population_mid_year:0},
  ];
  const points=history.map((row,index)=>({year:row.year,value:100+index*10}));
  const result=associateAnnualChanges(history,points,{perCapita:true,endYear:2014});
  assert.deepEqual(result.pairs.map(row=>row.year),[2011]);
  near(result.pairs[0].budgetChange,-20);
  near(associateAnnualChanges(history,points,{endYear:2014}).pairs[0].budgetChange,20);
});

test('five pairs are required by default and constant series has no Pearson coefficient', () => {
  const short=fixtures([1,2,3,4]);
  assert.equal(associateAnnualChanges(short.history,short.points,{endYear:2014}).reason,'sample');
  const constant=fixtures([10,10,10,10,10]);
  const result=associateAnnualChanges(constant.history,constant.points,{endYear:2015});
  assert.equal(result.pairs.length,5);assert.equal(result.r,null);assert.equal(result.reason,'variation');
  const stableOutcome=fixtures([1,2,3,4,5],[0,0,0,0,0]);
  assert.equal(associateAnnualChanges(stableOutcome.history,stableOutcome.points).reason,'variation');
});

test('ambiguous duplicate years are excluded and an alternate budget measure is honored', () => {
  const {history,points}=fixtures();
  const alternate=history.map(row=>({...row,capital_expense:row.expense_actual*2,expense_actual:0}));
  near(associateAnnualChanges(alternate,points,{budgetKey:'capital_expense'}).r,1);
  const duplicate=[...history,{...history[2],expense_actual:999999}];
  assert.deepEqual(associateAnnualChanges(duplicate,points).pairs.map(row=>row.year),[2011,2014,2015]);
});

const { serviceGroups, purposeEvidence } = require('../../lib/praha-budget-model.js');
test('service totals form a complete non-overlapping partition, preserving unknown codes and missing amounts', () => {
  const row=(code,amount,stage='actual',year=2025,dimension='functional',side='expenditure')=>({code,amount,stage,year,dimension,side});
  const rows=[row('2212',100),row('2295',200),row('3111',50),row('9999',-10),row('3113',999,'approved'),row('2212',999,'actual',2024),row('5169',999,'actual',2025,'economic'),row('1111',999,'actual',2025,'functional','revenue')];
  const groups=serviceGroups(rows,2025,'actual');
  assert.equal(groups.reduce((sum,g)=>sum+g.amount,0),340);
  assert.deepEqual(groups.flatMap(g=>g.rows.map(r=>r.code)).sort(),['2212','2295','3111','9999']);
  assert.equal(groups.find(g=>g.id==='unclassified').amount,-10);
  assert.equal(serviceGroups([...rows,row('2292',null)],2025,'actual').find(g=>g.id==='transport').amount,null);
});

test('purpose evidence joins exact year and code, scopes project sums and never uses full event or budget totals', () => {
  const a=(year,paragraphCode,itemCode,event,expenditure,budgetExpenditure=0)=>({year,paragraphCode,itemCode,event,expenditure,budgetExpenditure,eventName:'Shared project',itemName:'Services'});
  const accounting=[a(2025,'2212','5169','A',100),a(2025,'2212','5169','A',-5),a(2025,'3111','5169','A',900),a(2024,'2212','5169','A',500),a(2025,'22120','5169','A',800),a(2025,'2212','6121','',0,40),a(2025,'2212','1111','A',0),a(2025,'2212','5171','B',null,40)];
  const payments=[{year:2025,paragraphCode:'2212',expenditure:8},{year:2024,paragraphCode:'2212',expenditure:10},{year:2025,paragraphCode:'22120',expenditure:11}];
  const result=purposeEvidence(accounting,payments,2025,'2212');
  assert.equal(result.accounting.length,4);
  assert.equal(result.items.find(r=>r.code==='5169').amount,95);
  assert.equal(result.projects.find(r=>r.code==='A').amount,95);
  assert.equal(result.items.find(r=>r.code==='6121').amount,0);
  assert.equal(result.items.find(r=>r.code==='5171').amount,null);
  assert.equal(result.projects.find(r=>r.code==='').records.length,1);
  assert.deepEqual(result.payments,[payments[0]]);
  assert.deepEqual(purposeEvidence(accounting,payments,2025,'0000').items,[]);
});

test('IT vendor totals retain refunds, separate unidentified names and exclude unrelated codes', () => {
  const rows=[
    {itemCode:'5168',counterpartyId:'001',counterparty:'Same name',expenditureCents:10000,description:'System support'},
    {itemCode:'5168',counterpartyId:'001',counterparty:'Renamed',expenditureCents:-1000,description:'System refund'},
    {itemCode:'5168',counterpartyId:'002',counterparty:'Same name',expenditureCents:2000},
    {itemCode:'5168',counterpartyId:'',counterparty:'Unknown',expenditureCents:500},
    {itemCode:'5168',counterpartyId:'',counterparty:'Unknown',expenditureCents:700},
    {itemCode:'5162',counterpartyId:'001',expenditureCents:3000},
    {itemCode:'5169',counterpartyId:'001',expenditureCents:900000},
  ];
  const evidence=math.itEvidence([{code:'5168',actualCents:15000,budgetCents:20000}],rows);
  assert.equal(evidence.actual,150);
  assert.equal(evidence.invoiceAmount,122);
  assert.equal(evidence.vendors.length,4);
  assert.equal(evidence.vendors[0].amount,90);
  assert.equal(evidence.payments.length,5);
  assert.equal(math.itEvidence([],rows,'5162').invoiceAmount,30);
  assert.equal(math.itEvidence([],rows,'it','system').invoiceAmount,90);
  assert.equal(math.itEvidence([],[]).invoiceAmount,null);
  assert.equal(math.itEvidence([],[{itemCode:'5168',expenditureCents:null}]).invoiceAmount,null);
});
