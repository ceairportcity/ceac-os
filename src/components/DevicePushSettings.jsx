import {useEffect,useState} from "react";
import {pushSupport,loadPushConfiguration,enableDevicePush,disableDevicePush} from "../lib/ceacPush";

// Optional device notifications. A permission request is made only from the
// Enable button, never on page load, and never for unsupported Apple browsers.
export default function DevicePushSettings(){
  const support=pushSupport();
  const [configuration,setConfiguration]=useState(null);
  const [status,setStatus]=useState("loading");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState(false);

  useEffect(()=>{
    if(support!=="supported"){setStatus(support);return;}
    let active=true;
    loadPushConfiguration().then(config=>{
      if(!active)return;
      setConfiguration(config);
      setStatus(!config?"unconfigured":config.subscription?"enabled":"available");
    }).catch(()=>{if(active)setStatus("unconfigured");});
    return()=>{active=false;};
  },[support]);

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
      status==="available"?<button type="button" disabled={busy} onClick={()=>void enable()}>Enable notifications</button>:null}
    </header>
    {status==="loading"&&<p role="status">Checking this device…</p>}
    {status==="enabled"&&<p role="status">Notifications are enabled on this device. You can turn them off at any time.</p>}
    {status==="install_required"&&<p>On iPhone or iPad, add CEAC OS to your Home Screen, open it there, and then enable notifications.</p>}
    {status==="unavailable"&&<p>This browser cannot receive CEAC notifications while closed. Your in-app updates still work.</p>}
    {status==="unconfigured"&&<p>Device notifications are not available on this CEAC server yet. In-app updates remain available.</p>}
    {["available","enabled"].includes(status)&&<>
      <label style={{display:"flex",alignItems:"flex-start",gap:10,fontSize:13,marginTop:10,fontWeight:500}}>
        <input type="checkbox" checked={preview} disabled={busy||status==="enabled"}
          onChange={e=>setPreview(e.target.checked)} style={{marginTop:3}}/>
        <span>Show the sender and department in lock-screen previews when permitted. Otherwise, show only a private CEAC update.</span>
      </label>
      <p style={{fontSize:12,marginTop:8}}>Your phone or computer controls how notifications appear on its lock screen.</p>
    </>}
    {error&&<p role="alert" className="ceac-updates-error">{error}</p>}
  </section>;
}