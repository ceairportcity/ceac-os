import fs from "node:fs";
import path from "node:path";

const roots = [".github/workflows", ".github/actions"];
const yamlFiles = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.ya?ml$/i.test(entry.name)) yamlFiles.push(full);
  }
}

for (const root of roots) walk(root);

const failures = [];
for (const file of yamlFiles) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  if (file.startsWith(".github/workflows/")) {
    if (/^\s*pull_request_target\s*:/m.test(text)) {
      failures.push(`${file}: pull_request_target is prohibited without an explicit security-contract change.`);
    }
    if (/^permissions:\s*write-all\s*$/m.test(text)) {
      failures.push(`${file}: permissions: write-all is prohibited.`);
    }
    if (!/^permissions:\s*\n(?:[ \t]+[^\n]+\n)*?[ \t]+contents:\s*read\s*$/m.test(text)) {
      failures.push(`${file}: declare top-level permissions with contents: read.`);
    }
    const permissionBlock = text.match(/^permissions:\s*\n((?:[ \t]+[^\n]+\n?)*)/m)?.[1] || "";
    for (const line of permissionBlock.split(/\r?\n/)) {
      if (/\bwrite\b/i.test(line)) {
        failures.push(`${file}: top-level write permission requires an explicit reviewed exception.`);
      }
    }
  }

  let checkoutCount = 0;
  let noPersistCount = 0;
  for (const line of lines) {
    const uses = line.match(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/);
    if (uses) {
      const target = uses[1];
      if (target.startsWith("./")) continue;
      if (target.startsWith("docker://")) {
        if (!/@sha256:[0-9a-f]{64}$/i.test(target)) {
          failures.push(`${file}: Docker action must use an immutable sha256 digest: ${target}`);
        }
        continue;
      }
      const ref = target.match(/^([^@]+)@([0-9a-f]{40})$/i);
      if (!ref) {
        failures.push(`${file}: external action must be pinned to a full 40-character commit SHA: ${target}`);
      }
      if (target.startsWith("actions/checkout@")) checkoutCount++;
    }
    if (/^\s*persist-credentials:\s*false\s*$/i.test(line)) noPersistCount++;
  }
  if (checkoutCount > noPersistCount) {
    failures.push(`${file}: every actions/checkout step must set persist-credentials: false.`);
  }
}

if (failures.length) {
  console.error("GitHub Actions supply-chain policy failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`GitHub Actions supply-chain policy passed for ${yamlFiles.length} YAML files.`);
