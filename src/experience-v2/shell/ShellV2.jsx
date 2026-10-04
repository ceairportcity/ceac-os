import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, BrandMark, Drawer, PopoverMenu } from "../components";
import { CeacIcon } from "../icons";
import { searchCeacRecords } from "../../lib/globalSearch";
import { openOperationalFile } from "../../lib/operationalFiles";
import {
  getMobilePrimaryNavigation,
  getRoleName,
  getSecondaryNavigation,
  getShellNavigation,
  getShellQuickActions,
  groupDestinations,
  hasMultipleUnits,
} from "./navigation";

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
    </aside>
  );
}

function staticSearchGroups(query, navigation, quickItems) {
  const normalized = query.trim().toLowerCase();
  const destinationsByKey = new Map(navigation.map((item) => [item.key, item]));
  if (!destinationsByKey.has("announcements")) {
    destinationsByKey.set("announcements", { key: "announcements", label: "Announcements", icon: "messages" });
  }
  const destinations = [...destinationsByKey.values()]
    .filter((item) => !normalized || item.label.toLowerCase().includes(normalized))
    .map((item) => ({ kind: "destination", id: item.key, title: item.label, icon: item.icon, destination: item.key }));
  const actions = quickItems
    .filter((item) => !normalized || item.label.toLowerCase().includes(normalized))
    .map((item) => ({ kind: "action", id: item.id, title: item.label, icon: item.icon, onSelect: item.onSelect }));
  return [
    actions.length ? { key: "actions", label: "Actions", items: actions } : null,
    destinations.length ? { key: "destinations", label: "Destinations", items: destinations } : null,
  ].filter(Boolean);
}

function SearchGroups({ groups, loading, error, query, onSelect }) {
  const hasItems = groups.some((group) => group.items.length);
  return <div className="ev2s-search-groups" aria-live="polite">
    {loading ? <div className="ev2s-search-state">Searching authorised CEAC records…</div> : null}
    {error ? <div className="ev2s-search-state is-error">{error}</div> : null}
    {!loading && !hasItems ? <div className="ev2s-search-state">
      {query.trim().length < 2 ? "Type at least 2 characters to search CEAC records." : "No matching authorised results."}
    </div> : null}
    {groups.map((group) => group.items.length ? <section key={group.key} className="ev2s-search-group" aria-label={group.label}>
      <div className="ev2s-destination-palette-label">{group.label}</div>
      {group.items.map((item) => <button key={`${group.key}:${item.kind}:${item.id}`} type="button" onClick={() => onSelect(item)}>
        <CeacIcon name={item.icon || "search"} size="row" decorative />
        <span className="ev2s-search-result-copy">
          <strong>{item.title}</strong>
          {item.meta ? <small>{item.meta}</small> : null}
        </span>
        <CeacIcon name={item.kind === "file" ? "external" : "chevronRight"} size="meta" decorative />
      </button>)}
    </section> : null)}
  </div>;
}

function GlobalSearch({
  mobile = false,
  me,
  isAdmin = false,
  navigation = [],
  quickItems = [],
  onNavigate,
  onOpenWork,
  onOpenProject,
  onOpenPerson,
  onOpenMeeting,
  onOpenRoom,
  onOpenAnnouncement,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recordGroups, setRecordGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const staticGroups = staticSearchGroups(query, navigation, quickItems);

  useEffect(() => {
    let cancelled = false;
    const cleaned = query.trim();
    if (cleaned.length < 2) {
      setRecordGroups([]);
      setLoading(false);
      setError(null);
      return undefined;
    }
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const groups = await searchCeacRecords({ query: cleaned, me, isAdmin });
        if (!cancelled) setRecordGroups(groups);
      } catch (searchError) {
        if (!cancelled) {
          setRecordGroups([]);
          setError(searchError?.message || "CEAC search could not load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, me?.id, me?.org_id, isAdmin]);

  useEffect(() => {
    if (mobile) return undefined;
    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobile]);

  async function selectResult(item) {
    setError(null);
    try {
      if (item.kind === "action") item.onSelect?.();
      else if (item.kind === "destination") onNavigate?.(item.destination);
      else if (item.kind === "work") onOpenWork?.(item.id);
      else if (item.kind === "project") onOpenProject?.(item.id);
      else if (item.kind === "person") onOpenPerson?.(item);
      else if (item.kind === "meeting") onOpenMeeting?.(item.id);
      else if (item.kind === "announcement") onOpenAnnouncement?.(item.id);
      else if (item.kind === "ministry") onNavigate?.("strategy");
      else if (["unit", "sub_team", "room"].includes(item.kind)) onOpenRoom?.(item.context);
      else if (item.kind === "file" && item.file) await openOperationalFile(item.file);
      setOpen(false);
    } catch (openError) {
      setError(openError?.message || "That result could not be opened.");
    }
  }

  const groups = [...staticGroups, ...recordGroups];
  const results = <SearchGroups groups={groups} loading={loading} error={error} query={query} onSelect={selectResult} />;

  if (mobile) {
    return <>
      <button ref={triggerRef} type="button" className="ev2s-mobile-search" aria-label="Search CEAC" onClick={() => setOpen(true)}>
        <CeacIcon name="search" size="row" decorative />
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Search CEAC"
        description="Only records your account is authorised to see are returned."
        returnFocusRef={triggerRef}
        panelClassName="ev2s-mobile-search-drawer"
      >
        <div className="ev2s-search-sheet-field">
          <CeacIcon name="search" size="row" decorative />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search CEAC…"
            aria-label="Search CEAC"
          />
        </div>
        {results}
      </Drawer>
    </>;
  }

  return <div className="ev2s-destination-search" ref={rootRef}>
    <CeacIcon name="search" size="row" decorative />
    <input
      ref={inputRef}
      value={query}
      onFocus={() => setOpen(true)}
      onChange={(event) => {
        setQuery(event.target.value);
        setOpen(true);
      }}
      placeholder="Search CEAC…"
      aria-label="Search CEAC"
      aria-expanded={open}
    />
    <kbd>⌘ K</kbd>
    {open ? <div className="ev2s-destination-palette" role="dialog" aria-label="Search CEAC results">{results}</div> : null}
  </div>;
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
      <GlobalSearch
        me={me}
        isAdmin={isAdmin}
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
        {createItems.length ? (
          <PopoverMenu
            triggerLabel="Create"
            triggerText="Create"
            triggerIcon="create"
            items={createItems}
            align="end"
          />
        ) : null}

        {onMessages ? <button type="button" className="fpg9-topbar-message" onClick={onMessages} aria-label="Open messages">
          <CeacIcon name="messages" size="row" decorative />
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
            <small>{me?.unit_name || roleLabel} · {roleLabel}</small>
          </span>
        </div>

        <div className="ev2s-mobile-actions">
          <GlobalSearch
            mobile
            me={me}
            isAdmin={isAdmin}
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
          className={moreOpen || secondary.some((item) => item.key === tab) ? "is-active" : ""}
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
