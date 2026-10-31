import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (path) => readFileSync(path, "utf8");
const admin = file("src/screens/AdminHome.jsx");
const adminView = file("src/experience-v2/admin-overview/AdminOverviewV2.jsx");
const access = file("src/components/PeopleAccess.jsx");
const auth = file("src/lib/supabase.js");
const help = file("src/screens/TechnicalHelp.jsx");
const support = file("src/screens/TechnicalSupport.jsx");
const app = file("src/App.jsx");
const people = file("src/screens/People.jsx");
const workforce = file("src/screens/Workforce.jsx");
const attendanceCorrectionWorkflow = file("src/components/AttendanceCorrectionWorkflow.jsx");
const compensation = file("src/lib/protectedCompensation.js");
const notificationBrowser = file("tests/notification-work-state-phase4.spec.js");

test("global search returns authorised account-only people using the live profile schema", async () => {
  // These are ordinary live-schema profile fields. A department belongs to
  // unit_memberships, not profiles; a bad projection must not erase people.
  const profileFields = new Set(["id", "full_name", "job_title", "active"]);
  const reads = [];
  const person = { id: "profile-1", full_name: "Search Person", job_title: "Coordinator", active: true };
  const client = {
    from(table) {
      const request = { table, fields: "", filters: [], limit: null };
      reads.push(request);
      const builder = {
        select(fields) { request.fields = fields; return this; },
        eq(...filter) { request.filters.push(filter); return this; },
        ilike(...filter) { request.filters.push(filter); return this; },
        limit(value) { request.limit = value; return this; },
        order() { return this; },
        then(resolve, reject) {
          const invalid = table === "profiles" && request.fields.split(",").some((field) => !profileFields.has(field));
          const result = invalid
            ? { data: null, error: { code: "42703", message: "Unknown profile column" } }
            : { data: table === "profiles" ? [person] : [], error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
    rpc() { throw new Error("Non-administrative search must not read the HR roster"); },
  };
  const source = file("src/lib/globalSearch.js")
    .replace(/^import \{ supabase \} from "\.\/supabase";\s*/, "")
    .replace("export async function searchCeacRecords", "async function searchCeacRecords");
  const search = new Function("supabase", source + "\nreturn searchCeacRecords;")(client);
  const groups = await search({ query: "Search", me: { id: "actor", org_id: "org-1" } });
  assert.deepEqual(groups.find((entry) => entry.key === "people")?.items, [{
    kind: "person", id: person.id, profileId: person.id, employeeId: null,
    title: person.full_name, meta: person.job_title, icon: "people",
  }]);
  const profileRead = reads.find((request) => request.table === "profiles");
  assert.ok(profileRead.filters.some(([key, value]) => key === "org_id" && value === "org-1"));
  assert.ok(profileRead.filters.some(([key, value]) => key === "full_name" && value === "%Search%"));
  assert.equal(profileRead.limit, 6);
});

test("credentialed Playwright collection is safe when private fixtures are absent", () => {
  assert.match(notificationBrowser, /const hasFixtureEnvironment = Boolean/);
  assert.match(notificationBrowser, /hasFixtureEnvironment \? createClient/);
  assert.match(notificationBrowser, /test\.skip\(!hasFixtureEnvironment/);
});

test("Administration only presents verified counts for its current identity", () => {
  assert.match(admin, /\[me\.id, me\.org_id\]/);
  assert.match(admin, /readGeneration\.current \+= 1/);
  assert.match(admin, /generation !== readGeneration\.current/);
  assert.match(admin, /loadedScope !== scopeKey/);
  assert.match(admin, /loading=\{scopedLoading\}/);
  assert.match(admin, /countRecordedSessionDays\(sessWeek, person\.id, now\)/);
  assert.match(admin, /work sessions opened on/);
  assert.doesNotMatch(admin, /present on /);
  assert.match(adminView, /label="Open work sessions"/);
  assert.match(adminView, /Not verified live presence/);
  assert.match(adminView, /Current meeting information could not be verified/);
});

test("People & Access never displays a previous account's roster after switching", () => {
  assert.match(access, /snapshotScope !== scopeKey/);
  assert.match(access, /const generation = \+\+loadGeneration\.current/);
  assert.match(access, /generation !== loadGeneration\.current/);
  assert.match(access, /setSnapshot\(null\)/);
  assert.match(access, /\[me\.id, me\.org_id, canManage\]/);
  assert.match(access, /rpc\("admin_set_work_lane_membership"/);
  assert.match(access, /alreadyHasResponsibility/);
  assert.match(access, /belongsToSelectedUnit/);
});

test("Invitation email delivery is never confused with a stored invitation", () => {
  assert.match(auth, /class InvitationDeliveryUnconfirmedError/);
  assert.match(auth, /this\.invitationRecorded = true/);
  assert.match(auth, /throw new InvitationDeliveryUnconfirmedError\("new"\)/);
  assert.match(auth, /throw new InvitationDeliveryUnconfirmedError\("resend"\)/);
  assert.match(access, /actionError\?\.invitationRecorded/);
  assert.match(access, /invitationEmailConflicts\(form\.email/);
  assert.match(access, /existingAccountEmail \|\| existingInvitationEmail/);
  assert.match(access, /Delivery is not yet independently confirmed/);
});

test("Reporters cannot inherit cases from another login or invent a success", () => {
  assert.match(help, /visibleCases = loadedScope === currentScope \? cases : \[\]/);
  assert.match(help, /scopedLoading = loading \|\| loadedScope !== currentScope/);
  assert.match(help, /generation !== readGeneration\.current/);
  assert.match(help, /from\("support_case_safe_status"\)/);
  assert.doesNotMatch(help, /from\("support_cases"\)\s*\.select/);
  assert.match(help, /Your request could not be confirmed/);
  assert.doesNotMatch(help, /support_case_events/);
});

test("Technical Support cannot show stale authorisation or close access without business evidence", () => {
  assert.match(support, /scopedReady = ready && verifiedScope === currentScope/);
  assert.match(support, /\[me\.id, me\.org_id, canManage\]/);
  assert.match(support, /generation !== readGeneration\.current/);
  assert.match(support, /canRecordSupportOutcome\(currentCase, state, accessLedger\)/);
  assert.match(support, /onUpdate\(item\.id, nextState, resolution, item\.updated_at, accessLedger\)/);
  assert.match(support, /\.eq\("updated_at", expectedUpdatedAt\)/);
  assert.match(support, /\.is\("assigned_to", null\)/);
  assert.match(support, /\.eq\("assigned_to", me\.id\)/);
  assert.match(support, /\.not\("state", "in", "\(resolved,closed\)"\)/);
  assert.doesNotMatch(support, /auth\.admin/);
});

test("expired invitations remain visible for authorised follow-up but revoked ones do not", () => {
  assert.match(admin, /\.from\("pending_invitations"\)/);
  assert.match(admin, /\.is\("resolved_at",null\)\.is\("revoked_at",null\)/);
  assert.doesNotMatch(admin, /\.gt\("expires_at"/);
  assert.match(adminView, /expiredInvitationCount/);
  assert.match(adminView, /Invitations to review/);
  assert.match(access, /Outstanding and expired invitations require follow-up/);
});

test("invitation entry is validated before the record-creating RPC", () => {
  assert.match(auth, /isPlausibleInvitationEmail\(cleanEmail\)/);
  assert.match(auth, /cleanName\.length < 2/);
  assert.match(access, /isPlausibleInvitationEmail\(form\.email\)/);
  assert.match(access, /existingAccountEmail \|\| existingInvitationEmail/);
});

test("People and Access mutations are single-flight and identity-generation scoped", () => {
  assert.match(access, /const identityGeneration = useRef\(0\)/);
  assert.match(access, /const actionBusyRef = useRef\(false\)/);
  assert.match(access, /if \(actionBusyRef\.current \|\| busy \|\| !canManage \|\| snapshotScope !== scopeKey\) return false/);
  assert.match(access, /const identity = identityGeneration\.current/);
  assert.match(access, /const sameIdentity = \(\) => identity === identityGeneration\.current/);
  assert.match(access, /if \(!sameIdentity\(\)\) return true/);
  assert.match(access, /if \(sameIdentity\(\)\) \{\s*actionBusyRef\.current = false;\s*setBusy\(false\)/);
  assert.match(access, /return recorded \|\| Boolean\(actionError\?\.invitationRecorded\)/);
});

test("Technical Support case revisions and case history can recover without false success", () => {
  assert.match(support, /onRefresh=\{refreshCases\}/);
  assert.match(support, /onClick=\{onRefresh\}>Refresh case/);
  assert.match(support, /setHistory\(\[\]\)/);
  assert.match(support, /setHistoryError\(null\)/);
  assert.match(support, /if \(failure\) throw failure/);
  assert.match(support, /Case history could not be verified/);
  assert.match(support, /setHistoryRefreshToken\(\(n\) => n \+ 1\)/);
  assert.match(support, /historyRefreshToken\]/);
});

test("attendance decisions and reporter submissions are single-flight", () => {
  assert.match(admin, /const leaveActionBusyRef = useRef\(false\)/);
  assert.match(admin, /if \(busy \|\| scopedLoading \|\| loadError \|\| leaveActionBusyRef\.current\) return/);
  assert.match(admin, /leaveActionBusyRef\.current = true/);
  assert.match(admin, /leaveActionBusyRef\.current = false/);
  assert.match(help, /const submitBusyRef = useRef\(false\)/);
  assert.match(help, /if \(busy \|\| scopedLoading \|\| loadError \|\| submitBusyRef\.current\) return/);
  assert.match(help, /submitBusyRef\.current = true/);
  assert.match(help, /submitBusyRef\.current = false/);
});

test("all Administration direct reads have explicit organisation scope", () => {
  const queries = [...admin.matchAll(/\.from\("([a-z_]+)"\)\s*\.select\("[^"]*"\)/g)];
  const scoped = [...admin.matchAll(/\.from\("([a-z_]+)"\)\s*\.select\("[^"]*"\)\s*\.eq\("org_id",\s*me\.org_id\)/g)];
  assert.equal(queries.length, 25, "the expected Administration data-query inventory changed");
  assert.match(admin, /from\("announcements"\)\.select\("id,title,published_at,expires_at"\)\s*\.eq\("org_id",\s*me\.org_id\)/);
  assert.equal(scoped.length, queries.length, "a direct Administration query lacks current-organisation filtering");
  assert.match(admin, /from\("profiles"\)\.select\("id,full_name"\)\.eq\("org_id", me\.org_id\)/);
  assert.match(admin, /from\("work_sessions"\)\.select\("profile_id"\)\.eq\("org_id", me\.org_id\)/);
});

test("Administration invitation attention opens actual People and Access Invitations tab", () => {
  assert.match(app, /openPeopleAccess=\{openPeopleAccess\}/);
  assert.match(admin, /onOpenInvitations=\{\(\) => openPeopleAccess\?\.\(\{ mode: "invitations" \}\)\}/);
  assert.match(adminView, /action: onOpenInvitations/);
  assert.match(adminView, /pendingInvitations\.length && canManagePeople \? <AdminActionRow/);
  assert.match(adminView, /onClick=\{onOpenInvitations\}/);
  assert.match(people, /setViewMode\("access"\)/);
  assert.match(people, /initialMode=\{accessFocusMode\}/);
});

test("Administration never renders previous-account calendar or roster before role verification", () => {
  assert.match(admin, /const verifiedSnapshot = loadedScope === scopeKey && !loading && !loadError/);
  assert.match(admin, /humanError\(error, "Administration records could not be verified/);
  for (const key of ["units", "alerts", "blockers", "leaveQueue", "checks", "mine", "watch", "meetings", "employeeRoster", "pendingInvitations"]) {
    assert.ok(admin.includes(key + "={verifiedSnapshot ? " + key + " : []}"), key + " must not leak previous-account data");
  }
  assert.match(admin, /message=\{verifiedSnapshot \? msg : null\}/);
  assert.match(admin, /payrollReadiness=\{verifiedSnapshot \? payrollReadiness : null\}/);
});

test("sensitive workspaces remount when the authorised account changes", () => {
  for (const component of ["TechnicalHelp", "TechnicalSupport", "AdminHome", "People", "AdminProtectedHR", "AdminPayroll"]) {
    const opening = new RegExp("<" + component + "\\s+[\\s\\S]{0,85}?key=\\{\\x60\\$\\{me\\.org_id\\}:\\$\\{me\\.id\\}\\x60\\}");
    assert.match(app, opening, component + " must not retain previous-account React state");
  }
  assert.match(app, /<Workforce key=/);
  assert.match(app, /me\.unit_id \|\| "none"/);
  assert.match(app, /me\.role \|\| "none"/);
  assert.match(app, /me\.is_admin \? "admin" : "not-admin"/);
  assert.match(app, /me\.is_exec \? "exec" : "not-exec"/);
});

test("Workforce attendance and protected employment reads have explicit tenant scope", () => {
  const queries = [...workforce.matchAll(/\.from\("([a-z_]+)"\)\s*\.select\("[^"]*"\)/g)];
  const scoped = [...workforce.matchAll(/\.from\("([a-z_]+)"\)\s*\.select\("[^"]*"\)\s*\.eq\("org_id",\s*me\.org_id\)/g)];
  assert.equal(queries.length, 13, "unexpected Workforce query inventory");
  assert.equal(scoped.length, queries.length, "an attendance or confidential Workforce query lacks organisation scope");
  assert.match(workforce, /\.from\("employment_records"\).*\.eq\("org_id",me\.org_id\)/);
  assert.match(workforce, /\.from\("work_sessions"\).*\.eq\("org_id",me\.org_id\)/);
});

test("Workforce calendar uses Ghana dates rather than the operator's local clock", () => {
  assert.match(workforce, /import \{ accraDayOffset \} from "\.\.\/lib\/workforceDate"/);
  assert.match(workforce, /const d=accraDayOffset\(i\)/);
  assert.match(workforce, /date\+"T00:00:00Z"\)\.getUTCDay\(\)/);
  assert.match(workforce, /timeZone:"Africa\/Accra",hour:"2-digit"/);
});

test("Workforce renders every historical session date in Accra, not the viewer's timezone", () => {
  const dates = workforce.match(/new Date\(session\.started_at\)\.toLocaleDateString\("en-GB",\{timeZone:"Africa\/Accra",/g) || [];
  assert.equal(dates.length, 8);
  assert.doesNotMatch(workforce, /\.toLocaleString\("en-GB"\)/);
});

test("Workforce dataset failures cannot leave the console on stale or unverified rows", () => {
  assert.match(workforce, /settleWorkforceDatasets\(datasets\)/);
  assert.match(workforce, /setPeople\(!byName\.people\.error/);
  assert.match(workforce, /setSessions\(!byName\.sessions\.error/);
  assert.match(workforce, /setLeave\(!byName\.leave\.error/);
  assert.match(workforce, /setPolicies\(!byName\["leave policies"\]\.error/);
  assert.match(workforce, /setOffice\(!byName\["office location"\]\.error/);
  assert.match(workforce, /setDatasetErrors\(errors\)/);
  assert.match(workforce, /setLoading\(false\)/);
});

test("Workforce sensitive mutations cannot double-submit or strand loading on RPC errors", () => {
  assert.match(workforce, /const mutationBusyRef=useRef\(false\)/);
  assert.match(workforce, /if\(mutationBusyRef\.current \|\| busy \|\| loading\) return false/);
  assert.match(workforce, /mutationBusyRef\.current=true/);
  assert.match(workforce, /let recorded=false/);
  assert.match(workforce, /recorded=true/);
  assert.match(workforce, /catch \(failure\)/);
  assert.match(workforce, /mutationBusyRef\.current=false/);
  assert.match(workforce, /setBusy\(false\)/);
});

test("Attendance writes are unavailable while required current evidence has failed", () => {
  assert.match(workforce, /const unavailable=requiredDatasets\.filter\(\(dataset\)=>datasetErrors\[dataset\]\)/);
  assert.match(workforce, /if\(unavailable\.length\)\{/);
  assert.match(workforce, /Required Workforce records are currently unavailable/);
  assert.match(workforce, /<AttendanceCorrectionWorkflow me=\{me\} \/>/);
  assert.match(attendanceCorrectionWorkflow, /if \(writeLock\.current \|\| !ready \|\| unavailable\) return/);
  for (const rpc of ["attendance_request_correction","attendance_manager_decide_correction","attendance_hr_audit_correction"]) {
    assert.match(attendanceCorrectionWorkflow, new RegExp('supabase\\.rpc\\("'+rpc+'"'));
  }
  assert.match(attendanceCorrectionWorkflow, /No original work session was changed/);
  assert.match(workforce, /"Leave decision recorded\.",\["leave","leave history","my leave balances"\]/);
  assert.match(workforce, /"Confirmed leave policy activated\.",\["leave policies","leave policy rules"\]/);
});

test("Workforce provides a retry path after failed data reads in every role view", () => {
  const retries = workforce.match(/Retry Workforce data<\/Button>/g) || [];
  assert.equal(retries.length, 4);
  assert.match(workforce, /onClick=\{\(\)=>void load\(\)\}/);
  assert.match(workforce, /Required Workforce records are currently unavailable/);
});

test("HR leave policy activation cannot silently convert invalid numeric values to null", () => {
  assert.match(workforce, /import \{ isValidPolicyAmount \} from "\.\.\/lib\/workforcePolicyNumbers"/);
  assert.match(workforce, /&& isValidPolicyAmount\(policyEntitlement\)/);
  assert.match(workforce, /isValidPolicyAmount\(policyAccrualRate\)/);
  assert.match(workforce, /isValidPolicyAmount\(policyCarryoverLimit\)/);
  assert.doesNotMatch(workforce, /Number\(policyEntitlement\)>=0/);
});

test("Support status changes can only be saved by their current assigned technician", () => {
  assert.match(support, /if \(currentCase\.assigned_to !== me\.id\)/);
  assert.match(support, /\.eq\("updated_at", expectedUpdatedAt\)\s*\.eq\("assigned_to", me\.id\)/);
  assert.match(support, /disabled=\{busy \|\| item\.assigned_to !== myId\}/);
  assert.match(support, /Cases assigned to another technician are read-only/);
});

test("Technical Help validates the draft before taking its submission lock", () => {
  const validation = help.indexOf('if (title.length < 8 || details.length < 12)');
  const lock = help.indexOf('submitBusyRef.current = true;', validation);
  const request = help.indexOf('setBusy(true);', validation);
  assert.ok(validation >= 0 && lock > validation && request > lock);
  assert.match(help, /if \(title\.length < 8 \|\| details\.length < 12\) \{\s*setError\([\s\S]*?return;/);
});

test("Technical Support event history is scoped by organisation and case", () => {
  assert.match(support, /\.select\("id,action,note,occurred_at"\)\.eq\("org_id", orgId\)\.eq\("case_id", item\.id\)/);
  assert.match(support, /orgId=\{me\.org_id\}/);
  assert.match(support, /if \(currentCase\.assigned_to !== me\.id\)/);
});

test("unit responsibility removal confirms the server-side dependent team cleanup", () => {
  assert.match(access, /const stillInUnitTeam = selectedLaneMemberships\.some/);
  assert.match(access, /lane\.unit_id === membership\.unit_id/);
  assert.match(access, /setEndMembershipTarget\(\{/);
  assert.match(access, /removes all team placements for that unit/);
  assert.match(access, /saveResponsibility\("remove", target\.membership, target\.personId, target\.reason\)/);
  assert.doesNotMatch(access, /disabled=\{busy \|\| stillInUnitTeam/);
});

test("People directory and protected employee details reject stale navigation responses", () => {
  assert.match(people, /const rosterGeneration = useRef\(0\)/);
  assert.match(people, /const personGeneration = useRef\(0\)/);
  assert.match(people, /generation !== rosterGeneration\.current/);
  assert.match(people, /generation !== personGeneration\.current/);
  assert.match(people, /personGeneration\.current \+= 1/);
  assert.match(people, /if \(!initialEmployeeId \|\| !rows\.length \|\| person \|\| accessIntent\) return/);
  assert.match(people, /setProtectedHr\(null\)/);
  assert.match(people, /People records could not be verified/);
  assert.match(people, /This employee's current record could not be verified/);
});

test("People confidential writes are account-scoped and cannot falsely succeed", () => {
  assert.match(people, /protectedWriteBusy\.current = true/);
  assert.match(people, /employmentWriteBusy\.current = true/);
  assert.match(people, /recommendationWriteBusy\.current = true/);
  assert.match(people, /value\?\.employee_id === employeeId/);
  assert.match(people, /if \(!data\) throw new Error/);
  assert.match(people, /\.maybeSingle\(\)/);
});

test("People file reads never cross between two employee records", () => {
  assert.match(people, /const employeeFileWriteBusy = useRef\(false\)/);
  assert.match(people, /employeeFileWriteBusy\.current = true/);
  assert.match(people, /if \(generation !== personGeneration\.current\) return/);
  assert.match(people, /async function refreshEmployeeFiles\(employeeId, generation\)/);
  assert.match(people, /await refreshEmployeeFiles\(person\.id, generation\)/);
  assert.match(people, /employeeFileWriteBusy\.current = false/);
});

test("People attendance facts and invitation records have Accra-local timestamps", () => {
  assert.match(people, /\.toLocaleTimeString\("en-GB", \{ timeZone: "Africa\/Accra"/);
  assert.match(people, /\.toLocaleDateString\("en-GB", \{ timeZone: "Africa\/Accra"/);
  assert.match(people, /new Date\(accessInvitation\.invited_at\)\.toLocaleString\("en-GB", \{ timeZone: "Africa\/Accra" \}\)/);
});

test("People Access propagates failed roster refreshes after a successful mutation", () => {
  assert.match(people, /return false;/);
  assert.match(people, /return true;/);
  assert.match(people, /onChanged=\{async \(\) => \{ if \(!\(await load\(\{ silent: true \}\)\)\) throw new Error/);
});

test("People roster fails closed on unsuccessful RPC reads and offers recovery", () => {
  assert.match(people, /const \[verifiedRosterScope, setVerifiedRosterScope\] = useState\(null\)/);
  assert.match(people, /setVerifiedRosterScope\(scopeKey\)/);
  assert.match(people, /setVerifiedRosterScope\(null\)/);
  assert.match(people, /if \(verifiedRosterScope !== scopeKey\) return/);
  assert.match(people, /Retry People records/);
});

test("protected employee compensation never accepts overflowing minor-unit arithmetic", () => {
  assert.match(people, /protectedMoney, amountToMinor/);
  assert.match(compensation, /Number\.isSafeInteger\(Math\.round\(minor\)\)/);
  assert.match(compensation, /if \(!Number\.isSafeInteger\(amount\)\) return "Amount could not be verified"/);
  assert.match(compensation, /return "Currency could not be verified"/);
});


test("P5 cross-role project reader fails closed on truncated or malformed successful provider results",()=>{
 const s=file("src/components/Stage2ProjectReader.jsx");
 assert.match(s,/project_units"\)\s*\.select\("[^"]+", \{ count:"exact" \}\)/);
 assert.match(s,/project_phases"\)\.select\("[^"]+", \{ count:"exact" \}\)/);
 assert.match(s,/project_milestones"\)\.select\("[^"]+", \{ count:"exact" \}\)/);
 assert.match(s,/result\.count === result\.data\.length/);
 assert.match(s,/\[participation,phases,work\]\.every\(fullyRead\)/);
 assert.match(s,/milestonesVerified \? milestones\.data : null/);
 assert.doesNotMatch(s,/participants: participation\.data \|\| \[\]/);
});
test("P5 project work indicators respect exact Ghana deadlines and refresh on an open screen",()=>{
 const s=file("src/components/Stage2ProjectOverview.jsx");
 assert.match(s,/import \{ deadlineOverdue \} from/);
 assert.match(s,/deadlineOverdue\(row\.due_at, asOf\)/);
 assert.match(s,/window\.setInterval\(refresh, 60000\)/);
 assert.match(s,/document\.addEventListener\("visibilitychange", refresh\)/);
 assert.match(s,/<span>Work completed<\/span>/);
 assert.match(s,/<span>Departments involved<\/span>/);
 assert.doesNotMatch(s,/new Date\(row\.due_at\) < new Date\(\)/);
});


test("P5 versioned project closure refuses missing or truncated readback of costs and historical evidence",()=>{
 const screen=file("src/screens/ManagerProjectClose.jsx");
 assert.match(screen,/!Array\.isArray\(reopenResult\.data\)/);
 assert.match(screen,/!Array\.isArray\(readyResult\.data\)/);
 assert.match(screen,/costResult\.count !== costResult\.data\.length/);
 assert.match(screen,/costResult\.data\.forEach/);
 assert.match(screen,/project_close_objectives"\)[\s\S]*?\{ count: "exact" \}/);
 assert.match(screen,/project_close_deliverables"\)[\s\S]*?\{ count: "exact" \}/);
 assert.match(screen,/\[objectiveResult, deliverableResult, costResult\]\.every\(complete\)/);
 assert.match(screen,/setHistoryClose\(null\); setBusy\(true\); setError\(null\)/);
 assert.doesNotMatch(screen,/objectives: objectiveResult\.data \|\| \[\]/);
 assert.doesNotMatch(screen,/deliverables: deliverableResult\.data \|\| \[\]/);
});
