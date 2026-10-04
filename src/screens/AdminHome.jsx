import { useEffect, useState } from "react";
import { supabase, inviteByEmail } from "../lib/supabase";
import { Sheet, FieldGroup, ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import AdminOverviewV2 from "../experience-v2/admin-overview/AdminOverviewV2";

export default function AdminHome({ me, openItem, openMeeting, scheduleMeeting, openSettings, openUnits, go }) {
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
  const [payrollReadiness, setPayrollReadiness] = useState(null);
  const [inviting, setInviting] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function must(query, label) {
    const result = await query;
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
    return result.data;
  }

  async function load() {
    setLoadError(null);
    setLoading(true);
    try {
      const now = Date.now();
      const weekAgo = new Date(now - 7 * 864e5).toISOString();
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const todayStr = new Date().toISOString().slice(0, 10);

      const [us, mgrs, done7, openAlerts, pi, al, bl, lq, workflowSteps, my, o, staff, sessToday, sessWeek, away, projs, projectCloses, objs, period, subs, memberships, meetingRows, rosterRows] = await Promise.all([
        must(supabase.from("units").select("id,name").order("name"), "Units"),
        must(supabase.from("unit_memberships").select("unit_id,profile_id,profiles(id,full_name,email)").eq("role","manager"), "Unit heads"),
        must(supabase.from("completed_outputs").select("unit_id").gte("completed_at", weekAgo), "Completed outputs"),
        must(supabase.from("alerts").select("for_unit_id").is("acknowledged_at",null).is("resolved_at",null).not("for_unit_id","is",null), "Unit alerts"),
        must(supabase.from("pending_invitations").select("unit_id,email,full_name,invited_at,expires_at").is("resolved_at",null).gt("expires_at",new Date().toISOString()), "Pending invitations"),
        must(supabase.from("alerts")
          .select("id,kind,subject_id,subject_type,message,first_seen_at,for_unit_id,for_profile_id")
          .is("acknowledged_at",null).is("resolved_at",null)
          .or("for_profile_id.eq."+me.id+",and(for_unit_id.is.null,for_profile_id.is.null)")
          .order("first_seen_at",{ascending:false}).limit(30), "Administration alerts"),
        must(supabase.from("blockers")
          .select("id,party_text,since,state,party_unit_id,work_items(id,title,unit_id),claimant:profiles!blockers_claimed_by_fkey(full_name),units(name)")
          .neq("state","resolved").limit(20), "Cross-unit blockers"),
        must(supabase.from("leave_requests")
          .select("id,kind,start_date,end_date,days,status,requester:profiles!leave_requests_profile_id_fkey(full_name)")
          .in("status",["pending","escalated"]).order("requested_at",{ascending:false}).limit(20), "Leave queue"),
        must(supabase.from("workflow_run_steps")
          .select("id,label,required_capability,created_at,workflow_run_id")
          .eq("org_id",me.org_id).eq("state","ready")
          .order("created_at",{ascending:true}).limit(30), "Checks"),
        must(supabase.from("work_items")
          .select("id,ref,title,status,due_at").eq("assignee_id",me.id)
          .not("status","in","(completed,self_certified,cancelled)"), "Administration work"),
        must(supabase.from("office_locations").select("id").eq("is_primary",true).limit(1).maybeSingle(), "Office location"),
        must(supabase.from("profiles").select("id,full_name").eq("active",true), "Active people"),
        must(supabase.from("work_sessions").select("profile_id,ended_at,started_at").gte("started_at",dayStart.toISOString()), "Today's sessions"),
        must(supabase.from("work_sessions").select("profile_id,started_at").gte("started_at",weekAgo), "Recent sessions"),
        must(supabase.from("leave_requests").select("profile_id").eq("status","approved").lte("start_date",todayStr).gte("end_date",todayStr), "Today's leave"),
        must(supabase.from("projects").select("id,name,status,lead_unit_id,ends_on"), "Projects"),
        must(supabase.from("project_closes")
          .select("project_id,submitted_at")
          .eq("scope","overall").eq("status","submitted")
          .gte("submitted_at",monthStart.toISOString()), "Project closes"),
        must(supabase.from("objectives").select("id,name,status,unit_id,project_id"), "Objectives"),
        must(supabase.from("report_periods").select("id,label").eq("status","open").order("starts_on",{ascending:false}).limit(1).maybeSingle(), "Open reporting period"),
        must(supabase.from("submissions").select("profile_id,submitted_at").gte("submitted_at",weekAgo), "Recent submissions"),
        must(supabase.from("unit_memberships").select("profile_id,unit_id"), "Memberships"),
        must(supabase.from("meeting_sessions")
          .select("id,title,scope,starts_at,ends_at,provider,status,units(name),projects(name)")
          .gte("starts_at",new Date().toISOString())
          .lte("starts_at",new Date(now + 14*864e5).toISOString())
          .neq("status","cancelled").order("starts_at").limit(6), "Upcoming meetings"),
        must(supabase.rpc("admin_employee_roster_summary"), "Employee roster"),
      ]);

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
      if (myCapabilities.has("payroll.prepare") || myCapabilities.has("payroll.approve")) {
        setPayrollReadiness(await must(supabase.rpc("payroll_readiness_summary"), "Payroll readiness"));
      } else {
        setPayrollReadiness(null);
      }

      const awayIds = new Set((away || []).map((row) => row.profile_id));
      const startedIds = new Set((sessToday || []).map((row) => row.profile_id));
      setToday({
        working: (sessToday || []).filter((row) => !row.ended_at).length,
        leave: awayIds.size,
        notStarted: (staff || []).filter((person) => !startedIds.has(person.id) && !awayIds.has(person.id)).length,
        headcount: (staff || []).length,
      });

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
        const submitted = await must(supabase.from("reports").select("unit_id").eq("period_id",period.id).in("status",["submitted","confirmed"]), "Submitted reports");
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
        const days = new Set((sessWeek || []).filter((row) => row.profile_id === person.id).map((row) => new Date(row.started_at).toDateString())).size;
        if (days >= 3 && !lastSub[person.id]) rules.push({
          k: "p"+person.id,
          who: person.full_name,
          why: "present on "+days+" days this week, nothing submitted",
        });
      });
      (objs || []).filter((objective) => objective.status === "at_risk").forEach((objective) => rules.push({
        k:"o"+objective.id, who:objective.name, why:"objective at risk",
      }));
      setWatch(rules.slice(0,12));
      setMeetings(meetingRows || []);
    } catch (error) {
      setLoadError(error.message || "Administration could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function sendInvite() {
    if (!inviting) return;
    setBusy(true); setMsg(null);
    try {
      await inviteByEmail({ email, fullName:name, unitId:inviting.id });
      setMsg("Invitation sent. New accounts begin as Staff. After they activate, open Units to assign the Unit Head role.");
      setName(""); setEmail("");
      await load();
    } catch (error) { setMsg(error.message); }
    finally { setBusy(false); }
  }

  async function decideLeave(request, decision) {
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.rpc("workforce_leave_action", {
        p_leave_request_id: request.id,
        p_action: decision === "declined" ? "declined" : "admin_approved",
        p_reason: "Administration dashboard decision",
      });
      if (error) throw error;
      await load();
    } catch (error) { setMsg(humanError(error, "The leave decision could not be saved.")); }
    finally { setBusy(false); }
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
      loading={loading}
      loadFailed={loadError}
      message={msg && !inviting ? msg : null}
      busy={busy}
      units={units}
      alerts={alerts}
      blockers={blockers}
      leaveQueue={leaveQueue}
      checks={checks}
      mine={mine}
      office={office}
      today={today}
      delivery={delivery}
      reporting={reporting}
      watch={watch}
      meetings={meetings}
      employeeRoster={employeeRoster}
      payrollReadiness={payrollReadiness}
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
      onOpenProtectedHR={() => go?.("protected-hr")}
      onOpenPayroll={() => go?.("payroll")}
      onOpenProjects={() => go?.("admin-projects")}
      onOpenStrategy={() => go?.("strategy")}
      onOpenAttendance={() => go?.("attendance")}
      onInviteUnit={(unit) => { setInviting(unit); setMsg(null); }}
      onLeaveDecision={decideLeave}
    />

    {inviting && <Sheet onClose={() => { setInviting(null); setMsg(null); }}>
      <div className="eyebrow">People & access</div>
      <div className="h2">Invite someone to {inviting.name}</div>
      <p className="screen-note">Every invited account begins as Staff. After activation, Administration may explicitly assign Unit Head authority from Units.</p>
      <FieldGroup label="Full name"><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></FieldGroup>
      <FieldGroup label="Work email"><input className="field" type="email" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} /></FieldGroup>
      {msg && <ProductNotice tone="attention" title="Invitation">{msg}</ProductNotice>}
      <button className="btn" style={{ marginTop:14 }} onClick={sendInvite} disabled={busy || !name.trim() || !email.trim()}>{busy ? "Sending…" : "Send Staff invitation"}</button>
    </Sheet>}
  </>;
}
