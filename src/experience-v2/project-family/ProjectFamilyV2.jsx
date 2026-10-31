import DailyScenicPhoto from "../../components/DailyScenicPhoto";
import { CeacIcon } from "../icons";
import { Button, StatusBadge } from "../components";
import "./premium-projects.css";

const PROJECT_STATUS = {
  planned: ["Planned", "neutral"],
  active: ["Active", "success"],
  paused: ["Paused", "warning"],
  closed: ["Closed", "neutral"],
  cancelled: ["Cancelled", "neutral"],
};

const HEALTH = {
  on_track: ["On track", "success"],
  watch: ["Watch", "warning"],
  at_risk: ["At risk", "warning"],
  blocked: ["Blocked", "danger"],
};

export function projectLabel(value = "") {
  return String(value || "").replaceAll("_", " ");
}

export function ProjectStatusBadge({ status }) {
  const [label, tone] = PROJECT_STATUS[status] || [projectLabel(status || "Open"), "neutral"];
  return <StatusBadge tone={tone} icon={false}>{label}</StatusBadge>;
}

export function ProjectHealthBadge({ health }) {
  const [label, tone] = HEALTH[health] || [projectLabel(health || "Not recorded"), "neutral"];
  return <StatusBadge tone={tone} icon={false}>{label}</StatusBadge>;
}

export function ProjectPageHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <header className="ev2p-header">
      <div className="ev2p-header-copy">
        {eyebrow ? <span className="ev2p-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actionLabel ? <Button icon="create" onClick={onAction}>{actionLabel}</Button> : null}
    </header>
  );
}

export function ProjectBackButton({ onClick, label = "Projects" }) {
  return (
    <button type="button" className="ev2p-back" aria-label={`Back to ${label}`} onClick={onClick}>
      <CeacIcon name="chevronLeft" size="control" decorative />
      <span>{label}</span>
    </button>
  );
}

export function ProjectWorkspaceHeader({
  kind,
  status,
  title,
  purpose,
  context,
  onBack,
}) {
  return (
    <>
      <ProjectBackButton onClick={onBack} />
      <header className="ev2p-workspace-header s2-landscape-hero"><DailyScenicPhoto />
        <div className="ev2p-workspace-kicker">
          {[kind ? projectLabel(kind) : null, context].filter(Boolean).join(" · ")}
        </div>
        <div className="ev2p-workspace-title-row">
          <h1>{title}</h1>
          <ProjectStatusBadge status={status} />
        </div>
        <p>{purpose || "No purpose has been recorded."}</p>
      </header>
    </>
  );
}

export function ProjectTabs({ items, value, onChange, ariaLabel = "Project workspace" }) {
  const onKey = (event, index) => {
    const key = event.key;
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(key)) return;
    event.preventDefault();
    const next = key === "Home" ? 0 : key === "End" ? items.length - 1
      : (index + (key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    onChange(items[next][0]);
    event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return (
    <nav className="ev2p-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map(([key, label, count], index) => (
        <button key={key} type="button" role="tab"
          aria-selected={value === key} tabIndex={value === key ? 0 : -1}
          className={value === key ? "is-selected" : ""}
          onClick={() => onChange(key)} onKeyDown={event => onKey(event,index)}>
          <span>{label}</span>
          {Number.isFinite(count) ? <b>{count}</b> : null}
        </button>
      ))}
    </nav>
  );
}

export function ProjectListRow({
  eyebrow,
  title,
  meta,
  note,
  status,
  health,
  selected = false,
  onClick,
  trailing,
}) {
  return (
    <button
      type="button"
      className={`ev2p-row${selected ? " is-selected" : ""}`}
      data-health={health || ""}
      aria-pressed={selected || undefined}
      onClick={onClick}
    >
      <span className="ev2p-row-icon"><CeacIcon name="projects" size="row" decorative /></span>
      <span className="ev2p-row-main">
        {eyebrow ? <small>{eyebrow}</small> : null}
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
        {note ? <span className="ev2p-row-note">{note}</span> : null}
      </span>
      <span className="ev2p-row-state">
        {health ? <ProjectHealthBadge health={health} /> : status ? <ProjectStatusBadge status={status} /> : null}
        {trailing || <CeacIcon name="chevronRight" size="meta" decorative />}
      </span>
    </button>
  );
}


export function ProjectContextRow({
  eyebrow,
  title,
  meta,
  note,
  status,
  health,
  facts = [],
  actions = [],
  progress = null,
}) {
  return (
    <article className="ev2p-context-row" data-health={health || ""}>
      <span className="ev2p-context-row-icon"><CeacIcon name="projects" size="row" decorative /></span>
      <div className="ev2p-context-row-main">
        {eyebrow ? <small>{eyebrow}</small> : null}
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
        {note ? <p>{note}</p> : null}
        {Number.isFinite(progress) ? <div className="ev2p-objective-health" aria-label={`Objectives on track or met: ${Math.round(progress)} percent`}>
          <div className="ev2p-objective-health-copy"><span>Objectives on track or met</span><strong>{Math.round(progress)}%</strong></div>
          <div className="ev2p-objective-health-track" role="progressbar" aria-label="Objectives on track or met" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{width:`${Math.min(100,Math.max(0,progress))}%`}} /></div>
        </div> : null}
        {facts.length ? <div className="ev2p-context-facts" aria-label={`${title} factual context`}>
          {facts.map((fact) => (
            <span key={fact.label}>
              <b>{fact.value}</b>
              <small>{fact.label}</small>
            </span>
          ))}
        </div> : null}
      </div>
      <div className="ev2p-context-row-state">
        {health ? <ProjectHealthBadge health={health} /> : status ? <ProjectStatusBadge status={status} /> : null}
        {actions.length ? <div className="ev2p-context-actions">
          <button type="button" className="ev2p-context-primary-action"
            onClick={actions[0].onClick} disabled={actions[0].disabled}>
            {actions[0].label}<CeacIcon name="chevronRight" size="meta" decorative />
          </button>
          {actions.length > 1 ? <details className="ev2p-context-more">
            <summary>More actions</summary>
            <div className="ev2p-context-more-list">
              {actions.slice(1).map((action) => <button type="button" key={action.label}
                onClick={action.onClick} disabled={action.disabled}>{action.label}</button>)}
            </div>
          </details> : null}
        </div> : null}
      </div>
    </article>
  );
}

export function ProjectAttentionCard({
  eyebrow,
  title,
  meta,
  description,
  actions = [],
}) {
  return (
    <article className="ev2p-attention">
      <div className="ev2p-attention-copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
        {description ? <p>{description}</p> : null}
      </div>
      {actions.length ? <div className="ev2p-attention-actions">
        {actions.map((action, index) => (
          <Button
            key={action.label}
            variant={index === actions.length - 1 ? "primary" : "secondary"}
            size="compact"
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        ))}
      </div> : null}
    </article>
  );
}

export function ProjectSectionHeader({ eyebrow, title, count, actionLabel, onAction, action = null }) {
  return (
    <div className="ev2p-section-head">
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      <div className="ev2p-section-actions">
        {Number.isFinite(count) ? <b>{count}</b> : null}
        {actionLabel ? <Button variant="secondary" size="compact" onClick={onAction}>{actionLabel}</Button> : null}
        {action}
      </div>
    </div>
  );
}

export function ProjectSummary({ items }) {
  const content = (item) => <>
    <strong>{item.value}</strong>
    <span>{item.label}</span>
    {item.detail ? <small>{item.detail}</small> : null}
  </>;
  return (
    <div className="ev2p-summary">
      {items.map((item) => (
        <div key={item.label}>
          {item.onClick ? <button type="button" className="ev2p-summary-action" aria-pressed={Boolean(item.selected)} onClick={item.onClick}>{content(item)}</button> : content(item)}
        </div>
      ))}
    </div>
  );
}

export function ProjectEmpty({ title, description }) {
  return (
    <div className="ev2p-empty">
      <span><CeacIcon name="projects" size="feature" decorative /></span>
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}


// FPG4 accepted Project/Task gold-standard primitives. Keep visual markup stable unless a new reference is approved.
export function ProjectIssueTable({
  items = [],
  selectedId = null,
  objectiveById = new Map(),
  phaseById = new Map(),
  onSelect,
  formatDue,
  renderStatus,
}) {
  return (
    <div className="fpg-work-table-wrap">
      <table className="fpg-work-table">
        <thead>
          <tr>
            <th scope="col">Done</th>
            <th scope="col">Issue</th>
            <th scope="col">Date</th>
            <th scope="col">Tags</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const done = ["completed", "self_certified"].includes(item.status);
            const objective = objectiveById.get(item.objective_id);
            const phase = phaseById.get(item.phase_id);
            return (
              <tr
                key={item.id}
                className={selectedId === item.id ? "is-selected" : ""}
                onClick={() => onSelect?.(item.id)}
              >
                <td className="fpg-done-cell">
                  <span
                    className={done ? "fpg-readonly-check is-done" : "fpg-readonly-check"}
                    aria-label={done ? "Completed" : "Not completed"}
                  >
                    {done ? "✓" : ""}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="fpg-work-title"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect?.(item.id);
                    }}
                  >
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.ref} · {item.profiles?.full_name || "Unassigned"}</small>
                    </span>
                  </button>
                </td>
                <td>{formatDue?.(item.due_at)}</td>
                <td>
                  <div className="fpg-tag-stack">
                    {renderStatus?.(item.status)}
                    {phase && <span className="fpg-context-tag">{phase.name}</span>}
                    {objective && <span className="fpg-context-tag">{objective.ref}</span>}
                  </div>
                </td>
              </tr>
            );
          })}
          {!items.length && (
            <tr>
              <td colSpan="4">
                <div className="fpg-table-empty">No project work matches this view.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectWorkDrawer({
  item,
  projectName,
  description,
  onClose,
  onOpen,
  formatDue,
  formatDate,
  renderStatus,
}) {
  if (!item) return null;
  const attachments = (item.submissions || []).flatMap((submission) =>
    (submission.submission_files || []).map((file) => ({
      ...file,
      submitted_at: submission.submitted_at,
    })),
  );
  const completed = ["completed", "self_certified"].includes(item.status);
  const assignee = item.profiles?.full_name || "Unassigned";
  return (
    <div className="fpg-work-drawer-bg" role="presentation" onClick={onClose}>
      <aside
        className="fpg-work-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="fpg-drawer-top">
          <button type="button" className="fpg-drawer-close" aria-label="Close work preview" onClick={onClose}>×</button>
          <button type="button" className="fpg-drawer-open" onClick={() => onOpen?.(item.id)}>Open full record ↗</button>
        </div>
        <div className="fpg-drawer-title"><span>{item.ref}</span><h2>{item.title}</h2></div>
        <dl className="fpg-drawer-meta">
          <div><dt>Priority</dt><dd>Not recorded</dd></div>
          <div><dt>Status</dt><dd>{renderStatus?.(item.status)}</dd></div>
          <div><dt>Created date</dt><dd>{item.created_at ? formatDate?.(item.created_at) : "Not recorded"}</dd></div>
          <div><dt>Due date</dt><dd>{item.due_at ? formatDue?.(item.due_at) : "Not recorded"}</dd></div>
          <div><dt>Progress</dt><dd><span className="fpg-drawer-progress"><span aria-hidden="true"><i style={{ width: completed ? "100%" : "0%" }} /></span><b>{completed ? "Completed" : "Not recorded"}</b></span></dd></div>
          <div><dt>Assignees</dt><dd><span className="fpg-assignee"><b>{assignee === "Unassigned" ? "—" : assignee.slice(0,1).toUpperCase()}</b><span>{assignee}</span></span></dd></div>
          <div><dt>Project</dt><dd>{projectName || "Not recorded"}</dd></div>
          <div><dt>Type</dt><dd>{item.kind?.replaceAll("_", " ") || "Work"}</dd></div>
        </dl>
        {description ? <section className="fpg-drawer-description"><p>{description}</p></section> : <section className="fpg-drawer-description"><p>No description has been recorded.</p></section>}
        <section className="fpg-drawer-section">
          <div className="fpg-drawer-section-head"><h3>Attachments</h3><span>{attachments.length}</span></div>
          {attachments.length
            ? attachments.map((file, index) => (
              <div className="fpg-evidence-row" key={file.id || `${item.id}-evidence-${index}`}>
                <span>
                  <strong>Evidence file {index + 1}</strong>
                  <small>{file.submitted_at ? `Submitted ${formatDate?.(file.submitted_at)}` : "Submission date not recorded"}</small>
                </span>
                <b>Recorded</b>
              </div>
            ))
            : <p className="fpg-drawer-empty">No attachment or evidence file is recorded.</p>}
        </section>
        <section className="fpg-drawer-section">
          <div className="fpg-drawer-tabs">
            <button type="button" className="is-active">Subtasks <span>{item.checklist_items?.length || 0}</span></button>
            <button type="button" disabled title="Project discussion remains in the Project Room">Comments</button>
            <button type="button" disabled title="Open the full record for authoritative activity history">Activity</button>
          </div>
          {(item.checklist_items || []).length
            ? <div className="fpg-subtask-list">
              {[...(item.checklist_items || [])]
                .sort((a, b) => a.position - b.position)
                .map((step) => <div key={step.id}><i aria-hidden="true" /><span>{step.label}</span></div>)}
            </div>
            : <p className="fpg-drawer-empty">No checklist steps are recorded for this work item.</p>}
        </section>
      </aside>
    </div>
  );
}
