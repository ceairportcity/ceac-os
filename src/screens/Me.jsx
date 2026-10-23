import { useEffect, useState } from "react";
import ProfilePortraitEditor from "../components/ProfilePortraitEditor";
 import { supabase } from "../lib/supabase";
import { ProductNotice } from "../components/bits";
import { dateOnly } from "../lib/time";
import { humanError } from "../lib/productLanguage";
import { isMissingAnnualLeaveStageSchema, isMissingVolunteerNoticeSchema } from "../lib/stage1SchemaCompatibility";
import {
  Button,
  Drawer,
  InputField,
  ModalDialog,
  Skeleton,
  StatePanel,
  TextareaField,
} from "../experience-v2/components";
import {
  PersonalBoundary,
  PersonalDestinationCard,
  PersonalDestinationGrid,
  PersonalDetailGrid,
  PersonalEmpty,
  PersonalFact,
  PersonalPageHeader,
  PersonalRecordRow,
  PersonalSection,
  PersonalTabs,
} from "../experience-v2/personal-family/PersonalFamilyV2";

const EMPTY_DETAILS = {
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
  address_text: "",
  social_handles: {},
};

export default function Me({ me, openGoal, openRecord, openPerformance, openWorkforce, openLearning, openAssets, openCompliance, onOpenWork, onOpenAchievements }) {
  const [profile, setProfile] = useState(me);
  const [leavePolicy, setLeavePolicy] = useState(null);
  const [leavePolicyRules, setLeavePolicyRules] = useState([]);
  const [annualLeaveSummary, setAnnualLeaveSummary] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [goals, setGoals] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [engagement, setEngagement] = useState(null);
  const [volunteerNotices, setVolunteerNotices] = useState([]);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [profileForm, setProfileForm] = useState({ preferred_name: "", phone: "", birthday: "", emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relationship: "", address_text: "", instagram: "", linkedin: "" });
  const [area, setArea] = useState("goals");
  const [sheet, setSheet] = useState(null);
  const [kind, setKind] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [remindTitle, setRemindTitle] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [datasetErrors, setDatasetErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [annualLeaveStageReady, setAnnualLeaveStageReady] = useState(true);
  const [volunteerNoticesReady, setVolunteerNoticesReady] = useState(true);

  useEffect(() => { load(); }, [me.id]);

  async function load() {
    setLoading(true);

    let [requestsResult, policyResult, annualSummaryResult, goalsResult, remindersResult, detailsResult, profileResult, engagementResult, volunteerNoticeResult] = await Promise.all([
      supabase.from("leave_requests")
        .select("id, kind, start_date, end_date, days, working_days, working_days_basis, status, requested_at")
        .eq("profile_id", me.id).order("requested_at", { ascending: false }).limit(100),
      supabase.from("leave_policy_versions")
        .select("*").eq("org_id", me.org_id).eq("state", "active")
        .order("confirmed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.rpc("workforce_annual_leave_summary", {
        p_profile_id: me.id,
        p_as_of: new Date().toISOString().slice(0, 10),
      }),
      supabase.from("personal_goals")
        .select("id, title, target_date, status, achieved_at")
        .eq("profile_id", me.id).order("created_at", { ascending: false }),
      supabase.from("personal_reminders")
        .select("id, title, remind_at, linked_goal_id").eq("profile_id", me.id)
        .is("seen_at", null).order("remind_at", { ascending: true }).limit(10),
      supabase.from("profile_personal_details")
        .select("emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, address_text, social_handles")
        .eq("profile_id", me.id).maybeSingle(),
      supabase.from("profiles")
        .select("full_name, preferred_name, email, phone, birthday, job_title, joined_at, contract_type")
        .eq("id", me.id).single(),
      supabase.from("employment_records")
        .select("employment_type,employment_status,working_pattern,unit_id,manager_profile_id")
        .eq("profile_id", me.id).maybeSingle(),
      supabase.from("volunteer_engagement_notices")
        .select("id,notice_kind,title,summary,effective_on,agreement_reference,requires_acknowledgement,created_at,acknowledged_at")
        .eq("profile_id", me.id).order("created_at", { ascending: false }),
    ]);

    const errors = {};
    let annualStageAvailable = true;
    if (requestsResult.error && isMissingAnnualLeaveStageSchema(requestsResult.error)) {
      annualStageAvailable = false;
      requestsResult = await supabase.from("leave_requests")
        .select("id, kind, start_date, end_date, days, status, requested_at")
        .eq("profile_id", me.id).order("requested_at", { ascending: false }).limit(100);
    }
    if (requestsResult.error) errors.leaveRequests = humanError(requestsResult.error, "Your leave requests could not load.");
    else setMyRequests(requestsResult.data || []);

    if (policyResult.error) errors.leavePolicy = humanError(policyResult.error, "The confirmed leave policy could not load.");
    else setLeavePolicy(policyResult.data || null);

    if (annualSummaryResult.error && isMissingAnnualLeaveStageSchema(annualSummaryResult.error)) {
      annualStageAvailable = false;
      setAnnualLeaveSummary(null);
    } else if (annualSummaryResult.error) {
      errors.annualLeaveSummary = humanError(annualSummaryResult.error, "Your annual leave balance could not load.");
      setAnnualLeaveSummary(null);
    } else {
      setAnnualLeaveSummary(annualSummaryResult.data || null);
    }

    if (goalsResult.error) errors.goals = humanError(goalsResult.error, "Your personal goals could not load.");
    else setGoals(goalsResult.data || []);

    if (remindersResult.error) errors.reminders = humanError(remindersResult.error, "Your reminders could not load.");
    else setReminders(remindersResult.data || []);

    if (detailsResult.error) errors.details = humanError(detailsResult.error, "Your private contact details could not load.");
    else setDetails(detailsResult.data || EMPTY_DETAILS);

    if (profileResult.error) errors.profile = humanError(profileResult.error, "Your ordinary profile could not load.");
    else if (profileResult.data) setProfile((value) => ({ ...value, ...profileResult.data }));

    if (engagementResult.error) errors.engagement = humanError(engagementResult.error, "Your engagement record could not load.");
    else setEngagement(engagementResult.data || null);

    if (volunteerNoticeResult.error && isMissingVolunteerNoticeSchema(volunteerNoticeResult.error)) {
      setVolunteerNoticesReady(false);
      setVolunteerNotices([]);
    } else if (volunteerNoticeResult.error) {
      setVolunteerNoticesReady(true);
      errors.volunteerNotices = humanError(volunteerNoticeResult.error, "Your volunteer change notices could not load.");
    } else {
      setVolunteerNoticesReady(true);
      setVolunteerNotices(volunteerNoticeResult.data || []);
    }

    const policy = policyResult.error ? null : policyResult.data;
    if (policy) {
      const rulesResult = await supabase.from("leave_policy_rules")
        .select("*").eq("policy_version_id", policy.id).order("leave_kind");
      if (rulesResult.error) errors.leaveRules = humanError(rulesResult.error, "The leave policy rules could not load.");
      else setLeavePolicyRules(rulesResult.data || []);
    } else if (!policyResult.error) {
      setLeavePolicyRules([]);
    }

    setDatasetErrors(errors);
    setAnnualLeaveStageReady(annualStageAvailable);
    setLoading(false);
    return { errors };
  }

  const annualEntitlement = annualLeaveSummary?.annual_entitlement == null ? null : Number(annualLeaveSummary.annual_entitlement);
  const sharedLeaveSummary = annualLeaveSummary?.shared_other;
  const sharedLeft = sharedLeaveSummary?.balance_available && sharedLeaveSummary?.available_days != null ? Number(sharedLeaveSummary.available_days) : null;
  const annualAccrued = annualLeaveSummary?.accrued_days == null ? null : Number(annualLeaveSummary.accrued_days);
  const annualApproved = annualLeaveSummary?.approved_days == null ? null : Number(annualLeaveSummary.approved_days);
  const annualLeft = annualLeaveSummary?.balance_available && annualLeaveSummary?.available_days != null
    ? Number(annualLeaveSummary.available_days)
    : null;
  const annualBalanceReason = annualLeaveSummary?.reason || null;
  const secondaryPolicyConfigured = Boolean(leavePolicy && leavePolicyRules.some((rule) => rule.leave_kind === "shared_other" && rule.complete));
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const achievedGoals = goals.filter((goal) => goal.status === "achieved");
  const hasProfileReadError = Boolean(datasetErrors.profile || datasetErrors.details);

  function daysBetween(a, b) {
    if (!a || !b) return 0;
    return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
  }

  async function requestLeave() {
    setBusy(true); setMessage(null);
    try {
      const days = daysBetween(startDate, endDate);
      if (days <= 0) throw new Error("Pick a valid range.");
      const { error } = await supabase.rpc("workforce_request_leave", {
        p_kind: kind,
        p_start_date: startDate,
        p_end_date: endDate,
        p_reason: reason || null,
      });
      if (error) throw error;
      setSheet(null); setKind("annual"); setStartDate(""); setEndDate(""); setReason("");
      await load();
    } catch (error) { setMessage(humanError(error, "CEAC could not save that change.")); }
    finally { setBusy(false); }
  }

  async function cancelLeave(id) {
    setBusy(true); setMessage(null);
    try {
      const { error } = await supabase.rpc("workforce_leave_action", {
        p_leave_request_id: id,
        p_action: "cancelled_by_employee",
        p_reason: "Cancelled by employee",
      });
      if (error) throw error;
      await load();
    } catch (error) { setMessage(humanError(error, "That leave request could not be cancelled.")); }
    finally { setBusy(false); }
  }

  async function createGoal() {
    setBusy(true); setMessage(null);
    try {
      const { data, error } = await supabase.from("personal_goals").insert({
        org_id: me.org_id,
        profile_id: me.id,
        title: goalTitle.trim(),
        target_date: goalDate || null,
      }).select("id").single();
      if (error) throw error;
      setSheet(null); setGoalTitle(""); setGoalDate("");
      await load();
      if (openGoal && data) openGoal(data.id);
    } catch (error) { setMessage(humanError(error, "CEAC could not save that change.")); }
    finally { setBusy(false); }
  }

  async function createReminder() {
    setBusy(true); setMessage(null);
    try {
      if (!remindAt) throw new Error("Pick when to be reminded.");
      const { error } = await supabase.from("personal_reminders").insert({
        org_id: me.org_id,
        profile_id: me.id,
        title: remindTitle.trim(),
        remind_at: new Date(remindAt).toISOString(),
      });
      if (error) throw error;
      setSheet(null); setRemindTitle(""); setRemindAt("");
      await load();
    } catch (error) { setMessage(humanError(error, "CEAC could not save that change.")); }
    finally { setBusy(false); }
  }

  async function markReminderSeen(id) {
    setMessage(null);
    const { error } = await supabase.from("personal_reminders").update({ seen_at: new Date().toISOString() }).eq("id", id);
    if (error) { setMessage(humanError(error, "That reminder could not be updated.")); return; }
    await load();
  }

  function openProfile() {
    setMessage(null);
    if (hasProfileReadError) {
      setMessage("Your personal details are not editable until the current profile data has loaded successfully.");
      return;
    }
    setProfileForm({
      preferred_name: profile.preferred_name || "",
      phone: profile.phone || "",
      birthday: profile.birthday || "",
      emergency_contact_name: details.emergency_contact_name || "",
      emergency_contact_phone: details.emergency_contact_phone || "",
      emergency_contact_relationship: details.emergency_contact_relationship || "",
      address_text: details.address_text || "",
      instagram: details.social_handles?.instagram || "",
      linkedin: details.social_handles?.linkedin || "",
    });
    setSheet("profile");
  }

  async function saveProfile() {
    setBusy(true); setMessage(null);
    try {
      const { error } = await supabase.rpc("update_my_personal_details", {
        p_preferred_name: profileForm.preferred_name.trim() || null,
        p_phone: profileForm.phone.trim() || null,
        p_birthday: profileForm.birthday || null,
        p_emergency_contact_name: profileForm.emergency_contact_name.trim() || null,
        p_emergency_contact_phone: profileForm.emergency_contact_phone.trim() || null,
        p_emergency_contact_relationship: profileForm.emergency_contact_relationship.trim() || null,
        p_address_text: profileForm.address_text.trim() || null,
        p_social_handles: {
          instagram: profileForm.instagram.trim(),
          linkedin: profileForm.linkedin.trim(),
        },
      });
      if (error) throw error;
      await load();
      setMessage("Saved. This change is recorded in your profile history.");
    } catch (error) { setMessage(humanError(error, "Your details could not be saved.")); }
    finally { setBusy(false); }
  }

  async function acknowledgeVolunteerNotice(id) {
    setBusy(true); setMessage(null);
    const acknowledgedAt = new Date().toISOString();
    const { error } = await supabase.from("volunteer_engagement_notices")
      .update({ acknowledged_at: acknowledgedAt })
      .eq("id", id)
      .eq("profile_id", me.id);
    setBusy(false);
    if (error) {
      setMessage(humanError(error, "The volunteer notice could not be acknowledged."));
      return;
    }
    setVolunteerNotices((rows) => rows.map((row) => row.id === id ? { ...row, acknowledged_at: acknowledgedAt } : row));
    setMessage("Saved. Your acknowledgement is recorded.");
  }

  const profileItems = [
    profile.preferred_name ? { label: "Preferred name", value: profile.preferred_name } : null,
    { label: "Official name", value: profile.full_name },
    { label: "Email", value: profile.email },
    { label: "Phone", value: profile.phone || "Not added" },
    { label: "Unit", value: me.unit_name || "Not recorded" },
    { label: "Position", value: engagement?.employment_type === "volunteer" ? "Volunteer" : me.is_exec ? "Group Pastor" : me.is_admin ? "Administration & HR" : me.role === "manager" ? "Unit head" : "Staff" },
    profile.joined_at ? { label: "Joined", value: dateOnly(profile.joined_at) } : null,
    profile.birthday ? { label: "Birthday", value: new Date(profile.birthday + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" }) } : null,
  ];

  return <div className={`body ev2-personal-page ev2-personal-hub ${!me.is_admin && !me.is_exec && me.role !== "manager" ? "ev2-personal-staff" : ""}`.trim()}>
    <PersonalPageHeader
      eyebrow={me.unit_name || "CEAC OS"}
      title="My Hub"
      description={`${profile.preferred_name || profile.full_name} · ${profile.job_title || (me.is_exec ? "Group Pastor" : me.is_admin ? "Administration & HR" : "Staff")} · your personal workspace for development, time away, equipment, policies and ordinary profile information.`}
    />

    {message && !sheet ? <ProductNotice tone={message.startsWith("Saved") ? "success" : "error"} title={message.startsWith("Saved") ? "Saved" : "Could not complete that"}>{message}</ProductNotice> : null}

    {!loading && (engagement?.employment_type === "volunteer" || volunteerNotices.length > 0) ? <PersonalSection
      eyebrow="Your CEAC engagement"
      title="Volunteer engagement"
      description="Volunteer is your engagement type; your application experience remains Staff unless explicit authority is separately granted."
    >
      {datasetErrors.engagement ? <ProductNotice tone="attention" title="Engagement record unavailable">{datasetErrors.engagement}</ProductNotice> : <div className="ev2pf-facts">
        <PersonalFact value="Volunteer" label="engagement type" />
        <PersonalFact value={String(engagement?.working_pattern?.kind || "not_recorded").replaceAll("_"," ")} label="working arrangement" />
        <PersonalFact value={engagement?.employment_status || "active"} label="engagement status" />
      </div>}
      {!volunteerNoticesReady ? <ProductNotice tone="attention" title="Volunteer notices come in Stage 2">Your existing engagement record remains visible. Formal in-app volunteer change notices need the separately rehearsed volunteer migration and are not being written to this production database.</ProductNotice>
        : datasetErrors.volunteerNotices ? <ProductNotice tone="attention" title="Change notices unavailable">{datasetErrors.volunteerNotices}</ProductNotice>
        : volunteerNotices.length ? <div className="phase6-volunteer-self-notices">{volunteerNotices.map((notice) => <article key={notice.id}>
            <div>
              <strong>{notice.title}</strong>
              <span>Effective {dateOnly(notice.effective_on)} · {notice.summary}</span>
              <small>{notice.agreement_reference ? `Agreement: ${notice.agreement_reference}` : "No agreement document is attached to this notice."}</small>
            </div>
            {notice.acknowledged_at ? <span className="phase6-notice-ack">Acknowledged {dateOnly(notice.acknowledged_at)}</span>
              : notice.requires_acknowledgement ? <Button size="sm" disabled={busy} onClick={() => acknowledgeVolunteerNotice(notice.id)}>Acknowledge</Button>
              : <span className="phase6-notice-ack">Acknowledgement not required</span>}
          </article>)}</div>
        : <PersonalEmpty title="No volunteer change notices" description="Formal engagement or working-arrangement changes will appear here when recorded." />}
    </PersonalSection> : null}

    <PersonalDestinationGrid>
      <PersonalDestinationCard title="Work history" description="Completed work, feedback and recorded activity by month." ariaLabel="My work history" onClick={() => openRecord?.()} />
      <PersonalDestinationCard title="My achievements" description="Personal monthly and quarterly work contribution reports and PDF." ariaLabel="Open my achievements" onClick={() => onOpenAchievements?.()} />
      {!me.is_admin && !me.is_exec ? <PersonalDestinationCard title="Development" description="Your review evidence, reflection, feedback and development plan." ariaLabel="Reviews & development" onClick={() => openPerformance?.()} /> : null}
      {me.is_exec ? <PersonalDestinationCard title="Assigned appraisals" description="Review only the employee appraisal cases individually assigned to you. Protected HR records and publication decisions remain with independently authorised HR." ariaLabel="My assigned appraisals" onClick={() => openPerformance?.()} /> : null}
      {!me.is_admin && !me.is_exec ? <PersonalDestinationCard title="Time & leave" description="Open your wider Time & Leave workspace. Leave requests and confirmed policy context remain visible in the Leave tab below." ariaLabel="My workforce context" onClick={() => openWorkforce?.()} /> : null}
      {!me.is_admin && !me.is_exec ? <PersonalDestinationCard title="Learning" description="Assigned learning, resources and factual completion history." ariaLabel="Learning" onClick={() => openLearning?.()} /> : null}
      {!me.is_admin && !me.is_exec ? <PersonalDestinationCard title="Equipment" description="CEAC equipment currently in your custody and your recorded custody history." ariaLabel="My assets" onClick={() => openAssets?.()} /> : null}
      {!me.is_admin && !me.is_exec ? <PersonalDestinationCard title="Policies & requirements" description="Policies that apply to you, acknowledgements, evidence and exceptions." ariaLabel="My compliance" onClick={() => openCompliance?.()} /> : null}
    </PersonalDestinationGrid>

    <PersonalTabs value={area} onChange={setArea} />

    {loading ? <div className="ev2pf-loading" aria-label="Loading My Hub" aria-busy="true">
      <Skeleton variant="block" height="8rem" />
      <Skeleton variant="block" height="12rem" />
    </div> : null}

    {!loading && area === "goals" ? <>
      <PersonalSection
        eyebrow="Private to you"
        title="Goals & development"
        description="Your personal goals are not counted in CEAC reports. They remain private planning records."
        action={<Button size="sm" onClick={() => setSheet("goal")} disabled={Boolean(datasetErrors.goals)}>Add goal</Button>}
      >
        {datasetErrors.goals ? <div className="ev2pf-partial-error"><StatePanel state="error" title="Personal goals could not be loaded" description={datasetErrors.goals} actionLabel="Try again" onAction={load} icon="error" /></div>
          : activeGoals.length ? activeGoals.map((goal) => <PersonalRecordRow
              key={goal.id}
              title={goal.title}
              meta={goal.target_date ? `Target ${dateOnly(goal.target_date)}` : "No target date"}
              onClick={() => openGoal?.(goal.id)}
            />)
          : <PersonalEmpty title="No active personal goals" description="Add something you want to develop or accomplish for yourself." />}
        {achievedGoals.length > 0 && !datasetErrors.goals ? <div className="ev2pf-facts"><PersonalFact value={String(achievedGoals.length)} label={achievedGoals.length === 1 ? "goal marked achieved" : "goals marked achieved"} /></div> : null}
      </PersonalSection>

      <PersonalSection
        eyebrow="For yourself"
        title="Reminders"
        description="Private prompts that belong to you and are not organisational performance evidence."
        action={<Button variant="secondary" size="sm" onClick={() => setSheet("remind")} disabled={Boolean(datasetErrors.reminders)}>Add reminder</Button>}
      >
        {datasetErrors.reminders ? <div className="ev2pf-partial-error"><StatePanel state="error" title="Reminders could not be loaded" description={datasetErrors.reminders} actionLabel="Try again" onAction={load} icon="error" /></div>
          : reminders.length ? reminders.map((reminder) => <PersonalRecordRow
              key={reminder.id}
              title={reminder.title}
              meta={new Date(reminder.remind_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              action={<Button variant="quiet" size="sm" onClick={(event) => { event.stopPropagation(); markReminderSeen(reminder.id); }}>Done</Button>}
            />)
          : <PersonalEmpty title="No reminders are waiting" description="Add a private reminder when you want CEAC OS to keep something visible for you." />}
      </PersonalSection>
    </> : null}

    {!loading && area === "leave" ? <PersonalSection
      eyebrow="Time away"
      title="Leave"
      description="Your own request and confirmed-policy context. Manager and Administration decisions remain in Time & Leave."
      action={<div className="ev2pf-inline-actions">
        {!me.is_admin && !me.is_exec && openWorkforce ? <Button variant="secondary" size="sm" onClick={() => openWorkforce()}>Open Time & Leave</Button> : null}
        <Button size="sm" onClick={() => setSheet("leave")} disabled={Boolean(datasetErrors.leaveRequests)}>Ask for leave</Button>
      </div>}
    >
      <ProductNotice tone="info" title="Confirmed annual leave">
        The confirmed 24-day yearly allowance comprises 15 annual-leave days and one shared nine-day sick/study allowance. Each completed quarter earns 3.75 annual days and 2.25 shared days. Joiners receive a pro-rated first completed-quarter credit, and ordinary unused days expire at year end subject to protected exceptions. Every leave request follows Manager approval → Administration final approval.
      </ProductNotice>

      {!annualLeaveStageReady ? <ProductNotice tone="attention" title="Working-day balance comes after migration acceptance">Existing leave requests and the approved request route remain available. CEAC OS will not invent a working-day balance until the annual-leave migration has passed restored-data acceptance and is separately approved.</ProductNotice> : null}

      {annualLeaveStageReady && datasetErrors.annualLeaveSummary ? <ProductNotice tone="attention" title="Annual balance unavailable">{datasetErrors.annualLeaveSummary}</ProductNotice>
        : annualLeft === null ? <ProductNotice tone="info" title="Annual balance needs complete records">{annualBalanceReason === "annual_leave_policy_not_active"
          ? "Administration/HR has not confirmed an active annual leave policy for this date. Your balance will remain unavailable until that policy is confirmed."
          : annualBalanceReason === "join_date_not_recorded"
          ? "Your join date is not recorded yet, so CEAC OS will not invent an annual leave balance."
          : "CEAC OS needs attributable workforce schedule evidence for approved annual leave before it can show a reliable remaining working-day balance."}</ProductNotice>
        : null}

      {datasetErrors.leavePolicy || datasetErrors.leaveRules ? <ProductNotice tone="attention" title="Secondary leave policy unavailable">{datasetErrors.leavePolicy || datasetErrors.leaveRules}</ProductNotice>
        : !secondaryPolicyConfigured ? <ProductNotice tone="info" title="Shared leave allowance not active">The shared sick/study allowance is not active yet. Requests remain available on the confirmed approval route; CEAC OS will not invent a balance. Maternity and paternity requests retain their separate policy treatment.</ProductNotice>
        : null}

      {annualLeaveStageReady && !datasetErrors.annualLeaveSummary ? <div className="ev2pf-facts">
        <PersonalFact value={annualLeft === null ? "—" : String(annualLeft)} label={annualLeft === null ? "annual balance unavailable" : "annual working days available"} />
        <PersonalFact value={annualAccrued === null ? "—" : String(annualAccrued)} label="annual working days accrued" />
        <PersonalFact value={annualEntitlement === null ? "—" : String(annualEntitlement)} label="annual working-day entitlement" />
        <PersonalFact value={sharedLeft === null ? "—" : String(sharedLeft)} label={sharedLeft === null ? "shared sick/study balance unavailable" : "shared sick/study working days available"} />
        <PersonalFact value={sharedLeaveSummary?.accrued_days == null ? "—" : String(sharedLeaveSummary.accrued_days)} label="shared sick/study working days accrued" />
        <PersonalFact value={sharedLeaveSummary?.entitlement_days == null ? "—" : String(sharedLeaveSummary.entitlement_days)} label="shared sick/study yearly entitlement" />
      </div> : null}

      {datasetErrors.leaveRequests ? <div className="ev2pf-partial-error"><StatePanel state="error" title="Leave requests could not be loaded" description={datasetErrors.leaveRequests} actionLabel="Try again" onAction={load} icon="error" /></div>
        : myRequests.length ? myRequests.map((request) => {
          const statusLabel = request.status === "approved" ? "Approved"
            : request.status === "declined" ? "Declined"
            : request.status === "cancelled" ? "Cancelled"
            : request.status === "escalated" ? "With admin"
            : "Waiting";
          const kindLabel = request.kind ? request.kind.charAt(0).toUpperCase() + request.kind.slice(1) : "Leave";
          const dayLabel = ["annual", "sick", "study"].includes(request.kind)
            ? (request.working_days === null || request.working_days === undefined
              ? "Working-day count unavailable"
              : `${request.working_days} working day${Number(request.working_days) === 1 ? "" : "s"}`)
            : (request.days === null || request.days === undefined
              ? "Date span not recorded"
              : `${request.days} calendar-day span`);
          return <PersonalRecordRow
            key={request.id}
            className="leave-request-row"
            title={`${kindLabel} leave`}
            meta={`${dayLabel} · ${dateOnly(request.start_date)} — ${dateOnly(request.end_date)} · ${statusLabel}`}
            action={(request.status === "pending" || request.status === "escalated")
              ? <Button variant="quiet" size="sm" disabled={busy} onClick={() => cancelLeave(request.id)}>Cancel</Button>
              : null}
          />;
        })
        : <PersonalEmpty title="No leave requests recorded" description="Your own requests will remain visible here after they are submitted." />}
    </PersonalSection> : null}

    {!loading && area === "personal" ? <PersonalSection
      eyebrow="Your information"
      title="Personal & employment"
      description="Ordinary profile information only. Official employment/access records remain Administration-owned."
      action={<Button variant="secondary" size="sm" onClick={openProfile} disabled={hasProfileReadError}>Edit personal details</Button>}
    >
      {import.meta.env.VITE_STAGE2_UNIVERSAL_AAL2 === "true" && <ProfilePortraitEditor me={me} />}
      {datasetErrors.profile ? <div className="ev2pf-partial-error"><StatePanel state="error" title="Ordinary profile could not be loaded" description={datasetErrors.profile} actionLabel="Try again" onAction={load} icon="error" /></div>
        : <PersonalDetailGrid items={profileItems} />}
      {datasetErrors.details ? <div className="ev2pf-partial-error"><StatePanel state="error" title="Private contact details could not be loaded" description="Editing is disabled so unseen emergency-contact or address information cannot be overwritten with blanks." actionLabel="Try again" onAction={load} icon="error" /></div> : null}
      <PersonalBoundary title="Protected HR records">
        Ghana Card, SSNIT, tax, banking, contracts, payslips and private documents use a separate protected HR system and are not stored in these ordinary profile details.
      </PersonalBoundary>
      <div className="ev2pf-signout"><Button variant="quiet" onClick={() => supabase.auth.signOut()}>Sign out</Button></div>
    </PersonalSection> : null}

    <ModalDialog
      open={sheet === "goal"}
      onClose={() => !busy && setSheet(null)}
      title="Add a personal goal"
      description="Only you see this. Goal steps remain inside the existing private goal record."
      footer={<>
        <Button variant="secondary" onClick={() => setSheet(null)} disabled={busy}>Cancel</Button>
        <Button busy={busy} onClick={createGoal} disabled={!goalTitle.trim()}>Add goal</Button>
      </>}
    >
      <div className="ev2pf-form-stack">
        <InputField label="Goal" placeholder="What are you aiming for?" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} />
        <InputField label="Target date" help="Optional." type="date" value={goalDate} onChange={(event) => setGoalDate(event.target.value)} />
      </div>
    </ModalDialog>

    <ModalDialog
      open={sheet === "remind"}
      onClose={() => !busy && setSheet(null)}
      title="Add a reminder"
      description="Only you see this reminder."
      footer={<>
        <Button variant="secondary" onClick={() => setSheet(null)} disabled={busy}>Cancel</Button>
        <Button busy={busy} onClick={createReminder} disabled={!remindTitle.trim() || !remindAt}>Set reminder</Button>
      </>}
    >
      <div className="ev2pf-form-stack">
        <InputField label="Reminder" placeholder="What to remind you of" value={remindTitle} onChange={(event) => setRemindTitle(event.target.value)} />
        <InputField label="When" type="datetime-local" value={remindAt} onChange={(event) => setRemindAt(event.target.value)} />
      </div>
    </ModalDialog>

    <Drawer
      open={sheet === "profile"}
      onClose={() => !busy && setSheet(null)}
      title="Edit personal details"
      description="Official employment details remain read-only. Emergency contact and address details are visible only to you and Administration."
      footer={<>
        <Button variant="secondary" onClick={() => setSheet(null)} disabled={busy}>Close</Button>
        <Button busy={busy} onClick={saveProfile}>Save personal details</Button>
      </>}
    >
      <div className="ev2pf-form-stack">
        <div className="ev2pf-form-grid">
          <InputField label="Preferred name" value={profileForm.preferred_name} onChange={(event) => setProfileForm((value) => ({ ...value, preferred_name: event.target.value }))} />
          <InputField label="Phone" type="tel" value={profileForm.phone} onChange={(event) => setProfileForm((value) => ({ ...value, phone: event.target.value }))} />
        </div>
        <InputField label="Birthday" type="date" max={new Date().toISOString().slice(0, 10)} value={profileForm.birthday} onChange={(event) => setProfileForm((value) => ({ ...value, birthday: event.target.value }))} />

        <div className="ev2pf-form-section">
          <strong>Emergency contact</strong>
          <InputField label="Contact name" placeholder="Contact name" value={profileForm.emergency_contact_name} onChange={(event) => setProfileForm((value) => ({ ...value, emergency_contact_name: event.target.value }))} />
          <div className="ev2pf-form-grid">
            <InputField label="Contact phone" type="tel" value={profileForm.emergency_contact_phone} onChange={(event) => setProfileForm((value) => ({ ...value, emergency_contact_phone: event.target.value }))} />
            <InputField label="Relationship" value={profileForm.emergency_contact_relationship} onChange={(event) => setProfileForm((value) => ({ ...value, emergency_contact_relationship: event.target.value }))} />
          </div>
        </div>

        <TextareaField label="Address or ordinary contact information" rows={3} value={profileForm.address_text} onChange={(event) => setProfileForm((value) => ({ ...value, address_text: event.target.value }))} />

        <div className="ev2pf-form-section">
          <strong>Social handles</strong>
          <InputField label="Instagram" placeholder="Username or profile link" value={profileForm.instagram} onChange={(event) => setProfileForm((value) => ({ ...value, instagram: event.target.value }))} />
          <InputField label="LinkedIn" placeholder="Profile link" value={profileForm.linkedin} onChange={(event) => setProfileForm((value) => ({ ...value, linkedin: event.target.value }))} />
        </div>

        {message ? <ProductNotice tone={message.startsWith("Saved") ? "success" : "attention"} title={message.startsWith("Saved") ? "Saved" : "Could not save"}>{message}</ProductNotice> : null}
      </div>
    </Drawer>

    <ModalDialog
      open={sheet === "leave"}
      onClose={() => !busy && setSheet(null)}
      title="Ask for leave"
      description="Your request follows CEAC's existing workforce leave process. Manager and Administration decision controls remain in Time & Leave."
      footer={<>
        <Button variant="secondary" onClick={() => setSheet(null)} disabled={busy}>Cancel</Button>
        <Button busy={busy} onClick={requestLeave} disabled={busy || !startDate || !endDate || endDate < startDate}>Send request</Button>
      </>}
    >
      <div className="ev2pf-form-stack">
        <div className="ev2pf-form-section">
          <strong>Kind of leave</strong>
          <div className="ev2pf-inline-actions">
            {[["annual","Annual"],["sick","Sick"],["maternity","Maternity"],["paternity","Paternity"],["study","Study"]].map(([key, label]) => (
              <Button key={key} variant={kind === key ? "primary" : "secondary"} size="sm" onClick={() => setKind(key)}>{label}</Button>
            ))}
          </div>
        </div>
        <div className="ev2pf-form-grid">
          <InputField label="Leave starts" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <InputField
            label="Leave ends"
            type="date"
            min={startDate || undefined}
            value={endDate}
            error={startDate && endDate && endDate < startDate ? "Leave end date cannot be before the start date." : undefined}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
        <TextareaField label="Reason" help="Optional. Keep it brief." rows={3} placeholder="A short reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <ProductNotice tone="info" title="Working-day handling">
          For Annual leave, CEAC OS counts working days from your attributable workforce schedule when that schedule is complete. It does not guess working-day totals, entitlement or payroll consequences from request dates. It never turns leave or attendance into a Payroll deduction automatically.
        </ProductNotice>
      </div>
    </ModalDialog>
  </div>;
}
