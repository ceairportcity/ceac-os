import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
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
        supabase.from("submissions")
          .select("id,submitted_at,note,profiles!submissions_profile_id_fkey(full_name),work_items!inner(id,ref,title,kind,status,due_at,unit_id,assignee_id,projects(name))")
          .in("work_items.unit_id", me.memberships.filter((m) => m.role === "manager").map((m) => m.unit_id)).neq("work_items.assignee_id", me.id).eq("work_items.status", "in_review")
          .order("submitted_at", { ascending: true }),
      ]);
      const err = [mineResult.error, givenResult.error, teamResult.error, reviewResult.error].find(Boolean);
      if (err) throw err;
      setMine(mineResult.data || []);
      setGiven(givenResult.data || []);
      setTeam(teamResult.data || []);
      const latest = new Map();
      (reviewResult.data || []).forEach((row) => {
        const id = row.work_items?.id;
        if (!id) return;
        const existing = latest.get(id);
        if (!existing || new Date(row.submitted_at) > new Date(existing.submitted_at)) latest.set(id, row);
      });
      const authorized = await Promise.all([...latest.values()].map(async (row) => { const r = await supabase.rpc("app_can_review_item", { item_id: row.work_items.id }); if (r.error) throw r.error; return r.data ? row : null; }));
      setReviews(authorized.filter(Boolean));
    } catch (err) {
      setError(humanError(err, "Manager work could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  const activeMine = useMemo(() => mine.filter((item) => !COMPLETE.has(item.status)), [mine]);
  const activeGiven = useMemo(() => given.filter((item) => !COMPLETE.has(item.status)), [given]);
  const activeTeam = useMemo(() => team.filter((item) => !COMPLETE.has(item.status)), [team]);
  const views = [
    ["given", "Given out", activeGiven.length],
    ["reviews", "Needs review", reviews.length],
    ["team", "Team work", activeTeam.length],
    ["mine", "My work", activeMine.length],
  ];
  const rows = view === "given" ? activeGiven : view === "team" ? activeTeam : activeMine;
  const groupTitle = view === "given" ? "Work you gave out" : view === "team" ? "Active team work" : "Your open work";

  return <div className="body manager-work premium-manager-page ev2-work-page ev2-work-manager">
    <WorkPageHeader
      eyebrow={me.unit_name}
      title="Work"
      description="Delegate, follow progress and review what comes back without losing sight of your own work."
      actionLabel="Give out work"
      onAction={() => goAssign?.()}
    />

    <WorkTabs items={views} value={view} onChange={setView} ariaLabel="Manager work views" />

    {error && <ProductNotice tone="error" title="Could not load Manager Work">{error}</ProductNotice>}
    {loading && <LoadingState label="Loading manager work…" />}

    {!loading && view === "reviews" && (
      reviews.length ? (
        <WorkGroup title="Waiting for your review" count={reviews.length}>
          {reviews.map((row) => <WorkReviewRow
            key={row.id}
            title={row.work_items.title}
            person={row.profiles?.full_name || "Team member"}
            context={row.work_items.projects?.name}
            submitted={`submitted ${new Date(row.submitted_at).toLocaleString("en-GB")}`}
            note={row.note}
            onClick={() => openItem(row.work_items.id)}
          />)}
        </WorkGroup>
      ) : <WorkEmpty title="Nothing waiting for review" description="New submissions from your team will appear here." />
    )}

    {!loading && view !== "reviews" && (
      rows.length ? (
        <WorkGroup title={groupTitle} count={rows.length}>
          {rows.map((item) => <WorkRow
            key={item.id}
            title={item.title}
            refCode={item.ref}
            kind={item.kind}
            context={item.projects?.name}
            owner={view !== "mine" ? (item.profiles?.full_name || "Unassigned") : null}
            due={dueLabel(item.due_at)}
            status={item.status}
            recordedAt={item.created_at}
            actionLabel={item.status === "not_started" ? "New assignment" : item.status === "returned" ? "Needs correction" : null}
            attention={isOverdue(item.due_at) && !COMPLETE.has(item.status)}
            onClick={() => openItem(item.id)}
          />)}
        </WorkGroup>
      ) : <WorkEmpty
        title={view === "given" ? "No delegated work is open" : view === "team" ? "No other team work is open" : "Nothing is waiting in your own work"}
        description={view === "given" ? "Use Give out work when you delegate something." : view === "team" ? "Active work carried by your unit will appear here." : "Your personal responsibilities will appear here."}
        actionLabel={view === "given" ? "Give out work" : undefined}
        onAction={view === "given" ? () => goAssign?.() : undefined}
      />
    )}

    {view === "given" && <WorkFootnote>
      This view uses the recorded assigner on the current work item. A complete multi-step delegation chain requires explicit assignment-history records; CEAC OS does not invent that history.
    </WorkFootnote>}
  </div>;
}
