import {workforceTodayReviewCategory} from "./workforceTodayReview.js";

const DAYS=["sun","mon","tue","wed","thu","fri","sat"];
const validDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&!Number.isNaN(Date.parse(value+"T00:00:00Z"));

/** An HR roster is the identity source, not a login or profile directory.
 * All inputs must come from independently checked, authorised organisation
 * responses. No missing check-in becomes absence or a personnel judgement.
 */
export function reconcileWorkforceRosterToday({roster,linkedRows,schedules,dayTypes,date}={}) {
 if(!Array.isArray(roster)||!Array.isArray(linkedRows)
  ||!Array.isArray(schedules)||!Array.isArray(dayTypes)||!validDate(date))
  throw new Error("An authoritative dated workforce source is incomplete.");
 const day=DAYS[new Date(date+"T00:00:00Z").getUTCDay()];
 const linked=new Map(linkedRows.filter(row=>row?.profileId).map(row=>[row.profileId,row]));
 const typeById=new Map(dayTypes.filter(type=>type?.id).map(type=>[type.id,type]));
 const seen=new Set(),usedProfiles=new Set();
 const entries=[];
 for(const employee of roster) {
  if(!employee?.id||seen.has(employee.id))throw new Error("Employee roster identity is missing or duplicated.");
  seen.add(employee.id);
  const profileId=employee.profile_id||null;
  if(profileId){
   if(usedProfiles.has(profileId))throw new Error("Multiple HR employees share the same linked account.");
   usedProfiles.add(profileId);
  }
  const original=linked.get(profileId)||null;
  const matches=schedules.filter(schedule=>schedule &&
    (schedule.employee_id===employee.id||(!schedule.employee_id&&profileId&&schedule.profile_id===profileId)) &&
    schedule.effective_from<=date&&(!schedule.effective_to||date<=schedule.effective_to));
  const superseded=new Set(matches.map(schedule=>schedule.supersedes_id).filter(Boolean));
  const schedule=matches.find(schedule=>!superseded.has(schedule.id))||matches[0]||null;
  const dayId=schedule?.day_map?.[day]||null;
  const type=dayId?typeById.get(dayId):null;
  const inactive=employee.employment_status==="inactive";
  const displayName=employee.full_name||employee.preferred_name||"Recorded employee";
  const unit=(Array.isArray(employee.units)?employee.units:[])
    .map(row=>row?.unit_name||row?.name).filter(Boolean).join(", ")||"Unit not recorded";
  const merged={
   employeeId:employee.id,profileId,name:displayName,unit,
   active:!inactive,loginAvailable:Boolean(profileId),
   dayType:type?.name|| (dayId?"Recorded day type no longer active":null),
   configured:Boolean(schedule&&type),
   expected:type?Boolean(type.session_expected):null,
   started:Boolean(original?.started),firstStart:original?.firstStart||null,
   sessionEvidenceUnavailable:!inactive&&Boolean(original?.sessionEvidenceUnavailable),
   approvedLeave:Boolean(original?.approvedLeave),
   clockLabel:original?.clockLabel||null,
   recordedScheduleUnavailable:Boolean(dayId&&!type),
  };
  entries.push({...merged,category:workforceTodayReviewCategory(merged)});
 }
 for(const item of linkedRows) {
  if(!item?.profileId||usedProfiles.has(item.profileId))continue;
  // Some live CEAC accounts predate the imported HR roster. Keep their real
  // work-session facts visible, but flag the missing authoritative HR identity.
  usedProfiles.add(item.profileId);
  entries.push({
   ...item,employeeId:null,loginAvailable:true,identityUnlinked:true,
   category:"identity_unlinked",
  });
 }
 return entries;
}
