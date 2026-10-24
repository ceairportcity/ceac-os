import { useEffect, useRef, useState } from "react";
import { Drawer } from "../components";
import { CeacIcon } from "../icons";

function staticSearchGroups(query, navigation, quickItems) {
  const normalized = query.trim().toLowerCase();
  const destinationsByKey = new Map(navigation.map((item) => [item.key, item]));
  if (!destinationsByKey.has("announcements")) {
    destinationsByKey.set("announcements", { key: "announcements", label: "Announcements", icon: "messages" });
  }
  const destinations = [...destinationsByKey.values()]
    .filter((item) => !normalized || [item.label, item.searchTerms].filter(Boolean).join(" ").toLowerCase().includes(normalized))
    .map((item) => ({ kind: "destination", id: item.key, title: item.label, icon: item.icon, destination: item.key }));
  const actions = quickItems
    .filter((item) => !normalized || [item.label, item.searchTerms].filter(Boolean).join(" ").toLowerCase().includes(normalized))
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

export default function GlobalSearch({
  mobile = false,
  me,
  isAdmin = false,
  isExec = false,
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
    setRecordGroups([]);
    const timer = window.setTimeout(async () => {
      try {
        const { searchCeacRecords } = await import("../../lib/globalSearch");
        const groups = await searchCeacRecords({
          query: cleaned, me, isAdmin,
          onPartial: (partialGroups, issue) => {
            if (cancelled) return;
            if (issue?.error) {
              const category = issue.source === "organisation" ? "Organisation" : "Work";
              setError(`${category} search could not be verified. ${issue.error}`);
              return;
            }
            // Concurrent partial catalogues are independently authorised. A
            // slower Work response must not erase an already-arrived Unit, nor
            // may a Unit response erase the Work results before final settle.
            if (partialGroups.some((group) => group.items.length)) {
              setRecordGroups((current) => {
                const byKey = new Map(current.map((group) => [group.key, group]));
                for (const group of partialGroups) byKey.set(group.key, group);
                return [...byKey.values()];
              });
            }
          },
        });
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
      else if (item.kind === "file" && item.file) {
        const { openOperationalFile } = await import("../../lib/operationalFiles");
        await openOperationalFile(item.file);
      }
      setOpen(false);
    } catch (openError) {
      setError(openError?.message || "That result could not be opened.");
    }
  }

  const groups = [...staticGroups, ...recordGroups];
  const results = <SearchGroups groups={groups} loading={loading} error={error} query={query} onSelect={selectResult} />;

  if (mobile) {
    return <>
      <button ref={triggerRef} type="button" className="ev2s-mobile-profile ev2s-mobile-search" aria-label="Search CEAC" onClick={() => setOpen(true)}>
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
        <div className="ev2s-destination-search ev2s-search-sheet-field">
          <CeacIcon name="search" size="row" decorative />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isExec ? "Search across CEAC OS..." : "Search CEAC…"}
            aria-label={isExec ? "Search across CEAC OS" : "Search CEAC"}
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
      placeholder={isExec ? "Search across CEAC OS..." : "Search CEAC…"}
      aria-label={isExec ? "Search across CEAC OS" : "Search CEAC"}
      aria-expanded={open}
    />
    <kbd>⌘ K</kbd>
    {open ? <div className="ev2s-destination-palette" role="dialog" aria-label="Search CEAC results">{results}</div> : null}
  </div>;
}
