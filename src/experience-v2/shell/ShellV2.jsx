import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, BrandMark, Drawer, PopoverMenu } from "../components";
import { CeacIcon } from "../icons";
import {
  getMobilePrimaryNavigation,
  getRoleName,
  getSecondaryNavigation,
  getShellNavigation,
  getShellQuickActions,
  groupDestinations,
  hasMultipleUnits,
} from "./navigation";

const globalSearchModule = import("./GlobalSearch");
const GlobalSearch = lazy(() => globalSearchModule);

function GlobalSearchSurface(props) {
  return <Suspense fallback={null}><GlobalSearch {...props} /></Suspense>;
}

const ACCRA_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Accra",
});

const ACCRA_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Africa/Accra",
});

function UnitSwitch({ me, onUnitChange, compact = false }) {
  if (!me?.memberships?.length) return null;

  return (
    <label className={compact ? "ev2s-unit-switch is-compact" : "ev2s-unit-switch"}>
      <CeacIcon name="organisation" size="meta" decorative />
      <span className="ev2s-visually-hidden">Current unit</span>
      <select
        aria-label="Current unit"
        value={me.unit_id || ""}
        onChange={(event) => onUnitChange?.(event.target.value)}
      >
        {me.memberships.map((membership) => (
          <option key={membership.unit_id} value={membership.unit_id}>
            {membership.unit_name || "Unit"} · {membership.role === "manager" ? "Manager" : "Staff"}
          </option>
        ))}
      </select>
      <CeacIcon name="chevronDown" size="meta" decorative />
    </label>
  );
}

function navigationContext({ me, isAdmin, isExec, isManager }) {
  return { me, isAdmin, isExec, isManager };
}

export function SideNav({
  tab,
  setTab,
  me,
  isAdmin = false,
  isExec = false,
  isManager = false,
  onUnitChange,
  onCreateWork,
  onCreateMinistryObjective,
  onCreateProject,
  onCreateAnnouncement,
  onCreateMeeting,
  onMessages,
  onComposeMessage,
  onGuide,
}) {
  const context = navigationContext({ me, isAdmin, isExec, isManager });
  const navigation = getShellNavigation(context);
  const role = getRoleName(context);
  const quickItems = getShellQuickActions(context, {
    onCreateWork,
    onCreateMinistryObjective,
    onCreateProject,
    onCreateAnnouncement,
    onCreateMeeting,
    onMessages,
    onComposeMessage,
  });

  return (
    <aside className="ev2s-sidebar" aria-label="CEAC workspace navigation">
      <div className="ev2s-sidebar-identity">
        <div className="ev2s-brand">
          <BrandMark size="md" className="ev2s-brand-mark" />
          <div className="ev2s-brand-copy">
            <strong>CEAC OS</strong>
            <span>People. Work. Ministry. Impact.</span>
          </div>
        </div>

        {hasMultipleUnits(me, context) ? (
          <UnitSwitch me={me} onUnitChange={onUnitChange} compact />
        ) : null}
      </div>

      <div className="ev2s-sidebar-main">
        <nav className="ev2s-sidebar-nav" aria-label="Primary navigation">
          {groupDestinations(navigation).map((group) => (
            <section key={group.key} className="ev2s-sidebar-group" aria-label={group.label}>
              <div className="ev2s-sidebar-group-label">{group.label}</div>
              <div className="ev2s-sidebar-group-items">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={tab === item.key ? "is-active" : ""}
                    aria-current={tab === item.key ? "page" : undefined}
                    onClick={() => setTab(item.key)}
                  >
                    <CeacIcon name={item.icon} size="nav" decorative />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>

        {quickItems.length ? <div className="fpg9-sidebar-quick" aria-label="Quick create">
          <span>Quick create</span>
          <div>
            {quickItems.map((item) => <button
              key={item.id}
              type="button"
              onClick={item.onSelect}
            >
              <CeacIcon name={item.icon} size="row" decorative />
              <span>{item.label}</span>
            </button>)}
          </div>
        </div> : null}
      </div>

      <div className="ev2s-sidebar-footer">
        {onGuide ? <button
          type="button"
          className={tab === "guide" ? "ev2s-sidebar-guide is-active" : "ev2s-sidebar-guide"}
          onClick={onGuide}
          aria-label="CEAC Guide"
        >
          <CeacIcon name="help" size="nav" decorative />
          <span>CEAC Guide</span>
          <CeacIcon name="chevronRight" size="meta" decorative />
        </button> : null}

        <button
          type="button"
          className="ev2s-sidebar-profile"
          onClick={() => setTab("me")}
          aria-label="Open My Hub"
        >
          <Avatar name={me?.full_name || "CEAC"} size="md" />
          <span className="ev2s-sidebar-profile-copy">
            <strong>{me?.full_name || "Account"}</strong>
            <small>{me?.unit_name || role}</small>
          </span>
          <CeacIcon name="chevronRight" size="meta" decorative />
        </button>
      </div>
    </aside>
  );
}

export function AppTopBar({
  me,
  roleLabel,
  tab,
  onProfile,
  onNavigate,
  isAdmin = false,
  isExec = false,
  isManager = false,
  onMessages,
  onComposeMessage,
  onCreateWork,
  onCreateMinistryObjective,
  onCreateProject,
  onCreateAnnouncement,
  onCreateMeeting,
  onOpenWork,
  onOpenProject,
  onOpenPerson,
  onOpenMeeting,
  onOpenRoom,
  onOpenAnnouncement,
  onGuide,
}) {
  const [clock, setClock] = useState(() => new Date());

  const context = useMemo(
    () => navigationContext({ me, isAdmin, isExec, isManager }),
    [me, isAdmin, isExec, isManager]
  );
  const navigation = useMemo(() => getShellNavigation(context), [context]);
  const current = navigation.find((item) => item.key === tab);
  const createItems = getShellQuickActions(context, {
    onCreateWork,
    onCreateMinistryObjective,
    onCreateProject,
    onCreateAnnouncement,
    onCreateMeeting,
    onComposeMessage,
    onMessages,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="ev2s-topbar">
      <GlobalSearchSurface
        me={me}
        isAdmin={isAdmin}
        isExec={isExec}
        navigation={navigation}
        quickItems={createItems}
        onNavigate={onNavigate}
        onOpenWork={onOpenWork}
        onOpenProject={onOpenProject}
        onOpenPerson={onOpenPerson}
        onOpenMeeting={onOpenMeeting}
        onOpenRoom={onOpenRoom}
        onOpenAnnouncement={onOpenAnnouncement}
      />

      <div className="ev2s-topbar-context" aria-label="Current workspace">
        <span>{roleLabel}</span>
        {current ? (
          <>
            <b aria-hidden="true">/</b>
            <strong>{current.label}</strong>
          </>
        ) : null}
      </div>

      <div className="ev2s-topbar-actions">
        {onGuide ? <button
          type="button"
          className="fpg9-topbar-message ev2s-context-help"
          onClick={onGuide}
          aria-label="Help for this page"
          title="Help for this page"
        >
          <CeacIcon name="help" size="row" decorative />
        </button> : null}

        {createItems.length ? (
          <PopoverMenu
            triggerLabel="Create"
            triggerText="Create"
            triggerIcon="create"
            items={createItems}
            align="end"
          />
        ) : null}

        {onMessages ? <button
          type="button"
          className={isExec ? "fpg9-topbar-message exec-redesign-notification" : "fpg9-topbar-message"}
          onClick={onMessages}
          aria-label={isExec ? "Open updates" : "Open messages"}
        >
          <CeacIcon name={isExec ? "notification" : "messages"} size="row" decorative />
        </button> : null}

        <div className="ev2s-accra-time" aria-label="Current date and time in Accra">
          <strong>{ACCRA_DATE.format(clock)}</strong>
          <small>Accra · {ACCRA_TIME.format(clock)}</small>
        </div>

        <button
          type="button"
          className="ev2s-profile-button"
          onClick={onProfile}
          aria-label="Open profile"
        >
          <Avatar name={me?.full_name || "CEAC"} size="sm" />
          <span>
            <strong>{me?.full_name || "Account"}</strong>
            <small>{me?.unit_name || roleLabel}</small>
          </span>
        </button>
      </div>
    </header>
  );
}

export function MobileTopBar({
  me,
  roleLabel = "Staff",
  isAdmin = false,
  isExec = false,
  isManager = false,
  onProfile,
  onUnitChange,
  onNavigate,
  onMessages,
  onComposeMessage,
  onCreateWork,
  onCreateMinistryObjective,
  onCreateProject,
  onCreateAnnouncement,
  onCreateMeeting,
  onOpenWork,
  onOpenProject,
  onOpenPerson,
  onOpenMeeting,
  onOpenRoom,
  onOpenAnnouncement,
  onGuide,
}) {
  const context = navigationContext({ me, isAdmin, isExec, isManager });
  const canSwitchUnit = hasMultipleUnits(me, context);
  const navigation = getShellNavigation(context);
  const quickItems = getShellQuickActions(context, {
    onCreateWork,
    onCreateMinistryObjective,
    onCreateProject,
    onCreateAnnouncement,
    onCreateMeeting,
    onMessages,
    onComposeMessage,
  });

  return (
    <header className={canSwitchUnit ? "ev2s-mobile-topbar has-unit-switch" : "ev2s-mobile-topbar"}>
      <div className="ev2s-mobile-toprow">
        <div className="ev2s-mobile-identity">
          <BrandMark size="sm" className="ev2s-brand-mark" />
          <span>
            <strong>CEAC OS</strong>
            <small>{isAdmin ? "Administration & HR" : me?.unit_name && me.unit_name !== roleLabel ? `${me.unit_name} · ${roleLabel}` : roleLabel}</small>
          </span>
        </div>

        <div className="ev2s-mobile-actions">
          <GlobalSearchSurface
            mobile
            me={me}
            isAdmin={isAdmin}
            isExec={isExec}
            navigation={navigation}
            quickItems={quickItems}
            onNavigate={onNavigate}
            onOpenWork={onOpenWork}
            onOpenProject={onOpenProject}
            onOpenPerson={onOpenPerson}
            onOpenMeeting={onOpenMeeting}
            onOpenRoom={onOpenRoom}
            onOpenAnnouncement={onOpenAnnouncement}
          />
          {onGuide ? <button
            type="button"
            className="ev2s-mobile-profile"
            aria-label="Help for this page"
            title="Help for this page"
            onClick={onGuide}
          >
            <CeacIcon name="help" size="row" decorative />
          </button> : null}
          {isExec && onMessages ? <button
            type="button"
            className="ev2s-mobile-profile exec-redesign-mobile-notification"
            aria-label="Open updates"
            onClick={onMessages}
          >
            <CeacIcon name="notification" size="row" decorative />
          </button> : null}
          <button
            type="button"
            className="ev2s-mobile-profile"
            aria-label="Open profile"
            onClick={onProfile}
          >
            <Avatar name={me?.full_name || "CEAC"} size="sm" />
          </button>
        </div>
      </div>

      {canSwitchUnit ? (
        <div className="ev2s-mobile-unit-context">
          <UnitSwitch me={me} onUnitChange={onUnitChange} />
        </div>
      ) : null}
    </header>
  );
}

function mobileAccessibleLabel(item) {
  if (item.key === "home") return "Home";
  if (item.key === "me") return "Me";
  return item.label;
}

export function Tabs({
  tab,
  setTab,
  isManager = false,
  isExec = false,
  isAdmin = false,
  me = null,
  onGuide,
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef(null);
  const context = navigationContext({ me, isAdmin, isExec, isManager });
  const primary = getMobilePrimaryNavigation(context);
  const secondary = getSecondaryNavigation(context);
  const grouped = groupDestinations(secondary);
  const role = getRoleName(context);

  useEffect(() => {
    setMoreOpen(false);
  }, [tab, isAdmin, isExec, isManager, me?.unit_id]);

  return (
    <>
      <Drawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        placement="bottom"
        title="More"
        description={role}
        returnFocusRef={moreTriggerRef}
      >
        <div className="ev2s-more-groups">
          {grouped.map((group) => (
            <section key={group.key} className="ev2s-more-group" aria-label={group.label}>
              <h4>{group.label}</h4>
              <div>
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={tab === item.key ? "is-active" : ""}
                    aria-current={tab === item.key ? "page" : undefined}
                    onClick={() => {
                      setMoreOpen(false);
                      setTab(item.key);
                    }}
                  >
                    <CeacIcon name={item.icon} size="nav" decorative />
                    <span>{item.label}</span>
                    <CeacIcon name="chevronRight" size="meta" decorative />
                  </button>
                ))}
              </div>
            </section>
          ))}
          {onGuide ? <section className="ev2s-more-group" aria-label="Help">
            <h4>Help</h4>
            <div>
              <button
                type="button"
                className={tab === "guide" ? "is-active" : ""}
                aria-current={tab === "guide" ? "page" : undefined}
                aria-label="CEAC Guide"
                onClick={() => {
                  setMoreOpen(false);
                  onGuide();
                }}
              >
                <CeacIcon name="help" size="nav" decorative />
                <span>CEAC Guide</span>
                <CeacIcon name="chevronRight" size="meta" decorative />
              </button>
            </div>
          </section> : null}
        </div>
      </Drawer>

      <nav className="ev2s-mobile-nav" aria-label="Mobile navigation">
        {primary.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-label={mobileAccessibleLabel(item)}
            className={tab === item.key ? "is-active" : ""}
            aria-current={tab === item.key ? "page" : undefined}
            onClick={() => setTab(item.key)}
          >
            <CeacIcon name={item.icon} size="nav" decorative />
            <span>{item.label}</span>
          </button>
        ))}

        <button
          ref={moreTriggerRef}
          type="button"
          aria-label="More"
          className={moreOpen || tab === "guide" || secondary.some((item) => item.key === tab) ? "is-active" : ""}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((value) => !value)}
        >
          <CeacIcon name="more" size="nav" decorative />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
