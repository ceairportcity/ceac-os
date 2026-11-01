import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { attendanceDate } from "../lib/attendance";

const dateKey = date => date.toISOString().slice(0,10);
function reportingRange(period, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const current = new Date(date+"T12:00:00Z");
  if (Number.isNaN(current.getTime()) || dateKey(current)!==date) return null;
  if (period==="day") return {start:date,end:date};
  if (period==="week") {
    current.setUTCDate(current.getUTCDate()-(current.getUTCDay()+6)%7);
    const start=dateKey(current);
    current.setUTCDate(current.getUTCDate()+6);
    return {start,end:dateKey(current)};
  }
  const end = new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+1,0,12));
  return {start:date.slice(0,7)+"-01",end:dateKey(end)};
}
function localTime(value) {
  if (!value) return "Not recorded";
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return "Not recorded";
  return d.toLocaleString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
}
export default function CompliancePeriodReport({me,defaultPeriod="week",allowMemo=true}) {
  const [period,setPeriod]=useState(defaultPeriod);
  const [date,setDate]=useState(attendanceDate);
  const [page,setPage]=useState(0);
  const [result,setResult]=useState(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [drafting,setDrafting]=useState(false);
  const range=useMemo(()=>reportingRange(period,date),[period,date]);
  useEffect(()=>setPage(0),[period,date]);
  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");setResult(null);
    if(!range){setError("Choose a valid reporting date.");setLoading(false);return;}
    (async()=>{
      try{
        const response=await supabase.rpc("compliance_period_facts",{
          p_from:range.start,p_to:range.end,p_limit:25,p_offset:page*25
        });
        if(response.error)throw response.error;
        if(!response.data||!Array.isArray(response.data.rows)||typeof response.data.total_people!=="number")
          throw new Error("Incomplete reporting evidence");
        if(active)setResult(response.data);
      }catch{
        if(active)setError("The attendance report could not be verified. No totals have been displayed.");
      }finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[me.id,me.org_id,range?.start,range?.end,page]);
  const pageCount=Math.max(1,Math.ceil((result?.total_people||0)/25));
  async function prepareMonthlyMemo(){
    if(period!=="month"||!range||!result||loading||drafting)return;
    setDrafting(true);setError("");
    try{
      if(range.end>=attendanceDate())throw new Error("A monthly submission can be prepared after the month has ended.");
      const people=[];let total=null;
      for(let offset=0;offset<(total??1);offset+=50){
        const {data,error:readError}=await supabase.rpc("compliance_period_facts",{
          p_from:range.start,p_to:range.end,p_limit:50,p_offset:offset
        });
        if(readError||!data||!Array.isArray(data.rows)||typeof data.total_people!=="number")
          throw new Error("The complete monthly evidence could not be verified.");
        if(total===null)total=data.total_people;
        if(data.total_people!==total||total>2000||data.rows.length===0&&offset<total)
          throw new Error("The complete staff list could not be verified. Do not issue a partial report.");
        people.push(...data.rows);
      }
      if(people.length!==total||new Set(people.map(p=>p.employee_id)).size!==people.length)
        throw new Error("The report contains incomplete or duplicate staff records.");
      const sum=key=>people.reduce((n,p)=>n+Number(p[key]||0),0);
      const detail=people.length<=75?people.map(p=>
        (p.name||"Employee")+": scheduled "+p.expected_days+", started "+p.recorded_days+
        ", approved leave "+p.approved_leave_days+", requiring review "+p.days_needing_check
      ).join("\n"):"Individual attendance records remain available in the authorised Compliance Reports view.";
      const report=[
        "CEAC OS — MONTHLY COMPLIANCE SUMMARY",
        "Reporting period: "+range.start+" to "+range.end,
        "Prepared for review. This is not an approved finding or payroll instruction.",
        "",
        "People covered: "+people.length,
        "Scheduled employee-days: "+sum("expected_days"),
        "Employee-days with a recorded start: "+sum("recorded_days"),
        "Approved leave days: "+sum("approved_leave_days"),
        "Scheduled days requiring an attendance check: "+sum("days_needing_check"),
        "Days with a session still open: "+sum("open_session_days"),
        "",
        "INDIVIDUAL ATTENDANCE SUMMARY",detail,
        "",
        "COMPLIANCE OFFICER'S REVIEW",
        "[Review schedules, permissions, corrections and staff responses. Add verified findings here.]",
        "",
        "DECISIONS REQUESTED",
        "[Specify matters that require the Group Pastor's decision; do not propose automatic salary deductions.]",
        "",
        "A missing start is not automatically an absence or misconduct. Reported activity duration is not verified work time."
      ].join("\n");
      if(report.length>29000)throw new Error("The Memo is too large. Prepare an individual attachment instead.");
      const id=crypto.randomUUID();
      const {error:writeError}=await supabase.rpc("save_memo_draft",{
        p_id:id,p_version_id:null,p_subject:"Monthly Compliance Summary — "+range.start.slice(0,7),
        p_body:report,p_to:[],p_cc:[],p_decision_required:true,
        p_decision_scope:"cross_department",p_unit_id:null,p_decision_maker_id:null,
        p_expected_updated_at:null
      });
      if(writeError)throw new Error("The Memo draft could not be saved. No report was submitted.");
      window.location.assign("/?tab=messages&memo="+encodeURIComponent(id));
    }catch(e){setError(e.message||"The monthly draft could not be prepared.");setDrafting(false);}
  }

  return <section className="cp-overview" aria-label="Compliance attendance reports">
    <div className="sec"><span>Attendance reporting</span></div>
    <p className="screen-note">Review the daily evidence behind every weekly or monthly total. Attendance is counted once per person, even when they work in several departments.</p>
    <div className="cp-filters">
      <label>View <select className="field" value={period} onChange={e=>setPeriod(e.target.value)}>
        <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option>
      </select></label>
      <label>Reporting date <input className="field" aria-label="Choose a reporting date" type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
    </div>
    {range&&<p className="screen-note">Accra reporting period: {range.start} to {range.end}</p>}
    {allowMemo&&period==="month"&&<div className="cp-filters"><button type="button" className="btn" disabled={loading||drafting||!result||Boolean(error)} onClick={prepareMonthlyMemo}>{drafting?"Preparing draft…":"Prepare monthly report Memo"}</button><span className="screen-note">Review the draft and choose its HR and Group Pastor recipients before sending.</span></div>}
    {loading?<p role="status">Checking attendance records…</p>:error?<div role="alert" className="card">{error}</div>:result&&<>
      <p className="screen-note">{result.total_people} people within your authorised reporting scope. Open a name to see each day's record.</p>
      <div className="cp-scroll"><table className="cp-table">
        <thead><tr><th scope="col">Person</th><th scope="col">Scheduled days</th><th scope="col">Days started</th><th scope="col">Approved leave</th><th scope="col">Needs checking</th></tr></thead>
        <tbody>{result.rows.map(person=><tr key={person.employee_id}>
          <td><details><summary>{person.name||"Employee"}</summary>
            <p className="screen-note">Recorded attendance for this person; not a performance or disciplinary finding.</p>
            {(person.days||[]).map(entry=><p key={entry.date}>
              <strong>{entry.date}</strong> · {entry.approved_leave?"Approved leave · ":""}
              {entry.started?"Started "+localTime(entry.first_start)+" · Finished "+localTime(entry.last_finish)+" · "+(entry.location||"Location not recorded"):
                entry.scheduled?"No start recorded":"No session expected"}
              {entry.open_session?" · Open session requires review":""}
            </p>)}
          </details></td>
          <td>{person.expected_days}</td><td>{person.recorded_days}</td><td>{person.approved_leave_days}</td><td>{person.days_needing_check}</td>
        </tr>)}</tbody>
      </table></div>
      {result.rows.length===0&&<p>No authorised records found for the selected period.</p>}
      <div className="cp-filters">
        <button type="button" className="btn btn-ghost btn-sm" disabled={page===0} onClick={()=>setPage(n=>n-1)}>Previous</button>
        <span>Page {page+1} of {pageCount}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={page+1>=pageCount} onClick={()=>setPage(n=>n+1)}>Next</button>
      </div>
    </>}
    <p className="cp-fact">No start recorded does not mean a confirmed absence or violation. Compliance must review schedules, leave and explanations before reaching findings.</p>
  </section>;
}
