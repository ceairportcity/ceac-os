import { useEffect, useMemo, useRef, useState } from "react";
import { isIssuedUnitReport } from "../lib/ministryReportingFacts";
import { deadlineOverdue } from "../lib/stage2AchievementMetrics";
import {
  reportDateKey as dateKey,
  reportDateOnly as parseDateOnly,
  addReportDays as addDays,
  reportAccraDate as localDate,
  reportWeekRange as weekRange,
  reportMonthRange as monthRange,
  reportQuarterRange as quarterRange,
} from "../lib/ghanaReportingDates";
import AssistiveTextarea from "../components/AssistiveTextarea";
import { supabase } from "../lib/supabase";
import { Sheet, ProductNotice, FieldGroup } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import MinistryNumbers from "../components/MinistryNumbers";
import { Button, MotionDisclosure, Skeleton, StatePanel } from "../experience-v2/components";
import { DataVizChart } from "../experience-v2/data-viz/DataVizV2";
import {
  ReportingPageHeader,
  ReportingTabs,
  ReportingSection,
  ReportingEvidenceGrid,
  ReportingEvidenceCard,
  ReportingRecordRow,
  ReportingEmpty,
  ReportingFootnote,
} from "../experience-v2/reporting-family/ReportingFamilyV2";

// Managers may open CEAC from any country, but reporting days and periods
// always follow the Africa/Accra calendar, never device-local midnight.
const within = (value, start, end) => Boolean(value && value >= start && value <= end);
const COMPLETE = new Set(["completed", "self_certified"]);

function countBy(rows, key) {
  const out = {};
  rows.forEach((row) => { const value = typeof key === "function" ? key(row) : row[key]; out[value || "Other"] = (out[value || "Other"] || 0) + 1; });
  return out;
}

function distinctAttendanceDays(rows) {
  const seen = new Set();
  const kept = [];
  rows.forEach((row) => {
    const key = `${row.profile_id}:${localDate(row.started_at)}`;
    if (!seen.has(key)) { seen.add(key); kept.push(row); }
  });
  return kept;
}

function EvidenceMetric({ value, label, onClick }) {
  return <ReportingEvidenceCard value={value} label={label} detail="View source records ↗" icon={false} onClick={onClick} />;
}

// A submitted report's evidence is immutable. Never substitute today's live
// numbers, charts or objectives for a missing/partial historical snapshot.
function validFrozenReportSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
  const counts = snapshot.counts;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) return false;
  if (!["completed", "submissions", "overdue", "attendance_days"].every(
    (key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0
  )) return false;
  if (!snapshot.range || typeof snapshot.range.start !== "string"
    || typeof snapshot.range.end !== "string" || snapshot.range.end < snapshot.range.start) return false;
  if (!["unit", "project"].includes(snapshot.scope)) return false;
  if (!["daily", "by_project", "status_mix", "attendance", "objectives"].every(
    (key) => Array.isArray(snapshot[key])
  )) return false;
  return true;
}

export default function ManagerReports({ me, openItem, onOpenAchievements = null }) {
  const [mode, setMode] = useState("week");
  const [projectId, setProjectId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [projects, setProjects] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [work, setWork] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [memberIds, setMemberIds] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reportRefs, setReportRefs] = useState([]);
  const [narrative, setNarrative] = useState("");
  const [challenges, setChallenges] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [sheet, setSheet] = useState(null);
  const [drill, setDrill] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [periodRowsState, setPeriodRowsState] = useState("loading");
  const [historyVerified, setHistoryVerified] = useState(false);
  const [refsVerified, setRefsVerified] = useState(false);
  const refsReadSequence = useRef(0);
  const historyRequestRef = useRef(0);
  // A report can stay mounted while a Manager switches units or identities.
  // Never render a previous actor's figures during the next scoped fetch.
  const reportScope = [me.org_id, me.id, me.unit_id].join(":");
  const currentReportScope = useRef(reportScope);
  currentReportScope.current = reportScope;
  const baseRequestRef = useRef(0);
  const [loadedScope, setLoadedScope] = useState(null);
  // The live report must also change calendar day when a manager leaves this
  // screen open across Ghana midnight (or returns to a sleeping laptop).
  const [reportDay, setReportDay] = useState(() => dateKey(new Date()));
  const [reportAsOf, setReportAsOf] = useState(() => Date.now());
  useEffect(() => {
    const refreshDay = () => { setReportAsOf(Date.now()); setReportDay((day) => {
      const today = dateKey(new Date());
      return today === day ? day : today;
    }); };
    const onVisible = () => { if (!document.hidden) refreshDay(); };
    const interval = window.setInterval(refreshDay, 60_000);
    window.addEventListener("focus", refreshDay);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshDay);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    // Last-resort catch protects report privacy even if a future change
    // throws outside loadBase's own fail-closed provider error handler.
    void loadBase().catch(() => {
      if (currentReportScope.current !== reportScope) return;
      setLoadedScope(reportScope);
      setLoadFailed(true);
      setError("Manager reporting sources could not be verified.");
      setLoading(false);
    });
    return () => {
      baseRequestRef.current += 1;
      historyRequestRef.current += 1;
      refsReadSequence.current += 1;
    };
  }, [me.id, me.unit_id, me.org_id]);

  async function loadBase() {
    const requestedScope = reportScope;
    const request = ++baseRequestRef.current;
    const isCurrent = () => request === baseRequestRef.current
      && currentReportScope.current === requestedScope;
    setLoading(true); setError(null); setLoadFailed(false); setLoadedScope(null);
    setProjects([]); setPeriods([]); setWork([]); setObjectives([]);
    setMemberIds([]); setSessions([]); setSubmissions([]);
    setPeriodRowsState("loading");
    setHistory([]); setHistoryVerified(false); setSelectedReportId(null);
    setReportRefs([]); setRefsVerified(false); setDrill(null); setNotice(null);
    historyRequestRef.current += 1;
    refsReadSequence.current += 1;
    try {
    const [projectResult, periodResult, workResult, memberResult, objectiveResult] = await Promise.all([
      supabase.from("projects").select("id,name,starts_on,ends_on,status,lead_unit_id,project_units(unit_id)", { count:"exact" }).order("starts_on", { ascending: false, nullsFirst: false }),
      supabase.from("report_periods").select("id,kind,label,starts_on,ends_on,status", { count:"exact" }).order("starts_on", { ascending: false }),
      supabase.from("work_items").select("id,ref,title,kind,status,due_at,completed_at,project_id,assignee_id,origin,projects(name),profiles!work_items_assignee_id_fkey(full_name)", { count:"exact" }).eq("unit_id", me.unit_id).neq("visibility", "private"),
      supabase.from("unit_memberships").select("profile_id", { count:"exact" }).eq("unit_id", me.unit_id),
      supabase.from("objectives").select("id,project_id,unit_id,ref,name,status", { count:"exact" }).eq("unit_id", me.unit_id),
    ]);
    if (!isCurrent()) return;
    const first = [projectResult.error, periodResult.error, workResult.error, memberResult.error, objectiveResult.error].find(Boolean);
    if (first) {
      setLoadFailed(true); setError("Manager reporting source records could not be verified.");
      setLoadedScope(requestedScope); setLoading(false); return;
    }
    const fullyRead = (result) => Array.isArray(result.data) &&
      typeof result.count === "number" && result.count === result.data.length;
    if (![projectResult,periodResult,workResult,memberResult,objectiveResult].every(fullyRead)) {
      setLoadFailed(true); setError("Manager reporting records are incomplete; no totals can be verified.");
      setLoadedScope(requestedScope); setLoading(false); return;
    }
    setProjects((projectResult.data || []).filter((project) => project.lead_unit_id === me.unit_id || (project.project_units || []).some((row) => row.unit_id === me.unit_id)));
    setPeriods(periodResult.data || []);
    setWork(workResult.data || []);
    setObjectives(objectiveResult.data || []);

    // A salaried Manager also has their OWN attendance and achievements.
    // Do not suppress the period-session evidence read merely because the
    // selected unit currently has no other roster members.
    setMemberIds([...new Set([me.id, ...(memberResult.data || []).map((row) => row.profile_id)].filter(Boolean))]);
    setSessions([]);
    setSubmissions([]);
    setLoadedScope(requestedScope);
    setLoading(false);
    } catch {
      if (!isCurrent()) return;
      setLoadFailed(true); setLoadedScope(requestedScope);
      setError("Manager reporting source request failed; no totals can be verified.");
      setLoading(false);
    }
  }

  const baseRange = useMemo(() => mode === "week" ? weekRange(parseDateOnly(reportDay)) : mode === "month" ? monthRange(parseDateOnly(reportDay)) : mode === "quarter" ? quarterRange(parseDateOnly(reportDay)) : null, [mode, reportDay]);
  const kindPeriods = useMemo(() => periods.filter((period) => period.kind === mode), [periods, mode]);

  const matchingPeriod = useMemo(() => {
    if (selectedPeriodId) return periods.find((period) => period.id === selectedPeriodId && period.kind === mode) || null;
    if (mode === "project" || !baseRange) return null;
    return periods.find((period) => period.kind === mode && period.starts_on === baseRange.start && period.ends_on === baseRange.end && period.status === "open")
      || periods.find((period) => period.kind === mode && period.starts_on === baseRange.start && period.ends_on === baseRange.end)
      || null;
  }, [mode, selectedPeriodId, periods, baseRange]);

  const range = useMemo(() => {
    if (mode !== "project") {
      if (matchingPeriod) return { start: matchingPeriod.starts_on, end: matchingPeriod.ends_on, label: matchingPeriod.label };
      return baseRange;
    }
    const project = projects.find((row) => row.id === projectId);
    if (!project) return null;
    if (matchingPeriod) return { start: matchingPeriod.starts_on, end: matchingPeriod.ends_on, label: `${project.name} · ${matchingPeriod.label}` };
    const dates = work.filter((row) => row.project_id === project.id).flatMap((row) => [row.due_at ? localDate(row.due_at) : null, row.completed_at ? localDate(row.completed_at) : null]).filter(Boolean).sort();
    return {
      start: project.starts_on || dates[0] || dateKey(new Date()),
      end: project.ends_on || dates[dates.length - 1] || dateKey(new Date()),
      label: project.name,
    };
  }, [mode, baseRange, matchingPeriod, projectId, projects, work]);

  useEffect(() => {
    if (loadedScope !== reportScope || !range || !memberIds.length) {
      setSessions([]);
      setSubmissions([]);
      setPeriodRowsState(loadedScope === reportScope ? "ready" : "loading");
      return;
    }
    setSessions([]);
    setSubmissions([]);
    setPeriodRowsState("loading");
    let cancelled = false;
    async function loadPeriodRows() {
      // Ghana periods are UTC civil days, not the manager device timezone.
      const start = new Date(range.start + "T00:00:00Z");
      const endExclusive = new Date(new Date(range.end + "T00:00:00Z").getTime() + 86400000);
      const relevantWorkIds = work
        .filter((row) => mode !== "project" || row.project_id === projectId)
        .map((row) => row.id);

      const [sessionResult, submissionResult] = await Promise.all([
        supabase.from("work_sessions")
          .select("id,profile_id,work_item_id,started_at,ended_at,end_reason,profiles!work_sessions_profile_id_fkey(full_name)", { count:"exact" })
          .eq("org_id", me.org_id)
          .in("profile_id", memberIds)
          .gte("started_at", start.toISOString())
          .lt("started_at", endExclusive.toISOString()),
        relevantWorkIds.length
          ? supabase.from("submissions")
              .select("id,work_item_id,profile_id,submitted_at,note,profiles!submissions_profile_id_fkey(full_name)", { count:"exact" })
              .in("work_item_id", relevantWorkIds)
              .gte("submitted_at", start.toISOString())
              .lt("submitted_at", endExclusive.toISOString())
          : Promise.resolve({ data: [], error: null, count: 0 }),
      ]);
      if (cancelled || currentReportScope.current !== reportScope) return;
      const periodError = sessionResult.error || submissionResult.error;
      if (periodError) {
        setPeriodRowsState("error");
        setError("Manager session or submission source records could not be verified.");
        return;
      }
      const complete = (result) => Array.isArray(result.data)
        && typeof result.count === "number" && result.count === result.data.length;
      if (![sessionResult, submissionResult].every(complete)) {
        setPeriodRowsState("error");
        setError("Manager reporting period evidence is incomplete; no totals can be verified.");
        return;
      }
      setSessions(sessionResult.data);
      setSubmissions(submissionResult.data);
      setPeriodRowsState("ready");
    }
    void loadPeriodRows().catch(() => {
      if (!cancelled && currentReportScope.current === reportScope) {
        setPeriodRowsState("error");
        setError("Manager reporting source request failed; no totals can be verified.");
      }
    });
    return () => { cancelled = true; };
  }, [range?.start, range?.end, mode, projectId, memberIds.join(","), work, reportScope, loadedScope]);

  const evidence = useMemo(() => {
    if (!range || periodRowsState !== "ready") return null;
    const projectFilter = mode === "project" ? (row) => row.project_id === projectId : () => true;
    const relevantWork = work.filter(projectFilter);
    const completed = relevantWork.filter((row) => ["task", "deliverable"].includes(row.kind) && COMPLETE.has(row.status) && within(localDate(row.completed_at), range.start, range.end));
    const due = relevantWork.filter((row) => within(localDate(row.due_at), range.start, range.end));
    const overdue = due.filter((row) => !COMPLETE.has(row.status) && row.status !== "waiting_on" && deadlineOverdue(row.due_at, reportAsOf));
    const workIds = new Set(relevantWork.map((row) => row.id));
    const periodSubmissions = submissions.filter((row) => workIds.has(row.work_item_id) && within(localDate(row.submitted_at), range.start, range.end));
    const periodSessions = sessions.filter((row) => within(localDate(row.started_at), range.start, range.end) && (mode !== "project" || (row.work_item_id && workIds.has(row.work_item_id))));
    const attendanceDays = distinctAttendanceDays(periodSessions);
    const activeProjects = projects.filter((project) => relevantWork.some((row) => row.project_id === project.id));
    const relevantObjectives = objectives.filter((objective) => mode !== "project" || objective.project_id === projectId);
    return { relevantWork, completed, due, overdue, periodSubmissions, periodSessions, attendanceDays, activeProjects, relevantObjectives };
  }, [range, mode, projectId, work, submissions, sessions, projects, objectives, periodRowsState, reportAsOf]);

  const daily = useMemo(() => {
    if (!range || !evidence) return [];
    const rows = [];
    let day = parseDateOnly(range.start), end = parseDateOnly(range.end);
    while (day <= end && rows.length < (mode === "quarter" ? 93 : 62)) {
      const key = dateKey(day);
      const items = evidence.completed.filter((row) => localDate(row.completed_at) === key);
      rows.push({ date: key, label: key, value: items.length, rows: items, section: `completed_day:${key}` });
      day = addDays(day, 1);
    }
    return rows;
  }, [range, evidence, mode]);

  const attendanceHeat = useMemo(() => {
    if (!range || !evidence) return [];
    const rows = [];
    let day = parseDateOnly(range.start), end = parseDateOnly(range.end);
    while (day <= end && rows.length < (mode === "quarter" ? 93 : 62)) {
      const key = dateKey(day);
      const dayRows = distinctAttendanceDays(evidence.periodSessions.filter((row) => localDate(row.started_at) === key));
      rows.push({ date: key, label: key, value: dayRows.length, rows: dayRows, section: `attendance_day:${key}` });
      day = addDays(day, 1);
    }
    return rows;
  }, [range, evidence, mode]);

  const statusRows = useMemo(() => {
    if (!evidence) return [];
    const labels = { completed: "Completed", self_certified: "Self-certified", in_review: "In review", returned: "Returned", waiting_on: "Waiting on", in_progress: "In progress", not_started: "Not started" };
    const groups = countBy(evidence.relevantWork, "status");
    return Object.entries(groups).map(([status, value]) => ({
      label: labels[status] || status, value, rows: evidence.relevantWork.filter((row) => row.status === status), section: `status:${status}`,
    })).sort((a, b) => b.value - a.value);
  }, [evidence]);

  const projectRows = useMemo(() => {
    if (!evidence) return [];
    return evidence.activeProjects.map((project) => {
      const rows = evidence.completed.filter((row) => row.project_id === project.id);
      return { label: project.name, value: rows.length, rows, projectId: project.id, section: `project:${project.id}` };
    }).filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  }, [evidence]);

  const scope = mode === "project" ? "project" : "unit";

  useEffect(() => {
    historyRequestRef.current += 1;
    setSelectedReportId(null);
    setReportRefs([]);
    setHistory([]);
    setHistoryVerified(false);
    setNotice(null);
    if (loadedScope === reportScope && matchingPeriod && (scope === "unit" || projectId)) {
      void loadHistory().catch(() => {
        if (currentReportScope.current !== reportScope) return;
        setHistoryVerified(false);
        setError("Report version history could not be verified.");
      });
    }
  }, [matchingPeriod?.id, scope, projectId, reportScope, loadedScope]);

  async function loadHistory(preferDraft = true) {
    if (!matchingPeriod) return;
    const request = ++historyRequestRef.current;
    const requestedScope = reportScope;
    setHistoryVerified(false);
    let query = supabase.from("reports")
      .select("id,period_id,scope,unit_id,project_id,narrative,challenges,status,version,correction_reason,supersedes_report_id,evidence,submitted_at,submitted_by", { count:"exact" })
      .eq("period_id", matchingPeriod.id)
      .eq("scope", scope)
      .eq("unit_id", me.unit_id)
      .order("version", { ascending: false });
    query = scope === "project" ? query.eq("project_id", projectId) : query.is("project_id", null);
    const result = await query;
    if (request !== historyRequestRef.current || currentReportScope.current !== requestedScope) return;
    if (result.error || !Array.isArray(result.data) ||
        typeof result.count !== "number" || result.count !== result.data.length) {
      setError("The complete version history for this report could not be verified.");
      setHistory([]); setSelectedReportId(null); setReportRefs([]);
      return;
    }
    const rows = result.data;
    setHistory(rows);
    setHistoryVerified(true);
    const draft = rows.find((row) => row.status === "draft");
    const latestSubmitted = rows.find(isIssuedUnitReport);
    if (preferDraft && draft) {
      setSelectedReportId(null);
      setNarrative(draft.narrative || "");
      setChallenges(draft.challenges || "");
      setReportRefs([]);
    } else if (latestSubmitted) {
      setSelectedReportId(latestSubmitted.id);
      setNarrative(latestSubmitted.narrative || "");
      setChallenges(latestSubmitted.challenges || "");
    } else {
      setSelectedReportId(null);
      setNarrative("");
      setChallenges("");
      setReportRefs([]);
    }
  }

  useEffect(() => {
    const request = ++refsReadSequence.current;
    setRefsVerified(loadedScope === reportScope && !selectedReportId);
    setReportRefs([]);
    if (loadedScope === reportScope && selectedReportId) void loadRefs(selectedReportId, request);
    return () => { refsReadSequence.current += 1; };
  }, [selectedReportId, reportScope, loadedScope]);

  async function loadRefs(reportId, request) {
    try {
      const result = await supabase.from("report_evidence_refs")
        .select("id,report_id,section,object_type,object_id,label", { count:"exact" })
        .eq("report_id", reportId);
      if (request !== refsReadSequence.current || currentReportScope.current !== reportScope) return;
      if (result.error || !Array.isArray(result.data) ||
          typeof result.count !== "number" || result.count !== result.data.length) {
        setRefsVerified(false);
        setError("The submitted report evidence links could not be verified.");
        return;
      }
      setReportRefs(result.data);
      setRefsVerified(true);
    } catch {
      if (request === refsReadSequence.current && currentReportScope.current === reportScope) {
        setRefsVerified(false);
        setError("The submitted report evidence links could not be verified.");
      }
    }
  }

  const draft = history.find((row) => row.status === "draft") || null;
  const latestSubmitted = history.find(isIssuedUnitReport) || null;
  const frozenReport = selectedReportId ? history.find((row) => row.id === selectedReportId) || null : (!draft ? latestSubmitted : null);
  const frozen = frozenReport?.evidence || null;
  const viewingFrozen = Boolean(frozenReport && frozen);
  const invalidFrozenEvidence = Boolean(frozenReport && !validFrozenReportSnapshot(frozen));

  const liveCounts = evidence ? {
    completed: evidence.completed.length,
    submissions: evidence.periodSubmissions.length,
    overdue: evidence.overdue.length,
    attendance_days: evidence.attendanceDays.length,
  } : { completed: 0, submissions: 0, overdue: 0, attendance_days: 0 };

  const displayCounts = viewingFrozen ? (frozen.counts || {}) : liveCounts;
  const displayDaily = viewingFrozen ? (Array.isArray(frozen.daily) ? frozen.daily : []) : daily;
  const displayProjects = viewingFrozen ? (Array.isArray(frozen.by_project) ? frozen.by_project : []) : projectRows;
  const displayStatus = viewingFrozen ? (Array.isArray(frozen.status_mix) ? frozen.status_mix : []) : statusRows;
  const displayAttendance = viewingFrozen ? (Array.isArray(frozen.attendance) ? frozen.attendance : []) : attendanceHeat;
  const displayObjectives = viewingFrozen ? (Array.isArray(frozen.objectives) ? frozen.objectives : []) : (evidence?.relevantObjectives || []);
  const hasSupportingAnalysis = displayDaily.some((point) => point.value > 0)
    || displayProjects.length > 1
    || displayStatus.reduce((sum, row) => sum + Number(row.value || 0), 0) >= 5
    || displayAttendance.some((day) => day.value > 0);

  function rowsForSection(section) {
    return reportRefs.filter((row) => row.section === section);
  }

  function openFrozenSection(section, title) {
    setDrill({ title, rows: rowsForSection(section), kind: "ref" });
  }

  function openLive(section, title, rows, kind) {
    setDrill({ title, rows, kind, section });
  }

  async function saveDraft(showNotice = true) {
    if (!evidence) throw new Error("Report evidence is still being verified. Please retry after it loads.");
    if (!matchingPeriod || matchingPeriod.status !== "open") throw new Error("Administration must open this reporting period before you can save a report.");
    const result = await supabase.rpc("save_report_draft", {
      p_period_id: matchingPeriod.id,
      p_scope: scope,
      p_unit_id: me.unit_id,
      p_project_id: scope === "project" ? projectId : null,
      p_narrative: narrative.trim() || null,
      p_challenges: challenges.trim() || null,
    });
    if (result.error) throw result.error;
    if (showNotice) setNotice("Draft saved.");
    await loadHistory(true);
    return result.data;
  }

  function buildRefs(reportId) {
    if (!evidence) return [];
    const refs = [];
    const add = (section, objectType, rows, labelFor) => rows.forEach((row) => refs.push({
      report_id: reportId,
      section,
      object_type: objectType,
      object_id: row.id,
      label: labelFor(row),
    }));
    add("completed", "work_item", evidence.completed, (row) => `${row.ref} · ${row.title}`);
    add("submissions", "submission", evidence.periodSubmissions, (row) => `${row.profiles?.full_name || "Team member"} · ${new Date(row.submitted_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })}`);
    add("overdue", "work_item", evidence.overdue, (row) => `${row.ref} · ${row.title}`);
    add("attendance_days", "work_session", evidence.attendanceDays, (row) => `${row.profiles?.full_name || "Team member"} · ${localDate(row.started_at)}`);
    daily.forEach((day) => add(day.section, "work_item", day.rows, (row) => `${row.ref} · ${row.title}`));
    projectRows.forEach((row) => add(row.section, "work_item", row.rows, (item) => `${item.ref} · ${item.title}`));
    statusRows.forEach((row) => add(row.section, "work_item", row.rows, (item) => `${item.ref} · ${item.title}`));
    attendanceHeat.forEach((day) => add(day.section, "work_session", day.rows, (row) => `${row.profiles?.full_name || "Team member"} · ${localDate(row.started_at)}`));
    return refs;
  }

  function buildSnapshot() {
    return {
      counts: liveCounts,
      range: { start: range.start, end: range.end, label: range.label },
      scope,
      project_id: scope === "project" ? projectId : null,
      daily: daily.map(({ date, label, value, section }) => ({ date, label, value, section })),
      by_project: projectRows.map(({ label, value, projectId: id, section }) => ({ label, value, projectId: id, section })),
      status_mix: statusRows.map(({ label, value, section }) => ({ label, value, section })),
      attendance: attendanceHeat.map(({ date, label, value, section }) => ({ date, label, value, section })),
      objectives: (evidence?.relevantObjectives || []).map((row) => ({ id: row.id, ref: row.ref, name: row.name, status: row.status })),
    };
  }

  async function handleSave() {
    if (matchingPeriod && !historyVerified) return;
    setBusy(true); setError(null); setNotice(null);
    try { await saveDraft(true); }
    catch (err) { setError(humanError(err, "The report draft could not be saved.")); }
    finally { setBusy(false); }
  }

  async function submitReport() {
    if (!evidence || !historyVerified) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (!matchingPeriod || matchingPeriod.status !== "open") throw new Error("Administration must open this reporting period before you can submit a report.");
      const refs = buildRefs("pending").map(({ report_id, ...ref }) => ref);
      const submitted = await supabase.rpc("save_and_submit_report", {
        p_period_id: matchingPeriod.id,
        p_scope: scope,
        p_unit_id: me.unit_id,
        p_project_id: scope === "project" ? projectId : null,
        p_narrative: narrative.trim() || null,
        p_challenges: challenges.trim() || null,
        p_evidence: buildSnapshot(),
        p_refs: refs,
      });
      if (submitted.error) throw submitted.error;
      setNotice("Report submitted. This version is now fixed; later corrections create a new version.");
      await loadHistory(false);
    } catch (err) {
      setError(humanError(err, "The report could not be submitted."));
    } finally {
      setBusy(false);
    }
  }

  async function startCorrection() {
    if (!historyVerified || !refsVerified || !frozenReport || !correctionReason.trim()) return;
    setBusy(true); setError(null);
    try {
      const result = await supabase.rpc("correct_report", { p_report_id: frozenReport.id, p_reason: correctionReason.trim() });
      if (result.error) throw result.error;
      setSheet(null); setCorrectionReason(""); setSelectedReportId(null);
      setNotice("A new draft version has been opened. The submitted version remains unchanged.");
      await loadHistory(true);
    } catch (err) {
      setError(humanError(err, "A correction draft could not be opened."));
    } finally {
      setBusy(false);
    }
  }

  function printReport() {
    if ((matchingPeriod && !historyVerified) || (viewingFrozen && !refsVerified)) return;
    window.print();
  }

  const reportStatusLabel = viewingFrozen
    ? "Submitted · version " + frozenReport.version
    : matchingPeriod?.status === "open"
      ? "Drafting available"
      : matchingPeriod?.status === "closed"
        ? "Period closed"
        : "Live preview";

  if (loadedScope !== reportScope || loading || (range && periodRowsState === "loading")) return <div className="body manager-reports ev2-reporting-page ev2-reporting-manager">
    <ReportingPageHeader onOpenAchievements={onOpenAchievements}
      eyebrow={me.unit_name}
      title="Reports"
      description="Built from work, submissions, projects and recorded work sessions already in CEAC OS. Submitted versions keep the evidence they were filed with."
      statusLabel="Preparing report"
    />
    <div className="ev2rep-control-panel" aria-busy="true" aria-label="Preparing reports">
      <Skeleton variant="block" height="5rem" />
      <Skeleton variant="block" height="10rem" />
    </div>
  </div>;

  if (loadFailed || (range && periodRowsState === "error")) return <div className="body manager-reports ev2-reporting-page ev2-reporting-manager">
    <ReportingPageHeader onOpenAchievements={onOpenAchievements}
      eyebrow={me.unit_name}
      title="Reports"
      description="Built from work, submissions, projects and recorded work sessions already in CEAC OS. Submitted versions keep the evidence they were filed with."
      statusLabel="Evidence unavailable"
      statusTone="danger"
    />
    <div className="ev2rep-control-panel">
      <StatePanel
        state="error"
        title="Report evidence could not be loaded"
        description="No report figures are being shown because the current work, period or reporting records could not be retrieved."
        actionLabel="Try again"
        onAction={loadBase}
        icon="reports"
      />
    </div>
  </div>;

  if (invalidFrozenEvidence) return <div className="body manager-reports ev2-reporting-page ev2-reporting-manager">
    <ReportingPageHeader onOpenAchievements={onOpenAchievements} eyebrow={me.unit_name} title="Reports"
      description="Submitted versions must retain their original factual evidence."
      statusLabel="Archived evidence unavailable" statusTone="danger" />
    <div className="ev2rep-control-panel">
      <StatePanel state="error" title="Submitted report evidence could not be verified"
        description="This submitted version has a missing or incomplete frozen evidence snapshot. Current live figures cannot replace its historical counts or objectives."
        actionLabel="Retry submitted report"
        onAction={() => void loadHistory(false).catch(() => {
          setHistoryVerified(false);
          setError("Submitted report evidence could not be verified.");
        })}
        icon="reports" />
    </div>
  </div>;

  return <div className="body manager-reports report-print ev2-reporting-page ev2-reporting-manager">
    <div className="print-only report-print-brand">
      <b>CEAC</b>
      <span>{me.unit_name} · Manager report</span>
    </div>

    <ReportingPageHeader onOpenAchievements={onOpenAchievements}
      eyebrow={me.unit_name}
      title="Reports"
      description="Built from work, submissions, projects and recorded work sessions already in CEAC OS. Submitted versions keep the figures and evidence they were filed with."
      statusLabel={reportStatusLabel}
      statusTone={viewingFrozen ? "success" : matchingPeriod?.status === "closed" ? "warning" : "neutral"}
    />

    {error && <ProductNotice tone="error" title="Could not complete reporting">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Report updated">{notice}</ProductNotice>}
    {matchingPeriod && !historyVerified && <ProductNotice tone="attention" title="Report history not yet verified">
      Submitted versions, edits and printable evidence remain unavailable until their complete authorised history has been checked.
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
        void loadHistory().catch(() => setError("Report version history could not be verified."));
      }}>Retry report history</button>
    </ProductNotice>}

    <ReportingTabs
      items={[["week","Weekly"],["month","Monthly"],["quarter","Quarterly"],["project","Project"]]}
      value={mode}
      onChange={(key) => {
        setMode(key);
        setProjectId("");
        setSelectedPeriodId("");
        setSelectedReportId(null);
        setDrill(null);
        setShowAnalysis(false);
      }}
      label="Report scope"
    />

    <div className="ev2rep-control-panel">
      {mode !== "project" && kindPeriods.length > 0 && <select className="field" aria-label="Reporting period" value={matchingPeriod?.id || ""} onChange={(event) => { setSelectedPeriodId(event.target.value); setSelectedReportId(null); setDrill(null); }}>
        <option value="">Current {mode === "week" ? "week" : mode === "quarter" ? "quarter" : "month"} preview</option>
        {kindPeriods.map((period) => <option key={period.id} value={period.id}>{period.label} · {period.starts_on} → {period.ends_on} · {period.status}</option>)}
      </select>}

      {mode !== "project" && kindPeriods.length === 0 && <div className="ev2rep-live-state">
        <strong>Live preview only</strong>
        Administration has not recorded a {mode} reporting period matching this view. You can inspect factual evidence, but saving and submission remain unavailable until a period exists.
      </div>}

      {mode === "project" && <div className="ev2rep-control-grid">
        <select className="field" aria-label="Report project" value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelectedPeriodId(""); setSelectedReportId(null); setDrill(null); }}>
          <option value="">Choose a project</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        {projectId && <select className="field" aria-label="Project reporting period" value={selectedPeriodId} onChange={(event) => { setSelectedPeriodId(event.target.value); setSelectedReportId(null); setDrill(null); }}>
          <option value="">Choose a reporting period</option>
          {kindPeriods.map((period) => <option key={period.id} value={period.id}>{period.label} · {period.starts_on} → {period.ends_on} · {period.status}</option>)}
        </select>}
      </div>}
    </div>

    {!range && <ReportingSection eyebrow="Project report" title="Choose a project" description="Project reporting starts with an existing project in your visible reporting scope.">
      <ReportingEmpty title="No project selected" description="Choose a project above to prepare its factual report." />
    </ReportingSection>}

    {range && evidence && <>
      <ReportingSection
        eyebrow={viewingFrozen ? "Submitted evidence" : "Live evidence"}
        title={viewingFrozen ? "Frozen report evidence" : range.label}
        description={viewingFrozen
          ? "These are the figures and evidence links saved when this report version was submitted. Later activity does not rewrite them."
          : "This is a factual preview from currently recorded CEAC OS evidence. It is not a submitted report until you explicitly submit it."}
        meta={(viewingFrozen ? (frozen.range?.start || range.start) : range.start) + " → " + (viewingFrozen ? (frozen.range?.end || range.end) : range.end)}
      >
        {viewingFrozen && <div className="ev2rep-frozen-state">
          <strong>Submitted report · version {frozenReport.version}</strong>
          These figures were fixed when this version was submitted{frozenReport.submitted_at ? " on " + new Date(frozenReport.submitted_at).toLocaleString("en-GB") : ""}. Later activity remains separate.
        </div>}

        <ReportingEvidenceGrid>
          <EvidenceMetric value={displayCounts.completed || 0} label="completed in period" onClick={() => viewingFrozen ? openFrozenSection("completed", "Completed work") : openLive("completed", "Completed work", evidence.completed, "work")} />
          <EvidenceMetric value={displayCounts.submissions || 0} label="submissions" onClick={() => viewingFrozen ? openFrozenSection("submissions", "Submissions") : openLive("submissions", "Submissions", evidence.periodSubmissions, "submission")} />
          <EvidenceMetric value={displayCounts.overdue || 0} label="overdue from this period" onClick={() => viewingFrozen ? openFrozenSection("overdue", "Overdue work") : openLive("overdue", "Overdue work", evidence.overdue, "work")} />
          <EvidenceMetric value={displayCounts.attendance_days || 0} label={mode === "project" ? "project work-session days" : "recorded work-session days"} onClick={() => viewingFrozen ? openFrozenSection("attendance_days", "Recorded work-session days") : openLive("attendance_days", "Recorded work-session days", evidence.attendanceDays, "session")} />
        </ReportingEvidenceGrid>

        {drill && <div className="ev2rep-list" style={{ marginTop: 12 }}>
          {drill.rows.map((row) => drill.kind === "work"
            ? <ReportingRecordRow key={row.id} title={row.title} meta={row.ref + " · " + (row.profiles?.full_name || "Unassigned")} onClick={() => openItem(row.id)} />
            : drill.kind === "submission"
              ? <ReportingRecordRow key={row.id} title={(row.profiles?.full_name || "Team member") + " submitted work"} meta={new Date(row.submitted_at).toLocaleString("en-GB")} note={row.note || null} onClick={() => openItem(row.work_item_id)} />
              : drill.kind === "session"
                ? <ReportingRecordRow key={row.id} title={row.profiles?.full_name || "Team member"} meta={new Date(row.started_at).toLocaleString("en-GB")} />
                : <ReportingRecordRow key={row.id} title={row.label || "Recorded evidence"} meta={row.object_type.replaceAll("_", " ")} onClick={() => {
                    if (row.object_type === "work_item") openItem(row.object_id);
                    if (row.object_type === "submission") {
                      const submission = submissions.find((item) => item.id === row.object_id);
                      if (submission) openItem(submission.work_item_id);
                    }
                  }} />)}
          {drill.rows.length === 0 && <ReportingEmpty title="No supporting rows attached" description="This figure currently has no traceable supporting rows in the selected report evidence." />}
        </div>}
      </ReportingSection>

      <ReportingSection
        eyebrow="Supporting context"
        title="Patterns & activity"
        description="Optional factual patterns from the same recorded evidence. Every visual has an equivalent factual table and preserves drill-down."
      >
        <div className="report-analysis-toggle">
          <div>
            <strong>Charts and tables</strong>
            <span>Explore recorded trends or read the underlying records.</span>
          </div>
          <Button
            variant="quiet"
            size="compact"
            icon="chart"
            aria-expanded={showAnalysis}
            aria-controls="manager-report-supporting-analysis"
            onClick={() => setShowAnalysis((value) => !value)}
          >{showAnalysis ? "Hide charts and tables" : "Show charts and tables"}</Button>
        </div>

        <MotionDisclosure open={showAnalysis} ariaLabel="Supporting analysis">
          <div id="manager-report-supporting-analysis" className="report-analysis">
          {!hasSupportingAnalysis && <ReportingEmpty
            title="No supporting pattern is available for this view"
            description="The recorded evidence remains above. CEAC OS does not invent a chart when there is not enough comparable data to show a factual pattern."
          />}
          {displayDaily.some((point) => point.value > 0) && <DataVizChart
            kind="line"
            title="Completed work trend"
            note="Recorded completed work by date. Open a point or table record for the supporting work."
            data={displayDaily}
            series={[{ key:"value", label:"Completed work" }]}
            onOpen={(point) => viewingFrozen
              ? openFrozenSection(point.section, "Completed on " + point.date)
              : openLive(point.section, "Completed on " + point.date, point.rows || [], "work")}
          />}

          {displayProjects.length > 1 && <DataVizChart
            kind="bar"
            title="Completed by project"
            note="Recorded completed work grouped by project. The values remain linked to their supporting work."
            data={displayProjects}
            series={[{ key:"value", label:"Completed work" }]}
            onOpen={(row) => viewingFrozen
              ? openFrozenSection(row.section, row.label)
              : openLive(row.section, row.label, row.rows || [], "work")}
          />}

          {displayStatus.reduce((sum,row) => sum + Number(row.value || 0),0) >= 5 && <>
            <DataVizChart
              kind="donut"
              title="Current work composition"
              note="Current recorded work status is contextual only. It is separate from completed outcomes for the selected period."
              data={displayStatus}
              series={[{ key:"value", label:"Recorded work items" }]}
              onOpen={(row) => viewingFrozen
                ? openFrozenSection(row.section, row.label)
                : openLive(row.section, row.label, row.rows || [], "work")}
            />
            <p className="small" style={{ marginTop: 8 }}>Current work status is contextual only. It is not a performance, productivity or ranking score.</p>
          </>}

          {displayAttendance.some((day) => day.value > 0) && <>
            <DataVizChart
              kind="line"
              title="Recorded work-session activity"
              note="Unique team-member work-session days by date. Open a point or table record for the underlying sessions."
              data={displayAttendance}
              series={[{ key:"value", label:"Recorded team-member session days" }]}
              onOpen={(day) => viewingFrozen
                ? openFrozenSection(day.section, "Recorded work sessions · " + day.date)
                : openLive(day.section, "Recorded work sessions · " + day.date, day.rows || [], "session")}
            />
            <p className="small" style={{ marginTop: 8 }}>Recorded work-session activity is operational context, not an attendance or performance score.</p>
          </>}
          </div>
        </MotionDisclosure>
      </ReportingSection>

      <ReportingSection eyebrow="Objectives" title="Recorded objectives" description="Objective status stays separate from work completion and remains a factual recorded state." meta={String(displayObjectives.length)}>
        {displayObjectives.length > 0 ? <div className="ev2rep-list">
          {displayObjectives.map((objective) => <ReportingRecordRow
            key={objective.id}
            eyebrow={objective.ref}
            title={objective.name}
            meta={"Recorded status · " + String(objective.status).replaceAll("_", " ")}
            note="Work completion is shown separately; it does not determine whether this objective was met."
            statusLabel={String(objective.status).replaceAll("_", " ")}
            statusTone={objective.status === "at_risk" || objective.status === "not_met" ? "danger" : objective.status === "partly_met" ? "warning" : "success"}
          />)}
        </div> : <ReportingEmpty title="No objectives recorded" description="No objectives are recorded for this report view." />}
      </ReportingSection>

      <ReportingSection eyebrow="Narrative" title="Manager's summary" description={viewingFrozen ? "This submitted version is read-only." : "Add the context that recorded evidence alone cannot explain."}>
        <div className="report-authoring">
          <FieldGroup label="What leadership should understand"><AssistiveTextarea className="field" rows={4} disabled={viewingFrozen} placeholder="Summarise the period in plain language" value={viewingFrozen ? (frozenReport.narrative || "") : narrative} onChange={(event) => setNarrative(event.target.value)} /></FieldGroup>
          <FieldGroup label="Challenges or context" hint="Optional. Explain what the evidence alone would not show."><AssistiveTextarea className="field" rows={3} disabled={viewingFrozen} placeholder="Add useful context" value={viewingFrozen ? (frozenReport.challenges || "") : challenges} onChange={(event) => setChallenges(event.target.value)} /></FieldGroup>
        </div>
      </ReportingSection>

      <ReportingSection eyebrow="Submission" title="Report record" description="Submitted is final for that version. Corrections create a new draft version and keep the prior submission unchanged.">
        {!matchingPeriod && <div className="ev2rep-live-state">
          <strong>No matching reporting period is open</strong>
          Administration must open this {mode === "project" ? "project" : mode} period before you can save or submit. The factual preview remains available.
        </div>}

        {matchingPeriod && <div className="report-record-card">
          <strong>{matchingPeriod.label}</strong>
          <div className="small">{matchingPeriod.starts_on} → {matchingPeriod.ends_on} · {matchingPeriod.status}</div>
          {matchingPeriod.status === "closed" && <div className="hint">This period is closed. Existing versions remain visible, but a new draft cannot be filed until Administration reopens it.</div>}
        </div>}

        {history.length > 0 && <div className="ev2rep-list" style={{ marginTop: 12 }}>
          {history.map((row) => <ReportingRecordRow
            key={row.id}
            eyebrow={"Version " + row.version}
            title={row.status === "draft" ? "Draft" : "Submitted"}
            meta={row.submitted_at ? new Date(row.submitted_at).toLocaleString("en-GB") : "Not submitted yet"}
            note={row.correction_reason ? "Correction: " + row.correction_reason : null}
            statusLabel={row.status === "draft" ? "Draft" : "Submitted"}
            statusTone={row.status === "draft" ? "warning" : "success"}
            onClick={() => {
              if (row.status === "draft") { setSelectedReportId(null); setNarrative(row.narrative || ""); setChallenges(row.challenges || ""); }
              else setSelectedReportId(row.id);
              setDrill(null);
            }}
          />)}
        </div>}

        <div className="ev2rep-actions">
          <button className="btn btn-ghost" disabled={(!!matchingPeriod && !historyVerified) || (viewingFrozen && !refsVerified)} onClick={printReport}>Print / save PDF</button>
          {!viewingFrozen && matchingPeriod?.status === "open" && <>
            <button className="btn btn-ghost" disabled={busy || !historyVerified} onClick={handleSave}>{busy ? "Saving..." : "Save draft"}</button>
            <button className="btn" disabled={busy || !historyVerified} onClick={submitReport}>{busy ? "Submitting..." : "Submit report"}</button>
          </>}
          {viewingFrozen && !draft && frozenReport?.status === "submitted" && frozenReport.id === latestSubmitted?.id && matchingPeriod?.status === "open" && <button className="btn btn-ghost" disabled={!historyVerified || !refsVerified} onClick={() => { setCorrectionReason(""); setSheet("correct"); }}>Correct this report</button>}
          {viewingFrozen && draft && <button className="btn btn-ghost" onClick={() => { setSelectedReportId(null); setNarrative(draft.narrative || ""); setChallenges(draft.challenges || ""); }}>Return to draft</button>}
        </div>

        <ReportingFootnote>Submitted reports use frozen figures and evidence links. Later activity does not rewrite them. Reporting coverage and work-session context are factual records, not performance scores.</ReportingFootnote>
      </ReportingSection>
    </>}

    <div className="ev2rep-ministry-context">
      <MinistryNumbers me={me} />
    </div>

    {sheet === "correct" && <Sheet onClose={() => !busy && setSheet(null)}>
      <div className="h2">Open a correction</div>
      <p className="screen-note">The submitted version will stay unchanged. A new draft version will be created with your reason recorded.</p>
      <AssistiveTextarea className="field" rows={3} placeholder="Why is a correction needed?" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />
      <button className="btn" style={{ marginTop: 14 }} disabled={busy || !correctionReason.trim()} onClick={startCorrection}>{busy ? "Opening..." : "Create correction draft"}</button>
    </Sheet>}
  </div>;
}
