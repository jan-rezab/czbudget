(function(root,factory){ const api=factory(typeof module==='object'&&module.exports?require('./praha-budget-model.js'):root.PrahaBudgetMath); if(typeof module==='object'&&module.exports) module.exports=api; else root.PrahaSpending=api; }(globalThis,function(budgetMath){
  'use strict';
  const itCodes=['5168','6111','6125','5042','5172'];
  const sum=rows=>rows.length&&rows.every(Number.isFinite)?rows.reduce((a,b)=>a+b,0):null;
  const expenditureClass=code=>String(code).startsWith('5')?'opex':String(code).startsWith('6')?'capex':'unclassified';
  function split(rows, value=r=>r.expenditure){
    return Object.fromEntries(['opex','capex','unclassified'].map(kind=>[kind,sum(rows.filter(r=>expenditureClass(r.itemCode)===kind).map(value))]));
  }
  function investigate(detail,payments,year,focus='all',selection={}){
    const matches=(item,paragraph)=>(focus==='it'?itCodes.includes(String(item)):focus==='all'||budgetMath.serviceFor(paragraph).id===focus)&&(!selection.item||String(item)===selection.item)&&(!selection.purpose||String(paragraph)===selection.purpose)&&(!selection.kind||expenditureClass(item)===selection.kind);
    const budgetDimension=selection.item||selection.kind||focus==='it'?'economic':'functional';
    const crossTabMissing=(selection.purpose&&budgetDimension==='economic')||(focus!=='all'&&focus!=='it'&&budgetDimension==='economic');
    const budget=crossTabMissing?[]:(detail?.rows||[]).filter(r=>r.year===year&&r.side==='expenditure'&&r.dimension===budgetDimension&&matches(r.code,r.code));
    const stages=Object.fromEntries(['approved','adjusted','actual'].map(stage=>{
      const rows=budget.filter(r=>r.stage===stage);
      return [stage,focus==='it'&&!itCodes.filter(code=>(!selection.item||code===selection.item)&&(!selection.kind||expenditureClass(code)===selection.kind)).every(code=>rows.some(r=>r.code===code))?null:sum(rows.map(r=>r.amount))];
    }));
    const accounting=(detail?.accountingRows||[]).filter(r=>r.year===year&&matches(r.itemCode,r.paragraphCode)&&(r.expenditure!==0||(Number.isFinite(r.income)&&r.income!==0)));
    const invoices=(payments?.rows||[]).filter(r=>r.year===year&&matches(r.itemCode,r.paragraphCode)&&r.expenditure!==0);
    const projects=new Map();
    for(const [kind,rows] of [['accounting',accounting],['invoices',invoices]]) for(const [index,row] of rows.entries()){
      const key=row.event?String(row.event):`unassigned:${kind}:${row.id||index}`;
      if(!projects.has(key)) projects.set(key,{key,code:row.event||'',name:row.eventName||'',accounting:[],invoices:[]});
      projects.get(key)[kind].push(row);
    }
    const result=[...projects.values()].map(project=>{
      const vendors=new Map();
      for(const [index,row] of project.invoices.entries()){
        const key=row.counterpartyId||`unidentified:${index}`;
        if(!vendors.has(key)) vendors.set(key,{key,ico:row.counterpartyId||'',name:row.counterparty||'',rows:[]});
        vendors.get(key).rows.push(row);
      }
      return {...project,amount:sum(project.accounting.map(r=>r.expenditure)),income:sum(project.accounting.map(r=>r.income)),invoiceAmount:sum(project.invoices.map(r=>r.expenditure)),vendors:[...vendors.values()].map(v=>({...v,amount:sum(v.rows.map(r=>r.expenditure))})).sort((a,b)=>(b.amount??0)-(a.amount??0))};
    }).sort((a,b)=>Math.abs(b.amount??b.invoiceAmount??0)-Math.abs(a.amount??a.invoiceAmount??0));
    return {stages,budget,accounting,invoices,projects:result};
  }
  function capitalSplit(historyRow){
    const opex=historyRow?.current_expense,capex=historyRow?.capital_expense,total=historyRow?.expense_actual;
    const valid=[opex,capex,total].every(Number.isFinite)&&total>0&&Math.abs(opex+capex-total)<.02;
    return {opex:Number.isFinite(opex)?opex:null,capex:Number.isFinite(capex)?capex:null,total:Number.isFinite(total)?total:null,reconciled:valid,opexShare:valid?opex/total:null,capexShare:valid?capex/total:null};
  }
  return {investigate,expenditureClass,split,capitalSplit};
}));
