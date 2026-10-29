// Technical Support language/triage is deliberately independent of normal Work
// and contains no employee-performance or infrastructure scoring.
export const HELP_CATEGORIES = Object.freeze([
  { id: "cannot_sign_in", label: "I cannot sign in" },
  { id: "something_not_working", label: "Something is not working" },
  { id: "cannot_upload", label: "I cannot upload something" },
  { id: "access_needed", label: "I need access to something" },
  { id: "information_looks_wrong", label: "My information looks wrong" },
  { id: "other", label: "Something else" },
]);

export const SUPPORT_WORKSPACES = Object.freeze([
  { id: "home", label: "Home" },
  { id: "help-desk", label: "Help Desk" },
  { id: "people-access", label: "People & Access" },
  { id: "system", label: "System" },
  { id: "improvements", label: "Improvements" },
  { id: "guides", label: "Guides" },
]);

export const SERVICE_NAMES = Object.freeze([
  "CEAC platform", "Sign in & accounts", "Files & uploads",
  "Invitations & email", "Automatic jobs", "Backup & recovery", "Connected services",
]);

export const SUPPORT_GUIDES = Object.freeze([
  ["Help someone who cannot sign in", "Check whether they received an invitation or password-recovery message. Ask Administration to verify their approved account state. Never request a password or verification code."],
  ["Help a new person join CEAC", "Check invitation delivery and whether the expected account is active. Escalate a missing or incorrect role to People Administration."],
  ["Add or remove approved access", "Record the access requested and its business approver. Do not grant, revoke or execute access changes until the underlying authority process records approval."],
  ["Handle someone leaving", "Refer the departure to Administration & HR. Follow the approved access-revocation process and preserve work history and attribution."],
  ["Check whether CEAC is working", "Review the verified service signals and recent affected cases. If no trusted signal is connected, report status as unverified."],
  ["Respond when something looks unsafe", "Limit sharing of affected information, record factual symptoms and escalate to the designated security decision-maker."],
  ["Check the latest backup", "Locate the owner-verified backup and restoration evidence. Encryption or a checksum alone is not proof of restorability."],
  ["Recover after a failed update", "Identify the release and approved recovery plan. Never restore production or roll back a database without release authority."],
  ["Handle a failed integration", "Check approved connection health and non-secret failure metadata; escalate permissions or provider configuration changes."],
  ["Change a technical key safely", "Request an approved owner-controlled rotation, use the designated secret manager and avoid putting credentials into support cases."],
  ["Escalate a suspected security incident", "Record when, what service and what impact are known; notify the designated security lead without sharing confidential record contents."],
]);

export function supportCategoryLabel(id) {
  return HELP_CATEGORIES.find((entry) => entry.id === id)?.label || "Technical support";
}

export function canManageSupport(me) {
  // UI affordance only; server-side capability, membership and RLS are authoritative.
  return Boolean(me?.capabilities?.includes("support.case.manage"));
}

export function isUnresolved(caseRecord) {
  return caseRecord?.state !== "resolved" && caseRecord?.state !== "closed";
}

export function supportCaseGroups(cases = []) {
  const known = Array.isArray(cases) ? cases : [];
  return {
    attention: known.filter((item) => isUnresolved(item) && item.state !== "waiting_approval"),
    waitingApproval: known.filter((item) => item.state === "waiting_approval"),
    recentlyResolved: known.filter((item) => item.state === "resolved" || item.state === "closed").slice(0, 6),
    access: known.filter((item) => item.category === "access_needed" || item.category === "cannot_sign_in"),
    recurring: HELP_CATEGORIES.map((category) => ({
      ...category, cases: known.filter((item) => item.category === category.id),
    })).filter((category) => category.cases.length >= 2),
  };
}

export function filterSupportCases(cases = [], query = "", status = "all") {
  // A presentation-only filter over an already-authorised and bounded result.
  const needle = String(query || "").trim().toLocaleLowerCase();
  return (Array.isArray(cases) ? cases : []).filter((item) => {
    if (status !== "all" && item.state !== status) return false;
    return !needle || [item.summary, item.reference, item.reporter_name, item.affected_name, item.department_name, supportCategoryLabel(item.category)]
      .some((value) => String(value || "").toLocaleLowerCase().includes(needle));
  });
}

export function supportCasesNeedingMe(cases = [], profileId) {
  // Organisation queues can include cases held by other support operators.
  // The personal "Needs you" queue must not mislabel their assignments.
  return (Array.isArray(cases) ? cases : []).filter((item) =>
    isUnresolved(item)
    && item.state !== "waiting_approval"
    && (!item.assigned_to || (profileId && item.assigned_to === profileId))
  );
}

export function supportUnavailableMessage(error) {
  // An undeployed backend must not be reported as an empty Help Desk or as
  // a missing personal permission. No automatic schema writes are attempted.
  const code = String(error?.code || "");
  return code === "42P01" || code === "PGRST205"
    ? "Technical Support requests are not enabled in this environment. Use the currently approved CEAC support contact until the secured service is activated."
    : null;
}

export function canRecordSupportOutcome(caseRecord, nextState, recordedAccess = null) {
  // UI convenience only. The PostgreSQL case guard independently requires
  // approved, immutable business/technical evidence in the same organisation.
  if (caseRecord?.category !== "access_needed"
    || (nextState !== "resolved" && nextState !== "closed")) return true;
  return Boolean(recordedAccess?.state === "executed"
    && recordedAccess.approved_by && recordedAccess.executed_by
    && recordedAccess.approved_by !== recordedAccess.executed_by
    && typeof recordedAccess.execution_reference === "string"
    && recordedAccess.execution_reference.trim().length >= 8
    && recordedAccess.case_id === caseRecord.id);
}


export function supportReportedServiceIssues(cases = [], services = SERVICE_NAMES) {
  // Reporting facts are not telemetry. A self-reported incident must never
  // make a service's unverified operational health read as Working or Down.
  const known = Array.isArray(cases) ? cases : [];
  return (Array.isArray(services) ? services : []).map((service) => ({
    service,
    reportCount: known.filter((item) => item
      && item.affected_service === service
      && item.state !== "resolved" && item.state !== "closed").length,
    health: "Not verified",
  }));
}
