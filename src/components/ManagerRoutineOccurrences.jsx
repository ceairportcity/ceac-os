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
  const unitIds = useMemo(() => [...new Set(
    (me.memberships || []).filter((membership) => membership.role === "manager").map((membership) => membership.unit_id)
      .concat(me.unit_id ? [me.unit_id] : []).filter(Boolean)
  )], [me.memberships, me.unit_id]);
  const unitKey = unitIds.join(",");
  const identity = me.org_id+":"+me.id+":"+unitKey;
  const [verifiedIdentity,setVerifiedIdentity]=useState("");
  const ready = !loading && !error && verifiedIdentity===identity;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(""); setSeries([]); setHistory([]); setVerifiedIdentity("");
      try {
        if (!unitIds.length) { if (alive) setVerifiedIdentity(identity); return; }
        const { data: operations, error: operationError, count: operationCount } = await supabase.from("recurring_operations")
          .select("id,name,unit_id,work_item_id,active,paused_at,starts_on,ends_on,schedule_kind,weekdays,day_of_month",{count:"exact"})
          .in("unit_id", unitIds).order("name");
        if (operationError || !Array.isArray(operations) || typeof operationCount!=="number" || operationCount!==operations.length)
          throw new Error("Unit routines are incomplete");
        const ids = operations.map((row) => row.id);
        let records = [];
        if (ids.length) {
          const result = await supabase.from("operation_occurrences")
            .select("id,operation_id,occurred_on",{count:"exact"})
            .in("operation_id", ids)
            .gte("occurred_on", shiftDate(today, -14))
            .lte("occurred_on", shiftDate(today, 30));
          if (result.error || !Array.isArray(result.data) || typeof result.count!=="number" || result.count!==result.data.length)
            throw new Error("Unit routine history is incomplete");
          records = result.data;
        }
        // Corrupt projection cannot silently remove a responsibility.
        for (const operation of operations) if (operation.active && !operation.paused_at) {
          projectedRoutineDates(operation, records, {
            fromDate: shiftDate(today,-14), throughDate: shiftDate(today,30), today,
          });
        }
        if (alive) { setSeries(operations); setHistory(records); setVerifiedIdentity(identity); }
      } catch {
        if (alive) setError("Routine schedules or recorded occurrences could not be verified for this account.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [unitKey, today, me.id, me.org_id]);

  const items = !ready ? [] : series.filter((operation)=>!operation.paused_at).flatMap((operation) =>
    projectedRoutineDates(operation, history, {
      fromDate: shiftDate(today,-14), throughDate: shiftDate(today,30), today,
    }).map((item)=>({...item,operation}))
  ).sort((a,b)=>a.date.localeCompare(b.date)||a.operation.name.localeCompare(b.operation.name));

  return <section className="s2-routine-schedule" aria-label="Routine occurrence calendar">
    <header><div><h2>Scheduled occurrences</h2><p>Recorded outcomes and upcoming dates for your unit. Earlier unrecorded dates remain visible.</p></div>
      <span>Past 14 days · Next 30 days</span>
    </header>
    {(loading || verifiedIdentity!==identity && !error) && <p role="status">Verifying routine schedules…</p>}
    {error && <p role="alert">{error}</p>}
    {ready && !items.length && <p>No dated routine occurrences are available. Check a routine's start date and active schedule.</p>}
    {ready && items.length > 0 && <div className="s2-routine-scroll">
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
