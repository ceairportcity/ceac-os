import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { LoadingState, ProductNotice } from "../components/bits";
import { dueLabel, isOverdue } from "../lib/time";
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

const CLOSED = new Set(["completed", "self_certified", "cancelled"]);

export default function ExecutiveWork({ me, openItem, goAssign }) {
  const [view, setView] = useState("given");
  const [mine, setMine] = useState([]);
  const [given, setGiven] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.id, me.org_id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const fields = "id,ref,title,status,due_at,assignee_id,assigned_by,units(name),profiles!work_items_assignee_id_fkey(full_name),projects(name)";
      const [mineResult, givenResult, reviewResult] = await Promise.all([
        supabase.from("work_items").select(fields).eq("org_id", me.org_id).eq("assignee_id", me.id).order("due_at", { ascending: true, nullsFirst: false }),
        supabase.from("work_items").select(fields).eq("org_id", me.org_id).eq("assigned_by", me.id).neq("assignee_id", me.id).order("due_at", { ascending: true, nullsFirst: false }),
        supabase.rpc("my_work_attention_queue"),
      ]);
      const first = [mineResult.error, givenResult.error, reviewResult.error].find(Boolean);
      if (first) throw first;
      setMine(mineResult.data || []);
      setGiven(givenResult.data || []);
      setReviews((reviewResult.data || []).filter((row) => row.action_kind === "review_required"));
    } catch (err) {
      setError(humanError(err, "Executive work could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  const active = (rows) => rows.filter((item) => !CLOSED.has(item.status));
  const activeMine = active(mine);
  const activeGiven = active(given);
  const tabs = [
    ["given", "Given out", activeGiven.length],
    ["reviews", "Needs review", reviews.length],
    ["mine", "Mine", activeMine.length],
  ];
  const rows = view === "given" ? activeGiven : activeMine;

  return <div className="body executive-work premium-exec-page ev2-work-page ev2-work-executive">
    <WorkPageHeader
      eyebrow="Leadership work"
      title="Work"
      description="What you have given out, what needs review and what you personally carry."
      actionLabel="Give out work"
      onAction={() => goAssign?.()}
    />

    <WorkTabs items={tabs} value={view} onChange={setView} ariaLabel="Executive work views" />

    {error && <ProductNotice tone="error" title="Could not load Work">{error}</ProductNotice>}
    {loading && <LoadingState label="Loading leadership work…" />}

    {!loading && view === "reviews" && (
      reviews.length ? (
        <WorkGroup title="Submitted work requiring leadership context" count={reviews.length}>
          {reviews.map((row) => <WorkReviewRow
            key={row.submission_id}
            title={row.work_title}
            person={row.assignee_name || "Team member"}
            context={row.unit_name || "Unit"}
            submitted={row.action_at ? new Date(row.action_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null}
            note="Review authority follows this leadership assignment."
            onClick={() => openItem(row.work_item_id)}
          />)}
        </WorkGroup>
      ) : <WorkEmpty title="Nothing is waiting for review" description="Leadership-visible submissions that require context will appear here." />
    )}

    {!loading && view !== "reviews" && (
      rows.length ? (
        <WorkGroup title={view === "given" ? "Delegated work" : "Your open work"} count={rows.length}>
          {rows.map((item) => <WorkRow
            key={item.id}
            title={item.title}
            refCode={item.ref}
            context={item.projects?.name || item.units?.name}
            owner={view === "given" ? (item.profiles?.full_name || "Unassigned") : null}
            due={dueLabel(item.due_at)}
            status={item.status}
            attention={isOverdue(item.due_at) && !CLOSED.has(item.status)}
            onClick={() => openItem(item.id)}
          />)}
        </WorkGroup>
      ) : <WorkEmpty
        title="No open work in this view"
        description={view === "given" ? "Work you delegate will appear here." : "Your personal leadership work will appear here."}
        actionLabel={view === "given" ? "Give out work" : undefined}
        onAction={view === "given" ? () => goAssign?.() : undefined}
      />
    )}

    {view === "given" && <WorkFootnote>
      “Given out” reflects the current recorded assigner. CEAC OS does not invent a delegation chain that is not stored.
    </WorkFootnote>}
  </div>;
}
