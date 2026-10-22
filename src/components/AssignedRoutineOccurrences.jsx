import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ghanaCalendarDate } from "../lib/dailyLandscape";
import { readRoutineSchedulePreview, routineDueLabel } from "../lib/readRoutineSchedulePreview";
import "./AssignedRoutineOccurrences.css";

const plusDays = (date, days) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Individual staff work: a manager-created routine is assigned ONCE.
 * Each scheduled occurrence remains independently recorded through the
 * existing operation_occurrences/Item workflow, never fabricated as done.
 */
export default function AssignedRoutineOccurrences({ me, onOpen }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today,setToday] = useState(()=>ghanaCalendarDate());
  // Ghana midnight changes overdue/scheduled status even if this tab stays open.
  useEffect(() => {
    const refresh = () => {
      const next = ghanaCalendarDate();
      setToday(current=>current===next?current:next);
    };
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    const timer = window.setInterval(refresh,60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",refresh);
    };
  },[]);
  const identity = me.org_id+":"+me.id;
  const [verifiedIdentity,setVerifiedIdentity]=useState("");
  const ready = !loading && !error && verifiedIdentity===identity;

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(""); setRows([]); setVerifiedIdentity("");
      try {
        const source = await supabase.from("work_items")
          .select("id,title,assignee_id",{count:"exact"})
          .eq("assignee_id", me.id).eq("kind", "routine").eq("visibility", "unit")
          .in("status", ["not_started","in_progress","returned"]);
        if (source.error || !Array.isArray(source.data) || typeof source.count!=="number" || source.count!==source.data.length)
          throw new Error("Assigned work rows are incomplete");
        const templates = source.data;
        if (!templates.length) { if (active) { setRows([]); setVerifiedIdentity(identity); } return; }
        const result = await supabase.from("recurring_operations")
          .select("id,name,work_item_id,active,paused_at,starts_on,ends_on,schedule_kind,weekdays,day_of_month",{count:"exact"})
          .in("work_item_id", templates.map((x) => x.id));
        if (result.error || !Array.isArray(result.data) || typeof result.count!=="number" || result.count!==result.data.length)
          throw new Error("Assigned routine rows are incomplete");
        const routines = result.data;
        if (!routines.length) { if (active) { setRows([]); setVerifiedIdentity(identity); } return; }
        const dates = await readRoutineSchedulePreview(supabase, routines.map(row=>row.work_item_id), {
          fromDate: plusDays(today,-14), throughDate: plusDays(today,14),
        });
        const byId = new Map(routines.map(row=>[row.id,row]));
        const projected = dates.map(item=>{
          const routine=byId.get(item.operationId);
          if(!routine) throw new Error("Unrecognised assigned routine date");
          return {...item,routine};
        }).sort((a,b) => a.date.localeCompare(b.date) || a.routine.name.localeCompare(b.routine.name));
        if (active) { setRows(projected); setVerifiedIdentity(identity); }
      } catch {
        if (active) setError("Your assigned routine schedule could not be verified. Recorded work remains available.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [me.id,me.org_id,today]);

  // A frequently repeating routine must not crowd out another person's
  // assigned Saturday/Sunday responsibility. Display a bounded independent
  // preview for EVERY assigned routine, with missed work still visible.
  const byRoutine = new Map();
  for (const item of rows.filter((row) => row.state !== "recorded")) {
    const bucket = byRoutine.get(item.operationId) || { past: [], future: [], skipped: [] };
    (item.state === "skipped" ? bucket.skipped : item.state === "unrecorded_past" ? bucket.past : bucket.future).push(item);
    byRoutine.set(item.operationId, bucket);
  }
  const upcoming = [...byRoutine.values()].flatMap(({ past, future, skipped }) => [
    ...past.slice(-2), ...future.slice(0, 3), ...skipped.slice(-2),
  ]).sort((a,b) => a.date.localeCompare(b.date) || a.routine.name.localeCompare(b.routine.name));
  if (ready && !rows.length) return null;
  return <section className="s2-assigned-routines" aria-label="My scheduled recurring work">
    <header><h2>Recurring responsibilities</h2><small>Past 14 days · Next 14 days</small></header>
    <p>Created by you or assigned to you. Each scheduled date has its own outcome record; missed dates remain visible.</p>
    {(loading || verifiedIdentity!==identity && !error) && <p role="status">Checking your scheduled responsibilities…</p>}
    {error && <p role="alert">{error}</p>}
    {ready && <div className="s2-assigned-routine-list">
      {upcoming.map((item) => <button key={item.operationId+":"+item.date}
        type="button" onClick={() => onOpen?.(item.routine.work_item_id,item.date)}
        disabled={!item.routine.work_item_id}>
        <time dateTime={item.date}>{item.date}</time>
        <strong>{item.routine.name}</strong>
        <small style={{fontSize:12}}>{routineDueLabel(item)}</small>
        <span className={item.state==="skipped"?"is-exception":item.state==="unrecorded_past"?"is-missed":"is-upcoming"}>
          {item.state==="skipped"?"Skipped with authorised reason":item.state==="unrecorded_past"?"Not recorded":"Scheduled"}
        </span>
      </button>)}
      {!upcoming.length && <p>No outstanding scheduled dates or recorded single-date exceptions in this period.</p>}
    </div>}
  </section>;
}
