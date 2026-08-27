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
- `country.html?code=CZE&lang=cs` — sdílená šablona detailu země; čisté trasy
  publikují 191 států s řadou IMF WEO, z toho 17 s plným národním dashboardem
- `country.js` — dlouhodobé řady, národní specifika, zdroje a CS/EN překlady
- `municipalities/` — centrální evropský obecní rozcestník s filtrem všech 27 hlavních měst EU
- `municipalities/czechia/` — český obecní přehled, celostátní insighty a navigace na úplný adresář a velká města
- `municipalities.html` — zpětně kompatibilní přesměrování na `municipalities/`
- `eu-capitals.html` — rozpočty 27 hlavních měst EU a Londýna s přepínačem EUR / místní měna
- `eu-capitals.js` a `eu-capitals.css` — filtry, fiskální profily, rozpočtová salda, struktura výdajů/příjmů, obyvatelé a cestovní ruch
- `data/eu-capital-budgets.v1.json` — auditovatelný zdroj městských rozpočtů, komponent, sald a benchmarků
- `styles-v2.css` — vizuální systém homepage a detailů zemí
- `BRAND.md` a `brand-preview.html` — pravidla značky, paleta a referenční list
  (interní reference, nenasazuje se do produkčního obrazu)
- `cz/municipalities/` a `cz/kraje/` — filtrovatelné české územní benchmarky
- `cz/municipalities/<slug>/` a `cz/kraje/<slug>/` — indexovatelné detailní profily
- `data/entities/<ico>.json` — strojově čitelný detail účetní jednotky
- `data/municipal-history/<ico>.json` — roční snapshoty rozpočtu a stavu účtů každé současné obce za období 2010–2025
- `cz-obce.html` — zpětně kompatibilní přesměrování na `cz/municipalities/`
- `cesky-rozpocet.html` a `cesko.html` — připravené české tematické vrstvy
- `lib/data/sovereign-benchmark.v1.json` — harmonizované fiskální řady
- `data/catalog.v1.json` — katalog národních zdrojů a rozpočtových specifik
- `deep-dives/migration/` — přistěhování, vystěhování a migrační saldo všech 27 zemí EU v letech 2000–2024
- `data/eu-migration.v1.json` — auditovatelná časová řada Eurostatu; obnovuje ji `npm run build:eu-migration`

Volba jazyka se přenáší v URL parametru `lang` a ukládá do `localStorage`.
Nové texty mají být přidávány do slovníků `I` a `T`, nikoli natvrdo do
dynamicky generovaného rozhraní.

## Autentizované API

Produkční kontejner provozuje vedle statického webu API v téže Cloud Run
službě `czbudget-public`. Nginx obsluhuje veřejný web a předává cesty `/api`,
`/auth`, `/developers` a `/docs` internímu Node procesu.

- `/developers/login` — přihlášení a registrace vývojářů
- `/docs` — dokumentace pouze pro přihlášené uživatele s ověřeným e-mailem
- `/docs/openapi.json` — chráněný OpenAPI 3.1 kontrakt
- `/api/v1` — verzované JSON API; přijímá session cookie nebo
  `Authorization: Bearer <Identity Platform ID token>`

Produkční proměnné služby:

```text
IDENTITY_PLATFORM_API_KEY=<restricted Identity Toolkit API key>
IDENTITY_PLATFORM_PROJECT_ID=czbudget-janrezab
PUBLIC_ORIGIN=https://publicspendingdata.org
API_CORS_ORIGINS=https://publicspendingdata.org
NODE_ENV=production
```

Server přijme pouze podepsaný, neprošlý ID token se správným issuerem,
audience a claimem `email_verified=true`. Dokumentace používá `HttpOnly`,
`Secure` a `SameSite=Lax` cookies.

Veřejný obsah je statický; produkční obal používá připnutý Nginx image a
bezpečnostní hlavičky. Složky `pipeline/`, `tests/` a vývojové závislosti se do
obrazu nekopírují.

České územní stránky se po aktualizaci `data/benchmark.v1.json` regenerují
verzovaným skriptem `pipeline/transforms/build_czech_site.py`. Proměnná
`CZBUDGET_WORKSPACE_ROOT` určuje kořen lokálního datového workspace a
`PUBLIC_ORIGIN` při
sestavení určuje produkční canonical URL a adresu sitemap.

Historie všech obcí se připravuje z ročních extraktů FIN 2-12 M a rozvahy.
Roční počet obyvatel k 1. červenci se načítá z oficiální datové sady ČSÚ
DataStat `OBY01B01` (ukazatel `9379W`, pohlaví celkem):

```bash
python3 pipeline/transforms/fetch_municipal_population.py
python3 pipeline/transforms/prepare_municipal_history.py
```

Chybějící rok v historii není interpretován jako nulový rozpočet. Znamená,
že dnešní IČO v daném ročním extraktu nemá rozpočtové řádky; typicky jde o
obec vzniklou později. Stav účtů má metodický zlom v roce 2012. Výdajový
benchmark dělí skutečné roční výdaje středním stavem obyvatel a srovnává obec
s mediánem jejího populačního pásma; nejde o žebříček kvality služeb.

## Integrita a reprodukovatelnost

```bash
npm ci
npm run validate
npm run test:browser
node pipeline/create-source-manifest.mjs --verify
```

`scripts/validate-integrity.mjs` kontroluje všechny publikované JSON soubory,
vazbu snapshot ↔ 6 267 profilů, účetní identity, geografii, sitemap, canonical
URL, JSON-LD a všechny lokální odkazy (řádově stovky tisíc). Přesné počty se
nikde neopisují: audit je zapisuje do `data/data-quality-report.v1.json`, kde
`counts.local_references` udává skutečný počet ověřených lokálních odkazů a
`counts.published_data_entries` počet publikovaných datových záznamů. Tamtéž
jsou i explicitně chybějící hodnoty. Hashe lokálních zdrojových souborů jsou v
`pipeline/source-assets.manifest.json`; jejich počet udává `asset_count` a
`entry_count` přímo v manifestu. Produkční artifacty dostávají
`data/release-manifest.v1.json`.

Transformace, registry zdrojů, BigQuery schema a metodika jsou verzované v
`pipeline/`. Starý duplicitní export `gcp/site` je mimo tento repozitář
karanténován a nesmí být nasazen.

## Produkční nasazení

Tato složka je samostatný kanonický Git projekt. Každý push do hlavní větve
spustí validaci, vytvoří neměnný kontejner označený Git commitem a nasadí jej
do jediné Cloud Run služby `czbudget-public` v projektu `czbudget-janrezab` a
regionu `europe-west1`. Build má cílovou službu i region napevno a skončí
chybou, pokud v projektu existuje jiná služba `czbudget-*`. Legacy služba
`czbudget-web` byla po úplném porovnání zdrojů zrušena; nesmí se znovu vytvořit.
Projekt Riverdata není součástí tohoto deploymentu.

Veřejná canonical adresa je `https://publicspendingdata.org`. Jednorázové
připojení domény a následnou kontrolu popisuje `PUBLIC_DOMAIN_DEPLOYMENT.md`.

Lokální kontrola před commitem:

```bash
npm test
```

Při produkčním buildu se z BigQuery načtou také konsolidované řádky FIN 2-12 M
pro všech 6 254 obcí. Do každého profilového JSONu se vloží kompaktní členění
podle funkčních paragrafů a ekonomických položek pro schválený, upravený i
skutečný rozpočet; oficiální názvy sdílí jeden společný číselník.
