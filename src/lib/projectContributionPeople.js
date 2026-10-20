/**
 * Project display participants are NOT a human-resource roster. Merge only
 * work assignees and actually visible, current-version dated contribution
 * evidence. Keep the two independent counts; never count contribution actions
 * as completed tasks or as verified project outcomes.
 */
export function visibleProjectPeople(work = [], currentActions = []) {
  const people = new Map();
  for (const item of work) {
    if (!item.assignee_id) continue;
    const person = people.get(item.assignee_id) || {
      id: item.assignee_id, name: item.profiles?.full_name || "Authorised participant",
      assignedWorkCount: 0, recordedActionCount: 0,
    };
    if (item.profiles?.full_name) person.name = item.profiles.full_name;
    person.assignedWorkCount += 1;
    people.set(item.assignee_id, person);
  }
  for (const action of currentActions) {
    if (!action.contributor_id) continue;
    const person = people.get(action.contributor_id) || {
      id: action.contributor_id,
      name: action.contributor?.full_name || "Authorised contributor",
      assignedWorkCount: 0, recordedActionCount: 0,
    };
    if (action.contributor?.full_name) person.name = action.contributor.full_name;
    person.recordedActionCount += 1;
    people.set(action.contributor_id, person);
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Append-only corrections replace the earlier version as a display row. */
export function currentProjectActions(rows) {
  const replaced = new Set(rows.map(row => row.supersedes_id).filter(Boolean));
  return rows.filter(row => !replaced.has(row.id))
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at) || b.id.localeCompare(a.id));
}
