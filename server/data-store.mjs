import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.env.SITE_ROOT || "/usr/share/nginx/html");
const cache = new Map();

const DATASETS = {
  fiscal: "lib/data/sovereign-benchmark.v1.json",
  spending: "data/country-spending-2025-2026.v1.json",
  "spending-comparison": "data/country-spending-comparison.v1.json",
  "functional-spending": "data/country-functional-budgets.v1.json",
  revenue: "data/country-revenue.v1.json",
  health: "data/country-health.v1.json",
  "health-performance": "data/country-health-performance.v1.json",
  demography: "data/country-demography.v1.json",
  transport: "data/transport-performance.v1.json",
  "capital-cities": "data/eu-capital-budgets.v1.json",
  municipalities: "data/international-municipalities.v1.json",
  "czech-municipalities": "data/municipal-snapshot.v1.json",
  "public-entity-aggregates": "data/public-entity-aggregates.v1.json",
  "country-parity": "data/country-parity.v1.json",
  catalog: "data/catalog.v1.json",
  release: "data/release-manifest.v1.json",
};

export class DataError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function readJSON(relativePath, { useCache = true } = {}) {
  if (useCache && cache.has(relativePath)) return cache.get(relativePath);
  const filePath = path.join(ROOT, relativePath);
  if (!filePath.startsWith(`${ROOT}${path.sep}`)) throw new DataError(400, "invalid_path", "Invalid data path.");
  let value;
  try {
    value = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw new DataError(404, "not_found", "The requested record does not exist.");
    throw error;
  }
  if (useCache) cache.set(relativePath, value);
  return value;
}

async function code(value) {
  const normalized = String(value || "").toUpperCase();
  const parity = await readJSON(DATASETS["country-parity"]);
  if (!parity.countries.some((country) => country.country_code === normalized)) {
    throw new DataError(404, "country_not_found", "Country code is not available.");
  }
  return normalized;
}

function countryFromDataset(dataset, countryCode) {
  const countries = dataset.countries;
  if (Array.isArray(countries)) {
    return countries.find((country) => [country.country_code, country.code].includes(countryCode));
  }
  return countries?.[countryCode];
}

function pageParams(searchParams) {
  if (searchParams.getAll("limit").length > 1) throw new DataError(400, "duplicate_parameter", "The limit parameter may only be provided once.");
  const rawLimit = searchParams.get("limit");
  if (rawLimit !== null && !/^\d{1,3}$/.test(rawLimit)) {
    throw new DataError(400, "invalid_limit", "The page limit must be an integer between 1 and 200.");
  }
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (limit < 1 || limit > 200) throw new DataError(400, "invalid_limit", "The page limit must be between 1 and 200.");
  let offset = 0;
  if (searchParams.getAll("cursor").length > 1) throw new DataError(400, "duplicate_parameter", "The cursor parameter may only be provided once.");
  const cursor = searchParams.get("cursor");
  if (cursor) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(cursor)) throw new DataError(400, "invalid_cursor", "The pagination cursor is invalid.");
    try {
      const decoded = Buffer.from(cursor, "base64url").toString("utf8");
      if (!/^(?:0|[1-9]\d{0,9})$/.test(decoded)) throw new Error("invalid cursor payload");
      offset = Number(decoded);
    } catch {
      throw new DataError(400, "invalid_cursor", "The pagination cursor is invalid.");
    }
    if (!Number.isSafeInteger(offset) || offset < 0) throw new DataError(400, "invalid_cursor", "The pagination cursor is invalid.");
  }
  return { limit, offset };
}

function optionalQuery(searchParams, name, maxLength) {
  const values = searchParams.getAll(name);
  if (values.length > 1) throw new DataError(400, "duplicate_parameter", `The ${name} parameter may only be provided once.`);
  const value = values[0]?.trim();
  if (value && value.length > maxLength) throw new DataError(400, "query_too_long", `The ${name} parameter must not exceed ${maxLength} characters.`);
  return value;
}

function optionalCountry(searchParams) {
  const value = optionalQuery(searchParams, "country", 3)?.toUpperCase();
  if (value && !/^[A-Z]{3}$/.test(value)) throw new DataError(400, "invalid_country", "The country parameter must be a three-letter country code.");
  return value;
}

function paginate(items, searchParams) {
  const { limit, offset } = pageParams(searchParams);
  const data = items.slice(offset, offset + limit);
  const nextOffset = offset + data.length;
  return {
    data,
    meta: {
      count: data.length,
      total: items.length,
      limit,
      next_cursor: nextOffset < items.length ? Buffer.from(String(nextOffset)).toString("base64url") : null,
    },
  };
}

function datasetMetadata(dataset) {
  const { countries, cities, entities, municipalities, records, rows, observations, series, summaries, national_source_registry, ...metadata } = dataset;
  return metadata;
}

function decodeDirectory(dataset) {
  const dictionaryFields = new Set(dataset.dictionary_fields || []);
  return dataset.records.map((row) => Object.fromEntries(dataset.fields.map((field, index) => {
    const value = row[index];
    return [field, dictionaryFields.has(field) && value !== null ? dataset.dictionaries[field]?.[value] ?? null : value];
  })));
}

export async function apiIndex() {
  const release = await readJSON(DATASETS.release).catch(() => ({}));
  return {
    name: "Public Spending Data API",
    version: "1.0.0",
    status: "ok",
    release: release.release_id || release.generated_at || null,
    documentation: "/docs",
    openapi: "/docs/openapi.json",
  };
}

export async function listDatasets() {
  const results = [];
  for (const [id, relativePath] of Object.entries(DATASETS)) {
    const dataset = await readJSON(relativePath);
    results.push({ id, path: relativePath, schema_version: dataset.schema_version || null, generated_at: dataset.generated_at || null, dataset_id: dataset.dataset_id || dataset.contract || null });
  }
  return results;
}

export async function datasetInfo(id) {
  const relativePath = DATASETS[id];
  if (!relativePath) throw new DataError(404, "dataset_not_found", "Dataset is not available.");
  return { id, path: relativePath, ...datasetMetadata(await readJSON(relativePath)) };
}

export async function listCountries() {
  const parity = await readJSON(DATASETS["country-parity"]);
  return parity.countries;
}

export async function countryProfile(countryCode) {
  const countryCodeNormalized = await code(countryCode);
  const parity = await readJSON(DATASETS["country-parity"]);
  const country = parity.countries.find((item) => item.country_code === countryCodeNormalized);
  if (!country) throw new DataError(404, "country_not_found", "Country code is not available.");
  return country;
}

export async function countryModule(countryCode, module) {
  const countryCodeNormalized = await code(countryCode);
  const relativePath = DATASETS[module];
  if (!relativePath) throw new DataError(404, "module_not_found", "Country module is not available.");
  const dataset = await readJSON(relativePath);
  const country = module === "fiscal"
    ? {
        country: dataset.countries.find((item) => item.country_code === countryCodeNormalized),
        series: dataset.series.find((item) => item.country_code === countryCodeNormalized),
        summary: dataset.summaries.find((item) => item.country_code === countryCodeNormalized),
      }
    : countryFromDataset(dataset, countryCodeNormalized);
  if (!country || (module === "fiscal" && !country.country)) throw new DataError(404, "module_not_found", "This module is not available for the country.");
  return { metadata: datasetMetadata(dataset), data: country };
}

export async function listCapitalCities(searchParams) {
  const dataset = await readJSON(DATASETS["capital-cities"]);
  let items = dataset.cities;
  const country = optionalCountry(searchParams);
  if (country) items = items.filter((item) => item.country_code === country);
  return { ...paginate(items, searchParams), dataset: datasetMetadata(dataset) };
}

export async function capitalCity(cityID) {
  const dataset = await readJSON(DATASETS["capital-cities"]);
  const city = dataset.cities.find((item) => item.city_id === cityID);
  if (!city) throw new DataError(404, "capital_city_not_found", "Capital city does not exist.");
  return city;
}

export async function listMunicipalities(searchParams) {
  const dataset = await readJSON(DATASETS.municipalities);
  let items = dataset.entities;
  const country = optionalCountry(searchParams);
  const query = optionalQuery(searchParams, "q", 100)?.toLocaleLowerCase();
  if (country) items = items.filter((item) => item.country === country);
  if (query) items = items.filter((item) => `${item.name} ${item.code || ""} ${item.region || ""}`.toLocaleLowerCase().includes(query));
  return { ...paginate(items, searchParams), dataset: datasetMetadata(dataset) };
}

export async function municipality(countryCode, municipalityID) {
  const countryCodeNormalized = String(countryCode || "").toUpperCase();
  const dataset = await readJSON(DATASETS.municipalities);
  const item = dataset.entities.find((entity) => entity.country === countryCodeNormalized && [entity.id, entity.code].includes(municipalityID));
  if (!item) throw new DataError(404, "municipality_not_found", "Municipality does not exist.");
  return item;
}

function safeCzechID(value) {
  if (!/^\d{8}$/.test(value)) throw new DataError(400, "invalid_municipality_id", "Czech municipality IDs must contain eight digits.");
  return value;
}

export async function czechMunicipalityBudget(municipalityID) {
  return readJSON(`data/entities/${safeCzechID(municipalityID)}.json`);
}

export async function czechMunicipalityHistory(municipalityID) {
  return readJSON(`data/municipal-history/${safeCzechID(municipalityID)}.json`);
}

export async function listPublicEntities(searchParams) {
  const countryCode = await code(optionalCountry(searchParams));
  const dataset = await readJSON(`data/public-entity-directory/${countryCode}.v1.json`);
  let items = decodeDirectory(dataset);
  const query = optionalQuery(searchParams, "q", 100)?.toLocaleLowerCase();
  const entityClass = optionalQuery(searchParams, "entity_class", 100)?.toLocaleLowerCase();
  if (query) items = items.filter((item) => `${item.name || ""} ${item.national_id || ""} ${item.region || ""}`.toLocaleLowerCase().includes(query));
  if (entityClass) items = items.filter((item) => String(item.entity_class || "").toLocaleLowerCase() === entityClass);
  return { ...paginate(items, searchParams), dataset: datasetMetadata(dataset) };
}

export async function publicEntity(countryCode, recordID) {
  const countryCodeNormalized = await code(countryCode);
  const dataset = await readJSON(`data/public-entity-directory/${countryCodeNormalized}.v1.json`);
  const recordIndex = dataset.fields.indexOf("record_id");
  const row = dataset.records.find((item) => item[recordIndex] === recordID);
  if (!row) throw new DataError(404, "public_entity_not_found", "Public entity does not exist.");
  const decoded = decodeDirectory({ ...dataset, records: [row] });
  return decoded[0];
}

export async function publicEntityAggregates(searchParams) {
  const dataset = await readJSON(DATASETS["public-entity-aggregates"]);
  let observations = dataset.observations;
  const country = optionalCountry(searchParams);
  const metric = optionalQuery(searchParams, "metric", 100)?.toLowerCase();
  if (country) observations = observations.filter((item) => item.country_code === country);
  if (metric) observations = observations.filter((item) => item.metric.toLowerCase() === metric);
  return { ...paginate(observations, searchParams), dataset: datasetMetadata(dataset) };
}
