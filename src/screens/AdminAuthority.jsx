import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, LoadingState, ProductNotice } from "../components/bits";
import { Button, ComposerDrawer, DataPanel, MotionDisclosure, QueueRow, RecordRow, StatePanel, StatusBadge } from "../experience-v2/components";
import { humanError } from "../lib/productLanguage";

const ORG_ONLY = new Set(["authority.manage","hr_private.access","payroll.prepare","payroll.approve","audit.view","support.case.manage"]);

function stamp(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminAuthority({ me, refreshMe, initialProfileId=null }) {
  const [people, setPeople] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [grants, setGrants] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedId, setSelectedId] = useState(initialProfileId || me.id);
  const [capability, setCapability] = useState("people.manage");
  const [scopeUnitId, setScopeUnitId] = useState("");
  const [reason, setReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeGrantId, setRevokeGrantId] = useState(null);

  useEffect(() => { load(); }, [me.id,me.org_id]);
  useEffect(() => { if (initialProfileId) setSelectedId(initialProfileId); }, [initialProfileId]);

  async function load() {
    setLoading(true);
    setError(null);
    const [peopleResult, definitionsResult, grantsResult, unitsResult] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,job_title,active,is_admin,is_exec").eq("org_id", me.org_id).order("full_name"),
      supabase.from("capability_definitions").select("capability,label,description,sensitive").order("label"),
      supabase.from("capability_grants").select("id,profile_id,capability,scope_unit_id,granted_by,granted_at,grant_reason,revoked_by,revoked_at,revoke_reason").eq("org_id", me.org_id).order("granted_at", { ascending: false }),
      supabase.from("units").select("id,name").eq("org_id", me.org_id).eq("active", true).order("name"),
    ]);
    const firstError = peopleResult.error || definitionsResult.error || grantsResult.error || unitsResult.error;
    if (firstError) {
      setError(humanError(firstError, "Authority records could not load."));
      setLoading(false);
      return;
    }
    const authorisedPeople=peopleResult.data || [];
    setPeople(authorisedPeople);
    setSelectedId(current=>authorisedPeople.some(person=>person.id===current)?current:me.id);
    setDefinitions(definitionsResult.data || []);
    setGrants(grantsResult.data || []);
    setUnits(unitsResult.data || []);
    setLoading(false);
  }

  const selected = people.find((person) => person.id === selectedId) || null;
  const selectedGrants = grants.filter((grant) => grant.profile_id === selectedId);
  const activeGrants = selectedGrants.filter((grant) => !grant.revoked_at);
  const peopleById = useMemo(() => Object.fromEntries(people.map((person) => [person.id, person])), [people]);
  const unitsById = useMemo(() => Object.fromEntries(units.map((unit) => [unit.id, unit.name])), [units]);
  const definition = definitions.find((item) => item.capability === capability);

  useEffect(() => {
    if (ORG_ONLY.has(capability)) setScopeUnitId("");
  }, [capability]);

  async function grant() {
    if (!selectedId || !capability || !reason.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: grantError } = await supabase.rpc("grant_capability", {
      p_profile_id: selectedId,
      p_capability: capability,
      p_scope_unit_id: scopeUnitId || null,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (grantError) {
      setError(humanError(grantError, "The capability could not be granted."));
      return;
    }
    setReason("");
    setGrantOpen(false);
    setNotice("Capability granted.");
    await load();
    if (selectedId === me.id) await refreshMe?.();
  }

  async function revoke(grantId) {
    if (!revokeReason.trim()) {
      setError("Enter a reason before revoking authority.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: revokeError } = await supabase.rpc("revoke_capability", {
      p_grant_id: grantId,
      p_reason: revokeReason.trim(),
    });
    setBusy(false);
    if (revokeError) {
      setError(humanError(revokeError, "The capability could not be revoked."));
      return;
    }
    setRevokeReason("");
    setRevokeGrantId(null);
    setNotice("Capability revoked.");
    await load();
    if (selectedId === me.id) await refreshMe?.();
  }

  if (loading) return <div className="body"><LoadingState label="Loading access permissions…" /></div>;

  return <div className="body">
    <div style={{ paddingTop: 26 }}>
      <div className="eyebrow">Security & governance</div>
      <h1 className="h1">Access permissions</h1>
      <p className="screen-note">Choose who can access information and what they can do. A job title does not automatically give sensitive access.</p>
    </div>

    {error && <ProductNotice tone="error" title="Authority">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Authority updated">{notice}</ProductNotice>}

    <DataPanel eyebrow="Person record" title="Person" supporting="Choose a person to review or change their permissions." action={<Button size="compact" onClick={()=>setGrantOpen(true)}>Add permission</Button>}>
      <FieldGroup label="Choose person">
        <select className="field" aria-label="Authority person" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setNotice(null); setError(null); }}>
          {people.map((person) => <option key={person.id} value={person.id}>{person.full_name} · {person.email}</option>)}
        </select>
      </FieldGroup>
      {selected && <RecordRow name={selected.full_name} title={selected.full_name} meta={`${selected.job_title || "No job title"} · ${selected.active ? "Active" : "Inactive"}`} status={selected.active?"Active":"Inactive"} statusTone={selected.active?"success":"neutral"} />}
    </DataPanel>

    <DataPanel eyebrow="Current access" title="Active permissions" supporting="These permissions were assigned explicitly. Job titles do not grant access." action={<StatusBadge tone="neutral" icon={false}>{activeGrants.length} active</StatusBadge>}>
      {activeGrants.map((grant) => {
        const def = definitions.find((item) => item.capability === grant.capability);
        return <QueueRow key={grant.id} icon="shield" title={def?.label || grant.capability}
          meta={`${grant.scope_unit_id ? unitsById[grant.scope_unit_id] || "Unit scope" : "Organisation-wide"} · granted ${stamp(grant.granted_at)}${grant.granted_by ? " by " + (peopleById[grant.granted_by]?.full_name || "authorised user") : " · baseline"} · ${grant.grant_reason || "No reason recorded"}`}
          status="Active" statusTone="success"
          trailing={<Button variant="quiet" size="compact" disabled={busy} onClick={()=>{setRevokeReason("");setRevokeGrantId(grant.id);}}>Remove permission</Button>} />;
      })}
      {activeGrants.length === 0 && <StatePanel state="empty" title="No active permissions" description="No sensitive permissions have been assigned to this person." />}
    </DataPanel>

    <DataPanel eyebrow="History" title="Permission history" supporting="Review previous permissions, who removed them and why.">
      <Button variant="quiet" size="compact" onClick={()=>setHistoryOpen((value)=>!value)}>{historyOpen?"Hide permission history":"Show permission history"}</Button>
      <MotionDisclosure open={historyOpen} ariaLabel="Authority grant history">
        {selectedGrants.filter((grant) => grant.revoked_at).map((grant) => <QueueRow key={grant.id} icon="history"
          title={definitions.find((item) => item.capability === grant.capability)?.label || grant.capability}
          meta={`Revoked ${stamp(grant.revoked_at)}${grant.revoked_by ? " by " + (peopleById[grant.revoked_by]?.full_name || "authorised user") : ""} · ${grant.revoke_reason || "No reason recorded"}`}
          status="Revoked" statusTone="neutral" />)}
        {!selectedGrants.some((grant)=>grant.revoked_at)&&<StatePanel state="empty" title="No revoked grants" description="No revoked authority history is recorded for this person." />}
      </MotionDisclosure>
    </DataPanel>

    <ComposerDrawer open={grantOpen} onClose={()=>!busy&&setGrantOpen(false)} title="Add permission"
      description="Add only the access this person needs and record why."
      footer={<><Button variant="secondary" disabled={busy} onClick={()=>setGrantOpen(false)}>Cancel</Button><Button busy={busy} disabled={!selectedId||!reason.trim()} onClick={grant}>{busy?"Saving…":"Add permission"}</Button></>}>
      <FieldGroup label="Permission">
        <select className="field" aria-label="Capability" value={capability} onChange={(event) => setCapability(event.target.value)}>
          {definitions.map((item) => <option key={item.capability} value={item.capability}>{item.label}</option>)}
        </select>
      </FieldGroup>
      {definition && <p className="small" style={{ lineHeight: 1.5 }}>{definition.description}</p>}
      {capability === "support.case.manage" && <p className="screen-note">Technical Support case access requires both an active Support membership recorded by People Administration and this separately approved, organisation-wide capability. Unit Head status alone is not sufficient. This grant cannot confer HR, Payroll or broader Administration authority.</p>}
      <FieldGroup label="Who this covers">
        <select className="field" aria-label="Capability scope" value={scopeUnitId} disabled={ORG_ONLY.has(capability)} onChange={(event) => setScopeUnitId(event.target.value)}>
          <option value="">Organisation-wide</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </FieldGroup>
      {ORG_ONLY.has(capability) && <p className="small">This permission applies across the organisation.</p>}
      <FieldGroup label="Reason for access"><textarea className="field" aria-label="Grant reason" rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this access is needed" /></FieldGroup>
    </ComposerDrawer>

    <ComposerDrawer open={Boolean(revokeGrantId)} onClose={()=>!busy&&setRevokeGrantId(null)} title="Remove permission"
      description="The person loses this permission. The original record and the reason for removal remain in history."
      footer={<><Button variant="secondary" disabled={busy} onClick={()=>setRevokeGrantId(null)}>Cancel</Button><Button variant="danger" busy={busy} disabled={!revokeReason.trim()} onClick={()=>revoke(revokeGrantId)}>{busy?"Revoking…":"Revoke"}</Button></>}>
      <FieldGroup label="Reason for removal"><textarea className="field" aria-label="Revocation reason" rows="3" value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} placeholder="Why this access is being removed" /></FieldGroup>
      <p className="small" style={{ lineHeight: 1.5 }}>The final organisation authority manager cannot be removed through this flow.</p>
    </ComposerDrawer>
  </div>;
}
