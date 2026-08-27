import { access, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const expectedCommit = process.argv[2];
const markerPath = process.argv[3];
const refURL = "https://api.github.com/repos/jan-rezab/czbudget/git/ref/heads/main";

if (!/^[0-9a-f]{40}$/.test(expectedCommit || "")) throw new Error("Expected a full lowercase Git commit SHA.");
if (!path.isAbsolute(markerPath || "")) throw new Error("The deployment marker must use an absolute path.");

await unlink(markerPath).catch((error) => {
  if (error.code !== "ENOENT") throw error;
});

try {
  await access(path.join(process.cwd(), ".deployment-hold"));
  console.log("Production deployment is temporarily held; deploy marker will not be created.");
  process.exit(0);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const response = await fetch(refURL, {
  headers: {
    Accept: "application/vnd.github+json",
    "User-Agent": "czbudget-cloud-build",
    "X-GitHub-Api-Version": "2022-11-28",
  },
  signal: AbortSignal.timeout(15_000),
});
if (!response.ok) throw new Error(`GitHub returned ${response.status} while checking the production branch head.`);

const currentCommit = (await response.json())?.object?.sha;
if (!/^[0-9a-f]{40}$/.test(currentCommit || "")) throw new Error("GitHub did not return a valid main commit SHA.");

if (currentCommit !== expectedCommit) {
  console.log(`Stale build ${expectedCommit}; current main is ${currentCommit}. Deployment will be skipped.`);
  process.exit(0);
}

await writeFile(markerPath, `${expectedCommit}\n`, { flag: "wx", mode: 0o400 });
console.log(`Deployment authorized for current main commit ${expectedCommit}`);
