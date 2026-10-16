import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");

test("owner's ONE approved structured ratings schema and UI have the same contract", () => {
  const sql = read("supabase/migrations/20261016180000_151_stage2_human_appraisal_ratings.sql");
  const component = read("src/components/StructuredHumanReview.jsx");
  const validator = read("src/lib/stage2HumanRubric.js");
  const screen = read("src/screens/Performance.jsx");
  assert.match(sql, /CREATE TABLE public\.appraisal_human_rating_versions/);
  assert.match(sql, /stage2_cadence/);
  assert.match(sql, /stage2_require_quarterly_ratings_for_release/);
  assert.match(component, /cycle\?\.stage2_cadence/);
  assert.match(component, /\.from\("appraisal_human_rating_versions"\)/);
  assert.match(component, /profile_id:appraisal\.profile_id/);
  assert.match(component, /reviewer_id:me\.id,cadence/);
  assert.match(component, /category_ratings:Object\.fromEntries/);
  assert.match(component, /next_actions:/);
  assert.match(component, /assessment_entry_id:assessment\.id/);
  assert.match(screen, /<StructuredHumanReview/);
  assert.match(validator, /reliability/);
  assert.doesNotMatch(validator, /average|weightedScore|computedRating|rankEmployee/);
  assert.doesNotMatch(component, /\.rpc\("share_performance_review"/);
  assert.doesNotMatch(component, /\.from\("appraisal_entries"\)\.update/);
});

test("quarterly ratings stay attached to independent HR release, not a second publishing engine", () => {
  const sql = read("supabase/migrations/20261016180000_151_stage2_human_appraisal_ratings.sql");
  const ui = read("src/components/StructuredHumanReview.jsx");
  assert.match(sql, /BEFORE INSERT ON public\.performance_review_release_requests/);
  assert.match(sql, /FOREACH v_dimension IN ARRAY ARRAY\[/);
  assert.match(sql, /reviewer_id=auth\.uid\(\)/);
  assert.match(sql, /a\.manager_id<>a\.profile_id/);
  assert.match(ui, /newest\?\.assessment_entry_id !== assessment\.id/);
  assert.match(ui, /old|prior|immutable/i);
  assert.match(ui, /Specific explanation \/ N\/O reason/);
});

test("monthly ratings are optional and no reported work indicator becomes a rating", () => {
  const v = read("src/lib/stage2HumanRubric.js");
  assert.match(v, /allowNoMonthlyRatings/);
  assert.match(v, /monthly/);
  assert.match(v, /quarterly/);
  assert.match(v, /N\/O/);
  assert.doesNotMatch(read("src/lib/stage2AchievementMetrics.js"), /humanRating\s*=/);
});
