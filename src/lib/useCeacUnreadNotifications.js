import {useEffect,useState} from "react";
import {supabase} from "./supabase";

// The server remains the source of truth; an unavailable read does not become
// a fabricated zero. Private Memo/case body content is never cached here.
export function useCeacUnreadNotifications(me) {
  const [counts,setCounts]=useState(null);
  useEffect(()=>{
    if(!me?.id || !me?.org_id){setCounts(null);return;}
    let active=true;
    setCounts(null);
    async function refresh(){
      if(document.visibilityState==="hidden")return;
      try{
        const result=await supabase.rpc("my_ceac_notifications");
        if(!active || result.error || !Array.isArray(result.data))return;
        const unread=result.data.filter(row=>!row.read_at);
        setCounts({count:unread.length,memo:unread.filter(row=>row.context_kind==="memo").length});
        if("setAppBadge" in navigator){
          if(unread.length)void navigator.setAppBadge(unread.length).catch(()=>{});
          else if("clearAppBadge" in navigator)void navigator.clearAppBadge().catch(()=>{});
        }
      }catch{/* Retain the previously verified count. */}
    }
    void refresh();
    const timer=window.setInterval(refresh,12000);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    window.addEventListener("ceac:notifications-changed",refresh);
    return()=>{
      active=false;clearInterval(timer);
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",refresh);
      window.removeEventListener("ceac:notifications-changed",refresh);
    };
  },[me?.org_id,me?.id]);
  return counts;
}
