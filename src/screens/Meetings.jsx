import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CeacIcon } from "../experience-v2/icons";
import Meeting from "./Meeting";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Accra", weekday: "short", day: "numeric", month: "short",
  hour: "2-digit", minute: "2-digit",
});

export default function Meetings({ me, meetingId, openMeeting, closeMeeting, scheduleMeeting, ...detailProps }) {
  const [list, setList] = useState({ rows: [], state: "loading" });
  const [filter, setFilter] = useState("");
  const [retry, setRetry] = useState(0);
  const [browse, setBrowse] = useState(!meetingId);

  useEffect(() => {
    let current = true;
    setList({ rows: [], state: "loading" });
    async function load() {
      try {
        const { data, error } = await supabase.from("meeting_sessions")
          .select("id,title,starts_at,status").eq("org_id", me.org_id)
          .order("starts_at", { ascending: false }).order("id").limit(100);
        if (error) throw error;
        if (current) setList({ rows: data, state: "ready" });
      } catch {
        if (current) setList({ rows: [], state: "error" });
      }
    }
    load();
    return () => { current = false; };
  }, [me.id, me.org_id, me.unit_id, retry]);

  const selected = meetingId || list.rows[0]?.id;
  const visible = list.rows.filter(row => row.title.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
  return <div className={"meetings-workspace" + (browse && !meetingId ? " is-browsing" : "")}>
    <aside className="meeting-register" aria-label="Meeting list">
      <header><h1>Meetings</h1>{scheduleMeeting && <button type="button" className="btn btn-sm" onClick={scheduleMeeting}>+ New</button>}</header>
      <input type="search" aria-label="Search meetings" placeholder="Search meetings" value={filter} onChange={e => setFilter(e.target.value)} />
      {list.state === "loading" && <p role="status">Loading meetings…</p>}
      {list.state === "error" && <p role="alert">Meetings could not be loaded. <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></p>}
      {list.state === "ready" && (visible.length ? visible.map(row => <button type="button" key={row.id}
        className="meeting-list-row" aria-current={row.id === selected ? "true" : undefined}
        onClick={() => { setBrowse(false); openMeeting(row.id); }}>
        <CeacIcon name="meeting" size={17} />
        <span><strong>{row.title}</strong><small>{dateTime.format(new Date(row.starts_at))}{row.status === "cancelled" ? " · Cancelled" : ""}</small></span>
      </button>) : <p>{filter ? "No matching meetings." : "No meetings are available."}</p>)}
    </aside>
    <div className="meeting-selected">
      {selected && <Meeting {...detailProps} me={me} meetingId={selected} embedded
        back={() => { setBrowse(true); if (meetingId) closeMeeting(); }} />}
    </div>
  </div>;
}
