import {
  Button,
  Skeleton,
  StatePanel,
} from "../components";
import { CeacIcon } from "../icons";
import { DataVizChart } from "../data-viz/DataVizV2";
import "./executive-overview.css";

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

function ministryMovement(rows = []) {
  const values = rows.map((row) => Number(row.value) || 0);
  const first = values[0] || 0;
  const latest = values[values.length - 1] || 0;
  const delta = latest - first;
  return {
    latest,
    note: delta === 0
      ? "No arithmetic change across the recorded values."
      : `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-GH")} across ${rows.length} recorded values. CEAC OS does not infer why it moved.`,
  };
}

function pct(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (Number(value || 0) / Number(total)) * 100));
}

function ExecutiveStat({ icon, value, label, supporting, tone = "blue", onClick }) {
  const Tag = onClick ? "button" : "div";
  return <Tag type={onClick ? "button" : undefined} className={`executivev2-kpi is-${tone}`} onClick={onClick}>
    <span className="executivev2-kpi-icon"><CeacIcon name={icon} size="row" decorative /></span>
    <span className="executivev2-kpi-copy">
      <strong>{value}</strong>
      <span>{label}</span>
      {supporting ? <small>{supporting}</small> : null}
    </span>
  </Tag>;
}

function AttentionItem({ icon, title, meta, status, tone = "neutral", onClick }) {
  return <button type="button" className="executivev2-attention-item" onClick={onClick}>
    <span className={`executivev2-attention-icon is-${tone}`}><CeacIcon name={icon} size="row" decorative /></span>
    <span className="executivev2-attention-copy">
      <strong>{title}</strong>
      <small>{meta}</small>
    </span>
    <span className={`executivev2-pill is-${tone}`}>{status}</span>
    <span className="executivev2-row-action" aria-hidden="true">›</span>
  </button>;
}

function DirectionRow({ icon, label, value, progress, tone = "success" }) {
  return <div className="executivev2-direction-row">
    <span className={`executivev2-direction-icon is-${tone}`}><CeacIcon name={icon} size="row" decorative /></span>
    <span><strong>{value}</strong> {label}</span>
    <span className="executivev2-direction-track" aria-hidden="true"><span className={`is-${tone}`} style={{ width: `${progress}%` }} /></span>
    <small>{Math.round(progress)}%</small>
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
  executiveName,
  loading,
  error,
  summary,
  objectiveMix,
  reporting,
  ministryLatestRows = [],
  ministryCharts = [],
  meetings = [],
  onRetry,
  onOpenWork,
  onOpenMinistry,
  onOpenPortfolio,
  onOpenOrganisation,
  onOpenReports,
  onOpenMeeting,
  onScheduleMeeting,
}) {
  const reportingGap = reporting ? Math.max(0, Number(reporting.total) - Number(reporting.filed)) : 0;
  const attentionCount = Number(summary.objectiveAttention || 0) + Number(summary.blocked || 0) + reportingGap;
  const objectiveTotal = Number(summary.objectives || 0);
  const objectiveStable = Number(objectiveMix.onTrack || 0) + Number(objectiveMix.met || 0);
  const objectiveRisk = Number(objectiveMix.atRisk || 0) + Number(objectiveMix.notMet || 0);
  const objectiveOther = Number(objectiveMix.other || 0);
  const attentionRows = [
    Number(summary.objectiveAttention || 0) > 0 ? {
      icon: "goal",
      title: "Review ministry objective status",
      meta: `${summary.objectiveAttention} objective${summary.objectiveAttention === 1 ? "" : "s"} recorded at risk or not met`,
      status: "At risk",
      tone: "risk",
      onClick: onOpenMinistry,
    } : null,
    Number(summary.blocked || 0) > 0 ? {
      icon: "warning",
      title: "Resolve recorded delivery hold-ups",
      meta: `${summary.blocked} unresolved blocker${summary.blocked === 1 ? "" : "s"} across visible work`,
      status: "Follow up",
      tone: "warning",
      onClick: onOpenWork,
    } : null,
    reportingGap > 0 ? {
      icon: "reports",
      title: "Outstanding unit reporting",
      meta: `${reportingGap} unit report${reportingGap === 1 ? "" : "s"} still outstanding for ${reporting.label}`,
      status: "Reporting",
      tone: "action",
      onClick: onOpenReports,
    } : null,
  ].filter(Boolean);

  return <div className="body executive-home">
    <div className="executivev2">
      <header className="executivev2-greeting">
        <h1>Good morning, {executiveName || "Group Pastor"}</h1>
        <p>Here&apos;s what matters across CEAC today.</p>
      </header>

      {error ? <StatePanel
        state="error"
        title="Executive Overview could not finish loading"
        description={error}
        actionLabel="Try again"
        onAction={onRetry}
      /> : null}

      {loading ? <div className="executivev2-loading" role="status" aria-live="polite" aria-busy="true" aria-label="Loading Executive Overview">
        <Skeleton width="100%" height="5rem" />
        <Skeleton width="100%" height="16rem" />
        <Skeleton width="100%" height="13rem" />
      </div> : null}

      {!loading && !error ? <main className="executivev2-main">
        <section className="executivev2-kpis" aria-label="Executive summary">
          <ExecutiveStat
            icon="warning"
            value={attentionCount}
            label="Items need attention"
            supporting="Objectives, blockers and reporting"
            tone="red"
            onClick={attentionCount ? onOpenWork : undefined}
          />
          <ExecutiveStat
            icon="goal"
            value={summary.objectives}
            label="Ministry objectives"
            supporting={objectiveRisk ? `${objectiveRisk} at risk or not met` : "No recorded objective risk"}
            tone="blue"
            onClick={onOpenMinistry}
          />
          <ExecutiveStat
            icon="projects"
            value={summary.projects}
            label="Active projects"
            supporting={summary.review ? `${summary.review} work item${summary.review === 1 ? "" : "s"} in review` : "Current active portfolio"}
            tone="green"
            onClick={onOpenPortfolio}
          />
          <ExecutiveStat
            icon="organisation"
            value={summary.activeUnits || 0}
            label="Departments"
            supporting="Active organisation units"
            tone="purple"
            onClick={onOpenOrganisation}
          />
        </section>

        <section className="executivev2-reference-grid">
          <section className="executivev2-reference-panel executivev2-attention" aria-label="Needs your attention">
            <div className="executivev2-panel-head">
              <h2>Needs your attention</h2>
              {attentionCount ? <button type="button" onClick={onOpenWork}>View all</button> : null}
            </div>
            <div className="executivev2-panel-body">
              {attentionRows.length ? attentionRows.map((row) => <AttentionItem key={row.title} {...row} />) : (
                <div className="executivev2-empty">
                  <CeacIcon name="checkCircle" size="row" decorative />
                  <span><strong>No recorded item needs your decision right now.</strong><small>New exceptions will appear here when the underlying record requires Executive attention.</small></span>
                </div>
              )}
            </div>
          </section>

          <div className="executivev2-side-stack">
            <section className="executivev2-reference-panel executivev2-direction">
              <div className="executivev2-panel-head">
                <h2>Ministry direction</h2>
                <button type="button" onClick={onOpenMinistry}>View all</button>
              </div>
              <div className="executivev2-panel-body">
                {objectiveTotal ? <>
                  <DirectionRow icon="checkCircle" label="on track or met" value={objectiveStable} progress={pct(objectiveStable, objectiveTotal)} tone="success" />
                  <DirectionRow icon="warning" label="at risk or not met" value={objectiveRisk} progress={pct(objectiveRisk, objectiveTotal)} tone="risk" />
                  <DirectionRow icon="info" label="other recorded status" value={objectiveOther} progress={pct(objectiveOther, objectiveTotal)} tone="warning" />
                </> : <div className="executivev2-empty compact"><span><strong>No objective status recorded yet.</strong><small>Open Ministry to add or review objectives.</small></span></div>}
              </div>
            </section>

            <section className="executivev2-reference-panel executivev2-organisation">
              <div className="executivev2-panel-head">
                <h2>Organisational overview</h2>
                <button type="button" onClick={onOpenOrganisation}>View all</button>
              </div>
              <div className="executivev2-org-grid">
                <button type="button" onClick={onOpenOrganisation}><CeacIcon name="organisation" size="row" decorative /><span><strong>{summary.activeUnits || 0}</strong><small>Departments</small></span></button>
                <button type="button" onClick={onOpenPortfolio}><CeacIcon name="projects" size="row" decorative /><span><strong>{summary.projects || 0}</strong><small>Active projects</small></span></button>
                <button type="button" onClick={onOpenReports}><CeacIcon name="reports" size="row" decorative /><span><strong>{reporting ? `${reporting.filed}/${reporting.total}` : "—"}</strong><small>Reports filed</small></span></button>
              </div>
            </section>
          </div>
        </section>

        <section className="executivev2-lower-grid">
          <section className="executivev2-reference-panel executivev2-activity executivev2-movement">
            <div className="executivev2-panel-head">
              <h2>Recent activity</h2>
              <button type="button" onClick={onOpenMinistry}>View ministry</button>
            </div>
            <div className="executivev2-activity-context">Recorded ministry activity</div>
            <div className="executivev2-activity-tabs" aria-label="Activity filter">
              <span className="is-active">All</span>
              <span>Ministry</span>
              <span>Work</span>
              <span>Reports</span>
            </div>
            <div className="executivev2-activity-grid">
              {ministryLatestRows.length ? ministryLatestRows.slice(0, 4).map((row) => <ActivityItem key={row.id} row={row} />) : (
                <div className="executivev2-empty compact"><span><strong>No recent ministry values are recorded.</strong><small>This area only shows attributable CEAC records.</small></span></div>
              )}
            </div>
            {ministryCharts.length ? <details className="executivev2-movement-details">
              <summary>Recorded movement</summary>
              <div className="executivev2-movement-charts">
                {ministryCharts.slice(0, 2).map(({ operation, rows }) => {
                  const movement = ministryMovement(rows);
                  const label = `${operation.units?.name || "Unit"} · ${operation.name}`;
                  return <DataVizChart
                    key={operation.id}
                    kind="line"
                    compact
                    title={label}
                    note={movement.note}
                    summary={`${movement.latest.toLocaleString("en-GH")} ${operation.value_label || "recorded"}`}
                    ariaLabel={`${label} recorded ministry movement`}
                    data={rows}
                    series={[{ key: "value", label: operation.value_label || "Recorded value" }]}
                  />;
                })}
              </div>
            </details> : null}
          </section>

          <section className="executivev2-reference-panel executivev2-meetings">
            <div className="executivev2-panel-head">
              <h2>Upcoming meetings</h2>
              <Button variant="quiet" size="compact" onClick={onScheduleMeeting}>Schedule meeting</Button>
            </div>
            <div className="executivev2-panel-body">
              {meetings.length ? meetings.slice(0, 4).map((meeting) => <button type="button" className="executivev2-meeting-row" key={meeting.id} onClick={() => onOpenMeeting?.(meeting.id)}>
                <span className="executivev2-meeting-icon"><CeacIcon name="meeting" size="row" decorative /></span>
                <span><strong>{meeting.title}</strong><small>{formatDate(meeting.starts_at, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</small></span>
                <span className="executivev2-meeting-action">View</span>
              </button>) : <div className="executivev2-empty compact"><span><strong>No upcoming meeting is visible.</strong><small>Schedule a meeting when one is needed.</small></span></div>}
            </div>
          </section>
        </section>
      </main> : null}
    </div>
  </div>;
}
