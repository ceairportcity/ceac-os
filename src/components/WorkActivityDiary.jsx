import { outstandingActivityActions } from "../lib/workCompletion";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { RESPONSIBILITY_STATUS } from "../lib/responsibilityRegister";
import {OperationalFileList, PendingFilePicker} from "./OperationalFiles";
import {uploadOperationalFile} from "../lib/operationalFiles";
import "./WorkActivityDiary.css";

function ghanaDay() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

const states = [
  ["planned", "Planned"],
  ["in_progress", "In progress"],
  ["done", "Done"],
  ["waiting", "Waiting"],
  ["blocked", "Blocked"],
];

/** Source-backed contribution diary. A diary action never completes a parent
 * responsibility, changes formal attendance or self-approves an objective. */
export default function WorkActivityDiary(props) {
  return <ActivityDiary key={`${props.me.org_id}:${props.me.id}:${props.item.id}`} {...props}/>;
}
function ActivityDiary({ me, item, prefillDate = "", prefillRequest = 0, compact = false, routineOccurrences = [] }) {
  const [sourceHistory, setSourceHistory] = useState([]);
  const [completedDiaryScope, setCompletedDiaryScope] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(false);
  const [correctingId, setCorrectingId] = useState(null);
  const [entryKind,setEntryKind] = useState("update");
  const [removingId,setRemovingId] = useState(null);
  const [date, setDate] = useState(ghanaDay);
  const [state, setState] = useState("done");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionOn, setNextActionOn] = useState("");
  const [minutes, setMinutes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [reload, setReload] = useState(0);
  const [files,setFiles]=useState([]);
  const [planNext,setPlanNext]=useState(true);
  const [writeError,setWriteError]=useState("");
  const savedActivity=useRef(null);
  const uploadAttempts=useRef(new Map());
  const submitting = useRef(false);
  const sectionRef = useRef(null);
  const active=useRef(true);
  useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);
  const diaryScope = `${me.org_id}:${me.id}:${item.id}`;
  const verified = completedDiaryScope === diaryScope && !loading && !error && !unavailable;
  const history = verified ? sourceHistory : [];
  const checking = loading || completedDiaryScope !== diaryScope;
  const activeError = completedDiaryScope === diaryScope ? error : "";
  const visibleSuccess = verified ? success : "";
  // Reset the previous identity and its draft before a new scope can submit.
  useEffect(() => {
    setEditor(false); setCorrectingId(null); setEntryKind("update"); setRemovingId(null); setDate(ghanaDay()); setState("done");
    setSummary(""); setOutcome(""); setNextAction(""); setNextActionOn(""); setMinutes(""); setEvidenceUrl("");
    setSuccess(""); setError("");
    setFiles([]);setWriteError("");savedActivity.current=null;uploadAttempts.current.clear();
  }, [me.id, me.org_id, item.id]);
  // Only user-invoked occurrence shortcuts set the entry date; an unrelated
  // rerender or ordinary load never discards an editor's unsaved work.
  useEffect(() => {
    if (!prefillRequest || !/^\d{4}-\d{2}-\d{2}$/.test(prefillDate)) return;
    setCorrectingId(null); setEntryKind("update");
    setDate(prefillDate);
    setState("done");
    setSummary(""); setOutcome(""); setNextAction(""); setNextActionOn(""); setMinutes(""); setEvidenceUrl("");
    setError(""); setSuccess("");
    setEditor(true);
    sectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [prefillRequest, prefillDate]);

  useEffect(() => {
    let current = true;
    setLoading(true); setCompletedDiaryScope("");
    setError("");
    setSourceHistory([]);
    setUnavailable(false);
    (async () => {
      try {
        let all = [];
        let total = null;
        for (let page = 0; page < 20; page++) {
          const start = page * 200;
          const read = await supabase.from("work_activity_records")
            .select("id,org_id,work_item_id,contributor_id,activity_date,activity_state,entry_kind,action_summary,outcome_note,next_action,next_action_on,duration_minutes,evidence_url,supersedes_id,recorded_at,contributor:profiles!work_activity_records_contributor_id_fkey(full_name)", { count: "exact" })
            .eq("org_id", me.org_id).eq("work_item_id", item.id)
            .order("recorded_at", { ascending: false })
            .order("id", { ascending: false })
            .range(start, start + 199);
          if (read.error) throw read.error;
          if (typeof read.count !== "number" || !Array.isArray(read.data))
            throw new Error("Complete activity history could not be confirmed.");
          if (total !== null && total !== read.count)
            throw new Error("Activity history changed during reading. Please refresh.");
          total = read.count;
          all = [...all, ...read.data];
          if (all.length === total) break;
        }
        if (all.length !== total) throw new Error("Activity history is incomplete. Please refresh.");
        if (!current) return;
        const revised = new Set(all.map((row) => row.supersedes_id).filter(Boolean));
        setSourceHistory(all.filter((row) => !revised.has(row.id))
          .sort((a,b) => b.activity_date.localeCompare(a.activity_date) || b.recorded_at.localeCompare(a.recorded_at)));
      } catch (e) {
        if (!current) return;
        const message = String(e?.message || "");
        if (/work_activity_records|PGRST205|42P01/.test(message)) {
          setUnavailable(true);
          setError("Dated activity recording is awaiting its authorised database migration.");
        } else setError(message || "Activity records could not be verified.");
      } finally {
        if (current) { setCompletedDiaryScope(diaryScope); setLoading(false); }
      }
    })();
    return () => { current = false; };
  }, [me.id, me.org_id, item.id, reload]);

  const nextActions = outstandingActivityActions(history);
  const timeline = [
    ...history.map(entry=>({...entry,timelineType:"update"})),
    ...(item.kind==="routine"?routineOccurrences.map(entry=>({
      id:"routine-"+entry.id,timelineType:"routine",entry_kind:"routine",
      activity_date:entry.occurred_on,recorded_at:entry.created_at,
      contributor_id:entry.recorded_by,action_summary:"Routine occurrence recorded",
      activity_state:"done",outcome_note:entry.note,routineValue:entry.value,
    })):[]),
  ].sort((a,b)=>b.activity_date.localeCompare(a.activity_date)
    || String(b.recorded_at||"").localeCompare(String(a.recorded_at||"")));

  const canRecord = verified && (item.assignee_id === me.id || (
    item.visibility !== "private" && item.confidential !== true
  ));

  function correct(entry) {
    if (entry.contributor_id !== me.id || busy || savedActivity.current || !verified) return;
    setCorrectingId(entry.id);
    setPlanNext(false);setFiles([]);setWriteError("");
    setDate(entry.activity_date);
    setState(entry.activity_state); setEntryKind(entry.entry_kind||"update");
    setSummary(entry.action_summary);
    setOutcome(entry.outcome_note || "");
    setNextAction(entry.next_action || "");
    setNextActionOn(entry.next_action_on || "");
    setMinutes(entry.duration_minutes == null ? "" : String(entry.duration_minutes));
    setEvidenceUrl(entry.evidence_url || "");
    setError(""); setSuccess(""); setEditor(true);
  }

  async function save(event) {
    event.preventDefault();
    if (busy || submitting.current || !verified || !canRecord || summary.trim().length < 3 || !date) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setWriteError("");
    setSuccess("");
    try {
      const fields = {
        org_id: me.org_id, work_item_id: item.id, contributor_id: me.id,
        activity_date: date, activity_state: state, entry_kind:entryKind,
        action_summary: summary.trim(),
        outcome_note: outcome.trim() || null,
        next_action: nextAction.trim() || null,
        next_action_on: nextAction.trim() ? nextActionOn || null : null,
        duration_minutes: minutes === "" ? null : Number(minutes),
        evidence_url: evidenceUrl.trim() || null,
        supersedes_id: correctingId || null,
      };
      const write = savedActivity.current ? {data:{id:savedActivity.current},error:null} : await supabase.from("work_activity_records").insert(fields).select("id").single();
      if(!active.current)return;
      if (write.error) throw write.error;
      if (!write.data?.id)
        throw new Error("The save outcome is uncertain. Inspect the activity history before trying again.");
      savedActivity.current=write.data.id;
      const check = await supabase.from("work_activity_records")
        .select("id,org_id,work_item_id,contributor_id,action_summary,activity_date,supersedes_id")
        .eq("id", write.data.id).eq("org_id", me.org_id).eq("work_item_id", item.id).maybeSingle();
      if (check.error || !check.data || check.data.contributor_id !== me.id
        || check.data.action_summary !== fields.action_summary
        || check.data.activity_date !== fields.activity_date
        || (check.data.supersedes_id || null) !== fields.supersedes_id)
        throw new Error("The record cannot be independently confirmed. Refresh before retrying.");
      if(!active.current)return;
      if(planNext && fields.next_action){
        const planned=await supabase.rpc("plan_work_activity_followup",{p_activity_id:write.data.id});
        if(planned.error)throw planned.error;
        if(!active.current)return;
      }
      for(let index=0;index<files.length;index++){
        if(!uploadAttempts.current.has(files[index]))uploadAttempts.current.set(files[index],{});
        try{await uploadOperationalFile({file:files[index],contextType:"work_activity",contextId:write.data.id,relation:"activity_evidence",retryState:uploadAttempts.current.get(files[index])});}
        catch(failure){setFiles(files.slice(index));throw failure;}
        if(!active.current)return;
      }
      savedActivity.current=null;setFiles([]);uploadAttempts.current.clear();
      setSummary(""); setOutcome(""); setNextAction(""); setNextActionOn(""); setMinutes(""); setEvidenceUrl("");
      setCorrectingId(null); setEntryKind("update"); setDate(ghanaDay()); setState("done");
      setSuccess(fields.supersedes_id
        ? "Your activity correction was recorded. The earlier version remains preserved."
        : fields.next_action&&planNext ? "Your activity was recorded. Its follow-up remains in your private plan even when this assignment is finished." : "Your dated activity was recorded.");
      setEditor(false);
      setReload((n) => n + 1);
    } catch (e) {
      setWriteError((savedActivity.current ? "The activity is saved. Retry to finish its follow-up or attachments without recording it again. " : "")+(e?.message || "The activity could not be saved."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const beginUpdate = (activityDate) => {
    setCorrectingId(null); setEntryKind("update"); setDate(activityDate); setState("done"); setSummary(""); setOutcome("");
    setNextAction(""); setNextActionOn(""); setMinutes(""); setEvidenceUrl(""); setFiles([]);
    setPlanNext(true); setWriteError(""); setEditor(true);
  };

  async function removeActivity(entry) {
    if (busy || entry.contributor_id!==me.id || !verified) return;
    setBusy(true);setWriteError("");setSuccess("");
    try {
      const result=await supabase.rpc("remove_own_work_update",{p_activity_id:entry.id});
      if(result.error || result.data!==true) throw result.error||new Error("Removal could not be verified.");
      setRemovingId(null);setSuccess("Entry removed from progress history; audit remains.");
      setReload(n=>n+1);
    }catch(cause){setWriteError(cause.message||"Entry could not be removed.");}
    finally{setBusy(false);}
  }
  const inlineComposer=verified&&canRecord&&!editor&&<div className="s2-progress-inline">
    <label htmlFor="ceac-progress-inline">What have you accomplished?</label>
    <textarea id="ceac-progress-inline" readOnly rows={2} aria-label="Write a work update"
      placeholder="Share an update, result or milestone…" onFocus={()=>beginUpdate(ghanaDay())}/>
    <small>Choose the date and add any supporting evidence as you write.</small>
  </div>;

  return <section ref={sectionRef} className="s2-work-diary" aria-label="Responsibility activity diary">
    {compact && <dl className="s2-work-inspector-facts">
      <div><dt>Work status</dt><dd>{RESPONSIBILITY_STATUS[item.status] || item.status?.replaceAll("_", " ") || "Not recorded"}</dd></div>
      <div><dt>Recorded actions</dt><dd>{verified ? history.length : checking ? "Verifying…" : "Unavailable"}</dd></div>
    </dl>}
    {!compact && <header>
      <div><span className="eyebrow">Your work</span><h3>Progress history</h3>
        <p>Follow your progress, milestones and supporting evidence over time.</p>
      </div>
    </header>}
    {!compact && inlineComposer}
    {editor && verified && <div className="s2-progress-editor-heading"><strong>{correctingId?"Edit progress":"Your progress"}</strong><button type="button" disabled={busy} onClick={()=>setEditor(false)}>Cancel</button></div>}
    {editor && verified && <form className="s2-work-diary-form" onSubmit={save}>
      <fieldset disabled={busy || Boolean(savedActivity.current)} className="s2-work-diary-fields">
      {correctingId && <p className="wide" role="status">Correcting your own activity. The existing dated entry is preserved for the audit trail. Existing private follow-up tasks stay in Calendar; edit them there if needed.</p>}
      <label>Activity date <input type="date" value={date} max={ghanaDay()} onChange={(e) => setDate(e.target.value)} required /></label>
      <p className="wide">Earlier dates, including weekends, are available.</p>
      <label>Progress type<select value={entryKind} onChange={event=>setEntryKind(event.target.value)}>
        <option value="update">Work update</option><option value="milestone">Milestone reached</option>
      </select></label>
      <label>Action state <select value={state} onChange={(e) => setState(e.target.value)}>
        {states.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="wide">{entryKind==="milestone"?"What milestone was reached?":"What did you accomplish?"} <textarea autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={600} minLength={3} required rows={2} placeholder="What did you do?" /></label>
      <label className="wide">What was the result? <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} maxLength={4000} rows={2} placeholder="What happened?" /></label>
      <label className="wide">What happens next? <textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} maxLength={1200} rows={2} /></label>
      <label>Next action date (optional) <input type="date" value={nextActionOn} onChange={e => setNextActionOn(e.target.value)} disabled={!nextAction.trim()} /></label>
      {nextAction.trim()&&<label className="wide"><span><input type="checkbox" checked={planNext} onChange={e=>setPlanNext(e.target.checked)}/> Keep this follow-up in my private plan</span></label>}
      <p className="wide">An update or milestone does not close the responsibility.</p>
      <label>Minutes spent (optional, self-recorded) <input type="number" min={0} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
      <label className="wide">Evidence link (optional, HTTPS) <input type="url" pattern="https://.*" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://" /></label>
      </fieldset>
      <div className="wide"><PendingFilePicker compact files={files} onChange={setFiles} disabled={busy} label="Attach activity files"/></div>
      {writeError&&<p className="wide" role="alert">{writeError}</p>}
      {savedActivity.current&&<button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={()=>{savedActivity.current=null;uploadAttempts.current.clear();setFiles([]);setEditor(false);setWriteError("");setSuccess("The activity is saved. You can plan its next action or attach files from its activity record later.");setReload(n=>n+1);}}>Keep saved activity; finish later</button>}
      <button type="submit" className="btn btn-sm" style={{width:"fit-content"}} disabled={busy || summary.trim().length < 3 || !date}>{busy ? "Saving..." : correctingId ? "Save correction" : "Save work update"}</button>
    </form>}
    {checking && <p role="status">Verifying activity records...</p>}
    {activeError && <p className="s2-work-diary-error" role="alert">{activeError}
      {!unavailable && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReload((n) => n + 1)}>Retry</button>}
    </p>}
    {visibleSuccess && <p role="status">{visibleSuccess}</p>}
    {!compact && verified && history.length > 0 && <div className="s2-work-diary-summary" aria-label="Recorded activity summary">
      <div><span>Progress entries</span><strong>{timeline.length}</strong></div>
      <div><span>Milestones</span><strong>{history.filter(entry=>entry.entry_kind==="milestone").length}</strong></div>
    </div>}
    {verified && nextActions.length > 0 && <div className="s2-work-diary-next-action">
      <span>Recorded next actions</span>{nextActions.map(action => <p key={action.id}>{action.next_action_on ? `${action.next_action_on} · ` : ""}{action.next_action}{action.contributor_id===me.id&&<PlanFollowup activityId={action.id}/>}</p>)}
    </div>}
    {compact && verified && <h3>Progress history</h3>}
    {verified && timeline.length === 0 && <p>No progress yet. Begin writing when work moves forward.</p>}
    {verified && timeline.length > 0 && <ol className="s2-work-diary-timeline">
      {timeline.map((entry) => <li key={entry.id}>
        <div><strong>{entry.action_summary}</strong>{entry.entry_kind==="milestone"&&<small className="s2-progress-milestone">Milestone reached</small>}{entry.timelineType==="routine"&&<small className="s2-progress-milestone">Scheduled routine</small>}
          <small>{entry.activity_date} · {entry.contributor?.full_name || (entry.contributor_id === me.id ? "You" : "Authorised contributor")} · {states.find(([key]) => key === entry.activity_state)?.[1] || entry.activity_state}</small>
        </div>
        {entry.outcome_note && <p>{entry.outcome_note}</p>}{entry.timelineType==="routine"&&entry.routineValue!=null&&<p>Recorded result: {entry.routineValue}</p>}
        {entry.next_action && <p><b>Next{entry.next_action_on ? ` · ${entry.next_action_on}` : ""}:</b> {entry.next_action}</p>}
        {entry.duration_minutes != null && <small>{entry.duration_minutes} minutes self-recorded (not attendance)</small>}
        {entry.evidence_url && <a href={entry.evidence_url} target="_blank" rel="noopener noreferrer">Open evidence ↗</a>}
        {entry.timelineType!=="routine"&&<ActivityFiles entry={entry} canUpload={entry.contributor_id===me.id&&canRecord}/>}
        {entry.supersedes_id && <small>Corrected entry · prior version preserved</small>}
        {entry.timelineType!=="routine"&&entry.contributor_id===me.id&&canRecord&&<details className="s2-progress-menu">
            <summary aria-label={`Options for ${entry.action_summary}`} title="Entry options">⋯</summary>
            <div className="s2-progress-menu-actions">
              <button type="button" disabled={busy||Boolean(savedActivity.current)} onClick={()=>{correct(entry);sectionRef.current?.scrollIntoView?.({behavior:"smooth",block:"start"});}}>Edit entry</button>
              <button type="button" disabled={busy||Boolean(savedActivity.current)} onClick={()=>setRemovingId(entry.id)}>Remove entry</button>
            </div></details>}
          {removingId===entry.id&&<div className="s2-progress-remove" role="group" aria-label="Confirm removal">
            <p>Remove this update from progress history? An audit record remains.</p>
            <button type="button" disabled={busy} onClick={()=>removeActivity(entry)}>Remove</button>
            <button type="button" disabled={busy} onClick={()=>setRemovingId(null)}>Keep</button>
          </div>}
      </li>)}
    </ol>}
    {compact && inlineComposer}
  </section>;
}

function ActivityFiles({entry,canUpload}){
 const [open,setOpen]=useState(false);
 return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary>Activity files</summary>{open&&<OperationalFileList contextType="work_activity" contextId={entry.id} relation="activity_evidence" canUpload={canUpload} title="Activity evidence"/>}</details>;
}
function PlanFollowup({activityId}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const writing=useRef(false);
 async function plan(){
  if(writing.current)return;writing.current=true;setBusy(true);setMessage('');
  try{const result=await supabase.rpc('plan_work_activity_followup',{p_activity_id:activityId});if(result.error)throw result.error;setMessage(result.data?'Available in Calendar → Tasks. Completing the assignment leaves this task open.':'This private follow-up was previously deleted.');}
  catch(e){setMessage(e.message || 'The follow-up could not be planned.');}
  finally{writing.current=false;setBusy(false);}
 }
 return <><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={plan}>{busy?'Saving…':'Keep in my plan'}</button>{message&&<small role="status">{message}</small>}</>;
}
