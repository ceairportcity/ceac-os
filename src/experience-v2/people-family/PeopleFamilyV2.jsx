import "./people-family.css";
import { CeacIcon } from "../icons";
import { Avatar, Button, StatusBadge } from "../components";

export function PeopleBackButton({ onClick, label = "Team", ariaLabel }) {
  return (
    <button type="button" className="ev2p-back" aria-label={ariaLabel || `Back to ${label}`} onClick={onClick}>
      <CeacIcon name="chevronLeft" size="control" decorative />
      <span>{label}</span>
    </button>
  );
}

export function PeoplePersonHeader({
  name,
  src,
  eyebrow,
  subtitle,
  context,
}) {
  return (
    <header className="ev2p-person-header">
      <Avatar name={name} src={src} size="lg" />
      <div className="ev2p-person-header-copy">
        {eyebrow ? <span className="ev2p-eyebrow">{eyebrow}</span> : null}
        <h1>{name || "—"}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {context ? <small>{context}</small> : null}
      </div>
    </header>
  );
}

export function PeopleEvidenceSummary({ facts = [], note }) {
  return (
    <section className="ev2p-evidence-summary" aria-label="Factual operating context">
      <div className="ev2p-evidence-summary-grid">
        {facts.map((fact) => (
          <div key={fact.label} className={`ev2p-evidence-summary-item ${fact.tone ? `is-${fact.tone}` : ""}`}>
            <strong>{fact.value}</strong>
            <span>{fact.label}</span>
          </div>
        ))}
      </div>
      {note ? <p>{note}</p> : null}
    </section>
  );
}

export function PeopleWorkspaceSection({
  id,
  title,
  description,
  meta,
  children,
  className = "",
}) {
  return (
    <section id={id} className={`ev2p-workspace-section ${className}`.trim()}>
      <div className="ev2p-workspace-section-head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {meta ? <div className="ev2p-workspace-section-meta">{meta}</div> : null}
      </div>
      <div className="ev2p-workspace-section-body">{children}</div>
    </section>
  );
}

export function PeoplePageHeader({
  eyebrow,
  title,
  description,
  count,
  countLabel = "people",
  actionLabel,
  actionIcon = "create",
  onAction,
}) {
  return (
    <header className="ev2p-header">
      <div className="ev2p-header-copy">
        {eyebrow ? <span className="ev2p-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="ev2p-header-side">
        {Number.isFinite(count) ? (
          <div className="ev2p-count" aria-label={`${count} ${countLabel}`}>
            <strong>{count}</strong>
            <span>{countLabel}</span>
          </div>
        ) : null}
        {actionLabel ? (
          <Button icon={actionIcon} onClick={onAction}>{actionLabel}</Button>
        ) : null}
      </div>
    </header>
  );
}

export function PeopleRoomCard({ title = "Unit Room", description, onClick }) {
  return (
    <button type="button" className="ev2p-room" onClick={onClick}>
      <span className="ev2p-room-icon"><CeacIcon name="messages" size="row" decorative /></span>
      <span className="ev2p-room-copy">
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <CeacIcon name="chevronRight" size="meta" decorative />
    </button>
  );
}

export function PeopleSection({
  title,
  meta,
  description,
  open = true,
  onToggle,
  tone = "default",
  children,
}) {
  const collapsible = typeof onToggle === "function";
  return (
    <section className={`ev2p-section ev2p-section-${tone}`}>
      {collapsible ? (
        <button type="button" className="ev2p-section-head ev2p-section-toggle" onClick={onToggle} aria-expanded={open}>
          <span>
            <strong>{title}</strong>
            {description ? <small>{description}</small> : null}
          </span>
          <span className="ev2p-section-meta">
            {meta ? <b>{meta}</b> : null}
            <CeacIcon name={open ? "chevronUp" : "chevronDown"} size="meta" decorative />
          </span>
        </button>
      ) : (
        <div className="ev2p-section-head">
          <span>
            <strong>{title}</strong>
            {description ? <small>{description}</small> : null}
          </span>
          {meta ? <span className="ev2p-section-meta"><b>{meta}</b></span> : null}
        </div>
      )}
      {open ? <div className="ev2p-section-body">{children}</div> : null}
    </section>
  );
}

export function PeoplePersonRow({
  name,
  src,
  subtitle,
  context,
  status,
  statusTone = "neutral",
  onClick,
  trailing,
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`ev2p-person-row ${onClick ? "is-action" : ""}`} onClick={onClick}>
      <Avatar name={name} src={src} size="md" />
      <span className="ev2p-person-copy">
        <strong>{name || "—"}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
        {context ? <small>{context}</small> : null}
      </span>
      <span className="ev2p-person-tail">
        {status ? <StatusBadge tone={statusTone} icon={false}>{status}</StatusBadge> : null}
        {trailing}
        {onClick ? <CeacIcon name="chevronRight" size="meta" decorative /> : null}
      </span>
    </Tag>
  );
}



export function PeopleAdminPersonRow({
  name,
  src,
  subtitle,
  context,
  status,
  statusTone = "neutral",
  primaryFact,
  secondaryFact,
  onClick,
}) {
  return (
    <button type="button" className="ev2p-admin-person-row" onClick={onClick}>
      <Avatar name={name} src={src} size="md" />
      <span className="ev2p-person-copy">
        <strong>{name || "—"}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
        {context ? <small>{context}</small> : null}
      </span>
      <span className="ev2p-admin-person-context">
        {status ? <StatusBadge tone={statusTone} icon={false}>{status}</StatusBadge> : null}
        {primaryFact ? <strong>{primaryFact}</strong> : null}
        {secondaryFact ? <small>{secondaryFact}</small> : null}
      </span>
      <CeacIcon name="chevronRight" size="meta" decorative />
    </button>
  );
}

export function PeopleEvidencePerson({
  name,
  subtitle,
  context,
  status,
  statusTone = "neutral",
  onOpen,
  facts = [],
}) {
  return (
    <article className="ev2p-evidence-person">
      <button type="button" className="ev2p-evidence-person-main" onClick={onOpen}>
        <Avatar name={name} size="md" />
        <span className="ev2p-person-copy">
          <strong>{name || "—"}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
          {context ? <small>{context}</small> : null}
        </span>
        <span className="ev2p-person-tail">
          {status ? <StatusBadge tone={statusTone} icon={false}>{status}</StatusBadge> : null}
          <CeacIcon name="chevronRight" size="meta" decorative />
        </span>
      </button>
      {facts.length ? (
        <div className="ev2p-evidence-strip" aria-label={`Factual context for ${name || "person"}`}>
          {facts.map((fact) => (
            <button key={fact.label} type="button" onClick={fact.onClick}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function PeopleFactRow({
  icon = "info",
  title,
  subtitle,
  meta,
  tone = "neutral",
}) {
  return (
    <div className={`ev2p-fact-row ev2p-fact-${tone}`}>
      <span className="ev2p-fact-icon"><CeacIcon name={icon} size="row" decorative /></span>
      <span className="ev2p-fact-copy">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </span>
      {meta ? <span className="ev2p-fact-meta">{meta}</span> : null}
    </div>
  );
}

export function PeopleResourceRow({ title, category, description, href, pinned = false }) {
  return (
    <a className="ev2p-resource-row" href={href} target="_blank" rel="noreferrer noopener">
      <span className="ev2p-resource-icon"><CeacIcon name="file" size="row" decorative /></span>
      <span className="ev2p-resource-copy">
        <strong>{pinned ? `Pinned · ${title}` : title}</strong>
        {category ? <span>{category}</span> : null}
        {description ? <small>{description}</small> : null}
      </span>
      <CeacIcon name="external" size="meta" decorative />
    </a>
  );
}

export function PeopleEmpty({ title, description, actionLabel, onAction }) {
  return (
    <div className="ev2p-empty">
      <span className="ev2p-empty-icon"><CeacIcon name="people" size="feature" decorative /></span>
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {actionLabel ? <Button variant="secondary" size="compact" onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
