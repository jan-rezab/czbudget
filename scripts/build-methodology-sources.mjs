#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const [parity, sovereign, cashIn, administrative, comparison, functions, transport, health, providers, municipalities, municipalHistory, publicEntityCoverage, publicEntityDirectory, publicEntityAggregates, demography, itemizedCoverage, internationalWarehouse, municipalSourceConfig] = await Promise.all([
  read("data/country-parity.v1.json"), read("lib/data/sovereign-benchmark.v1.json"), read("data/country-cash-in.v1.json"),
  read("data/country-spending-2025-2026.v1.json"), read("data/country-spending-comparison.v1.json"), read("data/country-functional-budgets.v1.json"),
  read("data/transport-budget-detail.v1.json"), read("data/country-health.v1.json"), read("data/country-provider-networks.v1.json"),
  read("data/international-municipalities.v1.json"), read("data/municipal-history-directory.v1.json"), read("data/public-entity-coverage.v1.json"), read("data/public-entity-directory/manifest.v1.json"), read("data/public-entity-aggregates.v1.json"), read("data/country-demography.v1.json"),
  read("data/municipal-itemized-coverage.v1.json"), read("data/international-itemized-warehouse.v1.json"), read("pipeline/config/international_municipal_sources.json")
]);

const moduleMeta = {
  sovereign:{order:1,cs:"Makro a fiskální rámec",en:"Macro-fiscal framework",artifact:"lib/data/sovereign-benchmark.v1.json"},
  revenue:{order:2,cs:"Příjmy a saldo",en:"Revenue and balance",artifact:"data/country-cash-in.v1.json"},
  administrative_spending:{order:3,cs:"Národní rozpočet",en:"Native budget",artifact:"data/country-spending-2025-2026.v1.json"},
  common_spending:{order:4,cs:"Společné kategorie",en:"Common categories",artifact:"data/country-spending-comparison.v1.json"},
  functional_spending:{order:5,cs:"Funkční výdaje",en:"Functional spending",artifact:"data/country-functional-budgets.v1.json"},
  transport:{order:6,cs:"Doprava",en:"Transport",artifact:"data/transport-budget-detail.v1.json"},
  health:{order:7,cs:"Zdravotnictví",en:"Healthcare",artifact:"data/country-health.v1.json"},
  providers:{order:8,cs:"Síť poskytovatelů",en:"Provider network",artifact:"data/country-provider-networks.v1.json"},
  municipalities:{order:9,cs:"Obecní finance",en:"Municipal finance",artifact:"data/international-municipalities.v1.json"},
  municipal_itemized:{order:10,cs:"Položkové rozpočty obcí",en:"Itemized municipal budgets",artifact:"data/municipal-itemized-coverage.v1.json"},
  public_entities:{order:11,cs:"Veřejné subjekty",en:"Public entities",artifact:"data/public-entity-coverage.v1.json"},
  demography:{order:12,cs:"Demografie",en:"Demography",artifact:"data/country-demography.v1.json"}
};
const alpha2 = {CZE:"CZ",UKR:"UA",POL:"PL",DEU:"DE",GBR:"UK",FRA:"FR",USA:"US",CHE:"CH",SWE:"SE",DNK:"DK",FIN:"FI",NLD:"NL",NOR:"NO",BRA:"BR",ESP:"ES",JPN:"JP"};
const source = (title,url,location="") => ({title,url,location});
const cleanSources = values => values.filter(Boolean).filter((item,index,array)=>item?.url&&array.findIndex(other=>other?.url===item.url)===index);
const adminByCode = code => administrative.countries.find(country=>country.code===code);
const municipalByCode = code => municipalities.countries.find(country=>country.code===code);
const transportByCode = code => transport.countries[code];

function lineage(code,module) {
  const admin=adminByCode(code), healthProfile=health.countries[code], provider=providers.countries[code], municipal=municipalByCode(code), entity=publicEntityCoverage.countries[code], entityDirectory=publicEntityDirectory.countries.find(item=>item.country_code===code), entityAggregates=publicEntityAggregates.observations.filter(item=>item.country_code===code), demographic=demography.countries[code], transportProfile=transportByCode(code);
  const unavailable =
    (module==="functional_spending" && !functions.countries[code]) ||
    (module==="transport" && !transportProfile) ||
    (module==="health" && !healthProfile) ||
    (module==="providers" && !provider) ||
    (module==="public_entities" && (!entity || !entityDirectory));
  if (unavailable) {
    const fallback=admin?.sources?.[0];
    return {period:"Not loaded",scope:"Explicit coverage gap",sources:fallback?[source(fallback.title,fallback.url,"coverage registry; no module-specific extraction")]:[],transform:"No transformation: the module is not published for this country.",caveat:"Not loaded; no values are inferred from another accounting perimeter."};
  }
  if(module==="sovereign") return {
    period:parity.countries.find(c=>c.country_code===code).modules.sovereign.coverage,
    scope:"General government (WEO)",
    sources:[source(`${sovereign.source.provider} · ${sovereign.source.dataset}`,sovereign.source.download_page,`${sovereign.source.source_file} → ISO=${code}; WEO subject codes for 15 published metrics`)],
    transform:"Select the country and indicator series; preserve WEO units and status; derive only displayed deltas.",
    caveat:"WEO estimates and projections remain labelled; national budgets are not substituted for general government."
  };
  if(module==="revenue") return {
    period:"2001–2031 where WEO publishes observations/estimates",
    scope:Object.keys(cashIn.countries[code]?.layers||{}).length?"General government plus separately labelled native layers":"General government",
    sources:cleanSources([source("IMF WEO · general-government revenue, balance and debt",sovereign.source.download_page,`${sovereign.source.source_file} → ISO=${code} → GGR, GGR_NGDP, BCA/GGXONLB and debt series`),...(code==="CZE"?cashIn.sources.slice(1).map(item=>source(item.title,item.url,"Czech native institutional layer named in the source")):[])]),
    transform:"Keep the WEO consolidated layer separate from any national state, municipal or public-corporation layer.",
    caveat:"Institutional layers are not additive unless internal transfers are eliminated."
  };
  if(module==="administrative_spending") return {
    period:`${admin.periods.previous.label} / ${admin.periods.current.label}`,
    scope:admin.scope_en,
    sources:(admin.sources||[]).map(item=>source(item.title,item.url,`native rows → ${admin.dimension}; published ${item.published||"date in source"}`)),
    transform:"Parse native line codes and amounts; retain local currency, national perimeter and budget stage.",
    caveat:admin.note_en||"This is the native central/state budget, not consolidated general government."
  };
  if(module==="common_spending") return {
    period:`${admin.periods.previous.label} / ${admin.periods.current.label}`,
    scope:"Broad PSD categories mapped from the native budget perimeter",
    sources:(admin.sources||[]).map(item=>source(item.title,item.url,"same source rows as the native-budget module")),
    transform:`scripts/build-country-spending-comparison.mjs → explicit ${code} line-code map → 12 common categories; unmapped rows remain Other / unallocated; totals reconcile.`,
    caveat:comparison.method.note_en
  };
  if(module==="functional_spending") {
    const selected=code==="UKR"?functions.sources.filter(item=>item.id.startsWith("ukraine")||item.id==="imf-gdp"):code==="USA"?functions.sources.filter(item=>["us-omb","imf-gdp"].includes(item.id)):functions.sources.filter(item=>["oecd-cofog","imf-gdp"].includes(item.id));
    return {period:`${functions.period.start}–${functions.period.end}`,scope:functions.countries[code].scope,sources:selected.map(item=>source(item.title,item.url||item.download_url,item.api_url||item.download_url||"dataset/table named in title")),transform:"Load COFOG/GF function observations, preserve the source sector and unit, and join nominal GDP only for the displayed share.",caveat:code==="UKR"?"Ukraine uses national functional execution rather than OECD COFOG.":code==="USA"?"The U.S. series uses OMB federal functions, not consolidated general government.":"OECD revisions and break flags are retained."};
  }
  if(module==="transport") return {
    period:String(transportProfile.latest_year),scope:transportProfile.coverage,
    sources:cleanSources([source("Eurostat · General government expenditure by function",transport.sources[0].url,"gov_10a_exp → GF04.5 Transport → TE/MIO_EUR, sector S13"),...(transportProfile.public_data?.sources||[]).map(item=>source(item.title,item.url,"national bridge/cross-check named in the source"))]),
    transform:"Select COFOG transport and economic transaction rows; keep national detail and government-level bridges separate.",
    caveat:transportProfile.public_data?.note_en||"National detail may use a different accounting perimeter."
  };
  if(module==="health") return {
    period:String(healthProfile.year),scope:"Current health expenditure under SHA 2011",
    sources:code==="UKR"?[source("WHO Global Health Expenditure Database",healthProfile.official_url,healthProfile.source_location)]:[source("OECD · Health expenditure and financing",health.sources[0].url,"DSD_SHA@DF_SHA → REF_AREA country → 2024; HF1/HF3 and HP1/HP2/HP3/HP5 shares"),source(healthProfile.official_title,healthProfile.official_url,"national architecture and primary-source cross-check")],
    transform:code==="UKR"?"Use the latest complete GHED financing row; voluntary/other is the remainder to 100%; do not impute provider shares.":"Normalize only within SHA: financing and provider shares sum to 100%; keep bed-year/status separate.",
    caveat:(healthProfile.missing_dimensions||[]).join("; ")||health.methodology.en
  };
  if(module==="providers") return {
    period:provider.source?.update_frequency||"source reference date",
    scope:provider.coverage,
    sources:[source(provider.source?.title,provider.source?.url||provider.source?.download_url,provider.source?.location||provider.source?.api_url||provider.source?.download_url||provider.records)],
    transform:"Use the official register identifier as the record key; deduplicate specialty/activity rows only where the adapter documents that step.",
    caveat:[...(provider.missing_dimensions||[]),provider.payments?.note_en].filter(Boolean).join("; ")
  };
  if(module==="municipalities") return {
    period:code==="CZE"?`${municipalHistory.period.from}–${municipalHistory.period.to}`:(municipal.years||[]).join(", "),scope:municipal.coverage_en,
    artifact:code==="CZE"?"data/international-municipalities.v1.json · data/municipal-history-directory.v1.json":moduleMeta.municipalities.artifact,
    sources:[source(municipal.source_detail?.dataset||"Official municipal-finance source",municipal.source,municipal.source_detail?.location||"source adapter and table/file listed in pipeline/config/international_municipal_sources.json")],
    transform:code==="CZE"?"Join the current entity directory to the 2010–2025 municipal budget history by national identifier; retain missing years as missing.":municipal.source_detail?.location||"Load entity identifiers and native revenue/expenditure facts; keep source currency, stage and year.",
    caveat:(municipal.missing_dimensions||[]).join("; ")||"Coverage is the entity population stated by the national source."
  };
  if(module==="public_entities") return {
    period:[...new Set([...(entity.sources||[]).map(item=>item.period),...entityAggregates.map(item=>item.period)])].filter(Boolean).join(", "),scope:entity.comparison_perimeter,
    sources:cleanSources([...(entity.sources||[]).map(item=>source(item.source_id,item.url,`${entity.registry_file} → ${item.source_id}`)),...entityAggregates.map(item=>source(item.source_id,item.source_url,`data/public-entity-aggregates.v1.json → ${code} → ${item.metric}`))]),
    transform:`Normalize official source rows into ${entity.registry_file}; expose ${entityDirectory.record_count} source-scoped records in ${entityDirectory.file}; keep broader aggregate-only populations separate.`,
    caveat:(entity.unresolved_layers||[]).join("; ")||publicEntityCoverage.comparison_warning
  };
  return {
    period:demographic.source.period,scope:demographic.projection,
    sources:[source(`${demographic.source.publisher} · ${demographic.source.dataset}`,demographic.source.url,demographic.source.location)],
    transform:`Store every source year by age group and sex in ${demographic.detail}; derive annual 2025–2045 totals, sex splits, 0–19, 20–64, 65–79 and 80+ bands, shares and the 65+/20–64 dependency ratio from those rows.`,
    caveat:`The source-native ${demographic.reference_date} reference date and oldest-age open/grouped tail are retained; central projection scenarios are not mixed across countries.`
  };
}

const rows=[];
for(const country of parity.countries) for(const [module,moduleCoverage] of Object.entries(country.modules)) {
  const detail=lineage(country.country_code,module), missing=moduleCoverage.missing_dimensions||[];
  const status=moduleCoverage.coverage_level==="aggregate_only"?"aggregate":missing.length?"partial":"full";
  rows.push({
    country_code:country.country_code,country_name_cs:country.name_cs,country_name_en:country.name_en,flag:alpha2[country.country_code],
    module,module_order:moduleMeta[module].order,module_label_cs:moduleMeta[module].cs,module_label_en:moduleMeta[module].en,status,
    artifact:detail.artifact||moduleMeta[module].artifact,coverage:moduleCoverage.coverage,period:detail.period,scope:detail.scope,sources:detail.sources,
    exact_extraction:detail.sources.map(item=>item.location).filter(Boolean).join(" · "),transformation:detail.transform,
    limitations:[...new Set([...missing,detail.caveat].filter(Boolean))].join(" · ")
  });
}

// Municipality coverage extends beyond the ten-country sovereign comparison.
// Add those national municipal sources to the same auditable ledger instead of
// leaving them visible only in the directory JSON.
const parityCodes=new Set(parity.countries.map(country=>country.country_code));
for(const municipal of municipalities.countries.filter(country=>!parityCodes.has(country.code))){
  const detail=lineage(municipal.code,"municipalities");
  rows.push({
    country_code:municipal.code,country_name_cs:municipal.name_cs,country_name_en:municipal.name_en,flag:alpha2[municipal.code],
    module:"municipalities",module_order:moduleMeta.municipalities.order,module_label_cs:moduleMeta.municipalities.cs,module_label_en:moduleMeta.municipalities.en,
    status:municipal.status==="aggregate_only"?"aggregate":municipal.status==="complete"?"full":"partial",
    artifact:detail.artifact||moduleMeta.municipalities.artifact,coverage:municipal.coverage_en,period:detail.period,scope:detail.scope,sources:detail.sources,
    exact_extraction:detail.sources.map(item=>item.location).filter(Boolean).join(" · "),transformation:detail.transform,limitations:detail.caveat
  });
}

// Itemized budgets are a distinct published layer. Keep their warehouse
// provenance separate from the directory/headline municipality module so the
// methodology never implies that a national directory is itself line-item
// coverage.
const warehouseByCode=new Map(internationalWarehouse.countries.map(country=>[country.code,country]));
const municipalNames=new Map(municipalities.countries.map(country=>[country.code,country]));
for(const itemized of itemizedCoverage.countries){
  const municipal=municipalNames.get(itemized.code),warehouse=warehouseByCode.get(itemized.code),configured=municipalSourceConfig.countries[itemized.code];
  const configuredSources=(configured?.sources||[]).map((item,index)=>source(
    index===0&&itemized.source_title?itemized.source_title:item.id,
    item.url,
    [item.id,item.dataset&&`Socrata ${item.dataset}`,item.table&&`table ${item.table}`,item.filename].filter(Boolean).join(" · ")
  ));
  const sources=cleanSources(configuredSources.length?configuredSources:[source(itemized.source_title,itemized.source_url,"published profile adapter documented by the itemized coverage contract")]);
  const stages=(itemized.stages||warehouse?.stages||[]).join(", ")||"source-native stages listed in the profile data";
  const factCounts=warehouse
    ? `${warehouse.line_fact_count.toLocaleString("en-US")} line facts${warehouse.balance_fact_count?` plus ${warehouse.balance_fact_count.toLocaleString("en-US")} balance-sheet facts`:""}`
    : "profile-level native item rows in the published benchmark/expansion artifacts";
  rows.push({
    country_code:itemized.code,country_name_cs:municipal.name_cs,country_name_en:municipal.name_en,flag:alpha2[itemized.code],
    module:"municipal_itemized",module_order:moduleMeta.municipal_itemized.order,module_label_cs:moduleMeta.municipal_itemized.cs,module_label_en:moduleMeta.municipal_itemized.en,
    status:itemized.status,
    artifact:warehouse?"data/international-itemized-warehouse.v1.json · czbudget-janrezab.budget_detail.municipal_budget_line_facts":"data/municipal-itemized-coverage.v1.json · published municipal profile artifacts",
    coverage:`${itemized.profile_count.toLocaleString("en-US")} of ${itemized.municipal_scope.toLocaleString("en-US")} municipal profiles; ${itemized.detail_kind_en}`,
    period:itemized.period,scope:`Stages: ${stages}. ${factCounts}.`,sources,
    exact_extraction:sources.map(item=>item.location).filter(Boolean).join(" · "),
    transformation:warehouse
      ? `pipeline/transforms/prepare_international_municipal_data.py → ${configured?.adapter||"official-source adapter"} → native functional/economic codes, local currency and budget stage retained → production BigQuery facts → verified coverage snapshot.`
      : "Load the official profile artifact, retain native item classifications and stages, and count only profiles with actual line-item arrays.",
    limitations:itemized.note
  });
}

rows.sort((a,b)=>a.module_order-b.module_order||a.country_code.localeCompare(b.country_code));
const payload={
  schema_version:"1.0.0",contract:"methodology-sources.v1",generated_at:new Date().toISOString(),row_count:rows.length,
  countries:[...new Map([...parity.countries.map(country=>({code:country.country_code,name_cs:country.name_cs,name_en:country.name_en})),...municipalities.countries.map(country=>({code:country.code,name_cs:country.name_cs,name_en:country.name_en}))].map(country=>[country.code,country])).values()],
  modules:Object.entries(moduleMeta).map(([id,value])=>({id,label_cs:value.cs,label_en:value.en,order:value.order})),
  status_definitions:{full:"Source-backed layer with no missing dimensions recorded in the parity contract.",partial:"Source-backed layer with one or more disclosed missing dimensions.",aggregate:"Official aggregate layer without entity-level facts."},
  rows
};

const expectedRows=parity.country_count*(Object.keys(moduleMeta).length-1)+municipalities.countries.filter(country=>!parityCodes.has(country.code)).length+itemizedCoverage.countries.length;
if(rows.length!==expectedRows) throw new Error(`Unexpected lineage row count: ${rows.length}; expected ${expectedRows}`);
for(const row of rows) if(!row.sources.length||row.sources.some(item=>!item.url)||!row.exact_extraction) throw new Error(`${row.country_code}/${row.module}: incomplete lineage`);
await writeFile(new URL("../data/methodology-sources.v1.json",import.meta.url),`${JSON.stringify(payload,null,2)}\n`);
console.log(`Wrote ${rows.length} methodology lineage rows`);
