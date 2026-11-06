import {lightAppearanceCss} from "./helpers/lightAppearanceCss.mjs";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const legacyCeilings = Object.freeze({
  "src/premium-admin.css": 83,
  "src/premium-executive.css": 2,
  "src/premium-manager.css": 68,
  "src/premium-parity.css": 228,
  "src/premium-staff.css": 63,
  "src/premium.css": 50,
  "src/styles.css": 121,
});

function countImportant(source) {
  return (source.match(/!important\b/g) || []).length;
}

function walk(dir, predicate) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full, predicate));
    else if (predicate(full)) results.push(full);
  }
  return results;
}

test("Stage 15A prevents legacy important debt from increasing", () => {
  let total = 0;
  for (const [file, ceiling] of Object.entries(legacyCeilings)) {
    const source = fs.readFileSync(file, "utf8");
    const count = countImportant(source);
    total += count;
    expect(count, file).toBeLessThanOrEqual(ceiling);
  }
  expect(total, "legacy !important total").toBeLessThanOrEqual(615);
});

test("Stage 15A keeps Experience V2 free of hidden role override debt", () => {
  const cssFiles = walk("src/experience-v2", (file) => file.endsWith(".css"));
  expect(cssFiles.length).toBeGreaterThan(0);

  for (const file of cssFiles) {
    const source = fs.readFileSync(file, "utf8");
    expect(countImportant(source), file).toBe(0);
    expect(source, file).not.toMatch(/\.(staff-app|manager-app|office-app|executive-app)\b/);
  }
});

test("Stage 15A preserves one V2 icon registry boundary", () => {
  const files = walk("src/experience-v2", (file) => /\.(js|jsx)$/.test(file));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    if (file.endsWith(path.join("experience-v2", "icons.jsx"))) {
      expect(source).toContain('from "lucide-react"');
      continue;
    }
    expect(source, file).not.toContain('from "lucide-react"');
    expect(source, file).not.toContain("components/primitives/Icon");
    expect(source, file).not.toContain("components/bits");
  }
});

test("Stage 15A keeps V2 loaded after the legacy compatibility stack", () => {
  const main = fs.readFileSync("src/main.jsx", "utf8");
  const parity = main.indexOf('import "./premium-parity.css";');
  const foundation = main.indexOf('import "./experience-v2.css";');
  const shell = main.indexOf('import "./experience-v2/shell/shell.css";');

  expect(parity).toBeGreaterThan(-1);
  expect(foundation).toBeGreaterThan(parity);
  expect(shell).toBeGreaterThan(foundation);
});

test("Stage 15A retains the accepted focus, touch and reduced-motion contracts", () => {
  const interactions = fs.readFileSync("tests/experience-v2-interactions.spec.js", "utf8");
  const shell = fs.readFileSync("tests/experience-v2-shell-responsive.spec.js", "utf8");
  const motion = fs.readFileSync("tests/experience-v2-motion.spec.js", "utf8");
  const provider = fs.readFileSync("src/experience-v2/ExperienceV2MotionProvider.jsx", "utf8");

  expect(interactions).toContain('page.keyboard.press("Escape")');
  expect(interactions).toContain("restore keyboard context");
  expect(shell).toContain("mobile touch target");
  expect(shell).toContain('page.keyboard.press("Control+K")');
  expect(motion).toContain("reduced");
  expect(provider).toContain('reducedMotion="user"');
});


test("Stage 15B keeps superseded overview override layers retired", () => {
  const retired = [
    ["src/premium-staff.css", ".staff-command-surface"],
    ["src/premium-manager.css", ".manager-command-surface"],
    ["src/premium-admin.css", ".admin-command-surface"],
    ["src/premium-executive.css", ".executive-command-surface"],
  ];
  for (const [file, selector] of retired) {
    expect(fs.readFileSync(file, "utf8"), file).not.toContain(selector);
  }

  const parity = fs.readFileSync("src/premium-parity.css", "utf8");
  for (const selector of [
    ".staff-command-surface",
    ".manager-command-surface",
    ".admin-command-surface",
    ".executive-command-surface",
    ".staff-home-dashboard",
    ".home-dashboard",
    ".admin-home-grid",
    ".admin-pulse-grid",
    ".admin-home-section",
    ".executive-intelligence-grid",
    ".executive-change-card",
    ".home-panel-priority",
    ".home-panel-projects",
    ".home-panel-waiting",
    ".home-panel-coming",
    ".home-panel-movement",
    ".home-panel-pulse",
    ".home-panel-week",
  ]) {
    expect(parity, "src/premium-parity.css").not.toContain(selector);
  }

  expect(fs.readFileSync("src/premium-staff.css", "utf8"), "src/premium-staff.css")
    .not.toContain(".staff-home-dashboard");
});

test("Stage 15C retires the unused bits shell icon implementation", () => {
  const bits = fs.readFileSync("src/components/bits.jsx", "utf8");
  for (const deadExport of ["Icon", "MobileTopBar", "AppTopBar", "SideNav", "Tabs"]) {
    expect(bits, "src/components/bits.jsx").not.toContain(`export function ${deadExport}`);
  }
  expect(bits, "src/components/bits.jsx").not.toContain("function tabItems(");
  expect(bits, "src/components/bits.jsx").not.toContain("function desktopGroups(");
  expect(bits, "src/components/bits.jsx").not.toContain("function MobileMenuGroup(");
});

test("Stage 15C removes visual components proven unused by the production import graph", () => {
  expect(fs.existsSync("src/components/PremiumShell.jsx")).toBe(false);
  expect(fs.existsSync("src/components/ReferenceDashboard.jsx")).toBe(false);
});

test("Stage 15C keeps the remaining primitive icon compatibility boundary explicit", () => {
  const app = fs.readFileSync("src/App.jsx", "utf8");
  const gallery = fs.readFileSync("src/screens/DesignPrimitives.jsx", "utf8");
  const primitiveIcon = fs.readFileSync("src/components/primitives/Icon.jsx", "utf8");

  expect(app).toContain('tab === "primitives" && isAdmin');
  expect(gallery).toContain("../components/primitives");
  expect(gallery).toContain("Icon");
  expect(primitiveIcon).toContain("export default function Icon");

  for (const file of [
    "src/components/primitives/Stat.jsx",
    "src/components/primitives/QueueRow.jsx",
    "src/components/primitives/Chart.jsx",
    "src/components/primitives/EmptyState.jsx",
  ]) {
    expect(fs.readFileSync(file, "utf8"), file).toContain('import Icon from "./Icon"');
  }
});


test("Stage 15D keeps production chunking explicit and bounded", () => {
  const config = fs.readFileSync("vite.config.js", "utf8");
  expect(config).toContain("rolldownOptions");
  expect(config).toContain("codeSplitting");
  for (const group of ["react-vendor", "supabase-vendor", "motion-vendor", "icons-vendor", "vendor"]) {
    expect(config, `missing chunk group ${group}`).toContain(`name: "${group}"`);
  }
  expect(config).toContain("maxSize: 300 * 1024");
});


function stage15HexToRgb(hex) {
  const value = String(hex).replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function stage15RelativeLuminance(hex) {
  const [r, g, b] = stage15HexToRgb(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function stage15ContrastRatio(foreground, background) {
  const left = stage15RelativeLuminance(foreground);
  const right = stage15RelativeLuminance(background);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function stage15CssHex(source, token) {
  const match = source.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
  expect(match, `missing ${token}`).not.toBeNull();
  return match[1];
}

test("Stage 15D keeps V2 normal-text semantic colors at AA contrast", () => {
  const css = lightAppearanceCss(fs.readFileSync("src/experience-v2.css", "utf8"));
  const surfaces = [
    stage15CssHex(css, "--ev2-surface"),
    stage15CssHex(css, "--ev2-surface-soft"),
    stage15CssHex(css, "--ev2-surface-muted"),
  ];
  for (const foregroundToken of ["--ev2-text", "--ev2-text-secondary", "--ev2-text-tertiary"]) {
    const foreground = stage15CssHex(css, foregroundToken);
    for (const background of surfaces) {
      expect(stage15ContrastRatio(foreground, background), `${foregroundToken} on ${background}`)
        .toBeGreaterThanOrEqual(4.5);
    }
  }

  for (const [foregroundToken, backgroundToken] of [
    ["--ev2-success", "--ev2-success-soft"],
    ["--ev2-warning", "--ev2-warning-soft"],
    ["--ev2-danger", "--ev2-danger-soft"],
  ]) {
    expect(
      stage15ContrastRatio(stage15CssHex(css, foregroundToken), stage15CssHex(css, backgroundToken)),
      `${foregroundToken} on ${backgroundToken}`
    ).toBeGreaterThanOrEqual(4.5);
  }

  for (const foregroundToken of ["--ev2-action", "--ev2-identity-strong", "--ev2-violet"]) {
    expect(stage15ContrastRatio(stage15CssHex(css, foregroundToken), "#ffffff"), `${foregroundToken} on white`)
      .toBeGreaterThanOrEqual(4.5);
  }
});

test("Stage 15D keeps V2 image geometry reserved before media decode", () => {
  const brand = fs.readFileSync("src/experience-v2/components/BrandMark.jsx", "utf8");
  const avatar = fs.readFileSync("src/experience-v2/components/Avatar.jsx", "utf8");
  const components = fs.readFileSync("src/experience-v2/components/components.css", "utf8");

  expect(brand).toContain("width={pixels}");
  expect(brand).toContain("height={pixels}");
  expect(brand).toContain('decoding="async"');
  expect(avatar).toContain("ev2c-avatar");
  expect(components).toContain(".ev2c-avatar img");
  expect(components).toContain("object-fit: cover");
  expect(components).toContain(".ev2c-avatar-sm");
  expect(components).toContain(".ev2c-avatar-md");
  expect(components).toContain(".ev2c-avatar-lg");
});


test("Stage 15D lazy-loads authenticated route surfaces", () => {
  const app = fs.readFileSync("src/App.jsx", "utf8");
  expect(app).toContain("lazy, Suspense");
  expect(app).toContain("<Suspense fallback={<RouteFallback />}>");
  for (const route of [
    ["Home", "./screens/Home"],
    ["ManagerHome", "./screens/ManagerHome"],
    ["AdminHome", "./screens/AdminHome"],
    ["ExecutiveHome", "./screens/ExecutiveHome"],
    ["DesignPrimitives", "./screens/DesignPrimitives"],
    ["MeetingScheduler", "./components/MeetingScheduler"],
  ]) {
    expect(app, `missing lazy route ${route[0]}`).toContain(`const ${route[0]} = lazy(() => import("${route[1]}"));`);
  }
  for (const staticImport of [
    'import Home from "./screens/Home";',
    'import ManagerHome from "./screens/ManagerHome";',
    'import AdminHome from "./screens/AdminHome";',
    'import ExecutiveHome from "./screens/ExecutiveHome";',
  ]) {
    expect(app).not.toContain(staticImport);
  }
});
