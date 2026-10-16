import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ghanaCalendarDate } from "../lib/dailyLandscape";
import { projectedRoutineDates } from "../lib/organisationRoutineSchedule";
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
  const today = ghanaCalendarDate();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(""); setRows([]);
      try {
        const source = await supabase.from("work_items")
          .select("id,title,assignee_id")
          .eq("assignee_id", me.id).eq("kind", "routine").eq("visibility", "unit")
          .in("status", ["not_started","in_progress","returned"]);
        if (source.error) throw source.error;
        const templates = source.data || [];
        if (!templates.length) { if (active) setRows([]); return; }
        const result = await supabase.from("recurring_operations")
          .select("id,name,work_item_id,active,paused_at,starts_on,ends_on,schedule_kind,weekdays,day_of_month")
          .in("work_item_id", templates.map((x) => x.id)).eq("active", true);
        if (result.error) throw result.error;
        const routines = result.data || [];
        if (!routines.length) { if (active) setRows([]); return; }
        const history = await supabase.from("operation_occurrences")
          .select("id,operation_id,occurred_on")
          .in("operation_id", routines.map((x) => x.id))
          .gte("occurred_on", plusDays(today,-14)).lte("occurred_on", plusDays(today,14));
        if (history.error) throw history.error;
        const projected = routines.flatMap((routine) => {
          if (routine.paused_at) return [];
          try {
            return projectedRoutineDates(routine, history.data || [], {
              fromDate: plusDays(today,-14), throughDate: plusDays(today,14), today,
            }).map((item) => ({ ...item, routine }));
          } catch { return []; }
        }).sort((a,b) => a.date.localeCompare(b.date) || a.routine.name.localeCompare(b.routine.name));
        if (active) setRows(projected);
      } catch {
        if (active) setError("Your assigned routine schedule could not be verified. Recorded work remains available.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [me.id,today]);

  const upcoming = rows.filter((item) => item.state !== "recorded");
  if (!loading && !error && !rows.length) return null;
  return <section className="s2-assigned-routines" aria-label="My scheduled recurring work">
    <header><h2>Recurring responsibilities</h2><small>Past 14 days · Next 14 days</small></header>
    <p>Assigned once by your manager. Each scheduled date has its own completion record; missed dates remain visible.</p>
    {loading && <p role="status">Checking your scheduled responsibilities…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && <div className="s2-assigned-routine-list">
      {upcoming.slice(0,12).map((item) => <button key={item.operationId+":"+item.date}
        type="button" onClick={() => onOpen?.(item.routine.work_item_id)}
        disabled={!item.routine.work_item_id}>
        <time dateTime={item.date}>{item.date}</time>
        <strong>{item.routine.name}</strong>
        <span className={item.state==="unrecorded_past"?"is-missed":"is-upcoming"}>
          {item.state==="unrecorded_past"?"Not recorded":"Scheduled"}
        </span>
      </button>)}
      {!upcoming.length && <p>Every visible occurrence has a recorded outcome.</p>}
    </div>}
  </section>;
}
