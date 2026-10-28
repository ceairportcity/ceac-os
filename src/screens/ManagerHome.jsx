import { useEffect, useState } from "react";
import AssistiveTextarea from "../components/AssistiveTextarea";
import { supabase } from "../lib/supabase";
import { isOverdue } from "../lib/time";
import { Sheet } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import ManagerOverviewV2 from "../experience-v2/manager-overview/ManagerOverviewV2";

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek(date = new Date()) {
  const value = startOfDay(date);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

function dateKey(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function previousOrSameWeekday(date, weekday) {
  const value = startOfDay(date);
  value.setDate(value.getDate() - ((value.getDay() - weekday + 7) % 7));
  return value;
}

function happenedOn(value, date) {
  return Boolean(value) && dateKey(new Date(value)) === dateKey(date);
}

function moneyMinor(minor, currency) {
  return `${currency} ${(Number(minor || 0) / 100).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`;
}

function requireResult(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data || [];
}

export default function ManagerHome({ me, openItem, openProject, openMeeting, scheduleMeeting, openPerson, goAssign, go }) {
  const [submissions, setSubmissions] = useState([]);
  const [leave, setLeave] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [team, setTeam] = useState({ present: [], working: [], leave: [], notStarted: [], completed: [], submitted: [] });
  const [mine, setMine] = useState([]);
  const [delegated, setDelegated] = useState([]);
  const [projects, setProjects] = useState([]);
  const [upcomingProjects, setUpcomingProjects] = useState([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [week, setWeek] = useState({ due: [], completed: [], overdue: [] });
  const [recentMovement, setRecentMovement] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [financePositions, setFinancePositions] = useState([]);
  const [serviceDayData, setServiceDayData] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [followupAlerts, setFollowupAlerts] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [drill, setDrill] = useState(null);
  const [comment, setComment] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [selectedReturnItems, setSelectedReturnItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => { load(); }, [me.id, me.unit_id]);

  async function load() {
    if (!me.unit_id) return;
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const today = startOfDay();
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const weekStart = startOfWeek();
      const nextWeek = new Date(weekStart); nextWeek.setDate(nextWeek.getDate() + 7);

      const recentSince = new Date(today); recentSince.setDate(recentSince.getDate() - 7);
      const [memberResult, submissionResult, leaveResult, incomingBlockerResult, outgoingBlockerResult, mineResult, delegatedResult,
        sessionResult, weekResult, projectUnitResult, activeProjectResult,
        todayOutputResult, todaySubmissionResult, recentCompletedResult, recentSubmissionResult, followupAlertResult, meetingResult] = await Promise.all([
        supabase.from("unit_memberships")
          .select("profile_id, profiles!unit_memberships_profile_id_fkey(id, full_name)")
          .eq("unit_id", me.unit_id),
        supabase.rpc("my_work_attention_queue"),
        supabase.from("leave_requests")
          .select("id, profile_id, kind, start_date, end_date, days, status, reason, requested_at, profiles!leave_requests_profile_id_fkey(full_name)")
          .eq("status", "pending").order("requested_at", { ascending: true }),
        supabase.from("blockers")
          .select("id, party_text, note, since, state, work_item_id, party_unit_id, profiles!blockers_claimed_by_fkey(full_name), units(name), work_items!inner(id, ref, title)")
          .eq("party_unit_id", me.unit_id).in("state", ["claimed", "acknowledged"])
          .order("since", { ascending: true }),
        supabase.from("blockers")
          .select("id, party_text, note, since, state, work_item_id, party_unit_id, profiles!blockers_claimed_by_fkey(full_name), units(name), work_items!inner(id, ref, title, unit_id)")
          .eq("work_items.unit_id", me.unit_id).neq("party_unit_id", me.unit_id)
          .in("state", ["claimed", "acknowledged"])
          .order("since", { ascending: true }),
        supabase.from("work_items")
          .select("id, ref, title, status, due_at").eq("assignee_id", me.id)
          .not("status", "in", "(completed,self_certified,cancelled)"),
        supabase.from("work_items")
          .select("id, ref, title, status, due_at, assignee_id, profiles!work_items_assignee_id_fkey(full_name)")
          .eq("assigned_by", me.id)
          .neq("assignee_id", me.id)
          .not("status", "in", "(completed,self_certified,cancelled)")
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(6),
        supabase.from("work_sessions").select("profile_id, started_at, ended_at")
          .gte("started_at", today.toISOString()).lt("started_at", tomorrow.toISOString()),
        supabase.from("work_items")
          .select("id, ref, title, status, due_at, completed_at, assignee_id")
          .eq("unit_id", me.unit_id).eq("kind", "task"),
        supabase.from("project_units").select("project_id").eq("unit_id", me.unit_id),
        supabase.from("projects").select("id, name, lead_unit_id, ends_on, status").eq("status", "active"),
        supabase.from("work_items").select("id, ref, title, status, due_at, assignee_id, completed_at")
          .eq("unit_id", me.unit_id).in("kind", ["task", "deliverable"])
          .eq("status", "completed")
          .gte("completed_at", today.toISOString()).lt("completed_at", tomorrow.toISOString()),
        supabase.from("submissions").select("id, profile_id, submitted_at, profiles!submissions_profile_id_fkey(full_name), work_items!inner(id, ref, title, status, due_at, unit_id)")
          .eq("work_items.unit_id", me.unit_id)
          .gte("submitted_at", today.toISOString()).lt("submitted_at", tomorrow.toISOString()),
        supabase.from("work_items").select("id,ref,title,completed_at,assignee_id,profiles!work_items_assignee_id_fkey(full_name)")
          .eq("unit_id", me.unit_id).in("kind", ["task", "deliverable"]).in("status", ["completed", "self_certified"])
          .gte("completed_at", recentSince.toISOString()).order("completed_at", { ascending: false }).limit(8),
        supabase.from("submissions").select("id,profile_id,submitted_at,profiles!submissions_profile_id_fkey(full_name),work_items!inner(id,ref,title,unit_id)")
          .eq("work_items.unit_id", me.unit_id).gte("submitted_at", recentSince.toISOString())
          .order("submitted_at", { ascending: false }).limit(8),
        supabase.from("alerts")
          .select("id,kind,subject_type,subject_id,message,last_seen_at")
          .eq("for_unit_id", me.unit_id)
          .is("resolved_at", null)
          .in("kind", ["review_followup","blocker_followup"])
          .order("last_seen_at", { ascending: false }),
        supabase.from("meeting_sessions")
          .select("id,title,starts_at,ends_at,provider,status,scope,unit_id,project_id,projects(name)")
          .gte("starts_at", today.toISOString())
          .lt("starts_at", new Date(today.getTime() + 14 * 86400000).toISOString())
          .neq("status", "cancelled")
          .order("starts_at", { ascending: true })
          .limit(8),
      ]);

      const members = requireResult(memberResult, "Team").filter((member) => member.profile_id !== me.id);
      const memberIds = new Set(members.map((member) => member.profile_id));
      const submissionRows = requireResult(submissionResult, "Submissions")
        .filter((row) => row.action_kind === "review_required")
        .map((row) => ({
          id: row.submission_id,
          submitted_at: row.action_at,
          note: null,
          submission_files: [],
          profiles: { full_name: row.assignee_name },
          work_items: {
            id: row.work_item_id,
            ref: row.work_ref,
            title: row.work_title,
            kind: row.work_kind,
            status: row.work_status,
            purpose: null,
            expected_outcome: null,
          },
        }));
      setSubmissions(submissionRows.sort((left, right) => new Date(left.submitted_at) - new Date(right.submitted_at)));
      setFollowupAlerts(requireResult(followupAlertResult, "Follow-ups"));
      setUpcomingMeetings(requireResult(meetingResult, "Upcoming meetings"));
      setLeave(requireResult(leaveResult, "Leave requests").filter((request) => memberIds.has(request.profile_id)));
      const blockerMap = new Map();
      requireResult(incomingBlockerResult, "Blockers waiting on your unit")
        .forEach((blocker) => blockerMap.set(blocker.id, { ...blocker, direction: "incoming" }));
      requireResult(outgoingBlockerResult, "Work waiting on another unit")
        .forEach((blocker) => {
          if (!blockerMap.has(blocker.id)) blockerMap.set(blocker.id, { ...blocker, direction: "outgoing" });
        });
      setBlockers([...blockerMap.values()]);
      setMine(requireResult(mineResult, "Your work").filter((item) => {
        const dueToday = item.due_at && new Date(item.due_at) >= today && new Date(item.due_at) < tomorrow;
        return dueToday || isOverdue(item.due_at) || item.status === "returned" || item.status === "waiting_on";
      }));
      setDelegated(requireResult(delegatedResult, "Work you gave out"));
      const sessions = requireResult(sessionResult, "Presence");
      const presentIds = new Set(sessions.map((session) => session.profile_id));
      const workingIds = new Set(sessions.filter((session) => !session.ended_at).map((session) => session.profile_id));
      const approvedLeaveResult = memberIds.size ? await supabase.from("leave_requests")
        .select("profile_id").in("profile_id", [...memberIds]).eq("status", "approved")
        .lte("start_date", dateKey(today)).gte("end_date", dateKey(today)) : { data: [], error: null };
      const leaveIds = new Set(requireResult(approvedLeaveResult, "Today’s leave").map((request) => request.profile_id));
      const todayOutput = requireResult(todayOutputResult, "Today’s completed work");
      const todaySubmissions = requireResult(todaySubmissionResult, "Today’s submissions");
      const submittedWorkMap = new Map();
      todaySubmissions.forEach((submission) => {
        if (submission.work_items?.id && !submittedWorkMap.has(submission.work_items.id)) {
          submittedWorkMap.set(submission.work_items.id, submission.work_items);
        }
      });
      const submittedWork = [...submittedWorkMap.values()];
      const people = members.map((member) => ({
        id: member.profile_id,
        name: member.profiles?.full_name || "—",
        completed: todayOutput.filter((item) => item.assignee_id === member.profile_id).length,
        submitted: todaySubmissions.filter((submission) => submission.profile_id === member.profile_id).length,
      }));
      setTeam({
        leave: people.filter((person) => leaveIds.has(person.id)),
        present: people.filter((person) => !leaveIds.has(person.id) && presentIds.has(person.id)),
        working: people.filter((person) => !leaveIds.has(person.id) && workingIds.has(person.id)),
        notStarted: people.filter((person) => !leaveIds.has(person.id) && !presentIds.has(person.id)),
        completed: todayOutput,
        submitted: submittedWork,
      });

      const recentCompletedRows = requireResult(recentCompletedResult, "Recent completed work");
      const recentCompleted = recentCompletedRows
        .map((item) => ({ key: `completed-${item.id}`, type: "completed", at: item.completed_at, itemId: item.id, title: `${item.ref} · ${item.title}`, detail: `${item.profiles?.full_name || "Team member"} completed this work` }));
      const recentSubmissionRows = requireResult(recentSubmissionResult, "Recent submissions");
      const recentSubmitted = recentSubmissionRows
        .map((row) => ({ key: `submitted-${row.id}`, type: "submitted", at: row.submitted_at, itemId: row.work_items.id, title: `${row.work_items.ref} · ${row.work_items.title}`, detail: `${row.profiles?.full_name || "Team member"} submitted this work` }));
      setRecentMovement([...recentCompleted, ...recentSubmitted]
        .sort((left, right) => new Date(right.at) - new Date(left.at))
        .slice(0, 6));

      const latestSunday = previousOrSameWeekday(today, 0);
      const latestMidweek = previousOrSameWeekday(today, 3);
      const completedRows = recentCompletedRows;
      setServiceDayData([
        {
          label: "Completed outputs",
          sunday: completedRows.filter((item) => happenedOn(item.completed_at, latestSunday)).length,
          midweek: completedRows.filter((item) => happenedOn(item.completed_at, latestMidweek)).length,
        },
        {
          label: "Submissions",
          sunday: recentSubmissionRows.filter((row) => happenedOn(row.submitted_at, latestSunday)).length,
          midweek: recentSubmissionRows.filter((row) => happenedOn(row.submitted_at, latestMidweek)).length,
        },
      ]);

      const requestResult = await supabase.from("work_requests")
        .select("work_item_id,request_state,responsible_unit_id, work_items!inner(id,ref,title,due_at,status,assigned_by)")
        .eq("responsible_unit_id", me.unit_id)
        .in("request_state", ["waiting", "clarification"])
        .order("responded_at", { ascending: true, nullsFirst: true });
      setIncomingRequests(requireResult(requestResult, "Incoming requests"));

      const routineResult = await supabase.from("recurring_operations")
        .select("id,name,work_item_id,active,schedule_kind,weekdays,day_of_month,records_value,value_label,starts_on,ends_on")
        .eq("unit_id", me.unit_id)
        .not("work_item_id", "is", null)
        .order("name");
      setRoutines(requireResult(routineResult, "Routines"));

      const financePositionResult = await supabase.rpc("unit_budget_position", {
        p_unit_id: me.unit_id,
        p_year: today.getFullYear(),
      });
      setFinancePositions(requireResult(financePositionResult, "Unit financial position"));

      const tasks = requireResult(weekResult, "This week");
      setWeek({
        due: tasks.filter((item) => item.due_at && new Date(item.due_at) >= weekStart && new Date(item.due_at) < nextWeek),
        completed: tasks.filter((item) => ["completed", "self_certified"].includes(item.status) && item.completed_at && new Date(item.completed_at) >= weekStart && new Date(item.completed_at) < nextWeek),
        overdue: tasks.filter((item) => isOverdue(item.due_at) && !["completed", "self_certified", "cancelled", "waiting_on"].includes(item.status)),
      });

      const participatingIds = new Set(requireResult(projectUnitResult, "Project units").map((row) => row.project_id));
      const relevantProjects = requireResult(activeProjectResult, "Projects")
        .filter((project) => project.lead_unit_id === me.unit_id || participatingIds.has(project.id));
      const upcomingCutoff = new Date(today); upcomingCutoff.setDate(upcomingCutoff.getDate() + 14);
      setUpcomingProjects(relevantProjects
        .filter((project) => project.ends_on && project.ends_on >= dateKey(today) && project.ends_on < dateKey(upcomingCutoff))
        .sort((left, right) => left.ends_on.localeCompare(right.ends_on)));
      const projectIds = relevantProjects.map((project) => project.id);
      const [objectiveResult, projectTaskResult] = projectIds.length ? await Promise.all([
        supabase.from("objectives").select("id, project_id, name, status").in("project_id", projectIds),
        supabase.from("work_items").select("id, ref, title, project_id, objective_id, status, due_at, kind").in("project_id", projectIds),
      ]) : [{ data: [], error: null }, { data: [], error: null }];
      const objectives = requireResult(objectiveResult, "Project objectives");
      const projectTasks = requireResult(projectTaskResult, "Project tasks");
      setProjects(relevantProjects.map((project) => {
        const atRisk = objectives.filter((objective) => objective.project_id === project.id && ["at_risk", "not_met"].includes(objective.status));
        const closesThisWeek = project.ends_on && project.ends_on >= dateKey(today) && project.ends_on < dateKey(nextWeek);
        const projectWork = projectTasks.filter((item) => item.project_id === project.id);
        const tasksForProject = projectWork.filter((item) => item.kind === "task");
        const openDeliverables = projectWork.filter((item) => item.kind === "deliverable" && !["completed", "self_certified", "cancelled"].includes(item.status));
        const objectivesWithoutActiveWork = objectives.filter((objective) =>
          objective.project_id === project.id
          && ["on_track", "at_risk"].includes(objective.status)
          && !projectWork.some((item) => item.objective_id === objective.id && !["completed", "self_certified", "cancelled"].includes(item.status))
        );
        return { ...project, atRisk, closesThisWeek, tasks: tasksForProject,
          openDeliverables, objectivesWithoutActiveWork,
          completedTasks: tasksForProject.filter((task) => ["completed", "self_certified"].includes(task.status)).length,
          taskCount: tasksForProject.length };
      }).filter((project) => project.atRisk.length > 0 || project.closesThisWeek || project.openDeliverables.length > 0 || project.objectivesWithoutActiveWork.length > 0));
    } catch (err) {
      setLoadFailed(true);
      setError(humanError(err, "Manager Home could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  async function openReview(submission, decision = null) {
    setError(null);
    setComment("");
    setReturnItems([]);
    setSelectedReturnItems([]);
    const result = await supabase.from("checklist_items")
      .select("id,label,position")
      .eq("work_item_id", submission.work_items.id)
      .order("position");
    if (result.error) {
      setError(`Checklist: ${result.error.message}`);
      return;
    }
    setReturnItems(result.data || []);
    setSheet({ type: "work-review", item: submission, decision });
  }

  function toggleReturnItem(id) {
    setSelectedReturnItems((current) => current.includes(id)
      ? current.filter((itemId) => itemId !== id)
      : [...current, id]);
  }

  async function decideWork(submission, decision) {
    setBusy(true); setError(null);
    try {
      if (decision === "returned" && !comment.trim()) throw new Error("Add a comment explaining what needs changing.");
      if (decision === "returned") {
        const { error: returnError } = await supabase.rpc("return_work_for_correction", {
          p_submission_id: submission.id,
          p_comment: comment.trim(),
          p_checklist_item_ids: selectedReturnItems.length ? selectedReturnItems : null,
        });
        if (returnError) throw returnError;
        setSheet(null); setComment(""); setReturnItems([]); setSelectedReturnItems([]); await load();
        return;
      }
      const { error: approveError } = await supabase.rpc("approve_work_submission", {
        p_submission_id: submission.id,
        p_comment: comment.trim() || null,
      });
      if (approveError) throw approveError;
      setSheet(null); setComment(""); await load();
    } catch (err) { setError(humanError(err, "The review could not be saved.")); }
    finally { setBusy(false); }
  }

  async function answerBlocker(blocker, state) {
    setBusy(true); setError(null);
    try {
      const { error: responseError } = await supabase.rpc("respond_to_blocker", {
        p_blocker_id: blocker.id, p_state: state, p_note: comment.trim() || null,
      });
      if (responseError) throw responseError;
      setSheet(null); setComment(""); await load();
    } catch (err) { setError(humanError(err, "The blocker response could not be saved.")); }
    finally { setBusy(false); }
  }

  async function resolveBlocker(blocker) {
    setBusy(true); setError(null);
    try {
      const { error: resolveError } = await supabase.rpc("resolve_blocker", {
        p_blocker_id: blocker.id, p_note: null,
      });
      if (resolveError) throw resolveError;
      await load();
    } catch (err) { setError(humanError(err, "The blocker could not be resolved.")); }
    finally { setBusy(false); }
  }

  const reviewFollowupByWork = new Map(followupAlerts.filter((alert) => alert.kind === "review_followup").map((alert) => [alert.subject_id, alert]));
  const blockerFollowupAlerts = followupAlerts.filter((alert) => alert.kind === "blocker_followup");
  const decisionRows = [
    ...submissions.map((item) => ({ type: "submission", since: item.submitted_at, item })),
    ...leave.map((item) => ({ type: "leave", since: item.requested_at, item })),
    ...blockerFollowupAlerts.map((item) => ({ type: "followup", since: item.last_seen_at, item })),
  ].sort((left, right) => new Date(left.since || 0) - new Date(right.since || 0));
  const waitingCount = decisionRows.length;
  const incomingBlockers = blockers.filter((blocker) => blocker.direction === "incoming");
  const outgoingBlockers = blockers.filter((blocker) => blocker.direction === "outgoing");
  const drillRows = drill?.rows || [];
  const managerHour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    hour: "2-digit",
    hour12: false,
  }).format(new Date()));
  const managerGreeting = managerHour < 12 ? "Good morning" : managerHour < 17 ? "Good afternoon" : "Good evening";
  const managerDate = new Date().toLocaleDateString("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return <>
    <ManagerOverviewV2
      me={me}
      greeting={managerGreeting}
      dateLabel={managerDate}
      loading={loading}
      loadFailed={loadFailed}
      error={error}
      busy={busy}
      decisionRows={decisionRows}
      reviewFollowupByWork={reviewFollowupByWork}
      blockers={blockers}
      team={team}
      projects={projects}
      incomingRequests={incomingRequests}
      financePositions={financePositions}
      serviceDayData={serviceDayData}
      mine={mine}
      delegated={delegated}
      week={week}
      upcomingMeetings={upcomingMeetings}
      upcomingProjects={upcomingProjects}
      routines={routines}
      recentMovement={recentMovement}
      drill={drill}
      drillRows={drillRows}
      onRetry={load}
      onGiveOutWork={goAssign}
      onOpenWork={() => go?.("work")}
      onOpenItem={openItem}
      onOpenProject={openProject}
      onOpenMeeting={openMeeting}
      onScheduleMeeting={scheduleMeeting}
      onOpenPerson={openPerson}
      onOpenReview={openReview}
      onBlockerDisagree={(blocker) => setSheet({ type: "blocker", item: blocker })}
      onBlockerAcknowledge={(blocker) => answerBlocker(blocker, "acknowledged")}
      onResolveBlocker={resolveBlocker}
      onOpenFinance={() => go?.("manager-finance")}
      onNavigate={go}
      onDrill={setDrill}
    />

    {!loading && !loadFailed ? <>
      {sheet?.type === "work-review" && <Sheet onClose={() => { setSheet(null); setComment(""); setReturnItems([]); setSelectedReturnItems([]); }}>
        <div className="eyebrow">Evidence-first review</div>
        <div className="h2" style={{ marginTop: 5 }}>{sheet.item.work_items.title}</div>
        <p className="screen-note">{sheet.item.work_items.ref} · {sheet.item.profiles?.full_name || "Team member"} · submitted {new Date(sheet.item.submitted_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
        {sheet.item.work_items.purpose && <div className="review-evidence-block"><span>Why this work matters</span><strong>{sheet.item.work_items.purpose}</strong></div>}
        {sheet.item.work_items.expected_outcome && <div className="review-evidence-block"><span>Expected result</span><strong>{sheet.item.work_items.expected_outcome}</strong></div>}
        {sheet.item.note && <div className="review-evidence-block"><span>Submission note</span><strong>{sheet.item.note}</strong></div>}
        {sheet.item.submission_files?.length > 0 && <div className="review-evidence-links">
          {sheet.item.submission_files.map((file) => <a key={file.url} href={file.url} target="_blank" rel="noreferrer">Open submitted evidence ↗</a>)}
        </div>}
        {returnItems.length > 0 && <div className="review-checklist-summary">
          <span>Checklist</span>
          {returnItems.map((item) => <div key={item.id}>{item.label}</div>)}
        </div>}
        {!sheet.decision && <div className="review-decision-row">
          <button className="btn btn-ghost" onClick={() => setSheet((current) => ({ ...current, decision: "returned" }))}>Return for correction</button>
          <button className="btn" onClick={() => setSheet((current) => ({ ...current, decision: "completed" }))}>Approve</button>
        </div>}
        {sheet.decision === "returned" && <>
          <div className="sec" style={{ marginTop: 14 }}><span>What needs changing</span></div>
          {returnItems.length > 0 && <div className="card" style={{ padding: "2px 15px" }}>
            {returnItems.map((item) => (
              <button key={item.id} className={"ck " + (selectedReturnItems.includes(item.id) ? "done" : "")} onClick={() => toggleReturnItem(item.id)}>
                <span className={"box " + (selectedReturnItems.includes(item.id) ? "on" : "")} />
                <span className="ck-l">{item.label}</span>
              </button>
            ))}
          </div>}
          <AssistiveTextarea className="field" rows={3} placeholder="Explain exactly what needs changing" value={comment} onChange={(event) => setComment(event.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} disabled={busy || !comment.trim()} onClick={() => decideWork(sheet.item, "returned")}>{busy ? "Saving..." : "Return work"}</button>
        </>}
        {sheet.decision === "completed" && <>
          <AssistiveTextarea className="field" rows={3} placeholder="Approval note (optional)" value={comment} onChange={(event) => setComment(event.target.value)} />
          <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={() => decideWork(sheet.item, "completed")}>{busy ? "Saving..." : "Confirm approval"}</button>
        </>}
        {sheet.decision && <button className="text-action" style={{ marginTop: 12 }} onClick={() => { setComment(""); setSelectedReturnItems([]); setSheet((current) => ({ ...current, decision: null })); }}>Choose another decision</button>}
      </Sheet>}
      {sheet?.type === "blocker" && <Sheet onClose={() => { setSheet(null); setComment(""); }}>
        <div className="h2">Why does your unit disagree?</div>
        <AssistiveTextarea className="field" rows={3} placeholder="What is actually needed" value={comment} onChange={(event) => setComment(event.target.value)} />
        <button className="btn" style={{ marginTop: 14 }} disabled={busy || !comment.trim()} onClick={() => answerBlocker(sheet.item, "disputed")}>{busy ? "Saving..." : "Send response"}</button>
      </Sheet>}
    </> : null}
  </>;
}
