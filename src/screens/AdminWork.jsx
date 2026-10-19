import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import SelfWorkComposer from "../components/SelfWorkComposer";
import WorkRegisterLayout from "../components/WorkRegisterInspector";
import { dueLabel, isOverdue } from "../lib/time";
import { LoadingState, ProductNotice } from "../components/bits";
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

  useEffect(() => { load(); }, [me.id, me.org_id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const fields = "id,ref,title,kind,status,origin,due_at,assigned_by,assignee_id,unit_id,projects(name),units(name),profiles!work_items_assignee_id_fkey(full_name)";
      const [mineR, givenR, orgR, reviewR] = await Promise.all([
        supabase.from("work_items").select(fields).eq("org_id", me.org_id).eq("assignee_id", me.id).order("created_at", { ascending: false }),
        supabase.from("work_items").select(fields).eq("org_id", me.org_id).eq("assigned_by", me.id).neq("assignee_id", me.id).order("created_at", { ascending: false }),
        supabase.from("work_items").select(fields).eq("org_id", me.org_id).order("last_movement_at", { ascending: false }).limit(250),
        supabase.rpc("my_work_attention_queue"),
      ]);
      const err = [mineR.error, givenR.error, orgR.error, reviewR.error].find(Boolean);
      if (err) throw err;
      setMine(mineR.data || []);
      setGiven(givenR.data || []);
      setOrg(orgR.data || []);
      setReviews((reviewR.data || []).filter((row) => row.action_kind === "review_required"));
    } catch (err) {
      setError(humanError(err, "Administration work could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  const active = (rows) => rows.filter((item) => !CLOSED.has(item.status));
  const activeMine = active(mine);
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
      description="Follow work Administration delegated, review what is waiting, or inspect organisation work without turning every operational engine into a separate menu."
      actionLabel="Give out work"
      onAction={() => goAssign?.()}
      secondaryActionLabel="Add my work"
      onSecondaryAction={() => setAddingMyWork(true)}
    />
    <WorkTabs items={views} value={view} onChange={setView} ariaLabel="Administration work views" />
    {addingMyWork && <SelfWorkComposer me={me}
      onClose={() => setAddingMyWork(false)}
      onCreated={() => { setView("mine"); void load(); }} />}

    {error && <ProductNotice tone="error" title="Could not load Work">{error}</ProductNotice>}
    {loading && <LoadingState label="Loading organisation work…" />}

    {!loading && view === "reviews" && (
      reviews.length ? (
        <WorkGroup title="Submissions visible to Administration" count={reviews.length}>
          {reviews.map((row) => <WorkReviewRow
            key={row.submission_id}
            title={row.work_title}
            person={row.assignee_name || "Team member"}
            context={row.unit_name || "Unit"}
            submitted={row.action_at ? new Date(row.action_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null}
            note={row.responsible_reviewer_name && row.responsible_reviewer_id !== me.id ? `Responsible reviewer: ${row.responsible_reviewer_name}` : "Review authority is available to Administration."}
            onClick={() => openItem(row.work_item_id)}
          />)}
        </WorkGroup>
      ) : <WorkEmpty title="Nothing waiting for review" description="Organisation submissions visible to Administration will appear here." />
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
            owner={["mine","created","completed"].includes(view) ? null : [item.units?.name, item.profiles?.full_name].filter(Boolean).join(" · ") || "Unassigned"}
            due={dueLabel(item.due_at)}
            status={item.status}
            attention={isOverdue(item.due_at) && !CLOSED.has(item.status)}
            onClick={() => setSelectedWorkId(item.id)}
          />)}
        </WorkGroup>
      ) : <WorkEmpty
        title="No open work in this view"
        description="The list will update when authorised work is created, delegated or becomes visible here."
        actionLabel={view === "given" ? "Give out work" : undefined}
        onAction={view === "given" ? () => goAssign?.() : undefined}
      />
        )}
      </WorkRegisterLayout>
    )}

    {view === "given" && <WorkFootnote>
      “Given out” uses the current recorded assigner. CEAC OS does not invent delegation history that is not stored.
    </WorkFootnote>}
  </div>;
}
