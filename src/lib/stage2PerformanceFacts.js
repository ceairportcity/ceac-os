/**
 * CEAC Stage 2 factual employee achievement metrics.
 * NOT an appraisal, quality score, ranking, verified objective or payroll basis.
 * Africa/Accra = UTC+0 with no DST; compare ISO date-only values.
 * All counts dedupe by authoritative work ID. Current status is labelled LIVE,
 * not reconstructed historical status at the period end.
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOSED = new Set(["completed", "self_certified"]);
const EXCLUDED = new Set(["cancelled", "archived"]);
export function accraDate(value) {
  if (!value) return null;
  if (DATE.test(value)) return value;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0,10) : null;
}
export function reportRange(year, kind, index) {
  const y = Number(year), n = Number(index);
  if (!Number.isInteger(y) || y < 2000 || y > 2200) throw new Error("Invalid report year");
  if (kind !== "month" && kind !== "quarter") throw new Error("Only month and quarter are supported");
  const count = kind === "month" ? 12 : 4;
  if (!Number.isInteger(n) || n < 1 || n > count) throw new Error("Invalid report period");
  const month = kind === "month" ? n : (n - 1) * 3 + 1;
  const endMonth = kind === "month" ? month : month + 2;
  const pad = (x) => String(x).padStart(2,"0");
  const lastDay = new Date(Date.UTC(y,endMonth,0)).getUTCDate();
  return {
    kind, year:y, index:n,
    start:`${y}-${pad(month)}-01`, end:`${y}-${pad(endMonth)}-${pad(lastDay)}`,
    label:kind==="quarter" ? `Quarter ${n}, ${y}` : new Date(Date.UTC(y,month-1,1)).toLocaleDateString("en-GB",{timeZone:"UTC",month:"long",year:"numeric"}),
  };
}
const inPeriod = (date,range) => Boolean(date && date >= range.start && date <= range.end);
const distinct = (records) => {
  const indexed = new Map();
  for (const row of records) {
    if (row?.id && !indexed.has(row.id)) indexed.set(row.id,row);
  }
  return [...indexed.values()];
};

export function personalAchievementSummary(records, range, { projectId = null, generatedAt = new Date().toISOString() } = {}) {
  if (!range || !DATE.test(range.start) || !DATE.test(range.end) || range.end < range.start)
    throw new Error("Invalid report range");
  const source = distinct(records || []).filter(x=>!projectId || x.project_id === projectId);
  const scoped = source.filter(x=>!EXCLUDED.has(x.status));
  const periodTasks = scoped.filter(x=>inPeriod(accraDate(x.due_at),range) ||
      (CLOSED.has(x.status) && inPeriod(accraDate(x.completed_at),range)) ||
      inPeriod(accraDate(x.created_at),range));
  const due = scoped.filter(x=>inPeriod(accraDate(x.due_at),range));
  const completed = scoped.filter(x=>CLOSED.has(x.status) && inPeriod(accraDate(x.completed_at),range));
  const onTime = due.filter(x=>CLOSED.has(x.status) && x.completed_at &&
     new Date(x.completed_at).getTime() <= new Date(x.due_at).getTime());
  const assessed = completed.filter(x=>x.first_time_approved === true);
  const selfCertified = completed.filter(x=>x.status === "self_certified");
  const uniqueProjects = [...new Set(periodTasks.map(x=>x.project_id).filter(Boolean))];
  const now = accraDate(generatedAt);
  return {
    range, generatedAt, asOfDate:now, state:"live-current-state-not-period-end-snapshot",
    work:periodTasks,
    counts:{
      tasksInScope:periodTasks.length,
      completed:completed.length,
      firstReviewApproved:assessed.length,
      selfCertified:selfCertified.length,
      due:due.length,
      onTime:onTime.length,
      onTimeRatio:due.length ? {numerator:onTime.length,denominator:due.length} : null,
      currentlyOpen:periodTasks.filter(x=>!CLOSED.has(x.status)).length,
      currentlyOverdue:periodTasks.filter(x=>!CLOSED.has(x.status) && x.due_at && accraDate(x.due_at)<now).length,
      currentlyReturned:periodTasks.filter(x=>x.status==="returned").length,
      projectsLinked:uniqueProjects.length,
      noDueDate:periodTasks.filter(x=>!x.due_at).length,
      excluded:source.length-scoped.length,
    },
    distinctProjectIds:uniqueProjects,
    limitations:[
      "Status is the current database status, not a historical period-end snapshot.",
      "First-review approval records are separate from verified project outcomes.",
      "Deadline changes and reopened tasks require audited timeline review before formal on-time certification.",
      "Linked projects indicate work association; actual project outcomes require independent evidence.",
    ],
  };
}

export const HUMAN_RUBRIC = Object.freeze([
  {key:"delivery",label:"Delivery of responsibilities"},
  {key:"quality",label:"Quality of work"},
  {key:"reliability",label:"Ownership and reliability"},
  {key:"initiative",label:"Initiative/problem-solving"},
  {key:"collaboration",label:"Collaboration/contribution"},
]);
export const VALID_RATINGS = Object.freeze(["1","2","3","4","5","N/O"]);
/** Validation only: these ratings MUST be entered by an authorised human.
 * No average or automatic overall rating is computed anywhere.
 */
export function validateHumanAppraisal({periodKind, reviewerId, employeeId, categories, overall, narrative, strengths, challenges, actions}={}) {
  const errors=[];
  if (!reviewerId || !employeeId || reviewerId===employeeId) errors.push("Independent reviewer required");
  if (periodKind!=="month"&&periodKind!=="quarter") errors.push("Invalid cycle");
  const required=periodKind==="quarter";
  for(const item of HUMAN_RUBRIC){
    const rating=categories?.[item.key];
    if (!rating || !rating.rating){
      if(required) errors.push(`${item.label}: rating required`);
      continue;
    }
    if(!VALID_RATINGS.includes(String(rating.rating))) errors.push(`${item.label}: invalid rating`);
    if(!String(rating.reason||"").trim()) errors.push(`${item.label}: explanation required`);
    if(!Array.isArray(rating.evidenceIds)) errors.push(`${item.label}: evidence selection must be explicit`);
    else if(String(rating.rating)!=="N/O" && rating.evidenceIds.length===0) errors.push(`${item.label}: verified source references required for a numeric observation`);
  }
  if(required || overall?.rating) {
    if(!VALID_RATINGS.includes(String(overall?.rating||""))) errors.push("Human-selected overall rating required");
    if(!String(narrative||"").trim()) errors.push("Overall Manager narrative required");
    if(!String(strengths||"").trim()) errors.push("Strengths required");
    if(!String(challenges||"").trim()) errors.push("Challenges required");
    if(!String(actions||"").trim()) errors.push("Improvement actions required");
  }
  return {valid:errors.length===0,errors};
}
