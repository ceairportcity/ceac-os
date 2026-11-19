import { useEffect, useState } from "react";
import { Clock3, CheckCircle2 } from "lucide-react";
import { openSession, reconcileWorkSession, endWork } from "../lib/session";
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

export default function WorkSessionCutoff({ me, session, setSession }) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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

  const clock = accraClock();
  const sessionDay = session?.started_at && new Intl.DateTimeFormat("en-CA",
    {timeZone:"Africa/Accra",year:"numeric",month:"2-digit",day:"2-digit"})
    .format(new Date(session.started_at));
  const overtime = session?.flags?.overtime_until ? new Date(session.flags.overtime_until) : null;
  const overtimeActive = overtime && overtime.getTime() > now;
  if (!session?.id || sessionDay !== clock.day || (clock.minutes < 16*60+55 && !overtimeActive)) return null;

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
