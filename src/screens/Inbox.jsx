import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { LoadingState, ProductNotice } from "../components/bits";
import { Button, DataPanel, QueueRow, SegmentedControl, StatePanel, StatusBadge } from "../experience-v2/components";
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

function titleCase(value = "") {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actionPresentation(row) {
  if (row.action_kind === "routine_due") return { icon: "notification", label: "Routine due", tone: "warning" };
  if (row.action_kind === "returned_work") {
    return { icon: "warning", label: "Correction required", tone: "danger" };
  }
  if (row.action_kind === "review_required") {
    return { icon: "notification", label: "Review required", tone: "warning" };
  }
  return { icon: "work", label: "New assignment", tone: "action" };
}

function formattedAt(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function Inbox({ me, openRoom, openItem, openAnnouncements, initialView = null, onInitialViewHandled }) {
  const organisationRooms = Boolean(me.is_exec || me.is_admin);
  const scopeKey=[me.org_id,me.id,me.unit_id||"",Boolean(me.is_exec),Boolean(me.is_admin)].join(":");
  const liveScope=useRef(scopeKey);liveScope.current=scopeKey;
  const request=useRef(0);
  const [loadedScope,setLoadedScope]=useState("");
  const verifiedScope=loadedScope===scopeKey;
  const [view, setView] = useState("all");
  const [actions, setActions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [mentions, setMentions] = useState(new Set());
  const [reads, setReads] = useState(new Map());
  const [announcements, setAnnouncements] = useState([]);
  const [roomDirectory, setRoomDirectory] = useState([]);
  const [peopleDirectory,setPeopleDirectory]=useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
    const refresh=()=>load();
    window.addEventListener("focus",refresh);
    return ()=>{request.current++;window.removeEventListener("focus",refresh);};
  }, [scopeKey]);
  useEffect(() => {
    if (!initialView) return;
    setView(initialView);
    onInitialViewHandled?.();
  }, [initialView]);

  async function load() {
    const requestedScope=scopeKey;
    const requested=++request.current;
    const current=()=>requested===request.current&&requestedScope===liveScope.current;
    setLoadedScope("");
    setLoading(true);
    setError(null);
    try {
      const [actionResult, mentionResult, readResult, announcementResult, directoryResult, peopleResult] = await Promise.all([
        supabase.rpc("my_work_attention_queue"),
        supabase.from("room_mentions").select("message_id").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(120),
        supabase.from("room_reads").select("room_id,last_read_at").eq("profile_id", me.id),
        supabase.from("announcements")
          .select("id,title,body,priority,requires_acknowledgement,published_at,profiles!announcements_author_id_fkey(full_name),announcement_receipts(profile_id,read_at,acknowledged_at)")
          .order("published_at", { ascending: false }).limit(40),
        organisationRooms
          ? supabase.from("rooms")
              .select("id,kind,unit_id,sub_team_id,project_id,units(name),sub_teams(name),projects(name)")
              .eq("org_id", me.org_id)
              .in("kind", me.is_admin ? ["unit", "sub_team", "project"] : ["unit", "sub_team"])
          : Promise.resolve({ data: [], error: null }),
        me.is_admin ? supabase.from("profiles").select("id,full_name,is_admin,is_exec,unit_memberships(unit_id,role,units(name))")
          .eq("org_id",me.org_id).eq("active",true).order("full_name") : Promise.resolve({data:[],error:null}),
      ]);

      const first = [actionResult.error, mentionResult.error, readResult.error, announcementResult.error, directoryResult.error, peopleResult.error].find(Boolean);
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

      if(!current())return;
      setLoadedScope(requestedScope);
      setActions(actionResult.data || []);
      setMessages(loadedMessages);
      setMentions(new Set(mentionIds));
      setReads(new Map((readResult.data || []).map((row) => [row.room_id, row.last_read_at])));
      setAnnouncements(announcementResult.data || []);
      setRoomDirectory(directory);
      setPeopleDirectory(peopleResult.data||[]);
    } catch (err) {
      if(!current())return;
      setLoadedScope(requestedScope);
      setAnnouncements([]);setMentions(new Set());setReads(new Map());
      setError(humanError(err, "Messages could not be loaded."));
      setActions([]);
      setMessages([]);
      setRoomDirectory([]);setPeopleDirectory([]);
    } finally {
      if(current())setLoading(false);
    }
  }

  const communicationRows = useMemo(() => {
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

  const totalUnread = useMemo(() => {
    const unreadMessages = messages.filter((message) => message.author_id !== me.id
      && (!reads.get(message.room_id) || new Date(message.created_at) > new Date(reads.get(message.room_id)))).length;
    const unreadAnnouncements = announcements.filter((announcement) =>
      !(announcement.announcement_receipts || []).some((receipt) => receipt.profile_id === me.id && receipt.read_at)
    ).length;
    return unreadMessages + unreadAnnouncements;
  }, [messages, announcements, reads, me.id]);
  const showActions = view === "all" || view === "work";

  return <div className={me.is_exec ? "body inbox-page exec-redesign-shared" : "body premium-page inbox-page"}>
    <header className={me.is_exec ? "exec-redesign-shared-head" : "premium-page-head"}>
      <div>
        <span className="eyebrow">Communication</span>
        <h1 className="h1">Messages</h1>
        <p className="screen-note">
          {organisationRooms
            ? "Find conversations, mentions, announcements and work needing a response."
            : "Work actions, Rooms, mentions and announcements in one operational queue. CEAC OS does not provide unrestricted direct messages."}
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Button variant="secondary" size="compact" onClick={openAnnouncements}>Announcements</Button>
        <StatusBadge tone={actions.length ? "warning" : "neutral"} icon={false}>{verifiedScope?actions.length:0} need action</StatusBadge>
        <StatusBadge tone={totalUnread ? "action" : "neutral"} icon={false}>{verifiedScope?totalUnread:0} unread</StatusBadge>
      </div>
    </header>

    <SegmentedControl
      ariaLabel="Message views"
      value={view}
      onChange={setView}
      items={[
        { value:"all", label:"All" },
        { value:"rooms", label:"Rooms" },
        ...(me.is_admin?[{value:"people",label:"People"}]:[]),
        { value:"mentions", label:"Mentions" },
        { value:"work", label:"Work" },
        { value:"announcements", label:"Announcements" },
      ]}
    />

    {verifiedScope&&error && <ProductNotice tone="error" title="Could not load Messages">{error}</ProductNotice>}

    {loading||!verifiedScope ? <LoadingState label="Loading Messages…" /> : <>
      {showActions && <DataPanel
        eyebrow="Work state"
        title="Needs action"
        supporting="These labels come from current Work Engine state. Opening a row does not submit, approve, return or complete the work."
        action={<StatusBadge tone={actions.length ? "warning" : "neutral"} icon={false}>{actions.length} open</StatusBadge>}
      >
        {actions.length ? actions.map((row) => {
          const presentation = actionPresentation(row);
          const context = row.action_kind === "routine_due"
            ? `Routine · Due ${formattedAt(row.action_at)} · Open the dated outcome in Work`
            : row.action_kind === "review_required"
            ? `${row.assignee_name || "Team member"} submitted · ${formattedAt(row.action_at)}`
            : `${titleCase(row.work_kind)} · ${formattedAt(row.action_at)}${row.responsible_reviewer_name ? ` · Reviewer: ${row.responsible_reviewer_name}` : ""}`;
          return <QueueRow
            key={`${row.action_kind}-${row.work_item_id}-${row.action_at}`}
            icon={presentation.icon}
            title={`${row.work_ref} · ${row.work_title}`}
            meta={context}
            status={presentation.label}
            statusTone={presentation.tone}
            onClick={() => openItem?.(row.work_item_id)}
          />;
        }) : <StatePanel state="empty" title="No work action is waiting" description="New assignments, returned work and submissions you are authorised to review will appear here." />}
      </DataPanel>}

      {me.is_admin && view === "people" && <DataPanel eyebrow="People" title="Address a person" supporting="Choose their department to address them by name in its shared room. Room participants can read the conversation.">
        {peopleDirectory.filter(person=>person.id!==me.id).flatMap(person=>(person.unit_memberships?.length?person.unit_memberships:(person.is_admin||person.is_exec)?roomDirectory.filter(room=>room.kind==="unit").map(room=>({unit_id:room.unit_id,units:room.units,role:"leadership"})):[]).filter(membership=>roomDirectory.some(room=>room.kind==="unit"&&room.unit_id===membership.unit_id)).map(membership=><QueueRow
          key={`${person.id}:${membership.unit_id}`} icon="person" title={person.full_name}
          meta={`${membership.role==="manager"?"Department head":"Team member"} · ${membership.units?.name||"Department"} · Shared room`}
          onClick={()=>openRoom?.({kind:"unit",unitId:membership.unit_id,mentionProfileId:person.id})}/>))}
      </DataPanel>}

      {organisationRooms && view === "rooms" && <DataPanel
        eyebrow="Room directory"
        title="Organisation Rooms"
        supporting="Choose a room, then mention a person to address them in that shared conversation."
        action={<StatusBadge tone="neutral" icon={false}>{roomDirectory.length} rooms</StatusBadge>}
      >
        {roomDirectory.map((room) => <QueueRow
          key={room.id}
          icon="messages"
          title={roomName(room)}
          meta={`${room.kind === "unit" ? "Unit Room" : room.kind === "project" ? "Project Room" : "Sub-team Room"} · ${room.units?.name || "Unit"}`}
          onClick={() => openRoom?.(contextFor(room))}
        />)}
        {!roomDirectory.length && <StatePanel state="empty" title="No organisational Rooms are available" description="Rooms authorised by CEAC appear here." />}
      </DataPanel>}

      <DataPanel
        eyebrow="Updates"
        title={view === "announcements" ? "Announcements" : view === "mentions" ? "Mentions" : view === "work" ? "Work-linked messages" : view === "rooms" ? "Room activity" : "Messages and announcements"}
        supporting="Unread means not opened. It is independent of the Needs action queue and never decides linked work."
      >
        {communicationRows.length ? communicationRows.map((row) => row.type === "announcement"
          ? <QueueRow
              key={`announcement-${row.announcement.id}`}
              icon="messages"
              title={row.announcement.title}
              meta={`Announcement · ${row.announcement.profiles?.full_name || "CEAC"} · ${formattedAt(row.at)}${row.announcement.requires_acknowledgement ? " · acknowledgement may be required" : ""}`}
              status={row.unread ? "Unread" : "Read"}
              statusTone={row.unread ? "warning" : "neutral"}
              onClick={openAnnouncements}
            />
          : <QueueRow
              key={row.message.id}
              icon={row.mentioned ? "notification" : "messages"}
              title={row.message.profiles?.full_name || "CEAC member"}
              meta={`${roomName(row.message.rooms)} · ${row.message.body} · ${formattedAt(row.at)}`}
              status={row.unread ? (row.mentioned ? "Unread · Mention" : row.work ? "Unread · Linked work" : "Unread") : row.mentioned ? "Mention" : row.work ? "Linked work" : "Read"}
              statusTone={row.mentioned || row.unread ? "warning" : row.work ? "action" : "neutral"}
              onClick={() => openRoom?.(contextFor(row.message.rooms))}
            />
        ) : <StatePanel state="empty" title="Nothing is waiting in this view" description="Rooms, mentions, linked work and announcements will appear here when they need your attention." />}
      </DataPanel>
    </>}
  </div>;
}
