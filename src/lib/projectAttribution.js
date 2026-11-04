// Present the immutable project creation audit separately from delivery ownership.
// Permission-filtered profile joins can hide a name; never infer a person from a unit.
export function projectCreatorLabel(project, viewer) {
  const name = project?.creator?.full_name?.trim();
  if (name) return name;
  if (project?.created_by && project.created_by === viewer?.id && viewer?.full_name?.trim()) {
    return viewer.full_name.trim();
  }
  return project?.created_by ? "Name unavailable" : "Not recorded";
}

export function projectCreatedAtLabel(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(date) + " GMT";
}
