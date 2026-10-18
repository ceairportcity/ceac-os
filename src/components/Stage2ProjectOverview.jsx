import { useEffect, useMemo, useState } from "react";
import { deadlineOverdue } from "../lib/stage2AchievementMetrics";
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
  const [asOf, setAsOf] = useState(() => Date.now());
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

  const people = useMemo(() => {
    const found = new Map();
    for (const item of work) {
      if (!item.assignee_id || !item.profiles?.full_name) continue;
      const previous = found.get(item.assignee_id) || { id: item.assignee_id, name: item.profiles.full_name, count: 0 };
      previous.count++;
      found.set(item.assignee_id, previous);
    }
    return [...found.values()].sort((a,b) => a.name.localeCompare(b.name));
  }, [work]);

  const visible = tasks.filter((item) => (filter === "all" || (filter === "finished" ? finished.has(item.status) : !inactive.has(item.status))) &&
    (unit === "all" || item.unit_id === unit) &&
    [item.title, item.ref, item.profiles?.full_name].some((value) => String(value || "").toLowerCase().includes(search.trim().toLowerCase())));
  const recent = work.filter((item) => item.created_at).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
  return <div className="s2-project">
    <section className="s2-project-metrics" aria-label="Recorded project metrics">
      <div className="s2-project-stat-card s2-project-progress-card">
        <span>Visible task completion</span>
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
        <span>Visible participating departments</span>
        <strong>{units.length}</strong><small>Including the lead department</small>
      </div>
      <div className="s2-project-stat-card">
        <span>Next key date</span>
        <strong className="s2-project-date">{when(next?.due_at)}</strong>
        <small>{next?.title || "No upcoming due date"}</small>
      </div>
    </section>
    <div className="s2-project-layout">
      <div className="s2-project-content">
        <section className="s2-project-panel">
          <header><h2>Project team</h2><small>{people.length} recorded assignees</small></header>
          <div className="s2-project-people">{people.map((person) => <div className="s2-project-person" key={person.id}>
            <PersonAvatar name={person.name} photoUrl={visiblePortraits[person.id]} /><span><strong>{person.name}</strong><small>{person.count} assigned work item{person.count === 1 ? "" : "s"}</small></span>
          </div>)}{!people.length && <p>No named assignees recorded yet.</p>}</div>
          <div className="s2-project-units"><header><h3>Departments involved</h3></header><div>{units.map((row) => <span key={row.id}><strong>{row.name}</strong><small>{row.lead ? "Lead" : "Participating"}</small></span>)}</div></div>
        </section>
        <section className="s2-project-panel">
          <header><h2>Project tasks</h2>{canAssign && <button className="s2-project-primary" onClick={addWork}>+ Add task</button>}</header>
          <div className="s2-project-filters">
            <input type="search" aria-label="Search project tasks" placeholder="Search tasks or assignees" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select aria-label="Task status" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All tasks</option><option value="active">Active</option><option value="finished">Finished</option></select>
            <select aria-label="Department" value={unit} onChange={(e) => setUnit(e.target.value)}><option value="all">All departments</option>{units.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
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
        <section><h3>Recently created work</h3>{recent.length ? <ol>{recent.map((item) => <li key={item.id}><button onClick={() => openWork?.(item.id)}>{item.title}</button><small>{when(item.created_at)}</small></li>)}</ol> : <p>No work records yet.</p>}</section>
      </aside>
    </div>
  </div>;
}
