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
  return <ComposerDrawer open title="Create project" onClose={()=>{if(!saving.current)onClose();}} description="Choose the lead department, then add objectives and give out work in the project workspace.">
    {error&&<div ref={errorRef} tabIndex={-1} role="region" aria-label="Project creation error"><ProductNotice tone="error" title="Project creation">{error}</ProductNotice></div>}
    <form onSubmit={save} style={{display:"grid",gap:12}}>
      <fieldset disabled={busy||Boolean(createdId.current)} style={{display:"grid",gap:12,border:0,padding:0,margin:0,minWidth:0}}>
        <FieldGroup label="Project name"><input className="field" required maxLength={200} value={form.name} onChange={e=>set("name",e.target.value)}/></FieldGroup>
        <FieldGroup label="Purpose"><textarea className="field" rows={3} value={form.purpose} onChange={e=>set("purpose",e.target.value)}/></FieldGroup>
        <FieldGroup label="Lead department"><select className="field" required value={form.leadUnitId} onChange={e=>setForm(previous=>({...previous,leadUnitId:e.target.value,participants:previous.participants.filter(id=>id!==e.target.value)}))}>
          <option value="">Choose a department</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select></FieldGroup>
        <FieldGroup label="Start date"><input className="field" type="date" value={form.startsOn} onChange={e=>set("startsOn",e.target.value)}/></FieldGroup>
        <FieldGroup label="Target date"><input className="field" type="date" min={form.startsOn||undefined} value={form.endsOn} onChange={e=>set("endsOn",e.target.value)}/></FieldGroup>
        <fieldset style={{border:0,padding:0,margin:0}}><legend className="field-label">Participating departments</legend>
          {units.filter(unit=>unit.id!==form.leadUnitId).map(unit=><label className="ck" key={unit.id}><input type="checkbox" checked={form.participants.includes(unit.id)} onChange={e=>set("participants",e.target.checked?[...form.participants,unit.id]:form.participants.filter(id=>id!==unit.id))}/><span>{unit.name}</span></label>)}
        </fieldset>
      </fieldset>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button className="btn btn-ghost" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="btn" disabled={busy||!ready}>{busy?"Saving project…":createdId.current?"Verify saved project":"Create project"}</button></div>
    </form>
  </ComposerDrawer>;
}
