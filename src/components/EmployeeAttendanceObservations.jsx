import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { PeopleEmpty, PeopleWorkspaceSection } from "../experience-v2/people-family/PeopleFamilyV2";

/** Read-only HR case context. Uses the original tenant-scoped observation
 * register; never infers employee absence, discipline, KPI or correction. */
export default function EmployeeAttendanceObservations({ me, employeeId }) {
  const scope = `${me.org_id}:${me.id}:${employeeId}`;
  const [result,setResult] = useState({scope:"",rows:[],loading:true,error:""});
  useEffect(() => {
    let current=true;
    setResult({scope:"",rows:[],loading:true,error:""});
    (async()=>{
      try{
        const response=await supabase.rpc("compliance_attendance_case_register",{
          p_date_from:null,p_date_to:null,
        });
        if(response.error||!Array.isArray(response.data))
          throw new Error("Observation scope cannot be verified");
        const own=response.data.filter(row=>row.employee_id===employeeId);
        if(current)setResult({scope,rows:own,loading:false,error:""});
      }catch{
        if(current)setResult({scope,rows:[],loading:false,
          error:"Authorised observation history is unavailable. This is not confirmation that no observations exist."});
      }
    })();
    return()=>{current=false;};
  },[scope]);
  const ready=result.scope===scope&&!result.loading&&!result.error;
  return <PeopleWorkspaceSection title="Attendance observations & resolutions"
    description="Authorised Compliance observations, responses and human resolutions are shown separately from the original time entries and employee schedules.">
    {!ready&&!result.error&&<p role="status">Verifying employee observation history…</p>}
    {result.error&&<p role="alert">{result.error}</p>}
    {ready&&(result.rows.length
      ?<div className="ev2p-admin-history-list">{result.rows.map(row=><article className="ev2p-admin-history-row" key={row.id}>
        <div><strong>{row.work_date} · {String(row.category||"other").replaceAll("_"," ")}</strong>
          <span>{String(row.status||"open").replaceAll("_"," ")} · {row.events?.length||0} attributable events</span>
          {(row.events||[]).map(event=><p key={event.id}>
            {String(event.event_type||"recorded").replaceAll("_"," ")} ·
            {event.explanation||event.factual_note||"Evidence recorded"} ·
            {String(event.created_at||"").slice(0,10)}
          </p>)}
        </div>
      </article>)}</div>
      :<PeopleEmpty title="No authorised attendance observations"
        description="No cases are visible for this employee in the verified register. No conclusion about attendance or performance is inferred." />)}
    <p className="screen-note">Formal attendance corrections remain separate HR-authorised records; an officer’s observation cannot rewrite them.</p>
  </PeopleWorkspaceSection>;
}
