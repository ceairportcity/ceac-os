import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
export default function ComplianceReportReferences({me}){
 const [rows,setRows]=useState(null);
 const [error,setError]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  let active=true;setRows(null);setError("");
  (async()=>{
   try{
    const result=await supabase.from("compliance_report_filings")
      .select("id,memo_id,period_start,period_end,issued_at,people_verified")
      .order("issued_at",{ascending:false}).limit(25);
    if(result.error||!Array.isArray(result.data))throw new Error("Incomplete filing register");
    if(active)setRows(result.data);
   }catch{if(active)setError("Submitted Compliance reports could not be checked. Retry.");}
  })();
  return()=>{active=false;};
 },[me.org_id,me.id,reload]);
 return <section className="ev2rep-live-state" aria-label="Submitted Compliance reports">
  <div className="sec"><span>Compliance reports</span>
   <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setReload(n=>n+1)}>Refresh</button>
  </div>
  <p className="screen-note">Monthly Compliance reports formally issued to your account. Open the Memo for the original report and decisions.</p>
  {rows===null&&!error&&<p role="status">Checking authorised reports…</p>}
  {error&&<p role="alert">{error}</p>}
  {rows?.length===0&&<p>No issued Compliance report is available to this account.</p>}
  {rows?.map(row=><a key={row.id} href={"/?tab=messages&memo="+encodeURIComponent(row.memo_id)} className="ev2rep-record-row">
    <strong>Monthly Compliance Summary — {row.period_start.slice(0,7)}</strong>
    <span>{new Date(row.issued_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",year:"numeric"})}</span>
    <small>{row.people_verified} people covered · Issued</small>
  </a>)}
 </section>;
}
