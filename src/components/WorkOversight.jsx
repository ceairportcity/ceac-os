import {useEffect, useRef, useState} from "react";
import {supabase} from "../lib/supabase";
import {humanError} from "../lib/productLanguage";
import {isWorkOverdue} from "../lib/time";
import "./WorkOversight.css";

const labels={update:"Progress update",milestone:"Milestone for review",decision:"Decision requested",attention:"Attention requested",follow_up:"Follow-up",feedback:"Feedback",accepted:"Milestone accepted",changes_requested:"Changes requested",answered:"Decision recorded"};
const requestKinds=new Set(["milestone","decision","attention"]);
const stamp=value=>new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Accra"}).format(new Date(value));

/** Keyed identity boundaries discard drafts and results on account/work changes. */
export function WorkOversightConversation(props){
  if(props.item.visibility==="private"||props.item.confidential)return null;
  return <Conversation key={`${props.me.org_id}:${props.me.id}:${props.item.id}`} {...props}/>;
}
function Conversation({me,item,onChanged}){
  const [context,setContext]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [draft,setDraft]=useState(null),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const [supervisor,setSupervisor]=useState(""),[reason,setReason]=useState(""),[editingLine,setEditingLine]=useState(false);
  const generation=useRef(0),writing=useRef(false),request=useRef(null);
  useEffect(()=>{void load();return()=>{generation.current++;};},[me.id,me.org_id,item.id]);
  async function load(){
    const token=++generation.current;setLoading(true);setError("");setContext(null);
    try{
      const result=await supabase.rpc("work_oversight_context",{p_work:item.id});
      if(result.error)throw result.error;
      if(!result.data||!Array.isArray(result.data.events))throw new Error("The shared work record could not be verified.");
      if(token===generation.current){setContext(result.data);setSupervisor(result.data.named_supervisor_id||"");}
    }catch(e){if(token===generation.current)setError(humanError(e,"Shared oversight could not be opened."));}
    finally{if(token===generation.current)setLoading(false);}
  }
  function compose(kind,parent=null){setDraft({kind,parent});setNote("");setNotice("");request.current=null;}
  async function save(){
    if(writing.current||!draft||!note.trim())return;
    writing.current=true;setBusy(true);setNotice("");const token=generation.current;
    // Reuse the exact ID and content after an indeterminate network result.
    const args={p_work:item.id,p_kind:draft.kind,p_note:note.trim(),p_reply_to:draft.parent?.id||null};
    if(!request.current||JSON.stringify(request.current.args)!==JSON.stringify(args))request.current={id:crypto.randomUUID(),args};
    try{
      const result=await supabase.rpc("add_work_oversight_entry",{...args,p_request_id:request.current.id});
      if(result.error)throw result.error;
      if(result.data!==request.current.id)throw new Error("Saving could not be confirmed. Refresh before trying again.");
      if(token!==generation.current)return;
      setDraft(null);setNote("");request.current=null;await load();
      setNotice(args.p_kind==="update"?"Update shared. No approval request was created.":"Saved to this work conversation.");onChanged?.();
    }catch(e){if(token===generation.current)setNotice(humanError(e,"Saving could not be confirmed. Refresh the conversation before retrying."));}
    finally{writing.current=false;if(token<=generation.current)setBusy(false);}
  }
  async function saveSupervisor(){
    if(writing.current||!supervisor||!reason.trim())return;
    writing.current=true;setBusy(true);setNotice("");const token=generation.current;
    try{
      const result=await supabase.rpc("set_work_supervisor",{p_work:item.id,p_supervisor:supervisor,p_reason:reason.trim()});
      if(result.error)throw result.error;
      if(result.data!==supervisor)throw new Error("The reporting change could not be verified.");
      if(token!==generation.current)return;
      setEditingLine(false);setReason("");await load();setNotice("Supervisor recorded. The current review route is shown separately.");onChanged?.();
    }catch(e){if(token===generation.current)setNotice(humanError(e,"The supervisor could not be saved."));}
    finally{writing.current=false;setBusy(false);}
  }
  if(loading)return <section className="cw-oversight" aria-label="Shared oversight"><p role="status">Opening shared work…</p></section>;
  if(error)return <section className="cw-oversight"><p role="alert">{error}</p><button className="btn btn-ghost" onClick={load}>Try again</button></section>;
  const pending=context.events.filter(e=>requestKinds.has(e.kind)&&!e.resolved);
  const canFollow=context.can_coordinate||context.supervisor_id===me.id||context.reviewer_id===me.id;
  return <section className="cw-oversight" aria-label="Shared oversight">
    <header className="cw-oversight-heading"><div><span className="eyebrow">People &amp; progress</span><h2>Shared work conversation</h2></div>{context.open&&<span className="cw-oversight-state">{pending.length?`${pending.length} awaiting a response`:"Progress visible"}</span>}</header>
    <dl className="cw-oversight-people">
      <div><dt>Responsible</dt><dd>{context.responsible_name||"Not assigned"}</dd></div>
      <div><dt>{context.named_supervisor_id?"Reports to":"Current supervision route"}</dt><dd>{context.supervisor_name||"Not yet recorded"}</dd></div>
      <div><dt>Final review</dt><dd>{context.reviewer_name||(item.kind==="routine"?"Individual dates have their own review":"No reviewer recorded")}</dd></div>
      <div><dt>Coordination</dt><dd>{context.coordinators.join(", ")||"No active Admin recorded"}</dd></div>
    </dl>
    {context.can_coordinate&&context.supervisor_options?.length>0&&<details className="cw-oversight-line" open={editingLine} onToggle={e=>setEditingLine(e.currentTarget.open)}><summary>Set the responsible person's supervisor</summary><p>This executive supervises the manager's shared work. Work assigned by Admin still returns to its assigning Admin.</p><label>Supervisor<select className="field" value={supervisor} onChange={e=>setSupervisor(e.target.value)} disabled={busy}><option value="">Choose a supervisor</option>{context.supervisor_options.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Reason<input className="field" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></label><button type="button" className="btn btn-ghost" disabled={busy||!supervisor||!reason.trim()} onClick={saveSupervisor}>Save supervisor</button></details>}
    {item.status==="in_review"&&<p className="cw-oversight-next"><strong>Awaiting final review</strong><span>{context.reviewer_name||"The responsible reviewer"} has the next action. No repeat submission is needed.</span></p>}
    {pending.map(entry=><div className="cw-oversight-next" key={entry.id}><strong>{labels[entry.kind]}</strong><span>{entry.recipient_name||"The named recipient"} to respond · {stamp(entry.recorded_at)}</span><p>{entry.note}</p>{entry.recipient_id===me.id&&entry.actor_id!==me.id&&context.open&&<div className="cw-oversight-actions">{entry.kind==="milestone"?<><button type="button" className="btn" disabled={busy} onClick={()=>compose("accepted",entry)}>Accept milestone</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>compose("changes_requested",entry)}>Request changes</button></>:<button type="button" className="btn" disabled={busy} onClick={()=>compose("answered",entry)}>Record response</button>}</div>}</div>)}
    <div className="cw-oversight-history" aria-label="Shared progress history">{context.events.length===0?<p className="screen-note">Shared updates, feedback and decisions will appear here.</p>:context.events.map(entry=><article key={entry.id}><header><strong>{entry.actor_name||"CEAC member"}</strong><span>{labels[entry.kind]}</span></header><p>{entry.note}</p><time dateTime={entry.recorded_at}>{stamp(entry.recorded_at)}</time>{entry.reply_to&&<span className="cw-oversight-reply">Response to the linked request</span>}</article>)}</div>
    {context.events.length===100&&<p className="screen-note">Showing the latest 100 messages. The complete audit record is retained.</p>}
    {context.open&&!draft&&<div className="cw-oversight-actions">
      {context.can_update&&<><button type="button" className="btn" disabled={busy} onClick={()=>compose("update")}>Share update</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>compose("milestone")}>Request milestone review</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>compose("decision")}>Request a decision</button></>}
      {canFollow&&<><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>compose("follow_up")}>Follow up</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>compose("attention")}>Request attention</button></>}
      {!context.can_update&&<button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>compose("feedback")}>Give feedback</button>}
    </div>}
    {draft&&<form className="cw-oversight-compose" onSubmit={e=>{e.preventDefault();void save();}}><label>{labels[draft.kind]}<textarea className="field" rows={3} maxLength={4000} autoFocus value={note} onChange={e=>setNote(e.target.value)} disabled={busy} required/></label><p>{draft.kind==="update"?"Visible to the responsible person, authorised supervisors and Admin. Your private diary stays separate.":draft.kind==="milestone"||draft.kind==="accepted"?"A milestone decision does not complete the whole assignment.":"Your message stays attached to this work item."}</p><div className="cw-oversight-actions"><button type="submit" className="btn" disabled={busy||!note.trim()}>{busy?"Saving…":"Save and share"}</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>{setDraft(null);request.current=null;}}>Cancel</button></div></form>}
    {notice&&<p role="status" className="cw-oversight-notice">{notice}</p>}
  </section>;
}

export default function WorkOversightWorkspace({me,openItem}){
  return <OversightWorkspace key={`${me.org_id}:${me.id}`} me={me} openItem={openItem}/>;
}
function OversightWorkspace({me,openItem}){
  const [rows,setRows]=useState([]),[total,setTotal]=useState(0),[offset,setOffset]=useState(0),[selected,setSelected]=useState(null);
  const [filter,setFilter]=useState("all"),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const generation=useRef(0);
  useEffect(()=>{void load();return()=>{generation.current++;};},[me.org_id,me.id,offset]);
  async function load(quiet=false){const token=++generation.current;if(!quiet){setLoading(true);setRows([]);}setError("");
    try{const result=await supabase.rpc("work_oversight_queue",{p_offset:offset});if(result.error)throw result.error;if(!Array.isArray(result.data?.rows))throw new Error("The work list could not be verified.");if(token!==generation.current)return;setRows(result.data.rows);setTotal(result.data.total);setSelected(id=>result.data.rows.some(r=>r.id===id)?id:null);}
    catch(e){if(token===generation.current)setError(humanError(e,"Oversight could not be loaded."));}finally{if(token===generation.current)setLoading(false);}}
  const visible=rows.filter(row=>filter==="all"||filter==="routine"&&row.kind==="routine"||filter==="action"&&(row.pending_count>0||row.status==="in_review"||isWorkOverdue(row)));
  const chosen=visible.find(r=>r.id===selected);
  return <section className="cw-oversight-workspace" aria-label="Work oversight"><header className="cw-oversight-intro"><span className="eyebrow">{me.is_admin?"Coordination":me.is_exec?"Leadership oversight":"Team supervision"}</span><h2>{me.is_admin?"Keep work moving.":me.is_exec?"Decisions, in focus.":"Progress, together."}</h2><p>{me.is_admin?"Follow up with managers and bring decisions to the right person.":"Follow shared progress and respond where your input is needed."}</p></header>
    <div className="cw-oversight-filters" role="group" aria-label="Oversight filter">{[["all","All work"],["action","Needs action"],["routine","Routine"]].map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}<span>{total} active responsibilities</span></div>
    {loading?<p role="status">Loading shared work…</p>:error?<div role="alert">{error}<button type="button" className="btn btn-ghost" onClick={()=>load(false)}>Try again</button></div>:<div className={`cw-oversight-columns${chosen?" has-selection":""}`}><div className="cw-oversight-list">{visible.length?visible.map(row=><button type="button" key={row.id} aria-pressed={selected===row.id} onClick={()=>setSelected(row.id)}><span>{row.pending_count>0?`${row.pending_count} awaiting a response`:row.status==="in_review"?"Awaiting final review":row.kind==="routine"?"Recurring responsibility":isWorkOverdue(row)?"Past due — follow up":"In progress"}</span><strong>{row.title}</strong><small>{row.assignee_name||"Not assigned"} · {row.unit_name}</small></button>):<p className="screen-note">No matching work on this page.</p>}
    {total>50&&<div className="cw-oversight-actions"><button type="button" className="btn btn-ghost" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Previous</button><span>{offset+1}–{Math.min(offset+50,total)} of {total}</span><button type="button" className="btn btn-ghost" disabled={offset+50>=total} onClick={()=>setOffset(n=>n+50)}>Next</button></div>}</div>
    {chosen&&<div className="cw-oversight-selected"><header><div><span className="eyebrow">{chosen.ref}</span><h3>{chosen.title}</h3></div><button type="button" aria-label="Close shared work" onClick={()=>setSelected(null)}>×</button></header><WorkOversightConversation me={me} item={chosen} onChanged={()=>load(true)}/><button type="button" className="btn btn-ghost" onClick={()=>openItem(chosen.id)}>Open full work record</button></div>}</div>}
  </section>;
}
