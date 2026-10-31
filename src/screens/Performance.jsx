import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import StructuredAppraisalRatings from "../components/StructuredAppraisalRatings";
import HRProjectContributionQueue from "../components/HRProjectContributionQueue";
import FormalReviewProjectDrafts from "../components/FormalReviewProjectDrafts";
import { includeProjectAssessment } from "../lib/projectAssessmentDraft";
import { EmptyState, FieldGroup, LoadingState, Pill, ProductNotice, Sheet } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { Avatar, ComposerDrawer, SegmentedControl } from "../experience-v2/components";
import { WorkPageHeader } from "../experience-v2/work-family/WorkFamilyV2";
import { PersonalPageHeader } from "../experience-v2/personal-family/PersonalFamilyV2";
import "./premium-personal.css";

const CATEGORY_LABELS = {
  work: "Work outcomes",
  objective: "Owned objectives",
  feedback: "Feedback",
  activity_context: "Activity context",
  learning_history: "Existing training history",
};

const STATUS_LABELS = {
  evidence: "Evidence ready",
  reflection_submitted: "Reflection submitted",
  manager_draft: "Manager assessment recorded",
  conversation_recorded: "Conversation recorded",
  shared: "Shared",
  closed: "Closed",
};

function day(value) {
  if (!value) return "Date not recorded";
  return new Date(value + (String(value).length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function sentence(value = "") {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function latestEntry(entries, type) {
  const rows = entries.filter((entry) => entry.entry_type === type);
  const superseded = new Set(rows.map((entry) => entry.supersedes_id).filter(Boolean));
  return [...rows].filter((entry) => !superseded.has(entry.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
}

function latestPlan(plans) {
  const superseded = new Set(plans.map((plan) => plan.supersedes_id).filter(Boolean));
  return [...plans].filter((plan) => !superseded.has(plan.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
}

function evidenceDetail(item) {
  const d = item.detail || {};
  if (item.category === "work") {
    const timing = d.due_at ? (new Date(d.completed_at) <= new Date(d.due_at) ? "Completed on or before the recorded due time" : "Completed after the recorded due time") : "No due date was recorded";
    const review = d.first_time_approved === true ? "Approved without a return" : d.first_time_approved === false ? "Returned before final approval" : "No first-review result recorded";
    return [d.ref, timing, review].filter(Boolean).join(" · ");
  }
  if (item.category === "objective") {
    if (d.measurement_kind === "numeric") {
      return [sentence(d.status), d.current_value !== undefined && d.target_value !== undefined ? `${d.current_value} ${d.target_unit || ""} recorded · target ${d.target_value} ${d.target_unit || ""}` : null].filter(Boolean).join(" · ");
    }
    return [sentence(d.status), d.statement].filter(Boolean).join(" · ");
  }
  if (item.category === "feedback") return d.note || "Feedback record";
  if (item.category === "activity_context") {
    const started = d.started_at ? new Date(d.started_at).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }) : "Start not recorded";
    return `${started}${d.place ? " · " + d.place : ""} · activity context only, not a performance measure`;
  }
  if (item.category === "learning_history") return [d.completed_on ? "Completed " + day(d.completed_on) : null, d.note].filter(Boolean).join(" · ");
  return "";
}

function CaseState({ status }) {
  const tone = status === "shared" || status === "closed" ? "green"
    : status === "conversation_recorded" || status === "manager_draft" ? "amber"
    : "grey";
  return <Pill tone={tone}>{STATUS_LABELS[status] || sentence(status)}</Pill>;
}

function ReviewForm({ admin, error, resetError, children, ...props }) {
  useEffect(() => { if (admin) resetError(null); }, [admin, resetError]);
  const Dialog = admin ? ComposerDrawer : Sheet;
  return <Dialog {...props}>
    {admin && error && <ProductNotice tone="error" title="Review change not recorded">{error}</ProductNotice>}
    {children}
  </Dialog>;
}

export default function Performance({ me }) {
  const hrReleaseAdmin = Boolean(me.is_admin) && (me.capabilities || []).includes("people.manage");
  const mayPublishAssignedHrHead = (review) => Boolean(
    me.is_exec && !me.is_admin && me.job_title?.trim().toLowerCase() === "group pastor"
    && review?.profiles?.is_admin && review.profile_id !== me.id
    && review.manager_id === me.id && review.reviewer_assignment_reason
  );
  const orgPerformanceAdmin = hrReleaseAdmin || (me.capability_grants || []).some((grant) =>
    grant.capability === "performance.admin" && !grant.scope_unit_id
  );
  const [cycles, setCycles] = useState([]);
  const [cases, setCases] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [reviewStep,setReviewStep]=useState("prepare");
  useEffect(()=>{setReviewStep("prepare");},[selectedCaseId]);
  const [evidence, setEvidence] = useState([]);
  const [entries, setEntries] = useState([]);
  const [releaseQueue, setReleaseQueue] = useState([]);
  const [releaseQueueAvailable, setReleaseQueueAvailable] = useState(true);
  const [releaseDecisionNote, setReleaseDecisionNote] = useState("");
  const [plans, setPlans] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [feedbackResponses, setFeedbackResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [caseLoading, setCaseLoading] = useState(false);
  // Selected-review queries can overlap when a person changes before an earlier fetch finishes.
  // Only the newest request may update this review or its loading/error state.
  const caseRequestSerial = useRef(0);
  const baseRequestSerial = useRef(0);
  const selectedCaseRef = useRef("");
  const selectedCycleRef = useRef("");
  const requestedPersonRef = useRef(new URLSearchParams(window.location.search).get("reviewPerson"));
  const reviewPanelRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [cycleFlow, setCycleFlow] = useState(false);
  const [cycleStep, setCycleStep] = useState(1);
  const [cycleName, setCycleName] = useState("");
  const [cycleStart, setCycleStart] = useState("");
  const [cycleEnd, setCycleEnd] = useState("");
  const [cycleReason, setCycleReason] = useState("");
  const [closeCycleFlow, setCloseCycleFlow] = useState(false);
  const [closeCycleReason, setCloseCycleReason] = useState("");

  const [reviewerId, setReviewerId] = useState("");
  const [reviewerReason, setReviewerReason] = useState("");
  const [reflection, setReflection] = useState("");
  const [assessment, setAssessment] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [conversation, setConversation] = useState("");
  const [staffReply, setStaffReply] = useState("");

  const [planFlow, setPlanFlow] = useState(false);
  const [planStep, setPlanStep] = useState(1);
  const [planFocus, setPlanFocus] = useState("");
  const [planOutcome, setPlanOutcome] = useState("");
  const [planSteps, setPlanSteps] = useState("");
  const [planStart, setPlanStart] = useState("");
  const [planTarget, setPlanTarget] = useState("");
  const [planState, setPlanState] = useState("active");
  const [planReason, setPlanReason] = useState("");

  const [feedbackKind, setFeedbackKind] = useState("observation");
  const [feedbackDate, setFeedbackDate] = useState(new Date().toISOString().slice(0,10));
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackReplyFor, setFeedbackReplyFor] = useState("");
  const [feedbackReply, setFeedbackReply] = useState("");

  useEffect(() => { loadBase(); }, [me.id]);
  useEffect(() => {
    if (selectedCaseId) loadCase(selectedCaseId);
    else {
      caseRequestSerial.current += 1;
      setCaseLoading(false);
      setEvidence([]); setEntries([]); setPlans([]); setFeedback([]); setFeedbackResponses([]);
      setReleaseQueue([]); setReleaseQueueAvailable(true); setReleaseDecisionNote("");
    }
  }, [selectedCaseId]);

  async function loadBase() {
    const baseSerial = ++baseRequestSerial.current;
    setLoading(true); setError(null);
    try {
      const requests = [
        supabase.from("appraisal_cycles").select("*").eq("org_id", me.org_id).order("starts_on", { ascending:false }),
        supabase.from("appraisals").select("id,org_id,cycle_id,profile_id,manager_id,unit_id,status,created_at,shared_at,reviewer_assignment_reason,profiles!appraisals_profile_id_fkey(full_name,email,job_title,is_admin,is_exec),reviewer:profiles!appraisals_manager_id_fkey(full_name,email),units(name)").eq("org_id", me.org_id).order("created_at", { ascending:false }),
      ];
      if (orgPerformanceAdmin) {
        requests.push(
          supabase.from("profiles").select("id,full_name,email,is_admin,is_exec,job_title,active").eq("org_id", me.org_id).eq("active", true).order("full_name"),
          supabase.from("unit_memberships").select("profile_id,unit_id,role").eq("org_id", me.org_id).eq("role","manager")
        );
      }
      const results = await Promise.all(requests);
      if (baseSerial !== baseRequestSerial.current) return;
      const failed = results.find((row) => row.error);
      if (failed) throw failed.error;
      const cycleRows = results[0].data || [];
      const caseRows = results[1].data || [];
      setCycles(cycleRows);
      setCases(caseRows);
      if (orgPerformanceAdmin) {
        setProfiles(results[2].data || []);
        setMemberships(results[3].data || []);
      }
      // An in-flight refresh must not undo an employee/cycle selected after it started.
      const linkedReview = requestedPersonRef.current
        ? caseRows.find(row => row.profile_id === requestedPersonRef.current && cycleRows.some(cycle => cycle.id === row.cycle_id && cycle.status === "open"))
        : null;
      if (linkedReview) {
        selectedCaseRef.current = linkedReview.id;
        selectedCycleRef.current = linkedReview.cycle_id;
      }
      requestedPersonRef.current = null;
      const requestedCycle = selectedCycleRef.current;
      const cycleId = requestedCycle && cycleRows.some((row) => row.id === requestedCycle)
        ? requestedCycle
        : cycleRows[0]?.id || "";
      selectedCycleRef.current = cycleId;
      setSelectedCycleId(cycleId);
      const filtered = cycleId ? caseRows.filter((row) => row.cycle_id === cycleId) : caseRows;
      const requestedCase = selectedCaseRef.current;
      const caseId = requestedCase && filtered.some((row) => row.id === requestedCase)
        ? requestedCase
        : filtered[0]?.id || caseRows[0]?.id || "";
      selectedCaseRef.current = caseId;
      setSelectedCaseId(caseId);
    } catch (err) {
      if (baseSerial === baseRequestSerial.current)
        setError(humanError(err, "Reviews & development could not finish loading."));
    } finally {
      if (baseSerial === baseRequestSerial.current) setLoading(false);
    }
  }

  async function loadCase(caseId) {
    const requestSerial = ++caseRequestSerial.current;
    setCaseLoading(true); setError(null);
    const selected = cases.find((row) => row.id === caseId);
    if (!selected) {
      if (requestSerial === caseRequestSerial.current) setCaseLoading(false);
      return;
    }
    try {
      const [e, en, p, f, fr] = await Promise.all([
        supabase.from("appraisal_evidence_items").select("*").eq("appraisal_id", caseId).order("occurred_on", { ascending:false, nullsFirst:false }),
        supabase.from("appraisal_entries").select("*, author:profiles!appraisal_entries_created_by_fkey(full_name)").eq("appraisal_id", caseId).order("created_at", { ascending:true }),
        supabase.from("development_plan_versions").select("*").eq("appraisal_id", caseId).order("created_at", { ascending:true }),
        supabase.from("feedback_notes").select("id,profile_id,author_id,note,kind,occurred_on,created_at,author:profiles!feedback_notes_author_id_fkey(full_name)").eq("profile_id", selected.profile_id).order("created_at", { ascending:false }),
        supabase.from("feedback_responses").select("*").eq("profile_id", selected.profile_id).order("created_at", { ascending:true }),
      ]);
      // A previous employee/cycle may finish after this request. Ignore its stale results.
      if (requestSerial !== caseRequestSerial.current) return;
      const failed = [e,en,p,f,fr].find((row) => row.error);
      if (failed) throw failed.error;
      const releaseResult = hrReleaseAdmin || mayPublishAssignedHrHead(selected)
        ? await supabase.from("performance_review_release_requests")
            .select("id,requested_assessment_id,requested_by,request_reason,requested_at,state")
            .eq("org_id",me.org_id).eq("appraisal_id",caseId).eq("state","pending")
        : { data:[],error:null };
      if (requestSerial !== caseRequestSerial.current) return;
      const releaseMissing = ["42P01","PGRST205"].includes(releaseResult.error?.code)
        && /performance_review_release_requests/i.test(releaseResult.error?.message || "");
      if (releaseResult.error && !releaseMissing) throw releaseResult.error;
      setReleaseQueueAvailable(!releaseMissing);
      setReleaseQueue(releaseMissing ? [] : (releaseResult.data || []));
      setEvidence(e.data || []);
      setEntries(en.data || []);
      setPlans(p.data || []);
      setFeedback(f.data || []);
      setFeedbackResponses(fr.data || []);
      const reflectionEntry = latestEntry(en.data || [], "employee_reflection");
      const assessmentEntry = latestEntry(en.data || [], "manager_assessment");
      const conversationEntry = latestEntry(en.data || [], "conversation_record");
      setReflection(reflectionEntry?.body || "");
      setAssessment(assessmentEntry?.body || "");
      setConversation(conversationEntry?.body || "");
      const plan = latestPlan(p.data || []);
      setPlanFocus(plan?.focus || "");
      setPlanOutcome(plan?.desired_outcome || "");
      setPlanSteps(plan?.next_steps || "");
      setPlanStart(plan?.starts_on || "");
      setPlanTarget(plan?.target_on || "");
      setPlanState(plan?.state || "active");
      setReviewerId(selected.manager_id || "");
    } catch (err) {
      if (requestSerial === caseRequestSerial.current)
        setError(humanError(err, "This review could not finish loading."));
    } finally {
      if (requestSerial === caseRequestSerial.current) setCaseLoading(false);
    }
  }

  const selectedCycle = cycles.find((row) => row.id === selectedCycleId) || null;
  const cycleCases = useMemo(() => selectedCycleId ? cases.filter((row) => row.cycle_id === selectedCycleId) : cases, [cases,selectedCycleId]);
  const selectedCase = cases.find((row) => row.id === selectedCaseId) || null;
  const isSelf = selectedCase?.profile_id === me.id;
  const isReviewer = selectedCase?.manager_id === me.id;
  const assignedPastorPublication = mayPublishAssignedHrHead(selectedCase);
  const canDecidePublication = !isSelf && (hrReleaseAdmin || assignedPastorPublication);
  const currentReflection = latestEntry(entries, "employee_reflection");
  const currentAssessment = latestEntry(entries, "manager_assessment");
  const currentReleaseRequest = releaseQueue.find((request) =>
    request.requested_assessment_id === currentAssessment?.id
  ) || null;
  const currentConversation = latestEntry(entries, "conversation_record");
  const currentPlan = latestPlan(plans);

  const reviewerCandidates = selectedCase ? profiles.filter((profile) => {
    if (profile.id === selectedCase.profile_id) return false;
    if (selectedCase.profiles?.is_admin) {
      // The owner's single-case exception: Group Pastor may be assigned HR
      // Head's appraisal. Identity/permission is revalidated on the server.
      return profile.is_exec && !profile.is_admin
        && profile.job_title?.trim().toLowerCase() === "group pastor";
    }
    return profile.is_admin || memberships.some((membership) =>
      membership.profile_id === profile.id && membership.unit_id === selectedCase.unit_id && membership.role === "manager"
    );
  }) : [];

  const evidenceGroups = Object.keys(CATEGORY_LABELS).map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    rows: evidence.filter((item) => item.category === key),
  })).filter((group) => group.rows.length);

  async function rpc(name, args, success) {
    setBusy(true); setError(null); setNotice(null);
    const { error: rpcError } = await supabase.rpc(name, args);
    setBusy(false);
    if (rpcError) { setError(humanError(rpcError, "That change could not be recorded.")); return false; }
    setNotice(success);
    await loadBase();
    if (selectedCaseRef.current) await loadCase(selectedCaseRef.current);
    return true;
  }

  async function openCycle() {
    const ok = await rpc("open_performance_review_cycle", {
      p_name: cycleName.trim(),
      p_starts_on: cycleStart,
      p_ends_on: cycleEnd,
      p_reason: cycleReason.trim(),
    }, "Review period opened and factual evidence packs assembled.");
    if (ok) {
      setCycleFlow(false); setCycleStep(1); setCycleName(""); setCycleStart(""); setCycleEnd(""); setCycleReason("");
    }
  }

  async function closeCycle() {
    if (!selectedCycle) return;
    const ok = await rpc("close_performance_review_cycle", {
      p_cycle_id: selectedCycle.id,
      p_reason: closeCycleReason.trim(),
    }, "Review period closed.");
    if (ok) {
      setCloseCycleFlow(false);
      setCloseCycleReason("");
    }
  }

  async function assignReviewer() {
    if (!selectedCase) return;
    const ok = await rpc("assign_performance_reviewer", {
      p_appraisal_id: selectedCase.id,
      p_reviewer_id: reviewerId,
      p_reason: reviewerReason.trim(),
    }, "Reviewer assignment recorded.");
    if (ok) setReviewerReason("");
  }

  async function recordEntry(type, body, prior, success) {
    if (!selectedCase) return;
    await rpc("record_appraisal_entry", {
      p_appraisal_id: selectedCase.id,
      p_entry_type: type,
      p_body: body.trim(),
      p_supersedes_id: prior?.id || null,
    }, success);
  }

  async function refreshEvidence() {
    if (!selectedCase) return;
    await rpc("refresh_performance_evidence", { p_appraisal_id: selectedCase.id }, "Evidence pack checked for new recorded rows.");
  }

  async function decideHRRelease(approved) {
    const decisionNote = releaseDecisionNote.trim();
    if (!canDecidePublication || !currentReleaseRequest
        || (!approved && decisionNote.length < 8)
        || (decisionNote && decisionNote.length < 8)) return;
    if (currentReleaseRequest.requested_by === me.id && !assignedPastorPublication) {
      setError("An independent HR officer must authorise assessment publication.");
      return;
    }
    const confirmed = await rpc("performance_hr_decide_release", {
      p_request_id:currentReleaseRequest.id,
      p_approve:approved,
      p_reason:decisionNote || "Assessment reviewed and approved for publication.",
    }, assignedPastorPublication
      ? (approved ? "Group Pastor approved publication of the assigned HR-head assessment version." : "Group Pastor declined publication of the assigned HR-head assessment version.")
      : approved
      ? "HR approved publication of this manager assessment version."
      : "HR declined publication; the manager assessment remains restricted.");
    if (confirmed) setReleaseDecisionNote("");
  }

  async function requestRelease() {
    if (!selectedCase || releaseReason.trim().length < 8) return;
    const submitted = await rpc("performance_request_release", {
      p_appraisal_id: selectedCase.id,
      p_reason: releaseReason.trim(),
    }, assignedPastorPublication ? "The exact HR-head assessment version is ready for your separate publication decision." : "The manager's assessment release request was recorded for HR review. The employee cannot see the unpublished manager narrative.");
    if (submitted) setReleaseReason("");
  }

  async function recordPlan() {
    if (!selectedCase) return;
    const ok = await rpc("record_development_plan_version", {
      p_appraisal_id: selectedCase.id,
      p_focus: planFocus.trim(),
      p_desired_outcome: planOutcome.trim(),
      p_next_steps: planSteps.trim(),
      p_starts_on: planStart || null,
      p_target_on: planTarget || null,
      p_state: planState,
      p_reason: planReason.trim(),
      p_supersedes_id: currentPlan?.id || null,
    }, currentPlan ? "Development plan revision recorded." : "Development plan recorded.");
    if (ok) { setPlanFlow(false); setPlanStep(1); setPlanReason(""); }
  }

  async function recordFeedback() {
    if (!selectedCase) return;
    const ok = await rpc("record_performance_feedback", {
      p_profile_id: selectedCase.profile_id,
      p_kind: feedbackKind,
      p_note: feedbackNote.trim(),
      p_occurred_on: feedbackDate,
      p_work_item_id: null,
      p_project_id: null,
      p_strategy_node_id: null,
    }, "Visible feedback recorded.");
    if (ok) setFeedbackNote("");
  }

  async function replyFeedback(feedbackId) {
    const ok = await rpc("respond_to_performance_feedback", {
      p_feedback_note_id: feedbackId,
      p_response: feedbackReply.trim(),
    }, "Your feedback response was recorded.");
    if (ok) { setFeedbackReplyFor(""); setFeedbackReply(""); }
  }

  if (loading) return <div className="body"><LoadingState label="Loading reviews & development…" /></div>;

  const personalReview = !orgPerformanceAdmin && !me.is_admin;
  const reviewIntro = personalReview
    ? <PersonalPageHeader
        eyebrow="My Hub"
        title="Reviews & development"
        description="See your work, add reflections and review feedback from your manager. Your progress is discussed with people, not calculated as a score."
        statusLabel="Your reviews"
      />
    : me.is_admin ? <WorkPageHeader
        eyebrow="People development"
        title="Reviews & development"
        description="Recorded evidence, human assessments and development plans. Reviewers enter ratings with explanations; CEAC OS does not calculate employee scores or rankings."
      /> : <div style={{ paddingTop:26 }}>
        <div className="eyebrow">Evidence-first people development</div>
        <h1 className="h1">Reviews & development</h1>
        <p className="screen-note">{hrReleaseAdmin ? "CEAC OS assembles recorded evidence. People write the reflection, assessment, conversation record and development plan. Reviewers enter ratings with explanations; the system does not calculate employee scores or rankings." : "CEAC OS assembles recorded evidence. People write the reflection, assessment, conversation record and development plan. There is no employee score or ranking."}</p>
      </div>;

  return <div className={`body performance-page ${personalReview ? "ev2-personal-page ev2-personal-review ceac-premium-review" : ""}`.trim()}>
    {reviewIntro}

    {error && <ProductNotice tone="error" title="Reviews & development">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Recorded">{notice}</ProductNotice>}

    {orgPerformanceAdmin && <section className="performance-admin-bar">
      <div>
        <span className="eyebrow">Administration</span>
        <strong>Review periods</strong>
        <small>{hrReleaseAdmin ? "Quarterly formal reviews require reviewer-entered ratings and explanations. Monthly ratings are optional. Choose the evidence dates for the review period." : "Open a period when CEAC is ready to review a defined date range. No frequency is assumed."}</small>
      </div>
      <div className="performance-admin-actions">
        {selectedCycle?.status === "open" && <button className="btn btn-ghost btn-sm" onClick={() => setCloseCycleFlow(true)}>Close selected period</button>}
        <button className="btn btn-sm" onClick={() => setCycleFlow(true)}>Open review period</button>
      </div>
    </section>}

    {cycles.length > 0 && <div className="performance-cycle-strip" aria-label="Review periods">
      {cycles.map((cycle) => <button key={cycle.id} className={selectedCycleId === cycle.id ? "on" : ""} onClick={() => {
        selectedCycleRef.current = cycle.id;
        setSelectedCycleId(cycle.id);
        const first = cases.find((row) => row.cycle_id === cycle.id);
        selectedCaseRef.current = first?.id || "";
        setSelectedCaseId(first?.id || "");
      }}>
        <strong>{cycle.name}</strong>
        <span>{day(cycle.starts_on)} → {day(cycle.ends_on)}</span>
        <small>{sentence(cycle.status)}</small>
      </button>)}
    </div>}

    {!cycles.length && <EmptyState title={orgPerformanceAdmin ? "No review period yet" : "No review has been opened for you"}>{orgPerformanceAdmin ? "Open the first period when CEAC is ready. The system will assemble evidence from recorded work." : "When Administration opens a review period, your authorised review will appear here."}</EmptyState>}

    {selectedCycle && <div className="performance-layout">
      <aside className="performance-case-list">
        <div className="sec"><span>People in this period</span><span>{cycleCases.length}</span></div>
        {cycleCases.length === 0 && <p className="ceac-review-empty">No reviews have been assigned in this period yet.</p>}
        {cycleCases.map((review) => <button key={review.id} className={"performance-case-row"+(selectedCaseId === review.id ? " on" : "")} onClick={() => { selectedCaseRef.current = review.id; setSelectedCaseId(review.id); }}>
          <Avatar name={review.profiles?.full_name} size="sm" />
          <span><strong>{review.profiles?.full_name || "Employee"}</strong><small>{review.units?.name || "Unit not recorded"} · {review.reviewer?.full_name ? "Reviewer: " + review.reviewer.full_name : "Reviewer not assigned"}</small></span>
          <CaseState status={review.status} />
        </button>)}
      </aside>

      <section className="performance-review" ref={reviewPanelRef} tabIndex={-1} aria-label="Selected formal review">
        {!selectedCase ? <EmptyState title="Choose a review">Open a person to inspect the evidence and review record.</EmptyState> : caseLoading ? <LoadingState label="Opening review…" /> : <>
          <header className="performance-person-header">
            <Avatar name={selectedCase.profiles?.full_name} size="lg" />
            <div><span className="eyebrow">{selectedCase.units?.name || "Unit not recorded"}</span><h2>{selectedCase.profiles?.full_name}</h2><p>{selectedCase.profiles?.job_title || "Position not recorded"}</p></div>
            <CaseState status={selectedCase.status} />
          </header>

          {me.is_admin&&<SegmentedControl ariaLabel="Review stages" value={reviewStep} onChange={setReviewStep} items={[{value:"prepare",label:"1 · Prepare"},{value:"assessment",label:"2 · Assessment"},{value:"publication",label:"3 · Publication"},{value:"response",label:"4 · Response"}]}/>}
          <div hidden={me.is_admin&&reviewStep!=="prepare"}>
          {!selectedCase.manager_id && <ProductNotice tone="attention" title="Reviewer not assigned">Administration must assign an authorised reviewer. The evidence remains visible to the employee.</ProductNotice>}

          {orgPerformanceAdmin && <section className="card performance-authority-card">
            <div className="sec" style={{ marginTop:0 }}><span>Review responsibility</span></div>
            <FieldGroup label="Reviewer">
              <select className="field" aria-label="Performance reviewer" value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}>
                <option value="">Choose reviewer</option>
                {reviewerCandidates.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}{profile.is_admin ? " · Administration" : profile.is_exec ? " · Group Pastor · assigned review only" : ""}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Reason for assignment"><textarea className="field" aria-label="Reviewer assignment reason" rows="2" value={reviewerReason} onChange={(event) => setReviewerReason(event.target.value)} placeholder="Why this person is responsible for the review" /></FieldGroup>
            <button className="btn btn-sm" disabled={busy || !reviewerId || !reviewerReason.trim()} onClick={assignReviewer}>Record reviewer</button>
          </section>}

          <div className="performance-section-head">
            <div><span className="eyebrow">Evidence pack</span><h3>Recorded facts in this review period</h3></div>
            {(isReviewer || orgPerformanceAdmin) && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={refreshEvidence}>Check for new records</button>}
          </div>
          <p className="screen-note">Activity sessions are shown only as context. Missing records do not automatically mean absence, low effort or poor performance.</p>
          {evidenceGroups.map((group) => <details className="performance-evidence-group" key={group.key} open={group.key !== "activity_context"}>
            <summary><strong>{group.label}</strong><span>{group.rows.length} record{group.rows.length === 1 ? "" : "s"}</span></summary>
            <div>
              {group.rows.map((item) => <article key={item.id} className="performance-evidence-row">
                <div><strong>{item.label}</strong><small>{item.occurred_on ? day(item.occurred_on) : "Date not recorded"}</small></div>
                <p>{evidenceDetail(item)}</p>
              </article>)}
            </div>
          </details>)}
          {!evidence.length && <EmptyState compact title="No evidence rows in this period">CEAC OS will not create placeholder evidence. Review the date range or record the work first.</EmptyState>}

          </div>
          <div hidden={me.is_admin&&reviewStep!=="assessment"}>
          <div className="performance-section-head"><div><span className="eyebrow">Employee voice</span><h3>Your reflection</h3></div></div>
          {isSelf ? <>
            <FieldGroup label={currentReflection ? "Revise your reflection" : "Your reflection"} hint="Write what happened, what you learned and what you need next.">
              <textarea className="field" aria-label="Employee reflection" rows="5" value={reflection} onChange={(event) => setReflection(event.target.value)} />
            </FieldGroup>
            <button className="btn wide-auto" disabled={busy || reflection.trim().length < 3} onClick={() => recordEntry("employee_reflection", reflection, currentReflection, currentReflection ? "Reflection revision recorded." : "Reflection recorded.")}>{currentReflection ? "Record reflection revision" : "Submit reflection"}</button>
          </> : currentReflection ? <div className="card performance-narrative"><p>{currentReflection.body}</p><small>Recorded {new Date(currentReflection.created_at).toLocaleString("en-GB")}</small></div> : <div className="card small">No employee reflection has been recorded yet.</div>}
          {entries.filter((entry) => entry.entry_type === "employee_reflection").length > 1 && <details className="performance-history">
            <summary>Reflection history · {entries.filter((entry) => entry.entry_type === "employee_reflection").length} versions</summary>
            {entries.filter((entry) => entry.entry_type === "employee_reflection").map((entry) => <div key={entry.id}><strong>{entry.body}</strong><span>{new Date(entry.created_at).toLocaleString("en-GB")}</span></div>)}
          </details>}

          <div className="performance-section-head"><div><span className="eyebrow">Reviewer narrative</span><h3>Manager assessment</h3></div></div>
          {currentAssessment && <div className="card performance-narrative"><p>{currentAssessment.body}</p><small>{currentAssessment.author?.full_name || "Reviewer"} · {new Date(currentAssessment.created_at).toLocaleString("en-GB")}</small></div>}
          {isReviewer && <>
            <FormalReviewProjectDrafts key={selectedCase.id} me={me} review={selectedCase} cycle={selectedCycle}
              disabled={busy || caseLoading} onInclude={note => setAssessment(body => includeProjectAssessment(body, note))} />
            <FieldGroup label={currentAssessment ? "Record a revised assessment" : "Manager assessment"} hint="Narrative judgement only. Do not add a score, rank or invented percentage.">
              <textarea className="field" aria-label="Manager assessment" rows="5" value={assessment} onChange={(event) => setAssessment(event.target.value)} />
            </FieldGroup>
            <button className="btn wide-auto" disabled={busy || assessment.trim().length < 3} onClick={() => recordEntry("manager_assessment", assessment, currentAssessment, currentAssessment ? "Assessment revision recorded." : "Manager assessment recorded.")}>{currentAssessment ? "Record assessment revision" : "Record assessment"}</button>
          </>}
          {!currentAssessment && !isReviewer && <div className="card small">No manager assessment has been recorded yet.</div>}
          {entries.filter((entry) => entry.entry_type === "manager_assessment").length > 1 && <details className="performance-history">
            <summary>Assessment history · {entries.filter((entry) => entry.entry_type === "manager_assessment").length} versions</summary>
            {entries.filter((entry) => entry.entry_type === "manager_assessment").map((entry) => <div key={entry.id}><strong>{entry.body}</strong><span>{entry.author?.full_name || "Reviewer"} · {new Date(entry.created_at).toLocaleString("en-GB")}</span></div>)}
          </details>}

          <StructuredAppraisalRatings key={selectedCase.id} me={me} review={selectedCase} cycle={selectedCycle}
             evidence={evidence} assessment={currentAssessment} isReviewer={isReviewer}
             isHR={hrReleaseAdmin} onSaved={() => loadCase(selectedCase.id)} />

           <div className="performance-section-head"><div><span className="eyebrow">Human review</span><h3>Review conversation</h3></div></div>
          {currentConversation && <div className="card performance-narrative"><p>{currentConversation.body}</p><small>{currentConversation.author?.full_name || "Reviewer"} · {new Date(currentConversation.created_at).toLocaleString("en-GB")}</small></div>}
          {isReviewer && <>
            <FieldGroup label={currentConversation ? "Revise conversation record" : "What was discussed and agreed?"}>
              <textarea className="field" aria-label="Review conversation record" rows="4" value={conversation} onChange={(event) => setConversation(event.target.value)} />
            </FieldGroup>
            <button className="btn wide-auto" disabled={busy || conversation.trim().length < 3} onClick={() => recordEntry("conversation_record", conversation, currentConversation, currentConversation ? "Conversation record revision recorded." : "Review conversation recorded.")}>{currentConversation ? "Record conversation revision" : "Record conversation"}</button>
          </>}
          {entries.filter((entry) => entry.entry_type === "conversation_record").length > 1 && <details className="performance-history">
            <summary>Conversation history · {entries.filter((entry) => entry.entry_type === "conversation_record").length} versions</summary>
            {entries.filter((entry) => entry.entry_type === "conversation_record").map((entry) => <div key={entry.id}><strong>{entry.body}</strong><span>{entry.author?.full_name || "Reviewer"} · {new Date(entry.created_at).toLocaleString("en-GB")}</span></div>)}
          </details>}

          <div className="performance-section-head">
            <div><span className="eyebrow">Next cycle</span><h3>Development plan</h3></div>
            {isReviewer && <button className="btn btn-ghost btn-sm" onClick={() => { setPlanStep(1); setPlanFlow(true); }}>{currentPlan ? "Revise plan" : "Create plan"}</button>}
          </div>
          {currentPlan ? <div className="card performance-plan-card">
            <div><span>Focus</span><strong>{currentPlan.focus}</strong></div>
            <div><span>Desired outcome</span><strong>{currentPlan.desired_outcome}</strong></div>
            <div><span>Agreed next steps</span><strong>{currentPlan.next_steps}</strong></div>
            <div><span>Dates</span><strong>{currentPlan.starts_on ? day(currentPlan.starts_on) : "Start not recorded"}{currentPlan.target_on ? " → " + day(currentPlan.target_on) : ""}</strong></div>
            <div><span>State</span><strong>{sentence(currentPlan.state)}</strong></div>
            <small>Version {currentPlan.version}. Earlier versions remain in history.</small>
          </div> : <div className="card small">No development plan has been recorded for this review yet.</div>}
          {plans.length > 1 && <details className="performance-history">
            <summary>Development plan history · {plans.length} versions</summary>
            {plans.map((plan) => <div key={plan.id}><strong>Version {plan.version} · {plan.focus}</strong><span>{sentence(plan.state)} · {plan.change_reason}</span></div>)}
          </details>}

          </div>
          <div hidden={me.is_admin&&reviewStep!=="response"}>
          <div className="performance-section-head"><div><span className="eyebrow">Right of reply</span><h3>Employee response</h3></div></div>
          {entries.filter((entry) => entry.entry_type === "staff_response").map((entry) => <div className="row" key={entry.id}><div className="row-t">{entry.body}</div><div className="row-m">{new Date(entry.created_at).toLocaleString("en-GB")}</div></div>)}
          {isSelf && <>
            <FieldGroup label="Add a response"><textarea className="field" aria-label="Review response" rows="3" value={staffReply} onChange={(event) => setStaffReply(event.target.value)} placeholder="Add context, agreement or a correction in your own words" /></FieldGroup>
            <button className="btn wide-auto" disabled={busy || staffReply.trim().length < 3} onClick={async () => { await recordEntry("staff_response", staffReply, null, "Your response was recorded."); setStaffReply(""); }}>Record response</button>
          </>}

          <div className="performance-section-head"><div><span className="eyebrow">Ongoing record</span><h3>Visible feedback</h3></div></div>
          <p className="screen-note">Feedback is visible to the employee. There are no private manager notes in this surface.</p>
          {feedback.map((note) => <div className="card performance-feedback-card" key={note.id}>
            <div><Pill tone={note.kind === "recognition" ? "green" : note.kind === "guidance" ? "amber" : "grey"}>{sentence(note.kind)}</Pill><small>{day(note.occurred_on || note.created_at?.slice(0,10))}</small></div>
            <strong>{note.author?.full_name || "Reviewer"}</strong>
            <p>{note.note}</p>
            {feedbackResponses.filter((response) => response.feedback_note_id === note.id).map((response) => <div className="performance-feedback-response" key={response.id}><span>Employee response</span><p>{response.response}</p></div>)}
            {isSelf && feedbackReplyFor === note.id && <div className="performance-inline-reply">
              <textarea className="field" aria-label="Feedback response" rows="2" value={feedbackReply} onChange={(event) => setFeedbackReply(event.target.value)} />
              <button className="btn btn-sm" disabled={busy || !feedbackReply.trim()} onClick={() => replyFeedback(note.id)}>Record response</button>
            </div>}
            {isSelf && feedbackReplyFor !== note.id && <button className="text-action" onClick={() => { setFeedbackReplyFor(note.id); setFeedbackReply(""); }}>Respond</button>}
          </div>)}
          {!feedback.length && <div className="card small">No continuous feedback has been recorded.</div>}

          {isReviewer && <section className="card performance-feedback-form">
            <div className="sec" style={{ marginTop:0 }}><span>Record visible feedback</span></div>
            <div className="form-grid two">
              <FieldGroup label="Type"><select className="field" aria-label="Feedback type" value={feedbackKind} onChange={(event) => setFeedbackKind(event.target.value)}><option value="observation">Observation</option><option value="recognition">Recognition</option><option value="guidance">Guidance</option></select></FieldGroup>
              <FieldGroup label="When"><input className="field" aria-label="Feedback date" type="date" value={feedbackDate} onChange={(event) => setFeedbackDate(event.target.value)} /></FieldGroup>
            </div>
            <FieldGroup label="Feedback" hint="Keep this factual and visible."><textarea className="field" aria-label="Visible feedback" rows="3" value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} /></FieldGroup>
            <button className="btn btn-sm" disabled={busy || feedbackNote.trim().length < 3} onClick={recordFeedback}>Record feedback</button>
          </section>}

          </div>
          <div hidden={me.is_admin&&reviewStep!=="publication"}>
          {hrReleaseAdmin && isSelf && <ProductNotice tone="attention" title="Your assigned reviewer decides publication">You cannot decide publication of your own appraisal. The assigned Group Pastor may conduct and publish this review under the owner-approved HR-head exception. The assessment remains restricted until that decision.</ProductNotice>}
          {canDecidePublication && <div className="performance-share-bar">
            <div><strong>{assignedPastorPublication ? "Assigned HR-head publication decision" : "HR publication decisions"}</strong>
              <span>{assignedPastorPublication ? "You may publish only this assigned HR-head assessment. This does not grant access to other protected HR records." : "Only independent HR may publish this completed manager narrative. Review the manager assessment above before deciding."}</span>
            </div>
            {!releaseQueueAvailable && <p className="screen-note">Formal approval controls await the accepted database migration.</p>}
            {releaseQueueAvailable && !currentReleaseRequest && <p className="screen-note">No pending HR request matches the current manager assessment version.</p>}
            {releaseQueueAvailable && currentReleaseRequest && <>
              <p className="screen-note">Manager's reason: {currentReleaseRequest.request_reason}</p>
              <FieldGroup label="Decision note" hint="Optional when approving a reviewed assessment. Explain a decline in at least 8 characters.">
                <textarea className="field" rows="2" aria-label="HR assessment publication decision reason"
                  value={releaseDecisionNote} onChange={(event)=>setReleaseDecisionNote(event.target.value)} />
              </FieldGroup>
              <button className="btn btn-sm" disabled={busy || (currentReleaseRequest.requested_by === me.id && !assignedPastorPublication) || (releaseDecisionNote.trim().length > 0 && releaseDecisionNote.trim().length < 8)}
                onClick={()=>decideHRRelease(true)}>{assignedPastorPublication ? "Publish assigned HR-head review" : "HR approve publication"}</button>
              <button className="btn btn-ghost btn-sm" disabled={busy || (currentReleaseRequest.requested_by === me.id && !assignedPastorPublication) || releaseDecisionNote.trim().length < 8}
                onClick={()=>decideHRRelease(false)}>{assignedPastorPublication ? "Decline assigned HR-head publication" : "HR decline with reason"}</button>
            </>}
          </div>}

          {isReviewer && selectedCase.status !== "closed" && <div className="performance-share-bar">
            <div><strong>{assignedPastorPublication ? "Prepare HR-head publication" : "Request HR release"}</strong><span>{assignedPastorPublication ? "Record a release request for this exact assessment version, then make a separate reasoned publication decision above. New revisions require a new decision." : "Your assessment remains restricted to the assigned reviewer and authorised HR until HR approves its formal publication. New revisions require their own release approval."}</span></div>
            {!currentAssessment && <p className="screen-note">Record your assessment before requesting HR publication.</p>}
            <FieldGroup label="Reason to release this assessment">
              <textarea className="field" rows="2" value={releaseReason} onChange={(event) => setReleaseReason(event.target.value)} aria-label="Performance release request reason" />
            </FieldGroup>
            <button className="btn btn-sm" disabled={busy || !currentAssessment || releaseReason.trim().length < 8} onClick={requestRelease}>{assignedPastorPublication ? "Prepare assigned HR-head publication" : "Submit release request to HR"}</button>
          </div>}
          </div>
        </>}
      </section>
    </div>}

    {hrReleaseAdmin && <HRProjectContributionQueue me={me} cases={cases} cycles={cycles} onOpenReview={reviewId => {
      const review = cases.find(row => row.id === reviewId);
      if (!review || !cycles.some(cycle => cycle.id === review.cycle_id)) return;
      selectedCaseRef.current = review.id;
      selectedCycleRef.current = review.cycle_id;
      setSelectedCycleId(review.cycle_id);
      setSelectedCaseId(review.id);
      requestAnimationFrame(() => {
        reviewPanelRef.current?.focus();
        reviewPanelRef.current?.scrollIntoView({ block: "start" });
      });
    }} />}

    {cycleFlow && <ReviewForm admin={me.is_admin} error={error} resetError={setError} open title="Open review period" onClose={() => { if (!busy) { setCycleFlow(false); setCycleStep(1); } }}>
      <div className="eyebrow">Open review period · Step {cycleStep} of 3</div>
      <div className="h2">{cycleStep === 1 ? "Name the review period" : cycleStep === 2 ? "Choose the evidence dates" : "Confirm why this period is opening"}</div>
      {cycleStep === 1 && <FieldGroup label="Review period name"><input className="field" aria-label="Review period name" value={cycleName} onChange={(event) => setCycleName(event.target.value)} placeholder="e.g. July–September review" /></FieldGroup>}
      {cycleStep === 2 && <div className="form-grid two"><FieldGroup label="From"><input className="field" aria-label="Review period start" type="date" value={cycleStart} onChange={(event) => setCycleStart(event.target.value)} /></FieldGroup><FieldGroup label="To"><input className="field" aria-label="Review period end" type="date" min={cycleStart} value={cycleEnd} onChange={(event) => setCycleEnd(event.target.value)} /></FieldGroup></div>}
      {cycleStep === 3 && <>
        <FieldGroup label="Reason"><textarea className="field" aria-label="Review period reason" rows="3" value={cycleReason} onChange={(event) => setCycleReason(event.target.value)} placeholder="Why CEAC is opening this review period now" /></FieldGroup>
        <div className="card small">Opening this period creates a review case for every active linked employee, including Administration, while excluding the Group Pastor. Administration’s own case requires a different assigned reviewer; it cannot self-review or self-publish. Factual evidence is assembled from recorded rows without a calculated score.</div>
      </>}
      <div className="guided-actions">
        {cycleStep > 1 && <button className="btn btn-ghost" disabled={busy} onClick={() => setCycleStep((step) => step-1)}>Back</button>}
        {cycleStep < 3
          ? <button className="btn" disabled={(cycleStep === 1 && cycleName.trim().length < 3) || (cycleStep === 2 && (!cycleStart || !cycleEnd))} onClick={() => setCycleStep((step) => step+1)}>Continue</button>
          : <button className="btn" disabled={busy || cycleReason.trim().length < 3} onClick={openCycle}>{busy ? "Opening…" : "Open review period"}</button>}
      </div>
    </ReviewForm>}

    {closeCycleFlow && <ReviewForm admin={me.is_admin} error={error} resetError={setError} open title="Close review period" onClose={() => { if (!busy) setCloseCycleFlow(false); }}>
      <div className="eyebrow">Close review period</div>
      <div className="h2">Close {selectedCycle?.name || "this period"}?</div>
      <p className="screen-note">This closes the period itself. Reviews already shared are marked closed; incomplete reviews keep their factual workflow state so Administration can still see what was unfinished.</p>
      <FieldGroup label="Reason"><textarea className="field" aria-label="Review period close reason" rows="3" value={closeCycleReason} onChange={(event) => setCloseCycleReason(event.target.value)} placeholder="Why this review period is closing" /></FieldGroup>
      <button className="btn" style={{ marginTop:14 }} disabled={busy || closeCycleReason.trim().length < 3} onClick={closeCycle}>{busy ? "Closing…" : "Close review period"}</button>
    </ReviewForm>}

    {planFlow && <ReviewForm admin={me.is_admin} error={error} resetError={setError} open title="Development plan" onClose={() => { if (!busy) { setPlanFlow(false); setPlanStep(1); } }}>
      <div className="eyebrow">Development plan · Step {planStep} of 3</div>
      <div className="h2">{planStep === 1 ? "What should develop?" : planStep === 2 ? "What will happen next?" : "Confirm the plan"}</div>
      {planStep === 1 && <>
        <FieldGroup label="Development focus"><textarea className="field" aria-label="Development focus" rows="3" value={planFocus} onChange={(event) => setPlanFocus(event.target.value)} /></FieldGroup>
        <FieldGroup label="Desired outcome"><textarea className="field" aria-label="Development desired outcome" rows="3" value={planOutcome} onChange={(event) => setPlanOutcome(event.target.value)} /></FieldGroup>
      </>}
      {planStep === 2 && <FieldGroup label="Agreed next steps"><textarea className="field" aria-label="Development next steps" rows="5" value={planSteps} onChange={(event) => setPlanSteps(event.target.value)} /></FieldGroup>}
      {planStep === 3 && <>
        <div className="form-grid two"><FieldGroup label="Starts"><input className="field" aria-label="Development start" type="date" value={planStart} onChange={(event) => setPlanStart(event.target.value)} /></FieldGroup><FieldGroup label="Target"><input className="field" aria-label="Development target" type="date" min={planStart} value={planTarget} onChange={(event) => setPlanTarget(event.target.value)} /></FieldGroup></div>
        <FieldGroup label="State"><select className="field" aria-label="Development state" value={planState} onChange={(event) => setPlanState(event.target.value)}><option value="active">Active</option><option value="completed">Completed</option><option value="closed">Closed</option></select></FieldGroup>
        <FieldGroup label="Reason for this version"><textarea className="field" aria-label="Development change reason" rows="2" value={planReason} onChange={(event) => setPlanReason(event.target.value)} placeholder="Why this plan/version is being recorded" /></FieldGroup>
        <div className="card small">This creates a new plan version. Earlier versions remain on record.</div>
      </>}
      <div className="guided-actions">
        {planStep > 1 && <button className="btn btn-ghost" disabled={busy} onClick={() => setPlanStep((step) => step-1)}>Back</button>}
        {planStep < 3
          ? <button className="btn" disabled={(planStep === 1 && (planFocus.trim().length < 3 || planOutcome.trim().length < 3)) || (planStep === 2 && planSteps.trim().length < 3)} onClick={() => setPlanStep((step) => step+1)}>Continue</button>
          : <button className="btn" disabled={busy || planReason.trim().length < 3} onClick={recordPlan}>{busy ? "Recording…" : currentPlan ? "Record plan revision" : "Record development plan"}</button>}
      </div>
    </ReviewForm>}
  </div>;
}
