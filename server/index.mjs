import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AuthError, handleAuth, requestToken, verifyIdToken } from "./auth.mjs";
import { DataError, apiIndex, capitalCity, countryModule, countryProfile, czechMunicipalityBudget, czechMunicipalityHistory, datasetInfo, listCapitalCities, listCountries, listDatasets, listMunicipalities, listPublicEntities, municipality, publicEntity, publicEntityAggregates } from "./data-store.mjs";
import { openapi } from "./openapi.mjs";

const PORT = Number(process.env.API_PORT || 8081);
const MAX_BODY_BYTES = 32 * 1024;
const PAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const CORS_ORIGINS = new Set((process.env.API_CORS_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
const rateBuckets = new Map();

function requestID(request) {
  const incoming = request.headers["x-request-id"];
  return typeof incoming === "string" && /^[A-Za-z0-9._:-]{1,100}$/.test(incoming) ? incoming : crypto.randomUUID();
}

export function sendJSON(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "x-content-type-options": "nosniff",
    ...extraHeaders,
  });
  response.end(body);
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

function enforceRateLimit(request, response, id, { limit, windowMs, group }) {
  const key = `${group}:${clientIP(request)}`;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  response.setHeader("RateLimit-Limit", String(limit));
  response.setHeader("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
  response.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count <= limit) return true;
  response.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
  sendError(response, 429, "rate_limit_exceeded", "Too many requests. Try again after the rate-limit window resets.", id);
  return false;
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

async function requireUser(request) {
  return verifyIdToken(requestToken(request));
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

  const url = new URL(request.url, "http://api.internal");
  try {
    if (url.pathname.startsWith("/auth/")) {
      if (!enforceRateLimit(request, response, id, { limit: 20, windowMs: 15 * 60 * 1000, group: "auth" })) return;
      const handled = await handleAuth(request, response, url.pathname.replace(/\/$/, ""), await readBody(request), sendJSON);
      if (handled) return;
      throw new DataError(404, "endpoint_not_found", "Authentication endpoint does not exist.");
    }

    if (url.pathname === "/developers" || url.pathname === "/developers/" || url.pathname === "/developers/login") {
      return sendPage(response, "login.html", "text/html; charset=utf-8");
    }

    if (url.pathname === "/healthz") return sendJSON(response, 200, { status: "ok" });

    if (url.pathname === "/docs" || url.pathname === "/docs/") {
      await requireUser(request);
      return sendPage(response, "docs.html", "text/html; charset=utf-8");
    }
    if (url.pathname === "/docs/openapi.json") {
      await requireUser(request);
      return sendJSON(response, 200, openapi, { "cache-control": "private, max-age=300" });
    }
    if (url.pathname === "/docs/assets/docs.css") {
      await requireUser(request);
      return sendPage(response, "docs.css", "text/css; charset=utf-8");
    }
    if (url.pathname === "/docs/assets/docs.js") {
      await requireUser(request);
      return sendPage(response, "docs.js", "application/javascript; charset=utf-8");
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (!enforceRateLimit(request, response, id, { limit: 300, windowMs: 60 * 1000, group: "api" })) return;
      const claims = await requireUser(request);
      response.setHeader("X-Authenticated-User", claims.user_id || claims.sub);
      response.setHeader("Cache-Control", "private, max-age=60");
      return await routeAPI(request, response, url);
    }

    throw new DataError(404, "not_found", "Resource does not exist.");
  } catch (error) {
    if (error instanceof AuthError && (url.pathname === "/docs" || url.pathname === "/docs/")) {
      response.writeHead(303, { Location: "/developers/login?next=%2Fdocs" });
      response.end();
      return;
    }
    if (error instanceof AuthError || error instanceof DataError) return sendError(response, error.status, error.code, error.message, id);
    console.error(JSON.stringify({ severity: "ERROR", request_id: id, path: url.pathname, message: error?.message, stack: error?.stack }));
    return sendError(response, 500, "internal_error", "The request could not be completed.", id);
  }
}

if (process.env.NODE_ENV !== "test") {
  const server = http.createServer(handler);
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(JSON.stringify({ severity: "INFO", message: "API server ready", port: PORT }));
  });
}
