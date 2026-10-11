export function protectedMoney(minor, currency = "GHS") {
  if (minor == null) return "Not recorded";
  const amount = Number(minor);
  if (!Number.isSafeInteger(amount)) return "Amount could not be verified";
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return "Currency could not be verified";
  }
}

export function amountToMinor(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  const minor = number * 100;
  return Number.isFinite(number) && Number.isSafeInteger(Math.round(minor))
    ? Math.round(minor) : 0;
}
