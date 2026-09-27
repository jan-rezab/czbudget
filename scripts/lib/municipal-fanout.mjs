// Where the per-entity municipal fan-out lives now that Git no longer tracks it.
//
// data/municipal-history/<ico>.json and data/municipal-benchmarks/<cc>/<id>.json are pinned
// in pipeline/config/municipal-serving-inputs.v1.json to immutable raw copies and restored by
// scripts/hydrate-municipal-fanout.py. A reader asks for an input by name and gets the
// directory holding it, in this order:
//   1. the explicit env root (MUNICIPAL_HISTORY_ROOT / MUNICIPAL_BENCHMARK_ROOT), which must hold it;
//   2. the checkout directory, when it still carries the fan-out (commits before the move);
//   3. .municipal-fanout/<directory>, the hydrator's default destination.
// null means none holds it. Each caller decides whether that is fatal; a builder that would
// otherwise publish a smaller dataset must treat it as fatal.
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const INPUTS = {
  "municipal-history": {
    directory: "data/municipal-history",
    env: "MUNICIPAL_HISTORY_ROOT",
    holds: (root) => readdirSync(root).some((name) => /^\d{8}\.json$/.test(name)),
  },
  "municipal-benchmarks": {
    directory: "data/municipal-benchmarks",
    env: "MUNICIPAL_BENCHMARK_ROOT",
    holds: (root) => readdirSync(root, { withFileTypes: true }).some((entry) => entry.isDirectory()),
  },
};

export const FANOUT_HINT = "run `python3 scripts/hydrate-municipal-fanout.py --from git` (local, no network) or `--from gcs` (data plane)";

export function fanoutRoot(name, root = process.cwd(), env = process.env) {
  const input = INPUTS[name];
  if (!input) throw new Error(`Unknown municipal fan-out input ${name}`);
  const isDirectory = (candidate) => existsSync(candidate) && statSync(candidate).isDirectory();
  if (env[input.env]) {
    const explicit = path.resolve(root, env[input.env]);
    if (!isDirectory(explicit) || !input.holds(explicit)) throw new Error(`${input.env}=${env[input.env]} does not hold the ${name} fan-out`);
    return explicit;
  }
  for (const candidate of [path.join(root, input.directory), path.join(root, ".municipal-fanout", input.directory)]) {
    if (isDirectory(candidate) && input.holds(candidate)) return candidate;
  }
  return null;
}

export function requireFanoutRoot(name, root = process.cwd(), env = process.env) {
  const found = fanoutRoot(name, root, env);
  if (!found) throw new Error(`The ${name} fan-out is not in this checkout (it is no longer tracked in Git); ${FANOUT_HINT}, or set ${INPUTS[name].env}.`);
  return found;
}
