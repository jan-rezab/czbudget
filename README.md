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

### Smlouvy města Plzně

Profil Plzně může zobrazit kompaktní snapshot nejnovějších smluv z Hlídače
státu. Token se předává pouze procesu přes prostředí a nikdy se nezapisuje do
JSONu ani do klientského JavaScriptu. Výchozí běh stáhne přibližně 2 000 záznamů;
vícestránkový běh je sekvenční, čeká nejméně půl sekundy mezi požadavky a má
pevný strop sto stran.

```bash
HLIDACSTATU_API_TOKEN=... npm run fetch:plzen-contracts
# Kompletní historie od spuštění registru; datumová okna a checkpoint obejdou
# stránkovací strop bez zvýšení tempa nad dva požadavky za sekundu:
HLIDACSTATU_API_TOKEN=... npm run fetch:plzen-contracts-full
# Přepočet tagů a rozpočtových odhadů nad cache, bez dalších API požadavků:
python3 pipeline/transforms/fetch_hlidac_contracts.py --reuse-existing
python3 pipeline/transforms/build_municipal_public_site.py --profiles-only
# Samostatný prohledávatelný detail smluv zveřejněných v roce 2026:
python3 pipeline/transforms/build_plzen_contract_detail.py
# Jednorázový, sekvenční a omezený snapshot investičních projektů města:
python3 pipeline/transforms/fetch_plzen_budget_projects.py
# Časová osa smluv, projektových rozpočtů a plateb bez síťových požadavků:
python3 pipeline/transforms/build_plzen_contract_timeline.py
```

Vzorek je v `data/contracts/00075370.v1.json`; kompletní historie se ukládá
komprimovaně do `data/contracts/00075370.full.v1.json.gz`. Průběžný checkpoint
je v `.cache/contracts/00075370.full.checkpoint.jsonl`, takže přerušený import
pokračuje pouze chybějícími stránkami. Stránka nikdy nevolá API
přímo z prohlížeče, takže se token nezveřejní a návštěvnost webu nezvyšuje
provoz na Hlídači státu. Stáří smlouvy se počítá vůči nejnovějšímu datu
zveřejnění v cache. Rozpočtová položka je transparentní odhad z předmětu
smlouvy a porovnává se s ekonomickými položkami skutečnosti roku 2025 z
`.warehouse-profiles/cze/00075370.json`; nejde o účetní zaúčtování ani
reconciliaci smlouvy s peněžním výdajem.
Roční detail se generuje bez dalšího volání API do
`data/contracts/00075370.2026.v1.json`; obsahuje také projektové kódy a čísla
SAP objednávek rozpoznané z předmětu smlouvy.

Oficiální aplikace Rozpočet města Plzně nemá zdokumentované datové API a
publikuje stavební investice přes Next.js server actions. Snapshot
`data/contracts/00075370.plzen-projects.v1.json` proto vzniká sekvenčně,
s minimálním odstupem 250 ms, bezpečnostním stropem 900 požadavků a nulovým
provozem za běhu webu. Obsahuje 555 unikátních projektů, rozpočtovou skutečnost,
fakturaci a pole `paid_by_fiscal_year`. Transformace z něj a z lokálního
registru vytvoří `data/contracts/00075370.timeline.v1.json`. Smluvní hodnotu
zobrazuje pouze v okamžiku podpisu nebo zveřejnění; mezi roky ji nerozpočítává.
Skutečné platby jsou časově přesné na úrovni projektu. Vazba smlouva–projekt je
samostatně označena jako přímá shoda kódu, silná shoda názvu a IČO, nebo odhad.

## Autentizované API

### Obecní profily bez souboru pro každou URL

Produkce negeneruje ani neobsluhuje jeden HTML soubor pro každou obec. Cloud
Build vytvoří neměnný release se 128 gzipovanými JSONL shardy, kompaktním
indexem cest a kontrolními součty. Release se nahraje do soukromého Cloud
Storage; ukazatel `current.json` se přepne až po nasazení kompatibilní revize.

Node renderer načte pouze shard příslušné obce, ověří jeho SHA-256 a drží
omezenou LRU cache. První odpověď už obsahuje název, souhrnné finance, historii,
zdroj, canonical metadata a Dataset JSON-LD; JavaScript ji pouze rozšíří o
grafy a položkový průzkumník. Běžný požadavek proto nevolá BigQuery. Nginx
směruje obecní detail vždy do rendereru, takže starý lokální `index.html`
nemůže zastínit aktivní release. Starší objektové snapshoty zůstávají po dobu
migrace čitelné pro bezpečný rollback.

```bash
npm run build:public-serving-snapshots -- --output /tmp/municipal-release --release-id local --shards 128
npm run validate:public-serving-snapshots -- /tmp/municipal-release
```

Generátory historických profilů zůstávají reprodukčními nástroji, ale jejich
HTML výstup není vstupem produkčního buildu.

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

### Browser release checks

`npm run test:browser` now builds a temporary municipal snapshot release from
local serving inputs and dispatches municipal pages to the production Node
renderer. Warehouse bundles are preferred; retired profile HTML is not restored.
The temporary release is removed when the test server stops. To reuse an existing
release, set `PUBLIC_SNAPSHOT_RELEASE_ROOT` to its directory (containing
`current.json`). The tests still need the normal hydrated site data.

BigQuery line-item responses are replayed from the small, recorded fixtures in
`tests/fixtures/municipal-lines/`; tests never query the warehouse or production.
Their manifest records URLs and capture time. Refresh them deliberately with
`node scripts/refresh-browser-line-fixtures.mjs` when testing a new source vintage.
Unrecorded line-item requests fail explicitly instead of fabricating data.

`tests/browser/contrast.spec.mjs` checks the full homepage, comparison, country,
Czech municipal and international municipal pages in CS/EN and desktop/mobile,
including currency changes and expanded municipal rows. Cloud Build runs this
suite against its freshly built release and blocks deployment on failure.
