import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ProductNotice } from "../components/bits";
import { dateOnly } from "../lib/time";
import { humanError } from "../lib/productLanguage";
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

export default function Me({ me, openGoal, openRecord, openPerformance, openWorkforce, openLearning, openAssets, openCompliance }) {
  const [profile, setProfile] = useState(me);
  const [leavePolicy, setLeavePolicy] = useState(null);
  const [leavePolicyRules, setLeavePolicyRules] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [goals, setGoals] = useState([]);
  const [reminders, setReminders] = useState([]);
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

  useEffect(() => { load(); }, [me.id]);

  async function load() {
    setLoading(true);

    const [requestsResult, policyResult, goalsResult, remindersResult, detailsResult, profileResult] = await Promise.all([
      supabase.from("leave_requests")
        .select("id, kind, start_date, end_date, days, status, requested_at")
        .eq("profile_id", me.id).order("requested_at", { ascending: false }).limit(100),
      supabase.from("leave_policy_versions")
        .select("*").eq("org_id", me.org_id).eq("state", "active")
        .order("confirmed_at", { ascending: false }).limit(1).maybeSingle(),
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
    ]);

    const errors = {};
    if (requestsResult.error) errors.leaveRequests = humanError(requestsResult.error, "Your leave requests could not load.");
    else setMyRequests(requestsResult.data || []);

    if (policyResult.error) errors.leavePolicy = humanError(policyResult.error, "The confirmed leave policy could not load.");
    else setLeavePolicy(policyResult.data || null);

    if (goalsResult.error) errors.goals = humanError(goalsResult.error, "Your personal goals could not load.");
    else setGoals(goalsResult.data || []);

    if (remindersResult.error) errors.reminders = humanError(remindersResult.error, "Your reminders could not load.");
    else setReminders(remindersResult.data || []);

    if (detailsResult.error) errors.details = humanError(detailsResult.error, "Your private contact details could not load.");
    else setDetails(detailsResult.data || EMPTY_DETAILS);

    if (profileResult.error) errors.profile = humanError(profileResult.error, "Your ordinary profile could not load.");
    else if (profileResult.data) setProfile((value) => ({ ...value, ...profileResult.data }));

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
    setLoading(false);
    return { errors };
  }

  const policyConfigured = Boolean(leavePolicy);
  const annualRule = leavePolicyRules.find((rule) => rule.leave_kind === "annual" && rule.complete);
  const sickRule = leavePolicyRules.find((rule) => rule.leave_kind === "sick" && rule.complete);
  const simpleBalanceRule = (rule) => Boolean(
    rule
    && rule.entitlement_unit === "days"
    && !rule.opening_balance_required
    && (rule.accrual_method === "annual" || rule.accrual_method === "none")
    && rule.carryover_method === "none"
  );
  const annualEntitlement = simpleBalanceRule(annualRule) ? Number(annualRule.entitlement_amount || 0) : null;
  const sickEntitlement = simpleBalanceRule(sickRule) ? Number(sickRule.entitlement_amount || 0) : null;
  const currentYear = new Date().getFullYear();
  const approvedThisYear = myRequests.filter((request) =>
    request.status === "approved" && new Date(request.start_date + "T00:00:00").getFullYear() === currentYear
  );
  const annualTaken = approvedThisYear.filter((request) => request.kind === "annual").reduce((sum, request) => sum + Number(request.days || 0), 0);
  const sickTaken = approvedThisYear.filter((request) => request.kind === "sick").reduce((sum, request) => sum + Number(request.days || 0), 0);
  const annualLeft = annualEntitlement === null ? null : annualEntitlement - annualTaken;
  const sickLeft = sickEntitlement === null ? null : sickEntitlement - sickTaken;
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

  const profileItems = [
    profile.preferred_name ? { label: "Preferred name", value: profile.preferred_name } : null,
    { label: "Official name", value: profile.full_name },
    { label: "Email", value: profile.email },
    { label: "Phone", value: profile.phone || "Not added" },
    { label: "Unit", value: me.unit_name || "Not recorded" },
    { label: "Position", value: me.is_exec ? "Group Pastor" : me.is_admin ? "Administration & HR" : me.role === "manager" ? "Unit head" : "Staff" },
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

    <PersonalDestinationGrid>
      <PersonalDestinationCard title="Work history" description="Completed work, feedback and recorded activity by month." ariaLabel="My work history" onClick={() => openRecord?.()} />
      {!me.is_admin && !me.is_exec ? <PersonalDestinationCard title="Development" description="Your review evidence, reflection, feedback and development plan." ariaLabel="Reviews & development" onClick={() => openPerformance?.()} /> : null}
      {!me.is_admin && !me.is_exec ? <PersonalDestinationCard title="Time & leave" description="Your schedule, recorded work-session context, leave and corrections." ariaLabel="My workforce context" onClick={() => openWorkforce?.()} /> : null}
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
      {datasetErrors.leavePolicy || datasetErrors.leaveRules ? <ProductNotice tone="attention" title="Leave policy unavailable">{datasetErrors.leavePolicy || datasetErrors.leaveRules}</ProductNotice>
        : !policyConfigured ? <ProductNotice tone="attention" title="Leave policy not configured">Your requests remain available, but CEAC OS will not invent leave entitlement or remaining-day figures.</ProductNotice>
        : (annualLeft === null || sickLeft === null) ? <ProductNotice tone="info" title="Some balances are unavailable">A confirmed policy exists, but CEAC OS only calculates a remaining balance when the relevant rule has explicit day entitlement, a supported accrual method, no carry-over, and no unresolved opening-balance requirement.</ProductNotice>
        : null}

      {!datasetErrors.leavePolicy && !datasetErrors.leaveRules ? <div className="ev2pf-facts">
        <PersonalFact value={annualLeft === null ? "—" : String(annualLeft)} label={annualLeft === null ? "annual balance unavailable" : "annual days left"} />
        <PersonalFact value={sickLeft === null ? "—" : String(sickLeft)} label={sickLeft === null ? "sick balance unavailable" : "sick days left"} />
      </div> : null}

      {datasetErrors.leaveRequests ? <div className="ev2pf-partial-error"><StatePanel state="error" title="Leave requests could not be loaded" description={datasetErrors.leaveRequests} actionLabel="Try again" onAction={load} icon="error" /></div>
        : myRequests.length ? myRequests.map((request) => {
          const statusLabel = request.status === "approved" ? "Approved"
            : request.status === "declined" ? "Declined"
            : request.status === "cancelled" ? "Cancelled"
            : request.status === "escalated" ? "With admin"
            : "Waiting";
          const kindLabel = request.kind ? request.kind.charAt(0).toUpperCase() + request.kind.slice(1) : "Leave";
          const dayLabel = request.days === null || request.days === undefined
            ? "Day count not recorded"
            : `${request.days} recorded day${Number(request.days) === 1 ? "" : "s"}`;
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
        <ProductNotice tone="info" title="Dates only">
          CEAC OS sends the dates you choose to the existing workforce leave process. It does not guess working-day totals, entitlement or payroll consequences here.
        </ProductNotice>
      </div>
    </ModalDialog>
  </div>;
}
