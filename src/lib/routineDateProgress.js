/** Complete RLS-backed history for one canonical routine date. */
export function routineEvidenceLinks(text) {
 const links=String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(links.length>5 || links.some(link=>link.length>2000 || !/^https?:\/\/[^\s]+$/.test(link)))
  throw new Error("Use at most five complete web links, one per line.");
 return links;
}
export async function readRoutineDateProgress(client,{orgId,operationId,date}) {
 const all=[]; let total=null;
 for(let page=0;page<20;page++) {
  const result=await client.from("routine_date_progress")
   .select("id,org_id,operation_id,scheduled_on,entry_number,actor_id,recorded_at,status,completed_step_ids,checklist_snapshot,note,evidence_links,actor:profiles!routine_date_progress_actor_id_fkey(full_name)",{count:"exact"})
   .eq("org_id",orgId).eq("operation_id",operationId).eq("scheduled_on",date)
   .order("entry_number",{ascending:false}).range(page*100,page*100+99);
  if(result.error) throw result.error;
  if(!Array.isArray(result.data) || !Number.isInteger(result.count) || result.count<0
   || total!==null && result.count!==total) throw new Error("This date's history could not be verified.");
  total=result.count; all.push(...result.data);
  if(all.length===total) break;
 }
 if(all.length!==total || new Set(all.map(row=>row.id)).size!==all.length
  || all.some((row,index)=>row.org_id!==orgId || row.operation_id!==operationId || row.scheduled_on!==date
   || row.entry_number!==total-index || !row.actor_id || !row.recorded_at
   || !["in_progress","waiting_on","ready_for_review"].includes(row.status)
   || !Array.isArray(row.completed_step_ids) || !Array.isArray(row.checklist_snapshot)
   || row.checklist_snapshot.some(step=>!step.id || typeof step.label!=="string" || typeof step.done!=="boolean")
   || !Array.isArray(row.evidence_links))) throw new Error("This date's history is incomplete or has changed. Refresh it.");
 for(const row of all) routineEvidenceLinks(row.evidence_links.join("\n"));
 return all;
}
