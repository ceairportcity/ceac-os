import {useEffect,useMemo,useRef,useState} from "react";
import {FieldGroup,ProductNotice} from "./bits";
import {ComposerDrawer} from "../experience-v2/components";
import {supabase} from "../lib/supabase";
import {humanError} from "../lib/productLanguage";

/** A new HR roster identity is NOT a new login, permission or invitation. */
const empty={
 fullName:"",preferredName:"",jobTitle:"",employmentType:"not_recorded",
 status:"active",primaryUnit:"",secondaryUnits:[],managerId:"",
 email:"",phone:"",startedOn:"",reason:"",confirmedDistinct:false,
};
export default function HRCreateRosterEmployee({me,units=[],employees=[],accounts=[],onCreated,onClose}){
 const [form,setForm]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const saving=useRef(false);
 const errorFocus=useRef(null);
 useEffect(()=>{if(error)errorFocus.current?.focus();},[error]);
 const set=(key,value)=>setForm(previous=>({...previous,[key]:value}));
 const nameMatches=useMemo(()=>employees.filter(person=>
  String(person.full_name||"").trim().toLocaleLowerCase()===form.fullName.trim().toLocaleLowerCase()
  && form.fullName.trim().length>1),[employees,form.fullName]);
 const rosterEmailConflict=useMemo(()=>{
  const target=form.email.trim().toLocaleLowerCase();
  return target ? employees.find(person=>String(person.hr_contact_email||person.email||"").trim().toLocaleLowerCase()===target)||null : null;
 },[employees,form.email]);
 const matchingAccount=useMemo(()=>{
  const target=form.email.trim().toLocaleLowerCase();
  return target ? accounts.find(account=>String(account.email||"").trim().toLocaleLowerCase()===target)||null : null;
 },[accounts,form.email]);
 const accountAlreadyLinked=Boolean(matchingAccount&&employees.some(
  employee=>employee.profile_id===matchingAccount.id));
 const mustAcknowledge=nameMatches.length>0||Boolean(matchingAccount);
 const ready=form.fullName.trim().length>=2&&form.fullName.trim().length<=180
  &&form.reason.trim().length>=12&&form.reason.trim().length<=2000
  &&(!mustAcknowledge||form.confirmedDistinct)
  &&!rosterEmailConflict&&!accountAlreadyLinked&&!saving.current;
 async function save(event){
  event.preventDefault();
  if(!ready||saving.current)return;
  saving.current=true;setBusy(true);setError("");
  try{
   const {data,error:writeError}=await supabase.rpc("admin_create_roster_employee",{
    p_full_name:form.fullName.trim(),
    p_preferred_name:form.preferredName.trim()||null,
    p_job_title:form.jobTitle.trim()||null,
    p_employment_type:form.employmentType,
    p_employment_status:form.status,
    p_primary_unit_id:form.primaryUnit||null,
    p_secondary_unit_ids:form.secondaryUnits,
    p_manager_profile_id:form.managerId||null,
    p_contact_email:form.email.trim()||null,
    p_contact_phone:form.phone.trim()||null,
    p_started_on:form.startedOn||null,
    p_reason:form.reason.trim(),
    p_confirm_distinct_person:form.confirmedDistinct,
   });
   if(writeError)throw writeError;
   if(!data?.created||!data.employee_id||data.profile_id!==null)
    throw new Error("HR creation did not return a verified roster-only employee identity.");
   const [detailRead,recordRead,auditRead]=await Promise.all([
    supabase.rpc("admin_employee_roster_detail",{p_employee_id:data.employee_id}),
    supabase.from("employee_roster")
     .select("id,org_id,profile_id,full_name,preferred_name,job_title,employment_type,employment_status,hr_contact_email,hr_contact_phone,hr_started_on")
     .eq("id",data.employee_id).eq("org_id",me.org_id).single(),
    supabase.from("employee_roster_change_events")
     .select("id,actor_id,reason,after_record")
     .eq("employee_id",data.employee_id).eq("org_id",me.org_id)
     .order("recorded_at",{ascending:false}).limit(1),
   ]);
   const detail=detailRead.data, record=recordRead.data;
   const actualUnits=(Array.isArray(detail?.units)?detail.units:[]);
   const expectedIds=[form.primaryUnit,...form.secondaryUnits].filter(Boolean).sort();
   const actualIds=actualUnits.map(item=>item.unit_id).sort();
   const audit=auditRead.data?.[0];
   if(detailRead.error||recordRead.error||auditRead.error
    ||detail?.employee?.id!==data.employee_id
    ||record?.id!==data.employee_id||record.org_id!==me.org_id||record.profile_id!==null
    ||record.full_name!==form.fullName.trim()
    ||(record.preferred_name||"")!==form.preferredName.trim()
    ||(record.job_title||"")!==form.jobTitle.trim()
    ||record.employment_type!==form.employmentType
    ||record.employment_status!==form.status
    ||(record.hr_contact_email||"")!==form.email.trim().toLowerCase()
    ||(record.hr_contact_phone||"")!==form.phone.trim()
    ||(record.hr_started_on||"")!==form.startedOn
    ||JSON.stringify(actualIds)!==JSON.stringify(expectedIds)
    ||actualUnits.filter(item=>item.is_primary).length!==Number(Boolean(form.primaryUnit))
    ||(form.primaryUnit&&actualUnits.find(item=>item.is_primary)?.unit_id!==form.primaryUnit)
    ||auditRead.data?.length!==1||audit?.actor_id!==me.id
    ||audit.reason!==form.reason.trim()
    ||audit.after_record?.event!=="employee_created")
    throw new Error("Employee creation may have been recorded, but its complete HR record, placement or audit could not be independently confirmed. Review the directory before retrying.");
   await onCreated?.(record);
  }catch(failure){
   setError(humanError(failure,"The HR employee record could not be confirmed. Review any existing record before retrying."));
  }finally{saving.current=false;setBusy(false);}
 }
 return <ComposerDrawer open title="Add employee" onClose={()=>{if(!busy)onClose?.();}}
  description="Create one employee record without a CEAC login. Account invitations and access permissions remain separate, verified actions.">
  {error&&<div ref={errorFocus} tabIndex={-1} role="region" aria-label="Employee creation error"><ProductNotice tone="error" title="Employee creation">{error}</ProductNotice></div>}
  <form onSubmit={save} aria-label="Add employee record" style={{display:"grid",gap:12}}>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
    <FieldGroup label="Legal or full name"><input className="field" aria-label="Employee full name" required maxLength={180} value={form.fullName} onChange={e=>set("fullName",e.target.value)}/></FieldGroup>
    <FieldGroup label="Preferred name"><input className="field" aria-label="Preferred name" maxLength={180} value={form.preferredName} onChange={e=>set("preferredName",e.target.value)}/></FieldGroup>
    <FieldGroup label="Job title"><input className="field" aria-label="Employee job title" maxLength={180} value={form.jobTitle} onChange={e=>set("jobTitle",e.target.value)}/></FieldGroup>
    <FieldGroup label="Employment type"><select className="field" aria-label="New employee employment type" value={form.employmentType} onChange={e=>set("employmentType",e.target.value)}>
     <option value="not_recorded">Not yet recorded</option><option value="permanent">Permanent</option>
     <option value="fixed_term">Fixed term</option><option value="volunteer">Volunteer</option>
    </select></FieldGroup>
    <FieldGroup label="Employment status"><select className="field" aria-label="New employee status" value={form.status} onChange={e=>set("status",e.target.value)}>
     <option value="active">Active</option><option value="inactive">Inactive</option>
    </select></FieldGroup>
    <FieldGroup label="Started on"><input className="field" aria-label="New employee start date" type="date" value={form.startedOn} onChange={e=>set("startedOn",e.target.value)}/></FieldGroup>
    <FieldGroup label="Primary unit"><select className="field" aria-label="New employee primary unit" value={form.primaryUnit}
      onChange={e=>setForm(previous=>({...previous,primaryUnit:e.target.value,managerId:"",secondaryUnits:e.target.value?previous.secondaryUnits.filter(id=>id!==e.target.value):[]}))}>
     <option value="">Not assigned yet</option>{units.map(unit=><option value={unit.id} key={unit.id}>{unit.name}</option>)}
    </select></FieldGroup>
    <FieldGroup label="Reporting manager"><select className="field" aria-label="New employee manager" value={form.managerId} disabled={!form.primaryUnit} onChange={e=>set("managerId",e.target.value)}>
     <option value="">Not assigned</option>
     {accounts.filter(p=>p.active&&p.role==="manager"&&p.unit_id===form.primaryUnit).map(p=><option value={p.id} key={p.id}>{p.full_name}</option>)}
    </select></FieldGroup>
    <FieldGroup label="HR contact email (not login)"><input className="field" aria-label="New employee HR email" type="email" maxLength={254} value={form.email} onChange={e=>set("email",e.target.value)}/></FieldGroup>
    <FieldGroup label="HR contact phone"><input className="field" aria-label="New employee HR phone" maxLength={40} value={form.phone} onChange={e=>set("phone",e.target.value)}/></FieldGroup>
   </div>
   <FieldGroup label="Other units (optional)">
    <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
     {units.filter(unit=>unit.id!==form.primaryUnit).map(unit=><label key={unit.id} style={{display:"inline-flex",alignItems:"center",gap:6}}>
      <input type="checkbox" checked={form.secondaryUnits.includes(unit.id)} disabled={!form.primaryUnit}
       onChange={e=>set("secondaryUnits",e.target.checked?[...form.secondaryUnits,unit.id]:form.secondaryUnits.filter(id=>id!==unit.id))}/>
      {unit.name}
     </label>)}
    </div>
   </FieldGroup>
   {rosterEmailConflict&&<ProductNotice tone="attention" title="Existing employee email">This contact email already belongs to an HR employee record. Open and review that employee instead of creating another roster identity.</ProductNotice>}
   {accountAlreadyLinked&&<ProductNotice tone="attention" title="Account already linked to an employee">
     This CEAC login is already assigned to an HR employee record. Open the existing employee rather than creating a duplicate. Confirmation cannot override this boundary.
   </ProductNotice>}
   {mustAcknowledge&&<ProductNotice tone="attention" title="Manual identity review required">
    {nameMatches.length>0&&<p>{nameMatches.length} roster record(s) have this name. Confirm this is not a duplicate person.</p>}
    {matchingAccount&&<p>An existing CEAC login uses this email. If this account is missing its employee record, HR may create a separate roster record only after verifying the person. Account linking still requires independent evidence.</p>}
    <label style={{display:"flex",gap:8,alignItems:"flex-start",marginTop:8}}>
     <input type="checkbox" checked={form.confirmedDistinct} onChange={e=>set("confirmedDistinct",e.target.checked)}/>
     I have checked existing roster records, verified this employee identity and understand that account access remains unlinked until a separate authorised verification.
    </label>
   </ProductNotice>}
   <FieldGroup label="Reason / HR source reference"><textarea className="field" aria-label="Employee creation reason" required minLength={12} maxLength={2000} rows={3}
    value={form.reason} onChange={e=>set("reason",e.target.value)} placeholder="Document the appointment, source and reason for this new roster record."/></FieldGroup>
   <p className="screen-note">A saved HR creation event records the acting administrator, fields, organisational placement and reason. No account or permissions are created.</p>
   <div style={{display:"flex",justifyContent:"flex-end",flexWrap:"wrap",gap:8}}>
    <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
    <button type="submit" className="btn" disabled={busy||!ready}>{busy?"Saving employee…":"Save employee"}</button>
   </div>
  </form>
 </ComposerDrawer>;
}
