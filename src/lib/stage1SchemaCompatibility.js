const text = (error) => String(error?.message || error?.details || error?.hint || "").toLowerCase();

const missingSchemaObject = (error) => {
  const code = String(error?.code || "").toUpperCase();
  return ["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(code)
    || /does not exist|schema cache|could not find/.test(text(error));
};

export function isMissingPersonalPlanningSchema(error) {
  if (!missingSchemaObject(error)) return false;
  return [
    "personal_day_tasks",
    "personal_day_task_checklist",
    "personal_day_notes",
    "personal_calendar_events",
    "personal_task_series",
    "personal_materialize_task_series",
  ].some((name) => text(error).includes(name));
}

export function isMissingAnnualLeaveStageSchema(error) {
  if (!missingSchemaObject(error)) return false;
  return ["working_days", "working_days_basis", "workforce_annual_leave_summary"]
    .some((name) => text(error).includes(name));
}

export function isMissingAttendanceEvidenceStageSchema(error) {
  if (!missingSchemaObject(error)) return false;
  return [
    "attendance_corroboration_for_day",
    "attendance_integrity_status",
    "attendance_verify_office_code",
  ].some((name) => text(error).includes(name));
}

export function isMissingTechnicalSupportStageSchema(error) {
  if (!missingSchemaObject(error)) return false;
  return [
    "support_access_requests",
    "support_access_events",
    "support_case_events",
    "support_case_safe_status",
    "support_cases",
    "support_membership_events",
    "support_team_memberships",
  ].some((name) => text(error).includes(name));
}

export function isMissingVolunteerNoticeSchema(error) {
  return missingSchemaObject(error) && text(error).includes("volunteer_engagement_notices");
}

export function isMissingVolunteerManagementSchema(error) {
  if (!missingSchemaObject(error)) return false;
  return ["volunteer_working_pattern_versions", "volunteer_change_recommendations"]
    .some((name) => text(error).includes(name));
}

export function isMissingVolunteerInvitationSchema(error) {
  if (!missingSchemaObject(error)) return false;
  const message = text(error);
  return message.includes("pending_invitations") && [
    "engagement_type",
    "engagement_working_pattern",
  ].some((name) => message.includes(name));
}
