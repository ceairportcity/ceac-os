import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
import AdminWorkforceToday from "./AdminWorkforceToday";

// All three authorised views read the same organisation roster and work-start
// snapshot. Attendance case policy and private HR records are separate.
const accraDay=()=>new Intl.DateTimeFormat("en-CA",{
 timeZone:"Africa/Accra",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date());
const validSnapshot=data=>data&&typeof data==="object"
 && Array.isArray(data.roster)&&Array.isArray(data.sessions)
 && Array.isArray(data.operationalProfiles)
 && data.roster_count===data.roster.length
 && data.session_count===data.sessions.length;

export default function RoleWorkforceMap({me,date=null,roleLabel="People & HR",...viewProps}){
 const [today,setToday]=useState(accraDay),[revision,setRevision]=useState(0);
 const [read,setRead]=useState({});
 const selectedDay=date||today;
 const scope=[me?.org_id,me?.id,selectedDay].join(":");
 useEffect(()=>{
  const update=()=>{setToday(accraDay());setRevision(n=>n+1);};
  const timer=setInterval(update,60000);
  window.addEventListener("focus",update);
  return()=>{clearInterval(timer);window.removeEventListener("focus",update);};
 },[]);
 useEffect(()=>{
  let active=true;
  setRead({scope,loading:true});
  (async()=>{
   try{
    if(!me?.org_id||!me?.id)throw new Error("No authorised map scope.");
    const {data,error}=await supabase.rpc("workforce_map_day",{p_date:selectedDay});
    if(error||!validSnapshot(data)||data.date!==selectedDay)
     throw new Error("Incomplete workforce map evidence.");
    if(active)setRead({scope,data});
   }catch{
    if(active)setRead({scope,error:true});
   }
  })();
  return()=>{active=false;};
 },[scope,revision]);
 if(read.scope!==scope||read.loading)return <section className="workstart-workspace" aria-label="Today's workforce start locations">
  <h2>Where work was started {date?"· "+selectedDay:"today"}</h2>
  <p role="status">Loading recorded work starts…</p>
 </section>;
 if(read.error)return <section className="workstart-workspace" aria-label="Today's workforce start locations">
  <h2>Where work was started {date?"· "+selectedDay:"today"}</h2>
  <p role="status">Work-start records are unavailable. No attendance conclusion is implied.</p>
  <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setRevision(n=>n+1)}>Retry work-start records</button>
 </section>;
 return <AdminWorkforceToday me={me}
  roster={read.data.roster} sessions={read.data.sessions}
  operationalProfiles={read.data.operationalProfiles}
  roleLabel={roleLabel} dateLabel={date||"today"} {...viewProps}/>;
}
