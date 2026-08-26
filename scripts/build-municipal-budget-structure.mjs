#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const categories = {
  administration: { label_en: "Administration", label_cs: "Správa" },
  safety: { label_en: "Public safety", label_cs: "Veřejná bezpečnost" },
  economy: { label_en: "Economy and jobs", label_cs: "Ekonomika a práce" },
  transport: { label_en: "Transport", label_cs: "Doprava" },
  environment: { label_en: "Environment and utilities", label_cs: "Životní prostředí a sítě" },
  housing: { label_en: "Housing and planning", label_cs: "Bydlení a územní rozvoj" },
  health: { label_en: "Health and care", label_cs: "Zdraví a péče" },
  education: { label_en: "Schools and education", label_cs: "Školy a vzdělávání" },
  culture: { label_en: "Culture and recreation", label_cs: "Kultura a volný čas" },
  social: { label_en: "Social protection", label_cs: "Sociální ochrana" },
  other: { label_en: "Other functions", label_cs: "Ostatní funkce" }
};

const countryDefinitions = {
  DNK: {
    year: 2025,
    stage: "actual",
    scope_en: "All 98 municipalities",
    scope_cs: "Všech 98 obcí",
    source_basis_en: "Net expenditure in the authorized StatBank functional classification",
    source_basis_cs: "Čisté výdaje v autorizovaném funkčním členění StatBank",
    map(row) {
      const code = String(row.code || "").split(" ", 1)[0];
      if (/^3\.(22|30)\./.test(code) || /^3\.38\.(72|76|77)$/.test(code)) return "education";
      if (/^3\./.test(code) || /^0\.(32|35)\./.test(code)) return "culture";
      if (/^4\./.test(code)) return "health";
      if (/^5\./.test(code)) return "social";
      if (/^2\./.test(code)) return "transport";
      if (/^0\.(22|25)\./.test(code)) return "housing";
      if (/^0\.58\./.test(code)) return "safety";
      if (/^(0\.(28|48|52|55)\.|1\.)/.test(code)) return "environment";
      if (/^6\./.test(code)) return "administration";
      return "other";
    }
  },
  GEO: {
    year: 2025,
    stage: "actual",
    scope_en: "All 69 municipalities",
    scope_cs: "Všech 69 obcí",
    source_basis_en: "Actual expenditure in the Ministry of Finance functional workbook",
    source_basis_cs: "Skutečné výdaje ve funkčním sešitu ministerstva financí",
    codeMap: { "7.1": "administration", "7.2": "other", "7.3": "safety", "7.4": "economy", "7.5": "environment", "7.6": "housing", "7.7": "health", "7.8": "culture", "7.9": "education", "7.10": "social" },
    map(row) { return this.codeMap[String(row.code || "")] || null; }
  },
  NLD: {
    year: 2025,
    stage: "actual",
    scope_en: "All 342 municipalities",
    scope_cs: "Všech 342 obcí",
    source_basis_en: "Gross expenditure across CBS Iv3 task fields",
    source_basis_cs: "Hrubé výdaje podle oblastí úloh CBS Iv3",
    map(row) {
      const code = String(row.code || "");
      if (code === "7.1") return "health";
      return ({ "0": "administration", "1": "safety", "2": "transport", "3": "economy", "4": "education", "5": "culture", "6": "social", "7": "environment", "8": "housing" })[code[0]] || "other";
    }
  },
  NOR: {
    year: 2025,
    stage: "actual",
    scope_en: "All 357 municipalities plus Longyearbyen",
    scope_cs: "Všech 357 obcí a Longyearbyen",
    source_basis_en: "Gross operating expenditure in non-overlapping KOSTRA function groups",
    source_basis_cs: "Hrubé provozní výdaje v nepřekrývajících se funkčních skupinách KOSTRA",
    codeMap: { FGK1a: "administration", FGK1b: "administration", FGK1c: "administration", FGK2: "culture", FGK3: "environment", FGK4: "economy", FGK5: "transport", FGK6a: "housing", FGK7: "education", FGK8b: "education", FGK9: "health", FGK12: "social", FGK13: "social", FGK14: "environment", FGK15: "culture", FGK16: "housing", FGK17: "safety" },
    map(row) {
      const [code, measure] = String(row.code || "").split(":");
      return measure === "AGD10" ? this.codeMap[code] || null : null;
    }
  },
  PER: {
    year: 2024,
    stage: "actual",
    scope_en: "1,891 local budgets: 1,695 district, 195 provincial and Metropolitan Lima",
    scope_cs: "1 891 místních rozpočtů: 1 695 okresních, 195 provinčních a metropolitní Lima",
    source_basis_en: "Actual expenditure in the MEF functional classification",
    source_basis_cs: "Skutečné výdaje ve funkční klasifikaci MEF",
    tier_counts: [
      { id: "district", count: 1695, label_en: "district", label_cs: "okresní" },
      { id: "provincial", count: 195, label_en: "provincial", label_cs: "provinční" },
      { id: "metropolitan", count: 1, label_en: "metropolitan", label_cs: "metropolitní" }
    ],
    codeMap: { "03": "administration", "05": "safety", "07": "economy", "09": "economy", "10": "economy", "15": "transport", "17": "environment", "18": "environment", "19": "housing", "20": "health", "21": "culture", "22": "education", "23": "social" },
    map(row) { return this.codeMap[String(row.code || "")] || "other"; }
  }
};

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, root), "utf8"));

function summarizeProfiles(code, profiles) {
  const definition = countryDefinitions[code];
  const categoryShareSums = Object.fromEntries(Object.keys(categories).map((id) => [id, 0]));
  let included = 0;

  for (const profile of profiles) {
    const amounts = Object.fromEntries(Object.keys(categories).map((id) => [id, 0]));
    const rows = code === "NLD" || code === "NOR"
      ? profile.breakdown || []
      : (profile.detail || []).filter((row) => row.year === definition.year && row.stage === definition.stage && row.side === "expenditure");

    for (const row of rows) {
      const category = definition.map(row);
      if (!category) continue;
      const amount = code === "NLD" ? Number(row.expenditure) : Number(row.amount);
      if (Number.isFinite(amount)) amounts[category] += amount;
    }

    // Contra-entries exist in several native systems. A service cannot consume a
    // negative share, so net-negative category totals are floored before shares.
    const normalized = Object.fromEntries(Object.entries(amounts).map(([id, amount]) => [id, Math.max(0, amount)]));
    const total = Object.values(normalized).reduce((sum, amount) => sum + amount, 0);
    if (!(total > 0)) continue;
    included += 1;
    for (const [id, amount] of Object.entries(normalized)) categoryShareSums[id] += amount / total * 100;
  }

  if (!included) throw new Error(`${code}: no usable functional expenditure profiles`);
  const resultCategories = Object.entries(categoryShareSums)
    .map(([id, sum]) => ({ id, ...categories[id], average_share_pct: Number((sum / included).toFixed(4)) }))
    .filter((item) => item.average_share_pct >= 0.01)
    .sort((a, b) => b.average_share_pct - a.average_share_pct);

  return {
    code,
    year: definition.year,
    stage: definition.stage,
    profile_count: profiles.length,
    included_profile_count: included,
    weighting: "equal_municipality",
    scope_en: definition.scope_en,
    scope_cs: definition.scope_cs,
    source_basis_en: definition.source_basis_en,
    source_basis_cs: definition.source_basis_cs,
    ...(definition.tier_counts ? { tier_counts: definition.tier_counts } : {}),
    categories: resultCategories
  };
}

async function readExpansionProfiles(slug) {
  const directory = new URL(`data/municipal-expansion/${slug}/`, root);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const profiles = [];
  for (const name of names) profiles.push(JSON.parse(await readFile(new URL(name, directory), "utf8")));
  return profiles;
}

const benchmarkNld = await readJson("data/municipal-benchmarks/nld.json");
const benchmarkNor = await readJson("data/municipal-benchmarks/nor.json");
const output = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString().slice(0, 10),
  definition_en: "Mean functional expenditure share across local budgets. Every covered municipality or local government has equal weight, regardless of budget size.",
  definition_cs: "Průměrný podíl funkčních výdajů napříč místními rozpočty. Každá pokrytá obec nebo místní samospráva má stejnou váhu bez ohledu na velikost rozpočtu.",
  countries: [
    summarizeProfiles("DNK", await readExpansionProfiles("dnk")),
    summarizeProfiles("GEO", await readExpansionProfiles("geo")),
    summarizeProfiles("NLD", benchmarkNld.entities),
    summarizeProfiles("NOR", benchmarkNor.entities),
    summarizeProfiles("PER", await readExpansionProfiles("per"))
  ]
};

await writeFile(new URL("data/municipal-budget-structure.v1.json", root), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Built average municipal budget structures for ${output.countries.length} countries`);
