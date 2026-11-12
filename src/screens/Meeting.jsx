import { useEditorPosition } from "../lib/useEditorPosition";
import { useWorkFormDraft } from "../lib/useWorkFormDraft";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { statusPill } from "../components/bits";
import "../components/MeetingPlanning.css";
import { downloadMeetingCalendar } from "../lib/calendarExport";
import { CeacIcon } from "../experience-v2/icons";
import VoiceInput from "../components/VoiceInput";
import { humanError } from "../lib/productLanguage";

function whenLabel(value, timeOnly = false) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    ...(!timeOnly && { weekday: "short", day: "numeric", month: "short" }),
    hour: "2-digit", minute: "2-digit",
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

function MeetingDetail({ me, meetingId, back, goAssign, openItem, openProject, embedded = false }) {
  const [section, setSection] = useEditorPosition(me, "meeting-view:" + meetingId, null);
  const [, refreshStatus] = useState(0);
  const [meeting, setMeeting] = useState(null);
  const [records, setRecords] = useState([]);
  const [links, setLinks] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [responses,setResponses]=useState([]);
  const [responsesReady,setResponsesReady]=useState(false);
  const [notice,setNotice]=useState("");
  const [editingDetails,setEditingDetails]=useEditorPosition(me,`meeting-details:${meetingId}`,false);
  const [detailsEdit,setDetailsDraft]=useState(null);
  const detailsDraft = detailsEdit ?? (meeting && {
    title:meeting.title,starts:meeting.starts_at.slice(0,16),
    ends:(meeting.ends_at||"").slice(0,16),location:meeting.location||"",
  });
  const [savedPrivateNote, setSavedPrivateNote] = useState("");
  const [noteEdit, setPrivateNote] = useState(null);
  const privateNote = noteEdit ?? savedPrivateNote;
  const [noteSaveState, setNoteSaveState] = useState("");
  const noteWriteQueue = useRef(Promise.resolve());
  const latestNote = useRef(null);
  const noteUserEdited = useRef(false);
  latestNote.current = noteEdit;
  const [decision, setDecision] = useState("");
  const [agendaEdit, setAgendaDraft] = useState(null);
  const agendaDraft = agendaEdit ?? meeting?.agenda ?? "";
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [meetingId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [meetingResult, recordResult, linkResult, participantResult, privateNoteResult] = await Promise.all([
        supabase.from("meeting_sessions")
          .select("id,org_id,scope,unit_id,project_id,title,agenda,starts_at,ends_at,provider,provider_meeting_id,join_url,location,status,created_by,updated_at,units(name),projects(name,lead_unit_id,project_units(unit_id))")
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
      const responseResult=await supabase.from("meeting_responses").select("profile_id,response,meeting_starts_at,meeting_ends_at").eq("meeting_id",meetingId);
      if(responseResult.error&&!["42P01","PGRST205"].includes(responseResult.error.code))throw responseResult.error;
      setResponsesReady(!responseResult.error);setResponses(responseResult.data||[]);
      setMeeting(meetingResult.data);
      setRecords(recordResult.data || []);
      setLinks(linkResult.data || []);
      setParticipants(participantResult.data || []);
      setSavedPrivateNote(privateNoteResult.data?.body || "");
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
  const startsAt = Date.parse(meeting?.starts_at);
  // Accra uses GMT year-round. Without an end time, treat earlier dates as past.
  const dayMs = 24 * 60 * 60 * 1000;
  const endsAt = meeting?.ends_at ? Date.parse(meeting.ends_at) : (Math.floor(startsAt / dayMs) + 1) * dayMs;
  const cancelled = meeting?.status === "cancelled";
  const clock = Date.now();
  const meetingStarted = clock >= startsAt || meeting?.status === "completed";
  const meetingEnded = meeting?.status === "completed" || clock >= endsAt;
  const upcoming = Boolean(meeting && !cancelled && !meetingStarted);
  const canRespond = upcoming && canContribute && !canManage && responsesReady;
  const canRecord = canManage && clock >= startsAt && !cancelled;

  useEffect(() => {
    const current = Date.now();
    const boundary = [startsAt, endsAt].filter(time => time > current).sort((a, b) => a - b)[0];
    if (!boundary) return;
    let timer;
    function refreshAtBoundary() {
      const remaining = boundary - Date.now();
      if (remaining <= 0) refreshStatus(version => version + 1);
      else timer = setTimeout(refreshAtBoundary, Math.min(remaining, 2147483647));
    }
    refreshAtBoundary();
    return () => clearTimeout(timer);
  }, [startsAt, endsAt, meetingStarted, meetingEnded]);

  const noteRecovery = useWorkFormDraft(me, canContribute && meeting.status !== "cancelled" ? `meeting-note:${meetingId}` : "",
    {noteEdit}, saved => setPrivateNote(typeof saved.noteEdit === "string" && saved.noteEdit.trim() ? saved.noteEdit : null));
  const agendaRecovery = useWorkFormDraft(me, canManage && upcoming ? `meeting-agenda:${meetingId}:${meeting.updated_at || ""}` : "",
    {agendaEdit}, saved => setAgendaDraft(saved.agendaEdit));
  const decisionRecovery = useWorkFormDraft(me, canRecord ? `meeting-decision:${meetingId}` : "",
    {decision}, saved => setDecision(saved.decision));

  const detailsRecovery = useWorkFormDraft(me, editingDetails && canManage && upcoming
    ? `meeting-edit:${meetingId}:${meeting.updated_at || ""}` : "", {detailsEdit},
    saved => setDetailsDraft(saved.detailsEdit));
  const responseCurrent=row=>row&&new Date(row.meeting_starts_at).getTime()===new Date(meeting.starts_at).getTime()&&(row.meeting_ends_at?new Date(row.meeting_ends_at).getTime():null)===(meeting.ends_at?new Date(meeting.ends_at).getTime():null);
  function editDetails(){setDetailsDraft(null);setEditingDetails(true);}
  async function saveDetails(){
    if(!canManage||!upcoming||Date.now()>=startsAt||!detailsRecovery.ready||busy||!detailsDraft.title?.trim()||!detailsDraft.starts||detailsDraft.ends&&detailsDraft.ends<=detailsDraft.starts)return;
    setBusy(true);setError(null);setNotice("");
    try{
      let write=supabase.from("meeting_sessions").update({title:detailsDraft.title.trim(),starts_at:new Date(`${detailsDraft.starts}:00Z`).toISOString(),ends_at:detailsDraft.ends?new Date(`${detailsDraft.ends}:00Z`).toISOString():null,location:detailsDraft.location.trim()||null,updated_by:me.id,updated_at:new Date().toISOString()}).eq("id",meeting.id).eq("starts_at",meeting.starts_at).eq("status","scheduled");
      write=meeting.updated_at?write.eq("updated_at",meeting.updated_at):write.is("updated_at",null);
      const result=await write.select("id,title,starts_at,ends_at,location,status,updated_at").single();
      if(result.error)throw result.error;
      setMeeting(current=>({...current,...result.data}));void detailsRecovery.clear({detailsEdit:null});setDetailsDraft(null);setEditingDetails(false);setNotice("Meeting updated. Participants will receive the change in CEAC OS.");
    }catch(err){setError(humanError(err,"The meeting could not be updated. It may have changed since you opened it."));}finally{setBusy(false);}
  }

  async function respond(response){
    if (!canRespond || busy || Date.now() >= startsAt) return;
    setBusy(true);setError(null);setNotice("");
    try{
      const result=await supabase.from("meeting_responses").upsert({meeting_id:meeting.id,profile_id:me.id,org_id:me.org_id,response,updated_at:new Date().toISOString()},{onConflict:"meeting_id,profile_id"}).select("profile_id,response,meeting_starts_at,meeting_ends_at").single();
      if(result.error)throw result.error;
      setResponses(rows=>[...rows.filter(row=>row.profile_id!==me.id),result.data]);setNotice("Your response has been saved.");
    }catch(err){setError(humanError(err,"Your response could not be saved."));}finally{setBusy(false);}
  }

  // Serialize writes: an older autosave must never arrive after a newer draft.
  function persistPrivateNote(body) {
    const operation = noteWriteQueue.current.catch(() => {}).then(async () => {
      const result = await supabase.from("meeting_private_notes").upsert({
        meeting_id: meetingId, org_id: me.org_id, author_id: me.id,
        body, updated_at: new Date().toISOString(),
      }, { onConflict: "meeting_id,author_id" });
      if (result.error) throw result.error;
      setSavedPrivateNote(body);
    });
    noteWriteQueue.current = operation;
    return operation;
  }

  useEffect(() => {
    if (!meeting || !canContribute || meeting.status === "cancelled" ||
        !noteRecovery.ready || !noteUserEdited.current || noteEdit === null || !noteEdit.trim()) return;
    setNoteSaveState("Saving draft…");
    const timer = setTimeout(() => {
      const snapshot = noteEdit;
      persistPrivateNote(snapshot).then(() => {
        if (latestNote.current === snapshot) setNoteSaveState("Saved automatically");
      }).catch(() => setNoteSaveState("Not saved online — draft retained on this device"));
    }, 1200);
    return () => clearTimeout(timer);
  }, [noteEdit, meeting?.id, noteRecovery.ready, canContribute]);

  async function savePrivateNote() {
    if (!meeting || !canContribute || meeting.status === "cancelled" || !noteRecovery.ready) return;
    // Empty saves are never allowed to destroy previously written meeting notes.
    if (!privateNote.trim()) {
      // An empty local draft must not mask a non-empty saved server note on reopen.
      await noteRecovery.clear({ noteEdit: null });
      setPrivateNote(null);
      noteUserEdited.current = false;
      setNoteSaveState("");
      setNotice("Nothing to save. Your existing notes are unchanged.");
      return;
    }
    setBusy(true); setError(null);
    const snapshot = privateNote;
    try {
      await persistPrivateNote(snapshot);
      if (latestNote.current === snapshot) {
        await noteRecovery.clear({ noteEdit: null });
        setPrivateNote(null);
        noteUserEdited.current = false;
      }
      setNoteSaveState("Saved");
      setNotice("Your private notes have been saved.");
    } catch (err) {
      setNoteSaveState("Not saved online — draft retained on this device");
      setError(humanError(err, "Your private meeting notes could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function addDecision() {
    const clean = decision.trim();
    if (!clean || !canRecord || busy) return;
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
      void decisionRecovery.clear({decision:""});
      setDecision("");
      await load();
    } catch (err) {
      setError(humanError(err, "The shared decision could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function saveAgenda() {
    if (!upcoming || !canManage || Date.now() >= startsAt || !agendaRecovery.ready || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await supabase.from("meeting_sessions").update({ agenda: agendaDraft.trim() || null }).eq("id",meeting.id);
      if (result.error) throw result.error;
      void agendaRecovery.clear({agendaEdit:null});
      await load();setAgendaDraft(null);
    } catch (err) {
      setError(humanError(err, "The agenda could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  function createAction() {
    if (!canRecord || !goAssign) return;
    goAssign({
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      meetingOn: String(meeting.starts_at).slice(0, 10),
      meetingNote: "From " + meeting.title,
      projectId: meeting.project_id || "",
      unitId: meeting.unit_id || me.unit_id,
      kind: "meeting_outcome",
    });
  }

  if (loading) return <div className="meeting-screen"><div className="spin">Opening meeting...</div></div>;

  if (!meeting) return <div className="meeting-screen">
    <button className="back meeting-back" data-embedded={embedded || undefined} onClick={back}>← {embedded ? "Meetings" : "Back"}</button>
    <div className="flag flag-brick"><h4>Meeting unavailable</h4>{error || "This meeting is not available to your account."}</div>
  </div>;

  const context = meeting.scope === "project"
    ? meeting.projects?.name || "Project meeting"
    : meeting.scope === "unit"
      ? meeting.units?.name || "Unit meeting"
      : "Organisation meeting";

  const currentSection = section || (cancelled ? "agenda" : meetingEnded ? "recap" : meetingStarted ? "during" : "agenda");
  const myResponse = responses.find(row => row.profile_id === me.id);
  const status = cancelled ? "Cancelled" : meeting.status === "completed" ? "Completed"
    : meetingEnded ? "Past meeting" : meetingStarted ? "Start time passed" : "Upcoming";
  const organiser = participants.filter(row => row.role === "organiser" || row.profile_id === meeting.created_by)
    .map(row => row.profiles?.full_name).filter(Boolean).join(", ") || (canManage ? me.full_name : "");
  return <div className="meeting-screen">
    <button className="back meeting-back" data-embedded={embedded || undefined} onClick={back}>← {embedded ? "Meetings" : "Back"}</button>

    <header className="meeting-hero">
      <div className="meeting-context"><span>{context}</span><span>{status}</span></div>
      <h1>{meeting.title}</h1>
      <p className="meeting-time"><time dateTime={meeting.starts_at}>{whenLabel(meeting.starts_at)}</time>{meeting.ends_at && <> – <time dateTime={meeting.ends_at}>{whenLabel(meeting.ends_at, new Date(startsAt).toISOString().slice(0, 10) === new Date(endsAt).toISOString().slice(0, 10))}</time></>} GMT</p>
      {((upcoming && canManage && !editingDetails) || (meeting.join_url && !cancelled && !meetingEnded)) && <div className="meeting-toolbar">
        {meeting.join_url && !cancelled && !meetingEnded && <a className="btn btn-sm" href={meeting.join_url} target="_blank" rel="noreferrer">Join {providerLabel(meeting)} ↗</a>}
        {upcoming && canManage && !editingDetails && <button type="button" className="btn btn-ghost btn-sm" onClick={editDetails}>Edit meeting</button>}
      </div>}
      {canRespond && <div className="meeting-invitation">
        <strong>{myResponse && !responseCurrent(myResponse) ? "The time changed. Please respond again." : "Will you attend?"}</strong>
        <div className="meeting-response" role="group" aria-label="Your invitation response">
          {[["accepted", "Accept"], ["tentative", "Maybe"], ["declined", "Decline"]].map(([value, label]) => <button
            type="button" key={value} className="btn btn-ghost btn-sm"
            aria-pressed={responseCurrent(myResponse) && myResponse.response === value}
            disabled={busy} onClick={() => respond(value)}>{label}</button>)}
        </div>
      </div>}
      {editingDetails&&canManage&&upcoming&&detailsRecovery.ready&&<div className="meeting-details-editor"><label>Title<input className="field" value={detailsDraft.title} maxLength={220} onChange={e=>setDetailsDraft(d=>({...(d??detailsDraft),title:e.target.value}))}/></label><label>Starts · Accra time<input className="field" type="datetime-local" value={detailsDraft.starts} onChange={e=>setDetailsDraft(d=>({...(d??detailsDraft),starts:e.target.value}))}/></label><label>Ends · Accra time<input className="field" type="datetime-local" value={detailsDraft.ends} onChange={e=>setDetailsDraft(d=>({...(d??detailsDraft),ends:e.target.value}))}/></label><label>Location<input className="field" value={detailsDraft.location} onChange={e=>setDetailsDraft(d=>({...(d??detailsDraft),location:e.target.value}))}/></label><button className="btn" disabled={busy||!detailsDraft.title?.trim()||!detailsDraft.starts||Boolean(detailsDraft.ends&&detailsDraft.ends<=detailsDraft.starts)} onClick={saveDetails}>Save changes</button><button className="btn btn-ghost" disabled={busy} onClick={()=>{void detailsRecovery.clear({detailsEdit:null});setDetailsDraft(null);setEditingDetails(false);}}>Cancel editing</button></div>}
      {notice&&<p role="status">{notice}</p>}
    </header>

    {error && <div className="flag flag-brick" role="alert"><h4>Could not complete that</h4>{error}</div>}

    <nav className="meeting-view-tabs" aria-label="Meeting views">
      {[["agenda", "Agenda"], ["during", "My notes"], ["recap", "Recap"]].map(([key, label]) =>
        <button type="button" key={key} aria-pressed={currentSection === key} onClick={() => setSection(key)}>{label}</button>)}
    </nav>
    <div className="meeting-detail-layout">
      <div className="meeting-detail-content">
        <section className="meeting-panel" hidden={currentSection !== "agenda"}>
          <h2>Agenda</h2>
          {upcoming && canManage
            ? <div className="meeting-agenda-editor">
                <textarea rows={4} aria-label="Meeting agenda" value={agendaDraft} disabled={busy || !agendaRecovery.ready} onChange={(event) => setAgendaDraft(event.target.value)} placeholder="What should this meeting cover?" />
                {agendaRecovery.notice&&<p role="status">{agendaRecovery.notice}</p>}
                <button className="btn btn-sm" disabled={busy || !agendaRecovery.ready} onClick={saveAgenda}>{busy ? "Saving…" : "Save agenda"}</button>
              </div>
            : meeting.agenda ? <p className="meeting-agenda">{meeting.agenda}</p> : <p>No agenda recorded.</p>}
        </section>

        <section className="meeting-panel" hidden={currentSection !== "during"}>
          <h2>My notes</h2>
          {(!canContribute || cancelled) && <p className="meeting-agenda">{savedPrivateNote || "No private notes available."}</p>}
          {canContribute && meeting.status!=="cancelled" && <div className="meeting-private-notes">
            <div className="meeting-private-note-head">
              <span>Only you can read these notes.</span>
            </div>
            <div className="assistive-field textarea">
              <textarea rows={7} aria-label="Private meeting notes" value={privateNote} disabled={busy || !noteRecovery.ready} onChange={(event) => { noteUserEdited.current = true; setPrivateNote(event.target.value); }} placeholder="Write your own notes from this meeting…" />
              {noteRecovery.ready && !busy && <VoiceInput compact label="Speak private note" onResult={(text) => { noteUserEdited.current = true; setPrivateNote(privateNote ? privateNote + " " + text : text); }} />}
            </div>
            {noteRecovery.notice&&<p role="status">{noteRecovery.notice}</p>}
            {noteSaveState&&<p role="status">{noteSaveState}</p>}
            <button className="btn btn-sm" disabled={busy || !noteRecovery.ready} onClick={savePrivateNote}>{busy ? "Saving…" : "Save my notes"}</button>
          </div>}

        </section>

        <section className="meeting-panel" hidden={currentSection !== "recap"}>
          {decisions.length === 0 && !meetingStarted && <p>Decisions and follow-up work will appear here.</p>}
          {(meetingStarted || decisions.length > 0) && <div className="meeting-shared-decisions">
            <div className="meeting-section-subhead"><h2>Shared decisions</h2></div>
            {decisions.length === 0 && <p>No decisions recorded.</p>}
            {decisions.map((row) => <article className="meeting-record meeting-record-decision" key={row.id}>
              <div className="meeting-record-meta">
                <span>{row.profiles?.full_name || "CEAC member"} · {new Date(row.created_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})}</span>
              </div>
              <p>{row.body}</p>
            </article>)}
            {canRecord && <div className="meeting-record-form">
              <div className="assistive-field textarea">
                <textarea rows={3} aria-label="Shared decision" value={decision} disabled={busy || !decisionRecovery.ready} onChange={(event) => setDecision(event.target.value)} placeholder="Record the decision exactly as agreed" />
                {decisionRecovery.ready && !busy && <VoiceInput compact label="Speak decision" onResult={(text) => setDecision((current) => current ? current + " " + text : text)} />}
              </div>
              <button className="btn" disabled={busy || !decisionRecovery.ready || !decision.trim()} onClick={addDecision}>{busy ? "Saving…" : "Record shared decision"}</button>
            </div>}
          </div>}
          {(meetingStarted || links.length > 0) && <h2>Follow-up work</h2>}
          {links.map((link) => <button type="button" className="meeting-work-row" key={link.work_item_id} disabled={!openItem || !link.work_items} onClick={() => openItem(link.work_item_id)}>
            <span><strong>{link.work_items?.title || "Work item"}</strong><small>{link.work_items?.ref} · {link.relation.replaceAll("_"," ")}</small></span>
            {link.work_items && statusPill(link.work_items.status)}
          </button>)}
          {meetingStarted && links.length === 0 && <p>No follow-up work yet.</p>}
          {canRecord && goAssign && <div className="meeting-action-buttons">
            <button type="button" className="btn btn-sm" onClick={createAction}>Assign follow-up</button>
          </div>}
        </section>
      </div>
      <div className="meeting-detail-inspector">
        <aside className="meeting-panel" aria-label="Meeting details">
          <h2>Details</h2>
          <dl>
            {organiser && <><dt>Organiser</dt><dd>{organiser}</dd></>}
            <dt>Format</dt><dd>{meeting.join_url ? providerLabel(meeting) : meeting.location ? "In person" : "Unspecified"}</dd>
            {meeting.location && <><dt>Location</dt><dd>{meeting.location}<br />
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meeting.location)}`} target="_blank" rel="noreferrer">Get directions ↗</a>
            </dd></>}
          </dl>
          {upcoming && <button type="button" className="meeting-export" onClick={() => downloadMeetingCalendar(meeting)}>Download calendar event (.ics)</button>}
          {meeting.project_id && openProject && <button className="meeting-project-link" onClick={() => openProject(meeting.project_id)}>Open project →</button>}
          {participants.length > 0 && <details className="meeting-attendees">
            <summary>Participants ({participants.length})</summary>
            <ul>{participants.map(participant => {
              const response = responses.find(row => row.profile_id === participant.profile_id);
              const label = responseCurrent(response) ? {accepted:"Accepted", tentative:"Maybe", declined:"Declined"}[response.response] : null;
              const isOrganiser = participant.role === "organiser" || participant.profile_id === meeting.created_by;
              return <li key={participant.profile_id}>{participant.profiles?.full_name || "CEAC member"}
                {isOrganiser ? " · Organiser" : label ? " · " + label : ""}</li>;
            })}</ul>
          </details>}
        </aside>
      </div>
    </div>
  </div>;
}
