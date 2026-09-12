import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/czech-mf-budget-detail.v1.json', root)));
const workbook = data.workbooks.find(w => w.archive_member === 'F_01_Tabulková část SR 2027.xlsx');
const table = name => workbook.sheets.find(s => s.name === name).rows;
const expenseRows = table('Tab.2 - výdaje odvětvově');
const revenueRows = table('Tab.1 - příjmy');
for (const rows of [expenseRows, revenueRows]) {
  if (rows.find(r => r.source_row === 8).cells[6] !== 2026) throw new Error('Expected the 2026 budget column.');
}
const en = Object.fromEntries(`101|Agricultural and food production
102|Agricultural markets and support
103|Forestry
106|Agricultural administration
108|Agricultural and forestry research
109|Other agricultural activities
211|Mining and energy
212|Industry and construction
213|Foreign trade
214|Domestic trade, services and tourism
216|Industry and energy administration
218|Industrial research and development
219|Other industrial activities
221|Road infrastructure
222|Road transport
223|Inland and maritime navigation
224|Rail transport
225|Civil aviation
226|Transport administration
227|Other rail systems
228|Transport research
229|Other transport activities
231|Drinking water
232|Wastewater collection and treatment
233|Watercourses and water infrastructure
234|Water in agricultural landscapes
241|Communications services
246|Communications administration
249|Other communications activities
253|General financial affairs
254|General economic services
256|Economic administration
258|General economic research
259|Other economic activities
311|Preschool and basic education
312|Secondary schools and conservatoires
313|Institutional and protective education
314|Other youth education facilities
315|Higher vocational education
321|Higher education
323|Arts, languages and leisure education
326|Education administration
329|Other and unspecified education spending
331|Culture
332|Monuments and cultural heritage
333|Registered churches and religious groups
334|Media
336|Culture and media administration
338|Culture and media research
339|Other cultural activities
341|Sport
342|Leisure and recreation
346|Sports administration
348|Sport and recreation research
351|Outpatient care
352|Inpatient care
353|Special medical facilities and services
354|Health programmes
356|Healthcare administration
358|Medical research and development
359|Other healthcare activities
361|Housing development and management
363|Municipal services and spatial development
366|Housing and development administration
369|Other housing and development activities
371|Air and climate protection
372|Waste management
373|Soil and groundwater remediation
374|Nature and landscape protection
376|Environmental administration
377|Radiation protection
378|Environmental research
379|Other environmental activities
380|Other research and development
411|Pension insurance benefits
412|Sickness insurance benefits
413|Social support and foster-care benefits (413)
414|Social support and foster-care benefits (414)
415|Armed forces and security service benefits
417|Material-need benefits
418|Disability benefits
419|Other social-security benefits
421|Unemployment benefits
422|Active labour-market policies
423|Protection against employer insolvency
424|Employment support for disabled people
425|Support for restructuring impacts
431|Social counselling
432|Support for children and young people
433|Support for marriage and families
434|Social rehabilitation and other assistance
435|Social care services
436|Social and employment administration
438|Social policy research
439|Other social services
511|Military defence
516|Defence administration
517|Armed forces support
518|Defence research and development
519|Other defence activities
521|Protection of people
522|Economic measures for emergencies
526|Emergency economic administration
527|Crisis management
528|Civil preparedness research
529|Other civil preparedness activities
531|Public order and safety
538|Public safety research
539|Other public safety activities
541|Constitutional justice
542|Courts
543|Public prosecution
544|Prisons
545|Probation and mediation
546|Justice administration
547|Public rights protection
549|Other justice activities
551|Fire protection
552|Other integrated rescue services
556|Fire and rescue administration
558|Fire and rescue research
559|Other fire and rescue activities
611|Representative bodies and elections
612|Office of the President
613|Supreme Audit Office
614|General domestic administration
615|Foreign service and external affairs
618|Public administration research
619|Political parties and movements
621|Other public services
622|Foreign aid and international cooperation
631|General financial operations
639|Other financial operations
640|Other activities`.split('\n').map(line => line.split('|')));
const purposes = {};
const prefixes = {10:'agriculture',21:'industry_trade',22:'transport',23:'water_communications',24:'water_communications',25:'general_economic',31:'education',32:'education',33:'culture_media',34:'sport',35:'health',36:'housing',37:'environment',38:'research',43:'social_services',51:'defence',52:'civil_preparedness',53:'public_order',54:'legal_protection',55:'fire_rescue',61:'public_administration',62:'financial_operations',63:'financial_operations',64:'financial_operations'};
const singles = {411:'pensions',412:'sickness',413:'state_social_support',414:'state_social_support',415:'service_benefits',417:'material_need_disability',418:'material_need_disability',419:'other_social',421:'unemployment',422:'active_employment',423:'employee_protection',424:'disabled_employment',425:'disabled_employment'};
for (const row of expenseRows) {
  const match = String(row.cells[1]).match(/^(\d{3})\s+([\s\S]+)/);
  if (!match || !(row.cells[6] > 0)) continue;
  const [, code, label] = match;
  const purpose = singles[code] || prefixes[code.slice(0,2)];
  if (!purpose || !en[code]) throw new Error(`Unmapped functional code ${code}`);
  (purposes[purpose] ||= []).push({ id: code, label_cs: label.replace(/\s+/g,' ').trim(), label_en: en[code], value: row.cells[6] / 1e9, source_row: row.source_row, source_code: code });
}
const rv = row => revenueRows.find(r => r.source_row === row).cells[6] / 1e9;
const r = (id, row, cs, en) => ({id, value:rv(row),label_cs:cs,label_en:en,source_row:row});
const revenueChildren = {
  personal_income_tax:[r('1111',11,'Daň ze zaměstnání placená plátci','Employment income tax'),r('1112',12,'Daň placená poplatníky','Tax paid through individual returns'),r('1113',13,'Daň vybíraná srážkou','Withholding income tax')],
  insurance:[r('pension_insurance',35,'Pojistné na důchodové pojištění','Pension insurance contributions'),{id:'other_insurance',value:rv(34)-rv(35),label_cs:'Ostatní povinné sociální pojistné a příspěvky',label_en:'Other compulsory social contributions',source_row:34,derived:'row 34 minus row 35'}],
  other_income:[r('non_tax',68,'Nedaňové příjmy','Non-tax revenue'),r('capital_income',74,'Kapitálové příjmy','Capital receipts'),r('current_transfers',85,'Přijaté neinvestiční transfery','Current transfers received'),r('capital_transfers',94,'Přijaté investiční transfery','Capital transfers received')],
  other_taxes:[r('113',15,'Další přímé daně','Other direct taxes'),r('132',21,'Daně z provozu vozidel','Motor vehicle taxes'),r('133',22,'Ekologické poplatky a odvody','Environmental fees and levies'),r('135',24,'Další odvody z činností a služeb','Other activity and service levies'),r('136',25,'Správní a soudní poplatky','Administrative and court fees'),r('137',26,'Poplatky na činnost úřadů','Regulatory fees'),r('138',27,'Daně z hazardních her','Gambling taxes'),r('140',29,'Daně a cla ze zahraničí','Foreign-trade taxes and duties'),r('170',37,'Ostatní daňové příjmy','Other tax revenue')],
};
revenueChildren.other_income[0].children = [r('own_activity',46,'Vlastní činnost a odvody organizací','Own activities and organisational remittances'),r('penalties',49,'Sankce a vratky transferů','Penalties and returned transfers'),r('other_non_tax',56,'Ostatní nedaňové příjmy a prodej majetku','Other non-tax receipts and asset sales'),r('loan_repayments',65,'Přijaté splátky půjček','Loan repayments received'),r('shared_eu',67,'Příjmy sdílené s EU','Revenue shared with the EU')];
const total = expenseRows.find(row => row.source_row === 195).cells[6] / 1e9;
const sum = rows => rows.reduce((a,b)=>a+b.value,0);
if (Math.abs(sum(Object.values(purposes).flat())-total)>1e-6) throw new Error('Leaf expenditure does not match total.');
const output = {year:2026,stage:'approved_budget',unit:'CZK_bn',source:{...data.source, workbook:workbook.archive_member, column:'2026 state budget', expenditure_table:'Tab.2 - výdaje odvětvově',revenue_table:'Tab.1 - příjmy'},total,revenue:rv(97),income_values:{insurance:rv(34),vat:rv(18),corporate_income_tax:rv(14),personal_income_tax:rv(10),excise_and_energy_taxes:rv(19),other_income:rv(96),other_taxes:sum(revenueChildren.other_taxes)},purposes,revenue_children:revenueChildren};
const path = new URL('data/money-flow-detail-2026.v1.json',root);
writeFileSync(path,JSON.stringify(output,null,2)+'\n');
console.log(`${fileURLToPath(path)}: ${Object.keys(purposes).length} purposes / ${Object.values(purposes).flat().length} detailed items`);
