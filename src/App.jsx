import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { supabase, loadMe } from "./lib/supabase";
import { openSession } from "./lib/session";
import { useForegroundPresence } from "./lib/useForegroundPresence";
import { validRoutineDate } from "./lib/routineDateRoute";
import SignIn from "./screens/SignIn";
const AccountPassword = lazy(() => import("./screens/AccountPassword"));
import { AppTopBar, MobileTopBar, Tabs, SideNav } from "./experience-v2/shell";
import RouteTransition from "./experience-v2/RouteTransition";
import AuthFrame from "./components/AuthFrame";
import SettingsBack from "./components/SettingsBack";
import ExecutiveAssign from "./components/ExecutiveAssign";
import { RolePresentationContext } from "./experience-v2/RolePresentationContext";
import PrivilegedMfaGate from "./components/PrivilegedMfaGate";
import Stage2UniversalMfaGate from "./components/Stage2UniversalMfaGate";
import { decideUniversalTotpAccess } from "./lib/Stage2UniversalMfaPolicy";

// Stage 2 activates only after the independently approved server/Auth AAL2 cutover.
// Never infer cutover authority from a frontend preview or design approval.
const UNIVERSAL_TOTP_CUTOVER = import.meta.env.VITE_STAGE2_UNIVERSAL_AAL2 === "true";
const ActiveMfaGate = import.meta.env.VITE_STAGE2_UNIVERSAL_AAL2 === "true"
  ? Stage2UniversalMfaGate : PrivilegedMfaGate;

const Home = lazy(() => import("./screens/Home"));
const Work = lazy(() => import("./screens/Work"));
const Item = lazy(() => import("./screens/Item"));
const Record = lazy(() => import("./screens/Record"));
const MeScreen = lazy(() => import("./screens/Me"));
const ManagerHome = lazy(() => import("./screens/ManagerHome"));
const ManagerWork = lazy(() => import("./screens/ManagerWork"));
const AdminHome = lazy(() => import("./screens/AdminHome"));
const AdminWork = lazy(() => import("./screens/AdminWork"));
const Units = lazy(() => import("./screens/Units"));
const People = lazy(() => import("./screens/People"));
const Workforce = lazy(() => import("./screens/Workforce"));
const Cost = lazy(() => import("./screens/Cost"));
const Finance = lazy(() => import("./screens/Finance"));
const Reports = lazy(() => import("./screens/Reports"));
const PersonalAchievements = lazy(() => import("./screens/PersonalAchievements"));
const ExecutiveHome = lazy(() => import("./screens/ExecutiveHome"));
const ExecutiveWork = lazy(() => import("./screens/ExecutiveWork"));
const ExecutiveOrganisation = lazy(() => import("./screens/ExecutiveOrganisation"));
const ExecutiveFinance = lazy(() => import("./screens/ExecutiveFinance"));
const ExecutiveReports = lazy(() => import("./screens/ExecutiveReports"));
const ExecutiveRedesignStyles = lazy(() => import("./experience-v2/executive-overview/ExecutiveRedesignStyles"));
const Assign = lazy(() => import("./screens/Assign"));
const Team = lazy(() => import("./screens/Team"));
const PersonDetail = lazy(() => import("./screens/PersonDetail"));
const StaffTeam = lazy(() => import("./screens/StaffTeam"));
const StaffCalendar = lazy(() => import("./screens/StaffCalendar"));
const Inbox = lazy(() => import("./screens/Inbox"));
const OfficeSettings = lazy(() => import("./screens/OfficeSettings"));
const ControlCenter = lazy(() => import("./screens/ControlCenter"));
const AdminProjects = lazy(() => import("./screens/AdminProjects"));
const AdminCalendar = lazy(() => import("./screens/AdminCalendar"));
const AdminAudit = lazy(() => import("./screens/AdminAudit"));
const AdminAuthority = lazy(() => import("./screens/AdminAuthority"));
const AdminEvents = lazy(() => import("./screens/AdminEvents"));
const AdminWorkflows = lazy(() => import("./screens/AdminWorkflows"));
const AdminPolicies = lazy(() => import("./screens/AdminPolicies"));
const AdminIntegrations = lazy(() => import("./screens/AdminIntegrations"));
const AdminLifecycle = lazy(() => import("./screens/AdminLifecycle"));
const AdminProtectedHR = lazy(() => import("./screens/AdminProtectedHR"));
const AdminPayroll = lazy(() => import("./screens/AdminPayroll"));
const Goals = lazy(() => import("./screens/Goals"));
const Strategy = lazy(() => import("./screens/Strategy"));
const Delivery = lazy(() => import("./screens/Delivery"));
const ResourceWorkload = lazy(() => import("./screens/ResourceWorkload"));
const Performance = lazy(() => import("./screens/Performance"));
const Learning = lazy(() => import("./screens/Learning"));
const Assets = lazy(() => import("./screens/Assets"));
const Compliance = lazy(() => import("./screens/Compliance"));
const ManagerProjects = lazy(() => import("./screens/ManagerProjects"));
const ManagerCalendar = lazy(() => import("./screens/ManagerCalendar"));
const ManagerFinance = lazy(() => import("./screens/ManagerFinance"));
const ManagerReports = lazy(() => import("./screens/ManagerReports"));
const Announcements = lazy(() => import("./screens/Announcements"));
const Room = lazy(() => import("./screens/Room"));
const Meeting = lazy(() => import("./screens/Meeting"));
const DesignPrimitives = lazy(() => import("./screens/DesignPrimitives"));
const AccountActivity = lazy(() => import("./screens/AccountActivity"));
const Guide = lazy(() => import("./screens/Guide"));
const TechnicalHelp = lazy(() => import("./screens/TechnicalHelp"));
const TechnicalSupport = lazy(() => import("./screens/TechnicalSupport"));
const MeetingScheduler = lazy(() => import("./components/MeetingScheduler"));


function RouteFallback() {
  return <div className="route-fallback" role="status" aria-live="polite" aria-busy="true">
    <p className="screen-note">Opening this workspace…</p>
  </div>;
}

function routeFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const roomKind = params.get("roomKind");
  const roomId = params.get("room");
  let roomContext = null;
  if (roomKind && roomId) {
    if (roomKind === "unit") roomContext = { kind: "unit", unitId: roomId };
    if (roomKind === "sub_team") roomContext = { kind: "sub_team", subTeamId: roomId };
    if (roomKind === "project") roomContext = { kind: "project", projectId: roomId };
  }
  if (roomContext && /^[0-9a-f-]{36}$/i.test(params.get("mention") || "")) roomContext.mentionProfileId = params.get("mention");
  return {
    tab: params.get("tab") || "home",
    directory: params.get("tab") === "exec-organisation" && ["departments", "teams", "people", "staff", "volunteers"].includes(params.get("directory")) ? params.get("directory") : null,
    setting: params.get("setting") || null,
    settingsReturn: params.get("settingsReturn") === "people" ? "people" : null,
    leaveRequestId: params.get("tab") === "attendance" ? params.get("leave") : null,
    workforceSection: params.get("tab") === "attendance" && params.get("workforce") === "setup" ? "setup" : null,
    itemId: params.get("item"),
    routineDate: params.get("item") ? validRoutineDate(params.get("routineDate")) : null,
    projectId: params.get("project"),
    meetingId: params.get("meeting"),
    roomContext,
  };
}

export default function App() {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState(null);
  const initialRoute = routeFromLocation();
  const [tab, setTab] = useState(initialRoute.tab);
  const [directory, setDirectory] = useState(initialRoute.directory);
  const [setting, setSetting] = useState(initialRoute.setting);
  const [settingsReturn, setSettingsReturn] = useState(initialRoute.settingsReturn);
  const [leaveRequestId, setLeaveRequestId] = useState(initialRoute.leaveRequestId);
  const [workforceSection, setWorkforceSection] = useState(initialRoute.workforceSection);
  const [itemId, setItemId] = useState(initialRoute.itemId);
  const [itemRoutineDate,setItemRoutineDate] = useState(initialRoute.routineDate);
  const [goalId, setGoalId] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [person, setPerson] = useState(null);
  const [projectId, setProjectId] = useState(initialRoute.projectId);
  const [roomContext, setRoomContext] = useState(initialRoute.roomContext);
  const [meetingId, setMeetingId] = useState(initialRoute.meetingId);
  const [meetingDraft, setMeetingDraft] = useState(null);
  const [createIntent, setCreateIntent] = useState(null);
  const [guideContextTab, setGuideContextTab] = useState(null);
  const [peopleFocusId, setPeopleFocusId] = useState(null);
  const [authorityFocusProfileId,setAuthorityFocusProfileId] = useState(null);
  const [peopleAccessIntent, setPeopleAccessIntent] = useState(null);
  const [lifecycleIntent, setLifecycleIntent] = useState(null);
  const [announcementFocusId, setAnnouncementFocusId] = useState(null);
  const [session, setSession] = useState(null);
  const [hasPendingMfaSession, setHasPendingMfaSession] = useState(false);
  // Invalidate slow responses from a previous sign-in, token refresh or logout.
  const bootEpoch = useRef(0);
  useForegroundPresence(me, session);

  useEffect(() => {
    boot();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (UNIVERSAL_TOTP_CUTOVER) {
        // Identity-changing Auth events must immediately hide the previous
        // actor's protected workspace, before any asynchronous profile read.
        // Routine token refreshes retain their legitimate workspace while
        // the separate universal MFA gate rechecks signed assurance.
        if (["SIGNED_OUT", "SIGNED_IN", "PASSWORD_RECOVERY", "USER_UPDATED"].includes(event)) {
          ++bootEpoch.current;
          setReady(false);
          setMe(null);
          setSession(null);
        }
        // Do not await provider calls within Supabase's Auth callback lock.
        setTimeout(() => boot(), 0);
      } else boot();
    });
    const onPopState = () => applyRoute(routeFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => {
      ++bootEpoch.current;
      sub.subscription.unsubscribe();
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  async function boot() {
    const requestEpoch = ++bootEpoch.current;
    const isCurrent = () => requestEpoch === bootEpoch.current;
    setBootError(null);
    try {
      // Stage 2 protects ordinary profile reads at AAL1; Auth verification
      // must precede any access to the RLS-protected employee profile.
      if (UNIVERSAL_TOTP_CUTOVER) {
        const result = await supabase.auth.getSession();
        if (!isCurrent()) return;
        if (result.error) throw result.error;
        const authSession = result.data?.session || null;
        setHasPendingMfaSession(Boolean(authSession));
        if (!authSession) {
          // A delayed profile lookup from a previous session must not restore
          // an old role or personal-work session after sign-out.
          setMe(null);
          setSession(null);
          return;
        }
        const [assurance, factors, claims] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
          supabase.auth.getClaims(),
        ]);
        if (!isCurrent()) return;
        const failure = [assurance.error, factors.error, claims.error].find(Boolean);
        if (failure) throw failure;
        const access = decideUniversalTotpAccess({
          session: authSession, assurance: assurance.data,
          factors: factors.data, claims: claims.data?.claims,
        });
        if (access.state !== "allow") {
          setMe(null); setSession(null);
          return;
        }
      }
      const m = await loadMe();
      if (!isCurrent()) return;
      const currentSession = m ? await openSession(m.org_id, m.id) : null;
      if (!isCurrent()) return;
      // Publish identity and attendance together, never from stale async work.
      setMe(m);
      setSession(currentSession);
    } catch (error) {
      if (!isCurrent()) return;
      setMe(null);
      setSession(null);
      setBootError(error.message || "CEAC could not load your account.");
    } finally {
      if (isCurrent()) setReady(true);
    }
  }

  function applyRoute(route) {
    setTab(route.tab || "home");
    setDirectory(route.tab === "exec-organisation" ? route.directory || null : null);
    setSetting(route.setting || null);
    setSettingsReturn(route.settingsReturn || null);
    setLeaveRequestId(route.tab === "attendance" ? route.leaveRequestId || null : null);
    setWorkforceSection(route.tab === "attendance" && route.workforceSection === "setup" ? "setup" : null);
    setItemId(route.itemId || null);
    setItemRoutineDate(route.itemId ? validRoutineDate(route.routineDate) : null);
    setProjectId(route.projectId || null);
    setMeetingId(route.meetingId || null);
    setRoomContext(route.roomContext || null);
    setGoalId(null);
    setAssigning(null);
    setPerson(null);
    setMeetingDraft(null);
    setCreateIntent(null);
    setPeopleFocusId(null);
    setPeopleAccessIntent(null);
    setAuthorityFocusProfileId(null);
    setAnnouncementFocusId(null);
  }

  function navigate(route, { replace = false } = {}) {
    const next = {
      tab: route.tab || tab || "home",
      directory: route.tab === "exec-organisation" && ["departments", "teams", "people", "staff", "volunteers"].includes(route.directory) ? route.directory : null,
      setting: route.tab === "office-settings" ? route.setting || null : null,
      settingsReturn: route.settingsReturn === "people" ? "people" : null,
      leaveRequestId: route.tab === "attendance" ? route.leaveRequestId || null : null,
      workforceSection: route.tab === "attendance" && route.workforceSection === "setup" ? "setup" : null,
      itemId: route.itemId || null,
      routineDate: route.itemId ? validRoutineDate(route.routineDate) : null,
      projectId: route.projectId || null,
      meetingId: route.meetingId || null,
      roomContext: route.roomContext || null,
    };
    const params = new URLSearchParams();
    if (next.tab !== "home") params.set("tab", next.tab);
    if (next.directory) params.set("directory", next.directory);
    if (next.setting) params.set("setting", next.setting);
    if (next.settingsReturn) params.set("settingsReturn", next.settingsReturn);
    if (next.leaveRequestId) params.set("leave", next.leaveRequestId);
    if (next.workforceSection) params.set("workforce", next.workforceSection);
    if (next.itemId) params.set("item", next.itemId);
    if (next.itemId && next.routineDate) params.set("routineDate",next.routineDate);
    if (next.projectId) params.set("project", next.projectId);
    if (next.meetingId) params.set("meeting", next.meetingId);
    if (next.roomContext) {
      const kind = next.roomContext.kind;
      const id = kind === "unit" ? next.roomContext.unitId
        : kind === "sub_team" ? next.roomContext.subTeamId
        : next.roomContext.projectId;
      if (kind && id) {
        params.set("roomKind", kind);
        params.set("room", id);
        if (next.roomContext.mentionProfileId) params.set("mention", next.roomContext.mentionProfileId);
      }
    }
    const query = params.toString();
    const url = window.location.pathname + (query ? `?${query}` : "");
    window.history[replace ? "replaceState" : "pushState"]({ ceacRoute: true }, "", url);
    applyRoute(next);
  }

  function closeUrlOverlay() {
    if (window.history.state?.ceacRoute) window.history.back();
    else navigate({ tab, projectId }, { replace: true });
  }

  function go(t, options = {}) {
    if (t !== "guide") setGuideContextTab(null);
    setAuthorityFocusProfileId(null);
    navigate({ tab: t, setting: options.setting, directory: options.directory, leaveRequestId: options.leaveRequestId, workforceSection: options.workforceSection });
  }

  function openGuide(contextual = false) {
    setGuideContextTab(contextual && tab !== "guide" ? tab : null);
    navigate({ tab: "guide" });
  }
  function openLifecycle(profileId = null, type = "offboarding") {
    navigate({ tab: "lifecycle" });
    setLifecycleIntent(profileId ? { profileId, type } : null);
  }
  function openAuthorityForPerson(profileId) {
    if (!canManageAuthority || !profileId) return;
    navigate({tab:"authority", settingsReturn:"people"});
    setAuthorityFocusProfileId(profileId);
  }
  function openPeopleAccess(intent = {}) {
    navigate({ tab: "people" });
    setPeopleAccessIntent(intent);
  }
  function openItem(id,routineDate=null) { navigate({ tab, itemId: id, routineDate, projectId }); }
  function openProject(id) { navigate({ tab, projectId: id }); }
  function openMeeting(id) { navigate({ tab, meetingId: id }); }

  function openSearchWork(id) {
    navigate({ tab: "work", itemId: id });
  }

  function openSearchProject(id) {
    if (isAdmin) { navigate({tab:"admin-projects",projectId:id}); return; }
    if (isUnitManager) {
      navigate({ tab: "projects", projectId: id });
      return;
    }
    if (canUseDelivery) {
      navigate({ tab: "delivery", projectId: id });
      return;
    }
    navigate({ tab: "work" });
  }

  function openSearchPerson(result) {
    if (isAdmin) {
      navigate({ tab: "people" });
      setPeopleFocusId(result.employeeId || result.id);
      return;
    }
    if (isUnitManager && result.profileId) {
      navigate({ tab: "team" });
      setPerson({ id: result.profileId, focus: "current" });
      return;
    }
    navigate({ tab: isExec ? "exec-organisation" : "team" });
  }

  function openSearchAnnouncement(id) {
    navigate({ tab: "announcements" });
    setAnnouncementFocusId(id);
  }

  function openRoom(context) {
    navigate({ tab, roomContext: context });
  }

  function closeRoom() { closeUrlOverlay(); }

  function switchUnit(unitId) {
    const membership = me?.memberships?.find((entry) => entry.unit_id === unitId);
    if (!membership || membership.unit_id === me.unit_id) return;
    localStorage.setItem(`ceac-unit:${me.id}`, membership.unit_id);
    setMe((current) => ({
      ...current,
      unit_id: membership.unit_id,
      unit_name: membership.unit_name,
      role: membership.role,
    }));
    go("home");
  }

  const authPath = window.location.pathname;
  if (authPath === "/activate" || authPath === "/reset-password") {
    return <Suspense fallback={<div className="auth-boot">Opening secure account setup…</div>}><AccountPassword
      mode={authPath === "/activate" ? "activate" : "recover"}
      onDone={() => {
        window.history.replaceState({}, "", "/");
        boot();
      }}
    /></Suspense>;
  }

  if (!ready) return <div className="auth-boot"><span className="auth-boot-mark">CEAC</span><span>Opening your workspace…</span></div>;
  if (bootError && !me) return <AuthFrame eyebrow="Connection problem" title="Could not load your account" description="CEAC OS could not finish opening your secure workspace.">
    <div className="auth-message error">{bootError}</div>
    <button className="auth-primary" onClick={boot}><span>Try again</span><span aria-hidden="true">→</span></button>
  </AuthFrame>;
  if (!me && UNIVERSAL_TOTP_CUTOVER && hasPendingMfaSession) return <Stage2UniversalMfaGate onVerified={boot}>
    <div className="auth-boot">Opening your verified CEAC workspace…</div>
  </Stage2UniversalMfaGate>;
  if (!me) return <SignIn />;

  const isAdmin = Boolean(me.is_admin);
  const isExec = Boolean(me.is_exec);
  const isUnitManager = !isAdmin && !isExec && me.role === "manager";
  const isStaff = !isAdmin && !isExec && !isUnitManager;
  const isManager = isAdmin || isUnitManager;
  const hasCapability = (capability) => (me.capabilities || []).includes(capability);
  const hasOrgCapability = (capability) => (me.capability_grants || []).some((grant) =>
    grant.capability === capability && !grant.scope_unit_id
  );
  const canManagePeople = hasCapability("people.manage");
  const canManageSupport = hasCapability("support.case.manage");
  const canViewAudit = hasCapability("audit.view");
  const canManageAuthority = hasCapability("authority.manage");
  const canUseWorkflows = canViewAudit || canManagePeople || canManageAuthority;
  const canManageIntegrations = hasCapability("integration.manage");
  const canAccessProtectedHR = hasCapability("hr_private.access");
  const canUsePayroll = hasCapability("payroll.prepare") || hasCapability("payroll.approve");
  const canUseDelivery = isAdmin || isExec || isUnitManager || hasCapability("delivery.manage");
  const canUseWorkload = isUnitManager || hasCapability("resource.manage");
  // Assigned Executive reviewers may open this route; appraisal RLS restricts them to their own case.
  // Opening the route never grants performance.admin or Protected HR. The assigned HR-head publication exception is checked per case by the server.
  const canUsePerformance = isExec || isStaff || isUnitManager || hasOrgCapability("performance.admin");
  const canUseLearning = !isExec && (isStaff || isUnitManager || hasOrgCapability("learning.manage"));
  const canUseWorkforce = !isExec && (isStaff || isUnitManager || hasOrgCapability("workforce.manage") || hasOrgCapability("attendance.correct") || hasOrgCapability("compliance.manage"));
  const canUseAssets = !isExec && (isStaff || isUnitManager || hasOrgCapability("asset.manage"));
  const canUseCompliance = !isExec && (isStaff || isUnitManager || hasOrgCapability("compliance.manage"));
  const canPublishAnnouncement = isAdmin || isExec || hasOrgCapability("post_announcement");
  const overlay = itemId || assigning || goalId || person || (projectId && isUnitManager) || roomContext || meetingId || meetingDraft;

  function startAssignment(context = {}) {
    if (context.projectId) setProjectId(context.projectId);
    setAssigning(context);
  }

  function startMeeting(context = {}) {
    setMeetingDraft(context);
  }

  function startSurfaceCreate(tabKey, intent) {
    navigate({ tab: tabKey });
    setCreateIntent(intent);
  }

  function pageForTab() {
    // All Work roles remount on actor/tenant/unit changes. This invalidates
    // previous-role drafts and pending state before any new request completes.
    const managerScopeKey = `${me.org_id}:${me.id}:${me.unit_id || "none"}`;
    if (tab === "guide") return <Guide me={me} contextTab={guideContextTab} go={go} />;
    if (tab === "account") return <AccountActivity me={me} />;
    if (tab === "achievements") return <PersonalAchievements me={me} back={() => go("me")} openItem={openItem} />;
    if (tab === "technical-help") return <TechnicalHelp key={`${me.org_id}:${me.id}`} me={me} />;
    if (tab === "technical-support") return canManageSupport
      ? <TechnicalSupport key={`${me.org_id}:${me.id}`} me={me} go={go} />
      : <div className="body" role="alert">This account is not authorised to manage Technical Support.</div>;
    if (tab === "primitives" && isAdmin) return <DesignPrimitives me={me} />;
    if (tab === "home") {
      if (me.is_exec) return <ExecutiveHome key={me.org_id+":"+me.id} me={me} openMeeting={openMeeting} scheduleMeeting={startMeeting} go={go} />;
      if (me.is_admin) return <AdminHome key={`${me.org_id}:${me.id}`} me={me} openItem={openItem} openMeeting={openMeeting} scheduleMeeting={startMeeting} openSettings={() => go("settings")} openUnits={() => go("units")} openPeopleAccess={openPeopleAccess} openPerson={(employeeId) => openSearchPerson({ employeeId })} go={go} />;
      if (isManager) return <ManagerHome key={managerScopeKey} me={me} openItem={openItem} openProject={openProject} openMeeting={openMeeting} scheduleMeeting={startMeeting} openPerson={(id, focus) => setPerson({ id, focus })} goAssign={() => startAssignment()} go={go} />;
      return <Home me={me} session={session} setSession={setSession} openItem={openItem} openMeeting={openMeeting} openRoom={openRoom} openWork={() => go("work")} openMe={() => go("me")} openAnnouncements={() => go("announcements")} openTeam={() => go("team")} openCalendar={() => go("staff-calendar")} />;
    }
    if (tab === "team") return isManager
      ? <Team key={managerScopeKey} me={me} openPerson={(id, focus) => setPerson({ id, focus })} goAssign={startAssignment} openRoom={() => openRoom({ kind: "unit", unitId: me.unit_id })} />
      : <StaffTeam me={me} openRoom={() => openRoom({ kind: "unit", unitId: me.unit_id })} />;
    if (tab === "work") {
      if (isExec) return <ExecutiveWork key={managerScopeKey} me={me} openItem={openItem} goAssign={startAssignment} />;
      if (isAdmin) return <AdminWork key={managerScopeKey} me={me} openItem={openItem} goAssign={startAssignment} />;
      if (isUnitManager) return <ManagerWork key={managerScopeKey} me={me} openItem={openItem} goAssign={startAssignment} />;
      return <Work key={managerScopeKey} me={me} isManager={false} openItem={openItem} />;
    }
    if (tab === "staff-calendar" && isStaff) return <StaffCalendar me={me} openItem={openItem} openMeeting={openMeeting} />;
    if (tab === "messages") return <Inbox
      key={`${me.org_id}:${me.id}`}
      me={me}
      openProject={id=>navigate({tab:isAdmin?"admin-projects":isExec?"delivery":"projects",projectId:id})}
      scheduleMeeting={startMeeting}
      startWorkFromMessage={isManager || isExec ? startAssignment : null}
      openRoom={openRoom}
      openItem={(id) => navigate({ tab: "work", itemId: id })}
      openAnnouncements={() => go("announcements")}
      initialView={createIntent === "message_room" ? "rooms" : null}
      onInitialViewHandled={() => setCreateIntent(null)}
    />;
    if (tab === "projects" && isUnitManager) return <ManagerProjects key={managerScopeKey} me={me} openItem={openItem} goAssign={startAssignment} openMeeting={openMeeting} scheduleMeeting={startMeeting} openRoom={(projectId, reference) => openRoom({ kind: "project", projectId, reference })} />;
    if (tab === "calendar" && isUnitManager) return <ManagerCalendar key={managerScopeKey} me={me} openItem={openItem} openProject={openProject} openMeeting={openMeeting} scheduleMeeting={startMeeting} openPerson={(id, focus) => setPerson({ id, focus })} />;
    if (tab === "manager-finance" && isUnitManager) return <ManagerFinance key={managerScopeKey} me={me} openProject={openProject} />;
    if (tab === "manager-reports" && isUnitManager) return <ManagerReports key={managerScopeKey} me={me} openItem={openItem} openProject={openProject} />;
    if (tab === "exec-projects" && isExec) return <AdminProjects key={`${me.org_id}:${me.id}:executive-projects`} me={me} openProject={id=>navigate({tab:"delivery",projectId:id})} scheduleMeeting={startMeeting} openItem={openItem} goAssign={startAssignment} openRoom={(id,reference)=>openRoom({kind:"project",projectId:id,reference})} />;
    if (tab === "exec-organisation" && isExec) return <ExecutiveOrganisation key={`${me.org_id}:${me.id}`} me={me} directory={directory} goAssign={startAssignment} openItem={openItem} openRoom={openRoom} />;
    if (tab === "exec-finance" && isExec) return <ExecutiveFinance me={me} />;
    if (tab === "exec-reports" && isExec) return <ExecutiveReports me={me} openItem={openItem} />;
    if (tab === "record") return <Record me={me} openItem={openItem} />;
    if (tab === "announcements") return <Announcements
      me={me}
      back={() => go("home")}
      createRequest={createIntent === "announcement"}
      onCreateHandled={() => setCreateIntent(null)}
      initialAnnouncementId={announcementFocusId}
      onInitialHandled={() => setAnnouncementFocusId(null)}
    />;
    if (tab === "strategy") return <Strategy
      me={me}
      createRequest={createIntent === "ministry_objective" ? "ministry_objective" : null}
      onCreateHandled={() => setCreateIntent(null)}
    />;
    if (tab === "delivery" && canUseDelivery) return <Delivery key={`${me.org_id}:${me.id}`} me={me} initialProjectId={projectId} openItem={openItem} openProject={openProject} goAssign={startAssignment} />;
    if (tab === "workload" && canUseWorkload) return <ResourceWorkload me={me} />;
    if (tab === "performance" && canUsePerformance) return <Performance me={me} />;
    if (tab === "learning" && canUseLearning) return <Learning me={me} />;
    if (tab === "assets" && canUseAssets) return <Assets me={me} />;
    if (tab === "compliance" && canUseCompliance) return <Compliance
      me={me}
      openWork={() => go("work")}
      openAnnouncements={hasOrgCapability("post_announcement") ? () => startSurfaceCreate("announcements", "announcement") : null}
    />;
    if (tab === "cost" && isAdmin) return <Cost key={`${me.org_id}:${me.id}`} me={me} />;
    if (tab === "finance" && isAdmin) return <Finance key={`${me.org_id}:${me.id}`} me={me} openExpenses={() => go("cost")} />;
    if (tab === "reporting" && isAdmin) return <Reports me={me} />;
    if (tab === "attendance" && canUseWorkforce) return <Workforce key={`${me.org_id}:${me.id}:${me.unit_id || "none"}:${me.role || "none"}:${me.is_admin ? "admin" : "not-admin"}:${me.is_exec ? "exec" : "not-exec"}`} me={me} initialLeaveRequestId={leaveRequestId} initialSection={workforceSection} />;
    if (tab === "people" && canManagePeople) return <People
      key={`${me.org_id}:${me.id}`}
      me={me}
      openItem={openItem}
      go={go}
      openLifecycle={openLifecycle}
      accessIntent={peopleAccessIntent}
      onAccessIntentHandled={() => setPeopleAccessIntent(null)}
      initialEmployeeId={peopleFocusId}
      onInitialHandled={() => setPeopleFocusId(null)}
      onManagePermissions={canManageAuthority ? openAuthorityForPerson : null}
    />;
    if (tab === "lifecycle" && canManagePeople) return <AdminLifecycle me={me} initialProfileId={lifecycleIntent?.profileId || null} initialType={lifecycleIntent?.type || null} onInitialHandled={() => setLifecycleIntent(null)} />;
    if (tab === "protected-hr" && canAccessProtectedHR) return <AdminProtectedHR key={`${me.org_id}:${me.id}`} me={me} />;
    if (tab === "payroll" && canUsePayroll) return <AdminPayroll key={`${me.org_id}:${me.id}`} me={me} />;
    if (tab === "units" && isAdmin) return <Units me={me} openItem={openItem} openPeopleAccess={openPeopleAccess} openProject={(id) => navigate({tab:"admin-projects",projectId:id})} />;
    if (tab === "admin-projects" && isAdmin) return <AdminProjects key={`${me.org_id}:${me.id}`} me={me} initialProjectId={projectId} openProject={openProject} scheduleMeeting={startMeeting} openItem={openItem} goAssign={startAssignment} openRoom={(id, reference) => openRoom({kind:"project",projectId:id,reference})} />;
    if (tab === "admin-calendar" && isAdmin) return <AdminCalendar me={me} openItem={openItem} openMeeting={openMeeting} scheduleMeeting={startMeeting} roleMode="admin" openProject={(id) => navigate({tab:"admin-projects",projectId:id})} />;
    if (tab === "exec-calendar" && isExec) return <AdminCalendar me={me} openItem={openItem} openMeeting={openMeeting} scheduleMeeting={startMeeting} roleMode="executive" openProject={(id) => navigate({tab:"delivery",projectId:id})} />;
    if (tab === "audit" && canViewAudit) return <AdminAudit me={me} />;
    if (tab === "events" && canViewAudit) return <AdminEvents me={me} />;
    if (tab === "workflows" && canUseWorkflows) return <AdminWorkflows me={me} />;
    if (tab === "policies" && canManageAuthority) return <AdminPolicies me={me} />;
    if (tab === "integrations" && canManageIntegrations) return <AdminIntegrations me={me} />;
    if (tab === "authority" && canManageAuthority) return <AdminAuthority me={me} refreshMe={boot} initialProfileId={authorityFocusProfileId} />;
    if (tab === "settings" && isAdmin) return <ControlCenter me={me} go={go} />;
    if (tab === "office-settings" && isAdmin) return <OfficeSettings me={me} section={setting} openSection={(next) => go("office-settings", {setting:next})} back={() => go("settings")} openWorkforce={(section) => go("attendance", {workforceSection:section})} />;
    return <MeScreen me={me} onOpenWork={openItem} onOpenAchievements={() => go("achievements")} openGoal={setGoalId} openRecord={() => go("record")} openPerformance={() => go("performance")} openWorkforce={() => go("attendance")} openLearning={() => go("learning")} openAssets={() => go("assets")} openCompliance={() => go("compliance")} />;
  }

  const appModeClass = isExec ? "executive-app" : isUnitManager ? "manager-app" : (!isAdmin ? "staff-app" : "office-app");
  const roleLabel = isExec ? "Group Pastor" : isAdmin ? "Administration" : isUnitManager ? "Manager" : "Staff";
  const routeTransitionKey = itemId
    ? `item:${itemId}`
    : assigning
      ? "assign"
      : projectId && isUnitManager
        ? `project:${projectId}`
        : goalId
          ? `goal:${goalId}`
          : person && isManager
            ? `person:${person.id}:${person.focus || "current"}`
            : roomContext
              ? `room:${roomContext.kind}:${roomContext.unitId || roomContext.subTeamId || roomContext.projectId || ""}`
              : meetingDraft
                ? `meeting-draft:${meetingDraft.scope || "context"}`
                : meetingId
                  ? `meeting:${meetingId}`
                  : `tab:${tab}`;

  return (
    <ActiveMfaGate me={me} onVerified={boot}>
    <RolePresentationContext.Provider value={isExec ? "executive" : null}>
    <div className={`app ${appModeClass}`}>
      {isExec ? <Suspense fallback={null}><ExecutiveRedesignStyles /></Suspense> : null}
      <SideNav
        tab={tab}
        setTab={go}
        me={me}
        isAdmin={isAdmin}
        isExec={isExec}
        isManager={isUnitManager}
        onUnitChange={switchUnit}
        onMessages={() => go("messages")}
        onComposeMessage={() => (isExec || isAdmin) ? startSurfaceCreate("messages", "message_room") : me.unit_id ? openRoom({ kind:"unit", unitId:me.unit_id }) : go("messages")}
        onCreateWork={(isManager || isExec) ? () => startAssignment() : undefined}
        onCreateMinistryObjective={isExec ? () => startSurfaceCreate("strategy", "ministry_objective") : undefined}
         onCreateProject={isExec ? () => go("exec-projects") : undefined}
        onCreateAnnouncement={canPublishAnnouncement ? () => startSurfaceCreate("announcements", "announcement") : undefined}
        onCreateMeeting={() => startMeeting(isAdmin || isExec ? { scope:"organisation", organisation:true } : { scope:"unit", unitId:me.unit_id, unitName:me.unit_name })}
        onGuide={() => openGuide(false)}
      />
      <div className="ev2s-workspace">
        <MobileTopBar
          me={me}
          roleLabel={roleLabel}
          isAdmin={isAdmin}
          isExec={isExec}
          isManager={isUnitManager}
          onProfile={() => go("me")}
          onUnitChange={switchUnit}
          onNavigate={go}
          onMessages={() => go("messages")}
          onComposeMessage={() => (isExec || isAdmin) ? startSurfaceCreate("messages", "message_room") : me.unit_id ? openRoom({ kind:"unit", unitId:me.unit_id }) : go("messages")}
          onCreateWork={(isManager || isExec) ? () => startAssignment() : undefined}
          onCreateMinistryObjective={isExec ? () => startSurfaceCreate("strategy", "ministry_objective") : undefined}
         onCreateProject={isExec ? () => go("exec-projects") : undefined}
          onCreateAnnouncement={canPublishAnnouncement ? () => startSurfaceCreate("announcements", "announcement") : undefined}
          onCreateMeeting={() => startMeeting(isAdmin || isExec ? { scope:"organisation", organisation:true } : { scope:"unit", unitId:me.unit_id, unitName:me.unit_name })}
          onOpenWork={openSearchWork}
          onOpenProject={openSearchProject}
          onOpenPerson={openSearchPerson}
          onOpenMeeting={openMeeting}
          onOpenRoom={openRoom}
          onOpenAnnouncement={openSearchAnnouncement}
          onGuide={() => openGuide(true)}
        />
        <AppTopBar
          me={me}
          roleLabel={roleLabel}
          tab={tab}
          onProfile={() => go("me")}
          onNavigate={go}
          isAdmin={isAdmin}
          isExec={isExec}
          isManager={isUnitManager}
          onMessages={() => go("messages")}
          onComposeMessage={() => (isExec || isAdmin) ? startSurfaceCreate("messages", "message_room") : me.unit_id ? openRoom({ kind:"unit", unitId:me.unit_id }) : go("messages")}
          onCreateWork={(isManager || isExec) ? () => startAssignment() : undefined}
          onCreateMinistryObjective={isExec ? () => startSurfaceCreate("strategy", "ministry_objective") : undefined}
         onCreateProject={isExec ? () => go("exec-projects") : undefined}
          onCreateAnnouncement={canPublishAnnouncement ? () => startSurfaceCreate("announcements", "announcement") : undefined}
          onCreateMeeting={() => startMeeting(isAdmin || isExec ? { scope:"organisation", organisation:true } : { scope:"unit", unitId:me.unit_id, unitName:me.unit_name })}
          onOpenWork={openSearchWork}
          onOpenProject={openSearchProject}
          onOpenPerson={openSearchPerson}
          onOpenMeeting={openMeeting}
          onOpenRoom={openRoom}
          onOpenAnnouncement={openSearchAnnouncement}
          onGuide={() => openGuide(true)}
        />
        <main className={"app-content ev2s-content" + (isExec && (tab !== "home" || overlay) ? " exec-v2" : "")}>
          {me.capabilitySchemaReady === false && <div className="flag flag-amber" role="status">
            {me.legacyAuthorityVerified
              ? "Preview compatibility: your existing permissions have been checked by the CEAC server. The temporary-delegation expiry upgrade is not installed; new database-dependent functionality remains unavailable. Use production for normal work."
              : "Preview compatibility: the database upgrade is not installed and server permission verification was incomplete. Privileged capabilities are disabled here. Use production for normal work."}
          </div>}
          {tab === "work" && !overlay && <div className="s2-achievement-entry">
            <button type="button" onClick={() => go("achievements")}>My achievements · Monthly / Quarterly / Projects →</button>
          </div>}
          <RouteTransition routeKey={routeTransitionKey}>
          <Suspense fallback={<RouteFallback />}>
          <SettingsBack tab={tab} enabled={isAdmin && !overlay} go={go} returnTo={settingsReturn}>
          {itemId ? <Item id={itemId} me={me} reviewOnly={isExec && tab === "exec-organisation"} session={session} isManager={isUnitManager} initialRoutineDate={itemRoutineDate} openRoom={openRoom} back={closeUrlOverlay} />
            : assigning && (isExec || isAdmin) ? <ExecutiveAssign key={`${me.org_id}:${me.id}`} me={me} context={assigning} back={() => setAssigning(null)} />
            : assigning ? <Assign me={me}
                initialProjectId={assigning.projectId}
                initialObjectiveId={assigning.objectiveId}
                initialPhaseId={assigning.phaseId}
                initialSubTeamId={assigning.subTeamId}
                initialMeetingId={assigning.meetingId}
                initialKind={assigning.kind}
                initialMeetingTitle={assigning.meetingTitle}
                initialMeetingOn={assigning.meetingOn}
                initialMeetingNote={assigning.meetingNote}
                initialTitle={assigning.title}
                initialSourceRoomId={assigning.sourceRoomId}
                initialSourceMessageId={assigning.sourceMessageId}
                back={() => setAssigning(null)} />
            : projectId && isUnitManager ? <ManagerProjects key={`${me.org_id}:${me.id}:${me.unit_id || "none"}:${projectId}`} me={me} initialProjectId={projectId} openItem={openItem} goAssign={startAssignment} openMeeting={openMeeting} scheduleMeeting={startMeeting} openRoom={(id, reference) => openRoom({ kind: "project", projectId: id, reference })} back={closeUrlOverlay} />
            : goalId ? <Goals id={goalId} me={me} back={() => setGoalId(null)} />
            : person && isManager ? <PersonDetail me={me} profileId={person.id} focus={person.focus} openItem={openItem} openProject={openProject} back={() => setPerson(null)} />
            : roomContext ? <Room key={`${me.org_id}:${me.id}:${roomContext.mentionProfileId || ""}`} me={me} context={roomContext} back={closeRoom} openItem={openItem} openProject={openProject} scheduleMeeting={startMeeting} openAnnouncements={() => go("announcements")} onRoomChange={openRoom} startWorkFromMessage={isManager || isExec ? startAssignment : null} />
            : meetingDraft ? <MeetingScheduler me={me} context={meetingDraft} onClose={() => setMeetingDraft(null)} onCreated={(id) => { setMeetingDraft(null); openMeeting(id); }} />
            : meetingId ? <Meeting me={me} meetingId={meetingId} back={closeUrlOverlay} goAssign={startAssignment} openItem={openItem} openProject={openProject} openRoom={openRoom} />
            : pageForTab()}
          </SettingsBack>
          </Suspense>
          </RouteTransition>
        </main>
        {!overlay && <Tabs tab={tab} setTab={go} isManager={isUnitManager} isExec={isExec} isAdmin={isAdmin} me={me} onGuide={() => openGuide(false)} />}
      </div>
    </div>
    </RolePresentationContext.Provider>
    </ActiveMfaGate>);
}
