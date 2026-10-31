import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import { PersonalPageHeader } from "../experience-v2/personal-family/PersonalFamilyV2";
import { Sheet } from "../components/bits";
import "./premium-personal.css";

function accraDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function when(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function kindLabel(value) {
  return value === "meeting_outcome" ? "Meeting outcome" : value ? value[0].toUpperCase() + value.slice(1) : "Work";
}

export default function Record({ me, openItem }) {
  const [record, setRecord] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [area, setArea] = useState("highlights");
  const [error, setError] = useState(null);
  const [correctionSession, setCorrectionSession] = useState(null);
  const [correctedEnd, setCorrectedEnd] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => { load(); }, [me.id, month]);

  function changeMonth(delta) {
    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(year, monthNumber - 1 + delta, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }

  function setMonthPart(part, value) {
    const [year, monthNumber] = month.split("-").map(Number);
    const nextYear = part === "year" ? Number(value) : year;
    const nextMonth = part === "month" ? Number(value) : monthNumber;
    setMonth(`${nextYear}-${String(nextMonth).padStart(2, "0")}`);
  }

  async function load() {
    setError(null);
    setRecord(null);

    const [year, monthNumber] = month.split("-").map(Number);
    const monthStart = new Date(year, monthNumber - 1, 1);
    const nextMonth = new Date(year, monthNumber, 1);

    const [itemResult, sessionResult, blockerResult, feedbackResult, submissionResult] = await Promise.all([
      supabase.from("work_items")
        .select("id,ref,title,kind,status,origin,visibility,due_at,completed_at,first_time_approved,created_at,expected_outcome")
        .eq("assignee_id", me.id),
      supabase.from("work_sessions")
        .select("id,started_at,ended_at,last_confirmed_at,place,end_reason,corrected_at,flags")
        .eq("profile_id", me.id)
        .gte("started_at", monthStart.toISOString()).lt("started_at", nextMonth.toISOString())
        .order("started_at", { ascending: false }),
      supabase.from("blockers")
        .select("id,work_item_id,party_text,since,note,state,response_note,resolved_at,resolution_note,created_at,work_items(ref,title)")
        .eq("claimed_by", me.id)
        .gte("created_at", monthStart.toISOString()).lt("created_at", nextMonth.toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("feedback_notes")
        .select("id,note,created_at,profiles!feedback_notes_author_id_fkey(full_name)")
        .eq("profile_id", me.id).order("created_at", { ascending: false }),
      supabase.from("submissions")
        .select("id,work_item_id,submitted_at,note,reviews(id,decision,comment,reviewed_at),work_items(ref,title,kind)")
        .eq("profile_id", me.id)
        .gte("submitted_at", monthStart.toISOString()).lt("submitted_at", nextMonth.toISOString())
        .order("submitted_at", { ascending: false }),
    ]);

    const failed = [itemResult, sessionResult, blockerResult, feedbackResult, submissionResult].find((result) => result.error);
    if (failed) { setError(failed.error.message); return; }

    const items = itemResult.data || [];
    const sessions = sessionResult.data || [];
    const blockers = blockerResult.data || [];
    const notes = feedbackResult.data || [];
    const submissions = submissionResult.data || [];

    const sessionEventResult = sessions.length
      ? await supabase.from("work_session_events")
        .select("id,work_session_id,action,effective_at,note,created_at")
        .in("work_session_id", sessions.map((entry) => entry.id))
        .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (sessionEventResult.error) { setError(sessionEventResult.error.message); return; }

    const formalItems = items.filter((item) => item.visibility !== "private");
    const done = formalItems.filter((item) => ["task", "deliverable"].includes(item.kind)
      && ["completed", "self_certified"].includes(item.status)
      && item.completed_at
      && new Date(item.completed_at) >= monthStart
      && new Date(item.completed_at) < nextMonth)
      .sort((left, right) => new Date(right.completed_at) - new Date(left.completed_at));

    const dueDone = done.filter((item) => item.due_at && item.completed_at);
    const reviewedDone = done.filter((item) => item.first_time_approved !== null);
    const todayKey = accraDateKey(new Date());
    const flaggedSessions = sessions.filter((entry) => entry.flags?.needs_reconciliation === true);
    const staleOpenSessions = sessions.filter((entry) => !entry.ended_at
      && accraDateKey(entry.last_confirmed_at || entry.started_at) < todayKey);
    const excludedIds = new Set([...flaggedSessions, ...staleOpenSessions].map((entry) => entry.id));
    const validSessions = sessions.filter((entry) => !excludedIds.has(entry.id));

    const minutes = validSessions.reduce((sum, session) => {
      const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
      return sum + Math.max(0, (end - new Date(session.started_at).getTime()) / 60000);
    }, 0);

    const corrections = submissions.flatMap((submission) => (submission.reviews || [])
      .filter((review) => review.decision === "returned")
      .map((review) => ({ ...review, submission })))
      .sort((left, right) => new Date(right.reviewed_at) - new Date(left.reviewed_at));

    setFeedback(notes);
    setRecord({
      completed: done.length,
      assigned: done.filter((item) => item.origin === "assigned").length,
      self: done.filter((item) => item.origin === "self_created").length,
      onTime: dueDone.filter((item) => new Date(item.completed_at) <= new Date(item.due_at)).length,
      dueCompleted: dueDone.length,
      firstTime: reviewedDone.filter((item) => item.first_time_approved === true).length,
      reviewedCompleted: reviewedDone.length,
      blocked: blockers.length,
      days: new Set(validSessions.map((session) => accraDateKey(session.started_at))).size,
      hours: Math.floor(minutes / 60),
      mins: Math.round(minutes % 60),
      office: validSessions.filter((session) => session.place === "office").length,
      completedItems: done,
      sessions: sessions.map((entry) => ({
        ...entry,
        events: (sessionEventResult.data || []).filter((event) => event.work_session_id === entry.id),
      })),
      flaggedSessions,
      staleOpenSessions,
      blockers,
      corrections,
    });
  }

  async function correctHistoricalSession() {
    if (!correctionSession || !correctedEnd) return;
    setBusy(true); setError(null);
    try {
      const { error: correctionError } = await supabase.rpc("reconcile_closed_work_session", {
        p_session_id: correctionSession.id,
        p_effective_ended_at: new Date(correctedEnd).toISOString(),
        p_note: correctionNote.trim() || null,
      });
      if (correctionError) throw correctionError;
      setCorrectionSession(null); setCorrectedEnd(""); setCorrectionNote("");
      await load();
    } catch (err) { setError(humanError(err, "The session could not be corrected.")); }
    finally { setBusy(false); }
  }

  // Keep the destination's identity visible while its factual history is loading.
  // A slow authorised read must not make navigation appear to have failed.
  if (!record) return <div className="body staff-record ev2-personal-page ev2-personal-record">
    <PersonalPageHeader
      eyebrow="My Hub"
      title="My work history"
      description="Look back at completed work, feedback and recorded time. Choose a month to see what happened."
    />
    {error
      ? <div className="flag flag-brick" role="alert" style={{ marginTop: 24 }}><h4>Could not load your record</h4>{error}</div>
      : <div className="spin" role="status" aria-busy="true">Loading your history...</div>}
  </div>;

  const [year, monthNumber] = month.split("-").map(Number);
  const monthLabel = new Date(year, monthNumber - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const firstHighlight = record.completedItems[0];
  const secondHighlight = record.completedItems[1];

  return <div className={`body staff-record ev2-personal-page ev2-personal-record ceac-premium-record ${!me.is_admin && !me.is_exec && me.role !== "manager" ? "ev2-personal-staff" : ""}`.trim()}>
    <PersonalPageHeader
      eyebrow="My Hub"
      title="My work history"
      description="Look back at completed work, feedback and recorded time. Choose a month to see what happened."
      statusLabel={monthLabel}
    />
    <p className="context-note">Private work and personal goals remain outside this history.</p>
    <div className="ev2-personal-record-period">
      <div className="record-period-control" aria-label="Work history period">
        <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>←</button>
        <div className="record-period-selects">
          <select aria-label="History month" value={monthNumber} onChange={(event) => setMonthPart("month",event.target.value)}>
            {Array.from({length:12},(_,index)=>index+1).map((value)=><option key={value} value={value}>{new Date(2020,value-1,1).toLocaleDateString("en-GB",{month:"long"})}</option>)}
          </select>
          <select aria-label="History year" value={year} onChange={(event) => setMonthPart("year",event.target.value)}>
            {Array.from({length:7},(_,index)=>new Date().getFullYear()-5+index).map((value)=><option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>→</button>
      </div>
    </div>

    <div className="staff-segment" role="tablist" aria-label="Record view">
      <button role="tab" aria-selected={area === "highlights"} className={area === "highlights" ? "on" : ""} onClick={() => setArea("highlights")}>Highlights</button>
      <button role="tab" aria-selected={area === "history"} className={area === "history" ? "on" : ""} onClick={() => setArea("history")}>Work history</button>
      <button role="tab" aria-selected={area === "time"} className={area === "time" ? "on" : ""} onClick={() => setArea("time")}>Time & activity</button>
    </div>

    {area === "highlights" && <div className="record-area">
      <div className="area-heading">
        <div><span className="eyebrow">{monthLabel}</span><h2>Highlights for this month</h2></div>
      </div>

      <div className="record-summary-grid">
        <div><strong>{record.completed}</strong><span>Completed work</span></div>
        <div><strong>{record.dueCompleted>0 ? <>{record.onTime}<small> / {record.dueCompleted}</small></> : "—"}</strong><span>{record.dueCompleted>0 ? "Completed on time" : "No dated completed work"}</span></div>
        <div><strong>{feedback.length}</strong><span>Feedback received</span></div>
      </div>

      {firstHighlight ? <div className="highlight-stack">
        {[firstHighlight, secondHighlight].filter(Boolean).map((item) => <button key={item.id} className="highlight-card" onClick={() => openItem?.(item.id)}>
          <span className="eyebrow">{kindLabel(item.kind)} · completed {new Date(item.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          <strong>{item.title}</strong>
          {item.expected_outcome && <p>{item.expected_outcome}</p>}
          <div className="highlight-facts">
            {item.due_at && <span>{new Date(item.completed_at) <= new Date(item.due_at) ? "Completed on time" : "Completed after due date"}</span>}
          </div>
        </button>)}
      </div> : <div className="quiet-empty compact">
        <strong>No completed work this month</strong>
        <span>Completed tasks and deliverables will appear here when your work is marked finished.</span>
      </div>}

      {feedback.length > 0 && <section className="record-feedback">
        <div className="area-heading secondary"><div><span className="eyebrow">Recorded by your manager</span><h2>Feedback</h2></div></div>
        {feedback.slice(0, 3).map((note) => <div className="feedback-quote" key={note.id}>
          <p>{note.note}</p>
          <span>{note.profiles?.full_name || "Manager"} · {new Date(note.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>)}
      </section>}
    </div>}

    {area === "history" && <div className="record-area">
      <div className="area-heading"><div><span className="eyebrow">{monthLabel}</span><h2>Work history</h2></div></div>

      {record.completedItems.length > 0 && <section className="timeline">
        {record.completedItems.map((item) => <button key={item.id} className="timeline-row" onClick={() => openItem?.(item.id)}>
          <time>{new Date(item.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time>
          <div>
            <strong>{item.title}</strong>
            <span>{item.ref} · {kindLabel(item.kind)} · {item.origin === "self_created" ? "you added this work" : "given to you"}</span>
            {item.due_at && <small>{new Date(item.completed_at) <= new Date(item.due_at) ? "Completed on time" : "Completed after its due date"}</small>}
          </div>
        </button>)}
      </section>}

      {record.corrections.length > 0 && <section>
        <div className="area-heading secondary"><div><h2>Returned & corrected</h2></div><span>{record.corrections.length}</span></div>
        {record.corrections.map((entry) => <button key={entry.id} className="record-line" onClick={() => openItem?.(entry.submission.work_item_id)}>
          <div><strong>{entry.submission.work_items?.title}</strong><span>Returned {when(entry.reviewed_at)}</span></div>
          <p>{entry.comment || "No return comment was recorded."}</p>
        </button>)}
      </section>}

      {record.blockers.length > 0 && <section>
        <div className="area-heading secondary"><div><h2>Dependency history</h2></div><span>{record.blockers.length}</span></div>
        {record.blockers.map((blocker) => <button key={blocker.id} className="record-line" onClick={() => openItem?.(blocker.work_item_id)}>
          <div><strong>{blocker.work_items?.title || "Work"}</strong><span>{blocker.party_text} · {blocker.state}</span></div>
          <p>{blocker.resolution_note || blocker.response_note || blocker.note || "No additional note."}</p>
        </button>)}
      </section>}

      {record.completedItems.length === 0 && record.corrections.length === 0 && record.blockers.length === 0 && <div className="quiet-empty compact">
        <strong>No work history in this month</strong>
        <span>Completed work, corrections and dependency history will appear here.</span>
      </div>}
    </div>}

    {area === "time" && <div className="record-area">
      <div className="area-heading"><div><span className="eyebrow">{monthLabel}</span><h2>Time & activity</h2></div></div>

      {(record.flaggedSessions.length > 0 || record.staleOpenSessions.length > 0) && <div className="flag flag-amber">
        <h4>{record.flaggedSessions.length + record.staleOpenSessions.length} session{record.flaggedSessions.length + record.staleOpenSessions.length === 1 ? "" : "s"} need correction</h4>
        These sessions are excluded from recorded time until they are reconciled, so CEAC OS does not invent working hours.
      </div>}

      <div className="record-summary-grid">
        <div><strong>{record.days}</strong><span>days with valid sessions</span></div>
        <div><strong>{record.hours}h {record.mins}m</strong><span>recorded session time</span></div>
        <div><strong>{record.office}</strong><span>sessions started at office</span></div>
      </div>
      <p className="context-note">Hours are an activity record, not a basis for pay. Location is recorded when you start work, not continuously.</p>

      <div className="session-list">
        {record.sessions.map((session) => {
          const needsCorrection = session.flags?.needs_reconciliation === true;
          return <div className={`session-row ${needsCorrection ? "needs-correction" : ""}`} key={session.id}>
            <div>
              <strong>{when(session.started_at)}</strong>
              <span>{session.place === "office" ? "Started at the office" : "Started elsewhere"} · {session.ended_at ? `ended ${when(session.ended_at)}` : "still open"}</span>
              {session.end_reason && <small>End reason: {session.end_reason}</small>}
              {session.events.map((event) => <small key={event.id}>{kindLabel(event.action)} {when(event.created_at)}{event.effective_at ? ` · effective ${when(event.effective_at)}` : ""}{event.note ? ` · ${event.note}` : ""}</small>)}
            </div>
            {needsCorrection && <button className="btn btn-ghost btn-sm" onClick={() => {
              setCorrectionSession(session);
              setCorrectedEnd("");
              setCorrectionNote("");
            }}>Correct session</button>}
          </div>;
        })}
        {record.sessions.length === 0 && <div className="quiet-empty compact"><strong>No sessions this month</strong><span>Work sessions you start will appear here.</span></div>}
      </div>
    </div>}

    {correctionSession && <Sheet onClose={() => !busy && setCorrectionSession(null)}>
      <div className="h2">Correct work session</div>
      <p className="screen-note">This session ran across several days and is not included in your totals. Enter when the work actually ended. CEAC OS keeps the correction history.</p>
      <div className="session-correction-context">
        <span>Recorded start</span><strong>{when(correctionSession.started_at)}</strong>
        <span>Old recorded end</span><strong>{when(correctionSession.ended_at)}</strong>
      </div>
      <label className="field-label">Actual end time</label>
      <input className="field" type="datetime-local" value={correctedEnd} onChange={(event) => setCorrectedEnd(event.target.value)} />
      <textarea className="field" rows={2} placeholder="Correction note (optional)" value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} />
      <button className="btn" style={{ marginTop: 14 }} disabled={busy || !correctedEnd} onClick={correctHistoricalSession}>{busy ? "Saving..." : "Save correction"}</button>
    </Sheet>}
  </div>;
}
