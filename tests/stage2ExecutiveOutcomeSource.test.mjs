import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("Executive briefing only receives explicitly issued organisational reports, not HR narratives or drafts",()=>{
 const screen=read("src/screens/ExecutiveReports.jsx");
 const view=read("src/components/ExecutiveOutcomeBrief.jsx");
 assert.match(screen,/\.from\("reports"\)\.select\("id,unit_id,version,status,submitted_at,narrative,challenges"\)/);
 assert.match(screen,/\.in\("status",\["submitted","confirmed"\]\)/, "leadership fetch must never request draft or returned narrative");
 assert.match(screen,/\.from\("objectives"\)/);
 assert.match(screen,/\.from\("project_milestones"\)/);
 assert.match(screen,/\.length>500/);
 assert.match(view,/ministryPeriodEvidence/);
 assert.doesNotMatch(view,/appraisal_entries|profile_portraits|feedback_notes|appraisal_human_rating_versions/);
});
test("one outcome counted once with source references and printable V4-light presentation",()=>{
 const src=read("src/lib/ministryReportingFacts.js");
 const html=read("src/components/ExecutiveOutcomeBrief.jsx");
 const css=read("src/components/ExecutiveOutcomeBrief.css");
 assert.match(src,/objectiveMap=new Map\(\)/);
 assert.match(src,/milestoneMap=new Map\(\)/);
 assert.match(src,/!final\(report.status\)/);
 assert.match(html,/No achievement figures have been inferred/);
 assert.match(html,/not automatically employee scoring|not automatic employee scoring/);
 assert.match(html,/window\.print\(\)/);
 assert.match(css,/@media print/);
 assert.match(css,/body:has\(\.s2-exec-brief\)/, "Executive print styles must not blank other routes after visiting Reports");
 assert.doesNotMatch(css,/\.s2-exec-brief-milestones\{display:none!important\}/, "issued evidence must be present in the printed briefing");
});
