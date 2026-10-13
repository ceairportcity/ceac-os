// Dashboard-only operational counts. Employee/payroll population remains in the
// separate authoritative employee roster; login profiles cannot replace it.
// A missing work session is not evidence of absence or grounds for a deduction.
export function summariseAdminToday({ activeProfiles = [], todaySessions = [], activeSessions = [], approvedLeave = [] }) {
  const activeIds = new Set(activeProfiles.map((person) => person?.id).filter(Boolean));
  const known = (row) => Boolean(row?.profile_id && activeIds.has(row.profile_id));
  const startedToday = new Set(todaySessions.filter(known).map((row) => row.profile_id));
  const workingNow = new Set(activeSessions.filter(known).map((row) => row.profile_id));
  const onLeave = new Set(approvedLeave.filter(known).map((row) => row.profile_id));
  // Overnight open sessions are counted as working now, not as lacking a session.
  const noSession = [...activeIds].filter((id) => !startedToday.has(id) && !workingNow.has(id) && !onLeave.has(id));
  return {
    working: workingNow.size,
    leave: onLeave.size,
    notStarted: noSession.length,
    headcount: activeIds.size,
  };
}

export function countRecordedSessionDays(sessions = [], profileId, now = Date.now()) {
  // Accra has UTC calendar dates year-round. A recorded work session is NOT
  // proof of physical attendance or employee-payroll eligibility.
  if (!profileId || !Number.isFinite(now)) return 0;
  const dates = new Set();
  for (const row of Array.isArray(sessions) ? sessions : []) {
    if (row?.profile_id !== profileId || typeof row.started_at !== "string") continue;
    const at = Date.parse(row.started_at);
    if (!Number.isFinite(at) || at > now || at < now - 7 * 864e5) continue;
    dates.add(new Date(at).toISOString().slice(0, 10));
  }
  return dates.size;
}
