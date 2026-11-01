import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
import {attendanceDate} from "../lib/attendance";
function lastThirtyDays(){
 const d=new Date(attendanceDate()+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-29);
 return d.toISOString().slice(0,10);
}
export default function PersonalContributions({me,onOpenWork}){
 const [groups,setGroups]=useState(null),[error,setError]=useState("");
 useEffect(()=>{
  let active=true;setGroups(null);setError("");
  (async()=>{
   try{
    const date=lastThirtyDays();
    const a=await supabase.from("work_activity_records")
      .select("id,activity_date,supersedes_id,work_item_id",{count:"exact"})
      .eq("org_id",me.org_id).eq("contributor_id",me.id)
      .gte("activity_date",date).order("activity_date",{ascending:false}).limit(200);
    if(a.error||!Array.isArray(a.data)||a.count==null||a.count>200)
      throw new Error("This period cannot be fully verified.");
    const superseded=new Set(a.data.map(row=>row.supersedes_id).filter(Boolean));
    const current=a.data.filter(row=>!superseded.has(row.id));
    const ids=[...new Set(current.map(row=>row.work_item_id).filter(Boolean))];
    const linked=[];
    for(let i=0;i<ids.length;i+=40){
      const w=await supabase.from("work_items")
        .select("id,unit_id,units!work_items_unit_id_fkey(name)")
        .eq("org_id",me.org_id).in("id",ids.slice(i,i+40));
      if(w.error||!Array.isArray(w.data))throw new Error("Work departments could not be verified.");
      linked.push(...w.data);
    }
    const sources=new Map(linked.map(item=>[item.id,item]));
    if(current.some(row=>!sources.has(row.work_item_id)))throw new Error("Some work records are not available to this account.");
    const byUnit=new Map();
    for(const row of current){
      const source=sources.get(row.work_item_id);
      const unit=source.unit_id||"unknown";
      if(!byUnit.has(unit))byUnit.set(unit,{id:unit,name:source.units?.name||"Department not recorded",count:0,dates:new Set(),items:new Set()});
      const result=byUnit.get(unit);result.count+=1;result.dates.add(row.activity_date);result.items.add(row.work_item_id);
    }
    if(active)setGroups([...byUnit.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)));
   }catch{if(active)setError("Your department contributions could not be verified. Open Work history for the original records.");}
  })();
  return()=>{active=false;};
 },[me.org_id,me.id]);
 return <div className="ev2pf-section-body">
  <p className="screen-note">Your recorded activities from the last 30 calendar days, grouped by the department of the original work item. These are self-reported contributions, not additional attendance days or verified working hours.</p>
  {groups===null&&!error&&<p role="status">Checking work contributions…</p>}
  {error&&<p role="alert">{error}</p>}
  {groups?.length===0&&<p>No work diary activities were recorded in this period.</p>}
  {groups?.map(group=><div className="ev2pf-row" key={group.id}>
    <strong>{group.name}</strong>
    <span>{group.count} recorded {group.count===1?"activity":"activities"} · {group.items.size} work {group.items.size===1?"item":"items"} · {group.dates.size} {group.dates.size===1?"date":"dates"} with entries</span>
  </div>)}
  {onOpenWork&&<button type="button" className="btn btn-ghost btn-sm" onClick={onOpenWork}>Open Work history</button>}
 </div>;
}
