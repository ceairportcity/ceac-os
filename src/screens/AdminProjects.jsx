import { useEffect, useState } from "react";
import Stage2ProjectReader from "../components/Stage2ProjectReader";
import { supabase } from "../lib/supabase";
import { dateOnly } from "../lib/time";
import { LoadingState, ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import {
  ProjectContextRow,
  ProjectEmpty,
  ProjectPageHeader,
  ProjectSectionHeader,
  ProjectSummary,
} from "../experience-v2/project-family/ProjectFamilyV2";

export default function AdminProjects({ me, scheduleMeeting, openItem, initialProjectId = null, openProject }) {
  const [projects,setProjects]=useState([]);
  const selectedProjectId = initialProjectId;
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);

  useEffect(()=>{load();},[me.org_id]);

  async function load(){
    setLoading(true); setError(null);
    try{
      const [projectResult,unitResult,objectiveResult,projectUnitResult]=await Promise.all([
        supabase.from("projects").select("id,name,status,lead_unit_id,starts_on,ends_on,purpose").eq("org_id",me.org_id).order("ends_on",{ascending:true,nullsFirst:false}),
        supabase.from("units").select("id,name").eq("org_id",me.org_id),
        supabase.from("objectives").select("id,project_id,status").eq("org_id",me.org_id),
        supabase.from("project_units").select("project_id,unit_id"),
      ]);
      const failed=[projectResult,unitResult,objectiveResult,projectUnitResult].find((row)=>row.error);
      if(failed) throw failed.error;
      const unitById=Object.fromEntries((unitResult.data||[]).map((unit)=>[unit.id,unit.name]));
      setProjects((projectResult.data||[]).map((project)=>{
        const objectives=(objectiveResult.data||[]).filter((row)=>row.project_id===project.id);
        const participating=(projectUnitResult.data||[]).filter((row)=>row.project_id===project.id).map((row)=>unitById[row.unit_id]).filter(Boolean);
        return {...project,leadUnit:unitById[project.lead_unit_id]||"No lead unit",participating,objectives};
      }));
    }catch(err){setError(humanError(err,"Projects could not be loaded."));}
    finally{setLoading(false);}
  }

  if(loading) return <div className="body admin-projects ev2-project-page ev2-project-admin"><LoadingState label="Loading organisation projects…" /></div>;

  if (selectedProjectId) return <Stage2ProjectReader me={me} projectId={selectedProjectId} openItem={openItem} onBack={() => openProject?.(null)} />;

  const active=projects.filter((project)=>project.status==="active");
  const planned=projects.filter((project)=>project.status==="planned");
  const attention=projects.filter((project)=>project.objectives.some((row)=>["at_risk","not_met"].includes(row.status)));

  return <div className="body admin-projects ev2-project-page ev2-project-admin">
    <ProjectPageHeader
      eyebrow="Organisation delivery"
      title="Projects"
      description="Organisation-wide project movement, objective status and participating units. Detailed unit execution remains in the unit workspace."
    />

    {error&&<ProductNotice tone="error" title="Projects could not finish loading" action={<button className="btn btn-ghost btn-sm" onClick={load}>Try again</button>}>{error}</ProductNotice>}

    <ProjectSummary items={[
      {label:"Active projects",value:active.length,detail:"Recorded as active"},
      {label:"Planned projects",value:planned.length,detail:"Recorded as planned"},
      {label:"Need objective attention",value:attention.length,detail:"At risk or not met objective state"},
    ]} />

    <ProjectSectionHeader eyebrow="Delivery" title="Organisation projects" count={projects.length} />

    {projects.length===0&&<ProjectEmpty title="No projects recorded" description="Projects created by authorised managers will appear here." />}

    <div className="ev2p-context-list">
      {projects.map((project)=>{
        const onTrack=project.objectives.filter((row)=>["on_track","met"].includes(row.status)).length;
        const atRisk=project.objectives.filter((row)=>row.status==="at_risk").length;
        const notMet=project.objectives.filter((row)=>row.status==="not_met").length;
        const other=Math.max(0,project.objectives.length-onTrack-atRisk-notMet);
        const dateContext=project.starts_on||project.ends_on
          ? `${project.starts_on?dateOnly(project.starts_on):"No start date"} → ${project.ends_on?dateOnly(project.ends_on):"No end date"}`
          : "No project dates recorded";
        const projectUnits=project.participating.length?project.participating.join(", "):"No participating units recorded";
        const facts=project.objectives.length
          ? [
              {label:"Objectives",value:project.objectives.length},
              {label:"On track / met",value:onTrack},
              {label:"At risk",value:atRisk},
              {label:"Not met",value:notMet},
              ...(other?[{label:"Other states",value:other}]:[]),
            ]
          : [{label:"Objectives",value:"None recorded"}];

        return <ProjectContextRow
          key={project.id}
          eyebrow="Organisation project"
          title={project.name}
          meta={`Lead: ${project.leadUnit} · ${dateContext}`}
          note={`Project units: ${projectUnits} · ${project.purpose||"No purpose recorded."}`}
          status={project.status}
          facts={facts}
          actions={[{
            label:"Open project",
            onClick:()=>openProject?.(project.id),
          },{
            label:"Schedule project meeting",
            onClick:()=>scheduleMeeting?.({scope:"project",projectId:project.id,title:project.name+" meeting"}),
          }]}
        />;
      })}
    </div>
  </div>;
}
