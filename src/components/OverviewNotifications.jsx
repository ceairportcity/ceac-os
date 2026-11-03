import {Bell,CalendarClock,CheckCircle2,Clock3,FileText,MessageSquare,ShieldAlert} from "lucide-react";
import "./overview-notifications.css";
import {supabase} from "../lib/supabase";
import {supabase} from "../lib/supabase";

// Same compact notification stack on all four Overview experiences.
// No confidential Memo or Room message body enters this preview.
const icons={meeting:CalendarClock,work:Clock3,room:MessageSquare,
  event:FileText,calendar:CalendarClock,reminder:Bell};
export default function OverviewNotifications({notifications,onOpenUpdates}){
  const items=notifications?.items?.slice(0,3)||[];
  async function openItem(event,row){
    if(row.type!=="event" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button!==0)return;
    event.preventDefault();
    const id=row.id.slice("event:".length);
    try{
      const result=await supabase.rpc("mark_ceac_notification_read",{p_id:id});
      if(!result.error)window.dispatchEvent(new Event("ceac:notifications-changed"));
    }catch{/* Opening an authorised update should remain possible during a transient mark-read failure. */}
    window.location.assign(row.url||"/?tab=messages&updates=1");
  }
  const pending=notifications?.attention||0;
  async function openNotice(row,evt){
    if(row.type!=="event" || evt.button!==0 || evt.metaKey || evt.ctrlKey || evt.altKey || evt.shiftKey)return;
    evt.preventDefault();
    const id=String(row.id||"").slice(6);
    try{
      const result=await supabase.rpc("mark_ceac_notification_read",{p_id:id});
      if(!result.error)window.dispatchEvent(new Event("ceac:notifications-changed"));
    }catch{/* A failed acknowledgement must not deny access to the record. */}
    window.location.assign(row.url||"/?tab=messages&updates=1");
  }
  return <section className="ceac-glass-updates" aria-label="Your notification briefing">
    <header className="ceac-glass-updates-header">
      <div className="ceac-glass-updates-title">
        <span className="ceac-glass-bell" aria-hidden="true"><Bell size={19}/></span>
        <div><h2>Your updates</h2><p>{pending>0?pending+" need"+(pending===1?"s":"")+" attention":"Personal reminders and messages"}</p></div>
      </div>
      <button type="button" onClick={onOpenUpdates} className="ceac-glass-all">View all</button>
    </header>
    {notifications?.error&&<p className="ceac-glass-error" role="status">{notifications.error}</p>}
    {!notifications&&<p className="ceac-glass-empty" role="status">Checking your updates…</p>}
    {notifications&&!items.length&&<div className="ceac-glass-empty"><CheckCircle2 size={19}/><span>No urgent or unread updates right now.</span></div>}
    {!!items.length&&<div className="ceac-glass-list">
      {items.map(row=>{
        const Icon=icons[row.type]||ShieldAlert;
        return <a key={row.id} className={"ceac-glass-item is-"+row.level} href={row.url||"/?tab=messages&updates=1"} onClick={evt=>void openNotice(row,evt)} onClick={event=>void openItem(event,row)}>
          <span className="ceac-glass-icon" aria-hidden="true"><Icon size={17}/></span>
          <span className="ceac-glass-copy">
            <strong>{row.title}</strong>
            <small>{row.meta}</small>
          </span>
          {row.level==="attention"&&<span className="ceac-glass-priority">Action</span>}
        </a>;
      })}
    </div>}
    <div className="ceac-glass-foot"><span>{notifications?.room>0?notifications.room+" followed Room updates":"Rooms stay quiet unless followed or mentioned"}</span></div>
  </section>;
}
