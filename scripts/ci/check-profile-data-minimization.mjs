import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const extensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const sensitiveFields = ["phone", "birthday", "contract_type"];

// Self-only profile reads may include the person's own personal details.
const selfOnlyDirectAllow = new Map([
  ["src/lib/supabase.js", new Set(["phone", "birthday", "contract_type"])],
  ["src/screens/Me.jsx", new Set(["phone", "birthday", "contract_type"])],
]);

// These are known legacy ordinary-user birthday surfaces. They remain visible
// only so the security gate can freeze today's exposure without breaking the
// active product. The future directory/profile projection work should remove
// these exceptions rather than adding to them.
const legacyEmbeddedAllow = new Map([
  ["src/screens/Home.jsx", new Set(["birthday"])],
  ["src/screens/StaffTeam.jsx", new Set(["birthday"])],
]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && extensions.has(extname(entry.name))) files.push(full);
  }
  return files;
}

function hasField(spec, field) {
  return new RegExp(`\\b${field}\\b`).test(spec);
}

const findings = [];

for (const fullPath of walk(sourceRoot)) {
  const path = relative(root, fullPath).replaceAll("\\", "/");
  const source = readFileSync(fullPath, "utf8");
  const selectPattern = /\.select\(\s*([\x22\x27\x60])([\s\S]*?)\1\s*\)/g;

  for (const match of source.matchAll(selectPattern)) {
    const spec = match[2];
    const before = source.slice(Math.max(0, match.index - 220), match.index);
    const directProfiles = /\.from\(\s*[\x22\x27]profiles[\x22\x27]\s*\)\s*$/.test(before);

    if (directProfiles) {
      if (spec.trim() === "*") {
        findings.push(`${path}: direct profiles(*) is not permitted`);
      }

      for (const field of sensitiveFields) {
        if (!hasField(spec, field)) continue;
        const allowed = selfOnlyDirectAllow.get(path)?.has(field) ?? false;
        if (!allowed) {
          findings.push(`${path}: direct profiles SELECT exposes ${field} outside a self-only surface`);
        }
      }
    }

    const embeddedProfiles = /profiles(?:![^(,\s]+)?\(([^)]*)\)/g;
    for (const embedded of spec.matchAll(embeddedProfiles)) {
      const fields = embedded[1];
      if (fields.trim() === "*" || /(^|,)\s*\*\s*(,|$)/.test(fields)) {
        findings.push(`${path}: embedded profiles(*) is not permitted`);
      }

      for (const field of sensitiveFields) {
        if (!hasField(fields, field)) continue;
        const allowed = legacyEmbeddedAllow.get(path)?.has(field) ?? false;
        if (!allowed) {
          findings.push(`${path}: embedded profiles relation exposes ${field} outside the reviewed exceptions`);
        }
      }
    }
  }
}

if (findings.length) {
  console.error("Profile data minimisation gate failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Profile data minimisation gate passed: no new cross-profile phone/birthday/contract-type exposure.");
