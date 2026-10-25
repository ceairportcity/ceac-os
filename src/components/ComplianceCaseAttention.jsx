import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { complianceReviewQueue } from "../lib/complianceReviewQueue";
import { CeacIcon } from "../experience-v2/icons";

/** Existing case register summary; not an attendance score or a second engine.
 * The RPC applies tenant and role restrictions before returning any rows. */
export default function ComplianceCaseAttention({ scopeKey, onOpen, evidence = [], exceptions = [], onEvidence, onException }) {
  const [data,setData] = useState({ scope:"", loading:true, error:false, rows:[] });
  const [filter,setFilter] = useState("all");
  const [search,setSearch] = useState("");
  const [refresh,setRefresh] = useState(0);
  useEffect(() => {
    let current=true;
    setData({ scope:"", loading:true, error:false, rows:[] });
    (async () => {
      try {
        const r=await supabase.rpc("compliance_attendance_case_register",{
          p_date_from:null,p_date_to:null,
        });
        if (r.error || !Array.isArray(r.data)) throw new Error("Unverified case register");
        for(const row of r.data) {
          if (!["open","referred","disputed","resolved"].includes(row.status)) throw new Error("Unexpected case state");
        }
        if(current) setData({scope:scopeKey,loading:false,error:false,rows:r.data});
      } catch {
        if(current) setData({scope:scopeKey,loading:false,error:true,rows:[]});
      }
    })();
    return()=>{current=false;};
  },[scopeKey,refresh]);
  const ready=data.scope===scopeKey&&!data.loading&&!data.error;
  const queue=useMemo(()=>complianceReviewQueue(ready?data.rows:[],evidence,exceptions)
    .filter(row=>(filter==="all"||row.kind===filter)&&(!search.trim()||
      [row.title,row.person,row.type,row.status].join(" ").toLowerCase().includes(search.trim().toLowerCase()))),
  [ready,data.rows,evidence,exceptions,filter,search]);
  return <section className="cp-desk" aria-labelledby="compliance-desk-title">
    <header className="cp-heading">
      <div><h2 id="compliance-desk-title">Your review desk</h2><p>Items requiring a human review</p></div>
      <div className="cp-filters">
        <select className="field" aria-label="Filter Compliance review items" value={filter} onChange={event=>setFilter(event.target.value)}>
          <option value="all">All items</option><option value="attendance">Attendance cases</option>
          <option value="evidence">Evidence</option><option value="exceptions">Exceptions</option>
        </select>
        <input className="field" type="search" aria-label="Search Compliance review items" placeholder="Search items…" value={search} onChange={event=>setSearch(event.target.value)} />
      </div>
    </header>
    {!ready&&!data.error&&<p role="status">Verifying authorised case register…</p>}
    {data.error&&<div role="alert" className="cp-error">Attendance cases unavailable; no empty result is assumed.
      <button className="btn btn-ghost btn-sm" onClick={()=>setRefresh(value=>value+1)}>Retry cases</button>
    </div>}
    <div className="cp-items">
      {queue.map(row=><div className="cp-item" key={row.key}>
        <span className="cp-icon"><CeacIcon name="record" /></span>
        <div className="cp-copy"><small className="eyebrow">{row.type}</small><h3>{row.title}</h3><p>{row.person} · {row.context}</p></div>
        <span className={`cp-status is-${row.kind}`}>{row.status}</span>
        <button type="button" className="cp-action" aria-label={`Review ${row.type.toLowerCase()} for ${row.person}`} onClick={()=>{
          if(row.kind==="attendance")onOpen?.(row.record.id);
          else if(row.kind==="evidence")onEvidence?.(row.record);
          else onException?.(row.record);
        }}>Review <span aria-hidden="true">→</span></button>
      </div>)}
      {ready&&!queue.length&&<p className="cp-empty">No items match this verified review view. Change the filter or open the relevant records tab.</p>}
    </div>
  </section>;
}
