import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import ManagerOverviewV2 from '../../src/experience-v2/manager-overview/ManagerOverviewV2';
import OverviewNotifications from '../../src/components/OverviewNotifications';
import {WorkPageHeader} from '../../src/experience-v2/work-family/WorkFamilyV2';
import {ModalDialog,Toast} from '../../src/experience-v2/components';
import {installPhonePresentation} from '../../src/lib/phonePresentation';
import {initialiseAppearance} from '../../src/lib/appearance';
import {supabase} from '../../src/lib/supabase';
import '../../src/styles.css';
import '../../src/premium.css';
import '../../src/experience-v2.css';
import '../../src/experience-v2/components/components.css';
import '../../src/experience-v2/shell/shell.css';
import '../../src/experience-v2/work-family/work-family.css';
import '../../src/appearance.css';
import '../../src/resilience/phone-presentation.css';
import '../../src/resilience/pwa-status.css';

initialiseAppearance();installPhonePresentation();
// Presentation-only fixture; no real account or session is read or changed.
supabase.rpc=async()=>({data:null,error:{message:'Synthetic session is not started'}});
supabase.from=()=>{
  const read={select:()=>read,eq:()=>read,is:()=>read,order:()=>read,limit:()=>read,
    maybeSingle:async()=>({data:null,error:null})};
  return read;
};
const team={working:[],present:[],leave:[],notStarted:[],completed:[]};
const notifications={items:[{id:'synthetic-work',type:'work',level:'attention',title:'Work is past due',meta:'Service Preparations',url:'#'}],room:0};
const me={id:'11111111-1111-4111-8111-111111111111',org_id:'22222222-2222-4222-8222-222222222222',full_name:'Manager Example',unit_name:'Technical Support',unit_id:'33333333-3333-4333-8333-333333333333'};
function Fixture(){
  const [dialog,setDialog]=useState(false);
  const [notice,setNotice]=useState(false);
  return <><div className="app manager-app"><main className="app-content ev2s-content">
  <ManagerOverviewV2 me={me} team={team} greeting="Good evening" dateLabel="Friday 6 November" loading={false} notificationPanel={<OverviewNotifications notifications={notifications}/>}/>
  <section className="ev2-work-page"><WorkPageHeader title="Work" description="Your responsibilities, team progress and submissions awaiting review." actionLabel="Create work" secondaryActionLabel="Give out work"/></section>
  <button onClick={()=>setDialog(true)}>Open phone dialog</button>
  <button onClick={()=>setNotice(true)}>Show phone notices</button>
</main></div>
  <ModalDialog open={dialog} title="Phone form" onClose={()=>setDialog(false)}><p>Existing phone dialog composition.</p></ModalDialog>
  <Toast open={notice} title="Phone update saved" description="Synthetic presentation check" onClose={()=>setNotice(false)}/>
  {notice&&<aside className="ceac-pwa-status is-update"><div><strong>CEAC update ready</strong><span>Synthetic update preview</span></div><button onClick={()=>setNotice(false)}>Dismiss preview</button></aside>}
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
