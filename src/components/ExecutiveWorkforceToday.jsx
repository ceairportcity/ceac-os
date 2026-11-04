import RoleWorkforceMap from "./RoleWorkforceMap";

// Executive uses the same restricted employee roster and recorded work-start
// evidence as HR and Compliance, without private HR or payroll columns.
export default function ExecutiveWorkforceToday({me}) {
  return <RoleWorkforceMap me={me} roleLabel="Executive" peopleLabel="people"/>;
}
