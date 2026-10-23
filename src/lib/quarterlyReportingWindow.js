/** A reporting period is quarterly only when its exact Accra calendar
 * bounds cover one complete January–March / April–June / July–September /
 * October–December interval. Never label a monthly or custom period Qx. */
export function verifiedReportingQuarter(period) {
  const start = period?.starts_on, end = period?.ends_on;
  if (typeof start !== "string" || typeof end !== "string"
    || !/^\d{4}-\d{2}-\d{2}$/.test(start)
    || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const year = Number(start.slice(0,4));
  const month = Number(start.slice(5,7));
  if (year < 2000 || year > 2200 || ![1,4,7,10].includes(month)) return null;
  const quarter = Math.floor((month - 1) / 3) + 1;
  const lastMonth = quarter * 3;
  const lastDay = new Date(Date.UTC(year, lastMonth, 0)).getUTCDate();
  const completeEnd = `${year}-${String(lastMonth).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
  return start.endsWith("-01") && end === completeEnd
    ? { year, quarter, label:`Q${quarter} ${year}`, starts_on:start, ends_on:end } : null;
}
