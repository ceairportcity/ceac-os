import { lazy, useEffect, useState } from "react";
import { projectCreatedAtLabel, projectCreatorLabel } from "../lib/projectAttribution";
import { supabase } from "../lib/supabase";

const Stage2ProjectReader = lazy(() => import("./Stage2ProjectReader"));

export default function AssignedProjects({ me, openItem, children }) {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    supabase.from("projects").select("id,name,created_by,created_at,creator_display_name", { count: "exact" })
      .eq("org_id", me.org_id).eq("assigned_person_id", me.id)
      .is("archived_at", null).order("name").order("id")
      .then(result => {
        if (!current) return;
        if (result.error || result.count !== result.data?.length) setFailed(true);
        else setProjects(result.data);
      });
    return () => { current = false; };
  }, [me.org_id, me.id]);

  if (selectedId) return <Stage2ProjectReader projectId={selectedId} me={me} openItem={openItem} onBack={() => setSelectedId(null)} />;
  return <>
    {projects.length > 0 && <section className="body" aria-labelledby="assigned-projects-heading">
      <h2 id="assigned-projects-heading">Projects assigned to me</h2>
      <ul>
        {projects.map(project => <li key={project.id}>
          <button className="btn btn-ghost" type="button" onClick={() => setSelectedId(project.id)}>{project.name}</button>
          <p className="screen-note">Created by {projectCreatorLabel(project, me)} · {projectCreatedAtLabel(project.created_at)}</p>
        </li>)}
      </ul>
    </section>}
    {failed && <p className="screen-note" role="status">Your assigned projects could not be loaded.</p>}
    {children}
  </>;
}
