import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import WorkActivityDiary from "./WorkActivityDiary";
import WorkProjectLink from "./WorkProjectLink";
import { WorkStateBadge } from "../experience-v2/work-family/WorkFamilyV2";
import "./WorkRegisterInspector.css";

/** Approved Work register's selected-responsibility inspector.
 * Uses real RLS-scoped work and contribution records, never sample outcomes. */
export function WorkRegisterInspector({ me, selectedId, onClose, openItem }) {
  const [work, setWork] = useState(null);
  const [loading, setLoading] = useState(Boolean(selectedId));
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    setWork(null);
    setError("");
    if (!selectedId) { setLoading(false); return () => { current = false; }; }
    setLoading(true);
    supabase.from("work_items")
      .select("id,org_id,unit_id,project_id,objective_id,phase_id,assignee_id,origin,visibility,confidential,title,ref,kind,status,purpose,expected_outcome,due_at,projects(name),profiles!work_items_assignee_id_fkey(full_name)")
      .eq("id",selectedId).eq("org_id",me.org_id).single()
      .then(({data,error:readError}) => {
        if (!current) return;
        if (readError) setError("This responsibility could not be verified for your account.");
        else setWork(data);
        setLoading(false);
      });
    return () => { current=false; };
  }, [me.id,me.org_id,selectedId,reload]);

  return <aside className="s2-work-inspector" aria-label="Selected responsibility">
    <header className="s2-work-inspector-head">
      <span>Selected responsibility</span>
      {onClose && <button aria-label="Close responsibility inspector" type="button" onClick={onClose}>×</button>}
    </header>
    {!selectedId && <p className="s2-work-inspector-empty">Choose a responsibility from the register to inspect it.</p>}
    {loading && <p role="status">Loading selected responsibility…</p>}
    {error && <div role="alert">{error}<button type="button" onClick={() => setReload(n=>n+1)}>Retry</button></div>}
    {!loading && !error && work && <>
      <h2>{work.title}</h2>
      <p className="s2-work-inspector-context">{work.ref} · {work.projects?.name || "No linked project"}</p>
      <dl className="s2-work-inspector-facts">
        <div><dt>Work status</dt><dd><WorkStateBadge status={work.status}/></dd></div>
        <div><dt>Person responsible</dt><dd>{work.assignee_id === me.id ? "You" : work.profiles?.full_name || "Authorised person"}</dd></div>
        <div><dt>Origin</dt><dd>{work.origin === "self_created" ? "Self-created" : "Assigned"}</dd></div>
        <div><dt>Due date</dt><dd>{work.due_at ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"Africa/Accra"}).format(new Date(work.due_at)) : "Not specified"}</dd></div>
      </dl>
      {work.expected_outcome && <section className="s2-work-inspector-outcome">
        <strong>Expected outcome</strong><p>{work.expected_outcome}</p>
      </section>}
      <WorkProjectLink me={me} item={work} key={`${me.id}:${work.id}`} onLinked={() => setReload(n=>n+1)} />
      <WorkActivityDiary me={me} item={work} key={`${me.id}:${work.id}`} />
      <button className="btn s2-work-inspector-open" type="button" onClick={() => openItem?.(work.id)}>
        Open complete work record →
      </button>
    </>}
  </aside>;
}

export default function WorkRegisterLayout({ me, selectedId, onClose, openItem, children }) {
  return <div className="s2-work-layout">
    <div className="s2-work-register">{children}</div>
    <WorkRegisterInspector me={me} selectedId={selectedId} onClose={onClose} openItem={openItem}/>
  </div>;
}
