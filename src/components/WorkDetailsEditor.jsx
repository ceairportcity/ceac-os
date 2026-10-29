import {useRef,useState} from 'react';
import {supabase} from '../lib/supabase';

// Shared by Staff, Manager and HR work detail. The RPC rechecks all authority.
export default function WorkDetailsEditor({me,item,onSaved}) {
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [draft,setDraft]=useState(null);
 const writing=useRef(false);
 const memberships=me.memberships || [];
 const member=memberships.some(m=>m.unit_id===item.unit_id)||me.unit_id===item.unit_id;
 const manager=memberships.some(m=>m.unit_id===item.unit_id&&m.role==='manager');
 const allowed= !['completed','self_certified','cancelled','in_review'].includes(item.status) && (
  item.origin==='self_created'&&item.assignee_id===me.id&&member || item.assigned_by===me.id&&(manager||me.is_exec));
 if(!allowed)return null;
 async function save(event) {
  event.preventDefault();if(writing.current)return;
  writing.current=true;setBusy(true);setError('');
  try {
   const result=await supabase.rpc('edit_open_work_details',{
    p_work_item_id:item.id,p_expected_movement:item.last_movement_at || null,
    p_title:draft.title,p_purpose:draft.purpose,p_outcome:draft.expected_outcome,p_instructions:draft.instructions,
   });
   if(result.error)throw result.error;
   setOpen(false);await onSaved?.();
  }catch(e){setError(e.message || 'The work details could not be saved.');}
  finally{writing.current=false;setBusy(false);}
 }
 return <section aria-label="Edit work details">
  {!open?<button className="btn btn-ghost btn-sm" type="button" onClick={()=>{setDraft({title:item.title||'',purpose:item.purpose||'',expected_outcome:item.expected_outcome||'',instructions:item.instructions||''});setOpen(true);setError('');}}>Edit work details</button>:
   <form className="s2-work-diary-form" onSubmit={save}>
    <h3 className="wide">Edit work details</h3>
    <label className="wide">Title<input required minLength={3} maxLength={220} value={draft.title} disabled={busy} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    {[['purpose','Why this matters',4000],['expected_outcome','What finished looks like',4000],['instructions','What to do',8000]].map(([field,label,max])=><label className="wide" key={field}>{label}<textarea rows={3} maxLength={max} disabled={busy} value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}/></label>)}
    {error&&<p className="wide" role="alert">{error}</p>}
    <div className="wide"><button className="btn btn-sm" disabled={busy} type="submit">{busy?'Saving…':'Save work details'}</button> <button className="btn btn-ghost btn-sm" disabled={busy} type="button" onClick={()=>setOpen(false)}>Cancel</button></div>
   </form>}
 </section>;
}
