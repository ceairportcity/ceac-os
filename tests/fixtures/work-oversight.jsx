import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {supabase} from '../../src/lib/supabase';
import WorkOversightWorkspace from '../../src/components/WorkOversight';
import '../../src/styles.css';
import '../../src/premium.css';
import '../../src/experience-v2.css';
const staff='11111111-1111-4111-8111-111111111111',manager='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333',executive='44444444-4444-4444-8444-444444444444',work='55555555-5555-4555-8555-555555555555';
const names={[staff]:'Staff Example',[manager]:'Manager Example',[admin]:'Admin Example',[executive]:'Executive Example'};
let actor=admin;const events=[],requests=[];window.__oversightFixture={events,requests};
supabase.rpc=async(name,args)=>{
 requests.push({name,args});
 if(name==='work_oversight_queue')return {data:{total:1,rows:[{id:work,title:'Registration preparation',ref:'TEST-OVERSIGHT',assignee_id:staff,assignee_name:names[staff],kind:'task',status:'in_progress',unit_name:'Example team',pending_count:events.filter(e=>['milestone','decision','attention'].includes(e.kind)&&!e.resolved).length}]}};
 if(name==='work_oversight_context')return {data:{responsible_name:names[staff],supervisor_id:manager,supervisor_name:names[manager],named_supervisor_id:manager,reviewer_id:manager,reviewer_name:names[manager],coordinators:[names[admin]],can_coordinate:actor===admin,can_update:actor===staff,events:[...events],open:true,supervisor_options:null}};
 if(name==='add_work_oversight_entry'){
  if(args.p_reply_to){const parent=events.find(e=>e.id===args.p_reply_to);parent.resolved=true;}
  if(!events.some(e=>e.id===args.p_request_id))events.push({id:args.p_request_id,kind:args.p_kind,note:args.p_note,actor_id:actor,actor_name:names[actor],recipient_id:['milestone','decision','attention'].includes(args.p_kind)?manager:null,recipient_name:names[manager],reply_to:args.p_reply_to,recorded_at:'2026-11-06T15:00:00Z',resolved:false});
  return {data:args.p_request_id};
 }
 return {data:null,error:{message:'Unexpected fixture RPC'}};
};
function Fixture(){const [person,setPerson]=useState(admin);actor=person;return <div className="ev2-work-page" style={{padding:16}}><label>Fixture role<select value={person} onChange={e=>setPerson(e.target.value)}>{Object.entries(names).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><WorkOversightWorkspace me={{id:person,org_id:work,is_admin:person===admin,is_exec:person===executive}} openItem={()=>{}}/></div>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
