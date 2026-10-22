import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {eligibleRosterManagers} from "../lib/eligibleRosterManagers";

const types=[["not_recorded","Not yet recorded"],["permanent","Permanent"],["fixed_term","Fixed-term"],["volunteer","Volunteer"]];
const statuses=[["active","Active"],["inactive","Inactive"]];
const blank=()=>({fullName:"",preferredName:"",jobTitle:"",employmentType:"not_recorded",status:"active",primaryUnit:"",secondaryUnits:[],managerId:"",contactEmail:"",contactPhone:"",startedOn:"",reason:""});
const timestamp=value=>value?new Date(value).toLocaleString("en-GB",{timeZone:"Africa/Accra"}):"Not recorded";

/** HR employment/placement for roster-only staff. NEVER creates a login or grants a role. */
export default function RosterOnlyEmploymentEditor({me,employeeId,units=[],onSaved}){
 const authorised=Boolean(me.is_admin);
 const [form,setForm]=useState(blank),[updatedAt,setUpdatedAt]=useState(null);
 const [history,setHistory]=useState([]),[edit,setEdit]=useState(false);
 const [managerMemberships,setManagerMemberships]=useState([]),[managerDirectory,setManagerDirectory]=useState([]),[managersVerified,setManagersVerified]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[uncertain,setUncertain]=useState(false);
 const [reload,setReload]=useState(0),generation=useRef(0),sending=useRef(false);
 const scope=me.org_id+":"+me.id+":"+employeeId;
 useEffect(()=>{
  const token=++generation.current;setLoading(true);setEdit(false);setUpdatedAt(null);
  setHistory([]);setManagerMemberships([]);setManagerDirectory([]);setManagersVerified(false);setError("");setNotice("");setUncertain(false);
  if(!authorised||!employeeId){setLoading(false);return()=>{generation.current++;};}
  (async()=>{
   try{
    const [detail,row,events,managerRead,profilesRead,employmentRead]=await Promise.all([
     supabase.rpc("admin_employee_roster_detail",{p_employee_id:employeeId}),
     supabase.from("employee_roster").select("id,org_id,profile_id,updated_at,manager_profile_id,hr_contact_email,hr_contact_phone,hr_started_on")
      .eq("org_id",me.org_id).eq("id",employeeId).single(),
     supabase.from("employee_roster_change_events").select("id,recorded_at,reason,actor_id,before_record,after_record")
      .eq("org_id",me.org_id).eq("employee_id",employeeId)
      .order("recorded_at",{ascending:false}).limit(10),
     supabase.from("unit_memberships")
      .select("profile_id,unit_id,role",{count:"exact"})
      .eq("org_id",me.org_id).eq("role","manager").order("unit_id").order("profile_id").range(0,999),
     supabase.from("profiles").select("id,full_name,active",{count:"exact"})
      .eq("org_id",me.org_id).order("id").range(0,999),
     supabase.from("employment_records").select("profile_id,employment_status",{count:"exact"})
      .eq("org_id",me.org_id).order("profile_id").range(0,999),
    ]);
    if(detail.error||row.error||events.error||managerRead.error||profilesRead.error||employmentRead.error)
     throw detail.error||row.error||events.error||managerRead.error||profilesRead.error||employmentRead.error;
    if(!detail.data?.employee||row.data?.id!==employeeId||row.data?.profile_id!==null
      ||!row.data.updated_at||!Array.isArray(detail.data.units)||!Array.isArray(events.data)
      ||!Array.isArray(managerRead.data)||!Number.isInteger(managerRead.count)
      ||managerRead.count!==managerRead.data.length
      ||!Array.isArray(profilesRead.data)||!Number.isInteger(profilesRead.count)
      ||profilesRead.count!==profilesRead.data.length
      ||!Array.isArray(employmentRead.data)||!Number.isInteger(employmentRead.count)
      ||employmentRead.count!==employmentRead.data.length)
     throw new Error("This unlinked employee record could not be verified.");
    if(token!==generation.current)return;
    const e=detail.data.employee, placements=detail.data.units;
    setForm({fullName:e.full_name||"",preferredName:e.preferred_name||"",jobTitle:e.job_title||"",
     employmentType:e.employment_type||"not_recorded",status:e.employment_status||"active",
     primaryUnit:placements.find(u=>u.is_primary)?.unit_id||"",
     secondaryUnits:placements.filter(u=>!u.is_primary).map(u=>u.unit_id),
     managerId:row.data.manager_profile_id||"",contactEmail:row.data.hr_contact_email||"",contactPhone:row.data.hr_contact_phone||"",startedOn:row.data.hr_started_on||"",reason:""});
    // A manager may have a legitimate app account and operational unit-manager
    // authority while HR has not linked that account to an imported roster row.
    // Use the authorised operational directory and current employment records,
    // not the employee roster or job title, for all manager options.
    const employmentByProfile=new Map(employmentRead.data.map(record=>[record.profile_id,record.employment_status]));
    const directory=profilesRead.data.map(profile=>({
     profile_id:profile.id,full_name:profile.full_name,
     account_active:profile.active===true,
     active:employmentByProfile.get(profile.id)==="active",
    }));
    eligibleRosterManagers(directory,managerRead.data,placements.find(u=>u.is_primary)?.unit_id||"");
    setManagerDirectory(directory);setManagerMemberships(managerRead.data);setManagersVerified(true);
    setUpdatedAt(row.data.updated_at);setHistory(events.data);
   }catch(cause){if(token===generation.current)setError(cause.message||"The employee record is unavailable.");}
   finally{if(token===generation.current)setLoading(false);}
  })();
  return()=>{generation.current++;};
 },[scope,authorised,reload]);

 const managerOptions=managersVerified?eligibleRosterManagers(managerDirectory,managerMemberships,form.primaryUnit):[];
 const valid=Boolean(updatedAt&&!loading&&!uncertain&&managersVerified&&form.fullName.trim().length>=2
  &&form.reason.trim().length>=8&&types.some(([value])=>value===form.employmentType)
  &&statuses.some(([value])=>value===form.status)
  &&(!form.contactEmail.trim()||(form.contactEmail.trim().length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())))
  &&(!form.contactPhone.trim()||(form.contactPhone.trim().length>=4&&form.contactPhone.trim().length<=40))
  &&(!form.startedOn||/^\d{4}-\d{2}-\d{2}$/.test(form.startedOn))
  &&(!form.managerId||managerOptions.some(row=>row.profile_id===form.managerId)));
 const editValue=(name,value)=>setForm(old=>({...old,[name]:value}));
 async function save(){
  if(!authorised||!edit||!valid||busy||sending.current)return;
  const token=generation.current,snapshot={...form,secondaryUnits:[...form.secondaryUnits]};
  sending.current=true;setBusy(true);setError("");setNotice("");
  let acknowledged=false;
  try{
   const result=await supabase.rpc("admin_record_roster_employment_profile",{
    p_employee_id:employeeId,p_expected_updated_at:updatedAt,
    p_full_name:snapshot.fullName.trim(),p_preferred_name:snapshot.preferredName.trim()||null,
    p_job_title:snapshot.jobTitle.trim()||null,p_employment_type:snapshot.employmentType,
    p_employment_status:snapshot.status,p_primary_unit_id:snapshot.primaryUnit||null,
    p_secondary_unit_ids:snapshot.secondaryUnits,p_manager_profile_id:snapshot.managerId||null,
    p_contact_email:snapshot.contactEmail.trim()||null,
    p_contact_phone:snapshot.contactPhone.trim()||null,
    p_started_on:snapshot.startedOn||null,
    p_reason:snapshot.reason.trim(),
   });
   if(result.error)throw result.error;
   if(result.data?.employee_id!==employeeId||result.data?.profile_id!==null||!result.data?.updated_at)
    throw new Error("The server did not confirm the intended employee record.");
   acknowledged=true;
   const [detail,version,historyRead]=await Promise.all([
    supabase.rpc("admin_employee_roster_detail",{p_employee_id:employeeId}),
    supabase.from("employee_roster").select("updated_at,manager_profile_id,profile_id,hr_contact_email,hr_contact_phone,hr_started_on")
     .eq("org_id",me.org_id).eq("id",employeeId).single(),
    supabase.from("employee_roster_change_events").select("id,recorded_at,reason,actor_id,before_record,after_record")
     .eq("org_id",me.org_id).eq("employee_id",employeeId).order("recorded_at",{ascending:false}).limit(10),
   ]);
   if(detail.error||version.error||historyRead.error)throw detail.error||version.error||historyRead.error;
   if(detail.data?.employee?.full_name!==snapshot.fullName.trim()
     ||detail.data.employee.employment_type!==snapshot.employmentType
     ||detail.data.employee.employment_status!==snapshot.status
     ||version.data?.profile_id!==null||Date.parse(version.data?.updated_at)!==Date.parse(result.data.updated_at)
     ||(version.data?.manager_profile_id||"")!==snapshot.managerId
     ||(version.data?.hr_contact_email||"")!==snapshot.contactEmail.trim().toLowerCase()
     ||(version.data?.hr_contact_phone||"")!==snapshot.contactPhone.trim()
     ||(version.data?.hr_started_on||"")!==snapshot.startedOn
     ||JSON.stringify((detail.data.units||[]).map(unit=>unit.unit_id).sort())
      !==JSON.stringify([...snapshot.secondaryUnits,...(snapshot.primaryUnit?[snapshot.primaryUnit]:[])].sort()))
    throw new Error("The saved employee record could not be independently verified.");
   if(token!==generation.current)return;
   setEdit(false);setNotice("Employee, contact and unit placement changes saved. HR audit history retained.");
   setUpdatedAt(version.data.updated_at);setHistory(historyRead.data||[]);
   setForm({...snapshot,contactEmail:version.data.hr_contact_email||"",
    contactPhone:version.data.hr_contact_phone||"",startedOn:version.data.hr_started_on||"",reason:""});
   onSaved?.({...detail.data.employee,roster_units:detail.data.units,
    employee_id:employeeId,manager_profile_id:version.data.manager_profile_id,
    hr_contact_email:version.data.hr_contact_email,hr_contact_phone:version.data.hr_contact_phone,
    hr_started_on:version.data.hr_started_on,
    unit_id:snapshot.primaryUnit||null,
    unit_name:units.find(u=>u.id===snapshot.primaryUnit)?.name||null});
  }catch(cause){
   if(token===generation.current){
    if(acknowledged)setUncertain(true);
    setError(acknowledged
     ?"The change was recorded but readback is incomplete. Refresh the employee record before attempting another change."
     :cause.message||"The employment change was not confirmed; refresh before retrying.");
   }
  }finally{sending.current=false;if(token===generation.current)setBusy(false);}
 }
 if(!authorised)return null;
 return <section className="ev2p-admin-schedule" aria-label="Roster-only HR record and placement">
  <div className="row-t" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div><h3 style={{margin:"0 0 4px"}}>Employment &amp; organisational placement</h3>
    <p className="screen-note" style={{margin:0}}>Edit this employee without creating an account. Unit and manager records do not grant app permissions.</p></div>
   {!edit&&!loading&&!error&&<button type="button" className="btn btn-ghost" onClick={()=>{setEdit(true);setNotice("");}}>Edit employee record</button>}
  </div>
  {loading&&<p role="status">Verifying this employee's HR record…</p>}
  {error&&<p role="alert">{error}</p>}
  {notice&&!loading&&<p role="status">{notice}</p>}
  {!loading&&error&&(!edit||uncertain)&&<button type="button" className="btn btn-ghost" onClick={()=>setReload(n=>n+1)}>{uncertain?"Verify saved record":"Retry loading employee record"}</button>}
  {!loading&&!error&&!edit&&<div className="ev2p-admin-record-grid">
   <div><strong>{form.fullName}</strong><p className="screen-note">{form.jobTitle||"No job title"} · {form.employmentType.replaceAll("_"," ")}</p></div>
   <div><strong>Primary unit</strong><p className="screen-note">{units.find(u=>u.id===form.primaryUnit)?.name||"Not assigned"}</p></div>
   <div><strong>Other units</strong><p className="screen-note">{form.secondaryUnits.map(id=>units.find(u=>u.id===id)?.name||"Unknown unit").join(", ")||"None recorded"}</p></div>
   <div><strong>Reporting manager</strong><p className="screen-note">{managerDirectory.find(m=>m.profile_id===form.managerId)?.full_name||"Not recorded"}</p></div>
   <div><strong>HR contact email</strong><p className="screen-note">{form.contactEmail||"Not recorded"} · not an account login</p></div>
   <div><strong>HR contact phone</strong><p className="screen-note">{form.contactPhone||"Not recorded"}</p></div>
   <div><strong>Employment start date</strong><p className="screen-note">{form.startedOn||"Not recorded"}</p></div>
  </div>}
  {edit&&!loading&&<div className="ev2p-admin-schedule-editor">
   <div className="form-grid two">
    <label>Full name<input className="field" value={form.fullName} maxLength={180} onChange={e=>editValue("fullName",e.target.value)}/></label>
    <label>Preferred name<input className="field" value={form.preferredName} maxLength={180} onChange={e=>editValue("preferredName",e.target.value)}/></label>
    <label>Job title<input className="field" value={form.jobTitle} maxLength={180} onChange={e=>editValue("jobTitle",e.target.value)}/></label>
     <label>HR contact email (not login)<input className="field" type="email" value={form.contactEmail} maxLength={254} onChange={e=>editValue("contactEmail",e.target.value)}/></label>
     <label>HR contact phone<input className="field" type="tel" value={form.contactPhone} maxLength={40} onChange={e=>editValue("contactPhone",e.target.value)}/></label>
     <label>Employment start date<input className="field" type="date" value={form.startedOn} onChange={e=>editValue("startedOn",e.target.value)}/></label>
    <label>Employment type<select className="field" value={form.employmentType} onChange={e=>editValue("employmentType",e.target.value)}>
     {types.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Status<select className="field" value={form.status} onChange={e=>editValue("status",e.target.value)}>
     {statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Primary department<select className="field" value={form.primaryUnit}
     onChange={e=>setForm(old=>({...old,primaryUnit:e.target.value,
      secondaryUnits:old.secondaryUnits.filter(id=>id!==e.target.value),managerId:""}))}>
     <option value="">Not assigned</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}
    </select></label>
   </div>
   <fieldset style={{border:"1px solid var(--ev2-line,var(--line))",borderRadius:8,margin:"12px 0",padding:12}}>
    <legend>Additional departments (without additional app authority)</legend>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}>
     {units.filter(unit=>unit.id!==form.primaryUnit).map(unit=><label key={unit.id} style={{display:"flex",gap:7,alignItems:"start"}}>
      <input type="checkbox" checked={form.secondaryUnits.includes(unit.id)} onChange={event=>setForm(old=>({
       ...old,secondaryUnits:event.target.checked?[...old.secondaryUnits,unit.id]:old.secondaryUnits.filter(id=>id!==unit.id)
      }))}/>{unit.name}</label>)}
    </div>
   </fieldset>
   <label>Reporting manager<select className="field" value={form.managerId} disabled={!form.primaryUnit}
    onChange={event=>editValue("managerId",event.target.value)}>
    <option value="">Not recorded</option>
    {managerOptions.map(manager=><option key={manager.profile_id} value={manager.profile_id}>{manager.full_name}</option>)}
   </select></label>
   {form.primaryUnit&&!managerOptions.length&&<p className="screen-note">No active manager of this department is available. Leave this unset rather than assuming authority.</p>}
   <label>Reason for this HR change<textarea className="field" rows={3} maxLength={2000} value={form.reason} onChange={event=>editValue("reason",event.target.value)} placeholder="Explain the verified employment or departmental change"/></label>
   <div className="workforce-setup-actions">
    <button type="button" className="btn" onClick={save} disabled={!valid||busy}>{busy?"Recording change…":"Save HR record"}</button>
    <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setReload(n=>n+1)}>Cancel</button>
   </div>
  </div>}
  {!loading&&history.length>0&&<details style={{marginTop:12}}><summary>HR changes · {history.length} recent</summary>
   {history.map(row=><article className="row" key={row.id}><strong>{timestamp(row.recorded_at)}</strong>
    <p className="screen-note">{row.reason}</p></article>)}
  </details>}
 </section>;
}
