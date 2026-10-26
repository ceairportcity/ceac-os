import { StatePanel } from "../experience-v2/components";
import { WorkPageHeader } from "../experience-v2/work-family/WorkFamilyV2";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { EmptyState, FieldGroup, LoadingState } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { Table } from "../components/primitives";

function humanize(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replaceAll(".", " · ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function auditTime(value) {
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

export default function AdminAudit({ me }) {
  const [events, setEvents] = useState([]);
  const [actors, setActors] = useState({});
  const [resource, setResource] = useState("all");
  const [action, setAction] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.id]);

  async function load() {
    setLoading(true);
    setError(null);

    const { data, error: auditError } = await supabase
      .from("platform_audit_events")
      .select("id,actor_id,action,resource_type,resource_id,subject_profile_id,source_table,changed_fields,created_at")
      .eq("org_id", me.org_id)
      .order("created_at", { ascending: false })
      .limit(250);

    if (auditError) {
      setError(humanError(auditError, "The audit record could not load."));
      setLoading(false);
      return;
    }

    const rows = data || [];
    const actorIds = [...new Set(rows.map((event) => event.actor_id).filter(Boolean))];
    let actorMap = {};

    if (actorIds.length) {
      const { data: profiles, error: actorError } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", actorIds);
      if (actorError) {
        setError(humanError(actorError, "Audit actors could not be resolved."));
        setLoading(false);
        return;
      }
      actorMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile.full_name]));
    }

    setEvents(rows);
    setActors(actorMap);
    setLoading(false);
  }

  const resources = useMemo(
    () => [...new Set(events.map((event) => event.resource_type).filter(Boolean))].sort(),
    [events]
  );
  const actions = useMemo(
    () => [...new Set(events.map((event) => event.action).filter(Boolean))].sort(),
    [events]
  );

  const cleanSearch = searchText.trim().toLowerCase();
  const shown = events.filter((event) => {
    if (resource !== "all" && event.resource_type !== resource) return false;
    if (action !== "all" && event.action !== action) return false;
    if (!cleanSearch) return true;
    const actor = actors[event.actor_id] || "System";
    return [
      actor,
      event.action,
      event.resource_type,
      event.resource_id,
      event.subject_profile_id,
      ...(event.changed_fields || []),
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(cleanSearch));
  });

  if (loading) return <div className="body"><LoadingState label="Loading audit history…" /></div>;

  return <div className="body">
    <WorkPageHeader eyebrow="Governance" title="Activity history" description="See who changed a record and when. Showing up to 250 recent changes. Previous entries cannot be edited. Confidential HR activity has its own protected history." />

    {error && <StatePanel state="error" title="Records could not load" description={error} actionLabel="Try again" onAction={load} />}

    {!error && <div className="split" style={{ marginTop: 18 }}>
      <div className="main-col">
        <div className="sec"><span>Recent changes</span><span>{shown.length}</span></div>
        <Table
          rows={shown}
          empty="No audit events match."
          exportName="ceac-audit"
          columns={[
            { key:"created_at",label:"When",width:150,render:(row)=>auditTime(row.created_at) },
            { key:"actor_id",label:"Who",render:(row)=>actors[row.actor_id] || "System" },
            { key:"action",label:"Action",render:(row)=>humanize(row.action) },
            { key:"resource_type",label:"Record",render:(row)=>humanize(row.resource_type) + (row.resource_id ? " · " + row.resource_id.slice(0,8) : "") },
            { key:"changed_fields",label:"Changed",render:(row)=>(row.changed_fields || []).length ? row.changed_fields.map(humanize).join(", ") : "—",csv:(row)=>(row.changed_fields||[]).join("; ") },
          ]}
        />
      </div>

      <div className="side-col">
        <div className="sec"><span>Filter</span></div>
        <div className="card" style={{ padding: 15 }}>
          <FieldGroup label="Search">
            <input className="field" aria-label="Search audit" type="search" placeholder="Actor, action, field or record" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
          </FieldGroup>
          <FieldGroup label="Resource">
            <select className="field" aria-label="Audit resource" value={resource} onChange={(event) => setResource(event.target.value)}>
              <option value="all">All resources</option>
              {resources.map((value) => <option value={value} key={value}>{humanize(value)}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Action">
            <select className="field" aria-label="Audit action" value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="all">All actions</option>
              {actions.map((value) => <option value={value} key={value}>{humanize(value)}</option>)}
            </select>
          </FieldGroup>
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={load}>Refresh audit</button>
        </div>

        <div className="sec"><span>Audit contract</span></div>
        <div className="card" style={{ padding: 15 }}>
          <p className="small" style={{ lineHeight: 1.6, margin: 0 }}>
            Audit rows cannot be edited or deleted through CEAC OS. The log stores who changed what, when, and which fields changed without copying arbitrary record contents into a shadow data store.
          </p>
        </div>
      </div>
    </div>}
  </div>;
}
