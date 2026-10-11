import { CeacIcon } from "../icons";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";
import { Surface } from "./Surface";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function StatTile({
  label,
  value,
  supporting,
  icon,
  tone = "neutral",
  onClick,
  href,
  className,
}) {
  const content = (
    <>
      <span className={joinClasses("ev2c-stat-icon", `ev2c-stat-icon-${tone}`)}>
        {icon ? <CeacIcon name={icon} size="row" decorative /> : null}
      </span>
      <span className="ev2c-stat-copy">
        <span className="ev2c-stat-label">{label}</span>
        <strong className="ev2c-stat-value">{value}</strong>
        {supporting ? <span className="ev2c-stat-supporting">{supporting}</span> : null}
      </span>
      {onClick || href ? <CeacIcon name="chevronRight" size="meta" decorative /> : null}
    </>
  );

  const classes = joinClasses("ev2c-stat", onClick || href ? "is-interactive" : "", className);

  if (href) {
    return <a className={classes} href={href}>{content}</a>;
  }

  if (onClick) {
    return <button className={classes} type="button" onClick={onClick}>{content}</button>;
  }

  return <div className={classes}>{content}</div>;
}

export function QueueRow({
  icon = "task",
  title,
  meta,
  status,
  statusTone = "neutral",
  trailing,
  onClick,
  className,
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={joinClasses("ev2c-queue-row", onClick ? "is-interactive" : "", className)}
    >
      <span className="ev2c-row-icon"><CeacIcon name={icon} size="row" decorative /></span>
      <span className="ev2c-row-copy">
        <span className="ev2c-row-title">{title}</span>
        {meta ? <span className="ev2c-row-meta">{meta}</span> : null}
      </span>
      {status ? <StatusBadge tone={statusTone}>{status}</StatusBadge> : null}
      {trailing ?? (onClick ? <CeacIcon name="chevronRight" size="meta" decorative /> : null)}
    </Component>
  );
}

export function RecordRow({
  avatar,
  name,
  title,
  meta,
  status,
  statusTone = "neutral",
  onClick,
  className,
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={joinClasses("ev2c-record-row", onClick ? "is-interactive" : "", className)}
    >
      <Avatar src={avatar} alt="" name={name} size="md" />
      <span className="ev2c-row-copy">
        <span className="ev2c-row-title">{title || name}</span>
        {meta ? <span className="ev2c-row-meta">{meta}</span> : null}
      </span>
      {status ? <StatusBadge tone={statusTone}>{status}</StatusBadge> : null}
      {onClick ? <CeacIcon name="chevronRight" size="meta" decorative /> : null}
    </Component>
  );
}

export function ActionFocusCard({
  eyebrow,
  title,
  supporting,
  icon = "work",
  status,
  statusTone = "action",
  actionLabel,
  onAction,
  className,
}) {
  return (
    <Surface variant="feature" padding="standard" className={joinClasses("ev2c-focus-card", className)}>
      <div className="ev2c-focus-main">
        <span className="ev2c-focus-icon"><CeacIcon name={icon} size="feature" decorative /></span>
        <div className="ev2c-focus-copy">
          {eyebrow ? <span className="ev2c-focus-eyebrow">{eyebrow}</span> : null}
          <h4 className="ev2c-focus-title">{title}</h4>
          {supporting ? <p className="ev2c-focus-supporting">{supporting}</p> : null}
        </div>
        {status ? <StatusBadge tone={statusTone}>{status}</StatusBadge> : null}
      </div>
      {actionLabel ? (
        <div className="ev2c-focus-action">
          <Button onClick={onAction} icon="arrowRight" iconPosition="end">{actionLabel}</Button>
        </div>
      ) : null}
    </Surface>
  );
}

export function DataPanel({
  id,
  eyebrow,
  title,
  supporting,
  action,
  children,
  className,
  surfaceVariant = "section",
}) {
  return (
    <Surface id={id} variant={surfaceVariant} padding={surfaceVariant === "section" ? "none" : "standard"} className={joinClasses("ev2c-data-panel", className)}>
      <div className="ev2c-data-panel-head">
        <div>
          {eyebrow ? <span className="ev2c-data-eyebrow">{eyebrow}</span> : null}
          <h4 className="ev2c-data-title">{title}</h4>
          {supporting ? <p className="ev2c-data-supporting">{supporting}</p> : null}
        </div>
        {action ? <div className="ev2c-data-action">{action}</div> : null}
      </div>
      <div className="ev2c-data-panel-body">{children}</div>
    </Surface>
  );
}

export function ProgressDistribution({ items = [], className }) {
  return (
    <div className={joinClasses("ev2c-progress-list", className)}>
      {items.map((item) => {
        const percent = Math.max(0, Math.min(100, Number(item.percent) || 0));
        return (
          <div className="ev2c-progress-item" key={item.label}>
            <div className="ev2c-progress-labels">
              <span>{item.label}</span>
              <span>{item.value ?? `${percent}%`}</span>
            </div>
            <div
              className="ev2c-progress-track"
              role="progressbar"
              aria-label={item.label}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={percent}
            >
              <span className="ev2c-progress-fill" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Timeline({ items = [], className }) {
  return (
    <ol className={joinClasses("ev2c-timeline", className)}>
      {items.map((item) => (
        <li className="ev2c-timeline-item" key={item.id || item.title}>
          <span className="ev2c-timeline-marker"><CeacIcon name={item.icon || "clock"} size="meta" decorative /></span>
          <div className="ev2c-timeline-copy">
            <div className="ev2c-timeline-topline">
              <span className="ev2c-row-title">{item.title}</span>
              {item.time ? <time className="ev2c-row-meta">{item.time}</time> : null}
            </div>
            {item.meta ? <span className="ev2c-row-meta">{item.meta}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
