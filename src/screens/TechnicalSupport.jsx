import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import { supportCasePeople } from "../lib/supportCasePeople";
import SupportAccessCaseActions from "../components/SupportAccessCaseActions";
import DailyScenicPhoto from "../components/DailyScenicPhoto";
import { OperationalFileList } from "../components/OperationalFiles";
import {
  canManageSupport, SUPPORT_WORKSPACES, SERVICE_NAMES, SUPPORT_GUIDES,
  supportCategoryLabel, supportCaseGroups, filterSupportCases, supportCasesNeedingMe, supportReportedServiceIssues, supportUnavailableMessage, canRecordSupportOutcome,
} from "../lib/technicalSupport";
import "../role-styles/technical-support.css";
import "../role-styles/technical-support-stage2.css";

function SupportRows({ cases, onSelect, empty = "Nothing requires action here." }) {
  return <div className="ceac-support-rows">
    {!cases.length && <p className="screen-note">{empty}</p>}
    {cases.map((item) => <button type="button" key={item.id}
      className="ceac-support-row ceac-support-case-button" onClick={() => onSelect(item.id)}>
      <span><strong>{item.summary}</strong>
        <small>{item.reporter_name || "Reporter details unavailable"}{item.department_name ? ` · ${item.department_name}` : ""}</small>
        <small>{item.reference || "Reference pending"} · {supportCategoryLabel(item.category)}</small>
      </span>
      <span className="ceac-support-state">{String(item.state).replaceAll("_", " ")}</span>
    </button>)}
  </div>;
}

function CaseDetails({ item, onClose, onRefresh, onUpdate, onClaim, onRelease, me, myId, orgId, busy, error }) {
  const [nextState, setNextState] = useState(item.state);
  const [resolution, setResolution] = useState(item.resolution_summary || "");
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [accessLedger, setAccessLedger] = useState(null);
  const requiresBusinessApproval = item.category === "access_needed";
  const accessReadyToClose = canRecordSupportOutcome(item, "resolved", accessLedger);
  useEffect(() => {
    setNextState(item.state);
    setResolution(item.resolution_summary || "");
  }, [item.id, item.state, item.resolution_summary, item.updated_at]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistory([]);
    setHistoryError(null);
    (async () => {
      try {
        const { data, error: failure } = await supabase.from("support_case_events")
          .select("id,action,note,occurred_at").eq("org_id", orgId).eq("case_id", item.id)
          .order("occurred_at", { ascending: false }).limit(75);
        if (failure) throw failure;
        if (active) setHistory(data || []);
      } catch {
        if (active) setHistoryError("Case history could not be verified.");
      } finally {
        if (active) setHistoryLoading(false);
      }
    })();
    return () => { active = false; };
  }, [orgId, item.id, item.state, item.resolution_summary, item.updated_at, historyRefreshToken]);

  return <section className="ceac-support-detail" aria-labelledby="support-case-title">
    <div className="ceac-support-detail-top">
      <div><p className="ceac-support-eyebrow">{item.reference || "Support case"}</p>
        <h2 id="support-case-title">{item.summary}</h2></div>
      <div className="ceac-support-section-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onRefresh}>Refresh case</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Close details</button>
      </div>
    </div>
    <dl className="ceac-support-case-facts">
      <div><dt>Reported by</dt><dd>{item.reporter_name || "Reporter details unavailable"}</dd></div>
      <div><dt>Department</dt><dd>{item.department_name || "Not recorded with this request"}</dd></div>
      <div><dt>Affected colleague</dt><dd>{item.affected_name || (item.affected_profile_id===item.reported_by ? item.reporter_name : null) || "Not recorded"}</dd></div>
      <div><dt>Submitted</dt><dd>{new Date(item.opened_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}</dd></div>
      <div><dt>Category</dt><dd>{supportCategoryLabel(item.category)}</dd></div>
      <div><dt>Service</dt><dd>{item.affected_service || "Not specified"}</dd></div>
      <div><dt>Impact</dt><dd>{item.impact || "Unspecified"}</dd></div>
      <div><dt>Current status</dt><dd>{String(item.state).replaceAll("_", " ")}</dd></div>
      <div><dt>Assignment</dt><dd>{item.assigned_to === myId ? "Assigned to you" : item.assigned_to ? item.assignee_name || "Assigned to another support member" : "Unassigned"}</dd></div>
    </dl>
    {!item.assigned_to && item.state !== "resolved" && item.state !== "closed" && <button type="button" className="btn btn-ghost" disabled={busy}
      onClick={() => onClaim(item.id)}>{busy ? "Recording..." : "Take this case"}</button>}
    {item.assigned_to === myId && item.state !== "resolved" && item.state !== "closed" &&
      <button type="button" className="btn btn-ghost" disabled={busy}
        onClick={() => onRelease(item.id)}>{busy ? "Recording..." : "Return to unassigned queue"}</button>}
    <h3>What happened</h3>
    <p className="ceac-support-description">{item.description}</p>
    <h3>Record next action</h3>
    {item.assigned_to !== myId && <p role="status" className="ceac-support-unverified">
      Take the unassigned case before editing it. Cases assigned to another technician are read-only here.
    </p>}
    <form className="ceac-support-form" onSubmit={(event) => {
      event.preventDefault();
      onUpdate(item.id, nextState, resolution, item.updated_at, accessLedger);
    }}>
      <label>Case status
        <select disabled={busy || item.assigned_to!==myId} value={nextState} onChange={(event) => setNextState(event.target.value)}>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="waiting_approval">Waiting for business approval</option>
          <option value="resolved" disabled={requiresBusinessApproval && !accessReadyToClose}>Resolved</option>
          <option value="closed" disabled={requiresBusinessApproval && !accessReadyToClose}>Closed</option>
        </select>
      </label>
      {requiresBusinessApproval && !accessReadyToClose && <p className="ceac-support-unverified" role="status">Access requests remain open until independent business approval and attributable technical execution are recorded. The database verifies both before closure.</p>}
      <label>Action or resolution note
        <textarea disabled={busy || item.assigned_to!==myId} rows={3} value={resolution} onChange={(event) => setResolution(event.target.value)}
          maxLength={2000} placeholder="Record factual work completed. Do not include credentials or protected records." />
      </label>
      {error && <p role="alert" className="ceac-support-error">{error}</p>}
      <button className="btn" type="submit" disabled={busy || item.assigned_to !== myId}>{busy ? "Saving..." : "Save case change"}</button>
      <p className="screen-note">Access changes still require separate business approval. This form cannot grant permissions.</p>
    </form>
    {requiresBusinessApproval && <SupportAccessCaseActions item={item} me={me} onLedgerChange={setAccessLedger} />}
    <OperationalFileList key={`${me.org_id}:${me.id}:${item.id}`} contextType="support_case" contextId={item.id} relation="support_evidence"
      canUpload={item.state !== "closed" && item.state !== "resolved"
        && (item.assigned_to === me.id)}
      title="Private case evidence"
      emptyText="No private technical evidence is recorded for this case." />
    <div className="ceac-support-history">
      <h3>Case history</h3>
      {historyLoading && <p role="status">Loading attributable support history...</p>}
      {historyError && <div role="alert" className="ceac-support-error">
        {historyError} <button type="button" className="btn btn-ghost"
          onClick={() => setHistoryRefreshToken((n) => n + 1)}>Try history again</button>
      </div>}
      {!historyLoading && !historyError && !history.length && <p className="screen-note">No verified event history is available.</p>}
      <ol className="ceac-support-history-list">
        {history.map((event) => <li key={event.id}>
          <strong>{event.action.replaceAll("_", " ")}</strong>
          <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })}</time>
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
  const [verifiedScope, setVerifiedScope] = useState(null);
  const readGeneration = useRef(0);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const canManage = canManageSupport(me);
  const currentScope = `${me.org_id}:${me.id}:${canManage ? "support" : "no-support"}`;
  const scopedReady = ready && verifiedScope === currentScope;

  useEffect(() => {
    const generation = ++readGeneration.current;
    let live = true;
    // A role/account transition must not keep an old user's case data visible.
    setReady(false);
    setVerifiedScope(null);
    setMembership(null);
    setCases([]);
    setSelectedId(null);
    setBusy(false);
    setActionError(null);
    setError(null);
    (async () => {
      try {
        if (!canManage) throw new Error("Your account has no Technical Support case-management authority.");
        const { data: membershipData, error: membershipFailure } = await supabase.from("support_team_memberships")
          .select("id,role").eq("org_id", me.org_id).eq("profile_id", me.id)
          .eq("active", true).maybeSingle();
        if (membershipFailure) throw membershipFailure;
        if (!live || generation !== readGeneration.current) return;
        setMembership(membershipData);
        if (!membershipData) return;
        const { data: caseData, error: casesFailure } = await supabase.from("support_cases")
          .select("id,reference,category,summary,description,affected_service,impact,state,reported_by,affected_profile_id,affected_unit_id,assigned_to,opened_at,resolved_at,closed_at,resolution_summary,updated_at")
          .eq("org_id", me.org_id).order("opened_at", { ascending: false }).limit(150);
        if (casesFailure) throw casesFailure;
        const namedCases=await supportCasePeople(supabase,caseData || []);
        if (live && generation === readGeneration.current) setCases(namedCases);
      } catch (failure) {
        if (live && generation === readGeneration.current) setError(supportUnavailableMessage(failure) || humanError(failure, "The Technical Support service cannot be opened. No permissions were changed."));
      } finally {
        if (live && generation === readGeneration.current) { setVerifiedScope(currentScope); setReady(true); }
      }
    })();
    return () => { live = false; readGeneration.current += 1; };
  }, [me.id, me.org_id, canManage]);

  const groups = useMemo(() => supportCaseGroups(cases), [cases]);
  const serviceIssues = useMemo(() => supportReportedServiceIssues(cases), [cases]);
  const needsYou = useMemo(() => supportCasesNeedingMe(cases, me.id), [cases, me.id]);
  // These filters apply only to the latest RLS-authorised cases fetched above;
  // never suggest that an incomplete 150-record window is the full history.
  const deskCases = useMemo(
    () => filterSupportCases(cases, deskQuery, deskStatus),
    [cases, deskQuery, deskStatus],
  );
  const selected = cases.find((item) => item.id === selectedId);

  async function refreshCases() {
    if (busy) return;
    const generation = ++readGeneration.current;
    // Clear previously obtained case data BEFORE rechecking current
    // membership, so a removed member cannot keep browsing a stale list.
    setReady(false);
    setVerifiedScope(null);
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
        .select("id,reference,category,summary,description,affected_service,impact,state,reported_by,affected_profile_id,affected_unit_id,assigned_to,opened_at,resolved_at,closed_at,resolution_summary,updated_at")
        .eq("org_id", me.org_id).order("opened_at", { ascending: false }).limit(150);
      if (casesFailure) throw casesFailure;
      if (generation !== readGeneration.current) return;
      const namedCases=await supportCasePeople(supabase,currentCases || []);
      if (generation !== readGeneration.current) return;
      setCases(namedCases);
      setMembership(currentMembership);
    } catch (failure) {
      if (generation === readGeneration.current) setError(supportUnavailableMessage(failure) || humanError(failure, "The Technical Support queue cannot be refreshed. No case was changed."));
    } finally {
      if (generation === readGeneration.current) { setVerifiedScope(currentScope); setReady(true); }
    }
  }

  async function claimCase(id) {
    if (!canManage || !membership || busy) return;
    const generation = readGeneration.current;
    setBusy(true);
    setActionError(null);
    try {
      // Do not silently seize an already assigned case. RLS/membership and
      // the backend assignment guard independently authorise this transition.
      const { data, error: failure } = await supabase.from("support_cases")
        .update({ assigned_to: me.id }).eq("id", id).eq("org_id", me.org_id)
        .is("assigned_to", null)
        .not("state", "in", "(resolved,closed)")
        .select("id,reference,category,summary,description,affected_service,impact,state,reported_by,affected_profile_id,affected_unit_id,assigned_to,opened_at,resolved_at,closed_at,resolution_summary,updated_at")
        .maybeSingle();
      if (failure) throw failure;
      if (!data) throw new Error("This case is no longer unassigned. Refresh the Help Desk before taking it.");
      if (generation !== readGeneration.current) return;
      setCases((items) => items.map((item) => item.id === id ? {...item,...data} : item));
    } catch (failure) {
      if (generation === readGeneration.current) setActionError(humanError(failure, "The case was not assigned to you."));
    } finally {
      if (generation === readGeneration.current) setBusy(false);
    }
  }

  async function releaseCase(id) {
    if (!canManage || !membership || busy) return;
    const generation = readGeneration.current;
    setBusy(true);
    setActionError(null);
    try {
      const { data, error: failure } = await supabase.from("support_cases")
        .update({ assigned_to: null }).eq("id", id).eq("org_id", me.org_id)
        .eq("assigned_to", me.id)
        .not("state", "in", "(resolved,closed)")
        .select("id,reference,category,summary,description,affected_service,impact,state,reported_by,affected_profile_id,affected_unit_id,assigned_to,opened_at,resolved_at,closed_at,resolution_summary,updated_at")
        .maybeSingle();
      if (failure) throw failure;
      if (!data) throw new Error("This case is no longer yours to release. Refresh before trying again.");
      if (generation !== readGeneration.current) return;
      setCases((items) => items.map((item) => item.id === id ? {...item,...data} : item));
    } catch (failure) {
      if (generation === readGeneration.current) setActionError(humanError(failure, "The case was not released."));
    } finally {
      if (generation === readGeneration.current) setBusy(false);
    }
  }

  async function updateCase(id, state, note, expectedUpdatedAt, accessLedger = null) {
    if (!canManage || !membership || busy) return;
    const generation = readGeneration.current;
    const currentCase = cases.find((item) => item.id === id);
    if (!currentCase) {
      setActionError("The selected case is no longer in the verified Help Desk queue. Refresh before saving.");
      return;
    }
    if (currentCase.assigned_to !== me.id) {
      setActionError("Take ownership of an unassigned case before editing. A colleague's assignment cannot be overwritten here.");
      return;
    }
    if (!canRecordSupportOutcome(currentCase, state, accessLedger)) {
      setActionError("An access request cannot be marked fulfilled here without the approved business-authority evidence and verified execution path.");
      return;
    }
    if (!expectedUpdatedAt) {
      setActionError("The case revision cannot be verified. Refresh the Help Desk before saving.");
      return;
    }
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
        .eq("updated_at", expectedUpdatedAt)
        .eq("assigned_to", me.id)
        .select("id,reference,category,summary,description,affected_service,impact,state,reported_by,affected_profile_id,affected_unit_id,assigned_to,opened_at,resolved_at,closed_at,resolution_summary,updated_at")
        .maybeSingle();
      if (failure) throw failure;
      if (!data) throw new Error("The case changed since you opened it. Refresh the Help Desk before saving.");
      if (generation !== readGeneration.current) return;
      setCases((items) => items.map((item) => item.id === id ? {...item,...data} : item));
    } catch (failure) {
      if (generation === readGeneration.current) setActionError(humanError(failure, "The case change was not recorded. No further action was taken."));
    } finally {
      if (generation === readGeneration.current) setBusy(false);
    }
  }

  return <main className="body ceac-support-page ceac-support-operations">
    <header className="ceac-support-heading s2-support-heading s2-landscape-hero"><DailyScenicPhoto />
      <p className="ceac-support-eyebrow">IT services</p>
      <h1>Technical Support</h1>
      <p>Track requests, record responses and help colleagues get back to work.</p>
    </header>

    {!scopedReady && <p role="status" aria-busy="true">Checking your Technical Support authority...</p>}
    {scopedReady && error && <div className="ceac-support-error" role="alert">
      {error} <button type="button" className="btn btn-ghost" onClick={refreshCases}>Try again</button>
    </div>}
    {scopedReady && !error && !membership && <div className="ceac-support-empty" role="status">
      You do not have an active Technical Support team membership. Contact People Administration to complete the approved transition. No support queue is visible.
    </div>}
    {scopedReady && !error && membership && <>
      <nav aria-label="Technical Support workspaces" className="ceac-support-nav">
        {SUPPORT_WORKSPACES.map((item) => <button key={item.id} type="button"
          aria-current={workspace === item.id ? "page" : undefined}
          className={workspace === item.id ? "is-active" : ""}
          onClick={() => { setWorkspace(item.id); setSelectedId(null); setActionError(null); }}>
          {item.label}
        </button>)}
      </nav>

      {selected && workspace !== "help-desk" ? <CaseDetails key={selected.id} item={selected} busy={busy} error={actionError}
        me={me} myId={me.id} orgId={me.org_id} onClaim={claimCase} onRelease={releaseCase}
        onClose={() => { setSelectedId(null); setActionError(null); }} onRefresh={refreshCases} onUpdate={updateCase} /> : <>
        {workspace === "home" && <div className="s2-support-home">
          <section className="s2-support-summary" aria-label="Recorded Technical Support caseload">
            <div><span>Needs action</span><strong>{needsYou.length}</strong><small>Open or assigned to you</small></div>
            <div><span>Waiting for approval</span><strong>{groups.waitingApproval.length}</strong><small>Recorded approval queue</small></div>
            <div><span>Recently resolved</span><strong>{groups.recentlyResolved.length}</strong><small>Recorded resolution cases</small></div>
          </section>
          <div className="ceac-support-layout">
          <section className="ceac-support-main">
            <h2>Needs you</h2>
            <p className="screen-note">Open cases awaiting triage or currently assigned to you. Other technicians’ assigned cases stay in Help Desk.</p>
            <SupportRows cases={needsYou} onSelect={setSelectedId} />
          </section>
          <aside className="ceac-support-side">
            <h2>Waiting for approval</h2>
            <SupportRows cases={groups.waitingApproval} onSelect={setSelectedId}
              empty="No requests are recorded as waiting for approval." />
            <h2>Recently resolved</h2>
            <SupportRows cases={groups.recentlyResolved} onSelect={setSelectedId}
              empty="No recently resolved requests." />
          </aside>
          </div>
        </div>}
        {workspace === "help-desk" && <div className={selected ? "s2-support-split has-inspector" : "s2-support-split"}>
          <section className="ceac-support-main">
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
          </section>
          {selected && <aside className="s2-support-inspector" aria-label="Selected Technical Support case">
            <CaseDetails key={selected.id} item={selected} busy={busy} error={actionError}
              me={me} myId={me.id} orgId={me.org_id} onClaim={claimCase} onRelease={releaseCase}
              onClose={() => { setSelectedId(null); setActionError(null); }} onRefresh={refreshCases} onUpdate={updateCase} />
          </aside>}
        </div>}
        {workspace === "people-access" && <section className="ceac-support-main">
          <h2>People & Access</h2>
          <p className="screen-note">Investigate account and approved access requests without inspecting confidential employee or payroll information.</p>
          <SupportRows cases={groups.access} onSelect={setSelectedId}
            empty="No account or access cases were reported." />
          <div className="ceac-support-unverified">
            <strong>Business-approved access assistance is recorded per case.</strong>
            <p>Unit Managers and People Administration decide requests within their existing business authority. Assigned technicians may record approved assistance and evidence, but cannot grant permissions or approve their own requests.</p>
          </div>
        </section>}
        {workspace === "system" && <section className="ceac-support-main">
          <h2>Is CEAC working?</h2>
          <p className="screen-note">Service health remains Not verified until trustworthy provider telemetry is connected. Open case counts below come from recorded reports, not live infrastructure checks.</p>
          <div className="ceac-support-rows">
            {serviceIssues.map(({ service, reportCount, health }) => <div key={service} className="ceac-support-row">
              <strong>{service}</strong><span className="ceac-support-state">{health}
                {reportCount > 0 ? ` · ${reportCount} unresolved reported ${reportCount === 1 ? "case" : "cases"}` : ""}
              </span>
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
