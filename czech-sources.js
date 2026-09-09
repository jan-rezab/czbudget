(() => {
  const en=document.documentElement.lang==='en';
  const t=(cs,english)=>en?english:cs;
  const set=(id,value)=>{document.getElementById(id).textContent=value;};
  document.title=t('Česká zdrojová data','Czech source data')+' — Public Spending Data';
  set('source-eyebrow','Public Spending Data · '+t('Česko','Czechia'));
  set('source-title',t('Česká zdrojová data','Czech source data'));
  set('source-intro',t('Původní tabulky, podrobnější záznamy a jejich účetní význam.','Original tables, detailed records and their accounting meaning.'));
  set('city-title',t('CityVizor: obce a jejich organizace','CityVizor: municipalities and their organizations'));
  set('city-definition',t('Záznam může popisovat fakturu nebo její rozúčtování. Nejde automaticky o jedinečnou fakturu, účtenku ani samostatnou bankovní platbu. Rozpočty, účetnictví příspěvkových organizací, platby a smlouvy se navzájem překrývají a nesčítají se.','A record can describe an invoice or its accounting allocation. It does not necessarily identify a unique invoice, receipt or individual bank payment. Budgets, municipal organization accounts, payments and contracts overlap and must not be added together.'));
  set('city-search-label',t('Název nebo IČO','Name or organization ID'));
  set('city-head-name',t('Organizace','Organization'));set('city-head-years',t('Roky a exporty','Years and exports'));set('city-head-records',t('Záznamy plateb','Payment records'));
  set('city-more',t('Zobrazit dalších 30','Show 30 more'));
  set('city-download-note',t('Roční odkazy vedou na živé ZIP exporty CityVizoru (účetnictví, akce a platby). Účetní plány a platby příspěvkových organizací mají samostatné API a jsou zahrnuty v místním archivu. Katalog uchovává kontrolní součty archivované verze; dnešní export se může lišit. Binární přílohy smluv a úřední desky nejsou součástí archivu.','Year links open live CityVizor ZIP exports (accounting, events and payments). Municipal organization plans and payments use separate APIs and are included in the local archive. The catalogue preserves archived checksums; live exports can differ. Contract and noticeboard attachment binaries are outside the archive.'));
  set('city-manifest',t('Katalog a kontrolní součty','Catalogue and checksums'));
  set('datasets-title',t('Další podrobné české zdroje','More detailed Czech sources'));
  set('datasets-definition',t('Každý soubor zachovává svůj rozsah, období a finanční fázi. Původní tabulky mohou obsahovat součty i jejich podrobnosti; nejsou určeny k plošnému sčítání.','Each file retains its scope, period and financial stage. Native tables can contain both totals and their components; summing every row would double count.'));
  set('coverage-back',t('Pokrytí a metodika','Coverage and methodology'));
  const link=(text,url)=>{const a=document.createElement('a');a.textContent=text;a.href=url;return a;};
  const datasets=[
    ['Kontrola obecních součtů','Municipal reconciliation','czech-municipal-reconciliation.v1.json','Kontrola všech obcí vůči čerstvému exportu MONITOR včetně zdrojových rozdílů.','All municipalities checked against a fresh MONITOR export, including source discrepancies.'],
    ['Měsíční rozpočet MF','MF monthly budget','czech-mf-monthly-2026.v1.json','Kumulované plnění roku 2026; budoucí měsíce zůstávají prázdné.','Cumulative 2026 execution; future months remain missing.'],
    ['Zaměstnanci státu','State employees','czech-mf-employment-2025.v1.json','Skutečnost 2025 a původní rozpočtové fáze; rozsah státem regulovaných platů.','2025 actuals and native budget stages; state-regulated-pay perimeter.'],
    ['Rozpočty MF','MF budgets','czech-mf-budget-detail.v1.json','Skutečnost, schválený rozpočet a návrh odděleně; původní přílohy.','Actuals, approved budget and proposal kept separate; native annexes.'],
    ['Účetní závěrky ČEZ 2025','ČEZ 2025 financial statements','cez-issuer-2025.v1.json','Skupinové a individuální účetní závěrky odděleně; původní ESEF kontexty.','Group and individual financial statements kept separate; native ESEF contexts.'],
    ['Historie okruhu konsolidace','Consolidation perimeter history','czech-mf-perimeter-history.v1.json','Skutečný seznam 2020, deklarované registry 2016–2023 a změny odděleně; mezery přiznány.','Actual 2020 list, declared 2016–2023 registers and changes kept separate; gaps disclosed.'],
    ['Konsolidované účty','Consolidated accounts','czech-consolidated-accounts.v1.json','Účetní výkazy 2016–2024 a původní okruh konsolidace 2024.','2016–2024 financial statements and the native 2024 consolidation perimeter.'],
    ['MONITOR 2026','MONITOR 2026','czech-monitor-2026.v1.json','FINM2026 včetně partnerů transferů; nejde o všeobecný registr faktur.','FINM2026 including transfer partners; not a universal invoice register.'],
    ['Dotace MONITOR','MONITOR grants','czech-monitor-grants.v1.json','Měsíční záznamy vyplacených dotací a návratných výpomocí.','Monthly paid grants and repayable assistance records.'],
    ['DotaceEU','DotaceEU','czech-dotaceeu-operations.v1.json','Projekty a zakázky; stejné projekty se mohou opakovat.','Projects and procurements; project rows may repeat.'],
    ['IS ReD','IS ReD','czech-isred-grants.v1.json','Pět hlavních tabulek: příjemci, dotace, rozhodnutí, období a poskytovatelé.','Five core tables: recipients, grants, decisions, annual periods and providers.'],
    ['Školy 2026','Schools 2026','cze-school-funding-2026-summary.v1.json','Přidělené prostředky podle RED_IZO; nikoli konečné výdaje.','Allocated funding by RED_IZO; not final spending.'],
    ['Důchody ČSSZ','ČSSZ pensions','cze-pension-tables-2025.v1.json','Všech 14 sešitů s původními tabulkami a souřadnicemi buněk.','All 14 workbooks with native tables and cell locations.'],
    ['Úhrady léčiv','Medicine reimbursements','cze-medicine-reimbursements-summary.v1.json','Pouze vymezený soubor NR-04-17; pacienti se mezi skupinami nesčítají.','Scoped NR-04-17 dataset; patient counts are not additive across groups.'],
    ['Průmysl ČSÚ','ČSÚ industry','industry/CZE.json','Měsíční a čtvrtletní historie, původní jednotky a klasifikace.','Monthly and quarterly history, native units and classifications.'],
    ['Peníze ČNB ARAD','ČNB ARAD money','money-reports/cze-arad-native.v1.json','Stavy, tempa růstu a transakční toky odděleně.','Levels, growth rates and transaction flows kept separate.'],
    ['Vymezení obranných výdajů','Defense expenditure definitions','czech-defense-definitions.v1.json','NATO včetně označených odhadů a skutečné výdaje kapitoly 307 jako oddělené řady.','NATO including flagged estimates and chapter 307 actual expenditure as separate series.'],
    ['Obrana SIPRI','SIPRI defense','czech-sipri-military-expenditure.v1.json','Přímá revidovaná řada SIPRI do roku 2025.','Direct revised SIPRI series through 2025.'],
    ['Příspěvek na státní správu','State administration grants','mv-administration-grants.v1.json','Původní tabulky MV za roky 2006–2025.','Native Ministry of Interior tables for 2006–2025.'],
    ['Investice a silniční mapa','Investment and road geography','czech-project-geography.v1.json','Původní záznamy investiční mapy Plzně a majetku ŘSD; geometrie není finanční plnění.','Native Plzeň investment-map and ŘSD asset records; geometry does not establish spending.'],
    ['Projekty SFDI','SFDI projects','czech-sfdi-financing.v1.json','Upravený rozpočet a uvolněné prostředky; nikoli faktury dodavatelů.','Revised budget and released funds; not supplier invoices.'],
    ['Rozpočty SFDI','SFDI budgets','czech-sfdi-budget-tables.v1.json','Původní přílohy rozpočtů a výhledů.','Native budget and outlook annexes.'],
    ['Registr smluv','Official contract registry','contracts/official-registry/lineage.v1.json','Historie verzí smluv Plzně, ŘSD a Správy železnic z oficiálních měsíčních souborů; nejde o všechny zadavatele.','Contract version history for Plzeň, ŘSD and Správa železnic from official monthly dumps; not all buyers.'],
    ['Kontroly NKÚ','NKÚ audits','czech-nku.v1.json','Výběrové kontroly a kontrolované osoby; nikoli plošná míra pochybení.','Selective audits and audited entities; not a national wrongdoing rate.']
  ];
  const cards=document.getElementById('source-datasets');
  for(const [cs,english,path,csNote,enNote] of datasets){const card=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p');h.append(link(t(cs,english),'/data/'+path));p.textContent=t(csNote,enNote);card.append(h,p);cards.append(card);}
  let data,limit=30;
  document.getElementById('city-search').value=new URLSearchParams(location.search).get('ico')||'';
  const format=n=>n.toLocaleString(en?'en-GB':'cs-CZ');
  const searchText=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  function render(){
    const q=searchText(document.getElementById('city-search').value.trim());
    const rows=data.profiles.filter(p=>searchText(p.name+' '+(p.ico||'')).includes(q)).sort((a,b)=>(a.type==='municipality'?0:1)-(b.type==='municipality'?0:1)||a.name.localeCompare(b.name,en?'en':'cs'));
    set('city-result-count',t('Nalezeno: ','Matches: ')+format(rows.length));
    const body=document.getElementById('city-rows');body.replaceChildren();
    for(const p of rows.slice(0,limit)){
      const tr=document.createElement('tr'),name=document.createElement('td'),ico=document.createElement('td'),years=document.createElement('td'),count=document.createElement('td'),kind=document.createElement('small');
      name.append(link(p.name,p.profile_url));kind.textContent=p.type==='municipality'?t('Samospráva','Municipality or region'):t('Příspěvková organizace','Municipal organization');kind.textContent+=' · '+new URL(p.instance).hostname;name.append(kind);ico.textContent=p.ico||'—';
      const yearLinks=document.createElement('div');yearLinks.className='source-years';for(const y of p.years)yearLinks.append(link(String(y.year),y.bulk_export_url));years.append(yearLinks);
      if(p.years.some(y=>y.json_payment_recovery)){const note=document.createElement('small');note.textContent=t('Archiv obsahuje opravu vadného CSV pomocí původního JSON API; viz katalog.','The archive includes native JSON recovery for a malformed source CSV; see the catalogue.');years.append(note);}
      if(p.type==='pbo'){const a=link(t('Plány API','Plans API'),p.instance+'/api/public/profiles/'+p.id+'/plans');years.append(a);years.append(document.createElement('br'));years.append(link(t('Platby API','Payments API'),p.instance+'/api/public/profiles/'+p.id+'/payments?limit=100&offset=0'));}
      count.textContent=format(p.type==='pbo'?p.pbo_payment_rows:p.years.reduce((n,y)=>n+y.records.payments,0));tr.append(name,ico,years,count);body.append(tr);
    }
    document.getElementById('city-more').hidden=limit>=rows.length;
  }
  document.getElementById('city-search').addEventListener('input',()=>{limit=30;if(data)render();});
  document.getElementById('city-more').addEventListener('click',()=>{limit+=30;render();});
  fetch('/data/cityvizor-catalogue.v1.json').then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json();}).then(value=>{data=value;set('city-stats',format(data.profile_count)+t(' profilů · ',' profiles · ')+format(data.profile_years)+t(' kombinací profilu a roku · ',' profile-year exports · ')+format(data.profiles_with_payment_rows)+t(' profilů se záznamy plateb · archiv dokončen ',' profiles with payment records · archive completed ')+data.snapshot_completed_at.slice(0,10));render();}).catch(()=>set('city-stats',t('Katalog se nepodařilo načíst.','The catalogue could not be loaded.')));
})();
