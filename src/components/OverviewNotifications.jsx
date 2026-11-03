import {cloneElement,isValidElement,useState} from "react";
import {Bell,CalendarClock,CheckCircle2,Clock3,FileText,MessageSquare,ShieldAlert,ClipboardCheck} from "lucide-react";
import "./overview-notifications.css";
import {supabase} from "../lib/supabase";
import {filterDayNotices} from "../lib/overviewDay";

// Decisions are supplied by the authorised Overview role, not fetched again.
export function withOverviewActions(panel,actionItems=[],actionReady=true) {
  return isValidElement(panel)?cloneElement(panel,{actionItems,actionReady}):panel;
}
const icons={meeting:CalendarClock,work:Clock3,room:MessageSquare,event:FileText,
  calendar:CalendarClock,reminder:Bell,report:FileText,people:ClipboardCheck,
  checks:ClipboardCheck,warning:ShieldAlert,leave:CalendarClock,announcement:Bell};
export default function OverviewNotifications({notifications,onOpenUpdates,actionItems=[],actionReady=true}){
  const [expanded,setExpanded]=useState(false);
  const actions=Array.isArray(actionItems)?actionItems.filter(Boolean):[];
  const items=filterDayNotices(notifications?.items||[],actions).slice(0,3);
  const visibleActions=expanded?actions:actions.slice(0,3);
  async function openItem(event,row){
    if(row.type!=="event"||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();
    const id=row.id.slice("event:".length);
    try{
      const result=await supabase.rpc("mark_ceac_notification_read",{p_id:id});
      if(!result.error)window.dispatchEvent(new Event("ceac:notifications-changed"));
    }catch{/* A read failure should not prevent the user from opening the record. */}
    window.location.assign(row.url||"/?tab=messages&updates=1");
  }
  return <section id="ceac-your-day" className="ceac-glass-updates ceac-day" aria-label="Your day">
    <header className="ceac-glass-updates-header">
      <div className="ceac-glass-updates-title">
        <span className="ceac-glass-bell" aria-hidden="true"><Bell size={19}/></span>
        <div><h2>Your Day</h2><p>Priorities, reminders and updates in one place</p></div>
      </div>
    </header>
    <div className="ceac-day-sections">
      <section className="ceac-day-group" aria-label="Requires your action">
        <header className="ceac-day-group-head"><h3>Requires your action</h3>
          {actionReady&&actions.length>0?<span className="ceac-day-count">{actions.length}</span>:null}
        </header>
        {!actionReady?<p className="ceac-glass-empty" role="status">Checking your decisions…</p>
          :actions.length?<><div className="ceac-day-actions">{visibleActions.map(row=>{
            const Icon=icons[row.icon]||ClipboardCheck;
            const content=<><span className="ceac-glass-icon" aria-hidden="true"><Icon size={17}/></span>
              <span className="ceac-glass-copy"><strong>{row.title}</strong>
                {row.meta?<small>{row.meta}</small>:null}</span>
              {row.status?<span className="ceac-day-status">{row.status}</span>:null}</>;
            return <div key={row.id} className="ceac-day-decision">
              {row.onClick?<button type="button" className="ceac-day-decision-main" onClick={row.onClick}>{content}</button>
                :<div className="ceac-day-decision-main">{content}</div>}
              {row.actions?<div className="ceac-day-action-buttons">{row.actions}</div>:null}
            </div>;
          })}</div>
          {actions.length>3?<button type="button" className="ceac-day-expand"
            onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>
            {expanded?"Show fewer":"Show all "+actions.length+" actions"}</button>:null}
          </>:<p className="ceac-glass-empty"><CheckCircle2 size={18}/> Nothing requires your decision right now.</p>}
      </section>
      <section className="ceac-day-group" aria-label="Upcoming and updates">
        <header className="ceac-day-group-head"><h3>Upcoming &amp; updates</h3>
          <button type="button" className="ceac-glass-all" onClick={onOpenUpdates}>View all</button>
        </header>
        {notifications?.error?<p className="ceac-glass-error" role="status">{notifications.error}</p>:null}
        {!notifications?<p className="ceac-glass-empty" role="status">Checking your updates…</p>:null}
        {notifications&&!items.length?<p className="ceac-glass-empty"><CheckCircle2 size={18}/> No upcoming or unread updates right now.</p>:null}
        {!!items.length?<div className="ceac-glass-list">{items.map(row=>{
          const Icon=icons[row.type]||ShieldAlert;
          return <a key={row.id} className={"ceac-glass-item is-"+row.level}
            href={row.url||"/?tab=messages&updates=1"} onClick={event=>void openItem(event,row)}>
            <span className="ceac-glass-icon" aria-hidden="true"><Icon size={17}/></span>
            <span className="ceac-glass-copy"><strong>{row.title}</strong><small>{row.meta}</small></span>
            {row.level==="attention"?<span className="ceac-glass-priority">Action</span>:null}
          </a>;
        })}</div>:null}
        {notifications?.room>0?<div className="ceac-glass-foot">{notifications.room} followed Room updates</div>:null}
      </section>
    </div>
  </section>;
}
