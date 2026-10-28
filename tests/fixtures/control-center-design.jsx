import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import ControlCenter from '../../src/screens/ControlCenter';
import Workforce from '../../src/screens/Workforce';
import '../../src/experience-v2/workforce-family/workforce-family.css';
import OfficeSettings from '../../src/screens/OfficeSettings';
import SettingsBack from '../../src/components/SettingsBack';
import {SideNav,AppTopBar,MobileTopBar,Tabs} from '../../src/experience-v2/shell/ShellV2';
import '../../src/styles.css';import '../../src/premium.css';import '../../src/premium-staff.css';import '../../src/premium-manager.css';import '../../src/premium-admin.css';import '../../src/premium-executive.css';import '../../src/premium-parity.css';import '../../src/experience-v2.css';import '../../src/experience-v2/components/components.css';import '../../src/experience-v2/shell/shell.css';import '../../src/experience-v2/ui-density-refinement.css';
const params=()=>new URLSearchParams(location.search);
const full=params().get('access')!=='limited';
const me={id:'synthetic-admin',org_id:'synthetic-org',full_name:'HR Fixture',is_admin:true,is_exec:false,role:'staff',capabilities:full?['people.manage','workforce.manage','authority.manage','audit.view','integration.manage']:['people.manage'],capability_grants:[]};
function Fixture(){
 const [route,setRoute]=useState({tab:params().get('tab')||'settings',setting:params().get('setting'),workforceSection:params().get('workforce')});
 const go=(tab,options={})=>{const next={tab,setting:options.setting||null,workforceSection:tab==='attendance'&&options.workforceSection==='setup'?'setup':null};const query=new URLSearchParams({tab});if(next.setting)query.set('setting',next.setting);if(next.workforceSection)query.set('workforce',next.workforceSection);history.pushState(next,'','?'+query);setRoute(next);};
 useEffect(()=>{const pop=()=>setRoute({tab:params().get('tab')||'settings',setting:params().get('setting'),workforceSection:params().get('workforce')});window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 return <div className="app office-app"><SideNav me={me} isAdmin tab={route.tab} setTab={go}/><div className="ev2s-workspace"><MobileTopBar me={me} isAdmin roleLabel="Administration" onNavigate={go}/><AppTopBar me={me} isAdmin tab={route.tab}/><main className="app-content ev2s-content"><SettingsBack tab={route.tab} enabled go={go}>
 {route.tab==='settings'?<ControlCenter me={me} go={go}/>:route.tab==='office-settings'?<OfficeSettings me={me} section={route.setting} openSection={setting=>go('office-settings',{setting})} back={()=>go('settings')} openWorkforce={section=>go('attendance',{workforceSection:section})}/>:route.tab==='attendance'?<Workforce me={me} initialSection={route.workforceSection}/>:<div className="body"><h1>{route.tab==='people'?'People & Access':route.tab==='finance'?'Finance':route.tab}</h1></div>}
 </SettingsBack></main><Tabs me={me} isAdmin tab={route.tab} setTab={go}/></div></div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
