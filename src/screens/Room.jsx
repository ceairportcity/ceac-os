import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { supabase } from "../lib/supabase";
import VoiceInput from "../components/VoiceInput";
import { OperationalMediaList, PendingFilePicker } from "../components/OperationalFiles";
import { listOperationalFilesForContexts, uploadOperationalFiles } from "../lib/operationalFiles";
import { humanError } from "../lib/productLanguage";

function timeLabel(value) {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const key = date.toDateString();
  if (key === today.toDateString()) return "Today";
  if (key === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function roomTitle(room) {
  if (!room) return "Room";
  if (room.kind === "project") return room.projects?.name || "Project";
  if (room.kind === "sub_team") return room.sub_teams?.name || "Sub-team";
  return room.units?.name || "Unit";
}

function roomLabel(room) {
  if (room?.kind === "project") return "Project Room";
  if (room?.kind === "sub_team") return "Sub-team Room";
  return "Unit Room";
}

function uniqueById(rows) {
  const byId = new Map();
  rows.filter(Boolean).forEach((row) => row.id && byId.set(row.id, row));
  return [...byId.values()].sort((a,b) => a.full_name.localeCompare(b.full_name));
}

export default function Room({
  me,
  context,
  back,
  openItem,
  openProject,
  scheduleMeeting,
  openAnnouncements,
  onRoomChange,
  startWorkFromMessage,
}) {
  const reduceMotion = useReducedMotion();
  const [room, setRoom] = useState(null);
  const [scopeRooms, setScopeRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [selectedRefs, setSelectedRefs] = useState(() => context?.reference ? [context.reference] : []);
  const [workOptions, setWorkOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);
  const [panel, setPanel] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [canAnnounce, setCanAnnounce] = useState(Boolean(me.is_admin || me.is_exec));
  const [lastReadAt, setLastReadAt] = useState(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState("offline");
  const endRef = useRef(null);
  const unreadRef = useRef(null);
  const feedRef = useRef(null);
  const atBottomRef = useRef(true);
  const sendingRef = useRef(false);
  const roomOpenSerial = useRef(0);
  const contactApplied = useRef("");
  const activeRoomIdRef = useRef(null);
  const messageLoadSerial = useRef(0);
  const PAGE_SIZE = 60;

  const canCoordinate = Boolean(me.is_admin || me.is_exec || me.role === "manager");

  useEffect(() => {
    const target = context?.mentionProfileId;
    const key = `${room?.id || ""}:${target || ""}`;
    if (!(me.is_exec || me.is_admin) || !room?.id || !target || contactApplied.current === key) return;
    const person = participants.find(row => row.id === target);
    if (!person) return;
    // A URL is only an intent. Authorised room participants supply the name
    // and mention identity; opening this composer never sends a message.
    contactApplied.current = key;
    setBody(current => current.trim() ? current : `@${person.full_name} `);
    setMentions(current => current.includes(person.id) ? current : [...current,person.id]);
  }, [room?.id,context?.mentionProfileId,participants,me.is_exec,me.is_admin]);

  useEffect(() => { loadInitialRoom(); }, [context?.kind, context?.unitId, context?.subTeamId, context?.projectId]);
  useEffect(() => {
    if (me.is_admin || me.is_exec) { setCanAnnounce(true); return; }
    supabase.from("capabilities").select("id").eq("profile_id", me.id).eq("capability", "post_announcement").maybeSingle()
      .then(({ data, error: capabilityError }) => {
        if (!capabilityError) setCanAnnounce(Boolean(data));
      });
  }, [me.id, me.is_admin, me.is_exec]);

  useEffect(() => {
    if (!room?.id) { setRealtimeStatus("offline"); return undefined; }
    let active = true;
    setRealtimeStatus("connecting");
    const channel = supabase.channel(`ceac-room-${room.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}`,
      }, async () => {
        const loaded = await loadMessages(room.id, false);
        if (loaded && activeRoomIdRef.current === room.id && atBottomRef.current) {
          requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end" }));
          await markRead(room.id);
        } else {
          setNewMessageCount((count) => count + 1);
        }
      })
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") setRealtimeStatus("connected");
        else if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT")
          setRealtimeStatus("offline");
        else setRealtimeStatus("connecting");
      });
    return () => { active = false; setRealtimeStatus("offline"); supabase.removeChannel(channel); };
  }, [room?.id]);

  useEffect(() => {
    if (loading || !room?.id || error || activeRoomIdRef.current !== room.id) return;
    requestAnimationFrame(() => {
      if (unreadRef.current) unreadRef.current.scrollIntoView({ block: "center" });
      else endRef.current?.scrollIntoView({ block: "end" });
      atBottomRef.current = true;
      markRead(room.id);
    });
  }, [loading, room?.id]);

  async function roomQueryForContext() {
    let query = supabase.from("rooms")
      .select("id,kind,unit_id,sub_team_id,project_id,created_at,units(name),sub_teams(name,unit_id),projects(name,status)")
      .eq("org_id", me.org_id);

    if (context?.kind === "project") return query.eq("kind", "project").eq("project_id", context.projectId).maybeSingle();
    if (context?.kind === "sub_team") return query.eq("kind", "sub_team").eq("sub_team_id", context.subTeamId).maybeSingle();
    return query.eq("kind", "unit").eq("unit_id", context?.unitId || me.unit_id).maybeSingle();
  }

  async function loadInitialRoom() {
    const openSerial = ++roomOpenSerial.current;
    activeRoomIdRef.current = null;
    ++messageLoadSerial.current;
    setLoading(true); setError(null); setRoom(null); setMessages([]); setLastReadAt(null); setHasOlder(false); setNewMessageCount(0);
    try {
      const result = await roomQueryForContext();
      if (openSerial !== roomOpenSerial.current) return;
      if (result.error) throw result.error;
      if (!result.data) throw new Error("This Room is not available to your account.");
      await selectRoom(result.data, true);
    } catch (err) {
      if (openSerial !== roomOpenSerial.current) return;
      setError(humanError(err, "This Room could not be opened."));
      setLoading(false);
    }
  }

  async function selectRoom(nextRoom, initial = false) {
    const openSerial = roomOpenSerial.current;
    activeRoomIdRef.current = nextRoom.id;
    // Clear prior-room identities/references before any asynchronous read.
    setParticipants([]); setScopeRooms([]); setWorkOptions([]); setProjectOptions([]);
    setRoom(nextRoom);
    setPanel(null);
    setPendingFiles([]);
    setReplyTo(null);
    setMentions([]);
    setMentionQuery(null);
    setNewMessageCount(0);
    if (!initial) setSelectedRefs([]);
    const readResult = await supabase.from("room_reads")
      .select("last_read_at")
      .eq("room_id", nextRoom.id)
      .eq("profile_id", me.id)
      .maybeSingle();
    if (openSerial !== roomOpenSerial.current || activeRoomIdRef.current !== nextRoom.id) return;
    setLastReadAt(readResult.error ? null : readResult.data?.last_read_at || null);
    await Promise.all([
      loadMessages(nextRoom.id, true),
      loadParticipants(nextRoom, openSerial),
      loadScopeRooms(nextRoom, openSerial),
      loadReferenceOptions(nextRoom, openSerial),
    ]);
  }

  async function loadScopeRooms(currentRoom, openSerial) {
    const current = () => openSerial === roomOpenSerial.current && activeRoomIdRef.current === currentRoom.id;
    if (!currentRoom?.unit_id || currentRoom.kind === "project") {
      setScopeRooms([]);
      return;
    }
    const result = await supabase.from("rooms")
      .select("id,kind,unit_id,sub_team_id,project_id,created_at,units(name),sub_teams(name,unit_id),projects(name,status)")
      .eq("unit_id", currentRoom.unit_id)
      .in("kind", ["unit","sub_team"]);
    if (!current()) return;
    if (result.error) { setScopeRooms([]); return; }
    setScopeRooms((result.data || []).sort((a,b) => {
      if (a.kind === "unit") return -1;
      if (b.kind === "unit") return 1;
      return roomTitle(a).localeCompare(roomTitle(b));
    }));
  }

  async function loadParticipants(currentRoom, openSerial) {
    const current = () => openSerial === roomOpenSerial.current && activeRoomIdRef.current === currentRoom.id;
    try {
      let profileIds = [];

      if (currentRoom.kind === "sub_team") {
        const [membersResult, teamResult, managersResult] = await Promise.all([
          supabase.from("sub_team_members")
            .select("profile_id")
            .eq("sub_team_id", currentRoom.sub_team_id),
          supabase.from("sub_teams")
            .select("lead_id")
            .eq("id", currentRoom.sub_team_id).single(),
          supabase.from("unit_memberships")
            .select("profile_id")
            .eq("unit_id", currentRoom.unit_id).eq("role", "manager"),
        ]);
        if (membersResult.error) throw membersResult.error;
        if (teamResult.error) throw teamResult.error;
        if (managersResult.error) throw managersResult.error;

        profileIds = [
          ...(membersResult.data || []).map((row) => row.profile_id),
          teamResult.data?.lead_id,
          ...(managersResult.data || []).map((row) => row.profile_id),
        ].filter(Boolean);
      } else {
        let unitIds = [];
        if (currentRoom.kind === "unit") unitIds = [currentRoom.unit_id];
        if (currentRoom.kind === "project") {
          const projectResult = await supabase.from("projects")
            .select("lead_unit_id,project_units(unit_id)").eq("id", currentRoom.project_id).single();
          if (projectResult.error) throw projectResult.error;
          unitIds = [...new Set([
            projectResult.data.lead_unit_id,
            ...(projectResult.data.project_units || []).map((row) => row.unit_id),
          ].filter(Boolean))];
        }
        if (!unitIds.length) { if (current()) setParticipants([]); return; }

        const memberResult = await supabase.from("unit_memberships")
          .select("profile_id")
          .in("unit_id", unitIds);
        if (memberResult.error) throw memberResult.error;
        profileIds = (memberResult.data || []).map((row) => row.profile_id);
      }

      const uniqueIds = [...new Set(profileIds)].filter((id) => id && id !== me.id);
      const profileResult = await supabase.from("profiles")
        .select("id,full_name,active")
        .eq("org_id", me.org_id).neq("id",me.id)
        .or([...(uniqueIds.length?[`id.in.(${uniqueIds.join(",")})`]:[]),"is_admin.eq.true",...(currentRoom.kind!=="project"?["is_exec.eq.true"]:[])].join(","))
        .eq("active", true);
      if (profileResult.error) throw profileResult.error;
      if (current()) setParticipants(uniqueById(profileResult.data || []));
    } catch (err) {
      if (current()) {
        console.warn("Room participants unavailable", err?.message || err);
        setParticipants([]);
      }
    }
  }

  async function loadReferenceOptions(currentRoom, openSerial) {
    const current = () => openSerial === roomOpenSerial.current && activeRoomIdRef.current === currentRoom.id;
    try {
      let workQuery = supabase.from("work_items")
        .select("id,ref,title,status,unit_id,sub_team_id,project_id")
        .neq("status","completed").order("created_at", { ascending:false }).limit(40);
      if (currentRoom.kind === "project") workQuery = workQuery.eq("project_id", currentRoom.project_id);
      else if (currentRoom.kind === "sub_team") workQuery = workQuery.eq("sub_team_id", currentRoom.sub_team_id);
      else workQuery = workQuery.eq("unit_id", currentRoom.unit_id);

      let projectQuery = supabase.from("projects")
        .select("id,name,status,lead_unit_id,project_units(unit_id)")
        .in("status",["planned","active"]).order("name");

      const [workResult, projectResult] = await Promise.all([workQuery, projectQuery]);
      if (workResult.error) throw workResult.error;
      if (projectResult.error) throw projectResult.error;
      if (!current()) return;
      setWorkOptions(workResult.data || []);

      if (currentRoom.kind === "project") setProjectOptions([]);
      else setProjectOptions((projectResult.data || []).filter((project) =>
        project.lead_unit_id === currentRoom.unit_id
        || (project.project_units || []).some((unit) => unit.unit_id === currentRoom.unit_id)
      ));
    } catch {
      if (current()) {
        setWorkOptions([]);
        setProjectOptions([]);
      }
    }
  }

  const messageSelect = "id,room_id,author_id,body,reply_to_id,created_at,profiles!room_messages_author_id_fkey(full_name),room_message_refs(id,object_type,object_id,label),room_mentions(profile_id,profiles!room_mentions_profile_id_fkey(full_name))";

  async function hydrateMessageMedia(rows = []) {
    const grouped = await listOperationalFilesForContexts("room_message", rows.map((row) => row.id));
    return rows.map((row) => ({ ...row, operational_files: grouped.get(row.id) || [] }));
  }

  async function loadMessages(roomId, showLoading = false) {
    if (!roomId || activeRoomIdRef.current !== roomId) return false;
    const requestSerial = ++messageLoadSerial.current;
    if (showLoading) setLoading(true);
    try {
      const result = await supabase.from("room_messages")
        .select(messageSelect)
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
      if (result.error) throw result.error;
      const hydrated = await hydrateMessageMedia(result.data || []);
      if (requestSerial !== messageLoadSerial.current || activeRoomIdRef.current !== roomId) return false;
      setMessages([...hydrated].reverse());
      setHasOlder((result.data || []).length === PAGE_SIZE);
      return true;
    } catch (err) {
      if (requestSerial === messageLoadSerial.current && activeRoomIdRef.current === roomId)
        setError(humanError(err, "Room messages could not be loaded."));
      return false;
    } finally {
      if (requestSerial === messageLoadSerial.current && activeRoomIdRef.current === roomId) setLoading(false);
    }
  }

  async function loadOlder() {
    if (!room?.id || !messages.length || loadingOlder || !hasOlder) return;
    setLoadingOlder(true); setError(null);
    const selectedRoomId = room.id;
    const openSerial = roomOpenSerial.current;
    const feed = feedRef.current;
    const previousHeight = feed?.scrollHeight || 0;
    try {
      const oldest = messages[0];
      const result = await supabase.from("room_messages")
        .select(messageSelect)
        .eq("room_id", room.id)
        .or(`created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
      if (result.error) throw result.error;
      const hydrated = await hydrateMessageMedia(result.data || []);
      if (openSerial !== roomOpenSerial.current || activeRoomIdRef.current !== selectedRoomId) return;
      const older = [...hydrated].reverse();
      setMessages((current) => [...older, ...current]);
      setHasOlder((result.data || []).length === PAGE_SIZE);
      requestAnimationFrame(() => {
        if (feed) feed.scrollTop += feed.scrollHeight - previousHeight;
      });
    } catch (err) {
      if (openSerial === roomOpenSerial.current && activeRoomIdRef.current === selectedRoomId)
        setError(humanError(err, "Earlier Room messages could not be loaded."));
    } finally {
      if (openSerial === roomOpenSerial.current && activeRoomIdRef.current === selectedRoomId)
        setLoadingOlder(false);
    }
  }

  async function markRead(roomId = room?.id) {
    if (!roomId || activeRoomIdRef.current !== roomId) return;
    const result = await supabase.rpc("mark_room_read", { p_room_id: roomId });
    if (!result.error && activeRoomIdRef.current === roomId) setNewMessageCount(0);
  }

  function handleFeedScroll() {
    const feed = feedRef.current;
    if (!feed) return;
    const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    atBottomRef.current = atBottom;
    if (atBottom && newMessageCount > 0) markRead();
  }

  function jumpToLatest() {
    endRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
    atBottomRef.current = true;
    markRead();
  }

  const parentById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  const mentionMatches = useMemo(() => {
    const query = String(mentionQuery || "").toLowerCase();
    if (!query) return participants.slice(0,6);
    return participants.filter((person) => person.full_name.toLowerCase().includes(query)).slice(0,6);
  }, [mentionQuery, participants]);

  function updateBody(value) {
    setBody(value);
    const match = value.match(/(?:^|\s)@([^\n@]*)$/);
    setMentionQuery(match ? match[1].trim() : null);
  }

  function chooseMention(person) {
    setBody((current) => {
      const match = current.match(/(?:^|\s)@([^\n@]*)$/);
      if (!match) return current + (current ? " " : "") + "@" + person.full_name + " ";
      const start = match.index + (match[0].startsWith(" ") ? 1 : 0);
      return current.slice(0,start) + "@" + person.full_name + " ";
    });
    setMentions((current) => current.includes(person.id) ? current : [...current, person.id]);
    setMentionQuery(null);
  }

  async function send() {
    const clean = body.trim();
    if (!clean || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true); setError(null);
    try {
      // Route transitions may invalidate the rendered room between a user's click
      // and the handler. Resolve the authorised context rather than discarding the draft.
      const matchesContext = room?.id && (
        context?.kind === "project" ? room.kind === "project" && room.project_id === context.projectId
          : context?.kind === "sub_team" ? room.kind === "sub_team" && room.sub_team_id === context.subTeamId
            : room.kind === "unit" && room.unit_id === (context?.unitId || me.unit_id)
      );
      let targetRoomId = matchesContext ? room.id : null;
      if (!targetRoomId) {
        const resolved = await roomQueryForContext();
        if (resolved.error) throw resolved.error;
        if (!resolved.data?.id) throw new Error("The Room is not ready or you do not have access.");
        targetRoomId = resolved.data.id;
      }
      const mentionIds = [...new Set(mentions)];
      const result = await supabase.rpc("send_room_message", {
        p_room_id: targetRoomId,
        p_body: clean,
        p_reply_to_id: replyTo?.id || null,
        p_refs: selectedRefs,
        p_mention_ids: mentionIds,
      });
      if (result.error) throw result.error;
      const messageId = Array.isArray(result.data) ? result.data[0] : result.data;
      if (pendingFiles.length && messageId) {
        try {
          await uploadOperationalFiles({
            files: pendingFiles,
            contextType: "room_message",
            contextId: messageId,
            relation: "room_media",
          });
        } catch (fileError) {
          setError(`Your message was sent, but ${fileError.message || "one or more files could not be attached."}`);
        }
      }
      setBody(""); setPendingFiles([]); setReplyTo(null); setMentions([]); setMentionQuery(null); setSelectedRefs([]);
      await loadMessages(targetRoomId, false);
    } catch (err) {
      setError(humanError(err, "Your message could not be sent."));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function appendVoice(text) {
    setBody((current) => current.trim() ? current.trim() + " " + text : text);
  }

  function addRef(ref) {
    setSelectedRefs((current) => current.some((row) => row.object_type === ref.object_type && row.object_id === ref.object_id)
      ? current
      : [...current, ref]);
    setPanel(null);
  }

  function openRef(ref) {
    if (ref.object_type === "work_item") openItem?.(ref.object_id);
    if (ref.object_type === "project") openProject?.(ref.object_id);
  }

  function meetingContext() {
    if (room.kind === "project") {
      return {
        scope:"project",
        projectId:room.project_id,
        title:"",
      };
    }
    return {
      scope:"unit",
      unitId:room.unit_id,
      unitName:room.units?.name,
      subTeamId:room.kind === "sub_team" ? room.sub_team_id : null,
      subTeamName:room.kind === "sub_team" ? room.sub_teams?.name : null,
      title:"",
    };
  }

  function contextForRoom(entry) {
    if (entry.kind === "project") return { kind: "project", projectId: entry.project_id };
    if (entry.kind === "sub_team") return { kind: "sub_team", subTeamId: entry.sub_team_id };
    return { kind: "unit", unitId: entry.unit_id };
  }

  let previousDay = null;
  let unreadShown = false;

  return <div className="body room-screen">
    <header className="room-head">
      <button type="button" className="room-back" aria-label="Back from Room" onClick={back}>←</button>
      <div className="room-head-copy">
        <span>{roomLabel(room)}</span>
        <h1>{roomTitle(room)}</h1>
      </div>
      <span className="room-live-status" role="status" data-state={realtimeStatus}>
        <span className="room-live-dot" aria-hidden="true" />
        {realtimeStatus === "connected" ? "Live updates" : realtimeStatus === "connecting" ? "Connecting" : "Updates offline"}
      </span>
    </header>

    {error && <div className="flag flag-brick room-error"><h4>Room could not complete that</h4>{error}<button className="btn btn-ghost btn-sm" onClick={loadInitialRoom}>Try again</button></div>}

    {scopeRooms.length > 1 && <nav className="room-scope-strip" aria-label="Unit conversations">
      {scopeRooms.map((entry) => <button key={entry.id} className={entry.id === room?.id ? "on" : ""} onClick={() => entry.id === room?.id ? null : onRoomChange?.(contextForRoom(entry))}>
        {entry.kind === "unit" ? "Everyone" : roomTitle(entry)}
      </button>)}
    </nav>}

    <div className="room-context-note">
      {room?.kind === "project"
        ? "Project coordination stays attached to the work and its record."
        : room?.kind === "sub_team"
          ? `This conversation is for ${roomTitle(room)}. The Unit Manager can coordinate here; it is not a private DM.`
          : "Operational communication for this unit. Use a sub-team conversation when the message is only for that lane."}
    </div>

    <main ref={feedRef} className="room-feed" aria-live="polite" onScroll={handleFeedScroll}>
      {loading && <div className="spin">Opening Room...</div>}
      {!loading && hasOlder && <button className="room-load-older" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? "Loading earlier messages…" : "Load earlier messages"}</button>}
      {!loading && !messages.length && !error && <div className="room-empty">
        <strong>No messages yet</strong>
        <span>Start with the work, decision or coordination that belongs in this context.</span>
      </div>}
      {!loading && messages.map((message) => {
        const currentDay = new Date(message.created_at).toDateString();
        const showDay = currentDay !== previousDay;
        previousDay = currentDay;
        const mine = message.author_id === me.id;
        const parent = message.reply_to_id ? parentById.get(message.reply_to_id) : null;
        const isUnread = !unreadShown && lastReadAt && !mine && new Date(message.created_at) > new Date(lastReadAt);
        if (isUnread) unreadShown = true;
        return <div key={message.id}>
          {isUnread && <div ref={unreadRef} className="room-unread-divider"><span>New since your last visit</span></div>}
          {showDay && <div className="room-day"><span>{dayLabel(message.created_at)}</span></div>}
          <article className={`room-message ${mine ? "mine" : ""}`}>
            <div className="room-message-meta">
              <strong>{mine ? "You" : message.profiles?.full_name || "CEAC member"}</strong>
              <time>{timeLabel(message.created_at)}</time>
            </div>
            {parent && <div className="room-reply-context">
              <strong>{parent.author_id === me.id ? "You" : parent.profiles?.full_name || "Earlier message"}</strong>
              <span>{parent.body}</span>
            </div>}
            <p>{message.body}</p>
            <OperationalMediaList files={message.operational_files || []} />
            {(message.room_mentions || []).length > 0 && <div className="room-message-mentions">
              {(message.room_mentions || []).map((mention) => <span key={mention.profile_id}>@{mention.profiles?.full_name || "CEAC member"}</span>)}
            </div>}
            {(message.room_message_refs || []).length > 0 && <div className="room-ref-list">
              {message.room_message_refs.map((ref) => <button key={ref.id} onClick={() => openRef(ref)}>
                <span>{ref.object_type.replaceAll("_", " ")}</span>
                <strong>{ref.label || "Open record"}</strong>
              </button>)}
            </div>}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="room-reply-action" onClick={() => setReplyTo(message)}>Reply</button>
              {startWorkFromMessage && !(message.room_message_refs || []).some((ref) => ref.object_type === "work_item") &&
                <button className="room-reply-action" onClick={() => startWorkFromMessage({
                  title: message.body,
                  sourceRoomId: room.id,
                  sourceMessageId: message.id,
                  unitId: room.unit_id || "",
                  projectId: room.kind === "project" ? room.project_id : "",
                  subTeamId: room.kind === "sub_team" ? room.sub_team_id : "",
                  kind: "task",
                })}>Make this a responsibility?</button>}
            </div>
          </article>
        </div>;
      })}
      <div ref={endRef} />
    </main>
    {newMessageCount > 0 && <button className="room-new-messages" onClick={jumpToLatest}>{newMessageCount} new message{newMessageCount === 1 ? "" : "s"} ↓</button>}

    <footer className="room-composer">
      {replyTo && <div className="room-composer-reply">
        <span>Replying to {replyTo.author_id === me.id ? "your message" : replyTo.profiles?.full_name || "message"}</span>
        <button onClick={() => setReplyTo(null)}>×</button>
      </div>}

      {selectedRefs.length > 0 && <div className="room-composer-context-list">
        {selectedRefs.map((ref) => <button key={ref.object_type + ref.object_id} onClick={() => setSelectedRefs((current) => current.filter((row) => !(row.object_type === ref.object_type && row.object_id === ref.object_id)))}>
          <span>{ref.object_type.replaceAll("_"," ")}</span><strong>{ref.label || "Linked record"}</strong><b>×</b>
        </button>)}
      </div>}

      {mentionQuery !== null && mentionMatches.length > 0 && <div className="room-inline-mentions">
        <div className="room-inline-label">Mention someone in this Room</div>
        {mentionMatches.map((person) => <button key={person.id} onClick={() => chooseMention(person)}>
          <span className="room-person-avatar">{person.full_name.charAt(0)}</span>
          <strong>{person.full_name}</strong>
        </button>)}
      </div>}

      {panel === "actions" && <div className="room-plus-panel">
        {scopeRooms.length > 1 && <button onClick={() => setPanel("scope")}><span>◎</span><div><strong>Choose conversation</strong><small>Everyone or a sub-team</small></div></button>}
        {workOptions.length > 0 && <button onClick={() => setPanel("work")}><span>✓</span><div><strong>Link work</strong><small>Keep the task in the conversation</small></div></button>}
        {projectOptions.length > 0 && <button onClick={() => setPanel("project")}><span>▱</span><div><strong>Link project</strong><small>Add project context</small></div></button>}
        {canCoordinate && <button onClick={() => { setPanel(null); scheduleMeeting?.(meetingContext()); }}><span>◷</span><div><strong>Schedule meeting</strong><small>Invite the right CEAC audience</small></div></button>}
        {canAnnounce && openAnnouncements && <button onClick={() => { setPanel(null); openAnnouncements(); }}><span>◉</span><div><strong>Make announcement</strong><small>Publish through the announcement system</small></div></button>}
      </div>}

      {panel === "scope" && <div className="room-picker-panel">
        <div className="room-picker-head"><strong>Choose conversation</strong><button onClick={() => setPanel("actions")}>Back</button></div>
        {scopeRooms.map((entry) => <button key={entry.id} className={entry.id === room?.id ? "on" : ""} onClick={() => entry.id === room?.id ? null : onRoomChange?.(contextForRoom(entry))}>
          <span>{entry.kind === "unit" ? "Everyone in " + roomTitle(entry) : roomTitle(entry)}</span><b>{entry.id === room?.id ? "✓" : "→"}</b>
        </button>)}
      </div>}

      {panel === "work" && <div className="room-picker-panel">
        <div className="room-picker-head"><strong>Link work</strong><button onClick={() => setPanel("actions")}>Back</button></div>
        {workOptions.slice(0,12).map((item) => <button key={item.id} onClick={() => addRef({object_type:"work_item",object_id:item.id,label:`${item.ref} · ${item.title}`})}>
          <span><small>{item.ref}</small>{item.title}</span><b>+</b>
        </button>)}
      </div>}

      {panel === "project" && <div className="room-picker-panel">
        <div className="room-picker-head"><strong>Link project</strong><button onClick={() => setPanel("actions")}>Back</button></div>
        {projectOptions.slice(0,12).map((project) => <button key={project.id} onClick={() => addRef({object_type:"project",object_id:project.id,label:project.name})}>
          <span>{project.name}</span><b>+</b>
        </button>)}
      </div>}

      <PendingFilePicker
        files={pendingFiles}
        onChange={setPendingFiles}
        label="Attach media or file"
        disabled={sending}
      />

      <div className="room-composer-row room-composer-v2">
        <button type="button" className={"room-plus " + (panel ? "on" : "")}
          aria-label={panel ? "Close Room actions" : "Add context or action"}
          aria-expanded={Boolean(panel)} onClick={() => setPanel((current) => current ? null : "actions")}>
          {panel ? "×" : "+"}</button>
        <div className="room-text-wrap">
          <textarea
            rows={1}
            value={body}
            maxLength={8000}
            aria-label="Room message"
            placeholder={room?.kind === "project" ? "Message the project team" : room?.kind === "sub_team" ? `Message ${roomTitle(room)}` : "Message your unit"}
            onChange={(event) => updateBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault(); send();
              }
            }}
          />
          <VoiceInput compact label="Speak message" onResult={appendVoice} />
        </div>
        <button className="room-send" disabled={sending || loading || !room?.id || !body.trim()} onClick={send}>{sending ? "…" : "Send"}</button>
      </div>
      <small>Work communication only · @ mentions notify people inside this Room</small>
    </footer>
  </div>;
}
