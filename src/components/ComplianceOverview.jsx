import { useMemo } from "react";
import { attendanceDate, startEvidence } from "../lib/attendance";
import AdminWorkforceToday from "./AdminWorkforceToday";
import ComplianceCaseAttention from "./ComplianceCaseAttention";
import { EmptyState, LoadingState, ProductNotice } from "./bits";
import { CeacIcon } from "../experience-v2/icons";

function time(value) {
  return value ? new Date(value).toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" }) : "Not recorded";
}
function noticeOnDate(notice,date){
  const start=attendanceDate(new Date(notice.starts_at));
  const end=notice.expected_return_at?attendanceDate(new Date(notice.expected_return_at)):start;
  return start<=date&&end>=date;
}
function rowState(row,date) {
  if((row.approved_leave||[]).some(leave=>leave.state==="current"&&leave.start_date<=date&&leave.end_date>=date))return "Approved leave";
  if((row.notices||[]).some(notice=>notice.kind==="temporary_permission"&&notice.request_state==="fulfilled"&&!notice.returned_at&&noticeOnDate(notice,date)))return "Permission recorded";
  if((row.sessions||[]).some(session=>!session.ended_at))return "Recorded present";
  if(row.sessions?.length)return "Session ended";
  if(row.expected_today===true)return "No session recorded";
  return row.expected_today===false ? (row.day_type||"No session expected") : "Schedule not configured";
}

export default function ComplianceOverview({
  date,onDateChange,onRefresh,scopeKey,rows,units=[],loading,error,
  activePolicies,requirements,acknowledgements,evidenceLatest,exceptionLatest,
  openWork,openObservations,openAnnouncements,onSection,onEvidence,onException,
}) {
  const unitNames=useMemo(()=>new Map(units.map(unit=>[unit.id,unit.name])),[units]);
  // Read ONLY the existing sanitised, role-scoped attendance response.
  const workforceMapRows=useMemo(()=>({
    roster:rows.map(row=>({id:row.employee_id||("profile:"+row.profile_id),profile_id:row.profile_id||null,
      full_name:row.name,units:row.unit_id?[{name:unitNames.get(row.unit_id)||"Unit not named"}]:[]})),
    sessions:rows.flatMap(row=>row.profile_id?(row.sessions||[]).map(session=>({
      id:session.id,profile_id:row.profile_id,started_at:session.started_at,ended_at:session.ended_at,
      lat:session.start_lat,lng:session.start_lng,place:session.place,
      location_captured_at:session.location_captured_at,location_accuracy_m:session.start_location_accuracy_m,
    })):[]),
  }),[rows,unitNames]);
  return <div className="cp-overview">
    <div className="cp-layout">
      <ComplianceCaseAttention scopeKey={scopeKey} onOpen={openObservations}
        evidence={evidenceLatest} exceptions={exceptionLatest} onEvidence={onEvidence} onException={onException} />
      <aside className="cp-policy" aria-labelledby="compliance-policy-title">
        <h2 id="compliance-policy-title">Policy workspace</h2>
        {[["policies","Policies & revisions","record"],["policies","Acknowledgements","people"],
          ["requirements","Requirements","work"],["evidence","Evidence history","record"]].map(([section,label,icon])=>
          <button className="cp-link" key={label} type="button" onClick={()=>onSection?.(section)}>
            <CeacIcon name={icon}/><span>{label}</span><span aria-hidden="true">›</span>
          </button>)}
        <div className="cp-note"><CeacIcon name="help"/><div><strong>Review with context</strong>
          <p>Recorded evidence supports review. It does not determine a finding.</p></div></div>
        <details className="screen-note cp-totals"><summary>Recorded policy context</summary>
          <p>CEAC OS does not calculate an employee compliance score.</p>
          <p>{activePolicies.length} current policies · {requirements.length} recorded requirements · {acknowledgements.length} acknowledgements recorded</p>
          <p>These counts organise recorded attention only. They do not calculate compliance, guilt, performance or disciplinary outcomes.</p>
        </details>
        {(openWork||openAnnouncements)&&<div className="cp-links">
          {openWork&&<button className="cp-action" onClick={openWork}>Open authorised work →</button>}
          {openAnnouncements&&<button className="cp-action" onClick={openAnnouncements}>Publish policy instruction →</button>}
        </div>}
      </aside>
    </div>

    <section className="cp-attendance" aria-labelledby="compliance-attendance-title">
      <header className="cp-heading">
        <div><h2 id="compliance-attendance-title">Attendance context</h2><p>Recent attendance activity for reference</p></div>
        <div className="cp-filters">
          <input type="date" className="field" aria-label="Compliance overview date" value={date} onChange={event=>onDateChange(event.target.value)}/>
          <button type="button" className="cp-action" onClick={onRefresh} disabled={loading}>Refresh evidence</button>
          <button type="button" className="cp-action" onClick={()=>openObservations?.()}>Open attendance cases →</button>
        </div>
      </header>
      {error&&<ProductNotice tone="error" title="Attendance evidence unavailable">{error}</ProductNotice>}
      {loading?<LoadingState label="Loading compliance overview…"/>:!error&&rows.length?<div className="cp-scroll">
        <table className="cp-table"><thead><tr>
          <th scope="col">Employee</th><th scope="col">Department</th><th scope="col">Expected start</th>
          <th scope="col">Recorded start</th><th scope="col">Status</th>
        </tr></thead><tbody>{rows.map(row=>{
          const start=startEvidence(row,date);
          return <tr key={row.employee_id||row.profile_id}>
            <td><details><summary>{row.name}</summary><div>
              <p>{start.label}</p><p>Verified office start: {time(start.verified)}</p>
              <p>Expected hours: {row.expected_start&&row.expected_end?`${row.expected_start.slice(0,5)}–${row.expected_end.slice(0,5)}`:"Not configured"}</p>
              <p>Latest verification: {row.latest_location?.captured_at?new Date(row.latest_location.captured_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"}):"Not recorded"}</p>
              <p>Last CEAC activity: {row.last_activity_at?new Date(row.last_activity_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"}):"Not recorded"}</p>
              {(row.notices||[]).filter(notice=>noticeOnDate(notice,date)).map((notice,index)=><p key={notice.id||index}>{String(notice.kind||"Attendance notice").replaceAll("_"," ")} · {String(notice.request_state||"waiting").replaceAll("_"," ")}</p>)}
              {(row.approved_leave||[]).map((leave,index)=><p key={leave.id||index}>Approved leave: {leave.start_date}–{leave.end_date} · {leave.state}</p>)}
            </div></details></td>
            <td>{unitNames.get(row.unit_id)||"Not recorded"}</td>
            <td>{row.expected_today===true?(row.expected_start?.slice(0,5)||"Session expected"):row.expected_today===false?"No session expected":"Not configured"}</td>
            <td>{time(row.sessions?.[0]?.started_at)}</td>
            <td><span className="cp-status">{rowState(row,date)}</span></td>
          </tr>;
        })}</tbody></table>
      </div>:!error&&<EmptyState compact title="No attendance evidence in scope">The overview remains empty until authorised employee records are available.</EmptyState>}
      <p className="cp-fact">“No session recorded” is not an absence or misconduct finding.</p>
    </section>
    {!loading&&!error&&<AdminWorkforceToday roleLabel="Compliance" dateLabel={date}
      roster={workforceMapRows.roster} sessions={workforceMapRows.sessions}/>}
  </div>;
}
