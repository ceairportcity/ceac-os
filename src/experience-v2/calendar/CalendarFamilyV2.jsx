import "./calendar.css";
import { useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button, IconButton, QueueRow, SegmentedControl, StatusBadge } from "../components";
import { CeacIcon } from "../icons";
import { EV2_TRANSITIONS } from "../motion";

export function calendarDateKey(date) {
  const value = date instanceof Date ? date : new Date(date);
  const pad = (part) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function CalendarPageHeader({
  eyebrow,
  title = "Calendar",
  description,
  status,
  statusTone = "neutral",
  action,
}) {
  return (
    <header className="ev2cal-page-head">
      <div className="ev2cal-page-copy">
        {eyebrow ? <span className="ev2cal-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="ev2cal-page-actions">
        {status ? <StatusBadge tone={statusTone} icon={false}>{status}</StatusBadge> : null}
        {action}
      </div>
    </header>
  );
}

export function CalendarViewTabs({ value, onChange, items, ariaLabel = "Calendar view" }) {
  return <SegmentedControl ariaLabel={ariaLabel} value={value} onChange={onChange} items={items} />;
}

export function CalendarPeriodControls({
  label,
  onPrevious,
  onNext,
  onToday,
  previousLabel = "Previous period",
  nextLabel = "Next period",
  todayLabel = "Today",
}) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : EV2_TRANSITIONS.fast;

  return (
    <div className="ev2cal-period" aria-label="Calendar period controls">
      <IconButton icon="chevronLeft" label={previousLabel} variant="secondary" onClick={onPrevious} />
      <span className="ev2cal-period-label" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.strong
            key={label}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={transition}
          >
            {label}
          </motion.strong>
        </AnimatePresence>
      </span>
      <IconButton icon="chevronRight" label={nextLabel} variant="secondary" onClick={onNext} />
      {onToday ? <Button variant="quiet" size="compact" icon="calendar" onClick={onToday}>{todayLabel}</Button> : null}
    </div>
  );
}

export function CalendarFilters({ value, onChange, items, ariaLabel = "Calendar filters" }) {
  return (
    <div className="ev2cal-filters">
      <SegmentedControl
        ariaLabel={ariaLabel}
        value={value}
        onChange={onChange}
        items={items}
      />
    </div>
  );
}

function EventChip({ event, onOpen }) {
  const actionable = Boolean(event.onClick || onOpen);
  const content = <>
    <span className="ev2cal-event-dot" aria-hidden="true" />
    <span>{event.title}</span>
  </>;
  const props = {
    className: `ev2cal-event is-${event.tone || event.kind || "neutral"}`,
    title: event.meta || event.title,
  };

  if (actionable) {
    return (
      <button
        type="button"
        {...props}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          if (event.onClick) event.onClick(event);
          else onOpen?.(event);
        }}
      >
        {content}
      </button>
    );
  }
  return <span {...props}>{content}</span>;
}

export function CalendarMonthGrid({
  days = [],
  currentMonth,
  selectedDateKey,
  onSelectDate,
  getEvents = () => [],
  onOpenEvent,
  todayKey = calendarDateKey(new Date()),
  maxEventsPerDay = 3,
  ariaLabel = "Calendar month",
}) {
  const instanceId = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();

  return (
    <div className="ev2cal-month" role="grid" aria-label={ariaLabel}>
      <div className="ev2cal-weekdays" role="row">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day} role="columnheader">{day}</span>
        ))}
      </div>
      <div className="ev2cal-grid">
        {days.map((date) => {
          const key = calendarDateKey(date);
          const events = getEvents(key) || [];
          const muted = Number.isInteger(currentMonth) && date.getMonth() !== currentMonth;
          const selected = key === selectedDateKey;
          const today = key === todayKey;
          const dateLabel = date.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return (
            <div
              key={key}
              role="gridcell"
              className={[
                "ev2cal-day",
                muted ? "is-muted" : "",
                selected ? "is-selected" : "",
                today ? "is-today" : "",
              ].filter(Boolean).join(" ")}
            >
              <button
                type="button"
                className="ev2cal-day-button"
                aria-label={`${dateLabel}${events.length ? `, ${events.length} recorded item${events.length === 1 ? "" : "s"}` : ""}`}
                aria-pressed={selected}
                aria-current={today ? "date" : undefined}
                onClick={() => onSelectDate?.(key, date)}
              >
                {selected ? (
                  <motion.span
                    className="ev2cal-selection-indicator"
                    layoutId={`ev2cal-selection-${instanceId}`}
                    transition={reduceMotion ? { duration: 0 } : EV2_TRANSITIONS.reflow}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="ev2cal-day-number">{date.getDate()}</span>
                {today ? <small>Today</small> : null}
              </button>
              <div className="ev2cal-day-events">
                {events.slice(0, maxEventsPerDay).map((event) => (
                  <EventChip key={event.id} event={event} onOpen={onOpenEvent} />
                ))}
                {events.length > maxEventsPerDay ? (
                  <button
                    type="button"
                    className="ev2cal-more"
                    onClick={() => onSelectDate?.(key, date)}
                    aria-label={`Show all ${events.length} items on ${dateLabel}`}
                  >
                    +{events.length - maxEventsPerDay} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarAgenda({
  eyebrow = "Selected date",
  title,
  description,
  events = [],
  emptyTitle = "Nothing recorded",
  emptyDescription = "No calendar item is recorded for this date.",
  onOpenEvent,
}) {
  return (
    <section className="ev2cal-agenda" aria-label={title || "Selected date agenda"}>
      <header className="ev2cal-agenda-head">
        <div>
          <span className="ev2cal-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <StatusBadge tone={events.length ? "action" : "neutral"} icon={false}>
          {events.length} item{events.length === 1 ? "" : "s"}
        </StatusBadge>
      </header>
      <div className="ev2cal-agenda-body">
        {events.length ? events.map((event) => (
          <QueueRow
            key={event.id}
            icon={event.icon || (event.kind === "meeting" ? "meeting" : event.kind === "work" ? "work" : "calendar")}
            title={event.title}
            meta={event.meta}
            status={event.status}
            statusTone={event.statusTone || "neutral"}
            onClick={event.onClick ? () => event.onClick(event) : onOpenEvent ? () => onOpenEvent(event) : undefined}
          />
        )) : (
          <div className="ev2cal-empty">
            <CeacIcon name="calendar" size="feature" decorative />
            <div><strong>{emptyTitle}</strong><span>{emptyDescription}</span></div>
          </div>
        )}
      </div>
    </section>
  );
}

export function CalendarTimeline({ groups = [], onOpenEvent }) {
  return (
    <div className="ev2cal-timeline">
      {groups.map((group) => (
        <section className="ev2cal-timeline-day" key={group.key}>
          <time dateTime={group.key}>{group.label}</time>
          <div className="ev2cal-timeline-list">
            {group.events.map((event) => (
              <QueueRow
                key={event.id}
                icon={event.icon || (event.kind === "meeting" ? "meeting" : "calendar")}
                title={event.title}
                meta={event.meta}
                status={event.status || event.type}
                statusTone={event.statusTone || "neutral"}
                onClick={event.onClick ? () => event.onClick(event) : onOpenEvent ? () => onOpenEvent(event) : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
