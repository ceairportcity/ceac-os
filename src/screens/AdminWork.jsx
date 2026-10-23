import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import SelfWorkComposer from "../components/SelfWorkComposer";
import WorkRegisterLayout from "../components/WorkRegisterInspector";
import ResponsibilityRegister from "../components/ResponsibilityRegister";
import { LoadingState, ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import {
  WorkEmpty,
  WorkFootnote,
  WorkGroup,
  WorkPageHeader,
  WorkReviewRow,
  WorkTabs,
} from "../experience-v2/work-family/WorkFamilyV2";

const CLOSED = new Set(["completed", "self_certified", "cancelled"]);

export default function AdminWork({ me, openItem, goAssign }) {
  const [view, setView] = useState("mine");
  const [addingMyWork, setAddingMyWork] = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [mine, setMine] = useState([]);
  const [given, setGiven] = useState([]);
  const [org, setOrg] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const readGeneration = useRef(0);
  const [loadedScope, setLoadedScope] = useState("");
  const actorScope = [me.org_id, me.id, me.unit_id].join(":");
  const scopedLoading = loading || loadedScope !== actorScope;

  useEffect(() => {
    const request = ++readGeneration.current;
    setAddingMyWork(false);
    setSelectedWorkId(null);
    void load(request, actorScope);
    return () => { readGeneration.current += 1; };
  }, [actorScope]);

  async function load(request = ++readGeneration.current, requestedScope = actorScope) {
    setLoadedScope("");
    setLoading(true);
    setError(null);
    setMine([]); setGiven([]); setOrg([]); setReviews([]);
    try {
      const fields = "id,ref,title,kind,status,origin,project_id,due_at,assigned_by,assignee_id,unit_id,projects(name),units(name),profiles!work_items_assignee_id_fkey(full_name)";
      const [mineR, givenR, orgR, reviewR] = await Promise.all([
        supabase.from("work_items").select(fields).eq("org_id", me.org_id).eq("assignee_id", me.id).order("created_at", { ascending: false }),
        supabase.from("work_items").select(fields).eq("org_id", me.org_id).eq("assigned_by", me.id).neq("assignee_id", me.id).order("created_at", { ascending: false }),
        supabase.from("work_items").select(fields).eq("org_id", me.org_id).order("last_movement_at", { ascending: false }).limit(250),
        supabase.rpc("my_work_attention_queue"),
      ]);
      const err = [mineR.error, givenR.error, orgR.error, reviewR.error].find(Boolean);
      if (err) throw err;
      if (request !== readGeneration.current) return;
      setMine(mineR.data || []);
      setGiven(givenR.data || []);
      setOrg(orgR.data || []);
      setReviews((reviewR.data || []).filter((row) => row.action_kind === "review_required"));
    } catch (err) {
      if (request === readGeneration.current)
        setError(humanError(err, "Administration work could not be loaded."));
    } finally {
      if (request === readGeneration.current) {
        setLoadedScope(requestedScope);
        setLoading(false);
      }
    }
  }

  const active = (rows) => rows.filter((item) => !CLOSED.has(item.status));

  const activeGiven = active(given);
  const activeOrg = active(org);
  const selfCreated = mine.filter((item) => item.origin === "self_created");
  const completedMine = mine.filter((item) => item.status === "completed" || item.status === "self_certified");
  const views = [
    ["mine", "My work", mine.filter((item) => item.status !== "cancelled").length],
    ["created", "Created by me", selfCreated.length],
    ["given", "Given out", activeGiven.length],
    ["reviews", "For review", reviews.length],
    ["completed", "Completed", completedMine.length],
    ["organisation", "Organisation", activeOrg.length],
  ];
  const rows = view === "given" ? activeGiven : view === "organisation" ? activeOrg
    : view === "created" ? selfCreated : view === "completed" ? completedMine
    : mine.filter((item) => item.status !== "cancelled");
  const selectedInView = selectedWorkId === "none" ? null : (rows.some(item => item.id === selectedWorkId) ? selectedWorkId : (rows[0]?.id || null));
  const groupTitle = view === "given" ? "Work Administration gave out" : view === "organisation" ? "Organisation work"
    : view === "created" ? "Responsibilities created by me" : view === "completed" ? "Completed responsibilities" : "My responsibilities";

  return <div className="body admin-work premium-admin-page ev2-work-page ev2-work-admin">
    <WorkPageHeader
      eyebrow="Organisation operations"
      title="Work"
      description="Plan, record, and finish your work. Keep every contribution connected to the right project."
      actionLabel="Give out work"
      onAction={() => goAssign?.()}
      secondaryActionLabel="Add my work"
      onSecondaryAction={() => setAddingMyWork(true)}
    />
    {addingMyWork && !scopedLoading && <SelfWorkComposer me={me}
      onClose={() => setAddingMyWork(false)}
      onCreated={(saved) => { setSelectedWorkId(saved.id); setView("mine"); void load(); }} />}

    {!scopedLoading && error && <ProductNotice tone="error" title="Could not load Work">{error}</ProductNotice>}
    {scopedLoading && <LoadingState label="Loading organisation work…" />}

    {!scopedLoading && !error && <WorkRegisterLayout me={me}
      selectedId={view === "reviews" ? null : selectedInView}
      onClose={() => setSelectedWorkId("none")} openItem={openItem}
      recordCount={view === "reviews" ? reviews.length : rows.length}
      tabs={<WorkTabs items={views} value={view} onChange={setView} ariaLabel="Admin work views" />}>
      {view === "reviews" ? (reviews.length ? <WorkGroup title="Waiting for your review" count={reviews.length}>
        {reviews.map(row=><WorkReviewRow key={row.submission_id} title={row.work_title}
          person={row.assignee_name || "Team member"} context={row.project_name || row.unit_name}
          submitted={`submitted ${new Date(row.action_at).toLocaleString("en-GB")}`}
          note={row.responsible_reviewer_name && row.responsible_reviewer_id !== me.id ? `Responsible reviewer: ${row.responsible_reviewer_name}` : "Review authority is available to Administration."} onClick={() => openItem(row.work_item_id)} />)}
      </WorkGroup> : <WorkEmpty title="Nothing waiting for review" description="New submissions available to you will appear here." />)
      : <ResponsibilityRegister key={view} rows={rows} selectedId={selectedInView}
          onSelect={setSelectedWorkId} onAdd={() => setAddingMyWork(true)}
          emptyAction={view === "given" || view === "routines" ? {label:"Give out work",onClick:()=>goAssign?.()} : undefined} />}
    </WorkRegisterLayout>}

    {view === "given" && <WorkFootnote>
      “Given out” uses the current recorded assigner. CEAC OS does not invent delegation history that is not stored.
    </WorkFootnote>}
  </div>;
}
