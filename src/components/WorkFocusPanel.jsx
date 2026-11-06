import { useMemo } from "react";
import { isWorkOverdue, dueLabel } from "../lib/time";

const awaiting = new Set(["in_review","waiting_on","waiting","blocked"]);
const statusLabel = item => item.status === "returned" ? "Changes requested"
  : isWorkOverdue(item) ? "Past due — needs action"
  : item.status === "in_review" ? "Sent for approval"
  : item.status === "waiting_on" ? "Waiting on someone else"
  : item.status === "in_progress" ? "In progress"
  : item.status === "not_started" ? "Not started"
  : item.status === "self_certified" || item.status === "completed" ? "Completed"
  : item.status?.replaceAll("_"," ") || "Current work";

const style = {
  wrap: { padding:"21px 22px 20px", border:"1px solid #dce7f3", background:"linear-gradient(130deg,#f5f9ff 0%,#fff 64%)", borderRadius:16, boxShadow:"0 8px 28px rgba(19,55,95,.035)", margin:"14px 0 18px" },
  kicker: { fontSize:11, color:"#597b9d", letterSpacing:".065em", textTransform:"uppercase", fontWeight:700 },
  head: { fontSize:21, fontWeight:680, color:"#173a60", letterSpacing:"-.035em", margin:"5px 0 4px", lineHeight:1.25 },
  desc: { margin:0, fontSize:13, color:"#667b92", lineHeight:1.55 },
  grid: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,165px),1fr))", gap:10, marginTop:18 },
  metric: { background:"#fff", border:"1px solid #e3eaf3", borderRadius:11, padding:"13px 15px", minWidth:0 },
  value: { display:"block", fontSize:25, fontWeight:690, lineHeight:1.1, color:"#193e66", letterSpacing:"-.035em" },
  label: { display:"block", color:"#5b7088", fontSize:12, marginTop:6, fontWeight:550 },
  focus: { display:"flex", justifyContent:"space-between", alignItems:"center", gap:14, flexWrap:"wrap", padding:"13px 15px", background:"#fff", border:"1px solid #d9e6f3", borderRadius:11, marginTop:12 },
  focusTitle: { margin:0, fontSize:14, color:"#183c60", fontWeight:680, overflowWrap:"anywhere" },
  focusMeta: { display:"block", marginTop:5, fontSize:12, color:"#687d90", lineHeight:1.5 },
  button: { background:"#176cb6", border:0, color:"#fff", padding:"10px 15px", borderRadius:8, minHeight:44, fontSize:13, fontWeight:650, cursor:"pointer" },
};

/** Purely presentational and bounded. All numbers are derived from the role's
 * already-authorised Work read; no new database calls, subscriptions or timers. */
export default function WorkFocusPanel({ rows = [], reviews = [], role = "staff", onOpen }) {
  const facts = useMemo(() => {
    const unique = [...new Map(rows.filter(Boolean).map(item => [item.id,item])).values()];
    const attention = unique.filter(item => item.status === "returned" || isWorkOverdue(item));
    const toDo = unique.filter(item => ["not_started","in_progress","assigned"].includes(item.status)
      && !isWorkOverdue(item));
    const waiting = unique.filter(item => awaiting.has(item.status));
    const completed = unique.filter(item => item.status === "completed" || item.status === "self_certified");
    const byDue = (a,b) => (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity);
    const focus = [...attention].sort((a,b) =>
      (a.status === "returned" ? -1 : 0) - (b.status === "returned" ? -1 : 0) || byDue(a,b))[0]
      || [...toDo].sort(byDue)[0] || null;
    return { attention:attention.length, toDo:toDo.length, waiting:waiting.length,
      completed:completed.length, focus };
  },[rows]);
  const isLeadership = role !== "staff";
  const review = isLeadership && reviews.length ? reviews[0] : null;
  const focus = review ? null : facts.focus;
  const hasAction = Boolean(review || focus);
  return <section className="ceac-work-focus" aria-label="Work overview" style={style.wrap}>
    <div style={style.kicker}>{isLeadership ? "Your work and approvals" : "Your work, made clear"}</div>
    <h2 style={style.head}>{role === "staff" ? "Your work at a glance" : role === "manager" ? "Team work at a glance" : role === "admin" ? "Organisation work at a glance" : "Leadership work at a glance"}</h2>
    <p style={style.desc}>See open work, what is waiting for approval, and what has been completed.</p>
    <div style={style.grid}>
      {[
        [facts.attention + (isLeadership ? reviews.length : 0),isLeadership ? "Needs attention or review" : "Needs your attention"],
        [facts.toDo,isLeadership ? "Work in progress or ready" : "Ready to work on"],
        [facts.waiting,"Waiting or with reviewer"],
        [facts.completed,"Completed"],
      ].map(([value,label])=><div style={style.metric} key={label}>
        <strong style={style.value}>{value}</strong><span style={style.label}>{label}</span>
      </div>)}
    </div>
    <div style={style.focus}>
      <div style={{flex:"1 1 190px",minWidth:0}}>
        <div style={style.kicker}>{review ? "Waiting for your decision" : focus ? (isLeadership ? "Work needing follow-up" : "Next action") : "No immediate action"}</div>
        <p style={style.focusTitle}>{review ? "Submitted work awaiting your decision" : focus?.title || "You're up to date"}</p>
        <small style={style.focusMeta}>{review
          ? "A submitted work item is ready for your review."
          : focus ? (focus.kind === "routine" ? "Recurring work · Open its schedule to update the correct date" : statusLabel(focus) + " · " + dueLabel(focus.due_at,focus.status))
          : facts.waiting ? "Some work is already with a reviewer or waiting on someone else. No repeat submission is needed."
          : "Your recorded work will appear here when action is needed."}</small>
      </div>
      {hasAction && <button type="button" style={style.button}
        onClick={() => onOpen?.(review ? review.work_item_id : focus.id)}>
        {review ? "Review work" : focus.status === "returned" ? "View requested changes" : "Open work"}
      </button>}
    </div>
  </section>;
}
