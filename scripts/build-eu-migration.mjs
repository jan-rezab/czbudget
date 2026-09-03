#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";
const FIRST_YEAR = 2000;
const LAST_YEAR = 2024;
const PROTECTION_FIRST_YEAR = 2008;
const PROTECTION_LAST_YEAR = 2025;
const PROTECTION_TYPES = ["refugee", "subsidiary", "humanitarian"];
const PROTECTION_DECISIONS = {
  refugee: "POS_RFG",
  subsidiary: "POS_SPROT",
  humanitarian: "POS_HUM",
};

const MEMBERS = [
  ["AUT", "AT", "at", "Rakousko", "Austria"],
  ["BEL", "BE", "be", "Belgie", "Belgium"],
  ["BGR", "BG", "bg", "Bulharsko", "Bulgaria"],
  ["HRV", "HR", "hr", "Chorvatsko", "Croatia"],
  ["CYP", "CY", "cy", "Kypr", "Cyprus"],
  ["CZE", "CZ", "cz", "Česko", "Czechia"],
  ["DNK", "DK", "dk", "Dánsko", "Denmark"],
  ["EST", "EE", "ee", "Estonsko", "Estonia"],
  ["FIN", "FI", "fi", "Finsko", "Finland"],
  ["FRA", "FR", "fr", "Francie", "France"],
  ["DEU", "DE", "de", "Německo", "Germany"],
  ["GRC", "EL", "gr", "Řecko", "Greece"],
  ["HUN", "HU", "hu", "Maďarsko", "Hungary"],
  ["IRL", "IE", "ie", "Irsko", "Ireland"],
  ["ITA", "IT", "it", "Itálie", "Italy"],
  ["LVA", "LV", "lv", "Lotyšsko", "Latvia"],
  ["LTU", "LT", "lt", "Litva", "Lithuania"],
  ["LUX", "LU", "lu", "Lucembursko", "Luxembourg"],
  ["MLT", "MT", "mt", "Malta", "Malta"],
  ["NLD", "NL", "nl", "Nizozemsko", "Netherlands"],
  ["POL", "PL", "pl", "Polsko", "Poland"],
  ["PRT", "PT", "pt", "Portugalsko", "Portugal"],
  ["ROU", "RO", "ro", "Rumunsko", "Romania"],
  ["SVK", "SK", "sk", "Slovensko", "Slovakia"],
  ["SVN", "SI", "si", "Slovinsko", "Slovenia"],
  ["ESP", "ES", "es", "Španělsko", "Spain"],
  ["SWE", "SE", "se", "Švédsko", "Sweden"],
  ["CHE", "CH", "ch", "Švýcarsko", "Switzerland"],
  ["GBR", "UK", "gb", "Spojené království", "United Kingdom"],
  ["ISL", "IS", "is", "Island", "Iceland"],
  ["LIE", "LI", "li", "Lichtenštejnsko", "Liechtenstein"],
  ["MNE", "ME", "me", "Černá Hora", "Montenegro"],
  ["NOR", "NO", "no", "Norsko", "Norway"],
].map(([iso3, eurostat_geo, map_id, name_cs, name_en]) => ({
  iso3,
  eurostat_geo,
  map_id,
  name_cs,
  name_en,
  eu_member: !["CHE", "GBR", "ISL", "LIE", "MNE", "NOR"].includes(iso3),
}));

function url(dataset, aggregate = false) {
  const params = new URLSearchParams({
    lang: "en",
    freq: "A",
    sinceTimePeriod: String(FIRST_YEAR),
    untilTimePeriod: String(LAST_YEAR),
  });
  if (dataset === "demo_gind") params.set("indic_de", "AVG");
  else {
    params.set("age", "TOTAL");
    params.set("unit", "NR");
    params.set("sex", "T");
  }
  if (aggregate) params.set("geo", "EU27_2020");
  else params.set("geoLevel", "country");
  return `${API}/${dataset}?${params}`;
}

async function download(dataset, aggregate = false) {
  const sourceUrl = url(dataset, aggregate);
  const response = await fetch(sourceUrl, { headers: { "user-agent": "PublicSpendingData/1.0" } });
  if (!response.ok) throw new Error(`${dataset} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.class !== "dataset") throw new Error(`${dataset} did not return a JSON-stat dataset`);
  return { payload, sourceUrl };
}

function protectionUrl(dataset, aggregate = false) {
  const params = new URLSearchParams({
    lang: "en",
    freq: "A",
    unit: "PER",
    citizen: "TOTAL",
    age: "TOTAL",
    sex: "T",
    sinceTimePeriod: String(PROTECTION_FIRST_YEAR),
    untilTimePeriod: String(PROTECTION_LAST_YEAR),
  });
  if (aggregate) params.set("geo", "EU27_2020");
  else params.set("geoLevel", "country");
  return `${API}/${dataset}?${params}`;
}

async function downloadProtection(dataset, aggregate = false) {
  const sourceUrl = protectionUrl(dataset, aggregate);
  const response = await fetch(sourceUrl, { headers: { "user-agent": "PublicSpendingData/1.0" } });
  if (!response.ok) throw new Error(`${dataset} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.class !== "dataset") throw new Error(`${dataset} did not return a JSON-stat dataset`);
  return { payload, sourceUrl };
}

function categoryIndex(payload, dimension) {
  const index = payload.dimension[dimension].category.index;
  return Array.isArray(index) ? Object.fromEntries(index.map((key, position) => [key, position])) : index;
}

function flatIndex(payload, positions) {
  let index = 0;
  let stride = 1;
  for (let offset = payload.id.length - 1; offset >= 0; offset -= 1) {
    index += positions[payload.id[offset]] * stride;
    stride *= payload.size[offset];
  }
  return index;
}

function valueAt(payload, dimensions) {
  const positions = {};
  for (const dimension of payload.id) {
    const index = categoryIndex(payload, dimension);
    let key = dimensions[dimension];
    if (key === undefined) key = Object.keys(index)[0];
    if (index[key] === undefined) return null;
    positions[dimension] = index[key];
  }
  const index = String(flatIndex(payload, positions));
  const value = payload.value?.[index];
  if (value === undefined || value === null) return null;
  return { value: Number(value), status: payload.status?.[index] || null };
}

function series(payload, geo, kind) {
  const years = Object.keys(categoryIndex(payload, "time")).map(Number).sort((a, b) => a - b);
  return Object.fromEntries(years.map((year) => {
    const base = { geo, time: String(year) };
    if (kind === "flow") {
      base.age = "TOTAL";
      base.unit = "NR";
      base.sex = "T";
      const completed = valueAt(payload, { ...base, agedef: "COMPLET" });
      const reached = valueAt(payload, { ...base, agedef: "REACH" });
      return [year, completed || reached];
    }
    base.indic_de = "AVG";
    return [year, valueAt(payload, base)];
  }));
}

const round = (value, digits = 3) => value == null ? null : Number(value.toFixed(digits));
const rate = (flow, population) => flow == null || !population ? null : round(flow / population * 1000);

function countryRows(country, payloads) {
  const immigration = series(payloads.immigration, country.eurostat_geo, "flow");
  const emigration = series(payloads.emigration, country.eurostat_geo, "flow");
  const population = series(payloads.population, country.eurostat_geo, "population");
  return Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, offset) => FIRST_YEAR + offset).map((year) => {
    const incoming = immigration[year];
    const outgoing = emigration[year];
    const residents = population[year];
    const immigrationValue = incoming?.value ?? null;
    const emigrationValue = outgoing?.value ?? null;
    const populationValue = residents?.value ?? null;
    const net = immigrationValue == null || emigrationValue == null ? null : immigrationValue - emigrationValue;
    return {
      year,
      immigration: immigrationValue,
      emigration: emigrationValue,
      net,
      population: populationValue,
      immigration_per_1000: rate(immigrationValue, populationValue),
      emigration_per_1000: rate(emigrationValue, populationValue),
      net_per_1000: rate(net, populationValue),
      flags: {
        immigration: incoming?.status ?? null,
        emigration: outgoing?.status ?? null,
        population: residents?.status ?? null,
      },
    };
  }).filter((row) => row.immigration != null || row.emigration != null || row.population != null);
}

function protectionRows(firstInstance, finalInstance, geo) {
  return Array.from({ length: PROTECTION_LAST_YEAR - PROTECTION_FIRST_YEAR + 1 }, (_, offset) => PROTECTION_FIRST_YEAR + offset).map((year) => {
    const row = { year };
    PROTECTION_TYPES.forEach((type) => {
      const dimensions = {
        geo,
        time: String(year),
        unit: "PER",
        citizen: "TOTAL",
        age: "TOTAL",
        sex: "T",
        decision: PROTECTION_DECISIONS[type],
      };
      const values = [valueAt(firstInstance, dimensions), valueAt(finalInstance, dimensions)].filter(Boolean);
      row[type] = values.length ? values.reduce((sum, item) => sum + item.value, 0) : null;
      row[`${type}_flags`] = [...new Set(values.map((item) => item.status).filter(Boolean))];
    });
    const available = PROTECTION_TYPES.map((type) => row[type]).filter(Number.isFinite);
    row.total = available.length ? available.reduce((sum, value) => sum + value, 0) : null;
    return row;
  }).filter((row) => row.total != null);
}

async function main() {
  const [immigration, emigration, population, immigrationAggregate, emigrationAggregate, populationAggregate, protectionFirst, protectionFinal, protectionFirstAggregate, protectionFinalAggregate] = await Promise.all([
    download("migr_imm8"),
    download("migr_emi2"),
    download("demo_gind"),
    download("migr_imm8", true),
    download("migr_emi2", true),
    download("demo_gind", true),
    downloadProtection("migr_asydcfsta"),
    downloadProtection("migr_asydcfina"),
    downloadProtection("migr_asydcfsta", true),
    downloadProtection("migr_asydcfina", true),
  ]);
  const nationalPayloads = { immigration: immigration.payload, emigration: emigration.payload, population: population.payload };
  const aggregatePayloads = { immigration: immigrationAggregate.payload, emigration: emigrationAggregate.payload, population: populationAggregate.payload };
  const countries = MEMBERS.map((country) => ({
    ...country,
    rows: countryRows(country, nationalPayloads),
    protection_rows: protectionRows(protectionFirst.payload, protectionFinal.payload, country.eurostat_geo),
  }));
  const aggregate = countryRows({ eurostat_geo: "EU27_2020" }, aggregatePayloads);
  const aggregateProtection = protectionRows(protectionFirstAggregate.payload, protectionFinalAggregate.payload, "EU27_2020");
  const latestAggregate = [...aggregate].reverse().find((row) => row.immigration != null && row.emigration != null);
  const payload = {
    schema_version: "1.0.0",
    contract: "eu-migration.v1",
    generated_at: new Date().toISOString(),
    scope: {
      membership: "EU27_2020",
      country_coverage: "EU-27 plus Iceland, Liechtenstein, Montenegro, Norway, Switzerland and the United Kingdom",
      country_count: countries.length,
      first_year: FIRST_YEAR,
      last_year: LAST_YEAR,
      latest_complete_aggregate_year: latestAggregate?.year ?? null,
      protection_first_year: aggregateProtection.at(0)?.year ?? null,
      protection_last_year: aggregateProtection.at(-1)?.year ?? null,
    },
    definitions: {
      immigration_en: "A person establishing usual residence in the reporting country for at least 12 months after previously residing elsewhere.",
      immigration_cs: "Osoba, která si v dané zemi zakládá obvyklé bydliště alespoň na 12 měsíců poté, co předtím pobývala jinde.",
      emigration_en: "A person ceasing usual residence in the reporting country for at least 12 months.",
      emigration_cs: "Osoba, která přestává mít v dané zemi obvyklé bydliště alespoň na 12 měsíců.",
      aggregate_warning_en: "EU totals count migration events reported by Member States. A move between two EU countries appears as an emigration in one and an immigration in another; totals are not external-border crossings.",
      aggregate_warning_cs: "Součty EU zahrnují migrační události hlášené členskými státy. Přesun mezi dvěma zeměmi EU je vystěhováním v jedné a přistěhováním v druhé; nejde o počet překročení vnější hranice.",
    },
    flag_legend: {
      b: "break in time series",
      e: "estimated",
      i: "see metadata",
      p: "provisional",
    },
    sources: {
      publisher: "Eurostat",
      retrieved_at: new Date().toISOString(),
      immigration: { dataset: "migr_imm8", title: immigration.payload.label, updated: immigration.payload.updated, url: immigration.sourceUrl, browser_url: "https://ec.europa.eu/eurostat/databrowser/view/migr_imm8/default/table" },
      emigration: { dataset: "migr_emi2", title: emigration.payload.label, updated: emigration.payload.updated, url: emigration.sourceUrl, browser_url: "https://ec.europa.eu/eurostat/databrowser/view/migr_emi2/default/table" },
      population: { dataset: "demo_gind", title: population.payload.label, updated: population.payload.updated, url: population.sourceUrl, browser_url: "https://ec.europa.eu/eurostat/databrowser/view/demo_gind/default/table" },
      protection_first_instance: { dataset: "migr_asydcfsta", title: protectionFirst.payload.label, updated: protectionFirst.payload.updated, url: protectionFirst.sourceUrl, browser_url: "https://ec.europa.eu/eurostat/databrowser/view/migr_asydcfsta/default/table" },
      protection_final: { dataset: "migr_asydcfina", title: protectionFinal.payload.label, updated: protectionFinal.payload.updated, url: protectionFinal.sourceUrl, browser_url: "https://ec.europa.eu/eurostat/databrowser/view/migr_asydcfina/default/table" },
      metadata_url: "https://ec.europa.eu/eurostat/cache/metadata/en/migr_immi_esms.htm",
      protection_metadata_url: "https://ec.europa.eu/eurostat/cache/metadata/en/migr_asydec_esms.htm",
    },
    eu27: aggregate,
    eu27_protection: aggregateProtection,
    countries,
  };
  const target = resolve(ROOT, "data/eu-migration.v1.json");
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Stored ${countries.length} European countries and ${aggregate.length} EU aggregate years in ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
