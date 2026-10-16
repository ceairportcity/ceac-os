import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { ghanaCalendarDate } from "../lib/dailyLandscape";
import { projectedRoutineDates } from "../lib/organisationRoutineSchedule";
import "./ManagerRoutineOccurrences.css";

function shiftDate(date, days) {
  const current = new Date(date + "T00:00:00Z");
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().slice(0, 10);
}

/** No synthetic completion, no new grants and no duplicate task records. */
export default function ManagerRoutineOccurrences({ me, openItem }) {
  const [series, setSeries] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const today = ghanaCalendarDate();
  const unitIds = useMemo(() => [...new Set(
    (me.memberships || []).filter((membership) => membership.role === "manager").map((membership) => membership.unit_id)
      .concat(me.unit_id ? [me.unit_id] : []).filter(Boolean)
  )], [me.memberships, me.unit_id]);
  const unitKey = unitIds.join(",");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(""); setSeries([]); setHistory([]);
      try {
        if (!unitIds.length) { setLoading(false); return; }
        const { data: operations, error: operationError } = await supabase.from("recurring_operations")
          .select("id,name,unit_id,work_item_id,active,starts_on,ends_on,schedule_kind,weekdays,day_of_month")
          .in("unit_id", unitIds).order("name");
        if (operationError) throw operationError;
        const ids = (operations || []).map((row) => row.id);
        let records = [];
        if (ids.length) {
          const result = await supabase.from("operation_occurrences")
            .select("id,operation_id,occurred_on")
            .in("operation_id", ids)
            .gte("occurred_on", shiftDate(today, -14))
            .lte("occurred_on", shiftDate(today, 30));
          if (result.error) throw result.error;
          records = result.data || [];
        }
        if (alive) { setSeries(operations || []); setHistory(records); }
      } catch {
        if (alive) setError("Routine schedules or recorded occurrences could not be verified for this account.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [unitKey, today]);

  const items = series.flatMap((operation) => {
    try {
      return projectedRoutineDates(operation, history, {
        fromDate: shiftDate(today, -14),
        throughDate: shiftDate(today, 30),
        today,
      }).map((item) => ({ ...item, operation }));
    } catch {
      return [];
    }
  }).sort((a, b) => a.date.localeCompare(b.date) || a.operation.name.localeCompare(b.operation.name));

  return <section className="s2-routine-schedule" aria-label="Routine occurrence calendar">
    <header><div><h2>Scheduled occurrences</h2><p>Recorded outcomes and upcoming dates for your unit. Earlier unrecorded dates remain visible.</p></div>
      <span>Past 14 days · Next 30 days</span>
    </header>
    {loading && <p role="status">Verifying routine schedules…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !items.length && <p>No dated routine occurrences are available. Check a routine's start date and active schedule.</p>}
    {!loading && !error && items.length > 0 && <div className="s2-routine-scroll">
      <table><thead><tr><th>Scheduled date</th><th>Responsibility</th><th>Record</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.operationId + ":" + item.date}>
          <td><time dateTime={item.date}>{item.date}</time></td>
          <td><button type="button" onClick={() => openItem?.(item.operation.work_item_id)}
            disabled={!item.operation.work_item_id}>{item.operation.name}</button></td>
          <td><span className={"s2-routine-state is-" + item.state}>
            {item.state === "recorded" ? "Recorded" : item.state === "unrecorded_past" ? "Not recorded" : "Scheduled"}
          </span></td>
        </tr>)}
      </tbody></table>
    </div>}
  </section>;
}
