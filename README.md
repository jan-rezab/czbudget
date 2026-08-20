# Public Spending Data — statický bilingvní portál

Web je čisté HTML, CSS a JavaScript bez frameworku a bez vazby na konkrétní
hostingovou platformu.

## Lokální spuštění

```bash
./serve.sh
```

Potom otevřete <http://localhost:3000/>.

## Informační architektura

- `index.html` — kondenzované mezinárodní srovnání a adresář zemí
- `homepage-v2.js` — filtry srovnání a česká/anglická lokalizace homepage
- `country.html?code=CZE&lang=cs` — sdílená šablona detailu každé země
- `country.js` — dlouhodobé řady, národní specifika, zdroje a CS/EN překlady
- `styles-v2.css` — vizuální systém homepage a detailů zemí
- `cz/obce/` a `cz/kraje/` — filtrovatelné české územní benchmarky
- `cz/obce/<slug>/` a `cz/kraje/<slug>/` — indexovatelné detailní profily
- `data/entities/<ico>.json` — strojově čitelný detail účetní jednotky
- `cz-obce.html` — zpětně kompatibilní přesměrování na `cz/obce/`
- `cesky-rozpocet.html` a `cesko.html` — připravené české tematické vrstvy
- `lib/data/sovereign-benchmark.v1.json` — harmonizované fiskální řady
- `data/catalog.v1.json` — katalog národních zdrojů a rozpočtových specifik

Volba jazyka se přenáší v URL parametru `lang` a ukládá do `localStorage`.
Nové texty mají být přidávány do slovníků `I` a `T`, nikoli natvrdo do
dynamicky generovaného rozhraní.

Celý obsah složky lze nahrát na libovolný statický hosting; build není potřeba.

České územní stránky se po aktualizaci `data/benchmark.v1.json` regenerují
skriptem `../scripts/build_czech_site.py`. Proměnná `PUBLIC_ORIGIN` při
sestavení určuje produkční canonical URL a adresu sitemap.

## Produkční nasazení

Tato složka je samostatný kanonický Git projekt. Každý push do hlavní větve
spustí validaci, vytvoří neměnný kontejner označený Git commitem a nasadí jej
do samostatné Cloud Run služby `czbudget-public` v projektu
`czbudget-janrezab`. Služba `czbudget-web` ani projekt Riverdata nejsou součástí
tohoto deploymentu.

Lokální kontrola před commitem:

```bash
node scripts/validate-site.mjs
```
