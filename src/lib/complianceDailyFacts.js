/** A factual snapshot from the already-authorised attendance_day_evidence response.
 * Never infer misconduct, hours worked, lateness or a payroll action.
 * Attendance belongs to the person, even when several departments list them.
 */
export function complianceDailyFacts(rows, date) {
  if (!Array.isArray(rows) || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const people = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object") return null;
    const key = row.profile_id ? `profile:${row.profile_id}` : row.employee_id ? `employee:${row.employee_id}` : null;
    // An unidentifiable row cannot safely contribute to a supposedly complete count.
    if (!key) return null;
    if (!people.has(key)) people.set(key, { scheduled: false, sessions: new Set(), open: false, leave: false });
    const person = people.get(key);
    person.scheduled ||= row.expected_today === true;
    for (const session of Array.isArray(row.sessions) ? row.sessions : []) {
      if (!session?.started_at) continue;
      person.sessions.add(session.id || session.started_at);
      if (!session.ended_at) person.open = true;
    }
    if ((Array.isArray(row.approved_leave) ? row.approved_leave : []).some(leave =>
      leave?.state === "current" && leave.start_date <= date && leave.end_date >= date
    )) person.leave = true;
  }
  const entries = [...people.values()];
  return {
    people: entries.length,
    scheduled: entries.filter(person => person.scheduled).length,
    recordedStarts: entries.filter(person => person.sessions.size > 0).length,
    noStartRecorded: entries.filter(person => person.scheduled && person.sessions.size === 0).length,
    approvedLeave: entries.filter(person => person.leave).length,
    openSessions: entries.filter(person => person.open).length,
  };
}
