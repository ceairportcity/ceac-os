import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { LoadingState, ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";

const MESSAGE_SELECT = "id,room_id,author_id,body,created_at,profiles!room_messages_author_id_fkey(full_name),room_message_refs(id,object_type,object_id,label),rooms(id,kind,unit_id,sub_team_id,project_id,units(name),sub_teams(name),projects(name))";

function roomName(room) {
  if (!room) return "Room";
  if (room.kind === "project") return room.projects?.name || "Project Room";
  if (room.kind === "sub_team") return room.sub_teams?.name || "Sub-team Room";
  return room.units?.name || "Unit Room";
}

function contextFor(room) {
  if (room?.kind === "project") return { kind: "project", projectId: room.project_id };
  if (room?.kind === "sub_team") return { kind: "sub_team", subTeamId: room.sub_team_id };
  return { kind: "unit", unitId: room?.unit_id };
}

function mergeMessages(...groups) {
  const byId = new Map();
  groups.flat().filter(Boolean).forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export default function Inbox({ me, openRoom, openAnnouncements }) {
  const [view, setView] = useState("all");
  const [messages, setMessages] = useState([]);
  const [mentions, setMentions] = useState(new Set());
  const [reads, setReads] = useState(new Map());
  const [announcements, setAnnouncements] = useState([]);
  const [roomDirectory, setRoomDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.id, me.unit_id, me.is_exec]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [mentionResult, readResult, announcementResult, directoryResult] = await Promise.all([
        supabase.from("room_mentions").select("message_id").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(120),
        supabase.from("room_reads").select("room_id,last_read_at").eq("profile_id", me.id),
        supabase.from("announcements")
          .select("id,title,body,priority,requires_acknowledgement,published_at,profiles!announcements_author_id_fkey(full_name),announcement_receipts(profile_id,read_at,acknowledged_at)")
          .order("published_at", { ascending: false }).limit(40),
        me.is_exec
          ? supabase.from("rooms")
              .select("id,kind,unit_id,sub_team_id,project_id,units(name),sub_teams(name),projects(name)")
              .in("kind", ["unit", "sub_team"])
          : Promise.resolve({ data: [], error: null }),
      ]);

      const first = [mentionResult.error, readResult.error, announcementResult.error, directoryResult.error].find(Boolean);
      if (first) throw first;

      const mentionIds = [...new Set((mentionResult.data || []).map((row) => row.message_id).filter(Boolean))];
      let loadedMessages = [];

      if (me.is_exec) {
        const ownResult = await supabase.from("room_messages")
          .select(MESSAGE_SELECT)
          .eq("author_id", me.id)
          .order("created_at", { ascending: false })
          .limit(80);
        if (ownResult.error) throw ownResult.error;

        let mentionedRows = [];
        if (mentionIds.length) {
          const mentionedResult = await supabase.from("room_messages")
            .select(MESSAGE_SELECT)
            .in("id", mentionIds.slice(0, 120))
            .order("created_at", { ascending: false });
          if (mentionedResult.error) throw mentionedResult.error;
          mentionedRows = mentionedResult.data || [];
        }
        loadedMessages = mergeMessages(ownResult.data || [], mentionedRows);
      } else {
        const messageResult = await supabase.from("room_messages")
          .select(MESSAGE_SELECT)
          .order("created_at", { ascending: false })
          .limit(120);
        if (messageResult.error) throw messageResult.error;
        loadedMessages = messageResult.data || [];
      }

      const directory = [...(directoryResult.data || [])].sort((a, b) => {
        const aUnit = a.units?.name || "";
        const bUnit = b.units?.name || "";
        if (aUnit !== bUnit) return aUnit.localeCompare(bUnit);
        if (a.kind !== b.kind) return a.kind === "unit" ? -1 : 1;
        return roomName(a).localeCompare(roomName(b));
      });

      setMessages(loadedMessages);
      setMentions(new Set(mentionIds));
      setReads(new Map((readResult.data || []).map((row) => [row.room_id, row.last_read_at])));
      setAnnouncements(announcementResult.data || []);
      setRoomDirectory(directory);
    } catch (err) {
      setError(humanError(err, "Messages could not be loaded."));
      setMessages([]);
      setRoomDirectory([]);
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    const messageRows = messages.map((message) => ({
      type: "message",
      at: message.created_at,
      message,
      mentioned: mentions.has(message.id),
      work: (message.room_message_refs || []).some((ref) => ref.object_type === "work_item"),
      unread: message.author_id !== me.id
        && (!reads.get(message.room_id) || new Date(message.created_at) > new Date(reads.get(message.room_id))),
    }));
    const announcementRows = announcements.map((announcement) => ({
      type: "announcement",
      at: announcement.published_at,
      announcement,
      unread: !(announcement.announcement_receipts || []).some((receipt) => receipt.profile_id === me.id && receipt.read_at),
    }));
    const combined = view === "announcements"
      ? announcementRows
      : view === "mentions"
        ? messageRows.filter((row) => row.mentioned)
        : view === "work"
          ? messageRows.filter((row) => row.work)
          : view === "rooms"
            ? messageRows
            : [...messageRows, ...announcementRows];
    return combined.sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [messages, announcements, mentions, reads, view, me.id]);

  const unread = rows.filter((row) => row.unread).length;

  return <div className="body premium-page inbox-page">
    <header className="premium-page-head">
      <div>
        <span className="eyebrow">Communication</span>
        <h1 className="h1">Messages</h1>
        <p className="screen-note">
          {me.is_exec
            ? "Your Room activity, mentions and announcements. Use the Room directory when you intentionally need to enter another Unit or Sub-team conversation."
            : "Rooms, mentions, work context and announcements. CEAC OS does not provide unrestricted direct messages."}
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" type="button" onClick={openAnnouncements}>Announcements</button>
        <span className="premium-count-badge">{unread} unread</span>
      </div>
    </header>

    <div className="premium-filter-row" role="tablist" aria-label="Message views">
      {[["all", "All"], ["rooms", "Rooms"], ["mentions", "Mentions"], ["work", "Work"], ["announcements", "Announcements"]].map(([key, label]) =>
        <button key={key} role="tab" aria-selected={view === key} className={view === key ? "on" : ""} onClick={() => setView(key)}>{label}</button>
      )}
    </div>

    {error && <ProductNotice tone="error" title="Could not load Messages">{error}</ProductNotice>}

    {loading ? <LoadingState label="Loading Messages…" /> : <>
      {me.is_exec && view === "rooms" && <section className="inbox-room-directory" aria-label="Organisation Room directory">
        <div className="sec"><span>Organisation Rooms</span><span>{roomDirectory.length}</span></div>
        <p className="screen-note">Leadership access is deliberate: enter a Unit or Sub-team Room when the work requires it. This directory does not create direct messages.</p>
        <div className="inbox-list">
          {roomDirectory.map((room) => <button key={room.id} className="inbox-row" onClick={() => openRoom?.(contextFor(room))}>
            <span className="inbox-icon room">#</span>
            <span className="inbox-copy">
              <span className="inbox-meta"><strong>{room.kind === "unit" ? "Unit Room" : "Sub-team Room"}</strong></span>
              <b>{roomName(room)}</b>
              <small>{room.units?.name || "Unit"}</small>
            </span>
          </button>)}
          {!roomDirectory.length && <div className="premium-empty inbox-empty"><strong>No organisational Rooms are available</strong><span>Only active Unit and Sub-team Rooms authorised by CEAC appear here.</span></div>}
        </div>
      </section>}

      <section className="inbox-list">
        {rows.length ? rows.map((row) => row.type === "announcement"
          ? <button key={`announcement-${row.announcement.id}`} className={`inbox-row ${row.unread ? "unread" : ""}`} onClick={openAnnouncements}>
              <span className="inbox-icon announcement">A</span>
              <span className="inbox-copy">
                <span className="inbox-meta"><strong>Announcement</strong><time>{new Date(row.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></span>
                <b>{row.announcement.title}</b>
                <small>{row.announcement.profiles?.full_name || "CEAC"}{row.announcement.requires_acknowledgement ? " · acknowledgement may be required" : ""}</small>
              </span>
            </button>
          : <button key={row.message.id} className={`inbox-row ${row.unread ? "unread" : ""}`} onClick={() => openRoom?.(contextFor(row.message.rooms))}>
              <span className={`inbox-icon ${row.mentioned ? "mention" : "room"}`}>{row.mentioned ? "@" : "#"}</span>
              <span className="inbox-copy">
                <span className="inbox-meta"><strong>{roomName(row.message.rooms)}</strong><time>{new Date(row.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></span>
                <b>{row.message.profiles?.full_name || "CEAC member"}</b>
                <small>{row.message.body}</small>
                {row.work && <span className="inbox-context">Linked work</span>}
              </span>
            </button>
        ) : <div className="premium-empty inbox-empty"><strong>Nothing is waiting in this view</strong><span>Rooms, mentions, linked work and announcements will appear here when they need your attention.</span></div>}
      </section>
    </>}
  </div>;
}
