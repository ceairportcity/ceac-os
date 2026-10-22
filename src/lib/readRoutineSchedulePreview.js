/** Read every bounded provider page; partial dates must never look like a complete schedule. */
export async function readRoutineSchedulePreview(client, workItemIds, {fromDate,throughDate}) {
  const ids=[...new Set(workItemIds.filter(Boolean))];
  const rows=[];
  for(let start=0;start<ids.length;start+=200) {
    const batch=ids.slice(start,start+200);
    let expected=null;
    const batchRows=[];
    do {
      const result=await client.rpc("routine_schedule_preview",{
        p_work_item_ids:batch,p_from_date:fromDate,p_through_date:throughDate,
      },{count:"exact"}).range(batchRows.length,batchRows.length+499);
      if(result.error || !Array.isArray(result.data) || !Number.isInteger(result.count)
        || result.count<0 || result.count>74200 || expected!==null && expected!==result.count)
        throw new Error("The complete routine schedule could not be verified.");
      expected=result.count;
      if(!result.data.length && batchRows.length<expected) throw new Error("Routine schedule page is missing.");
      batchRows.push(...result.data);
      if(batchRows.length>expected) throw new Error("Routine schedule page count changed.");
    } while(batchRows.length<expected);
    rows.push(...batchRows);
  }
  const seen=new Set();
  return rows.map(row=>{
    const key=row.operation_id+":"+row.scheduled_on;
    if(seen.has(key) || !["recorded","unrecorded_past","scheduled","skipped"].includes(row.state)
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.scheduled_on) || !Number.isFinite(Date.parse(row.due_at)))
      throw new Error("Routine schedule dates are inconsistent.");
    seen.add(key);
    return {operationId:row.operation_id,date:row.scheduled_on,state:row.state,dueAt:row.due_at,timezone:row.timezone,dueTime:row.due_time};
  });
}

export function routineDueLabel(item) {
  return (item.dueTime ? new Intl.DateTimeFormat("en-GB",{timeZone:item.timezone,hour:"2-digit",minute:"2-digit"}).format(new Date(item.dueAt)) : "By end of day")+" · "+item.timezone;
}
