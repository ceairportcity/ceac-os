import {readRoutineCovers,includeCoveredRoutineWork,routineCoverKey,routineCoverLabel} from "./routineDateCovers.js";
import { readRoutineSchedulePreview, routineDueLabel } from "./readRoutineSchedulePreview.js";

export const routineCalendarStatus = state => ({
  recorded: "Outcome recorded", unrecorded_past: "Not recorded", scheduled: "Scheduled", skipped: "Skipped by authorised exception",
})[state] || "Routine";

const error = () => new Error("The complete routine calendar could not be verified.");
const calendarDay = value => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return parts.year + "-" + parts.month + "-" + parts.day;
};

async function readAll(query) {
  const rows = [];
  let expected = null;
  do {
    const result = await query().range(rows.length, rows.length + 499);
    if (result.error || !Array.isArray(result.data) || !Number.isInteger(result.count)
      || result.count < 0 || result.count > 2000
      || expected !== null && expected !== result.count) throw error();
    expected = result.count;
    if (!result.data.length && rows.length < expected) throw error();
    rows.push(...result.data);
    if (rows.length > expected) throw error();
  } while (rows.length < expected);
  return rows;
}

/** Read-only organisational projection. Never writes private Calendar instances. */
export async function readRoutineCalendar(client, me, { scope, fromDate, throughDate }) {
  if (!me?.id || !me.org_id || !["own", "unit"].includes(scope) || scope === "unit" && !me.unit_id) throw error();
  let work = await readAll(() => {
    let query = client.from("work_items")
      .select("id,ref,title,org_id,unit_id,assignee_id", { count: "exact" })
      .eq("org_id", me.org_id).eq("kind", "routine").neq("visibility", "private").order("id");
    return scope === "own" ? query.eq("assignee_id", me.id) : query.eq("unit_id", me.unit_id);
  });
  if(work.some(row=>row.org_id!==me.org_id||(scope==="own"?row.assignee_id!==me.id:row.unit_id!==me.unit_id)))throw error();
  const covers=await readRoutineCovers(client,me,{fromDate,throughDate});
  const originalIds=new Set(work.map(row=>row.id));
  if(scope==="own")work=await includeCoveredRoutineWork(client,me,work,covers,"id,ref,title,org_id,unit_id,assignee_id");
  const byId = new Map();
  for (const row of work) {
    if (!row.id || byId.has(row.id) || row.org_id !== me.org_id
      || (scope === "own" ? originalIds.has(row.id)&&row.assignee_id !== me.id : row.unit_id !== me.unit_id)) throw error();
    byId.set(row.id, row);
  }
  const workIds = [...byId.keys()];
  if (!workIds.length) return [];
  const byOperation = new Map();
  const seenWork = new Set();
  for (let offset = 0; offset < workIds.length; offset += 200) {
    const ids = workIds.slice(offset, offset + 200);
    const result = await client.from("recurring_operations")
      .select("id,work_item_id,org_id", { count: "exact" })
      .eq("org_id", me.org_id).in("work_item_id", ids).order("id");
    if (result.error || !Array.isArray(result.data) || result.count !== result.data.length
      || result.data.length > ids.length) throw error();
    for (const row of result.data) {
      if (!row.id || byOperation.has(row.id) || seenWork.has(row.work_item_id)
        || row.org_id !== me.org_id || !ids.includes(row.work_item_id)) throw error();
      byOperation.set(row.id, byId.get(row.work_item_id));
      seenWork.add(row.work_item_id);
    }
  }
  const dates = await readRoutineSchedulePreview(client, workIds, { fromDate, throughDate });
  if (dates.length > 20000) throw error();
  return dates.flatMap(item => {
    const source = byOperation.get(item.operationId);
    if (!source) throw error();
    const cover=covers.get(routineCoverKey(item.operationId,item.date));
    if(scope==="own"&&source.assignee_id!==me.id&&!(cover?.action==="assign"&&cover.assignee_id===me.id))return [];
    const coverLabel=routineCoverLabel(cover,me);
    return [{
      id: "routine-" + item.operationId + "-" + item.date,
      kind: "work", type: "tasks", date: calendarDay(item.dueAt),
      title: source.title, itemId: source.id, sortAt: item.dueAt,
      time: new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" }).format(new Date(item.dueAt)),
      meta: source.ref + " · Routine · " + routineDueLabel(item) + " · " + routineCalendarStatus(item.state)+(coverLabel?" · "+coverLabel:""),
      routineState: item.state, scheduledOn: item.date,
    }];
  });
}
