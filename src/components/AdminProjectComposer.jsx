import {useEffect,useRef,useState} from "react";
import {ComposerDrawer} from "../experience-v2/components";
import {FieldGroup,ProductNotice} from "./bits";
import {supabase} from "../lib/supabase";
import {humanError} from "../lib/productLanguage";

export default function AdminProjectComposer({me,units,onClose,onCreated}) {
  const [form,setForm]=useState({name:"",purpose:"",leadUnitId:units.some(u=>u.id===me.unit_id)?me.unit_id:"",startsOn:"",endsOn:"",participants:[]});
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const saving=useRef(false),errorRef=useRef(null),createdId=useRef(null);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  const set=(key,value)=>setForm(previous=>({...previous,[key]:value}));
  const ready=form.name.trim()&&units.some(u=>u.id===form.leadUnitId)&&(!form.startsOn||!form.endsOn||form.endsOn>=form.startsOn);
  async function save(event) {
    event.preventDefault();
    if(!ready||saving.current)return;
    saving.current=true;setBusy(true);setError("");
    try {
      // A confirmed server identity is retained if a subsequent read fails;
      // retry verifies it rather than creating a second project.
      if(!createdId.current) {
        const result=await supabase.rpc("create_project_with_participants",{
          p_lead_unit_id:form.leadUnitId,p_name:form.name.trim(),p_purpose:form.purpose.trim()||null,
          p_starts_on:form.startsOn||null,p_ends_on:form.endsOn||null,
          p_participant_unit_ids:form.participants.filter(id=>id!==form.leadUnitId),
        });
        if(result.error)throw result.error;
        if(typeof result.data!=="string"||!result.data)throw new Error("The project identity could not be confirmed. Review Projects before retrying.");
        createdId.current=result.data;
      }
      const result=await supabase.from("projects").select("id,org_id,name,lead_unit_id").eq("org_id",me.org_id).eq("id",createdId.current).single();
      if(result.error)throw result.error;
      if(result.data?.id!==createdId.current||result.data.org_id!==me.org_id||result.data.name!==form.name.trim()||result.data.lead_unit_id!==form.leadUnitId)
        throw new Error("The saved project could not be independently confirmed. Review Projects before retrying.");
      await onCreated(createdId.current);
    } catch(failure) {setError(humanError(failure,"The project could not be confirmed. Your draft is retained."));}
    finally {saving.current=false;setBusy(false);}
  }
  return <ComposerDrawer open title="Create project" onClose={()=>{if(!saving.current)onClose();}} description="Start with the essentials. You can add tasks, goals and updates after creating the project.">
    {error&&<div ref={errorRef} tabIndex={-1} role="region" aria-label="Project creation error"><ProductNotice tone="error" title="Project creation">{error}</ProductNotice></div>}
    <form onSubmit={save} className="ceac-project-create-form">
      <fieldset disabled={busy||Boolean(createdId.current)} className="ceac-project-create-fields">
        <section className="ceac-project-create-section" aria-labelledby="project-basic-heading">
          <div className="ceac-project-create-section-head"><span className="ceac-project-create-step">01</span><div><h3 id="project-basic-heading">Project details</h3><p>Give the project a clear name and explain what success looks like.</p></div></div>
          <FieldGroup label="Project name"><input className="field" required maxLength={200} placeholder="e.g. Welcome new volunteers" value={form.name} onChange={e=>set("name",e.target.value)}/></FieldGroup>
          <FieldGroup label="Purpose"><textarea className="field" rows={3} placeholder="What is this project for, and what should it achieve?" value={form.purpose} onChange={e=>set("purpose",e.target.value)}/></FieldGroup>
        </section>
        <section className="ceac-project-create-section" aria-labelledby="project-people-heading">
          <div className="ceac-project-create-section-head"><span className="ceac-project-create-step">02</span><div><h3 id="project-people-heading">Who's responsible?</h3><p>Choose the department that will lead this project.</p></div></div>
          <FieldGroup label="Lead department"><select className="field" required value={form.leadUnitId} onChange={e=>setForm(previous=>({...previous,leadUnitId:e.target.value,participants:previous.participants.filter(id=>id!==e.target.value)}))}>
            <option value="">Choose a department</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select></FieldGroup>
          <details className="ceac-project-create-more">
            <summary>Other departments helping <span>{form.participants.length?form.participants.length+" selected":"Optional"}</span></summary>
            <p>Choose any other departments that will work on this project.</p>
            <fieldset className="ceac-project-create-departments"><legend className="field-label">Participating departments</legend>
              {units.filter(unit=>unit.id!==form.leadUnitId).map(unit=><label className="ck" key={unit.id}><input type="checkbox" checked={form.participants.includes(unit.id)} onChange={e=>set("participants",e.target.checked?[...form.participants,unit.id]:form.participants.filter(id=>id!==unit.id))}/><span>{unit.name}</span></label>)}
            </fieldset>
          </details>
        </section>
        <section className="ceac-project-create-section" aria-labelledby="project-dates-heading">
          <div className="ceac-project-create-section-head"><span className="ceac-project-create-step">03</span><div><h3 id="project-dates-heading">Project dates</h3><p>Add dates if you know them. You can plan the work after creating the project.</p></div></div>
          <div className="ceac-project-create-dates">
            <FieldGroup label="Start date"><input className="field" type="date" value={form.startsOn} onChange={e=>set("startsOn",e.target.value)}/></FieldGroup>
            <FieldGroup label="Target date"><input className="field" type="date" min={form.startsOn||undefined} value={form.endsOn} onChange={e=>set("endsOn",e.target.value)}/></FieldGroup>
          </div>
          {form.startsOn&&form.endsOn&&form.endsOn<form.startsOn&&<p className="ceac-project-create-validation" role="alert">The target date must be on or after the start date.</p>}
        </section>
      </fieldset>
      <div className="ceac-project-create-footer"><span>Tasks and milestones come next.</span><div><button className="btn btn-ghost" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="btn" disabled={busy||!ready}>{busy?"Creating project…":createdId.current?"Verify saved project":"Create project"}</button></div></div>
    </form>
  </ComposerDrawer>;
}
