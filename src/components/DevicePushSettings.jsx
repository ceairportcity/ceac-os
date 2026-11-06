import {useEffect,useState} from "react";
import {pushSupport,loadPushConfiguration,enableDevicePush,disableDevicePush,saveDevicePushPreferences,sendDevicePushTest} from "../lib/ceacPush";

// Optional device notifications. A permission request is made only from the
// Enable button, never on page load, and never for unsupported Apple browsers.
export default function DevicePushSettings(){
  const support=pushSupport();
  const [configuration,setConfiguration]=useState(null);
  const [status,setStatus]=useState("loading");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState(false);
  const [preferences,setPreferences]=useState({categories:{messages:true,work:true,calendar:true,rooms:false},quietStart:null,quietEnd:null,reminderMinutes:30});
  const [notice,setNotice]=useState("");
  const [revision,setRevision]=useState(0);
  async function save(){setBusy(true);setError("");setNotice("");try{await saveDevicePushPreferences(preferences,preview);setNotice("Notification preferences saved.");}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function test(){setBusy(true);setError("");setNotice("");try{await sendDevicePushTest();setNotice("Test queued. It should arrive shortly; delivery depends on this device's settings.");}catch(e){setError(e.message);}finally{setBusy(false);}}

  useEffect(()=>{
    if(support!=="supported"){setStatus(support);return;}
    if(Notification.permission==="denied"){setStatus("blocked");return;}
    setStatus("loading");setError("");
    let active=true;
    loadPushConfiguration().then(config=>{
      if(!active)return;
      setConfiguration(config);
      setPreview(config?.preview===true);
      if(config?.preferences)setPreferences(config.preferences);
      setStatus(!config?"unconfigured":config.subscription?"enabled":"available");
    }).catch(()=>{if(active){setStatus("check_failed");setError("Device notifications could not be checked. Please retry.");}});
    return()=>{active=false;};
  },[support,revision]);

  async function enable(){
    if(!configuration||busy)return;
    setBusy(true);setError("");
    try{
      const subscription=await enableDevicePush(configuration,preview);
      setConfiguration(current=>({...current,subscription}));
      setStatus("enabled");
    }catch(e){setError(e?.message||"This device could not be registered.");}
    finally{setBusy(false);}
  }
  async function disable(){
    if(busy)return;
    setBusy(true);setError("");
    try{
      await disableDevicePush();
      setConfiguration(current=>({...current,subscription:null}));
      setStatus("available");
    }catch(e){setError(e?.message||"This device could not be disconnected.");}
    finally{setBusy(false);}
  }
  return <section className="ceac-room-settings" aria-label="Device notifications">
    <header><div><h3>Notifications on this device</h3>
      <p>Receive CEAC reminders when the application is closed. You stay in control.</p></div>
      {status==="enabled"?<button type="button" disabled={busy} onClick={()=>void disable()}>Turn off</button>:
      status==="check_failed"?<button type="button" onClick={()=>setRevision(n=>n+1)}>Retry</button>:
      status==="available"?<button type="button" disabled={busy} onClick={()=>void enable()}>Enable notifications</button>:null}
    </header>
    {status==="loading"&&<p role="status">Checking this device…</p>}
    {status==="enabled"&&<p role="status">Notifications are enabled on this device. You can turn them off at any time.</p>}
    {status==="install_required"&&<p>On iPhone or iPad, add CEAC OS to your Home Screen, open it there, and then enable notifications.</p>}
    {status==="blocked"&&<p>Notifications are blocked in this device’s settings. Allow CEAC notifications there, then refresh this page.</p>}
    {status==="unavailable"&&<p>This browser cannot receive CEAC notifications while closed. Your in-app updates still work.</p>}
    {status==="unconfigured"&&<p>Device notifications are not available on this CEAC server yet. In-app updates remain available.</p>}
    {["available","enabled"].includes(status)&&<>
      <label style={{display:"flex",alignItems:"flex-start",gap:10,fontSize:13,marginTop:10,fontWeight:500}}>
        <input type="checkbox" checked={preview} disabled={busy}
          onChange={e=>setPreview(e.target.checked)} style={{marginTop:3}}/>
        <span>Show the sender and department in lock-screen previews when permitted. Otherwise, show only a private CEAC update.</span>
      </label>
      <p style={{fontSize:12,marginTop:8}}>Your phone or computer controls how notifications appear on its lock screen.</p>
    </>}
    {status==="enabled"&&<fieldset disabled={busy} className="ceac-push-preferences"><legend>Choose your notifications</legend>
      {[["messages","Memos and messages"],["work","Work and decisions"],["calendar","Meetings and reminders"],["rooms","Other Room activity (off by default)"]].map(([key,label])=><label key={key}>
        <input type="checkbox" checked={key==="rooms"?preferences.categories[key]===true:preferences.categories[key]!==false} onChange={e=>setPreferences(p=>({...p,categories:{...p.categories,[key]:e.target.checked}}))}/>{label}</label>)}
      <label>Remind me before timed work and meetings<select value={preferences.reminderMinutes||30} onChange={e=>setPreferences(p=>({...p,reminderMinutes:Number(e.target.value)}))}>{[5,15,30,60].map(minutes=><option key={minutes} value={minutes}>{minutes} minutes before</option>)}</select></label>
      <label><input type="checkbox" checked={preferences.quietStart!==null} onChange={e=>setPreferences(p=>({...p,quietStart:e.target.checked?21:null,quietEnd:e.target.checked?7:null}))}/>Quiet hours · Ghana time</label>
      {preferences.quietStart!==null&&<div className="ceac-push-hours">{[["quietStart","From"],["quietEnd","Until"]].map(([key,label])=><label key={key}>{label}<select value={preferences[key]} onChange={e=>setPreferences(p=>({...p,[key]:Number(e.target.value)}))}>
        {Array.from({length:24},(_,hour)=><option key={hour} value={hour}>{String(hour).padStart(2,"0")}:00</option>)}</select></label>)}</div>}
      <div className="ceac-push-buttons"><button type="button" onClick={()=>void save()}>Save preferences</button><button type="button" onClick={()=>void test()}>Send a test notification</button></div>
    </fieldset>}
    {notice&&<p role="status">{notice}</p>}
    {error&&<p role="alert" className="ceac-updates-error">{error}</p>}
  </section>;
}