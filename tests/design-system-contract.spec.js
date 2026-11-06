import {lightAppearanceCss} from "./helpers/lightAppearanceCss.mjs";
import fs from "node:fs";
import { test, expect } from "@playwright/test";

const premiumCssFiles = [
  "src/premium.css",
  "src/premium-staff.css",
  "src/premium-manager.css",
  "src/premium-admin.css",
  "src/premium-executive.css",
  "src/premium-parity.css",
  "src/final-product/fpg7-people-workforce.css",
];

test("issue 70 runtime typography fixes stay at the approved floor", async () => {
  const styles = await fs.promises.readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const required = [
    [".home-chip", /\.home-chip\{[^}]*font-size:12px/],
    [".admin-reporting-card span", /\.admin-reporting-card span\{[^}]*font-size:12px/],
    [".admin-missing-units span", /\.admin-missing-units span\{[^}]*font-size:12px/],
    [".progress-meter-head span", /\.progress-meter-head span\{[^}]*font-size:12px/],
    [".ch-tick", /\.ch-tick\{[^}]*font-size:12px/],
    [".ch-legend span", /\.ch-legend span\{[^}]*font-size:12px/],
  ];
  for (const [label, pattern] of required) {
    expect(styles, label + " must not regress below 12px").toMatch(pattern);
  }
});

test("premium CSS preserves the 12px operational text floor", async () => {
  const violations = [];
  for (const path of premiumCssFiles) {
    const css = fs.readFileSync(path, "utf8");
    for (const match of css.matchAll(/font-size\s*:\s*([0-9]*\.?[0-9]+)px\b/g)) {
      const size = Number(match[1]);
      if (size < 12) violations.push({ path, size, declaration: match[0] });
    }
  }
  expect(violations).toEqual([]);
});

test("workspace action colours resolve through semantic tokens", async () => {
  const premium = lightAppearanceCss(fs.readFileSync("src/premium.css", "utf8")).toLowerCase();
  expect((premium.match(/#0c5df9/g) || []).length).toBe(1);
  expect((premium.match(/#6498f9/g) || []).length).toBe(1);

  for (const path of ["src/premium-staff.css", "src/premium-manager.css", "src/premium-admin.css", "src/premium-executive.css", "src/premium-parity.css"]) {
    const css = fs.readFileSync(path, "utf8").toLowerCase();
    expect(css.includes("#0c5df9")).toBeFalsy();
    expect(css.includes("#6498f9")).toBeFalsy();
  }
});

test("legacy visual-debt counters cannot grow", async () => {
  const paths = [
    "src/styles.css",
    "src/premium.css",
    "src/premium-staff.css",
    "src/premium-manager.css",
    "src/premium-admin.css",
    "src/premium-executive.css",
    "src/premium-parity.css",
  ];
  const css = paths.map((path) => fs.readFileSync(path, "utf8")).join("\n");
  const uniqueHex = new Set((css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((value) => value.toLowerCase())).size;
  const uniqueShadows = new Set([...css.matchAll(/box-shadow\s*:\s*([^;}\n]+)/g)].map((match) => match[1].trim())).size;
  const uniqueRadii = new Set([...css.matchAll(/border-radius\s*:\s*([^;}\n]+)/g)].map((match) => match[1].trim())).size;
  const uniquePixelSizes = new Set([...css.matchAll(/font-size\s*:\s*([0-9]*\.?[0-9]+)px\b/g)].map((match) => match[1])).size;

  // These are debt ceilings, not target values. Refactors may reduce them; new work may not increase them.
  expect(uniqueHex).toBeLessThanOrEqual(746);
  expect(uniqueShadows).toBeLessThanOrEqual(134);
  expect(uniqueRadii).toBeLessThanOrEqual(55);
  expect(uniquePixelSizes).toBeLessThanOrEqual(36);
});

test("role CSS remains isolated and the important-debt budget does not grow", async () => {
  const executive = fs.readFileSync("src/premium-executive.css", "utf8");
  for (const leakedSelector of [".staff-app", ".manager-app", ".office-app", ".premium-side", ".reference-"]) {
    expect(executive.includes(leakedSelector)).toBeFalsy();
  }

  const allCss = [
    "src/styles.css",
    ...premiumCssFiles,
  ].map((path) => fs.readFileSync(path, "utf8")).join("\n");
  const importantCount = (allCss.match(/!important\b/g) || []).length;
  expect(importantCount).toBeLessThanOrEqual(1125);
});

test("Instrument Sans is the premium body family and PWA icons are shipped", async ({ page }) => {
  await page.goto("/");
  const bodyFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bodyFamily.toLowerCase().startsWith('"instrument sans"') || bodyFamily.toLowerCase().startsWith("instrument sans")).toBeTruthy();

  const manifest = await page.evaluate(async () => {
    const response = await fetch("/manifest.webmanifest");
    return response.json();
  });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/ceac-icon-192.png", sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ src: "/ceac-icon-512.png", sizes: "512x512", type: "image/png" }),
  ]));

  for (const icon of ["/ceac-icon-192.png", "/ceac-icon-512.png", "/apple-touch-icon.png"]) {
    const result = await page.evaluate(async (src) => {
      const response = await fetch(src);
      return { ok: response.ok, type: response.headers.get("content-type"), bytes: (await response.arrayBuffer()).byteLength };
    }, icon);
    expect(result.ok).toBeTruthy();
    expect(result.type).toContain("image/png");
    expect(result.bytes).toBeGreaterThan(1000);
  }
});


test("Compliance populated metadata stays at the CEAC 12px floor", () => {
  const css = fs.readFileSync("src/styles.css", "utf8");
  const selectors = [
    ".compliance-policy-card summary",
    ".compliance-meta span",
    ".compliance-meta b",
    ".compliance-self-item span,.compliance-self-item small",
    ".compliance-chip-list button",
    ".compliance-history summary",
    ".compliance-history>div strong",
    ".compliance-history>div span",
  ];

  for (const selector of selectors) {
    const escaped = selector.replace(/[.*+?^$()|[\]{}]/g, "\\$&");
    const match = css.match(new RegExp(escaped + "\\{[^}]*font-size:([0-9.]+)px"));
    expect(match, `Missing explicit font size for ${selector}`).not.toBeNull();
    expect(Number(match[1]), `${selector} must stay at or above 12px`).toBeGreaterThanOrEqual(12);
  }
});
