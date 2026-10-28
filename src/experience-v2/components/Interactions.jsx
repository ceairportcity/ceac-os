import {
  cloneElement,
  isValidElement,
  useEffect,
  useContext,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CeacIcon } from "../icons";
import { EV2_TRANSITIONS } from "../motion";
import { Button, IconButton } from "./Button";
import { Surface } from "./Surface";
import { RolePresentationContext } from "../RolePresentationContext";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useOverlayFocus(open, containerRef, onClose, returnFocusRef) {
  // Callback identity changes while typing are not an overlay lifecycle change.
  const latest = useRef({ onClose, returnFocusRef });
  useEffect(() => { latest.current = { onClose, returnFocusRef }; });
  useEffect(() => {
    if (!open) return undefined;

    const previous = latest.current.returnFocusRef?.current || document.activeElement;
    const node = containerRef.current;
    const first = node?.querySelector(FOCUSABLE);
    first?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        latest.current.onClose?.();
        return;
      }

      if (event.key !== "Tab" || !node) return;

      const items = [...node.querySelectorAll(FOCUSABLE)].filter(
        (item) => !item.hasAttribute("disabled") && item.getAttribute("aria-hidden") !== "true"
      );

      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      queueMicrotask(() => previous?.focus?.());
    };
  }, [open, containerRef]);
}

export function Tooltip({ label, children, placement = "top" }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  if (!isValidElement(children)) return children;

  const child = cloneElement(children, {
    "aria-describedby": open ? id : children.props["aria-describedby"],
    onFocus: (event) => {
      children.props.onFocus?.(event);
      setOpen(true);
    },
    onBlur: (event) => {
      children.props.onBlur?.(event);
      setOpen(false);
    },
    onMouseEnter: (event) => {
      children.props.onMouseEnter?.(event);
      setOpen(true);
    },
    onMouseLeave: (event) => {
      children.props.onMouseLeave?.(event);
      setOpen(false);
    },
  });

  return (
    <span className="ev2c-tooltip-wrap">
      {child}
      <AnimatePresence>
        {open ? (
          <motion.span
            id={id}
            role="tooltip"
            className={`ev2c-tooltip ev2c-tooltip-${placement}`}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={EV2_TRANSITIONS.fast}
          >
            {label}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

export function PopoverMenu({
  triggerLabel = "Open menu",
  triggerIcon = "more",
  triggerText,
  triggerVariant = "primary",
  items = [],
  align = "end",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    menuRef.current?.querySelector('[role="menuitem"]')?.focus();

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        queueMicrotask(() => triggerRef.current?.querySelector("button")?.focus());
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span className="ev2c-popover" ref={rootRef}>
      <span ref={triggerRef}>
        {triggerText ? (
          <Button
            icon={triggerIcon}
            variant={triggerVariant}
            aria-label={triggerLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {triggerText}
          </Button>
        ) : (
          <IconButton
            icon={triggerIcon}
            label={triggerLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          />
        )}
      </span>

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={menuRef}
            role="menu"
            className={`ev2c-menu ev2c-menu-${align}`}
            initial={{ opacity: 0, scale: 0.98, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={EV2_TRANSITIONS.fast}
          >
            {items.map((item) => (
              <button
                key={item.id || item.label}
                type="button"
                role="menuitem"
                className={`ev2c-menu-item ${item.danger ? "is-danger" : ""}`}
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                  queueMicrotask(() => triggerRef.current?.querySelector("button")?.focus());
                }}
              >
                {item.icon ? <CeacIcon name={item.icon} size="row" decorative /> : null}
                <span>{item.label}</span>
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

function OverlayShell({
  open,
  onClose,
  title,
  description,
  children,
  kind = "modal",
  placement = "right",
  footer,
  returnFocusRef,
  panelClassName = "",
  bodyClassName = "",
  footerClassName = "",
}) {
  const titleId = useId();
  const descriptionId = useId();
  const presentation = useContext(RolePresentationContext);
  const panelRef = useRef(null);

  useOverlayFocus(open, panelRef, onClose, returnFocusRef);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={presentation === "executive" ? "ev2c-overlay executive-app" : "ev2c-overlay"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={EV2_TRANSITIONS.fast}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose?.();
          }}
        >
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className={
              (kind === "drawer"
                ? `ev2c-drawer ev2c-drawer-${placement}`
                : "ev2c-modal") + (panelClassName ? ` ${panelClassName}` : "") + (presentation === "executive" ? " exec-v2" : "")
            }
            initial={
              kind === "drawer"
                ? placement === "bottom"
                  ? { y: 24, opacity: 0 }
                  : { x: 24, opacity: 0 }
                : { y: 8, opacity: 0, scale: 0.985 }
            }
            animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            exit={
              kind === "drawer"
                ? placement === "bottom"
                  ? { y: 24, opacity: 0 }
                  : { x: 24, opacity: 0 }
                : { y: 8, opacity: 0, scale: 0.985 }
            }
            transition={EV2_TRANSITIONS.panel}
          >
            <header className="ev2c-overlay-head">
              <div>
                <h3 id={titleId} className="ev2c-overlay-title">{title}</h3>
                {description ? (
                  <p id={descriptionId} className="ev2c-overlay-description">{description}</p>
                ) : null}
              </div>
              <IconButton icon="close" label="Close" variant="quiet" onClick={onClose} />
            </header>

            <div className={`ev2c-overlay-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>

            {footer ? <footer className={`ev2c-overlay-footer${footerClassName ? ` ${footerClassName}` : ""}`}>{footer}</footer> : null}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

export function ModalDialog(props) {
  return <OverlayShell {...props} kind="modal" />;
}

export function Drawer({
  placement = "right",
  ...props
}) {
  return <OverlayShell {...props} kind="drawer" placement={placement} />;
}

export function ComposerDrawer(props) {
  return <Drawer {...props} placement="right" panelClassName={`ev2c-composer-drawer ${props.panelClassName || ""}`.trim()} bodyClassName={`ev2c-composer-body ${props.bodyClassName || ""}`.trim()} footerClassName={`ev2c-composer-footer ${props.footerClassName || ""}`.trim()} />;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirm action",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  returnFocusRef,
}) {
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="ev2c-confirm-copy">
        Review the consequence before continuing. The application should keep destructive work explicit and reversible where possible.
      </p>
    </ModalDialog>
  );
}

export function Skeleton({
  variant = "line",
  width = "100%",
  height,
  className = "",
}) {
  const style = {
    width,
    ...(height ? { height } : {}),
  };

  return (
    <span
      className={`ev2c-skeleton ev2c-skeleton-${variant} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  );
}

const STATE_ICONS = {
  empty: "folder",
  error: "error",
  configuration: "settings",
  success: "checkCircle",
  info: "info",
};

export function StatePanel({
  state = "empty",
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  icon,
}) {
  return (
    <Surface
      variant="soft"
      padding="spacious"
      className={`ev2c-state ev2c-state-${state}`}
      role={state === "error" ? "alert" : undefined}
      aria-live={state === "error" ? "assertive" : undefined}
      aria-atomic={state === "error" ? "true" : undefined}
    >
      <span className="ev2c-state-icon">
        <CeacIcon name={icon || STATE_ICONS[state] || "info"} size="empty" decorative />
      </span>
      <div className="ev2c-state-copy">
        <h4 className="ev2c-state-title">{title}</h4>
        {description ? <p className="ev2c-state-description">{description}</p> : null}
      </div>
      {actionLabel || secondaryLabel ? (
        <div className="ev2c-state-actions">
          {actionLabel ? <Button onClick={onAction}>{actionLabel}</Button> : null}
          {secondaryLabel ? <Button variant="secondary" onClick={onSecondary}>{secondaryLabel}</Button> : null}
        </div>
      ) : null}
    </Surface>
  );
}

export function Toast({
  open,
  tone = "neutral",
  title,
  description,
  actionLabel,
  onAction,
  onClose,
}) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : EV2_TRANSITIONS.panel;
  const initialState = reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.985 };
  const exitState = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 };
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`ev2c-toast ev2c-toast-${tone}`}
          role={tone === "danger" ? "alert" : "status"}
          aria-live={tone === "danger" ? "assertive" : "polite"}
          aria-atomic="true"
          initial={initialState}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={exitState}
          transition={transition}
        >
          <span className="ev2c-toast-icon">
            <CeacIcon
              name={tone === "danger" ? "error" : tone === "success" ? "checkCircle" : "info"}
              size="row"
              decorative
            />
          </span>
          <span className="ev2c-toast-copy">
            <strong>{title}</strong>
            {description ? <span>{description}</span> : null}
          </span>
          {actionLabel ? (
            <button type="button" className="ev2c-toast-action" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          <IconButton icon="close" label="Dismiss notification" variant="quiet" size="compact" onClick={onClose} />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
