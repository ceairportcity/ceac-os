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
import {SideNav,AppTopBar,MobileTopBar,Tabs} from '../../src/experience-v2/shell/ShellV2';
import '../../src/styles.css';
import '../../src/premium.css';
import '../../src/premium-staff.css';
import '../../src/premium-manager.css';
import '../../src/premium-admin.css';
import '../../src/premium-executive.css';
import '../../src/premium-parity.css';
import '../../src/experience-v2.css';
import '../../src/experience-v2/components/components.css';
import '../../src/experience-v2/shell/shell.css';
import '../../src/experience-v2/staff-today/staff-today.css';
import '../../src/experience-v2/admin-overview/admin-overview.css';
import '../../src/experience-v2/work-family/work-family.css';
import '../../src/experience-v2/executive-overview/executive-surfaces.css';
import '../../src/experience-v2/project-family/project-family.css';
import '../../src/experience-v2/workforce-family/workforce-family.css';
import '../../src/experience-v2/finance-family/finance-family.css';
import '../../src/experience-v2/personal-family/personal-family.css';
import '../../src/experience-v2/data-viz/data-viz.css';
import '../../src/experience-v2/integrations/integrations.css';
import '../../src/resilience/pwa-status.css';
import '../../src/experience-v2/ui-density-refinement.css';
import '../../src/experience-v2/executive-overview/ExecutiveRedesignStyles';
const me={full_name:'Design preview',role:'staff',memberships:[],managed_units:[],id:'actor',org_id:'org',is_admin:true,is_exec:true,capabilities:['people.manage','workforce.manage'],capability_grants:[{capability:'people.manage',scope_unit_id:null},{capability:'learning.manage',scope_unit_id:null}]};
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
 const content=screens[screen]||<PeopleAccess me={actor}/>;
 if(params.get('full')==='1'){
  const isExec=params.get('actor')==='executive'||['reports','review'].includes(screen),isAdmin=['department-reports','payroll'].includes(screen),isManager=screen==='manager-reports';
  const roleClass=isExec?'executive-app':isAdmin?'office-app':isManager?'manager-app':'staff-app';
  const tab={reports:'exec-reports','department-reports':'reporting','manager-reports':'manager-reports',achievements:'achievements',payroll:'payroll',review:'item'}[screen];
  const noop=()=>{};
  const roleProps={me:actor,isExec,isAdmin,isManager,tab};
  return <div className={'app '+roleClass}>
   <SideNav {...roleProps} setTab={noop}/>
   <div className="ev2s-workspace">
    <MobileTopBar {...roleProps} roleLabel={isExec?'Executive':isAdmin?'Administration':isManager?'Manager':'Staff'} onNavigate={noop}/>
    <AppTopBar {...roleProps} onNavigate={noop}/>
    <main className={"app-content ev2s-content"+(isExec?" exec-v2":"")}>{content}</main>
    <Tabs {...roleProps} setTab={noop}/>
   </div>
  </div>;
 }
 return <main className={screen==='reports'?'executive-app':undefined}>
  <button onClick={()=>setActor({...me,id:'new-actor'})}>Switch fixture actor</button>
  {content}
 </main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
