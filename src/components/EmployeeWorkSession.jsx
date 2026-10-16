import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { openSession, startWork, endWork, reconcileWorkSession } from "../lib/session";
import { Sheet } from "./bits";
import "./EmployeeWorkSession.css";

const ghanaDay = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));

/**
 * Manager/Administration employee's OWN operational Start/End Work action.
 * One person across all units. Never reads/writes a team's attendance.
 * The existing work_sessions RLS, duty-location evidence and correction RPCs
 * remain authoritative. This is NOT an automatic HR presence/payroll verdict.
 */
export default function EmployeeWorkSession({ me }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(false);
  const [recover, setRecover] = useState(false);
  const [place, setPlace] = useState("office");
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState([]);
  const [workId, setWorkId] = useState("");
  const [ownWork, setOwnWork] = useState([]);
  const [endedAt, setEndedAt] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [ready, setReady] = useState(false);
  const stale = useMemo(() => Boolean(session?.started_at &&
    ghanaDay(session.last_confirmed_at || session.started_at) < ghanaDay(new Date())),
    [session]);

  useEffect(() => {
    let alive = true;
    setSession(null); setError(""); setLoading(true); setReady(false);
    (async () => {
      try {
        const current = await openSession(me.org_id, me.id);
        if (alive) setSession(current);
      } catch {
        if (alive) setError("Your work session could not be verified. Start and End Work are unavailable until it is checked.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [me.org_id,me.id]);

  useEffect(() => {
    if (!editor) return;
    let alive = true;
    setReady(false); setLocations([]); setOwnWork([]);
    (async () => {
      try {
        const [locationResult,workResult] = await Promise.all([
          supabase.from("office_locations").select("id,name")
            .eq("org_id",me.org_id).eq("active",true).order("name"),
          supabase.from("work_items").select("id,ref,title").eq("assignee_id",me.id)
            .in("status",["not_started","in_progress","returned"])
            .order("created_at",{ascending:false}).limit(100),
        ]);
        if (locationResult.error || workResult.error) throw (locationResult.error || workResult.error);
        if (alive) {
          setLocations(locationResult.data || []); setOwnWork(workResult.data || []);
          setReady(true);
        }
      } catch { if (alive) setError("Authorised duty locations or your own work could not be verified."); }
    })();
    return () => { alive = false; };
  }, [editor,me.org_id,me.id]);

  async function begin() {
    if (busy || !ready) return;
    if (place === "office" && !locationId) { setError("Choose an authorised duty location."); return; }
    if (place === "elsewhere" && !workId) { setError("Choose one of your own assigned responsibilities."); return; }
    setBusy(true);setError("");
    try {
      const created = await startWork(me.org_id,me.id,place,place==="elsewhere"?workId:null,place==="office"?locationId:null);
      setSession(created);setEditor(false);setReady(false);
    } catch (e) { setError(e?.message || "The work session could not be started."); }
    finally { setBusy(false); }
  }
  async function stop() {
    if (!session?.id || busy || stale) return;
    setBusy(true);setError("");
    try { await endWork(session.id);setSession(null); }
    catch(e) { setError(e?.message || "The work session could not be ended."); }
    finally { setBusy(false); }
  }
  async function continueOld() {
    if (!session?.id || busy) return;
    setBusy(true);setError("");
    try {
      const current = await reconcileWorkSession(session.id,"continue");
      setSession(current);setRecover(false);
    } catch (e) { setError(e?.message || "Your earlier session requires review."); }
    finally { setBusy(false); }
  }
  async function closeOld() {
    if (!session?.id || !endedAt || busy) return;
    setBusy(true);setError("");
    try {
      await reconcileWorkSession(session.id,"close",new Date(endedAt).toISOString(),correctionReason.trim()||null);
      setSession(null);setRecover(false);setEndedAt("");setCorrectionReason("");
    } catch(e) { setError(e?.message || "The historical correction could not be saved."); }
    finally { setBusy(false); }
  }

  return <section className="s2-own-work-session" aria-label="My work session">
    <div className="s2-own-work-session-info">
      <strong>My work session</strong>
      <span>{loading?"Checking your existing session…":session
        ? stale?"Earlier work session requires reconciliation"
          : "In progress · started "+new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"}).format(new Date(session.started_at))
        :"Not started"}
      </span>
      <small>Recorded working time is operational evidence, not automatic attendance approval, overtime or payroll.</small>
    </div>
    <div className="s2-own-work-session-buttons">
      {session
        ? stale?<button type="button" onClick={()=>setRecover(true)} disabled={busy||loading}>Review earlier session</button>
          :<button type="button" onClick={stop} disabled={busy||loading}>{busy?"Ending…":"End work"}</button>
        :<button type="button" onClick={()=>{setError("");setEditor(true);}} disabled={busy||loading||Boolean(error)}>
          Start work
        </button>}
    </div>
    {error&&<p className="s2-own-work-session-error" role="alert">{error}</p>}
    {editor&&<Sheet onClose={()=>!busy&&setEditor(false)}>
      <h2>Start your work session</h2>
      <p>Choose your actual working location. Location evidence is checked when you begin. The system does not continuously track your position.</p>
      <fieldset><legend>Working location</legend>
        <label><input type="radio" name="s2-own-place" checked={place==="office"} onChange={()=>setPlace("office")}/> Authorised office or programme venue</label>
        <label><input type="radio" name="s2-own-place" checked={place==="elsewhere"} onChange={()=>setPlace("elsewhere")}/> Off-site work on my responsibility</label>
      </fieldset>
      {place==="office"?<label>Duty location
        <select value={locationId} onChange={e=>setLocationId(e.target.value)} disabled={!ready}>
          <option value="">Choose a verified CEAC location</option>
          {locations.map(loc=><option key={loc.id} value={loc.id}>{loc.name}</option>)}
        </select>
      </label>:<label>My responsibility
        <select value={workId} onChange={e=>setWorkId(e.target.value)} disabled={!ready}>
          <option value="">Choose your own work</option>
          {ownWork.map(item=><option key={item.id} value={item.id}>{item.ref} · {item.title}</option>)}
        </select>
      </label>}
      {error&&<p role="alert">{error}</p>}
      <button type="button" className="btn" disabled={busy||!ready||(place==="office"?!locationId:!workId)} onClick={begin}>
        {busy?"Verifying location…":"Start work"}
      </button>
    </Sheet>}
    {recover&&<Sheet onClose={()=>!busy&&setRecover(false)}>
      <h2>Review your earlier session</h2>
      <p>The original start and any corrections remain recorded. Do not invent an end time.</p>
      <button type="button" onClick={continueOld} disabled={busy}>Continue recorded session</button>
      <label>Actual end time <input type="datetime-local" value={endedAt} onChange={e=>setEndedAt(e.target.value)}/></label>
      <label>Explanation for correction <textarea rows={3} value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)}/></label>
      <button type="button" onClick={closeOld} disabled={busy||!endedAt}>Close at actual time</button>
      {error&&<p role="alert">{error}</p>}
    </Sheet>}
  </section>;
}
