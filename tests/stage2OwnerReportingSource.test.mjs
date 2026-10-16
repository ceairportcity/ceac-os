import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file = path => readFileSync(path,"utf8");

test("all-role self-achievement view queries only own RLS-bound Work records",()=>{
 const component=file("src/components/PersonalAchievements.jsx");
 const me=file("src/screens/Me.jsx");
 const app=file("src/App.jsx");
 assert.match(component,/\.eq\("assignee_id",me\.id\)/);
 assert.match(component,/\.from\("work_items"\)/);
 assert.match(component,/\.from\("projects"\)/);
 assert.match(component,/\.in\("id",ids\)/);
 assert.match(component,/more than 1,000 records/);
 assert.match(component,/personalAchievementSummary/);
 assert.match(component,/window\.print\(\)/);
 assert.doesNotMatch(component,/\.insert\(|\.update\(|\.delete\(|service_role|fetch\(/);
 assert.match(me,/<PersonalAchievements me=\{me\}/);
 assert.match(app,/onOpenWork=\{openItem\}/);
});

test("factual report explicitly rejects invented historical snapshot, payroll or scores",()=>{
 const code=file("src/lib/stage2PerformanceFacts.js");
 const html=file("src/components/PersonalAchievements.jsx");
 assert.match(code,/live-current-state-not-period-end-snapshot/);
 assert.match(code,/new Map\(records\.filter/);
 assert.match(code,/new Set\(periodTasks\.map/);
 assert.match(code,/first_time_approved === true/);
 assert.match(code,/onTimeRatio:due\.length \?/);
 assert.match(html,/Live factual preview, not a frozen issued report/);
 assert.match(html,/not a performance rating/);
 assert.match(html,/not contain protected HR appraisal or payroll/);
 assert.doesNotMatch(html,/\.from\("appraisal_entries"\)|\.from\("protected_hr"/);
});

test("rubric is human selected, with 5 dimensions, N/O explanations and independent reviewer",()=>{
 const facts=file("src/lib/stage2PerformanceFacts.js");
 assert.match(facts,/HUMAN_RUBRIC/);
 assert.match(facts,/reviewerId===employeeId/);
 assert.match(facts,/periodKind==="quarter"/);
 assert.match(facts,/rating\.reason/);
 assert.match(facts,/VALID_RATINGS/);
 assert.doesNotMatch(facts,/autoScore|calculateRating|averageRating|sort.*rating/);
});

test("report export is local browser print and hides unrelated private UI from print",()=>{
 const css=file("src/components/PersonalAchievements.css");
 assert.match(css,/@media print/);
 assert.match(css,/body \*\{visibility:hidden!important\}/);
 assert.match(css,/\.s2-achievements,.s2-achievements \*\{visibility:visible!important\}/);
 assert.match(css,/@page\{size:A4/);
});
