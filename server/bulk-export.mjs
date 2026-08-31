/**
 * Bulk export — A3b.
 *
 * "Open the API" is only half of open: a reader who wants the whole series should not have
 * to paginate an endpoint to reconstruct a file that already exists. USAspending offers bulk
 * download and a data dictionary; this is the equivalent.
 *
 * CSV is generated on request from the same artifacts the API already serves rather than
 * written into the repository. The alternative — committing one CSV per dataset — would add
 * a second copy of every published figure, which is exactly the duplication this programme
 * spent its time removing.
 *
 * Each export carries its own provenance: the source artifact, its schema version, the
 * vintage it was generated at, and a sha256 of the bytes served, so a downloaded file can be
 * proved to be the one a given release published.
 */
import { createHash } from "node:crypto";

/** The delimiter and quoting rules of RFC 4180, with a BOM so Excel reads UTF-8. */
const BOM = "﻿";

function cell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return quote(JSON.stringify(value));
  const text = String(value);
  return /[",\r\n]/.test(text) ? quote(text) : text;
}

const quote = (text) => `"${text.replace(/"/g, '""')}"`;

/**
 * Blocks that describe the dataset rather than being it. Without this the largest-array rule
 * picks `sources` for artifacts whose real table is keyed by country: country-revenue would
 * have exported three source URLs under the name "revenue".
 */
const METADATA_KEYS = new Set([
  "sources", "definitions", "scope", "contract", "methodology", "notes", "period",
  "coverage", "slice", "metrics", "columns", "known_gaps",
]);

/**
 * Find the rows in a dataset. Published artifacts share no shape: some hold an array of
 * `countries`, some an array of `entities`, and some a map keyed by country code. Both forms
 * are considered and the larger table wins; a map contributes its key as the first column,
 * because that key is the row's identity and dropping it would make the export unjoinable.
 */
export function findRows(payload) {
  if (Array.isArray(payload)) return { key: null, rows: payload };
  let best = { key: null, rows: [] };

  for (const [key, value] of Object.entries(payload || {})) {
    if (METADATA_KEYS.has(key)) continue;

    if (Array.isArray(value)) {
      if (value.length <= best.rows.length) continue;
      if (!value.every((item) => item && typeof item === "object" && !Array.isArray(item))) continue;
      best = { key, rows: value };
      continue;
    }

    if (value && typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length <= best.rows.length) continue;
      if (!entries.every(([, item]) => item && typeof item === "object" && !Array.isArray(item))) continue;
      best = { key, rows: entries.map(([id, item]) => ({ id, ...item })) };
    }
  }
  return best;
}

/** Column order is the union of every row's keys, in first-seen order — not row one's keys. */
export function columnsOf(rows) {
  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push(key);
    }
  }
  return columns;
}

export function toCSV(rows) {
  const columns = columnsOf(rows);
  const lines = [columns.map(cell).join(",")];
  for (const row of rows) lines.push(columns.map((column) => cell(row[column])).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

export function exportDataset(payload) {
  const { key, rows } = findRows(payload);
  const body = toCSV(rows);
  return {
    body,
    rows: rows.length,
    columns: columnsOf(rows).length,
    table: key,
    sha256: createHash("sha256").update(body).digest("hex"),
    // The publication vintage of the source, not the moment this CSV was rendered: two
    // downloads of the same release must describe themselves identically.
    vintage: payload?.generated_at || null,
    schema_version: payload?.schema_version || null,
    dataset_id: payload?.dataset_id || null,
  };
}
