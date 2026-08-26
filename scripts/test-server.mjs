import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 4173);
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
    const countryMatch = pathname.match(/^\/countries\/([^/]+)(\/?)$/);

    if (countryMatch && countrySlugs.has(countryMatch[1])) {
      if (countryMatch[2]) {
        redirect(response, `/countries/${countryMatch[1]}${url.search}`);
        return;
      }
      pathname = "/country.html";
    } else if (pathname === "/country.html") {
      const slug = countryCodes[(url.searchParams.get("code") || "CZE").toUpperCase()] || countryCodes.CZE;
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
