import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import SupportAccessApprovals from "../components/SupportAccessApprovals";
import { humanError } from "../lib/productLanguage";
import AdminOverviewV2 from "../experience-v2/admin-overview/AdminOverviewV2";
import { summariseAdminToday, countRecordedSessionDays } from "../lib/adminTodaySummary";

export default function AdminHome({ me, openItem, openMeeting, scheduleMeeting, openSettings, openUnits, openPeopleAccess, go }) {
  const [units, setUnits] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [leaveQueue, setLeaveQueue] = useState([]);
  const [checks, setChecks] = useState([]);
  const [mine, setMine] = useState([]);
  const [office, setOffice] = useState(null);
  const [today, setToday] = useState({ working: 0, leave: 0, notStarted: 0, headcount: 0 });
  const [delivery, setDelivery] = useState({ active: 0, closedThisMonth: 0, onTrack: 0, atRisk: 0, met: 0, notMet: 0, other: 0, objectives: 0 });
  const [reporting, setReporting] = useState(null);
  const [watch, setWatch] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [employeeRoster, setEmployeeRoster] = useState([]);
  const [dailySessionRows, setDailySessionRows] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [payrollReadiness, setPayrollReadiness] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedScope, setLoadedScope] = useState(null);
  const readGeneration = useRef(0);
  const leaveActionBusyRef = useRef(false);
  const scopeKey = `${me.org_id}:${me.id}`;
  const scopedLoading = loading || loadedScope !== scopeKey;
  // Never render prior-account records before the next effect clears state.
  const verifiedSnapshot = loadedScope === scopeKey && !loading && !loadError;

  useEffect(() => {
    // The administrator can change account or organisation while reads are in flight.
    // Clear the old scoped records immediately; stale requests may not repopulate them.
    readGeneration.current += 1;
    setLoadedScope(null);
    leaveActionBusyRef.current = false;
    setBusy(false);
    setUnits([]); setAlerts([]); setBlockers([]); setLeaveQueue([]);
    setChecks([]); setMine([]); setOffice(null);
    setEmployeeRoster([]); setDailySessionRows([]); setPendingInvitations([]); setPayrollReadiness(null);
    setMeetings([]); setReporting(null); setWatch([]);
    setToday({ working: 0, leave: 0, notStarted: 0, headcount: 0 });
    setDelivery({ active: 0, closedThisMonth: 0, onTrack: 0, atRisk: 0, met: 0, notMet: 0, other: 0, objectives: 0 });
    setMsg(null);
    void load();
    return () => { readGeneration.current += 1; leaveActionBusyRef.current = false; };
  }, [me.id, me.org_id]);

  async function must(query, label) {
    const result = await query;
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
    return result.data;
  }

  async function load() {
    const generation = ++readGeneration.current;
    setLoadedScope(null);
    setLoadError(null);
    setLoading(true);
    try {
      const now = Date.now();
      const weekAgo = new Date(now - 7 * 864e5).toISOString();
      // CEAC reporting dates use Accra time (UTC year-round), not the viewer's device timezone.
      const nowDate = new Date(now);
      const dayStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()));
      const tomorrow = new Date(dayStart.getTime() + 864e5);
      const monthStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1));
      const todayStr = dayStart.toISOString().slice(0, 10);

      const [us, mgrs, done7, openAlerts, pi, al, bl, lq, workflowSteps, my, o, staff, sessToday, activeSessionsNow, sessWeek, away, projs, projectCloses, objs, period, subs, memberships, meetingRows, rosterRows] = await Promise.all([
        must(supabase.from("units").select("id,name").eq("org_id", me.org_id).order("name"), "Units"),
        must(supabase.from("unit_memberships").select("unit_id,profile_id,profiles(id,full_name,email)").eq("org_id", me.org_id).eq("role","manager"), "Unit heads"),
        must(supabase.from("completed_outputs").select("unit_id").eq("org_id", me.org_id).gte("completed_at", weekAgo), "Completed outputs"),
        must(supabase.from("alerts").select("for_unit_id").eq("org_id", me.org_id).is("acknowledged_at",null).is("resolved_at",null).not("for_unit_id","is",null), "Unit alerts"),
        must(supabase.from("pending_invitations").select("unit_id,email,full_name,invited_at,expires_at").eq("org_id", me.org_id).is("resolved_at",null).is("revoked_at",null), "Unresolved invitations, including expired links"),
        must(supabase.from("alerts")
          .select("id,kind,subject_id,subject_type,message,first_seen_at,for_unit_id,for_profile_id").eq("org_id", me.org_id)
          .is("acknowledged_at",null).is("resolved_at",null)
          .or("for_profile_id.eq."+me.id+",and(for_unit_id.is.null,for_profile_id.is.null)")
          .order("first_seen_at",{ascending:false}).limit(30), "Administration alerts"),
        must(supabase.from("blockers")
          .select("id,party_text,since,state,party_unit_id,work_items(id,title,unit_id),claimant:profiles!blockers_claimed_by_fkey(full_name),units(name)").eq("org_id", me.org_id)
          .neq("state","resolved").limit(20), "Cross-unit blockers"),
        must(supabase.from("leave_requests")
          .select("id,kind,start_date,end_date,days,status,requester:profiles!leave_requests_profile_id_fkey(full_name)").eq("org_id", me.org_id)
          .in("status",["pending","escalated"]).order("requested_at",{ascending:false}).limit(20), "Leave queue"),
        must(supabase.from("workflow_run_steps")
          .select("id,label,required_capability,created_at,workflow_run_id")
          .eq("org_id",me.org_id).eq("state","ready")
          .order("created_at",{ascending:true}).limit(30), "Checks"),
        must(supabase.from("work_items")
          .select("id,ref,title,status,due_at").eq("org_id", me.org_id).eq("assignee_id",me.id)
          .not("status","in","(completed,self_certified,cancelled)"), "Administration work"),
        must(supabase.from("office_locations").select("id").eq("org_id", me.org_id).eq("is_primary",true).limit(1).maybeSingle(), "Office location"),
        must(supabase.from("profiles").select("id,full_name").eq("org_id", me.org_id).eq("active",true), "Active people"),
        must(supabase.from("work_sessions").select("id,profile_id,started_at,ended_at,place,lat,lng,location_captured_at,location_accuracy_m").eq("org_id", me.org_id).gte("started_at",dayStart.toISOString()).lt("started_at",tomorrow.toISOString()), "Today's sessions"),
        must(supabase.from("work_sessions").select("profile_id").eq("org_id", me.org_id).is("ended_at",null).lte("started_at",nowDate.toISOString()), "Active work sessions"),
        must(supabase.from("work_sessions").select("profile_id,started_at").eq("org_id", me.org_id).gte("started_at",weekAgo).lte("started_at",nowDate.toISOString()), "Recent sessions"),
        must(supabase.from("leave_requests").select("profile_id").eq("org_id", me.org_id).eq("status","approved").lte("start_date",todayStr).gte("end_date",todayStr), "Today's leave"),
        must(supabase.from("projects").select("id,name,status,lead_unit_id,ends_on").eq("org_id", me.org_id), "Projects"),
        must(supabase.from("project_closes")
          .select("project_id,submitted_at").eq("org_id", me.org_id)
          .eq("scope","overall").eq("status","submitted")
          .gte("submitted_at",monthStart.toISOString()), "Project closes"),
        must(supabase.from("objectives").select("id,name,status,unit_id,project_id").eq("org_id", me.org_id), "Objectives"),
        must(supabase.from("report_periods").select("id,label").eq("org_id", me.org_id).eq("status","open").order("starts_on",{ascending:false}).limit(1).maybeSingle(), "Open reporting period"),
        must(supabase.from("submissions").select("profile_id,submitted_at").eq("org_id", me.org_id).gte("submitted_at",weekAgo), "Recent submissions"),
        must(supabase.from("unit_memberships").select("profile_id,unit_id").eq("org_id", me.org_id), "Memberships"),
        must(supabase.from("meeting_sessions")
          .select("id,title,scope,starts_at,ends_at,provider,status,units(name),projects(name)").eq("org_id", me.org_id)
          .gte("starts_at",new Date().toISOString())
          .lte("starts_at",new Date(now + 14*864e5).toISOString())
          .neq("status","cancelled").order("starts_at").limit(6), "Upcoming meetings"),
        must(supabase.rpc("admin_employee_roster_summary"), "Employee roster"),
      ]);
      if (generation !== readGeneration.current) return;

      const headByUnit = {};
      (mgrs || []).forEach((row) => { if (row.profiles) headByUnit[row.unit_id] = row.profiles; });
      const doneByUnit = {};
      (done7 || []).forEach((row) => { doneByUnit[row.unit_id] = (doneByUnit[row.unit_id] || 0) + 1; });
      const alertsByUnit = {};
      (openAlerts || []).forEach((row) => { alertsByUnit[row.for_unit_id] = (alertsByUnit[row.for_unit_id] || 0) + 1; });
      const pendByUnit = {};
      (pi || []).forEach((row) => { if (row.unit_id) pendByUnit[row.unit_id] = row; });
      setUnits((us || []).map((unit) => ({
        ...unit,
        head: headByUnit[unit.id] || null,
        pending: pendByUnit[unit.id] || null,
        done7: doneByUnit[unit.id] || 0,
        alerts: alertsByUnit[unit.id] || 0,
      })));

      setAlerts(al || []);
      setBlockers((bl || []).filter((blocker) => blocker.work_items && blocker.party_unit_id && blocker.work_items.unit_id !== blocker.party_unit_id));
      setLeaveQueue(lq || []);
      const myCapabilities = new Set(me.capabilities || []);
      setChecks((workflowSteps || []).filter((step) => !step.required_capability || myCapabilities.has(step.required_capability)));
      setMine(my || []);
      setOffice(o || null);
      setEmployeeRoster(Array.isArray(rosterRows) ? rosterRows : []);
      setDailySessionRows(sessToday || []);
      setPendingInvitations(pi || []);
      if (myCapabilities.has("payroll.prepare") || myCapabilities.has("payroll.approve")) {
        const payroll = await must(supabase.rpc("payroll_readiness_summary"), "Payroll readiness");
        if (generation !== readGeneration.current) return;
        setPayrollReadiness(payroll);
      } else {
        setPayrollReadiness(null);
      }

      setToday(summariseAdminToday({
        activeProfiles: staff || [],
        todaySessions: sessToday || [],
        activeSessions: activeSessionsNow || [],
        approvedLeave: away || [],
      }));

      const closedProjectIds = new Set((projectCloses || []).map((row) => row.project_id));
      const objectiveRows = objs || [];
      const met = objectiveRows.filter((objective) => objective.status === "met").length;
      const onTrack = objectiveRows.filter((objective) => objective.status === "on_track").length;
      const atRisk = objectiveRows.filter((objective) => objective.status === "at_risk").length;
      const notMet = objectiveRows.filter((objective) => objective.status === "not_met").length;
      setDelivery({
        active: (projs || []).filter((project) => project.status === "active").length,
        closedThisMonth: (projs || []).filter((project) => project.status === "closed" && closedProjectIds.has(project.id)).length,
        onTrack,
        atRisk,
        met,
        notMet,
        other: Math.max(0, objectiveRows.length - onTrack - atRisk - met - notMet),
        objectives: objectiveRows.length,
      });

      if (period) {
        const submitted = await must(supabase.from("reports").select("unit_id").eq("org_id", me.org_id).eq("period_id",period.id).in("status",["submitted","confirmed"]), "Submitted reports");
        if (generation !== readGeneration.current) return;
        const inIds = new Set((submitted || []).map((row) => row.unit_id));
        setReporting({
          label: period.label,
          total: (us || []).length,
          submitted: inIds.size,
          missing: (us || []).filter((unit) => !inIds.has(unit.id)),
        });
      } else setReporting(null);

      const lastSub = {};
      (subs || []).forEach((row) => {
        const at = new Date(row.submitted_at).getTime();
        if (!lastSub[row.profile_id] || at > lastSub[row.profile_id]) lastSub[row.profile_id] = at;
      });
      const memberOf = {};
      (memberships || []).forEach((membership) => {
        (memberOf[membership.unit_id] = memberOf[membership.unit_id] || []).push(membership.profile_id);
      });

      const rules = [];
      const eightDaysAgo = now - 8 * 864e5;
      (us || []).forEach((unit) => {
        const ids = memberOf[unit.id] || [];
        if (!ids.length) return;
        const latest = Math.max(...ids.map((id) => lastSub[id] || 0));
        if (latest < eightDaysAgo) rules.push({
          k: "u"+unit.id,
          who: unit.name,
          why: latest === 0 ? "nothing submitted in the last 7 days" : "no submission in "+Math.floor((now-latest)/864e5)+" days",
        });
      });

      (staff || []).forEach((person) => {
        const days = countRecordedSessionDays(sessWeek, person.id, now);
        if (days >= 3 && !lastSub[person.id]) rules.push({
          k: "p"+person.id,
          who: person.full_name,
          why: "work sessions opened on "+days+" calendar days in the last week; no submission recorded in this window",
        });
      });
      (objs || []).filter((objective) => objective.status === "at_risk").forEach((objective) => rules.push({
        k:"o"+objective.id, who:objective.name, why:"objective at risk",
      }));
      setWatch(rules.slice(0,12));
      setMeetings(meetingRows || []);
    } catch (error) {
      if (generation === readGeneration.current) setLoadError(humanError(error, "Administration records could not be verified. Please try again."));
    } finally {
      if (generation === readGeneration.current) { setLoadedScope(scopeKey); setLoading(false); }
    }
  }

  async function decideLeave(request, decision) {
    if (busy || scopedLoading || loadError || leaveActionBusyRef.current) return;
    leaveActionBusyRef.current = true;
    const generation = readGeneration.current;
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.rpc("workforce_leave_action", {
        p_leave_request_id: request.id,
        p_action: decision === "declined" ? "declined" : "admin_approved",
        p_reason: "Administration dashboard decision",
      });
      if (error) throw error;
      if (generation !== readGeneration.current) return;
      // The next load deliberately acquires a new generation. Release this
      // action's busy latch before starting it, while the page enters loading.
      leaveActionBusyRef.current = false;
      setBusy(false);
      await load();
    } catch (error) {
      if (generation === readGeneration.current) setMsg(humanError(error, "The leave decision could not be confirmed. Review its recorded state before retrying."));
    } finally {
      if (generation === readGeneration.current) {
        leaveActionBusyRef.current = false;
        setBusy(false);
      }
    }
  }

  const adminDate = new Date().toLocaleDateString("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const canManagePeople = (me.capabilities || []).includes("people.manage");
  const canUsePayroll = (me.capabilities || []).some((capability) => capability === "payroll.prepare" || capability === "payroll.approve");
  const canAccessProtectedHR = (me.capabilities || []).includes("hr_private.access");

  return <>
    <AdminOverviewV2
      me={me}
      dateLabel={adminDate}
      loading={scopedLoading}
      loadFailed={loadedScope === scopeKey ? loadError : null}
      message={verifiedSnapshot ? msg : null}
      busy={busy}
      units={verifiedSnapshot ? units : []}
      alerts={verifiedSnapshot ? alerts : []}
      blockers={verifiedSnapshot ? blockers : []}
      leaveQueue={verifiedSnapshot ? leaveQueue : []}
      checks={verifiedSnapshot ? checks : []}
      mine={verifiedSnapshot ? mine : []}
      office={verifiedSnapshot ? office : null}
      today={verifiedSnapshot ? today : { working: 0, leave: 0, notStarted: 0, headcount: 0 }}
      delivery={verifiedSnapshot ? delivery : { active: 0, closedThisMonth: 0, onTrack: 0, atRisk: 0, met: 0, notMet: 0, other: 0, objectives: 0 }}
      reporting={verifiedSnapshot ? reporting : null}
      watch={verifiedSnapshot ? watch : []}
      meetings={verifiedSnapshot ? meetings : []}
      employeeRoster={verifiedSnapshot ? employeeRoster : []}
      dailySessionRows={verifiedSnapshot ? dailySessionRows : []}
      pendingInvitations={verifiedSnapshot ? pendingInvitations : []}
      payrollReadiness={verifiedSnapshot ? payrollReadiness : null}
      canManagePeople={canManagePeople}
      canUsePayroll={canUsePayroll}
      canAccessProtectedHR={canAccessProtectedHR}
      onRetry={load}
      onOpenItem={openItem}
      onOpenMeeting={openMeeting}
      onScheduleMeeting={scheduleMeeting}
      onOpenSettings={openSettings}
      onOpenUnits={openUnits}
      onOpenWorkflows={() => go?.("workflows")}
      onOpenReports={() => go?.("reporting")}
      onOpenFinance={() => go?.("finance")}
      onOpenPeople={() => go?.("people")}
      onOpenInvitations={() => openPeopleAccess?.({ mode: "invitations" })}
      onOpenProtectedHR={() => go?.("protected-hr")}
      onOpenPayroll={() => go?.("payroll")}
      onOpenProjects={() => go?.("admin-projects")}
      onOpenStrategy={() => go?.("strategy")}
      onOpenAttendance={() => go?.("attendance")}
      onLeaveDecision={decideLeave}
    />
    {canManagePeople && verifiedSnapshot && <SupportAccessApprovals me={me} authority="people_administration" />}

  </>;
}
