import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=(path)=>readFileSync(path,"utf8");

test("there is one self-achievement route for both My Hub and the navigation",()=>{
 const screen=file("src/screens/PersonalAchievements.jsx");
 const me=file("src/screens/Me.jsx");
 const app=file("src/App.jsx");
 assert.match(me,/onOpenAchievements\?\.\(\)/);
 assert.doesNotMatch(me,/components\/PersonalAchievements|showAchievements/);
 assert.match(app,/const PersonalAchievements = lazy/);
 assert.match(app,/onOpenAchievements=\{\(\) => go\("achievements"\)\}/);
 assert.match(app,/tab === "achievements"/);
 assert.match(screen,/individualAchievementFacts/);
 assert.match(screen,/\.from\("work_items"\)/);
 assert.match(screen,/\.from\("submissions"\)/);
 assert.match(screen,/\.eq\("assignee_id",me\.id\)/);
 assert.match(screen,/\.eq\("profile_id",me\.id\)/);
 assert.match(screen,/projects\(name\)/);
 assert.match(screen,/Too many records to verify accurately/);
 assert.match(screen,/window\.print\(\)/);
 assert.doesNotMatch(screen,/\.insert\(|\.update\(|\.delete\(|service_role/);
});

test("personal reports distinguish live factual records from frozen HR-reviewed appraisal",()=>{
 const screen=file("src/screens/PersonalAchievements.jsx");
 const metrics=file("src/lib/stage2AchievementMetrics.js");
 assert.match(screen,/live view of your current authorised records/i);
 assert.match(screen,/not a frozen monthly filing/i);
 assert.match(screen,/Print \/ Save as PDF/);
 assert.match(screen,/Distinct projects contributed to/);
 assert.match(screen,/No employee rating, comparison, salary/i);
 assert.match(metrics,/distinctVerifiedProjectOutcomes/);
 assert.doesNotMatch(screen,/\.from\("appraisal_entries"\)|\.from\("appraisal_human_rating_versions"\)/);
});

test("human appraisal rubric remains independent of factual achievement totals",()=>{
 const facts=file("src/lib/stage2PerformanceFacts.js");
 assert.match(facts,/HUMAN_RUBRIC/);
 assert.match(facts,/reviewerId===employeeId/);
 assert.match(facts,/periodKind==="quarter"/);
 assert.match(facts,/rating\.reason/);
 assert.match(facts,/VALID_RATINGS/);
 assert.doesNotMatch(facts,/autoScore|calculateRating|averageRating|sort.*rating/);
});

test("personal print/export hides the rest of the application, including protected records",()=>{
 const css=file("src/screens/PersonalAchievements.css");
 assert.match(css,/@media print/);
 assert.match(css,/body:has\(\.s2-achievement\) \*\{visibility:hidden!important\}/);
 assert.match(css,/\.s2-achievement,\.s2-achievement \*\{visibility:visible!important\}/);
 assert.match(css,/@page\{size:A4/);
});
