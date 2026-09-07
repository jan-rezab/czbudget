# Firemní sektor a průmyslová diagnostika Eurostatu

Web: `/deep-dives/industry/diagnostics/`. Odkaz je také v původním průmyslovém exploreru.

## Rozsah dokončeného stažení

Snapshot z 8. září 2026 místního času obsahuje **120 datových sad**, **25 966 873 zdrojových řad** a **245 963 679 číselných buněk** v dostupných obdobích od roku 2010. Úplný seznam je v `pipeline/config/industrial-intelligence.json`. Zahrnuje podnikové a finanční účty, SBS, kapitál a produktivitu, průmyslové STS, průzkumy kapacit a objednávek, energetické účty, demografii podniků, zahraniční vlastnictví, charakteristiky obchodu, globální řetězce, FIGARO a PRODCOM.

Jde o úplné stažení těchto 120 vybraných sad se všemi vrácenými zeměmi a rozměry, **nikoli o celou databázi Eurostatu ani záruku, že neexistuje další relevantní tabulka**. Číselné buňky zahrnují také číselná metadata PRODCOM; nejsou totožné s počtem ekonomických pozorování.

Zdrojový archiv je mimo webový repozitář:

`/Users/johnwick/dev/czbudget/outputs/20260908-industrial-intelligence/`

- `raw/`: původní komprimované odpovědi Eurostatu, včetně starších období.
- `filtered/`: všechny dostupné sloupce od roku 2010, původní hodnoty a příznaky.
- `metadata/`, `manifest.json`, `scope.json`: pokrytí, URL, čas stažení, SHA-256.
- `validation.json`: dokončená kontrola 240 zdrojových souborů a 37 118 webových datových dílů.

Webová kopie `data/industrial-intelligence/` obsahuje bezeztrátové komprimované JSON díly (celkem 648 474 865 bajtů samotných dílů), indexy a číselníky. Rozdělení podle země a odvětví/výrobku umožňuje prohlížeči načíst jen vybranou část. Největší komprimovaná část výběru má 4 223 904 bajtů; prohlížeč drží nejvýše tři části v mezipaměti. Fyzická velikost na disku je kvůli počtu souborů vyšší.

## Co web umí

- Společný graf hrubého provozního přebytku a hrubých fixních investic nefinančních podniků vůči přidané hodnotě.
- Šest vstupních pohledů: kapacity, reálná výroba, investice do zařízení, energie, domácí přidaná hodnota v exportu a konkrétní výrobky.
- Prohlížení každé ze 120 sad: země, všechny dimenze, vyhledávání výrobků, časové období a srovnání zemí se shodnými rozměry.
- Tabulky, CSV, PNG, citace a původ zdroje přes společný PSDChart.
- Sdílitelný výběr v URL, české a anglické rozhraní. Oficiální názvy ukazatelů zůstávají z číselníků Eurostatu.

Pohledy zobrazují skutečné zdrojové řady, nikoli automatický kauzální verdikt nebo syntetické skóre zdraví země. Energie sama není energetická efektivita; investiční podíl není čistá investice po odpisech; domácí přidaná hodnota neznamená domácí vlastnictví.

## Integrita a omezení

- Rok 2010 je začátek požadovaného filtru. Sady vzniklé později nemají doplněné fiktivní roky. Například nové SBS začínají 2021 a tento PRODCOM snapshot končí 2024.
- Aktuálně revidovaná historie není historický real-time vintage.
- Chybějící, utajené a nulové hodnoty zůstávají odlišné. Zdrojové příznaky se zachovávají. Řádky obsahující výhradně prosté chybějící `:` lze nalézt v původním raw souboru; filtrovaná kopie je vynechává.
- Metodické zlomy a mezery se nepřemosťují. Staré a nové klasifikace se automaticky neslepují.
- PRODCOM propojuje jednotky a příznaky důvěrnosti ze samostatných řad. Jednotky se normalizují jen u ekvivalentních zápisů, např. `M2`/`m2`. Metadata se nezobrazují jako produkce. Při skutečně různých jednotkách je společný graf vypnutý, tabulka zůstává dostupná.
- Porovnání národních měn a PPS mezi zeměmi je v grafu vypnuté. Žádný nezdokumentovaný měnový přepočet.
- Záznamy chyb a neúplnost jsou explicitní v manifestu. Dokončený snapshot má 0 chyb a 0 čekajících sad.

## Opakování pipeline

Spouštět z adresáře `website`. Pro nový vintage použijte **nový výstupní adresář**; existující snapshot se obnovuje z cache a nestahuje nové revize.

```sh
python3 scripts/fetch-industrial-intelligence.py --output ../outputs/20260908-industrial-intelligence --start-year 2010
python3 scripts/build-industrial-intelligence.py --source ../outputs/20260908-industrial-intelligence
python3 scripts/fetch-industrial-labels.py --source ../outputs/20260908-industrial-intelligence
/Users/johnwick/.codex/bin/resource-guard.py serial -- python3 scripts/validate-industrial-intelligence.py --source ../outputs/20260908-industrial-intelligence
python3 -m unittest discover -s tests -p test_industrial_intelligence.py
node --test tests/industrial-data.test.cjs
```

Downloader používá nejvýše dva pracovníky. Validátor znovu ověřuje SHA-256 původních a filtrovaných souborů, každý webový díl, počty řad a úplnost rozsahu. Testy ověřují roundtrip hodnot/příznaků, nuly, důvěrnost, mezery, jednotky a kompletnost indexu.

Statický web se publikuje přes existující GitHub → Cloud Build → Cloud Run pipeline podle `AGENTS.md`. Cloud Build ověřuje každý datový díl (`validate-industrial-release.mjs`) a pouští browser testy všech pohledů, exportů, souběžného přepínání a obnovy po chybném kontrolním součtu.

Metodika jednotek, příznaků a zaokrouhlení PRODCOM: [oficiální průvodce DS-059358](https://ec.europa.eu/eurostat/documents/120432/19597181/Quick%2Bguide%2Bon%2Baccessing%2BPRODCOM%2Bdata%2BDS-059358.pdf/30ad2839-31cd-32b0-c0f2-d43f200be35e?t=1762360585715). Základ zaokrouhlení je u výrobních řad zahrnut v tabulce a CSV.

## Produkční úpravy reportu

Angličtina je výchozím jazykem HTML; sdílená jazyková komponenta respektuje explicitní `lang=cs` i uloženou volbu. Přepnutí jazyka zachová výběr. Report obsahuje úvod, dvě skutečné podnikové míry, šest ekonomických témat s vysvětlením, interaktivní grafy ovládané i klávesnicí, katalog a metodiku.

Po původním sestavení lze bezeztrátově sloučit malé díly:

```sh
python3 scripts/compact-industrial-intelligence.py --source data/industrial-intelligence --output ../outputs/industrial-serving-next
```

Nový adresář nejprve ověřte validátorem s `--serving ../outputs/industrial-serving-next`, potom jím nahraďte webovou kopii a starou uchovejte mimo repozitář. Díly obsahují nejvýše 5 000 řad. Prohlížeč načítá nejvýše tři soubory současně, kontroluje SHA-256, přeruší zastaralý výběr a nabízí opakování po chybě. Síťové požadavky mají 30sekundový limit. Osám grafů se mění skutečné rozměry podle zařízení; neměřítkuje se desktopový text na nečitelnou velikost.

Komprimovaná webová data jsou součástí vydávaného Git commitu stejně jako stávající průmyslový archiv. Původní TSV snapshoty zůstávají mimo repozitář. Pro další pravidelná velká vydání je vhodné navázat na existující systém datových vrstev, až bude dostupný zápis do jeho bucketu; pro toto vydání není vyžadována žádná nová cloudová služba nebo oprávnění.
