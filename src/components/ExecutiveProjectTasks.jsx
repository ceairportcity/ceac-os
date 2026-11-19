import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { useEditorPosition } from "../lib/useEditorPosition";
import { isWorkOverdue } from "../lib/time";
import { RESPONSIBILITY_STATUS } from "../lib/responsibilityRegister";

const closed = new Set(["completed", "self_certified", "cancelled"]);
const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Accra" });

export function isActiveProjectTask(work) {
  return work.kind === "task" && !closed.has(work.status);
}

export default function ExecutiveProjectTasks({ me, project, openItem, assign }) {
  const [position, setPosition] = useEditorPosition(me, `executive-project-tasks:${project.id}`, {});
  const list = useRef(null);
  const restored = useRef(false);
  const query = position.query || "";
  const filter = position.filter || "active";
  const tasks = project.work.filter(row => row.kind === "task");
  const visible = tasks.filter(row => {
    if (filter === "active" && closed.has(row.status)) return false;
    if (filter === "finished" && !["completed", "self_certified"].includes(row.status)) return false;
    return [row.title, row.ref, row.profiles?.full_name].some(value => value?.toLowerCase().includes(query.trim().toLowerCase()));
  });

  useEffect(() => {
    if (restored.current || !position.item) return;
    restored.current = true;
    const row = list.current?.querySelector(`[data-task-id="${CSS.escape(position.item)}"]`);
    if (!row) return;
    row.focus({ preventScroll: true });
    row.scrollIntoView({ block: "nearest" });
  }, [position.item]);

  return <section className="ceac-exec-task-panel" aria-label="Project tasks">
    <header><div><h2>Project tasks</h2><p>{tasks.filter(isActiveProjectTask).length} active</p></div>
      {assign && <button type="button" className="btn" onClick={assign}>Assign task</button>}
    </header>
    <div className="ceac-exec-task-filters">
      <input type="search" className="field" value={query} aria-label="Search project tasks" placeholder="Search tasks or assignees"
        onChange={event => setPosition({ query: event.target.value, filter })} />
      <select className="field" value={filter} aria-label="Task status" onChange={event => setPosition({ query, filter: event.target.value })}>
        <option value="active">Active tasks</option><option value="all">All tasks</option><option value="finished">Finished tasks</option>
      </select>
    </div>
    {visible.length ? <ul ref={list} className="ceac-exec-task-list">
      {visible.map(work => {
        const due = work.due_at && new Date(work.due_at);
        const overdue = isWorkOverdue(work);
        return <li key={work.id}><button type="button" data-task-id={work.id} onClick={() => {
          setPosition({ query, filter, item: work.id });
          openItem(work.id);
        }}>
          <span className="ceac-exec-task-name"><strong>{work.title}</strong><small>{work.profiles?.full_name || "Unassigned"} · {due ? `Due ${dateLabel.format(due)}` : "No due date"}</small></span>
          <span className={overdue ? "ceac-exec-task-overdue" : ""}>{overdue ? "Past due" : RESPONSIBILITY_STATUS[work.status] || work.status?.replaceAll("_", " ") || "Status unavailable"}</span>
          <ChevronRight size={17} aria-hidden="true" />
        </button></li>;
      })}
    </ul> : <p className="screen-note">{tasks.length ? "No tasks match these filters." : "This project has no tasks yet."}</p>}
  </section>;
}
