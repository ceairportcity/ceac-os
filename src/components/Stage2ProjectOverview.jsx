import MemoProjectOrigin from "./MemoProjectOrigin";
import { useEffect, useMemo, useState } from "react";
import { deadlineOverdue } from "../lib/stage2AchievementMetrics";
import { currentProjectActions, visibleProjectPeople } from "../lib/projectContributionPeople";
import { supabase } from "../lib/supabase";
import PersonAvatar from "./PersonAvatar";
import { useProjectPortraits } from "../lib/useProjectPortraits";
import "./Stage2ProjectOverview.css";

const finished = new Set(["completed", "self_certified"]);
const inactive = new Set(["completed", "self_certified", "cancelled"]);
const when = (value) => {
  if (!value) return "Not recorded";
  const d = new Date(value.length === 10 ? value + "T12:00:00Z" : value);
  return Number.isNaN(d.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", day: "numeric", month: "short", year: "numeric" }).format(d);
};
const initials = (name) => String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "—";

export default function Stage2ProjectOverview({ project, openWork, addWork, showWork, canAssign, photoUrls = {} }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [unit, setUnit] = useState("all");
  const [filterProjectKey, setFilterProjectKey] = useState("");
  const [asOf, setAsOf] = useState(() => Date.now());
  const [sourceActions, setSourceActions] = useState([]);
  const [completedProjectKey, setCompletedProjectKey] = useState("");
  const [actionLoading, setActionLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [actionReload, setActionReload] = useState(0);
  const projectEvidenceKey = `${project.org_id}:${project.id}`;
  const projectFilterReady = filterProjectKey === projectEvidenceKey;
  const scopedSearch = projectFilterReady ? search : "";
  const scopedFilter = projectFilterReady ? filter : "all";
  const scopedUnit = projectFilterReady ? unit : "all";
  useEffect(() => {
    setSearch(""); setFilter("all"); setUnit("all"); setFilterProjectKey(projectEvidenceKey);
  }, [project.id, project.org_id]);
  const activityChecking = actionLoading || completedProjectKey !== projectEvidenceKey;
  const displayActionError = completedProjectKey === projectEvidenceKey ? actionError : "";
  const visibleActions = !activityChecking && !displayActionError ? sourceActions : [];
  // Discard evidence from the previously mounted project before effects run.

  // Read only real, permission-filtered, immutable contribution records.
  // Creating a work item is not evidence that someone did work.
  useEffect(() => {
    let active = true;
    setActionLoading(true); setActionError(""); setSourceActions([]); setCompletedProjectKey("");
    (async () => {
      try {
        const collected = [];
        let total = null;
        const pageSize = 200;
        // The source-backed people list must not infer total contributors
        // from only the latest six actions. Fail closed if records exceed
        // the explicit bounded verification window.
        for (let page = 0; page < 20; page++) {
          const first = page * pageSize;
          const evidence = await supabase.from("work_activity_records")
            .select("id,work_item_id,contributor_id,activity_date,activity_state,action_summary,recorded_at,supersedes_id,contributor:profiles!work_activity_records_contributor_id_fkey(full_name)", { count: "exact" })
            .eq("org_id", project.org_id).eq("source_project_id", project.id)
            .order("recorded_at", { ascending: false }).order("id", { ascending: false })
            .range(first, first + pageSize - 1);
          if (evidence.error) throw evidence.error;
          if (typeof evidence.count !== "number" || !Array.isArray(evidence.data)
            || (total !== null && total !== evidence.count))
            throw new Error("Project activity changed during reading. Refresh.");
          total = evidence.count;
          collected.push(...evidence.data);
          if (collected.length === total) break;
        }
        if (collected.length !== total)
          throw new Error("Project activity exceeds the verified display window. Request a report.");
        if (active) setSourceActions(currentProjectActions(collected));
      } catch (error) {
        if (active) setActionError(/PGRST205|42P01|work_activity_records/.test(String(error?.message || ""))
          ? "Project activity is awaiting its authorised database migration."
          : "Recent project activity could not be verified.");
      } finally {
        if (active) { setCompletedProjectKey(projectEvidenceKey); setActionLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [project.id, project.org_id, actionReload]);
  // Project due dates (including date-only promises) must follow the Ghana
  // civil day without marking an entire still-valid deadline day overdue.
  useEffect(() => {
    const refresh = () => setAsOf(Date.now());
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const signedPortraits = useProjectPortraits(project);
  const visiblePortraits = { ...signedPortraits, ...photoUrls };
  const work = project.work || [];
  const tasks = work.filter((row) => row.kind === "task");
  const completed = tasks.filter((row) => finished.has(row.status));
  const completionRate = tasks.length ? Math.round(100 * completed.length / tasks.length) : null;
  const open = tasks.filter((row) => !inactive.has(row.status));
  const overdue = open.filter((row) => deadlineOverdue(row.due_at, asOf));
  const next = open.filter((row) => row.due_at && !deadlineOverdue(row.due_at, asOf))
    .sort((a,b) => new Date(a.due_at) - new Date(b.due_at))[0];

  const units = useMemo(() => {
    const found = new Map();
    if (project.lead_unit_id) found.set(project.lead_unit_id, { id: project.lead_unit_id, name: project.units?.name || "Lead unit", lead: true });
    for (const row of project.participants || []) {
      if (!row.unit_id) continue;
      const existing = found.get(row.unit_id);
      found.set(row.unit_id, { id: row.unit_id, name: row.units?.name || existing?.name || "Unit not recorded", lead: existing?.lead || row.role === "lead" });
    }
    return [...found.values()];
  }, [project]);

  const people = useMemo(() => visibleProjectPeople(work, visibleActions), [work, visibleActions]);
  const recentActions = visibleActions.slice(0, 6);

  const visible = tasks.filter((item) => (scopedFilter === "all" || (scopedFilter === "finished" ? finished.has(item.status) : !inactive.has(item.status))) &&
    (scopedUnit === "all" || item.unit_id === scopedUnit) &&
    [item.title, item.ref, item.profiles?.full_name].some((value) => String(value || "").toLowerCase().includes(scopedSearch.trim().toLowerCase())));
  return <div className="s2-project">
    <MemoProjectOrigin project={project} />
    <div className="s2-project-layout">
      <div className="s2-project-content">
    <section className="s2-project-metrics" aria-label="Recorded project metrics">
      <div className="s2-project-stat-card s2-project-progress-card">
        <span>Task completion</span>
        <div className="s2-project-progress-line">
          <span className="s2-project-progress-ring" style={{ "--s2-percent": completionRate ?? 0 }} aria-hidden="true">
            <strong>{completionRate === null ? "—" : completionRate + "%"}</strong>
          </span>
          <small>{completed.length} of {tasks.length} tasks complete</small>
        </div>
      </div>
      <div className="s2-project-stat-card">
        <span>Tasks</span>
        <div className="s2-project-task-facts">
          <strong>{completed.length}<small>Completed</small></strong>
          <strong>{open.length}<small>Open</small></strong>
          <strong className="is-overdue">{overdue.length}<small>Overdue</small></strong>
        </div>
      </div>
      <div className="s2-project-stat-card">
        <span>Departments</span>
        <strong>{units.length}</strong><small>Including the lead department</small>
      </div>
      <div className="s2-project-stat-card">
        <span>Next key date</span>
        <strong className="s2-project-date">{when(next?.due_at)}</strong>
        <small>{next?.title || "No upcoming due date"}</small>
      </div>
    </section>
        <section className="s2-project-panel">
          <header><h2>Project team</h2><small aria-label={people.length + " people with visible assignments or dated actions"}>{people.length} {people.length === 1 ? "person" : "people"}</small></header>
          {displayActionError && <p role="alert">Additional contributors could not be verified; only visible assignments are shown.</p>}
          <div className="s2-project-people">{people.map((person) => <div className="s2-project-person" key={person.id}>
            <PersonAvatar name={person.name} photoUrl={visiblePortraits[person.id]} /><span><strong>{person.name}</strong>
              <small>{person.assignedWorkCount} assigned · {person.recordedActionCount} dated action{person.recordedActionCount === 1 ? "" : "s"}</small></span>
          </div>)}{!people.length && <p>No visible assignments or dated contributions yet.</p>}</div>
          <div className="s2-project-units"><header><h3>Departments involved</h3></header><div>{units.map((row) => <span key={row.id}><strong>{row.name}</strong><small>{row.lead ? "Lead" : "Participating"}</small></span>)}</div></div>
        </section>
        <section className="s2-project-panel">
          <header><h2>Project tasks</h2>{canAssign && <button className="s2-project-primary" onClick={addWork}>+ Add task</button>}</header>
          <div className="s2-project-filters">
            <input type="search" aria-label="Search project tasks" placeholder="Search tasks or assignees" value={scopedSearch} onChange={(e) => setSearch(e.target.value)} />
            <select aria-label="Task status" value={scopedFilter} onChange={(e) => setFilter(e.target.value)}><option value="all">All tasks</option><option value="active">Active</option><option value="finished">Finished</option></select>
            <select aria-label="Department" value={scopedUnit} onChange={(e) => setUnit(e.target.value)}><option value="all">All departments</option>{units.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
          </div>
          <div className="s2-project-table-scroll"><table><thead><tr><th>Task</th><th>Department</th><th>Assigned to</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>{visible.map((item) => <tr key={item.id}>
            <td><button className="s2-project-task" onClick={() => openWork?.(item.id)}>{item.title}<small>{item.ref}</small></button></td>
            <td><span className="s2-project-unit-chip">{units.find((dept) => dept.id === item.unit_id)?.name || (item.unit_id === project.lead_unit_id ? project.units?.name || "Lead unit" : "Not recorded")}</span></td>
            <td>{item.profiles?.full_name ? <span className="s2-project-personcell"><PersonAvatar name={item.profiles.full_name} photoUrl={visiblePortraits[item.assignee_id]} size={25} />{item.profiles.full_name}</span> : "Unassigned"}</td><td>{when(item.due_at)}</td>
            <td><span className={finished.has(item.status) ? "s2-project-done" : "s2-project-pending"}>{String(item.status || "Not recorded").replaceAll("_"," ")}</span></td>
          </tr>)}</tbody></table></div>
          {!visible.length && <p className="s2-project-empty">No recorded tasks match this view.</p>}
          {showWork && work.length > tasks.length && <button className="s2-project-more" onClick={showWork}>View all project work →</button>}
        </section>
      </div>
      <aside className="s2-project-panel s2-project-aside">
        <header><h2>About this project</h2></header>
        <dl><div><dt>Status</dt><dd>{project.status || "Not recorded"}</dd></div><div><dt>Lead unit</dt><dd>{project.units?.name || "Not recorded"}</dd></div><div><dt>Start date</dt><dd>{when(project.starts_on)}</dd></div><div><dt>End date</dt><dd>{when(project.ends_on)}</dd></div></dl>
        {project.purpose && <section><h3>Description</h3><p>{project.purpose}</p></section>}
        <section><h3>Key milestones</h3>{project.milestones === null ? <p>Milestone records are unavailable to this view.</p> : project.milestones?.length ? <ol className="s2-project-milestones">{project.milestones.map((milestone) => <li key={milestone.id} className={milestone.status === "achieved" ? "is-complete" : ""}><strong>{milestone.name}</strong><small>{String(milestone.status || "Not recorded").replaceAll("_", " ")} · {milestone.completed_at ? "Completed " + when(milestone.completed_at) : milestone.target_on ? "Target " + when(milestone.target_on) : "No recorded date"}</small></li>)}</ol> : <p>No milestones recorded.</p>}</section>
        <section className="s2-project-recent-activity" aria-label="Recent visible project activity" aria-description="Recorded actions visible to your account; entries are not automatic approvals.">
          <header><h3>Recent activity</h3><button type="button" onClick={() => setActionReload((n) => n + 1)}
            disabled={activityChecking}>Refresh</button></header>
          {activityChecking && <p role="status">Verifying project activity…</p>}
          {displayActionError && <p role="alert">{displayActionError}</p>}
          {!activityChecking && !displayActionError && !recentActions.length && <p>No activity recorded in this view yet.</p>}
          {!activityChecking && !displayActionError && recentActions.length > 0 && <ol>{recentActions.map((entry) =>
            <li key={entry.id}>
              <button type="button" onClick={() => openWork?.(entry.work_item_id)}>
                <strong>{entry.action_summary}</strong>
              </button>
              <small>{when(entry.activity_date)} · {entry.contributor?.full_name || "Authorised contributor"} · {String(entry.activity_state || "recorded").replaceAll("_", " ")}</small>
            </li>
          )}</ol>}
        </section>
      </aside>
    </div>
  </div>;
}
