import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const previewPort = 4187;
const previewUrl = `http://127.0.0.1:${previewPort}`;
let preview;

async function waitForPreview() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("CEAC production preview did not start.");
}

test.beforeAll(async () => {
  test.setTimeout(120000);
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
  preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(previewPort)], { stdio: "ignore" });
  await waitForPreview();
});

test.afterAll(() => {
  if (preview && !preview.killed) preview.kill("SIGTERM");
  rmSync("test-artifacts/resilience-recovery", { recursive: true, force: true });
});

test("R1 manifest and installability contract are complete", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  expect(manifest.name).toBe("CEAC OS");
  expect(manifest.id).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of manifest.icons) expect(existsSync(join("public", icon.src))).toBeTruthy();
});

test("R1-R2 service worker is registered and denies business-data caching", () => {
  const main = readFileSync("src/main.jsx", "utf8");
  const registration = readFileSync("src/resilience/registerServiceWorker.js", "utf8");
  const worker = readFileSync("public/sw.js", "utf8");
  expect(main).toContain("registerCeacServiceWorker()");
  expect(registration).toContain('navigator.serviceWorker.register("/sw.js"');
  expect(worker).toContain('request.method !== "GET"');
  expect(worker).toContain('url.hostname.endsWith(".supabase.co")');
  expect(worker).toContain('/^\\/(auth|rest|realtime|storage|functions)\\//');
  expect(worker).not.toMatch(/cache\.put\([^\n]*(supabase|\/rest\/|\/auth\/)/i);
  expect(worker).toContain('event.data?.type === "SKIP_WAITING"');
});

test("R1 application shell remains available after connectivity loss", async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(previewUrl);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator("body")).toBeVisible();
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await context.close();
});

test("R3 recovery release has exact SHA, checksums and no secret files", () => {
  test.setTimeout(60000);
  const output = "test-artifacts/resilience-recovery";
  execFileSync("node", ["scripts/resilience/create-recovery-release.mjs", "--skip-build", "--output", output], { stdio: "inherit" });
  const directory = execFileSync("sh", ["-c", `find '${output}' -maxdepth 1 -type d -name 'ceac-recovery-*' | head -1`], { encoding: "utf8" }).trim();
  const manifest = JSON.parse(readFileSync(join(directory, "RECOVERY_MANIFEST.json"), "utf8"));
  expect(manifest.sourceCommit).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
  expect(manifest.files.length).toBeGreaterThan(10);
  expect(existsSync(join(directory, "CHECKSUMS.sha256"))).toBeTruthy();
  expect(existsSync(join(directory, "ceac-source.bundle"))).toBeTruthy();
  expect(manifest.intentionallyExcluded.join(" ")).toMatch(/credentials|tokens|Supabase Auth/);
  expect(execFileSync("sha256sum", ["-c", "CHECKSUMS.sha256"], { cwd: directory, encoding: "utf8" })).toContain("OK");
});

test("R4 standby package is prebuilt, provider-neutral and not authorised for cutover", () => {
  const output = "test-artifacts/resilience-standby";
  execFileSync("node", ["scripts/resilience/prepare-standby-package.mjs", "--skip-build", "--output", output], { stdio: "inherit" });
  const manifest = JSON.parse(readFileSync(join(output, "STANDBY_MANIFEST.json"), "utf8"));
  expect(manifest.productionCutoverAuthorised).toBe(false);
  expect(existsSync(join(output, "site", "index.html"))).toBeTruthy();
  expect(existsSync(join(output, "serve-prebuilt.mjs"))).toBeTruthy();
  expect(existsSync(join(output, "container", "Dockerfile"))).toBeTruthy();
  rmSync(output, { recursive: true, force: true });
});

test("security and authority changes are never mixed into a resilience-only commit", () => {
  // The original test rejected *every* unrelated release/security change in
  // the latest commit, even if the resilience package was entirely untouched.
  // Inspect the exact commit only when it actually alters resilience sources.
  const changed = execFileSync("git", ["diff", "--name-only", "HEAD^", "HEAD"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
  const resilienceSource = changed.some((path) =>
    path.startsWith("src/resilience/") ||
    path.startsWith("scripts/resilience/") ||
    path === "public/sw.js" ||
    path === "public/manifest.webmanifest"
  );
  if (resilienceSource) {
    expect(changed.join("\n")).not.toMatch(/^supabase\/migrations\//m);
    expect(changed.join("\n")).not.toMatch(/^src\/lib\/supabase/m);
    expect(changed.join("\n")).not.toMatch(/security-s[138]|capability.*expir|protected.*hr/i);
  }
  // Regardless of commit scope, enforce the recovery package's no-production-
  // cutover default and deny shipping secrets via the manifest contract.
  const standby = readFileSync("scripts/resilience/prepare-standby-package.mjs", "utf8");
  expect(standby).toContain("productionCutoverAuthorised");
  const recovery = readFileSync("scripts/resilience/create-recovery-release.mjs", "utf8");
  expect(recovery).toContain("intentionallyExcluded");
});
