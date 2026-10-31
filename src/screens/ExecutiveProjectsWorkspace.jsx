import { useState } from "react";
import AdminProjects from "./AdminProjects";
import Delivery from "./Delivery";

/**
 * One Executive Projects destination. The register remains the canonical
 * project list and creation flow; delivery insights expose recorded programme
 * groupings, risks and milestones without duplicating another project list.
 */
export default function ExecutiveProjectsWorkspace({
  me, initialProjectId = null, initialView = "projects",
  openProject, openItem, scheduleMeeting, goAssign, openRoom,
}) {
  const [view, setView] = useState(initialView === "insights" && !initialProjectId ? "insights" : "projects");

  const select = (next) => {
    if (initialProjectId && openProject) openProject(null);
    setView(next);
  };

  return <div className="ev2-project-page executive-projects-consolidated">
    {!initialProjectId && <nav className="ev2p-tabs" role="tablist" aria-label="Executive project views">
      <button type="button" role="tab" className={view === "projects" ? "is-selected" : ""}
        aria-selected={view === "projects"} onClick={() => select("projects")}>All projects</button>
      <button type="button" role="tab" className={view === "insights" ? "is-selected" : ""}
        aria-selected={view === "insights"} onClick={() => select("insights")}>Delivery insights</button>
    </nav>}
    {view === "projects" || initialProjectId
      ? <AdminProjects me={me} initialProjectId={initialProjectId}
          openProject={openProject} openItem={openItem}
          scheduleMeeting={scheduleMeeting} goAssign={goAssign} openRoom={openRoom} />
      : <Delivery me={me} insightsOnly openItem={openItem}
          openProject={openProject} goAssign={goAssign} />}
  </div>;
}
