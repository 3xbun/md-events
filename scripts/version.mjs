// Version stamp = git commit, not a counter.
// Writes src/version.js (untracked) as YY-<7-char commit> before dev/build.
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let sha = process.env.CF_PAGES_COMMIT_SHA || "";
if (!sha) {
  try {
    sha = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
  } catch {
    sha = "nogit"; // no commits yet (fresh repo)
  }
}
const yy = new Date().toISOString().slice(2, 4);
const stamp = `${yy}-${sha.slice(0, 7)}`;
writeFileSync(join(root, "src/version.js"), `export const APP_VERSION = "${stamp}";\n`);
console.log(`[version] ${stamp}`);
