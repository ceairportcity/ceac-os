import fs from "node:fs";
import { test, expect } from "@playwright/test";

const providerPath = "src/experience-v2/ExperienceV2MotionProvider.jsx";
const motionPath = "src/experience-v2/motion.js";

test("Experience V2 has one central MotionConfig provider that respects user preference", async () => {
  const provider = fs.readFileSync(providerPath, "utf8");
  expect(provider).toContain('from "motion/react"');
  expect(provider).toContain("MotionConfig");
  expect(provider).toContain('reducedMotion="user"');
});

test("Experience V2 motion constants stay semantic and restrained", async () => {
  const source = fs.readFileSync(motionPath, "utf8");
  for (const token of [
    "press: 0.12",
    "fast: 0.16",
    "standard: 0.22",
    "surface: 0.28",
    "complex: 0.32",
    "stiffness: 420",
    "damping: 34",
    "mass: 0.8",
    "EV2_TRANSITIONS",
    "reflow",
  ]) {
    expect(source, token + " must remain defined").toContain(token);
  }
  expect(source).not.toContain("bounce");
});

test("Experience V2 motion provider wraps the app without changing legacy screens", async () => {
  const main = fs.readFileSync("src/main.jsx", "utf8");
  const providerImport = main.indexOf('import ExperienceV2MotionProvider from "./experience-v2/ExperienceV2MotionProvider";');
  // Main application is intentionally lazy to preserve the measured root
  // bundle budget. MotionConfig still wraps the lazy app under Suspense.
  const appImport = main.indexOf('const App = lazy(() => import("./App"));');
  expect(appImport).toBeGreaterThanOrEqual(0);
  expect(providerImport).toBeGreaterThanOrEqual(0);
  expect(main.indexOf("<ExperienceV2MotionProvider>")).toBeLessThan(main.indexOf("<App />"));
  expect(main).toContain("<ExperienceV2MotionProvider>");
  expect(main).toContain("<App />");
  expect(main).toContain("</ExperienceV2MotionProvider>");
});

test("Experience V2 uses the free motion package only", async () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  expect(pkg.dependencies?.motion).toBeTruthy();
  expect(pkg.dependencies?.["motion-plus"]).toBeFalsy();
  expect(pkg.dependencies?.["framer-motion"]).toBeFalsy();
});
