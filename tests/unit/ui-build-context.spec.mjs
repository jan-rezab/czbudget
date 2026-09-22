import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyTrackedContext } from "../../scripts/lib/copy-tracked-context.mjs";

test("UI packaging restores only tracked inputs omitted by a sparse checkout", async () => {
  const root = mkdtempSync(join(tmpdir(), "psd-ui-sparse-"));
  // The pre-push hook exports GIT_DIR for the real checkout. Isolate this fixture.
  const gitVariables = Object.entries(process.env).filter(([name]) => name.startsWith("GIT_"));
  for (const [name] of gitVariables) delete process.env[name];
  try {
    execFileSync("git", ["init", "-q", root]);
    mkdirSync(join(root, "assets"));
    mkdirSync(join(root, "data"));
    writeFileSync(join(root, "Dockerfile"), "FROM node:24\n");
    writeFileSync(join(root, "assets", "chart.js"), "export const value = 1;\n");
    writeFileSync(join(root, "data", "country.json"), '{"country":"DEU"}\n');
    writeFileSync(join(root, "assets", "ignored.js"), "should not be packaged\n");
    execFileSync("git", ["-C", root, "add", "Dockerfile", "assets/chart.js", "data/country.json"]);
    execFileSync("git", ["-C", root, "-c", "user.name=Contract Test", "-c", "user.email=contract@example.com", "commit", "-qm", "fixture"]);
    rmSync(join(root, "Dockerfile"));
    rmSync(join(root, "assets", "chart.js"));
    rmSync(join(root, "data", "country.json"));
    const destination = join(root, "bundle");
    assert.equal(await copyTrackedContext({
      root, destination, files: ["Dockerfile", "data/country.json"], directories: ["assets"],
    }), 3);
    assert.equal(readFileSync(join(destination, "Dockerfile"), "utf8"), "FROM node:24\n");
    assert.equal(readFileSync(join(destination, "assets", "chart.js"), "utf8"), "export const value = 1;\n");
    assert.equal(readFileSync(join(destination, "data", "country.json"), "utf8"), '{"country":"DEU"}\n');
    assert.throws(() => readFileSync(join(destination, "assets", "ignored.js")), { code: "ENOENT" });
    await assert.rejects(copyTrackedContext({
      root, destination: join(root, "invalid"), files: ["data/not-tracked.json"], directories: [],
    }), /not tracked/);
  } finally {
    for (const [name, value] of gitVariables) process.env[name] = value;
    rmSync(root, { recursive: true, force: true });
  }
});
