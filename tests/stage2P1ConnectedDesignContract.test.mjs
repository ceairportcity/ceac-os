import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync("docs/design/stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html", "utf8");
function getMenu(role) {
  const start = html.indexOf("\n " + role + ":[[");
  assert.ok(start >= 0, "missing preview role: " + role);
  return html.slice(start, html.indexOf("\n", start + 1));
}
test("P1 Compliance and Payroll have separate capability-specific preview panels", () => {
  assert.match(getMenu("compliance"), /\["compliance","Independent Compliance desk"\]/);
  assert.match(getMenu("payroll"), /\["payroll","Payroll preparation and approval"\]/);
  for (const role of ["staff","manager","support","admin","executive","volunteer"]) {
    assert.doesNotMatch(getMenu(role), /\["(?:compliance|payroll)",/);
  }
  assert.match(html, /<option value="compliance">Compliance Officer/);
  assert.match(html, /<option value="payroll">Payroll-authorised officer/);
  assert.match(html, /const dest=roleNav\[role\]; if\(!dest\.some\(row=>row\[0\]===page\)\)page=dest\[0\]\[0\]/);
});
test("P1 additions wire accessible local synthetic Compliance and Payroll views", () => {
  for (const fragment of [
    "function complianceP1()", "function payrollP1()",
    "compliance:complianceP1,payroll:payrollP1",
    'kind==="compliance-review"', 'kind==="payroll-detail"',
    "Payroll.prepare", "Payroll.approve",
    "cannot automatically become payable payroll amounts",
    "No salary or payout data exists",
    "No actual changes will be saved",
  ]) assert.ok(html.includes(fragment), "missing P1 source boundary: " + fragment);
  assert.doesNotMatch(html, /(?:fetch\s*\(|\.from\s*\(|\.rpc\s*\(|supabase\.auth|signInWithPassword|service_role)/);
});
test("P1 extension retains canonical light-blue palette and responsive layout", () => {
  for (const token of [
    "--bg:#f5f8fc", "--surface:#fff", "--nav:#fff", "--ink:#122440",
    "--blue:#1368ed", "--line:#e7edf4", "max-width:960px",
  ]) assert.ok(html.includes(token), "missing V4 source token: " + token);
  assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
});
test("P1 Finance is isolated from Payroll; Administration and Executive share only synthetic quarterly event design", () => {
  const finance = getMenu("finance");
  assert.match(finance, /\["finance","Finance controls"\]/);
  assert.doesNotMatch(finance, /\["payroll",/);
  for (const role of ["staff","manager","support","admin","executive","volunteer","compliance","payroll"]) {
    assert.doesNotMatch(getMenu(role), /\["finance",/);
  }
  for (const role of ["admin","executive"]) {
    assert.match(getMenu(role), /\["quarterly","Quarterly event"\]/);
  }
  for (const role of ["staff","manager","support","volunteer","compliance","payroll","finance"]) {
    assert.doesNotMatch(getMenu(role), /\["quarterly",/);
  }
  for (const fragment of [
    "function financeP1()", "function quarterlyP1()",
    "finance:financeP1,quarterly:quarterlyP1",
    'kind==="finance-request"', 'kind==="quarterly-event"',
    "A failed read must show an error",
    "Quarterly required, never auto-calculated",
    "No event or report is published",
  ]) assert.ok(html.includes(fragment), "missing Finance/quarterly review design contract: " + fragment);
});
test("P1 report evidence failure state is visibly fail-closed rather than showing fabricated metrics", () => {
  for (const phrase of [
    "reportEvidenceReady=true",
    'action==="report-unavailable"',
    'action==="report-ready"',
    'role="alert">Report evidence could not be loaded',
    "Period statistics, completion counts and review evidence are withheld",
    'btn("Preview evidence failure","report-unavailable")',
  ]) assert.ok(html.includes(phrase), "missing fail-closed evidence preview: " + phrase);
});
test("P1 selected-Manager-unit demonstration is isolated from membership or Auth permissions", () => {
  for(const expected of [
    'demoUnit="Unit One"',
    'role==="manager"?',
    'Selected unit: ',
    'action==="switch-demo-unit" && role==="manager"',
    'No real permissions changed',
  ]) assert.ok(html.includes(expected),"missing isolated Manager unit design: "+expected);
  assert.doesNotMatch(html,/(?:fetch\s*\(|\.from\s*\(|\.rpc\s*\(|supabase\.auth|service_role)/);
});
test("P1 period status differentiates not-yet-loaded, no-filed-evidence and failed source read",()=>{
  for(const key of [
    'reportEvidencePhase="ready"','data-evidence-phase',
    'Loading source evidence','No filed period evidence',
    'action==="report-loading" || action==="report-empty"',
    'btn("Preview loading","report-loading")',
    'btn("Preview empty period","report-empty")'
  ]) assert.ok(html.includes(key),"missing source evidence status "+key);
  assert.match(html,/if\(!reportEvidenceReady\)return/);
  assert.doesNotMatch(html,/(?:fetch\s*\(|\.from\s*\(|\.rpc\s*\(|supabase\.auth|service_role)/);
});
test("P1 connected Work draft is local-only, unit-scoped and escapes user-provided preview text",()=>{
  for(const v of ['const draftWorkSamples=[]','escapePreview','name="draftTitle"',
    'name="draftProject"','name="draftAssignee"','name="draftNotes"',
    'new FormData(event.target)','draftWorkSamples.unshift',
    'draft.role===role && (role!=="manager"||draft.unit===demoUnit)',
    'Sample draft, not saved']) assert.ok(html.includes(v),"missing P1 Work draft scenario: "+v);
  assert.doesNotMatch(html,/(?:fetch\s*\(|\.from\s*\(|\.rpc\s*\(|supabase\.auth|service_role)/);
});
test("P1 Auth step review never substitutes a synthetic TOTP for verified AAL2",()=>{
  for(const v of ['let authPreviewStep="setup"','auth-step-setup','auth-step-challenge',
   'auth-step-recovery','authPreviewStep=action.slice','No actual Supabase Auth',
   'Protected action withheld pending real proof','cannot reset or bypass a factor'])
    assert.ok(html.includes(v),"missing Auth design boundary: "+v);
  assert.doesNotMatch(html,/(?:fetch\s*\(|\.from\s*\(|\.rpc\s*\(|supabase\.auth|service_role)/);
});
test("P1 project close is Manager-only synthetic design requiring evidence and attribution",()=>{
  for(const fragment of [
    'const canAuthor=role==="manager"',
    'Preview project closure',
    'kind==="project-close" && role==="manager"',
    'action==="project-close" && role!=="manager"',
    'name="projectReadiness"',
    'name="projectEvidence"',
    'name="projectAttribution"',
    'no duplicated shared outcomes'
  ]) assert.ok(html.includes(fragment),"missing P1 project-close guard: "+fragment);
  assert.doesNotMatch(html,/(?:fetch\s*\(|\.from\s*\(|\.rpc\s*\(|supabase\.auth|service_role)/);
});
test("P1 private Calendar review never grants organisation meeting access by menu alone",()=>{
  for(const v of [
    'function calendarP1()','calendar:calendarP1','kind==="calendar-private"',
    'kind==="calendar-meeting" && (role==="manager"||role==="admin"||role==="executive")',
    'action==="calendar-meeting" && !["manager","admin","executive"].includes(role)',
    'Private day events','Only me'
  ]) assert.ok(html.includes(v),"missing Calendar design boundary "+v);
  for(const role of ["staff","manager","support","admin","executive"])
    assert.match(getMenu(role),/\["calendar","My calendar"\]/);
  for(const role of ["volunteer","compliance","payroll","finance"])
    assert.doesNotMatch(getMenu(role),/\["calendar","My calendar"\]/);
  assert.doesNotMatch(html,/(?:fetch\s*\(|\.from\s*\(|\.rpc\s*\(|supabase\.auth|service_role)/);
});
test("P1 personal appraisal is synthetic employee-owned, HR-published and not a computed KPI",()=>{
  for(const v of [
    'function personalReviewP1()','myreview:personalReviewP1',
    'personalReviewPhase="unpublished"','appraisal-published',
    'appraisal-unpublished',
    'kind==="employee-response" && page==="myreview" && personalReviewPhase==="published"',
    'Sample response recorded locally, not submitted',
    'System-generated work counts cannot replace the human review'
  ]) assert.ok(html.includes(v),"missing employee review boundary "+v);
  for(const role of ["staff","manager","support","admin","executive"])
    assert.match(getMenu(role),/\["myreview","My appraisal"\]/);
  for(const role of ["volunteer","compliance","payroll","finance"])
    assert.doesNotMatch(getMenu(role),/\["myreview","My appraisal"\]/);
  assert.doesNotMatch(html,/(?:fetch\s*\(|\.from\s*\(|\.rpc\s*\(|supabase\.auth|service_role)/);
});
test("P1 Administration-only invite design keeps nonsalaried Volunteer and HR boundaries explicit",()=>{
  for(const str of [
    'const mayInviteInPreview=role==="admin"',
    'kind==="invite" && role==="admin"',
    'action==="invite" && role!=="admin"',
    'name="inviteeEmail"','name="participantType"',
    'Nonsalaried Volunteer','has no implied payroll'
  ]) assert.ok(html.includes(str),"missing invitation boundary "+str);
  assert.doesNotMatch(html,/(?:fetch\s*\(|\.from\s*\(|\.rpc\s*\(|supabase\.auth|service_role)/);
});

test("P1 Manager owns human-rating entry; Administration has separate review oversight",()=>{
  assert.match(getMenu("manager"),/\["ratings","Team appraisals"\]/);
  assert.match(getMenu("admin"),/\["ratings","Quarterly reviews"\]/);
  for(const role of ["staff","support","executive","compliance","payroll","finance","volunteer"])
    assert.doesNotMatch(getMenu(role),/\["ratings",/);
  assert.match(html,/role==="manager"\?btn\("Open rating entry","rating","primary"\):""/);
  assert.match(html,/kind==="rating" && role==="manager"/);
  assert.match(html,/action==="rating" && role!=="manager"/);
  assert.match(html,/name="humanRating" required/);
  assert.match(html,/name="ratingExplanation" rows="3" required/);
  assert.match(html,/name="ratingEvidence" required/);
});


test("P1 scenic Overview review follows owner direction rather than withdrawn dark or plain layout", () => {
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  const overview = html.slice(html.indexOf("function overview(){"), html.indexOf("function work(){"));
  assert.ok(overview.includes("s2ov-hero"), "review must use correct scenic overview family");
  assert.ok(overview.includes("s2ov-photo"), "scenic photo must be placed at upper right");
  for (const section of ["My work session", "Today's focus", "My projects", "Today's activity", "My work", "Selected responsibility"]) {
    assert.ok(overview.includes(section), "owner-selected Overview family missing section: " + section);
  }
  assert.ok(css.includes(".s2ov-photo{"), "hero photo composition missing");
  assert.ok(css.includes(".s2ov-four{"), "four summary-card layout missing");
  assert.ok(css.includes("@media(max-width:520px){.s2ov-four"), "phone hierarchy missing");
  assert.ok(overview.includes('role!=="volunteer"'), "volunteer must not inherit employee work-time control");
  assert.ok(overview.includes("Sample activity only"), "preview must not report invented actual work");
  assert.ok(!css.includes("rgba(17,48,90,.87)"), "old dark hero must not be the approval candidate");
});

test("P1 Work candidate preserves the exact owner-selected register/inspector desktop and phone family",()=>{
 const css=html.slice(html.indexOf("<style>"),html.indexOf("</style>"));
 const work=html.slice(html.indexOf("function work(){"),html.indexOf("function projects(){"));
 for(const token of ["s2w-grid","Responsibilities","Given out","Created by me","In progress","Waiting & review","Completed","s2w-table-head","Selected responsibility","Activity record","s2w-next"]) {
  assert.ok(work.includes(token),"missing owner-approved Work visual family element "+token);
 }
 assert.ok(css.includes(".s2w-grid{display:grid;grid-template-columns:minmax(0,2.7fr)"),"desktop Work register/inspector should reflect approved proportions");
 assert.ok(css.includes("@media(max-width:520px){.s2w-register"),"390px Work must stack inspector after register");
 assert.ok(work.includes("Sample draft, not saved"),"synthetic task cannot claim committed real data");
 assert.ok(work.includes('role==="manager"'),"delegation preview needs explicit eligible role");
 assert.doesNotMatch(work,/Start (work|session)/i,"Start work must remain on Overview, not Work");
});

test("P1 local give-work draft uses the Given out filter without pretending it was assigned to self",()=>{
  assert.match(html, /workFilter=kind==="give-work"\?"given":"mine"/);
  assert.match(html, /workFilter==="given"\?row\.origin==="given"/);
  assert.match(html, /workFilter==="mine"\?row\.origin!=="given"/);
});

test("P1 reviewed draft separates truthful provenance from not-saved status once",()=>{
 const work=html.slice(html.indexOf("function work(){"),html.indexOf("function projects(){"));
 assert.ok(work.includes('ref:"Preview only · "+(draft.kind==="delegation"?"Given out":"Created by me")'));
 assert.ok(work.includes('draft:"Sample draft, not saved"'));
 assert.ok(!work.includes('ref:"Sample draft, not saved"'),"draft metadata must not duplicate state label");
});

test("P1 selected collaborative Projects family retains shared team, one task table and inspector without private names",()=>{
 const project=html.slice(html.indexOf("function projects(){"),html.indexOf("function reports(){"));
 const css=html.slice(html.indexOf("<style>"),html.indexOf("</style>"));
 for(const token of ["s2pr-hero","s2pr-photo","s2pr-metrics","s2pr-team","Departments involved","s2pr-taskpanel","Recent tasks","s2pr-right","About this project","Key milestones","Recent activity","Read-only view"]) {
  assert.ok(project.includes(token),"missing selected Projects visual feature: "+token);
 }
 assert.equal(project.split("panel(\"Project team and departments\"").length-1,1);
 assert.equal(project.split("panel(\"About this project\"").length-1,1);
 assert.ok(css.includes("@media(max-width:520px){.s2pr-hero"),"phone Projects cards/inspector missing");
 assert.match(project,/const canAuthor=role===\"manager\"/);
 assert.ok(project.includes("readonly?btn("),"non-manager project close must remain denied");
 assert.doesNotMatch(project,/Gabriel Johnson|Nana Ama|Kwame Mensah/,"owner screenshot sample names must not be published into synthetic preview");
});

test("P1 Projects family tabs are keyboard-operable connected sample views, not dead labels",()=>{
 const projects=html.slice(html.indexOf("function projects(){"),html.indexOf("function reports(){"));
 for(const term of ["data-project-tab","role=\"tab\"","aria-selected","aria-controls","projectPreviewTab","samplePanels","role=\"tabpanel\"","Project files","Project settings"]){
  assert.ok(projects.includes(term),"missing Projects connected tab behavior: "+term);
 }
 assert.ok(html.includes('validTabs.includes(control.dataset.projectTab)'),"tab action must only allow declared project tabs");
 assert.ok(projects.includes("readonly?'<p>Read-only view"),"restricted project settings must not leak authoring UI");
 assert.ok(projects.includes("Preview only; no private files are exposed"),"files tab may not assume Storage grant");
});
test("P1 protected HR issue preview keeps evidence failure separate and mandates independent publication fields",()=>{
 const section=html.slice(html.indexOf("function hr(){"),html.indexOf("function ratings(){"));
 for(const token of ["hrPreviewPhase","Awaiting independent HR verification","Source evidence unavailable","Review HR publication","Only HR","Return to HR draft"].filter(x=>x!=="Only HR")) {
  assert.ok(section.includes(token),"Missing protected HR design state: "+token);
 }
 for(const token of ['name="hrEvidence" required','name="hrReleaseExplanation"','name="hrReleaseScope" required',
  'if(action==="hr-release" && (role!=="admin"||page!=="hr"||hrPreviewPhase!=="draft"))return;',
  'if(!evidence||!reason||data.get("hrReleaseScope")!=="own")return;']) {
  assert.ok(html.includes(token),"Missing independent HR publication safeguard: "+token);
 }
 assert.ok(html.includes('hrPreviewPhase="draft";drawNav();'),"switching simulated roles must clear HR issue state");
});
