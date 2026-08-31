/**
 * Warehouse-backed municipal line items, for every country including France.
 *
 * France proved the pattern: 35,042 communes and 10.4 million line facts served from
 * BigQuery, costing the repository nothing, while countries of a fraction the size shipped
 * as tens of thousands of committed JSON files. This is that pattern generalised, so every
 * country answers on one grain through one endpoint instead of each acquiring a bespoke
 * store — France included, addressable as ?country=FRA alongside the rest.
 *
 * Generalising did not mean flattening. France reports two classifications where the others
 * report one, and resolves its codes through published nomenclature tables. A country brings
 * its own query, dimensions and labeller where it has them, and the store carries those
 * through rather than reducing every country to the poorest common shape. A country that
 * reports one classification simply omits the field instead of carrying an invented one.
 *
 * The original /public-data/france-municipality-lines route and its store are untouched, so
 * anything already linking to them keeps working unchanged.
 *
 * Adding a country is a COUNTRIES entry, not new code.
 */
import {
  FRANCE_MUNICIPAL_LINES_SQL,
  FranceLinesError,
  decodeRows,
  economicLabels,
  functionalLabels,
  metadataToken,
  parameter,
  requestJSON,
} from "./france-municipal-lines.mjs";

const DEFAULT_PROJECT = "czbudget-janrezab";
const DEFAULT_LOCATION = "EU";
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_SIZE = 256;

/**
 * One entry per warehouse-backed country. `prefix` is the entity-id namespace the warehouse
 * uses — alpha-2 by its own established convention, which is why the entity registry exists
 * to map it to the canonical alpha-3 the artifacts carry.
 */
export const COUNTRIES = {
  // France reports two classifications where every other country reports one, and its codes
  // resolve through published nomenclature tables. Rather than flatten that away for the
  // sake of a uniform shape, the country brings its own query and its own labeller; the
  // store carries them through. Its original route stays exactly as it was.
  FRA: {
    prefix: "FR",
    currency: "EUR",
    codePattern: /^(?:\d{5}|2[AB]\d{3})$/,
    codeHint: "Expected a five-character French INSEE commune code.",
    scopes: ["main_budget"],
    years: [2024, 2026],
    sql: FRANCE_MUNICIPAL_LINES_SQL,
    dimensions: ["economic", "functional"],
    label: (dimension, code) => (dimension === "functional" ? functionalLabels(code) : economicLabels(code)),
    nativeLanguage: "fr",
    sourceUrl: "https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-communes-en-2025/",
    methodology:
      "Amounts are official DGFiP executed-account entries. Economic accounts describe what kind of input " +
      "or asset was paid for. Functional codes describe the public purpose, only where the commune reports " +
      "that classification.",
  },
  BOL: {
    prefix: "BO",
    currency: "BOB",
    codePattern: /^\d{4}$/,
    codeHint: "Expected a four-digit Bolivian local-government code.",
    scopes: ["standalone_municipality"],
    years: [2025, 2025],
    sourceUrl: "https://abierto.economiayfinanzas.gob.bo/descargas",
    methodology:
      "Bolivian Ministry of Economy open budget data: 2025 budget and execution for all 343 active " +
      "local governments, municipal and Indigenous autonomous.",
  },
  CHL: {
    prefix: "CL",
    currency: "CLP",
    codePattern: /^\d{5}$/,
    codeHint: "Expected a five-digit Chilean SINIM municipality code.",
    scopes: ["standalone_municipality"],
    years: [2025, 2025],
    sourceUrl: "https://datos.sinim.gov.cl/evolucion_presupuestaria.php",
    methodology:
      "Chilean SINIM budget execution. The source publishes a three-level hierarchy; only leaf rows " +
      "(N3) are served as facts, so summing returns the total once rather than three times.",
  },
  COL: {
    prefix: "CO",
    currency: "COP",
    codePattern: /^\d{8,9}$/,
    codeHint: "Expected a eight or nine digit Colombian CUIPO entity code.",
    scopes: ["standalone_municipality"],
    years: [2025, 2025],
    sourceUrl: "https://www.datos.gov.co/browse?q=OVCF%20CUIPO",
    methodology:
      "Colombian CUIPO reporting: initial and definitive plans plus execution for all reporting " +
      "municipalities.",
  },
  CRI: {
    prefix: "CR",
    currency: "CRC",
    codePattern: /^[A-Z]+(?:-[A-Z]+)+$/,
    codeHint: "Expected a Costa Rican SIPP institution code, e.g. SIPP-ABANGARES.",
    scopes: ["standalone_municipality"],
    years: [2025, 2025],
    sourceUrl: "https://cgrweb.cgr.go.cr/apex/f?p=150220:2",
    methodology:
      "Costa Rican Contraloría General SIPP filings.",
  },
  ESP: {
    prefix: "ES",
    currency: "EUR",
    codePattern: /^\d{5}[A-Z]{2}\d{3}$/,
    codeHint: "Expected a ten-character Spanish CONPREL entity code, e.g. 44001AA000.",
    scopes: ["standalone_municipality"],
    years: [2025, 2026],
    sourceUrl: "https://serviciostelematicosext.hacienda.gob.es/sgfal/conprel",
    methodology:
      "Spanish CONPREL: 2026 adopted budgets and 2025 liquidations with economic accounts, plus a " +
      "cash measure served as `paid`.",
  },
  GEO: {
    prefix: "GE",
    currency: "GEL",
    codePattern: /^[A-Z]{3}-\d{3}$/,
    codeHint: "Expected a Georgian Ministry of Finance workbook code, e.g. MOF-033.",
    scopes: ["standalone_municipality"],
    years: [2025, 2026],
    sourceUrl: "https://www.mof.ge/ka/page/budget-of-autonomous-republics-and-municipalities",
    methodology:
      "Georgian Ministry of Finance workbooks: 2025 actuals and the 2026 approved plan.",
  },
  GTM: {
    prefix: "GT",
    currency: "GTQ",
    codePattern: /^\d{8}$/,
    codeHint: "Expected a eight-digit Guatemalan municipality code.",
    scopes: ["standalone_municipality"],
    years: [2025, 2025],
    sourceUrl: "https://datos.minfin.gob.gt/es/dataset/informacion-municipal",
    methodology:
      "Guatemalan Ministry of Finance municipal reporting. A small number of items are published " +
      "without a code and are keyed by their official name, flagged item_code_derived_from_name.",
  },
  ITA: {
    prefix: "IT",
    currency: "EUR",
    codePattern: /^\d{9}$/,
    codeHint: "Expected a nine-digit Italian SIOPE entity code.",
    scopes: ["standalone_municipality"],
    years: [2025, 2025],
    sourceUrl: "https://www.siope.it/Siope/",
    methodology:
      "Italian SIOPE cash receipts and payments for 2025, grouped by native titles. SIOPE is a " +
      "cash-basis source, so every row is served as `paid`.",
  },
  KOR: {
    prefix: "KR",
    currency: "KRW",
    codePattern: /^\d{7}$/,
    codeHint: "Expected a seven-digit Korean local-finance code.",
    scopes: ["standalone_municipality"],
    years: [2024, 2024],
    sourceUrl: "https://www.lofin365.go.kr/portal/LF5100000.do",
    methodology:
      "Korean LOFIN local finance reporting for 2024.",
  },
  MEX: {
    prefix: "MX",
    currency: "MXN",
    codePattern: /^\d{5}$/,
    codeHint: "Expected a five-digit INEGI municipality code.",
    scopes: ["standalone_municipality"],
    years: [2024, 2024],
    sourceUrl: "https://www.inegi.org.mx/programas/finanzas/",
    methodology:
      "Mexican INEGI state and municipal public finance statistics for 2024. The source balance is " +
      "a reporting construct, not a fiscal-performance indicator.",
  },
  PER: {
    prefix: "PE",
    currency: "PEN",
    codePattern: /^\d{6}$/,
    codeHint: "Expected a six-digit Peruvian MEF entity code.",
    scopes: ["standalone_municipality"],
    years: [2024, 2024],
    sourceUrl: "https://datosabiertos.mef.gob.pe/dataset/presupuesto",
    methodology:
      "Peruvian MEF open budget data for 2024, including a cash measure served as `paid`.",
  },
  SLV: {
    prefix: "SV",
    currency: "USD",
    codePattern: /^\d{4}$/,
    codeHint: "Expected a four-digit Salvadoran municipality code.",
    scopes: ["standalone_municipality"],
    years: [2023, 2023],
    sourceUrl: "https://www.transparenciafiscal.gob.sv/ptf/es/PTF2-Gastos.html",
    methodology:
      "Salvadoran fiscal transparency portal, 2023 municipal budgets. Reported in US dollars, the " +
      "country’s legal tender.",
  },
  DNK: {
    prefix: "DK",
    currency: "DKK",
    codePattern: /^\d{3}$/,
    codeHint: "Expected a three-digit Danish municipality code.",
    scopes: ["standalone_municipality"],
    years: [2024, 2025],
    sourceUrl: "https://www.statbank.dk/BUDK100",
    methodology:
      "Statistics Denmark StatBank: BUDK100 adopted budgets and REGK100 final accounts at the " +
      "authorised functional and economic detail, for all 98 municipalities. Denmark is the one " +
      "country loaded from a national statistics office rather than from a ministry filing, so its " +
      "classification is the authorised account structure rather than a budget-document layout.",
  },
  BRA: {
    prefix: "BR",
    currency: "BRL",
    codePattern: /^\d{7}$/,
    codeHint: "Expected a seven-digit IBGE municipality code.",
    scopes: ["standalone_municipality"],
    years: [2024, 2025],
    sourceUrl: "https://apidatalake.tesouro.gov.br/docs/siconfi",
    methodology:
      "Amounts are official SICONFI RREO filings. Brazil runs expenditure through three execution " +
      "phases and reports all of them: committed (empenhada), actual (liquidada, the accrual measure " +
      "comparable with other countries) and paid (paga, the cash measure). They describe the same money " +
      "at different points, so do not add them together — pick the phase that answers your question. " +
      "carried_over is restos a pagar, payables carried into the next year. Rows with period FY cover " +
      "the whole year; period B6 is the sixth bimester alone, a slice of it, so those must not be summed " +
      "with FY either. The published SALDO columns are forecast minus realised — derivable from the rows " +
      "here rather than separately reported, so they are not stored.",
  },
};

export function resolveCountry(value) {
  const code = String(value || "").trim().toUpperCase();
  const country = COUNTRIES[code];
  if (!country) {
    throw new FranceLinesError(
      404,
      "country_not_warehoused",
      `No warehouse-backed municipal line detail for "${code}". Available: ${Object.keys(COUNTRIES).sort().join(", ")}.`,
    );
  }
  return { code, ...country };
}

function normaliseCode(country, value) {
  const code = String(value || "").trim().toUpperCase();
  if (!country.codePattern.test(code)) {
    throw new FranceLinesError(400, "invalid_municipality_code", country.codeHint);
  }
  return code;
}

/** Scope filter is per country: France reports main_budget, Brazil standalone_municipality. */
function sqlFor(scopes) {
  const list = scopes.map((scope) => `'${scope}'`).join(", ");
  return `
    SELECT
      fiscal_year,
      fiscal_period,
      budget_stage,
      budget_side,
      reporting_scope,
      economic_item_code AS code,
      source_budget_item_type_code AS column_label,
      CAST(SUM(amount_local) AS STRING) AS amount_local,
      STRING_AGG(DISTINCT source_id, ',' ORDER BY source_id) AS source_ids
    FROM \`czbudget-janrezab.budget_detail.municipal_budget_line_facts\`
    WHERE fiscal_year BETWEEN @min_year AND @max_year
      AND public_entity_id = @entity_id
      AND budget_side IN ('revenue', 'expenditure')
      AND NOT is_consolidation_item
      AND NOT is_summary_row
      AND reporting_scope IN (${list})
    -- fiscal_period must group, not collapse: a within-year slice (a bimester) and the
    -- full year are different facts about the same code, and adding them double-counts.
    GROUP BY 1, 2, 3, 4, 5, 6, 7
    ORDER BY fiscal_year, fiscal_period, budget_side, code
  `;
}

export class MunicipalLinesStore {
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

  async profile(countryCode, code) {
    const country = resolveCountry(countryCode);
    const normalised = normaliseCode(country, code);
    const key = `${country.code}:${normalised}`;

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now()) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.value;
    }

    const rows = await this.query(country, `${country.prefix}:${normalised}`);
    const lines = [];
    const sources = new Set();
    const years = new Set();

    for (const row of rows) {
      const amount = Number(row.amount_local);
      if (!Number.isFinite(amount) || !row.code) continue;
      // A country that reports more than one classification says which this row belongs to;
      // one that reports a single classification leaves the field off rather than inventing it.
      const dimension = country.dimensions
        ? (country.dimensions.includes(row.dimension) ? row.dimension : country.dimensions[0])
        : null;
      const labels = country.label ? country.label(dimension, row.code) : null;
      const item = {
        year: Number(row.fiscal_year),
        // "FY" is the whole year; anything else is a slice of it (Brazil files bimesters).
        period: row.fiscal_period || "FY",
        stage: row.budget_stage,
        side: row.budget_side,
        reporting_scope: row.reporting_scope,
        ...(dimension ? { dimension } : {}),
        code: row.code,
        ...(row.nomenclature ? { nomenclature: row.nomenclature } : {}),
        ...(labels ? {
          name_native: labels[country.nativeLanguage] ?? labels.en ?? null,
          name_en: labels.en ?? null,
          name_cs: labels.cs ?? null,
        } : {}),
        // The source's own column heading, kept verbatim: it is the only label the
        // upstream filing provides, and inventing a translation would misreport it.
        ...(row.column_label ? { source_column: row.column_label } : {}),
        amount,
        currency: country.currency,
        source_ids: String(row.source_ids || "").split(",").filter(Boolean),
      };
      item.source_ids.forEach((source) => sources.add(source));
      years.add(item.year);
      lines.push(item);
    }

    const value = {
      schema_version: "1.0.0",
      country: country.code,
      entity_code: normalised,
      currency: country.currency,
      years: [...years].sort((a, b) => a - b),
      coverage: {
        line_count: lines.length,
        stages: [...new Set(lines.map((line) => line.stage))].sort(),
        ...(country.dimensions ? {
          dimensions: Object.fromEntries(country.dimensions.map((name) => [
            name, lines.filter((line) => line.dimension === name).length,
          ])),
        } : {}),
        note: lines.length
          ? "Official line items as filed, excluding published totals and intra-budgetary transfers."
          : "No line detail is warehoused for this municipality.",
      },
      lines,
      sources: [...sources].sort(),
      source_url: country.sourceUrl,
      methodology: country.methodology,
    };

    this.cache.set(key, { value, expiresAt: this.now() + CACHE_TTL_MS });
    while (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value);
    return value;
  }

  async query(country, entityID) {
    const token = await this.tokenProvider();
    const body = {
      query: country.sql || sqlFor(country.scopes),
      useLegacySql: false,
      location: this.location,
      timeoutMs: 8_000,
      maxResults: "20000",
      maximumBytesBilled: "2000000000",
      parameterMode: "NAMED",
      queryParameters: [
        parameter("entity_id", "STRING", entityID),
        parameter("min_year", "INT64", String(country.years[0])),
        parameter("max_year", "INT64", String(country.years[country.years.length - 1])),
      ],
    };
    const endpoint = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(this.project)}/queries`;
    let payload = await requestJSON(this.fetchImpl, endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!payload.jobComplete) {
      const job = payload.jobReference;
      if (!job?.jobId) {
        throw new FranceLinesError(504, "municipal_lines_timeout", "The detailed municipal query did not complete in time.");
      }
      payload = await requestJSON(
        this.fetchImpl,
        `${endpoint}/${encodeURIComponent(job.jobId)}?location=${encodeURIComponent(job.location || this.location)}&timeoutMs=5000&maxResults=20000`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    }
    if (!payload.jobComplete) {
      throw new FranceLinesError(504, "municipal_lines_timeout", "The detailed municipal query did not complete in time.");
    }
    return decodeRows(payload);
  }
}
