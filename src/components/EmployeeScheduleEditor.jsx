import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { approvedOfficeWeekTemplate } from "../lib/approvedOfficeWeekTemplate";
import { workforceRecordedWeek } from "../lib/workforceRecordedWeek";

const DAYS = [
  ["mon","Monday"],["tue","Tuesday"],["wed","Wednesday"],
  ["thu","Thursday"],["fri","Friday"],["sat","Saturday"],["sun","Sunday"],
];

const emptyDays = () => Object.fromEntries(DAYS.map(([day]) => [day, {
  type:"", start:"", end:"",
}]));
const dateOf = (value) => value ? String(value).slice(0,10) : "";
const recordedWeekRowStyle = {
  display:"grid",gridTemplateColumns:"minmax(72px,.6fr) minmax(114px,1.2fr) minmax(105px,1fr)",
  minWidth:315,gap:8,padding:"9px 10px",fontSize:12,lineHeight:1.4,alignItems:"center",
};

export default function EmployeeScheduleEditor({ me, profileId, employeeId, unitId, name }) {
  const authorised = Boolean(me?.is_admin) && (me.capabilities || []).includes("workforce.manage");
  const [dayTypes,setDayTypes] = useState([]);
  const [versions,setVersions] = useState([]);
  const [historyCount,setHistoryCount] = useState(0);
  const [previewId,setPreviewId] = useState("");
  const [days,setDays] = useState(emptyDays);
  const [startDate,setStartDate] = useState("");
  const [endDate,setEndDate] = useState("");
  const [reason,setReason] = useState("");
  const [edit,setEdit] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const generation = useRef(0);
  const writeBusy = useRef(false);

  async function load(expectedVersionId = null) {
    const token = ++generation.current;
    setLoading(true);
    const [types, schedules] = await Promise.all([
      supabase.from("workforce_day_types").select("id,name,session_expected,active")
        .eq("org_id",me.org_id).eq("active",true).order("name"),
      (employeeId
        ? supabase.from("workforce_schedule_versions")
            .select("id,effective_from,effective_to,day_map,clock_map,reason,created_at", { count:"exact" })
            .eq("org_id",me.org_id)
            .or(profileId ? "employee_id.eq."+employeeId+",profile_id.eq."+profileId : "employee_id.eq."+employeeId)
        : supabase.from("workforce_schedule_versions")
            .select("id,effective_from,effective_to,day_map,clock_map,reason,created_at", { count:"exact" })
            .eq("org_id",me.org_id).eq("profile_id",profileId))
        .order("created_at",{ascending:false}).limit(20),
    ]);
    if (token !== generation.current) return false;
    setLoading(false);
    if (types.error || schedules.error || !Number.isInteger(schedules.count) || schedules.count < (schedules.data||[]).length) {
      setError("The employee's authoritative schedule could not be loaded. No change was made.");
      return false;
    }
    if (expectedVersionId && !(schedules.data||[]).some(version=>version.id===expectedVersionId)) {
      setError("A schedule write was acknowledged, but the saved version is not in the verified employee history. Do not retry before checking it.");
      return false;
    }
    setDayTypes(types.data || []);
    setVersions(schedules.data || []);
    setHistoryCount(schedules.count);
    setPreviewId(old=>(schedules.data||[]).some(version=>version.id===old)?old:"");
    setError("");
    return true;
  }

  useEffect(() => {
    generation.current += 1;
    writeBusy.current = false;
    setEdit(false);
    setPreviewId("");
    setHistoryCount(0);
    setDays(emptyDays());
    setStartDate("");
    setEndDate("");
    setReason("");
    setError("");
    setNotice("");
    if (authorised && (employeeId || profileId)) void load();
    return () => { generation.current += 1; };
  }, [me.id,me.org_id,profileId,employeeId,authorised]);

  if (!authorised || (!profileId && !employeeId)) return null;

  const previous = versions[0] || null;
  const inspected = versions.find(version=>version.id===previewId) || previous;
  const previewDays = workforceRecordedWeek(inspected,dayTypes);
  const officeTemplate = approvedOfficeWeekTemplate(dayTypes);
  function beginEdit() {
    setPreviewId("");
    setDays(Object.fromEntries(DAYS.map(([key]) => [key,{
      type:previous?.day_map?.[key] || "",
      start:dateOf(previous?.clock_map?.[key]?.start).slice(0,5),
      end:dateOf(previous?.clock_map?.[key]?.end).slice(0,5),
    }])));
    setStartDate("");
    setEndDate("");
    setReason("");
    setError("");
    setNotice("");
    setEdit(true);
  }
  function change(day,field,value) {
    setDays((current) => ({
      ...current,
      [day]: {
        ...current[day],[field]:value,
        ...(field==="type" && !dayTypes.find((type)=>type.id===value)?.session_expected
          ? {start:"",end:""} : {}),
      },
    }));
  }
  const complete = DAYS.every(([day]) => {
    const row = days[day];
    const type = dayTypes.find((candidate) => candidate.id===row?.type);
    return type && (!type.session_expected ||
      Boolean(row.start && row.end && row.end>row.start));
  });
  const valid = Boolean(startDate) && (!endDate || endDate>=startDate)
    && reason.trim().length>=8 && complete;

  async function save() {
    if (writeBusy.current || !valid || (!profileId && !employeeId)) return;
    writeBusy.current=true;
    setBusy(true);
    setError("");
    setNotice("");
    const token=generation.current;
    let recorded=false;
    try {
      const dayMap=Object.fromEntries(DAYS.map(([key])=>[key,days[key].type]));
      const clockMap=Object.fromEntries(DAYS.map(([key])=>[key,{
        start:days[key].start || null,end:days[key].end || null,
      }]));
      const shared={
        p_effective_from:startDate,p_effective_to:endDate || null,
        p_day_map:dayMap,p_clock_map:clockMap,
        p_reason:reason.trim(),p_supersedes_id:previous?.id || null,
      };
      const { data, error:failure }=await supabase.rpc(
        employeeId ? "workforce_record_roster_pattern" : "workforce_record_pattern",
        employeeId ? { ...shared, p_employee_id:employeeId }
          : { ...shared,p_profile_id:profileId,p_unit_id:unitId || null },
      );
      if (failure) throw failure;
      if (typeof data !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data))
        throw new Error("The schedule write did not return an authoritative version identifier.");
      recorded=true;
      if (token !== generation.current) return;
      setEdit(false);
      const refreshed=await load(data);
      if (token === generation.current-1) {
        if (refreshed) setNotice("HR-authorised schedule version verified in the employee history. Previous versions remain recorded.");
        else setNotice("The server returned a schedule reference, but its employee-history readback could not be verified.");
      }
    } catch (failure) {
      if (token===generation.current)
        setError(recorded
          ? "The schedule was recorded but its latest state could not be confirmed."
          : "The schedule outcome could not be confirmed. Check recorded history before trying again.");
    } finally {
      writeBusy.current=false;
      setBusy(false);
    }
  }

  return <section className="ev2p-admin-schedule" aria-labelledby="employee-schedule-heading">
    <h3 id="employee-schedule-heading">HR-authorised working schedule</h3>
    <p className="screen-note">Schedules vary by employee and include their approved office, remote, programme and weekly rest days. Do not calculate historical leave or lateness from an unconfirmed schedule.</p>
    {loading && <p role="status">Loading the employee's schedule...</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!loading && previous && <div className="ev2p-admin-schedule-history" style={{display:"grid",gap:12,minWidth:0,marginTop:12}}>
      <p className="screen-note"><strong>{inspected?.id === previous.id ? "Latest recorded version" : "Earlier saved version"}:</strong> {dateOf(inspected.effective_from)}{inspected.effective_to ? " to "+dateOf(inspected.effective_to) : " onward"}. This is a recorded HR pattern, not evidence of actual attendance.</p>
      <div className="ev2p-admin-schedule-week" role="table" aria-label="Saved employee seven-day working week" style={{minWidth:0,overflowX:"auto",border:"1px solid var(--ev2-line,var(--line))",borderRadius:8}}>
        <div role="row" className="ev2p-admin-schedule-week-head" style={{...recordedWeekRowStyle,background:"var(--ev2-surface-muted,#f3f4f4)"}}>
          <strong role="columnheader">Day</strong><strong role="columnheader">Day type</strong><strong role="columnheader">Expected hours</strong>
        </div>
        {previewDays.map(day=><div role="row" key={day.key} className="ev2p-admin-schedule-week-row" style={{...recordedWeekRowStyle,borderTop:"1px solid var(--ev2-line,var(--line))"}}>
          <span role="cell">{day.label}</span><span role="cell">{day.typeName}</span><span role="cell">{day.hours}</span>
        </div>)}
      </div>
      <p className="screen-note">Recorded reason: {inspected.reason || "Not available"}.</p>
      {versions.length>1&&<label className="small">Inspect a saved schedule version
        <select className="field" aria-label="Inspect recorded schedule version" value={inspected.id}
         onChange={event=>setPreviewId(event.target.value)}>
          {versions.map((version,index)=><option key={version.id} value={version.id}>
            {index===0?"Latest":`Earlier #${index+1}`} · {dateOf(version.effective_from)} · {dateOf(version.created_at)}
          </option>)}
        </select>
      </label>}
      {historyCount>versions.length&&<p className="screen-note">Showing the {versions.length} most recently recorded of {historyCount} versions; older records remain in the authorised history.</p>}
    </div>}
    {!loading && !previous && <p className="screen-note">No HR-authorised individual work schedule is recorded yet.</p>}
    {!loading && dayTypes.length===0 && <p className="screen-note">Administration must configure approved day types (including duty and weekly off-day) in Workforce before recording an individual pattern.</p>}
    {!loading && dayTypes.length>0 && !edit &&
      <button type="button" className="btn btn-ghost" onClick={beginEdit}>Edit authorised work schedule</button>}
    {edit && <div className="ev2p-admin-schedule-editor">
      <p className="screen-note">Editing {name || "employee"}; all seven days must have a day type. Scheduled duty days also require start/end hours. Changes create a new version, not an overwrite.</p>
      {officeTemplate && <div className="workforce-setup-actions">
        <button className="btn btn-ghost btn-sm" type="button" onClick={()=>setDays(officeTemplate)}>
          Fill approved normal office week
        </button>
        <p className="screen-note">Monday–Friday 10:00–17:00, lunch 13:00–14:00; weekends off. Review actual Office/Remote/Field, event and individual exceptions before saving. A template never publishes a schedule.</p>
      </div>}
      <div className="form-grid two">
        <label>Effective from
          <input className="field" type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)}/>
        </label>
        <label>Effective to (optional)
          <input className="field" type="date" value={endDate} min={startDate || undefined} onChange={(e)=>setEndDate(e.target.value)}/>
        </label>
      </div>
      {DAYS.map(([key,label]) => {
        const selected=dayTypes.find((entry)=>entry.id===days[key].type);
        return <div className="form-grid two" key={key}>
          <label>{label}
            <select className="field" aria-label={label+" work arrangement"} value={days[key].type}
              onChange={(e)=>change(key,"type",e.target.value)}>
              <option value="">Choose approved day type</option>
              {dayTypes.map((type)=><option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </label>
          <div className="form-grid two">
            <label>Start
              <input className="field" type="time" aria-label={label+" start"} value={days[key].start}
                disabled={!selected?.session_expected} onChange={(e)=>change(key,"start",e.target.value)}/>
            </label>
            <label>End
              <input className="field" type="time" aria-label={label+" end"} value={days[key].end}
                disabled={!selected?.session_expected} onChange={(e)=>change(key,"end",e.target.value)}/>
            </label>
          </div>
        </div>;
      })}
      <label>HR reason and individual agreement
        <textarea className="field" rows={3} aria-label="HR schedule reason"
          value={reason} onChange={(e)=>setReason(e.target.value)} />
      </label>
      <div className="workforce-setup-actions">
        <button type="button" className="btn" disabled={busy || !valid} onClick={save}>{busy ? "Recording..." : "Record HR-authorised schedule"}</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setEdit(false)}>Cancel</button>
      </div>
    </div>}
  </section>;
}
