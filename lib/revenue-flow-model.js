/* Editorial, cited country examples alongside the published OECD profile.
 * No loading or inferred source-to-recipient matrices. */
(function (root) {
  'use strict';
  const references = {
    vat: ['Financial Administration · 2023 · graph 1', 'https://financnisprava.gov.cz/assets/cs/prilohy/fs-financni-sprava-cr/vyrocni-zprava-o-cinnosti-financni-spravy-2023.pdf#page=6'],
    property: ['Financial Administration · 2023 · table 17', 'https://financnisprava.gov.cz/assets/cs/prilohy/fs-financni-sprava-cr/vyrocni-zprava-o-cinnosti-financni-spravy-2023.pdf#page=11'],
    state: ['Ministry of Finance · 2023 final account C · table 5', 'https://mf.gov.cz/assets/attachments/2024-04-29_C-Zprava-o-vysledcich-hospodareni-statniho-rozpoctu.pdf#page=18'],
    funds: ['Ministry of Finance · 2023 final account F · table 6', 'https://mf.gov.cz/assets/attachments/2024-04-29_F-Zprava-o-hospodareni-dalsich-slozek-verejnych-rozpoctu-a-o-fondech-organizacnich-slozek-statu.pdf#page=28'],
    local: ['Ministry of Finance · January–December 2023', 'https://mf.gov.cz/cs/rozpoctova-politika/uzemni-rozpocty/hospodareni-uzemnich-rozpoctu/mesicni-zpravy-o-hospodareni-uzemnich-ro/2023/zprava-o-vyvoji-rozpoctoveho-hospodareni-55251'],
    health: ['Ministries of Health & Finance · 2023 · table 1', 'https://mzd.gov.cz/wp-content/uploads/2024/06/vz2023_hodnoceni.pdf#page=5'],
    germany: ['BMF · March 2024 · provisional 2023 results', 'https://www.bundesfinanzministerium.de/Monatsberichte/Ausgabe/2024/03/Inhalte/Kapitel-3-Analysen/3-1-bund-laender-finanzausgleich-2023.html'],
    oecd: ['OECD Global Revenue Statistics · DF_RSGLOBAL, 2.1', 'https://sdmx.oecd.org/public/rest/v1/data/OECD.CTP.TPS,DSD_REV_COMP_GLOBAL@DF_RSGLOBAL,2.1/'],
  };
  const labels = {
    vat:['DPH','VAT'],national:['Ostatní státní daně','Other state taxes'],property:['Daň z nemovitých věcí','Property tax'],social:['Sociální pojištění','Social insurance'],health:['Zdravotní pojistné','Health contributions'],
    central:['Státní rozpočet','State budget'],funds:['Státní fondy','State funds'],regions:['Kraje','Regions'],municipal:['Obce','Municipalities'],insurers:['Zdravotní pojišťovny','Health insurers'],
    personal_income:['Daň z příjmů fyzických osob','Personal income tax'],corporate_income:['Daň z příjmů právnických osob','Corporate income tax'],excise:['Spotřební daně','Excise taxes'],social_security:['Sociální příspěvky','Social contributions'],other:['Ostatní daně','Other taxes'],
  };
  const czechSources = [
    {id:'vat',amount:'567.17',ref:'vat',allocation:{central:['365.14',64.38],regions:['55.47',9.78],municipal:['146.56',25.84]}},
    {id:'national',amount:'573.0',ref:'state',allocation:{central:['573.0',100]}},
    {id:'property',amount:'12.4519',ref:'property',allocation:{municipal:['12.4519',100]}},
    {id:'social',amount:'689.2',ref:'state',allocation:{central:['689.2',100]}},
    {id:'health',amount:'319.96',ref:'health',allocation:{insurers:['319.96',100]}},
  ];
  const czechRecipients = [
    {id:'central',amount:'1914.1',ref:'state'},
    {id:'funds',amount:'222.186412',ref:'funds'},
    {id:'regions',amount:'356.8',ref:'local'},
    {id:'municipal',amount:'493.1',ref:'local'},
    {id:'insurers',amount:'467.52',ref:'health'},
  ];
  function euros(amount,currency,year,fx){
    if(amount===null||amount===undefined||amount==='')return null;
    const value=Number(amount),rate=currency==='EUR'?1:Number(fx?.rates?.[currency]?.[year]?.value);
    return Number.isFinite(value)&&Number.isFinite(rate)&&rate>0?{value:value/rate,rate,currency,year,source_url:currency==='EUR'?null:fx.source_url}:null;
  }
  function build({code,profile,lang='en',source=null,recipient=null,cashExample=false,currency='native',fx=null}) {
    const en=lang==='en', tr=(cs,english)=>en?english:cs, label=id=>labels[id]?.[en?1:0]||id;
    const money=tr('mld. Kč','CZK bn'), shareUnit=tr('% všech daní','% of all taxes');
    const national=code==='CZE',germanExample=code==='DEU'&&cashExample;
    const sourceList=national?czechSources.map(s=>({...s,label:label(s.id),unit:money})):germanExample?[{id:'vat',label:label('vat'),amount:'291.4',unit:'EUR bn',ref:'germany'}]:Object.entries(profile.tax_detail||{}).map(([id,value])=>({id,label:id==='property'?tr('Majetkové daně','Property taxes'):label(id),amount:Number.isFinite(value)?String(value):null,unit:shareUnit,ref:'oecd'}));
    const levelLabel={central:tr('Ústřední vláda','Central government'),state:tr('Regionální / státní vláda','State / regional government'),local:tr('Místní vláda','Local government'),social_security:tr('Fondy sociálního zabezpečení','Social-security funds')};
    if(code==='DEU')Object.assign(levelLabel,{central:tr('Spolková vláda','Federation'),state:'Länder',local:tr('Obce','Municipalities')});
    if(code==='USA')Object.assign(levelLabel,{central:tr('Federální vláda','Federal government'),state:tr('Státy','States'),local:tr('Místní samosprávy','Local governments')});
    if(code==='SWE')levelLabel.local=tr('Regiony a obce','Regions & municipalities');
    const recipientList=national?czechRecipients.map(r=>({...r,label:label(r.id),unit:money})):germanExample?['central','state','local'].map(id=>({id,label:levelLabel[id],amount:null,unit:tr('% DPH','% of VAT'),ref:'germany'})):Object.entries(profile.government_levels||{}).filter(([,value])=>Number.isFinite(value)).map(([id,value])=>({id,label:levelLabel[id]||id,amount:String(value),unit:shareUnit,ref:'oecd'}));
    const selected=sourceList.find(s=>s.id===source)||(germanExample?sourceList[0]:null);
    let allocation=selected?.allocation, selectedUnit=selected?.unit;
    // Preserve the BMF's rounded shares. Do not fabricate currency allocations
    // by multiplying the separately rounded national total by those percentages.
    if(code==='DEU'&&(profile.latest_year===2023||germanExample)&&selected?.id==='vat') {
      allocation={central:['47.5',47.5],state:['49.7',49.7],local:['2.8',2.8]};
      selectedUnit=tr('% DPH','% of VAT'); selected.ref='germany';
      selected.meta=tr('291,4 mld. EUR · 2023 · předběžně','EUR 291.4bn · 2023 · provisional');
    }
    const known=Boolean(allocation), zero=selected?.amount!==null&&Number(selected?.amount)===0;
    const sourceNotes={
      vat:tr('Celostátní výnos · prvotní rozdělení','National receipts · initial allocation'),
      national:tr('Jen státní podíl · výpočet','State share only · calculation'),
      property:tr('Celostátní výnos','National receipts'),
      social:tr('Příjem státního rozpočtu','State-budget receipts'),
      health:tr('Přímo vybrané pojistné','Direct premium collections'),
    };
    const sources=sourceList.map(s=>({...s,nodeId:'source-'+s.id,meta:s.meta||(national?sourceNotes[s.id]:shareUnit),selected:s.id===selected?.id,muted:Boolean(selected&&selected.id!==s.id)}));
    const recipients=recipientList.map(r=>{
      const a=allocation?.[r.id];
      return {...r,nodeId:'recipient-'+r.id,amount:selected?(a?.[0]??null):r.amount,unit:selected?(a?selectedUnit:''):r.unit,share:a?.[1]??null,selected:!selected&&recipient===r.id,muted:Boolean(selected&&!a),meta:selected?(a?tr('Podíl vybraného zdroje','Share of selected source'):known?tr('Bez přímého podílu','No direct allocation'):zero?tr('Žádný výnos k rozdělení','No receipts to allocate'):tr('Rozdělení není dostupné','Allocation unavailable')):national?tr('Hrubé příjmy','Gross receipts'):tr('Přiřazení OECD','OECD attribution')};
    });
    const routeNodes=[{nodeId:'collection',label:tr('Výběr a rozdělení','Collect & allocate'),meta:national?tr('Celostátní výběr daní','National tax collection'):tr('Přiřazení příjmů','Revenue attribution')},{nodeId:'budget',label:tr('Rozpočet státu','State budget'),meta:tr('Vlastní výdaje a další transfery','Own spending and onward transfers')}];
    const edges=[];
    const edge=(from,to,kind='tax',active=true)=>edges.push({from,to,kind,active});
    if(national){
      for(const s of sources){const target=s.id==='health'?'recipient-insurers':['social','national'].includes(s.id)?'budget':'collection';edge(s.nodeId,target,['social','health'].includes(s.id)?'contribution':'tax',!selected||s.id===selected.id);}
      edge('collection','budget','tax',!selected||selected.id==='vat');
      edge('budget','recipient-central','tax',!selected||Boolean(allocation?.central));
      edge('collection','recipient-regions','tax',!selected||Boolean(allocation?.regions));
      edge('collection','recipient-municipal','tax',!selected||Boolean(allocation?.municipal));
      for(const r of ['funds','regions','municipal','insurers'])edge('budget','recipient-'+r,'transfer',!selected);
      edge('recipient-regions','recipient-municipal','transfer',!selected);
    }else{
      routeNodes.splice(1,1);
      // Aggregate totals can meet at the pool, but a selected tax gets no
      // outgoing routes unless its own allocation is independently supplied.
      for(const s of sources)if(s.amount!==null&&Number(s.amount)>0)edge(s.nodeId,'collection',s.id==='social_security'?'contribution':'tax',!selected||s.id===selected.id);
      for(const r of recipients)if(!selected||allocation?.[r.id])edge('collection',r.nodeId,'tax',true);
    }
    if(!national&&!selected){
      const sectorIds={S1311:'central',S1312:'state',S1313:'local',S1314:'social_security'};
      const pairs=new Set();
      for(const r of profile.transfer_evidence||[]){
        if(r.layer!=='esa_transfers'||!r.category.includes('_S131'))continue;
        const from=sectorIds[r.sector],to=sectorIds[r.category.split('_').at(-1)];
        if(from&&to&&from!==to&&Number(r.value)>0&&recipients.some(n=>n.id===from)&&recipients.some(n=>n.id===to)&&!pairs.has(from+to)){
          edge('recipient-'+from,'recipient-'+to,'transfer',true);pairs.add(from+to);
        }
      }
    }
    let note=national?tr('Hrubé příjmy obsahují vzájemné transfery: součty příjemců nesčítejte. Vybrané zdroje nepokrývají všechny příjmy.','Gross receipts overlap through transfers: do not add recipient totals. Selected sources do not cover all revenue.'):tr('Podíly OECD před transfery. Údaje o zdrojích a příjemcích nejsou společnou maticí; chybějící rozdělení daně neodhadujeme.','OECD shares before transfers. Source and recipient totals are not a joint matrix; missing tax allocations are not estimated.');
    if(selected&&known)note=tr('Prvotní rozdělení. Pozdější granty nelze přiřadit právě této dani; pohyb částic ukazuje směr, nikoliv objem ani rychlost peněz.','Initial allocation. Later grants cannot be traced to this particular tax; moving particles indicate direction, not money volume or speed.');
    if(national&&selected?.id==='national')note=tr('Výpočet: 938,1 daně a poplatky − 365,1 státní příjem z DPH = 573,0 mld. Kč. Zahrnuje státní podíly důchodových daní; jejich místní podíly tu nejsou.','Calculation: 938.1 taxes and fees − 365.1 state VAT receipts = CZK 573.0bn. Includes state income-tax shares; their local shares are outside this card.');
    if(national&&selected?.id==='property')note=tr('Přesný převod 12 451,9 mil. Kč na miliardy. Výnos této daně náleží obcím.','Exact conversion of CZK 12,451.9 million to billions. This tax’s revenue belongs to municipalities.');
    if(national&&selected?.id==='social')note=tr('Příspěvky na sociální zabezpečení a politiku zaměstnanosti přijaté státním rozpočtem. Zdravotní pojistné je samostatně.','Social security and employment-policy contributions received by the state budget. Health premiums are separate.');
    if(national&&selected?.id==='health')note=tr('Přímé pojistné je část celkových příjmů pojišťoven 467,52 mld. Kč. Příspěvky státu se nesmí započíst dvakrát.','Direct premiums form part of insurers’ CZK 467.52bn total receipts. State payments must not be counted twice.');
    if(code==='DEU'&&selected?.id==='vat'&&known)note=tr('BMF: předběžné výsledky 2023, DPH včetně dovozní DPH 291,4 mld. EUR. Podíly jsou publikované a zaokrouhlené; částky pro příjemce z nich neodhadujeme.','BMF: provisional 2023 results, VAT including import VAT EUR 291.4bn. Shares are published and rounded; recipient currency amounts are not inferred from them.');
    const picked=recipientList.find(r=>r.id===recipient);
    let details=[];
    if(selected&&known)details=recipients.filter(r=>r.share!==null).map(r=>[r.label,r.amount+' '+r.unit,r.share+'%']);
    else if(national&&picked){
      const contents={
        central:[[tr('Daně a poplatky','Taxes and fees'),'938.1'],[tr('Sociální pojištění','Social insurance'),'689.2'],[tr('Ostatní příjmy včetně transferů','Other receipts including transfers'),'286.8']],
        funds:[[tr('Všechny přijaté transfery','All received transfers'),'181.878824'],[tr('Z toho ze státního rozpočtu','Of which from the state budget'),'137.412606'],[tr('Daňové příjmy','Tax receipts'),'31.587725']],
        regions:[[tr('Vlastní příjmy','Own receipts'),'119.8'],[tr('Transfery ze všech zdrojů','Transfers from all origins'),'237.0'],[tr('Po odečtení vybraných školských průtoků','After specified school pass-throughs'),'185.5']],
        municipal:[[tr('Vlastní příjmy','Own receipts'),'403.1'],[tr('Transfery ze všech zdrojů','Transfers from all origins'),'90.1'],[tr('Po odečtení vybraných školských průtoků','After specified school pass-throughs'),'468.8']],
        insurers:[[tr('Přímé pojistné','Direct premiums'),'319.96'],[tr('Přerozdělování (zejména stát)','Redistribution (primarily state)'),'141.93'],[tr('Ostatní systémové příjmy','Other system receipts'),'3.35'],[tr('Zahraniční pojišťovny','Foreign insurers'),'2.20'],[tr('Ostatní činnosti','Other activities'),'0.08']],
      };details=(contents[picked.id]||[]).map(([name,value])=>[name,value+' '+money,'']);
      if(['regions','municipal'].includes(picked.id))note+=' '+tr('Upravený školský součet je alternativní pohled, ne další příjem. Zaokrouhlené složky se nemusí sečíst přesně.','The adjusted school total is an alternative view, not another receipt. Rounded components may not sum exactly.');
      if(picked.id==='funds')note+=' '+tr('Řádek „z toho“ je podmnožina transferů. Přesný převod z tisíců Kč; tabulka zdroje obsahuje zaokrouhlení.','The “of which” row is a subset of transfers. Exact conversion from CZK thousands; the source table contains rounding.');
    }
    if(national&&picked&&['regions','municipal'].includes(picked.id)){
      const components=picked.id==='regions'?119.8+237.0:403.1+90.1;
      details.push([tr('Reziduum: hrubý příjem − vlastní příjmy − transfery','Residual: gross receipts − own receipts − transfers'),(Number(picked.amount)-components).toFixed(1)+' '+money,tr('Rozdíl vykázaných zaokrouhlených částek','Difference between reported rounded amounts')]);
    }
    if(!national&&!selected&&edges.some(e=>e.kind==='transfer'))note+=' '+tr('Přerušované trasy: vykázané platby mezi úrovněmi podle ESA, na akruální bázi; přesné ukazatele a roky jsou v tabulce transferů.','Dashed routes: reported ESA payments between levels, on an accrual basis; exact metrics and years appear in the transfer table.');
    const refKeys=selected?[selected.ref]:picked?[picked.ref]:national?['state','funds','local','health']:['oecd'];
    const refs=[...new Set(refKeys)].map(key=>references[key]);
    if(!national&&!germanExample&&profile.tax_total_source?.source_url)refs.splice(0,refs.length,['OECD · '+profile.latest_year,profile.tax_total_source.source_url]);
    const rows=[...sources.map(s=>({kind:'source',label:s.label,amount:s.amount,unit:s.unit,year:national||germanExample?2023:profile.latest_year,country:code,share:null,source:references[s.ref][1]})),...recipients.map(r=>({kind:'recipient',label:r.label,amount:r.amount,unit:r.unit,year:national||germanExample?2023:profile.latest_year,country:code,share:r.share,source:references[selected?.ref||r.ref][1]}))];
    let displayUnit=national?money:shareUnit;
    if(currency==='EUR'&&national){
      const rate=euros('1','CZK',2023,fx);
      if(rate){
        const converted=value=>(Number(value)/rate.rate).toFixed(3);
        for(const node of [...sources,...recipients])if(node.amount!==null&&node.unit===money){node.nativeAmount=node.amount;node.nativeUnit=money;node.amount=converted(node.amount);node.unit='EUR bn';node.meta+=' · '+node.nativeAmount+' '+money;}
        for(const row of rows)if(row.amount!==null&&row.unit===money){row.native_amount=row.amount;row.native_unit=money;row.amount=converted(row.amount);row.unit='EUR bn';}
        details=details.map(([label,value,share])=>value.endsWith(' '+money)?[label,converted(value.slice(0,-money.length-1))+' EUR bn',share+' · '+value]:[label,value,share]);
        note+=' '+tr('Přepočet, nikoliv nový zdrojový údaj: EUR = Kč / roční průměr ECB 2023 ','Calculated display, not a new source observation: EUR = CZK / ECB 2023 annual average ')+rate.rate+tr(' Kč za EUR. Původní částky jsou zachovány; stejný kurz platí i pro rezidua.',' CZK per EUR. Original amounts are retained; the same rate applies to residuals.');
        refs.push(['ECB · 2023 · CZK/EUR',rate.source_url]);displayUnit='EUR bn';
      }else note+=' '+tr('Přepočet na EUR není dostupný: chybí ověřený kurz stejného roku.','EUR conversion unavailable: no verified same-year rate.');
    }
    return {code,year:national||germanExample?2023:profile.latest_year,national,source:selected?.id||null,recipient:picked?.id||null,sources,recipients,routeNodes,edges,rows,refs,note,details,
      detailTitle:selected?.label||picked?.label||tr('Příjmy jednotlivých rozpočtů','Receipts by budget'),
      status:selected?(known?tr('Sledujete vybraný zdroj','Following the selected source'):zero?tr('Vykázaný výnos je nula','Reported receipts are zero'):tr('Rozdělení tohoto zdroje není dostupné','Allocation of this source is unavailable')):national?tr('Hrubé příjmy · nepřičítat k sobě','Gross receipts · do not add together'):tr('Každých 100 jednotek daní · OECD','Every 100 tax units · OECD'),
      unit:displayUnit,labels:{source:tr('Vyberte zdroj příjmu','Select a revenue source'),route:tr('Jak peníze putují','How it gets there'),recipient:tr('Kdo peníze dostává','Who receives it'),none:tr('—','—'),share:tr('z vybraného zdroje','of selected source')},
    };
  }
  const api=Object.freeze({build,references,euros});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDRevenueFlow=api;
})(typeof window==='undefined'?globalThis:window);
