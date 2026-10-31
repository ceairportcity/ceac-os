import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { LoadingState, ProductNotice } from "./bits";
import ExecutiveProjectDepartments from "./ExecutiveProjectDepartments";
import Stage2ProjectOverview from "./Stage2ProjectOverview";
import { ProjectTabs, ProjectWorkspaceHeader } from "../experience-v2/project-family/ProjectFamilyV2";

/**
 * Stage 2 factual cross-role project inspector; explicit Executive actions
 * use independently authorised server contracts.
 * PostgREST and database RLS determine visible records. This never upgrades
 * access, estimates unavailable cross-unit numbers, or shows private work.
 */
export default function Stage2ProjectReader({ projectId, openItem, onBack, me, goAssign }) {
  const [reload, setReload] = useState(0);
  const [view, setView] = useState("overview");
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setProject(null);
    setError(null);
    (async () => {
      try {
        const projectResult = await supabase.from("projects")
          .select("id,org_id,kind,name,purpose,status,starts_on,ends_on,lead_unit_id,units!projects_lead_unit_id_fkey(name)")
          .eq("id", projectId).single();
        if (projectResult.error) throw projectResult.error;
        const [participation, phases, work, milestones] = await Promise.all([
          supabase.from("project_units")
            .select("project_id,unit_id,role,units!project_units_unit_id_fkey(name)", { count:"exact" })
            .eq("project_id", projectId),
          supabase.from("project_phases").select("id,name,ends_on,closed_at", { count:"exact" })
            .eq("project_id", projectId).order("position"),
          supabase.from("work_items")
            .select("id,ref,title,kind,status,created_at,due_at,unit_id,assignee_id,profiles!work_items_assignee_id_fkey(full_name)", { count:"exact" })
            .eq("project_id", projectId).neq("visibility", "private")
            .order("due_at", { ascending: true, nullsFirst: false }),
          supabase.from("project_milestones").select("id,name,status,target_on,completed_at", { count:"exact" })
            .eq("project_id", projectId).order("target_on", { ascending: true, nullsFirst: false }),
        ]);
        // Provider defaults can truncate a successful 2xx page. Never describe
        // partial authorised tasks/teams as complete project statistics.
        const fullyRead = (result) => !result.error && Array.isArray(result.data)
          && typeof result.count === "number" && result.count === result.data.length;
        if (![participation,phases,work].every(fullyRead))
          throw new Error("The authorised project records were incomplete.");
        const milestonesVerified = fullyRead(milestones);
        if (current) setProject({
          ...projectResult.data,
          participants: participation.data,
          phases: phases.data,
          work: work.data,
          milestones: milestonesVerified ? milestones.data : null,
        });
      } catch {
        if (current) setError("This project's authorised overview could not be verified. No private project data was displayed.");
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => { current = false; };
  }, [projectId, reload, me?.id, me?.org_id]);

  return <div className="ev2-project-page ev2-project-workspace s2-project-reader">
    {loading && <LoadingState label="Loading authorised project details…" />}
    {error && <ProductNotice tone="error" title="Project details unavailable">{error}</ProductNotice>}
    {project && <>
      <ProjectWorkspaceHeader kind={project.kind} title={project.name} purpose={project.purpose}
        status={project.status} context={project.units?.name || "Lead unit not recorded"} onBack={onBack} />
      <p className="screen-note">Every number below comes from work and delivery records available to your role. Project access does not expose private employee information.</p>
      {me?.is_exec && ["planned","active"].includes(project.status) && <div className="s2-project-quick-actions" aria-label="Project actions"><button type="button" className="btn btn-sm" onClick={() => goAssign?.({projectId:project.id})}>Assign project work</button><ExecutiveProjectDepartments me={me} project={project} onSaved={() => setReload(n => n+1)} /></div>}
      <ProjectTabs ariaLabel="Executive project details" items={[
        ["overview", "Overview"],
        ["people", "People & departments", project.participants.length],
        ["work", "Project tasks", project.work.filter(row => row.kind === "task").length],
        ["milestones", "Milestones & activity", project.milestones?.length ?? undefined],
      ]} value={view} onChange={setView} />
      <Stage2ProjectOverview key={project.id} project={project} section={view} openWork={openItem} canAssign={false} />
    </>}
    {!project && (loading || error) && <button type="button" className="btn btn-ghost" onClick={onBack}>Back to projects</button>}
  </div>;
}
