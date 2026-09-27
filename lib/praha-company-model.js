(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PrahaCompanies=api;}(globalThis,function(){
  'use strict';
  // Hand-reviewed identity rules. Evidence dates remain visible; this is a
  // partial reviewed set, never an assertion that all other parties are private.
  const companies=[
    {ico:'02795281',name:'Operátor ICT, a.s.',sourceUrl:'https://operatorict.cz/informace/verejne-zakazky',evidencePeriod:'2023-08-08',ownership:'sole_shareholder'},
    {ico:'03447286',name:'Technická správa komunikací hl. m. Prahy, a.s.',sourceUrl:'https://www.tsk-praha.cz/o-nas/povinne-zverejnovane-informace/',evidencePeriod:'current publisher statement; checked 2026-09-27',ownership:'sole_shareholder'},
    {ico:'00005886',name:'Dopravní podnik hl. m. Prahy, a.s.',sourceUrl:'https://www.dpp.cz/spolecnost/o-spolecnosti/historie',evidencePeriod:'current publisher statement; checked 2026-09-27',ownership:'sole_shareholder'},
    {ico:'60194120',name:'Pražské služby, a.s.',sourceUrl:'https://www.psas.cz/upload/files/vyrocni-zprava-2024-final%281%29.pdf#page=66',evidencePeriod:'2024 annual report, page 66',ownership:'sole_shareholder'}
  ];
  function identify(ico){return typeof ico==='string'&&/^\d{8}$/.test(ico)?companies.find(c=>c.ico===ico)||null:null;}
  function group(rows){
    const identified=new Map(),unreviewed=[];
    for(const row of rows||[]){
      const company=identify(row.counterpartyId);
      if(!company){unreviewed.push(row);continue;}
      if(!identified.has(company.ico))identified.set(company.ico,{...company,rows:[]});
      identified.get(company.ico).rows.push(row);
    }
    return {companies:[...identified.values()].map(c=>{
      const cents=c.rows.map(r=>Number.isFinite(r.expenditure)?Math.round(r.expenditure*100):null);
      const complete=cents.every(v=>Number.isSafeInteger(v));
      const sum=complete?cents.reduce((s,v)=>s+v,0):null;
      return {...c,amount:complete&&Number.isSafeInteger(sum)?sum/100:null};
    }).sort((a,b)=>(b.amount??0)-(a.amount??0)),unreviewed};
  }
  return {identify,group,reviewedCompanies:companies};
}));
