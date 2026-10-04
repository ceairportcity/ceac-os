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
      ? `Invitation sent to ${unit.pending.email} · ${unit.done7} finished output${unit.done7 === 1 ? "" : "s"} in the last 7 days`
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
    {missing ? <Button variant="quiet" size="compact" onClick={() => onInvite?.(unit)}>Invite staff</Button> : null}
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
  onOpenProtectedHR,
  onOpenPayroll,
  onOpenProjects,
  onOpenStrategy,
  onOpenAttendance,
  onInviteUnit,
  onLeaveDecision,
}) {
  const decisionCount = alerts.length + leaveQueue.length + checks.length;
  const headlessUnits = units.filter((unit) => !unit.head);
  const setupCount = (office ? 0 : 1) + headlessUnits.length;
  const deliveryAttention = watch.length + blockers.length;
  const reportingGap = reporting?.missing?.length || 0;
  const rosterOnlyCount = employeeRoster.filter((person) => person.identity_state === "roster_only").length;
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
  const totalAttention = decisionCount + setupCount + peopleAttention + payrollAttention;
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
      <header className="adminv2-intro">
        <div className="adminv2-context"><span>Administration &amp; HR</span><time>{dateLabel}</time></div>
        <div className="adminv2-intro-row">
          <div>
            <h1>Administration</h1>
            <p>{totalAttention
              ? `${totalAttention} recorded item${totalAttention === 1 ? "" : "s"} need Administration attention or configuration.`
              : "No Administration decision or configuration gap is waiting right now."}</p>
          </div>
          <div className="adminv2-intro-actions">
            {canManagePeople ? <Button icon="people" variant="secondary" onClick={onOpenPeople}>Open People</Button> : null}
            <Button icon="control" onClick={onOpenSettings}>Control Center</Button>
          </div>
        </div>
      </header>

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
        <section className="adminv2-command-grid" aria-label="Administration actions and setup">
          <DataPanel
            className="adminv2-panel adminv2-inbox"
            eyebrow="Operational inbox"
            title="Needs Administration"
            supporting="Decisions and checks that require Administration authority. Unit-level daily management stays with managers."
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
            {canManagePeople ? <Button icon="people" variant="secondary" onClick={onOpenPeople}>Open People</Button> : null}
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
              <StatTile label="Roster-only" value={rosterOnlyCount} supporting="No fabricated login" icon="people" tone="neutral" onClick={canManagePeople ? onOpenPeople : undefined} />
              <StatTile label="Identity review" value={identityReviewCount} supporting="Needs confirmation" icon="warning" tone={identityReviewCount ? "warning" : "neutral"} onClick={canManagePeople ? onOpenPeople : undefined} />
              <StatTile label="Needs attention" value={peopleAttention} supporting="Recorded gaps" icon="notification" tone={peopleAttention ? "warning" : "neutral"} onClick={canManagePeople ? onOpenPeople : undefined} />
            </div>
            <div className="adminv2-panel-foot">
              {canManagePeople ? <Button variant="quiet" size="compact" onClick={onOpenPeople}>Open People</Button> : null}
              {canAccessProtectedHR ? <Button variant="quiet" size="compact" onClick={onOpenProtectedHR}>Protected HR</Button> : null}
            </div>
          </DataPanel>
        </section>

        <section className="adminv2-context-grid" aria-label="People operations">
          <DataPanel
            className="adminv2-panel adminv2-workforce"
            eyebrow="Time & Leave"
            title="Today and leave context"
            supporting="Recorded sessions and confirmed leave are operational context only. No work session is not an absence and never creates a Payroll deduction."
          >
            <div className="adminv2-stat-grid is-four">
              <StatTile label="Working now" value={today?.working || 0} supporting="Current sessions" icon="people" tone="success" onClick={onOpenAttendance} />
              <StatTile label="Approved leave" value={today?.leave || 0} supporting="Today" icon="time" tone="action" onClick={onOpenAttendance} />
              <StatTile label="No session" value={today?.notStarted || 0} supporting="Not absence" icon="pending" tone="neutral" onClick={onOpenAttendance} />
              <StatTile label="People on record" value={today?.headcount || 0} supporting="Active people" icon="people" tone="neutral" onClick={canManagePeople ? onOpenPeople : undefined} />
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
            className="adminv2-panel adminv2-setup"
            eyebrow="Organisation setup"
            title="Organisation configuration"
            supporting="Recorded office and Unit Head configuration. Invitations always begin as Staff and job titles never grant authority."
            action={<Count value={setupCount} tone={setupCount ? "attention" : "success"} />}
          >
            {!office ? <SetupRow
              icon="location"
              title="Set the office location"
              meta="Attendance cannot distinguish the office from another work location until this is configured."
              status="Not configured"
              statusTone="warning"
              actionLabel="Open Settings"
              onAction={onOpenSettings}
            /> : null}

            {headlessUnits.map((unit) => unit.pending ? <SetupRow
              key={unit.id}
              icon="people"
              title={unit.name}
              meta={`Invitation sent to ${unit.pending.email}. Unit Head authority is assigned only after activation.`}
              status="Invitation pending"
              statusTone="action"
              actionLabel="Open Units"
              onAction={onOpenUnits}
            /> : <SetupRow
              key={unit.id}
              icon="people"
              title={unit.name}
              meta="No Unit Head is recorded. Invite a Staff account or assign an active unit member from Units."
              status="No Unit Head"
              statusTone="warning"
              actionLabel="Invite staff"
              onAction={() => onInviteUnit?.(unit)}
            />)}

            {setupCount === 0 ? <Quiet icon="settings">Primary office and Unit Head configuration are recorded.</Quiet> : null}
            <div className="adminv2-panel-foot"><Button variant="quiet" size="compact" onClick={onOpenUnits}>Open all units</Button></div>
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
            />) : <Quiet icon="calendar">No upcoming meeting is recorded in the next 14 days.</Quiet>}
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

          <DataPanel
            className="adminv2-panel adminv2-units"
            eyebrow="Organisation"
            title="Units"
            supporting="Alphabetical factual context. Outputs and alerts are not a ranking."
            action={<Button variant="quiet" size="compact" onClick={onOpenUnits}>Open all units</Button>}
          >
            {units.length ? units.map((unit) => <UnitRow key={unit.id} unit={unit} onInvite={onInviteUnit} />) : <Quiet icon="organisation">No units are recorded.</Quiet>}
          </DataPanel>
        </section>
      </main> : null}
    </div>
  </div>;
}
