import RoutineScheduleOptions from "../components/RoutineScheduleOptions";
import { initialRoutineScheduleOptions, routineScheduleOptions } from "../lib/routineScheduleOptions";
import { useEffect, useRef, useState } from "react";
import AssistiveTextarea from "../components/AssistiveTextarea";
import { supabase } from "../lib/supabase";
import { dueLabel } from "../lib/time";
import { Sheet } from "../components/bits";
import WorkActivityDiary from "../components/WorkActivityDiary";
import WorkProjectLink from "../components/WorkProjectLink";
import RoutineDateProgress from "../components/RoutineDateProgress";
import RoutineOccurrenceReviews from "../components/RoutineOccurrenceReviews";
import { routineFutureChange, routineOccurrenceDetails } from "../lib/routineWriteValidation";
import RoutineWeekdayPicker from "../components/RoutineWeekdayPicker";
import { ghanaCalendarDate } from "../lib/dailyLandscape";
import { OperationalFileList } from "../components/OperationalFiles";
import {
  WorkDetailCopy,
  WorkDetailHeader,
  WorkDetailSection,
  WorkDependencyNotice,
  WorkReturnedNotice,
} from "../experience-v2/work-family/WorkFamilyV2";

const MANAGER_SELF_CERTIFICATION_READY = true;

const BRAND_BOOK_TASK_CSS = `.fpg-brandbook-task-card{margin-top:var(--ev2-space-6);overflow:hidden;border:1px solid var(--ev2-line);border-radius:14px;background:var(--ev2-surface);box-shadow:var(--ev2-shadow-1)}
.fpg-brandbook-task-card>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 15px 10px}
.fpg-brandbook-task-card>header span{display:grid;gap:2px}.fpg-brandbook-task-card>header small{color:var(--ev2-text-tertiary);font-size:12px}.fpg-brandbook-task-card>header strong{font-size:14px}.fpg-brandbook-task-card>header>b{font-size:22px;letter-spacing:-.04em}
.fpg-brandbook-task-card>footer{padding:9px 15px;border-top:1px solid var(--ev2-line);color:var(--ev2-text-secondary);font-size:12px}
.fpg-brandbook-task-card .staff-check-progress{margin:0 15px 8px;border-radius:999px}.fpg-brandbook-task-card .checklist-card{border:0;border-radius:0;box-shadow:none}`;

/** Remount the detail's multi-query state for each actual work/user/unit.
 * A late response from a previous account or work item must never populate
 * another responsibility's detail, its routine proof or its review controls.
 * The existing authoritative RPC/RLS write checks remain unchanged.
 */
export default function Item(props) {
  const scope = [props.me?.org_id, props.me?.id, props.me?.unit_id, props.id, props.initialRoutineDate || ""].join(":");
  return <ItemDetail key={scope} {...props} />;
}

function ItemDetail({ id, me, session, isManager = false, initialRoutineDate=null, openRoom, back }) {
  const [item, setItem] = useState(null);
  const [canReview, setCanReview] = useState(false);
  const [responsibleReviewer, setResponsibleReviewer] = useState(null);
  const [checks, setChecks] = useState([]);
  const [ticks, setTicks] = useState({});
  // Discard checklist reads that started before a newer local tick mutation.
  const tickMutationVersion = useRef(0);
  const [myStep, setMyStep] = useState("");
  const [recipeSteps, setRecipeSteps] = useState([]);
  const [recipeSource, setRecipeSource] = useState(null);
  const [blocker, setBlocker] = useState(null);
  const [review, setReview] = useState(null);
  const [latestSubmission, setLatestSubmission] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewChecklist, setReviewChecklist] = useState([]);
  const [units, setUnits] = useState([]);
  const [routine, setRoutine] = useState(null);
  const [routineOccurrences, setRoutineOccurrences] = useState([]);
  // A dated evidence shortcut is UI context only; the authoritative evidence
  // stays in append-only work_activity_records with normal contributor RLS.
  const [routineEvidenceDate, setRoutineEvidenceDate] = useState("");
  const [routineEvidenceRequest, setRoutineEvidenceRequest] = useState(0);
  const [caseRecord, setCaseRecord] = useState(null);
  const [requestRecord, setRequestRecord] = useState(null);
  const [requestResponses, setRequestResponses] = useState([]);
  const [decisionRecord, setDecisionRecord] = useState(null);
  const [decisionText, setDecisionText] = useState("");
  const [meetingRecord, setMeetingRecord] = useState(null);
  const [deliverableRecord, setDeliverableRecord] = useState(null);
  const [routineDate, setRoutineDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [routineValue, setRoutineValue] = useState("");
  const [routineEffective, setRoutineEffective] = useState("");
  const [routineSchedule, setRoutineSchedule] = useState("weekly");
  const [routineWeeklyDay, setRoutineWeeklyDay] = useState("7");
  const [routineWeekdays, setRoutineWeekdays] = useState([]);
  const [routineDayOfMonth, setRoutineDayOfMonth] = useState("");
  const [routineEnd, setRoutineEnd] = useState("");
  const [routineOptions, setRoutineOptions] = useState(initialRoutineScheduleOptions);
  const [sheet, setSheet] = useState(null);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [party, setParty] = useState("");
  const [partyUnit, setPartyUnit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { load(); }, [id, me.id, me.unit_id]);

  async function load() {
    const tickReadVersion = tickMutationVersion.current;
    setErr(null);
    setCanReview(false);
    setResponsibleReviewer(null);
    const { data: w, error: workError } = await supabase.from("work_items")
      .select("*, projects(name), sub_teams(name)").eq("id", id).single();
    if (workError) { setErr(workError.message); return; }
    setItem(w);
    const authority = await supabase.rpc("app_can_review_item", { item_id: id });
    if (authority.error) { setErr(authority.error.message); return; }
    setCanReview(Boolean(authority.data) && w.assignee_id !== me.id);
    const reviewerRoute = await supabase.rpc("app_responsible_reviewer_id", { item_id: id });
    if (reviewerRoute.error) { setErr(reviewerRoute.error.message); return; }
    if (reviewerRoute.data) {
      const reviewerProfile = await supabase.from("profiles")
        .select("id,full_name")
        .eq("id", reviewerRoute.data)
        .maybeSingle();
      setResponsibleReviewer(reviewerProfile.error
        ? { id: reviewerRoute.data, full_name: null }
        : reviewerProfile.data || { id: reviewerRoute.data, full_name: null });
    }
    if (w.kind === "deliverable") {
      const deliverableResult = await supabase.from("work_deliverables")
        .select("evidence_required,evidence_kind")
        .eq("work_item_id", id).single();
      if (deliverableResult.error) { setErr(`Deliverable: ${deliverableResult.error.message}`); return; }
      setDeliverableRecord(deliverableResult.data);
    } else setDeliverableRecord(null);
    if (w.kind === "meeting_outcome") {
      const meetingResult = await supabase.from("work_meeting_outcomes")
        .select("meeting_title,meeting_on,meeting_note,source_event_id")
        .eq("work_item_id", id).single();
      if (meetingResult.error) { setErr(`Meeting outcome: ${meetingResult.error.message}`); return; }
      setMeetingRecord(meetingResult.data);
    } else setMeetingRecord(null);
    if (w.kind === "decision") {
      const decisionResult = await supabase.from("work_decisions")
        .select("authority_profile_id,question,decision_text,rationale,decided_at,decided_by")
        .eq("work_item_id", id).single();
      if (decisionResult.error) { setErr(`Decision: ${decisionResult.error.message}`); return; }
      setDecisionRecord(decisionResult.data);
    } else setDecisionRecord(null);
    if (w.kind === "request") {
      const requestResult = await supabase.from("work_requests")
        .select("requester_id,responsible_profile_id,responsible_unit_id,request_state,responded_at,responded_by,response_note, units:responsible_unit_id(name)")
        .eq("work_item_id", id).single();
      if (requestResult.error) { setErr(`Request: ${requestResult.error.message}`); return; }
      setRequestRecord(requestResult.data);
      const responseResult = await supabase.from("work_request_responses")
        .select("id,actor_id,outcome,note,created_at")
        .eq("work_item_id", id).order("created_at", { ascending: false });
      if (responseResult.error) { setErr(`Request history: ${responseResult.error.message}`); return; }
      setRequestResponses(responseResult.data || []);
    } else {
      setRequestRecord(null);
      setRequestResponses([]);
    }
    if (w.kind === "case") {
      const caseResult = await supabase.from("work_cases")
        .select("opened_on,target_resolution_on,case_state,resolution_note,resolved_at,resolved_by")
        .eq("work_item_id", id).single();
      if (caseResult.error) { setErr(`Case: ${caseResult.error.message}`); return; }
      setCaseRecord(caseResult.data);
    } else setCaseRecord(null);
    if (w.kind === "routine") {
      const routineResult = await supabase.from("recurring_operations")
        .select("id,name,cadence,records_value,value_label,active,starts_on,ends_on,paused_at,schedule_kind,weekdays,day_of_month,interval_count,timezone,due_time,occurrence_limit")
        .eq("work_item_id", id).single();
      if (routineResult.error) { setErr(`Routine: ${routineResult.error.message}`); return; }
      setRoutine(routineResult.data);
      const occurrenceResult = await supabase.from("operation_occurrences")
        .select("id,occurred_on,value,note,recorded_by,created_at")
        .eq("operation_id", routineResult.data.id)
        .order("occurred_on", { ascending: false })
        .limit(12);
      if (occurrenceResult.error) { setErr(`Routine history: ${occurrenceResult.error.message}`); return; }
      setRoutineOccurrences(occurrenceResult.data || []);
    } else {
      setRoutine(null);
      setRoutineOccurrences([]);
    }
    const { data: c, error: checklistError } = await supabase.from("checklist_items")
      .select("id,label,position").eq("work_item_id", id).order("position");
    if (checklistError) { setErr(checklistError.message); return; }
    setChecks(c || []);
    if (tickReadVersion === tickMutationVersion.current) setTicks({});
    if (c && c.length) {
      const { data: t, error: tickError } = await supabase.from("checklist_ticks")
        .select("checklist_item_id, undone_at").in("checklist_item_id", c.map((x) => x.id));
      if (tickError) { setErr(tickError.message); return; }
      const map = {};
      (t || []).forEach((x) => { if (!x.undone_at) map[x.checklist_item_id] = true; });
      if (tickReadVersion === tickMutationVersion.current) setTicks(map);
    }

    setRecipeSteps([]);
    setRecipeSource(null);
    if (w.kind === "task" && w.assignee_id === me.id) {
      const history = await supabase.from("work_items")
        .select("id,title,completed_at,checklist_items(label,position)")
        .eq("unit_id", w.unit_id)
        .eq("kind", "task")
        .in("status", ["completed","self_certified"])
        .neq("id", w.id)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(40);
      if (!history.error) {
        const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const prior = (history.data || []).find((row) =>
          normalize(row.title) === normalize(w.title) && (row.checklist_items || []).length > 0
        );
        if (prior) {
          setRecipeSource(prior);
          setRecipeSteps([...prior.checklist_items].sort((a,b) => a.position-b.position).map((row) => row.label).filter(Boolean));
        }
      }
    }
    const { data: b, error: blockerError } = await supabase.from("blockers").select("*, units(name)")
      .eq("work_item_id", id).neq("state", "resolved").maybeSingle();
    if (blockerError) { setErr(blockerError.message); return; }
    setBlocker(b);
    const { data: subs, error: submissionError } = await supabase.from("submissions")
      .select("id, profile_id, note, submitted_at, profiles!submissions_profile_id_fkey(full_name), submission_files(url), reviews(id, decision, comment, review_checklist_items(checklist_item_id))")
      .eq("work_item_id", id).order("submitted_at", { ascending: false }).limit(1);
    if (submissionError) { setErr(submissionError.message); return; }
    const last = subs && subs[0];
    setLatestSubmission(last || null);
    setReview(last && last.reviews && last.reviews[0] ? last.reviews[0] : null);
    const { data: u, error: unitError } = await supabase.from("units").select("id,name").order("name");
    if (unitError) { setErr(unitError.message); return; }
    setUnits(u || []);
  }

  const done = checks.filter((c) => ticks[c.id]).length;
  const allDone = checks.length > 0 && done === checks.length;
  const gated = !session;
  const managerOwnWork = isManager && item && item.assignee_id === me.id && item.origin !== "assigned_by_exec" && (item.origin === "self_created" || item.assigned_by === me.id);
  const managerSubmissionBlocked = managerOwnWork && !MANAGER_SELF_CERTIFICATION_READY;

  async function addMyStep() {
    const label = myStep.trim();
    if (!label || !item || item.assignee_id !== me.id) return;
    setBusy(true); setErr(null);
    try {
      const nextPosition = checks.reduce((max, row) => Math.max(max, Number(row.position) || 0), 0) + 1;
      const { error } = await supabase.from("checklist_items").insert({
        work_item_id: item.id,
        label,
        position: nextPosition,
      });
      if (error) throw error;
      setMyStep("");
      await load();
    } catch (error) {
      setErr(error.message || "Your step could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function useRecipeSteps() {
    if (!item || item.assignee_id !== me.id || !recipeSteps.length) return;
    const existing = new Set(checks.map((row) => row.label.trim().toLowerCase()));
    const missing = recipeSteps.filter((label) => !existing.has(label.trim().toLowerCase()));
    if (!missing.length) return;
    setBusy(true); setErr(null);
    try {
      const start = checks.reduce((max, row) => Math.max(max, Number(row.position) || 0), 0);
      const rows = missing.map((label, index) => ({
        work_item_id: item.id,
        label,
        position: start + index + 1,
      }));
      const { error } = await supabase.from("checklist_items").insert(rows);
      if (error) throw error;
      await load();
    } catch (error) {
      setErr(error.message || "The previous method could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(cid) {
    if (gated) return;
    ++tickMutationVersion.current;
    setErr(null);
    if (ticks[cid]) {
      const { error } = await supabase.from("checklist_ticks").update({ undone_at: new Date().toISOString() })
        .eq("checklist_item_id", cid).eq("profile_id", me.id).is("undone_at", null);
      if (error) { setErr(error.message); return; }
      ++tickMutationVersion.current;
      setTicks((t) => ({ ...t, [cid]: false }));
    } else {
      const { error } = await supabase.from("checklist_ticks")
        .insert({ checklist_item_id: cid, profile_id: me.id, session_id: session ? session.id : null });
      if (error) { setErr(error.message); return; }
      ++tickMutationVersion.current;
      setTicks((t) => ({ ...t, [cid]: true }));
      if (item.status === "not_started") {
        const { error: statusError } = await supabase.from("work_items").update({ status: "in_progress", last_movement_at: new Date().toISOString() }).eq("id", id);
        if (statusError) { setErr(statusError.message); return; }
        setItem((i) => ({ ...i, status: "in_progress" }));
      }
    }
  }

  async function submit() {
    if (managerSubmissionBlocked) {
      setErr("Manager self-certification needs the pending database migration. Nothing was submitted.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (item.kind === "deliverable" && deliverableRecord?.evidence_required && !link.trim()) {
        throw new Error("Add the required evidence link before sending this deliverable.");
      }
      if (managerOwnWork) {
        const { error: selfCertificationError } = await supabase.rpc("self_certify_work", {
          p_work_item_id: id,
          p_session_id: session ? session.id : null,
          p_note: note.trim() || null,
          p_link: link.trim() || null,
        });
        if (selfCertificationError) throw selfCertificationError;
        setSheet(null); setNote(""); setLink(""); await load();
        return;
      }
      const { error: submissionError } = await supabase.rpc("submit_work_for_review", {
        p_work_item_id: id,
        p_session_id: session ? session.id : null,
        p_note: note.trim() || null,
        p_link: link.trim() || null,
      });
      if (submissionError) throw submissionError;
      setSheet(null); setNote(""); setLink(""); await load();
    } catch (e) { setErr(e.message || "The work could not be submitted."); }
    finally { setBusy(false); }
  }

  function toggleReviewChecklist(id) {
    setReviewChecklist((current) => current.includes(id)
      ? current.filter((itemId) => itemId !== id)
      : [...current, id]);
  }

  async function decideManagerReview(decision) {
    if (!canReview || !latestSubmission || item?.status !== "in_review") return;
    setBusy(true);
    setErr(null);
    try {
      if (decision === "returned") {
        if (!reviewComment.trim()) throw new Error("Add a comment explaining what needs changing.");
        const { error } = await supabase.rpc("return_work_for_correction", {
          p_submission_id: latestSubmission.id,
          p_comment: reviewComment.trim(),
          p_checklist_item_ids: reviewChecklist.length ? reviewChecklist : null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("approve_work_submission", {
          p_submission_id: latestSubmission.id,
          p_comment: reviewComment.trim() || null,
        });
        if (error) throw error;
      }
      setSheet(null);
      setReviewComment("");
      setReviewChecklist([]);
      await load();
    } catch (error) {
      setErr(error.message || "The review could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function recordDecision() {
    if (!decisionText.trim() || !note.trim()) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.rpc("record_work_decision", {
        p_work_item_id: id,
        p_decision: decisionText.trim(),
        p_rationale: note.trim(),
      });
      if (error) throw error;
      setSheet(null); setDecisionText(""); setNote(""); await load();
    } catch (e) { setErr(e.message || "The decision could not be recorded."); }
    finally { setBusy(false); }
  }

  async function respondRequest(outcome) {
    if (["declined", "clarification"].includes(outcome) && !note.trim()) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.rpc("respond_work_request", {
        p_work_item_id: id,
        p_outcome: outcome,
        p_note: note.trim() || null,
      });
      if (error) throw error;
      setSheet(null); setNote(""); await load();
    } catch (e) { setErr(e.message || "The request response could not be saved."); }
    finally { setBusy(false); }
  }

  async function provideRequestClarification() {
    if (!note.trim()) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.rpc("provide_request_clarification", {
        p_work_item_id: id,
        p_note: note.trim(),
      });
      if (error) throw error;
      setSheet(null); setNote(""); await load();
    } catch (e) { setErr(e.message || "The clarification could not be sent."); }
    finally { setBusy(false); }
  }

  async function resolveCase() {
    if (!note.trim()) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.rpc("resolve_work_case", {
        p_work_item_id: id,
        p_resolution_note: note.trim(),
      });
      if (error) throw error;
      setSheet(null); setNote(""); await load();
    } catch (e) { setErr(e.message || "The case could not be resolved."); }
    finally { setBusy(false); }
  }

  async function recordRoutineOccurrence() {
    if (!routine) return;
    setBusy(true); setErr(null);
    try {
      const details = routineOccurrenceDetails({
        workId: id, date: routineDate, today: ghanaCalendarDate(),
        numericValue: routineValue, recordsValue: routine.records_value, note,
      });
      const { error } = await supabase.rpc("record_routine_occurrence", details);
      if (error) throw error;
      setSheet(null); setRoutineValue(""); setNote(""); await load();
    } catch (e) { setErr(e.message || "The routine occurrence could not be recorded."); }
    finally { setBusy(false); }
  }

  function openRoutineSchedule() {
    const today = new Date().toISOString().slice(0, 10);
    setRoutineSchedule(routine?.schedule_kind || "weekly");
    setRoutineWeeklyDay(String(routine?.weekdays?.[0] || 7));
    setRoutineWeekdays(routine?.weekdays || []);
    setRoutineDayOfMonth(routine?.day_of_month ? String(routine.day_of_month) : "");
    setRoutineEnd(routine?.ends_on || "");
    setRoutineEffective(routine?.schedule_kind ? "" : today);
    setRoutineOptions({interval:String(routine?.interval_count || 1),timezone:routine?.timezone || "Africa/Accra",
      dueTime:routine?.due_time || "",limit:routine?.occurrence_limit == null ? "" : String(routine.occurrence_limit)});
    setSheet("routine-schedule");
  }

  async function saveRoutineSchedule() {
    setBusy(true); setErr(null);
    try {
      const details = routineFutureChange({
        workId: id, effectiveFrom: routineEffective, schedule: routineSchedule,
        weekday: routineWeeklyDay, weekdays: routineWeekdays,
        monthDay: routineDayOfMonth, end: routineEnd, today: ghanaCalendarDate(),
        hasReliableSchedule: Boolean(routine?.schedule_kind),
      });
      const { error } = await supabase.rpc("change_routine_schedule_options", {p_work_item_id:details.p_work_item_id,p_effective_from:details.p_effective_from,p_options:{...routineScheduleOptions(routineOptions),schedule_kind:details.p_schedule_kind,...(details.p_weekdays ? {weekdays:details.p_weekdays} : {}),day_of_month:details.p_day_of_month,ends_on:details.p_ends_on}});
      if (error) throw error;
      setSheet(null); await load();
    } catch (e) { setErr(e.message || "The routine schedule could not be changed."); }
    finally { setBusy(false); }
  }

  async function toggleRoutinePause() {
    if (!routine || !note.trim()) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.rpc("set_routine_paused", {
        p_work_item_id: id,
        p_paused: routine.active,
        p_reason: note.trim(),
      });
      if (error) throw error;
      setSheet(null); setNote(""); await load();
    } catch (e) { setErr(e.message || "The routine could not be updated."); }
    finally { setBusy(false); }
  }

  async function reopenFinishedWork() {
    if (!note.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc("reopen_approved_work", {
        p_work_item_id: id,
        p_reason: note.trim(),
      });
      if (error) throw error;
      setSheet(null); setNote(""); await load();
    } catch (e) { setErr(e.message || "The work could not be reopened."); }
    finally { setBusy(false); }
  }

  async function markWaiting() {
    setBusy(true);
    setErr(null);
    try {
      const { error: blockerError } = await supabase.rpc("raise_work_blocker", {
        p_work_item_id: id,
        p_party_unit_id: partyUnit || null,
        p_party_text: party.trim() || null,
        p_note: note.trim() || null,
      });
      if (blockerError) throw blockerError;
      setSheet(null); setParty(""); setNote(""); setPartyUnit(null); await load();
    } catch (e) { setErr(e.message || "The blocker could not be saved."); }
    finally { setBusy(false); }
  }

  async function resolveActiveBlocker() {
    if (!blocker) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.rpc("resolve_blocker", { p_blocker_id: blocker.id, p_note: null });
      if (error) throw error;
      await load();
    } catch (e) { setErr(e.message || "The blocker could not be resolved."); }
    finally { setBusy(false); }
  }

  if (!item) return err
    ? <div className="body"><button className="back" onClick={back}>← Back</button><div className="flag flag-brick"><h4>Could not load this work</h4>{err}</div></div>
    : <div className="spin">Loading...</div>;

  return (
    <div className={`body ${isManager ? "manager-work-detail" : "staff-work-detail"} ev2-work-detail`}>
      <WorkDetailHeader
        refCode={item.ref}
        kind={item.kind}
        title={item.title}
        context={[
          item.projects?.name,
          item.sub_teams?.name,
        ].filter(Boolean).join(" · ")}
        due={dueLabel(item.due_at)}
        status={item.status}
        onBack={back}
      />
      <WorkProjectLink key={`${me.id}:${item.id}:${item.project_id || "unlinked"}`} me={me} item={item} onLinked={load} />

      {openRoom && (item.project_id || item.sub_team_id || item.unit_id) && <button className="work-room-entry" onClick={() => openRoom({
        ...(item.project_id
          ? { kind: "project", projectId: item.project_id }
          : item.sub_team_id
            ? { kind: "sub_team", subTeamId: item.sub_team_id }
            : { kind: "unit", unitId: item.unit_id }),
        reference: { object_type: "work_item", object_id: item.id, label: `${item.ref} · ${item.title}` },
      })}>
        <span><strong>{item.project_id ? "Discuss in Project Room" : item.sub_team_id ? "Discuss in Sub-team Room" : "Discuss in Team Room"}</strong><small>Open the relevant conversation with this work linked.</small></span>
        <b aria-hidden="true">→</b>
      </button>}

      {err && <div className="flag flag-brick" style={{ marginTop: 14 }}>{err}</div>}

      {review && review.decision === "returned" && (
        <WorkReturnedNotice
          comment={review.comment}
          checklistItems={(review.review_checklist_items || []).map((row) => checks.find((check) => check.id === row.checklist_item_id)).filter(Boolean)}
        />)}

      {blocker && (
        <WorkDependencyNotice
          party={blocker.units ? blocker.units.name : blocker.party_text}
          state={blocker.state}
          request={blocker.party_text}
          note={blocker.note}
          responseNote={blocker.response_note}
          canResolve={blocker.claimed_by === me.id}
          resolving={busy}
          onResolve={resolveActiveBlocker}
        />)}

      <OperationalFileList
        contextType="work_item"
        contextId={item.id}
        relation="assignment_source"
        title="Source files"
        emptyText="No source files were supplied with this work."
      />

      {item.purpose && <WorkDetailSection title="Why this matters">
        <WorkDetailCopy>{item.purpose}</WorkDetailCopy>
      </WorkDetailSection>}

      {item.expected_outcome && <WorkDetailSection title="What finished looks like">
        <WorkDetailCopy tone="emphasis">{item.expected_outcome}</WorkDetailCopy>
      </WorkDetailSection>}

      {item.instructions && <WorkDetailSection title="What to do">
        <WorkDetailCopy>{item.instructions}</WorkDetailCopy>
      </WorkDetailSection>}

      <WorkActivityDiary key={`${me.id}:${item.id}`} me={me} item={item}
        prefillDate={routineEvidenceDate} prefillRequest={routineEvidenceRequest} />

      {item.kind === "deliverable" && deliverableRecord && <>
        <div className="sec"><span>Deliverable evidence</span></div>
        <div className="card">
          <div className="row-t">{deliverableRecord.evidence_required ? "Evidence required" : "Evidence optional"}</div>
          <div className="row-m">{deliverableRecord.evidence_required
            ? "Add a link to the finished output before sending it for review."
            : "The finished output can be submitted without an evidence link."}</div>
        </div>
      </>}

      {item.kind === "meeting_outcome" && meetingRecord && <>
        <div className="sec"><span>Meeting source</span></div>
        <div className="card">
          <div className="row-t">{meetingRecord.meeting_title}</div>
          <div className="row-m">{meetingRecord.meeting_on}</div>
          {meetingRecord.meeting_note && <div className="row-note" style={{ marginTop: 8 }}>{meetingRecord.meeting_note}</div>}
        </div>
      </>}

      {item.kind === "decision" && decisionRecord && <>
        <div className="sec"><span>Decision required</span></div>
        <div className="card">
          <div className="row-t">{decisionRecord.question}</div>
          {decisionRecord.decided_at
            ? <>
              <div className="row-note" style={{ marginTop: 10 }}><strong>Decision:</strong> {decisionRecord.decision_text}</div>
              <div className="row-note" style={{ marginTop: 6 }}><strong>Rationale:</strong> {decisionRecord.rationale}</div>
            </>
            : <div className="row-m">Waiting for the named decision-maker.</div>}
        </div>
        {!decisionRecord.decided_at && (decisionRecord.authority_profile_id === me.id || me.is_admin) &&
          <button className="btn" style={{ marginTop: 20 }} onClick={() => { setDecisionText(""); setNote(""); setSheet("decision-record"); }}>Record decision</button>}
      </>}

      {item.kind === "request" && requestRecord && <>
        <div className="sec"><span>Request</span></div>
        <div className="card">
          <div className="row-t">{requestRecord.request_state.replaceAll("_", " ")}</div>
          <div className="row-m">Responsible: {requestRecord.units?.name || (requestRecord.responsible_profile_id ? "Named person" : "—")}</div>
          {requestRecord.response_note && <div className="row-note" style={{ marginTop: 8 }}>{requestRecord.response_note}</div>}
        </div>
        {requestResponses.length > 0 && <>
          <div className="sec"><span>Response history</span><span>{requestResponses.length}</span></div>
          {requestResponses.map((response) => <div className="row" key={response.id}>
            <div className="row-t">{response.outcome.replaceAll("_", " ")}</div>
            {response.note && <div className="row-m">{response.note}</div>}
            <div className="row-note">{new Date(response.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
          </div>)}
        </>}
        {requestRecord.request_state === "waiting" && (
          requestRecord.responsible_profile_id === me.id
          || (isManager && requestRecord.responsible_unit_id === me.unit_id)
          || me.is_admin
        ) &&
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <button className="btn btn-sm" onClick={() => { setNote(""); setSheet("request-fulfilled"); }}>Mark fulfilled</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setNote(""); setSheet("request-clarification"); }}>Ask for clarification</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setNote(""); setSheet("request-declined"); }}>Decline</button>
          </div>}
        {requestRecord.request_state === "clarification" && requestRecord.requester_id === me.id &&
          <button className="btn" style={{ marginTop: 16 }} onClick={() => { setNote(""); setSheet("request-provide-clarification"); }}>Provide clarification</button>}
        {!["fulfilled", "declined", "cancelled"].includes(requestRecord.request_state) && requestRecord.requester_id === me.id &&
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => { setNote(""); setSheet("request-cancel"); }}>Cancel request</button>}
      </>}

      {item.kind === "case" && caseRecord && <>
        <div className="sec"><span>Case</span></div>
        <div className="card">
          <div className="row-t">{caseRecord.case_state === "resolved" ? "Resolved" : "Open case"}</div>
          <div className="row-m">Opened {caseRecord.opened_on}{caseRecord.target_resolution_on ? ` · target ${caseRecord.target_resolution_on}` : ""}</div>
          {caseRecord.resolution_note && <div className="row-note" style={{ marginTop: 8 }}>{caseRecord.resolution_note}</div>}
        </div>
        {caseRecord.case_state === "open" && (item.assignee_id === me.id || me.is_admin) &&
          <button className="btn" style={{ marginTop: 20 }} onClick={() => { setNote(""); setSheet("case-resolve"); }}>Record resolution</button>}
      </>}

      {item.kind === "routine" && routine && <>
        <div className="sec"><span>Routine schedule</span></div>
        <div className="card">
          <div className="row-t">{routine.schedule_kind
            ? routine.schedule_kind === "daily" ? "Daily"
              : routine.schedule_kind === "monthly" ? `Monthly · day ${routine.day_of_month}`
                : `${routine.schedule_kind === "weekly" ? "Weekly" : "Selected weekdays"} · ${(routine.weekdays || []).map((day) => ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][day - 1]).join(", ")}`
            : "Schedule needs to be set"}</div>
          <div className="row-m">{routine.starts_on ? `Started ${routine.starts_on}` : ""}{routine.ends_on ? ` · ends ${routine.ends_on}` : ""}</div>
          <div className="row-note">{routine.active ? "Active" : "Paused"}{routine.records_value ? ` · records ${routine.value_label}` : ""}</div>
        </div>
        {!routine.schedule_kind && <div className="flag flag-amber" style={{ marginTop: 10 }}>
          <h4>Schedule not yet configured</h4>This is a reconciled legacy routine. Its old record only said “Weekly”, so CEAC OS did not invent a weekday.
        </div>}
        {checks.length > 0 && <section aria-label="Routine method"><h3>Steps to repeat each time</h3><ol>{checks.map(step => <li key={step.id}>{step.label}</li>)}</ol></section>}
        <RoutineDateProgress me={me} item={item} routine={routine} steps={checks} initialDate={initialRoutineDate}
          canRecord={Boolean(item.assignee_id === me.id || !item.assignee_id || canReview || me.is_admin)} />
        {routineOccurrences.length > 0 && <>
          <div className="sec"><span>Recent occurrences</span><span>{routineOccurrences.length}</span></div>
          <RoutineOccurrenceReviews me={me} item={item} occurrences={routineOccurrences}
            canReview={Boolean(isManager || me.is_admin || canReview)}
            onRecordEvidence={item.assignee_id === me.id || item.visibility !== "private" && item.confidential !== true
              ? (date) => { setRoutineEvidenceDate(date); setRoutineEvidenceRequest((n) => n + 1); }
              : null} />
        </>}
        {routine.active && routine.schedule_kind && (item.assignee_id === me.id || !item.assignee_id || canReview || me.is_admin) && <button className="btn" style={{ marginTop: 20 }} onClick={() => {
          setRoutineDate(new Date().toISOString().slice(0, 10)); setRoutineValue(""); setNote(""); setSheet("routine-record");
        }}>Record occurrence</button>}
        {!routine.active && <div className="flag flag-amber" style={{ marginTop: 16 }}><h4>Routine paused</h4>No new occurrence action is shown while this routine is paused.</div>}
        {(isManager || me.is_admin || item.origin === "self_created" && item.assignee_id === me.id && item.assigned_by === me.id) && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={openRoutineSchedule}>{routine.schedule_kind ? "Change future schedule" : "Set schedule"}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setNote(""); setSheet("routine-pause"); }}>{routine.active ? "Pause routine" : "Resume routine"}</button>
        </div>}
      </>}

      {item.kind !== "routine" && checks.length > 0 && <><style data-fpg-brandbook-task>{BRAND_BOOK_TASK_CSS}</style><section className="fpg-brandbook-task-card" aria-label="Task checklist and progress">
        <header>
          <span><small>Task progress</small><strong>Completion checklist</strong></span>
          <b>{Math.round((done / checks.length) * 100)}%</b>
        </header>
        <div className="staff-check-progress" aria-label={`${done} of ${checks.length} checklist items complete`}>
          <span style={{ width: `${Math.round((done / checks.length) * 100)}%` }} />
        </div>
        <div className="card checklist-card" style={{ padding: "2px 15px" }}>
          {checks.map((c) => (
            <button key={c.id} className={"ck " + (ticks[c.id] ? "done" : "")} onClick={() => toggle(c.id)} disabled={gated}>
              <span className={"box " + (ticks[c.id] ? "on" : "")} />
              <span className="ck-l">{c.label}</span>
            </button>))}
        </div>
        <footer>{done} of {checks.length} recorded step{checks.length === 1 ? "" : "s"} complete</footer>
      </section></>}

      {canReview && item.status === "in_review" && latestSubmission && <WorkDetailSection
        title="Review submitted work"
        meta={`Submitted ${new Date(latestSubmission.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
      >
        <div className="ev2wr-panel">
          <div className="ev2wr-attribution">
            <strong>{latestSubmission.profiles?.full_name || "Team member"}</strong>
            <span>submitted this work for your decision.</span>
          </div>
          {latestSubmission.note && <div className="ev2wr-evidence">
            <span>Submission note</span>
            <p>{latestSubmission.note}</p>
          </div>}
          {latestSubmission.submission_files?.length > 0 && <div className="ev2wr-evidence">
            <span>Submitted evidence</span>
            <div className="ev2wr-links">
              {latestSubmission.submission_files.map((file) => <a key={file.url} href={file.url} target="_blank" rel="noreferrer">Open evidence ↗</a>)}
            </div>
          </div>}
          {checks.length > 0 && <div className="ev2wr-evidence">
            <span>Checklist context</span>
            <div className="ev2wr-checklist">
              {checks.map((check) => <div key={check.id}>{check.label}</div>)}
            </div>
          </div>}
          <div className="ev2wr-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setReviewComment(""); setReviewChecklist([]); setSheet("manager-review-return"); }}>
              Return for correction
            </button>
            <button type="button" className="btn" onClick={() => { setReviewComment(""); setReviewChecklist([]); setSheet("manager-review-approve"); }}>
              Approve
            </button>
          </div>
        </div>
      </WorkDetailSection>}

      {item.kind === "task" && item.assignee_id === me.id && !["in_review","completed","self_certified","cancelled"].includes(item.status) && <>
        {recipeSteps.length > 0 && <div className="card small" style={{ marginTop: 12 }}>
          <div className="row-t">Last time this unit did this</div>
          <div className="row-m">{recipeSource?.title} · {recipeSteps.length} recorded step{recipeSteps.length === 1 ? "" : "s"}</div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} disabled={busy} onClick={useRecipeSteps}>Use these steps</button>
        </div>}
        <div className="card small" style={{ marginTop: 10 }}>
          <div className="row-t">Break this work down</div>
          <div className="row-m">Add your own next step. Your manager’s original assignment remains unchanged.</div>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <input className="field" aria-label="Add my step" placeholder="Add my step" value={myStep} onChange={(event) => setMyStep(event.target.value)} />
            <button className="btn btn-sm" disabled={busy || !myStep.trim()} onClick={addMyStep}>Add step</button>
          </div>
        </div>
      </>}

      {item.assignee_id === me.id && !["routine", "case", "request", "decision"].includes(item.kind) && !(["in_review", "completed", "self_certified"].includes(item.status)) && (<>
        <button className="btn work-primary-action" style={{ marginTop: 20 }} onClick={() => setSheet("submit")}
          disabled={managerSubmissionBlocked || (checks.length > 0 && !allDone)}>
          {item.kind === "deliverable"
            ? (managerOwnWork ? "Finish deliverable" : "Send deliverable for review")
            : managerOwnWork ? "Finish this work" : "Send for review"}</button>
        {gated && <div className="hint">No work session is open. You can still send this in; it will be recorded as outside a session.</div>}
        {managerSubmissionBlocked && <div className="hint">Manager self-certification is waiting on the database migration. This work will not enter your review queue.</div>}
        {!gated && checks.length > 0 && !allDone && <div className="hint">Finish the checklist to send it in</div>}
        {!blocker && (
          <button className="btn btn-ghost work-secondary-action" style={{ marginTop: 10 }} onClick={() => setSheet("waiting")}>
            I am waiting on someone</button>)}
      </>)}

      {!canReview && item.status === "in_review" &&
        <div className="flag flag-amber" style={{ marginTop: 20 }}><h4>Sent in</h4>Waiting on {responsibleReviewer?.full_name || "the responsible reviewer"} to check it.</div>}

      {isManager && ["task", "meeting_outcome", "deliverable"].includes(item.kind) && ["completed", "self_certified"].includes(item.status) &&
        <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => { setNote(""); setSheet("reopen"); }}>
          Reopen this work
        </button>}

      {sheet === "manager-review-return" && latestSubmission && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Return for correction</div>
          <p className="screen-note">State exactly what needs changing. You can also identify checklist points that need to be redone.</p>
          {checks.length > 0 && <div className="ev2wr-return-checklist">
            {checks.map((check) => (
              <button
                type="button"
                key={check.id}
                className={reviewChecklist.includes(check.id) ? "is-selected" : ""}
                onClick={() => toggleReviewChecklist(check.id)}
              >
                <span className="box" aria-hidden="true" />
                <span>{check.label}</span>
              </button>
            ))}
          </div>}
          <AssistiveTextarea className="field" rows={4} placeholder="Explain exactly what needs changing" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} disabled={busy || !reviewComment.trim()} onClick={() => decideManagerReview("returned")}>
            {busy ? "Saving..." : "Return work"}
          </button>
        </Sheet>)}

      {sheet === "manager-review-approve" && latestSubmission && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Approve submitted work</div>
          <p className="screen-note">This records your approval against the submitted evidence and current work record.</p>
          <AssistiveTextarea className="field" rows={3} placeholder="Approval note (optional)" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={() => decideManagerReview("completed")}>
            {busy ? "Saving..." : "Confirm approval"}
          </button>
        </Sheet>)}

      {sheet === "decision-record" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Record decision</div>
          <p className="screen-note">The decision and rationale are permanent, attributable records.</p>
          <AssistiveTextarea className="field" rows={3} placeholder="Decision" value={decisionText} onChange={(e) => setDecisionText(e.target.value)} />
          <AssistiveTextarea className="field" rows={4} placeholder="Why was this decision made?" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={recordDecision} disabled={busy || !decisionText.trim() || !note.trim()}>
            {busy ? "Saving..." : "Record decision"}</button>
        </Sheet>)}

      {sheet === "request-fulfilled" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Mark request fulfilled</div>
          <AssistiveTextarea className="field" rows={3} placeholder="What was provided? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={() => respondRequest("fulfilled")} disabled={busy}>{busy ? "Saving..." : "Mark fulfilled"}</button>
        </Sheet>)}

      {sheet === "request-clarification" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Ask for clarification</div>
          <AssistiveTextarea className="field" rows={3} placeholder="What needs to be clarified?" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={() => respondRequest("clarification")} disabled={busy || !note.trim()}>{busy ? "Saving..." : "Ask for clarification"}</button>
        </Sheet>)}

      {sheet === "request-declined" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Decline request</div>
          <AssistiveTextarea className="field" rows={3} placeholder="Why is this request being declined?" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={() => respondRequest("declined")} disabled={busy || !note.trim()}>{busy ? "Saving..." : "Decline request"}</button>
        </Sheet>)}

      {sheet === "request-provide-clarification" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Provide clarification</div>
          <AssistiveTextarea className="field" rows={3} placeholder="Clarification" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={provideRequestClarification} disabled={busy || !note.trim()}>{busy ? "Saving..." : "Send clarification"}</button>
        </Sheet>)}

      {sheet === "request-cancel" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Cancel request</div>
          <AssistiveTextarea className="field" rows={3} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={() => respondRequest("cancelled")} disabled={busy}>{busy ? "Saving..." : "Cancel request"}</button>
        </Sheet>)}

      {sheet === "case-resolve" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Resolve this case</div>
          <p className="screen-note">Record how the matter ended. The resolution stays in the case history.</p>
          <AssistiveTextarea className="field" rows={4} placeholder="What resolved the case?" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={resolveCase} disabled={busy || !note.trim()}>
            {busy ? "Saving..." : "Resolve case"}</button>
        </Sheet>)}

      {sheet === "routine-record" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Record routine occurrence</div>
          <p className="screen-note">This creates a separate historical occurrence. Earlier occurrences are never rewritten.</p>
          <label className="small">Date<input className="field" type="date" value={routineDate} onChange={(e) => setRoutineDate(e.target.value)} /></label>
          {routine?.records_value && <input className="field" inputMode="decimal" placeholder={routine.value_label || "Value"} value={routineValue} onChange={(e) => setRoutineValue(e.target.value)} />}
          <AssistiveTextarea className="field" rows={2} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={recordRoutineOccurrence}
            disabled={busy || !routineDate || (routine?.records_value && !routineValue.trim())}>{busy ? "Recording..." : "Record occurrence"}</button>
        </Sheet>)}

      {sheet === "routine-schedule" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">{routine?.schedule_kind ? "Change future schedule" : "Set routine schedule"}</div>
          <p className="screen-note">{routine?.schedule_kind
            ? "The new schedule starts in the future. Earlier schedule history stays unchanged."
            : "This legacy routine had no reliable weekday in its old record. Set the schedule from today or later."}</p>
          <label className="small">Effective from<input className="field" type="date" value={routineEffective} onChange={(e) => setRoutineEffective(e.target.value)} /></label>
          <select className="field" value={routineSchedule} onChange={(e) => setRoutineSchedule(e.target.value)}>
            <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="weekdays">Selected weekdays</option><option value="monthly">Monthly</option>
          </select>
          {routineSchedule === "weekly" && <select className="field" value={routineWeeklyDay} onChange={(e) => setRoutineWeeklyDay(e.target.value)}>
            {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
          </select>}
          {routineSchedule === "weekdays" && <RoutineWeekdayPicker value={routineWeekdays}
             onChange={setRoutineWeekdays} label="Which days?" />}
          {routineSchedule === "monthly" && <input className="field" type="number" min="1" max="31" placeholder="Day of month (1–31)" value={routineDayOfMonth} onChange={(e) => setRoutineDayOfMonth(e.target.value)} />}
          <label className="small">Ends (optional)<input className="field" type="date" value={routineEnd} onChange={(e) => setRoutineEnd(e.target.value)} /></label>
          <RoutineScheduleOptions value={routineOptions} onChange={setRoutineOptions} frequency={routineSchedule} />
          <button className="btn" style={{ marginTop: 14 }} onClick={saveRoutineSchedule}
            disabled={busy || !routineEffective || (routineSchedule === "weekdays" && routineWeekdays.length === 0)
              || (routineSchedule === "monthly" && !(Number(routineDayOfMonth) >= 1 && Number(routineDayOfMonth) <= 31))}>
            {busy ? "Saving..." : "Save schedule"}</button>
        </Sheet>)}

      {sheet === "routine-pause" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">{routine?.active ? "Pause routine" : "Resume routine"}</div>
          <p className="screen-note">History is kept. Record why this routine is changing state.</p>
          <AssistiveTextarea className="field" rows={3} placeholder="Reason" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={toggleRoutinePause} disabled={busy || !note.trim()}>
            {busy ? "Saving..." : routine?.active ? "Pause routine" : "Resume routine"}</button>
        </Sheet>)}

      {sheet === "submit" && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="h2">{item.kind === "deliverable"
            ? (managerOwnWork ? "Finish deliverable" : "Send deliverable for review")
            : managerOwnWork ? "Finish this work" : "Send for review"}</div>
          <p className="screen-note">{managerOwnWork
            ? "This records your submission as self-certified. It will not enter your review queue."
            : `${responsibleReviewer?.full_name || "The responsible reviewer"} will receive this in their review queue.`}</p>
          {gated && <div className="flag flag-amber"><h4>No work session is open</h4>This submission will still be accepted and recorded as outside a session.</div>}
          <AssistiveTextarea className="field" rows={3} placeholder="Anything they should know (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <input className="field" placeholder={item.kind === "deliverable" && deliverableRecord?.evidence_required ? "Evidence link (required)" : "Paste a link to the file (optional)"} value={link} onChange={(e) => setLink(e.target.value)} />
          <p className="small" style={{ marginTop: 8 }}>Large files — video especially — should be a link rather than an upload.</p>
          <button className="btn" style={{ marginTop: 14 }} onClick={submit}
            disabled={busy || (item.kind === "deliverable" && deliverableRecord?.evidence_required && !link.trim())}>
            {busy ? "Saving..." : gated ? (managerOwnWork ? "Finish outside session" : "Send outside session") : managerOwnWork ? "Finish work" : "Send"}</button>
        </Sheet>)}

      {sheet === "reopen" && (
        <Sheet onClose={() => !busy && setSheet(null)}>
          <div className="h2">Reopen this work</div>
          <p className="screen-note">The existing approval/completion record stays in history. State why more work is required.</p>
          <AssistiveTextarea className="field" rows={3} placeholder="Why is this work being reopened?" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={reopenFinishedWork} disabled={busy || !note.trim()}>
            {busy ? "Reopening..." : "Reopen work"}
          </button>
        </Sheet>)}

      {sheet === "waiting" && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="h2">What are you waiting on?</div>
          <p className="screen-note">This stops the job counting as late, and shows your manager where the hold-up really is.</p>
          <input className="field" placeholder="What you need, and from whom" value={party} onChange={(e) => setParty(e.target.value)} />
          <div className="sec" style={{ marginTop: 14 }}><span>Which unit?</span></div>
          <div style={{ maxHeight: 148, overflowY: "auto" }}>
            {units.map((u) => (
              <button key={u.id} className="opt" onClick={() => setPartyUnit(u.id)}>
                <span className={"rd " + (partyUnit === u.id ? "on" : "")} /> {u.name}</button>))}
          </div>
          <AssistiveTextarea className="field" rows={2} placeholder="Anything worth noting (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} onClick={markWaiting} disabled={busy || !party.trim()}>
            {busy ? "Saving..." : "Mark as waiting"}</button>
          <div className="hint">They will be asked to confirm or disagree.</div>
        </Sheet>)}
    </div>);
}
