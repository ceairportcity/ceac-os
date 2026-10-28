// Match the existing non-negative, two-decimal budget/spend contract without
// stripping a minus sign, currency text or malformed grouping into a new value.
export function expenseAmountMinor(value) {
  const text = String(value ?? "").trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replaceAll(",", "").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}
