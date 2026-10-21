/**
 * Match HR reporting-manager choices against *operational* manager memberships,
 * never a displayed job title or a single primary roster department.
 * Database admin_record_roster_employment independently enforces the same unit.
 */
export function eligibleRosterManagers(people,memberships,unitId) {
 if (!Array.isArray(people)||!Array.isArray(memberships))
  throw new Error("The authorised manager directory is incomplete.");
 if(!unitId)return [];
 const approved=new Set();
 for(const member of memberships) {
  if(!member||!member.profile_id||!member.unit_id||member.role!=="manager")
   throw new Error("The operational manager directory is inconsistent.");
  if(member.unit_id===unitId)approved.add(member.profile_id);
 }
 const seen=new Set();
 return people.filter(person=>{
  if(!person?.profile_id||seen.has(person.profile_id)||!approved.has(person.profile_id))return false;
  seen.add(person.profile_id);
  // Employment and the account must *both* be active.
  return person.active===true&&person.account_active===true;
 }).sort((a,b)=>String(a.full_name||"").localeCompare(String(b.full_name||"")));
}
