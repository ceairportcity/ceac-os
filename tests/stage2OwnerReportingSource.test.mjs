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
 assert.match(app,/onOpenAchievements=\{\(\) => openAchievements\("me"\)\}/);
 assert.match(app,/tab === "achievements"/);
 assert.match(app,/openAchievements\("manager-reports"\)/);
 assert.match(app,/openAchievements\("exec-reports"\)/);
 assert.match(app,/openAchievements\("reporting"\)/);
 assert.doesNotMatch(app,/s2-achievement-entry/);
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
 assert.match(screen,/Distinct projects with recorded evidence/);
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
 assert.match(css,/body \.s2-achievement,body \.s2-achievement \*\{visibility:visible!important\}/);
 assert.match(css,/@page\{size:A4/);
});

test("Manager reports verify period evidence and issued versions before showing actionable numbers",()=>{
 const screen=file("src/screens/ManagerReports.jsx");
 assert.match(screen,/const \[periodRowsState, setPeriodRowsState\]/);
 assert.match(screen,/periodRowsState !== "ready"/);
 assert.match(screen,/periodRowsState === "error"/);
 assert.match(screen,/historyRequestRef\.current/);
 assert.match(screen,/import \{ isIssuedUnitReport \} from/);
 assert.match(screen,/history\.find\(isIssuedUnitReport\)/);
 assert.match(screen,/rows\.find\(isIssuedUnitReport\)/);
 assert.match(screen,/Report evidence is still being verified/);
});

test("P6 quarterly review scheduling prevents duplicate writes and requires server-confirmed event",()=>{
 const source=file("src/components/QuarterlyReviewEventControl.jsx");
 assert.match(source,/const creationPending=useRef\(false\)/);
 assert.match(source,/!allowed\|\|busy\|\|creationPending\.current/);
 assert.match(source,/creationPending\.current=true/);
 assert.match(source,/creationPending\.current=false/);
 assert.match(source,/!result\.data\?\.id\|\|result\.data\.starts_on!==range\.start/);
 assert.match(source,/old\.filter\(row=>row\.id!==result\.data\.id\)/);
 assert.match(source,/Check the schedule before trying again/);
});

test("P6 quarterly review cannot duplicate a scheduled quarter after provider read or write uncertainty",()=>{
 const source=file("src/components/QuarterlyReviewEventControl.jsx");
 assert.match(source,/const recordsVerified=!loading&&!unavailable&&!error/);
 assert.match(source,/const alreadyScheduled=rows\.some\(row=>row\.starts_on===range\.start&&row\.ends_on===range\.end\)/);
 assert.match(source,/!creationPending\.current\|\|!recordsVerified\|\|alreadyScheduled|creationPending\.current\|\|!recordsVerified\|\|alreadyScheduled/);
 assert.match(source,/\{open&&recordsVerified&&<form/);
 assert.match(source,/disabled=\{busy\|\|!recordsVerified\|\|alreadyScheduled/);
 assert.match(source,/Retry quarterly schedule verification/);
 assert.match(source,/onClick=\{\(\)=>setReload\(n=>n\+1\)\}/);
});

test("P6 checks the exact selected quarter independently of the 16-row schedule preview",()=>{
 const source=file("src/components/QuarterlyReviewEventControl.jsx");
 const migration=file("supabase/migrations/20261016183000_152_quarterly_ministry_review_events.sql");
 assert.match(source,/\.order\("starts_on",\{ascending:false\}\)\.limit\(16\)/);
 assert.match(source,/const exactQuarter=await supabase\.from\("quarterly_ministry_review_events"\)/);
 assert.match(source,/\.select\("id"\)\.eq\("org_id",me\.org_id\)/);
 assert.match(source,/\.eq\("starts_on",range\.start\)\.eq\("ends_on",range\.end\)\.limit\(1\)/);
 assert.match(source,/exactQuarter\.error\|\|!Array\.isArray\(exactQuarter\.data\)/);
 assert.match(source,/if\(exactQuarter\.data\.length\)/);
 assert.ok(source.indexOf("const exactQuarter=")<source.indexOf('const result=await supabase.from("quarterly_ministry_review_events").insert('));
 assert.match(migration,/UNIQUE\(org_id,starts_on,ends_on\)/);
});

test("P6 self-report pagination breaks timestamp ties consistently and fails closed on incomplete evidence",()=>{
 const screen=file("src/screens/PersonalAchievements.jsx");
 assert.match(screen,/\.eq\("assignee_id",me\.id\)\.order\("created_at",\{ascending:false\}\)\.order\("id",\{ascending:false\}\)/);
 assert.match(screen,/\.eq\("profile_id",me\.id\)[\s\S]*?\.order\("submitted_at",\{ascending:false\}\)\.order\("id",\{ascending:false\}\)/);
 assert.match(screen,/\.range\(offset,offset\+499\)/);
 assert.match(screen,/Too many records to verify accurately/);
 assert.match(screen,/setCompleteLoad\(false\)/);
 assert.match(screen,/disabled=\{!verifiedLoad\}/);
});

test("P6 personal achievements refuses missing or malformed successful provider pages",()=>{
 const source=file("src/screens/PersonalAchievements.jsx");
 assert.match(source,/if\(!Array\.isArray\(res\.data\)\) throw new Error\("The report source returned incomplete records\."\)/);
 assert.match(source,/found\.push\(\.\.\.res\.data\)/);
 assert.doesNotMatch(source,/found\.push\(\.\.\.\(res\.data\|\|\[\]\)\)/);
 assert.match(source,/if\(alive\)setError\("Report source records could not be verified/);
 assert.match(source,/disabled=\{!verifiedLoad\}/);
});


test("P6 personal report maintains an honest Ghana as-of clock and safe month across long sessions",()=>{
 const screen=file("src/screens/PersonalAchievements.jsx");
 assert.match(screen,/const \[asOf,setAsOf\] = useState\(\(\)=>Date\.now\(\)\)/);
 assert.match(screen,/const today = ghanaDate\(new Date\(asOf\)\)/);
 assert.match(screen,/asOf:new Date\(asOf\)/);
 assert.match(screen,/\[works,submissions,range,projectId,asOf\]/);
 assert.match(screen,/window\.setInterval\(refresh,60000\)/);
 assert.match(screen,/document\.addEventListener\("visibilitychange",refresh\)/);
 assert.match(screen,/window\.addEventListener\("focus",refresh\)/);
 assert.match(screen,/window\.clearInterval\(interval\)/);
 assert.match(screen,/value=\{safePeriod\}/);
 assert.match(screen,/longMonth\(safePeriod\)/);
 assert.doesNotMatch(screen,/longMonth\(period\)/);
});


test("P6 self-only reports suppress old employee/period totals, project names and print access during a changed source read",()=>{
 const screen=file("src/screens/PersonalAchievements.jsx");
 assert.match(screen,/const reportKey = /);
 assert.match(screen,/loadedKey===reportKey && !busy && !error/);
 assert.match(screen,/setLoadedKey\(""\)/);
 assert.match(screen,/setLoadedKey\(reportKey\)/);
 assert.match(screen,/const print = \(\) => \{ if\(verifiedLoad\) window\.print\(\); \}/);
 assert.match(screen,/disabled=\{!verifiedLoad\}/);
 assert.match(screen,/\{verifiedLoad&&projects\.map/);
 assert.match(screen,/\{verifiedLoad && <>/);
});


test("P6 personal reporting hides raw provider diagnostics, validates dates and resets employee-specific project filters",()=>{
 const source=file("src/screens/PersonalAchievements.jsx");
 assert.match(source,/if \(!Number\.isFinite\(parsed\.getTime\(\)\)\) return "Unverified date"/);
 assert.match(source,/typeof date === "string"/);
 assert.match(source,/setProjectId\(""\); \}, \[me\.id,me\.org_id\]/);
 assert.match(source,/const reportKey = `\$\{me\.org_id\}:\$\{me\.id\}/);
 assert.match(source,/\[me\.org_id,me\.id,range\.start,range\.end,retryToken\]/);
 assert.match(source,/Report source records could not be verified\. Retry records or contact Administration\./);
 assert.doesNotMatch(source,/String\(e\.message\|\|"Please retry\."\)/);
 assert.match(source,/Too many records to verify accurately\. Contact Administration for a verified report/);
 assert.doesNotMatch(source,/Narrow the report period or contact Administration/);
});


test("P6 manager evidence refuses truncated 2xx dataset reads and uses Ghana civil boundaries",()=>{
 const source=file("src/screens/ManagerReports.jsx");
 for(const table of ["projects","report_periods","work_items","unit_memberships","objectives","work_sessions","submissions"])
   assert.match(source,new RegExp('supabase\\.from\\("'+table+'"\\)[\\s\\S]*?\\{ count:"exact" \\}'),table);
 assert.match(source,/\[projectResult,periodResult,workResult,memberResult,objectiveResult\]\.every\(fullyRead\)/);
 assert.match(source,/result\.count === result\.data\.length/);
 assert.match(source,/\[sessionResult, submissionResult\]\.every\(complete\)/);
 assert.match(source,/Promise\.resolve\(\{ data: \[\], error: null, count: 0 \}\)/);
 assert.match(source,/new Date\(range\.start \+ "T00:00:00Z"\)/);
 assert.match(source,/new Date\(range\.end \+ "T00:00:00Z"\)/);
 assert.match(source,/void loadPeriodRows\(\)\.catch/);
 assert.match(source,/setPeriodRowsState\("error"\)/);
 assert.match(source,/deadlineOverdue\(row\.due_at, reportAsOf\)/);
 assert.match(source,/setReportAsOf\(Date\.now\(\)\)/);
 assert.doesNotMatch(source,/new Date\(row\.due_at\) < new Date\(\)/);
});

test("P6 manager report version history and evidence links cannot silently truncate a successful provider response",()=>{
 const screen=file("src/screens/ManagerReports.jsx");
 assert.match(screen,/\.select\("id,period_id,scope,unit_id,[^\n]*\{ count:"exact" \}\)/);
 assert.match(screen,/result\.count !== result\.data\.length/);
 assert.match(screen,/setHistoryVerified\(true\)/);
 assert.match(screen,/setHistoryVerified\(false\)/);
 assert.match(screen,/\.select\("id,report_id,section,object_type,object_id,label", \{ count:"exact" \}\)/);
 assert.match(screen,/const request = \+\+refsReadSequence\.current/);
 assert.match(screen,/request !== refsReadSequence\.current/);
 assert.match(screen,/setRefsVerified\(false\)/);
 assert.match(screen,/setRefsVerified\(true\)/);
 assert.match(screen,/if \(!evidence \|\| !historyVerified\) return/);
 assert.match(screen,/if \(\(matchingPeriod && !historyVerified\) \|\| \(viewingFrozen && !refsVerified\)\) return/);
 assert.match(screen,/disabled=\{busy \|\| !historyVerified\} onClick=\{submitReport\}/);
});

test("P6 manager source failures give an explicit retry route instead of unresolved promises or write access",()=>{
 const screen=file("src/screens/ManagerReports.jsx");
 assert.match(screen,/void loadBase\(\)\.catch/);
 assert.match(screen,/void loadHistory\(\)\.catch/);
 assert.match(screen,/Report history not yet verified/);
 assert.match(screen,/Retry report history/);
 assert.match(screen,/submitted versions, edits/i);
 assert.match(screen,/\[me\.id, me\.unit_id, me\.org_id\]/);
});

test("P6 Administration unit-coverage report refuses truncated reads while identifying its intentional 40-period window",()=>{
 const admin=file("src/screens/Reports.jsx");
 assert.match(admin,/report_periods"\)\.select\("\*",\{count:"exact"\}\)/);
 assert.match(admin,/\.limit\(40\)/);
 assert.match(admin,/reports"\)\.select\("[^\n]+,\{count:"exact"\}\)/);
 assert.match(admin,/units"\)\.select\("id, name",\{count:"exact"\}\)/);
 assert.match(admin,/reportResult\.data\.length !== reportResult\.count/);
 assert.match(admin,/unitResult\.data\.length !== unitResult\.count/);
 assert.match(admin,/periodResult\.data\.length > periodResult\.count/);
 assert.match(admin,/setLoadFailed\(true\)/);
 assert.match(admin,/setReports\(\[\]\); setUnits\(\[\]\)/);
 assert.match(admin,/Showing the latest \$\{periods\.length\} of \$\{periodCount\} reporting periods/);
 assert.match(admin,/reportWeekRange\(now\)/);
 assert.match(admin,/reportMonthRange\(now\)/);
 assert.match(admin,/reportAccraDate\(now\)/);
 assert.doesNotMatch(admin,/new Date\(now\.getFullYear\(\), now\.getMonth\(\)/);
});

test("P6 Compliance read surfaces reject partial successful history and never fabricate zero evidence",()=>{
 const screen=file("src/screens/Compliance.jsx");
 for(const name of ["compliance_policy_versions","compliance_policy_applicability","compliance_requirements","compliance_acknowledgements","compliance_evidence_versions","compliance_exception_versions"])
   assert.match(screen,new RegExp('supabase\\.from\\("'+name+'"\\)\\.select\\([\\s\\S]*?\\{count:"exact"\\}\\)'),name);
 assert.match(screen,/const complete=\(result\)=>!result\.error&&Array\.isArray\(result\.data\)/);
 assert.match(screen,/result\.count===result\.data\.length/);
 assert.match(screen,/if\(!results\.every\(complete\)\)/);
 assert.match(screen,/const actorScope=me\.org_id\+":"\+me\.id/);
 assert.match(screen,/actorRef\.current===expectedActor&&readSequence\.current===request/);
 assert.match(screen,/setVerifiedActor\(expectedActor\)/);
 assert.match(screen,/if\(!isVerified\)return <div className="body">/);
 assert.match(screen,/Retry Compliance verification/);
 assert.match(screen,/if\(e\|\|!Array\.isArray\(data\)\)/);
 assert.match(screen,/const reverified=await load\(\)/);
 assert.match(screen,/if\(!reverified\)/);
});

test("P6 Compliance attendance never publishes an old operator's evidence after a new identity or date",()=>{
 const screen=file("src/screens/Compliance.jsx");
 assert.match(screen,/const overviewReadSequence=useRef\(0\)/);
 assert.match(screen,/overviewReadSequence\.current===request/);
 assert.match(screen,/if\(current\(\)\)setAttendanceRows\(data\)/);
 assert.match(screen,/if\(current\(\)\)setOverviewLoading\(false\)/);
 assert.match(screen,/overviewReadSequence\.current\+=1/);
 assert.match(screen,/\[me\.id,me\.org_id,canManage,overviewDate\]/);
});

test("P6 Administration reporting hides previous account and tenant evidence before a new verified read",()=>{
 const admin=file("src/screens/Reports.jsx");
 assert.match(admin,/const actorScope = \[me\.org_id, me\.id\]\.join\(":"\)/);
 assert.match(admin,/currentActorScope\.current = actorScope/);
 assert.match(admin,/const request = \+\+loadSequence\.current/);
 assert.match(admin,/const isCurrent = \(\) => request === loadSequence\.current\s*&& currentActorScope\.current === requestedActor/);
 assert.match(admin,/\[me\.org_id, me\.id\]/);
 assert.match(admin,/return \(\) => \{ loadSequence\.current \+= 1; \}/);
 assert.match(admin,/if \(!isCurrent\(\)\) return;/);
 assert.match(admin,/setLoadedActor\(requestedActor\)/);
 assert.match(admin,/if \(loadedActor !== actorScope \|\| loading\)/);
 assert.match(admin,/setPeriods\(\[\]\); setReports\(\[\]\); setUnits\(\[\]\)/);
 assert.match(admin,/if \(isCurrent\(\)\) setLoading\(false\)/);
 assert.match(admin,/if \(currentActorScope\.current !== writingActor\) return;/);
 assert.match(admin,/\.eq\("org_id", me\.org_id\)\.eq\("status", period\.status\)/);
 assert.match(admin,/\.select\("id,status"\)\.single\(\)/);
 assert.match(admin,/if \(error \|\| data\?\.id !== period\.id \|\| data\.status !== status\)/);
});
