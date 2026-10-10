import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import process from "node:process";
import { assertNoSecretFiles, checksumInventory, copyPath, writeJson } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const valueAfter = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const skipBuild = args.has("--skip-build");
const root = process.cwd();
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const shortSha = sha.slice(0, 12);
const commitTime = execFileSync("git", ["show", "-s", "--format=%cI", sha], { encoding: "utf8" }).trim();
const outputRoot = resolve(valueAfter("--output", join(root, "recovery-output")));
const releaseRoot = join(outputRoot, `ceac-recovery-${shortSha}`);

if (!skipBuild) execFileSync("npm", ["run", "build"], { stdio: "inherit", env: process.env });
if (!existsSync(join(root, "dist", "index.html"))) throw new Error("Production dist is missing. Run npm run build first.");

rmSync(releaseRoot, { recursive: true, force: true });
mkdirSync(releaseRoot, { recursive: true });

for (const path of ["dist", "package.json", "package-lock.json", "vercel.json", "public/manifest.webmanifest", "supabase/migrations", "supabase/replay", "scripts/resilience", "deploy/standby", "docs/resilience"]) {
  copyPath(join(root, path), join(releaseRoot, path));
}

execFileSync("git", ["bundle", "create", join(releaseRoot, "ceac-source.bundle"), "HEAD"], { cwd: root, stdio: "inherit" });

const manifestPath = join(releaseRoot, "RECOVERY_MANIFEST.json");
const inventory = checksumInventory(releaseRoot, new Set(["RECOVERY_MANIFEST.json", "CHECKSUMS.sha256"]));
const manifest = {
  schema: "ceac-recovery-release/v1",
  product: "CEAC OS",
  sourceCommit: sha,
  sourceCommitTime: commitTime,
  applicationVersion: JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version,
  buildRuntime: { node: process.version, platform: process.platform, architecture: process.arch },
  restores: ["accepted frontend build", "source history reachable from the accepted commit", "tracked Supabase migrations and replay material", "frontend serving configuration and recovery runbooks"],
  intentionallyExcluded: ["credentials and passwords", "environment-variable values", "private keys and tokens", "live Supabase database rows", "Supabase Auth users/sessions", "private Storage objects", "DNS and provider account ownership"],
  files: inventory,
};
writeJson(manifestPath, manifest);
const finalInventory = checksumInventory(releaseRoot, new Set(["CHECKSUMS.sha256"]));
writeFileSync(join(releaseRoot, "CHECKSUMS.sha256"), finalInventory.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n") + "\n", "utf8");
assertNoSecretFiles(releaseRoot);

const epoch = Math.floor(new Date(commitTime).getTime() / 1000);
const archive = `${releaseRoot}.tar.gz`;
execFileSync("tar", ["--sort=name", `--mtime=@${epoch}`, "--owner=0", "--group=0", "--numeric-owner", "-czf", archive, "-C", outputRoot, basename(releaseRoot)], { stdio: "inherit" });
console.log(JSON.stringify({ releaseRoot, archive, sourceCommit: sha }, null, 2));
