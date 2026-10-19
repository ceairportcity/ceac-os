/** Resolve append-only corrections before applying a reporting period. */
export function currentActivityRecords(records) {
  const superseded = new Set(records.map((entry) => entry.supersedes_id).filter(Boolean));
  return records.filter((entry) => !superseded.has(entry.id));
}

export function activityRecordsInPeriod(records, start, end) {
  return currentActivityRecords(records).filter((entry) =>
    entry.activity_date >= start && entry.activity_date <= end
  );
}
