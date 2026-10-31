import { CeacIcon } from "../icons";
import { StatusBadge } from "../components";
import "./reporting-family.css";

const TONES = { success:"success", warning:"warning", danger:"danger", action:"action", neutral:"neutral" };

export function ReportingStatusBadge({ children, tone = "neutral" }) {
  return <StatusBadge tone={TONES[tone] || "neutral"} icon={false}>{children}</StatusBadge>;
}

export function ReportingPageHeader({ eyebrow, title = "Reports", description, statusLabel, statusTone = "neutral", onOpenAchievements = null }) {
  return <header className="ev2rep-header">
    <div className="ev2rep-header-copy">
      {eyebrow ? <span className="ev2rep-eyebrow">{eyebrow}</span> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    <div className="ev2rep-header-actions">
      {onOpenAchievements ? <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenAchievements}>My achievements</button> : null}
      {statusLabel ? <ReportingStatusBadge tone={statusTone}>{statusLabel}</ReportingStatusBadge> : null}
    </div>
  </header>;
}

export function ReportingTabs({ items, value, onChange, label = "Reporting views" }) {
  return <div className="ev2rep-tabs" aria-label={label}>
    {items.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} className={value === key ? "is-active" : ""} onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}

export function ReportingSection({ eyebrow, title, description, meta, children, className = "" }) {
  return <section className={`ev2rep-section ${className}`.trim()}>
    <div className="ev2rep-section-head">
      <div>{eyebrow ? <span>{eyebrow}</span> : null}<h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
      {meta ? <strong>{meta}</strong> : null}
    </div>
    <div className="ev2rep-section-body">{children}</div>
  </section>;
}

export function ReportingEvidenceGrid({ children }) {
  return <div className="ev2rep-evidence-grid">{children}</div>;
}

export function ReportingEvidenceCard({ value, label, detail = "Why?", onClick, tone = "neutral", icon = true }) {
  const Component = onClick ? "button" : "article";
  return <Component type={onClick ? "button" : undefined} className={`ev2rep-evidence is-${tone} ${onClick ? "is-interactive" : ""}`.trim()} onClick={onClick}>
    {icon && <span className="ev2rep-evidence-icon"><CeacIcon name="reports" size="row" decorative /></span>}
    <strong>{value}</strong>
    <span>{label}</span>
    {detail ? <small>{detail}</small> : null}
  </Component>;
}

export function ReportingRecordRow({ eyebrow, title, meta, note, statusLabel, statusTone = "neutral", onClick, children, className = "" }) {
  const Component = onClick ? "button" : "article";
  return <Component type={onClick ? "button" : undefined} onClick={onClick} className={`ev2rep-row ${onClick ? "is-interactive" : ""} ${className}`.trim()}>
    <span className="ev2rep-row-icon"><CeacIcon name="reports" size="row" decorative /></span>
    <span className="ev2rep-row-copy">
      {eyebrow ? <small>{eyebrow}</small> : null}
      <strong>{title}</strong>
      {meta ? <span>{meta}</span> : null}
      {note ? <p>{note}</p> : null}
    </span>
    {statusLabel ? <ReportingStatusBadge tone={statusTone}>{statusLabel}</ReportingStatusBadge> : null}
    {children ? <span className="ev2rep-row-actions">{children}</span> : null}
  </Component>;
}

export function ReportingEmpty({ title, description }) {
  return <div className="ev2rep-empty">
    <span><CeacIcon name="reports" size="feature" decorative /></span>
    <div><strong>{title}</strong>{description ? <p>{description}</p> : null}</div>
  </div>;
}

export function ReportingFootnote({ children }) {
  return <p className="ev2rep-footnote">{children}</p>;
}
