import {useEffect,useRef,useState} from "react";
import {ComposerDrawer} from "../experience-v2/components";
import {FieldGroup,ProductNotice} from "./bits";
import {supabase} from "../lib/supabase";
import {humanError} from "../lib/productLanguage";
import "./admin-project-composer.css";

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
  return <ComposerDrawer open title="Create project" onClose={()=>{if(!saving.current)onClose();}} description="Start with the goal and the department responsible. You can plan tasks and invite people after creating the project.">
    {error&&<div ref={errorRef} tabIndex={-1} role="region" aria-label="Project creation error"><ProductNotice tone="error" title="We couldn't finish creating the project">{error}</ProductNotice></div>}
    <form onSubmit={save} className="ceac-project-composer">
      <fieldset disabled={busy||Boolean(createdId.current)} className="ceac-project-composer-fields">
        <section className="ceac-project-form-section" aria-labelledby="ceac-project-basics">
          <header><span className="ceac-project-form-index" aria-hidden="true">01</span><div><h3 id="ceac-project-basics">The project</h3><p>Give this project a clear name and describe what you want to achieve.</p></div></header>
          <FieldGroup label="Project name"><input className="field" required maxLength={200} autoFocus placeholder="For example, New Members Welcome Programme" value={form.name} onChange={e=>set("name",e.target.value)}/></FieldGroup>
          <FieldGroup label="What is this project for?"><textarea className="field" rows={3} placeholder="Describe the result you want, in one or two sentences." value={form.purpose} onChange={e=>set("purpose",e.target.value)}/></FieldGroup>
        </section>
        <section className="ceac-project-form-section" aria-labelledby="ceac-project-people">
          <header><span className="ceac-project-form-index" aria-hidden="true">02</span><div><h3 id="ceac-project-people">Who is responsible?</h3><p>Choose one department to lead. You can include other departments if they will help.</p></div></header>
          <FieldGroup label="Which department is responsible?"><select className="field" aria-label="Lead department" required value={form.leadUnitId} onChange={e=>setForm(previous=>({...previous,leadUnitId:e.target.value,participants:previous.participants.filter(id=>id!==e.target.value)}))}>
            <option value="">Choose the lead department</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select></FieldGroup>
          {units.some(unit=>unit.id!==form.leadUnitId)&&<details className="ceac-project-form-collaborators">
            <summary>Other departments helping <span>{form.participants.length ? form.participants.length+" selected" : "Optional"}</span></summary>
            <p>Select only departments that will take part in this project.</p>
            <div className="ceac-project-form-options">{units.filter(unit=>unit.id!==form.leadUnitId).map(unit=><label key={unit.id}><input type="checkbox" checked={form.participants.includes(unit.id)} onChange={e=>set("participants",e.target.checked?[...form.participants,unit.id]:form.participants.filter(id=>id!==unit.id))}/><span>{unit.name}</span></label>)}</div>
          </details>}
        </section>
        <section className="ceac-project-form-section" aria-labelledby="ceac-project-timing">
          <header><span className="ceac-project-form-index" aria-hidden="true">03</span><div><h3 id="ceac-project-timing">When will it happen?</h3><p>Dates are optional. Add them now if you already have a schedule.</p></div></header>
          <div className="ceac-project-form-date-grid">
            <FieldGroup label="Start date"><input className="field" type="date" value={form.startsOn} onChange={e=>set("startsOn",e.target.value)}/></FieldGroup>
            <FieldGroup label="When should it be completed?"><input className="field" aria-label="Target date" type="date" min={form.startsOn||undefined} value={form.endsOn} onChange={e=>set("endsOn",e.target.value)}/></FieldGroup>
          </div>
          {form.startsOn&&form.endsOn&&form.endsOn<form.startsOn?<p role="alert" className="ceac-project-form-error">The completion date must be on or after the start date.</p>:null}
        </section>
      </fieldset>
      <footer className="ceac-project-form-footer">
        <p>Next: add tasks, set milestones and bring your team into the project.</p>
        <div><button className="btn btn-ghost" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="btn" disabled={busy||!ready}>{busy?"Creating project…":createdId.current?"Check saved project":"Create project"}</button></div>
      </footer>
    </form>
  </ComposerDrawer>;
}
