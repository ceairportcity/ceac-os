import {useCallback,useState} from 'react';
import LearningDraftEditor from './LearningDraftEditor';
import {EmptyState, Pill} from './bits';

const panel={minWidth:0,padding:24,margin:0};
const stack={display:'grid',gap:16};
const stages=[['details','Course details'],['modules','Modules & resources'],['audience','Audience'],['publish','Publish']];

// Draft authoring only. Existing course, resource and assignment contracts own writes.
export default function LearningCourseBuilder({me,course,modules,resources,rules,profiles,units,busy,onSaved,onAddModule,onAddResource,onEditResource,onAssign,onPublish,onArchive,preview,onPreview,children}){
 const [stage,setStage]=useState('modules');
 const [selectedId,setSelectedId]=useState(modules[0]?.id||'');
 const [draftStates,setDraftStates]=useState({});
 const onDraftState=useCallback((id,dirty,saving)=>setDraftStates(current=>current[id]?.dirty===dirty&&current[id]?.saving===saving?current:{...current,[id]:{dirty,saving}}),[]);
 const unsaved=Object.values(draftStates).some(row=>row.dirty||row.saving);
 const selected=modules.find(row=>row.id===selectedId)||modules[0];
 const draft=course.state==='draft';
 const courseRules=rules.filter(row=>row.course_id===course.id);
 const ready=modules.some(row=>row.required)&&modules.every(row=>resources.some(resource=>resource.module_id===row.id));
 const title=rule=>rule.target_kind==='person'?profiles.find(row=>row.id===rule.target_profile_id)?.full_name||'Person':rule.target_kind==='unit'?units.find(row=>row.id===rule.target_unit_id)?.name||'Unit':rule.target_kind==='onboarding'?'Onboarding template':rule.target_role?.replaceAll('_',' ');
 return <section aria-label="Course builder" className="learning-reference-builder">
  <header className="learning-section-title" style={{flexWrap:'wrap'}}>
   <div style={{flex:'1 1 auto',minWidth:0,maxWidth:'100%'}}><span className="eyebrow">Learning / Course builder</span><h2 style={{fontSize:28,lineHeight:1.3,overflowWrap:'anywhere'}}>{course.title}</h2><p className="screen-note">{draft?'Draft course · Save each section as you build.':course.state==='published'?'Published course · Content is protected.':'Archived course · Existing learning history is preserved.'}</p><Pill tone={course.state==='published'?'green':'grey'}>{draft?'Draft':course.state==='published'?'Published':'Archived'}</Pill></div>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
    <button type="button" className="btn btn-ghost btn-sm" aria-pressed={preview} onClick={()=>onPreview(!preview)}>{preview?'Back to builder':'Learner preview'}</button>
    {draft&&!preview&&<button type="button" className="btn btn-sm" onClick={()=>{onPreview(false);setStage('publish');}}>Review & publish</button>}
   </div>
  </header>
  <div hidden={preview}>
   <nav aria-label="Course building stages" style={{display:'flex',flexWrap:'wrap',gap:8,margin:'24px 0'}}>
    {stages.map(([id,label],index)=><button type="button" key={id} className="btn btn-ghost btn-sm" style={{flex:'1 1 145px',justifyContent:'flex-start',border:0,borderBottom:`2px solid ${stage===id?'var(--ev2-action)':'var(--line)'}`,borderRadius:0,background:'transparent',color:stage===id?'var(--ev2-action)':undefined,padding:'12px 0'}} aria-current={stage===id?'step':undefined} aria-controls={`learning-stage-${id}`} onClick={()=>setStage(id)}>{index+1} · {label}</button>)}
   </nav>
   <div id="learning-stage-details" hidden={stage!=='details'}>
    <section className="card" style={panel} aria-label="Course details">
     <h3>Course details</h3>
     {draft?<LearningDraftEditor key={course.id} embedded me={me} edit={{kind:'course',row:course}} onSaved={onSaved} onDraftState={onDraftState}/>:<><p>{course.summary}</p>{course.estimated_minutes&&<p>{course.estimated_minutes} minutes</p>}</>}
    </section>
   </div>
   <div id="learning-stage-modules" hidden={stage!=='modules'}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:20,alignItems:'start'}}>
     <section className="card" style={{...panel,minHeight:360}} aria-label="Course outline">
      <h3>Course outline</h3>
      <div role="group" aria-label="Select module" style={{...stack,maxHeight:460,overflowY:'auto',margin:'20px 0'}} tabIndex={0}>
       {modules.map((row,index)=><button type="button" key={row.id} className="learning-assignment-card" aria-pressed={selected?.id===row.id} aria-controls={`learning-module-${row.id}`} onClick={()=>setSelectedId(row.id)} style={{margin:0,padding:16,borderColor:selected?.id===row.id?'var(--ev2-action)':undefined,background:selected?.id===row.id?'var(--ev2-action-soft)':undefined}}>
        <strong style={{display:"block"}}>{index+1} · {row.title}</strong>
        <small style={{display:"block",marginTop:6}}>{row.required?'Required':'Optional'}{row.estimated_minutes?` · ${row.estimated_minutes} min`:''} · {resources.filter(resource=>resource.module_id===row.id).length} {resources.filter(resource=>resource.module_id===row.id).length===1?'resource':'resources'}</small>
       </button>)}
       {!modules.length&&<EmptyState title="No modules yet">Add the first module to start your outline.</EmptyState>}
      </div>
      {draft&&<button type="button" className="text-action" onClick={onAddModule}>+ Add module</button>}
     </section>
     <section className="card" style={{...panel,maxHeight:760,overflowY:'auto'}} tabIndex={0} aria-label="Selected module editor">
      {!selected&&<EmptyState title="Start with a module">Your module editor and learning resources will appear here.</EmptyState>}
      {modules.map((row,index)=><div key={row.id} id={`learning-module-${row.id}`} hidden={selected?.id!==row.id}>
       <div className="learning-card-head"><h3>{row.title}</h3><Pill>Module {index+1}</Pill></div>
       {draft?<LearningDraftEditor embedded me={me} edit={{kind:'module',row}} onSaved={onSaved} onDraftState={onDraftState}>
       <h3 style={{marginTop:28}}>Learning resources</h3>
       <div className="learning-resources">
        {resources.filter(resource=>resource.module_id===row.id).map(resource=><article className="learning-resource" key={resource.id}>
         <div><strong>{resource.title}</strong><span>{resource.resource_type==='text'?'Text':resource.resource_type==='video'?'Video link':resource.resource_type==='document'?'Document link':'Link'}</span></div>
         {resource.resource_type==='text'?<p>{resource.body_text}</p>:<a href={resource.resource_url} target="_blank" rel="noreferrer">Preview resource</a>}
         {draft&&<button type="button" className="text-action" aria-label={`Edit resource ${resource.title}`} onClick={()=>onEditResource(resource)}>Edit resource</button>}
        </article>)}
        {!resources.some(resource=>resource.module_id===row.id)&&<p className="screen-note">No resources yet. Add text or a secure document, video or web link.</p>}
       </div>
       {draft&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>onAddResource(row.id)}>Add resource</button>}
       </LearningDraftEditor>:<><p>{row.summary}</p><h3>Learning resources</h3>{resources.filter(resource=>resource.module_id===row.id).map(resource=><article className="learning-resource" key={resource.id}><strong>{resource.title}</strong>{resource.resource_type==='text'?<p>{resource.body_text}</p>:<a href={resource.resource_url} target="_blank" rel="noreferrer">Preview resource</a>}</article>)}</>}
      </div>)}
     </section>
    </div>
   </div>
   <div id="learning-stage-audience" hidden={stage!=='audience'}>
    <section className="card" style={panel} aria-label="Course audience">
     <h3>Who should receive this course?</h3>
     <p>Assign to a person, a unit, an employment role or the onboarding template.</p>
     {draft&&<p className="screen-note">Publish the course before creating an assignment. Draft courses stay private to Learning Administration.</p>}
     {courseRules.length?<ul>{courseRules.map(rule=><li key={rule.id}>{title(rule)} · {rule.active?'Active':'Inactive'}{rule.due_days_after_assignment?` · Due in ${rule.due_days_after_assignment} days`:''}</li>)}</ul>:<p>No assignment rules recorded for this course.</p>}
     {course.state==='published'&&<button type="button" className="btn" onClick={onAssign}>Create assignment rule</button>}
     {draft&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setStage('publish')}>Review publication requirements</button>}
    </section>
   </div>
   <div id="learning-stage-publish" hidden={stage!=='publish'}>
    <section className="card" style={panel} aria-label="Review and publish">
     <h3>{draft?(ready?'Ready to publish?':'Before publishing'):'Course publication'}</h3>
     <p>{course.summary}</p>
     <ul style={{lineHeight:2}}>
      <li>{modules.length} modules · {resources.length} resources</li>
      <li>{modules.some(row=>row.required)?'Required module recorded':<><span>Add at least one required module. </span>{draft&&<button type="button" className="text-action" onClick={()=>{setStage('modules');if(!modules.length)onAddModule();}}>Edit course outline</button>}</>}</li>
      <li>{modules.length&&modules.every(row=>resources.some(resource=>resource.module_id===row.id))?'Every module has a resource':<><span>Add a resource to every module. </span>{draft&&modules.length>0&&<button type="button" className="text-action" onClick={()=>{setSelectedId(modules.find(row=>!resources.some(resource=>resource.module_id===row.id))?.id||modules[0].id);setStage('modules');}}>Add missing resources</button>}</>}</li>
     </ul>
     {draft&&<><p>Published content cannot be edited. Review the learner preview before publishing; assignments are created separately in Audience.</p>{unsaved&&<p role="status">Save your course and module changes before publishing. Learner preview shows saved content.</p>}<button type="button" className="btn btn-sm" style={{width:"fit-content",opacity:(busy||!ready||unsaved)?0.45:1}} disabled={busy||!ready||unsaved} onClick={onPublish}>Publish course</button></>}
     {course.state==='published'&&<><p>Published content is protected. Archive this course if it should no longer receive new assignments.</p><button type="button" className="btn btn-ghost" disabled={busy} onClick={onArchive}>Archive course</button></>}
     {course.state==='archived'&&<p>This course is archived. Existing assignments and history remain available.</p>}
    </section>
   </div>
  </div>
  {preview&&<div><p className="screen-note">Learner preview · Review the course content before publishing.</p>{children}</div>}
 </section>;
}
