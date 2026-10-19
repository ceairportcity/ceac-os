import { useEffect, useMemo, useState } from "react";
import ManagerRoutineOccurrences from "../components/ManagerRoutineOccurrences";
import { supabase } from "../lib/supabase";
import SelfWorkComposer from "../components/SelfWorkComposer";
import WorkRegisterLayout from "../components/WorkRegisterInspector";
import { dueLabel, isOverdue } from "../lib/time";
import { ProductNotice, LoadingState } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import {
  WorkEmpty,
  WorkFootnote,
  WorkGroup,
  WorkPageHeader,
  WorkReviewRow,
  WorkRow,
  WorkTabs,
} from "../experience-v2/work-family/WorkFamilyV2";

const COMPLETE = new Set(["completed", "self_certified", "cancelled"]);

export default function ManagerWork({ me, openItem, goAssign }) {
  const [view, setView] = useState("reviews");
  const [addingMyWork, setAddingMyWork] = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [mine, setMine] = useState([]);
  const [given, setGiven] = useState([]);
  const [team, setTeam] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.id, me.unit_id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [mineResult, givenResult, teamResult, reviewResult] = await Promise.all([
        supabase.from("work_items")
          .select("id,ref,title,kind,status,due_at,created_at,assigned_by,assignee_id,projects(name),profiles!work_items_assignee_id_fkey(full_name)")
          .eq("assignee_id", me.id).order("created_at", { ascending: false }),
        supabase.from("work_items")
          .select("id,ref,title,kind,status,due_at,created_at,assigned_by,assignee_id,projects(name),profiles!work_items_assignee_id_fkey(full_name)")
          .eq("assigned_by", me.id).neq("assignee_id", me.id).order("created_at", { ascending: false }),
        supabase.from("work_items")
          .select("id,ref,title,kind,status,due_at,created_at,assigned_by,assignee_id,projects(name),profiles!work_items_assignee_id_fkey(full_name)")
          .in("unit_id", me.memberships.filter((m) => m.role === "manager").map((m) => m.unit_id)).neq("assignee_id", me.id).order("created_at", { ascending: false }),
        supabase.rpc("my_work_attention_queue"),
      ]);
      const err = [mineResult.error, givenResult.error, teamResult.error, reviewResult.error].find(Boolean);
      if (err) throw err;
      setMine(mineResult.data || []);
      setGiven(givenResult.data || []);
      setTeam(teamResult.data || []);
      setReviews((reviewResult.data || [])
        .filter((row) => row.action_kind === "review_required")
        .sort((left, right) => new Date(left.action_at) - new Date(right.action_at)));
    } catch (err) {
      setError(humanError(err, "Manager work could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  const activeMine = useMemo(() => mine.filter((item) => !COMPLETE.has(item.status)), [mine]);
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
  const views = [
    ["given", "Given out", activeGiven.length],
    ["reviews", "Needs review", reviews.length],
    ["team", "Team work", activeTeam.length],
    ["mine", "My work", activeMine.length],
    ["routines", "Routines", routines.length],
  ];
  const rows = view === "given" ? activeGiven : view === "team" ? activeTeam : view === "routines" ? routines : activeMine;
  const selectedInView = selectedWorkId === "none" ? null : (rows.some(item => item.id === selectedWorkId) ? selectedWorkId : (rows[0]?.id || null));
  const groupTitle = view === "given" ? "Work you gave out" : view === "team" ? "Active team work" : view === "routines" ? "Repeating responsibilities" : "Your open work";

  return <div className="body manager-work premium-manager-page ev2-work-page ev2-work-manager">
    <WorkPageHeader
      eyebrow={me.unit_name}
      title="Work"
      description="Delegate, follow progress and review what comes back without losing sight of your own work."
      actionLabel="Give out work"
      onAction={() => goAssign?.()}
    />

    <div className="ev2w-self-work-action">
      <button type="button" className="btn btn-primary" onClick={() => setAddingMyWork(true)}>+ Add my work</button>
    </div>
    <WorkTabs items={views} value={view} onChange={setView} ariaLabel="Manager work views" />
    {addingMyWork && <SelfWorkComposer me={me}
      onClose={() => setAddingMyWork(false)}
      onCreated={() => { setView("mine"); void load(); }} />}

    {error && <ProductNotice tone="error" title="Could not load Manager Work">{error}</ProductNotice>}
    {loading && <LoadingState label="Loading manager work…" />}

    {!loading && view === "reviews" && (
      reviews.length ? (
        <WorkGroup title="Waiting for your review" count={reviews.length}>
          {reviews.map((row) => <WorkReviewRow
            key={row.submission_id}
            title={row.work_title}
            person={row.assignee_name || "Team member"}
            context={row.project_name || row.unit_name}
            submitted={`submitted ${new Date(row.action_at).toLocaleString("en-GB")}`}
            note="Review authority is assigned to you for this item."
            onClick={() => openItem(row.work_item_id)}
          />)}
        </WorkGroup>
      ) : <WorkEmpty title="Nothing waiting for review" description="New submissions from your team will appear here." />
    )}

    {!loading && view !== "reviews" && (
      <WorkRegisterLayout me={me} selectedId={selectedInView} onClose={() => setSelectedWorkId("none")} openItem={openItem}>
        {rows.length ? (
        <WorkGroup title={groupTitle} count={rows.length}>
          {rows.map((item) => <WorkRow
            key={item.id}
            title={item.title}
            refCode={item.ref}
            kind={item.kind}
            context={item.projects?.name}
            owner={view !== "mine" ? (item.profiles?.full_name || "Unassigned") : null}
            due={item.kind === "routine" ? "Scheduled routine" : dueLabel(item.due_at)}
            status={item.status}
            recordedAt={item.created_at}
            actionLabel={item.status === "not_started" ? "New assignment" : item.status === "returned" ? "Needs correction" : null}
            attention={isOverdue(item.due_at) && !COMPLETE.has(item.status)}
            onClick={() => setSelectedWorkId(item.id)}
          />)}
        </WorkGroup>
      ) : <WorkEmpty
        title={view === "routines" ? "No repeating responsibilities recorded" : view === "given" ? "No delegated work is open" : view === "team" ? "No other team work is open" : "Nothing is waiting in your own work"}
        description={view === "routines" ? "Create a repeating responsibility in Give out work. Its dated history stays in the routine record." : view === "given" ? "Use Give out work when you delegate something." : view === "team" ? "Active work carried by your unit will appear here." : "Your personal responsibilities will appear here."}
        actionLabel={view === "given" || view === "routines" ? "Give out work" : undefined}
        onAction={view === "given" || view === "routines" ? () => goAssign?.() : undefined}
      />
        )}
      </WorkRegisterLayout>
    )}

    {!loading && !error && view === "routines" && <ManagerRoutineOccurrences me={me} openItem={openItem} />}

    {view === "given" && <WorkFootnote>
      This view uses the recorded assigner on the current work item. A complete multi-step delegation chain requires explicit assignment-history records; CEAC OS does not invent that history.
    </WorkFootnote>}
  </div>;
}
