(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PrahaMagistrate=api;})(globalThis,function(){
  'use strict';
  const fields=['income_budget_cents','income_actual_cents','expenditure_budget_cents','expenditure_actual_cents'];
  const finite=v=>typeof v==='number'&&Number.isSafeInteger(v);
  const amount=v=>finite(v)?v/100:null;
  const sum=(rows,key,empty=false)=>rows.length?rows.every(r=>finite(r[key]))?rows.reduce((n,r)=>n+r[key],0):null:empty?0:null;
  function statement(summary){
    if(!summary||!Number.isInteger(summary.year))throw new Error('An exact fiscal year is required');
    const a=summary.accounting||{},items=Array.isArray(a.by_item)?a.by_item:[],totals=a.totals||{},control=summary.annual_finance?.source_api_control||{};
    const validItems=items.length>0||a.rows===0;
    const checks=fields.map(key=>({key,reported:finite(totals[key])?totals[key]:null,source:finite(control[key])?control[key]:null,classified:sum(items,key,validItems)})).map(r=>({...r,matched:[r.reported,r.source,r.classified].every(finite)?r.reported===r.source&&r.reported===r.classified:null}));
    const classes=[['tax',['1']],['nontax',['2']],['capital_income',['3']],['transfers',['4']],['financing',['8']],['other_income',[]]];
    const group=(id,selected,side)=>({id,budget:a.rows===0?null:amount(sum(selected,`${side}_budget_cents`,validItems)),actual:a.rows===0?null:amount(sum(selected,`${side}_actual_cents`,validItems)),codes:selected.map(r=>String(r.key))});
    const income=classes.map(([id,prefixes])=>group(id,items.filter(r=>id==='other_income'?!['1','2','3','4','8'].includes(String(r.key)[0]):prefixes.includes(String(r.key)[0])),'income'));
    const expenditure=[['opex','5'],['capex','6'],['other_expenditure','']].map(([id,prefix])=>group(id,items.filter(r=>prefix?String(r.key).startsWith(prefix):!['5','6'].includes(String(r.key)[0])),'expenditure'));
    const normalize=row=>({code:String(row.key??''),name:row.label||String(row.key??''),income:amount(row.income_actual_cents),budgetIncome:amount(row.income_budget_cents),expenditure:amount(row.expenditure_actual_cents),budgetExpenditure:amount(row.expenditure_budget_cents),rows:row.rows??null});
    const observed=key=>a.rows===0?null:amount(totals[key]);
    const incomeActual=observed('income_actual_cents'),expenditureActual=observed('expenditure_actual_cents'),incomeBudget=observed('income_budget_cents'),expenditureBudget=observed('expenditure_budget_cents');
    return {year:summary.year,incomeActual,expenditureActual,incomeBudget,expenditureBudget,balance:incomeActual!==null&&expenditureActual!==null?incomeActual-expenditureActual:null,budgetBalance:incomeBudget!==null&&expenditureBudget!==null?incomeBudget-expenditureBudget:null,income,expenditure,items:items.map(normalize),purposes:(a.by_paragraph||[]).map(normalize),checks,reconciled:checks.every(r=>r.matched===true),sourceValidity:summary.source_validity||null,evidence:summary.source_bulk_export||{},accountingRows:a.rows??null,eventRows:summary.events?.rows??null,invoiceRows:summary.payments?.rows??null,invoiceExpenditure:amount(summary.payments?.totals?.expenditure_cents),invoiceIncome:amount(summary.payments?.totals?.income_cents),invoiceDates:[summary.payments?.first_date||null,summary.payments?.last_date||null],missingFields:summary.payments?.missing_fields||{},duplicateGroups:summary.payments?.exact_duplicate_groups??null,planRows:summary.plans?.rows??null};
  }
  return {statement};
});
