import { ghanaCalendarDate } from "./dailyLandscape.js";
import { readRoutineSchedulePreview } from "./readRoutineSchedulePreview.js";
import { RESPONSIBILITY_STATUS } from "./responsibilityRegister.js";

const closed = new Set(["completed", "self_certified", "cancelled"]);
const workFields = "id,title,kind,status,due_at,assignee_id,profiles!work_items_assignee_id_fkey(full_name),recurring_operations(id)";
const dayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

export function shiftPlanDay(day, offset) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function currentPlanWeek() {
  const day = ghanaCalendarDate();
  return shiftPlanDay(day, -((new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7));
}

export const planDayLabel = date => date ? dayFormat.format(new Date(date + "T00:00:00Z")) : "No day set";
export const weeklyPlanHref = id => `/?tab=work&weeklyPlan=${id}`;

async function readAll(makeQuery) {
  let rows = [];
  for (;;) {
    const { data, error, count } = await makeQuery().range(rows.length, rows.length + 499);
    if (error) throw error;
    if (!Array.isArray(data) || !Number.isInteger(count) || rows.length + data.length > count || (!data.length && rows.length !== count)) {
      throw new Error("The complete weekly plan could not be loaded.");
    }
    rows = rows.concat(data);
    if (rows.length === count) return rows;
  }
}

export async function readWeeklyPlans(client, week, id) {
  return readAll(() => {
    const query = client.from("weekly_work_plans").select("id,unit_id,week_start,shared_at,original_plan,units(name)", { count: "exact" });
    return (id ? query.eq("id", id) : query.eq("week_start", week)).order("id");
  });
}

const linkKey = (work, date) => `${work}:${date || ""}`;

async function routineStates(client, work, fromDate, throughDate) {
  const routines = work.filter(row => row.kind === "routine");
  const byOperation = new Map(routines.flatMap(row => {
    const operations = Array.isArray(row.recurring_operations) ? row.recurring_operations : [row.recurring_operations].filter(Boolean);
    return operations.map(operation => [operation.id, row.id]);
  }));
  const dates = await readRoutineSchedulePreview(client, routines.map(row => row.id), { fromDate, throughDate });
  return new Map(dates.filter(row => byOperation.has(row.operationId)).map(row => [linkKey(byOperation.get(row.operationId), row.date), row]));
}

export function isPlanItemDone(item) {
  if (item.carried_at) return false;
  return item.work_id ? (item.routine_date ? item.routine?.state === "recorded" : ["completed", "self_certified"].includes(item.work?.status)) : Boolean(item.completed_at);
}

export function planItemStatus(item) {
  if (item.dropped_at) return "Removed";
  if (item.carried_at) return "Carried forward";
  if (isPlanItemDone(item)) return "Done";
  if (item.work_id && !item.work) return "Work unavailable";
  if (item.decision_requested && !item.decision_response) return "Decision needed";
  if (item.blocker && !item.decision_response) return "Blocked";
  if (!item.work_id) return "To do";
  if (!item.routine_date) return RESPONSIBILITY_STATUS[item.work.status] || "Status unavailable";
  return { skipped: "Skipped", scheduled: "Scheduled", unrecorded_past: "Outcome not recorded" }[item.routine?.state] || "Occurrence unavailable";
}

export async function readPlanItems(client, plans) {
  if (!plans.length) return [];
  const planIds = plans.map(plan => plan.id);
  const entries = await readAll(() => client.from("weekly_work_plan_items").select("*", { count: "exact" })
    .in("plan_id", planIds).order("id"));
  const links = [...new Set(entries.map(item => item.work_id).filter(Boolean))];
  const people = [...new Set(entries.map(item => item.owner_id).filter(Boolean))];
  const batched = async (ids, load) => {
    const result = [];
    for (let index = 0; index < ids.length; index += 150) result.push(...await load(ids.slice(index, index + 150)));
    return result;
  };
  const [work, owners] = await Promise.all([
    batched(links, batch => readAll(() => client.from("work_items").select(workFields, { count: "exact" })
      .in("id", batch).eq("visibility", "unit").eq("confidential", false).order("id"))),
    batched(people, batch => readAll(() => client.from("profiles").select("id,full_name", { count: "exact" }).in("id", batch).order("id"))),
  ]);
  const workById = new Map(work.map(row => [row.id, row]));
  const ownerById = new Map(owners.map(row => [row.id, row.full_name]));
  const occurrenceDays = [...new Set(entries.map(item => item.routine_date).filter(Boolean))];
  const schedules = await Promise.all(occurrenceDays.map(day => {
    const scoped = [...new Set(entries.filter(item => item.routine_date === day).map(item => item.work_id))]
      .map(id => workById.get(id)).filter(Boolean);
    return routineStates(client, scoped, day, day);
  }));
  const scheduled = new Map(schedules.flatMap(map => [...map]));
  return entries.map(item => ({
    ...item,
    work: workById.get(item.work_id),
    routine: scheduled.get(linkKey(item.work_id, item.routine_date)),
    ownerName: ownerById.get(item.owner_id),
  })).sort((a, b) => (a.planned_on || "9999").localeCompare(b.planned_on || "9999"));
}

export async function readPlanEditor(client, plan) {
  const end = shiftPlanDay(plan.week_start, 6);
  const next = shiftPlanDay(plan.week_start, 7);
  const [members, work, previous] = await Promise.all([
    readAll(() => client.from("unit_memberships").select("profile_id,profiles!inner(full_name,active)", { count: "exact" })
      .eq("unit_id", plan.unit_id).eq("profiles.active", true).order("id")),
    readAll(() => client.from("work_items").select(workFields, { count: "exact" })
      .eq("unit_id", plan.unit_id).eq("visibility", "unit").eq("confidential", false)
      .not("status", "in", "(completed,self_certified,cancelled)").order("id")),
    readAll(() => client.from("weekly_work_plans").select("id", { count: "exact" })
      .eq("unit_id", plan.unit_id).eq("week_start", shiftPlanDay(plan.week_start, -7)).order("id")),
  ]);
  const active = work.filter(row => !closed.has(row.status));
  const [schedules, lastItems] = await Promise.all([
    routineStates(client, active, plan.week_start, end),
    readPlanItems(client, previous),
  ]);
  const suggestions = active.filter(row => row.kind !== "routine" && row.due_at >= plan.week_start && row.due_at < next).map(row => ({ ...row, day: row.due_at.slice(0, 10) }));
  const map = new Map(active.map(row => [row.id, row]));
  for (const [key, date] of schedules) {
    if (!["skipped", "recorded"].includes(date.state)) suggestions.push({ ...map.get(key.split(":")[0]), routine: date.date, day: date.date });
  }
  return {
    members,
    linkable: active.filter(row => row.kind !== "routine").sort((a, b) => a.title.localeCompare(b.title)),
    suggestions: suggestions.sort((a, b) => a.day.localeCompare(b.day)),
    lastItems: lastItems.filter(item => !item.dropped_at && !item.carried_at && !isPlanItemDone(item) && (!item.work_id || item.work && !closed.has(item.work.status))
      && (!item.routine_date || item.routine && item.routine.state !== "skipped")),
  };
}

export async function readPlanChanges(client, id) {
  const result = await client.from("weekly_work_plan_changes").select("*").eq("plan_id", id)
    .order("changed_at", { ascending: false }).order("id", { ascending: false }).limit(50);
  if (result.error) throw result.error;
  return result.data;
}
