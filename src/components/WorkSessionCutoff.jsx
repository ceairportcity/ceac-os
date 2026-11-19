import { useEffect, useState } from "react";
import { Clock3, CheckCircle2 } from "lucide-react";
import { openSession, reconcileWorkSession, endWork } from "../lib/session";
import { supabase } from "../lib/supabase";
import "./WorkSessionCutoff.css";

const accraClock = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit",
    year: "numeric", month: "2-digit", day: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const field = name => parts.find(part => part.type === name)?.value;
  return { minutes: Number(field("hour")) * 60 + Number(field("minute")),
    day: field("year") + "-" + field("month") + "-" + field("day") };
};

export default function WorkSessionCutoff({ me, session, setSession, showCorrections = false }) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [autoRecord, setAutoRecord] = useState(null);
  const [correcting, setCorrecting] = useState(false);
  const [actualFinish, setActualFinish] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionRevision, setCorrectionRevision] = useState(0);
  useEffect(() => {
    if (!session?.id) return;
    let active = true;
    async function refresh() {
      setNow(Date.now());
      if (document.visibilityState === "hidden") return;
      try {
        const current = await openSession(me.org_id, me.id);
        if (active && current?.id !== session.id) setSession(current);
        else if (active && current?.id === session.id &&
          JSON.stringify(current.flags) !== JSON.stringify(session.flags)) setSession(current);
      } catch { /* Network failure must not imply a closed session. */ }
    }
    const handleFocus = () => { if (!busy) void refresh(); };
    const timer = window.setInterval(handleFocus, 60000);
    document.addEventListener("visibilitychange", handleFocus);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", handleFocus); };
  }, [me.org_id, me.id, session?.id, session?.flags?.overtime_until, busy, setSession]);

  useEffect(() => {
    if (!showCorrections || session?.id) { setAutoRecord(null); return; }
    let active = true;
    const cutoff = new Date(Date.now()-7*86400000).toISOString();
    supabase.from("work_sessions").select("id,started_at,ended_at,end_reason")
      .eq("org_id",me.org_id).eq("profile_id",me.id).eq("end_reason","auto")
      .gte("ended_at",cutoff).order("ended_at",{ascending:false}).limit(1)
      .then(({data,error}) => { if (active && !error) setAutoRecord(data?.[0] || null); })
      .catch(() => {});
    return () => {active=false;};
  }, [showCorrections,session?.id,me.org_id,me.id,correctionRevision]);

  async function saveCorrection(event) {
    event.preventDefault();
    if (!autoRecord?.id || busy || !actualFinish || !correctionNote.trim()) return;
    setBusy(true); setMessage("");
    try {
      const result = await reconcileWorkSession(autoRecord.id,"correct_auto",
        new Date(actualFinish+":00Z").toISOString(),correctionNote.trim());
      if (result?.id !== autoRecord.id || result.end_reason !== "reconciled")
        throw new Error("The correction could not be verified.");
      setAutoRecord(null); setCorrecting(false); setActualFinish(""); setCorrectionNote("");
      setCorrectionRevision(n=>n+1);
      setMessage("Corrected finish time saved with an audit record.");
    } catch (error) {setMessage(error.message || "The correction could not be saved.");}
    finally {setBusy(false);}
  }

  const clock = accraClock();
  const sessionDay = session?.started_at && (() => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(session.started_at));
    const field = type => parts.find(part => part.type === type)?.value;
    return field("year") + "-" + field("month") + "-" + field("day");
  })();
  const overtime = session?.flags?.overtime_until ? new Date(session.flags.overtime_until) : null;
  const overtimeActive = overtime && overtime.getTime() > now;
  if (!session?.id) {
    if (!showCorrections) return null;
    if (!autoRecord) return message ? <p className="ceac-work-cutoff-message" role="status">{message}</p> : null;
    return <section className="ceac-work-cutoff ceac-work-cutoff-correction" aria-label="Review an automatically ended workday">
      <span className="ceac-work-cutoff-symbol" aria-hidden="true"><Clock3 size={20}/></span>
      <div className="ceac-work-cutoff-info">
        <strong>Review your automatically ended work session</strong>
        <small>Recorded finish: {new Date(autoRecord.ended_at).toLocaleString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}. This is an administrative cutoff, not verified attendance.</small>
        {correcting && <form className="ceac-work-cutoff-correct-form" onSubmit={saveCorrection}>
          <label>Actual finish time (Accra)<input type="datetime-local" required value={actualFinish} onChange={e=>setActualFinish(e.target.value)}/></label>
          <label>Reason for the correction<textarea required maxLength={500} rows={2} value={correctionNote} onChange={e=>setCorrectionNote(e.target.value)} placeholder="Explain when and why you finished at this time."/></label>
          <div className="ceac-work-cutoff-actions"><button className="ceac-work-cutoff-extend" type="submit" disabled={busy}>Save correction</button>
            <button className="ceac-work-cutoff-finish" type="button" onClick={()=>setCorrecting(false)}>Cancel</button></div>
        </form>}
        {message && <span className="ceac-work-cutoff-message" role="status">{message}</span>}
      </div>
      {!correcting && <button type="button" className="ceac-work-cutoff-finish" onClick={()=>{
        setCorrecting(true);setMessage("");
        setActualFinish(new Date(autoRecord.ended_at).toISOString().slice(0,16));
      }}>Correct time</button>}
    </section>;
  }
  if (sessionDay !== clock.day || (clock.minutes < 16*60+55 && !overtimeActive)) return null;

  async function extend() {
    if (busy || !session?.id) return;
    setBusy(true); setMessage("");
    try {
      const limit = new Date(Date.now()+60*60000);
      const result = await reconcileWorkSession(session.id, "overtime", limit.toISOString(),
        "Continued working after the normal cutoff.");
      const verified = await openSession(me.org_id, me.id);
      if (!result?.id || verified?.id !== session.id ||
          Date.parse(verified.flags?.overtime_until || "") < limit.getTime()-1000) {
        throw new Error("The overtime extension could not be verified.");
      }
      setSession(verified);
      setMessage("Extended for another hour. End work when finished.");
    } catch (error) {
      setMessage(error.message || "Could not extend your session. Check your current status.");
      try { setSession(await openSession(me.org_id, me.id)); } catch { /* Keep unverified state. */ }
    } finally { setBusy(false); }
  }
  async function finish() {
    if (busy || !session?.id) return;
    setBusy(true); setMessage("");
    try {
      await endWork(session.id);
      const verified = await openSession(me.org_id,me.id);
      if (verified?.id === session.id) throw new Error("The session is still open.");
      setSession(verified);
      setMessage("Work ended.");
    } catch(error) {
      setMessage(error.message || "End Work was not confirmed. Check your current session.");
    } finally {setBusy(false);}
  }
  return <section className="ceac-work-cutoff" aria-label="End of workday">
    <span className="ceac-work-cutoff-symbol" aria-hidden="true"><Clock3 size={20}/></span>
    <div className="ceac-work-cutoff-info">
      <strong>{overtimeActive ? "You're working overtime" : "Your workday is ending"}</strong>
      <small>{overtimeActive
        ? "Session extended until " + overtime.toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"}) + ". End when finished."
        : "Your open session closes automatically at 5:45 PM (Accra time). The cutoff is not proof of actual hours."}</small>
      {message && <span role="status" className="ceac-work-cutoff-message">{message}</span>}
    </div>
    <div className="ceac-work-cutoff-actions">
      <button type="button" className="ceac-work-cutoff-finish" disabled={busy} onClick={finish}><CheckCircle2 size={15}/> End work</button>
      <button type="button" className="ceac-work-cutoff-extend" disabled={busy} onClick={extend}>Continue 1 hour</button>
    </div>
  </section>;
}
