import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";

/** Read only already-authorised, sent Memo versions. No extra personnel privileges. */
export default function ComplianceReportReferences({me}){
  const [rows,setRows]=useState(null),[error,setError]=useState("");
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let current=true;
    setRows(null);setError("");
    (async()=>{
      try{
        const r=await supabase.from("memos")
          .select("id,status,updated_at,memo_versions!memo_versions_memo_id_fkey(subject,sent_at)")
          .neq("status","draft").order("updated_at",{ascending:false}).limit(200);
        if(r.error)throw r.error;
        if(!Array.isArray(r.data))throw new Error("Unable to verify Compliance reports.");
        const matching=r.data.flatMap(m=>(m.memo_versions||[])
          .filter(v=>v.sent_at&&/^Monthly Compliance Summary\s*[—-]\s*\d{4}-\d{2}$/.test(v.subject||""))
          .map(v=>({id:m.id,subject:v.subject,sentAt:v.sent_at,status:m.status})))
          .sort((a,b)=>String(b.sentAt).localeCompare(String(a.sentAt))).slice(0,12);
        if(current)setRows(matching);
      }catch{
        if(current)setError("Submitted Compliance reports could not be checked. Please retry.");
      }
    })();
    return()=>{current=false;};
  },[me.org_id,me.id,reload]);
  return <section className="ev2rep-live-state" aria-label="Submitted Compliance reports">
    <div className="sec"><span>Compliance reports</span>
      <button className="btn btn-ghost btn-sm" type="button" onClick={()=>setReload(n=>n+1)}>Refresh</button>
    </div>
    <p className="screen-note">Monthly Compliance submissions sent to you appear here. Open a Memo for the submitted version, its evidence, and any decisions.</p>
    {rows===null&&!error&&<p role="status">Checking authorised reports…</p>}
    {error&&<p role="alert">{error}</p>}
    {rows&&rows.length===0&&<p>No submitted Compliance reports are available to this account yet.</p>}
    {rows&&rows.map(row=><a key={row.id+row.sentAt} href={"/?tab=messages&memo="+encodeURIComponent(row.id)} className="ev2rep-record-row">
      <strong>{row.subject}</strong> <span>{new Date(row.sentAt).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",year:"numeric"})}</span>
      <small>{row.status.replaceAll("_"," ")}</small>
    </a>)}
  </section>;
}
