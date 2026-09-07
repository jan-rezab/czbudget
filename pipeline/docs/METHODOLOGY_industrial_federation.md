# Federace průmyslových statistik

Verze **1.1.0**, 7. září 2026. Vlastník: projekt Public Spending Data.
Normativní návrh a pravidla pro další implementaci. Stav skutečně provedených
kroků je oddělen v závěru; dokument sám neznamená, že všechny kontroly již běží.

## 1. Cíl a měřitelná výhoda

Budujeme federátor veřejných statistických pozorování. Přebíráme ukazatele od
národních producentů a paralelně z Eurostatu. Přidanou hodnotou má být rychlejší
dostupnost, reprodukovatelnost historických verzí, explicitní srovnatelnost a
vysvětlení rozdílů. Netvrdíme vyšší přesnost samotného měření produkce bez důkazu.
Rychlejší přístup a přesnější měření jsou dvě různé vlastnosti.

Každá prezentovaná hodnota musí odpovědět: co měří, koho a jaké území zahrnuje,
za jaké období platí, kdo ji vytvořil, kdo ji zveřejnil, jakou verzi máme,
jak jsme ji získali a co jsme s ní vypočítali. Chybějící odpověď zůstává viditelná.

Národní úřad a Eurostat obvykle nejsou dvě nezávislá měření. V katalogu vedeme
vztah původu dat; shoda dvou distribučních cest znamená konzistenci přenosu,
nikoli dvojnásobné statistické potvrzení. Hodnoty z obou cest se neprůměrují.

## 2. Co přebíráme z Eurostatu

Základem je STS, produkce v objemovém vyjádření, měsíční frekvence, explicitní
NACE, jednotka, indexové období a úpravy NSA/CA/SCA. Meziměsíční vývoj objemu
standardně čteme ze SCA, meziroční z CA. Tabulka `sts_inpr_m` není univerzální
označení všech národních „průmyslových“ součtů: metadata produkce vymezují B, C,
D s vyloučením D353 a E. B–E ani B–F proto automaticky nejsou stejné pokrytí.
Eurostat zveřejňuje národní údaje po přijetí a validaci, evropské agregáty mají
vlastní publikační režim. [Eurostat STS metadata, zejména 3.1, 3.6 a 8.1](https://ec.europa.eu/eurostat/cache/metadata/en/sts_esms.htm).

Evropské agregáty používají ekonomické váhy. Veřejný výstup nemusí obsahovat
všechny vstupy dostupné Eurostatu. Dokumentace také uvádí publikování revidovaných
národních dat do 24 hodin od jejich přijetí. To není záruka 24 hodin od národního
zveřejnění ani údaj o konkrétním přenosu.
[Eurostat: data, agregace a revize](https://ec.europa.eu/eurostat/web/short-term-business-statistics/information-data).

Naše následující pravidla jsou vlastní návrh federace, nikoli tvrzení o vnitřním
informačním systému Eurostatu. Implementace API vychází z jeho veřejného rozhraní
[Statistics API](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started/api).

## 3. Identita ukazatele a povolené spojení

Identitu ekonomického ukazatele tvoří celý kontrakt, nikoli název „industry“:

| Pole kontraktu | Požadovaný obsah |
|---|---|
| `concept` | Objem produkce; prodaná produkce jako explicitní varianta; tržby odděleně |
| `territory` | Země, geografické výjimky, verze hranic a pokrytí |
| `population` | Statistická jednotka, velikostní práh, výběr a výjimky |
| `activity` | Klasifikace, její verze, přesný kód a vyloučení |
| `frequency` | Měsíční, čtvrtletní; kumulativní období odděleně |
| `measure` | Index, meziroční/meziperiodická změna, trend, kumulativní poměr |
| `adjustment` | NSA, CA, SA nebo SCA a známé podrobnosti metody |
| `index_definition` | Referenční období, váhové období, řetězení a cenové pojetí |
| `method_regime` | Platnost definice a identifikátory metodických zlomů |

Zdrojová řada má navíc producenta, distributora, dataset, původní klíč řady a
verzi metadat. Zdrojové pozorování přidává referenční období a vintage.
Stejné číslo kódu ve dvou klasifikacích nestačí. Převod NACE Rev.2/Rev.2.1,
národní klasifikace/NAICS nebo kombinovaného odvětví musí mít verzovaný převodník,
datum platnosti, zdroj a vztah `exact`, `subset`, `superset`, `weighted_bridge`
nebo `unmapped`. Víceznačné převody bez vah zůstávají nepřevedené.

Pro každý pár řad evidujeme `approved_exact`, `approved_transform`,
`candidate`, `incompatible` nebo `insufficient_metadata`. Kandidáty lze ukázat
vedle sebe s popisem, ale nesmějí automaticky vstoupit do přepínání zdrojů,
žebříčku zemí ani do statistiky shody. Schválení obsahuje důkazové URL/soubory,
platnost, autora rozhodnutí a verzi pravidla. Numerická shoda není důkaz definice.

Příklady: české BCD je kandidát pro eurostatové B–D až po ověření výjimek;
polská prodaná produkce větších podniků vyžaduje kontrolu populace; švýcarské
B–E nelze prohlásit za B–D odečtením indexu E. Stavebnictví F se nesmí přimíchat.
SA se nepřejmenuje na SCA jen proto, že to usnadní join.

## 4. Čas, verze a dostupnost

Ukládáme odděleně následující časové údaje. Neznámý čas je `null` s důvodem,
nikoli půlnoc odhadnutého dne.

| Čas | Význam |
|---|---|
| `reference_start/end` | Období ekonomické aktivity |
| `scheduled_release_at` | Plán, s časovým pásmem a verzí kalendáře |
| `publication_at` | Doložené skutečné veřejné zveřejnění dané verze |
| `source_updated_at` | Timestamp datasetu deklarovaný poskytovatelem; nemusí platit pro každou buňku |
| `first_seen_at` | První úspěšná detekce obsahu naším sběrem |
| `retrieved_at` | Dokončení konkrétního stažení |
| `validated_at/served_at` | Dokončení našich kontrol a zpřístupnění |
| `superseded_at` | Kdy jsme zjistili novější verzi; původní se nemaže |

Všechny instanty ukládáme v UTC s původní zónou a přesností. Datum bez hodiny
zůstává datem. Pozorování drží referenční čas a čas, odkdy jej systém znal.
Dotaz „co jsme věděli k T“ vybírá jen verze získané do T a tehdy dostupné
mapování i výpočty. Zpětně nalezené staré vydání může sloužit doloženému
publikačnímu archivu; nesmí simulovat tehdejší znalost našeho systému.

Nezměněný obsah nemění `first_seen_at`. Při periodickém sledování lze okamžik
objevení změny omezit intervalem poslední kontroly starého obsahu a první kontroly
nového. Tento interval měří detekci daného endpointu, nikoli interní příjem
Eurostatem. Plánovaný release sám není důkaz uskutečněného zveřejnění.

Nový obsah = nový neměnný objekt s SHA256. Manifest eviduje původní i konečné URL,
parametry nebo tělo žádosti, HTTP stav, čas, hash, parser, verzi kódu a metadat.
Opakovaná detekce stejného hashe se ukládá jako událost kontroly. Revize, opravy
parseru, změny převodníku a nové metodiky jsou odlišné události. Oprava našeho
parseru se nikdy nevykazuje jako revize statistického úřadu.

## 5. Dvě distribuční vrstvy a rozhodování

Udržujeme národní i eurostatovou cestu v plném rozsahu. Pro uživatele definujeme:

1. **Zdrojový pohled:** přesná podoba každého vydavatele bez spojování hodnot.
2. **Srovnatelný pohled:** pouze schválené kontrakty, shodná definice a úprava.
3. **Nejnovější dostupný pohled:** možnost dřívější národní verze u schváleného
   páru; každá hodnota nese zdroj a verzi, včetně viditelného přechodu zdroje.

Pro konkrétní období rozhoduje nejprve shoda kontraktu a splnění kontrol,
potom doložené pořadí verzí. Datum stažení nemá přednost před skutečným obsahem
revize. Při nerozhodnutelném pořadí verzí nebo nevysvětleném rozporu zůstanou obě
hodnoty vedle sebe jako `unresolved`. Vyšší číslo, čerstvější HTTP hlavička ani
značka Eurostat automaticky nevyhrává. Každé rozhodnutí má důvodový kód.

Změna distributora uvnitř časové řady vyžaduje kontrolu návaznosti. Růst se
nepočítá z čitatele nové národní verze a jmenovatele staré eurostatové verze.
Fallback se vztahuje na celý potřebný výpočetní úsek. Výpadek API zachová
poslední ověřenou verzi s viditelným stářím; nevytvoří nulovou produkci.

## 6. Výpočty, váhy a sezónnost

Přednost má oficiálně publikované tempo se správnou definicí. Náš výpočet má
`derived=true`, vzorec, identifikátory všech vstupů, jejich vintage a verzi kódu.
Pro index stejné řady a verze:

```text
mom_pct(t) = 100 × (I(t) / I(t−1) − 1)
yoy_pct(t) = 100 × (I(t) / I(t−12) − 1)
growth_from_comparison_index = comparison_index − 100
```

Poslední vzorec platí jen pro explicitní základ srovnávaného období = 100.
Chybějící vstup, nulový jmenovatel, zlom nebo nekompatibilní vintage znamená
nedostupný výsledek. Zaokrouhlení vstupů se přenáší do přesnosti výsledku.
Kumulativní index leden–červenec není červencová změna. Měsíční procenta se
nesčítají ani neprůměrují na roční růst.

Přepočet indexové základny je dovolen jen na stejné objemové řadě s úplným
ověřeným referenčním obdobím: `I_new(t) = 100 × I_old(t) / mean(I_old(base))`.
Přezákladnění neřeší odlišnou populaci, váhy ani sezónní metodu. Váhový rok a
indexový referenční rok jsou samostatná metadata. Při nedostatku historie základnu
neodhadujeme. Přeindexované řady nevyjadřují absolutní velikost ekonomik.

Vlastní agregát vyžaduje disjunktní komponenty, ekonomicky odpovídající doložené
váhy, jejich období a platnost, známé pokrytí a zvolenou metodu řetězení. Bez nich
nevznikne součet či prostý průměr indexů jako „EU“. Skupina našich deseti zemí
není EU a nesmí tak být označena. Částečný agregát uvádí podíl pokrytí podle vah;
nepřejmenuje se na úplný po přenormalizování dostupných zemí. Počáteční verze
žádný vlastní evropský agregát nepočítá.

Oficiální sezónní úpravy zachováváme. Vlastní úprava nebo nowcast musí být
samostatný experimentální produkt s dostatečnou historií, verzí modelu,
diagnostikou zlomů, testy na minulých vintages bez budoucí informace a intervalem
nejistoty. Sedm měsíců 2026 není podklad pro spolehlivý nový sezónní model.
Odhady se nesmějí tvářit jako pozorování úřadu.

## 7. Kontrola shody a rozporů

Pořadí párování: kontrakt → období → vintage → jednotka/základ → příznaky → hodnota.
Rozdíl `national − eurostat` se počítá jen pro schválený pár. U temp je v
procentních bodech, u indexů v indexových bodech, nikoli obecně „v procentech“.

Výsledné stavy: `exact_match`, `within_rounding`, `vintage_mismatch`,
`definition_mismatch`, `method_break`, `missing_one_side`, `unresolved_difference`.
Příčina revize vyžaduje časový nebo dokumentační důkaz; rozdíl samotný ji nedokazuje.

Tolerance není univerzální ±0,1. Pokud dvě zveřejněné hodnoty vznikly zaokrouhlením
na d1 a d2 desetinných míst, intervaly mají poloviční šířku 0,5×10^−d1 a
0,5×10^−d2. Jejich průnik podporuje stav `within_rounding`, nikoli jistotu totožného
nezveřejněného čísla. U odvozených temp propagujeme intervaly obou vstupů přes
poměr. Neznámá přesnost nedovoluje automaticky omluvit rozdíl zaokrouhlením.
Shodné číslo přes metodický zlom zůstává neporovnatelné.

## 8. Kvalita, blokace a provoz

Příjem kontroluje HTTP obsah, schéma a číselníky, hash, jedinečnost zdrojového
klíče, frekvenci, konečné numerické hodnoty, období, příznaky a změny rozměrů.
Validace číselníků nesmí předpokládat stabilní pořadí sloupců. Chybějící nebo
potlačená buňka není nula. Původní příznaky, včetně zlomu, odhadu a důvěrnosti,
se uchovávají i při mapování na jednodušší interní status.

Neočekávané schéma, konfliktní duplicita, neznámá jednotka a porušený hash
zablokují danou dávku pro srovnatelný pohled. Výpadek jedné země nesmaže ostatní.
Velký statistický pohyb vyvolá kontrolu, není automatickou chybou: krize může
být skutečná. Důvěrné a potlačené hodnoty se nerekonstruují z agregátů.

Sběr má používat podmíněné HTTP žádosti, omezenou souběžnost, timeout, respekt
k `Retry-After`, omezené opakování a audit odpovědí. Navržený režim po implementaci:
kontrola kolem národního release a následně kontrola Eurostatu, s denním
základním režimem. Přesné intervaly nastavíme podle pravidel endpointu a měřené
latence. Toto vydání nezakládá automatický monitoring.

Kalendáře sledujeme odděleně od dat; plán může být posunut. Retence historie
se řídí revizní politikou zdroje. Kontrola posledního měsíce nestačí: upravené
řady mohou měnit starší hodnoty. Úplné historie stahujeme při rebasingu či zlomu;
průběžné revizní okno musí být zdokumentované, ne univerzálně odhadnuté.

## 9. Jak doložíme, že federace je lepší

Zveřejňujeme oddělené metriky, bez jediného neprůhledného „skóre kvality“:

- Medián/P95 času národní veřejné publikace → naše dostupnost, jen pro doložené
  časy. U detekovaných časů publikujeme nejistotu intervalu a výpadky monitoru.
- Rozdíl první detekce národního a eurostatového obsahu stejné vintage. To je
  náskok detekce distribučních cest; interní předávací zpoždění se z něj netvrdí.
- Pokrytí očekávaných zemí, období a řad; jmenovatel vychází z kontraktu a
  publikačního kalendáře, ne z počtu řad, které se náhodou podařilo stáhnout.
- Podíl schválených párů, rozporů a jejich stáří. Kandidáti jsou samostatně.
- Revize první zachycené hodnoty proti vintage po 30/90/365 dnech. Referenční
  vintage nemusí být „pravda“; hlásíme její horizont a počet dostupných párů.
- Podíl reprodukovatelných výpočtů a úspěšnost obnovení snapshotu z raw + kódu.

Porovnání výkonu uvádí období měření, N, výpadky a výběrová omezení. Historické
první zveřejnění nelze zpětně domyslet z dnešních tabulek. Pro tvrzení o vyšší
přesnosti odhadu vyžadujeme oddělený validační experiment; rychlost k němu nestačí.

## 10. Verze metodiky a stav implementace

Změna definice nebo výběru preferované hodnoty zvyšuje hlavní verzi metodiky.
Rozšíření beze změny významu zvyšuje vedlejší verzi; oprava implementace má
patch verzi, incident a přepočet dotčených výstupů. Release obsahuje changelog,
testy a identifikátor kódu. Staré výstupy zůstávají reprodukovatelné.

**Implementováno:** národní snapshot deseti zemí za dostupné měsíce 2026;
raw a SHA256 manifesty; normalizovaná pozorování; kontrola klíčů, období a
transformací; samostatný Eurostat downloader se zdrojovými dimenzemi, příznaky,
dataset timestampem a zákazem přepsání existujícího snapshotu. Zdrojové cesty
se uchovávají odděleně; Eurostat nepřepisuje národní soubory.

**Nutné před automatickým slučováním:** schválené kontrakty a převodníky,
observační evidence skutečných vintages, historie prvních detekcí, plná
dvoučasová databáze, intervaly přesnosti a pravidla výběru zdroje. Současné
národní extraktory nemají všechny tyto položky; neznámé se nesmějí domýšlet.

**Záměrně dosud neimplementováno:** vlastní agregace EU, vlastní sezonní model,
nowcast, automatické přepínání národní/Eurostat a pravidelný scheduler.
Pro první společný výstup je bezpečná zdrojová vrstva s oběma sadami; chybějící
eurostatová řada zůstane výslovně chybějící, nikoli doplněná pod jeho jménem.


## 11. Rozšíření 1.1.0: všechny dostupné země a roční pohled

Snapshot ze 7. září 2026 objevuje geografie z Eurostatu, nikoli z pevného seznamu
oblíbených zemí. V měsíčním výstupu 2026 má Eurostat data pro 36 zemí; s národními
řadami Británie a USA zobrazuje aplikace 38 zemí. Evropské agregáty nejsou země.
Rozšíření národních crawlerů nad původních deset zemí zatím není implementováno.

Roční frekvence pochází z oficiální tabulky
[sts_inpr_a](https://ec.europa.eu/eurostat/databrowser/product/page/sts_inpr_a),
měsíční z `sts_inpr_m`. Roční změna porovnává celé roky a není součtem měsíčních
procent ani změnou prosinec/prosinec. Zobrazujeme uzavřené roky 2020–2025;
2026 se nepovažuje za dokončený rok. Žádný neúplný rok se neannualizuje.

Veřejná prezentační vrstva odděluje frekvenci, jednotku, očištění, základ indexu,
zdroj a úroveň klasifikace. Pro Eurostat indexy vybírá současný základ 2021;
starší základy zůstávají v raw snapshotu. Národní základy se nepřepisují.
Čtvrtletní, kumulativní a trendové varianty do tohoto měsíčního/ročního grafu
nevstupují. Zdrojové řady se neporovnávají automaticky jen podle podobného názvu.

U britských a amerických odvozených změn se používá 100 × (I_t / I_s − 1),
s předchozím měsícem nebo stejným měsícem předchozího roku ze stejné řady,
stejného očištění a základu. Výpočet z publikovaných zaokrouhlených indexů může
mít jinou přesnost než oficiální publikovaná změna. Příznak odvození a původní
indexy se uchovávají; sezónní očištění se nepřejmenovává na kalendářní.

Graf odvětví je žebříček změn, nikoli příspěvků k růstu. Celkový průmysl je
publikovaný agregát. Pruhy se nesčítají a mohou mít neúplné odvětvové pokrytí.


### Historické rozšíření od roku 2010

Historický snapshot zahrnuje měsíční období od ledna 2010 a oficiální roční
pozorování od roku 2010. Na aktuální neuzavřený rok se roční dotaz nevztahuje.
Historie zachycuje současné revidované hodnoty; není to archiv toho, co bylo
publikováno v roce 2010. Úplnost období se ověřuje odděleně od metodických zlomů.
Národní kanál zůstává ve svém skutečně staženém rozsahu, bez doplnění Eurostatem.
