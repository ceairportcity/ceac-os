import { useEditorPosition } from "../lib/useEditorPosition";
import { useWorkFormDraft } from "../lib/useWorkFormDraft";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import "./ProjectManageControls.css";

/** Project changes are verified in manage_ceac_project; this menu is presentation only. */
export default function ProjectManageControls({ me, project, onChanged }) {
  const [savedMode,setSavedMode]=useEditorPosition(me,`project-edit:${project?.id}`,"");
  const [actionMode,setActionMode]=useState("");
  const mode = actionMode || savedMode;
  function setMode(value) { setSavedMode(value); setActionMode(""); }
  const currentDetails = {name:project?.name||"",purpose:project?.purpose||"",
    starts_on:project?.starts_on||"",ends_on:project?.ends_on||""};
  const [draft,setDraft]=useState(currentDetails);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const canManage=project?.created_by===me.id || me.is_admin || me.is_exec
    || (me.memberships||[]).some(row=>row.role==="manager"&&row.unit_id===project?.lead_unit_id);
  const recovery = useWorkFormDraft(me, canManage && mode === "save" ? `edit-project:${project.id}` : "", { draft }, (saved) => setDraft(saved.draft));
  if(!project || !canManage) return null;

  const begin=(next)=>{
    setError("");setNotice("");setMode(next === "save" ? next : "");
    setActionMode(next === "save" ? "" : next);
    setDraft(currentDetails);
  };
  async function save(event) {
    event.preventDefault();
    if(!mode || busy) return;
    setBusy(true);setError("");setNotice("");
    try {
      const args={p_project_id:project.id,p_action:mode};
      if(mode==="save")Object.assign(args,{
        p_name:draft.name.trim(),p_purpose:draft.purpose.trim(),
        p_starts_on:draft.starts_on||null,p_ends_on:draft.ends_on||null,
      });
      const result=await supabase.rpc("manage_ceac_project",args);
      if(result.error || result.data!==true)
        throw result.error||new Error("The project change could not be confirmed.");
      const action=mode;
      if (action === "save") void recovery.clear();
      setMode("");
      setNotice(action==="save"?"Project details updated.":action==="archive"?"Project archived.":action==="restore"?"Project restored.":"Unused project removed from the register.");
      await onChanged?.(action);
    }catch(cause){setError(cause?.message||"Project change could not be saved.");}
    finally{setBusy(false);}
  }

  return <section className="ceac-project-manage" aria-label="Project management">
    <details className="ceac-project-manage-menu">
      <summary aria-label="Project options" title="Project options">⋯</summary>
      <div className="ceac-project-manage-actions">
        {!project.archived_at&&<button type="button" onClick={()=>begin("save")}>Edit details</button>}
        {project.archived_at
          ? <button type="button" onClick={()=>begin("restore")}>Restore project</button>
          : <button type="button" onClick={()=>begin("archive")}>Archive project</button>}
        {!project.archived_at&&<button type="button" onClick={()=>begin("delete")}>Delete unused project</button>}
      </div>
    </details>
    {recovery.notice && <p role="status">{recovery.notice}</p>}
    {error&&<p role="alert" className="ceac-project-manage-error">{error}</p>}
    {notice&&<p role="status" className="ceac-project-manage-notice">{notice}</p>}
    {mode&&<form onSubmit={save} className="ceac-project-manage-form" aria-label="Project change">
      <header><strong>{mode==="save"?"Edit project details":mode==="archive"?"Archive project":mode==="restore"?"Restore project":"Delete unused project"}</strong>
        <button type="button" disabled={busy} onClick={()=>setMode("")} aria-label="Close project editor">Close</button>
      </header>
      {!recovery.ready ? <p role="status">Checking for a saved draft…</p> : mode==="save"?<>
        <label>Project name<input required minLength={3} maxLength={220} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} /></label>
        <label>Purpose<textarea maxLength={4000} rows={3} value={draft.purpose} onChange={e=>setDraft({...draft,purpose:e.target.value})}/></label>
        <div className="ceac-project-manage-dates">
          <label>Start date<input type="date" value={draft.starts_on} onChange={e=>setDraft({...draft,starts_on:e.target.value})}/></label>
          <label>End date<input type="date" min={draft.starts_on||undefined} value={draft.ends_on} onChange={e=>setDraft({...draft,ends_on:e.target.value})}/></label>
        </div>
      </>:<p>{mode==="archive"?"This project will leave the active portfolio. Its completed work, reviews and records remain available for audit. You can restore it later.":mode==="restore"?"Return the project to the active portfolio without changing its work history.":"Only a project with no substantive work, reports or related records can be removed. Projects with history must be archived instead."}</p>}
      <div className="ceac-project-manage-foot">
        <button type="button" disabled={busy} onClick={()=>{if(mode==="save")void recovery.clear();setMode("");}}>Cancel</button>
        <button type="submit" disabled={busy || !recovery.ready || mode==="save" && (!draft.name.trim()||draft.starts_on&&draft.ends_on&&draft.ends_on<draft.starts_on)}>{busy?"Saving…":mode==="save"?"Save changes":mode==="archive"?"Archive project":mode==="restore"?"Restore project":"Remove unused project"}</button>
      </div>
    </form>}
  </section>;
}
