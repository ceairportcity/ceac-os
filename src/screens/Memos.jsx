import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Search, Paperclip, Plus, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { PendingFilePicker, OperationalMediaList } from "../components/OperationalFiles";
import { listOperationalFiles, uploadOperationalFile } from "../lib/operationalFiles";
import { MEMO_STATUS_LABELS, eligibleMemoDecisionMakers, initials, memoInView, messageTimestamp } from "../lib/memos";

const fresh = () => ({id:crypto.randomUUID(),versionId:null,updatedAt:null,subject:"",body:"",to:[],cc:[],decisionRequired:false,scope:"department",unitId:"",decisionMakerId:""});

// Basic formatting is parsed into React text nodes. Never render authored HTML.
function MemoBody({body=""}) {
  return <div className="memo-body">{body.split("\n").map((line,index)=><p key={index}>{line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part,i)=>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2,-2)}</strong>
      : part.startsWith("_") && part.endsWith("_") ? <em key={i}>{part.slice(1,-1)}</em> : part)}{!line && <br/>}</p>)}</div>;
}
function RecipientPicker({label,people,value,onChange,excluded,disabled}) {
  const [query,setQuery]=useState("");
  const matches=people.filter(p=>!excluded.includes(p.id) && !value.includes(p.id) && `${p.full_name} ${p.job_title||""}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="memo-recipient"><label>{label}<input type="search" value={query} disabled={disabled} placeholder="Search colleagues or roles…" onChange={e=>setQuery(e.target.value)}/></label>
    <div className="memo-people">{value.map(id=><span key={id}>{people.find(p=>p.id===id)?.full_name || "Selected recipient"}<button disabled={disabled} type="button" aria-label={`Remove ${people.find(p=>p.id===id)?.full_name || "recipient"}`} onClick={()=>onChange(value.filter(x=>x!==id))}><X size={12}/></button></span>)}</div>
    {query && !disabled && <div className="memo-matches">{matches.slice(0,12).map(p=><button type="button" key={p.id} onClick={()=>{onChange([...value,p.id]);setQuery("");}}><strong>{p.full_name}</strong><small>{p.job_title || "CEAC colleague"}</small></button>)}{!matches.length && <p>No matching colleagues.</p>}</div>}
  </div>;
}
export default function Memos({me,composeRequest,initialMemoId,openProject,leaveGuard}) {
  const [rows,setRows]=useState([]),[people,setPeople]=useState([]),[units,setUnits]=useState([]),[fileVersions,setFileVersions]=useState(new Set());
  const [canCreateProject,setCanCreateProject]=useState(Boolean(me.is_admin));
  const [view,setView]=useState("received"),[query,setQuery]=useState(""),[selected,setSelected]=useState(initialMemoId || null);
  const [form,setForm]=useState(null),[dirty,setDirty]=useState(false),[pendingFiles,setPendingFiles]=useState([]),[draftFiles,setDraftFiles]=useState([]);
  const [detail,setDetail]=useState(null),[detailKey,setDetailKey]=useState(""),[reply,setReply]=useState("");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [reload,setReload]=useState(0),[projectUnit,setProjectUnit]=useState(""),[projectName,setProjectName]=useState(""),[projectSummary,setProjectSummary]=useState("");
  const writing=useRef(false),textarea=useRef(null),request=useRef(0),responseIntent=useRef(null),editorVersion=useRef(null),projectVersion=useRef(null);
  const name=id=>people.find(person=>person.id===id)?.full_name || "CEAC colleague";
  useEffect(()=>{if(composeRequest)startNew();},[composeRequest]);
  useEffect(()=>{
    let current=true;setLoading(true);setError("");
    (async()=>{
      try {
        const [memoResult,directoryResult,unitResult,creationResult]=await Promise.all([
          supabase.from("memos").select("*,memo_versions!memo_versions_memo_id_fkey(id,version_no,subject,sent_at),memo_recipients(*)").order("updated_at",{ascending:false}).limit(200),
          supabase.rpc("memo_recipient_directory"),supabase.from("units").select("id,name").eq("org_id",me.org_id).eq("active",true).order("name"),
          supabase.from("capabilities").select("id").eq("org_id",me.org_id).eq("profile_id",me.id).eq("capability","create_project").maybeSingle(),
        ]);
        const failure=[memoResult.error,directoryResult.error,unitResult.error].find(Boolean);if(failure)throw failure;
        const versionIds=(memoResult.data || []).flatMap(m=>m.memo_versions.map(v=>v.id));
        const attached=new Set();
        for(let offset=0;offset<versionIds.length;offset+=100){
          const files=await supabase.from("operational_file_links").select("context_id").eq("context_type","memo_version").in("context_id",versionIds.slice(offset,offset+100));
          if(files.error)throw files.error;for(const file of files.data || [])attached.add(file.context_id);
        }
        const actorUnits=(me.memberships || []).map(m=>m.unit_id);
        const relevance=p=>p.managed_units?.some(id=>actorUnits.includes(id))?2:p.member_units?.some(id=>actorUnits.includes(id))?1:0;
        if(current){setCanCreateProject(Boolean(me.is_admin || !creationResult.error && creationResult.data));
          setNotice(previous=>creationResult.error && !me.is_admin ? "Project creation permissions could not be verified. Refresh Memos to retry." : previous.startsWith("Project creation permissions could not be verified.") ? "" : previous);
          setRows(memoResult.data || []);setFileVersions(attached);setPeople((directoryResult.data || []).sort((a,b)=>relevance(b)-relevance(a)||a.full_name.localeCompare(b.full_name)));setUnits(unitResult.data || []);}
      }catch(failure){if(current){setRows([]);setError(failure.message || "Memos could not be loaded.");}}
      finally{if(current)setLoading(false);}
    })();return()=>{current=false;};
  },[me.id,me.org_id,me.is_admin,reload]);
  useEffect(()=>{
    const refresh=()=>{if(!writing.current && document.visibilityState=== "visible")setReload(n=>n+1);};window.addEventListener("focus",refresh);
    const timer=window.setInterval(refresh,30000);
    return()=>{window.removeEventListener("focus",refresh);window.clearInterval(timer);};
  },[]);
  useEffect(()=>{
    const warn=event=>{if(dirty || pendingFiles.length || reply.trim()){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
  },[dirty,pendingFiles.length,reply]);
  useEffect(()=>{
    if(!selected)return;const serial=++request.current;let current=true;if(detailKey!==selected)setDetailKey("");
    (async()=>{
      try{
        const [m,e]=await Promise.all([
          supabase.from("memos").select("*,memo_versions!memo_versions_memo_id_fkey(*),memo_recipients(*)").eq("id",selected).single(),
          supabase.from("memo_exchanges").select("*").eq("memo_id",selected).order("created_at").order("id"),
        ]);if(m.error)throw m.error;if(e.error)throw e.error;
        const versions=[...(m.data.memo_versions || [])].sort((a,b)=>a.version_no-b.version_no);
        const files=await Promise.all(versions.map(async version=>[version.id,await listOperationalFiles("memo_version",version.id)]));
        if(current && serial===request.current){setDetail({...m.data,versions,exchanges:e.data || [],files:Object.fromEntries(files)});setDetailKey(selected);
          if(projectVersion.current!==m.data.current_version_id){projectVersion.current=m.data.current_version_id;setProjectUnit(m.data.unit_id || "");setProjectName(versions.filter(v=>v.sent_at).at(-1)?.subject || "");setProjectSummary("");}}
        const read=await supabase.rpc("mark_memo_read",{p_id:selected});
        if(read.error && current)setNotice("Memo opened; its read indicator could not be updated.");
        else if(current)setRows(rows=>rows.map(row=>row.id!==selected?row:{...row,memo_recipients:row.memo_recipients.map(recipient=>recipient.profile_id===me.id?{...recipient,last_read_at:m.data.updated_at}:recipient)}));
      }catch(failure){if(current && serial===request.current){setDetail(null);setError(failure.message || "This memo could not be opened.");}}
    })();return()=>{current=false;};
  },[selected,reload]);
  useEffect(()=>{setReply("");responseIntent.current=null;},[selected]);
  useEffect(()=>{if(leaveGuard)leaveGuard.current=canLeave;return()=>{if(leaveGuard)leaveGuard.current=null;};},[dirty,pendingFiles.length,reply,leaveGuard]);
  function canLeave(){return !writing.current && (!(dirty || pendingFiles.length || reply.trim()) || window.confirm("Leave this unsaved message? Save Draft or send your reply first to keep your changes."));}
  function startNew(){if(!canLeave())return;setSelected(null);setForm(fresh());editorVersion.current=null;setDraftFiles([]);setPendingFiles([]);setDirty(false);setError("");setNotice("");}
  function change(key,value){setForm(f=>({...f,[key]:value}));setDirty(true);}
  function editMemo(m){
    if(!canLeave())return;const version=m.versions.find(v=>v.id===m.current_version_id);
    if(!version)return;
    setForm({id:m.id,versionId:version.id,updatedAt:m.updated_at,subject:version.subject,body:version.body,to:m.memo_recipients.filter(r=>r.kind==="to").map(r=>r.profile_id),cc:m.memo_recipients.filter(r=>r.kind==="cc").map(r=>r.profile_id),decisionRequired:m.decision_required,scope:m.decision_scope,unitId:m.unit_id||"",decisionMakerId:m.decision_maker_id||"",revision:m.status==="changes_requested"});
    editorVersion.current=version.sent_at?null:version.id;
    setDraftFiles(version.sent_at ? [] : m.files[version.id] || []);setPendingFiles([]);setDirty(false);setSelected(null);setError("");
  }
  async function persist(send=false){
    if(!form || writing.current)return;writing.current=true;setBusy(true);setError("");setNotice("");
    const savedForm={...form};
    try{
      const result=await supabase.rpc("save_memo_draft",{p_id:savedForm.id,p_version_id:savedForm.versionId,p_subject:savedForm.subject,p_body:savedForm.body,p_to:savedForm.to,p_cc:savedForm.cc,p_decision_required:savedForm.decisionRequired,p_decision_scope:savedForm.scope,p_unit_id:savedForm.unitId||null,p_decision_maker_id:savedForm.decisionRequired?savedForm.decisionMakerId||null:null,p_expected_updated_at:savedForm.updatedAt||null});
      if(result.error)throw result.error;
      if(!result.data?.version_id || !result.data.updated_at)throw new Error("Draft save could not be confirmed. Open Drafts before retrying.");
      const versionId=result.data.version_id;editorVersion.current=versionId;
      setForm(f=>({...f,versionId,updatedAt:result.data.updated_at}));setDirty(false);
      for(const file of pendingFiles){
        await uploadOperationalFile({file,contextType:"memo_version",contextId:versionId,relation:"memo_attachment"});
        setPendingFiles(current=>current.filter(row=>row!==file));
      }
      setDraftFiles(await listOperationalFiles("memo_version",versionId));
      if(send){const delivery=await supabase.rpc("send_memo",{p_id:savedForm.id,p_version_id:versionId});if(delivery.error)throw delivery.error;
        setForm(null);setSelected(savedForm.id);setNotice("Memo sent.");
      }else setNotice("Draft saved.");
      setReload(n=>n+1);
    }catch(failure){
      setError(failure.message || "Memo could not be saved. Your text is retained.");
      // Keep the original optimistic version after a save conflict. Never
      // adopt another editor's timestamp and silently overwrite their work.
      const versionId=editorVersion.current;
      if(versionId){try{setDraftFiles(await listOperationalFiles("memo_version",versionId));}catch{/* retain the original failure */}}
    }finally{writing.current=false;setBusy(false);}
  }
  async function removeFile(file){
    if(writing.current)return;writing.current=true;setBusy(true);setError("");
    try{const result=await supabase.rpc("remove_memo_draft_attachment",{p_link_id:file.link_id});if(result.error)throw result.error;setDraftFiles(current=>current.filter(row=>row.link_id!==file.link_id));}
    catch(failure){setError(failure.message);}finally{writing.current=false;setBusy(false);}
  }
  function format(before,after=before){
    const input=textarea.current;if(!input || !form)return;const start=input.selectionStart,end=input.selectionEnd;
    change("body",form.body.slice(0,start)+before+form.body.slice(start,end)+after+form.body.slice(end));
    requestAnimationFrame(()=>{input.focus();input.setSelectionRange(start+before.length,end+before.length);});
  }
  async function respond(action){
    if(writing.current || !detail || detailKey!==selected)return;
    writing.current=true;setBusy(true);setError("");
    const intentKey=`${detail.id}:${detail.current_version_id}:${action}:${reply}`;
    if(responseIntent.current?.key!==intentKey)responseIntent.current={key:intentKey,id:crypto.randomUUID()};
    try{const result=await supabase.rpc("respond_to_memo",{p_id:detail.id,p_version_id:detail.current_version_id,p_exchange_id:responseIntent.current.id,p_action:action,p_body:reply});if(result.error)throw result.error;setReply("");setReload(n=>n+1);}
    catch(failure){setError(failure.message || "Your response could not be confirmed.");}finally{writing.current=false;setBusy(false);}
  }
  async function createProject(){
    if(writing.current || !detail || !projectUnit)return;
    writing.current=true;setBusy(true);setError("");
    try{const result=await supabase.rpc("create_project_from_memo",{p_id:detail.id,p_version_id:detail.current_version_id,p_lead_unit_id:projectUnit,p_participant_unit_ids:[],p_project_name:projectName,p_project_summary:projectSummary});if(result.error)throw result.error;setNotice("Project created. Budget and implementation authority remain separate.");setReload(n=>n+1);}
    catch(failure){setError(failure.message || "The project could not be confirmed. Retry uses the same memo.");}finally{writing.current=false;setBusy(false);}
  }
  const visible=rows.filter(row=>memoInView(row,view,me.id)).filter(row=>row.memo_versions?.some(version=>version.subject.toLowerCase().includes(query.toLowerCase())));
  const active=detailKey===selected?detail:null;
  const decisions=active ? eligibleMemoDecisionMakers(people,{scope:active.decision_scope,unitId:active.unit_id,to:active.memo_recipients.filter(r=>r.kind==="to").map(r=>r.profile_id),senderId:active.sender_id}):[];
  const canDecide=active?.status==="pending_decision" && active.decision_maker_id===me.id && decisions.some(p=>p.id===me.id);
  const decisionPeople=form ? eligibleMemoDecisionMakers(people,{scope:form.scope,unitId:form.unitId,to:form.to,senderId:me.id}):[];
  const unread=rows.filter(row=>row.memo_recipients.some(r=>r.profile_id===me.id && (!r.last_read_at || new Date(r.last_read_at)<new Date(row.updated_at)))).length;
  return <section className={`memos-workspace ${form ? "is-composing" : ""}`} aria-label="Memos">
    {error && <p className="msg-error" role="alert">{error}<button type="button" disabled={busy} onClick={()=>setReload(n=>n+1)}>Retry loading</button></p>}
    {notice && <p className="msg-notice" role="status">{notice}</p>}
    {form ? <form className="memo-compose" onSubmit={e=>{e.preventDefault();void persist(true);}}>
      <header><button type="button" aria-label="Back to Memos" disabled={busy} onClick={()=>{if(canLeave()){setForm(null);setDirty(false);setPendingFiles([]);setReload(n=>n+1);}}}><ArrowLeft size={18}/></button><div><h2>{form.revision?"Revise Memo":"New Memo"}</h2><small>Formal communication · visible only to selected participants</small></div><button type="button" disabled={busy} onClick={()=>persist(false)}>Save Draft</button><button className="btn" disabled={busy}>{busy?"Saving…":"Send Memo"}</button></header>
      <fieldset disabled={busy}>
        <RecipientPicker label="To" people={people.filter(p=>p.id!==me.id)} value={form.to} excluded={form.cc} disabled={form.revision} onChange={to=>change("to",to)}/>
        <RecipientPicker label="Cc (optional)" people={people.filter(p=>p.id!==me.id)} value={form.cc} excluded={form.to} disabled={form.revision} onChange={cc=>change("cc",cc)}/>
        <label className="memo-subject">Subject<input required maxLength={240} value={form.subject} onChange={e=>change("subject",e.target.value)} placeholder="Enter a clear subject"/></label>
        <label className="memo-decision"><input type="checkbox" checked={form.decisionRequired} disabled={form.revision} onChange={e=>change("decisionRequired",e.target.checked)}/> Decision required</label>
        {form.decisionRequired && <div className="memo-route">
          <label>Proposal scope<select value={form.scope} disabled={form.revision} onChange={e=>change("scope",e.target.value)}><option value="department">Within one department</option><option value="cross_department">Cross-department</option></select></label>
          {form.scope==="department" && <label>Department<select value={form.unitId} disabled={form.revision} onChange={e=>change("unitId",e.target.value)} required={form.scope==="department"}><option value="">Choose department</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>}
          <label>Decision-maker<select required value={form.decisionMakerId} disabled={form.revision} onChange={e=>change("decisionMakerId",e.target.value)}><option value="">Choose an authorised To recipient</option>{decisionPeople.map(person=><option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
          {!decisionPeople.length && <p>Add the appropriate department head or Group Pastor to To. Cc cannot decide.</p>}
        </div>}
        <div className="memo-format" role="toolbar" aria-label="Message formatting"><button type="button" onClick={()=>format("**")}>Bold</button><button type="button" onClick={()=>format("_")}>Italic</button><button type="button" onClick={()=>format("\n• ","")}>List</button></div>
        <label className="memo-writing">Message<textarea ref={textarea} required maxLength={30000} rows={12} value={form.body} onChange={e=>change("body",e.target.value)} placeholder="Write your memo…"/></label>
        <PendingFilePicker files={pendingFiles} onChange={files=>{setPendingFiles(files);setDirty(true);}} label="Attach proposal or documents" disabled={busy}/>
        {draftFiles.map(file=><div className="memo-draft-file" key={file.link_id}><Paperclip size={14}/>{file.filename}{file.state!=="active" && <small>Upload incomplete</small>}<button type="button" onClick={()=>removeFile(file)}>Remove</button></div>)}
        <p className="memo-policy">Proposal approval does not authorise expenditure or project execution. Use the existing Finance, HR and Work processes for their respective approvals.</p>
      </fieldset>
    </form> : <div className={`memo-layout ${selected?"has-selection":""}`}>
      <aside className="memo-directory"><header><h2>Memos {unread>0 && <small>{unread} unread</small>}</h2><button type="button" onClick={startNew} aria-label="New Memo"><Plus size={18}/></button></header>
        <label className="msg-search"><Search size={16}/><input type="search" aria-label="Search Memos" placeholder="Search subjects…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <nav className="memo-filters" aria-label="Memo views">{[["received","Received"],["sent","Sent"],["drafts","Drafts"],["awaiting","Awaiting Decision"],["completed","Completed / Closed"]].map(([key,label])=><button type="button" key={key} aria-current={view===key?"page":undefined} onClick={()=>setView(key)}>{label}</button>)}</nav>
        {loading && <p role="status">Loading Memos…</p>}
        {!loading && !error && !visible.length && <p>No Memos in this view.</p>}
        {visible.map(memo=>{const version=memo.memo_versions.find(v=>v.id===memo.current_version_id)||memo.memo_versions.filter(v=>v.sent_at).sort((a,b)=>b.version_no-a.version_no)[0];const unread=memo.memo_recipients.some(r=>r.profile_id===me.id&&(!r.last_read_at||new Date(r.last_read_at)<new Date(memo.updated_at)));return <button className={`memo-row ${selected===memo.id?"selected":""}`} type="button" key={memo.id} onClick={()=>{setSelected(memo.id);setError("");}}><strong>{unread && <span aria-label="Unread">● </span>}{version?.subject || "Untitled draft"}{fileVersions.has(version?.id) && <Paperclip size={13} aria-label="Has attachments"/>}</strong><small>{memo.sender_id===me.id?`To: ${memo.memo_recipients.filter(r=>r.kind==="to").map(r=>name(r.profile_id)).join(", ")}`:name(memo.sender_id)}</small><span><time>{messageTimestamp(memo.updated_at)}</time><b>{MEMO_STATUS_LABELS[memo.status]}</b></span></button>;})}
        {rows.length===200 && <p>Showing the 200 most recently updated Memos.</p>}
      </aside>
      <article className="memo-reader" data-reading={active ? "" : undefined}>
        {selected && !active && !error && <p role="status">Opening Memo…</p>}
        {!selected && <div className="msg-empty"><h2>Your correspondence</h2><p>Read a Memo or create one to share a proposal, recommendation or document.</p></div>}
        {active && <>
          <header><button type="button" aria-label="Back to Memo list" onClick={()=>setSelected(null)}><ArrowLeft size={18}/></button><h2>{active.versions.filter(v=>v.sent_at).at(-1)?.subject || active.versions.at(-1)?.subject || "Untitled draft"}</h2><span className="memo-status">{MEMO_STATUS_LABELS[active.status]}</span></header>
          <div className="memo-document">
            <div className="memo-parties"><span className="msg-avatar" aria-hidden="true">{initials(name(active.sender_id))}</span><div><strong>{name(active.sender_id)}</strong><small>Created {messageTimestamp(active.created_at)}</small></div><div><small>To</small>{active.memo_recipients.filter(r=>r.kind==="to").map(r=>name(r.profile_id)).join(", ")}</div><div><small>Cc</small>{active.memo_recipients.filter(r=>r.kind==="cc").map(r=>name(r.profile_id)).join(", ") || "—"}</div></div>
            {active.versions.filter(v=>v.sent_at || active.sender_id===me.id).map(version=><section className="memo-version" key={version.id}>
              {active.versions.length>1 && <><h3>Version {version.version_no} · {version.sent_at?messageTimestamp(version.sent_at):"Unsent draft"}</h3><h4>{version.subject}</h4></>}
              <MemoBody body={version.body}/><OperationalMediaList files={active.files[version.id] || []}/>
            </section>)}
            {active.exchanges.length>0 && <section className="memo-history" aria-label="Replies and decision history"><h3>Replies and decisions</h3>{active.exchanges.map(exchange=><div key={exchange.id}><strong>{name(exchange.author_id)} · {exchange.kind==="reply"?"Reply":MEMO_STATUS_LABELS[exchange.kind]}</strong><small>{messageTimestamp(exchange.created_at)} · Version {active.versions.find(v=>v.id===exchange.version_id)?.version_no}</small><MemoBody body={exchange.body}/></div>)}</section>}
          </div>
          <div className="memo-response">
            {active.sender_id===me.id && ["draft","changes_requested"].includes(active.status) && <button className="btn" type="button" onClick={()=>editMemo(active)}>{active.status==="draft"?"Continue draft":"Prepare revision"}</button>}
            {canDecide && <div className="memo-actions"><strong>Actions</strong><button type="button" className="btn" disabled={busy} onClick={()=>respond("approved")}>Approve proposal</button><button type="button" disabled={busy||!reply.trim()} onClick={()=>respond("changes_requested")}>Request changes</button><button type="button" disabled={busy||!reply.trim()} onClick={()=>respond("declined")}>Decline</button><small>Add a reason when requesting changes or declining.</small></div>}
            {!["draft","closed","declined"].includes(active.status) && <>
              <label>Reply or clarification<textarea rows={3} maxLength={30000} value={reply} disabled={busy} onChange={e=>setReply(e.target.value)}/></label><button className="btn" type="button" disabled={busy||!reply.trim()} onClick={()=>respond("reply")}>Send reply</button>
              {active.sender_id===me.id && !active.decision_required && <button type="button" disabled={busy} onClick={()=>respond("closed")}>Close correspondence</button>}
            </>}
          </div>
          {active.status==="approved" && <div className="memo-project"><p>Approved in principle. Budget approval and implementation authority remain separate.</p>{active.project_id?<button type="button" onClick={()=>openProject?.(active.project_id)}>Open linked project</button>:canCreateProject && <><label>Project title<input value={projectName} maxLength={240} onChange={e=>setProjectName(e.target.value)}/></label><label>Shareable project summary<textarea rows={3} maxLength={4000} value={projectSummary} onChange={e=>setProjectSummary(e.target.value)}/></label><p>The project title and summary will be visible to authorised project participants. The original Memo and attachments remain restricted.</p><label>Project lead department<select value={projectUnit} onChange={e=>setProjectUnit(e.target.value)}><option value="">Choose department</option>{units.filter(u=>active.decision_scope!=="department"||u.id===active.unit_id).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><button type="button" disabled={busy||!projectUnit||!projectName.trim()} onClick={createProject}>Create project from approved Memo</button></>}</div>}
        </>}
      </article>
    </div>}
  </section>;
}
