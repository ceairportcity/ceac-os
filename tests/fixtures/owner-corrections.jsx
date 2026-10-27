// Synthetic local-only fixture: all remote requests are intercepted by tests.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Meeting from '../../src/screens/Meeting';
import Performance from '../../src/screens/Performance';
import Item from '../../src/screens/Item';
import PeopleAccess from '../../src/components/PeopleAccess';
import ExecutiveOrganisation from '../../src/screens/ExecutiveOrganisation';
import '../../src/styles.css';
import '../../src/premium.css';
import '../../src/premium-admin.css';
import '../../src/experience-v2.css';
import '../../src/experience-v2/components/components.css';
const me={id:'actor',org_id:'org',is_admin:true,is_exec:true,capabilities:['people.manage'],capability_grants:[{capability:'people.manage',scope_unit_id:null}]};
function Fixture(){
 const params=new URLSearchParams(location.search);
 const [actor,setActor]=useState({...me,is_admin:params.get('actor')!=='executive',is_exec:params.get('actor')!=='admin'});
 return <main><button onClick={()=>setActor({...me,id:'new-actor'})}>Switch fixture actor</button>{params.get('screen')==='meeting'?<Meeting me={actor} meetingId="meeting" back={()=>{}}/>:params.get('screen')==='review'?<Item me={actor} id="work" reviewOnly back={()=>{}}/>:params.get('screen')==='performance'?<Performance me={actor}/>:params.get('screen')==='directory'
  ?<ExecutiveOrganisation key={actor.id} me={actor} openItem={()=>{}}/>
  :<PeopleAccess me={actor}/>}</main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
