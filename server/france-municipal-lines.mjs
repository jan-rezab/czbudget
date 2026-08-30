const DEFAULT_PROJECT = "czbudget-janrezab";
const DEFAULT_LOCATION = "EU";
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_SIZE = 1_000;
let metadataAccessToken = null;

export const FRANCE_MUNICIPAL_LINES_SQL = `
WITH scoped AS (
  SELECT
    fiscal_year,
    budget_stage,
    budget_side,
    reporting_scope,
    economic_item_code,
    functional_paragraph_code,
    source_id,
    amount_local,
    (SELECT REPLACE(flag, 'nomenclature:', '')
     FROM UNNEST(quality_flags) AS flag
     WHERE STARTS_WITH(flag, 'nomenclature:')
     LIMIT 1) AS nomenclature
  FROM \`czbudget-janrezab.budget_detail.municipal_budget_line_facts\`
  WHERE fiscal_year BETWEEN @min_year AND @max_year
    AND public_entity_id = @entity_id
    AND budget_side IN ('revenue', 'expenditure')
    AND NOT is_consolidation_item
    AND NOT is_summary_row
    AND (reporting_scope = 'main_budget' OR coverage_type = 'published_subset')
)
SELECT
  'economic' AS dimension,
  fiscal_year,
  budget_stage,
  budget_side,
  reporting_scope,
  economic_item_code AS code,
  nomenclature,
  CAST(SUM(amount_local) AS STRING) AS amount_local,
  STRING_AGG(DISTINCT source_id, ',' ORDER BY source_id) AS source_ids
FROM scoped
GROUP BY fiscal_year, budget_stage, budget_side, reporting_scope, code, nomenclature
UNION ALL
SELECT
  'functional' AS dimension,
  fiscal_year,
  budget_stage,
  budget_side,
  reporting_scope,
  functional_paragraph_code AS code,
  nomenclature,
  CAST(SUM(amount_local) AS STRING) AS amount_local,
  STRING_AGG(DISTINCT source_id, ',' ORDER BY source_id) AS source_ids
FROM scoped
WHERE functional_paragraph_code IS NOT NULL
  AND functional_paragraph_code != 'UNSPECIFIED'
GROUP BY fiscal_year, budget_stage, budget_side, reporting_scope, code, nomenclature
ORDER BY fiscal_year DESC, budget_stage, budget_side, dimension, ABS(SAFE_CAST(amount_local AS NUMERIC)) DESC
`;

export class FranceLinesError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class FranceMunicipalLinesStore {
  constructor({
    fetchImpl = globalThis.fetch,
    tokenProvider = null,
    project = process.env.BQ_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT,
    location = process.env.BQ_LOCATION || DEFAULT_LOCATION,
    now = () => Date.now(),
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.tokenProvider = tokenProvider || (() => metadataToken(this.fetchImpl));
    this.project = project;
    this.location = location;
    this.now = now;
    this.cache = new Map();
  }

  async profile(code) {
    const normalized = normalizeCommuneCode(code);
    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > this.now()) {
      this.cache.delete(normalized);
      this.cache.set(normalized, cached);
      return cached.value;
    }

    const rows = await this.query(`FR:${normalized}`);
    const economic = [];
    const functional = [];
    const sources = new Set();
    const years = new Set();
    for (const row of rows) {
      const amount = Number(row.amount_local);
      if (!Number.isFinite(amount) || !row.code) continue;
      const dimension = row.dimension === "functional" ? "functional" : "economic";
      const labels = dimension === "functional" ? functionalLabels(row.code) : economicLabels(row.code);
      const item = {
        year: Number(row.fiscal_year),
        stage: row.budget_stage,
        side: row.budget_side,
        reporting_scope: row.reporting_scope,
        code: row.code,
        nomenclature: row.nomenclature || null,
        name_native: labels.fr,
        name_en: labels.en,
        name_cs: labels.cs,
        amount,
        currency: "EUR",
        source_ids: String(row.source_ids || "").split(",").filter(Boolean),
      };
      item.source_ids.forEach((source) => sources.add(source));
      years.add(item.year);
      (dimension === "functional" ? functional : economic).push(item);
    }

    const value = {
      schema_version: "1.0.0",
      country: "FRA",
      entity_code: normalized,
      currency: "EUR",
      years: [...years].sort((a, b) => a - b),
      coverage: {
        economic_account_detail: economic.length > 0,
        economic_line_count: economic.length,
        functional_purpose_detail: functional.length > 0,
        functional_line_count: functional.length,
        note: functional.length
          ? "This commune reports both economic account and functional purpose classifications."
          : "Economic account detail is available; the source does not publish a functional purpose classification for this commune.",
      },
      economic,
      functional,
      sources: [...sources].sort(),
      source_url: "https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-communes-en-2025/",
      functional_source_url: "https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec-la-presentation-croisee-nature-fonction-2025/",
      methodology: "Amounts are official DGFiP executed-account entries. Economic accounts describe what kind of input or asset was paid for. Functional codes describe the public purpose only where the commune reports that classification.",
    };
    this.cache.set(normalized, { value, expiresAt: this.now() + CACHE_TTL_MS });
    while (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value);
    return value;
  }

  async query(entityID) {
    const token = await this.tokenProvider();
    const body = {
      query: FRANCE_MUNICIPAL_LINES_SQL,
      useLegacySql: false,
      location: this.location,
      timeoutMs: 8_000,
      maxResults: "20000",
      maximumBytesBilled: "2000000000",
      parameterMode: "NAMED",
      queryParameters: [
        parameter("entity_id", "STRING", entityID),
        parameter("min_year", "INT64", "2024"),
        parameter("max_year", "INT64", "2026"),
      ],
    };
    let payload = await requestJSON(this.fetchImpl, `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(this.project)}/queries`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!payload.jobComplete) {
      const job = payload.jobReference;
      if (!job?.jobId) throw new FranceLinesError(504, "france_lines_timeout", "The detailed municipal query did not complete in time.");
      payload = await requestJSON(this.fetchImpl, `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(this.project)}/queries/${encodeURIComponent(job.jobId)}?location=${encodeURIComponent(job.location || this.location)}&timeoutMs=5000&maxResults=20000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    if (!payload.jobComplete) throw new FranceLinesError(504, "france_lines_timeout", "The detailed municipal query did not complete in time.");
    return decodeRows(payload);
  }
}

export function normalizeCommuneCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!/^(?:\d{5}|2[AB]\d{3})$/.test(code)) {
    throw new FranceLinesError(400, "invalid_france_commune_code", "Expected a five-character French INSEE commune code.");
  }
  return code;
}

export function parameter(name, type, value) {
  return { name, parameterType: { type }, parameterValue: { value } };
}

export function decodeRows(payload) {
  if (payload.errors?.length) throw new FranceLinesError(502, "france_lines_query_failed", "The detailed municipal source returned an error.");
  const fields = payload.schema?.fields?.map((field) => field.name) || [];
  return (payload.rows || []).map((row) => Object.fromEntries(fields.map((field, index) => [field, row.f?.[index]?.v ?? null])));
}

export async function metadataToken(fetchImpl) {
  const now = Date.now();
  if (metadataAccessToken?.expiresAt > now + 60_000) return metadataAccessToken.value;
  const payload = await requestJSON(fetchImpl, "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!payload.access_token) throw new FranceLinesError(503, "france_lines_identity_unavailable", "The municipal detail service identity is unavailable.");
  metadataAccessToken = { value: payload.access_token, expiresAt: now + Number(payload.expires_in || 300) * 1000 };
  return metadataAccessToken.value;
}

export async function requestJSON(fetchImpl, url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new FranceLinesError(response.status === 403 ? 503 : 502, "france_lines_upstream_failed", "The detailed municipal source is temporarily unavailable.");
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new FranceLinesError(504, "france_lines_timeout", "The detailed municipal source timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function economicLabels(code) {
  const groups = [
    ["10", "Capital et réserves", "Capital and reserves", "Kapitál a rezervy"],
    ["13", "Subventions d’investissement", "Investment grants", "Investiční dotace"],
    ["16", "Emprunts et dettes assimilées", "Loans and similar debt", "Úvěry a obdobné dluhy"],
    ["20", "Immobilisations incorporelles", "Intangible assets", "Nehmotný majetek"],
    ["21", "Immobilisations corporelles", "Tangible assets", "Hmotný majetek"],
    ["23", "Immobilisations en cours", "Assets under construction", "Nedokončený majetek"],
    ["26", "Participations et créances rattachées", "Equity holdings and related receivables", "Majetkové účasti a související pohledávky"],
    ["27", "Autres immobilisations financières", "Other financial assets", "Ostatní finanční majetek"],
    ["60", "Achats et variation des stocks", "Purchases and inventory changes", "Nákupy a změny zásob"],
    ["61", "Services extérieurs", "External services", "Externí služby"],
    ["62", "Autres services extérieurs", "Other external services", "Ostatní externí služby"],
    ["63", "Impôts, taxes et versements assimilés", "Taxes and similar payments", "Daně a obdobné odvody"],
    ["64", "Charges de personnel", "Personnel costs", "Osobní náklady"],
    ["65", "Autres charges de gestion courante", "Other current management costs", "Ostatní běžné provozní náklady"],
    ["66", "Charges financières", "Financial costs", "Finanční náklady"],
    ["67", "Charges spécifiques", "Specific and exceptional costs", "Specifické a mimořádné náklady"],
    ["68", "Dotations aux amortissements et provisions", "Depreciation, amortisation and provisions", "Odpisy a rezervy"],
    ["70", "Produits des services et ventes", "Service and sales revenue", "Příjmy ze služeb a prodeje"],
    ["73", "Impôts et taxes", "Taxes and duties", "Daně a poplatky"],
    ["74", "Dotations et participations", "Grants and contributions", "Dotace a příspěvky"],
    ["75", "Autres produits de gestion courante", "Other current management revenue", "Ostatní běžné provozní příjmy"],
    ["76", "Produits financiers", "Financial income", "Finanční výnosy"],
    ["77", "Produits spécifiques", "Specific and exceptional income", "Specifické a mimořádné výnosy"],
    ["78", "Reprises sur amortissements et provisions", "Reversals of depreciation and provisions", "Rozpuštění odpisů a rezerv"],
  ];
  const exact = {
    "60611": ["Eau et assainissement", "Water and sanitation", "Voda a kanalizace"],
    "60612": ["Énergie et électricité", "Energy and electricity", "Energie a elektřina"],
    "60613": ["Chauffage", "Heating", "Vytápění"],
    "60621": ["Combustibles et carburants", "Fuel", "Paliva"],
  }[code];
  const match = exact || groups.find(([prefix]) => String(code).startsWith(prefix))?.slice(1);
  return { fr: match?.[0] || `Compte ${code}`, en: match?.[1] || `Account ${code}`, cs: match?.[2] || `Účet ${code}` };
}

export function functionalLabels(code) {
  const groups = {
    "0": ["Services généraux", "General public services", "Všeobecné veřejné služby"],
    "1": ["Sécurité", "Public safety", "Veřejná bezpečnost"],
    "2": ["Enseignement et formation", "Education and training", "Vzdělávání a odborná příprava"],
    "3": ["Culture, jeunesse, sports et loisirs", "Culture, youth, sport and leisure", "Kultura, mládež, sport a volný čas"],
    "4": ["Santé et action sociale", "Health and social action", "Zdravotnictví a sociální oblast"],
    "5": ["Aménagement et habitat", "Spatial planning and housing", "Územní rozvoj a bydlení"],
    "6": ["Action économique", "Economic affairs", "Hospodářská oblast"],
    "7": ["Environnement", "Environmental protection", "Ochrana životního prostředí"],
    "8": ["Transports", "Transport", "Doprava"],
  }[String(code).charAt(0)];
  return { fr: groups?.[0] || `Fonction ${code}`, en: groups?.[1] || `Function ${code}`, cs: groups?.[2] || `Funkce ${code}` };
}
