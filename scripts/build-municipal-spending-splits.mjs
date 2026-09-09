import { readdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("data/municipal-spending-splits.v1.json", root);
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

async function frenchSplit() {
  const directory = new URL("data/france-municipal-profiles/", root);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".v1.json")).sort();
  let operating = 0;
  let investment = 0;
  let municipalityCount = 0;

  for (const file of files) {
    const payload = JSON.parse(await readFile(new URL(file, directory), "utf8"));
    for (const profile of Object.values(payload.profiles || {})) {
      const row = profile.history?.find((entry) => Number(entry.year) === 2025);
      if (!Number.isFinite(row?.expenditure) || !Number.isFinite(row?.operating_expenditure)) continue;
      const residual = Number(row.expenditure) - Number(row.operating_expenditure);
      if (residual < -0.01) throw new Error(`France ${profile.code}: operating expenditure exceeds total expenditure`);
      operating += Number(row.operating_expenditure);
      investment += Math.max(0, residual);
      municipalityCount += 1;
    }
  }

  if (municipalityCount < 34_000) throw new Error(`France: only ${municipalityCount} profiles contributed to the split`);
  return {
    code: "FRA",
    year: 2025,
    stage: "provisional_actual",
    currency: "EUR",
    municipality_count: municipalityCount,
    operating_expenditure: round(operating),
    investment_expenditure: round(investment),
    classified_expenditure: round(operating + investment),
    labels: {
      cs: { operating: "Provozní výdaje", investment: "Investiční výdaje" },
      en: { operating: "Operating expenditure", investment: "Investment expenditure" },
    },
    methodology_cs: "Hlavní rozpočet OFGL rozděluje výdaje na section de fonctionnement a section d’investissement. Investiční část zahrnuje také finanční toky, například splátky jistiny dluhu, a není proto totožná s firemním CAPEX.",
    methodology_en: "The OFGL main budget separates the operating section (fonctionnement) from the investment section (investissement). Investment also includes financing flows such as debt-principal repayment, so it is not identical to corporate CAPEX.",
    source_title: "OFGL · Base communes",
    source_url: "https://data.ofgl.fr/explore/dataset/ofgl-base-communes/",
  };
}

async function finnishSplit() {
  const directory = new URL("data/municipal-benchmarks/fin/", root);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  let operating = 0;
  let investment = 0;
  let municipalityCount = 0;

  for (const file of files) {
    const profile = JSON.parse(await readFile(new URL(file, directory), "utf8"));
    const measures = new Map((profile.breakdown || []).map((row) => [row.name, row.amount]));
    const operatingValue = measures.get("Operating expenses total");
    const investmentValue = measures.get("Investment expenses");
    if (!Number.isFinite(operatingValue) || !Number.isFinite(investmentValue)) continue;
    operating += Number(operatingValue);
    investment += Number(investmentValue);
    municipalityCount += 1;
  }

  if (municipalityCount !== 310) throw new Error(`Finland: expected 310 profiles, found ${municipalityCount}`);
  return {
    code: "FIN",
    year: 2020,
    stage: "actual",
    currency: "EUR",
    municipality_count: municipalityCount,
    operating_expenditure: round(operating),
    investment_expenditure: round(investment),
    classified_expenditure: round(operating + investment),
    labels: {
      cs: { operating: "Provozní náklady", investment: "Investiční výdaje" },
      en: { operating: "Operating expenses", investment: "Investment expenses" },
    },
    methodology_cs: "Finské obecní účetní výkazy vykazují provozní náklady a investiční výdaje jako samostatné ukazatele. Jmenovatelem je jejich součet; nejde o mandatorní versus volitelné výdaje ani o rozklad výsledovkových nákladů.",
    methodology_en: "Finnish municipal financial statements publish operating expenses and investment expenses as separate measures. The denominator is their sum; this is neither mandatory versus discretionary spending nor a decomposition of income-statement expenditure.",
    source_title: "Statistics Finland · Municipal finances",
    source_url: "https://pxdata.stat.fi/PxWeb/pxweb/en/Kuntien_talous_ja_toiminta/",
  };
}

const countries = await Promise.all([frenchSplit(), finnishSplit()]);
const payload = {
  schema_version: "1.0.0",
  generated_at: "2026-09-09",
  definition: "Country-native operating/current and investment/capital expenditure splits. Values are comparable within a country and year; terminology and accounting boundaries are not silently harmonised across countries.",
  countries,
};

await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${countries.length} municipal spending splits to ${output.pathname}`);
