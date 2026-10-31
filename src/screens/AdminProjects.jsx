import { useEffect, useState } from "react";
import ManagerProjects from "./ManagerProjects";
import Stage2ProjectReader from "../components/Stage2ProjectReader";
import AdminProjectComposer from "../components/AdminProjectComposer";
import { supabase } from "../lib/supabase";
import { dateOnly } from "../lib/time";
import { LoadingState, ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { Button } from "../experience-v2/components";
import {
  ProjectContextRow,
  ProjectEmpty,
  ProjectPageHeader,
  ProjectSectionHeader,
  ProjectSummary,
} from "../experience-v2/project-family/ProjectFamilyV2";

export default function AdminProjects({ me, scheduleMeeting, openItem, initialProjectId = null, openProject, goAssign, openRoom }) {
  const [projects,setProjects]=useState([]);
  const [units,setUnits]=useState([]);
  const [creating,setCreating]=useState(false);
  const selectedProjectId = initialProjectId;
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");

  useEffect(()=>{load();},[me.org_id]);

  async function load(){
    setLoading(true); setError(null); setProjects([]);
    try{
      const [projectResult,unitResult,objectiveResult,projectUnitResult]=await Promise.all([
        supabase.from("projects").select("id,name,status,lead_unit_id,starts_on,ends_on,purpose").eq("org_id",me.org_id).order("ends_on",{ascending:true,nullsFirst:false}),
        supabase.from("units").select("id,name,active").eq("org_id",me.org_id),
        supabase.from("objectives").select("id,project_id,status").eq("org_id",me.org_id),
        supabase.from("project_units").select("project_id,unit_id"),
      ]);
      const failed=[projectResult,unitResult,objectiveResult,projectUnitResult].find((row)=>row.error);
      if(failed) throw failed.error;
      const unitById=Object.fromEntries((unitResult.data||[]).map((unit)=>[unit.id,unit.name]));
      setUnits(unitResult.data||[]);
      setProjects((projectResult.data||[]).map((project)=>{
        const objectives=(objectiveResult.data||[]).filter((row)=>row.project_id===project.id);
        const participating=(projectUnitResult.data||[]).filter((row)=>row.project_id===project.id).map((row)=>unitById[row.unit_id]).filter(Boolean);
        return {...project,leadUnit:unitById[project.lead_unit_id]||"No lead unit",participating,objectives};
      }));
    }catch(err){setError(humanError(err,"Projects could not be loaded."));}
    finally{setLoading(false);}
  }


  if(loading) return <div className="body admin-projects ev2-project-page ev2-project-admin"><LoadingState label="Loading organisation projects…" /></div>;
  if(error) return <div className="body admin-projects ev2-project-page ev2-project-admin"><ProductNotice tone="error" title="Projects could not finish loading" action={<button className="btn btn-ghost btn-sm" onClick={load}>Try again</button>}>{error}</ProductNotice></div>;

  const selected = projects.find(project => project.id === selectedProjectId);
  if (selectedProjectId && !selected) return <div className="body admin-projects"><button className="back" onClick={()=>openProject?.(null)}>← Projects</button><ProductNotice tone="error" title="Project unavailable">This project could not be verified in your organisation.</ProductNotice></div>;
  if (selected && me.is_exec) return <Stage2ProjectReader key={`${me.org_id}:${me.id}:${selected.id}`}
    projectId={selected.id} me={me} openItem={openItem} onBack={()=>openProject?.(null)} goAssign={goAssign} />;
  if (selected) return <ManagerProjects key={`${me.org_id}:${me.id}:${selected.id}`} me={me} projectUnitId={selected.lead_unit_id}
    initialProjectId={selected.id} back={()=>openProject?.(null)} openItem={openItem}
    goAssign={context=>goAssign?.({...context,unitId:selected.lead_unit_id})} openRoom={openRoom} scheduleMeeting={scheduleMeeting} />;

  const active=projects.filter((project)=>project.status==="active");
  const planned=projects.filter((project)=>project.status==="planned");
  const attention=projects.filter((project)=>project.objectives.some((row)=>["at_risk","not_met"].includes(row.status)));
  const statusMatches=filter==="active"?active:filter==="planned"?planned:filter==="attention"?attention:projects;
  const query=search.trim().toLocaleLowerCase();
  const visible=statusMatches.filter(project=>!query||[project.name,project.purpose,project.leadUnit,...project.participating].some(value=>String(value||"").toLocaleLowerCase().includes(query)));
  const chooseFilter=(next)=>setFilter(current=>current===next?"all":next);

  return <div className="body admin-projects ev2-project-page ev2-project-admin">
    <ProjectPageHeader
      eyebrow={me.is_exec?"Executive delivery":"Organisation delivery"}
      title="Projects"
      description={me.is_exec?"See what your teams are delivering, what needs attention and where to make decisions.":"Plan projects, check progress and keep departments working together."}
      actionLabel="Create project" onAction={()=>setCreating(true)}
    />

    {creating&&<AdminProjectComposer me={me} units={units.filter(unit=>unit.active!==false)} onClose={()=>setCreating(false)} onCreated={async id=>{setCreating(false);await load();openProject?.(id);}}/>}

    {error&&<ProductNotice tone="error" title="Projects could not finish loading" action={<button className="btn btn-ghost btn-sm" onClick={load}>Try again</button>}>{error}</ProductNotice>}

    <ProjectSummary items={[
      {label:"Active projects",value:active.length,detail:"In progress",selected:filter==="active",onClick:()=>chooseFilter("active")},
      {label:"Planned projects",value:planned.length,detail:"Coming up",selected:filter==="planned",onClick:()=>chooseFilter("planned")},
      {label:"Need attention",value:attention.length,detail:"Objectives marked at risk or not met",selected:filter==="attention",onClick:()=>chooseFilter("attention")},
    ]} />

    <div className="ev2p-register-toolbar">
      <label className="ev2p-register-search"><span>Find a project</span><input type="search" aria-label="Find a project" placeholder="Search by project or department" value={search} onChange={event=>setSearch(event.target.value)} /></label>
      <p aria-live="polite">{visible.length} {visible.length===1?"project":"projects"} shown</p>
    </div>
    <ProjectSectionHeader eyebrow="Your project portfolio" title={filter==="all"?"All projects":filter==="attention"?"Projects needing attention":filter==="active"?"Active projects":"Planned projects"} count={visible.length} />
    {filter!=="all"&&<Button variant="secondary" onClick={()=>setFilter("all")}>Show all projects</Button>}

    {projects.length===0&&<ProjectEmpty title="No projects recorded" description="Create a project to begin planning objectives and work." />}
    {projects.length>0&&visible.length===0&&<ProjectEmpty title="No matching projects" description="Try another search or select a different status above." />}

    <div className="ev2p-context-list">
      {visible.map((project)=>{
        const onTrack=project.objectives.filter((row)=>["on_track","met"].includes(row.status)).length;
        const atRisk=project.objectives.filter((row)=>row.status==="at_risk").length;
        const notMet=project.objectives.filter((row)=>row.status==="not_met").length;
        const other=Math.max(0,project.objectives.length-onTrack-atRisk-notMet);
        const onTrackPercentage=project.objectives.length?100*onTrack/project.objectives.length:null;
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
          : [{label:"Objectives",value:"Not added yet"}];

        return <ProjectContextRow
          key={project.id}
          eyebrow="Project"
          title={project.name}
          meta={`Led by ${project.leadUnit} · ${dateContext}`}
          note={`${project.purpose||"No description added yet."} · Other departments: ${projectUnits}`}
          status={project.status}
          facts={facts}
          progress={onTrackPercentage}
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
