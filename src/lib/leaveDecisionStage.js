// Leave requests now go straight to HR; the server RPC is authoritative.
export function leaveStageLabel(request) {
  if (request?.status === "pending") return "Waiting for HR approval";
  if (request?.status === "escalated") return "Awaiting HR final decision";
  if (request?.status === "approved") return "Approved";
  if (request?.status === "declined") return "Declined";
  if (request?.status === "cancelled") return "Cancelled";
  return "Review the recorded request state";
}

// Only callers with workforce.manage may render decision controls.
// The server independently enforces HR authority for every request.
export function canAdminDecideLeave(request) {
  return request?.status === "pending" || request?.status === "escalated";
}
