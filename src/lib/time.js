export function since(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? h + "h " + (mins % 60) + "m" : mins + "m";
}
export function dueLabel(iso, status = null) {
  if (!iso) return "No date";
  const d = new Date(iso), now = new Date();
  const t = d.toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "numeric", minute: "2-digit" }).toLowerCase();
  // A past deadline is a fact, but a review or blocked responsibility is not
  // overdue work for the employee. Keep its original due date visible.
  if (status && !["not_started", "in_progress", "assigned"].includes(status))
    return "Due " + d.toLocaleDateString("en-GB", { timeZone: "Africa/Accra", day: "numeric", month: "short", year: "numeric" });
  if (d.toDateString() === now.toDateString()) return "Due today, " + t;
  const days = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (days < 0) return "Overdue " + Math.abs(days) + " day" + (Math.abs(days) === 1 ? "" : "s");
  if (days === 1) return "Due tomorrow, " + t;
  return "Due " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
export const isOverdue = (iso) => !!iso && new Date(iso).getTime() < Date.now();
export function dateOnly(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Only unfinished, actionable work is overdue; review and dependencies have
 * their own owners and queues. Recurring series are assessed per occurrence. */
export function isWorkOverdue(work, now = Date.now()) {
  if (!work || !["not_started", "in_progress", "assigned"].includes(work.status) || work.kind === "routine") return false;
  const due = new Date(work.due_at || "").getTime();
  return Number.isFinite(due) && due < now;
}
