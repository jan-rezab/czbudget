# České zdravotní pojišťovny – skutečnost 2024

Všech sedm aktivních zdravotních pojišťoven je propojeno přes IČO s registrem
`data/cz-public-entities-2024.json`. Oficiální zdroj: [hodnocení MZ/MF](https://mzd.gov.cz/hodnoceni-vyvoje-systemu-verejneho-zdravotniho-pojisteni/).

## Obnova

Z kořene webového repozitáře, s Pythonem a knihovnou openpyxl:

```sh
python3 pipeline/transforms/prepare_health_insurers_2024.py --download
python3 pipeline/transforms/build_public_entity_web_dataset.py
node --test tests/unit/health-insurers.spec.mjs
```

Bez `--download` se použijí původní XLSX soubory uložené v pracovním kořeni
`data/source_cache/health_insurers/`. Normalizovaný soubor
`data/cz-health-insurers-2024.json` obsahuje URL zdrojů, jejich SHA-256 a adresy
použitých buněk. Webový build čte tento normalizovaný soubor, takže doplnění
přežije další sestavení registru. Historické řady VZZ se nemění.

## Význam údajů

- Tabulka 1, část A: skutečné příjmy celkem včetně zdaňovaných činností,
  výdaje celkem a jejich saldo (sloupce X, AR, AZ). Nejde o plán ani údaje
  přepočtené na pojištěnce. Používají se výhradně řádky 7–13 aktivních pojišťoven.
- Tabulka 2: čistá aktiva k 31. 12. 2024 (řádek 61) a samostatný účetní
  výsledek běžného období (řádek 89). Kontroluje se rovnost aktiv a pasiv.
- Tabulka 3: skutečné náklady na zdravotní služby včetně dohadných položek,
  které nejsou totožné s peněžními výdaji. Jsou uloženy jako doplňující údaj.
- Částky se převádějí z tisíců na miliony Kč. Údaje o pojištěncích a FTE
  zůstávají v osobách. U každé pojišťovny se kontroluje saldo a součty se
  porovnávají s ministerskými kontrolními součty aktivních pojišťoven.

Ve webové tabulce se pojišťovnám zobrazují příjmy, výdaje, saldo, aktiva a odkaz
na zdroj. Vlastní záložka shrnuje příjmy, výdaje, saldo a aktiva.
Firemní pole `revenue_mczk`, `cost_mczk`, `net_result_mczk` a marže zůstávají
prázdná: pojišťovací peněžní toky se nesčítají s firemním obratem ani ziskem.
Účetní výsledek z rozvahy se zachovává v `health_insurance.accounting_net_result_mczk`.

Kontrolní součty (mil. Kč): příjmy 504 667,887; výdaje 512 186,394;
saldo −7 518,507; aktiva 116 797,224. Saldo se nesmí zaměnit za účetní
výsledek z rozvahy 30,482 mil. Kč.
