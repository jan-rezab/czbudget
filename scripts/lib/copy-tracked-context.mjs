import { execFileSync } from "node:child_process";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function copyTrackedContext({ root, destination, files, directories, revision = "HEAD" }) {
  const explicit = new Set(files);
  const paths = execFileSync("git", ["ls-files", "-z", "--", ...explicit, ...directories], { cwd: root })
    .toString().split("\0").filter(Boolean);
  const tracked = new Set(paths);
  for (const path of explicit) {
    if (!tracked.has(path)) throw new Error(`UI context input is not tracked: ${path}`);
  }

  for (const path of tracked) {
    const target = join(destination, path);
    await mkdir(dirname(target), { recursive: true });
    try {
      await cp(join(root, path), target);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      // A clean sparse checkout can omit a tracked input. Read the exact Git
      // blob instead of submitting a partial UI context or downloading data.
      await writeFile(target, execFileSync("git", ["show", `${revision}:${path}`], { cwd: root }));
    }
  }
  return tracked.size;
}
