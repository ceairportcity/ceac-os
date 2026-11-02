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
        const [result,rooms]=await Promise.all([
          supabase.rpc("my_ceac_notifications"),
          supabase.rpc("my_room_directory"),
        ]);
        if(!active || result.error || !Array.isArray(result.data))return;
        const unread=result.data.filter(row=>!row.read_at);
        const roomUnread=rooms.error || !Array.isArray(rooms.data)?null:rooms.data.reduce(
          (total,row)=>total+Math.max(0,Number(row.unread_count)||0),0
        );
        const count=unread.length+(roomUnread||0);
        setCounts({count,memo:unread.filter(row=>row.context_kind==="memo").length,room:roomUnread});
        if("setAppBadge" in navigator){
          if(count)void navigator.setAppBadge(count).catch(()=>{});
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
