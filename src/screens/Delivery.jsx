import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, LoadingState, ProductNotice, Sheet } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import ProjectParticipantRegister from "../components/ProjectParticipantRegister";
import Stage2ProjectReader from "../components/Stage2ProjectReader";
import {
  ProjectContextRow,
  ProjectEmpty,
  ProjectListRow,
  ProjectPageHeader,
  ProjectSectionHeader,
  ProjectSummary,
} from "../experience-v2/project-family/ProjectFamilyV2";

const PRIORITIES = [["low","Low"],["normal","Normal"],["high","High"],["critical","Critical"]];
const HEALTH = [["on_track","On track"],["watch","Watch"],["at_risk","At risk"],["blocked","Blocked"]];
const MILESTONE_STATUS = [["planned","Planned"],["in_progress","In progress"],["achieved","Achieved"],["missed","Missed"],["cancelled","Cancelled"]];
const SEVERITY = [["low","Low"],["medium","Medium"],["high","High"],["critical","Critical"]];

function label(list, value) {
  return list.find(([key]) => key === value)?.[1] || value || "—";
}
function human(value = "") {
  return String(value).replaceAll("_"," ").replace(/\b\w/g,(m)=>m.toUpperCase());
}
export default function Delivery({ me, initialProjectId = null, insightsOnly = false, openItem, openProject, goAssign }) {
  const [projects,setProjects]=useState([]);
  const [groups,setGroups]=useState([]);
  const [groupLinks,setGroupLinks]=useState([]);
  const [milestones,setMilestones]=useState([]);
  const [projectDeps,setProjectDeps]=useState([]);
  const [milestoneDeps,setMilestoneDeps]=useState([]);
  const [workDeps,setWorkDeps]=useState([]);
  const [registerItems,setRegisterItems]=useState([]);
  const [work,setWork]=useState([]);
  const [units,setUnits]=useState([]);
  const [people,setPeople]=useState([]);
  const [strategyLinks,setStrategyLinks]=useState([]);
  const [strategyNodes,setStrategyNodes]=useState([]);
  const [selectedProjectId,setSelectedProjectId]=useState("");
  const inspectProjectId = me.is_exec ? initialProjectId : null;
  const setInspectProjectId = id => openProject?.(id);
  const [showOperations,setShowOperations]=useState(Boolean(insightsOnly));
  const [sheet,setSheet]=useState(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [notice,setNotice]=useState(null);

  const [metadata,setMetadata]=useState({priority:"normal",health:"on_track",sponsor:"",owner:"",reason:""});
  const [groupLink,setGroupLink]=useState("");
  const [groupLinkReason,setGroupLinkReason]=useState("");
  const [projectDependency,setProjectDependency]=useState("");
  const [projectDependencyReason,setProjectDependencyReason]=useState("");
  const [milestoneSuccessor,setMilestoneSuccessor]=useState("");
  const [milestonePredecessor,setMilestonePredecessor]=useState("");
  const [milestoneDependencyReason,setMilestoneDependencyReason]=useState("");
  const [workSuccessor,setWorkSuccessor]=useState("");
  const [workPredecessor,setWorkPredecessor]=useState("");
  const [workDependencyReason,setWorkDependencyReason]=useState("");

  useEffect(()=>{ load(); },[me.id]);
  useEffect(()=>{ if(initialProjectId) setSelectedProjectId(initialProjectId); },[initialProjectId]);

  async function load() {
    setLoading(true); setError(null);
    const queries = await Promise.all([
      supabase.from("projects").select("id,name,purpose,status,lead_unit_id,starts_on,ends_on,priority,health,sponsor_profile_id,delivery_owner_id").eq("org_id",me.org_id).order("name"),
      supabase.from("delivery_groups").select("*").eq("org_id",me.org_id).order("name"),
      supabase.from("delivery_group_projects").select("*").eq("org_id",me.org_id).eq("state","active"),
      supabase.from("project_milestones").select("*").eq("org_id",me.org_id).order("target_on",{ascending:true,nullsFirst:false}),
      supabase.from("project_dependencies").select("*").eq("org_id",me.org_id).order("created_at",{ascending:false}),
      supabase.from("milestone_dependencies").select("*").eq("org_id",me.org_id).order("created_at",{ascending:false}),
      supabase.from("work_dependencies").select("*").eq("org_id",me.org_id).order("created_at",{ascending:false}),
      supabase.from("project_register_items").select("*").eq("org_id",me.org_id).order("created_at",{ascending:false}),
      supabase.from("work_items").select("id,ref,title,project_id,status").eq("org_id",me.org_id).order("created_at",{ascending:false}).limit(500),
      supabase.from("units").select("id,name").eq("org_id",me.org_id).order("name"),
      supabase.from("profiles").select("id,full_name,email,active").eq("org_id",me.org_id).order("full_name"),
      me.is_exec
        ? supabase.from("strategy_delivery_links").select("strategy_node_id,project_id,status").eq("org_id",me.org_id).eq("status","active")
        : Promise.resolve({data:[],error:null}),
      me.is_exec
        ? supabase.from("strategy_nodes").select("id,name,node_type,status").eq("org_id",me.org_id).in("node_type",["ministry_objective","unit_objective"])
        : Promise.resolve({data:[],error:null}),
    ]);
    const failed=queries.find((row)=>row.error);
    if(failed){ setError(humanError(failed.error,"Delivery could not finish loading.")); setLoading(false); return; }
    const [p,g,gl,m,pd,md,wd,ri,w,u,pe,sl,sn]=queries.map((row)=>row.data||[]);
    setProjects(p); setGroups(g); setGroupLinks(gl); setMilestones(m); setProjectDeps(pd);
    setMilestoneDeps(md); setWorkDeps(wd); setRegisterItems(ri); setWork(w); setUnits(u); setPeople(pe);
    setStrategyLinks(sl); setStrategyNodes(sn);
    const nextSelected = selectedProjectId && p.some((row)=>row.id===selectedProjectId) ? selectedProjectId : (p[0]?.id||"");
    setSelectedProjectId(nextSelected);
    const selected = p.find((row)=>row.id===nextSelected);
    if(selected) setMetadata({
      priority:selected.priority||"normal",
      health:selected.health||"on_track",
      sponsor:selected.sponsor_profile_id||"",
      owner:selected.delivery_owner_id||"",
      reason:"",
    });
    setLoading(false);
  }

  const projectsById=useMemo(()=>Object.fromEntries(projects.map((row)=>[row.id,row])),[projects]);
  const groupsById=useMemo(()=>Object.fromEntries(groups.map((row)=>[row.id,row])),[groups]);
  const milestonesById=useMemo(()=>Object.fromEntries(milestones.map((row)=>[row.id,row])),[milestones]);
  const workById=useMemo(()=>Object.fromEntries(work.map((row)=>[row.id,row])),[work]);
  const peopleById=useMemo(()=>Object.fromEntries(people.map((row)=>[row.id,row])),[people]);
  const unitsById=useMemo(()=>Object.fromEntries(units.map((row)=>[row.id,row])),[units]);
  const strategyNodesById=useMemo(()=>Object.fromEntries(strategyNodes.map((row)=>[row.id,row])),[strategyNodes]);

  const selectedProject=projectsById[selectedProjectId]||null;
  const selectedMilestones=milestones.filter((row)=>row.project_id===selectedProjectId);
  const selectedWork=work.filter((row)=>row.project_id===selectedProjectId);
  const selectedRegister=registerItems.filter((row)=>row.project_id===selectedProjectId);
  const selectedProjectDeps=projectDeps.filter((row)=>row.project_id===selectedProjectId);
  const selectedGroupLinks=groupLinks.filter((row)=>row.project_id===selectedProjectId);
  const activeMilestoneDeps=milestoneDeps.filter((row)=>row.state==="active" && selectedMilestones.some((m)=>m.id===row.milestone_id));
  const activeWorkDeps=workDeps.filter((row)=>row.state==="active" && selectedWork.some((w)=>w.id===row.work_item_id));

  const capabilities=me.capabilities||[];
  const canManageOrg=Boolean(me.is_admin||me.is_exec||capabilities.includes("delivery.manage"));
  const managedUnitIds=(me.memberships||[]).filter((row)=>row.role==="manager").map((row)=>row.unit_id);
  if(me.role==="manager" && me.unit_id && !managedUnitIds.includes(me.unit_id)) managedUnitIds.push(me.unit_id);
  const canManageSelected=Boolean(selectedProject && (canManageOrg||managedUnitIds.includes(selectedProject.lead_unit_id)));

  useEffect(()=>{
    if(!selectedProject) return;
    setMetadata({
      priority:selectedProject.priority||"normal",
      health:selectedProject.health||"on_track",
      sponsor:selectedProject.sponsor_profile_id||"",
      owner:selectedProject.delivery_owner_id||"",
      reason:"",
    });
    setProjectDependency("");
    setMilestoneSuccessor("");
    setMilestonePredecessor("");
    setWorkSuccessor("");
    setWorkPredecessor("");
  },[selectedProjectId]);

  const report = groups.map((group)=>{
    const linkedIds=groupLinks.filter((link)=>link.delivery_group_id===group.id&&link.state==="active").map((link)=>link.project_id);
    const linkedProjects=linkedIds.map((id)=>projectsById[id]).filter(Boolean);
    const linkedMilestones=milestones.filter((row)=>linkedIds.includes(row.project_id));
    const linkedRegister=registerItems.filter((row)=>linkedIds.includes(row.project_id)&&row.state!=="resolved");
    return {
      ...group,
      linkedProjects,
      active:linkedProjects.filter((p)=>p.status==="active").length,
      atRisk:linkedProjects.filter((p)=>["at_risk","blocked"].includes(p.health)).length,
      openMilestones:linkedMilestones.filter((m)=>!["achieved","cancelled"].includes(m.status)).length,
      serious:linkedRegister.filter((r)=>["high","critical"].includes(r.severity)).length,
    };
  });

  async function run(action, success) {
    setBusy(true); setError(null); setNotice(null);
    try { await action(); setNotice(success); setSheet(null); await load(); }
    catch(err){ setError(humanError(err,"The delivery change could not be saved.")); }
    finally{ setBusy(false); }
  }

  async function createGroup(form) {
    await run(async()=>{
      const {error:e}=await supabase.from("delivery_groups").insert({
        org_id:me.org_id,
        kind:form.kind,
        parent_group_id:form.parent||null,
        unit_id:form.unit||null,
        name:form.name.trim(),
        purpose:form.purpose.trim()||null,
        owner_profile_id:form.owner||null,
        starts_on:form.startsOn||null,
        ends_on:form.endsOn||null,
        status:"active",
        change_reason:form.reason.trim(),
        created_by:me.id,
        updated_by:me.id,
      });
      if(e) throw e;
    },"Programme / Portfolio created.");
  }

  async function saveMetadata() {
    if(!selectedProject||!metadata.reason.trim()) return;
    await run(async()=>{
      const {error:e}=await supabase.from("projects").update({
        priority:metadata.priority,
        health:metadata.health,
        sponsor_profile_id:metadata.sponsor||null,
        delivery_owner_id:metadata.owner||null,
        delivery_change_reason:metadata.reason.trim(),
      }).eq("id",selectedProject.id);
      if(e) throw e;
    },"Project delivery metadata updated.");
  }

  async function createMilestone(form) {
    await run(async()=>{
      const payload={
        org_id:me.org_id,project_id:selectedProjectId,name:form.name.trim(),
        description:form.description.trim()||null,owner_profile_id:form.owner||null,
        target_on:form.targetOn||null,status:form.status,change_reason:form.reason.trim(),
        created_by:me.id,updated_by:me.id,
      };
      if(form.status==="achieved") payload.completed_at=new Date().toISOString();
      const {error:e}=await supabase.from("project_milestones").insert(payload);
      if(e) throw e;
    },"Milestone recorded.");
  }

  async function reviseMilestone(form) {
    await run(async()=>{
      const payload={
        status:form.status,
        target_on:form.targetOn||null,
        owner_profile_id:form.owner||null,
        change_reason:form.reason.trim(),
        updated_by:me.id,
      };
      if(form.status==="achieved") payload.completed_at=new Date().toISOString();
      const {error:e}=await supabase.from("project_milestones").update(payload).eq("id",form.id);
      if(e) throw e;
    },"Milestone revised.");
  }

  async function createRegister(form) {
    await run(async()=>{
      const {error:e}=await supabase.from("project_register_items").insert({
        org_id:me.org_id,project_id:selectedProjectId,kind:form.kind,
        title:form.title.trim(),description:form.description.trim(),
        impact:form.impact.trim()||null,severity:form.severity,
        likelihood:form.kind==="risk"?form.likelihood:null,
        owner_profile_id:form.owner||null,response_plan:form.responsePlan.trim()||null,
        target_on:form.targetOn||null,state:form.kind==="risk"?"open":"open",
        change_reason:form.reason.trim(),created_by:me.id,updated_by:me.id,
      });
      if(e) throw e;
    },form.kind==="risk"?"Risk recorded.":"Issue recorded.");
  }

  async function resolveRegister(form) {
    await run(async()=>{
      const {error:e}=await supabase.from("project_register_items").update({
        state:"resolved",resolution_note:form.resolution.trim(),
        change_reason:form.reason.trim(),updated_by:me.id,
      }).eq("id",form.id);
      if(e) throw e;
    },"Register item resolved.");
  }

  async function linkProject() {
    if(!selectedProjectId||!groupLink||!groupLinkReason.trim()) return;
    await run(async()=>{
      const {error:e}=await supabase.from("delivery_group_projects").insert({
        org_id:me.org_id,delivery_group_id:groupLink,project_id:selectedProjectId,
        state:"active",change_reason:groupLinkReason.trim(),created_by:me.id,updated_by:me.id,
      });
      if(e) throw e;
      setGroupLink(""); setGroupLinkReason("");
    },"Project linked to Programme / Portfolio.");
  }

  async function withdrawGroupLink(link) {
    const reason=window.prompt("Reason for withdrawing this project link:");
    if(!reason?.trim()) return;
    await run(async()=>{
      const {error:e}=await supabase.from("delivery_group_projects").update({
        state:"withdrawn",change_reason:reason.trim(),updated_by:me.id,
      }).eq("id",link.id);
      if(e) throw e;
    },"Project link withdrawn.");
  }

  async function addProjectDependency() {
    if(!projectDependency||!projectDependencyReason.trim()) return;
    await run(async()=>{
      const {error:e}=await supabase.from("project_dependencies").insert({
        org_id:me.org_id,project_id:selectedProjectId,depends_on_project_id:projectDependency,
        state:"active",change_reason:projectDependencyReason.trim(),
        created_by:me.id,updated_by:me.id,
      });
      if(e) throw e;
      setProjectDependency(""); setProjectDependencyReason("");
    },"Project dependency recorded.");
  }

  async function addMilestoneDependency() {
    if(!milestoneSuccessor||!milestonePredecessor||!milestoneDependencyReason.trim()) return;
    await run(async()=>{
      const {error:e}=await supabase.from("milestone_dependencies").insert({
        org_id:me.org_id,milestone_id:milestoneSuccessor,depends_on_milestone_id:milestonePredecessor,
        state:"active",change_reason:milestoneDependencyReason.trim(),
        created_by:me.id,updated_by:me.id,
      });
      if(e) throw e;
      setMilestoneSuccessor(""); setMilestonePredecessor(""); setMilestoneDependencyReason("");
    },"Milestone dependency recorded.");
  }

  async function addWorkDependency() {
    if(!workSuccessor||!workPredecessor||!workDependencyReason.trim()) return;
    await run(async()=>{
      const {error:e}=await supabase.from("work_dependencies").insert({
        org_id:me.org_id,work_item_id:workSuccessor,depends_on_work_item_id:workPredecessor,
        state:"active",change_reason:workDependencyReason.trim(),
        created_by:me.id,updated_by:me.id,
      });
      if(e) throw e;
      setWorkSuccessor(""); setWorkPredecessor(""); setWorkDependencyReason("");
    },"Work dependency recorded.");
  }

  if(loading) return <div className="body"><LoadingState label="Loading delivery management…" /></div>;

  const executiveSurface=Boolean(me.is_exec);
  const attentionProjects=projects.filter((project)=>{
    const explicitHealth=["watch","at_risk","blocked"].includes(project.health);
    const seriousOpenItem=registerItems.some((item)=>item.project_id===project.id&&item.state!=="resolved"&&["high","critical"].includes(item.severity));
    return explicitHealth||seriousOpenItem;
  });

  if (executiveSurface && inspectProjectId) return <div className="body ev2-project-page ev2-project-delivery is-executive">
    <Stage2ProjectReader key={inspectProjectId} projectId={inspectProjectId} openItem={openItem} onBack={() => setInspectProjectId(null)} goAssign={goAssign} me={me} />
  </div>;

  return <div className={"body ev2-project-page ev2-project-delivery"+(executiveSurface?" is-executive":"")}>
    <ProjectPageHeader
      eyebrow={executiveSurface ? "Strategic portfolio" : "Work Management 2.0"}
      title={executiveSurface ? "Delivery insights" : "Delivery"}
      description={executiveSurface ? "See recorded project risks, delivery milestones and coordinated programmes. Open All projects to manage an individual project." : "Programmes, portfolios, milestones, dependencies, risks and issues. Health is an explicit management state; CEAC OS does not generate a hidden project score."}
    />

    {error&&<ProductNotice tone="error" title="Delivery">{error}</ProductNotice>}
    {notice&&<ProductNotice tone="success" title="Delivery">{notice}</ProductNotice>}

    <ProjectSummary items={[
      {label:"Active projects",value:projects.filter((p)=>p.status==="active").length,detail:"Recorded as active"},
      {label:"Explicit risk / blocked",value:projects.filter((p)=>["at_risk","blocked"].includes(p.health)).length,detail:"Stored project health"},
      {label:"Open milestones",value:milestones.filter((m)=>!["achieved","cancelled"].includes(m.status)).length,detail:"Recorded milestone state"},
      {label:"Open risks / issues",value:registerItems.filter((r)=>r.state!=="resolved").length,detail:"Recorded register items"},
    ]} />

    {executiveSurface&&<>
      <ProjectSectionHeader eyebrow="Leadership attention" title="Recorded attention" count={attentionProjects.length} />
      {attentionProjects.length>0?<div className="ev2p-attention-list">
        {attentionProjects.map((project)=>{
          const openMilestones=milestones.filter((row)=>row.project_id===project.id&&!["achieved","cancelled"].includes(row.status)).length;
          const openRegister=registerItems.filter((row)=>row.project_id===project.id&&row.state!=="resolved");
          return <ProjectContextRow
            key={project.id}
            eyebrow="Explicit recorded state"
            title={project.name}
            meta={(unitsById[project.lead_unit_id]?.name||"Lead unit")+" · "+label(PRIORITIES,project.priority)+" priority"}
            note={project.purpose||"No purpose recorded."}
            health={project.health}
            facts={[
              {label:"Open milestones",value:openMilestones},
              {label:"Open risks / issues",value:openRegister.length},
              {label:"High / critical",value:openRegister.filter((row)=>["high","critical"].includes(row.severity)).length},
            ]}
            actions={[{label:"Open project",onClick:()=>setInspectProjectId(project.id)},{label:"Operational details",onClick:()=>{setSelectedProjectId(project.id);setShowOperations(true);}}]}
          />;
        })}
      </div>:<ProjectEmpty title="No recorded project attention" description="No visible project currently has Watch, At risk, Blocked, or a high / critical open register item." />}
    </>}

    {executiveSurface&&!insightsOnly&&<>
      <ProjectSectionHeader eyebrow="Project register" title="All projects" count={projects.length} />
      {projects.length ? <div className="ev2p-context-list">
        {projects.map((project)=>{
          const linkedObjectives=strategyLinks
            .filter((link)=>link.project_id===project.id)
            .map((link)=>strategyNodesById[link.strategy_node_id]?.name)
            .filter(Boolean);
          const owner=peopleById[project.delivery_owner_id]?.full_name||"Not recorded";
          const openMilestones=milestones.filter((row)=>row.project_id===project.id&&!["achieved","cancelled"].includes(row.status)).length;
          const attentionItems=registerItems.filter((row)=>row.project_id===project.id&&row.state!=="resolved"&&["high","critical"].includes(row.severity)).length;
          const needsDecision=["watch","at_risk","blocked"].includes(project.health)||attentionItems>0;
          return <ProjectContextRow
            key={project.id}
            eyebrow={needsDecision?"Executive attention":"Recorded project"}
            title={project.name}
            meta={`${unitsById[project.lead_unit_id]?.name||"Lead unit not recorded"} · Owner: ${owner}`}
            note={`Objective served: ${linkedObjectives.join(", ")||"Not recorded"} · ${project.purpose||"No purpose recorded."}`}
            health={project.health}
            facts={[
              {label:"Health",value:label(HEALTH,project.health)},
              {label:"Open milestones",value:openMilestones},
              {label:"Decision",value:needsDecision?"Review":"None recorded"},
            ]}
            actions={[{label:"Open project",onClick:()=>setInspectProjectId(project.id)},{label:"Operational details",onClick:()=>{setSelectedProjectId(project.id);setShowOperations(true);}}]}
          />;
        })}
      </div> : <ProjectEmpty title="No projects recorded" description={executiveSurface ? "Projects will appear here when they are recorded." : "Authorised project records will appear here."} />}
      <button className="btn btn-ghost" type="button" onClick={()=>setShowOperations((value)=>!value)}>
        {showOperations?"Hide operational details":"Open operational details"}
      </button>
    </>}

    {(!executiveSurface||showOperations||insightsOnly)&&<>
    <ProjectSectionHeader
      eyebrow="Structure"
      title="Coordinated programmes"
      count={report.length}
      actionLabel="Create programme group"
      onAction={()=>setSheet({type:"group"})}
    />
    {report.length===0&&<ProjectEmpty title="No Programmes or Portfolios" description="Create a delivery group when several projects belong to one coordinated outcome." />}
    {report.map((group)=><section className="ev2p-portfolio-card" key={group.id}>
      <div className="row-t">{group.name}</div>
      <div className="row-m">{human(group.kind)} · {group.unit_id?unitsById[group.unit_id]?.name||"Unit":"Ministry-wide"} · {human(group.status)}</div>
      {group.purpose&&<div className="row-note">{group.purpose}</div>}
      <div className="project-overview-summary" style={{marginTop:12}}>
        <div><strong>{group.linkedProjects.length}</strong><span>visible projects</span></div>
        <div><strong>{group.active}</strong><span>active</span></div>
        <div><strong>{group.atRisk}</strong><span>at risk / blocked</span></div>
        <div><strong>{group.openMilestones}</strong><span>open milestones</span></div>
        <div><strong>{group.serious}</strong><span>high / critical open items</span></div>
      </div>
    </section>)}

    {!insightsOnly && <div className="ev2p-delivery-layout">
      <div className="main-col ev2p-delivery-main">
        <ProjectSectionHeader eyebrow="Projects" title="Portfolio projects" count={projects.length} />
        <div className="ev2p-list">
          {projects.map((project)=><ProjectListRow
            key={project.id}
            eyebrow={unitsById[project.lead_unit_id]?.name||"Lead unit"}
            title={project.name}
            meta={label(PRIORITIES,project.priority)+" priority"}
            note={project.purpose||"No purpose recorded."}
            health={project.health}
            selected={selectedProjectId===project.id}
            onClick={()=>setSelectedProjectId(project.id)}
          />)}
        </div>
        {!projects.length&&<ProjectEmpty title="No visible projects" description="Projects you are authorised to see will appear here." />}

        {selectedProject&&<>
          <div className="sec"><span>Milestones</span><span>{selectedMilestones.length}</span></div>
          {canManageSelected&&<button className="btn btn-sm" style={{marginBottom:10}} onClick={()=>setSheet({type:"milestone"})}>Add milestone</button>}
          {selectedMilestones.map((m)=><div className="row" key={m.id}>
            <div className="row-t">{m.name}</div>
            <div className="row-m">{label(MILESTONE_STATUS,m.status)}{m.target_on?" · target "+m.target_on:""}</div>
            {m.description&&<div className="row-note">{m.description}</div>}
            {canManageSelected&&<button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={()=>setSheet({type:"milestone-revise",value:m})}>Revise</button>}
          </div>)}
          {!selectedMilestones.length&&<div className="card small">No milestones recorded.</div>}

          <div className="sec"><span>Risk & issue register</span><span>{selectedRegister.length}</span></div>
          {canManageSelected&&<div style={{display:"flex",gap:8,marginBottom:10}}>
            <button className="btn btn-sm" onClick={()=>setSheet({type:"register",kind:"risk"})}>Add risk</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setSheet({type:"register",kind:"issue"})}>Add issue</button>
          </div>}
          {selectedRegister.map((item)=><div className="row" key={item.id}>
            <div className="row-t">{item.title}</div>
            <div className="row-m">{human(item.kind)} · {human(item.severity)} · {human(item.state)}</div>
            <div className="row-note">{item.description}</div>
            {item.response_plan&&<div className="small" style={{marginTop:6}}>Response: {item.response_plan}</div>}
            {canManageSelected&&item.state!=="resolved"&&<button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={()=>setSheet({type:"register-resolve",value:item})}>Resolve</button>}
          </div>)}
          {!selectedRegister.length&&<div className="card small">No project risks or issues recorded.</div>}

          <div className="sec"><span>Participant register</span><span>Project capability</span></div>
          <ProjectParticipantRegister me={me} project={selectedProject} />
        </>}
      </div>

      <div className="side-col ev2p-delivery-side">
        {selectedProject&&<>
          <div className="sec"><span>Project management state</span></div>
          <div className="card" style={{padding:15}}>
            <strong>{selectedProject.name}</strong>
            <p className="small">{selectedProject.purpose||"No purpose recorded."}</p>
            <FieldGroup label="Priority">
              <select className="field" aria-label="Delivery project priority" value={metadata.priority} disabled={!canManageSelected} onChange={(e)=>setMetadata({...metadata,priority:e.target.value})}>
                {PRIORITIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Health">
              <select className="field" aria-label="Delivery project health" value={metadata.health} disabled={!canManageSelected} onChange={(e)=>setMetadata({...metadata,health:e.target.value})}>
                {HEALTH.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Sponsor">
              <select className="field" aria-label="Delivery project sponsor" value={metadata.sponsor} disabled={!canManageSelected} onChange={(e)=>setMetadata({...metadata,sponsor:e.target.value})}>
                <option value="">Not recorded</option>{people.map((p)=><option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Delivery owner">
              <select className="field" aria-label="Delivery project owner" value={metadata.owner} disabled={!canManageSelected} onChange={(e)=>setMetadata({...metadata,owner:e.target.value})}>
                <option value="">Not recorded</option>{people.map((p)=><option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </FieldGroup>
            {canManageSelected&&<>
              <FieldGroup label="Reason for change"><textarea className="field" aria-label="Delivery metadata reason" rows="2" value={metadata.reason} onChange={(e)=>setMetadata({...metadata,reason:e.target.value})}/></FieldGroup>
              <button className="btn" disabled={busy||!metadata.reason.trim()} onClick={saveMetadata}>Save project state</button>
            </>}
          </div>

          <div className="sec"><span>Programme / Portfolio</span></div>
          <div className="card" style={{padding:15}}>
            {selectedGroupLinks.map((link)=><div className="small" key={link.id} style={{marginBottom:8}}>
              {groupsById[link.delivery_group_id]?.name||"Delivery group"}
              {canManageSelected&&<button className="btn btn-ghost btn-sm" style={{marginLeft:8}} onClick={()=>withdrawGroupLink(link)}>Withdraw</button>}
            </div>)}
            {canManageSelected&&<>
              <FieldGroup label="Link to">
                <select className="field" aria-label="Delivery group link" value={groupLink} onChange={(e)=>setGroupLink(e.target.value)}>
                  <option value="">Choose Programme / Portfolio</option>
                  {groups.filter((g)=>!selectedGroupLinks.some((l)=>l.delivery_group_id===g.id)).map((g)=><option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </FieldGroup>
              <FieldGroup label="Reason"><input className="field" aria-label="Delivery group link reason" value={groupLinkReason} onChange={(e)=>setGroupLinkReason(e.target.value)}/></FieldGroup>
              <button className="btn btn-sm" disabled={!groupLink||!groupLinkReason.trim()||busy} onClick={linkProject}>Link project</button>
            </>}
          </div>

          <div className="sec"><span>Project dependency</span></div>
          <div className="card" style={{padding:15}}>
            {selectedProjectDeps.filter((d)=>d.state==="active").map((d)=><div className="small" key={d.id} style={{marginBottom:8}}>Depends on {projectsById[d.depends_on_project_id]?.name||"project"}</div>)}
            {canManageSelected&&<>
              <select className="field" aria-label="Project dependency predecessor" value={projectDependency} onChange={(e)=>setProjectDependency(e.target.value)}>
                <option value="">Choose predecessor project</option>
                {projects.filter((p)=>p.id!==selectedProjectId).map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="field" aria-label="Project dependency reason" placeholder="Reason / context" value={projectDependencyReason} onChange={(e)=>setProjectDependencyReason(e.target.value)}/>
              <button className="btn btn-sm" disabled={!projectDependency||!projectDependencyReason.trim()||busy} onClick={addProjectDependency}>Add project dependency</button>
            </>}
          </div>

          <div className="sec"><span>Milestone dependency</span></div>
          <div className="card" style={{padding:15}}>
            {activeMilestoneDeps.map((d)=><div className="small" key={d.id}>{milestonesById[d.milestone_id]?.name||"Milestone"} depends on {milestonesById[d.depends_on_milestone_id]?.name||"milestone"}</div>)}
            {canManageSelected&&selectedMilestones.length>1&&<>
              <select className="field" aria-label="Milestone dependency successor" value={milestoneSuccessor} onChange={(e)=>setMilestoneSuccessor(e.target.value)}>
                <option value="">Dependent milestone</option>{selectedMilestones.map((m)=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select className="field" aria-label="Milestone dependency predecessor" value={milestonePredecessor} onChange={(e)=>setMilestonePredecessor(e.target.value)}>
                <option value="">Predecessor milestone</option>{selectedMilestones.filter((m)=>m.id!==milestoneSuccessor).map((m)=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input className="field" aria-label="Milestone dependency reason" placeholder="Reason / context" value={milestoneDependencyReason} onChange={(e)=>setMilestoneDependencyReason(e.target.value)}/>
              <button className="btn btn-sm" disabled={!milestoneSuccessor||!milestonePredecessor||!milestoneDependencyReason.trim()||busy} onClick={addMilestoneDependency}>Add milestone dependency</button>
            </>}
          </div>

          <div className="sec"><span>Work dependency</span></div>
          <div className="card" style={{padding:15}}>
            {activeWorkDeps.map((d)=><div className="small" key={d.id}>{workById[d.work_item_id]?.title||"Work"} depends on {workById[d.depends_on_work_item_id]?.title||"work"}</div>)}
            {canManageSelected&&selectedWork.length>1&&<>
              <select className="field" aria-label="Work dependency successor" value={workSuccessor} onChange={(e)=>setWorkSuccessor(e.target.value)}>
                <option value="">Dependent work</option>{selectedWork.map((w)=><option key={w.id} value={w.id}>{w.ref} · {w.title}</option>)}
              </select>
              <select className="field" aria-label="Work dependency predecessor" value={workPredecessor} onChange={(e)=>setWorkPredecessor(e.target.value)}>
                <option value="">Predecessor work</option>{selectedWork.filter((w)=>w.id!==workSuccessor).map((w)=><option key={w.id} value={w.id}>{w.ref} · {w.title}</option>)}
              </select>
              <input className="field" aria-label="Work dependency reason" placeholder="Reason / context" value={workDependencyReason} onChange={(e)=>setWorkDependencyReason(e.target.value)}/>
              <button className="btn btn-sm" disabled={!workSuccessor||!workPredecessor||!workDependencyReason.trim()||busy} onClick={addWorkDependency}>Add work dependency</button>
            </>}
          </div>
        </>}
      </div>
    </div>}

    </>}

    {sheet?.type==="group"&&<GroupSheet me={me} units={units} people={people} groups={groups} canManageOrg={canManageOrg} busy={busy} onClose={()=>setSheet(null)} onSave={createGroup}/>}
    {sheet?.type==="milestone"&&<MilestoneSheet people={people} busy={busy} onClose={()=>setSheet(null)} onSave={createMilestone}/>}
    {sheet?.type==="milestone-revise"&&<MilestoneSheet people={people} value={sheet.value} busy={busy} onClose={()=>setSheet(null)} onSave={reviseMilestone}/>}
    {sheet?.type==="register"&&<RegisterSheet kind={sheet.kind} people={people} busy={busy} onClose={()=>setSheet(null)} onSave={createRegister}/>}
    {sheet?.type==="register-resolve"&&<ResolveRegisterSheet item={sheet.value} busy={busy} onClose={()=>setSheet(null)} onSave={resolveRegister}/>}
  </div>;
}

function GroupSheet({me,units,people,groups,canManageOrg,busy,onClose,onSave}) {
  const [form,setForm]=useState({
    kind:"programme",parent:"",unit:canManageOrg?"":me.unit_id||"",name:"",purpose:"",owner:"",startsOn:"",endsOn:"",reason:""
  });
  const valid=form.name.trim()&&form.reason.trim()&&(canManageOrg||form.unit);
  return <Sheet onClose={onClose}>
    <div className="h2">New Programme / Portfolio</div>
    <FieldGroup label="Type"><select className="field" aria-label="Delivery group type" value={form.kind} onChange={(e)=>setForm({...form,kind:e.target.value,parent:e.target.value==="portfolio"?"":form.parent})}><option value="programme">Programme</option><option value="portfolio">Portfolio</option></select></FieldGroup>
    {form.kind==="programme"&&<FieldGroup label="Parent Portfolio (optional)"><select className="field" aria-label="Delivery group parent" value={form.parent} onChange={(e)=>setForm({...form,parent:e.target.value})}><option value="">No parent</option>{groups.filter((g)=>g.kind==="portfolio"&&g.status!=="closed").map((g)=><option key={g.id} value={g.id}>{g.name}</option>)}</select></FieldGroup>}
    <FieldGroup label="Owning unit"><select className="field" aria-label="Delivery group unit" value={form.unit} disabled={!canManageOrg} onChange={(e)=>setForm({...form,unit:e.target.value})}><option value="">Ministry-wide</option>{units.map((u)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></FieldGroup>
    <FieldGroup label="Name"><input className="field" aria-label="Delivery group name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></FieldGroup>
    <FieldGroup label="Purpose"><textarea className="field" aria-label="Delivery group purpose" rows="3" value={form.purpose} onChange={(e)=>setForm({...form,purpose:e.target.value})}/></FieldGroup>
    <FieldGroup label="Owner"><select className="field" aria-label="Delivery group owner" value={form.owner} onChange={(e)=>setForm({...form,owner:e.target.value})}><option value="">Not recorded</option>{people.map((p)=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></FieldGroup>
    <FieldGroup label="Starts on"><input className="field" aria-label="Delivery group start date" type="date" value={form.startsOn} onChange={(e)=>setForm({...form,startsOn:e.target.value})}/></FieldGroup>
    <FieldGroup label="Ends on"><input className="field" aria-label="Delivery group end date" type="date" value={form.endsOn} onChange={(e)=>setForm({...form,endsOn:e.target.value})}/></FieldGroup>
    <FieldGroup label="Reason / context"><textarea className="field" aria-label="Delivery group reason" rows="2" value={form.reason} onChange={(e)=>setForm({...form,reason:e.target.value})}/></FieldGroup>
    <button className="btn" disabled={busy||!valid} onClick={()=>onSave(form)}>{busy?"Creating…":"Create Programme / Portfolio"}</button>
  </Sheet>;
}

function MilestoneSheet({people,value=null,busy,onClose,onSave}) {
  const [form,setForm]=useState({
    id:value?.id||"",name:value?.name||"",description:value?.description||"",owner:value?.owner_profile_id||"",
    targetOn:value?.target_on||"",status:value?.status||"planned",reason:""
  });
  const revise=Boolean(value);
  return <Sheet onClose={onClose}>
    <div className="h2">{revise?"Revise milestone":"Add milestone"}</div>
    {!revise&&<FieldGroup label="Name"><input className="field" aria-label="Milestone name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></FieldGroup>}
    {!revise&&<FieldGroup label="Description"><textarea className="field" aria-label="Milestone description" rows="3" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></FieldGroup>}
    <FieldGroup label="Owner"><select className="field" aria-label="Milestone owner" value={form.owner} onChange={(e)=>setForm({...form,owner:e.target.value})}><option value="">Not recorded</option>{people.map((p)=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></FieldGroup>
    <FieldGroup label="Target date"><input className="field" aria-label="Milestone target date" type="date" value={form.targetOn} onChange={(e)=>setForm({...form,targetOn:e.target.value})}/></FieldGroup>
    <FieldGroup label="Status"><select className="field" aria-label="Milestone status" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}>{MILESTONE_STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></FieldGroup>
    <FieldGroup label="Reason / context"><textarea className="field" aria-label="Milestone reason" rows="2" value={form.reason} onChange={(e)=>setForm({...form,reason:e.target.value})}/></FieldGroup>
    <button className="btn" disabled={busy||!form.reason.trim()||(!revise&&!form.name.trim())} onClick={()=>onSave(form)}>{busy?"Saving…":revise?"Record milestone revision":"Save milestone"}</button>
  </Sheet>;
}

function RegisterSheet({kind,people,busy,onClose,onSave}) {
  const [form,setForm]=useState({kind,title:"",description:"",impact:"",severity:"medium",likelihood:"medium",owner:"",responsePlan:"",targetOn:"",reason:""});
  return <Sheet onClose={onClose}>
    <div className="h2">Add {kind}</div>
    <FieldGroup label="Title"><input className="field" aria-label="Register item title" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></FieldGroup>
    <FieldGroup label="Description"><textarea className="field" aria-label="Register item description" rows="3" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></FieldGroup>
    <FieldGroup label="Impact"><textarea className="field" aria-label="Register item impact" rows="2" value={form.impact} onChange={(e)=>setForm({...form,impact:e.target.value})}/></FieldGroup>
    <FieldGroup label="Severity"><select className="field" aria-label="Register item severity" value={form.severity} onChange={(e)=>setForm({...form,severity:e.target.value})}>{SEVERITY.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></FieldGroup>
    {kind==="risk"&&<FieldGroup label="Likelihood"><select className="field" aria-label="Register item likelihood" value={form.likelihood} onChange={(e)=>setForm({...form,likelihood:e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></FieldGroup>}
    <FieldGroup label="Owner"><select className="field" aria-label="Register item owner" value={form.owner} onChange={(e)=>setForm({...form,owner:e.target.value})}><option value="">Not recorded</option>{people.map((p)=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></FieldGroup>
    <FieldGroup label="Response plan"><textarea className="field" aria-label="Register item response plan" rows="2" value={form.responsePlan} onChange={(e)=>setForm({...form,responsePlan:e.target.value})}/></FieldGroup>
    <FieldGroup label="Target date"><input className="field" aria-label="Register item target date" type="date" value={form.targetOn} onChange={(e)=>setForm({...form,targetOn:e.target.value})}/></FieldGroup>
    <FieldGroup label="Reason / context"><textarea className="field" aria-label="Register item reason" rows="2" value={form.reason} onChange={(e)=>setForm({...form,reason:e.target.value})}/></FieldGroup>
    <button className="btn" disabled={busy||!form.title.trim()||!form.description.trim()||!form.reason.trim()} onClick={()=>onSave(form)}>{busy?"Saving…":"Save "+kind}</button>
  </Sheet>;
}

function ResolveRegisterSheet({item,busy,onClose,onSave}) {
  const [resolution,setResolution]=useState("");
  const [reason,setReason]=useState("");
  return <Sheet onClose={onClose}>
    <div className="h2">Resolve {item.kind}</div>
    <p className="screen-note">{item.title}</p>
    <FieldGroup label="Resolution"><textarea className="field" aria-label="Register resolution" rows="3" value={resolution} onChange={(e)=>setResolution(e.target.value)}/></FieldGroup>
    <FieldGroup label="Reason / context"><textarea className="field" aria-label="Register resolution reason" rows="2" value={reason} onChange={(e)=>setReason(e.target.value)}/></FieldGroup>
    <button className="btn" disabled={busy||!resolution.trim()||!reason.trim()} onClick={()=>onSave({id:item.id,resolution,reason})}>{busy?"Resolving…":"Resolve item"}</button>
  </Sheet>;
}
