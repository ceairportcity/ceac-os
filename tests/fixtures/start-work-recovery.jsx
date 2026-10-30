// Synthetic local-only fixture. Tests intercept every remote request.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../../src/screens/Home';
import EmployeeWorkSession from '../../src/components/EmployeeWorkSession';
import '../../src/styles.css';
import '../../src/premium.css';
import '../../src/premium-staff.css';
import '../../src/premium-admin.css';
import '../../src/premium-parity.css';
import '../../src/experience-v2.css';
import '../../src/experience-v2/components/components.css';
import '../../src/experience-v2/staff-today/staff-today.css';
function Fixture(){
 const role=new URLSearchParams(location.search).get('role')||'staff';
 const staff=role==='staff';
 const me={id:'employee',org_id:'org',unit_id:'unit',full_name:'Synthetic colleague',role:staff?'staff':role==='manager'?'manager':'employee',is_admin:role==='employee',is_exec:role==='executive',memberships:[],capabilities:[],capability_grants:[]};
 const [session,setSession]=useState(new URLSearchParams(location.search).has('stale')?{id:'earlier-session',started_at:new Date(Date.now()-86400000).toISOString(),last_confirmed_at:new Date(Date.now()-86400000).toISOString(),place:'elsewhere',flags:{offsite_location_name:'Synthetic remote office'}}:null),[workOpened,setWorkOpened]=useState(false);
 const noop=()=>{};
 return <div className={`app ${staff?'staff-app':role==='manager'?'manager-app':role==='executive'?'executive-app':'office-app'}`}><main className="app-content">
  {workOpened?<p role="status">Work destination opened</p>:staff?<Home me={me} session={session} setSession={setSession} openWork={()=>setWorkOpened(true)} openItem={noop} openMeeting={noop} openRoom={noop} openMe={noop} openAnnouncements={noop} openTeam={noop} openCalendar={noop}/>:<EmployeeWorkSession me={me}/>}
 </main></div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
