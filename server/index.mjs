import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AuthError, handleAuth, requestToken, verifyIdToken } from "./auth.mjs";
import { DataError, apiIndex, capitalCity, countryModule, countryProfile, czechMunicipalityBudget, czechMunicipalityHistory, datasetIds, datasetInfo, datasetPayload, listCapitalCities, listCountries, listDatasets, listMunicipalities, listPublicEntities, municipality, publicEntity, publicEntityAggregates } from "./data-store.mjs";
import { exportDataset } from "./bulk-export.mjs";
import { EMBEDDABLE, EmbedError, embedURL, oembed } from "./embed.mjs";
import { openapi } from "./openapi.mjs";
import { FixedWindowRateLimiter } from "./rate-limit.mjs";
import { FranceLinesError, FranceMunicipalLinesStore } from "./france-municipal-lines.mjs";
import { COUNTRIES as WAREHOUSED_COUNTRIES, MunicipalLinesStore } from "./municipal-lines.mjs";
import { municipalityPage } from "./municipality-page.mjs";
import { publicSnapshotStore, SnapshotError } from "./snapshot-store.mjs";

const PORT = Number(process.env.API_PORT || 8081);
const MAX_BODY_BYTES = 32 * 1024;
const MAX_REQUEST_URL_BYTES = integerSetting("API_MAX_REQUEST_URL_BYTES", 4 * 1024, 1024, 32 * 1024);
const MAX_RESPONSE_BYTES = integerSetting("API_MAX_RESPONSE_BYTES", 2 * 1024 * 1024, 64 * 1024, 32 * 1024 * 1024);
const MAX_IN_FLIGHT = integerSetting("API_MAX_IN_FLIGHT", 32, 1, 1_000);
const API_IP_MINUTE_LIMIT = integerSetting("API_IP_MINUTE_LIMIT", 300, 1, 100_000);
const API_USER_MINUTE_LIMIT = integerSetting("API_USER_MINUTE_LIMIT", 300, 1, 100_000);
const API_USER_DAY_LIMIT = integerSetting("API_USER_DAY_LIMIT", 10_000, 1, 10_000_000);
const API_ANON_MINUTE_LIMIT = integerSetting("API_ANON_MINUTE_LIMIT", 120, 1, 100_000);
const AUTH_IP_WINDOW_LIMIT = integerSetting("AUTH_IP_WINDOW_LIMIT", 20, 1, 100_000);
const RATE_LIMIT_BUCKETS = integerSetting("RATE_LIMIT_BUCKETS", 50_000, 100, 1_000_000);
const PAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const CORS_ORIGINS = new Set((process.env.API_CORS_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
const rateLimiter = new FixedWindowRateLimiter({ maxBuckets: RATE_LIMIT_BUCKETS });
const franceMunicipalLines = new FranceMunicipalLinesStore();
const municipalLines = new MunicipalLinesStore();
let apiRequestsInFlight = 0;

function integerSetting(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function requestID(request) {
  const incoming = request.headers["x-request-id"];
  return typeof incoming === "string" && /^[A-Za-z0-9._:-]{1,100}$/.test(incoming) ? incoming : crypto.randomUUID();
}

export function sendJSON(response, status, payload, extraHeaders = {}) {
  let body = JSON.stringify(payload);
  if (status < 400 && Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
    status = 500;
    body = JSON.stringify({
      error: {
        code: "response_limit_exceeded",
        message: "The response exceeds the API safety limit. Use a paginated or narrower endpoint.",
        request_id: String(response.getHeader("X-Request-ID") || ""),
      },
    });
  }
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "x-content-type-options": "nosniff",
    ...extraHeaders,
  });
  response.end(body);
  return true;
}

function sendPublicJSON(request, response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    "x-content-type-options": "nosniff",
    ...extraHeaders,
  });
  response.end(request.method === "HEAD" ? undefined : body);
  return true;
}

function sendHTML(request, response, body) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    "x-content-type-options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : body);
  return true;
}

function sendError(response, status, code, message, id) {
  return sendJSON(response, status, { error: { code, message, request_id: id } });
}

function setCors(request, response) {
  const origin = request.headers.origin;
  if (!origin || !CORS_ORIGINS.has(origin)) return;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Vary", "Origin");
}

function clientIP(request) {
  return String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function enforceRateLimit(response, id, { key, limit, windowMs, group }) {
  const now = Date.now();
  const result = rateLimiter.consume(`${group}:${key}`, { limit, windowMs }, now);
  response.setHeader("RateLimit-Limit", String(result.limit));
  response.setHeader("RateLimit-Remaining", String(result.remaining));
  response.setHeader("RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  response.setHeader("RateLimit-Policy", `\"${group}\";q=${limit};w=${Math.ceil(windowMs / 1000)}`);
  if (result.allowed) return true;
  response.setHeader("Retry-After", String(Math.max(1, Math.ceil((result.resetAt - now) / 1000))));
  sendError(response, 429, "rate_limit_exceeded", "Too many requests. Try again after the rate-limit window resets.", id);
  return false;
}

function acquireAPISlot(response, id) {
  if (apiRequestsInFlight >= MAX_IN_FLIGHT) {
    response.setHeader("Retry-After", "1");
    sendError(response, 503, "api_capacity_exceeded", "The API is temporarily at capacity. Try again shortly.", id);
    return false;
  }
  apiRequestsInFlight += 1;
  return true;
}

async function readBody(request) {
  if (!["POST", "PUT", "PATCH"].includes(request.method)) return {};
  const contentType = request.headers["content-type"] || "";
  if (!contentType && !request.headers["transfer-encoding"] && Number(request.headers["content-length"] || 0) === 0) return {};
  if (!contentType.toLowerCase().startsWith("application/json")) throw new DataError(415, "unsupported_media_type", "Use application/json for request bodies.");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new DataError(413, "request_too_large", "Request body exceeds 32 KiB.");
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("body must be an object");
    return value;
  } catch {
    throw new DataError(400, "invalid_json", "Request body must be a valid JSON object.");
  }
}

async function sendPage(response, fileName, contentType) {
  const body = await fs.readFile(path.join(PAGE_ROOT, fileName));
  response.writeHead(200, {
    "content-type": contentType,
    "content-length": body.length,
    "cache-control": fileName.endsWith(".html") ? "no-store" : "private, max-age=3600",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
  return true;
}

/**
 * The public origin to write into embed snippets. Taken from configuration, not from the
 * request's Host header: a snippet built from an attacker-supplied Host would point every
 * embedded chart at their domain while looking like ours. The request origin is used only
 * where nothing is configured, which is local development and the tests.
 */
function originOf(request, url) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, "");
  return url.origin;
}

async function routeAPI(request, response, url) {
  if (request.method !== "GET") throw new DataError(405, "method_not_allowed", "This endpoint only supports GET.");
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  let match;

  if (pathname === "/api/v1") return sendJSON(response, 200, { data: await apiIndex() });
  if (pathname === "/api/v1/datasets") return sendJSON(response, 200, { data: await listDatasets() });
  if ((match = pathname.match(/^\/api\/v1\/datasets\/([^/]+)$/))) return sendJSON(response, 200, { data: await datasetInfo(decodeURIComponent(match[1])) });
  if (pathname === "/api/v1/countries") return sendJSON(response, 200, { data: await listCountries() });
  if ((match = pathname.match(/^\/api\/v1\/countries\/([^/]+)$/))) return sendJSON(response, 200, { data: await countryProfile(match[1]) });

  const countryModules = [
    ["fiscal", "fiscal"],
    ["spending", "spending"],
    ["spending/comparison", "spending-comparison"],
    ["spending/functions", "functional-spending"],
    ["revenue", "revenue"],
    ["health", "health"],
    ["health/performance", "health-performance"],
    ["demography", "demography"],
    ["transport", "transport"],
  ];
  for (const [route, module] of countryModules) {
    match = pathname.match(new RegExp(`^/api/v1/countries/([^/]+)/${route}$`));
    if (match) return sendJSON(response, 200, await countryModule(match[1], module));
  }

  if (pathname === "/api/v1/capital-cities") return sendJSON(response, 200, await listCapitalCities(url.searchParams));
  if ((match = pathname.match(/^\/api\/v1\/capital-cities\/([^/]+)$/))) return sendJSON(response, 200, { data: await capitalCity(decodeURIComponent(match[1])) });
  if (pathname === "/api/v1/municipalities") return sendJSON(response, 200, await listMunicipalities(url.searchParams));
  if ((match = pathname.match(/^\/api\/v1\/municipalities\/CZE\/(\d{8})\/budget$/))) return sendJSON(response, 200, { data: await czechMunicipalityBudget(match[1]) });
  if ((match = pathname.match(/^\/api\/v1\/municipalities\/CZE\/(\d{8})\/history$/))) return sendJSON(response, 200, { data: await czechMunicipalityHistory(match[1]) });
  if ((match = pathname.match(/^\/api\/v1\/municipalities\/([^/]+)\/([^/]+)$/))) return sendJSON(response, 200, { data: await municipality(match[1], decodeURIComponent(match[2])) });
  if (pathname === "/api/v1/public-entities/aggregates") return sendJSON(response, 200, await publicEntityAggregates(url.searchParams));
  if (pathname === "/api/v1/public-entities") return sendJSON(response, 200, await listPublicEntities(url.searchParams));
  if ((match = pathname.match(/^\/api\/v1\/public-entities\/([^/]+)\/(.+)$/))) return sendJSON(response, 200, { data: await publicEntity(match[1], decodeURIComponent(match[2])) });

  // A2 — oEmbed. A CMS pasting a chart link should get the chart, not a bare URL. This is the
  // one API route consumers reach cross-origin by design, so it answers publicly and caches.
  if (pathname === "/api/v1/oembed") {
    try {
      return sendPublicJSON(request, response, 200, oembed(url.searchParams, originOf(request, url)), {
        "Cache-Control": "public, max-age=3600",
      });
    } catch (error) {
      if (error instanceof EmbedError) throw new DataError(error.status, error.code, error.message);
      throw error;
    }
  }

  // A3b — bulk. A reader wanting the whole series should not have to paginate an endpoint to
  // rebuild a file that already exists.
  if (pathname === "/api/v1/bulk") {
    const datasets = [];
    for (const id of datasetIds()) {
      try {
        const { path: source, payload } = await datasetPayload(id);
        const exported = exportDataset(payload);
        datasets.push({
          id,
          source_artifact: source,
          csv: `/api/v1/bulk/${id}.csv`,
          rows: exported.rows,
          columns: exported.columns,
          sha256: exported.sha256,
          vintage: exported.vintage,
          schema_version: exported.schema_version,
        });
      } catch {
        // A dataset the registry names but the tree does not carry is reported as absent
        // rather than silently omitted, so the manifest and the registry cannot disagree.
        datasets.push({ id, source_artifact: null, csv: null, available: false });
      }
    }
    return sendJSON(response, 200, {
      schema_version: "1.0.0",
      note: "One CSV per published dataset. sha256 is of the exact bytes served, so a "
          + "downloaded file can be matched to the release that produced it. vintage is the "
          + "source artifact's publication date, not the moment the CSV was rendered.",
      dataset_count: datasets.length,
      datasets,
    }, { "cache-control": "public, max-age=300" });
  }

  if ((match = pathname.match(/^\/api\/v1\/bulk\/([A-Za-z0-9-]+)\.csv$/))) {
    const { payload } = await datasetPayload(match[1]);
    const exported = exportDataset(payload);
    const body = Buffer.from(exported.body, "utf8");
    response.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-length": body.length,
      "content-disposition": `attachment; filename="${match[1]}.csv"`,
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
      ETag: `"${exported.sha256.slice(0, 32)}"`,
      "x-dataset-vintage": exported.vintage || "",
      "x-dataset-rows": String(exported.rows),
    });
    response.end(request.method === "HEAD" ? undefined : body);
    return true;
  }

  throw new DataError(404, "endpoint_not_found", "API endpoint does not exist.");
}

export async function handler(request, response) {
  const id = requestID(request);
  response.setHeader("X-Request-ID", id);
  setCors(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (Buffer.byteLength(request.url || "") > MAX_REQUEST_URL_BYTES) {
    return sendError(response, 414, "request_uri_too_long", "The request URL exceeds the API safety limit.", id);
  }
  const url = new URL(request.url, "http://api.internal");
  try {
    if (url.pathname.startsWith("/auth/")) {
      if (!enforceRateLimit(response, id, { key: clientIP(request), limit: AUTH_IP_WINDOW_LIMIT, windowMs: 15 * 60 * 1000, group: "auth-ip" })) return;
      const handled = await handleAuth(request, response, url.pathname.replace(/\/$/, ""), await readBody(request), sendJSON);
      if (handled) return;
      throw new DataError(404, "endpoint_not_found", "Authentication endpoint does not exist.");
    }

    if (url.pathname === "/developers" || url.pathname === "/developers/" || url.pathname === "/developers/login") {
      return sendPage(response, "login.html", "text/html; charset=utf-8");
    }

    // A2 — the tidy embed URL. The snippet itself points at the query form, which works on
    // plain static hosting where this server is not in front of the pages; this redirect
    // exists so a hand-typed /embed/<slug> still lands somewhere sensible.
    if (url.pathname.startsWith("/embed/")) {
      const slug = url.pathname.slice("/embed/".length).replace(/\/$/, "");
      if (!Object.prototype.hasOwnProperty.call(EMBEDDABLE, slug)) {
        return sendJSON(response, 404, { error: { code: "chart_not_embeddable", message: `No embeddable chart named '${slug}'` } });
      }
      const lang = url.searchParams.get("lang") === "en" ? "en" : undefined;
      response.writeHead(302, { Location: embedURL(slug, "", lang), "Cache-Control": "public, max-age=3600" });
      return response.end();
    }

    if (url.pathname === "/healthz") return sendJSON(response, 200, { status: "ok", public_snapshots: await publicSnapshotStore.status() });

    if (url.pathname === "/public-data/france-municipality-lines") {
      if (!["GET", "HEAD"].includes(request.method)) throw new DataError(405, "method_not_allowed", "This endpoint only supports GET and HEAD.");
      if (!enforceRateLimit(response, id, { key: "global", limit: 60, windowMs: 60 * 1000, group: "france-lines-global" })) return;
      if (!enforceRateLimit(response, id, { key: clientIP(request), limit: 30, windowMs: 60 * 1000, group: "france-lines-ip" })) return;
      if (!acquireAPISlot(response, id)) return;
      try {
        const payload = await franceMunicipalLines.profile(url.searchParams.get("code"));
        return sendPublicJSON(request, response, 200, payload, { ETag: `W/\"france-${payload.entity_code}-${payload.years.join("-")}\"` });
      } finally {
        apiRequestsInFlight -= 1;
      }
    }

    // The same job as the France route above, for every other warehoused country. France
    // keeps its own because it carries a nomenclature dimension and label tables no other
    // country reports; adding a country here is a config entry, not a new endpoint.
    if (url.pathname === "/public-data/municipality-lines") {
      if (!["GET", "HEAD"].includes(request.method)) throw new DataError(405, "method_not_allowed", "This endpoint only supports GET and HEAD.");
      if (!enforceRateLimit(response, id, { key: "global", limit: 60, windowMs: 60 * 1000, group: "municipal-lines-global" })) return;
      if (!enforceRateLimit(response, id, { key: clientIP(request), limit: 30, windowMs: 60 * 1000, group: "municipal-lines-ip" })) return;
      if (!acquireAPISlot(response, id)) return;
      try {
        const payload = await municipalLines.profile(url.searchParams.get("country"), url.searchParams.get("code"));
        return sendPublicJSON(request, response, 200, payload, {
          ETag: `W/"${payload.country}-${payload.entity_code}-${payload.years.join("-")}"`,
        });
      } finally {
        apiRequestsInFlight -= 1;
      }
    }

    if (url.pathname === "/public-data/municipality-lines/countries") {
      if (!["GET", "HEAD"].includes(request.method)) throw new DataError(405, "method_not_allowed", "This endpoint only supports GET and HEAD.");
      return sendPublicJSON(request, response, 200, {
        schema_version: "1.0.0",
        countries: Object.entries(WAREHOUSED_COUNTRIES).map(([code, country]) => ({
          country_code: code,
          currency: country.currency,
          years: country.years,
          source_url: country.sourceUrl,
        })),
      });
    }

    if (url.pathname === "/public-data/municipality-profile" || url.pathname === "/public-data/municipality-history") {
      if (!["GET", "HEAD"].includes(request.method)) throw new DataError(405, "method_not_allowed", "This endpoint only supports GET and HEAD.");
      const snapshot = await publicSnapshotStore.profileForPath(url.searchParams.get("path"));
      if (url.pathname.endsWith("-history")) {
        if (snapshot.history === null) throw new DataError(404, "municipality_history_not_found", "A separate history payload is not available for this profile.");
        return sendPublicJSON(request, response, 200, snapshot.history, { ETag: `"${snapshot.route.payload_sha256}-history"` });
      }
      return sendPublicJSON(request, response, 200, snapshot.profile, { ETag: `"${snapshot.route.payload_sha256}"` });
    }

    if (/^\/(?:municipalities\/[^/]+\/[^/]+|cz\/municipalities\/[^/]+)\/?$/.test(url.pathname)) {
      if (!["GET", "HEAD"].includes(request.method)) throw new DataError(405, "method_not_allowed", "This endpoint only supports GET and HEAD.");
      const snapshot = await publicSnapshotStore.profileForPath(url.pathname);
      return sendHTML(request, response, municipalityPage(snapshot));
    }

    // The two payload trees the pages fetch by file path — 28,559 expansion profiles and 6,254
    // Czech entities, 659 MB — answered from the release instead of from the image. The pages
    // above already fall back this way; these are the same objects under the names the client
    // asks for. municipal-expanded-profile.js reads the first, municipal-i18n.js the second.
    //
    // The route index is keyed by profile_id, which is exactly the country and code the path
    // carries, so this is a lookup rather than a second index.
    const expansionFile = /^\/(?:data\/)?municipal-expansion\/([a-z]{3})\/([^/]+)\.json$/.exec(url.pathname);
    const entityFile = /^\/data\/entities\/(\d{8})\.json$/.exec(url.pathname);
    const payloadFile = expansionFile
      ? { country: expansionFile[1].toUpperCase(), code: expansionFile[2] }
      : entityFile ? { country: "CZE", code: entityFile[1] } : null;
    if (payloadFile) {
      if (!["GET", "HEAD"].includes(request.method)) throw new DataError(405, "method_not_allowed", "This endpoint only supports GET and HEAD.");
      const snapshot = await publicSnapshotStore.profileForId(`${payloadFile.country}:${decodeURIComponent(payloadFile.code)}`);
      return sendPublicJSON(request, response, 200, snapshot.profile, { ETag: `"${snapshot.route.payload_sha256}"` });
    }

    // A3a — the contract is public. A specification nobody can read is not a contract, so the
    // docs page, the OpenAPI document and their assets answer without a session.
    if (url.pathname === "/docs" || url.pathname === "/docs/") {
      return sendPage(response, "docs.html", "text/html; charset=utf-8");
    }
    if (url.pathname === "/docs/openapi.json") {
      return sendJSON(response, 200, openapi, { "cache-control": "public, max-age=300" });
    }
    if (url.pathname === "/docs/assets/docs.css") {
      return sendPage(response, "docs.css", "text/css; charset=utf-8");
    }
    if (url.pathname === "/docs/assets/docs.js") {
      return sendPage(response, "docs.js", "application/javascript; charset=utf-8");
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (!enforceRateLimit(response, id, { key: clientIP(request), limit: API_IP_MINUTE_LIMIT, windowMs: 60 * 1000, group: "api-ip" })) return;

      // A3a — read-only routes answer anonymously. A token is no longer the door, only the
      // higher quota. A token that is presented but invalid still fails loudly rather than
      // silently downgrading to anonymous, so client auth bugs stay visible.
      const presentedToken = requestToken(request);
      const claims = presentedToken ? await verifyIdToken(presentedToken) : null;

      if (claims) {
        const userID = String(claims.user_id || claims.sub);
        if (!enforceRateLimit(response, id, { key: userID, limit: API_USER_DAY_LIMIT, windowMs: 24 * 60 * 60 * 1000, group: "api-user-day" })) return;
        if (!enforceRateLimit(response, id, { key: userID, limit: API_USER_MINUTE_LIMIT, windowMs: 60 * 1000, group: "api-user-minute" })) return;
        response.setHeader("X-Authenticated-User", claims.user_id || claims.sub);
        response.setHeader("Cache-Control", "private, max-age=60");
      } else {
        if (!enforceRateLimit(response, id, { key: clientIP(request), limit: API_ANON_MINUTE_LIMIT, windowMs: 60 * 1000, group: "api-anon" })) return;
        // Anonymous answers are identical for every caller, so shared caches may hold them.
        response.setHeader("Cache-Control", "public, max-age=300");
      }
      if (!acquireAPISlot(response, id)) return;
      try {
        return await routeAPI(request, response, url);
      } finally {
        apiRequestsInFlight -= 1;
      }
    }

    throw new DataError(404, "not_found", "Resource does not exist.");
  } catch (error) {
    if (error instanceof AuthError || error instanceof DataError || error instanceof SnapshotError || error instanceof FranceLinesError) return sendError(response, error.status, error.code, error.message, id);
    console.error(JSON.stringify({ severity: "ERROR", request_id: id, path: url.pathname, message: error?.message, stack: error?.stack }));
    return sendError(response, 500, "internal_error", "The request could not be completed.", id);
  }
}

if (process.env.NODE_ENV !== "test") {
  const server = http.createServer(handler);
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.listen(PORT, "0.0.0.0", async () => {
    try {
      if (process.env.API_READY_FILE) await fs.writeFile(process.env.API_READY_FILE, `${process.pid}\n`, { mode: 0o600 });
      console.log(JSON.stringify({ severity: "INFO", message: "API server ready", port: PORT }));
    } catch (error) {
      console.error(JSON.stringify({ severity: "ERROR", message: "API readiness marker failed", error: error?.message }));
      server.close(() => process.exit(1));
    }
  });
}
