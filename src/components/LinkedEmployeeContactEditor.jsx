import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";

const blank=()=>({fullName:"",preferredName:"",phone:"",reason:""});
const normalize=(value)=>String(value||"").trim();
const date=(v)=>v?new Date(v).toLocaleString("en-GB",{timeZone:"Africa/Accra"}):"Unknown time";

/** Existing linked employee only. Never edits Auth email or application authority. */
export default function LinkedEmployeeContactEditor({me,employeeId,profileId,onSaved}){
 const scope=me.org_id+":"+me.id+":"+employeeId+":"+profileId;
 const permitted=Boolean(me.is_admin&&employeeId&&profileId);
 const [verifiedScope,setVerifiedScope]=useState("");
 const [baseline,setBaseline]=useState(null);
 const [form,setForm]=useState(blank);
 const [history,setHistory]=useState([]);
 const [historyCount,setHistoryCount]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [edit,setEdit]=useState(false);
 const [busy,setBusy]=useState(false);
 const [reload,setReload]=useState(0);
 const generation=useRef(0),writeBusy=useRef(false);
 useEffect(()=>{
  const token=++generation.current;
  setVerifiedScope("");setBaseline(null);setForm(blank());setHistory([]);setHistoryCount(0);
  setLoading(true);setEdit(false);setError("");setNotice("");setBusy(false);
  if(!permitted){setLoading(false);return()=>{generation.current++;};}
  (async()=>{
   try{
    const [person,roster,events]=await Promise.all([
     supabase.from("profiles").select("id,org_id,full_name,preferred_name,phone")
      .eq("id",profileId).eq("org_id",me.org_id).single(),
     supabase.from("employee_roster").select("id,org_id,profile_id,full_name,preferred_name")
      .eq("id",employeeId).eq("org_id",me.org_id).eq("profile_id",profileId).single(),
     supabase.from("employee_linked_contact_change_events")
      .select("id,recorded_at,reason,before_record,after_record,actor_id",{count:"exact"})
      .eq("org_id",me.org_id).eq("profile_id",profileId)
      .order("recorded_at",{ascending:false}).limit(20),
    ]);
    if(person.error||roster.error||events.error)throw person.error||roster.error||events.error;
    if(person.data?.id!==profileId||person.data.org_id!==me.org_id
      ||roster.data?.id!==employeeId||roster.data.profile_id!==profileId
      ||!Array.isArray(events.data)||!Number.isInteger(events.count)
      ||events.count<events.data.length)throw new Error("Authorised employee contact records are incomplete.");
    if(token!==generation.current)return;
    const row=person.data;
    setBaseline(row);
    setForm({fullName:row.full_name||"",preferredName:row.preferred_name||"",
      phone:row.phone||"",reason:""});
    setHistory(events.data);setHistoryCount(events.count);
    setVerifiedScope(scope);
   }catch(cause){if(token===generation.current)setError(cause?.message||"HR contact details could not be loaded.");}
   finally{if(token===generation.current)setLoading(false);}
  })();
  return()=>{generation.current++;};
 },[scope,permitted,reload]);
 const ready=permitted&&!loading&&verifiedScope===scope&&!!baseline&&!error;
 const changed=ready&&(normalize(form.fullName)!==baseline.full_name
  ||(normalize(form.preferredName)||null)!==(baseline.preferred_name||null)
  ||(normalize(form.phone)||null)!==(baseline.phone||null));
 const valid=changed&&normalize(form.fullName).length>=2&&normalize(form.fullName).length<=180
  &&normalize(form.preferredName).length<=180
  &&(!normalize(form.phone)||(normalize(form.phone).length>=4&&normalize(form.phone).length<=40))
  &&normalize(form.reason).length>=8&&normalize(form.reason).length<=2000;
 async function save(){
  if(!ready||!edit||!valid||busy||writeBusy.current)return;
  const token=generation.current, expected={...baseline}, next={...form};
  setBusy(true);writeBusy.current=true;setError("");setNotice("");
  let acknowledged=false;
  try{
   const {data,error:saveError}=await supabase.rpc("admin_record_linked_person_contact",{
    p_employee_id:employeeId,p_profile_id:profileId,p_expected_full_name:expected.full_name,
    p_expected_preferred_name:expected.preferred_name,p_expected_phone:expected.phone,
    p_full_name:normalize(next.fullName),p_preferred_name:normalize(next.preferredName)||null,
    p_phone:normalize(next.phone)||null,p_reason:normalize(next.reason),
   });
   if(saveError)throw saveError;
   if(data?.employee_id!==employeeId||data?.profile_id!==profileId||!data.event_id||!data.roster_event_id)
    throw new Error("The protected HR update did not return a verified person/event identity.");
   acknowledged=true;
   if(token!==generation.current)return;
   const [person,roster,events,rosterEvents]=await Promise.all([
    supabase.from("profiles").select("id,org_id,full_name,preferred_name,phone")
     .eq("id",profileId).eq("org_id",me.org_id).single(),
    supabase.from("employee_roster").select("id,org_id,profile_id,full_name,preferred_name")
     .eq("id",employeeId).eq("org_id",me.org_id).eq("profile_id",profileId).single(),
    supabase.from("employee_linked_contact_change_events")
     .select("id,recorded_at,reason,before_record,after_record,actor_id",{count:"exact"})
     .eq("org_id",me.org_id).eq("profile_id",profileId)
     .order("recorded_at",{ascending:false}).limit(20),
    supabase.from("employee_roster_change_events")
     .select("id",{count:"exact"}).eq("org_id",me.org_id).eq("employee_id",employeeId)
     .order("recorded_at",{ascending:false}).limit(20),
   ]);
   if(person.error||roster.error||events.error||rosterEvents.error)
    throw person.error||roster.error||events.error||rosterEvents.error;
   if(person.data?.id!==profileId||person.data.org_id!==me.org_id
     ||roster.data?.id!==employeeId||roster.data.org_id!==me.org_id
     ||roster.data.profile_id!==profileId
     ||roster.data.full_name!==data.full_name
     ||(roster.data.preferred_name||null)!==(data.preferred_name||null)
     ||person.data.full_name!==data.full_name
     ||(person.data.preferred_name||null)!==(data.preferred_name||null)
     ||(person.data.phone||null)!==(data.phone||null)
     ||!Array.isArray(events.data)||!Number.isInteger(events.count)
     ||events.count<events.data.length
     ||!events.data.some(event=>event.id===data.event_id)
     ||!Array.isArray(rosterEvents.data)||!Number.isInteger(rosterEvents.count)
     ||rosterEvents.count<rosterEvents.data.length
     ||!rosterEvents.data.some(event=>event.id===data.roster_event_id))
    throw new Error("The employee contact edit or the exact HR audit event could not be verified.");
   if(token!==generation.current)return;
   setBaseline(person.data);
   setForm({fullName:person.data.full_name,preferredName:person.data.preferred_name||"",
     phone:person.data.phone||"",reason:""});
   setHistory(events.data);setHistoryCount(events.count);
   setEdit(false);
   setNotice("Employee and account profile are reconciled; both official HR histories verified.");
   onSaved?.(person.data);
  }catch(cause){if(token===generation.current){
   setError(acknowledged
    ?"The server recorded a change, but its exact HR history could not be verified. Reload before retrying."
    :cause?.message||"The employee contact update could not be confirmed.");
  }}finally{writeBusy.current=false;if(token===generation.current)setBusy(false);}
 }
 if(!permitted)return null;
 return <section className="ev2p-admin-schedule" aria-label="Linked employee HR contact record">
  <div className="row-t" style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
   <div><h3>Employee name &amp; contact</h3>
    <p className="screen-note">Official employee profile facts only. Login email and account permissions cannot be edited here.</p>
   </div>
   {ready&&!edit&&<button type="button" className="btn btn-ghost" onClick={()=>{setEdit(true);setNotice("");}}>Edit contact</button>}
  </div>
  {loading&&<p role="status">Verifying linked employee contact records…</p>}
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!loading&&error&&<button type="button" className="btn btn-ghost" onClick={()=>setReload(n=>n+1)}>Reload authorised contact record</button>}
  {ready&&!edit&&<div className="ev2p-admin-record-grid">
   <div><strong>Official name</strong><p className="screen-note">{baseline.full_name}</p></div>
   <div><strong>Preferred name</strong><p className="screen-note">{baseline.preferred_name||"Not recorded"}</p></div>
   <div><strong>Phone</strong><p className="screen-note">{baseline.phone||"Not recorded"}</p></div>
  </div>}
  {ready&&edit&&<div className="ev2p-admin-schedule-editor">
   <div className="form-grid two">
    <label>Official name<input className="field" value={form.fullName} maxLength={180} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))}/></label>
    <label>Preferred name<input className="field" value={form.preferredName} maxLength={180} onChange={e=>setForm(f=>({...f,preferredName:e.target.value}))}/></label>
    <label>Phone<input className="field" type="tel" value={form.phone} maxLength={40} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></label>
   </div>
   <label>HR change reason<textarea className="field" rows={3} maxLength={2000} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}/></label>
   <div className="workforce-setup-actions">
    <button type="button" className="btn" disabled={!valid||busy} onClick={save}>{busy?"Saving correction…":"Save HR contact"}</button>
    <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>{setEdit(false);setForm({fullName:baseline.full_name,preferredName:baseline.preferred_name||"",phone:baseline.phone||"",reason:""});}}>Cancel</button>
   </div>
  </div>}
  {ready&&history.length>0&&<details><summary>Official contact change history · {historyCount} recorded</summary>
   {history.map(event=><div className="ev2p-admin-history-row" key={event.id}>
    <strong>{date(event.recorded_at)}</strong><span>{event.reason}</span>
   </div>)}
   {historyCount>history.length&&<p className="screen-note">Showing {history.length} recent of {historyCount} authorised changes.</p>}
  </details>}
 </section>;
}
