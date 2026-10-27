import { CeacIcon } from "../icons";
import { StatusBadge } from "../components";

const TONE_MAP = {
  green: "success",
  success: "success",
  blue: "action",
  action: "action",
  amber: "warning",
  warning: "warning",
  red: "danger",
  danger: "danger",
  grey: "neutral",
  neutral: "neutral",
};

function statusTone(tone) {
  return TONE_MAP[tone] || "neutral";
}

export function WorkforceContextBadge({ label, tone = "neutral" }) {
  if (!label) return null;
  return <StatusBadge tone={statusTone(tone)} icon={false}>{label}</StatusBadge>;
}

export function WorkforcePageHeader({
  eyebrow,
  title = "Workforce",
  description,
  statusLabel,
  statusTone: tone,
  action,
}) {
  return (
    <header className="ev2wf-header">
      <div className="ev2wf-header-copy">
        {eyebrow ? <span className="ev2wf-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action || (statusLabel ? <WorkforceContextBadge label={statusLabel} tone={tone} /> : null)}
    </header>
  );
}

export function WorkforceTabs({ items = [], value, onChange, ariaLabel = "Workforce sections" }) {
  return (
    <div className="ev2wf-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          className={value === key ? "is-selected" : ""}
          onClick={() => onChange?.(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function WorkforceTodayCard({
  name,
  meta,
  detail,
  statusLabel,
  statusTone: tone,
  children,
}) {
  return (
    <article className="ev2wf-today-card workforce-person">
      <div className="ev2wf-today-head">
        <span className="ev2wf-today-icon"><CeacIcon name="person" size="row" decorative /></span>
        <div>
          <strong>{name}</strong>
          {meta ? <span>{meta}</span> : null}
        </div>
        <WorkforceContextBadge label={statusLabel} tone={tone} />
      </div>
      {detail ? <p>{detail}</p> : null}
      {children}
    </article>
  );
}

export function WorkforceFactGrid({ items = [] }) {
  return (
    <div className="ev2wf-facts">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function WorkforceSection({ title, description, meta, children }) {
  return (
    <section className="ev2wf-section">
      <div className="ev2wf-section-head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {meta ? <span>{meta}</span> : null}
      </div>
      <div className="ev2wf-section-body">{children}</div>
    </section>
  );
}

export function WorkforceRecordRow({
  icon = "record",
  eyebrow,
  title,
  meta,
  note,
  statusLabel,
  statusTone: tone,
  className = "",
}) {
  return (
    <article className={`ev2wf-row ${className}`.trim()}>
      <span className="ev2wf-row-icon"><CeacIcon name={icon} size="row" decorative /></span>
      <div className="ev2wf-row-copy">
        {eyebrow ? <small>{eyebrow}</small> : null}
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
        {note ? <p>{note}</p> : null}
      </div>
      {statusLabel ? <div className="ev2wf-row-state"><WorkforceContextBadge label={statusLabel} tone={tone} /></div> : null}
    </article>
  );
}

export function WorkforceDecisionRow({
  icon = "calendar",
  eyebrow,
  title,
  meta,
  note,
  statusLabel,
  statusTone: tone,
  children,
}) {
  return (
    <article className="ev2wf-decision-row row">
      <span className="ev2wf-row-icon"><CeacIcon name={icon} size="row" decorative /></span>
      <div className="ev2wf-row-copy">
        {eyebrow ? <small>{eyebrow}</small> : null}
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
        {note ? <p>{note}</p> : null}
      </div>
      {statusLabel ? <div className="ev2wf-row-state"><WorkforceContextBadge label={statusLabel} tone={tone} /></div> : null}
      {children ? <div className="ev2wf-decision-actions">{children}</div> : null}
    </article>
  );
}

export function WorkforceEmpty({ title, description, compact = false }) {
  return (
    <div className={`ev2wf-empty ${compact ? "is-compact" : ""}`}>
      <span><CeacIcon name="time" size={compact ? "row" : "feature"} decorative /></span>
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

export function WorkforceFootnote({ children }) {
  return <p className="ev2wf-footnote">{children}</p>;
}
