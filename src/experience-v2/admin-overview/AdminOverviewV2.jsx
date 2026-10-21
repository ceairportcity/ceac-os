import DailyScenicPhoto from "../../components/DailyScenicPhoto";
import EmployeeWorkSession from "../../components/EmployeeWorkSession";
import AdminWorkforceToday from "../../components/AdminWorkforceToday";
import { useState } from "react";
import {
  Button,
  DataPanel,
  ProgressDistribution,
  QueueRow,
  Skeleton,
  StatePanel,
  StatTile,
  StatusBadge,
  Surface,
} from "../components";
import { CeacIcon } from "../icons";
import { dueLabel } from "../../lib/time";

function formatDate(value, options = {}) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    day: "numeric",
    month: "short",
    ...options,
  });
}

function AdminCalendarRail({ meetings }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
  const now = new Date();
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
  const weekdayOffset = (month.getUTCDay() + 6) % 7;
  const monthTitle = new Intl.DateTimeFormat("en-GB", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(month);
  const isoDate = (date) => date.toISOString().slice(0, 10);
  const validMeetingTime = (item) => item?.starts_at && Number.isFinite(Date.parse(item.starts_at));
  const meetingDays = new Set(meetings.filter(validMeetingTime).map((item) => isoDate(new Date(item.starts_at))));
  const selectedMeetings = meetings.filter((item) => validMeetingTime(item) && isoDate(new Date(item.starts_at)) === selectedDay);
  const todayIso = isoDate(now);
  const through = isoDate(new Date(now.getTime() + 14 * 86400000));
  const withinLoadedWindow = selectedDay >= todayIso && selectedDay <= through;
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), index - weekdayOffset + 1));
    return {
      date: isoDate(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month.getUTCMonth(),
    };
  });
  return <div className="adminv2-mini-calendar" aria-label="Administration calendar context">
    <div className="adminv2-calendar-title">
      <strong>{monthTitle}</strong>
      <div className="adminv2-calendar-controls">
        <button type="button" aria-label="Previous month" onClick={() => setMonthOffset((x) => x - 1)}>‹</button>
        <button type="button" aria-label="Show current month" onClick={() => { setMonthOffset(0); setSelectedDay(todayIso); }}>Today</button>
        <button type="button" aria-label="Next month" onClick={() => setMonthOffset((x) => x + 1)}>›</button>
      </div>
    </div>
    <div className="adminv2-calendar-weekdays" aria-hidden="true">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
    </div>
    <div className="adminv2-calendar-days" role="group" aria-label={monthTitle}>
      {days.map((day) => <button type="button"
        key={day.date}
        className={["adminv2-calendar-day", day.inMonth ? "" : "is-outside", day.date === selectedDay ? "is-selected" : "", day.date === todayIso ? "is-today" : ""].filter(Boolean).join(" ")}
        aria-label={day.date}
        aria-pressed={day.date === selectedDay}
        onClick={() => { setSelectedDay(day.date); if(!day.inMonth) setMonthOffset((x) => x + (day.date < isoDate(month) ? -1 : 1)); }}
      >
        <span>{day.day}</span>{meetingDays.has(day.date) && <i aria-hidden="true" />}
      </button>)}
    </div>
    <div className="adminv2-calendar-selection" role="status">
      <strong>{new Intl.DateTimeFormat("en-GB", {weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(selectedDay+"T00:00:00Z"))}</strong>
      <span>{!withinLoadedWindow
        ? "This calendar previews at most six upcoming meetings within the next 14 days."
        : selectedMeetings.length
          ? `${selectedMeetings.length} recorded meeting${selectedMeetings.length === 1 ? "" : "s"}`
          : "No meeting is shown for this date in the limited upcoming preview."}</span>
    </div>
  </div>;
}

function Count({ value, tone = "neutral" }) {
  return <span className={`adminv2-count is-${tone}`}>{value}</span>;
}

function Quiet({ icon = "checkCircle", children }) {
  return <div className="adminv2-quiet">
    <CeacIcon name={icon} size="row" decorative />
    <span>{children}</span>
  </div>;
}

function Notice({ tone = "attention", title, children }) {
  const icon = tone === "error" ? "error" : tone === "success" ? "checkCircle" : "warning";
  return <Surface variant="soft" padding="standard" className={`adminv2-notice is-${tone}`} role={tone === "error" ? "alert" : "status"}>
    <CeacIcon name={icon} size="row" decorative />
    <div><strong>{title}</strong>{children ? <span>{children}</span> : null}</div>
  </Surface>;
}

function AdminActionRow({ icon, title, meta, status, statusTone = "warning", children, onClick }) {
  const Main = onClick ? "button" : "div";
  return <div className="adminv2-action-row">
    <Main type={onClick ? "button" : undefined} className={`adminv2-action-main${onClick ? " is-interactive" : ""}`} onClick={onClick}>
      <span className="adminv2-row-icon"><CeacIcon name={icon} size="row" decorative /></span>
      <span className="adminv2-action-copy">
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
      </span>
      {status ? <StatusBadge tone={statusTone}>{status}</StatusBadge> : null}
      {onClick ? <CeacIcon name="chevronRight" size="meta" decorative /> : null}
    </Main>
    {children ? <div className="adminv2-action-buttons">{children}</div> : null}
  </div>;
}

function SetupRow({ icon, title, meta, status, statusTone = "warning", actionLabel, onAction }) {
  return <div className="adminv2-setup-row">
    <span className="adminv2-row-icon"><CeacIcon name={icon} size="row" decorative /></span>
    <span className="adminv2-action-copy">
      <strong>{title}</strong>
      {meta ? <small>{meta}</small> : null}
    </span>
    {status ? <StatusBadge tone={statusTone}>{status}</StatusBadge> : null}
    {actionLabel && onAction ? <Button variant="quiet" size="compact" onClick={onAction}>{actionLabel}</Button> : null}
  </div>;
}

function UnitRow({ unit, onInvite }) {
  const pending = !unit.head && unit.pending;
  const missing = !unit.head && !unit.pending;
  const meta = unit.head
    ? `${unit.head.full_name} · ${unit.done7} finished output${unit.done7 === 1 ? "" : "s"} in the last 7 days`
    : pending
      ? `Account invitation pending for ${unit.pending.email} · ${unit.done7} finished output${unit.done7 === 1 ? "" : "s"} in the last 7 days`
      : `${unit.done7} finished output${unit.done7 === 1 ? "" : "s"} in the last 7 days`;

  return <div className="adminv2-unit-row">
    <span className="adminv2-row-icon"><CeacIcon name="organisation" size="row" decorative /></span>
    <span className="adminv2-action-copy">
      <strong>{unit.name}</strong>
      <small>{meta}</small>
    </span>
    <StatusBadge tone={missing ? "warning" : pending ? "action" : "success"}>
      {missing ? "No Unit Head" : pending ? "Invitation pending" : unit.alerts ? `${unit.alerts} open alert${unit.alerts === 1 ? "" : "s"}` : "Head assigned"}
    </StatusBadge>
    <Button variant="quiet" size="compact" onClick={() => onInvite?.(unit)}>Add staff</Button>
  </div>;
}

export default function AdminOverviewV2({
  me,
  dateLabel,
  loading,
  loadFailed,
  message,
  busy,
  units = [],
  alerts = [],
  blockers = [],
  leaveQueue = [],
  checks = [],
  mine = [],
  office,
  today,
  delivery,
  reporting,
  watch = [],
  meetings = [],
  employeeRoster = [],
  dailySessionRows = [],
  pendingInvitations = [],
  payrollReadiness = null,
  canManagePeople,
  canUsePayroll = false,
  canAccessProtectedHR = false,
  onRetry,
  onOpenItem,
  onOpenMeeting,
  onScheduleMeeting,
  onOpenSettings,
  onOpenUnits,
  onOpenWorkflows,
  onOpenReports,
  onOpenFinance,
  onOpenPeople,
  onOpenPerson,
  onOpenInvitations,
  onOpenProtectedHR,
  onOpenPayroll,
  onOpenProjects,
  onOpenStrategy,
  onOpenAttendance,
  onLeaveDecision,
}) {
  const decisionCount = alerts.length + leaveQueue.length + checks.length;
  const headlessUnits = units.filter((unit) => !unit.head);
  const setupCount = (office ? 0 : 1) + headlessUnits.length;
  const deliveryAttention = watch.length + blockers.length;
  const reportingGap = reporting?.missing?.length || 0;
  const identityReviewCount = employeeRoster.filter((person) => person.identity_state === "needs_review").length;
  const peopleAttention = employeeRoster.filter((person) =>
    person.identity_state === "needs_review"
    || person.employment_type === "not_recorded"
    || !(person.job_title || person.source_position)
    || !(person.units || []).length
  ).length;
  const payrollAttention = canUsePayroll && payrollReadiness
    ? Number(payrollReadiness.compensation_missing_count || 0)
      + Number(payrollReadiness.payment_missing_count || 0)
      + Number(payrollReadiness.identity_review_count || 0)
    : 0;
  const onboardingAttention = pendingInvitations.length;
  const expiredInvitationCount = pendingInvitations.filter((invitation) =>
    invitation.expires_at && Date.parse(invitation.expires_at) <= Date.now()).length;
  const reportingAttention = reportingGap;
  const totalAttention = decisionCount + onboardingAttention + peopleAttention + payrollAttention + deliveryAttention + reportingAttention;
  const adminFirstName = String(me?.full_name || "").trim().split(/\s+/)[0] || "there";
  const accraHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone:"Africa/Accra", hour:"2-digit", hourCycle:"h23" }).format(new Date()));
  const greeting = accraHour < 12 ? "Good morning" : accraHour < 17 ? "Good afternoon" : "Good evening";
  const nextMeetings = [...meetings]
    .filter((meeting) => meeting.starts_at && new Date(meeting.starts_at).getTime() >= Date.now())
    .sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at))
    .slice(0, 3);
  // Suggested next step is a navigation aid only: no automatic approval,
  // invented urgency, work ranking or additional authority is created.
  const suggestedAction = leaveQueue.length
    ? {
      eyebrow: "Leave decision waiting",
      title: `${leaveQueue[0].requester?.full_name || "Team member"} · ${leaveQueue[0].kind} leave`,
      detail: "Open Time & Leave to review the recorded request and supporting context.",
      action: onOpenAttendance,
      label: "Review request",
    }
    : checks.length
      ? {
        eyebrow: "Operational check",
        title: `${checks.length} check${checks.length === 1 ? "" : "s"} waiting for review`,
        detail: "Open the workflow queue; decisions remain subject to the existing CEAC approval rules.",
        action: onOpenWorkflows,
        label: "Review checks",
      }
      : pendingInvitations.length && canManagePeople
        ? {
          eyebrow: "Onboarding",
          title: `${pendingInvitations.length} Staff invitation${pendingInvitations.length === 1 ? "" : "s"} need follow-up`,
          detail: expiredInvitationCount
            ? `${expiredInvitationCount} activation link${expiredInvitationCount === 1 ? " has" : "s have"} expired. Review before resending.`
            : "Continue account onboarding through the authorised People & Access workspace.",
          action: onOpenInvitations,
          label: "Open invitations",
        }
        : mine.length
          ? {
            eyebrow: "Your work",
            title: mine[0].title || "Open work item",
            detail: `Recorded work · ${dueLabel(mine[0].due_at)}`,
            action: () => onOpenItem?.(mine[0].id),
            label: "Open work",
          }
          : null;
  const objectiveTotal = Number(delivery?.objectives || 0);
  const objectiveItems = [
    ["Met", delivery?.met || 0],
    ["On track", delivery?.onTrack || 0],
    ["At risk", delivery?.atRisk || 0],
    ["Not met", delivery?.notMet || 0],
    ["Other", delivery?.other || 0],
  ].filter(([, value]) => value > 0)
    .map(([label, value]) => ({
      label,
      value,
      percent: objectiveTotal ? (Number(value) / objectiveTotal) * 100 : 0,
    }));

  return <div className="body admin-home">
    <div className="adminv2">
      <header className="adminv2-intro adminv2-hero s2-landscape-hero" role="region" aria-label="Administration daily briefing"><DailyScenicPhoto />
        <div className="adminv2-hero-main">
          <div className="adminv2-context"><span>Administration &amp; HR</span><time>{dateLabel}</time></div>
          <div className="adminv2-intro-row">
            <div className="adminv2-hero-title">
              <span className="adminv2-eyebrow">Your CEAC workspace</span>
              <h1>{greeting}, {adminFirstName}<span className="adminv2-greeting-mark">.</span></h1>
              <p>{loading
                ? "Loading your recorded Administration priorities…"
                : loadFailed
                  ? "The latest Administration priorities could not be verified. Retry the connection before making decisions."
                  : totalAttention
                    ? `You have ${totalAttention} recorded item${totalAttention === 1 ? "" : "s"} to review. Start with what needs a decision, then move the work forward.`
                    : "Your decision inbox is clear. Keep the people, work and organisation moving forward."}</p>
            </div>
          </div>
          <div className="adminv2-intro-actions">
            <a className="adminv2-hero-link" href="#admin-operational-inbox">Review your inbox <CeacIcon name="chevronRight" size="meta" decorative /></a>
            {canManagePeople ? <Button icon="people" variant="secondary" onClick={onOpenPeople}>People &amp; Access</Button> : null}
            <Button icon="control" variant="secondary" onClick={onOpenSettings}>Control Center</Button>
          </div>
        </div>
        <aside className="adminv2-hero-agenda" aria-label="Upcoming commitments">
          <AdminCalendarRail meetings={meetings} />
          <div className="adminv2-agenda-heading">
            <span><CeacIcon name="calendar" size="row" decorative /> Coming up</span>
            <button type="button" onClick={() => onScheduleMeeting?.({ scope: "organisation", organisation: true })} className="adminv2-agenda-add">Schedule <CeacIcon name="chevronRight" size="meta" decorative /></button>
          </div>
          {loadFailed ? <div className="adminv2-agenda-empty" role="status">Current meeting information could not be verified.</div>
            : loading ? <div className="adminv2-agenda-empty">Loading your schedule…</div> : nextMeetings.length
            ? <div className="adminv2-agenda-list">
              {nextMeetings.map((meeting) => <button type="button" key={meeting.id} className="adminv2-agenda-item" onClick={() => onOpenMeeting?.(meeting.id)}>
                <span className="adminv2-agenda-date">{formatDate(meeting.starts_at, {weekday:"short",hour:"2-digit",minute:"2-digit"})}</span>
                <strong>{meeting.title}</strong>
                <CeacIcon name="chevronRight" size="meta" decorative />
              </button>)}
            </div>
            : <div className="adminv2-agenda-empty">No upcoming meetings were returned in this limited 14-day preview.</div>}
          {!loading && !loadFailed ? <div className="adminv2-agenda-foot">
            <span><strong>{pendingInvitations.length}</strong> invitations need follow-up</span>
            <span><strong>{leaveQueue.length}</strong> leave decisions</span>
          </div> : null}
        </aside>
      </header>
      <EmployeeWorkSession me={me} />

      {loadFailed ? <StatePanel
        state="error"
        title="Administration could not finish loading"
        description={loadFailed}
        actionLabel="Try again"
        onAction={onRetry}
      /> : null}

      {message ? <Notice tone={/sent|saved|done/i.test(message) ? "success" : "attention"} title="Administration update">{message}</Notice> : null}

      {loading ? <div className="adminv2-loading" role="status" aria-live="polite" aria-busy="true" aria-label="Loading Administration Overview">
        <Surface variant="plain" padding="standard"><Skeleton width="34%" /><Skeleton width="92%" /><Skeleton width="76%" /></Surface>
        <Surface variant="plain" padding="standard"><Skeleton width="30%" /><Skeleton width="100%" /><Skeleton width="80%" /></Surface>
        <Surface variant="plain" padding="standard"><Skeleton width="38%" /><Skeleton width="95%" /><Skeleton width="72%" /></Surface>
      </div> : null}

      {!loading && !loadFailed ? <main className="adminv2-main">
        <section className="adminv2-focus-strip" aria-label="Next useful Administration step">
          <div className="adminv2-focus-summary">
            <span className="adminv2-focus-icon"><CeacIcon name={suggestedAction ? "notification" : "checkCircle"} size="feature" decorative /></span>
            <div>
              <span className="adminv2-focus-eyebrow">{suggestedAction?.eyebrow || "Decision inbox clear"}</span>
              <h2>{suggestedAction?.title || "You are up to date on recorded Administration decisions."}</h2>
              <p>{suggestedAction?.detail || "Keep an eye on your people, work and the next recorded commitments."}</p>
            </div>
            {suggestedAction?.action ? <Button icon="arrowRight" onClick={suggestedAction.action}>{suggestedAction.label}</Button> : null}
          </div>
          <div className="adminv2-focus-metrics" aria-label="Recorded organisation context">
            <span><strong>{employeeRoster.length}</strong><small>Employees recorded</small></span>
            <span><strong>{reporting ? `${reporting.submitted}/${reporting.total}` : "—"}</strong><small>Reports submitted</small></span>
          </div>
        </section>
        <section className="adminv2-command-grid" aria-label="Administration actions and setup">
          <DataPanel
            className="adminv2-panel adminv2-inbox"
            id="admin-operational-inbox"
            eyebrow="Operational inbox"
            title="Needs Administration"
            supporting="Decisions, onboarding follow-up and checks that require Administration authority. Unit-level daily management stays with managers."
            action={<Count value={decisionCount} tone={decisionCount ? "attention" : "success"} />}
          >
            {decisionCount === 0 ? <Quiet>Nothing currently requires an Administration decision.</Quiet> : null}

            {checks.length ? <AdminActionRow
              icon="control"
              title={`Checks · ${checks.length} waiting`}
              meta={`Oldest waiting since ${formatDate(checks[0].created_at)}`}
              status="Open checks"
              statusTone="warning"
              onClick={onOpenWorkflows}
            /> : null}

            {pendingInvitations.length && canManagePeople ? <AdminActionRow
              icon="people"
              title={`Staff invitations to review · ${pendingInvitations.length}`}
              meta={expiredInvitationCount ? `${expiredInvitationCount} activation link${expiredInvitationCount === 1 ? " has" : "s have"} expired. Check before resending.` : "Activation is outstanding. Reconcile existing identities rather than inviting again."}
              status="Onboarding"
              statusTone="action"
              onClick={onOpenInvitations}
            /> : null}

            {leaveQueue.map((request) => <AdminActionRow
              key={request.id}
              icon="time"
              title={`${request.requester?.full_name || "Team member"} · ${request.days} day${Number(request.days) === 1 ? "" : "s"} ${request.kind} leave`}
              meta={`${request.start_date} → ${request.end_date} · ${request.status === "escalated" ? "Escalated by manager" : "Waiting for Administration"}`}
              status="Decision"
              statusTone="warning"
            >
              <Button variant="secondary" size="compact" disabled={busy} onClick={() => onLeaveDecision?.(request, "declined")}>Decline</Button>
              <Button size="compact" disabled={busy} onClick={() => onLeaveDecision?.(request, "approved")}>Approve</Button>
            </AdminActionRow>)}

            {alerts.map((alert) => <AdminActionRow
              key={alert.id}
              icon="notification"
              title={alert.message}
              meta={`Since ${formatDate(alert.first_seen_at)}`}
              status="Alert"
              statusTone="warning"
              onClick={alert.subject_type === "work_item" && alert.subject_id ? () => onOpenItem?.(alert.subject_id) : undefined}
            />)}
          </DataPanel>

          <div className="adminv2-mobile-actions" aria-label="Administration shortcuts">
            <a className="adminv2-hero-link" href="#admin-operational-inbox">Review your inbox <CeacIcon name="chevronRight" size="meta" decorative /></a>
            {canManagePeople ? <Button icon="people" variant="secondary" onClick={onOpenPeople}>Open People &amp; Access</Button> : null}
            <Button icon="control" onClick={onOpenSettings}>Control Center</Button>
          </div>

          <DataPanel
            className="adminv2-panel adminv2-setup adminv2-people"
            eyebrow="People & HR"
            title="Employee records"
            supporting="The employee roster is independent from login identity. Missing employment facts stay explicitly unrecorded until Administration confirms them."
            action={<Count value={peopleAttention} tone={peopleAttention ? "attention" : "success"} />}
          >
            <div className="adminv2-stat-grid is-four">
              <StatTile label="Employees" value={employeeRoster.length} supporting="Roster records" icon="people" tone="action" onClick={canManagePeople ? onOpenPeople : undefined} />
              <StatTile label="Invitations to review" value={pendingInvitations.length} supporting={expiredInvitationCount ? `${expiredInvitationCount} expired` : "Awaiting activation"} icon="notification" tone={pendingInvitations.length ? "action" : "neutral"} onClick={canManagePeople ? onOpenInvitations : undefined} />
              <StatTile label="Identity review" value={identityReviewCount} supporting="Needs confirmation" icon="warning" tone={identityReviewCount ? "warning" : "neutral"} onClick={canManagePeople ? onOpenPeople : undefined} />
              <StatTile label="Needs attention" value={peopleAttention} supporting="Recorded gaps" icon="notification" tone={peopleAttention ? "warning" : "neutral"} onClick={canManagePeople ? onOpenPeople : undefined} />
            </div>
            <div className="adminv2-panel-foot">
              {canManagePeople ? <Button variant="quiet" size="compact" onClick={onOpenPeople}>Open People &amp; Access</Button> : null}
              {canAccessProtectedHR ? <Button variant="quiet" size="compact" onClick={onOpenProtectedHR}>Protected HR</Button> : null}
            </div>
          </DataPanel>
        </section>

        <AdminWorkforceToday roster={employeeRoster} sessions={dailySessionRows} onOpenPeople={onOpenPeople} onOpenPerson={onOpenPerson} />

        <section className="adminv2-context-grid" aria-label="People operations">
          <DataPanel
            className="adminv2-panel adminv2-workforce"
            eyebrow="Time & Leave"
            title="Today and leave context"
            supporting="Recorded sessions and confirmed leave are operational context only. No work session is not an absence and never creates a Payroll deduction."
          >
            <div className="adminv2-stat-grid is-four">
              <StatTile label="Open work sessions" value={today?.working || 0} supporting="Not verified live presence" icon="people" tone="neutral" onClick={onOpenAttendance} />
              <StatTile label="Approved leave" value={today?.leave || 0} supporting="Today" icon="time" tone="action" onClick={onOpenAttendance} />
              <StatTile label="No session" value={today?.notStarted || 0} supporting="Not absence" icon="pending" tone="neutral" onClick={onOpenAttendance} />
              <StatTile label="Active accounts" value={today?.headcount || 0} supporting="Login profiles, not the full employee roster" icon="people" tone="neutral" onClick={canManagePeople ? onOpenPeople : undefined} />
            </div>
          </DataPanel>
          <DataPanel
            className="adminv2-panel adminv2-payroll"
            eyebrow="Payroll"
            title="Payroll readiness"
            supporting="Administration prepares. Group Pastor / CEO approves. Missing salary, payment or identity values remain factual gaps and never become inferred values."
            action={canUsePayroll ? <Count value={payrollAttention} tone={payrollAttention ? "attention" : "success"} /> : null}
          >
            {canUsePayroll && payrollReadiness ? <div className="adminv2-stat-grid is-four">
              <StatTile label="Employees" value={payrollReadiness.employee_count || 0} supporting="Draft population" icon="people" tone="neutral" onClick={onOpenPayroll} />
              <StatTile label="Salary record gaps" value={payrollReadiness.compensation_missing_count || 0} supporting="Not recorded" icon="finance" tone={payrollReadiness.compensation_missing_count ? "warning" : "neutral"} onClick={onOpenPayroll} />
              <StatTile label="Payment detail gaps" value={payrollReadiness.payment_missing_count || 0} supporting="Not recorded" icon="record" tone={payrollReadiness.payment_missing_count ? "warning" : "neutral"} onClick={onOpenPayroll} />
              <StatTile label="Identity review" value={payrollReadiness.identity_review_count || 0} supporting="Needs confirmation" icon="warning" tone={payrollReadiness.identity_review_count ? "warning" : "neutral"} onClick={onOpenPayroll} />
            </div> : <Quiet icon="finance">{canUsePayroll ? "Payroll readiness is not available right now." : "Payroll readiness requires Payroll authority."}</Quiet>}
            {canUsePayroll ? <div className="adminv2-panel-foot"><Button variant="quiet" size="compact" onClick={onOpenPayroll}>Open Payroll</Button></div> : null}
          </DataPanel>
        </section>

        <section className="adminv2-context-grid">
          <DataPanel
            className="adminv2-panel adminv2-reporting"
            eyebrow="Finance & reporting"
            title="Finance & reporting"
            supporting="Reporting shows submission presence only. Financial records remain in Finance and currencies stay separate."
            action={<div className="adminv2-panel-actions"><Button variant="quiet" size="compact" onClick={onOpenReports}>Reports</Button><Button variant="quiet" size="compact" onClick={onOpenFinance}>Finance</Button></div>}
          >
            {!reporting ? <Quiet icon="reports">No reporting period is open right now.</Quiet> : <>
              <div className="adminv2-reporting-head">
                <div><span>Open period</span><strong>{reporting.label}</strong></div>
                <StatusBadge tone={reportingGap ? "warning" : "success"}>{reporting.submitted}/{reporting.total} submitted</StatusBadge>
              </div>
              <ProgressDistribution items={[{
                label: "Units submitted",
                value: `${reporting.submitted}/${reporting.total}`,
                percent: reporting.total ? (reporting.submitted / reporting.total) * 100 : 0,
              }]} />
              {reporting.missing.length ? <div className="adminv2-missing">
                <span>Outstanding units</span>
                <div>{reporting.missing.map((unit) => <span key={unit.id}>{unit.name}</span>)}</div>
              </div> : <Quiet>Every unit is in for this period.</Quiet>}
            </>}
          </DataPanel>

          <DataPanel
            className="adminv2-panel adminv2-config-bridge"
            eyebrow="Durable configuration"
            title="Control Center"
            supporting="Organisation structure, office configuration, authority and system settings live in one deliberate configuration workspace — not on the operational Overview."
            action={<Count value={setupCount} tone={setupCount ? "attention" : "success"} />}
          >
            <div className="adminv2-config-summary">
              <CeacIcon name={setupCount ? "warning" : "checkCircle"} size="feature" decorative />
              <div>
                <strong>{setupCount ? `${setupCount} organisation configuration item${setupCount === 1 ? "" : "s"} need review` : "Core organisation configuration is recorded"}</strong>
                <span>{setupCount ? "Review the authoritative settings in Control Center." : "Use Control Center when a durable organisation setting needs to change."}</span>
              </div>
            </div>
            <div className="adminv2-panel-foot">
              <Button variant="quiet" size="compact" onClick={onOpenSettings}>Open Control Center</Button>
              <Button variant="quiet" size="compact" onClick={onOpenUnits}>Units</Button>
            </div>
          </DataPanel>
        </section>

        <section className="adminv2-context-grid">
          <DataPanel
            className="adminv2-panel adminv2-pulse"
            eyebrow="Organisation pulse"
            title="Projects and objectives"
            supporting="Recorded movement and objective states only."
            action={<div className="adminv2-panel-actions">
              <Button variant="quiet" size="compact" onClick={onOpenProjects}>Projects</Button>
              <Button variant="quiet" size="compact" onClick={onOpenStrategy}>Objectives</Button>
            </div>}
          >
            <div className="adminv2-stat-grid is-four">
              <StatTile label="Active projects" value={delivery?.active || 0} supporting="Recorded" icon="projects" tone="action" onClick={onOpenProjects} />
              <StatTile label="Closed" value={delivery?.closedThisMonth || 0} supporting="This month" icon="checkCircle" tone="success" onClick={onOpenProjects} />
              <StatTile label="Objectives" value={objectiveTotal} supporting="Recorded" icon="goal" tone="neutral" onClick={onOpenStrategy} />
              <StatTile label="At risk" value={delivery?.atRisk || 0} supporting="Recorded state" icon="warning" tone={delivery?.atRisk ? "warning" : "neutral"} onClick={onOpenStrategy} />
            </div>
            {objectiveItems.length ? <div className="adminv2-progress-wrap">
              <span className="adminv2-subhead">Objective status</span>
              <ProgressDistribution items={objectiveItems} />
            </div> : <Quiet icon="goal">No objective status records are available.</Quiet>}
          </DataPanel>

          <DataPanel
            className="adminv2-panel adminv2-delivery"
            eyebrow="Cross-unit attention"
            title="Delivery signals"
            supporting="Recorded rules and blockers are signals for review, not conclusions about performance."
            action={<Count value={deliveryAttention} tone={deliveryAttention ? "attention" : "success"} />}
          >
            {deliveryAttention === 0 ? <Quiet>No rule-based delivery signal or cross-unit blocker needs attention.</Quiet> : null}
            {watch.map((row) => <AdminActionRow
              key={row.k}
              icon="warning"
              title={row.who}
              meta={row.why}
              status="Recorded signal"
              statusTone="warning"
            />)}
            {blockers.map((blocker) => <AdminActionRow
              key={blocker.id}
              icon="work"
              title={blocker.work_items?.title || "Cross-unit blocker"}
              meta={`${blocker.claimant?.full_name || "Someone"} waiting on ${blocker.units?.name || blocker.party_text}`}
              status="Cross-unit blocker"
              statusTone="warning"
              onClick={blocker.work_items ? () => onOpenItem?.(blocker.work_items.id) : undefined}
            />)}
          </DataPanel>
        </section>

        <section className="adminv2-support-grid">
          <DataPanel
            className="adminv2-panel adminv2-meetings"
            eyebrow="Next 14 days"
            title="Meetings"
            action={<Button variant="quiet" size="compact" onClick={() => onScheduleMeeting?.({ scope: "organisation", organisation: true })}>Schedule</Button>}
          >
            {meetings.length ? meetings.slice(0, 4).map((meeting) => <QueueRow
              key={meeting.id}
              icon="meeting"
              title={meeting.title}
              meta={formatDate(meeting.starts_at, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
              status={meeting.provider === "zoom" ? "Zoom" : "Meeting"}
              statusTone="action"
              onClick={() => onOpenMeeting?.(meeting.id)}
            />) : <Quiet icon="calendar">No upcoming meeting appears in this limited 14-day preview.</Quiet>}
          </DataPanel>

          {mine.length ? <DataPanel
            className="adminv2-panel"
            eyebrow="Personal"
            title="Your own work"
            action={<Count value={mine.length} />}
          >
            {mine.map((item) => <QueueRow
              key={item.id}
              icon="work"
              title={item.title}
              meta={`${item.ref} · ${dueLabel(item.due_at)}`}
              status={item.status?.replaceAll("_", " ")}
              statusTone="action"
              onClick={() => onOpenItem?.(item.id)}
            />)}
          </DataPanel> : null}

        </section>
      </main> : null}
    </div>
  </div>;
}
