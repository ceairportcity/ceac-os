// HR/payroll-adjacent policy numbers must be finite, non-negative values.
// A string such as "Infinity" or whitespace must never activate a policy.
export function isValidPolicyAmount(value) {
  if (typeof value !== "number" && typeof value !== "string") return false;
  const text = String(value).trim();
  if (!text) return false;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0;
}
