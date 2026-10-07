import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export function ensureDirectory(path) { mkdirSync(path, { recursive: true }); }

export function copyPath(source, destination) {
  if (!existsSync(source)) return false;
  ensureDirectory(dirname(destination));
  cpSync(source, destination, { recursive: true, force: true });
  return true;
}

export function filesUnder(root) {
  if (!existsSync(root)) return [];
  const output = [];
  function visit(path) {
    for (const name of readdirSync(path).sort()) {
      const child = join(path, name);
      if (statSync(child).isDirectory()) visit(child);
      else output.push(child);
    }
  }
  visit(root);
  return output;
}

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function checksumInventory(root, excluded = new Set()) {
  return filesUnder(root)
    .map((path) => relative(root, path).replaceAll("\\", "/"))
    .filter((path) => !excluded.has(path))
    .map((path) => ({ path, sha256: sha256(join(root, path)), bytes: statSync(join(root, path)).size }));
}

export function writeJson(path, value) {
  ensureDirectory(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function assertNoSecretFiles(root) {
  const unsafeNames = /(^|\/)(\.env($|\.)|.*\.(pem|p12|pfx|key)|id_rsa|id_ed25519)$/i;
  const unsafeContent = /(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|SUPABASE_SERVICE_ROLE_KEY\s*=|VERCEL_TOKEN\s*=)/;
  for (const path of filesUnder(root)) {
    const name = relative(root, path).replaceAll("\\", "/");
    if (unsafeNames.test(name)) throw new Error(`Unsafe secret-bearing file in recovery output: ${name}`);
    if (statSync(path).size <= 2_000_000) {
      const content = readFileSync(path, "utf8");
      if (unsafeContent.test(content)) throw new Error(`Possible secret value in recovery output: ${name}`);
    }
  }
}
