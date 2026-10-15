// CEAC's operational calendar is based in Accra (UTC, year-round).
// Date arithmetic must never depend on the operator's device timezone.
export function accraDayOffset(offset, now = Date.now()) {
  if (!Number.isInteger(offset) || !Number.isFinite(now)) {
    throw new TypeError("A whole-day offset and valid timestamp are required.");
  }
  const current = new Date(now);
  const start = Date.UTC(
    current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(),
  );
  return new Date(start + offset * 86400000);
}
