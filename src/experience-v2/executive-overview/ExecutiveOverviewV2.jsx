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
import { DataVizChart } from "../data-viz/DataVizV2";

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

function Count({ value, tone = "neutral" }) {
  return <span className={`executivev2-count is-${tone}`}>{value}</span>;
}

function Quiet({ icon = "checkCircle", children }) {
  return <div className="executivev2-quiet">
    <CeacIcon name={icon} size="row" decorative />
    <span>{children}</span>
  </div>;
}

function AttentionRow({ icon, title, meta, status, tone = "warning", onClick }) {
  return <QueueRow
    className="executivev2-attention-row"
    icon={icon}
    title={title}
    meta={meta}
    status={status}
    statusTone={tone}
    onClick={onClick}
  />;
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

function MinistryRecord({ row }) {
  return <div className="executivev2-record-row">
    <span className="executivev2-row-icon"><CeacIcon name="record" size="row" decorative /></span>
    <span className="executivev2-record-copy">
      <strong>{row.name}</strong>
      <span>{row.unit} · {formatDate(row.occurred_on)}</span>
      {row.note ? <small>{row.note}</small> : null}
    </span>
    <span className="executivev2-record-value">
      <strong>{row.value === null ? "—" : Number(row.value).toLocaleString("en-GH")}</strong>{" "}
      <small>{row.value_label}</small>
    </span>
  </div>;
}

export default function ExecutiveOverviewV2({
  executiveDate,
  loading,
  error,
  summary,
  objectiveMix,
  reporting,
  ministryOperations = [],
  ministryOccurrences = [],
  occurrencesThisWeek = [],
  unitsThisWeek = 0,
  ministryLatestRows = [],
  ministryCharts = [],
  meetings = [],
  onRetry,
  onOpenWork,
  onOpenMinistry,
  onOpenPortfolio,
  onOpenOrganisation,
  onOpenFinance,
  onOpenReports,
  onOpenMeeting,
  onScheduleMeeting,
}) {
  const reportingGap = reporting ? Math.max(0, Number(reporting.total) - Number(reporting.filed)) : 0;
  const attentionCount = Number(summary.objectiveAttention || 0) + Number(summary.blocked || 0) + reportingGap;
  const objectiveTotal = Number(summary.objectives || 0);
  const objectiveItems = [
    ["Met", objectiveMix.met],
    ["On track", objectiveMix.onTrack],
    ["At risk", objectiveMix.atRisk],
    ["Not met", objectiveMix.notMet],
    ["Other", objectiveMix.other],
  ].filter(([, value]) => Number(value) > 0).map(([label, value]) => ({
    label,
    value,
    percent: objectiveTotal ? (Number(value) / objectiveTotal) * 100 : 0,
  }));
  const outputChange = Number(summary.doneWeek || 0) - Number(summary.donePreviousWeek || 0);
  const outputSupporting = outputChange === 0
    ? "Same recorded count as last week"
    : `${outputChange > 0 ? "+" : ""}${outputChange} compared with last week`;

  return <div className="body executive-home">
    <div className="executivev2">
      <header className="executivev2-intro">
        <div className="executivev2-context"><span>Group Pastor</span><time>{executiveDate}</time></div>
        <div className="executivev2-intro-row">
          <div>
            <h1>Ministry overview</h1>
            <p>{attentionCount
              ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need your attention.`
              : "Nothing currently needs your decision. Ministry direction and delivery context are below."}</p>
          </div>
          <Button icon="meeting" onClick={onScheduleMeeting}>Schedule meeting</Button>
        </div>
      </header>

      {error ? <StatePanel
        state="error"
        title="Executive Overview could not finish loading"
        description={error}
        actionLabel="Try again"
        onAction={onRetry}
      /> : null}

      {loading ? <div className="executivev2-loading" role="status" aria-live="polite" aria-busy="true" aria-label="Loading Executive Overview">
        <Surface variant="plain" padding="standard"><Skeleton width="32%" /><Skeleton width="92%" /><Skeleton width="76%" /></Surface>
        <Surface variant="plain" padding="standard"><Skeleton width="28%" /><Skeleton width="100%" /><Skeleton width="82%" /></Surface>
        <Surface variant="plain" padding="standard"><Skeleton width="38%" /><Skeleton width="95%" /><Skeleton width="70%" /></Surface>
      </div> : null}

      {!loading && !error ? <main className="executivev2-main">
        <section className="executivev2-command-grid" aria-label="Needs your attention">
          <DataPanel
            className="executivev2-panel executivev2-attention"
            eyebrow="Executive decisions"
            title="Needs your attention"
            supporting="Items that need an Executive decision or drill-in. Open the source record before acting."
            action={<Count value={attentionCount} tone={attentionCount ? "attention" : "success"} />}
          >
            {!attentionCount ? <Quiet>No recorded signal currently needs Executive drill-in.</Quiet> : null}
            {summary.objectiveAttention ? <AttentionRow
              icon="goal"
              title={`${summary.objectiveAttention} objective${summary.objectiveAttention === 1 ? "" : "s"} recorded at risk or not met`}
              meta="Open Ministry to review the recorded objective status and evidence."
              status="Recorded status"
              onClick={onOpenMinistry}
            /> : null}
            {summary.blocked ? <AttentionRow
              icon="warning"
              title={`${summary.blocked} unresolved delivery hold-up${summary.blocked === 1 ? "" : "s"}`}
              meta="Open the underlying work before drawing a conclusion."
              status="Unresolved"
              tone="warning"
              onClick={onOpenWork}
            /> : null}
            {reportingGap ? <AttentionRow
              icon="reports"
              title={`${reportingGap} unit report${reportingGap === 1 ? "" : "s"} outstanding`}
              meta={`${reporting.label} · ${reporting.filed} of ${reporting.total} units filed`}
              status="Coverage gap"
              onClick={onOpenReports}
            /> : null}
          </DataPanel>
        </section>

        <section className="executivev2-context-grid" aria-label="Ministry direction and delivery">
          <DataPanel
            className="executivev2-panel executivev2-direction"
            eyebrow="Ministry direction"
            title="Direction and objectives"
            supporting="Current ministry objectives and linked delivery. Descriptive objectives stay descriptive."
            action={<Button variant="quiet" size="compact" onClick={onOpenMinistry}>Open Ministry</Button>}
          >
            <div className="executivev2-direction-head">
              <StatTile label="Objectives" value={summary.objectives} icon="goal" onClick={onOpenMinistry} />
              <StatTile label="Active projects" value={summary.projects} icon="projects" onClick={onOpenPortfolio} />
            </div>
            {objectiveItems.length ? <ProgressDistribution items={objectiveItems} /> : <Quiet icon="info">No objective status is recorded yet.</Quiet>}
          </DataPanel>
          <DataPanel
            className="executivev2-panel executivev2-delivery"
            eyebrow="Delivery & exceptions"
            title="Delivery and exceptions"
            supporting="Completed work, unresolved blockers and items currently in authorised review."
            action={<Button variant="quiet" size="compact" onClick={onOpenOrganisation}>Open Organisation</Button>}
          >
            <div className="executivev2-delivery-grid">
              <StatTile label="Completed outputs" value={summary.doneWeek} supporting={outputSupporting} icon="work" onClick={onOpenWork} />
              <StatTile label="Open blockers" value={summary.blocked} supporting="Unresolved recorded hold-ups" icon="warning" onClick={onOpenWork} />
              <StatTile label="In manager review" value={summary.review} supporting="Remains with authorised managers unless escalated" icon="pending" onClick={onOpenWork} />
            </div>
          </DataPanel>
        </section>

        <section className="executivev2-support-grid" aria-label="Finance reporting and organisation">
          <DataPanel
            className="executivev2-panel executivev2-governance"
            eyebrow="Finance & reporting"
            title="Finance and reporting"
            supporting="Reporting coverage and recorded financial context for Executive review."
          >
            {reporting ? <button type="button" className="executivev2-coverage" onClick={onOpenReports}>
              <span><strong>{reporting.label}</strong><small>{reporting.filed} of {reporting.total} active units filed</small></span>
              <StatusBadge tone={reportingGap ? "warning" : "success"}>{reportingGap ? `${reportingGap} outstanding` : "Coverage complete"}</StatusBadge>
              <span className="executivev2-coverage-track" aria-hidden="true"><span style={{ width: `${reporting.total ? (reporting.filed / reporting.total) * 100 : 0}%` }} /></span>
            </button> : <Quiet icon="info">No reporting period is open. Administration controls reporting periods.</Quiet>}
            <QueueRow
              icon="finance"
              title="Financial oversight"
              meta="Open recorded budgets, requests and actual spend. Currencies remain separate."
              status="Authoritative record"
              statusTone="action"
              onClick={onOpenFinance}
            />
          </DataPanel>
          <DataPanel
            className="executivev2-panel executivev2-organisation"
            eyebrow="Organisation"
            title="Organisation"
            supporting="Departments, recorded leaders and structural exceptions."
            action={<Button variant="quiet" size="compact" onClick={onOpenOrganisation}>Open Organisation</Button>}
          >
            <QueueRow
              icon="organisation"
              title="Departments and leadership"
              meta="Review recorded Unit Heads, headcount and any missing leadership context."
              status="Leadership context"
              statusTone="neutral"
              onClick={onOpenOrganisation}
            />
          </DataPanel>
        </section>

        <section className="executivev2-support-grid" aria-label="Meetings and recent ministry activity">
          <DataPanel
            className="executivev2-panel executivev2-meetings"
            eyebrow="Next 14 days"
            title="Meetings"
            supporting="Upcoming non-cancelled meetings visible to Executive."
            action={<Button variant="quiet" size="compact" onClick={onScheduleMeeting}>Schedule</Button>}
          >
            {!meetings.length ? <Quiet icon="calendar">No upcoming meetings are visible in the current record.</Quiet> : meetings.slice(0, 4).map((meeting) => <QueueRow
              key={meeting.id}
              icon="meeting"
              title={meeting.title}
              meta={formatDate(meeting.starts_at, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
              status="Upcoming"
              statusTone="action"
              onClick={() => onOpenMeeting?.(meeting.id)}
            />)}
          </DataPanel>
          <DataPanel
            className="executivev2-panel executivev2-movement"
            eyebrow="Recent ministry activity"
            title="Recorded ministry activity"
            supporting="Recent unit-entered ministry figures. These are records, not scores."
            action={<Button variant="quiet" size="compact" onClick={onOpenMinistry}>Open Ministry</Button>}
          >
            {ministryOperations.length ? <div className="executivev2-stat-grid">
              <StatTile label="Measures" value={ministryOperations.length} icon="ministry" />
              <StatTile label="Records this week" value={occurrencesThisWeek.length} icon="record" />
              <StatTile label="Units recording" value={unitsThisWeek} icon="organisation" />
            </div> : <Quiet icon="info">No ministry numbers have been configured yet.</Quiet>}
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
          </DataPanel>
        </section>

        <DataPanel
          className="executivev2-panel executivev2-records"
          eyebrow="Supporting evidence"
          title="Latest ministry records"
          supporting={`${ministryOccurrences.length} occurrence${ministryOccurrences.length === 1 ? "" : "s"} visible in the current 90-day record.`}
          action={<Button variant="quiet" size="compact" onClick={onOpenMinistry}>Open full record</Button>}
        >
          {!ministryLatestRows.length ? <Quiet icon="info">No ministry values have been recorded yet.</Quiet> : ministryLatestRows.slice(0, 6).map((row) => <MinistryRecord key={row.id} row={row} />)}
        </DataPanel>
      </main> : null}
    </div>
  </div>;
}
