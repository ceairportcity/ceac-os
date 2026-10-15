/**
 * An absent observation is NOT measured zero.
 * Do not manufacture Executive objective progress for unrecorded values.
 */
export function strategyProgress(row) {
  if (row?.measurement_kind !== "numeric") return null;
  if (row.current_value === null || row.current_value === undefined) return null;
  if (row.target_value === null || row.target_value === undefined) return null;
  const target = Number(row.target_value);
  const current = Number(row.current_value);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(current)) return null;
  return Math.max(0, Math.min(100, (current / target) * 100));
}
