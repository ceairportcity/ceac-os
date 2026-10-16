// Stage 2 factual reporting contract. No scoring, ranking or HR appraisal inference.
// Dates are Africa/Accra calendar dates; never use browser-local date boundaries.
const COMPLETE = new Set(["completed", "self_certified"]);
const OMIT = new Set(["cancelled"]);
const zoneFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit",
});
export function ghanaDate(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  const parts = Object.fromEntries(zoneFormatter.formatToParts(timestamp)
    .filter((x) => ["year","month","day"].includes(x.type)).map((x) => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function dayNumber(date) { return Number(String(date).slice(8,10)); }
function yearMonth(date) { return String(date).slice(0,7); }
export function reportingRange(cadence, date = ghanaDate(new Date())) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !["monthly", "quarterly"].includes(cadence))
    throw new Error("Choose a valid Ghana reporting month or quarter.");
  const [year, month] = date.split("-").map(Number);
  if (year < 2000 || month < 1 || month > 12 || dayNumber(date) > new Date(Date.UTC(year, month, 0)).getUTCDate())
    throw new Error("Invalid reporting period.");
  const firstMonth = cadence === "quarterly" ? 1 + Math.floor((month - 1) / 3) * 3 : month;
  const lastMonth = cadence === "quarterly" ? firstMonth + 2 : month;
  const first = `${year}-${String(firstMonth).padStart(2,"0")}-01`;
  const finalDay = new Date(Date.UTC(year, lastMonth, 0)).getUTCDate();
  const last = `${year}-${String(lastMonth).padStart(2,"0")}-${String(finalDay).padStart(2,"0")}`;
  return { start: first, end: last, cadence,
    label: cadence === "quarterly" ? `Q${Math.ceil(month/3)} ${year}` : `${year}-${String(month).padStart(2,"0")}` };
}
export function during(value, range) {
  const day = ghanaDate(value);
  return Boolean(day && range && day >= range.start && day <= range.end);
}
/** All user-visible 'as-of' states describe NOW unless a frozen authorised snapshot is supplied. */
export function individualAchievementFacts({ works = [], submissions = [], range, projectId = null, asOf = new Date() }) {
  if (!range?.start || !range?.end || range.start > range.end) throw new Error("Invalid reporting range.");
  const uniqueWork = [...new Map(works.filter((r) => r?.id).map((r) => [r.id, r])).values()];
  const candidate = uniqueWork.filter((row) =>
    !projectId || row.project_id === projectId);
  const personalSubmissions = [...new Map(submissions.filter((s) => s?.id).map((s) => [s.id,s])).values()]
    .filter((row) => during(row.submitted_at, range));
  const contributionIds = new Set(personalSubmissions.map((s) => s.work_item_id));
  const contributed = candidate.filter((w) =>
    contributionIds.has(w.id) || (COMPLETE.has(w.status) && during(w.completed_at, range)));
  const completed = candidate.filter((w) => COMPLETE.has(w.status) && during(w.completed_at, range));
  const due = candidate.filter((w) => !OMIT.has(w.status) && during(w.due_at, range));
  const cancelled = candidate.filter((w) => OMIT.has(w.status) && during(w.due_at, range));
  const finishedOnTime = due.filter((w) =>
    COMPLETE.has(w.status) && w.completed_at && new Date(w.completed_at) <= new Date(w.due_at) &&
    Number(w.reschedule_count || 0) === 0);
  const unknownDueVersion = due.filter((w) => Number(w.reschedule_count || 0) > 0);
  const open = candidate.filter((w) => !OMIT.has(w.status) && !COMPLETE.has(w.status));
  const now = new Date(asOf);
  return {
    range, asOf: Number.isNaN(now.getTime()) ? null : now.toISOString(),
    completed, selfCertified: completed.filter((w) => w.status === "self_certified"),
    completedReviewed: completed.filter((w) => w.status === "completed"),
    due, cancelled, finishedOnTime, unknownDueVersion,
    // Historical deadline revisions are not in the work_items table.
    // Never label this partial coverage as an authoritative on-time percentage.
    onTimeDisplay: unknownDueVersion.length ? "Not verified — deadline revisions require history" :
      due.length ? `${finishedOnTime.length} of ${due.length} (current deadline; history not verified)` : "No dated commitments",
    open, overdueNow: open.filter((w) => w.due_at && new Date(w.due_at) < now),
    returned: open.filter((w) => w.status === "returned"),
    waiting: open.filter((w) => w.status === "waiting_on"),
    inReview: open.filter((w) => w.status === "in_review"),
    contributions: contributed,
    submissions: personalSubmissions.filter((s) => candidate.some((w) => w.id === s.work_item_id)),
    projectIds: [...new Set(contributed.map((w) => w.project_id).filter(Boolean))],
    // This is the person's evidence count, never count these as verified project deliverables.
    sourceCoverage: "Current authorised records; historical states and deadline revisions unverified",
  };
}
export function distinctVerifiedProjectOutcomes(outcomes) {
  // Aggregate each authorised objective/deliverable once, not once per contributor.
  return [...new Map(outcomes.filter((row) => row?.id && row.verified === true)
    .map((row) => [row.id, row])).values()];
}
