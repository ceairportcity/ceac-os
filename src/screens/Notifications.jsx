import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const titles={
 case_opened:"Attendance question needs your response",
 case_response:"An attendance question has a new response",
 case_referred:"Attendance question referred for review",
 case_resolved:"An attendance question has been resolved",
 memo_sent:"New Memo received",
 memo_response:"A Memo has a new response",
 work_assigned:"New work assigned to you",
 policy_published:"A policy has been published for you",
 evidence_submitted:"Evidence needs review",
 evidence_reviewed:"Your evidence has been reviewed",
 exception_requested:"An exception request needs review",
 exception_decided:"Your exception request has an update"
};
const actionable=new Set(["case_opened","case_response","case_referred","memo_sent","work_assigned","policy_published","evidence_submitted","exception_requested"]);
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||"");
function target(row){
 if(!uuid(row.context_id))return null;
 const id=encodeURIComponent(row.context_id);
 if(row.context_kind==="compliance_case")return "/?tab=compliance&case="+id;
 if(row.context_kind==="memo")return "/?tab=messages&memo="+id;
 if(row.context_kind==="work_item")return "/?tab=work&item="+id;
 if(row.context_kind==="compliance_policy")return "/?tab=compliance&section=policies";
 if(row.context_kind==="compliance_evidence")return "/?tab=compliance&section=evidence";
 if(row.context_kind==="compliance_exception")return "/?tab=compliance&section=exceptions";
 return null;
}
const when=value=>value?new Date(value).toLocaleString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"";
export default function Notifications({me}){
 const [rows,setRows]=useState(null);
 const [filter,setFilter]=useState("attention");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(null);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;setRows(null);setError("");
  (async()=>{
   const r=await supabase.rpc("my_ceac_notifications");
   if(!active)return;
   if(r.error||!Array.isArray(r.data)){
    setError("Updates could not be verified. Retry to read your latest notifications.");
   }else setRows(r.data);
  })().catch(()=>{if(active)setError("Updates are currently unavailable.");});
  return()=>{active=false;};
 },[me.org_id,me.id,refresh]);
 const visible=(rows||[]).filter(row=>filter==="all"||!row.read_at&&actionable.has(row.kind));
 async function open(row){
  const href=target(row);
  if(!href)return;
  setBusy(row.id);setError("");
  const r=await supabase.rpc("mark_ceac_notification_read",{p_id:row.id});
  if(r.error){setError("This update could not be confirmed. Check your access and retry.");setBusy(null);return;}
  window.location.assign(href);
 }
 return <section className="msg-layout" aria-label="Your updates">
  <div className="msg-directory" style={{width:"100%",maxWidth:"none"}}>
   <div className="sec"><span>Your updates</span>
    <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setRefresh(n=>n+1)}>Refresh</button>
   </div>
   <p className="screen-note">See work, Compliance questions and Memos that concern you. Private details appear only after you open an authorised record.</p>
   <div className="cp-filters">
    <button type="button" className="btn btn-ghost btn-sm" aria-pressed={filter==="attention"} onClick={()=>setFilter("attention")}>Needs your attention</button>
    <button type="button" className="btn btn-ghost btn-sm" aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>All updates</button>
   </div>
   {error&&<div role="alert" className="card">{error}</div>}
   {rows===null&&!error&&<p role="status">Checking updates…</p>}
   {rows!==null&&!error&&visible.map(row=><button key={row.id} type="button"
    className="msg-row" disabled={busy===row.id||!target(row)} onClick={()=>open(row)}
    aria-label={titles[row.kind]||"New update"}>
    <span className="msg-copy"><strong>{titles[row.kind]||"New update"}</strong>
     <small>{when(row.created_at)} · {row.read_at?"Read":"Not read"}</small></span>
    <span className="msg-meta">Open</span>
   </button>)}
   {rows!==null&&!error&&visible.length===0&&<p className="screen-note">No updates in this view.</p>}
  </div>
 </section>;
}
