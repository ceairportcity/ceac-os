import {useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {FieldGroup,ProductNotice} from './bits';
import {Button,ComposerDrawer} from '../experience-v2/components';

// Edits only existing draft content. Publication, assignments and completion
// remain with the established Learning screen and database guards.
export default function LearningDraftEditor({me,edit,onClose,onSaved,embedded=false,children,onDraftState}){
 const {kind,row}=edit;
 const [title,setTitle]=useState(row.title||''),[summary,setSummary]=useState(row.summary||'');
 const [minutes,setMinutes]=useState(row.estimated_minutes==null?'':String(row.estimated_minutes));
 const [required,setRequired]=useState(Boolean(row.required));
 const [type,setType]=useState(row.resource_type||'link'),[url,setUrl]=useState(row.resource_url||''),[text,setText]=useState(row.body_text||'');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef(false),mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const dirty=title!==(row.title||'')||summary!==(row.summary||'')||minutes!==(row.estimated_minutes==null?'':String(row.estimated_minutes))||required!==Boolean(row.required);
 useEffect(()=>{if(embedded)onDraftState?.(row.id,dirty,busy);},[embedded,onDraftState,row.id,dirty,busy]);
 const valid=title.trim().length>=(kind==='course'?3:2)
  &&(kind!=='course'||summary.trim().length>=3)
  &&(kind==='resource'?(type==='text'?Boolean(text.trim()):/^https:\/\//i.test(url.trim())):minutes===''||(/^\d+$/.test(minutes)&&Number(minutes)>0&&Number.isSafeInteger(Number(minutes))));
 async function save(){
  if(pending.current||busy||!valid)return;
  pending.current=true;setBusy(true);setError('');
  try{
   const payload={title:title.trim(),updated_by:me.id,...(kind==='resource'?{resource_type:type,resource_url:type==='text'?null:url.trim(),body_text:type==='text'?text.trim():null}:{summary:summary.trim()||null,estimated_minutes:minutes===''?null:Number(minutes),...(kind==='module'?{required}:{})})};
   let request=supabase.from({course:'learning_courses',module:'learning_modules',resource:'learning_resources'}[kind]).update(payload).eq('id',row.id).eq('org_id',me.org_id);
   if(kind==='course')request=request.eq('state','draft');
   const result=await request.select('id').single();
   if(!mounted.current)return;
   if(result.error)throw result.error;
   if(result.data?.id!==row.id)throw new Error('The draft update could not be confirmed. Reload the course before trying again.');
   setTitle(payload.title);
   if(kind!=='resource'){setSummary(payload.summary||'');setMinutes(payload.estimated_minutes==null?'':String(payload.estimated_minutes));}
   await onSaved();
  }catch(e){if(mounted.current)setError(e.message||'The draft could not be updated.');}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 const fields=<>
  {error&&<ProductNotice tone="error" title="Draft update not saved">{error}</ProductNotice>}
  <fieldset disabled={busy} style={{border:0,margin:0,padding:0,minWidth:0}}>
   <FieldGroup label={embedded?(kind==='module'?'Module title':'Course title'):'Title'}><input className="field" aria-label="Draft content title" value={title} onChange={e=>setTitle(e.target.value)}/></FieldGroup>
   {kind==='resource'?<>
    <FieldGroup label="Resource type"><select className="field" aria-label="Draft resource type" value={type} onChange={e=>setType(e.target.value)}><option value="link">Link</option><option value="video">Video link</option><option value="document">Document link</option><option value="text">Text</option></select></FieldGroup>
    {type==='text'?<FieldGroup label="Text"><textarea className="field" aria-label="Draft resource text" rows={6} value={text} onChange={e=>setText(e.target.value)}/></FieldGroup>:<FieldGroup label="Secure URL"><input className="field" type="url" aria-label="Draft resource URL" value={url} onChange={e=>setUrl(e.target.value)}/></FieldGroup>}
   </>:<>
    <FieldGroup label={embedded&&kind==='module'?'What will people learn?':'Summary'}><textarea className="field" aria-label="Draft content summary" rows={4} value={summary} onChange={e=>setSummary(e.target.value)}/></FieldGroup>
    <FieldGroup label="Estimated minutes (optional)"><input className="field" aria-label="Draft content minutes" inputMode="numeric" value={minutes} onChange={e=>setMinutes(e.target.value)}/></FieldGroup>
    {kind==='module'&&!embedded&&<label className="check"><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/><span>Required for course completion</span></label>}
   </>}
  </fieldset>
 </>;
 if(embedded)return <form onSubmit={event=>{event.preventDefault();void save();}}>
  {fields}
  {children}
  {kind==='module'&&<details style={{margin:'20px 0'}}><summary>Completion requirements</summary><label className="check" style={{display:'flex',gap:8,alignItems:'center',marginTop:12}}><input type="checkbox" disabled={busy} checked={required} onChange={e=>setRequired(e.target.checked)}/><span>Required for course completion</span></label></details>}
  <button type="submit" className="btn" style={{width:'auto'}} disabled={busy||!valid}>{busy?'Saving…':kind==='module'?'Save module':'Save course details'}</button>
 </form>;
 return <ComposerDrawer open title={`Edit ${kind==='course'?'course details':kind}`} description="Changes apply to this draft. Published learning and completed records stay protected." onClose={()=>!busy&&onClose()} footer={<Button disabled={busy||!valid} onClick={save}>{busy?'Saving…':'Save changes'}</Button>}>{fields}</ComposerDrawer>;
}
