// Names only, using the caller's existing profile/unit SELECT permissions.
// Never fetch employee, payroll, contact or authentication records for triage.
export async function supportCasePeople(client, cases) {
  const ids=[...new Set(cases.flatMap(item=>[item.reported_by,item.affected_profile_id,item.assigned_to]).filter(Boolean))];
  const unitIds=[...new Set(cases.map(item=>item.affected_unit_id).filter(Boolean))];
  const [people,units]=await Promise.all([
    ids.length?client.from("profiles").select("id,full_name").in("id",ids):{data:[]},
    unitIds.length?client.from("units").select("id,name").in("id",unitIds):{data:[]},
  ]);
  const names=new Map((people.error?[]:people.data || []).map(person=>[person.id,person.full_name]));
  const departments=new Map((units.error?[]:units.data || []).map(unit=>[unit.id,unit.name]));
  return cases.map(item=>({...item,reporter_name:names.get(item.reported_by)||null,
    affected_name:names.get(item.affected_profile_id)||null,assignee_name:names.get(item.assigned_to)||null,
    department_name:departments.get(item.affected_unit_id)||null}));
}
