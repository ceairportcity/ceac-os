/**
 * CEAC leadership factual-only brief, from canonical period/unit reports,
 * objectives and milestones. No arbitrary weights, staff scores or currency sums.
 */
const final = status => status === "submitted" || status === "confirmed";
export const isIssuedUnitReport = report => Boolean(report && final(report.status));

// A submitted unit report remains the current published evidence while its
// author prepares a later DRAFT correction. Show the latest draft only when
// the unit has never submitted an issued report. Unknown/returned states are
// never silently counted as successful filing.
export function latestUnitReportStatus(reports = []) {
 const issued = new Map(), drafts = new Map();
 for (const report of reports) {
  if (!report?.unit_id) continue;
  const bucket = isIssuedUnitReport(report) ? issued :
    report.status === "draft" ? drafts : null;
  if (!bucket) continue;
  const key = String(report.unit_id), prior = bucket.get(key);
  const version = Number(report.version ?? 0), previous = Number(prior?.version ?? 0);
  if (!prior || version > previous ||
      (version === previous && String(report.submitted_at || "") > String(prior.submitted_at || "")))
    bucket.set(key, report);
 }
 const result = {};
 for (const key of new Set([...issued.keys(), ...drafts.keys()]))
  result[key] = issued.get(key) || drafts.get(key);
 return result;
}
export function ministryPeriodEvidence({unitReports=[],objectives=[],milestones=[],targets=[],evidenceRefs=[],activeUnitIds=[]}={}){
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
 // Only the latest published report revision for each unit is a current
 // quarterly evidence source. Never treat previous report revisions as extra
 // commitments, and never derive commitments from unmatched references.
 const byReportId=new Map([...latest.values()].filter(report=>report.id).map(report=>[report.id,report]));
 const unique=(items)=>[...new Map(items.filter(row=>row?.id&&byReportId.has(row.report_id))
   .map(row=>[row.id,{...row,unit_id:byReportId.get(row.report_id).unit_id}])).values()];
 const unitTargets=unique(targets).sort((a,b)=>String(a.unit_id).localeCompare(String(b.unit_id))
    || Number(a.position||0)-Number(b.position||0) || String(a.id).localeCompare(String(b.id)));
 const unitEvidence=unique(evidenceRefs).sort((a,b)=>String(a.unit_id).localeCompare(String(b.unit_id))
    || String(a.section||"").localeCompare(String(b.section||""))
    || String(a.id).localeCompare(String(b.id)));
 const units=[...new Set(activeUnitIds.filter(Boolean))];
 return {
   filedReports:[...latest.values()].sort((a,b)=>String(a.unit_id).localeCompare(String(b.unit_id))),
   filing:{submitted:units.filter(id=>latest.has(id)).length,visibleUnits:units.length,missing:units.filter(id=>!latest.has(id))},
   objectives:[...objectiveMap.values()],
   milestones:[...milestoneMap.values()],
   unitTargets,unitEvidence,
   coverageNote:"Filing coverage is not a measure of performance; objective and milestone states are recorded, not independently verified here.",
   noDoubleCount:"Each distinct objective ID and milestone ID appears once, regardless of how many people or departments worked on it.",
 };
}
