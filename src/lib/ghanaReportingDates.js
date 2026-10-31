/** Manager reporting dates are Ghana-local calendar dates (UTC+00:00,
 * with no daylight-saving shifts), independent of a staff member's device TZ.
 * This is for factual reporting boundaries, not a payroll/absence decision.
 */
const pad = (value) => String(value).padStart(2, "0");

export function reportDateKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
export function reportDateOnly(value) {
  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
}
export function addReportDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
export function reportAccraDate(value) {
  return value ? reportDateKey(new Date(value)) : null;
}

export function reportWeekRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return { start: reportDateKey(start), end: reportDateKey(addReportDays(start, 6)), label: "This week" };
}

export function reportMonthRange(now = new Date()) {
  const year = now.getUTCFullYear(), month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: reportDateKey(start), end: reportDateKey(end),
    label: now.toLocaleDateString("en-GB", { timeZone: "Africa/Accra", month: "long", year: "numeric" }),
  };
}

/** Complete Ghana-calendar quarter; dates remain stable across browser timezones. */
export function reportQuarterRange(now = new Date()) {
  const year = now.getUTCFullYear();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  const month = (quarter - 1) * 3;
  return {
    start: reportDateKey(new Date(Date.UTC(year, month, 1))),
    end: reportDateKey(new Date(Date.UTC(year, month + 3, 0))),
    label: `Q${quarter} ${year}`,
  };
}
