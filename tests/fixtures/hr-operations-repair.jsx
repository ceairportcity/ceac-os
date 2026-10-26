// Real components with synthetic intercepted API data. Never a production entry.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Inbox from '../../src/screens/Inbox';
import Room from '../../src/screens/Room';
import ExecutiveAssign from '../../src/components/ExecutiveAssign';
import AdminProjects from '../../src/screens/AdminProjects';
import '../../src/styles.css';
import '../../src/premium.css';
import '../../src/premium-admin.css';
import '../../src/experience-v2.css';
import '../../src/experience-v2/components/components.css';
import '../../src/experience-v2/project-family/project-family.css';
import '../../src/experience-v2/work-family/work-family.css';
const me={id:'31000000-0000-4000-8000-000000000003',org_id:'10000000-0000-4000-8000-000000000010',is_admin:true,is_exec:false,role:'staff',memberships:[],capabilities:['people.manage']};
function Fixture(){
 const params=new URLSearchParams(location.search);
 const [room,setRoom]=useState(null),[assign,setAssign]=useState(params.get('screen')==='assign'?{}:null),[project,setProject]=useState(params.get('project'));
 const [action,setAction]=useState('');
 const openProject=id=>{const url=new URL(location.href);if(id)url.searchParams.set('project',id);else url.searchParams.delete('project');history.pushState({},'',url);setProject(id);};
 return <div className="app office-app"><main style={{width:'100%'}}><output aria-label="Fixture action">{action}</output>{assign?<ExecutiveAssign me={me} context={assign} back={()=>setAssign(null)}/>:room?<Room me={me} context={room} back={()=>setRoom(null)} onRoomChange={setRoom} openItem={id=>setAction('work:'+id)} startWorkFromMessage={setAssign}/>:params.get('screen')==='projects'?<AdminProjects me={me} initialProjectId={project} openProject={openProject} openItem={id=>setAction('work:'+id)} goAssign={setAssign} openRoom={id=>setRoom({kind:'project',projectId:id})}/>:<Inbox me={me} openRoom={setRoom} openItem={id=>setAction('work:'+id)} openAnnouncements={()=>{}}/>}</main></div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
