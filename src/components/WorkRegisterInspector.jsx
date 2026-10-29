import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import WorkActivityDiary from "./WorkActivityDiary";
import WorkProjectLink from "./WorkProjectLink";
import WorkDetailsEditor from "./WorkDetailsEditor";
import "./WorkRegisterInspector.css";

/** Approved Work register's selected-responsibility inspector.
 * Uses real RLS-scoped work and contribution records, never sample outcomes. */
export function WorkRegisterInspector({ me, selectedId, onClose, openItem }) {
  const [sourceWork, setSourceWork] = useState(null);
  const [completedWorkScope, setCompletedWorkScope] = useState("");
  const [loading, setLoading] = useState(Boolean(selectedId));
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const workScope = `${me.org_id}:${me.id}:${selectedId || ""}`;
  const checking = Boolean(selectedId) && (loading || completedWorkScope !== workScope);
  const activeError = completedWorkScope === workScope ? error : "";
  const work = !checking && !activeError && completedWorkScope === workScope ? sourceWork : null;
  useEffect(() => {
    let current = true;
    setSourceWork(null); setCompletedWorkScope("");
    setError("");
    if (!selectedId) { setLoading(false); setCompletedWorkScope(workScope); return () => { current = false; }; }
    setLoading(true);
    supabase.from("work_items")
      .select("id,org_id,unit_id,project_id,objective_id,phase_id,assignee_id,assigned_by,last_movement_at,instructions,origin,visibility,confidential,title,ref,kind,status,purpose,expected_outcome,due_at,projects(name),profiles!work_items_assignee_id_fkey(full_name)")
      .eq("id",selectedId).eq("org_id",me.org_id).single()
      .then(({data,error:readError}) => {
        if (!current) return;
        if (readError) setError("This responsibility could not be verified for your account.");
        else if (!data || data.id !== selectedId || data.org_id !== me.org_id)
          setError("The selected responsibility could not be verified.");
        else setSourceWork(data);
        setCompletedWorkScope(workScope); setLoading(false);
      }).catch(() => {
        if (!current) return;
        setSourceWork(null); setError("This responsibility could not be loaded. Retry.");
        setCompletedWorkScope(workScope); setLoading(false);
      });
    return () => { current=false; };
  }, [me.id,me.org_id,selectedId,reload]);

  return <aside className="s2-work-inspector" aria-label="Selected responsibility">
    <header className="s2-work-inspector-head">
      <span>Selected responsibility</span>
      {onClose && <button aria-label="Close responsibility inspector" type="button" onClick={onClose}>×</button>}
    </header>
    {!selectedId && <p className="s2-work-inspector-empty">Choose a responsibility from the register to inspect it.</p>}
    {checking && <p role="status">Loading selected responsibility…</p>}
    {activeError && <div role="alert">{activeError}<button type="button" onClick={() => setReload(n=>n+1)}>Retry</button></div>}
    {!checking && !activeError && work && <>
      <h2>{work.title}</h2>
      <p className="s2-work-inspector-context">{work.ref} · {work.projects?.name || "No linked project"}</p>
      <WorkActivityDiary me={me} item={work} compact key={`${me.id}:${work.id}`} />
      <WorkProjectLink me={me} item={work} key={`${me.id}:${work.id}`} onLinked={() => setReload(n=>n+1)} />
      <details className="s2-work-inspector-details"><summary>Responsibility details</summary>
      <WorkDetailsEditor key={`${me.id}:${work.id}:${work.last_movement_at}`} me={me} item={work} onSaved={() => setReload(n=>n+1)} />
      <dl className="s2-work-inspector-facts">
        <div><dt>Person responsible</dt><dd>{work.assignee_id === me.id ? "You" : work.profiles?.full_name || "Authorised person"}</dd></div>
        <div><dt>Origin</dt><dd>{work.origin === "self_created" ? "Self-created" : "Assigned"}</dd></div>
        <div><dt>Due date</dt><dd>{work.due_at ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"Africa/Accra"}).format(new Date(work.due_at)) : "Not specified"}</dd></div>
      </dl>
      {work.expected_outcome && <section className="s2-work-inspector-outcome">
        <strong>Expected outcome</strong><p>{work.expected_outcome}</p>
      </section>}
      </details>
      <button className="btn btn-ghost" type="button" onClick={() => openItem?.(work.id)}>
        Open full work record →
      </button>
      <footer><strong>Evidence & outcomes</strong> stay linked to the person and project.</footer>
    </>}
  </aside>;
}

export default function WorkRegisterLayout({ me, selectedId, onClose, openItem, children, tabs, recordCount }) {
  return <div className="s2-work-layout">
    <div className="s2-work-register">
      {tabs && <><header className="s2-register-heading"><h2>Responsibilities</h2><span>{recordCount} current records</span></header>{tabs}</>}
      {children}
    </div>
    <WorkRegisterInspector me={me} selectedId={selectedId} onClose={onClose} openItem={openItem}/>
  </div>;
}
