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

/** Names already authorised by the existing scoped attendance response; never
 * widen profiles RLS or infer a person from a similar name. */
export function compliancePersonOptions(people=[],attendanceRows=[]) {
 const names=new Map();
 for(const person of people)if(person.id&&person.full_name)names.set(person.id,{id:person.id,full_name:person.full_name});
 for(const row of attendanceRows)if(row.profile_id&&row.name)names.set(row.profile_id,{id:row.profile_id,full_name:row.name});
 return [...names.values()].sort((a,b)=>a.full_name.localeCompare(b.full_name));
}
export function withCompliancePersonNames(records=[],people=[]) {
 const names=new Map(people.map(person=>[person.id,person.full_name]));
 return records.map(row=>row.profile?.full_name||!names.has(row.profile_id)?row:
  {...row,profile:{full_name:names.get(row.profile_id)}});
}
