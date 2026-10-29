import DailyScenicPhoto from "../../components/DailyScenicPhoto";
import EmployeeWorkSession from "../../components/EmployeeWorkSession";
import {
  Skeleton,
  StatePanel,
} from "../components";
import { CeacIcon } from "../icons";
import "./executive-overview.css";
import { strategyProgress } from "./strategyProgress.js";

function formatDate(value, options = {}) {
  if (!value) return "Not recorded";
  const date = String(value).length <= 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return date.toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    day: "numeric",
    month: "short",
    ...options,
  });
}

function accraDateKey(value = new Date()) {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
}

function accraGreeting(value = new Date()) {
  const hourPart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value)).find((part) => part.type === "hour");
  const hour = Number(hourPart?.value || 0);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function displayCount(value) {
  return value === null || value === undefined ? "—" : Number(value).toLocaleString("en-GH");
}

function ExecutiveStat({ icon, value, label, supporting, tone = "purple", onClick }) {
  const Tag = onClick ? "button" : "div";
  return <Tag type={onClick ? "button" : undefined} className={`executivev2-kpi is-${tone}`} onClick={onClick}>
    <span className="executivev2-kpi-icon"><CeacIcon name={icon} size="row" decorative /></span>
    <span className="executivev2-kpi-copy">
      <span>{label}</span>
      <strong>{value}</strong>
      {supporting ? <small>{supporting}</small> : null}
    </span>
  </Tag>;
}

function AttentionItem({ icon, title, meta, tone = "neutral", onClick }) {
  return <button type="button" className="executivev2-attention-item" onClick={onClick}>
    <span className={`executivev2-attention-icon is-${tone}`}><CeacIcon name={icon} size="row" decorative /></span>
    <span className="executivev2-attention-copy">
      <strong>{title}</strong>
      <small>{meta}</small>
    </span>
    <span className="executivev2-row-action" aria-hidden="true">›</span>
  </button>;
}

function DirectionRow({ icon, label, detail, progress = null, tone = "success" }) {
  const hasProgress = Number.isFinite(progress);
  return <div className="executivev2-direction-row">
    <span className={`executivev2-direction-icon is-${tone}`}><CeacIcon name={icon} size="row" decorative /></span>
    <span className="executivev2-direction-copy"><strong>{label}</strong><small>{detail}</small></span>
    {hasProgress ? <>
      <span className="executivev2-direction-track" aria-hidden="true"><span className={`is-${tone}`} style={{ width: `${progress}%` }} /></span>
      <small>{Math.round(progress)}%</small>
    </> : <small className="executivev2-direction-state">Recorded</small>}
  </div>;
}

function strategyStatusLabel(row) {
  const status = String(row?.status || "recorded").replaceAll("_", " ");
  if (row?.measurement_kind !== "numeric") return status;
  const current = row?.current_value;
  const target = row?.target_value;
  const unit = row?.target_unit ? ` ${row.target_unit}` : "";
  if (current === null || current === undefined || target === null || target === undefined) return status;
  return `${Number(current).toLocaleString("en-GH")} of ${Number(target).toLocaleString("en-GH")}${unit} · ${status}`;
}

function OrganisationRow({ icon, label, value, tone = "purple", onClick }) {
  return <button type="button" className="executivev2-org-row" onClick={onClick}>
    <span className={`executivev2-org-icon is-${tone}`}><CeacIcon name={icon} size="row" decorative /></span>
    <span><strong>{label}</strong><small>{displayCount(value)}</small></span>
    <span aria-hidden="true">›</span>
  </button>;
}

function humanActivity(value = "") {
  return String(value || "activity")
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function activityPresentation(objectType = "") {
  const key = String(objectType || "").toLowerCase();
  if (key === "profile") return { icon: "people", tone: "purple" };
  if (key === "work_item") return { icon: "work", tone: "blue" };
  if (key === "project") return { icon: "projects", tone: "blue" };
  if (key === "objective" || key === "strategy_node") return { icon: "goal", tone: "green" };
  if (key === "meeting" || key === "meeting_session") return { icon: "calendar", tone: "amber" };
  if (key === "report") return { icon: "reports", tone: "amber" };
  if (key === "unit" || key === "sub_team") return { icon: "organisation", tone: "purple" };
  if (key === "announcement") return { icon: "messages", tone: "blue" };
  return { icon: "record", tone: "blue" };
}

function RecentActivityItem({ row }) {
  const presentation = activityPresentation(row.object_type);
  return <div className="executivev2-activity-item">
    <span className={`executivev2-activity-icon is-${presentation.tone}`}><CeacIcon name={presentation.icon} size="row" decorative /></span>
    <span className="executivev2-activity-copy">
      <strong>{humanActivity(row.verb)}</strong>
      <small>{[row.actor_name || "CEAC", humanActivity(row.object_type), formatDate(row.at, { hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · ")}</small>
    </span>
    <span className="executivev2-activity-value">{formatDate(row.at, { weekday: "short" })}</span>
  </div>;
}

function ActivityItem({ row }) {
  return <div className="executivev2-activity-item">
    <span className="executivev2-activity-icon"><CeacIcon name="record" size="row" decorative /></span>
    <span className="executivev2-activity-copy">
      <strong>{row.name}</strong>
      <small>{row.unit} · {formatDate(row.occurred_on)}</small>
    </span>
    <span className="executivev2-activity-value">
      <strong>{row.value === null ? "—" : Number(row.value).toLocaleString("en-GH")}{row.value_label ? ` ${row.value_label}` : ""}</strong>
    </span>
  </div>;
}

export default function ExecutiveOverviewV2({
  me,
  executiveName,
  executiveDate,
  loading,
  error,
  summary,
  objectiveMix,
  ministryStrategyRows = [],
  reporting,
  ministryLatestRows = [],
  recentActivity = [],
  meetings = [],
  onRetry,
  onOpenWork,
  onOpenMinistry,
  onOpenPortfolio,
  onOpenOrganisation,
  onOpenReports,
  onOpenCalendar,
  onOpenMeeting,
  onScheduleMeeting,
}) {
  const reportingGap = reporting ? Math.max(0, Number(reporting.total) - Number(reporting.filed)) : 0;
  const attentionCount = Number(summary.objectiveAttention || 0) + Number(summary.blocked || 0) + reportingGap;
  const objectiveRisk = Number(objectiveMix.atRisk || 0) + Number(objectiveMix.notMet || 0);
  const ministryDirectionRows = ministryStrategyRows.filter((row) => row.node_type === "ministry_objective").slice(0, 3);
  // Preserve recent, authorised ministry numbers alongside attributable work events.
  const recentMinistryRows = ministryLatestRows.filter((row) => row.value !== null).slice(0, 2);
  const directionFallbackRows = ministryDirectionRows.length ? ministryDirectionRows : ministryStrategyRows.filter((row) => row.node_type === "ministry_direction").slice(0, 3);
  const todayKey = accraDateKey();
  const meetingsToday = meetings.filter((meeting) => accraDateKey(meeting.starts_at) === todayKey).length;
  const greeting = accraGreeting();

  const attentionRows = [
    reportingGap > 0 ? {
      icon: "reports",
      title: "Reporting requires attention",
      meta: `${reportingGap} unit report${reportingGap === 1 ? "" : "s"} still outstanding for ${reporting.label}`,
      tone: "risk",
      onClick: onOpenReports,
    } : null,
    Number(summary.objectiveAttention || 0) > 0 ? {
      icon: "goal",
      title: "Ministry objective update due",
      meta: `${summary.objectiveAttention} objective${summary.objectiveAttention === 1 ? "" : "s"} recorded at risk or not met`,
      tone: "warning",
      onClick: onOpenMinistry,
    } : null,
    Number(summary.blocked || 0) > 0 ? {
      icon: "work",
      title: "Delivery follow-up required",
      meta: `${summary.blocked} unresolved blocker${summary.blocked === 1 ? "" : "s"} across visible work`,
      tone: "action",
      onClick: onOpenWork,
    } : null,
    Number(summary.review || 0) > 0 ? {
      icon: "people",
      title: "Work is waiting for review",
      meta: `${summary.review} submitted item${summary.review === 1 ? "" : "s"} currently in review`,
      tone: "purple",
      onClick: onOpenWork,
    } : null,
  ].filter(Boolean);

  return <div className="body executive-home">
    <div className="executivev2">
      <div className="executivev2-page-heading">
        <h1>Overview</h1>
        <p>Executive Dashboard</p>
      </div>

      <header className="executivev2-hero s2-landscape-hero"><DailyScenicPhoto />
        <div className="executivev2-hero-copy">
          <h2>{greeting}, {executiveName || "Executive"}</h2>
          <p>Here&apos;s what matters today across your ministry, people and operations.</p>
        </div>
        <time>{executiveDate}</time>
      </header>

      {me?.id && <EmployeeWorkSession me={me} />}

      {error ? <StatePanel
        state="error"
        title="Executive Overview could not finish loading"
        description={error}
        actionLabel="Try again"
        onAction={onRetry}
      /> : null}

      {loading ? <div className="executivev2-loading" role="status" aria-live="polite" aria-busy="true" aria-label="Loading Executive Overview">
        <Skeleton width="100%" height="7.5rem" />
        <Skeleton width="100%" height="13rem" />
        <Skeleton width="100%" height="12rem" />
      </div> : null}

      {!loading && !error ? <main className="executivev2-main">
        <section className="executivev2-kpis" aria-label="Executive summary">
          <ExecutiveStat
            icon="people"
            value={displayCount(summary.activeVolunteers)}
            label="Volunteers"
            supporting={summary.activeVolunteers === null ? "Visible when authorised" : "Active engagement"}
            tone="purple"
            onClick={onOpenOrganisation}
          />
          <ExecutiveStat
            icon="goal"
            value={displayCount(summary.ministryObjectives ?? summary.objectives)}
            label="Ministry Objectives"
            supporting={objectiveRisk ? `${objectiveRisk} need attention` : "Recorded direction"}
            tone="green"
            onClick={onOpenMinistry}
          />
          <ExecutiveStat
            icon="calendar"
            value={displayCount(meetingsToday)}
            label="Upcoming Meetings"
            supporting={meetingsToday ? "Today" : meetings.length ? "Next 14 days" : "None recorded today"}
            tone="amber"
            onClick={onOpenCalendar}
          />
          <ExecutiveStat
            icon="reports"
            value={displayCount(attentionCount)}
            label="Reports / Actions"
            supporting={attentionCount ? `${attentionCount} need your attention` : "No recorded urgent action"}
            tone="blue"
            onClick={onOpenReports}
          />
        </section>

        <section className="executivev2-reference-grid">
          <section className="executivev2-reference-panel executivev2-attention" aria-label="Needs your attention">
            <div className="executivev2-panel-head">
              <h2><CeacIcon name="warning" size="row" decorative />Needs your attention</h2>
              <button type="button" onClick={onOpenWork}>View all</button>
            </div>
            <div className="executivev2-panel-body">
              {attentionRows.length ? attentionRows.slice(0, 4).map((row) => <AttentionItem key={row.title} {...row} />) : (
                <div className="executivev2-empty">
                  <CeacIcon name="checkCircle" size="row" decorative />
                  <span><strong>No recorded item needs your decision right now.</strong><small>New exceptions will appear here when an underlying CEAC record requires Executive attention.</small></span>
                </div>
              )}
            </div>
          </section>

          <section className="executivev2-reference-panel executivev2-direction">
            <div className="executivev2-panel-head">
              <h2><CeacIcon name="goal" size="row" decorative />Ministry direction</h2>
              <button type="button" onClick={onOpenMinistry}>View all</button>
            </div>
            <div className="executivev2-panel-body">
              {directionFallbackRows.length ? directionFallbackRows.map((row, index) => {
                const progress = strategyProgress(row);
                const tone = row.status === "met" ? "success" : row.status === "draft" ? "blue" : index === 1 ? "warning" : "success";
                return <DirectionRow
                  key={row.id}
                  icon={row.node_type === "ministry_direction" ? "ministry" : "goal"}
                  label={row.name}
                  detail={strategyStatusLabel(row)}
                  progress={progress}
                  tone={tone}
                />;
              }) : <div className="executivev2-empty compact"><span><strong>No ministry objective is recorded yet.</strong><small>Open Ministry to add or review the recorded direction.</small></span></div>}
            </div>
          </section>

          <section className="executivev2-reference-panel executivev2-organisation">
            <div className="executivev2-panel-head">
              <h2><CeacIcon name="organisation" size="row" decorative />Organisational overview</h2>
              <button type="button" onClick={onOpenOrganisation}>View all</button>
            </div>
            <div className="executivev2-panel-body">
              <OrganisationRow icon="organisation" label="Departments" value={summary.activeUnits} tone="purple" onClick={onOpenOrganisation} />
              <OrganisationRow icon="team" label="Teams" value={summary.activeTeams} tone="blue" onClick={onOpenOrganisation} />
              <OrganisationRow icon="people" label="Active Volunteers" value={summary.activeVolunteers} tone="amber" onClick={onOpenOrganisation} />
              <OrganisationRow icon="account" label="Active Staff" value={summary.activeStaff} tone="green" onClick={onOpenOrganisation} />
            </div>
          </section>
        </section>

        <section className="executivev2-lower-grid">
          <section className="executivev2-reference-panel executivev2-activity">
            <div className="executivev2-panel-head">
              <h2><CeacIcon name="record" size="row" decorative />Significant updates</h2>
              <button type="button" onClick={onOpenMinistry}>View all</button>
            </div>
            <div className="executivev2-activity-context">{recentActivity.length ? "Organisational milestones and exceptions" : "Recorded ministry activity"}</div>
            <div className="executivev2-activity-grid">
              {recentMinistryRows.length || recentActivity.length ? <>
                  {recentMinistryRows.map((row) => <ActivityItem key={row.id} row={row} />)}
                  {recentActivity.slice(0, 4 - recentMinistryRows.length).map((row) => <RecentActivityItem key={row.id} row={row} />)}
                </> : ministryLatestRows.length ? ministryLatestRows.slice(0, 4).map((row) => <ActivityItem key={row.id} row={row} />)
                : <div className="executivev2-empty compact"><span><strong>No recent attributable activity is visible.</strong><small>This area only shows CEAC records your account is authorised to see.</small></span></div>}
            </div>
          </section>

          <section className="executivev2-reference-panel executivev2-meetings">
            <div className="executivev2-panel-head">
              <h2><CeacIcon name="calendar" size="row" decorative />Upcoming meetings</h2>
              <button type="button" onClick={onOpenCalendar}>View calendar</button>
            </div>
            <div className="executivev2-panel-body">
              {meetings.length ? meetings.slice(0, 4).map((meeting) => <button type="button" className="executivev2-meeting-row" key={meeting.id} onClick={() => onOpenMeeting?.(meeting.id)}>
                <time>{formatDate(meeting.starts_at, { hour: "2-digit", minute: "2-digit" })}</time>
                <span><strong>{meeting.title}</strong><small>{meeting.provider || "Meeting"} · {formatDate(meeting.starts_at, { weekday: "short" })}</small></span>
                <span className="executivev2-row-action" aria-hidden="true">›</span>
              </button>) : <div className="executivev2-empty compact"><span><strong>No upcoming meeting is visible.</strong><small>Meetings appear here when they are recorded in CEAC.</small></span></div>}
            </div>
            <button type="button" className="executivev2-schedule-link" onClick={onScheduleMeeting}>Schedule meeting</button>
          </section>
        </section>
      </main> : null}
    </div>
  </div>;
}
