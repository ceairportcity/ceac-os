import { useEffect, useRef, useState } from "react";
import { Search, MessageSquare, FileText, PenSquare } from "lucide-react";
import { supabase } from "../lib/supabase";
import Room from "./Room";
import Memos from "./Memos";
import { initials, messageTimestamp, roomContext } from "../lib/memos";
import "./MessagesWorkspace.css";

export default function Inbox({ me, openRoom, openItem, openProject, scheduleMeeting, startWorkFromMessage, openAnnouncements, initialView, onInitialViewHandled }) {
  const linkedMemo = new URLSearchParams(window.location.search).get("memo");
  const [section,setSection] = useState(linkedMemo ? "memos" : "rooms");
  const [rooms,setRooms] = useState([]), [selected,setSelected] = useState(null);
  const [actions,setActions] = useState([]), [actionsOpen,setActionsOpen] = useState(false);
  const [query,setQuery] = useState(""), [error,setError] = useState(""), [loading,setLoading] = useState(true);
  const [reload,setReload] = useState(0), [composeMemo,setComposeMemo] = useState(0);
  const [loadedScope,setLoadedScope] = useState("");
  const scope = `${me.org_id}:${me.id}`;
  const request = useRef(0);
  const workspaceRef = useRef(null);
  const memoLeaveGuard = useRef(null);
  function switchSection(next) {
    if(section === "memos" && next !== section && memoLeaveGuard.current && !memoLeaveGuard.current())return;
    setSection(next);
  }
  const verified = loadedScope === scope;
  useEffect(() => { if(initialView) {setSection("rooms");onInitialViewHandled?.();} },[initialView]);
  useEffect(() => {
    let active = true; const serial = ++request.current;
    setLoading(true);setError("");
    (async () => {
      try {
        const [result,attention] = await Promise.all([supabase.rpc("my_room_directory"),supabase.rpc("my_work_attention_queue")]);
        if(result.error) throw result.error;
        if(attention.error) throw attention.error;
        if(!active || serial !== request.current) return;
        setRooms(result.data || []);setActions(attention.data || []);setLoadedScope(scope);
        setSelected(current => (result.data || []).find(room => room.id === current?.id) || null);
      } catch(failure) {
        if(active && serial === request.current) {setRooms([]);setLoadedScope(scope);setError(failure.message || "Rooms could not be loaded.");}
      } finally {if(active && serial === request.current)setLoading(false);}
    })();
    return () => {active=false;};
  },[scope,reload]);
  useEffect(() => {
    const refresh=()=>{if(document.visibilityState === "visible")setReload(n=>n+1);};
    window.addEventListener("focus",refresh);
    const timer=window.setInterval(refresh,60000);
    return ()=>{window.removeEventListener("focus",refresh);window.clearInterval(timer);};
  },[]);
  useEffect(() => {
    const viewport=window.visualViewport;
    if(!viewport)return;
    const fit=()=>{
      const node=workspaceRef.current;if(!node)return;
      if(viewport.height < window.innerHeight-120){
        const top=Math.max(0,node.getBoundingClientRect().top-viewport.offsetTop);
        node.style.height=Math.max(160,viewport.height-top-8)+"px";node.style.minHeight="0";
      }else{node.style.removeProperty("height");node.style.removeProperty("min-height");}
    };
    viewport.addEventListener("resize",fit);viewport.addEventListener("scroll",fit);fit();
    return()=>{viewport.removeEventListener("resize",fit);viewport.removeEventListener("scroll",fit);};
  },[]);
  const visibleRooms = verified ? rooms.filter(room => `${room.name || ""} ${room.last_body || ""}`.toLowerCase().includes(query.toLowerCase())) : [];
  return <div ref={workspaceRef} className="msg-workspace" style={{"--exec-purple":"#1678c9"}}>
    <header className="msg-head"><h1>Messages</h1>
      <div><button type="button" aria-expanded={actionsOpen} onClick={()=>setActionsOpen(open=>!open)}>Work actions {verified ? actions.length : "…"}</button><button type="button" onClick={openAnnouncements}>Announcements</button>
      <button type="button" aria-label="New Memo" onClick={()=>{setSection("memos");setComposeMemo(n=>n+1);}}><PenSquare size={19}/></button></div>
    </header>
    {actionsOpen && verified && <div className="room-picker-panel" aria-label="Work actions">
      {actions.map(action=><button type="button" key={`${action.action_kind}:${action.work_item_id}:${action.action_at}`} onClick={()=>openItem?.(action.work_item_id)}>
        <strong>{action.work_ref} · {action.work_title}</strong><span>{{new_assignment:"New assignment",returned_work:"Correction required",review_required:"Review required",routine_due:"Routine due"}[action.action_kind] || action.action_kind.replaceAll("_"," ")}</span>
      </button>)}{!actions.length && <p>No work action is waiting.</p>}
    </div>}
    <nav className="msg-sections" aria-label="Messages sections">
      <button type="button" aria-current={section === "rooms" ? "page" : undefined} onClick={()=>switchSection("rooms")}><MessageSquare size={16}/> Rooms</button>
      <button type="button" aria-current={section === "memos" ? "page" : undefined} onClick={()=>switchSection("memos")}><FileText size={16}/> Memos</button>
    </nav>
    {section === "memos" ? <Memos key={scope} me={me} composeRequest={composeMemo} initialMemoId={linkedMemo} openProject={openProject} leaveGuard={memoLeaveGuard}/>
      : <div className={`msg-layout ${selected && verified ? "has-selection" : ""}`}>
        <aside className="msg-directory" aria-label="Rooms">
          <label className="msg-search"><Search size={16}/><input type="search" aria-label="Search Rooms" placeholder="Search rooms…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          {error && verified && <p role="alert">{error}<button type="button" onClick={()=>setReload(n=>n+1)}>Retry Rooms</button></p>}
          {loading && !verified && <p role="status">Loading Rooms…</p>}
          {visibleRooms.map(room=><button type="button" className={`msg-row ${selected?.id === room.id ? "selected" : ""}`} key={room.id}
            aria-current={selected?.id===room.id ? "true" : undefined} onClick={()=>setSelected(room)}>
            <span className="msg-icon" aria-hidden="true">{initials(room.name)}</span>
            <span className="msg-copy"><strong>{room.name || "Room"}</strong><small>{room.last_body ? `${room.last_author || "CEAC"}: ${room.last_body}` : "No messages yet"}</small></span>
            <span className="msg-meta"><time>{messageTimestamp(room.last_at)}</time>{Number(room.unread_count)>0 && <b aria-label={`${room.unread_count} unread messages`}>{room.unread_count}</b>}</span>
          </button>)}
          {!loading && !error && !visibleRooms.length && <p>No Rooms match this view.</p>}
        </aside>
        <section className="msg-conversation" aria-label="Selected Room">
          {selected && verified ? <Room key={`${scope}:${selected.id}`} me={me} embedded context={roomContext(selected)}
            back={()=>{setSelected(null);setReload(n=>n+1);}} openItem={openItem} openProject={openProject} scheduleMeeting={scheduleMeeting}
            openAnnouncements={openAnnouncements} startWorkFromMessage={startWorkFromMessage}
            onRoomChange={openRoom} onMessagesChanged={()=>setReload(n=>n+1)}/>
            : <div className="msg-empty"><MessageSquare size={26}/><h2>Your Rooms</h2><p>Select a Room to read or join its conversation.</p></div>}
        </section>
      </div>}
  </div>;
}
