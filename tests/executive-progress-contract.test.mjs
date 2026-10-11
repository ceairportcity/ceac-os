import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { strategyProgress } from "../src/experience-v2/executive-overview/strategyProgress.js";

test("Executive never displays missing objective observations as measured zero", () => {
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:100, current_value:null }), null);
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:100 }), null);
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:null, current_value:0 }), null);
  assert.equal(strategyProgress({ measurement_kind:"numeric", current_value:0 }), null);
});

test("a genuinely recorded zero or fractional objective remains accurate", () => {
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:100, current_value:0 }), 0);
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:100, current_value:25 }), 25);
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:100, current_value:150 }), 100);
});

test("non-numeric and invalid targets never generate a fabricated progress measure", () => {
  assert.equal(strategyProgress({measurement_kind:"qualitative", target_value:100, current_value:25}), null);
  assert.equal(strategyProgress({measurement_kind:"numeric", target_value:0, current_value:15}), null);
  assert.equal(strategyProgress({measurement_kind:"numeric", target_value:"not recorded", current_value:15}), null);
});

test("Executive UI actually uses the measured-only helper", () => {
  const source=readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx","utf8");
  assert.match(source, /import \{ strategyProgress \} from "\.\/strategyProgress\.js";/);
  assert.match(source, /const progress = strategyProgress\(row\);/);
  assert.doesNotMatch(source, /const current = Number\(row\?\.current_value\);/);
});
