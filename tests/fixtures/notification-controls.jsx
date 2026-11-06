import React from 'react';
import {createRoot} from 'react-dom/client';
import Notifications from '../../src/screens/Notifications';
import {supabase} from '../../src/lib/supabase';
const id='11111111-1111-4111-8111-111111111111';
supabase.auth.getSession=async()=>({data:{session:{access_token:'synthetic-browser-fixture'}}});
supabase.rpc=async(name)=>({data:name==='my_ceac_notification_history'?[{id,context_kind:'memo',context_id:id,kind:'memo_sent',created_at:'2026-11-06T09:00:00Z',read_at:'2026-11-06T10:00:00Z'}]:null,error:null});
const notifications={items:[{id:'event:'+id,type:'event',level:'personal',title:'New memo from Ama Example',meta:'HR · Camp preparation',url:'/?tab=messages&memo='+id},{id:'work:'+id,type:'work',level:'attention',title:'Work is past due',meta:'Prepare registration desk',url:'/?tab=work&item='+id}],attention:1,count:1,roomPreferences:[],roomPreferencesAvailable:true,refresh(){}};
createRoot(document.getElementById('root')).render(<Notifications me={{id,org_id:id}} notificationCounts={notifications}/>);
