const CONFIRMED_KINDS = new Set(["annual", "sick", "maternity", "paternity", "study"]);

function hasConfirmedRoute(request) {
  return CONFIRMED_KINDS.has(String(request?.kind || "").trim().toLowerCase());
}

// Presentation guidance only. The reviewed server action remains authoritative.
export function leaveStageLabel(request, configuredRoute = null) {
  const route = hasConfirmedRoute(request) ? "manager_then_admin" : configuredRoute;
  if (request?.status === "pending") {
    if (route === "manager_then_admin" || route === "manager") return "Waiting for Manager approval";
    if (route === "admin") return "Waiting for Administration";
    return "Pending · review the configured approval route";
  }
  if (request?.status === "escalated") {
    return route === "manager_then_admin"
      ? "Manager approved · Administration final decision required"
      : "Escalated · review the configured approval route";
  }
  return "Review the recorded request state";
}

// Overview has no policy context for custom leave kinds; review those in Time & Leave.
export function canAdminDecideLeave(request) {
  return hasConfirmedRoute(request) && request?.status === "escalated";
}
