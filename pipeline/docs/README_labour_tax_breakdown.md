# Zaměstnanecké daně a povinné odvody, 2025

Dataset: `data/labour-tax-breakdown-2025.v1.json`. Výpočet:
`python3 scripts/build-labour-tax-breakdown.py`. Stav ověření: 9. 9. 2026.
Data nejsou připojena do uživatelského rozhraní ani nasazena.

Scénář OECD: bezdětný jednotlivec, 100 % průměrné mzdy každé země.
Nejde o stejnou mzdu v eurech ani o sazbu platnou pro každého zaměstnance.

## Rozdělení při hrubé mzdě 100

Částky jsou jednotky na 100 jednotek hrubé mzdy. Tabulka zachovává základní
hranici Taxing Wages; další povinné platby jsou v následující tabulce.

| Země | Daň z příjmu | Odvody zaměstnance | Odvody a mzdové daně zaměstnavatele | Čistá mzda před dalšími povinnými platbami | Náklad zaměstnavatele před dalšími platbami |
| --- | ---: | ---: | ---: | ---: | ---: |
| Česko | 9,73 | 11,60 | 33,80 | 78,67 | 133,80 |
| Španělsko | 17,06 | 6,48 | 30,57 | 76,46 | 130,57 |
| Německo | 17,22 | 21,46 | 20,87 | 61,32 | 120,87 |
| Francie | 16,67 | 11,31 | 36,35 | 72,02 | 136,35 |
| Polsko | 6,61 | 17,83 | 16,30 | 75,56 | 116,30 |
| Británie | 17,55 | 5,59 | 13,66 | 76,86 | 113,66 |
| Švýcarsko | 11,65 | 6,40 | 6,40 | 81,95 | 106,40 |
| Nizozemsko | 17,85 | 10,02 | 12,60 | 72,14 | 112,60 |

Zdroj: existující `oecd-key-metrics.v1.json`, Taxing Wages 2026. Daň z příjmu
je efektivní daň po standardních úlevách modelu, nikoli zákonná mezní sazba.
Zaokrouhlení mohou způsobit rozdíl 0,01 v zobrazených součtech.

## Širší hranice povinných plateb

| Země | Základní klín | Včetně modelovaných povinných nedaňových plateb |
| --- | ---: | ---: |
| Česko | 41,2 % | 41,2 % |
| Španělsko | 41,4 % | 41,4 % |
| Německo | 49,3 % | 49,3 % |
| Francie | 47,2 % | 47,2 % |
| Polsko | 35,0 % | 40,0 % |
| Británie | 32,4 % | 32,4 % |
| Švýcarsko | 23,0 % | 40,2 % |
| Nizozemsko | 35,9 % | 49,9 % |

Zdroj: [OECD NTCP 2025, tabulka 1, sloupec 2](https://www.oecd.org/content/dam/oecd/en/topics/policy-issues/tax-policy/non-tax-compulsory-payments.pdf).
Soubor je uložen ve společné cache, jeho SHA-256 je v JSON.
Rozšířený ukazatel používá rozšířené náklady práce jako jmenovatel. Stále
nezahrnuje povinné pracovní úrazové pojištění Česka, Španělska, Německa a
Švýcarska. Povinná platba do penzijního fondu není totéž jako daň státu.

## Česko a Španělsko: jednotlivé pojistné složky

V procentech z hrubé mzdy v uvedeném modelu; pořadí zaměstnanec / zaměstnavatel:

- Česko: důchodové 6,5 / 21,5; nemocenské 0,6 / 2,1; zdravotní 4,5 / 9;
  politika zaměstnanosti 0 / 1,2. Celkem 11,6 / 33,8.
- Španělsko: společná složka důchod/nemoc/invalidita 4,7 / 23,6;
  nezaměstnanost 1,55 / 5,5; odborná příprava 0,1 / 0,6;
  mezigenerační mechanismus 0,13 / 0,67; garanční fond mezd 0 / 0,2.
  Celkem 6,48 / 30,57.

Španělská regionální daň je v OECD modelu zahrnuta váženou kombinací
regionálních sazeb. Nesmí se přičítat znovu. Zdravotnictví se financuje hlavně
z daní, takže samostatná česká sazba zdravotního pojistného nemá přímý protějšek.

Zdroje: [OECD Česko](https://www.oecd.org/en/publications/taxing-wages-2026_3a5169ef-en/full-report/czechia_f8f85811.html),
[ČSSZ 2025](https://www.cssz.gov.cz/-/prehled-nejdulezitejsich-udaju-pro-socialni-zabezpeceni-v-roce-2025),
[OECD Španělsko](https://www.oecd.org/en/publications/taxing-wages-2026_3a5169ef-en/full-report/spain_96c2f5c9.html),
[WHO / European Observatory](https://eurohealthobservatory.who.int/publications/i/spain-health-system-review-2024).

## Přepočet a meze

Pro hrubou mzdu 100, daň T, odvody zaměstnance E a zaměstnavatele R:

`klín = (T + E + R) / (100 + R)`.

Pokud přidáme povinné pojištění zaměstnavatele X, vzorec je
`(T + E + R + X) / (100 + R + X)`. Nelze jen přičíst sazbu X k původnímu klínu.
Při ilustrativní španělské sazbě X = 1,5 vychází 42,11 %.
Konkrétní pojistné závisí na profesi a základu; ilustrace není průměr za zemi.

OSVČ, DPH, spotřební daně a dobrovolná pojištění nejsou součástí tohoto
zaměstnaneckého modelu. Detail sociálního a zdravotního členění ostatních
zemí zde zůstává agregovaný podle OECD. Pro osobní kalkulaci je nutné zvolit
příjem, domácnost, region, věk, profesi a režim pojištění. Výsledky neměří
hodnotu veřejných služeb ani individuálních penzijních nároků.
