import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("Executive briefing only receives explicitly issued organisational reports, not HR narratives or drafts",()=>{
 const screen=read("src/screens/ExecutiveReports.jsx");
 const view=read("src/components/ExecutiveOutcomeBrief.jsx");
 assert.match(screen,/\.from\("reports"\)\.select\("id,unit_id,version,status,submitted_at,narrative,challenges", \{ count: "exact" \}\)/);
 assert.match(screen,/\.in\("status",\["submitted","confirmed"\]\)/, "leadership fetch must never request draft or returned narrative");
 assert.match(screen,/\.from\("objectives"\)/);
 assert.match(screen,/\.from\("project_milestones"\)/);
 assert.match(screen,/x\.count>500/);
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

test("Executive report data is committed only for the currently signed actor and verified report reads", () => {
 const screen=read("src/screens/ExecutiveReports.jsx");
 assert.match(screen,/const identity = me\.org_id \+ ":" \+ me\.id/);
 assert.match(screen,/const requestSequence = useRef\(0\)/);
 assert.match(screen,/const current = \(\) => loadedActor\.current === expected && requestSequence\.current === request/);
 assert.match(screen,/if \(!current\(\)\) return/);
 assert.match(screen,/const contextPending = loading \|\| \(readyActor !== identity && failedActor !== identity\)/);
 assert.match(screen,/const contextError = error && failedActor === identity/);
 assert.match(screen,/setFailedActor\(expected\)/);
 assert.match(screen,/\) : contextError \? \(/);
 assert.match(screen,/if \(current\(\)\) \{\s*setError\(humanError/);
 assert.match(screen,/if \(current\(\)\) setLoading\(false\)/);
 assert.match(screen,/setReports\(nextReports\);/);
 assert.match(screen,/\{contextPending \? \(/);
 assert.match(screen,/setOutcomeError\(nextOutcomeError\)/);
});

test("Executive filing counts fail closed on silent database result truncation", () => {
 const screen=read("src/screens/ExecutiveReports.jsx");
 assert.match(screen,/\.select\("id,name", \{ count: "exact" \}\)/);
 assert.match(screen,/\.select\("unit_id,status,version,submitted_at", \{ count: "exact" \}\)/);
 assert.match(screen,/unitResult\.count !== \(unitResult\.data \|\| \[\]\)\.length/);
 assert.match(screen,/reportResult\.count !== \(reportResult\.data \|\| \[\]\)\.length/);
 assert.match(screen,/No filing totals can be verified/);
 assert.match(screen,/Filing totals are withheld/);
});

test("Executive outcome sources require exact counts, not a potentially truncated 500-row view",()=>{
 const screen=read("src/screens/ExecutiveReports.jsx");
 for(const select of [
  'id,unit_id,version,status,submitted_at,narrative,challenges',
  'id,name,status,project_id,unit_id,target_value,achieved_value,target_unit',
  'id,name,status,project_id,target_on,completed_at'
 ]) {
  assert.ok(screen.includes('.select("'+select+'", { count: "exact" })'),"Missing complete-count source: "+select);
 }
 assert.match(screen,/typeof x\.count !== "number"/);
 assert.match(screen,/x\.count !== \(x\.data\|\|\[\]\)\.length/);
 assert.match(screen,/x\.count>500/);
 assert.match(screen,/nextOutcomeError="Leadership evidence could not be verified completely\. Detailed totals are withheld\."/);
});

test("Executive quarter sources bind recorded proposals and evidence to the latest issued unit revision only",()=>{
 const screen=read("src/screens/ExecutiveReports.jsx");
 const brief=read("src/components/ExecutiveOutcomeBrief.jsx");
 const facts=read("src/lib/ministryReportingFacts.js");
 assert.match(screen,/\.from\("report_targets"\)/);
 assert.match(screen,/\.from\("report_evidence_refs"\)/);
 assert.match(screen,/const latestIssued = Object\.values\(latestUnitReportStatus\(issued\.data \|\| \[\]\)\)/);
 assert.match(screen,/\.in\("report_id",issuedIds\)/);
 assert.match(screen,/response\.count>500/);
 assert.match(brief,/unitTargets\.map/);
 assert.match(brief,/unitEvidence\.map/);
 assert.match(brief,/A proposed target is not an Executive approval/);
 assert.match(facts,/byReportId\.has\(row\.report_id\)/);
 assert.doesNotMatch(brief,/approved Executive decision recorded/i);
});

test("quarterly leadership briefing uses period-scoped real Work decisions, never invented Executive approval",()=>{
 const screen=read("src/screens/ExecutiveReports.jsx");
 const view=read("src/components/ExecutiveOutcomeBrief.jsx");
 assert.match(screen,/\.from\("work_decisions"\)/);
 assert.match(screen,/\.gte\("decided_at",selectedPeriod\.starts_on/);
 assert.match(screen,/\.lt\("decided_at",exclusiveEnd\)/);
 assert.match(screen,/\.select\("id,title,unit_id,project_id",\{count:"exact"\}\)/);
 assert.match(screen,/itemRead\.count!==workIds\.length/);
 assert.match(screen,/decisionRead\.count>500/);
 assert.match(view,/decisions\.map\(decision=>/);
 assert.match(view,/separate from quarterly Executive approvals/);
 assert.match(view,/Recorded rationale:/);
});
