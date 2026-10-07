// Accounting semantics belong here. The shared plotter owns all geometry.
export const SCHEMA = 'czech-economic-flows.v1';
const metric = (id, group, en, cs, basis = 'accrual') => ({id, group, en, cs, basis});
export const METRICS = [
  metric('gdp','production','Gross domestic product','Hrubý domácí produkt'),
  metric('output','production','Gross output','Produkce'),
  metric('intermediate','production','Intermediate consumption','Mezispotřeba'),
  metric('gva','production','Gross value added','Hrubá přidaná hodnota'),
  metric('product_taxes_net','production','Taxes less subsidies on products','Daně z produktů minus dotace'),
  metric('household_consumption','production','Household and nonprofit consumption','Spotřeba domácností a neziskových institucí'),
  metric('government_consumption','production','Government consumption','Spotřeba vládních institucí'),
  metric('investment','production','Gross capital formation','Hrubá tvorba kapitálu'),
  metric('fixed_investment','production','Fixed investment','Tvorba fixního kapitálu'),
  metric('inventories','production','Changes in inventories','Změna zásob'),
  metric('exports','production','Exports, national accounts','Vývoz podle národních účtů'),
  metric('imports','production','Imports, national accounts','Dovoz podle národních účtů'),
  metric('exports_goods','external','Goods exports','Vývoz zboží'),
  metric('exports_services','external','Services exports','Vývoz služeb'),
  metric('imports_goods','external','Goods imports','Dovoz zboží'),
  metric('imports_services','external','Services imports','Dovoz služeb'),
  metric('primary_received','external','Primary income received','Přijaté prvotní důchody'),
  metric('primary_paid','external','Primary income paid','Vyplacené prvotní důchody'),
  metric('secondary_received','external','Current transfers received','Přijaté běžné transfery'),
  metric('secondary_paid','external','Current transfers paid','Vyplacené běžné transfery'),
  metric('current_account','external','Current-account balance','Saldo běžného účtu'),
  metric('capital_account','external','Capital-account balance','Saldo kapitálového účtu'),
  metric('capital_received','external','Capital-account credits','Příjmy kapitálového účtu'),
  metric('capital_paid','external','Capital-account debits','Výdaje kapitálového účtu'),
  metric('financial_account','external','Financial-account balance','Saldo finančního účtu','net_financial'),
  metric('direct_investment','external','Direct investment, net assets less liabilities','Přímé investice, čistá aktiva minus pasiva','net_financial'),
  metric('portfolio_investment','external','Portfolio investment, net assets less liabilities','Portfoliové investice, čistá aktiva minus pasiva','net_financial'),
  metric('financial_derivatives','external','Financial derivatives, net','Finanční deriváty, čisté','net_financial'),
  metric('direct_assets','external','Direct investment: net acquisition of foreign assets','Přímé investice: čisté pořízení zahraničních aktiv','net_financial'),
  metric('direct_liabilities','external','Direct investment: net incurrence of foreign liabilities','Přímé investice: čistý vznik závazků vůči zahraničí','net_financial'),
  metric('portfolio_assets','external','Portfolio investment: net acquisition of foreign assets','Portfoliové investice: čisté pořízení zahraničních aktiv','net_financial'),
  metric('portfolio_liabilities','external','Portfolio investment: net incurrence of foreign liabilities','Portfoliové investice: čistý vznik závazků vůči zahraničí','net_financial'),
  metric('derivative_assets','external','Derivatives: net acquisition of foreign assets','Deriváty: čisté pořízení zahraničních aktiv','net_financial'),
  metric('derivative_liabilities','external','Derivatives: net incurrence of foreign liabilities','Deriváty: čistý vznik závazků vůči zahraničí','net_financial'),
  metric('other_assets','external','Other investment: net acquisition of foreign assets','Ostatní investice: čisté pořízení zahraničních aktiv','net_financial'),
  metric('other_liabilities','external','Other investment: net incurrence of foreign liabilities','Ostatní investice: čistý vznik závazků vůči zahraničí','net_financial'),
  metric('other_investment','external','Other investment, net assets less liabilities','Ostatní investice, čistá aktiva minus pasiva','net_financial'),
  metric('reserve_assets','external','Transactions in reserve assets','Transakce s rezervními aktivy','net_financial'),
  metric('errors_omissions','external','Net errors and omissions','Čisté chyby a opomenutí','net_financial'),
  metric('external_assets','external','International investment position: assets','Investiční pozice vůči zahraničí: aktiva','stock'),
  metric('external_liabilities','external','International investment position: liabilities','Investiční pozice vůči zahraničí: pasiva','stock'),
  metric('net_external_position','external','Net international investment position','Čistá investiční pozice vůči zahraničí','stock'),
  metric('wages','income','Compensation of employees, domestic employers','Náhrady zaměstnancům, domácí zaměstnavatelé'),
  metric('operating_surplus','income','Gross operating surplus and mixed income','Hrubý provozní přebytek a smíšený důchod'),
  metric('national_income','income','Gross national income','Hrubý národní důchod'),
  metric('household_income','income','Household disposable income','Disponibilní důchod domácností'),
  metric('household_saving','income','Household gross saving','Hrubé úspory domácností'),
  metric('national_saving','income','National gross saving','Hrubé národní úspory'),
  metric('government_revenue','government','General-government revenue','Příjmy vládních institucí'),
  metric('government_expenditure','government','General-government expenditure','Výdaje vládních institucí'),
  metric('government_balance','government','Government net lending / borrowing','Čisté půjčky / výpůjčky vlády'),
  metric('government_taxes','government','Government tax receipts','Daňové příjmy vládních institucí'),
  metric('government_contributions','government','Government net social contributions','Čisté sociální příspěvky vládním institucím'),
  metric('government_benefits','government','Cash social benefits','Peněžní sociální dávky'),
  metric('government_interest','government','Government interest payable','Úroky placené vládními institucemi'),
  metric('financial_assets','finance','Financial assets, whole economy','Finanční aktiva celé ekonomiky','stock'),
  metric('financial_liabilities','finance','Financial liabilities, whole economy','Finanční pasiva celé ekonomiky','stock'),
  metric('net_financial_worth','finance','Net financial worth','Čisté finanční jmění','stock'),
  metric('asset_transactions','finance','Net acquisition of financial assets','Čisté pořízení finančních aktiv','net_financial'),
  metric('liability_transactions','finance','Net incurrence of liabilities','Čistý vznik závazků','net_financial'),
  metric('net_lending','finance','Economy net lending / borrowing','Čisté půjčky / výpůjčky ekonomiky','net_financial'),
  metric('loan_assets','finance','Loans held as financial assets','Poskytnuté půjčky jako finanční aktiva','stock'),
  metric('loan_liabilities','finance','Loan liabilities','Závazky z půjček','stock'),
  metric('debt_securities','finance','Debt-security liabilities','Závazky z dluhových cenných papírů','stock'),
  metric('equity_liabilities','finance','Equity and investment-fund liabilities','Závazky z účastí a podílů ve fondech','stock'),
  metric('pension_insurance','finance','Insurance and pension liabilities','Pojistné a penzijní závazky','stock'),
  metric('m1','money','M1 · immediately available money','M1 · okamžitě dostupné peníze','stock'),
  metric('m2','money','M2 · M1 plus short-term deposits','M2 · M1 a krátkodobé vklady','stock'),
  metric('m3','money','M3 · broad money','M3 · široké peníze','stock'),
  metric('currency','money','Currency in circulation','Oběživo','stock'),
  metric('overnight_deposits','money','Overnight deposits','Jednodenní vklady','stock'),
  metric('private_credit','money','MFI credit to other residents','Úvěry MFI ostatním rezidentům','stock'),
  metric('government_credit','money','MFI credit to government','Úvěry MFI vládním institucím','stock'),
  metric('credit_transfers','payments','Credit-transfer value','Hodnota úhrad','payment'),
  metric('direct_debits','payments','Direct-debit value','Hodnota inkas','payment'),
  metric('card_payments','payments','Card-payment value','Hodnota karetních plateb','payment'),
  metric('emoney','payments','E-money payment value','Hodnota plateb elektronickými penězi','payment'),
  metric('cash_withdrawals','payments','Card cash withdrawals','Výběry hotovosti kartou','payment'),
  metric('certis','payments','CERTIS settlement turnover','Obrat vypořádání CERTIS','settlement'),
];
export const SECTORS = [
  {id:'S11',en:'Businesses',cs:'Podniky'}, {id:'S12',en:'Finance',cs:'Finance'},
  {id:'S13',en:'Government',cs:'Vláda'}, {id:'S14_S15',en:'Households & nonprofits',cs:'Domácnosti a neziskové instituce'},
  {id:'S2',en:'Rest of the world',cs:'Zahraničí'},
];
export const TRANSACTIONS = [
  {id:'D1',en:'Wages & contributions',cs:'Mzdy a příspěvky'},
  {id:'D4',en:'Interest & investment income',cs:'Úroky a investiční důchody'},
  {id:'D5',en:'Income & wealth taxes',cs:'Daně z příjmů a majetku'},
  {id:'D61',en:'Social contributions',cs:'Sociální příspěvky'},
  {id:'D62',en:'Cash social benefits',cs:'Peněžní sociální dávky'},
  {id:'D7',en:'Other current transfers',cs:'Ostatní běžné transfery'},
];
export function validateRelease(data) {
  if(data?.schema_version!==SCHEMA||data.country!=='CZE'||!data.release_id||!Array.isArray(data.observations)||!Array.isArray(data.sector_accounts)||!Array.isArray(data.years)||!data.years.length)throw new Error('Invalid economic-flow release');
  const ids=new Set(METRICS.map(m=>m.id)),keys=new Set();
  for(const row of [...data.observations,...data.sector_accounts]){
    if(!Number.isInteger(row.year)||!data.years.includes(row.year)||row.unit!=='CZK_million'||!/^https:\/\//.test(row.source_url||'')||!row.source_dataset||!row.source_code)throw new Error('Missing economic observation provenance');
    if(row.value!==null&&(!Number.isFinite(row.value)||typeof row.source_value!=='string'||!row.source_value.trim()||!row.source_unit||!row.coverage||!Number.isFinite(Number(row.source_value))))throw new Error('Invalid economic value');
    const sector=Boolean(row.sector);
    if(sector&&(!SECTORS.some(s=>s.id===row.sector)||!TRANSACTIONS.some(t=>t.id===row.transaction)||!['uses','resources'].includes(row.direction)))throw new Error('Invalid sector account');
    if(!sector&&(!ids.has(row.id)||METRICS.find(m=>m.id===row.id).basis!==row.basis))throw new Error('Invalid metric basis');
    const key=sector?`${row.year}:${row.sector}:${row.transaction}:${row.direction}`:`${row.year}:${row.id}`;
    if(keys.has(key))throw new Error('Duplicate economic observation');keys.add(key);
  }
  return data;
}
export function observation(data,id,year){return data?.observations?.find(r=>r.id===id&&r.year===year)??null;}
export function completeSum(values){return values.length&&values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0):null;}
export function borderModel(data,year){
  const incoming=['exports_goods','exports_services','primary_received','secondary_received'];
  const outgoing=['imports_goods','imports_services','primary_paid','secondary_paid'];
  const rows=ids=>ids.map(id=>({...METRICS.find(m=>m.id===id),observation:observation(data,id,year)}));
  const totalIn=completeSum(incoming.map(id=>observation(data,id,year)?.value));
  const totalOut=completeSum(outgoing.map(id=>observation(data,id,year)?.value));
  const computed=totalIn===null||totalOut===null?null:totalIn-totalOut;
  return {incoming:rows(incoming),outgoing:rows(outgoing),totalIn,totalOut,computed,reported:observation(data,'current_account',year)?.value??null};
}
export function sectorModel(data,year,transaction){
  const rows=direction=>SECTORS.map(sector=>({...sector,observation:data?.sector_accounts?.find(r=>r.year===year&&r.sector===sector.id&&r.transaction===transaction&&r.direction===direction)??null}));
  const uses=rows('uses'),resources=rows('resources');
  const paid=completeSum(uses.map(r=>r.observation?.value)),received=completeSum(resources.map(r=>r.observation?.value));
  return {uses,resources,paid,received,difference:paid===null||received===null?null:paid-received};
}
export function availableYears(data){return [...(data?.years||[])].sort((a,b)=>b-a);}
export function preferredYear(data){
  const years=availableYears(data),core=['gdp','exports_goods','exports_services','imports_goods','imports_services','primary_received','primary_paid','secondary_received','secondary_paid'];
  return years.find(y=>core.every(id=>Number.isFinite(observation(data,id,y)?.value)))??years[0]??null;
}
export function ledgerRows(data,year){return METRICS.map(m=>({...m,observation:observation(data,m.id,year)}));}
export function bopReconciliation(data,year){
  const ids=['current_account','capital_account','errors_omissions','financial_account'];
  const values=ids.map(id=>observation(data,id,year)?.value);
  return {ids,values,gap:values.every(Number.isFinite)?values[0]+values[1]+values[2]-values[3]:null};
}
export function annualLedgerRows(data,year,language='en'){
  const lang=language==='cs'?'cs':'en';
  const row=(id,label,source,extra={})=>({release_id:data?.release_id||'',id,label,year,geography:source?.geography||'CZE',sector:'',transaction:'',direction:'',basis:source?.basis||'accrual',value:source?.value??null,unit:'CZK_million',source_value:source?.source_value??'',source_unit:source?.source_unit??'',source_dataset:source?.source_dataset??'',source_code:source?.source_code??'',source_url:source?.source_url??'',coverage:source?.coverage??'',reference_date:source?.reference_date??'',status:source?.status??'',normalization:source?.normalization??'',...extra});
  const rows=METRICS.map(m=>row(m.id,m[lang],observation(data,m.id,year),{basis:m.basis}));
  for(const transaction of TRANSACTIONS)for(const sector of SECTORS)for(const direction of ['uses','resources']){
    const source=data?.sector_accounts?.find(r=>r.year===year&&r.sector===sector.id&&r.transaction===transaction.id&&r.direction===direction);
    rows.push(row(`${transaction.id}:${sector.id}:${direction}`,`${transaction[lang]} · ${sector[lang]}`,source,{sector:sector.id,transaction:transaction.id,direction}));
  }
  return rows;
}
export function serializeLedgerCSV(rows){
  if(!rows.length)return '';
  const columns=Object.keys(rows[0]);
  const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
  return '\ufeff'+[columns,...rows.map(row=>columns.map(key=>row[key]))].map(row=>row.map(quote).join(',')).join('\r\n');
}

export const BALANCE_VIEWS=[{id:'assets',stock:'financial_assets',flow:'asset_transactions',en:'Financial assets',cs:'Finanční aktiva'},{id:'liabilities',stock:'financial_liabilities',flow:'liability_transactions',en:'Financial liabilities',cs:'Finanční pasiva'}];
// All three source observations must exist for the same perimeter and successive years.
// The residual is a calculation, not an observed valuation or payment series.
export function balanceBridge(data,year,id='assets') {
  const view=BALANCE_VIEWS.find(v=>v.id===id)||BALANCE_VIEWS[0];
  const opening=observation(data,view.stock,year-1),transactions=observation(data,view.flow,year),closing=observation(data,view.stock,year);
  const complete=[opening,transactions,closing].every(r=>Number.isFinite(r?.value));
  return {view,year,opening,transactions,closing,complete,residual:complete?closing.value-opening.value-transactions.value:null,change:complete?closing.value-opening.value:null};
}
