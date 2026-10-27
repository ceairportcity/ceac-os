import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { statusPill, ProductNotice, Avatar } from "../components/bits";
import VoiceInput from "../components/VoiceInput";
import { humanError } from "../lib/productLanguage";

function whenLabel(value) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function providerLabel(meeting) {
  if (meeting?.provider === "zoom") return "Zoom";
  if (/^https:\/\/meet\.google\.com\//i.test(meeting?.join_url || "")) return "Google Meet";
  return "Other meeting link";
}

export default function Meeting(props) {
  return <MeetingDetail key={`${props.me.org_id}:${props.me.id}:${props.meetingId}`} {...props} />;
}

function MeetingDetail({ me, meetingId, back, goAssign, openItem, openProject, openRoom }) {
  const [meeting, setMeeting] = useState(null);
  const [records, setRecords] = useState([]);
  const [links, setLinks] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [privateNote, setPrivateNote] = useState("");
  const [decision, setDecision] = useState("");
  const [agendaDraft, setAgendaDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [meetingId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [meetingResult, recordResult, linkResult, participantResult, privateNoteResult] = await Promise.all([
        supabase.from("meeting_sessions")
          .select("id,org_id,scope,unit_id,project_id,title,agenda,starts_at,ends_at,provider,provider_meeting_id,join_url,location,status,created_by,units(name),projects(name,lead_unit_id,project_units(unit_id))")
          .eq("id", meetingId).single(),
        supabase.from("meeting_records")
          .select("id,kind,body,author_id,created_at,profiles!meeting_records_author_id_fkey(full_name)")
          .eq("meeting_id", meetingId).order("created_at", { ascending: true }),
        supabase.from("meeting_work_links")
          .select("meeting_id,work_item_id,relation,linked_at,work_items(id,ref,title,status,due_at,project_id)")
          .eq("meeting_id", meetingId).order("linked_at", { ascending: false }),
        supabase.from("meeting_participants")
          .select("profile_id,role,source_type,profiles!meeting_participants_profile_id_fkey(full_name)")
          .eq("meeting_id", meetingId).order("created_at", { ascending: true }),
        supabase.from("meeting_private_notes")
          .select("body,updated_at")
          .eq("meeting_id", meetingId).eq("author_id", me.id).maybeSingle(),
      ]);
      if (meetingResult.error) throw meetingResult.error;
      if (recordResult.error) throw recordResult.error;
      if (linkResult.error) throw linkResult.error;
      if (participantResult.error) throw participantResult.error;
      if (privateNoteResult.error) throw privateNoteResult.error;
      setMeeting(meetingResult.data);
      setAgendaDraft(meetingResult.data?.agenda || "");
      setRecords(recordResult.data || []);
      setLinks(linkResult.data || []);
      setParticipants(participantResult.data || []);
      setPrivateNote(privateNoteResult.data?.body || "");
    } catch (err) {
      setError(humanError(err, "Meeting could not be opened."));
    } finally {
      setLoading(false);
    }
  }

  const myParticipant = participants.find((row) => row.profile_id === me.id);
  // Viewing a meeting through a leadership role does not make that person
  // its author. The creator and explicitly recorded organisers prepare it.
  const canManage = Boolean(meeting && (meeting.created_by === me.id || myParticipant?.role === "organiser"));
  const canContribute = Boolean(myParticipant);
  const decisions = records.filter((row) => row.kind === "decision");
  const meetingStarted = Boolean(meeting && Date.now() >= new Date(meeting.starts_at).getTime());
  const meetingEnded = Boolean(meeting?.ends_at && Date.now() > new Date(meeting.ends_at).getTime());

  async function savePrivateNote() {
    if (!meeting || !canContribute || !meetingStarted) return;
    setBusy(true); setError(null);
    try {
      const result = await supabase.from("meeting_private_notes").upsert({
        meeting_id: meeting.id,
        org_id: me.org_id,
        author_id: me.id,
        body: privateNote,
        updated_at: new Date().toISOString(),
      }, { onConflict:"meeting_id,author_id" });
      if (result.error) throw result.error;
    } catch (err) {
      setError(humanError(err, "Your private meeting notes could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function addDecision() {
    const clean = decision.trim();
    if (!clean || !meeting || !meetingStarted || !canManage) return;
    setBusy(true); setError(null);
    try {
      const result = await supabase.from("meeting_records").insert({
        meeting_id: meeting.id,
        org_id: me.org_id,
        kind: "decision",
        body: clean,
        author_id: me.id,
      });
      if (result.error) throw result.error;
      setDecision("");
      await load();
    } catch (err) {
      setError(humanError(err, "The shared decision could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function saveAgenda() {
    if (!meeting || !canManage || meetingStarted) return;
    setBusy(true); setError(null);
    try {
      const result = await supabase.from("meeting_sessions").update({ agenda: agendaDraft.trim() || null }).eq("id",meeting.id);
      if (result.error) throw result.error;
      await load();
    } catch (err) {
      setError(humanError(err, "The agenda could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  function createAction(kind = "task") {
    goAssign?.({
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      meetingOn: String(meeting.starts_at).slice(0, 10),
      meetingNote: "From " + meeting.title,
      projectId: meeting.project_id || "",
      kind,
    });
  }

  if (loading) return <div className="body meeting-screen"><div className="spin">Opening meeting...</div></div>;

  if (!meeting) return <div className="body meeting-screen">
    <button className="back" onClick={back}>← Back</button>
    <div className="flag flag-brick"><h4>Meeting unavailable</h4>{error || "This meeting is not available to your account."}</div>
  </div>;

  const context = meeting.scope === "project"
    ? meeting.projects?.name || "Project meeting"
    : meeting.scope === "unit"
      ? meeting.units?.name || "Unit meeting"
      : "Organisation meeting";

  return <div className="body meeting-screen">
    <button className="back meeting-back" onClick={back}>← Back</button>

    <header className="meeting-hero">
      <div className="eyebrow">{context}</div>
      <h1>{meeting.title}</h1>
      <div className="meeting-time">{whenLabel(meeting.starts_at)}{meeting.ends_at ? ` → ${whenLabel(meeting.ends_at)}` : ""}</div>
      <div className="meeting-status-row">
        {statusPill(meeting.status)}
        <span>{providerLabel(meeting)}</span>
      </div>
      {meeting.location && <div className="meeting-location">{meeting.location}</div>}
      {meeting.join_url && meeting.status !== "cancelled" && <a className="meeting-join" href={meeting.join_url} target="_blank" rel="noreferrer">
        Join {providerLabel(meeting)} <span aria-hidden="true">↗</span>
      </a>}
      {openRoom && meeting.scope !== "organisation" && <button className="btn btn-ghost btn-sm" onClick={() => openRoom(meeting.scope === "project"
        ? { kind:"project", projectId:meeting.project_id }
        : { kind:"unit", unitId:meeting.unit_id })}>
        Open meeting discussion
      </button>}
    </header>

    {error && <div className="flag flag-brick"><h4>Could not complete that</h4>{error}</div>}

    <section className="meeting-panel">
      <div className="meeting-section-head"><div><span>Before</span><h2>Agenda</h2></div><small>{meetingStarted ? "Meeting started" : "Preparation"}</small></div>
      {!meetingStarted && canManage
        ? <div className="meeting-agenda-editor">
            <textarea rows={4} value={agendaDraft} onChange={(event) => setAgendaDraft(event.target.value)} placeholder="What should this meeting cover?" />
            <button className="btn btn-sm" disabled={busy} onClick={saveAgenda}>{busy ? "Saving…" : "Save agenda"}</button>
          </div>
        : meeting.agenda ? <p className="meeting-agenda">{meeting.agenda}</p> : <div className="quiet-empty compact"><strong>No agenda recorded</strong><span>No shared agenda is on the record.</span></div>}
      {participants.length > 0 && <div className="meeting-participant-summary">
        <span>{participants.length === 1 && participants[0].profile_id === me.id ? "You are invited" : `${participants.length} participant${participants.length === 1 ? "" : "s"}`}</span>
        {participants.length > 1 && <div>{participants.slice(0,8).map((participant) => <b key={participant.profile_id}>{participant.profiles?.full_name || "CEAC member"}</b>)}</div>}
      </div>}
    </section>

    <section className="meeting-panel">
      <div className="meeting-section-head">
        <div><span>During</span><h2>Meeting workspace</h2></div>
        <small>{meetingStarted ? (meetingEnded ? "Meeting time has passed" : "In session") : "Opens at the scheduled start"}</small>
      </div>

      {!meetingStarted && <ProductNotice tone="info" title="Notes open when the meeting starts">Before the start time, the shared agenda is the meeting's writable preparation space. Personal notes and shared decisions remain closed.</ProductNotice>}

      {meetingStarted && canContribute && <div className="meeting-private-notes">
        <div className="meeting-private-note-head">
          <div><strong>My notes</strong><span>Only you can read these notes.</span></div>
          <span className="pill p-grey">Private</span>
        </div>
        <div className="assistive-field textarea">
          <textarea rows={7} value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} placeholder="Write your own notes from this meeting…" />
          <VoiceInput compact label="Speak private note" onResult={(text) => setPrivateNote((current) => current ? current + " " + text : text)} />
        </div>
        <button className="btn btn-sm" disabled={busy} onClick={savePrivateNote}>{busy ? "Saving…" : "Save my notes"}</button>
      </div>}

      {meetingStarted && <div className="meeting-shared-decisions">
        <div className="meeting-section-subhead"><div><strong>Shared decisions</strong><span>Visible to invited participants.</span></div><b>{decisions.length}</b></div>
        {decisions.length === 0 && <div className="quiet-empty compact"><strong>No shared decision recorded</strong><span>Use this only for decisions that belong on the organisation record.</span></div>}
        {decisions.map((row) => <article className="meeting-record meeting-record-decision" key={row.id}>
          <div className="meeting-record-meta">
            <strong>Decision</strong>
            <span>{row.profiles?.full_name || "CEAC member"} · {new Date(row.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span>
          </div>
          <p>{row.body}</p>
        </article>)}
        {canManage && <div className="meeting-record-form">
          <div className="assistive-field textarea">
            <textarea rows={3} value={decision} onChange={(event) => setDecision(event.target.value)} placeholder="Record the decision exactly as agreed" />
            <VoiceInput compact label="Speak decision" onResult={(text) => setDecision((current) => current ? current + " " + text : text)} />
          </div>
          <button className="btn" disabled={busy || !decision.trim()} onClick={addDecision}>{busy ? "Saving…" : "Record shared decision"}</button>
        </div>}
      </div>}
    </section>

    <section className="meeting-panel">
      <div className="meeting-section-head">
        <div><span>After</span><h2>Actions & outcomes</h2></div>
        <small>{links.length} linked</small>
      </div>
      {links.map((link) => <button className="meeting-work-row" key={link.work_item_id} onClick={() => openItem?.(link.work_item_id)}>
        <span><strong>{link.work_items?.title || "Work item"}</strong><small>{link.work_items?.ref} · {link.relation.replaceAll("_"," ")}</small></span>
        {link.work_items && statusPill(link.work_items.status)}
      </button>)}
      {links.length === 0 && <div className="quiet-empty compact"><strong>No actions linked yet</strong><span>Turn agreed actions into real CEAC work instead of leaving them buried in notes.</span></div>}
      {meetingStarted && canManage && <div className="meeting-action-buttons">
        <button className="btn" onClick={() => createAction("task")}>Create action</button>
        <button className="btn btn-ghost" onClick={() => createAction("meeting_outcome")}>Record meeting outcome</button>
      </div>}
    </section>

    {meeting.project_id && openProject && <button className="meeting-project-link" onClick={() => openProject(meeting.project_id)}>Open project →</button>}

    <div className="meeting-provider-note">
      <strong>Meeting provider boundary</strong>
      <span>CEAC stores the operational record. Video transport remains with {providerLabel(meeting)}. A pasted link is not presented as a CEAC-created provider integration.</span>
    </div>
  </div>;
}
