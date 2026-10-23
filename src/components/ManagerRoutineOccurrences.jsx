import {readRoutineCovers,routineCoverKey,routineCoverLabel} from "../lib/routineDateCovers";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { ghanaCalendarDate } from "../lib/dailyLandscape";
import { readRoutineSchedulePreview, routineDueLabel } from "../lib/readRoutineSchedulePreview";
import "./ManagerRoutineOccurrences.css";

function shiftDate(date, days) {
  const current = new Date(date + "T00:00:00Z");
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().slice(0, 10);
}

/** No synthetic completion, no new grants and no duplicate task records. */
export default function ManagerRoutineOccurrences({ me, openItem }) {
  const [series, setSeries] = useState([]);
  const [dates, setDates] = useState([]);
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
      setLoading(true); setError(""); setSeries([]); setDates([]); setVerifiedIdentity("");
      try {
        if (!unitIds.length) { if (alive) setVerifiedIdentity(identity); return; }
        const { data: operations, error: operationError, count: operationCount } = await supabase.from("recurring_operations")
          .select("id,name,unit_id,work_item_id,active,paused_at,starts_on,ends_on,schedule_kind,weekdays,day_of_month",{count:"exact"})
          .in("unit_id", unitIds).order("name");
        if (operationError || !Array.isArray(operations) || typeof operationCount!=="number" || operationCount!==operations.length)
          throw new Error("Unit routines are incomplete");
        const covers=await readRoutineCovers(supabase,me,{fromDate:shiftDate(today,-14),throughDate:shiftDate(today,30)});
        const projected = await readRoutineSchedulePreview(supabase,operations.map(row=>row.work_item_id),{
          fromDate:shiftDate(today,-14),throughDate:shiftDate(today,30),
        });
        const known=new Set(operations.map(row=>row.id));
        if(projected.some(row=>!known.has(row.operationId))) throw new Error("Unrecognised unit routine date");
        if (alive) { setSeries(operations); setDates(projected.map(row=>({...row,cover:covers.get(routineCoverKey(row.operationId,row.date))}))); setVerifiedIdentity(identity); }
      } catch {
        if (alive) setError("Routine schedules or recorded occurrences could not be verified for this account.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [unitKey, today, me.id, me.org_id]);

  const byId=new Map(series.map(row=>[row.id,row]));
  const items = !ready ? [] : dates.map(item=>({...item,operation:byId.get(item.operationId)}))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.operation.name.localeCompare(b.operation.name));

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
          <td><time dateTime={item.date}>{item.date}</time><small style={{display:"block",fontSize:12}}>{routineDueLabel(item)}</small></td>
          <td><button type="button" onClick={() => openItem?.(item.operation.work_item_id,item.date)}
            disabled={!item.operation.work_item_id}>{item.operation.name}</button>{item.cover?.action==="assign"&&<small style={{display:"block"}}>{routineCoverLabel(item.cover,me)}</small>}</td>
          <td><span className={"s2-routine-state is-" + item.state}>
            {item.state === "skipped" ? "Skipped with authorised reason" : item.state === "recorded" ? "Recorded" : item.state === "unrecorded_past" ? "Not recorded" : "Scheduled"}
          </span></td>
        </tr>)}
      </tbody></table>
    </div>}
  </section>;
}
