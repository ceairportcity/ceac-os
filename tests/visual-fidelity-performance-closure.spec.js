import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

const KIB = 1024;

// Exact pre-VF9C production baseline from CI 37029835677 at e4d920b:
// core CSS 518.47 kB raw / 74.27 kB gzip;
// main index JS 65.18 kB raw / 18.48 kB gzip;
// largest non-vendor route chunk 91.59 kB;
// motion/react/supabase vendors 123.72 / 139.83 / 214.54 kB.
// Budgets below add small regression headroom; they are guards, not optimisation targets.
const budgets = {
  // 7 Oct 2026 Phase 5 adds the responsive People & Access and grouped Control Center
  // workspaces. The measured candidate is 531.51 KiB raw / 78.77 KiB gzip;
  // retain narrow regression headroom rather than exempting the new product CSS.
  coreCssRaw: 534 * KIB,
  coreCssGzip: 80 * KIB,
  // The owner-approved Executive route remains isolated; aggregate measured CSS is 574.99 KiB.
  allCssRaw: 578 * KIB,
  executiveRouteCssRaw: 16 * KIB,
  mainJsRaw: 72 * KIB,
  routeJsRaw: 100 * KIB,
  vendors: {
    "motion-vendor": 130 * KIB,
    "react-vendor": 145 * KIB,
    "supabase-vendor": 220 * KIB,
    "icons-vendor": 20 * KIB,
  },
};

function buildProduction() {
  const stdout = execFileSync("npm", ["run", "build"], {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return stdout;
}

function assetFiles(extension) {
  return readdirSync("dist/assets")
    .filter((name) => name.endsWith(extension))
    .map((name) => ({
      name,
      path: join("dist/assets", name),
      raw: statSync(join("dist/assets", name)).size,
    }));
}

test("VF9C production bundle preserves measured route and vendor budgets", async () => {
  test.setTimeout(120000);

  const buildOutput = buildProduction();
  expect(buildOutput).toContain("built in");

  const css = assetFiles(".css");
  const js = assetFiles(".js");

  const coreCss = css.find((asset) => /^index-.*\.css$/.test(asset.name));
  expect(coreCss, "Vite core CSS asset").toBeTruthy();
  const coreCssGzip = gzipSync(readFileSync(coreCss.path)).byteLength;
  expect(coreCss.raw, "core CSS raw regression budget").toBeLessThanOrEqual(budgets.coreCssRaw);
  expect(coreCssGzip, "core CSS gzip regression budget").toBeLessThanOrEqual(budgets.coreCssGzip);
  expect(
    css.reduce((sum, asset) => sum + asset.raw, 0),
    "aggregate CSS regression budget",
  ).toBeLessThanOrEqual(budgets.allCssRaw);

  const executiveCssSourceRaw = statSync("src/experience-v2/executive-overview/executive-overview.css").size;
  expect(
    executiveCssSourceRaw,
    "Executive Overview route CSS source budget",
  ).toBeLessThanOrEqual(budgets.executiveRouteCssRaw);

  const mainJs = js.find((asset) => /^index-.*\.js$/.test(asset.name));
  expect(mainJs, "Vite main index JS asset").toBeTruthy();
  expect(mainJs.raw, "main index JS regression budget").toBeLessThanOrEqual(budgets.mainJsRaw);

  const routeChunks = js.filter((asset) =>
    !asset.name.includes("-vendor-") &&
    !asset.name.startsWith("rolldown-runtime-") &&
    !/^index-.*\.js$/.test(asset.name)
  );
  const largestRoute = routeChunks.sort((a, b) => b.raw - a.raw)[0];
  expect(largestRoute, "route chunks remain split").toBeTruthy();
  expect(
    largestRoute.raw,
    `largest route chunk ${largestRoute.name}`,
  ).toBeLessThanOrEqual(budgets.routeJsRaw);

  for (const [prefix, limit] of Object.entries(budgets.vendors)) {
    const asset = js.find((entry) => entry.name.startsWith(`${prefix}-`));
    expect(asset, `${prefix} chunk exists`).toBeTruthy();
    expect(asset.raw, `${prefix} raw regression budget`).toBeLessThanOrEqual(limit);
  }
});

test("VF9C keeps heavy product destinations lazy and loading state announced", async () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const vite = readFileSync("vite.config.js", "utf8");

  const lazyDestinations = app.match(/lazy\(\(\) => import\(/g) || [];
  expect(lazyDestinations.length, "route-level lazy destinations").toBeGreaterThanOrEqual(45);

  expect(app).toContain("function RouteFallback()");
  expect(app).toContain('role="status"');
  expect(app).toContain('aria-live="polite"');
  expect(app).toContain('aria-busy="true"');
  expect(app).toContain("<Suspense fallback={<RouteFallback />}>");

  for (const group of ["react-vendor", "supabase-vendor", "motion-vendor", "icons-vendor"]) {
    expect(vite, `${group} split`).toContain(`name: "${group}"`);
  }
  expect(vite).toContain("maxSize: 300 * 1024");
});
