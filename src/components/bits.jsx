import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EV2_TRANSITIONS } from "../experience-v2/motion";


export function Pill({ tone, children }) {
  return <span className={"pill p-" + tone}>{children}</span>;
}

export function FieldGroup({ label, hint, children, className = "" }) {
  return <label className={`field-group ${className}`.trim()}>
    <span className="field-label">{label}</span>
    {children}
    {hint && <span className="field-hint">{hint}</span>}
  </label>;
}

export function ProductNotice({ tone = "info", title, children, action = null }) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : EV2_TRANSITIONS.fast;
  return <motion.div
    className={`product-notice product-notice-${tone}`}
    role={tone === "error" ? "alert" : "status"}
    aria-live={tone === "error" ? "assertive" : "polite"}
    aria-atomic="true"
    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    transition={transition}
  >
    {title && <strong>{title}</strong>}
    {children && <span>{children}</span>}
    {action}
  </motion.div>;
}

export function EmptyState({ title, children, action = null, compact = false }) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}>
    <strong>{title}</strong>
    {children && <span>{children}</span>}
    {action}
  </div>;
}

export function LoadingState({ label = "Loading…" }) {
  return <div className="loading-state" role="status" aria-live="polite">
    <span className="loading-state-dot" aria-hidden="true" />
    <span>{label}</span>
  </div>;
}

export function Avatar({ name = "", src = null, size = "md" }) {
  const initials = String(name || "?").trim().split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase()).join("") || "?";
  return <span className={`avatar avatar-${size}`} aria-hidden="true">
    {src ? <img src={src} alt="" /> : initials}
  </span>;
}

export function StatusDistribution({ segments = [], label = "Status distribution" }) {
  const safe = segments.filter((segment) => Number(segment.value) > 0);
  const total = safe.reduce((sum, segment) => sum + Number(segment.value || 0), 0);
  return <div className="status-distribution" aria-label={label}>
    <div className="status-distribution-track">
      {total > 0 ? safe.map((segment) => <span
        key={segment.key || segment.label}
        className={`status-distribution-segment tone-${segment.tone || "neutral"}`}
        style={{ width:`${(Number(segment.value) / total) * 100}%` }}
        title={`${segment.label}: ${segment.value}`}
      />) : <span className="status-distribution-empty" />}
    </div>
    <div className="status-distribution-legend">
      {segments.map((segment) => <span key={segment.key || segment.label}><i className={`tone-${segment.tone || "neutral"}`} />{segment.label}<b>{segment.value}</b></span>)}
    </div>
  </div>;
}

export function ProgressMeter({ value = 0, max = 0, label, detail }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100)) : 0;
  return <div className="progress-meter">
    <div className="progress-meter-head"><strong>{label}</strong>{detail && <span>{detail}</span>}</div>
    <div className="progress-meter-track"><span style={{ width:`${pct}%` }} /></div>
  </div>;
}

export function SectionHeader({ eyebrow, title, count, action = null }) {
  return <div className="section-header">
    <div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>
    <div className="section-header-actions">{count !== undefined && count !== null && <b>{count}</b>}{action}</div>
  </div>;
}
export function statusPill(status) {
  if (status === "in_progress") return <Pill tone="green">In progress</Pill>;
  if (status === "in_review") return <Pill tone="amber">In review</Pill>;
  if (status === "waiting_on") return <Pill tone="amber">Waiting on</Pill>;
  if (status === "returned") return <Pill tone="brick">Sent back</Pill>;
  if (status === "completed") return <Pill tone="green">Completed</Pill>;
  if (status === "self_certified") return <Pill tone="green">Self-certified</Pill>;
  return <Pill tone="grey">Not started</Pill>;
}
export function Sheet({ children, onClose, className = "", ariaLabel, dismissDisabled = false }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const dismissDisabledRef = useRef(dismissDisabled);
  const [open, setOpen] = useState(true);
  const reduceMotion = useReducedMotion();
  const requestClose = useCallback(() => { if (!dismissDisabledRef.current) setOpen(false); }, []);

  useEffect(() => { onCloseRef.current = onClose; dismissDisabledRef.current = dismissDisabled; }, [onClose, dismissDisabled]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") { requestClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href], [tabindex]:not([tabindex='-1'])")]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [requestClose]);

  const backdropTransition = reduceMotion ? { duration: 0 } : EV2_TRANSITIONS.fast;
  const panelTransition = reduceMotion ? { duration: 0 } : EV2_TRANSITIONS.panel;

  return (
    <AnimatePresence onExitComplete={() => onCloseRef.current?.()}>
      {open ? [
        <motion.div
          key="sheet-backdrop"
          className="sheet-bg"
          onClick={requestClose}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
        />,
        <motion.div
          key="sheet-panel"
          ref={dialogRef}
          className={`sheet ${className}`.trim()}
          role="dialog"
          aria-label={ariaLabel}
          aria-modal="true"
          tabIndex={-1}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={panelTransition}
        >
          <button type="button" className="sheet-close" aria-label="Close dialog" disabled={dismissDisabled} onClick={requestClose}>×</button>
          {children}
        </motion.div>,
      ] : null}
    </AnimatePresence>
  );
}
