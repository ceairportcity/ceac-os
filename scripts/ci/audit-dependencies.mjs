import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Temporary, explicit exception for GHSA-fc5q-39xc-vjpf (Oct 2026).
// The advisory affects picomatch <=4.0.7 without a published patched
// release. In this locked tree it is installed ONLY in development/build
// tooling. All other high/critical vulnerabilities continue to fail CI.
// This exception expires on 17 December 2026; never waive new advisories.
const EXCEPTION_END = Date.parse("2026-12-17T00:00:00Z");
const ADVISORY = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const TRANSITIVE_DEV_CHAIN = new Set([
  "picomatch", "fdir", "tinyglobby", "vite", "@vitejs/plugin-react",
]);

export function evaluateDependencyAudit(audit, dateMs = Date.now()) {
  if (!audit || typeof audit !== "object" || audit.error) {
    return { ok: false, explanation: "npm audit did not return a usable security report." };
  }
  const vulnerabilities = Object.entries(audit.vulnerabilities || {})
    .filter(([, item]) => item.severity === "high" || item.severity === "critical");
  if (!vulnerabilities.length) return { ok: true, exception: false };
  if (dateMs >= EXCEPTION_END) {
    return { ok: false, explanation: "Temporary build-only picomatch exception has expired." };
  }
  const flagged = new Set(vulnerabilities.map(([name]) => name));
  if (!flagged.has("picomatch") ||
      [...flagged].some(name => !TRANSITIVE_DEV_CHAIN.has(name))) {
    return { ok: false, explanation: "New or unrelated high-severity dependency vulnerability." };
  }
  for (const [name, item] of vulnerabilities) {
    if (item.dev !== true || item.severity === "critical") {
      return { ok: false, explanation: "A production or critical dependency vulnerability remains: " + name };
    }
    const via = Array.isArray(item.via) ? item.via : [];
    if (!via.length) return { ok: false, explanation: "Audit finding lacks a verifiable dependency chain: " + name };
    for (const source of via) {
      if (typeof source === "string") {
        if (!TRANSITIVE_DEV_CHAIN.has(source) || !flagged.has(source)) {
          return { ok: false, explanation: "Unexpected vulnerable transitive dependency: " + source };
        }
      } else if (source && typeof source === "object") {
        if (name !== "picomatch" || source.url !== ADVISORY || source.severity !== "high") {
          return { ok: false, explanation: "Unreviewed advisory in " + name };
        }
      } else return { ok: false, explanation: "Invalid npm audit advisory metadata." };
    }
  }
  // Only issue through the known picomatch source, not a blanket advisory
  // suppression for arbitrary future reports.
  if (!(audit.vulnerabilities.picomatch.via || []).some(
    source => source && typeof source === "object" && source.url === ADVISORY
  )) return { ok: false, explanation: "The specific reviewed picomatch advisory is absent." };
  return {
    ok: true, exception: true,
    explanation: "Only the known build-only picomatch advisory remains; it has no released fix. Temporary exception expires 2026-12-17.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = spawnSync("npm", ["audit", "--audit-level=high", "--json"], {
    encoding: "utf8", maxBuffer: 12 * 1024 * 1024,
  });
  if (command.error || !command.stdout?.trim() || ![0, 1].includes(command.status)) {
    console.error("Dependency audit could not run reliably.", command.error?.message || command.stderr);
    process.exitCode = 1;
  } else {
    let result;
    try { result = evaluateDependencyAudit(JSON.parse(command.stdout)); }
    catch (error) { result = { ok: false, explanation: "Invalid npm audit output: " + error.message }; }
    if (!result.ok) {
      console.error("Dependency audit blocked:", result.explanation);
      process.exitCode = 1;
    } else {
      console.log(result.exception ? "Scoped dependency exception: " + result.explanation
        : "Dependency security audit passed without exceptions.");
    }
  }
}
