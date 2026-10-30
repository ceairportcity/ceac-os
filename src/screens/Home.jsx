import { useEffect, useRef, useState } from "react";
import AssistiveTextarea from "../components/AssistiveTextarea";
import { supabase } from "../lib/supabase";
import { openSession, startWork, endWork, reconcileWorkSession, verifyContinuedWorkSession, WorkStartPreflightError } from "../lib/session";
import { isOverdue } from "../lib/time";
import { Sheet } from "../components/bits";
import SessionRecoveryDialog from "../components/SessionRecoveryDialog";
import { recheckSessionCorrection } from "../lib/session";
import StartWorkDialog from "../components/StartWorkDialog";
import { humanError } from "../lib/productLanguage";
import StaffTodayV2 from "../experience-v2/staff-today/StaffTodayV2";
import MinistryNumbers from "../components/MinistryNumbers";

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

function requireResult(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data || [];
}

function accraDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function nextBirthday(value) {
  const [, month, day] = String(value).slice(0, 10).split("-").map(Number);
  const today = startOfDay();
  const date = new Date(today.getFullYear(), month - 1, day);
  if (date < today) date.setFullYear(date.getFullYear() + 1);
  return date;
}

export default function Home({ me, session, setSession, openItem, openMeeting, openRoom, openWork, openMe, openAnnouncements, openTeam, openCalendar }) {
  const [items, setItems] = useState([]);
  const [completedThisWeek, setCompletedThisWeek] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [roomMentions, setRoomMentions] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [upcomingLeave, setUpcomingLeave] = useState([]);
  const [leaveUpdates, setLeaveUpdates] = useState([]);
  const [reviewSubmissions, setReviewSubmissions] = useState([]);
  const [reviewFollowups, setReviewFollowups] = useState([]);
  const [myBlockers, setMyBlockers] = useState([]);
  const [blockerFollowups, setBlockerFollowups] = useState([]);
  const [ask, setAsk] = useState(false);
  const [place, setPlace] = useState("office");
  const [officeLocations, setOfficeLocations] = useState([]);
  const [officeLocationId, setOfficeLocationId] = useState("");
  const [officeLocationStatus, setOfficeLocationStatus] = useState("loading");
  const [sessionWorkItem, setSessionWorkItem] = useState("");
  const [offsiteLocationName, setOffsiteLocationName] = useState("");
  const [offsiteWork, setOffsiteWork] = useState([]);
  const [offsiteWorkStatus, setOffsiteWorkStatus] = useState("idle");
  const starting=useRef(false);
  useEffect(()=>{setAsk(false);setOffsiteLocationName("");setSessionWorkItem("");},[me.id,me.org_id]);
  const [startOptionsAttempt,setStartOptionsAttempt]=useState(0);
  const sessionScope = me.org_id + ":" + me.id;
  const [verifiedSessionScope, setVerifiedSessionScope] = useState(sessionScope);
  const sessionVerified = verifiedSessionScope === sessionScope;
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [drill, setDrill] = useState(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEndedAt, setRecoveryEndedAt] = useState("");
  const [recoveryNote, setRecoveryNote] = useState("");
  const [correctionNotice, setCorrectionNotice] = useState("");
  const [eventDetail, setEventDetail] = useState(null);
  const [, tick] = useState(0);

  useEffect(() => { const timer = setInterval(() => tick((value) => value + 1), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { load(); }, [me.id, me.unit_id]);
  useEffect(() => {
    if(!ask)return;
    let active = true;
    setOfficeLocations([]);
    setOfficeLocationId("");
    setOfficeLocationStatus("loading");
    supabase.from("office_locations").select("id,name")
      .eq("org_id", me.org_id).order("name")
      .then(({ data, error: locationError }) => {
        if (!active) return;
        if (locationError) { setOfficeLocationStatus("error"); return; }
        setOfficeLocations(data || []);
        setOfficeLocationStatus("ready");
      }, () => { if (active) setOfficeLocationStatus("error"); });
    return () => { active = false; };
  }, [ask, me.id, me.org_id,startOptionsAttempt]);

  // Optional off-site links load independently of the Overview's
  // calendars, alerts and other optional datasets. No stale list is trusted.
  useEffect(() => {
    if (!ask || place !== "elsewhere") return;
    let active = true;
    setOffsiteWork([]);
    setSessionWorkItem("");
    setOffsiteWorkStatus("loading");
    Promise.resolve(
      supabase.from("work_items").select("id,ref,title,status")
        .eq("org_id",me.org_id).eq("assignee_id",me.id)
        .in("status",["not_started","in_progress","returned"])
        .order("created_at",{ascending:false}).limit(100)
    ).then(({ data, error: workError }) => {
      if (!active) return;
      setOffsiteWork(workError ? [] : (data || []));
      setOffsiteWorkStatus(workError ? "error" : "ready");
    }).catch(() => { if (active) { setOffsiteWork([]); setOffsiteWorkStatus("error"); } });
    return () => { active = false; };
  }, [ask, place, me.org_id, me.id,startOptionsAttempt]);

  async function load() {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const rangeStart = startOfDay();
      const rangeEnd = new Date(rangeStart); rangeEnd.setDate(rangeEnd.getDate() + 14);
      const recentStart = new Date(rangeStart); recentStart.setDate(recentStart.getDate() - 14);
      const requests = [
        supabase.from("work_items")
          .select("id, ref, title, status, due_at, visibility, completed_at")
          .eq("assignee_id", me.id).not("status", "in", "(completed,self_certified,cancelled)")
          .order("due_at", { ascending: true, nullsFirst: false }),
        supabase.from("work_items")
          .select("id, ref, title, status, due_at, completed_at")
          .eq("assignee_id", me.id).in("kind", ["task", "deliverable"])
          .in("status", ["completed", "self_certified"])
          .gte("completed_at", startOfWeek().toISOString())
          .order("completed_at", { ascending: false }),
        supabase.from("alerts")
          .select("id, kind, subject_id, message, first_seen_at,resolved_at")
          .eq("for_profile_id", me.id).is("acknowledged_at", null).is("resolved_at", null),
        supabase.from("feedback_notes")
          .select("id,note,created_at,profiles!feedback_notes_author_id_fkey(full_name)")
          .eq("profile_id", me.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("announcements")
          .select("id,title,priority,requires_acknowledgement,published_at,profiles!announcements_author_id_fkey(full_name),announcement_receipts(profile_id,read_at,acknowledged_at)")
          .eq("status", "published").order("published_at", { ascending: false }).limit(2),
        supabase.from("ministry_events")
          .select("id,title,kind,scope,unit_id,starts_at,ends_at,all_day,location,notes,cancelled,ministry_event_units(unit_id,note)")
          .lte("starts_at", rangeEnd.toISOString()).order("starts_at"),
        supabase.from("meeting_sessions")
          .select("id,title,scope,unit_id,project_id,starts_at,ends_at,provider,join_url,status,projects(name),units(name)")
          .gte("starts_at", rangeStart.toISOString()).lte("starts_at", rangeEnd.toISOString())
          .neq("status","cancelled").order("starts_at"),
        supabase.from("unit_memberships")
          .select("profile_id,profiles!unit_memberships_profile_id_fkey(id,full_name,birthday)")
          .eq("unit_id", me.unit_id),
        supabase.from("leave_requests")
          .select("id,kind,start_date,end_date,status,decided_at,decision_note")
          .eq("profile_id", me.id).order("requested_at", { ascending: false }),
        supabase.from("submissions")
          .select("id,work_item_id,submitted_at")
          .eq("profile_id", me.id).order("submitted_at", { ascending: false }),
        supabase.from("work_followups")
          .select("id,work_item_id,sequence,created_at")
          .eq("actor_id", me.id).order("created_at", { ascending: false }),
        supabase.from("blockers")
          .select("id,work_item_id,party_text,party_unit_id,state,responded_at,created_at,units:party_unit_id(name),work_items(id,ref,title,status)")
          .eq("claimed_by", me.id).in("state", ["claimed","acknowledged"]),
        supabase.from("blocker_followups")
          .select("id,blocker_id,sequence,created_at")
          .eq("actor_id", me.id).order("created_at", { ascending: false }),
        supabase.from("room_mentions")
          .select("id,message_id,created_at")
          .eq("profile_id", me.id).gte("created_at", recentStart.toISOString())
          .order("created_at", { ascending: false }).limit(5),
      ];

      const [itemResult, completedResult, alertResult, feedbackResult, announcementResult, eventResult, meetingResult, memberResult, leaveResult, submissionResult, reviewFollowupResult, blockerResult, blockerFollowupResult, mentionResult] = await Promise.all(requests);
      setItems(requireResult(itemResult, "Your work"));
      setCompletedThisWeek(requireResult(completedResult, "Completed work"));
      setAlerts(requireResult(alertResult, "Alerts"));
      setFeedback(requireResult(feedbackResult, "Feedback"));
      setAnnouncements(requireResult(announcementResult, "Announcements"));
      setReviewSubmissions(requireResult(submissionResult, "Submitted work"));
      setReviewFollowups(requireResult(reviewFollowupResult, "Review follow-ups"));
      setMyBlockers(requireResult(blockerResult, "Dependencies"));
      setBlockerFollowups(requireResult(blockerFollowupResult, "Dependency follow-ups"));
      const mentionRows = requireResult(mentionResult, "Room mentions");
      if (mentionRows.length) {
        const messageResult = await supabase.from("room_messages")
          .select("id,room_id,body,created_at,author_id,profiles!room_messages_author_id_fkey(full_name),rooms(id,kind,unit_id,sub_team_id,project_id,units(name),sub_teams(name),projects(name))")
          .in("id", mentionRows.map((row) => row.message_id));
        const messageRows = requireResult(messageResult, "Room mention messages");
        const byId = new Map(messageRows.map((row) => [row.id,row]));
        setRoomMentions(mentionRows.map((row) => byId.get(row.message_id)).filter(Boolean));
      } else setRoomMentions([]);

      const events = requireResult(eventResult, "Coming events").filter((event) => {
        const stillCurrent = new Date(event.ends_at || event.starts_at) >= rangeStart;
        const relevant = event.scope === "church" || event.unit_id === me.unit_id
          || (event.ministry_event_units || []).some((unit) => unit.unit_id === me.unit_id);
        return stillCurrent && relevant;
      });
      setCalendarEvents(events.slice(0, 4));
      setUpcomingMeetings(requireResult(meetingResult, "Meetings").slice(0, 4));
      const birthdayEnd = new Date(rangeStart); birthdayEnd.setDate(birthdayEnd.getDate() + 7);
      setBirthdays(requireResult(memberResult, "Birthdays")
        .map((member) => member.profiles).filter((profile) => profile?.birthday)
        .map((profile) => ({ ...profile, nextBirthday: nextBirthday(profile.birthday) }))
        .filter((profile) => profile.nextBirthday <= birthdayEnd)
        .sort((left, right) => left.nextBirthday - right.nextBirthday));
      const leaveRows = requireResult(leaveResult, "Leave");
      setUpcomingLeave(leaveRows.filter((request) => request.status === "approved"
        && new Date(`${request.start_date}T00:00:00`) >= rangeStart
        && new Date(`${request.start_date}T00:00:00`) <= rangeEnd).slice(0, 2));
      setLeaveUpdates(leaveRows.filter((request) => request.decided_at
        && new Date(request.decided_at) >= recentStart).slice(0, 2));
    } catch (err) {
      setLoadFailed(true);
      setError(humanError(err, "Home could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  const today = startOfDay();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const soon = new Date(today); soon.setDate(soon.getDate() + 7);
  const weekStart = startOfWeek();
  const nextWeek = new Date(weekStart); nextWeek.setDate(nextWeek.getDate() + 7);
  const returned = items.filter((item) => item.status === "returned");
  const returnedIds = new Set(returned.map((item) => item.id));
  const visibleAlerts = alerts.filter((alert) =>
    alert.kind !== "overdue_first"
    && (!alert.subject_id || !returnedIds.has(alert.subject_id))
  );
  const dueToday = items.filter((item) => item.due_at
    && new Date(item.due_at) >= today && new Date(item.due_at) < tomorrow
    && !["waiting_on","returned","in_review"].includes(item.status));
  const overdue = items.filter((item) => isOverdue(item.due_at)
    && !["waiting_on","returned","in_review"].includes(item.status));
  const waitingDependencies = items.filter((item) => item.status === "waiting_on");
  const waitingReviews = items.filter((item) => item.status === "in_review");
  const dueSoon = items.filter((item) => item.due_at
    && new Date(item.due_at) >= tomorrow && new Date(item.due_at) < soon
    && !["waiting_on","returned","in_review"].includes(item.status));
  const dueThisWeek = items.filter((item) => item.due_at
    && new Date(item.due_at) >= weekStart && new Date(item.due_at) < nextWeek
    && !["waiting_on","in_review"].includes(item.status));
  const activeWork = items.filter((item) => item.status === "in_progress"
    && !dueToday.some((due) => due.id === item.id)
    && !overdue.some((due) => due.id === item.id)).slice(0, 3);
  const announcementAttention = announcements.filter((announcement) => announcement.requires_acknowledgement
    && !(announcement.announcement_receipts || []).some((receipt) => receipt.profile_id === me.id && receipt.acknowledged_at));

  const actionMap = new Map();
  [...returned, ...overdue, ...dueToday].forEach((item) => actionMap.set(item.id, item));
  const nextMoveItems = [...actionMap.values()];
  const attention = nextMoveItems.length + visibleAlerts.length + announcementAttention.length;
  const staleSession = Boolean(session
    && accraDateKey(session.last_confirmed_at || session.started_at) < accraDateKey(new Date()));

  function reviewFollowupState(item) {
    const submission = reviewSubmissions.find((row) => row.work_item_id === item.id);
    const count = reviewFollowups.filter((row) => row.work_item_id === item.id).length;
    if (!submission) return { count, canFollowUp: false, label: "Waiting for review" };
    if (count >= 2) return { count, canFollowUp: false, label: "2 follow-ups sent" };
    const delayDays = count === 0 ? 1 : 3;
    const availableAt = new Date(new Date(submission.submitted_at).getTime() + delayDays * 86400000);
    return {
      count,
      canFollowUp: new Date() >= availableAt,
      availableAt,
      label: new Date() >= availableAt
        ? (count === 0 ? "Follow up" : "Send final follow-up")
        : `Follow-up available ${availableAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    };
  }

  function blockerFor(item) {
    return myBlockers.find((blocker) => blocker.work_item_id === item.id);
  }

  function blockerFollowupState(blocker) {
    if (!blocker) return { canFollowUp: false, label: "Waiting on another unit" };
    const count = blockerFollowups.filter((row) => row.blocker_id === blocker.id).length;
    if (count >= 2) return { count, canFollowUp: false, label: "2 follow-ups sent" };
    const anchor = new Date(blocker.responded_at || blocker.created_at);
    const delayDays = count === 0 ? 1 : 3;
    const availableAt = new Date(anchor.getTime() + delayDays * 86400000);
    return {
      count,
      canFollowUp: new Date() >= availableAt,
      availableAt,
      label: new Date() >= availableAt
        ? (count === 0 ? "Follow up" : "Send final follow-up")
        : `Follow-up available ${availableAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    };
  }

  async function followUpReview(itemId) {
    setBusy(true); setError(null);
    try {
      const { error: followError } = await supabase.rpc("follow_up_work_review", { p_work_item_id: itemId });
      if (followError) throw followError;
      await load();
    } catch (err) { setError(humanError(err, "The follow-up could not be sent.")); }
    finally { setBusy(false); }
  }

  async function followUpDependency(blockerId) {
    setBusy(true); setError(null);
    try {
      const { error: followError } = await supabase.rpc("follow_up_blocker", { p_blocker_id: blockerId });
      if (followError) throw followError;
      await load();
    } catch (err) { setError(humanError(err, "The follow-up could not be sent.")); }
    finally { setBusy(false); }
  }

  async function verifyEndedSession(id) {
    const { data: closed, error: closeError } = await supabase.from("work_sessions")
      .select("id,ended_at").eq("org_id",me.org_id)
      .eq("profile_id",me.id).eq("id",id).maybeSingle();
    if (closeError || !closed?.ended_at)
      throw new Error("The exact session close record is not verified.");
    const current = await openSession(me.org_id,me.id);
    if (current?.id === id) throw new Error("The same session remains open.");
    setSession(current);
  }

  async function verifyCurrentSession() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const current = await openSession(me.org_id,me.id);
      setSession(current); setVerifiedSessionScope(sessionScope);
      setAsk(false); setRecoveryOpen(false);
    } catch {
      setVerifiedSessionScope(null);
      setError("Work session status remains unverified. Retry before another Start or End action.");
    } finally { setBusy(false); }
  }

  async function begin() {
    if (starting.current || busy || !sessionVerified) return;
    starting.current=true;setBusy(true); setError(null);
    try {
      if (place === "elsewhere" && sessionWorkItem &&
          (offsiteWorkStatus !== "ready" || !offsiteWork.some((item) => item.id === sessionWorkItem))) {
        throw new WorkStartPreflightError("Choose an available active responsibility before starting off-site. No session was started.");
      }
      if (place === "office" && (officeLocationStatus !== "ready" || !officeLocationId)) {
        throw new WorkStartPreflightError("Choose the authorised office or programme location before you start. No session was started.");
      }
      const created = await startWork(me.org_id, me.id, place, place === "elsewhere" ? sessionWorkItem : null, place === "office" ? officeLocationId : null, offsiteLocationName);
      const current = await openSession(me.org_id,me.id);
      if (!created?.id || current?.id !== created.id)
        throw new Error("Start was not verified against the current session.");
      setSession(current); setAsk(false); setSessionWorkItem(""); setOffsiteLocationName("");
    } catch (err) {
      // Location acquisition failed before any database insert; the selected
      // location remains available so the employee can enable access and retry.
      if (err instanceof WorkStartPreflightError) {
        setError(err.message);
        return;
      }
      // A failed acknowledgement may follow a successful server insert:
      // another Start must remain disabled until an authoritative re-read.
      setVerifiedSessionScope(null); setAsk(false);
      setError((err?.message || "Start Work could not be verified.")+" Recheck your current session before trying again.");
    } finally { starting.current=false;setBusy(false); }
  }

  async function stop() {
    if (!session?.id || busy || !sessionVerified) return;
    setBusy(true); setError(null);
    try {
      await endWork(session.id);
      await verifyEndedSession(session.id);
    } catch {
      setVerifiedSessionScope(null);
      setError("End Work could not be verified. Recheck your current session before trying again.");
    } finally { setBusy(false); }
  }

  async function continueRecoveredSession() {
    if (!session?.id || busy || !sessionVerified) return;
    setBusy(true); setError(null);
    try {
      const created = await reconcileWorkSession(session.id, "continue");
      const current = await verifyContinuedWorkSession(me.org_id,me.id,session.id,created);
      if (
          accraDateKey(current.last_confirmed_at || current.started_at) < accraDateKey(new Date()))
        throw new Error("The stale session still requires verification.");
      setSession(current); setRecoveryOpen(false);
    } catch (err) {
      if (err instanceof WorkStartPreflightError) { setError(err.message); return; }
      setVerifiedSessionScope(null); setRecoveryOpen(false);
      setError("Continued work session could not be verified. Recheck the server record.");
    } finally { setBusy(false); }
  }

  async function closeRecoveredSession() {
    if (!session?.id || !recoveryEndedAt || busy || !sessionVerified) return;
    setBusy(true); setError(null);
    try {
      await reconcileWorkSession(session.id, "close", new Date(recoveryEndedAt).toISOString(), recoveryNote.trim() || null);
      await verifyEndedSession(session.id);
      setRecoveryOpen(false); setRecoveryEndedAt(""); setRecoveryNote("");setCorrectionNotice("End time saved. You can start work.");
    } catch (err) {
      setVerifiedSessionScope(null);
      setError(err?.message || "Earlier session close could not be verified. Recheck the server record.");
    } finally { setBusy(false); }
  }

  async function recheckCorrection() {
    if(busy || !session?.id) return;
    setBusy(true);setError(null);
    try {
      const result = await recheckSessionCorrection(me.org_id,me.id,session.id);
      setSession(result.current);setVerifiedSessionScope(sessionScope);
      if(result.closed){setRecoveryOpen(false);setRecoveryEndedAt("");setRecoveryNote("");setCorrectionNotice("End time saved. You can start work.");}
    } catch(err){setVerifiedSessionScope(null);setError(err.message);}
    finally{setBusy(false);}
  }

  const accraHour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    hour: "2-digit",
    hour12: false,
  }).format(new Date()));
  const greeting = accraHour < 12 ? "Good morning" : accraHour < 17 ? "Good afternoon" : "Good evening";
  const drillRows = drill?.rows || [];
  const primaryNextItem = nextMoveItems[0] || activeWork[0] || dueSoon[0] || null;
  const nextMeeting = upcomingMeetings[0] || null;
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return <>
    <StaffTodayV2
      me={me}
      session={session}
      staleSession={staleSession}
      busy={busy}
      sessionVerified={sessionVerified}
      greeting={greeting}
      todayLabel={todayLabel}
      loading={loading}
      loadFailed={loadFailed}
      error={error}
      primaryNextItem={primaryNextItem}
      nextMeeting={nextMeeting}
      nextMoveItems={nextMoveItems}
      visibleAlerts={visibleAlerts}
      announcementAttention={announcementAttention}
      feedback={feedback}
      completedThisWeek={completedThisWeek}
      leaveUpdates={leaveUpdates}
      roomMentions={roomMentions}
      waitingReviews={waitingReviews}
      waitingDependencies={waitingDependencies}
      reviewSubmissions={reviewSubmissions}
      dueSoon={dueSoon}
      upcomingMeetings={upcomingMeetings}
      calendarEvents={calendarEvents}
      birthdays={birthdays}
      upcomingLeave={upcomingLeave}
      announcements={announcements}
      dueThisWeek={dueThisWeek}
      overdue={overdue}
      drill={drill}
      drillRows={drillRows}
      onStartWork={() => sessionVerified && setAsk(true)}
      onEndWork={stop}
      onReviewSession={() => sessionVerified && setRecoveryOpen(true)}
      onContinueRecoveredSession={continueRecoveredSession}
      onCloseRecoveredSession={() => setRecoveryOpen(true)}
      onOpenItem={openItem}
      onOpenMeeting={openMeeting}
      onOpenRoom={openRoom}
      onOpenAnnouncements={openAnnouncements}
      onOpenEvent={setEventDetail}
      onRetry={load}
      onSelectDrill={setDrill}
      getReviewFollowupState={reviewFollowupState}
      getBlockerFor={blockerFor}
      getBlockerFollowupState={blockerFollowupState}
      onFollowUpReview={followUpReview}
      onFollowUpDependency={followUpDependency}
      ministryRecord={<MinistryNumbers me={me} compact presentation="staffV2" />}
    />

    {session?.place==="elsewhere"&&session.flags?.offsite_location_name&&<p className="screen-note">Working from: {session.flags.offsite_location_name}</p>}
    {!sessionVerified && <div role="alert" className="flag flag-amber">Work session status requires verification. <button type="button" disabled={busy} onClick={verifyCurrentSession}>Retry session verification</button></div>}
    {ask && sessionVerified && <StartWorkDialog
      place={place} onPlaceChange={value=>{setPlace(value);setError(null);if(value==="office")setSessionWorkItem("");}}
      locationName={offsiteLocationName} onLocationNameChange={value=>{setOffsiteLocationName(value);setError(null);}}
      locationId={officeLocationId} onLocationChange={value=>{setOfficeLocationId(value);setError(null);}}
      locations={officeLocations} locationStatus={officeLocationStatus}
      workId={sessionWorkItem} onWorkChange={value=>{setSessionWorkItem(value);setError(null);}}
      workItems={offsiteWork} workStatus={offsiteWorkStatus}
      busy={busy} error={error}
      canStart={sessionVerified && !(place === "elsewhere" && (!offsiteLocationName.trim() || Boolean(sessionWorkItem && (offsiteWorkStatus !== "ready" || !offsiteWork.some((item) => item.id === sessionWorkItem))))) && !(place === "office" && (officeLocationStatus !== "ready" || !officeLocationId))}
      onReload={()=>{setError(null);setStartOptionsAttempt(value=>value+1);}}
      onStart={begin} onClose={()=>!busy&&setAsk(false)}
    />}
    {correctionNotice&&<p role="status">{correctionNotice}</p>}
    {recoveryOpen && session && <SessionRecoveryDialog session={session} endedAt={recoveryEndedAt} onEndChange={setRecoveryEndedAt}
      note={recoveryNote} onNoteChange={setRecoveryNote} busy={busy} verified={sessionVerified} error={error}
      onSave={closeRecoveredSession} onContinue={continueRecoveredSession} onRecheck={recheckCorrection} onClose={()=>!busy&&setRecoveryOpen(false)}/>}
    {eventDetail && <Sheet onClose={() => setEventDetail(null)}>
      <div className="eyebrow">{eventDetail.kind.replaceAll("_", " ")}</div>
      <div className="h2" style={{ marginTop: 5 }}>{eventDetail.title}</div>
      {eventDetail.cancelled && <div className="flag flag-brick" style={{ marginTop: 12 }}><h4>Cancelled</h4>This stays visible because people may already have planned around it.</div>}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row-m">{new Date(eventDetail.starts_at).toLocaleString("en-GB", { timeZone: "Africa/Accra", day: "numeric", month: "short", year: "numeric", hour: eventDetail.all_day ? undefined : "2-digit", minute: eventDetail.all_day ? undefined : "2-digit" })}</div>
        {eventDetail.location && <div className="row-note">Location: {eventDetail.location}</div>}
        {eventDetail.notes && <div className="row-note">{eventDetail.notes}</div>}
      </div>
    </Sheet>}

  </>;
}
