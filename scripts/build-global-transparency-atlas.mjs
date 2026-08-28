import { readFile, writeFile } from "node:fs/promises";

const sovereignIso2 = new Set("ad ae af ag al am ao ar at au az ba bb bd be bf bg bh bi bj bn bo br bs bt bw by bz ca cd cf cg ch ci cl cm cn co cr cu cv cy cz de dj dk dm do dz ec ee eg er es et fi fj fm fr ga gb gd ge gh gm gn gq gr gt gw gy hn hr ht hu id ie il in iq ir is it jm jo jp ke kg kh ki km kn kp kr kw kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mr mt mu mv mw mx my mz na ne ng ni nl no np nr nz om pa pe pg ph pk pl ps pt pw py qa ro rs ru rw sa sb sc sd se sg si sk sl sm sn so sr ss st sv sy sz td tg th tj tl tm tn to tr tt tv tz ua ug us uy uz va vc ve vn vu ws ye za zm zw".split(" "));

const obsScores = {"af":0,"al":57,"am":60,"ao":26,"ar":51,"au":78,"az":67,"ba":27,"bd":37,"bf":30,"bg":79,"bi":14,"bj":79,"bo":11,"br":80,"bw":39,"ca":74,"cd":41,"cf":6,"ci":54,"cl":60,"cm":50,"cn":20,"co":50,"cr":61,"cz":62,"de":76,"do":77,"dz":15,"ec":48,"eg":49,"es":54,"et":10,"fj":34,"fr":74,"gb":62,"ge":87,"gh":46,"gm":36,"gn":10,"gq":4,"gt":64,"gw":5,"hn":65,"hr":67,"hu":22,"id":70,"in":51,"iq":8,"it":76,"jm":50,"jo":60,"jp":63,"ke":55,"kg":61,"kh":43,"km":4,"kr":71,"kz":63,"lb":17,"lk":37,"lr":52,"ls":35,"ma":47,"md":81,"me":48,"mg":39,"mk":35,"ml":10,"mm":3,"mn":62,"mw":6,"mx":80,"my":48,"mz":47,"na":54,"ne":33,"ng":31,"ni":44,"no":80,"np":50,"nz":87,"pe":71,"pg":52,"ph":75,"pk":30,"pl":59,"ps":8,"pt":62,"py":48,"qa":2,"ro":62,"rs":51,"ru":66,"rw":50,"sa":26,"sd":2,"se":85,"si":64,"sk":69,"sl":55,"sn":42,"so":37,"ss":13,"st":32,"sv":24,"sz":30,"td":6,"tg":17,"th":60,"tj":33,"tl":37,"tn":16,"tr":64,"tt":38,"tz":41,"ua":38,"ug":59,"us":69,"ve":0,"vn":51,"ye":0,"za":83,"zm":34,"zw":63};

const nationalBand = (score) => {
  if (score === null) return "not_researched";
  if (score >= 81) return "extensive";
  if (score >= 61) return "substantial";
  if (score >= 41) return "limited";
  if (score >= 21) return "minimal";
  return "scant";
};

const municipalWeights = { enacted:20, revised:15, execution:15, actual:20, function:10, economic:10, api:10 };
const municipalScore = (record) => record ? Object.entries(municipalWeights).reduce((sum, [key, weight]) => sum + (record.features[key] === true ? weight : 0), 0) : null;
const readinessBand = (score) => {
  if (score === null) return "not_researched";
  if (score >= 81) return "excellent";
  if (score >= 61) return "strong";
  if (score >= 41) return "partial";
  if (score >= 21) return "weak";
  return "very_weak";
};

const map = JSON.parse(await readFile("data/world-map.v1.json", "utf8"));
const municipal = JSON.parse(await readFile("data/municipal-transparency.v1.json", "utf8"));
const parity = JSON.parse(await readFile("data/country-parity.v1.json", "utf8"));
const universe = JSON.parse(await readFile("pipeline/config/sovereign_country_universe.json", "utf8"));
const itemizedCoverage = JSON.parse(await readFile("data/municipal-itemized-coverage.v1.json", "utf8"));
const itemizedWarehouse = JSON.parse(await readFile("data/international-itemized-warehouse.v1.json", "utf8"));
const acquisitionAudit = JSON.parse(await readFile("data/municipal-itemized-acquisition-audit.v1.json", "utf8"));

// ---------------------------------------------------------------------------
// Rule: public_coverage_unchanged_until_load
//
// Loading facts into the private production warehouse is not publication, and a
// research assessment is not a load. Public municipal capability may therefore
// only move when the acquisition audit and the published coverage contract say
// it moved. This is enforced here, in code, because the failure mode it guards
// against is silent: a country's pipeline and its adopted-budget flag get
// upgraded as a side effect of an import run that never touched that country.
// ---------------------------------------------------------------------------
const LOADED_PIPELINES = new Set(["loaded", "loaded_partial"]);
const ENACTED_STAGES = new Set(["enacted", "approved", "revised", "modified", "proposal", "plan", "budget"]);
// Audit verdicts that mean "we looked and there is no acquirable item-level
// adopted-budget dataset". Access and authentication blocks are deliberately
// excluded: those say the data exists but PSD cannot reach it, which is a
// truthful source-availability finding rather than an absence of adopted budgets.
const NO_ADOPTED_BUDGET_SOURCE = new Set([
  "catalog_not_coverage",
  "document_only",
  "decentralized_no_bulk",
  "accounts_not_budget",
  "heterogeneous_catalog",
  "no_stable_bulk_contract",
  "regional_fragmentation",
  "distributed_portals"
]);
// Countries where the official national source demonstrably publishes adopted
// item-level municipal budgets even though PSD has so far loaded only the
// accounts/execution layer. These are source-availability findings, not load
// claims, and every entry must be named here rather than appearing silently.
const SOURCE_ADOPTED_BUDGET_WITHOUT_PSD_LOAD = new Map([
  ["NLD", "CBS Iv3 publishes the municipal begroting alongside the realisatie; PSD has loaded the accounts layer only."],
  ["KOR", "Local Finance 365 publishes 예산 (adopted budgets) alongside the settlements; PSD has loaded the settlement layer only."],
  ["CRI", "The CGR SIPP portal publishes the presupuesto inicial alongside execution; PSD has loaded the execution layer only."]
]);

const acquiredCodes = new Set((acquisitionAudit.acquired || []).map((entry) => entry.country_code));
const noAdoptedBudgetCodes = new Set((acquisitionAudit.not_acquired || [])
  .filter((entry) => NO_ADOPTED_BUDGET_SOURCE.has(entry.status))
  .map((entry) => entry.country_code)
  .filter((code) => !acquiredCodes.has(code)));
const itemizedByCode = new Map(itemizedCoverage.countries.map((country) => [country.code, country]));
const warehouseByCode = new Map(itemizedWarehouse.countries.map((country) => [country.code, country]));

for (const record of municipal.countries) {
  const code = record.iso3;
  const coverage = itemizedByCode.get(code);
  const warehouse = warehouseByCode.get(code);
  const publishedProfiles = Number(coverage?.published_profile_count ?? coverage?.profile_count) || 0;
  const publishesAdoptedBudgets = publishedProfiles > 0 && (coverage?.stages || []).some((stage) => ENACTED_STAGES.has(stage));

  if (LOADED_PIPELINES.has(record.pipeline) && !publishedProfiles && !warehouse && !acquiredCodes.has(code)) {
    throw new Error(`${code}: municipal_item_level.pipeline claims "${record.pipeline}" with no published itemized profiles, no production warehouse entry and no acquired bundle in data/municipal-itemized-acquisition-audit.v1.json`);
  }

  if (record.features?.enacted === true && noAdoptedBudgetCodes.has(code) && !publishesAdoptedBudgets) {
    throw new Error(`${code}: municipal_item_level.features.enacted is true, but the acquisition audit records no acquirable item-level adopted-budget source for it and no adopted-budget stage is published on this site`);
  }

  if (record.features?.enacted === true && LOADED_PIPELINES.has(record.pipeline) && !acquiredCodes.has(code)) {
    const warehouseEnacted = (warehouse?.stages || []).some((stage) => ENACTED_STAGES.has(stage));
    if (!publishesAdoptedBudgets && !warehouseEnacted && !SOURCE_ADOPTED_BUDGET_WITHOUT_PSD_LOAD.has(code)) {
      throw new Error(`${code}: municipal_item_level claims a PSD load with features.enacted true, but no adopted-budget stage exists in the published profiles or the production warehouse and the country is not in the acquisition audit's acquired list`);
    }
  }
}

const municipalByIso = new Map(municipal.countries.map((country) => [country.iso2, country]));
const loadedByIso3 = new Map(parity.countries
  .filter((country) => country.modules.sovereign.status === "loaded")
  .map((country) => [country.country_code, country]));
const iso3ByIso2 = new Map(universe.countries.map((country) => [country.iso2, country.iso3]));
const czechNames = new Intl.DisplayNames(["cs"], { type: "region" });

const countries = map.locations
  .filter((country) => sovereignIso2.has(country.id))
  .map((country) => {
    const score = Number.isFinite(obsScores[country.id]) ? obsScores[country.id] : null;
    const municipalRecord = municipalByIso.get(country.id);
    const localScore = municipalScore(municipalRecord);
    const municipalBonus = localScore === null ? 0 : Math.round(localScore * 0.2);
    // The index is an OBS score plus a municipal bonus worth at most 20 points.
    // Without an OBS component there is no scale to add the bonus to, and falling
    // back to the raw municipal capability score mixed two incompatible ranges in
    // one column: it put the Netherlands at 100, level with Brazil which scored 80
    // on OBS alone, and it put four unsurveyed countries at 0 — a number the atlas
    // itself says must never be read as "this government publishes nothing".
    // Unscored is the honest answer; the municipal evidence still shows in its own
    // columns and in evidence_status.
    const readinessScore = score === null ? null : Math.min(100, score + municipalBonus);
    const index = {
      score: readinessScore,
      band: readinessBand(readinessScore),
      obs_component: score,
      municipal_score: localScore,
      municipal_bonus: localScore === null ? null : municipalBonus,
      evidence_status: score !== null && localScore !== null ? "complete" : score !== null ? "national_only" : localScore !== null ? "municipal_only" : "not_scored",
      formula: "OBS central-government score + 20% of verified municipal capability score, capped at 100"
    };
    const profileIso3 = iso3ByIso2.get(country.id) ?? municipalRecord?.iso3 ?? null;
    const loadedProfile = profileIso3 ? loadedByIso3.get(profileIso3) : null;
    const ingestionReady = !loadedProfile && ["excellent", "strong"].includes(index.band) && municipalRecord?.pipeline === "crawling";
    return {
      iso2: country.id,
      iso3: profileIso3,
      name_en: country.name,
      name_cs: czechNames.of(country.id.toUpperCase()) ?? country.name,
      national_budget: {
        research_status: score === null ? "not_researched" : "assessed",
        score,
        band: nationalBand(score),
        survey: score === null ? null : "OBS 2023"
      },
      budget_transparency_index: index,
      portal_readiness: index,
      psd_coverage: {
        country_profile: loadedProfile ? "loaded" : "not_loaded",
        loaded_modules: loadedProfile?.coverage.loaded_modules ?? 0,
        total_modules: loadedProfile?.coverage.total_modules ?? 11,
        ingestion_status: loadedProfile ? "loaded" : ingestionReady ? "discovery_crawl_started" : "not_queued",
        target: ingestionReady ? "Match every verified published layer and retain native classifications, stages and missingness." : null
      },
      municipal_item_level: municipalRecord ? {
        research_status: "researched",
        category: municipalRecord.category,
        pipeline: municipalRecord.pipeline,
        features: municipalRecord.features,
        source: municipalRecord.source,
        note_en: municipalRecord.note_en,
        note_cs: municipalRecord.note_cs
      } : {
        research_status: "not_researched",
        category: "not_researched",
        pipeline: null,
        features: { enacted:null, revised:null, execution:null, actual:null, function:null, economic:null, api:null },
        source: null,
        note_en: "Municipal item-level availability has not yet been researched country by country.",
        note_cs: "Dostupnost položkových obecních dat zatím nebyla pro tuto zemi samostatně prověřena."
      }
    };
  })
  .sort((a, b) => a.name_en.localeCompare(b.name_en, "en"));

if (countries.length !== 195) throw new Error(`Expected 195 sovereign states, received ${countries.length}`);
if (countries.filter((country) => country.national_budget.research_status === "assessed").length !== 125) throw new Error("Expected 125 OBS 2023 assessments");
if (countries.filter((country) => country.municipal_item_level.research_status === "researched").length !== municipal.countries.length) throw new Error("Municipal research join is incomplete");

const output = {
  schema_version: "1.0.0",
  updated: "2026-08-26",
  universe: {
    definition: "193 United Nations member states plus the Holy See and the State of Palestine",
    country_count: countries.length,
    source: "https://www.un.org/en/about-us/member-states"
  },
  methodology: {
    national_budget: "IBP Open Budget Survey 2023 score for online availability, timeliness and comprehensiveness of eight central-government budget documents. A score of 61 or more is sufficient for informed public debate.",
    budget_transparency_index: "BTI = OBS central-government score plus a municipal-data bonus worth up to 20 points, capped at 100. The municipal capability score weights approved budget 20, revised budget 15, in-year execution 15, final accounts 20, functional classification 10, economic classification 10, and API/bulk access 10. Missing municipal research adds no bonus and is labelled provisional, not unavailable.",
    portal_readiness: "Backward-compatible alias of the PSD Budget Transparency Index.",
    municipal_item_level: "PSD country-by-country review of whether one official national source exposes a comparable municipal budget lifecycle at item level. A national transparency score is not evidence of municipal data availability.",
    not_researched: "Dark gray always means not researched or not scored; it never means that a government publishes nothing."
  },
  sources: [
    { id:"obs-2023", title:"Open Budget Survey 2023", url:"https://internationalbudget.org/open-budget-survey/country-results", scope:"central government", country_count:125 },
    { id:"sng-wofi", title:"World Observatory on Subnational Government Finance and Investment", url:"https://www.sng-wofi.org/country_profiles/presentation.html", scope:"comparative subnational aggregates and institutional profiles", country_count:135 },
    { id:"boost", title:"World Bank BOOST country data", url:"https://www.worldbank.org/en/programs/boost-portal/country-data", scope:"published line-item fiscal datasets; government level varies by country" }
  ],
  ingestion_queue: {
    rule: "Budget Transparency Index band strong or excellent, verified municipal source, and no PSD country profile.",
    fidelity_target: "Load every verified published layer 1:1, retaining native classifications, budget stages, entity scope and explicit missingness.",
    countries: countries
      .filter((country) => country.psd_coverage.ingestion_status === "discovery_crawl_started")
      .sort((a, b) => b.budget_transparency_index.score - a.budget_transparency_index.score || a.name_en.localeCompare(b.name_en))
      .map((country) => ({
        iso3: country.iso3,
        name_en: country.name_en,
        name_cs: country.name_cs,
        budget_transparency_index: country.budget_transparency_index.score,
        verified_features: Object.entries(country.municipal_item_level.features).filter(([, available]) => available === true).map(([feature]) => feature),
        source: country.municipal_item_level.source,
        status: country.psd_coverage.ingestion_status
      }))
  },
  countries
};

await writeFile("data/global-budget-transparency.v1.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${countries.length} sovereign states: 125 national assessments and ${municipal.countries.length} municipal item-level reviews`);
