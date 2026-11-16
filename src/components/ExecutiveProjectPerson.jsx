import { useState } from "react";
import { supabase } from "../lib/supabase";
import { ProductNotice } from "./bits";
import { ComposerDrawer } from "../experience-v2/components";
import ProjectPersonPicker from "./ProjectPersonPicker";
import { humanError } from "../lib/productLanguage";

export default function ExecutiveProjectPerson({ me, project, onSaved }) {
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    if (busy || !personId || personId === project.assigned_person_id) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.from("projects").update({ assigned_person_id: personId })
        .eq("id", project.id).eq("org_id", me.org_id).select("assigned_person_id").single();
      if (result.error) throw result.error;
      if (result.data?.assigned_person_id !== personId) throw new Error("The assignment could not be confirmed.");
      setOpen(false);
      onSaved();
    } catch (failure) {
      setError(humanError(failure, "The project assignment could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  const label = project.assigned_person_id ? "Change responsible person" : "Assign individual";
  return <>
    <button type="button" className="btn btn-ghost" onClick={() => {
      setPersonId(project.assigned_person_id || "");
      setError("");
      setOpen(true);
    }}>{label}</button>
    {open && <ComposerDrawer open title={label} description={project.name} onClose={() => { if (!busy) setOpen(false); }}>
      {project.participants.length > 0 && <p className="screen-note">Departments already on this project will keep their access.</p>}
      {error && <ProductNotice tone="error" title="Assignment unavailable">{error}</ProductNotice>}
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <ProjectPersonPicker orgId={me.org_id} value={personId} onChange={setPersonId} />
        </fieldset>
        <div className="exec-directory-actions">
          <button className="btn" type="submit" disabled={busy || !personId || personId === project.assigned_person_id}>
            {busy ? "Saving…" : "Save assignment"}
          </button>
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </form>
    </ComposerDrawer>}
  </>;
}
