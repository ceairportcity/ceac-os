import { useEffect, useMemo, useRef, useState } from "react";
import ManagerRoutineOccurrences from "../components/ManagerRoutineOccurrences";
import { supabase } from "../lib/supabase";
import SelfWorkComposer from "../components/SelfWorkComposer";
import WorkRegisterLayout from "../components/WorkRegisterInspector";
import ResponsibilityRegister from "../components/ResponsibilityRegister";
import { ProductNotice, LoadingState } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import {
  WorkEmpty,
  WorkFootnote,
  WorkGroup,
  WorkPageHeader,
  WorkReviewRow,
  WorkTabs,
} from "../experience-v2/work-family/WorkFamilyV2";

const COMPLETE = new Set(["completed", "self_certified", "cancelled"]);

export default function ManagerWork({ me, openItem, goAssign }) {
  const [view, setView] = useState("mine");
  const [addingMyWork, setAddingMyWork] = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [mine, setMine] = useState([]);
  const [given, setGiven] = useState([]);
  const [team, setTeam] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const readGeneration = useRef(0);
  const [loadedScope, setLoadedScope] = useState("");
  const managedUnitIds = (me.memberships || []).filter(member => member.role === "manager")
    .map(member => member.unit_id).filter(Boolean).sort();
  const actorScope = [me.org_id, me.id, me.unit_id, managedUnitIds.join(",")].join(":");
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
    setMine([]); setGiven([]); setTeam([]); setReviews([]);
    try {
      const [mineResult, givenResult, teamResult, reviewResult] = await Promise.all([
        supabase.from("work_items")
          .select("id,ref,title,kind,status,origin,project_id,due_at,created_at,assigned_by,assignee_id,projects(name),profiles!work_items_assignee_id_fkey(full_name)")
          .eq("org_id", me.org_id).eq("assignee_id", me.id).order("created_at", { ascending: false }),
        supabase.from("work_items")
          .select("id,ref,title,kind,status,origin,project_id,due_at,created_at,assigned_by,assignee_id,projects(name),profiles!work_items_assignee_id_fkey(full_name)")
          .eq("org_id", me.org_id).eq("assigned_by", me.id).neq("assignee_id", me.id).order("created_at", { ascending: false }),
        managedUnitIds.length ? supabase.from("work_items")
          .select("id,ref,title,kind,status,origin,project_id,due_at,created_at,assigned_by,assignee_id,projects(name),profiles!work_items_assignee_id_fkey(full_name)")
          .eq("org_id", me.org_id).in("unit_id", managedUnitIds).neq("assignee_id", me.id).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase.rpc("my_work_attention_queue"),
      ]);
      const err = [mineResult.error, givenResult.error, teamResult.error, reviewResult.error].find(Boolean);
      if (err) throw err;
      if (request !== readGeneration.current) return;
      setMine(mineResult.data || []);
      setGiven(givenResult.data || []);
      setTeam(teamResult.data || []);
      setReviews((reviewResult.data || [])
        .filter((row) => row.action_kind === "review_required")
        .sort((left, right) => new Date(left.action_at) - new Date(right.action_at)));
    } catch (err) {
      if (request === readGeneration.current)
        setError(humanError(err, "Manager work could not be loaded."));
    } finally {
      if (request === readGeneration.current) {
        setLoadedScope(requestedScope);
        setLoading(false);
      }
    }
  }


  const activeGiven = useMemo(() => given.filter((item) => !COMPLETE.has(item.status)), [given]);
  const activeTeam = useMemo(() => team.filter((item) => !COMPLETE.has(item.status)), [team]);
  const routines = useMemo(() => {
    const indexed = new Map();
    // These are real authorised Work records. Preserve one row per routine ID.
    for (const item of [...mine, ...given, ...team]) {
      if (item.kind === "routine" && !COMPLETE.has(item.status)) indexed.set(item.id, item);
    }
    return [...indexed.values()].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }, [mine, given, team]);
  const createdByMe = useMemo(() => mine.filter((item) => item.origin === "self_created"), [mine]);
  const completedByMe = useMemo(() => mine.filter((item) => item.status === "completed" || item.status === "self_certified"), [mine]);
  const views = [
    ["mine", "My work", mine.filter((item) => item.status !== "cancelled").length],
    ["created", "Created by me", createdByMe.length],
    ["given", "Given out", activeGiven.length],
    ["reviews", "For review", reviews.length],
    ["completed", "Completed", completedByMe.length],
    ["team", "Team work", activeTeam.length],
    ["routines", "Routines", routines.length],
  ];
  const rows = view === "given" ? activeGiven : view === "team" ? activeTeam
    : view === "routines" ? routines : view === "created" ? createdByMe
    : view === "completed" ? completedByMe
    : mine.filter((item) => item.status !== "cancelled");
  const selectedInView = selectedWorkId === "none" ? null : (rows.some(item => item.id === selectedWorkId) ? selectedWorkId : (rows[0]?.id || null));
  const groupTitle = view === "given" ? "Work you gave out" : view === "team" ? "Active team work"
    : view === "routines" ? "Repeating responsibilities" : view === "completed" ? "Completed responsibilities"
    : view === "created" ? "Responsibilities created by me" : "My responsibilities";

  return <div className="body manager-work premium-manager-page ev2-work-page ev2-work-manager">
    <WorkPageHeader
      eyebrow={me.unit_name}
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

    {!scopedLoading && error && <ProductNotice tone="error" title="Could not load Manager Work">{error}</ProductNotice>}
    {scopedLoading && <LoadingState label="Loading manager work…" />}

    {!scopedLoading && !error && <WorkRegisterLayout me={me}
      selectedId={view === "reviews" ? null : selectedInView}
      onClose={() => setSelectedWorkId("none")} openItem={openItem}
      recordCount={view === "reviews" ? reviews.length : rows.length}
      tabs={<WorkTabs items={views} value={view} onChange={setView} ariaLabel="Manager work views" />}>
      {view === "reviews" ? (reviews.length ? <WorkGroup title="Waiting for your review" count={reviews.length}>
        {reviews.map(row=><WorkReviewRow key={row.submission_id} title={row.work_title}
          person={row.assignee_name || "Team member"} context={row.project_name || row.unit_name}
          submitted={`submitted ${new Date(row.action_at).toLocaleString("en-GB")}`}
          note="Review authority is assigned to you for this item." onClick={() => openItem(row.work_item_id)} />)}
      </WorkGroup> : <WorkEmpty title="Nothing waiting for review" description="New submissions available to you will appear here." />)
      : <ResponsibilityRegister key={view} rows={rows} selectedId={selectedInView}
          onSelect={setSelectedWorkId} onAdd={() => setAddingMyWork(true)}
          emptyAction={view === "given" || view === "routines" ? {label:"Give out work",onClick:()=>goAssign?.()} : undefined} />}
    </WorkRegisterLayout>}

    {!scopedLoading && !error && view === "routines" && <ManagerRoutineOccurrences me={me} openItem={openItem} />}

    {view === "given" && <WorkFootnote>
      This view uses the recorded assigner on the current work item. A complete multi-step delegation chain requires explicit assignment-history records; CEAC OS does not invent that history.
    </WorkFootnote>}
  </div>;
}
