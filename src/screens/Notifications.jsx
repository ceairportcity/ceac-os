import {useState} from "react";
import {Bell,CalendarClock,CheckCircle2,Clock3,FileText,MessageSquare,RefreshCw} from "lucide-react";
import {supabase} from "../lib/supabase";
import "./notifications-center.css";
import DevicePushSettings from "../components/DevicePushSettings";

const typeIcons={meeting:CalendarClock,work:Clock3,room:MessageSquare,
  event:FileText,calendar:CalendarClock,reminder:Bell};
const filters=[["attention","Needs attention"],["personal","For you"],["activity","Room activity"],["all","All"]];
export default function Notifications({me,notificationCounts}){
  const [filter,setFilter]=useState("attention");
  const [showAllRooms,setShowAllRooms]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [showSettings,setShowSettings]=useState(false);
  const data=notificationCounts;
  const entries=(data?.items||[]).filter(row=>filter==="all"||row.level===filter);
  const rooms=(data?.roomPreferences||[]).filter(room=>room.name.toLowerCase().includes(search.toLowerCase()));
  const visibleRooms=showAllRooms?rooms:rooms.slice(0,10);
  async function open(row){
    if(busy)return;
    if(row.type==="reminder"){
      const id=row.id.slice("reminder:".length);
      setBusy(id);setError("");
      const result=await supabase.from("personal_reminders").update({seen_at:new Date().toISOString()})
        .eq("id",id).eq("profile_id",me.id);
      if(result.error){setBusy("");setError("The reminder could not be acknowledged. Retry.");return;}
      setBusy("");data?.refresh?.();return;
    }
    if(row.type==="event"){
      const id=row.id.slice("event:".length);
      setBusy(id);setError("");
      const result=await supabase.rpc("mark_ceac_notification_read",{p_id:id});
      if(!result.error)window.dispatchEvent(new Event("ceac:notifications-changed"));
      // A temporary read-receipt failure must not block opening the source.
      // The notification remains unread until independently acknowledged.
    }
    window.location.assign(row.url||"/?tab=home");
  }
  async function changeRoomLevel(roomId,level){
    if(!data?.setRoomLevel)return;
    setBusy(roomId);setError("");
    try{await data.setRoomLevel(roomId,level);}
    catch{setError("That Room's notification preference could not be saved. Please retry.");}
    finally{setBusy("");}
  }
  return <section className="ceac-updates-page" aria-label="Your updates">
    <header className="ceac-updates-heading">
      <div><span className="ceac-updates-eyebrow">Personal notification centre</span><h2>Your updates</h2>
        <p>Meetings, deadlines, Memos and conversations that matter to you.</p></div>
      <button type="button" onClick={()=>data?.refresh?.()} aria-label="Refresh your updates" className="ceac-updates-refresh"><RefreshCw size={16}/> Refresh</button>
    </header>
    {data?.error&&<p className="ceac-updates-error" role="status">{data.error}</p>}
    {error&&<p className="ceac-updates-error" role="alert">{error}</p>}
    <nav className="ceac-updates-tabs" aria-label="Notification priority">
      {filters.map(([value,label])=><button type="button" key={value} aria-current={value===filter?"page":undefined}
        onClick={()=>setFilter(value)}>{label}
        {value==="attention"&&Boolean(data?.attention)&&<span>{data.attention}</span>}
      </button>)}
    </nav>
    {!data?<p role="status" className="ceac-updates-empty">Verifying your notifications…</p>
      : !entries.length?<div className="ceac-updates-empty"><CheckCircle2 size={20}/> Nothing in this category needs your attention.</div>
      : <div className="ceac-updates-list">{entries.slice(0,40).map(row=>{
        const Icon=typeIcons[row.type]||Bell;
        return <button type="button" className={"ceac-updates-entry is-"+row.level} key={row.id} disabled={Boolean(busy)}
          onClick={()=>void open(row)}>
          <span className="ceac-updates-icon"><Icon size={18}/></span>
          <span className="ceac-updates-copy"><strong>{row.title}</strong><small>{row.meta}</small></span>
          <span className="ceac-updates-category">{row.level==="attention"?"Action":row.level==="personal"?"For you":"Quiet"}</span>
        </button>;
      })}</div>}
    <DevicePushSettings/>
    <section className="ceac-room-settings" aria-label="Room notification settings">
      <header><div><h3>Room notifications</h3><p>Access to a Room is separate from receiving its messages.</p></div>
        <button type="button" onClick={()=>setShowSettings(value=>!value)} aria-expanded={showSettings}>{showSettings?"Hide settings":"Manage Rooms"}</button>
      </header>
      {showSettings&&<div className="ceac-room-settings-body">
        <p className="ceac-room-setting-hint">All activity: every unread message. Mentions only: when someone mentions you. Mute: no ordinary Room alerts. Formal approvals and assigned work remain visible.</p>
        {!data?.roomPreferencesAvailable&&<p role="status">Room preferences are temporarily unavailable.</p>}
        <label>Find Room<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search Rooms"/></label>
        <div className="ceac-room-settings-rows">
          {visibleRooms.map(room=><div className="ceac-room-setting" key={room.id}>
            <span><strong>{room.name}</strong><small>{room.unread?room.unread+" personal updates":"No active alerts"}</small></span>
            <select aria-label={"Notifications for "+room.name} value={room.level}
              disabled={Boolean(busy)||!data?.roomPreferencesAvailable}
              onChange={e=>void changeRoomLevel(room.id,e.target.value)}>
              <option value="all">All activity</option>
              <option value="mentions">Mentions only</option>
              <option value="mute">Mute</option>
            </select>
          </div>)}
          {!visibleRooms.length&&<p>No matching Rooms.</p>}
        </div>
        {!showAllRooms&&rooms.length>10&&<button type="button" className="ceac-room-more" onClick={()=>setShowAllRooms(true)}>Show all {rooms.length} Rooms</button>}
      </div>}
    </section>
  </section>;
}
