import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import {
  canManageSupport, SUPPORT_WORKSPACES, SERVICE_NAMES, SUPPORT_GUIDES,
  supportCategoryLabel, supportCaseGroups, filterSupportCases,
} from "../lib/technicalSupport";
import "../role-styles/technical-support.css";

function SupportRows({ cases, onSelect, empty = "Nothing requires action here." }) {
  return <div className="ceac-support-rows">
    {!cases.length && <p className="screen-note">{empty}</p>}
    {cases.map((item) => <button type="button" key={item.id}
      className="ceac-support-row ceac-support-case-button" onClick={() => onSelect(item.id)}>
      <span><strong>{item.summary}</strong>
        <small>{item.reference || "Reference pending"} · {supportCategoryLabel(item.category)}</small>
      </span>
      <span className="ceac-support-state">{String(item.state).replaceAll("_", " ")}</span>
    </button>)}
  </div>;
}

function CaseDetails({ item, onClose, onUpdate, onClaim, myId, busy, error }) {
  const [nextState, setNextState] = useState(item.state);
  const [resolution, setResolution] = useState(item.resolution_summary || "");
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  useEffect(() => {
    setNextState(item.state);
    setResolution(item.resolution_summary || "");
  }, [item.id, item.state, item.resolution_summary]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    (async () => {
      const { data, error: failure } = await supabase.from("support_case_events")
        .select("id,action,note,occurred_at").eq("case_id", item.id)
        .order("occurred_at", { ascending: false }).limit(75);
      if (!active) return;
      setHistory(data || []);
      setHistoryError(failure ? "Case history could not be verified." : null);
      setHistoryLoading(false);
    })();
    return () => { active = false; };
  }, [item.id, item.state, item.resolution_summary]);

  return <section className="ceac-support-detail" aria-labelledby="support-case-title">
    <div className="ceac-support-detail-top">
      <div><p className="ceac-support-eyebrow">{item.reference || "Support case"}</p>
        <h2 id="support-case-title">{item.summary}</h2></div>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Close details</button>
    </div>
    <dl className="ceac-support-case-facts">
      <div><dt>Category</dt><dd>{supportCategoryLabel(item.category)}</dd></div>
      <div><dt>Service</dt><dd>{item.affected_service || "Not specified"}</dd></div>
      <div><dt>Impact</dt><dd>{item.impact || "Unspecified"}</dd></div>
      <div><dt>Current status</dt><dd>{String(item.state).replaceAll("_", " ")}</dd></div>
      <div><dt>Assignment</dt><dd>{item.assigned_to === myId ? "Assigned to you" : item.assigned_to ? "Assigned to another support member" : "Unassigned"}</dd></div>
    </dl>
    {!item.assigned_to && <button type="button" className="btn btn-ghost" disabled={busy}
      onClick={() => onClaim(item.id)}>{busy ? "Recording..." : "Take this case"}</button>}
    <h3>What happened</h3>
    <p className="ceac-support-description">{item.description}</p>
    <h3>Record next action</h3>
    <form className="ceac-support-form" onSubmit={(event) => {
      event.preventDefault();
      onUpdate(item.id, nextState, resolution);
    }}>
      <label>Case status
        <select value={nextState} onChange={(event) => setNextState(event.target.value)}>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="waiting_approval">Waiting for business approval</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </label>
      <label>Action or resolution note
        <textarea rows={3} value={resolution} onChange={(event) => setResolution(event.target.value)}
          maxLength={2000} placeholder="Record factual work completed. Do not include credentials or protected records." />
      </label>
      {error && <p role="alert" className="ceac-support-error">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Saving..." : "Save case change"}</button>
      <p className="screen-note">Access changes still require separate business approval. This form cannot grant permissions.</p>
    </form>
    <div className="ceac-support-history">
      <h3>Case history</h3>
      {historyLoading && <p role="status">Loading attributable support history...</p>}
      {historyError && <p role="alert" className="ceac-support-error">{historyError}</p>}
      {!historyLoading && !historyError && !history.length && <p className="screen-note">No verified event history is available.</p>}
      <ol className="ceac-support-history-list">
        {history.map((event) => <li key={event.id}>
          <strong>{event.action.replaceAll("_", " ")}</strong>
          <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString("en-GB")}</time>
          {event.note && <p>{event.note}</p>}
        </li>)}
      </ol>
    </div>
  </section>;
}

export default function TechnicalSupport({ me, go }) {
  const [workspace, setWorkspace] = useState("home");
  const [deskQuery, setDeskQuery] = useState("");
  const [deskStatus, setDeskStatus] = useState("all");
  const [membership, setMembership] = useState(null);
  const [ready, setReady] = useState(false);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const canManage = canManageSupport(me);

  useEffect(() => {
    let live = true;
    // A role/account transition must not keep an old user's case data visible.
    setReady(false);
    setMembership(null);
    setCases([]);
    setSelectedId(null);
    setError(null);
    (async () => {
      try {
        if (!canManage) throw new Error("Your account has no Technical Support case-management authority.");
        const { data: membershipData, error: membershipFailure } = await supabase.from("support_team_memberships")
          .select("id,role").eq("org_id", me.org_id).eq("profile_id", me.id)
          .eq("active", true).maybeSingle();
        if (membershipFailure) throw membershipFailure;
        if (!live) return;
        setMembership(membershipData);
        if (!membershipData) return;
        const { data: caseData, error: casesFailure } = await supabase.from("support_cases")
          .select("id,reference,category,summary,description,affected_service,impact,state,assigned_to,opened_at,resolved_at,closed_at,resolution_summary")
          .eq("org_id", me.org_id).order("opened_at", { ascending: false }).limit(150);
        if (casesFailure) throw casesFailure;
        if (live) setCases(caseData || []);
      } catch (failure) {
        if (live) setError(humanError(failure, "The Technical Support service cannot be opened. No permissions were changed."));
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => { live = false; };
  }, [me.id, me.org_id, canManage]);

  const groups = useMemo(() => supportCaseGroups(cases), [cases]);
  // These filters apply only to the latest RLS-authorised cases fetched above;
  // never suggest that an incomplete 150-record window is the full history.
  const deskCases = useMemo(
    () => filterSupportCases(cases, deskQuery, deskStatus),
    [cases, deskQuery, deskStatus],
  );
  const selected = cases.find((item) => item.id === selectedId);

  async function refreshCases() {
    if (busy) return;
    // Clear previously obtained case data BEFORE rechecking current
    // membership, so a removed member cannot keep browsing a stale list.
    setReady(false);
    setError(null);
    setActionError(null);
    setSelectedId(null);
    setMembership(null);
    setCases([]);
    try {
      if (!canManage) throw new Error("Your account has no Technical Support case-management authority.");
      const { data: currentMembership, error: membershipFailure } = await supabase
        .from("support_team_memberships").select("id,role")
        .eq("org_id", me.org_id).eq("profile_id", me.id).eq("active", true).maybeSingle();
      if (membershipFailure) throw membershipFailure;
      if (!currentMembership) return;
      const { data: currentCases, error: casesFailure } = await supabase
        .from("support_cases")
        .select("id,reference,category,summary,description,affected_service,impact,state,assigned_to,opened_at,resolved_at,closed_at,resolution_summary")
        .eq("org_id", me.org_id).order("opened_at", { ascending: false }).limit(150);
      if (casesFailure) throw casesFailure;
      setCases(currentCases || []);
      setMembership(currentMembership);
    } catch (failure) {
      setError(humanError(failure, "The Technical Support queue cannot be refreshed. No case was changed."));
    } finally {
      setReady(true);
    }
  }

  async function claimCase(id) {
    if (!canManage || !membership || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      // Do not silently seize an already assigned case. RLS/membership and
      // the backend assignment guard independently authorise this transition.
      const { data, error: failure } = await supabase.from("support_cases")
        .update({ assigned_to: me.id }).eq("id", id).eq("org_id", me.org_id)
        .is("assigned_to", null)
        .select("id,reference,category,summary,description,affected_service,impact,state,assigned_to,opened_at,resolved_at,closed_at,resolution_summary")
        .maybeSingle();
      if (failure) throw failure;
      if (!data) throw new Error("This case is no longer unassigned. Refresh the Help Desk before taking it.");
      setCases((items) => items.map((item) => item.id === id ? data : item));
    } catch (failure) {
      setActionError(humanError(failure, "The case was not assigned to you."));
    } finally {
      setBusy(false);
    }
  }

  async function updateCase(id, state, note) {
    if (!canManage || !membership || busy) return;
    if ((state === "resolved" || state === "closed") && note.trim().length < 10) {
      setActionError("Record what was resolved before closing the case.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const { data, error: failure } = await supabase.from("support_cases")
        .update({ state, resolution_summary: note.trim() || null })
        .eq("id", id).eq("org_id", me.org_id)
        .select("id,reference,category,summary,description,affected_service,impact,state,assigned_to,opened_at,resolved_at,closed_at,resolution_summary")
        .single();
      if (failure) throw failure;
      setCases((items) => items.map((item) => item.id === id ? data : item));
    } catch (failure) {
      setActionError(humanError(failure, "The case change was not recorded. No further action was taken."));
    } finally {
      setBusy(false);
    }
  }

  return <main className="body ceac-support-page ceac-support-operations">
    <header className="ceac-support-heading">
      <p className="ceac-support-eyebrow">Media & Technical · Autonomous service team</p>
      <h1>Technical Support</h1>
      <p>Help people use CEAC, maintain approved access and escalate service issues. This workspace does not grant HR, payroll, leave or general administrative permissions.</p>
    </header>

    {!ready && <p role="status" aria-busy="true">Checking your Technical Support authority...</p>}
    {ready && error && <div className="ceac-support-error" role="alert">
      {error} <button type="button" className="btn btn-ghost" onClick={refreshCases}>Try again</button>
    </div>}
    {ready && !error && !membership && <div className="ceac-support-empty" role="status">
      You do not have an active Technical Support team membership. Contact People Administration to complete the approved transition. No support queue is visible.
    </div>}
    {ready && !error && membership && <>
      <nav aria-label="Technical Support workspaces" className="ceac-support-nav">
        {SUPPORT_WORKSPACES.map((item) => <button key={item.id} type="button"
          aria-current={workspace === item.id ? "page" : undefined}
          className={workspace === item.id ? "is-active" : ""}
          onClick={() => { setWorkspace(item.id); setSelectedId(null); setActionError(null); }}>
          {item.label}
        </button>)}
      </nav>

      {selected ? <CaseDetails key={selected.id} item={selected} busy={busy} error={actionError}
        myId={me.id} onClaim={claimCase}
        onClose={() => { setSelectedId(null); setActionError(null); }} onUpdate={updateCase} /> : <>
        {workspace === "home" && <div className="ceac-support-layout">
          <section className="ceac-support-main">
            <h2>Needs you</h2>
            <p className="screen-note">Open and in-progress cases that need Technical Support action.</p>
            <SupportRows cases={groups.attention} onSelect={setSelectedId} />
          </section>
          <aside className="ceac-support-side">
            <h2>Waiting for approval</h2>
            <SupportRows cases={groups.waitingApproval} onSelect={setSelectedId}
              empty="No requests are recorded as waiting for approval." />
            <h2>Recently resolved</h2>
            <SupportRows cases={groups.recentlyResolved} onSelect={setSelectedId}
              empty="No recently resolved requests." />
          </aside>
        </div>}
        {workspace === "help-desk" && <section className="ceac-support-main">
          <div className="ceac-support-section-head"><div><h2>Help people work</h2>
            <p className="screen-note">Only cases authorised for the support queue are listed.</p></div>
            <div className="ceac-support-section-actions">
              <button className="btn btn-ghost" type="button" onClick={refreshCases}>Refresh cases</button>
              <button className="btn btn-ghost" type="button" onClick={() => go("technical-help")}>Submit your own request</button>
            </div>
          </div>
          <div className="ceac-support-desk-filters">
            <label>Find a request
              <input type="search" value={deskQuery} onChange={(event) => setDeskQuery(event.target.value)}
                placeholder="Reference, summary or category" />
            </label>
            <label>Case status
              <select value={deskStatus} onChange={(event) => setDeskStatus(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="waiting_approval">Waiting for approval</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>
          <p className="screen-note" role="status">
            {deskCases.length} of {cases.length} loaded cases shown. This view loads up to 150 recent cases.
          </p>
          <SupportRows cases={deskCases} onSelect={setSelectedId}
            empty={cases.length ? "No loaded cases match these filters." : "No support cases have been recorded."} />
        </section>}
        {workspace === "people-access" && <section className="ceac-support-main">
          <h2>People & Access</h2>
          <p className="screen-note">Investigate account and approved access requests without inspecting confidential employee or payroll information.</p>
          <SupportRows cases={groups.access} onSelect={setSelectedId}
            empty="No account or access cases were reported." />
          <div className="ceac-support-unverified">
            <strong>Access execution is not enabled in this workspace.</strong>
            <p>Business approvers must authorise a change using the existing CEAC protected-authority process. Technical Support cannot approve its own request or assign itself new powers.</p>
          </div>
        </section>}
        {workspace === "system" && <section className="ceac-support-main">
          <h2>Is CEAC working?</h2>
          <p className="screen-note">Only verified service telemetry may establish Working, Needs attention or Down. No unverified check is presented as healthy.</p>
          <div className="ceac-support-rows">
            {SERVICE_NAMES.map((service) => <div key={service} className="ceac-support-row">
              <strong>{service}</strong><span className="ceac-support-state">Not verified</span>
            </div>)}
          </div>
          <p className="ceac-support-unverified">Live service-health providers and recovery evidence have not been connected to this panel. Use the approved operational incident and backup records until verified integrations are available.</p>
        </section>}
        {workspace === "improvements" && <section className="ceac-support-main">
          <h2>What keeps happening?</h2>
          <p className="screen-note">Repeated case categories suggest where to investigate. They are not proof of a common cause or a score for any person.</p>
          {!groups.recurring.length && <p>No repeating case categories in the cases available to this account.</p>}
          <div className="ceac-support-rows">
            {groups.recurring.map((item) => <div className="ceac-support-row" key={item.id}>
              <strong>{item.label}</strong>
              <span>{item.cases.length} cases · Review for patterns</span>
            </div>)}
          </div>
        </section>}
        {workspace === "guides" && <section className="ceac-support-main">
          <h2>I need to…</h2>
          <div className="ceac-support-guides">
            {SUPPORT_GUIDES.map(([name, guidance]) => <details key={name}>
              <summary>{name}</summary><p>{guidance}</p>
            </details>)}
          </div>
        </section>}
      </>}
    </>}
  </main>;
}
