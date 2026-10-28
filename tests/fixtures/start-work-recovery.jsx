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
import '../../src/experience-v2/components/components.css';
import '../../src/experience-v2/staff-today/staff-today.css';
function Fixture(){
 const staff=new URLSearchParams(location.search).get('role')==='staff';
 const me={id:'employee',org_id:'org',unit_id:'unit',full_name:'Synthetic colleague',role:staff?'staff':'manager',is_admin:!staff,is_exec:false,memberships:[],capabilities:[],capability_grants:[]};
 const [session,setSession]=useState(null),[workOpened,setWorkOpened]=useState(false);
 const noop=()=>{};
 return <div className={staff?'app staff-app':'app office-app'}><main className="app-content">
  {workOpened?<p role="status">Work destination opened</p>:staff?<Home me={me} session={session} setSession={setSession} openWork={()=>setWorkOpened(true)} openItem={noop} openMeeting={noop} openRoom={noop} openMe={noop} openAnnouncements={noop} openTeam={noop} openCalendar={noop}/>:<EmployeeWorkSession me={me}/>}
 </main></div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
