import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/** Existing case register summary; not an attendance score or a second engine.
 * The RPC applies tenant and role restrictions before returning any rows. */
export default function ComplianceCaseAttention({ scopeKey, onOpen }) {
  const [data,setData] = useState({ scope:"", loading:true, error:false, counts:{} });
  useEffect(() => {
    let current=true;
    setData({ scope:"", loading:true, error:false, counts:{} });
    (async () => {
      try {
        const r=await supabase.rpc("compliance_attendance_case_register",{
          p_date_from:null,p_date_to:null,
        });
        if (r.error || !Array.isArray(r.data)) throw new Error("Unverified case register");
        const counts={ open:0,referred:0,disputed:0,resolved:0 };
        for(const row of r.data) {
          if (!(row.status in counts)) throw new Error("Unexpected case state");
          counts[row.status]+=1;
        }
        if(current) setData({scope:scopeKey,loading:false,error:false,counts});
      } catch {
        if(current) setData({scope:scopeKey,loading:false,error:true,counts:{}});
      }
    })();
    return()=>{current=false;};
  },[scopeKey]);
  const ready=data.scope===scopeKey&&!data.loading&&!data.error;
  return <div className="compliance-attention-row" aria-label="Attendance observations requiring attention">
    <div>
      <strong>Attendance observations</strong>
      <p className="screen-note">Open, referred and disputed human-reviewed cases; not automatic misconduct findings.</p>
      {ready && <small>
        {data.counts.open} open · {data.counts.referred} referred · {data.counts.disputed} disputed · {data.counts.resolved} resolved
      </small>}
      {(!ready && !data.error) && <small>Verifying authorised case register…</small>}
      {data.error && <small role="alert">Case counts unavailable; no zero total assumed.</small>}
    </div>
    {onOpen && <button className="btn btn-ghost btn-sm" type="button" onClick={onOpen}>
      Review cases
    </button>}
  </div>;
}
