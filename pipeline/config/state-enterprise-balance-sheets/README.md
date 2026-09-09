# Individuální rozvahy 2024

Ručně ověřené základní údaje všech 38 subjektů portfolia MF. Datum rozvahy je
31. 12. 2024. Původní PDF jsou v `../data/source_cache/state_enterprise_balance_sheets/2024`
vůči kořenu website; záměrně nejsou součástí webového balíčku. Každá položka má
veřejnou URL, SHA-256, původní jednotku a čísla PDF stránek od 1.

Generování z kořene website:

```sh
python3 pipeline/transforms/prepare_state_enterprise_balance_sheets.py --verify-cache ../data/source_cache/state_enterprise_balance_sheets/2024
```

Bez `--verify-cache` stačí verzovaný vstup. Generátor obnoví samostatný JSON
a připojí údaje ke kartám podle IČO. Extraktor karet MF provádí stejné připojení.
Normalizovány jsou cash, aktiva netto, vlastní kapitál a dopočet ostatních pasiv.
Úplné rozvahy jsou dostupné na citovaných stránkách zdrojových PDF; jejich všechny
řádky nejsou normalizovány. Skeny byly čteny OCR a klíčové nejasnosti kontrolovány
v obrazu, zejména nízká hotovost PRISKO a sloupce Thermal.

Součet je hrubý součet právnických osob, bez konsolidačních eliminací. Obsahuje
100 % jejich vykázaných peněz bez vážení vlastnickým podílem. Není to hotovost
celého veřejného sektoru ani disponibilní zdroj rozpočtu. ČEB, NRB a EGAP mají
samostatný mezisoučet. Investice se nepřičítají automaticky k peněžní položce.

Původní `metrics.debt` je indikátor z karty MF; nesmí nahrazovat závazky rozvahy.
Nový `non_equity_funding_czk` = aktiva minus vlastní kapitál zahrnuje také rezervy
a případné časové rozlišení a není úročený dluh. Rozdíly aktiv a kapitálu proti
MF jsou uchovány (`mf_card_difference_czk`). Významnější rozdíly mají ČEPS a
Budvar; do původních hodnot MF nezasahujeme. Budvar uvádí i upravené srovnání 2023;
používáme běžné období 2024, nikoli srovnávací sloupec.

## BigQuery import (oddělený od publikace)

```sh
python3 pipeline/warehouse/load_state_enterprise_balance_sheets.py --account jan@ravineo.com --execute
```

Loader používá existující přihlášení pouze pro svůj proces. V jedné transakci
provede MERGE do `czbudget-janrezab.budget_detail.public_entities`,
`public_entity_sources`, `public_entity_balance_sheet_facts` (152 položek)
a `public_entity_cash_facts` (38 položek). Zápis je omezen zdrojem, datem,
entitou a kódem položky; obecní ani jiné účetní záznamy nenahrazuje.
Součtové položky aktiv, vlastního kapitálu a cash se nesčítají mezi sebou.
Zdrojové `notes` uchovávají úplný normalizovaný záznam v JSON včetně PDF stránek,
definice hotovosti a metodických poznámek. Příznak `selected_portfolio` vymezuje
pokrytí; dopočet ostatních pasiv má příznak `derived_assets_minus_equity`.
