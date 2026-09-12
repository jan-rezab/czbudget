import { buildMoneyFlow, layoutFlows, withFlowDetail, indexFlowTree, learningOverview } from './lib/money-flow-model.mjs';

const $ = selector => document.querySelector(selector);
const packs = {
  en: {
    eyebrow: 'THE PUBLIC MONEY ATLAS / CZECHIA', title: 'Follow the', money: 'money.', intro: 'From the taxes we pay to the services we share. See an entire state budget moving in one picture.', approved: 'Approved state budget', editionNote: 'Annual plan · including EU funds', fullBudget: 'Explore the full budget ↗', revenue: 'Money coming in', financing: 'Financing gap', spending: 'Money going out', annualUnit: 'billion Kč / year', gapHint: 'Spending above revenue', mapLabel: '01 / THE FLOW MAP', mapTitle: 'One budget. Millions of lives.', billions: 'Billion Kč', per100: 'Per 100 Kč spent', whole: 'The whole picture', stepIncome: '1. Where it comes from', stepSpending: '2. Where it goes', stepGap: '3. What is missing', scrollHint: 'Swipe across the map to follow the money →', loading: 'Loading the budget…', widthKey: 'Wider stream = more money', motionKey: 'Motion shows direction, not live transactions', sourceLine: 'Source: Ministry of Finance · 2026 approved plan ↗', reset: 'Show everything ↺', closer: '02 / LOOK A LITTLE CLOSER', boundaryTitle: 'A clear boundary makes an honest picture.', boundary: 'This is the central state budget. Municipal budgets, regional budgets and health insurers’ own revenues are outside it. Transfers from the state are counted once, as state spending. The map shows a shared funding pool, not earmarked links from individual taxes to services.', incomeData: 'Revenue data (JSON) ↗', spendingData: 'Spending data (JSON) ↗', pause: 'Ⅱ Pause', play: '▷ Play', pooled: 'Shared budget', pooledNote: 'REVENUE + FINANCING', poolBottom: 'ALLOCATED TO PUBLIC PURPOSES', left: 'WHERE IT COMES FROM', right: 'WHERE IT GOES', bn: 'bn Kč', unit100: 'Kč / 100 Kč spent', allTitle: 'What does 100 Kč pay for?', allDetail: 'Select a stream above or a category here. Open its components and see how much of every 100 Kč of state spending it represents.', children: 'What is included', incomeDetail: 'This source enters the shared state budget. The outgoing categories show how the overall budget is allocated.', allStory: 'Read left to right. People and businesses contribute, the state pools the money, and the budget allocates it to public purposes. Stream widths use the same scale on both sides.', incomeStory: 'Social insurance and taxes form most revenue. These are the shares received by the state budget; tax revenue retained by municipalities and regions is outside this picture.', spendingStory: 'Follow the branches into the things the state pays for. Each category opens into its component purposes. Pensions are the largest individual purpose in this budget.', gapStory: 'The red stream closes the gap between revenue and spending. It represents the deficit’s financing requirement, not tax income or total bond issuance, which also refinances old debt.', selectedNote: 'Click again or choose “Show everything” to return to the full picture.', totalLabel: 'of total spending', method: 'Central state budget, approved 2026, including EU and financial-mechanism funds. Revenue categories use the reconciled budget dataset; expenditure uses functional purposes, not ministry chapters.', excludes: 'Own revenues and spending of municipalities, regions and health insurers. No gross-debt issuance or individual payment tracing.', caveat: 'Widths show annual amounts. Animation is illustrative. Financing gap = spending minus revenue. Rounded categories are reconciled with an explicit adjustment in Other purposes.', unknownDate: 'Not recorded in the supplied source datasets', error: 'The budget could not be loaded. Please reload the page or use the data links below.', category: 'Category', direction: 'Side', amount: 'Billion Kč', share: 'Kč per 100 Kč spent', incoming: 'Revenue / financing', outgoing: 'Spending', skip: 'Skip to the money flows', unitLabel: 'Display unit', tourLabel: 'Guided explanation', diagramLabel: 'Interactive money flow diagram', balanceLabel: 'Budget balance',
    names: { insurance: 'Social insurance', vat: 'VAT', corporate_income_tax: 'Corporate income tax', personal_income_tax: 'Personal income tax', excise_and_energy_taxes: 'Excise & energy taxes', other_income: 'Transfers & other income', other_taxes: 'Other taxes & fees', deficit: 'Financing gap', pensions: 'Pensions', social: 'Other social protection', education: 'Education', security: 'Defence & public safety', health: 'Healthcare', economy: 'Economy & infrastructure', government: 'Government & finance', other: 'Other purposes' },
    notes: { insurance: 'Compulsory social insurance paid by employees, employers and the self-employed. Health-insurance contributions collected by insurers are outside this stream.', vat: 'Value-added tax collected on consumption. This is the state budget’s share of receipts.', corporate_income_tax: 'Tax on company profits received by the state budget.', personal_income_tax: 'Tax on personal income received by the state budget.', excise_and_energy_taxes: 'State receipts from excise and energy taxes, for example on fuels, tobacco and alcohol.', other_income: 'Received transfers, including EU funds, non-tax income and capital receipts. This is a combined category; it is not all EU money.', other_taxes: 'Remaining taxes and fees, reconciled to the published tax total. See the revenue dataset for the residual methodology.', health: 'Healthcare expenditure in the state budget, including transfers for state-insured people. It is only part of public healthcare financing; insurers’ own contributions are outside this budget.', government: 'Administration, other public services and financial operations. These functional groups include financial costs; this whole stream must not be read as the cost of bureaucracy.', other: 'Agriculture, culture, sport, housing, the environment and other research. Click to see the separate purposes.', pensions: 'Pension insurance benefits, including old-age, disability and survivors’ pensions. This is a budget allocation, not a personal savings account.', social: 'Social benefits and services outside pension insurance benefits. Expand the list to see the distinct purposes.', education: 'State-budget spending on education and school services. Municipalities and regions also finance education from their own budgets.', security: 'Defence, public order, legal protection, fire and rescue, and civil emergency preparedness. This functional definition differs from NATO defence expenditure.', economy: 'Transport, industry, trade, water management, communications and general economic affairs.' },
  },
  cs: {
    eyebrow: 'ATLAS VEŘEJNÝCH PENĚZ / ČESKO', title: 'Sledujte', money: 'peníze.', intro: 'Od daní, které platíme, ke službám, které využíváme. Celý státní rozpočet v jednom živém obrazu.', approved: 'Schválený státní rozpočet', editionNote: 'Roční plán · včetně prostředků EU', fullBudget: 'Prozkoumat celý rozpočet ↗', revenue: 'Peníze přicházejí', financing: 'Chybějící financování', spending: 'Peníze odcházejí', annualUnit: 'miliard Kč / rok', gapHint: 'Výdaje nad rámec příjmů', mapLabel: '01 / MAPA TOKŮ', mapTitle: 'Jeden rozpočet. Miliony životů.', billions: 'Miliardy Kč', per100: 'Na 100 Kč výdajů', whole: 'Celý obraz', stepIncome: '1. Odkud přicházejí', stepSpending: '2. Kam odcházejí', stepGap: '3. Co chybí', scrollHint: 'Posuňte mapu do strany a sledujte peníze →', loading: 'Načítání rozpočtu…', widthKey: 'Širší proud = více peněz', motionKey: 'Pohyb ukazuje směr, nikoli živé transakce', sourceLine: 'Zdroj: Ministerstvo financí · schválený plán 2026 ↗', reset: 'Zobrazit vše ↺', closer: '02 / PODÍVEJTE SE BLÍŽ', boundaryTitle: 'Jasné hranice, poctivý obraz.', boundary: 'Zobrazen je státní rozpočet. Vlastní příjmy a výdaje obcí, krajů a zdravotních pojišťoven jsou mimo něj. Transfery ze státu započítáváme jednou, jako státní výdaj. Mapa ukazuje společný rozpočet, nikoli účelové vazby mezi jednotlivými daněmi a službami.', incomeData: 'Příjmová data (JSON) ↗', spendingData: 'Výdajová data (JSON) ↗', pause: 'Ⅱ Pozastavit', play: '▷ Spustit', pooled: 'Společný rozpočet', pooledNote: 'PŘÍJMY + FINANCOVÁNÍ', poolBottom: 'ROZDĚLENO PODLE ÚČELU', left: 'ODKUD PŘICHÁZEJÍ', right: 'KAM ODCHÁZEJÍ', bn: 'mld. Kč', unit100: 'Kč / 100 Kč výdajů', allTitle: 'Co zaplatí 100 Kč?', allDetail: 'Vyberte proud v mapě nebo kategorii zde. Prohlédněte si její části a podíl na každé stokoruně státních výdajů.', children: 'Co zahrnuje', incomeDetail: 'Tento zdroj plyne do společného státního rozpočtu. Výdajové kategorie ukazují rozdělení celkového rozpočtu.', allStory: 'Čtěte zleva doprava. Lidé a firmy přispívají, stát peníze soustředí a rozpočet je rozděluje podle účelu. Šířka proudů má na obou stranách stejné měřítko.', incomeStory: 'Většinu příjmů tvoří sociální pojistné a daně. Jde o podíly státního rozpočtu; daňové příjmy ponechané obcím a krajům v této mapě nejsou.', spendingStory: 'Sledujte větve k tomu, co stát platí. Každá kategorie se otevře do dílčích účelů. Největším jednotlivým účelem jsou v tomto rozpočtu důchody.', gapStory: 'Červený proud vyrovnává rozdíl mezi příjmy a výdaji. Jde o potřebu financování schodku, nikoli daňový příjem nebo celkovou emisi dluhopisů, která také nahrazuje starý dluh.', selectedNote: 'Klikněte znovu nebo zvolte „Zobrazit vše“ pro návrat k celému obrazu.', totalLabel: 'celkových výdajů', method: 'Státní rozpočet, schválený rok 2026, včetně prostředků EU a finančních mechanismů. Příjmy vycházejí ze sladěných rozpočtových dat, výdaje z účelového členění, nikoli z ministerských kapitol.', excludes: 'Vlastní příjmy a výdaje obcí, krajů a zdravotních pojišťoven. Nezobrazuje hrubé emise dluhu ani jednotlivé platby.', caveat: 'Šířky představují roční částky. Pohyb je ilustrativní. Potřeba financování = výdaje minus příjmy. Zaokrouhlené kategorie jsou dorovnány explicitní položkou v Ostatních účelech.', unknownDate: 'V dodaných zdrojových souborech neuvedeno', error: 'Rozpočet se nepodařilo načíst. Obnovte stránku nebo použijte odkazy na data níže.', category: 'Kategorie', direction: 'Strana', amount: 'Miliardy Kč', share: 'Kč na 100 Kč výdajů', incoming: 'Příjmy / financování', outgoing: 'Výdaje', skip: 'Přeskočit k tokům peněz', unitLabel: 'Jednotka zobrazení', tourLabel: 'Průvodce rozpočtem', diagramLabel: 'Interaktivní diagram toků peněz', balanceLabel: 'Rozpočtová bilance',
    names: { insurance: 'Sociální pojistné', vat: 'DPH', corporate_income_tax: 'Daň z příjmů firem', personal_income_tax: 'Daň z příjmů lidí', excise_and_energy_taxes: 'Spotřební a energetické daně', other_income: 'Transfery a ostatní příjmy', other_taxes: 'Ostatní daně a poplatky', deficit: 'Financování schodku', pensions: 'Důchody', social: 'Ostatní sociální zabezpečení', education: 'Vzdělávání', security: 'Obrana a bezpečnost', health: 'Zdravotnictví', economy: 'Ekonomika a infrastruktura', government: 'Správa a finanční operace', other: 'Ostatní účely' },
    notes: { insurance: 'Povinné sociální pojistné zaměstnanců, zaměstnavatelů a OSVČ. Zdravotní pojistné vybírané zdravotními pojišťovnami do tohoto proudu nepatří.', vat: 'Daň z přidané hodnoty ze spotřeby. Zobrazen je podíl inkasa státního rozpočtu.', corporate_income_tax: 'Daň z firemních zisků přijatá státním rozpočtem.', personal_income_tax: 'Daň z příjmů fyzických osob přijatá státním rozpočtem.', excise_and_energy_taxes: 'Státní příjmy ze spotřebních a energetických daní, například z paliv, tabáku a alkoholu.', other_income: 'Přijaté transfery včetně prostředků EU, nedaňové a kapitálové příjmy. Jde o souhrnnou kategorii, ne pouze o peníze EU.', other_taxes: 'Zbývající daně a poplatky dorovnané na publikovaný daňový součet. Metodika reziduální kategorie je v příjmových datech.', health: 'Zdravotní výdaje státního rozpočtu včetně převodů za státní pojištěnce. Jde jen o část veřejného financování zdravotnictví; vlastní inkaso pojišťoven je mimo rozpočet.', government: 'Správa, další veřejné služby a finanční operace. Tyto účelové skupiny zahrnují i finanční náklady; celý proud nelze označit za cenu byrokracie.', other: 'Zemědělství, kultura, sport, bydlení, životní prostředí a ostatní výzkum. Kliknutím zobrazíte jednotlivé účely.', pensions: 'Dávky důchodového pojištění zahrnují starobní, invalidní a pozůstalostní důchody. Jde o rozpočtový výdaj, ne osobní spořicí účet.', social: 'Sociální dávky a služby mimo dávky důchodového pojištění. V seznamu uvidíte jednotlivé účely.', education: 'Výdaje státního rozpočtu na vzdělávání a školské služby. Obce a kraje financují školství také z vlastních rozpočtů.', security: 'Obrana, veřejný pořádek, právní ochrana, hasiči a civilní připravenost. Tato účelová definice se liší od výdajů na obranu podle NATO.', economy: 'Doprava, průmysl, obchod, vodní hospodářství, spoje a všeobecné hospodářské záležitosti.' },
  },
};
Object.assign(packs.en, {detailData:'Detailed source data (JSON) ↗', overview:'Overview', purposes:'30 spending purposes', searchCaption:'Find a budget item', searchPlaceholder:'Try rail, courts, healthcare…', allMoney:'All money', sourceItem:'Detailed source item', leafNote:'This is the most detailed item in this source table. It does not identify individual organisations or payments.', zoomNote:'Zoomed view: widths are proportional within this category. Amounts per 100 Kč still refer to the whole state budget.', detailNote:'30 spending purposes, with 134 detailed spending items underneath. Select any branch to unfold it.', openItems:'items — explore →', noResults:'No matching budget items.', matches:'matching items', within:'of this category', sourceCode:'Source code', sourceRows:'Source row', exactNote:'Detailed view uses the approved 2026 column of the Ministry of Finance’s 2027 documentation. Amounts reconcile in original crowns; display rounding may affect the last decimal.', purposeLevel:'SPENDING PURPOSE', detailLevel:'DETAILED BREAKDOWN', back:'Back to parent', incomePart:'REVENUE COMPONENTS', available:'available below', educationCaveat:'The official “Other and unspecified education spending” line includes centrally booked funding. These source codes do not fully separate schools by type.', healthCaveat:'The official “Other healthcare activities” line includes centrally booked healthcare funding. This is not a hospital-by-hospital breakdown.'});
Object.assign(packs.cs, {detailData:'Podrobná zdrojová data (JSON) ↗', overview:'Přehled', purposes:'30 účelů výdajů', searchCaption:'Najít položku rozpočtu', searchPlaceholder:'Např. železnice, soudy, zdravotnictví…', allMoney:'Všechny peníze', sourceItem:'Podrobná zdrojová položka', leafNote:'Jde o nejpodrobnější položku této zdrojové tabulky. Neidentifikuje jednotlivé organizace ani platby.', zoomNote:'Přiblížený pohled: šířky jsou poměrné v rámci této kategorie. Částky na 100 Kč stále odkazují na celý státní rozpočet.', detailNote:'30 účelů výdajů a pod nimi 134 podrobných výdajových položek. Vyberte větev a rozbalte její strukturu.', openItems:'položek — prozkoumat →', noResults:'Žádné odpovídající položky.', matches:'odpovídajících položek', within:'této kategorie', sourceCode:'Zdrojový kód', sourceRows:'Řádek zdroje', exactNote:'Podrobný pohled používá sloupec schváleného rozpočtu 2026 z dokumentace MF k roku 2027. Částky souhlasí v původních korunách; zaokrouhlení zobrazení může ovlivnit poslední desetinné místo.', purposeLevel:'ÚČEL VÝDAJŮ', detailLevel:'PODROBNÉ ČLENĚNÍ', back:'Zpět o úroveň', incomePart:'SLOŽKY PŘÍJMŮ', available:'k prozkoumání', educationCaveat:'Oficiální položka „Ostatní činnost a nespecifikované výdaje“ zahrnuje centrálně vykazované financování školství. Toto třídění plně neodděluje jednotlivé typy škol.', healthCaveat:'Oficiální položka „Ostatní činnost ve zdravotnictví“ zahrnuje centrálně vykazované financování zdravotnictví. Nejde o rozpis po nemocnicích.'});
let language = document.documentElement.lang === 'cs' ? 'cs' : 'en';
let copy = packs[language];
let model, controller, tree;
let level = 'overview';
let unit = 'hundred', step = 'all', selected = '';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches;
let offscreen = false;
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const fmt = (value, digits = 1) => new Intl.NumberFormat(language === 'cs' ? 'cs-CZ' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const amount = value => {
  const scaled = unit === 'annual' ? value : value / model.total * 100;
  return `${scaled > 0 && scaled < .01 ? `<${fmt(.01,2)}` : fmt(scaled, scaled > 0 && scaled < 0.1 ? 2 : 1)} ${unit === 'annual' ? copy.bn : 'Kč'}`;
};
const name = item => item[`label_${language}`] || copy.names[item.id];
const find = key => tree?.get(key);

const lessonWords = {
  en: {
    kicker:'A BUDGET, EXPLAINED', start:'▶ Watch the 1-minute story', replay:'↺ Replay the story', back:'← Back', next:'Next →', play:'▶ Continue story', pause:'Ⅱ Pause story', finish:'Explore the money →', manual:'6 short chapters · go at your own pace',
    introTitle:'Who pays for the things we share?', intro:'Schools. Roads. Help when people need it. A budget is a plan for collecting money and deciding what to pay for.',
    taxes:'Taxes', together:'Together', choices:'Choices', gap:'The gap', borrowing:'Financing', yourTurn:'Your turn', receipt:'When we shop or earn', taxLabel:'Tax', shared:'Our shared budget', services:'Things we share', school:'Schools', health:'Healthcare', roads:'Roads', contributions:'Contributions', other:'Other income', collected:'Collected', missing:'Still needed', financed:'To be financed', planned:'Planned spending', perTile:'Each square = 1 Kč of the planned 100 Kč',
    titles:['Public money starts with people.','We put money together.','A budget makes choices.','But the two sides do not match.','The gap is called a deficit.','Now you can investigate.'],
    bodies:[
      'Part of what people and companies pay is tax. For example, VAT is included in many shop prices. This stream shows the taxes that reach the state budget.',
      'Taxes, social contributions and other income go into a shared budget. Your particular tax payment is not usually tied to one particular school or road.',
      'The budget sets aside money for different purposes. Wider streams mean more money. Click a stream later to discover what is inside it.',
      'Imagine all planned spending is 100 Kč. Revenue covers {revenue} Kč. That leaves {gap} Kč still to find. Watch the empty part of the grid.',
      'The state needs to finance that {gap} Kč gap, usually by borrowing. Borrowed money must be repaid, and interest also costs money. It is not extra tax income.',
      'You can follow a large stream, then keep clicking to see smaller parts. First, one quick question: have you spotted what a deficit means?'
    ],
    question:'If spending is higher than revenue, what do we call the difference?', answers:['A new tax','A deficit','A profit'], correct:'Exactly. A deficit is the amount by which spending exceeds revenue. Now click any stream and follow the money.', wrong:'Try again. A tax is money collected; a profit would mean money left over. Here, spending is larger than revenue.'
  },
  cs: {
    kicker:'ROZPOČET SROZUMITELNĚ', start:'▶ Pustit minutový příběh', replay:'↺ Přehrát znovu', back:'← Zpět', next:'Dále →', play:'▶ Pokračovat', pause:'Ⅱ Pozastavit příběh', finish:'Prozkoumat peníze →', manual:'6 krátkých kapitol · vlastním tempem',
    introTitle:'Kdo platí věci, které sdílíme?', intro:'Školy. Silnice. Pomoc, když ji lidé potřebují. Rozpočet je plán, jak peníze vybrat a co za ně zaplatit.',
    taxes:'Daně', together:'Společně', choices:'Rozhodnutí', gap:'Co chybí', borrowing:'Financování', yourTurn:'Teď vy', receipt:'Když nakupujeme nebo vyděláváme', taxLabel:'Daň', shared:'Náš společný rozpočet', services:'Co společně platíme', school:'Školy', health:'Zdravotnictví', roads:'Silnice', contributions:'Pojistné', other:'Další příjmy', collected:'Vybráno', missing:'Ještě chybí', financed:'K dofinancování', planned:'Plánované výdaje', perTile:'Každý čtvereček = 1 Kč z plánované stokoruny',
    titles:['Veřejné peníze začínají u lidí.','Peníze dáváme dohromady.','Rozpočet znamená rozhodování.','Obě strany ale nejsou stejné.','Rozdílu říkáme schodek.','Teď můžete pátrat sami.'],
    bodies:[
      'Část toho, co lidé a firmy platí, tvoří daně. Třeba DPH je součástí ceny mnoha nákupů. Tento proud ukazuje daně, které dostává státní rozpočet.',
      'Daně, sociální pojistné a další příjmy plynou do společného rozpočtu. Vaše konkrétní daň obvykle není přiřazená jedné konkrétní škole nebo silnici.',
      'Rozpočet určuje, kolik peněz dostanou jednotlivé účely. Širší proud znamená více peněz. Později na něj klikněte a zjistěte, co obsahuje.',
      'Představte si, že všechny plánované výdaje jsou 100 Kč. Příjmy pokryjí {revenue} Kč. Zbývá najít {gap} Kč. Sledujte prázdnou část mřížky.',
      'Stát musí těchto {gap} Kč dofinancovat, obvykle půjčkou. Půjčené peníze se musí vrátit a úroky také něco stojí. Nejde o další daňový příjem.',
      'Vyberte velký proud a dalšími kliknutími odhalte jeho části. Nejdřív krátká otázka: už víte, co znamená schodek?'
    ],
    question:'Jak říkáme rozdílu, když jsou výdaje vyšší než příjmy?', answers:['Nová daň','Schodek','Zisk'], correct:'Přesně. Schodek je částka, o kterou výdaje převyšují příjmy. Teď klikněte na libovolný proud a sledujte peníze.', wrong:'Zkuste to znovu. Daň jsou vybrané peníze; zisk by znamenal peníze navíc. Tady ale výdaje převyšují příjmy.'
  }
};
Object.assign(packs.en,{intro:'Who pays for schools, roads and help when people need it? Follow the money, then click a stream to look inside.', clickHint:'Curious about a stream? Click it to look inside.', detailNote:'Start with the big picture. Each click opens one more layer.', pooled:'Our shared budget', pooledNote:'THE PLAN FOR THIS YEAR', poolBottom:'THINGS WE PAY FOR', poolExplore:'Click a stream to explore →', motionKey:'Moving markers show direction, not real payments', allStory:'People and businesses contribute. The budget brings the money together and sets out what to pay for. Follow a stream to discover more.',searchCaption:'Find a specific item', financing:'The gap to finance'});
Object.assign(packs.cs,{intro:'Kdo platí školy, silnice a pomoc, když ji lidé potřebují? Sledujte peníze a kliknutím do proudu nahlédněte dovnitř.',clickHint:'Zajímá vás některý proud? Klikněte a podívejte se dovnitř.',detailNote:'Začněte celkovým pohledem. Každé kliknutí otevře další vrstvu.',pooled:'Náš společný rozpočet',pooledNote:'PLÁN NA LETOŠNÍ ROK',poolBottom:'CO SPOLEČNĚ PLATÍME',poolExplore:'Klikněte a prozkoumejte →',motionKey:'Značky ukazují směr, nikoli skutečné platby',allStory:'Lidé a firmy přispívají. Rozpočet peníze soustředí a určuje, co za ně zaplatíme. Vyberte proud a zjistěte více.',searchCaption:'Najít konkrétní položku',financing:'Co je třeba dofinancovat'});
Object.assign(packs.en.names,{taxes:'Taxes',insurance:'Social contributions',other_income:'Other income',deficit:'The financing gap',social:'Benefits & social care',security:'Safety & defence',education:'Education',economy:'Transport & the economy',government:'Government & finance',other:'Other shared purposes'});
Object.assign(packs.cs.names,{taxes:'Daně',insurance:'Sociální pojistné',other_income:'Další příjmy',deficit:'Financování schodku',social:'Dávky a sociální péče',security:'Bezpečnost a obrana',education:'Vzdělávání',economy:'Doprava a ekonomika',government:'Správa a finance',other:'Další společné účely'});
packs.en.notes.taxes='People pay taxes on earnings and purchases; companies pay tax on profits. This is the part of those taxes received by the state budget. Open a branch to see the tax types.';
packs.cs.notes.taxes='Lidé platí daně z příjmů a nákupů, firmy ze zisků. Zde je část těchto daní, kterou dostává státní rozpočet. Otevřete větev a prohlédněte si jednotlivé daně.';
let lessonIndex=-1, lessonAutoplay=false, lessonElapsed=0, lessonTimer=null, lessonOffscreen=false, quizAnswer=null;
const sceneNames=['taxes','pool','spending','gap','borrowing','explore'];
const lessonDuration=10000;
const iconPaths={
  shop:'M4 13h24M6 13v15h20V13M3 13l3-9h20l3 9M11 28v-9h10v9M9 4l-1 9M16 4v9M23 4l1 9',
  bank:'M3 11L16 3l13 8H3M5 28h22M8 14v11M16 14v11M24 14v11',
  school:'M3 28h26M6 28V12l10-8 10 8v16M13 28v-8h6v8M10 14h2M20 14h2M16 4V1h7',
  health:'M6 4h20v24H6zM12 12h8M16 8v8M12 28v-7h8v7',
  roads:'M11 3L4 29M21 3l7 26M16 4v4M16 13v5M16 23v5',
  people:'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M24 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 28v-7a6 6 0 0 1 12 0v7M18 28v-7a6 6 0 0 1 12 0v7',
};
function lessonIcon(id){return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPaths[id]}"/></svg>`;}
function lessonVisual(){
  const w=lessonWords[language], index=lessonIndex;
  if(index===3||index===4){
    const covered=Number((model.revenue/model.total*100).toFixed(1));
    return `<div class="lesson-grid-wrap ${index===4?'is-financed':''}"><div class="lesson-hundred">${Array.from({length:100},(_,i)=>`<i class="${i>=Math.floor(covered)?'has-gap':''}" style="--covered:${Math.min(1,Math.max(0,covered-i))*100}%;--tile-delay:${Math.max(0,i-86)*.055}s"></i>`).join('')}</div><div class="lesson-grid-labels"><span><b>${fmt(covered)} Kč</b>${escape(w.collected)}</span><span class="red"><b>${fmt(100-covered)} Kč</b>${escape(index===4?w.financed:w.missing)}</span></div><small>${escape(w.perTile)}</small></div>`;
  }
  if(index===2||index===5){
    return `<div class="lesson-destinations">${['school','health','roads'].map((id,i)=>`<div style="--icon-delay:${i*.25}s">${lessonIcon(id)}<span>${escape(w[id])}</span></div>`).join('')}</div><small>${escape(w.services)}</small>`;
  }
  if(index===1){
    return `<div class="lesson-collect"><div class="lesson-source-tags"><span>${escape(w.taxes)}</span><span>${escape(w.contributions)}</span><span>${escape(w.other)}</span></div><div class="lesson-mini-stream"><i></i><i></i><i></i></div><div class="lesson-bank">${lessonIcon('bank')}</div></div><small>${escape(w.shared)}</small>`;
  }
  return `<div class="lesson-collect"><div class="lesson-shop">${lessonIcon('shop')}</div><div class="lesson-mini-stream"><i></i><i></i><i></i></div><div class="lesson-bank">${lessonIcon('bank')}</div></div><small>${escape(w.receipt)} → ${escape(w.shared)}</small>`;
}
function renderLesson(){
  const w=lessonWords[language], active=lessonIndex>=0;
  $('#lesson-kicker').textContent=active?`${String(lessonIndex+1).padStart(2,'0')} / 06 · ${w.kicker}`:w.kicker;
  $('#lesson-title').textContent=active?w.titles[lessonIndex]:w.introTitle;
  $('#lesson-copy').textContent=active?w.bodies[lessonIndex].replace('{revenue}',fmt(model.revenue/model.total*100)).replace('{gap}',fmt(model.deficit/model.total*100)):w.intro;
  $('#lesson-start').textContent=active?w.replay:reduced.matches?w.manual:w.start;
  $('#lesson-visual').innerHTML=lessonVisual();
  $('.lesson-navigation').hidden=!active;
  $('#lesson-prev').textContent=w.back;$('#lesson-prev').disabled=lessonIndex<=0;
  $('#lesson-next').textContent=lessonIndex===5?w.finish:w.next;
  $('#lesson-steps').innerHTML=[w.taxes,w.together,w.choices,w.gap,w.borrowing,w.yourTurn].map((label,i)=>`<button type="button" data-lesson-step="${i}" aria-pressed="${i===lessonIndex}"><span>${i+1}</span><b>${escape(label)}</b></button>`).join('');
  $('#lesson-quiz').hidden=lessonIndex!==5;
  $('#lesson-question').textContent=w.question;
  $('#lesson-answers').innerHTML=w.answers.map((answer,i)=>`<button type="button" data-answer="${i}" aria-pressed="${quizAnswer===i}">${escape(answer)}</button>`).join('');
  $('#lesson-feedback').textContent=quizAnswer===null?'':quizAnswer===1?w.correct:w.wrong;
  $('.flow-explorer').dataset.lesson=active?sceneNames[lessonIndex]:'overview';
  $('.flow-explorer').classList.toggle('lesson-active',active);
  if(model&&!selected)spotlightLesson();
  syncLessonTimer();
}
function spotlightLesson(){
  const active=lessonIndex>=0;
  document.querySelectorAll('[data-flow],[data-node]').forEach(node=>{
    const key=node.dataset.flow||node.dataset.node, income=key.startsWith('in:'), deficit=key==='in:deficit';
    const lit=!active||lessonIndex===5||(lessonIndex===0?key==='in:taxes':lessonIndex===1?income&&!deficit:lessonIndex===2?!income:lessonIndex===3?!deficit:lessonIndex===4?deficit:false);
    node.classList.toggle('lesson-muted',!lit);
    node.classList.toggle('lesson-gap-ghost',active&&lessonIndex===3&&deficit);
  });
}
function syncLessonTimer(){
  const running=lessonAutoplay&&!paused&&!document.hidden&&!lessonOffscreen;
  $('#lesson-play').textContent=lessonAutoplay?lessonWords[language].pause:lessonWords[language].play;
  $('#lesson-progress').style.width=`${lessonElapsed/lessonDuration*100}%`;
  $('#flow-lesson').classList.toggle('lesson-motion-paused',paused||document.hidden||lessonOffscreen);
  if(!running&&lessonTimer){clearInterval(lessonTimer);lessonTimer=null;}
  if(running&&!lessonTimer){
    lessonTimer=setInterval(()=>{
      lessonElapsed=Math.min(lessonDuration,lessonElapsed+100);
      $('#lesson-progress').style.width=`${lessonElapsed/lessonDuration*100}%`;
      if(lessonElapsed>=lessonDuration){
        if(lessonIndex<5)setLesson(lessonIndex+1,true);
        else{lessonAutoplay=false;syncLessonTimer();}
      }
    },100);
  }
}
function setLesson(index,autoplay=false){
  if(!model)return;
  const needsRedraw=Boolean(selected)||unit!=='hundred';
  lessonIndex=index;lessonAutoplay=autoplay;lessonElapsed=0;quizAnswer=null;
  selected='';step='all';unit='hundred';level='overview';
  if(autoplay)paused=false;
  $('#flow-search').value='';$('#flow-search-results').hidden=true;
  $('.flow-search-disclosure').open=false;
  if(needsRedraw)draw();else{applySelection();updatePause();}
  renderLesson();persist();
}
function stopLesson(){
  lessonIndex=-1;lessonAutoplay=false;lessonElapsed=0;
  if(lessonTimer){clearInterval(lessonTimer);lessonTimer=null;}
  renderLesson();
}
$('#lesson-start').addEventListener('click',()=>{setLesson(0,!reduced.matches);$('#flow-lesson').scrollIntoView({block:'start'});});
$('#lesson-prev').addEventListener('click',()=>setLesson(Math.max(0,lessonIndex-1)));
$('#lesson-next').addEventListener('click',()=>{if(lessonIndex===5){stopLesson();$('#flow-breadcrumb button').focus({preventScroll:true});}else setLesson(lessonIndex+1);});
$('#lesson-play').addEventListener('click',()=>{if(lessonIndex<0)return;lessonAutoplay=!lessonAutoplay;if(lessonAutoplay){paused=false;updatePause();}syncLessonTimer();});
$('#lesson-steps').addEventListener('click',event=>{const button=event.target.closest('[data-lesson-step]');if(button)setLesson(Number(button.dataset.lessonStep));});
$('#lesson-answers').addEventListener('click',event=>{const button=event.target.closest('[data-answer]');if(!button)return;quizAnswer=Number(button.dataset.answer);lessonAutoplay=false;renderLesson();});
new IntersectionObserver(entries=>{lessonOffscreen=!entries[0].isIntersecting;syncLessonTimer();}).observe($('#flow-lesson'));

function rootOutputs() {
  return model.outgoing.map(item => find(`out:${item.id}`));
}
function tableRows() {
  const current = find(selected);
  if (current) return current.children?.map(item => find(`${selected}/${item.id}`)) || [current];
  return [...model.incoming.map(item => find(`in:${item.id}`)), ...rootOutputs()];
}
function description(item) {
  const note = copy.notes[item.id];
  const special = item.id === 'education' ? copy.educationCaveat : item.id === 'health' ? copy.healthCaveat : '';
  const largest = item.children?.reduce((best, child) => !best || child.value > best.value ? child : best, null);
  const concentrated = largest && /^\d{2}9$/.test(largest.id) && largest.value / item.value > .5;
  const classificationNote = concentrated ? (language === 'en' ? `Most of this category is reported under “${name(largest)}”. The other named lines are not complete sector-wide spending totals.` : `Většina této kategorie je vykázána pod položkou „${name(largest)}“. Ostatní pojmenované řádky nepředstavují úplné výdaje za celý sektor.`) : '';
  return [note || (item.children ? '' : copy.leafNote), special, classificationNote, item.source_code ? `${copy.sourceCode}: ${item.source_code}.` : '', item.source_row ? `${copy.sourceRows}: ${item.source_row}. ${fmt(item.value * 1e9, 0)} Kč.` : ''].filter(Boolean).join(' ');
}
function textLines(text, limit = 30) {
  const words = text.split(' '), lines = [''];
  for (const word of words) {
    if (lines.at(-1).length + word.length + 1 > limit && lines.at(-1)) lines.push('');
    lines[lines.length-1] += `${lines.at(-1) ? ' ' : ''}${word}`;
  }
  if (lines.length > 2) return [lines[0], lines[1].replace(/[.,;:]$/, '') + '…'];
  return lines;
}
function svgLabel(text, x, y, css, limit = 30) {
  return `<text class="${css}" x="${x}" y="${y}">${textLines(text,limit).map((line,i)=>`<tspan x="${x}" dy="${i ? 16 : 0}">${escape(line)}</tspan>`).join('')}</text>`;
}
function drawTree(chart) {
  const current = find(selected);
  const focused = Boolean(current);
  const children = current?.children?.map(item => find(`${selected}/${item.id}`)) || [];
  const outputs = focused ? children : rootOutputs();
  const n = outputs.length;
  const gap = focused ? 42 : level === 'purposes' ? 42 : 26;
  const flowHeight = 220;
  const height = Math.max(focused?670:560, 140 + flowHeight + Math.max(0,n-1)*gap);
  const poolY = (height-320)/2;
  const poolX = focused ? 400 : 555, poolW = focused ? 285 : 200;
  const poolRight = poolX + poolW;
  const total = current?.value || model.total;
  const right = layoutFlows(outputs,total,{height:flowHeight,gap,top:(height-flowHeight-gap*Math.max(0,n-1))/2});
  const left = focused ? [] : layoutFlows(model.incoming.map(item => find(`in:${item.id}`)),model.total,{height:flowHeight,gap:26,top:(height-flowHeight-26*(model.incoming.length-1))/2});
  const nodeX = focused ? 990 : 1070;
  const curve = (x1,y1,x2,y2) => `M ${x1} ${y1} C ${x1+(x2-x1)*.46} ${y1}, ${x2-(x2-x1)*.46} ${y2}, ${x2} ${y2}`;
  const ribbons = (item,x1,y1,x2,y2,index) => {
    const color = item.id==='deficit' ? '#c93237' : '#a8b63f';
    const count=Math.min(5,Math.max(1,Math.ceil(item.width/22)));
    const duration=4.8;
    const traces=item.width<2?'':Array.from({length:count},(_,i)=>{
      const radius=Math.min(3,item.width/3);
      const path=curve(x1,y1,x2,y2);
      return `<g class="money-packet"><path d="M -12 0 H 0" stroke="${color}" stroke-width="${radius}" stroke-linecap="round" opacity=".45"/><circle r="${radius+2}" fill="${color}" opacity=".18"/><circle r="${radius}" fill="#faf7ef" stroke="${color}" stroke-width="1"/><animateMotion dur="${duration}s" repeatCount="indefinite" rotate="auto" calcMode="paced" begin="-${(i*duration/count+index*.27).toFixed(2)}s" path="${path}"/></g>`;
    }).join('');
    const half=item.width/2;
    const band=`M ${x1} ${y1-half} C ${x1+(x2-x1)*.46} ${y1-half}, ${x2-(x2-x1)*.46} ${y2-half}, ${x2} ${y2-half} L ${x2} ${y2+half} C ${x2-(x2-x1)*.46} ${y2+half}, ${x1+(x2-x1)*.46} ${y1+half}, ${x1} ${y1+half} Z`;
    const clipId='stream-'+item.key.replace(/[^a-zA-Z0-9]/g,'-');
    return `<g class="flow-ribbon" data-flow="${item.key}" data-side="${item.side}"><path class="flow-band" d="${band}" style="fill:${color};stroke:none"/><defs><clipPath id="${clipId}"><path d="${band}"/></clipPath></defs><g clip-path="url(#${clipId})">${traces}</g></g>`;
  };
  const node = (item,x,bar,index) => {
    const lines=textLines(name(item), focused?36:29);
    const labelY=item.y-(lines.length>1?16:5);
    const count=focused?item.children?.length:0;
    const valueY=labelY+(lines.length-1)*16+18;
    return `<g class="flow-node" role="button" tabindex="0" data-node="${item.key}" aria-pressed="false" aria-label="${escape(name(item))}: ${escape(amount(item.value))}${count ? `; ${count} ${escape(copy.openItems)}` : ''}"><title>${escape(name(item))}</title><rect class="node-hit" x="${x-6}" y="${item.y-26}" width="${focused?305:229}" height="52" rx="3"/><rect x="${bar}" y="${item.y-item.width/2}" width="4" height="${item.width}" fill="${item.id==='deficit'?'#c93237':'#a8b63f'}"/>${svgLabel(name(item),x,labelY,'node-name',focused?36:29)}<text class="node-value" x="${x}" y="${valueY}">${escape(amount(item.value))}${count?` · ${count} ↗`:''}</text></g>`;
  };
  let paths = left.map((item,i)=>ribbons(item,250,item.y,poolX,item.pooledY,i)).join('');
  paths += right.map((item,i)=> current?.side==='in' ? ribbons(item,nodeX,item.y,poolRight,item.pooledY,i) : ribbons(item,poolRight,item.pooledY,nodeX,item.y,i)).join('');
  const poolTitle = current ? name(current) : copy.pooled;
  const poolAmount = unit === 'annual' ? total : total/model.total*100;
  const terminal = focused && !children.length;
  chart.setAttribute('viewBox',`0 0 1320 ${height}`);
  chart.innerHTML = `<title id="diagram-title">${escape(poolTitle)}</title><desc id="diagram-desc">${escape(focused?copy.zoomNote:copy.allStory)}</desc><rect width="1320" height="${height}" fill="#171918"/><text class="flow-section-label" x="27" y="40">${escape(focused?copy.allMoney.toUpperCase():copy.left)}</text><text class="flow-section-label" x="${nodeX+12}" y="40">${escape(focused?(current.side==='in'?copy.incomePart:copy.detailLevel):copy.right)}</text><text class="flow-pool-note" x="27" y="61">${escape(unit==='annual'?copy.annualUnit:copy.unit100)}</text>${paths}<g class="flow-pool"><rect x="${poolX}" y="${poolY}" width="${poolW}" height="320" fill="#242724" stroke="#52564b"/><path d="M ${poolX} ${poolY} H ${poolRight}" stroke="#a8b63f" stroke-width="3"/><text x="${poolX+20}" y="${poolY+53}" class="flow-pool-note">${escape(focused?(current.side==='in'?copy.incomePart:copy.purposeLevel):copy.pooledNote)}</text>${svgLabel(poolTitle,poolX+20,poolY+90,'flow-pool-title',focused?27:19)}<text x="${poolX+20}" y="${poolY+160}" class="flow-pool-number">${poolAmount>0&&poolAmount<.01?escape(`<${fmt(.01,2)}`):fmt(poolAmount,poolAmount>0&&poolAmount<.1?2:1)}</text><text x="${poolX+20}" y="${poolY+182}" class="flow-pool-note">${escape(unit==='annual'?copy.bn:'Kč')}</text><line x1="${poolX+20}" x2="${poolRight-20}" y1="${poolY+216}" y2="${poolY+216}" class="flow-pool-line"/><text x="${poolX+20}" y="${poolY+245}" class="flow-pool-note">${focused ? `${fmt(total/model.total*100)} % ${escape(copy.totalLabel)}` : escape(copy.poolBottom)}</text><text x="${poolX+20}" y="${poolY+277}" class="flow-pool-note">${focused ? `${terminal?escape(copy.sourceItem):`${children.length} ${escape(copy.available)}`}` : escape(copy.poolExplore)}</text></g>${left.map((item,i)=>node(item,27,246,i)).join('')}${right.map((item,i)=>node(item,nodeX+15,nodeX,i)).join('')}${focused ? `<text class="flow-pool-note" x="27" y="140">${escape(copy.spending)}</text><text class="flow-pool-number" x="27" y="175">${escape(amount(model.total))}</text>${svgLabel(copy.zoomNote,27,218,'flow-pool-note',38)}` : ''}${terminal?`${svgLabel(copy.sourceItem,nodeX+15,poolY+90,'node-name',32)}${svgLabel(copy.leafNote,nodeX+15,poolY+130,'node-value',35)}`:''}<text x="27" y="${height-24}" fill="#b9baaf" font-family="monospace" font-size="10">MF ČR · F_01 / 2026 · ${focused?escape(copy.zoomNote.split('.')[0]):escape(copy.widthKey)}</text>`;
}
function renderDepthControls(item) {
  document.querySelectorAll('[data-level]').forEach(button=>{
    button.textContent=copy[button.dataset.level];
    button.setAttribute('aria-pressed',String(button.dataset.level===level));
  });
  $('#flow-search-caption').textContent=copy.searchCaption;
  $('#flow-search').placeholder=copy.searchPlaceholder;
  const ancestors=[];
  let cursor=item;
  while(cursor){ancestors.unshift(cursor);cursor=find(cursor.parent);}
  $('#flow-breadcrumb').innerHTML=`<button data-path="">${escape(copy.allMoney)}</button>${ancestors.map((entry,i)=>`<span aria-hidden="true">→</span><button data-path="${entry.key}" ${i===ancestors.length-1?'aria-current="page"':''}>${escape(name(entry))}</button>`).join('')}`;
  $('#flow-depth-note').hidden=!item;
  $('#flow-depth-note').textContent=item?`${description(item)} ${copy.zoomNote}`:copy.detailNote;
}
function searchItems() {
  const normalize = value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const query=normalize($('#flow-search').value.trim());
  const host=$('#flow-search-results');host.hidden=!query;
  if(!query)return;
  const matches=[...tree.values()].filter(item=>normalize(`${name(item)} ${item.label_cs||''} ${item.source_code||''}`).includes(query));
  host.innerHTML=`<p role="status">${matches.length?`${matches.length} ${escape(copy.matches)}`:escape(copy.noResults)}</p>${matches.slice(0,12).map(item=>`<button data-path="${item.key}"><span>${escape(name(item))}<small>${escape(find(item.parent)?name(find(item.parent)):item.side==='in'?copy.revenue:copy.spending)}</small></span><b>${escape(amount(item.value))} ↗</b></button>`).join('')}`;
}

function localize() {
  document.querySelectorAll('[data-copy]').forEach(node => { node.textContent = copy[node.dataset.copy]; });
  document.title = `${copy.title} ${copy.money} — Public Spending Data`;
  $('meta[name="description"]').content = copy.intro;
  $('#budget-link').href = `cesky-rozpocet.html?lang=${language}`;
  $('.flow-skip').textContent = copy.skip;
  $('.flow-unit-switch').setAttribute('aria-label', copy.unitLabel);
  renderLesson();
  $('.flow-scroll').setAttribute('aria-label', copy.diagramLabel);
  $('.flow-equation').setAttribute('aria-label', copy.balanceLabel);
  window.psdLanguageReady?.();
  updatePause();
}

function draw() {
  const chart = $('#flow-svg');
  drawTree(chart);
  chart.removeAttribute('hidden');
  $('#flow-loading').hidden = true;
  $('#total-income').textContent = fmt(model.revenue);
  $('#total-gap').textContent = fmt(model.deficit);
  $('#total-out').textContent = fmt(model.total);
  const covered = fmt(model.revenue / model.total * 100), missing = fmt(model.deficit / model.total * 100);
  $('#equation-story').innerHTML = language === 'en' ? `For every <strong>100 Kč</strong> spent, revenue covers ${covered} Kč. The remaining <b>${missing} Kč</b> is the financing gap.` : `Z každých vydaných <strong>100 Kč</strong> pokryjí příjmy ${covered} Kč. Zbývajících <b>${missing} Kč</b> je třeba dofinancovat.`;
  $('#rounding-note').textContent = copy.exactNote;
  applySelection();
  updatePause();
}

function applySelection() {
  const item = selected ? find(selected) : null;
  $('#flow-lesson').hidden=Boolean(item);
  document.querySelectorAll('[data-flow]').forEach(node => {
    const key = node.dataset.flow;
    const active = selected ? (key === selected || key.startsWith(selected + '/')) : step === 'income' ? node.dataset.side === 'in' && key !== 'in:deficit' : step === 'spending' ? node.dataset.side === 'out' : step === 'gap' ? key === 'in:deficit' : true;
    node.classList.toggle('is-muted', !active);
    node.classList.toggle('is-selected', active && (Boolean(selected) || step !== 'all'));
  });
  document.querySelectorAll('[data-node]').forEach(node => {
    node.setAttribute('aria-pressed', String(node.dataset.node === selected));
    node.classList.toggle('is-muted', Boolean(selected) && node.dataset.node !== selected && !node.dataset.node.startsWith(selected + '/'));
  });
  document.querySelectorAll('[data-step]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.step === step)));
  document.querySelectorAll('[data-unit]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.unit === unit)));
  $('#flow-reset').hidden = !selected && step === 'all';
  $('#reading-index').textContent = selected ? '↳' : ({ all: '01—03', income: '01', spending: '02', gap: '03' })[step];
  $('#flow-reading-text').textContent = item ? `${name(item)} · ${amount(item.value)}. ${item.id === 'deficit' ? copy.gapStory : description(item)}` : copy[({ all: 'allStory', income: 'incomeStory', spending: 'spendingStory', gap: 'gapStory' })[step]];
  renderDepthControls(item);
  showDetail(item);
  controller?.refresh();
  if(!selected)spotlightLesson();
}

function showDetail(item) {
  $('.flow-detail').hidden=!item;
  const gap = item?.id === 'deficit' || (!item && step === 'gap');
  $('#detail-title').textContent = item ? name(item) : gap ? copy.financing : step === 'income' ? copy.revenue : copy.allTitle;
  $('#detail-copy').textContent = gap ? copy.gapStory : item ? description(item) : step === 'income' ? copy.incomeStory : copy.allDetail;
  $('#detail-amount').textContent = item ? `${amount(item.value)} · ${fmt(item.value / model.total * 100)} % ${copy.totalLabel}` : '';
  let rows;
  if (item?.children) rows = item.children.map(child => ({ ...child, key: `${selected}/${child.id}`, side: item.side }));
  else if (item) rows = [];
  else if (gap) rows = [{ id: 'revenue', label_cs: packs.cs.revenue, label_en: packs.en.revenue, value: model.revenue, detail: true }, { id: 'deficit', value: model.deficit, detail: true }];
  else if (step === 'income' || item?.side === 'in') rows = model.incoming.map(child => ({ ...child, side: 'in' }));
  else rows = model.outgoing.map(child => ({ ...child, side: 'out' }));
  $('#detail-rows').innerHTML = rows.map(row => {
    const tag = row.detail ? 'div' : 'button';
    return `<${tag} class="flow-detail-row" ${row.detail ? '' : `type="button" data-select="${row.key || `${row.side}:${row.id}`}"`} style="--share:${Math.max(0, row.value / model.total * 100)}%"><span>${escape(name(row))}${row.children?.length ? `<small>${row.children.length} ${escape(copy.openItems)}</small>` : ''}</span><b>${escape(amount(row.value))}${row.detail ? '' : ' ↗'}${item ? `<small>${fmt(row.value / item.value * 100)} % ${escape(copy.within)}</small>` : ''}</b></${tag}>`;
  }).join('');
}

function registerChart() {
  $('#flow-chart-host').querySelectorAll('.psd-chart-rail,.psd-chart-panel,.psd-chart-drawer').forEach(node => node.remove());
  controller = window.PSDChart.register({
    slug: 'cz-budget-money-flow', el: $('#flow-chart-host'), title: () => find(selected) ? name(find(selected)) : copy.mapTitle,
    columns: [{ key: 'side', label: copy.direction }, { key: 'name', label: copy.category }, { key: 'amount', label: copy.amount, numeric: true }, { key: 'share', label: copy.share, numeric: true }],
    rows: () => tableRows().map(item => ({ side: item.side === 'in' ? copy.incoming : copy.outgoing, name: name(item), amount: Number(item.value.toFixed(9)), share: Number((item.value / model.total * 100).toFixed(6)) })),
    exports: ['csv', 'png'], embeddable: false,
    source: { name: 'MF ČR — Státní rozpočet 2026', url: model.detailSource.url, definition: copy.method, excludes: copy.excludes, caveat: copy.zoomNote + ' ' + copy.exactNote, table: 'F_01: Tab.1 - příjmy; Tab.2 - výdaje odvětvově · 2026 column', edition: '2026 approved budget · 2026-08-31 documentation', extracted: copy.unknownDate, vintage: 'plan' },
    state: { keys: ['unit', 'step', 'selected', 'level'], apply: state => {
      level = 'overview';
      unit = state.unit === 'annual' ? 'annual' : 'hundred';
      step = ['income', 'spending', 'gap'].includes(state.step) ? state.step : 'all';
      selected = state.selected && find(state.selected) ? state.selected : '';
    } },
  });
}
function persist() { controller?.writeState({ unit, step, selected, level }); }
function updatePause() {
  $('.flow-explorer').classList.toggle('flow-paused', paused || document.hidden || offscreen);
  $('.flow-explorer').classList.toggle('flow-motion-enabled', !paused);
  $('#flow-pause').textContent = paused ? copy.play : copy.pause;
  $('#flow-pause').setAttribute('aria-label', paused ? copy.play : copy.pause);
  const svg=$('#flow-svg');
  if(paused||document.hidden||offscreen)svg.pauseAnimations?.();else svg.unpauseAnimations?.();
  syncLessonTimer();
}
function revealBranch() {
  $('#flow-breadcrumb [aria-current]')?.focus({preventScroll:true});
  $('#flow-explorer').scrollIntoView({block:'start'});
}
function select(key) {
  stopLesson();
  selected = selected === key ? '' : key;
  let entry=find(selected);
  while(entry?.children?.length===1){selected += '/' + entry.children[0].id;entry=find(selected);}
  step = 'all';
  draw(); persist(); revealBranch();
}
document.querySelectorAll('[data-level]').forEach(button=>button.addEventListener('click',()=>{if(!model)return;level=button.dataset.level;selected='';draw();persist();}));
$('#flow-search').addEventListener('input',()=>{if(tree)searchItems();});
for(const host of [$('#flow-breadcrumb'),$('#flow-search-results')]) host.addEventListener('click',event=>{
  const button=event.target.closest('[data-path]');if(!button)return;
  stopLesson();selected=button.dataset.path;step='all';$('#flow-search').value='';$('#flow-search-results').hidden=true;draw();persist();revealBranch();
});
$('#flow-svg').addEventListener('click', event => { const node = event.target.closest('[data-node],[data-flow]'); if (node) select(node.dataset.node || node.dataset.flow); });
$('#flow-svg').addEventListener('keydown', event => { const node = event.target.closest('[data-node]'); if (node && ['Enter', ' '].includes(event.key)) { event.preventDefault(); select(node.dataset.node); } });
$('#detail-rows').addEventListener('click', event => { const node = event.target.closest('[data-select]'); if (node) select(node.dataset.select); });
document.querySelectorAll('[data-step]').forEach(node => node.addEventListener('click', () => { if (!model) return; step = node.dataset.step; selected = ''; draw(); persist(); }));
document.querySelectorAll('[data-unit]').forEach(node => node.addEventListener('click', () => { if (!model) return; stopLesson(); unit = node.dataset.unit; draw(); persist(); }));
$('#flow-reset').addEventListener('click', () => { stopLesson(); selected = ''; step = 'all'; draw(); persist(); });
$('#flow-pause').addEventListener('click', () => { paused = !paused; updatePause(); });
$('#flow-source-link').addEventListener('click', () => {
  const toggle = $('#flow-chart-host [data-action="sources"]');
  if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
  $('#flow-chart-host .psd-chart-drawer')?.scrollIntoView({ block: 'nearest' });
});
document.addEventListener('visibilitychange', updatePause);
new IntersectionObserver(entries => {
  offscreen = !entries[0].isIntersecting;
  updatePause();
}).observe($('#flow-svg'));
document.addEventListener('click', event => {
  const control = event.target.closest('[data-lang]');
  if (!control || !['cs', 'en'].includes(control.dataset.lang)) return;
  const next = new URL(location.href);
  next.searchParams.set('lang', control.dataset.lang);
  history.replaceState(null, '', next);
  window.PSDLanguage.set(control.dataset.lang, { persist: true });
});
reduced.addEventListener('change', event => { paused = event.matches; updatePause(); });
addEventListener('psdlanguagechange', () => {
  language = document.documentElement.lang === 'cs' ? 'cs' : 'en'; copy = packs[language];
  localize();
  if (model) { registerChart(); draw(); }
});
addEventListener('hashchange', () => {
  if (!controller) return;
  const state = controller.readState();
  controller.spec.state.apply(state);
  draw();
});
localize();
try {
  const [budget, spending, detail] = await Promise.all(['data/czech-budget.v1.json', 'data/cz-spending-2026.v1.json', 'data/money-flow-detail-2026.v1.json'].map(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Budget data: ${response.status}`);
    return response.json();
  }));
  model = withFlowDetail(buildMoneyFlow(budget, spending), detail);
  model = learningOverview(model);
  tree = indexFlowTree(model);
  registerChart(); draw(); renderLesson();
} catch (error) {
  $('#flow-loading').textContent = copy.error;
  console.error('Money flow unavailable:', error);
}
