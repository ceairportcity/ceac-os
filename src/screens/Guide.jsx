import { useEffect, useMemo, useState } from "react";
import { CeacIcon } from "../experience-v2/icons";
import { getRoleKey, getRoleName } from "../experience-v2/shell/navigation";
import {
  CEAC_GUIDE_GETTING_STARTED,
  CEAC_GUIDE_ROUTE_LABELS,
  CEAC_GUIDE_VERSION,
  guideArticlesForContext,
  guideArticlesForRole,
  searchGuideArticles,
} from "../guide/guideContent";
import "../guide/guide.css";


const GUIDE_PROGRESS_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function guideProgressKey(me) {
  return me?.id ? `ceac-guide-progress:${me.id}` : null;
}

function emptyGuideProgress() {
  return { version: CEAC_GUIDE_VERSION, completed: [], dismissed: false, expiresAt: Date.now() + GUIDE_PROGRESS_TTL_MS };
}

function readGuideProgress(me, role) {
  const key = guideProgressKey(me);
  if (!key) return emptyGuideProgress();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return emptyGuideProgress();
    const parsed = JSON.parse(raw);
    if (
      parsed?.version !== CEAC_GUIDE_VERSION
      || parsed?.role !== role
      || !Array.isArray(parsed?.completed)
      || Number(parsed?.expiresAt || 0) <= Date.now()
    ) {
      window.localStorage.removeItem(key);
      return emptyGuideProgress();
    }
    return {
      version: CEAC_GUIDE_VERSION,
      completed: parsed.completed.filter((item) => typeof item === "string"),
      dismissed: Boolean(parsed.dismissed),
      expiresAt: Number(parsed.expiresAt),
    };
  } catch {
    return emptyGuideProgress();
  }
}

function writeGuideProgress(me, role, progress) {
  const key = guideProgressKey(me);
  if (!key) return;
  const next = {
    version: CEAC_GUIDE_VERSION,
    role,
    completed: progress.completed,
    dismissed: progress.dismissed,
    expiresAt: Date.now() + GUIDE_PROGRESS_TTL_MS,
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Guide progress is optional local UI state; the product remains usable if storage is unavailable.
  }
}

function contextFor(me) {
  const isAdmin = Boolean(me?.is_admin);
  const isExec = Boolean(me?.is_exec);
  const isManager = !isAdmin && !isExec && me?.role === "manager";
  return { me, isAdmin, isExec, isManager };
}

export default function Guide({ me, contextTab = null, go }) {
  const roleContext = useMemo(() => contextFor(me), [me]);
  const role = getRoleKey(roleContext);
  const roleName = getRoleName(roleContext);
  const contextArticles = useMemo(
    () => guideArticlesForContext(role, contextTab),
    [role, contextTab]
  );
  const defaultId = contextArticles[0]?.id || "getting-started";
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultId);
  const checklist = CEAC_GUIDE_GETTING_STARTED[role] || [];
  const [progress, setProgress] = useState(() => readGuideProgress(me, role));

  useEffect(() => {
    setSelectedId(contextArticles[0]?.id || "getting-started");
    setQuery("");
  }, [contextTab, role]);

  useEffect(() => {
    setProgress(readGuideProgress(me, role));
  }, [me?.id, role]);

  function saveProgress(next) {
    setProgress(next);
    writeGuideProgress(me, role, next);
  }

  function toggleChecklistItem(id) {
    const complete = new Set(progress.completed);
    if (complete.has(id)) complete.delete(id);
    else complete.add(id);
    saveProgress({ ...progress, completed: [...complete] });
  }

  function dismissChecklist() {
    saveProgress({ ...progress, dismissed: true });
  }

  function showChecklist() {
    saveProgress({ ...progress, dismissed: false });
  }

  function resetChecklist() {
    saveProgress({ ...emptyGuideProgress(), dismissed: false });
  }

  const results = useMemo(() => {
    const searched = searchGuideArticles(role, query);
    if (query.trim() || !contextArticles.length) return searched;
    const priority = new Set(contextArticles.map((article) => article.id));
    return [...contextArticles, ...searched.filter((article) => !priority.has(article.id))];
  }, [role, query, contextArticles]);

  const allRoleArticles = useMemo(() => guideArticlesForRole(role), [role]);
  const selected = results.find((article) => article.id === selectedId)
    || allRoleArticles.find((article) => article.id === selectedId)
    || results[0]
    || allRoleArticles[0];

  useEffect(() => {
    if (results.length && !results.some((article) => article.id === selectedId)) {
      setSelectedId(results[0].id);
    }
  }, [results, selectedId]);

  const contextLabel = contextTab ? CEAC_GUIDE_ROUTE_LABELS[contextTab] : null;

  return <div className="ceac-guide">
    <header className="ceac-guide-header">
      <div>
        <div className="ceac-guide-eyebrow">CEAC Guide · {roleName}</div>
        <h1>Help that matches your work</h1>
        <p>Find what a feature means, how to use it, who can act, what happens next and what to do when something does not work.</p>
      </div>
      <div className="ceac-guide-version">Guide {CEAC_GUIDE_VERSION}</div>
    </header>

    {contextLabel ? <div className="ceac-guide-context" role="status">
      <strong>Help for {contextLabel}.</strong> The most relevant guidance for the page you came from is shown first.
    </div> : null}

    {!contextTab && !query.trim() ? (progress.dismissed
      ? <div className="ceac-guide-checklist-collapsed">
          <span>Getting Started is hidden.</span>
          <button type="button" onClick={showChecklist}>Show checklist</button>
        </div>
      : <section className="ceac-guide-checklist" aria-label="Getting Started checklist">
          <div className="ceac-guide-checklist-head">
            <div>
              <span>Getting Started</span>
              <strong>{progress.completed.length} of {checklist.length} complete</strong>
            </div>
            <div>
              <button type="button" onClick={resetChecklist}>Reset</button>
              <button type="button" onClick={dismissChecklist}>Dismiss</button>
            </div>
          </div>
          <div className="ceac-guide-checklist-items">
            {checklist.map((item) => {
              const done = progress.completed.includes(item.id);
              return <div key={item.id} className={done ? "is-done" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleChecklistItem(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
                <button type="button" onClick={() => go?.(item.route)}>Open</button>
              </div>;
            })}
          </div>
          <small>Only checklist step IDs, dismissal state, role, Guide version and a 90-day expiry are stored locally. No CEAC business records are cached.</small>
        </section>)
      : null}

    <label className="ceac-guide-search">
      <CeacIcon name="search" size="row" decorative />
      <span className="ev2s-visually-hidden">Search the CEAC Guide</span>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search the CEAC Guide…"
        autoComplete="off"
      />
    </label>

    <div className="ceac-guide-layout">
      <nav className="ceac-guide-index" aria-label="Guide topics">
        {results.length ? results.map((article) => <button
          key={article.id}
          type="button"
          className={selected?.id === article.id ? "is-active" : ""}
          aria-current={selected?.id === article.id ? "page" : undefined}
          onClick={() => setSelectedId(article.id)}
        >
          <strong>{article.title}</strong>
          <small>{article.summary}</small>
        </button>) : <div className="ceac-guide-empty">No guide topic matches that search. Try the feature name or the action you need to complete.</div>}
      </nav>

      {selected ? <article className="ceac-guide-article">
        <div className="ceac-guide-article-header">
          <div>
            <h2>{selected.title}</h2>
            <p>{selected.summary}</p>
          </div>
          {selected.primaryRoute && selected.primaryRoute !== "guide" ? <button
            type="button"
            className="ceac-guide-open"
            onClick={() => go?.(selected.primaryRoute)}
          >Open feature</button> : null}
        </div>

        {selected.sections.map((section) => <section key={section.title} className="ceac-guide-section">
          <h3>{section.title}</h3>
          {(section.body || []).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.steps?.length ? <ol>
            {section.steps.map((step) => <li key={step}>{step}</li>)}
          </ol> : null}
        </section>)}

        <div className="ceac-guide-safety">
          <strong>Support rule:</strong> never share your password, authentication code or recovery link. Technical troubleshooting does not automatically grant access to protected HR, Payroll, medical or confidential content.
        </div>
      </article> : null}
    </div>
  </div>;
}
