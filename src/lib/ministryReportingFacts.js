/**
 * CEAC leadership factual-only brief, from canonical period/unit reports,
 * objectives and milestones. No arbitrary weights, staff scores or currency sums.
 */
const final = status => status === "submitted" || status === "confirmed";
export function ministryPeriodEvidence({unitReports=[],objectives=[],milestones=[],activeUnitIds=[]}={}){
 const latest=new Map();
 for(const report of unitReports){
  if(!report?.unit_id||!final(report.status))continue;
  const key=String(report.unit_id);
  const prior=latest.get(key);
  if(!prior||Number(report.version)>Number(prior.version)||
     (Number(report.version)===Number(prior.version)&&String(report.submitted_at||"")>String(prior.submitted_at||"")))
    latest.set(key,report);
 }
 const objectiveMap=new Map();
 for(const item of objectives)if(item?.id&&!objectiveMap.has(item.id))objectiveMap.set(item.id,item);
 const milestoneMap=new Map();
 for(const item of milestones)if(item?.id&&!milestoneMap.has(item.id))milestoneMap.set(item.id,item);
 const units=[...new Set(activeUnitIds.filter(Boolean))];
 return {
   filedReports:[...latest.values()].sort((a,b)=>String(a.unit_id).localeCompare(String(b.unit_id))),
   filing:{submitted:units.filter(id=>latest.has(id)).length,visibleUnits:units.length,missing:units.filter(id=>!latest.has(id))},
   objectives:[...objectiveMap.values()],
   milestones:[...milestoneMap.values()],
   coverageNote:"Filing coverage is not a measure of performance; objective and milestone states are recorded, not independently verified here.",
   noDoubleCount:"Each distinct objective ID and milestone ID appears once, regardless of how many people or departments worked on it.",
 };
}
