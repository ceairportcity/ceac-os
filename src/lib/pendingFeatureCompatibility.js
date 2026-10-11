/**
 * Preview-only compatibility with unapplied Phase 6 migrations.
 *
 * Only classify a precise missing-object error. Never turn a permission
 * denial, network failure, or malformed server response into "unavailable".
 * This module grants no access and makes no database/schema changes.
 */
export function isPendingVolunteerRecommendationsTable(error) {
  if (!error || !["42P01", "PGRST205"].includes(error.code)) return false;
  const message = String(error.message || "");
  return /\bvolunteer_change_recommendations\b/i.test(message)
    && /(?:does not exist|could not find|not found)/i.test(message);
}

export function isPendingAttendanceIntegrityStatus(error) {
  if (!error || !["42883", "PGRST202"].includes(error.code)) return false;
  const message = String(error.message || "");
  return /\battendance_integrity_status\b/i.test(message)
    && /(?:does not exist|could not find|not found)/i.test(message);
}

/** Preserve normal errors; a missing pending feature is not zero recorded data. */
export function classifyPreviewFeatureResult(feature, result) {
  const error = result?.error || null;
  if (!error) return { available: true, data: result?.data ?? null, error: null };
  const absent = feature === "volunteerRecommendations"
    ? isPendingVolunteerRecommendationsTable(error)
    : feature === "attendanceIntegrity"
      ? isPendingAttendanceIntegrityStatus(error) : false;
  if (absent) return { available: false, data: null, error: null };
  return { available: false, data: null, error };
}
