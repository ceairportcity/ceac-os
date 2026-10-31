import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import AdminWorkforceToday from './AdminWorkforceToday';
const dayKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Accra',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

// Uses the Executive's existing organisation-scoped SELECT authority. No HR
// roster RPC, private employee fields, service key or capability grant.
export default function ExecutiveWorkforceToday({me,onOpenOrganisation}){
 const [day,setDay]=useState(dayKey),[retry,setRetry]=useState(0),[read,setRead]=useState({});
 const scope=me.org_id+':'+me.id+':'+day;
 useEffect(()=>{const timer=setInterval(()=>setDay(dayKey()),60000);const refresh=()=>setDay(dayKey());window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 useEffect(()=>{
  let active=true;setRead({scope,loading:true});
  const start=new Date(day+'T00:00:00Z'),end=new Date(start.getTime()+86400000);
  const complete=r=>{if(r.error||!Array.isArray(r.data)||r.count!==r.data.length)throw new Error('Work-start records could not be verified completely.');return r.data;};
  (async()=>{
   try{
    const [sessions,profiles,units,memberships]=await Promise.all([
     supabase.from('work_sessions').select('id,profile_id,started_at,ended_at,place,lat,lng,location_captured_at,location_accuracy_m',{count:'exact'}).eq('org_id',me.org_id).gte('started_at',start.toISOString()).lt('started_at',end.toISOString()),
     supabase.from('profiles').select('id,full_name,active',{count:'exact'}).eq('org_id',me.org_id),
     supabase.from('units').select('id,name',{count:'exact'}).eq('org_id',me.org_id),
     supabase.from('unit_memberships').select('profile_id,unit_id',{count:'exact'}).eq('org_id',me.org_id),
    ]);
    const sessionRows=complete(sessions),people=complete(profiles),departments=complete(units),members=complete(memberships);
    const roster=people.map(p=>({id:p.id,profile_id:p.id,full_name:p.full_name,units:members.filter(m=>m.profile_id===p.id).map(m=>({name:departments.find(u=>u.id===m.unit_id)?.name})).filter(u=>u.name)}));
    if(active)setRead({scope,sessions:sessionRows,roster});
   }catch{if(active)setRead({scope,error:true});}
  })();
  return()=>{active=false;};
 },[scope,retry]);
 if(read.scope!==scope||read.loading)return <section className="workstart-workspace" aria-label="Today's workforce start locations"><h2>Where work was started today</h2><p role="status">Loading recorded work starts…</p></section>;
 if(read.error)return <section className="workstart-workspace" aria-label="Today's workforce start locations"><h2>Where work was started today</h2><p role="status">Work-start records are unavailable. No attendance conclusion is implied.</p><button className="btn btn-ghost btn-sm" onClick={()=>setRetry(n=>n+1)}>Retry work-start records</button></section>;
 return <AdminWorkforceToday me={me} roster={read.roster} sessions={read.sessions} roleLabel="Executive" peopleLabel="people"/>;
}
