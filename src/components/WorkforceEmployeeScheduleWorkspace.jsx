import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import EmployeeScheduleEditor from "./EmployeeScheduleEditor";
import {WorkforceSection} from "../experience-v2/workforce-family/WorkforceFamilyV2";

/** Reuses the canonical HR roster and secured employee-id schedule RPC for ALL staff. */
export default function WorkforceEmployeeScheduleWorkspace({me}){
 const authorised=Boolean(me?.is_admin)&&(me.capabilities||[]).includes("workforce.manage");
 const [people,setPeople]=useState([]),[selectedId,setSelectedId]=useState("");
 const [search,setSearch]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [reload,setReload]=useState(0),generation=useRef(0);
 const scope=me.org_id+":"+me.id;
 useEffect(()=>{
  const token=++generation.current;
  setLoading(true);setPeople([]);setSelectedId("");setSearch("");setError("");
  if(!authorised){setLoading(false);return()=>{generation.current+=1;};}
  (async()=>{
   try{
    const result=await supabase.rpc("admin_employee_roster_summary");
    if(result.error||!Array.isArray(result.data)||result.data.some(row=>!row||!row.id))
     throw new Error("The authoritative employee directory could not be verified.");
    if(token!==generation.current)return;
    setPeople(result.data);
    setSelectedId(current=>result.data.some(row=>row.id===current)?current:result.data[0]?.id||"");
   }catch(cause){if(token===generation.current)setError(cause.message||"The directory could not be loaded.");}
   finally{if(token===generation.current)setLoading(false);}
  })();
  return()=>{generation.current+=1;};
 },[scope,authorised,reload]);
 if(!authorised)return null;
 const matches=people.filter(row=>{
  const units=Array.isArray(row.units)?row.units:[];
  return (String(row.full_name||row.preferred_name||"")+" "+units.map(unit=>typeof unit==="string"?unit:unit?.name||unit?.unit_name||"").join(" "))
    .toLocaleLowerCase().includes(search.toLocaleLowerCase());
 });
 const person=people.find(row=>row.id===selectedId)||null;
 return <WorkforceSection title="Employee working schedules" description="Set a complete, effective-dated working week for any employee, including people without CEAC login accounts. The existing approved HR schedule history is preserved.">
  <div className="workforce-setup-actions">
   <label className="small" style={{flex:"1 1 190px"}}>Find employee
    <input className="field" type="search" aria-label="Search employee schedules" placeholder="Search name or unit" value={search} onChange={event=>setSearch(event.target.value)}/>
   </label>
   <label className="small" style={{flex:"1 1 250px"}}>Employee record
    <select className="field" aria-label="Choose employee working schedule" value={matches.some(row=>row.id===selectedId)?selectedId:""}
     onChange={event=>setSelectedId(event.target.value)}>
     <option value="">Select an employee</option>
     {matches.map(row=><option key={row.id} value={row.id}>{row.full_name||row.preferred_name||"Employee"}{row.profile_id?"":" · no login account"}</option>)}
    </select>
   </label>
   <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setReload(value=>value+1)} disabled={loading}>Refresh directory</button>
  </div>
  {loading&&<p role="status">Checking HR employee records…</p>}
  {error&&<p role="alert">{error}</p>}
  {!loading&&!error&&!people.length&&<p className="screen-note">No employee records have been confirmed in this organisation.</p>}
  {!loading&&!error&&!matches.length&&people.length>0&&<p className="screen-note">No employee matches that search.</p>}
  {!loading&&!error&&person&&<EmployeeScheduleEditor key={scope+":"+person.id}
   me={me} employeeId={person.id} profileId={person.profile_id||null}
   unitId={null} name={person.full_name||person.preferred_name||"Employee"}/>}
 </WorkforceSection>;
}
