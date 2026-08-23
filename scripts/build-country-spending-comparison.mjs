import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../data/country-spending-2025-2026.v1.json", import.meta.url);
const outputPath = new URL("../data/country-spending-comparison.v1.json", import.meta.url);
const source = JSON.parse(await readFile(sourcePath, "utf8"));

const categories = [
  ["social_protection", "Sociální ochrana", "Social protection"],
  ["health", "Zdravotnictví", "Health"],
  ["education_research", "Vzdělávání a výzkum", "Education & research"],
  ["defence", "Obrana", "Defence"],
  ["public_order_justice", "Bezpečnost a justice", "Public order & justice"],
  ["transport_infrastructure", "Doprava a infrastruktura", "Transport & infrastructure"],
  ["environment_agriculture", "Životní prostředí a zemědělství", "Environment & agriculture"],
  ["housing_community", "Bydlení a místní rozvoj", "Housing & community"],
  ["economic_affairs", "Hospodářství a energie", "Economic affairs & energy"],
  ["general_services_debt", "Všeobecné služby a dluh", "General services & debt"],
  ["culture_recreation", "Kultura a rekreace", "Culture & recreation"],
  ["other_unallocated", "Ostatní / nerozdělené", "Other / unallocated"],
].map(([id, label_cs, label_en]) => ({id, label_cs, label_en}));

// Explicit national-line mappings. Any line not listed remains visible in the
// reconciliation bucket instead of being silently forced into a false match.
const map = {
  CZE: {
    social_protection:["313"], health:["335"], education_research:["333","361","377","321"], defence:["307"],
    public_order_justice:["314","336","305","378","376","375","308","358","309"], transport_infrastructure:["327"],
    environment_agriculture:["329","315"], housing_community:["317"], economic_affairs:["322","328","349","353","344","348","397"],
    general_services_debt:["398","396","312","306","364","302","304","345","303","381","301","343","372","371","359"],
    culture_recreation:["334","362","355"],
  },
  DEU: {
    social_protection:["11"], health:["15"], education_research:["30","17"], defence:["14"], public_order_justice:["06","07","19","22"],
    transport_infrastructure:["12","24"], environment_agriculture:["10","16"], housing_community:["25"], economic_affairs:["23","09"],
    general_services_debt:["60","32","08","05","04","02","20","01","21","03"],
  },
  DNK: {
    social_protection:["17","36","15","18","14"], health:["16"], education_research:["19","20"], defence:["12","13"], public_order_justice:["11"],
    transport_infrastructure:["28","25"], environment_agriculture:["27","29","24","23"], housing_community:["22"], economic_affairs:["08","10"],
    general_services_debt:["07","35","06","09","05","03","01","02"], culture_recreation:["21"],
  },
  FRA: {
    social_protection:["28","31","24","20"], health:["26"], education_research:["14","23"], defence:["9"], public_order_justice:["27","18","16"],
    transport_infrastructure:["11"], environment_agriculture:["3"], housing_community:["5","21"], economic_affairs:["17","12"],
    general_services_debt:["13","15","2","25","4","1","22","10","6","7","30"], culture_recreation:["8","29","19"],
  },
  GBR: {
    social_protection:["17"], health:["1"], education_research:["2","12"], defence:["6"], public_order_justice:["3","4","7","5"],
    transport_infrastructure:["13"], environment_agriculture:["15","14"], housing_community:["10","9"], economic_affairs:["16"],
    general_services_debt:["8","18","20","19"], culture_recreation:["11"],
  },
  POL: {
    social_protection:["753","855","852","853"], health:["851"], education_research:["730","801","854"], defence:["752"],
    public_order_justice:["754","755","751"], transport_infrastructure:["600","720"], environment_agriculture:["010","900","050","925","020"],
    housing_community:["700"], economic_affairs:["100","150","500","710","630","550"], general_services_debt:["758","757","750"], culture_recreation:["921","926"],
  },
  SWE: {
    social_protection:["10","12","14","11","15","13","8"], health:["9"], education_research:["16"], defence:["6"], public_order_justice:["4"],
    transport_infrastructure:["22"], environment_agriculture:["23","20"], housing_community:["18","19"], economic_affairs:["2","3","21","24"],
    general_services_debt:["25","27","7","26","1","5"], culture_recreation:["17"],
  },
  CHE: {
    social_protection:["1"], education_research:["4"], defence:["5"], transport_infrastructure:["3"], environment_agriculture:["6"],
    general_services_debt:["2","7"],
  },
  UKR: {
    social_protection:["10"], health:["07"], education_research:["09"], defence:["02"], public_order_justice:["03"],
    environment_agriculture:["05"], housing_community:["06"], economic_affairs:["04"], general_services_debt:["01"], culture_recreation:["08"],
  },
  USA: {
    social_protection:["12","9","21","166","190"], health:["6","23","234","28"], education_research:["13","20","145","188","106","48","99"],
    defence:["5","29","78"], public_order_justice:["18","8","2","26","50","182","205","239","76","172","110"],
    transport_infrastructure:["16","30","147","186","93","232"], environment_agriculture:["3","7","15","112","204","197","238","95"],
    housing_community:["19","219","223","150","101","119","156"], economic_affairs:["14","4","87","22","169","70","236","103"],
    general_services_debt:["11","10","27","1","17","80"], culture_recreation:["171","141","140","175","100","55","43","75"],
  },
};

const round = value => Math.round(value * 1e6) / 1e6;
const countries = source.countries.map(country => {
  const sourceAmountScaleToBillions = country.code === "USA" ? 0.001 : 1;
  const totals = {
    previous: round(country.totals.previous * sourceAmountScaleToBillions),
    current: round(country.totals.current * sourceAmountScaleToBillions),
  };
  const assigned = new Map();
  for (const [category, codes] of Object.entries(map[country.code] || {})) {
    for (const code of codes) {
      if (assigned.has(code)) throw new Error(`${country.code}: row ${code} mapped twice`);
      assigned.set(code, category);
    }
  }
  const unknownCodes = [...assigned.keys()].filter(code => !country.rows.some(row => row.code === code));
  if (unknownCodes.length) throw new Error(`${country.code}: unknown mapped rows ${unknownCodes.join(", ")}`);

  const groups = categories.map(category => {
    const rows = country.rows.filter(row => (assigned.get(row.code) || "other_unallocated") === category.id);
    const previous = round(rows.reduce((sum, row) => sum + row.amounts.previous, 0) * sourceAmountScaleToBillions);
    const current = round(rows.reduce((sum, row) => sum + row.amounts.current, 0) * sourceAmountScaleToBillions);
    return {
      category_id: category.id,
      amounts: {previous, current},
      shares_pct: {
        previous: round(previous / totals.previous * 100),
        current: round(current / totals.current * 100),
      },
      source_rows: rows.map(row => ({code: row.code, label_native: row.label_native, label_en: row.label_en})),
    };
  });
  for (const period of ["previous", "current"]) {
    const groupedTotal = round(groups.reduce((sum, group) => sum + group.amounts[period], 0));
    if (Math.abs(groupedTotal - totals[period]) > 0.01) throw new Error(`${country.code}: ${period} groups do not reconcile`);
  }
  return {
    code: country.code,
    currency: country.currency,
    unit: "billion_local_currency",
    source_amount_scale_to_billions: sourceAmountScaleToBillions,
    dimension: country.dimension,
    scope_cs: country.scope_cs,
    scope_en: country.scope_en,
    periods: country.periods,
    totals,
    groups,
  };
});

const payload = {
  schema_version: "1.0.0",
  dataset_id: "COUNTRY_SPENDING_COMPARISON_2025_2026",
  generated_at: source.generated_at,
  method: {
    id: "explicit_native_line_to_common_psd_category_v1",
    note_cs: "Národní položky centrálních nebo státních rozpočtů jsou přiřazeny k širokým společným kategoriím. Nejde o harmonizovanou statistiku COFOG ani o celý sektor vládních institucí. Smíšené a nerozlišitelné položky zůstávají v kategorii Ostatní / nerozdělené.",
    note_en: "Native central or state budget lines are mapped to broad common categories. This is not harmonised COFOG statistics or the full general-government sector. Mixed and non-separable lines remain in Other / unallocated.",
  },
  categories,
  fx: source.fx,
  countries,
};

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${countries.length} countries and ${categories.length} common categories`);
