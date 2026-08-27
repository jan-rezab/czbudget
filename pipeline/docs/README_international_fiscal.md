# Mezinárodní fiskální benchmark 2005–2024

Tato vrstva je srovnávací páteř, nikoli hotová vizualizace státních rozpočtů.
Používá jednotnou definici sektoru vládních institucí (general government) z IMF
WEO pro všech 191 suverénních států, pro které se v sešitu z dubna 2026 nachází
ekonomická řada. Chybějící pozorování zůstávají `null`; nejsou nahrazena nulou.

## Pokrytí zemí

- kotva: Česko
- zadané země: Ukrajina, Polsko, Německo, Spojené království, Francie, USA
- institucionální benchmarky: Švýcarsko, Švédsko, Dánsko
- globální makrofiskální profil: dalších 174 států
- bez řady v IMF WEO: Kuba, Monako, Severní Korea a Vatikán

„Anglie“ je v datech vedena jako Spojené království. Anglie nemá samostatný
suverénní státní rozpočet, který by byl s ostatními zeměmi srovnatelný.

## Co už je v datech

- příjmy a výdaje v % HDP
- celkové, primární a strukturální saldo
- hrubý vládní dluh
- velikost ekonomiky a HDP na obyvatele
- reálný růst, inflace a nezaměstnanost
- u každé hodnoty příznak actual/estimate podle zdrojové řady
- popisné 20leté benchmarky bez jednoho zavádějícího skóre
- registr ověřených národních zdrojů pro detailní rozpočtové stromy
- strojově čitelný registr fiskálních perimeterů a fiskální architektury všech deseti zemí

## Fiskální perimeter: tři odlišné účetní hranice

Dataset výslovně rozlišuje tři koncepty, které se nesmějí zaměňovat ani sčítat:

1. **Národní státní či federální rozpočet** je právní a pokladní plán ústřední
   vlády podle národních pravidel. Obvykle nezahrnuje vlastní rozpočty obcí a
   regionů, samostatné veřejné fondy ani hrubé tržby veřejných korporací.
2. **Sektor vládních institucí (general government)** je harmonizovaný
   statistický sektor ústřední, regionální a místní vlády a fondů sociálního
   zabezpečení. Vnitřní transfery jsou konsolidovány. Právní forma jednotky není
   rozhodující; rozhoduje institucionální klasifikace a tržní test.
3. **Veřejný sektor včetně korporací** rozšiřuje sektor vládních institucí o
   veřejné finanční a nefinanční korporace. Jejich obrat, náklady, aktiva a
   závazky jsou samostatné podnikové veličiny, nikoli rozšířené příjmy a výdaje
   státního rozpočtu.

Do příjmů státního rozpočtu proto patří pouze skutečně odvedené dividendy,
podíly na zisku, daně a další platby podniku státu. Dotace a kapitálové vklady
proudí opačným směrem. Přičíst celý obrat nebo účetní zisk veřejné korporace ke
státním příjmům by vedlo k dvojímu započtení a ekonomicky chybnému výsledku.

Zdrojová konfigurace je v `data/fiscal_scope_registry.json`; generovaný webový
dataset ji publikuje jako `fiscal_perimeters` a `countries[].fiscal_architecture`.
Srovnávací řady na webu používají výhradně sektor vládních institucí.

## Co v této vrstvě záměrně není

- mix federálního rozpočtu USA s konsolidovaným rozpočtem Francie
- automatické hodnocení „dobrý/špatný“ pouze podle výše dluhu
- nominální částky převedené jedním měnovým kurzem
- resorty, programy, účty, příjemci a jednotlivé transakce

Tyto položky patří do národních vrstev s vlastní účetní a institucionální
metodikou. Společné porovnání se provede až po mapování do stabilních analytických
dimenzí.

## Navržené rodiny benchmarků

1. **Udržitelnost** – dluh, změna dluhu, primární saldo a úroková zátěž.
2. **Disciplína** – původní plán, upravený plán, skutečnost a systematické odchylky.
3. **Odolnost** – velikost šoku, rychlost návratu salda a snižování krizového dluhu.
4. **Prioritizace** – co roste, co je vytlačováno a jak se mění podíl funkcí.
5. **Výkon** – výdaj na jednotku výsledku, ne pouze výdaj na obyvatele.
6. **Rigidita** – mandatorní, kvazimandatorní, diskreční a úrokové výdaje.
7. **Mezigenerační stopa** – investice proti běžné spotřebě a implicitní závazky.
8. **Transparentnost** – hloubka klasifikace, periodicita, revize a návaznost na výsledek.

## Kandidáti na nové vizualizace

- **Fiskální EKG**: 20 let salda, primárního salda, dluhu a růstu v jednom synchronním pohledu.
- **Rozpočtová gravitace**: co vytlačuje nové priority – penze, úroky, obrana, zdravotnictví.
- **Plánovací otisk**: heatmapa systematického pře-/nedočerpávání po kapitolách a letech.
- **Dluhová paměť**: každá krize jako vrstva dluhu a rychlost jejího umořování.
- **Cena výsledku**: výdaj spojený s konkrétním outcome ukazatelem a mezinárodním benchmarkem.
- **Rozpočet bez účetní osnovy**: cesta od vybrané koruny přes instituci a nástroj k příjemci a výsledku.

## Reprodukce

```bash
python3 scripts/prepare_international_fiscal_benchmarks.py
```

Zdrojový soubor lze znovu stáhnout přepínačem `--download`. Skript generuje
JSON pro analýzu a web, dlouhé CSV s jednotlivými pozorováními a souhrnné CSV.
