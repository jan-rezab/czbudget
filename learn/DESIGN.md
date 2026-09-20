# PSD Learn — návrh 02

Datum: 21. září 2026. Stav: interaktivní návrh na větvi `codex/learn-discover`; bez nasazení do produkce.

## Produktové rozhodnutí

Navrhovaná veřejná adresa je `/learn/`. `/study/` může být později jednoduchý redirect. Learn pojme děti i samostatné dospělé; Study působí více akademicky. Název sekce se nepřekládá, její obsah a navigace budou mít CS a EN variantu. Aktuální návrh je česky.

Learn má vlastní navigaci, typografickou hierarchii a scoped styly. Z hlavního webu do něj vede jeden vstup; zpět je diskrétní odkaz Data PSD. Zachováváme oficiální značku PSD, papírové povrchy, inkoust a zelený akcent. Vizuální zpracování jednotlivých úrovní se liší, jejich navigace a vzdělávací logika zůstávají společné.

## Navrhované cesty

- `/learn/`: pět úrovní; věk je doporučení, ne přístupové omezení.
- `/learn/discover/`: věk 5–11, šest témat, volba obtížnosti.
- `/learn/discover/choices/`: první aktivita s omezeným rozpočtem.
- `/learn/teachers/`: cíle, předpoklady, mapování osnov, řešení a diskusní otázky.
- Později `/learn/explore/`, `/learn/explain/`, `/learn/evaluate/`, `/learn/research/`.

V návrhu jsou cesty simulované přepínáním obrazovek. Další úrovně ukazují pouze plán. Ostatních pět Discover lekcí má zadání a zamýšlený princip; nejsou prezentovány jako hotové hry.

## Discover: vzdělávací pořadí

| Téma | Výstup dítěte | Interakce | Vazba na rámec |
| --- | --- | --- | --- |
| Na všechno nestačí | Vybere dostupnou kombinaci a pojmenuje odloženou možnost. | Vylepšování modelového městečka za 10 nebo 100 žetonů. | KS1/KS2 matematika: sčítání, odčítání, slovní úlohy; obohacení o omezené zdroje. |
| Kdo platí naši školu? | Popíše, že společná služba něco stojí. | Postupně odkrývaná cesta peněz ke škole. | PSHE/Citizenship obohacení, veřejné instituce; nejde o tvrzení o povinném samostatném předmětu ekonomie. |
| Co opravdu potřebuji? | Vysvětlí, proč se potřeby lidí liší podle situace. | Košíky pro různé postavy, více obhajitelných řešení. | Rozhodování a finanční vzdělávání. |
| Malé peníze, velký plán | Sestaví jednoduchý plán spoření. | Týdenní skládání žetonů k cíli. | Matematika a finanční plánování. |
| Stejné peníze. Jiný nákup. | Porovná kupované množství při různých cenách. | Dva košíky, stejný rozpočet, proměnlivá cena. | Počítání s penězi; pro starší jednotkové ceny. |
| Moje město doopravdy | Najde skutečnou službu, rok údaje a zdroj. | Kurátorovaný vstup do ověřených obecních dat PSD. | Čtení dat a občanské souvislosti. |

Mapování je pracovní návrh. Před veřejným označením „aligned to curriculum“ vyžaduje kontrolu konkrétních ročníků a pedagogickou revizi. Anglické osnovy, zemi dat a jazyk obsahu vedeme odděleně.

## Dvě obtížnosti

5–7: deset viditelných žetonů, krátké zadání, počítání a porovnávání; dospělý může číst. Pro produkci navrhnout dobrovolné namluvení skutečného zadání, ne nefunkční ikonu reproduktoru.

8–11: sto žetonů po desítkách, dvě porovnatelné kombinace, otázka komu výběr pomůže. Procenta jsou volitelná pro 10–11; nepředpokládáme jejich zvládnutí u osmiletých.

První aktivita pracuje s malým rozpočtem na zlepšení, nikoli s kompletním obecním hospodařením. Škola ani doprava nepřestávají existovat, když si dítě jejich vylepšení nevybere. Zůstatek lze ponechat. Neučíme, že veřejný rozpočet se ve všem chová jako domácnost, že se musí vždy vyrovnat nebo že všechny daňové příjmy mají přímou cestu k jedné konkrétní službě.

## Vizuální koncept

Discover: barevné hračkové městečko, zlaté žetony, průvodce Žetík, krátké věty a tlačítka s hmatatelnou odezvou. Teplá korálová, fialová a modrá doplňují ilustrace uvnitř Learn; jde o lokální návrh rozšíření palety, nikoli změnu oficiálního loga nebo barev statistických řad. Volba mění scénu a má čitelný textový ekvivalent. Krátká reakce na volbu respektuje reduced motion; žádné trvale běžící animace.

### Balanc: hravost a hloubka jsou dvě různé osy

Společná zůstává značka, navigace a postup **otázka → pokus → vysvětlení → důkaz**.
Mění se způsob znázornění, hustota informací a nároky na zdůvodnění.
Nezamykáme obsah podle data narození: věk je doporučení, přepnutí je dobrovolné.

| Úroveň | Vizuální jazyk | Stejná otázka s rostoucí hloubkou |
| --- | --- | --- |
| Discover 5–7 | Městečko, postavička, 10 žetonů | Co se vejde a co necháme na příště? |
| Discover 8–11 | Městečko + volitelná tabulka, 100 žetonů; procenta až jako rozšíření pro 10–11 | Jak se liší dvě možnosti a komu pomohou? |
| Explore 11–14 | Interaktivní mapy a toky, méně dekorací | Jaký podíl rozpočtu jde na jednotlivé služby? |
| Explain 14–16 | Experimenty, grafy, konkrétní modely | Jak vysvětlím náklady obětované příležitosti? |
| Evaluate 16–18 | Vedle sebe scénáře a argumenty | Kdo získá, kdo zaplatí a za jakých předpokladů? |
| Research 18+ | Datový pracovní prostor, definice a zdroje | Je vztah příčinný? Jak výsledek reprodukuji? |

První most už funguje: **Městečko / Podívat se na čísla** ukazuje stejný model
ve dvou reprezentacích. Přepnutí zachová výběr a rozpočet. Změna věkové skupiny
převádí 10 na 100 žetonů, nemění poměry. Samotná změna měřítka ještě není
pokročilejší výuka; vyšší obtížnost v hotovém produktu musí přidat srovnání,
vysvětlení a práci s předpoklady. Návrh proto ukazuje navazující otázku pro každou
další úroveň, ale nevydává tyto lekce za implementované.

Hra odměňuje objev a zdůvodnění. Není tu skóre „správného“ rozdělení peněz,
žebříček, časový tlak, ztracené životy ani povinná série návštěv. Jiná preference
není chyba. Průvodce není součástí navigačního základu; pokročilé úrovně ho nepotřebují.

Další úrovně mají vlastní vizuální slovník: Explore — propojení a toky; Explain — experimenty s grafy a modely; Evaluate — porovnání scénářů; Research — datové vrstvy a reprodukovatelné analýzy. Nejde o přebarvení stejného dětského rozhraní.

V návrhu funguje cesta Learn → Discover → výběr v městečku → vysvětlení → závěr, návrat, obě obtížnosti, plán dalších lekcí a učitelský přehled. Čísla jsou výslovně modelová. Reálné datové aktivity budou používat jen publikované, ověřené release PSD, s připnutým rokem a zdrojem.

## Oddělení kódu a nasazování

Aktuální závazný provozní rámec: jeden repozitář, Cloud Build v europe-west1, jediná produkční služba `czbudget-public`. Referenční dokumenty: `../AGENTS.md` a `../BUILD_PLANES.md`.

Doporučený první krok: samostatný adresář `learn/`, vlastní shell a izolované CSS/JS, společná značka a publikované datové kontrakty. Vlastní sada kontrol pro Learn, ale první zásah do navigace/routování musí projít úplnou verifikací podle současného selectoru. Stránky používají nativní stack PSD. Produkční nasazení zůstává společné a atomické. Tohle umožňuje oddělenou práci na sekci, nikoli nezávislé produkční deploye.

Skutečně samostatné vydávání by bylo samostatný architektonický krok. Možnosti jsou samostatně verzovaný kódový balíček obsluhovaný stávající službou nebo druhá služba za směrováním `/learn/*`. Druhá služba by byla změnou současného pravidla jedné služby; první možnost zase potřebuje bezpečný manifest, atomickou změnu verze, cache a rollback. Obě vyžadují návrh, testy a explicitní rozhodnutí, nikoli pouhé přidání nového deploy skriptu.

Nedoporučuji pro první Discover přidávat druhý runtime, repozitář ani release systém. Navržené rozhraní modulu má pozdější oddělení umožnit, ale dnes ho nepotřebuje. Oddělené vydávání kódu Learn se nesmí tvářit jako datová pipeline a obcházet produkční bránu.

## Inspirace

- [Bank of England: Money and Me](https://www.bankofengland.co.uk/education/education-resources/money-and-me): konkrétní situace, krátké aktivity, materiály pro dospělé.
- [Bank of England: econoME](https://www.bankofengland.co.uk/education/econome): rozhodování, důkazy a vysvětlení následků.
- [CORE Doing Economics](https://www.core-econ.org/project/doing-economics/): pozdější přechod od otázky k práci se skutečnými daty.
- [Anglické osnovy matematiky](https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study/national-curriculum-in-england-mathematics-programmes-of-study): ročníkově odstupňované dovednosti.

Inspirujeme se vzdělávacími principy. Postavy, ilustrace a texty těchto projektů nekopírujeme.

## Ověření návrhu

Ověřeno ve vestavěném prohlížeči: průchod aktivitou,
vracení voleb, blokování překročení rozpočtu, zpětná vazba, převod 10/100,
procenta, shoda tabulky a městečka, obnovení rozpracované volby po reloadu,
šířky 320, 360 a 1024 px bez vodorovného přetékání a konzole bez chyb. Vizuální kontrola proběhla v aktuálním tmavém schématu. Úplná cloudová verifikace produkčního kandidáta
je samostatná podmínka před případným sloučením na main.
