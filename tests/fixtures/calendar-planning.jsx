import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import StaffCalendar from '../../src/screens/StaffCalendar';
import ManagerCalendar from '../../src/screens/ManagerCalendar';
import AdminCalendar from '../../src/screens/AdminCalendar';
import Meeting from '../../src/screens/Meeting';
import Meetings from '../../src/screens/Meetings';
import '../../src/experience-v2/ApprovedWorkspace.css';
import MeetingScheduler from '../../src/components/MeetingScheduler';
import {initialiseAppearance} from '../../src/lib/appearance';
import {installPhonePresentation} from '../../src/lib/phonePresentation';
import '../../src/styles.css';
import '../../src/premium.css';
import '../../src/premium-staff.css';
import '../../src/premium-manager.css';
import '../../src/premium-admin.css';
import '../../src/premium-executive.css';
import '../../src/experience-v2.css';
import '../../src/experience-v2/components/components.css';
import '../../src/experience-v2/shell/shell.css';
import '../../src/appearance.css';
import '../../src/resilience/phone-presentation.css';
initialiseAppearance();installPhonePresentation();
const me={id:'11111111-1111-4111-8111-111111111111',org_id:'22222222-2222-4222-8222-222222222222',full_name:'Synthetic Planner',unit_id:'33333333-3333-4333-8333-333333333333',unit_name:'Synthetic IT',memberships:[{unit_id:'33333333-3333-4333-8333-333333333333',role:'manager'}]};
function Fixture(){
 const [opened,setOpened]=useState(''),[draft,setDraft]=useState(null),[selected,setSelected]=useState(null);
 const role=new URLSearchParams(location.search).get('role')||'staff';
 const actor={...me,is_admin:role==='admin',is_exec:role==='executive'};
 const props={me:actor,openItem:(id,date)=>setOpened(`Work: ${id} ${date||''}`),openMeeting:id=>setOpened(`Meeting: ${id}`),openProject:id=>setOpened(`Project: ${id}`),openPerson:id=>setOpened(`Person: ${id}`),scheduleMeeting:setDraft};
 return <div className={`app ${role==='staff'?'staff-app':role==='manager'?'manager-app':role==='executive'?'executive-app':'office-app'} ceac-ws`} style={{minWidth:0}}><main style={{padding:16,minWidth:0}}>
  {role==='meetings'?<Meetings me={actor} meetingId={selected} openMeeting={setSelected} closeMeeting={()=>setSelected(null)} />:role==='meeting'?<Meeting me={actor} meetingId="meeting-a" back={()=>{}}/>:role==='scheduler'?<MeetingScheduler me={actor} context={{startsAt:'2026-11-07T09:00',endsAt:'2026-11-07T10:00'}} onClose={()=>{}}/>:role==='staff'?<StaffCalendar {...props}/>:role==='manager'?<ManagerCalendar {...props}/>:<AdminCalendar {...props} roleMode={role==='executive'?'executive':'admin'}/>}
  {draft&&<MeetingScheduler me={actor} context={draft} onClose={()=>setDraft(null)}/>}
  {opened&&<p role="status">{opened}</p>}
 </main></div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
