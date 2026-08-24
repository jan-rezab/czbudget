import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const skip = new Set(["node_modules", ".git", "test-results", "playwright-report"]);

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (skip.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  }));
  return nested.flat();
}

function imageFor(path) {
  const local = `/${relative(root, path).replaceAll("\\", "/")}`;
  if (local === "/cesky-rozpocet.html") return "https://publicspendingdata.org/assets/og-budget.png";
  if (local === "/cesko.html" || local.includes("/state-owned-enterprises/")) return "https://publicspendingdata.org/assets/og-cesko.png";
  return "https://publicspendingdata.org/assets/og.png";
}

function setMeta(html, attribute, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escapedKey}["'][^>]*>`, "i");
  const tag = `<meta ${attribute}="${key}" content="${value}">`;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

const files = await htmlFiles(root);
let changed = 0;
for (const path of files) {
  let html = await readFile(path, "utf8");
  const before = html;
  const image = imageFor(path);
  if (html.includes("municipal-i18n.js") && !html.includes("language-bootstrap.js")) {
    html = html.replace(/<head>/i, '<head><script src="/language-bootstrap.js?v=20260824-bilingual-metadata"></script>');
  }
  html = setMeta(html, "property", "og:image", image);
  html = setMeta(html, "property", "og:image:width", "1200");
  html = setMeta(html, "property", "og:image:height", "630");
  html = setMeta(html, "property", "og:image:alt", "Public Spending Data");
  html = setMeta(html, "name", "twitter:card", "summary_large_image");
  html = setMeta(html, "name", "twitter:image", image);
  if (html !== before) {
    await writeFile(path, html);
    changed += 1;
  }
}

console.log(`Social previews checked: ${files.length}; updated: ${changed}`);
