import RoutineScheduleOptions from "../components/RoutineScheduleOptions";
import { initialRoutineScheduleOptions, routineScheduleOptions } from "../lib/routineScheduleOptions";
import { useEffect, useState } from "react";
import AssistiveTextarea from "../components/AssistiveTextarea";
import { supabase } from "../lib/supabase";
import { routineCreationDetails } from "../lib/routineWriteValidation";
import VoiceInput from "../components/VoiceInput";
import { parseWorkInput } from "../lib/parseTask";
import { humanError } from "../lib/productLanguage";
import { FieldGroup } from "../components/bits";
import RoutineWeekdayPicker from "../components/RoutineWeekdayPicker";
import { ComposerDrawer } from "../experience-v2/components";
import { CeacIcon } from "../experience-v2/icons";
import { PendingFilePicker } from "../components/OperationalFiles";
import { uploadOperationalFiles } from "../lib/operationalFiles";

const WORK_KINDS = [
  ["task", "Task", "A specific action for someone to complete.", true],
  ["routine", "Routine", "Work that repeats on a schedule.", true],
  ["case", "Case", "A matter that stays open while several actions or follow-ups happen around it.", true],
  ["request", "Request", "Something you need another person or unit to provide, arrange or resolve.", true],
  ["decision", "Decision", "A choice that someone needs to make and record.", true],
  ["meeting_outcome", "Meeting outcome", "An action or commitment agreed in a meeting.", true],
  ["deliverable", "Deliverable", "A finished output that must be produced and shown.", true],
];

const WORK_INTENTS = [
  ["task", "Get something done", "A specific action someone should complete."],
  ["deliverable", "Get a finished output", "A file, document, production or other output that must be shown."],
  ["request", "Ask for something", "Another person or unit should provide, arrange or resolve something."],
  ["routine", "Set repeating work", "Responsibility that happens again on a schedule."],
  ["decision", "Get a decision", "Someone needs to make and record a choice."],
  ["case", "Track an ongoing matter", "Keep a matter open while actions and follow-ups happen."],
  ["meeting_outcome", "Follow up from a meeting", "Turn an agreed meeting action into accountable work."],
];

export default function Assign({ me, back, initialProjectId = "", initialObjectiveId = "", initialPhaseId = "", initialSubTeamId = "", initialMeetingId = "", initialKind = "", initialMeetingTitle = "", initialMeetingOn = "", initialMeetingNote = "", initialTitle = "", initialSourceRoomId = "", initialSourceMessageId = "", selectedUnitId = null, initialAssigneeId = "", scopeControl = null }) {
  const workUnitId = me.is_exec ? (selectedUnitId || me.unit_id) : me.unit_id;
  const [people, setPeople] = useState([]);
  const [assignmentReady, setAssignmentReady] = useState(false);
  const [subTeams, setSubTeams] = useState([]);
  const [approvedLeave, setApprovedLeave] = useState([]);
  const [projects, setProjects] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [phases, setPhases] = useState([]);
  const [units, setUnits] = useState([]);
  const [title, setTitle] = useState(initialTitle);
  const [purpose, setPurpose] = useState("");
  const [instructions, setInstructions] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [kind, setKind] = useState("task");
  const [assignee, setAssignee] = useState(initialAssigneeId);
  const [subTeam, setSubTeam] = useState(initialSubTeamId);
  const [project, setProject] = useState(initialProjectId);
  const [objective, setObjective] = useState(initialObjectiveId);
  const [phase, setPhase] = useState(initialPhaseId);
  const [due, setDue] = useState("");
  const [steps, setSteps] = useState([""]);
  const [noStepsNeeded, setNoStepsNeeded] = useState(false);
  const [routineSchedule, setRoutineSchedule] = useState("weekly");
  const [routineWeeklyDay, setRoutineWeeklyDay] = useState("7");
  const [routineWeekdays, setRoutineWeekdays] = useState([]);
  const [routineDayOfMonth, setRoutineDayOfMonth] = useState("");
  const [routineStart, setRoutineStart] = useState("");
  const [routineEnd, setRoutineEnd] = useState("");
  const [routineOptions, setRoutineOptions] = useState(initialRoutineScheduleOptions);
  const [routineRecordsValue, setRoutineRecordsValue] = useState(false);
  const [routineValueLabel, setRoutineValueLabel] = useState("");
  const [caseOpenedOn, setCaseOpenedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [caseTargetOn, setCaseTargetOn] = useState("");
  const [requestResponsibleUnit, setRequestResponsibleUnit] = useState("");
  const [decisionQuestion, setDecisionQuestion] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingOn, setMeetingOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [meetingNote, setMeetingNote] = useState("");
  const [deliverableEvidenceRequired, setDeliverableEvidenceRequired] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [voiceHint, setVoiceHint] = useState(null);
  const [voiceProposal, setVoiceProposal] = useState(null);
  const [recipeSteps, setRecipeSteps] = useState([]);
  const [recipeSource, setRecipeSource] = useState(null);
  const [traceWarning, setTraceWarning] = useState(null);
  const [sourceFiles, setSourceFiles] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => { load(); }, [me.id, me.org_id, workUnitId]);
  useEffect(() => {
    setProject(initialProjectId);
    setObjective(initialObjectiveId);
    setPhase(initialPhaseId);
    setSubTeam(initialSubTeamId);
    if (initialKind) setKind(initialKind);
    if (initialMeetingTitle) setMeetingTitle(initialMeetingTitle);
    if (initialMeetingOn) setMeetingOn(initialMeetingOn);
    if (initialMeetingNote) setMeetingNote(initialMeetingNote);
    if (initialTitle) setTitle(initialTitle);
  }, [initialProjectId, initialObjectiveId, initialPhaseId, initialSubTeamId, initialKind, initialMeetingTitle, initialMeetingOn, initialMeetingNote, initialTitle]);
  useEffect(() => { loadProjectContext(); }, [project]);
  useEffect(() => {
    if (kind !== "task" || title.trim().length < 4) { setRecipeSteps([]); setRecipeSource(null); return; }
    const timer = setTimeout(() => loadRecipeSuggestion(title), 250);
    return () => clearTimeout(timer);
  }, [kind, title, workUnitId]);

  async function load() {
    if (!workUnitId) return;
    setAssignmentReady(false);
    setErr(null);
    const readOptions = me.is_exec ? {count:"exact"} : undefined;
    const [peopleResult, leaveResult, unitResult] = await Promise.all([
      supabase.from("unit_memberships")
        .select("profile_id, profiles(full_name,active)", readOptions).eq("org_id", me.org_id).eq("unit_id", workUnitId),
      supabase.from("leave_requests")
        .select("id,profile_id,kind,start_date,end_date,status")
        .eq("status", "approved"),
      supabase.from("units").select("id,name").eq("org_id", me.org_id).eq("active", true).order("name"),
    ]);
    if (peopleResult.error) { setErr(peopleResult.error.message); return; }
    if (leaveResult.error) { setErr(leaveResult.error.message); return; }
    if (unitResult.error) { setErr(unitResult.error.message); return; }
    if (me.is_exec && (!Array.isArray(peopleResult.data) || peopleResult.count !== peopleResult.data.length)) {
      setErr("The department's people could not be completely loaded. Close and try again."); return;
    }
    setPeople((peopleResult.data || []).filter(row => row.profiles?.active));
    setUnits(unitResult.data || []);
    const memberIds = new Set((peopleResult.data || []).map((row) => row.profile_id));
    setApprovedLeave((leaveResult.data || []).filter((row) => memberIds.has(row.profile_id)));
    const { data: st, error: teamError } = await supabase.from("sub_teams")
      .select("id,name,code").eq("unit_id", workUnitId).eq("active", true).order("position");
    if (teamError) { setErr(teamError.message); return; }
    setSubTeams(st || []);
    const { data: p, error: projectError, count: projectCount } = await supabase.from("projects").select("id,name,starts_on,ends_on,status,lead_unit_id,project_units(unit_id)", readOptions).eq("org_id",me.org_id).order("name");
    if (projectError) { setErr(projectError.message); return; }
    if (me.is_exec && (!Array.isArray(p) || projectCount !== p.length)) {
      setErr("Projects could not be completely loaded. Close and try again."); return;
    }
    setAssignmentReady(true);
    setProjects((p || []).filter((row) => (me.is_exec ? ["planned","active"].includes(row.status) : row.lead_unit_id === workUnitId || (row.project_units || []).some((unit) => unit.unit_id === workUnitId))));
  }

  function normaliseWorkTitle(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  async function loadRecipeSuggestion(candidateTitle) {
    const normalized = normaliseWorkTitle(candidateTitle);
    if (!normalized) { setRecipeSteps([]); setRecipeSource(null); return; }
    const result = await supabase.from("work_items")
      .select("id,title,completed_at,checklist_items(label,position)")
      .eq("unit_id", workUnitId)
      .eq("kind", "task")
      .in("status", ["completed","self_certified"])
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(40);
    if (result.error) { setRecipeSteps([]); setRecipeSource(null); return; }
    const prior = (result.data || []).find((row) =>
      normaliseWorkTitle(row.title) === normalized && (row.checklist_items || []).length > 0
    );
    if (!prior) { setRecipeSteps([]); setRecipeSource(null); return; }
    const ordered = [...prior.checklist_items].sort((a,b) => a.position-b.position).map((row) => row.label).filter(Boolean);
    setRecipeSteps(ordered);
    setRecipeSource(prior);
  }

  async function loadProjectContext() {
    if (!project) { setObjectives([]); setPhases([]); setObjective(""); setPhase(""); return; }
    const [objectiveResult, phaseResult] = await Promise.all([
      supabase.from("objectives").select("id, ref, name, unit_id, status").eq("project_id", project).eq("unit_id", workUnitId).order("ref"),
      supabase.from("project_phases").select("id, name, position").eq("project_id", project).order("position"),
    ]);
    if (objectiveResult.error) { setErr(`Project objectives: ${objectiveResult.error.message}`); return; }
    if (phaseResult.error) { setErr(`Project phases: ${phaseResult.error.message}`); return; }
    setObjectives(objectiveResult.data || []);
    setPhases(phaseResult.data || []);
    if (objective && !(objectiveResult.data || []).some((row) => row.id === objective)) setObjective("");
    if (phase && !(phaseResult.data || []).some((row) => row.id === phase)) setPhase("");
  }

  const selectedProject = projects.find((row) => row.id === project) || null;
  const selectedObjective = objectives.find((row) => row.id === objective) || null;
  const selectedPerson = people.find((row) => row.profile_id === assignee) || null;
  const dueDate = due ? due.slice(0, 10) : null;
  const assignmentWarnings = [];
  if (selectedPerson?.profiles?.active === false) {
    assignmentWarnings.push({ key: "inactive", title: "This person is marked inactive", detail: "CEAC OS is showing the profile status already recorded for this person. Check that the intended assignee is correct before sending." });
  }
  if (assignee && dueDate) {
    approvedLeave.filter((row) => row.profile_id === assignee && row.start_date <= dueDate && row.end_date >= dueDate)
      .forEach((row) => assignmentWarnings.push({ key: `leave-${row.id}`, title: "Due date falls during approved leave", detail: `${row.kind} leave is recorded from ${row.start_date} to ${row.end_date}. This is a factual warning; change the assignee/date or proceed if the work has already been agreed.` }));
  }
  if (selectedProject?.status === "closed") {
    assignmentWarnings.push({ key: "closed-project", title: "This project is closed", detail: "The selected project is recorded as closed. Confirm that this work should still be attached here." });
  }
  if (selectedProject && dueDate && selectedProject.starts_on && dueDate < selectedProject.starts_on) {
    assignmentWarnings.push({ key: "before-project", title: "Due date is before the project starts", detail: `Project start: ${selectedProject.starts_on} · task due: ${dueDate}.` });
  }
  if (selectedProject && dueDate && selectedProject.ends_on && dueDate > selectedProject.ends_on) {
    assignmentWarnings.push({ key: "after-project", title: "Due date is after the project ends", detail: `Project end: ${selectedProject.ends_on} · task due: ${dueDate}.` });
  }
  if (selectedObjective && ["met", "partly_met", "not_met"].includes(selectedObjective.status)) {
    assignmentWarnings.push({ key: "finished-objective", title: "This objective already has an outcome recorded", detail: `${selectedObjective.ref} is marked ${selectedObjective.status.replaceAll("_", " ")}. Confirm that new work should still sit under it.` });
  }

  function handleVoice(text) {
    setVoiceProposal(parseWorkInput(text, { people, projects, subTeams }));
    setVoiceHint(null);
  }

  function applyVoiceProposal(proposal, wordingOnly = false) {
    if (!proposal) return;
    setTitle(wordingOnly ? proposal.transcript : (proposal.title || proposal.transcript));
    if (!wordingOnly) {
      if (proposal.kind && WORK_KINDS.some(([value]) => value === proposal.kind)) setKind(proposal.kind);
      if (proposal.assignee_id) setAssignee(proposal.assignee_id);
      if (proposal.project_id) setProject(proposal.project_id);
      if (proposal.sub_team_id) setSubTeam(proposal.sub_team_id);
      if (proposal.due_at) {
        const d = new Date(proposal.due_at);
        const pad = (n) => String(n).padStart(2, "0");
        setDue(d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()));
      }
    }
    setVoiceHint(wordingOnly
      ? "Transcript added. Complete the work details before sending."
      : "CEAC applied what it could resolve. Review every field before sending.");
    setVoiceProposal(null);
  }

  async function linkMeeting(workId) {
    if (!initialMeetingId || !workId) return;
    const relation = kind === "meeting_outcome" ? "outcome" : "action";
    const result = await supabase.from("meeting_work_links").insert({
      meeting_id: initialMeetingId,
      work_item_id: workId,
      relation,
      linked_by: me.id,
    });
    if (result.error) throw new Error(`Meeting link: ${result.error.message}`);
  }

  async function linkSourceMessage(work) {
    if (!initialSourceRoomId || !initialSourceMessageId || !work?.id) return;
    const result = await supabase.rpc("send_room_message", {
      p_room_id: initialSourceRoomId,
      p_body: `Created ${work.ref} from this message.`,
      p_reply_to_id: initialSourceMessageId,
      p_refs: [{ object_type: "work_item", object_id: work.id, label: `${work.ref} · ${title.trim()}` }],
      p_mention_ids: [],
    });
    if (result.error) {
      setTraceWarning("The work was created, but CEAC could not attach the trace-back message in the Room.");
    }
  }

  async function attachSourceFiles(workId) {
    if (!workId || !sourceFiles.length) return;
    try {
      await uploadOperationalFiles({
        files: sourceFiles,
        contextType: "work_item",
        contextId: workId,
        relation: "assignment_source",
      });
      setSourceFiles([]);
    } catch (error) {
      setTraceWarning(`The work was created, but ${error.message || "one or more source files could not be attached."}`);
    }
  }

  function primaryActionLabel() {
    if (kind === "deliverable") return "Give deliverable";
    if (kind === "meeting_outcome") return "Record meeting outcome";
    if (kind === "decision") return "Ask for decision";
    if (kind === "request") return "Send request";
    if (kind === "case") return "Open case";
    if (kind === "routine") return "Create routine";
    return "Give it out";
  }

  function primaryActionDisabled() {
    if (busy || (me.is_exec && !assignmentReady)) return true;
    if (kind === "deliverable") return !title.trim() || !expectedOutcome.trim() || !assignee;
    if (kind === "meeting_outcome") return !title.trim() || !meetingTitle.trim() || !meetingOn || !assignee;
    if (kind === "decision") return !title.trim() || !decisionQuestion.trim() || !assignee;
    if (kind === "request") return !title.trim() || (!requestResponsibleUnit && !assignee);
    if (kind === "case") return !title.trim() || !assignee || !caseOpenedOn || Boolean(caseTargetOn && caseTargetOn < caseOpenedOn);
    if (kind === "routine") return !title.trim() || !assignee || !routineStart || Boolean(routineEnd && routineEnd < routineStart)
      || (routineSchedule === "weekdays" && routineWeekdays.length === 0)
      || (routineSchedule === "monthly" && !(Number(routineDayOfMonth) >= 1 && Number(routineDayOfMonth) <= 31))
      || (routineRecordsValue && !routineValueLabel.trim());
    return !title.trim() || !purpose.trim() || !assignee || !due;
  }

  async function create() {
    if (busy || (me.is_exec && !assignmentReady)) return;
    setBusy(true); setErr(null); setTraceWarning(null);
    try {
      const selectedKind = WORK_KINDS.find(([value]) => value === kind);
      if (!selectedKind?.[3]) throw new Error("This work type is not connected yet. CEAC OS will not save it with the wrong behaviour.");

      if (kind === "deliverable") {
        const { data: workId, error: deliverableError } = await supabase.rpc("create_typed_work", {
          p_kind: "deliverable",
          p_unit_id: workUnitId,
          p_title: title.trim(),
          p_assignee_id: assignee || null,
          p_sub_team_id: subTeam || null,
          p_project_id: project || null,
          p_phase_id: project && phase ? phase : null,
          p_objective_id: project && objective ? objective : null,
          p_responsibility_id: null,
          p_purpose: purpose.trim() || null,
          p_expected_outcome: expectedOutcome.trim() || null,
          p_due_at: due ? new Date(due).toISOString() : null,
          p_visibility: "unit",
          p_confidential: false,
          p_details: {
            evidence_required: deliverableEvidenceRequired,
            evidence_kind: deliverableEvidenceRequired ? "link" : "none",
          },
        });
        if (deliverableError) throw deliverableError;
        const createdResult = await supabase.from("work_items").select("ref").eq("id", workId).single();
        if (createdResult.error) throw createdResult.error;
        await linkMeeting(workId);
        await attachSourceFiles(workId);
        setDone(createdResult.data.ref);
        setTitle(""); setPurpose(""); setExpectedOutcome(""); setAssignee(""); setDue("");
        setDeliverableEvidenceRequired(true); setKind("task"); setVoiceHint(null);
        return;
      }

      if (kind === "meeting_outcome") {
        const { data: workId, error: meetingError } = await supabase.rpc("create_typed_work", {
          p_kind: "meeting_outcome",
          p_unit_id: workUnitId,
          p_title: title.trim(),
          p_assignee_id: assignee || null,
          p_sub_team_id: subTeam || null,
          p_project_id: project || null,
          p_phase_id: project && phase ? phase : null,
          p_objective_id: project && objective ? objective : null,
          p_responsibility_id: null,
          p_purpose: purpose.trim() || null,
          p_expected_outcome: expectedOutcome.trim() || null,
          p_due_at: due ? new Date(due).toISOString() : null,
          p_visibility: "unit",
          p_confidential: false,
          p_details: {
            meeting_title: meetingTitle.trim(),
            meeting_on: meetingOn,
            ...(meetingNote.trim() ? { meeting_note: meetingNote.trim() } : {}),
          },
        });
        if (meetingError) throw meetingError;
        const createdResult = await supabase.from("work_items").select("ref").eq("id", workId).single();
        if (createdResult.error) throw createdResult.error;
        await linkMeeting(workId);
        await attachSourceFiles(workId);
        setDone(createdResult.data.ref);
        setTitle(""); setPurpose(""); setExpectedOutcome(""); setAssignee(""); setDue("");
        setMeetingTitle(""); setMeetingOn(new Date().toISOString().slice(0, 10)); setMeetingNote("");
        setKind("task"); setVoiceHint(null);
        return;
      }

      if (kind === "decision") {
        const { data: workId, error: decisionError } = await supabase.rpc("create_typed_work", {
          p_kind: "decision",
          p_unit_id: workUnitId,
          p_title: title.trim(),
          p_assignee_id: assignee || null,
          p_sub_team_id: subTeam || null,
          p_project_id: project || null,
          p_phase_id: project && phase ? phase : null,
          p_objective_id: project && objective ? objective : null,
          p_responsibility_id: null,
          p_purpose: purpose.trim() || null,
          p_expected_outcome: expectedOutcome.trim() || null,
          p_due_at: due ? new Date(due).toISOString() : null,
          p_visibility: "unit",
          p_confidential: false,
          p_details: { question: decisionQuestion.trim() || title.trim() },
        });
        if (decisionError) throw decisionError;
        const createdResult = await supabase.from("work_items").select("ref").eq("id", workId).single();
        if (createdResult.error) throw createdResult.error;
        await linkMeeting(workId);
        await attachSourceFiles(workId);
        setDone(createdResult.data.ref);
        setTitle(""); setPurpose(""); setExpectedOutcome(""); setAssignee(""); setDue("");
        setDecisionQuestion(""); setKind("task"); setVoiceHint(null);
        return;
      }

      if (kind === "request") {
        const { data: workId, error: requestError } = await supabase.rpc("create_typed_work", {
          p_kind: "request",
          p_unit_id: workUnitId,
          p_title: title.trim(),
          p_assignee_id: assignee || null,
          p_sub_team_id: subTeam || null,
          p_project_id: project || null,
          p_phase_id: project && phase ? phase : null,
          p_objective_id: project && objective ? objective : null,
          p_responsibility_id: null,
          p_purpose: purpose.trim() || null,
          p_expected_outcome: expectedOutcome.trim() || null,
          p_due_at: due ? new Date(due).toISOString() : null,
          p_visibility: "unit",
          p_confidential: false,
          p_details: {
            ...(requestResponsibleUnit ? { responsible_unit_id: requestResponsibleUnit } : {}),
          },
        });
        if (requestError) throw requestError;
        const createdResult = await supabase.from("work_items").select("ref").eq("id", workId).single();
        if (createdResult.error) throw createdResult.error;
        await linkMeeting(workId);
        await attachSourceFiles(workId);
        setDone(createdResult.data.ref);
        setTitle(""); setPurpose(""); setExpectedOutcome(""); setAssignee(""); setDue("");
        setRequestResponsibleUnit(""); setKind("task"); setVoiceHint(null);
        return;
      }

      if (kind === "case") {
        const { data: workId, error: caseError } = await supabase.rpc("create_typed_work", {
          p_kind: "case",
          p_unit_id: workUnitId,
          p_title: title.trim(),
          p_assignee_id: assignee || null,
          p_sub_team_id: subTeam || null,
          p_project_id: project || null,
          p_phase_id: project && phase ? phase : null,
          p_objective_id: project && objective ? objective : null,
          p_responsibility_id: null,
          p_purpose: purpose.trim() || null,
          p_expected_outcome: expectedOutcome.trim() || null,
          p_due_at: caseTargetOn ? new Date(`${caseTargetOn}T23:59:00`).toISOString() : null,
          p_visibility: "unit",
          p_confidential: false,
          p_details: {
            opened_on: caseOpenedOn,
            ...(caseTargetOn ? { target_resolution_on: caseTargetOn } : {}),
          },
        });
        if (caseError) throw caseError;
        const createdResult = await supabase.from("work_items").select("ref").eq("id", workId).single();
        if (createdResult.error) throw createdResult.error;
        await linkMeeting(workId);
        await attachSourceFiles(workId);
        setDone(createdResult.data.ref);
        setTitle(""); setPurpose(""); setExpectedOutcome(""); setAssignee(""); setDue("");
        setCaseOpenedOn(new Date().toISOString().slice(0, 10)); setCaseTargetOn("");
        setKind("task"); setVoiceHint(null);
        return;
      }

      if (kind === "routine") {
        const details = routineCreationDetails({
          schedule: routineSchedule, start: routineStart, end: routineEnd,
          weekday: routineWeeklyDay, weekdays: routineWeekdays, monthDay: routineDayOfMonth,
          recordsValue: routineRecordsValue, valueLabel: routineValueLabel,
        });

        const { data: workId, error: routineError } = await supabase.rpc("create_typed_work", {
          p_kind: "routine",
          p_unit_id: workUnitId,
          p_title: title.trim(),
          p_assignee_id: assignee || null,
          p_sub_team_id: subTeam || null,
          p_project_id: project || null,
          p_phase_id: project && phase ? phase : null,
          p_objective_id: project && objective ? objective : null,
          p_responsibility_id: null,
          p_purpose: purpose.trim() || null,
          p_expected_outcome: expectedOutcome.trim() || null,
          p_due_at: null,
          p_visibility: "unit",
          p_confidential: false,
          p_details: {...details, ...routineScheduleOptions(routineOptions)},
        });
        if (routineError) throw routineError;
        const createdResult = await supabase.from("work_items").select("ref").eq("id", workId).single();
        if (createdResult.error) throw createdResult.error;
        await linkMeeting(workId);
        await attachSourceFiles(workId);
        setDone(createdResult.data.ref);
        setTitle(""); setPurpose(""); setInstructions(""); setExpectedOutcome("");
        setKind("task"); setAssignee(""); setDue(""); setSteps([""]); setNoStepsNeeded(false);
        setRoutineSchedule("weekly"); setRoutineWeeklyDay("7"); setRoutineWeekdays([]);
        setRoutineDayOfMonth(""); setRoutineStart(""); setRoutineEnd("");
        setRoutineRecordsValue(false); setRoutineValueLabel(""); setVoiceHint(null);
        return;
      }

      const clean = noStepsNeeded ? [] : steps.map((step) => step.trim()).filter(Boolean);
      const dueIso = due ? new Date(due).toISOString() : null;
      const { data: created, error: taskError } = await supabase.rpc("create_task_with_checklist", {
        p_unit_id: workUnitId,
        p_assignee_id: assignee,
        p_title: title.trim(),
        p_expected_outcome: expectedOutcome.trim() || null,
        p_sub_team_id: subTeam || null,
        p_project_id: project || null,
        p_objective_id: project && objective ? objective : null,
        p_phase_id: project && phase ? phase : null,
        p_purpose: purpose.trim() || null,
        p_instructions: instructions.trim() || null,
        p_due_at: dueIso,
        p_origin: me.is_exec ? "assigned_by_exec" : "assigned",
        p_visibility: "unit",
        p_steps: clean,
      });
      if (taskError) throw taskError;
      await linkMeeting(created.id);
      await linkSourceMessage(created);
      await attachSourceFiles(created.id);
      setDone(created.ref);
      setTitle(""); setPurpose(""); setInstructions(""); setExpectedOutcome("");
      setKind("task"); setDue(""); setSteps([""]); setNoStepsNeeded(false); setVoiceHint(null); setVoiceProposal(null);
    } catch (e) { setErr(e.message || "Something went wrong. Nothing was sent."); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <ComposerDrawer
        open
        onClose={back}
        title="Work sent"
        description="The work record is saved and available to the authorised people involved."
      >
        <div className="assign-screen assign-done ev2-work-assignment ocr-work-composer">
          <div className="empty">
            <h3>{done} is with them</h3>
            <p>They will see what needs doing, why it matters and when it is due.</p>
            {traceWarning && <div className="flag flag-amber" style={{ marginBottom: 12 }}>{traceWarning}</div>}
            <button className="btn" onClick={() => setDone(null)}>Give out something else</button>
            <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={back}>Close</button>
          </div>
        </div>
      </ComposerDrawer>
    );
  }

  return (
    <ComposerDrawer
      open
      onClose={back}
      title="Give out work"
      description={kind === "task" ? null : "Capture what matters, who owns it and when it is due. Add deeper context only when the work needs it."}
      panelClassName="reference-composer reference-work-composer"
      footer={<button className="btn assign-primary-action" onClick={create} disabled={primaryActionDisabled()}>{busy ? "Saving…" : primaryActionLabel()}</button>}
    >
    <div className={`assign-screen ev2-work-assignment ocr-work-composer is-${kind}`}>
      {kind !== "task" && <section className="assign-intro ev2wa-intro">
        <div className="assign-voice">
          <div><strong>Speak or type</strong><span>Voice can prefill the form. You remain in control.</span></div>
          <VoiceInput onResult={handleVoice} label="Speak your instruction" />
        </div>
      </section>}
      {voiceProposal && <div className="voice-proposal">
        <div className="voice-proposal-head"><span>CEAC heard</span><strong>{voiceProposal.transcript}</strong></div>
        <div className="voice-proposal-facts">
          <span>Type <b>{WORK_KINDS.find(([value]) => value === voiceProposal.kind)?.[1] || "Task"}</b></span>
          {voiceProposal.resolved.map((row) => <span key={row.type + row.id}>{row.type.replaceAll("_"," ")} <b>{row.label}</b></span>)}
          {voiceProposal.due_at && <span>Due <b>{new Date(voiceProposal.due_at).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</b></span>}
        </div>
        <p>Nothing has been created yet. Apply the proposal, then check the form.</p>
        <div className="voice-proposal-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => applyVoiceProposal(voiceProposal, true)}>Use wording only</button>
          <button className="btn btn-sm" onClick={() => applyVoiceProposal(voiceProposal)}>Apply proposal</button>
        </div>
      </div>}
      {scopeControl?.(busy)}
      {me.is_exec && project && projects.some(row => row.id === project && row.lead_unit_id !== workUnitId && !(row.project_units || []).some(unit => unit.unit_id === workUnitId)) && <p role="status" className="flag flag-amber">Saving this work will also add the selected department to the project. Its staff will be able to see shared project records allowed by their roles.</p>}
      {voiceHint && <div className="flag flag-green" style={{ marginTop: 10 }}>{voiceHint}</div>}
      {err && <div className="flag flag-brick" style={{ marginTop: 10 }}>{err}</div>}

      {kind === "task" && <div className="reference-task-form">
        <div className="reference-kind-row">
          <span className="reference-kind-icon"><CeacIcon name="work" size="row" decorative /></span>
          <span className="reference-kind-prefix">Task ·</span>
          <select aria-label="Work type" value={kind} onChange={(event) => setKind(event.target.value)}>
            {WORK_INTENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <VoiceInput compact onResult={handleVoice} label="Speak your instruction" />
        </div>

        <label className="reference-recurring-toggle" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", margin: "12px 0", border: "1px solid #dce7f3", borderRadius: 9, background: "#f8fbff" }}>
          <input type="checkbox" aria-label="Repeat this responsibility" checked={false} onChange={(event) => { if (event.target.checked) { setKind("routine"); setRoutineStart(due ? due.slice(0, 10) : routineStart); } }} />
          <span><strong>Repeat this responsibility</strong><small style={{ display: "block", color: "#72839a" }}>Daily, weekly, monthly or selected days. Set the schedule once.</small></span>
        </label>
        <FieldGroup label="What needs doing *" className="reference-primary-field">
          <input className="field" aria-label="Work to complete" placeholder="e.g. Prepare the October service report" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FieldGroup>

        <div className="reference-compact-fields">
          <FieldGroup label="Assignee *">
            <select className="field" aria-label="Responsible person" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Choose someone</option>
              {people.map((p) => <option key={p.profile_id} value={p.profile_id}>{p.profiles ? p.profiles.full_name : "—"}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Due date *">
            <input className="field" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Project">
            <select className="field" value={project} onChange={(e) => { setProject(e.target.value); setObjective(""); setPhase(""); }}>
              <option value="">Not selected</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{!["planned","active"].includes(p.status) ? ` · ${p.status}` : ""}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Team">
            <select className="field" value={subTeam} onChange={(e) => setSubTeam(e.target.value)}>
              <option value="">Not selected</option>
              {subTeams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FieldGroup>
        </div>

        {project && <details className="reference-disclosure">
          <summary><span>Project context</span><span>+</span></summary>
          <div className="reference-disclosure-body">
            <FieldGroup label="Project objective">
              <select className="field" value={objective} onChange={(e) => setObjective(e.target.value)}>
                <option value="">Not selected</option>
                {objectives.map((row) => <option key={row.id} value={row.id}>{row.ref} · {row.name}</option>)}
              </select>
            </FieldGroup>
            {phases.length > 0 && <FieldGroup label="Project phase">
              <select className="field" value={phase} onChange={(e) => setPhase(e.target.value)}>
                <option value="">Not selected</option>
                {phases.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </FieldGroup>}
          </div>
        </details>}

        <FieldGroup label="Why this matters *" className="reference-why-field">
          <AssistiveTextarea className="field" rows={3} placeholder="Explain the purpose or impact" value={purpose} onChange={(e) => setPurpose(e.target.value)} voiceLabel="Dictate purpose" />
        </FieldGroup>

        <details className="reference-disclosure">
          <summary><span>Attachments</span><span>+ Add file · {sourceFiles.length}</span></summary>
          <div className="reference-disclosure-body">
            <PendingFilePicker files={sourceFiles} onChange={setSourceFiles} label="Attach source files" disabled={busy} />
          </div>
        </details>

        <details className="reference-disclosure">
          <summary><span>Subtasks</span><span>+ Add subtask · {noStepsNeeded ? 0 : steps.filter((step) => step.trim()).length}</span></summary>
          <div className="reference-disclosure-body">
            {recipeSteps.length > 0 && <div className="reference-recipe">
              <span><strong>Last time this unit did this</strong><small>{recipeSource?.title} · {recipeSteps.length} recorded step{recipeSteps.length === 1 ? "" : "s"}</small></span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSteps(recipeSteps); setNoStepsNeeded(false); }}>Use steps</button>
            </div>}
            {steps.map((s, i) => <input key={i} className="field" placeholder={"Step " + (i + 1)} value={s} disabled={noStepsNeeded}
              onChange={(e) => setSteps((x) => x.map((v, j) => (j === i ? e.target.value : v)))} />)}
            {!noStepsNeeded && <button type="button" className="btn btn-ghost btn-sm reference-add-row"
              disabled={!steps[steps.length - 1]?.trim()}
              onClick={() => setSteps((current) => [...current, ""])}>+ Add subtask</button>}
            <label className="reference-check"><input type="checkbox" checked={noStepsNeeded} onChange={(event) => setNoStepsNeeded(event.target.checked)} /><span>No steps needed</span></label>
          </div>
        </details>

        <details className="reference-disclosure">
          <summary><span>Instructions <small>(optional)</small></span><span>+</span></summary>
          <div className="reference-disclosure-body">
            <AssistiveTextarea className="field" rows={3} placeholder="How it is done here" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
        </details>

        <details className="reference-disclosure">
          <summary><span>Finished result <small>(optional)</small></span><span>+</span></summary>
          <div className="reference-disclosure-body">
            <AssistiveTextarea className="field" aria-label="Finished result" rows={3} placeholder="Describe the finished result if useful" value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} voiceLabel="Dictate outcome" />
          </div>
        </details>

        {assignmentWarnings.length > 0 && <div className="reference-warning-stack">
          {assignmentWarnings.map((warning) => <div key={warning.key} className="flag flag-amber"><h4>{warning.title}</h4>{warning.detail}</div>)}
        </div>}
      </div>}

      {kind !== "task" && <div className="split" style={{ marginTop: 10 }}>
        <div className="main-col">
          <FieldGroup label="Work type">
            <select className="field" aria-label="Work type" value={kind} onChange={(event) => setKind(event.target.value)}>
              {WORK_INTENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FieldGroup>
          <div className="assign-system-type">
            <strong>{WORK_INTENTS.find(([value]) => value === kind)?.[1]}</strong>
            <span>{WORK_INTENTS.find(([value]) => value === kind)?.[2]}</span>
            <small>CEAC records this as {WORK_KINDS.find(([value]) => value === kind)?.[1]}.</small>
          </div>
          {!WORK_KINDS.find(([value]) => value === kind)?.[3] && <div className="flag flag-amber" style={{ marginTop: 10 }}>
            <h4>{WORK_KINDS.find(([value]) => value === kind)?.[1]} is not connected yet</h4>
            Its approved behaviour is not connected to this screen yet. CEAC OS will not save it with Task behaviour.
          </div>}
          {kind === "deliverable" && <>
            <FieldGroup label="Output to produce"><input className="field" placeholder="e.g. Final campaign video" value={title} onChange={(e) => setTitle(e.target.value)} /></FieldGroup>
            <FieldGroup label="Why this output matters" hint="Optional context for the person doing the work."><AssistiveTextarea className="field" rows={3} placeholder="Who it is for or why it matters" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></FieldGroup>
            <div className="sec"><span>Finished output</span></div>
            <FieldGroup label="Finished output"><AssistiveTextarea className="field" rows={3} placeholder="Describe exactly what must be delivered" value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} /></FieldGroup>
            <label className="card small" style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 10 }}>
              <input type="checkbox" checked={deliverableEvidenceRequired} onChange={(e) => setDeliverableEvidenceRequired(e.target.checked)} />
              <span>Require an evidence link before this deliverable can be approved.</span>
            </label>
            <div className="hint">This does not use a Task checklist. Review is based on the finished output and its evidence.</div>
          </>}
          {kind === "meeting_outcome" && <>
            <FieldGroup label="Commitment agreed"><input className="field" placeholder="What was agreed?" value={title} onChange={(e) => setTitle(e.target.value)} /></FieldGroup>
            <AssistiveTextarea className="field" rows={3} placeholder="Why this commitment matters (optional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            <AssistiveTextarea className="field" rows={3} placeholder="What finished looks like (optional)" value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} />
            <div className="sec"><span>Meeting source</span></div>
            <FieldGroup label="Meeting title"><input className="field" placeholder="Meeting title" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} /></FieldGroup>
            <FieldGroup label="Meeting date"><input className="field" type="date" value={meetingOn} onChange={(e) => setMeetingOn(e.target.value)} /></FieldGroup>
            <AssistiveTextarea className="field" rows={2} placeholder="Meeting note (optional)" value={meetingNote} onChange={(e) => setMeetingNote(e.target.value)} />
          </>}
          {kind === "decision" && <>
            <FieldGroup label="Decision needed"><input className="field" placeholder="What decision is needed?" value={title} onChange={(e) => setTitle(e.target.value)} /></FieldGroup>
            <FieldGroup label="Decision question"><AssistiveTextarea className="field" rows={3} placeholder="State the choice or question clearly" value={decisionQuestion} onChange={(e) => setDecisionQuestion(e.target.value)} /></FieldGroup>
            <AssistiveTextarea className="field" rows={3} placeholder="Context the decision-maker should know (optional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </>}
          {kind === "request" && <>
            <FieldGroup label="What you need"><input className="field" placeholder="What do you need?" value={title} onChange={(e) => setTitle(e.target.value)} /></FieldGroup>
            <AssistiveTextarea className="field" rows={3} placeholder="Why is it needed? (optional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            <AssistiveTextarea className="field" rows={3} placeholder="What should be provided or resolved? (optional)" value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} />
          </>}
          {kind === "case" && <>
            <FieldGroup label="Matter to track"><input className="field" placeholder="What matter needs to stay open?" value={title} onChange={(e) => setTitle(e.target.value)} /></FieldGroup>
            <AssistiveTextarea className="field" rows={3} placeholder="Why this case matters (optional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            <AssistiveTextarea className="field" rows={3} placeholder="What outcome would resolve this case? (optional)" value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} />
            <div className="sec"><span>Case dates</span></div>
            <label className="small">Opened on<input className="field" type="date" value={caseOpenedOn} onChange={(e) => setCaseOpenedOn(e.target.value)} /></label>
            <label className="small">Target resolution (optional)<input className="field" type="date" value={caseTargetOn} onChange={(e) => setCaseTargetOn(e.target.value)} /></label>
          </>}
          {kind === "routine" && <>
            <label className="reference-recurring-toggle" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 12, borderRadius: 9, background: "#f8fbff" }}>
              <input type="checkbox" aria-label="Repeat this responsibility" checked onChange={(event) => { if (!event.target.checked) setKind("task"); }} />
              <span><strong>Repeat this responsibility</strong><small style={{ display: "block", color: "#72839a" }}>Untick to return to a one-off task.</small></span>
            </label>
            <FieldGroup label="Repeating responsibility"><input className="field" placeholder="What repeats?" value={title} onChange={(e) => setTitle(e.target.value)} /></FieldGroup>
            <AssistiveTextarea className="field" rows={3} placeholder="Why this routine matters (optional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            <AssistiveTextarea className="field" rows={3} placeholder="What a good occurrence records or produces (optional)" value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} />
            <div className="sec"><span>Schedule</span></div>
            <select className="field" aria-label="Repeat frequency" value={routineSchedule} onChange={(e) => setRoutineSchedule(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="weekdays">Selected weekdays</option>
              <option value="monthly">Monthly</option>
            </select>
            {routineSchedule === "weekly" && <select className="field" aria-label="Repeat weekday" value={routineWeeklyDay} onChange={(e) => setRoutineWeeklyDay(e.target.value)}>
              {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
            </select>}
            {routineSchedule === "weekdays" && <RoutineWeekdayPicker value={routineWeekdays}
              onChange={setRoutineWeekdays} label="Which days?" />}
            {routineSchedule === "monthly" && <input className="field" type="number" min="1" max="31" placeholder="Day of month (1–31)"
              value={routineDayOfMonth} onChange={(e) => setRoutineDayOfMonth(e.target.value)} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="small">Starts<input className="field" type="date" value={routineStart} onChange={(e) => setRoutineStart(e.target.value)} /></label>
              <label className="small">Ends (optional)<input className="field" type="date" value={routineEnd} onChange={(e) => setRoutineEnd(e.target.value)} /></label>
            </div>
            <RoutineScheduleOptions value={routineOptions} onChange={setRoutineOptions} frequency={routineSchedule} />
            <label className="card small" style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 10 }}>
              <input type="checkbox" checked={routineRecordsValue} onChange={(e) => setRoutineRecordsValue(e.target.checked)} />
              <span>Record a number each time this routine happens.</span>
            </label>
            {routineRecordsValue && <input className="field" placeholder="What number? e.g. Peak online viewers" value={routineValueLabel} onChange={(e) => setRoutineValueLabel(e.target.value)} />}
          </>}
          {kind === "task" && <>
          <FieldGroup label="Work to complete"><input className="field" placeholder="What needs doing" value={title} onChange={(e) => setTitle(e.target.value)} /></FieldGroup>
          <FieldGroup label="Why this matters" hint="Who it is for, or what is affected if it is late."><AssistiveTextarea className="field" rows={3} placeholder="Add useful context" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></FieldGroup>
          <details className="ocr-composer-disclosure">
            <summary>Instructions <span>optional</span></summary>
            <FieldGroup label="Instructions" hint="Leave the method to the assignee when that is appropriate."><AssistiveTextarea className="field" rows={3} placeholder="How it is done here" value={instructions} onChange={(e) => setInstructions(e.target.value)} /></FieldGroup>
          </details>
          <details className="ocr-composer-disclosure">
            <summary>Finished result <span>optional</span></summary>
            <FieldGroup label="Finished result" hint="The required assignment fields are what, why, who and when."><AssistiveTextarea className="field" rows={3} placeholder="Describe the finished result if useful" value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)} /></FieldGroup>
          </details>
            {recipeSteps.length > 0 && <div className="card small" style={{ marginTop: 10 }}>
              <div className="row-t">Last time this unit did this</div>
              <div className="row-m">{recipeSource?.title} · {recipeSteps.length} recorded step{recipeSteps.length === 1 ? "" : "s"}</div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setSteps(recipeSteps); setNoStepsNeeded(false); }}>Use last time’s steps</button>
            </div>}
            <p className="small" style={{ margin: "12px 0 4px" }}>Optional task checklist</p>
            {steps.map((s, i) => (
              <input key={i} className="field" placeholder={"Step " + (i + 1)} value={s}
                disabled={noStepsNeeded}
                onChange={(e) => setSteps((x) => x.map((v, j) => (j === i ? e.target.value : v)))} />))}
            {!noStepsNeeded && <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}
              disabled={!steps[steps.length - 1]?.trim()}
              onClick={() => setSteps((current) => [...current, ""])}>+ Add another step</button>}
            <label className="card small" style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 10 }}>
              <input type="checkbox" checked={noStepsNeeded} onChange={(event) => setNoStepsNeeded(event.target.checked)} />
              <span>No steps needed — let the assignee determine the method.</span>
            </label>
          </>}
        </div>
        {kind === "deliverable" && <div className="side-col">
          <div className="sec"><span>Who owns the output</span></div>
          <select className="field" aria-label="Responsible person" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Choose owner</option>
            {people.map((p) => <option key={p.profile_id} value={p.profile_id}>{p.profiles ? p.profiles.full_name : "—"}</option>)}
          </select>
          <select className="field" value={subTeam} onChange={(e) => setSubTeam(e.target.value)}>
            <option value="">Which part of the team (optional)</option>
            {subTeams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <select className="field" value={project} onChange={(e) => { setProject(e.target.value); setObjective(""); setPhase(""); }}>
            <option value="">Part of a project (optional)</option>
            {projects.map((row) => <option key={row.id} value={row.id}>{row.name}{!["planned","active"].includes(row.status) ? ` · ${row.status}` : ""}</option>)}
          </select>
          {project && <select className="field" value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="">Project objective (optional)</option>
            {objectives.map((row) => <option key={row.id} value={row.id}>{row.ref} · {row.name}</option>)}
          </select>}
          {project && phases.length > 0 && <select className="field" value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">Project phase (optional)</option>
            {phases.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>}
          <div className="sec"><span>Due</span></div>
          <input className="field" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />

        </div>}
        {kind === "meeting_outcome" && <div className="side-col">
          <div className="sec"><span>Who owns the commitment</span></div>
          <select className="field" aria-label="Responsible person" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Choose owner</option>
            {people.map((p) => <option key={p.profile_id} value={p.profile_id}>{p.profiles ? p.profiles.full_name : "—"}</option>)}
          </select>
          <select className="field" value={subTeam} onChange={(e) => setSubTeam(e.target.value)}>
            <option value="">Which part of the team (optional)</option>
            {subTeams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <select className="field" value={project} onChange={(e) => { setProject(e.target.value); setObjective(""); setPhase(""); }}>
            <option value="">Part of a project (optional)</option>
            {projects.map((row) => <option key={row.id} value={row.id}>{row.name}{!["planned","active"].includes(row.status) ? ` · ${row.status}` : ""}</option>)}
          </select>
          {project && <select className="field" value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="">Project objective (optional)</option>
            {objectives.map((row) => <option key={row.id} value={row.id}>{row.ref} · {row.name}</option>)}
          </select>}
          <div className="sec"><span>Due</span></div>
          <input className="field" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />

        </div>}
        {kind === "decision" && <div className="side-col">
          <div className="sec"><span>Who decides</span></div>
          <select className="field" aria-label="Responsible person" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Choose decision-maker</option>
            {people.map((p) => <option key={p.profile_id} value={p.profile_id}>{p.profiles ? p.profiles.full_name : "—"}</option>)}
          </select>
          <select className="field" value={subTeam} onChange={(e) => setSubTeam(e.target.value)}>
            <option value="">Which part of the team (optional)</option>
            {subTeams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <select className="field" value={project} onChange={(e) => { setProject(e.target.value); setObjective(""); setPhase(""); }}>
            <option value="">Part of a project (optional)</option>
            {projects.map((row) => <option key={row.id} value={row.id}>{row.name}{!["planned","active"].includes(row.status) ? ` · ${row.status}` : ""}</option>)}
          </select>
          {project && <select className="field" value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="">Project objective (optional)</option>
            {objectives.map((row) => <option key={row.id} value={row.id}>{row.ref} · {row.name}</option>)}
          </select>}
          <div className="sec"><span>Decision due</span></div>
          <input className="field" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />

        </div>}
        {kind === "request" && <div className="side-col">
          <div className="sec"><span>Who should respond</span></div>
          <select className="field" value={requestResponsibleUnit} onChange={(e) => { setRequestResponsibleUnit(e.target.value); setAssignee(""); }}>
            <option value="">Choose responsible unit</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
          <select className="field" aria-label="Responsible person" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Named person (optional)</option>
            {requestResponsibleUnit === workUnitId && people.map((p) => <option key={p.profile_id} value={p.profile_id}>{p.profiles ? p.profiles.full_name : "—"}</option>)}
          </select>
          {requestResponsibleUnit && requestResponsibleUnit !== workUnitId &&
            <div className="hint">This manager can send the request to that unit. Named people outside your authorised People view are intentionally not exposed here.</div>}
          <select className="field" value={project} onChange={(e) => { setProject(e.target.value); setObjective(""); setPhase(""); }}>
            <option value="">Part of a project (optional)</option>
            {projects.map((row) => <option key={row.id} value={row.id}>{row.name}{!["planned","active"].includes(row.status) ? ` · ${row.status}` : ""}</option>)}
          </select>
          {project && <select className="field" value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="">Project objective (optional)</option>
            {objectives.map((row) => <option key={row.id} value={row.id}>{row.ref} · {row.name}</option>)}
          </select>}
          <div className="sec"><span>Needed by</span></div>
          <input className="field" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />

        </div>}
        {kind === "case" && <div className="side-col">
          <div className="sec"><span>Case owner</span></div>
          <select className="field" aria-label="Responsible person" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Choose someone</option>
            {people.map((p) => <option key={p.profile_id} value={p.profile_id}>{p.profiles ? p.profiles.full_name : "—"}</option>)}
          </select>
          <select className="field" value={subTeam} onChange={(e) => setSubTeam(e.target.value)}>
            <option value="">Which part of the team (optional)</option>
            {subTeams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <select className="field" value={project} onChange={(e) => { setProject(e.target.value); setObjective(""); setPhase(""); }}>
            <option value="">Part of a project (optional)</option>
            {projects.map((row) => <option key={row.id} value={row.id}>{row.name}{!["planned","active"].includes(row.status) ? ` · ${row.status}` : ""}</option>)}
          </select>
          {project && <select className="field" value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="">Project objective (optional)</option>
            {objectives.map((row) => <option key={row.id} value={row.id}>{row.ref} · {row.name}</option>)}
          </select>}
          {project && phases.length > 0 && <select className="field" value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">Project phase (optional)</option>
            {phases.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>}

        </div>}
        {kind === "routine" && <div className="side-col">
          <div className="sec"><span>Who owns it</span></div>
          <select className="field" aria-label="Responsible person" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Choose someone</option>
            {people.map((p) => (<option key={p.profile_id} value={p.profile_id}>{p.profiles ? p.profiles.full_name : "—"}</option>))}
          </select>
          <select className="field" value={subTeam} onChange={(e) => setSubTeam(e.target.value)}>
            <option value="">Which part of the team (optional)</option>
            {subTeams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <select className="field" value={project} onChange={(e) => { setProject(e.target.value); setObjective(""); setPhase(""); }}>
            <option value="">Part of a project (optional)</option>
            {projects.map((row) => <option key={row.id} value={row.id}>{row.name}{!["planned","active"].includes(row.status) ? ` · ${row.status}` : ""}</option>)}
          </select>
          {project && <select className="field" value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="">Project objective (optional)</option>
            {objectives.map((row) => <option key={row.id} value={row.id}>{row.ref} · {row.name}</option>)}
          </select>}
          {project && phases.length > 0 && <select className="field" value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">Project phase (optional)</option>
            {phases.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>}

          <div className="hint">Routine history is recorded occurrence by occurrence. Changing its schedule later does not rewrite earlier records.</div>
        </div>}
        {kind === "task" && <div className="side-col">
          <div className="sec"><span>Who is doing it</span></div>
          <select className="field" aria-label="Responsible person" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Choose someone</option>
            {people.map((p) => (<option key={p.profile_id} value={p.profile_id}>{p.profiles ? p.profiles.full_name : "—"}</option>))}
          </select>
          <select className="field" value={subTeam} onChange={(e) => setSubTeam(e.target.value)}>
            <option value="">Which part of the team (optional)</option>
            {subTeams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="field" value={project} onChange={(e) => { setProject(e.target.value); setObjective(""); setPhase(""); }}>
            <option value="">Part of a project (optional)</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{!["planned","active"].includes(p.status) ? ` · ${p.status}` : ""}</option>)}
          </select>
          {project && <select className="field" value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="">Project objective (optional)</option>
            {objectives.map((row) => <option key={row.id} value={row.id}>{row.ref} · {row.name}</option>)}
          </select>}
          {project && phases.length > 0 && <select className="field" value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">Project phase (optional)</option>
            {phases.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>}
          <div className="sec"><span>When</span></div>
          <input className="field" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          {assignmentWarnings.length > 0 && <div style={{ marginTop: 12 }}>
            {assignmentWarnings.map((warning) => <div key={warning.key} className="flag flag-amber" style={{ marginTop: 8 }}>
              <h4>{warning.title}</h4>{warning.detail}
            </div>)}
          </div>}

          <div className="hint">Required: what needs doing, why it matters, who owns it and when it is due. Method and checklist are optional.</div>
        </div>}
      </div>}

      {kind !== "task" && <div style={{ marginTop: 14 }}>
        <div className="sec"><span>Source files</span><span>optional</span></div>
        <p className="screen-note">Files supplied with the assignment stay on the work record. They are separate from submission/evidence files returned by the assignee.</p>
        <PendingFilePicker files={sourceFiles} onChange={setSourceFiles} label="Attach source files" disabled={busy} />
      </div>}
    </div>
    </ComposerDrawer>);
}
