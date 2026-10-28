import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { openSession, startWork, endWork, reconcileWorkSession, WorkStartPreflightError } from "../lib/session";
import { Sheet } from "./bits";
import "./EmployeeWorkSession.css";

const ghanaDay = (value) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

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
  const [offsiteLocationName, setOffsiteLocationName] = useState("");
  const [ownWork, setOwnWork] = useState([]);
  const [locationsUnavailable, setLocationsUnavailable] = useState(false);
  const [ownWorkUnavailable, setOwnWorkUnavailable] = useState(false);
  const [endedAt, setEndedAt] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [recheck, setRecheck] = useState(0);
  const [optionsAttempt,setOptionsAttempt]=useState(0);
  const starting=useRef(false);
  useEffect(()=>{setEditor(false);setOffsiteLocationName("");setWorkId("");},[me.id,me.org_id]);
  // A work session open across Ghana midnight becomes stale even when the
  // Overview stays mounted for hours. Refresh this calculation without
  // fetching or mutating HR attendance, and recheck on tab/focus return.
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    const updateClock = () => setClockNow(Date.now());
    const timer = setInterval(updateClock, 60_000);
    window.addEventListener("focus", updateClock);
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", updateClock);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, []);
  const stale = useMemo(() => Boolean(session?.started_at &&
    ghanaDay(session.last_confirmed_at || session.started_at) < ghanaDay(clockNow)),
    [session, clockNow]);

  useEffect(() => {
    let alive = true;
    setSession(null); setError(""); setLoading(true); setReady(false); setVerified(false);
    (async () => {
      try {
        const current = await openSession(me.org_id, me.id);
        if (alive) { setSession(current); setVerified(true); }
      } catch {
        if (alive) setError("Your work session could not be verified. Start and End Work are unavailable until it is checked.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [me.org_id,me.id,recheck]);

  useEffect(() => {
    if (!editor) return;
    let alive = true;
    setReady(false); setLocations([]); setOwnWork([]);setLocationId("");setWorkId("");
    setLocationsUnavailable(false); setOwnWorkUnavailable(false);
    // Optional responsibility loading cannot hold up location-only attendance.
    Promise.resolve(supabase.from("office_locations").select("id,name")
      .eq("org_id",me.org_id).order("name"))
      .then(({data,error})=>{if(alive){setLocations(error?[]:(data||[]));setLocationsUnavailable(Boolean(error));setReady(true);}})
      .catch(()=>{if(alive){setLocationsUnavailable(true);setReady(true);}});
    Promise.resolve(supabase.from("work_items").select("id,ref,title")
      .eq("org_id",me.org_id).eq("assignee_id",me.id)
      .in("status",["not_started","in_progress","returned"])
      .order("created_at",{ascending:false}).limit(100))
      .then(({data,error})=>{if(alive){setOwnWork(error?[]:(data||[]));setOwnWorkUnavailable(Boolean(error));}})
      .catch(()=>{if(alive)setOwnWorkUnavailable(true);});
    return () => { alive = false; };
  }, [editor,me.org_id,me.id,optionsAttempt]);

  async function begin() {
    if (starting.current || busy || !verified) return;
    if (place === "office" && (!ready || locationsUnavailable)) { setError("Authorised duty locations could not be loaded. Reopen this form to retry."); return; }
    if (place === "office" && !locationId) { setError("Choose an authorised duty location."); return; }
    if (place === "elsewhere" && workId && (ownWorkUnavailable || !ownWork.some(item=>item.id===workId))) { setError("Your assigned work could not be loaded. Reopen this form to retry."); return; }
    if (place === "elsewhere" && !offsiteLocationName.trim()) { setError("Enter where you are working from."); return; }
    starting.current=true;setBusy(true);setError("");
    try {
      const created = await startWork(me.org_id,me.id,place,place==="elsewhere"?workId:null,place==="office"?locationId:null,offsiteLocationName);
      // PostgREST insert acknowledgement is not enough to mark the user's
      // personal clock as running. Recheck the current tenant-scoped row.
      const current = await openSession(me.org_id, me.id);
      if (!created?.id || current?.id !== created.id) {
        throw new Error("Your work start could not be verified. Check the current session before trying again.");
      }
      setSession(current);setVerified(true);setEditor(false);setReady(false);setOffsiteLocationName("");
    } catch (e) {
      // A geolocation failure is classified *before* the insert. Keep the
      // editor and verified session state so location can be retried safely.
      if (e instanceof WorkStartPreflightError) {
        setError(e.message);
        return;
      }
      // startWork may have already created the server row before a network
      // error or an uncertain re-read. Never permit a duplicate Start until
      // the authoritative tenant-/actor-scoped session has been rechecked.
      setVerified(false); setEditor(false); setReady(false);
      setError((e?.message || "The work session could not be started.") +
        " Verify your current session before trying again.");
    } finally { starting.current=false;setBusy(false); }
  }
  async function verifyClosedSession(closedId) {
    // An open-session lookup cannot prove the SPECIFIC session was closed:
    // a second open row could otherwise hide an unclosed original.
    const { data: closed, error: closeReadError } = await supabase.from("work_sessions")
      .select("id,ended_at")
      .eq("org_id", me.org_id)
      .eq("profile_id", me.id)
      .eq("id", closedId)
      .maybeSingle();
    if (closeReadError || !closed?.ended_at) {
      throw new Error("The session end time could not be verified. Retry session verification.");
    }
    const current = await openSession(me.org_id, me.id);
    if (current?.id === closedId) {
      throw new Error("The work session still appears open. Retry verification before continuing.");
    }
    setSession(current);
    setVerified(true);
  }
  async function stop() {
    if (!session?.id || busy || stale || !verified) return;
    setBusy(true);setError("");
    try {
      await endWork(session.id);
      await verifyClosedSession(session.id);
    } catch(e) {
      setVerified(false);
      setError(e?.message || "Your work session end could not be verified. Retry session verification.");
    } finally { setBusy(false); }
  }
  async function continueOld() {
    if (!session?.id || busy || !verified) return;
    setBusy(true);setError("");
    try {
      await reconcileWorkSession(session.id,"continue");
      // RPC may return a void/acknowledgement rather than a work_sessions row.
      // Re-read the owner-scoped authoritative open session before rendering.
      const current = await openSession(me.org_id,me.id);
      if (!current || current.id !== session.id) {
        throw new Error("Your earlier work session identity could not be verified. Retry before making further changes.");
      }
      // A successful RPC alone is not evidence that the stale-session
      // reconciliation actually refreshed the authoritative server timestamp.
      if (ghanaDay(current.last_confirmed_at || current.started_at) < ghanaDay(Date.now())) {
        throw new Error("Your earlier work session is still stale. Retry verification before ending work.");
      }
      setSession(current);setVerified(true);setRecover(false);
    } catch (e) {
      setVerified(false); setRecover(false);
      setError(e?.message || "Your earlier session requires verification.");
    } finally { setBusy(false); }
  }
  async function closeOld() {
    if (!session?.id || !endedAt || busy || !verified) return;
    setBusy(true);setError("");
    try {
      await reconcileWorkSession(session.id,"close",new Date(endedAt).toISOString(),correctionReason.trim()||null);
      await verifyClosedSession(session.id);
      setRecover(false);setEndedAt("");setCorrectionReason("");
    } catch(e) {
      setVerified(false); setRecover(false);
      setError(e?.message || "The historical correction could not be verified. Retry session verification.");
    } finally { setBusy(false); }
  }

  return <section className="s2-own-work-session" aria-label="My work session">
    <div className="s2-own-work-session-info">
      <strong>My work session</strong>
      <span>{loading?"Checking your existing session…":!verified
        ? "Work session status unavailable · verification required"
        : session
          ? stale?"Earlier work session requires reconciliation"
            : "In progress · started "+new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"}).format(new Date(session.started_at))
          :"Not started"}
      </span>
      {session?.place==="elsewhere"&&session.flags?.offsite_location_name&&<span>Working from: {session.flags.offsite_location_name}</span>}
      <small>Recorded working time is operational evidence, not automatic attendance approval, overtime or payroll.</small>
    </div>
    <div className="s2-own-work-session-buttons">
      {session
        ? stale?<button type="button" onClick={()=>setRecover(true)} disabled={busy||loading||!verified}>Review earlier session</button>
          :<button type="button" onClick={stop} disabled={busy||loading||!verified}>{busy?"Ending…":"End work"}</button>
        :<button type="button" onClick={()=>{setError("");setEditor(true);}} disabled={busy||loading||!verified}>
          Start work
        </button>}
    </div>
    {error&&<p className="s2-own-work-session-error" role="alert">{error}{!verified&&<button type="button" onClick={()=>setRecheck((v)=>v+1)} disabled={loading}>Retry session verification</button>}</p>}
    {editor&&<Sheet onClose={()=>!busy&&setEditor(false)}>
      <form className="s2-work-start-form" onSubmit={event=>{event.preventDefault();begin();}}>
      <h2>Start your work session</h2>
      <p>Choose your actual working location. Location evidence is checked when you begin. The system does not continuously track your position.</p>
      <fieldset disabled={busy}><legend>Working location</legend>
        <label><input type="radio" name="s2-own-place" checked={place==="office"} onChange={()=>{setPlace("office");setError("");}}/> Authorised office or programme venue</label>
        <label><input type="radio" name="s2-own-place" checked={place==="elsewhere"} onChange={()=>{setPlace("elsewhere");setError("");}}/> Off-site work</label>
      </fieldset>
      {place==="office"?<label>Duty location
        <select value={locationId} onChange={e=>setLocationId(e.target.value)} disabled={busy||!ready||locationsUnavailable}>
          <option value="">Choose a verified CEAC location</option>
          {locations.map(loc=><option key={loc.id} value={loc.id}>{loc.name}</option>)}
        </select>
        {ready&&locationsUnavailable&&<small role="alert">Duty locations could not be verified.</small>}
      </label>:<>
        <label>Where are you working from?
          <input className="field" name="offsite_location_name" required value={offsiteLocationName} maxLength={200} disabled={busy}
            onChange={e=>{setOffsiteLocationName(e.target.value);setError("");}} placeholder="For example, home or a client’s office" />
        </label>
        <label>Responsibility (optional)
          <select className="field" value={workId} onChange={e=>{setWorkId(e.target.value);setError("");}} disabled={busy||ownWorkUnavailable}>
            <option value="">No responsibility linked</option>
            {ownWork.map(item=><option key={item.id} value={item.id}>{item.ref} · {item.title}</option>)}
          </select>
        </label>
        {ownWorkUnavailable&&<small role="status">Responsibilities could not be loaded. You can still start without linking one.</small>}
        {!ownWorkUnavailable&&ownWork.length===0&&<small role="status">No responsibility is required to start off-site.</small>}
        <p>Your current location and the place you enter will be recorded when you start.</p>
      </>}
      <button type="button" disabled={busy} onClick={()=>{setError("");setOptionsAttempt(value=>value+1);}}>Reload start options</button>
      {error&&<p role="alert">{error}</p>}
      <button type="submit" className="btn" disabled={busy||!verified||(place==="office"?(!ready||locationsUnavailable||!locationId):(!offsiteLocationName.trim()||Boolean(workId&&(ownWorkUnavailable||!ownWork.some(item=>item.id===workId)))))}>
        {busy?"Verifying location…":"Start work"}
      </button>
      </form>
    </Sheet>}
    {recover&&<Sheet onClose={()=>!busy&&setRecover(false)}>
      <h2>Review your earlier session</h2>
      <p>The original start and any corrections remain recorded. Do not invent an end time.</p>
      <button type="button" onClick={continueOld} disabled={busy||!verified}>Continue recorded session</button>
      <label>Actual end time <input type="datetime-local" value={endedAt} onChange={e=>setEndedAt(e.target.value)}/></label>
      <label>Explanation for correction <textarea rows={3} value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)}/></label>
      <button type="button" onClick={closeOld} disabled={busy||!endedAt||!verified}>Close at actual time</button>
      {error&&<p role="alert">{error}</p>}
    </Sheet>}
  </section>;
}
