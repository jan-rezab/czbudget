import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 4173);
// Exercise the same immutable snapshots and renderer as production. A caller may
// reuse a prepared release; otherwise build one from the local serving inputs.
let temporaryRelease;
if (!process.env.PUBLIC_SNAPSHOT_RELEASE_ROOT) {
  temporaryRelease = await mkdtemp(join(tmpdir(), "czbudget-browser-release-"));
  execFileSync(process.execPath, ["scripts/prepare-public-serving-snapshots.mjs", "--output", temporaryRelease, "--release-id", "browser-test"], { cwd: root, stdio: "inherit" });
  process.env.PUBLIC_SNAPSHOT_RELEASE_ROOT = temporaryRelease;
}
process.env.NODE_ENV = "test";
process.env.SITE_ROOT = root;
const { handler } = await import("../server/index.mjs");
const lineFixtures = JSON.parse(await readFile(join(root, "tests/fixtures/municipal-lines/manifest.json"), "utf8"));
const cleanup = async () => {
  if (temporaryRelease) await rm(temporaryRelease, { recursive: true, force: true });
  process.exit(0);
};
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
const countrySlugs = new Set([
  "czechia", "germany", "denmark", "france", "united-kingdom",
  "poland", "sweden", "switzerland", "ukraine", "united-states",
  "brazil", "spain", "japan", "netherlands", "norway", "finland", "greece",
]);
const countryCodes = {
  CZE: "czechia", DEU: "germany", DNK: "denmark", FRA: "france",
  GBR: "united-kingdom", POL: "poland", SWE: "sweden", CHE: "switzerland",
  UKR: "ukraine", USA: "united-states",
  BRA: "brazil", ESP: "spain", JPN: "japan", NLD: "netherlands", NOR: "norway", FIN: "finland", GRC: "greece",
};
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

const redirect = (response, location) => {
  response.writeHead(301, { Location: location });
  response.end();
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    // BigQuery has its own API contract tests. Browser tests replay recorded
    // public responses so they neither need cloud credentials nor spend quota.
    if (pathname === "/public-data/municipality-lines") {
      const fixture = lineFixtures.responses.find((item) => item.country === url.searchParams.get("country") && item.code === url.searchParams.get("code"));
      if (!fixture) {
        response.writeHead(503, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: { code: "missing_browser_fixture", message: "Record this municipality response before testing its detail." } }));
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(gunzipSync(await readFile(join(root, "tests/fixtures/municipal-lines", fixture.file))));
      return;
    }
    const queryProfile = /^\/municipalities\/(?:france|germany)\/profile\/$/.test(pathname);
    if ((!queryProfile && /^\/(?:municipalities\/[^/]+\/[^/]+|cz\/municipalities\/[^/]+)\/?$/.test(pathname))
      || /^\/(?:public-data|api|auth|docs|developers)(?:\/|$)/.test(pathname)
      || /^\/(?:data\/)?municipal-expansion\/[a-z]{3}\/[^/]+\.json$/.test(pathname)
      || /^\/data\/entities\/\d{8}\.json$/.test(pathname)
      || pathname === "/healthz") {
      await handler(request, response);
      return;
    }
    const countryMatch = pathname.match(/^\/countries\/([^/]+)(\/?)$/);

    if (countryMatch && (countrySlugs.has(countryMatch[1]) || /^[a-z]{3}$/.test(countryMatch[1]))) {
      if (countryMatch[2]) {
        redirect(response, `/countries/${countryMatch[1]}${url.search}`);
        return;
      }
      pathname = "/country.html";
    } else if (pathname === "/country.html") {
      const requestedCode = (url.searchParams.get("code") || "CZE").toUpperCase();
      const slug = countryCodes[requestedCode] || (/^[A-Z]{3}$/.test(requestedCode) ? requestedCode.toLowerCase() : countryCodes.CZE);
      const lang = url.searchParams.get("lang");
      redirect(response, `/countries/${slug}${lang === "cs" || lang === "en" ? `?lang=${lang}` : ""}`);
      return;
    } else if (pathname === "/cz-obce.html" || pathname === "/cz/obce") {
      redirect(response, `/cz/municipalities/${url.search}`);
      return;
    } else if (pathname.startsWith("/cz/obce/")) {
      redirect(response, `/cz/municipalities/${pathname.slice("/cz/obce/".length)}${url.search}`);
      return;
    }

    const relative = normalize(pathname).replace(/^[/\\]+/, "");
    let filePath = join(root, relative || "index.html");
    if (!filePath.startsWith(root)) throw new Error("Invalid path");

    let details;
    try {
      details = await stat(filePath);
    } catch {
      details = null;
    }
    if (details?.isDirectory()) {
      filePath = join(filePath, "index.html");
      try {
        details = await stat(filePath);
      } catch {
        details = null;
      }
    }
    if (!details?.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Length": details.size,
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Server error");
  }
}).listen(port, "127.0.0.1");
