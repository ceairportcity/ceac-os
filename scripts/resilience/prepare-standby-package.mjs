import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { assertNoSecretFiles, checksumInventory, copyPath, writeJson } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const valueAfter = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const root = process.cwd();
const output = resolve(valueAfter("--output", join(root, "standby-output")));
if (!args.has("--skip-build")) execFileSync("npm", ["run", "build"], { stdio: "inherit" });
if (!existsSync(join(root, "dist", "index.html"))) throw new Error("Production dist is missing.");

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
copyPath(join(root, "dist"), join(output, "site"));
copyPath(join(root, "scripts/resilience/serve-prebuilt.mjs"), join(output, "serve-prebuilt.mjs"));
copyPath(join(root, "deploy/standby"), join(output, "container"));
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
writeJson(join(output, "STANDBY_MANIFEST.json"), {
  schema: "ceac-standby-package/v1",
  sourceCommit: sha,
  entrypoint: "site/index.html",
  requirements: ["HTTPS", "SPA fallback to /index.html", "no-cache serving for /sw.js", "runtime Supabase public URL and publishable key supplied outside this package"],
  productionCutoverAuthorised: false,
});
const inventory = checksumInventory(output, new Set(["CHECKSUMS.sha256"]));
writeFileSync(join(output, "CHECKSUMS.sha256"), inventory.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n") + "\n", "utf8");
assertNoSecretFiles(output);
console.log(JSON.stringify({ output, sourceCommit: sha }, null, 2));
