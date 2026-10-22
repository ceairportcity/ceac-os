import {validRoutineDate} from "./routineDateRoute.js";
const failure=()=>new Error("The complete date-cover assignment could not be verified. Refresh before recording work.");
export const routineCoverKey=(operationId,date)=>operationId+":"+date;
export const routineDateAssignee=(work,cover)=>cover?.action==="assign"?cover.assignee_id:work.assignee_id;
export const routineCoverLabel=(cover,me)=>cover?.action==="assign"
 ? (cover.assignee_id===me?.id?"Cover assigned to you":"Cover: "+(cover.assignee?.full_name||"assigned colleague")):"";
/** Full version history, not a filtered obsolete assignment to the signed-in person. */
export async function readRoutineCovers(client,me,{fromDate,throughDate,workItemId=null}) {
 if(!me?.id||!me.org_id||!validRoutineDate(fromDate)||!validRoutineDate(throughDate)
  ||throughDate<fromDate||(Date.parse(throughDate)-Date.parse(fromDate))/86400000>370) throw failure();
 const all=[];let expected=null;
 do {
  let query=client.from("routine_date_covers").select("id,org_id,operation_id,work_item_id,unit_id,scheduled_on,version,action,assignee_id,reason,actor_id,recorded_at,assignee:profiles!routine_date_covers_assignee_id_fkey(full_name),actor:profiles!routine_date_covers_actor_id_fkey(full_name)",{count:"exact"})
   .eq("org_id",me.org_id).gte("scheduled_on",fromDate).lte("scheduled_on",throughDate);
  if(workItemId)query=query.eq("work_item_id",workItemId);
  const result=await query.order("operation_id").order("scheduled_on").order("version").range(all.length,all.length+199);
  if(result.error||!Array.isArray(result.data)||!Number.isInteger(result.count)||result.count<0||result.count>2000
   ||expected!==null&&result.count!==expected||!result.data.length&&all.length<result.count) throw failure();
  expected=result.count;all.push(...result.data);if(all.length>expected)throw failure();
 } while(all.length<expected);
 const byDate=new Map(),ids=new Set();
 for(const row of all){
  if(!row.id||ids.has(row.id)||row.org_id!==me.org_id||!row.operation_id||!row.work_item_id||!row.unit_id
   ||workItemId&&row.work_item_id!==workItemId||!validRoutineDate(row.scheduled_on)||row.scheduled_on<fromDate||row.scheduled_on>throughDate
   ||!Number.isInteger(row.version)||row.version<1||!["assign","restore"].includes(row.action)
   ||(row.action==="assign"?!row.assignee_id:row.assignee_id!==null)||!row.actor_id||!row.recorded_at)throw failure();
  ids.add(row.id);const key=routineCoverKey(row.operation_id,row.scheduled_on);
  const history=byDate.get(key)?.history||[];
  if(row.version!==history.length+1||history[0]&&(row.work_item_id!==history[0].work_item_id||row.unit_id!==history[0].unit_id))throw failure();
  byDate.set(key,{...row,history:[...history,{...row}]});
 }
 return byDate;
}
/** Merge incoming dated cover with the existing assigned series, without creating Work. */
export async function includeCoveredRoutineWork(client,me,work,covers,columns){
 const byId=new Map(work.map(row=>[row.id,row]));
 const incoming=[...new Set([...covers.values()].filter(row=>row.action==="assign"&&row.assignee_id===me.id).map(row=>row.work_item_id))].filter(id=>!byId.has(id));
 for(let start=0;start<incoming.length;start+=200){
  const batch=incoming.slice(start,start+200);
  const result=await client.from("work_items").select(columns,{count:"exact"}).eq("org_id",me.org_id).eq("kind","routine").eq("visibility","unit").in("id",batch);
  if(result.error||!Array.isArray(result.data)||result.count!==batch.length||result.data.length!==batch.length)throw failure();
  for(const row of result.data){if(!batch.includes(row.id)||byId.has(row.id)||row.org_id!==me.org_id)throw failure();byId.set(row.id,row);}
 }
 return [...byId.values()];
}
