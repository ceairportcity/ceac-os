// Presentation only: authorised, latest records come from the existing engines.
// Missing attendance never creates a case or an automatic finding.
export function complianceReviewQueue(cases = [], evidence = [], exceptions = []) {
  const label = value => String(value || "").replaceAll("_", " ");
  const categories={missing_evidence:"Missing attendance evidence",disputed_attendance:"Disputed attendance",schedule_discrepancy:"Working-pattern discrepancy",other:"Attendance observation"};
  return [
    ...cases.filter(row => ["open", "referred", "disputed"].includes(row.status)).map(row => ({
      key: `case:${row.id}`, kind: "attendance", type: "Attendance case",
      title: categories[row.category] || label(row.category) || "Attendance observation", person: row.employee_name || "Employee",
      context: row.work_date || "Date not recorded", status: label(row.status), record: row,
    })),
    ...evidence.filter(row => row.state === "submitted").map(row => ({
      key: `evidence:${row.id}`, kind: "evidence", type: "Evidence",
      title: row.requirement?.title || "Policy evidence submitted", person: row.profile?.full_name || "Employee",
      context: "Documentation received", status: "Awaiting review", record: row,
    })),
    ...exceptions.filter(row => row.state === "requested").map(row => ({
      key: `exception:${row.id}`, kind: "exceptions", type: "Exception request",
      title: row.requirement?.title || "Policy exception requested", person: row.profile?.full_name || "Employee",
      context: "Supporting explanation recorded", status: "Requested", record: row,
    })),
  ];
}
