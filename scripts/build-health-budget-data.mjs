import { readFile, writeFile } from "node:fs/promises";

const source = JSON.parse(await readFile("data/cz-public-entities-2024.json", "utf8"));
const hospitals = source.entities
  .filter((entity) => entity.category === "Nemocnice")
  .filter((entity) => Number.isFinite(entity.revenue_mczk) && entity.revenue_mczk > 0)
  .filter((entity) => Number.isFinite(entity.cost_mczk) && entity.cost_mczk > 0)
  .map((entity) => ({
    ico: entity.ico,
    name: entity.name,
    owner_level: entity.owner_level,
    legal_form: entity.legal_form,
    revenue_mczk: entity.revenue_mczk,
    cost_mczk: entity.cost_mczk,
    result_mczk: entity.net_result_mczk,
    margin_pct: entity.top_line?.net_margin_pct,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "cs"));

const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const output = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  units: "CZK billion unless stated otherwise",
  system_2023: {
    total_bn: 641.996,
    sources: [
      { id: "state", cs: "Státní rozpočet", en: "State budget", value_bn: 66.638 },
      { id: "local", cs: "Kraje a obce", en: "Regions and municipalities", value_bn: 9.431 },
      { id: "insurers", cs: "Zdravotní pojišťovny", en: "Health insurers", value_bn: 466.596 },
      { id: "private", cs: "Ostatní soukromé zdroje", en: "Other private sources", value_bn: 5.62 },
      { id: "households", cs: "Domácnosti", en: "Households", value_bn: 93.711 },
    ],
    destinations: [
      { id: "hospitals", cs: "Nemocnice", en: "Hospitals", value_bn: 288.19 },
      { id: "long_term", cs: "Dlouhodobá lůžková péče", en: "Long-term inpatient care", value_bn: 51.71 },
      { id: "outpatient", cs: "Ambulantní péče", en: "Outpatient care", value_bn: 152.721 },
      { id: "ancillary", cs: "Doprava, záchranka a laboratoře", en: "Transport, emergency and laboratories", value_bn: 26.113 },
      { id: "pharmacy", cs: "Lékárny a zdravotnické prostředky", en: "Pharmacies and medical devices", value_bn: 87.456 },
      { id: "prevention", cs: "Prevence", en: "Prevention", value_bn: 3.778 },
      { id: "other", cs: "Správa a ostatní", en: "Administration and other", value_bn: 32.028 },
    ],
  },
  insurers_2024: {
    insured_people: 10853476,
    insurer_count: 7,
    reserves_bn: 47.717,
    revenues: [
      { id: "premiums", cs: "Pojistné po přerozdělení", en: "Premium income after redistribution", value_bn: 498.143 },
      { id: "other", cs: "Ostatní příjmy", en: "Other income", value_bn: 6.514 },
    ],
    expenses: [
      { id: "care", cs: "Zdravotní služby", en: "Health services", value_bn: 499.286 },
      { id: "operations", cs: "Provoz pojišťoven", en: "Insurer operations", value_bn: 10.124 },
      { id: "foreign", cs: "Péče o cizince", en: "Care for foreign insured persons", value_bn: 2.718 },
      { id: "other", cs: "Jiné", en: "Other", value_bn: 0.037 },
    ],
  },
  hospital_sector_2022: {
    provider_count: 132,
    revenues: [
      { id: "insurers", cs: "Úhrady zdravotních pojišťoven", en: "Health insurer payments", value_bn: 218.486 },
      { id: "subsidies", cs: "Provozní dotace", en: "Operating subsidies", value_bn: 4.129 },
      { id: "goods", cs: "Prodej zboží", en: "Goods sold", value_bn: 12.935 },
      { id: "direct", cs: "Přímé tržby za služby", en: "Direct service revenue", value_bn: 2.967 },
      { id: "other", cs: "Ostatní výnosy", en: "Other revenue", value_bn: 17.839 },
    ],
    expenses: [
      { id: "staff", cs: "Osobní náklady", en: "Personnel", value_bn: 124.567 },
      { id: "drugs", cs: "Léčiva", en: "Medicines", value_bn: 42.489 },
      { id: "medical_supplies", cs: "Zdravotnický materiál", en: "Medical supplies", value_bn: 23.882 },
      { id: "other_material", cs: "Ostatní materiál", en: "Other materials", value_bn: 10.046 },
      { id: "services", cs: "Služby", en: "Services", value_bn: 15.3 },
      { id: "depreciation", cs: "Odpisy", en: "Depreciation", value_bn: 11.383 },
      { id: "energy_other", cs: "Energie, zboží a ostatní", en: "Energy, goods and other", value_bn: 21.432 },
    ],
  },
  hospital_benchmark_2024: {
    registered_count: source.entities.filter((entity) => entity.category === "Nemocnice").length,
    comparable_count: hospitals.length,
    coverage: "Publicly controlled entities with a positive 2024 VZZ revenue and cost statement in ČSÚIS; all comparable entities are contributory organisations.",
    medians: {
      revenue_mczk: median(hospitals.map((hospital) => hospital.revenue_mczk)),
      cost_mczk: median(hospitals.map((hospital) => hospital.cost_mczk)),
      result_mczk: median(hospitals.map((hospital) => hospital.result_mczk)),
      margin_pct: median(hospitals.map((hospital) => hospital.margin_pct)),
    },
    hospitals,
  },
  sources: [
    { title: "ČSÚ — Zdravotnické účty ČR 2010–2023", url: "https://csu.gov.cz/docs/107508/3183dddf-79c3-3d97-07bf-0660173c563e/26000525.pdf?version=1.1" },
    { title: "MF ČR — Státní závěrečný účet 2024", url: "https://www.mfcr.cz/assets/attachments/2024-04-28_F-Zprava-o-hospodareni-dalsich-slozek-verejnych-rozpoctu-a-o-fondech-organizacnich-slozek-statu.pdf" },
    { title: "ÚZIS ČR — Ekonomické výsledky nemocnic 2022", url: "https://www.uzis.cz/res/f/008448/eknem2022.pdf" },
    { title: "MONITOR Státní pokladny — transakční data ČSÚIS", url: "https://monitor.statnipokladna.gov.cz/datovy-katalog/transakcni-data" },
  ],
};

await writeFile("data/cz-health-budget.v1.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${hospitals.length} comparable hospitals.`);
