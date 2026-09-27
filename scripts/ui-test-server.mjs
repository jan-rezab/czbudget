#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { ASSET_PATH, StaticAssets } from "../server/static-assets.mjs";
import { localAssetOptions, serverAccessToken } from "./lib/static-asset-source.mjs";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 4173);
const nationalBudgetSlugs = new Set([
  "poland", "germany", "united-kingdom", "france", "united-states", "switzerland",
  "sweden", "denmark", "finland", "spain", "netherlands", "greece",
]);
// Like nginx in production: a file in the checkout wins; datasets that left the
// repository are served from the published static-asset packs (in memory only).
const assets = new StaticAssets(localAssetOptions(process.env, { tokenProvider: serverAccessToken }));
const mimeTypes = {
  ".mjs": "application/javascript; charset=utf-8",
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

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    const nationalBudget = url.pathname.match(/^\/national-budgets\/([^/]+)\/?$/);
    const pathname = nationalBudget && nationalBudgetSlugs.has(nationalBudget[1]) ? "/national-budget.html" : url.pathname;
    const relative = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "");
    let filePath = join(root, relative || "index.html");
    if (!filePath.startsWith(root)) throw new Error("Invalid path");

    let details = await fileStat(filePath);
    if (details?.isDirectory()) {
      filePath = join(filePath, "index.html");
      details = await fileStat(filePath);
    }
    if (!details?.isFile() && ASSET_PATH.test(`/${relative.split("\\").join("/")}`)) {
      try {
        await assets.serve(request, response, url.pathname);
      } catch (error) {
        if (!response.headersSent) {
          response.writeHead(error.status || 502, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ error: { code: error.code || "asset_unavailable" } }));
        } else response.destroy(error);
      }
      return;
    }
    if (!details?.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Length": details.size,
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Server error");
  }
}).listen(port, "127.0.0.1");

async function fileStat(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}
