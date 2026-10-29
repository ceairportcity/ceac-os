import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import SupportAccessApprovals from "../components/SupportAccessApprovals";
import { HELP_CATEGORIES, SERVICE_NAMES, supportCategoryLabel, supportUnavailableMessage } from "../lib/technicalSupport";
import "../role-styles/technical-support.css";

const formatDate = (date) => date ? new Date(date).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra",
}) : "Unknown date";

export default function TechnicalHelp({ me }) {
  const [cases, setCases] = useState([]);
  const [loadedScope, setLoadedScope] = useState(null);
  const readGeneration = useRef(0);
  const submitBusyRef = useRef(false);
  const [selectedId, setSelectedId] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showApprovals,setShowApprovals]=useState(false);
  const [category, setCategory] = useState("");
  const [impact,setImpact]=useState("normal");
  const [department,setDepartment]=useState(me.unit_id || "");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [service, setService] = useState("");
  const currentScope = `${me.org_id}:${me.id}`;
  const visibleCases = loadedScope === currentScope ? cases : [];
  const scopedLoading = loading || loadedScope !== currentScope;

  useEffect(() => {
    setCategory("");setImpact("normal");setDepartment(me.unit_id || "");
    setSummary(""); setDescription(""); setService("");
    setError(null); setSuccess(null); setBusy(false);
    submitBusyRef.current = false;
  }, [me.id, me.org_id]);

  useEffect(() => {
    const generation = ++readGeneration.current;
    let live = true;
    setLoading(true);
    setLoadedScope(null);
    setCases([]);
    setSelectedId(null);
    setLoadError(null);
    (async () => {
      try {
        const { data, error: failure } = await supabase.from("support_case_safe_status")
          .select("id,reference,category,summary,description,affected_service,state,opened_at,resolved_at,closed_at,resolution_summary")
          .order("opened_at", { ascending: false }).limit(30);
        if (failure) throw failure;
        if (live && generation === readGeneration.current) setCases(data || []);
      } catch (failure) {
        if (live && generation === readGeneration.current) setLoadError(supportUnavailableMessage(failure) || "Your support requests cannot be loaded right now. This does not mean they have been deleted.");
      } finally {
        if (live && generation === readGeneration.current) { setLoadedScope(currentScope); setLoading(false); }
      }
    })();
    return () => { live = false; readGeneration.current += 1; };
  }, [me.id, me.org_id, reloadCount]);

  async function submit(event) {
    event.preventDefault();
    // Lock synchronously: state updates alone do not prevent two rapid
    // clicks from inserting duplicate requests.
    if (busy || scopedLoading || loadError || submitBusyRef.current) return;
    const generation = readGeneration.current;
    const title = summary.trim();
    const details = description.trim();
    if(!HELP_CATEGORIES.some(item=>item.id===category)){
      setError("Choose the type of help you need.");return;
    }
    if (title.length < 8 || details.length < 12) {
      setError("Add a short summary and explain what is happening before sending.");
      return;
    }
    // Acquire the synchronous lock only after validating the draft;
    // otherwise an invalid first submission permanently disables retry.
    submitBusyRef.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const requestId = crypto.randomUUID();
      const { error: failure } = await supabase.from("support_cases").insert({
        id: requestId,
        org_id: me.org_id, reported_by: me.id, affected_profile_id: me.id,
        category, summary: title, description: details,
        affected_unit_id:(me.memberships || []).some(item=>item.unit_id===department)?department:null,
        affected_service: service.trim() || null, impact, state: "open",
      });
      if (failure) throw failure;
      if (generation !== readGeneration.current) return;
      const { data, error: readFailure } = await supabase.from("support_case_safe_status")
        .select("id,reference,category,summary,description,affected_service,state,opened_at,resolved_at,closed_at,resolution_summary")
        .eq("id", requestId).maybeSingle();
      if (generation !== readGeneration.current) return;
      // The insert has succeeded. A failed follow-up read must not tell the
      // reporter to submit again: that could create a second support case.
      setSummary(""); setDescription(""); setService("");setCategory("");setImpact("normal");
      if (readFailure || !data) {
        setSuccess("Your request was recorded, but its reference could not be loaded. Refresh your requests to see the saved case. Do not submit it again.");
        setReloadCount((previous) => previous + 1);
      } else {
        setCases((previous) => [data, ...previous.filter((item) => item.id !== data.id)]);
        setSuccess("Your request was recorded. Reference: " + data.reference);
      }
      setLoadError(null);
    } catch (failure) {
      if (generation === readGeneration.current) setError(supportUnavailableMessage(failure) || humanError(failure, "Your request could not be confirmed. Check your existing requests before trying again, or use the approved CEAC support contact."));
    } finally {
      if (generation === readGeneration.current) {
        submitBusyRef.current = false;
        setBusy(false);
      }
    }
  }

  const selected = visibleCases.find((item) => item.id === selectedId) || null;
  const requestUnavailable = scopedLoading || Boolean(loadError);

  return <main className="body ceac-support-page">
    <header className="ceac-support-heading">
      <p className="ceac-support-eyebrow">CEAC assistance</p>
      <h1>Get technical help</h1>
      <p>Tell Technical Support what is preventing you from working. Do not include passwords, verification codes, financial records or confidential employee information.</p>
    </header>
    <div className="ceac-support-layout">
      <section className="ceac-support-main" aria-labelledby="support-new-request">
        <h2 id="support-new-request">Describe the problem</h2>
        <p className="screen-note">Reported by <strong>{me.full_name || "Your signed-in account"}</strong>. Your identity is attached automatically.</p>
        <form className="ceac-support-form" onSubmit={submit}>
          <label>Department
            <select value={department} onChange={event=>setDepartment(event.target.value)} disabled={requestUnavailable || busy}>
              <option value="">No department selected</option>
              {(me.memberships || []).map(item=><option key={item.unit_id} value={item.unit_id}>{item.unit_name || (item.unit_id===me.unit_id?me.unit_name:null) || "Your department"}</option>)}
            </select>
          </label>
          <label>What do you need help with?
            <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={requestUnavailable || busy} required>
              <option value="">Choose request type</option>
              {HELP_CATEGORIES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Short summary
            <input value={summary} onChange={(event) => setSummary(event.target.value)}
              disabled={requestUnavailable || busy} maxLength={160} minLength={8} placeholder="What is preventing you from working?" required />
          </label>
          <label>What happened?
            <textarea value={description} onChange={(event) => setDescription(event.target.value)}
              disabled={requestUnavailable || busy} maxLength={3000} minLength={12} rows={5}
              placeholder="Describe the steps and the error you saw. Leave out confidential content." required />
          </label>
          <label>Affected CEAC feature (optional)
            <input value={service} onChange={(event) => setService(event.target.value)}
              list="support-services" disabled={requestUnavailable || busy} maxLength={120} placeholder="For example, invitations or file uploads" />
            <datalist id="support-services">{SERVICE_NAMES.map(name=><option key={name} value={name}/>)}</datalist>
          </label>
          <label>Effect on your work<select value={impact} onChange={event=>setImpact(event.target.value)} disabled={requestUnavailable || busy}><option value="normal">I can continue working</option><option value="work_blocked">I cannot continue working</option></select></label>
          {error && <p className="ceac-support-error" role="alert">{error}</p>}
          {success && <p className="ceac-support-success" role="status">{success}</p>}
          <button className="btn" type="submit" disabled={busy || requestUnavailable}>{busy ? "Recording request..." : "Send help request"}</button>
        </form>
      </section>
      <aside className="ceac-support-side" aria-labelledby="support-my-requests">
        <div className="ceac-support-section-head">
          <h2 id="support-my-requests">Your requests</h2>
          <button type="button" className="btn btn-ghost" disabled={scopedLoading || busy}
            onClick={() => setReloadCount((previous) => previous + 1)}>Refresh requests</button>
        </div>
        {scopedLoading && <p role="status">Loading your requests...</p>}
        {loadError && <div className="ceac-support-error" role="alert">
          {loadError} <button type="button" disabled={busy} className="btn btn-ghost"
            onClick={() => setReloadCount((previous) => previous + 1)}>Try again</button>
        </div>}
        {!scopedLoading && !loadError && visibleCases.length === 0 && <p className="screen-note">No requests have been recorded.</p>}
        <div className="ceac-support-rows">
          {visibleCases.map((item) => <button type="button" key={item.id}
            aria-pressed={selectedId === item.id}
            className="ceac-support-row ceac-support-case-button"
            onClick={() => setSelectedId((current) => current === item.id ? null : item.id)}>
            <span><strong>{item.summary}</strong><small>{item.reference || "Reference pending"} · {supportCategoryLabel(item.category)}</small></span>
            <span className="ceac-support-state">{String(item.state).replaceAll("_", " ")} · {formatDate(item.opened_at)}</span>
          </button>)}
        </div>
        {selected && <section className="ceac-support-detail" aria-labelledby="support-own-case-title">
          <div className="ceac-support-detail-top">
            <h3 id="support-own-case-title">Request {selected.reference || "details"}</h3>
            <button type="button" className="btn btn-ghost" onClick={() => setSelectedId(null)}>Close details</button>
          </div>
          <dl className="ceac-support-case-facts">
            <div><dt>Status</dt><dd>{String(selected.state).replaceAll("_", " ")}</dd></div>
            <div><dt>Opened</dt><dd>{formatDate(selected.opened_at)}</dd></div>
            <div><dt>Area</dt><dd>{selected.affected_service || "Not specified"}</dd></div>
          </dl>
          <h4>{selected.summary}</h4>
          <p className="ceac-support-description">{selected.description}</p>
          {selected.resolution_summary ? <>
            <h4>Technical Support response</h4>
            <p className="ceac-support-description">{selected.resolution_summary}</p>
          </> : <p className="screen-note">No resolution has been recorded yet. Case updates are subject to the Technical Support team's review.</p>}
        </section>}
      </aside>
    </div>
    {(me.memberships || []).some(membership=>membership.role === "manager") && <details onToggle={event=>setShowApprovals(event.currentTarget.open)}><summary>Access decisions assigned to you</summary>{showApprovals&&<SupportAccessApprovals me={me} authority="unit_manager" />}</details>}
  </main>;
}
