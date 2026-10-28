import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, LoadingState, ProductNotice } from "./bits";
import { ComposerDrawer } from "../experience-v2/components";
const Assign = lazy(() => import("../screens/Assign"));

// The selected department is assignment context, never an invented membership
// or a change to the authenticated actor's profile/authority.
export default function ExecutiveAssign({ me, context = {}, back }) {
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(context.unitId || me.unit_id || "");
  const [pendingUnitId, setPendingUnitId] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    let current = true;
    setReady(false); setUnits([]); setError(null);
    supabase.from("units").select("id,name", {count:"exact"}).eq("org_id", me.org_id).eq("active", true).order("name").then(result => {
      if (!current) return;
      if (result.error || !Array.isArray(result.data) || result.count !== result.data.length) setError("Departments could not be completely loaded. Close and try again.");
      else { setUnits(result.data); setReady(true); }
    });
    return () => { current = false; };
  }, [me.org_id, me.id]);
  const picker = busy => <FieldGroup label="Department"><select aria-label="Assignment department" className="field" disabled={busy || !ready || pendingUnitId !== null} value={unitId} onChange={e => {
    const next = e.target.value;
    if (next === unitId) return;
    if (!unitId) setUnitId(next);
    else setPendingUnitId(next);
  }}><option value="">Choose a department</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select>
    {pendingUnitId !== null && <ProductNotice tone="warning" title="Change assignment department?">
      <p>Changing to {units.find(row => row.id === pendingUnitId)?.name || "no department"} clears unsaved work details and loads that department’s people.</p>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => { setUnitId(pendingUnitId); setPendingUnitId(null); }}>Change department</button>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setPendingUnitId(null)}>Keep current department</button>
    </ProductNotice>}
  </FieldGroup>;
  const unit = ready && units.find(row => row.id === unitId);
  if (!me.is_exec && !me.is_admin) return null;
  if (!unit) return <ComposerDrawer open onClose={back} title="Give out work" description="Choose the department responsible, then the person and project.">
    {error ? <ProductNotice tone="error" title="Departments unavailable">{error}</ProductNotice> : !ready ? <LoadingState label="Loading departments…" /> : <>{picker(false)}{!units.length && <p>No active departments are recorded.</p>}</>}
  </ComposerDrawer>;
  return <Suspense fallback={<LoadingState label="Opening work form…" />}><Assign key={`${me.org_id}:${me.id}:${unit.id}`} me={me} back={back} selectedUnitId={unit.id} scopeControl={picker} scopeChangePending={pendingUnitId !== null}
    initialAssigneeId={context.unitId === unit.id ? context.assigneeId || "" : ""}
    initialProjectId={context.projectId || ""} initialObjectiveId={context.objectiveId || ""} initialPhaseId={context.phaseId || ""}
    initialSubTeamId={context.subTeamId || ""} initialMeetingId={context.meetingId || ""} initialKind={context.kind || ""}
    initialMeetingTitle={context.meetingTitle || ""} initialMeetingOn={context.meetingOn || ""} initialMeetingNote={context.meetingNote || ""}
    initialTitle={context.title || ""} initialSourceRoomId={context.sourceRoomId || ""} initialSourceMessageId={context.sourceMessageId || ""}/></Suspense>;
}
