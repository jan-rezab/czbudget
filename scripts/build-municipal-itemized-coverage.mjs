#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const read = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));

const municipalities = await read("data/international-municipalities.v1.json");
const internationalWarehouse = await read("data/international-itemized-warehouse.v1.json");
const warehouseByCountry = Object.fromEntries(internationalWarehouse.countries.map((country) => [country.code, country]));
const benchmarkCodes = { FIN: "fin", NLD: "nld", NOR: "nor" };
const benchmarkLabels = {
  FIN: { en: "native financial-statement measures", cs: "původní položky finančních výkazů" },
  NLD: { en: "native Iv3 task fields", cs: "původní položky úloh Iv3" },
  NOR: { en: "native KOSTRA measures", cs: "původní ukazatele KOSTRA" }
};
const expansionLabels = {
  BOL: { en: "native budget, revision and execution items", cs: "původní položky rozpočtu, úprav a plnění" },
  BRA: { en: "native RREO or DCA budget-execution items", cs: "původní položky plnění RREO nebo DCA" },
  CHL: { en: "native SINIM revenue and expenditure items", cs: "původní položky příjmů a výdajů SINIM" },
  COL: { en: "native CUIPO plan and execution items", cs: "původní položky plánu a plnění CUIPO" },
  CRI: { en: "native SIPP revenue and expenditure items", cs: "původní položky příjmů a výdajů SIPP" },
  DNK: { en: "native BUDK100 and REGK100 account items", cs: "původní účetní položky BUDK100 a REGK100" },
  ESP: { en: "native CONPREL budget and liquidation items", cs: "původní rozpočtové a likvidační položky CONPREL" },
  GEO: { en: "native Ministry of Finance plan and execution items", cs: "původní položky plánu a plnění ministerstva financí" },
  GTM: { en: "native SICOINGL and SICOINDES budget-execution items", cs: "původní položky plnění SICOINGL a SICOINDES" },
  ITA: { en: "native SIOPE cash receipt and payment items", cs: "původní položky hotovostních příjmů a plateb SIOPE" },
  JPN: { en: "native Local Public Finance Survey items", cs: "původní položky Local Public Finance Survey" },
  KOR: { en: "native Local Finance 365 settlement items", cs: "původní položky závěrečných účtů Local Finance 365" },
  MEX: { en: "native EFIPEM annual finance items", cs: "původní položky ročních financí EFIPEM" },
  PER: { en: "native MEF budget and execution items", cs: "původní položky rozpočtu a plnění MEF" },
  SLV: { en: "native SAFIM budget-execution items", cs: "původní položky plnění SAFIM" },
};
const benchmarkData = Object.fromEntries(await Promise.all(
  Object.entries(benchmarkCodes).map(async ([code, slug]) => [code, await read(`data/municipal-benchmarks/${slug}.json`)])
));

const countries = municipalities.countries.map((country) => {
  if (country.code === "CZE") {
    return {
      code: "CZE",
      municipal_scope: country.directory_count,
      profile_count: country.directory_count,
      status: "full",
      period: "2025",
      detail_kind_en: "economic and functional line items",
      detail_kind_cs: "ekonomické a funkční položky",
      source_title: "Monitor · FIN 2-12 M",
      source_url: country.source,
      note: "Economic and functional breakdowns for enacted, revised and actual stages are merged into every published Czech municipal profile during the production build."
    };
  }

  const warehouse = warehouseByCountry[country.code];
  if (warehouse) {
    const publishedProfileCount = warehouse.published_profile_count ?? Math.min(warehouse.profile_count, country.directory_count);
    return {
      code: country.code,
      municipal_scope: country.directory_count,
      profile_count: publishedProfileCount,
      warehouse_profile_count: warehouse.profile_count,
      status: warehouse.force_status || (publishedProfileCount === country.directory_count ? "full" : "partial"),
      period: warehouse.period,
      stages: warehouse.stages,
      detail_kind_en: warehouse.detail_kind_en,
      detail_kind_cs: warehouse.detail_kind_cs,
      line_fact_count: warehouse.line_fact_count,
      balance_fact_count: warehouse.balance_fact_count,
      source_title: warehouse.source_title,
      source_url: warehouse.source_url,
      note: country.code === "DEU"
        ? "The warehouse covers eleven verified official structured city publications; Germany remains decentralized and this is not nationwide coverage."
        : country.code === "GBR"
          ? "The warehouse covers 374 authorities across England, Scotland and Wales. The published directory currently exposes 318 England profiles; Northern Ireland remains document-only."
          : country.code === "USA"
          ? "This is a verified four-city scatter, not nationwide municipal coverage."
          : country.code === "CHE"
            ? "This is complete for the 79 Lucerne municipalities in the official cantonal file plus Zürich city, not nationwide Swiss coverage."
            : country.code === "FRA"
              ? "The national DGFiP actual-account layer is supplemented by six verified current enacted city budgets; the enacted layer is not a national census."
            : "Every counted profile has native itemized facts loaded in the production warehouse."
    };
  }

  const benchmark = benchmarkData[country.code];
  if (benchmark) {
    const detailed = benchmark.entities.filter((entity) => Array.isArray(entity.breakdown) && entity.breakdown.length > 0);
    const years = detailed.flatMap((entity) => entity.years || []).filter(Number.isFinite);
    const measureCounts = detailed
      .map((entity) => Number(entity.measure_count) || entity.breakdown.length)
      .filter(Number.isFinite);
    return {
      code: country.code,
      municipal_scope: country.directory_count,
      profile_count: detailed.length,
      status: detailed.length === country.directory_count ? "full" : detailed.length ? "partial" : "missing",
      period: years.length ? String(Math.max(...years)) : null,
      detail_kind_en: benchmarkLabels[country.code].en,
      detail_kind_cs: benchmarkLabels[country.code].cs,
      measure_count_min: measureCounts.length ? Math.min(...measureCounts) : 0,
      measure_count_max: measureCounts.length ? Math.max(...measureCounts) : 0,
      source_title: benchmark.country.source_title || `Official ${country.name_en} municipal source`,
      source_url: benchmark.country.source,
      note: "Each counted profile publishes its native itemized accounting breakdown."
    };
  }

  const expansion = expansionLabels[country.code];
  if (expansion) {
    const profileCount = country.code === "BRA"
      ? country.directory_count - country.missing_finance_count
      : country.directory_count;
    return {
      code: country.code,
      municipal_scope: country.directory_count,
      profile_count: profileCount,
      status: profileCount === country.directory_count ? "full" : "partial",
      period: String(Math.max(...country.years)),
      detail_kind_en: expansion.en,
      detail_kind_cs: expansion.cs,
      source_title: `Official ${country.name_en} municipal source`,
      source_url: country.source,
      note: country.code === "BRA"
        ? `${country.missing_finance_count} directory entities have no rows in either the 2025 RREO or 2024 DCA fallback layer.`
        : country.code === "MEX"
          ? "The count covers reporting municipal governments in the definitive 2024 EFIPEM file, not every municipality in Mexico."
          : country.code === "SLV"
            ? "The count covers 259 of the 262 municipalities in the 2023 SAFIM return; three did not report."
            : "Every counted profile publishes the native itemized classifications retained from the national source."
    };
  }

  return {
    code: country.code,
    municipal_scope: country.directory_count,
    profile_count: 0,
    status: "missing",
    period: null,
    detail_kind_en: null,
    detail_kind_cs: null,
    source_title: `Official ${country.name_en} municipal source`,
    source_url: country.source,
    note: "No itemized municipality-level budget profile is currently published on this site."
  };
});

const payload = {
  schema_version: "1.0.0",
  generated_at: internationalWarehouse.generated_at,
  definition: "A profile counts only when municipality-level economic, functional or native accounting line items are published on this site; headline totals alone do not count.",
  countries
};

await writeFile(
  new URL("../data/municipal-itemized-coverage.v1.json", import.meta.url),
  `${JSON.stringify(payload, null, 2)}\n`
);
console.log(`Recorded itemized municipal budget coverage for ${countries.length} countries`);
