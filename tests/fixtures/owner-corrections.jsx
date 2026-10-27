// Synthetic local-only fixture: all remote requests are intercepted by tests.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ManagerReports from '../../src/screens/ManagerReports';
import Reports from '../../src/screens/Reports';
import ExecutiveReports from '../../src/screens/ExecutiveReports';
import PersonalAchievements from '../../src/screens/PersonalAchievements';
import AdminPayroll from '../../src/screens/AdminPayroll';
import Learning from '../../src/screens/Learning';
import EmployeeScheduleEditor from '../../src/components/EmployeeScheduleEditor';
import Meeting from '../../src/screens/Meeting';
import Performance from '../../src/screens/Performance';
import Item from '../../src/screens/Item';
import PeopleAccess from '../../src/components/PeopleAccess';
import ExecutiveOrganisation from '../../src/screens/ExecutiveOrganisation';
import '../../src/styles.css';
import '../../src/role-styles/executive-redesign.css';
import '../../src/role-styles/executive-workspaces.css';
import '../../src/premium.css';
import '../../src/premium-admin.css';
import '../../src/experience-v2.css';
import '../../src/experience-v2/components/components.css';
const me={id:'actor',org_id:'org',is_admin:true,is_exec:true,capabilities:['people.manage','workforce.manage'],capability_grants:[{capability:'people.manage',scope_unit_id:null},{capability:'learning.manage',scope_unit_id:null}]};
function Fixture(){
 const params=new URLSearchParams(location.search);
 const screen=params.get('screen');
 const [actor,setActor]=useState({...me,is_admin:params.get('actor')!=='executive',is_exec:params.get('actor')!=='admin'});
 const screens={
  'department-reports':<Reports me={actor}/>,
  reports:<ExecutiveReports me={actor} openItem={()=>{}}/>,
  'manager-reports':<ManagerReports me={{...actor,unit_id:'unit'}} openItem={()=>{}}/>,
  achievements:<PersonalAchievements me={actor} back={()=>{}} openItem={()=>{}}/>,
  payroll:<AdminPayroll me={{...actor,capabilities:[...actor.capabilities,'payroll.prepare']}}/>,
  learning:<Learning me={actor}/>,
  schedule:<EmployeeScheduleEditor me={actor} profileId="person" unitId="unit" name="Synthetic colleague"/>,
  meeting:<Meeting me={actor} meetingId="meeting" back={()=>{}}/>,
  review:<Item me={actor} id="work" reviewOnly back={()=>{}}/>,
  performance:<Performance me={actor}/>,
  directory:<ExecutiveOrganisation key={actor.id} me={actor} openItem={()=>{}}/>,
 };
 return <main className={screen==='reports'?'executive-app':undefined}>
  <button onClick={()=>setActor({...me,id:'new-actor'})}>Switch fixture actor</button>
  {screens[screen]||<PeopleAccess me={actor}/>}
 </main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
