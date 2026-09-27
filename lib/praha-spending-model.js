(function(root,factory){ const api=factory(typeof module==='object'&&module.exports?require('./praha-budget-model.js'):root.PrahaBudgetMath); if(typeof module==='object'&&module.exports) module.exports=api; else root.PrahaSpending=api; }(globalThis,function(budgetMath){
  'use strict';
  const itCodes=['5168','6111','6125','5042','5172'];
  const sum=rows=>rows.length&&rows.every(Number.isFinite)?rows.reduce((a,b)=>a+b,0):null;
  function investigate(detail,payments,year,focus='all'){
    const matches=(item,paragraph)=>focus==='it'?itCodes.includes(String(item)):focus==='all'||budgetMath.serviceFor(paragraph).id===focus;
    const budget=(detail?.rows||[]).filter(r=>r.year===year&&r.side==='expenditure'&&r.dimension===(focus==='it'?'economic':'functional')&&matches(r.code,r.code));
    const stages=Object.fromEntries(['approved','adjusted','actual'].map(stage=>{
      const rows=budget.filter(r=>r.stage===stage);
      return [stage,focus==='it'&&!itCodes.every(code=>rows.some(r=>r.code===code))?null:sum(rows.map(r=>r.amount))];
    }));
    const accounting=(detail?.accountingRows||[]).filter(r=>r.year===year&&matches(r.itemCode,r.paragraphCode)&&r.expenditure!==0);
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
      return {...project,amount:sum(project.accounting.map(r=>r.expenditure)),invoiceAmount:sum(project.invoices.map(r=>r.expenditure)),vendors:[...vendors.values()].map(v=>({...v,amount:sum(v.rows.map(r=>r.expenditure))})).sort((a,b)=>(b.amount??0)-(a.amount??0))};
    }).sort((a,b)=>Math.abs(b.amount??b.invoiceAmount??0)-Math.abs(a.amount??a.invoiceAmount??0));
    return {stages,budget,accounting,invoices,projects:result};
  }
  return {investigate};
}));
