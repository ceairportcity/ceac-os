import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, CalendarDays, Plus, Send, Link2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import {
  currentPlanWeek, shiftPlanDay, isPlanItemDone, planDayLabel, planItemStatus,
  readPlanChanges, readPlanEditor, readPlanItems, readWeeklyPlans, weeklyPlanHref,
} from "../lib/weeklyWorkPlan";
import { useEditorPosition } from "../lib/useEditorPosition";
import { LoadingState, ProductNotice } from "../components/bits";
import "./WeeklyWorkPlan.css";

const blankEditor = { title: "", owner: "", day: "", blocker: "", decision: false };
const titleFor = item => item.work?.title || item.title || "Linked work";
const activeItems = items => items.filter(item => !item.dropped_at);
const needsDecision = item => !item.dropped_at && !item.carried_at && !isPlanItemDone(item) && item.decision_requested && !item.decision_response;
const itemKey = item => item.work_id + ":" + (item.routine_date || "");
const weekLabel = week => planDayLabel(week) + " – " + planDayLabel(shiftPlanDay(week, 6));

function PlanItem({ item, me, canEdit, canCarry, working, onEdit, onDrop, onCarry, onTick, openItem, onAnswer }) {
  const [responding, setResponding] = useState(false);
  const [response, setResponse] = useState("");
  const checked = isPlanItemDone(item);
  const editable = canEdit && !item.dropped_at && (!item.work_id || item.work);
  return <li className="weekly-plan-row">
    {!item.work_id && me.id === item.owner_id && !item.dropped_at && !item.carried_at
      ? <button type="button" className="weekly-tick" aria-label={(checked ? "Undo completion for " : "Complete ") + titleFor(item)}
        aria-pressed={checked} disabled={working} onClick={() => onTick(item, !checked)}>{checked && <Check size={17} />}</button>
      : <span aria-hidden="true" className="weekly-tick weekly-tick-static">{checked ? <Check size={17} /> : item.work_id ? <ChevronRight size={16} /> : "·"}</span>}
    <div className="weekly-row-main">
      {item.work ? <button type="button" className="weekly-source" onClick={() => openItem(item.work_id, item.routine_date)}>{titleFor(item)}</button>
        : <strong>{titleFor(item)}</strong>}
      <small>{item.work?.profiles?.full_name || item.ownerName || (item.work ? "Unassigned" : "Owner unavailable")}
        {item.planned_on && " · " + planDayLabel(item.planned_on)}
        {item.routine_date && item.routine_date !== item.planned_on && " · Occurrence " + planDayLabel(item.routine_date)}</small>
      {item.blocker && <p>{item.blocker}</p>}
      {item.decision_response && <p><strong>Leadership response</strong><br />{item.decision_response}</p>}
      {onAnswer && needsDecision(item) && (responding
        ? <form className="weekly-response" onSubmit={async event => {
          event.preventDefault();
          if (await onAnswer(item, response)) { setResponding(false); setResponse(""); }
        }}>
          <textarea className="field" aria-label="Decision response" required maxLength={1000} value={response} onChange={event => setResponse(event.target.value)} />
          <button type="submit" className="btn btn-sm" disabled={working}>Send response</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResponding(false)}>Cancel</button>
        </form> : <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResponding(true)}>Respond</button>)}
      {canEdit && !item.dropped_at && !item.carried_at && <div className="weekly-row-actions" aria-label="Item actions">
        {editable && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(item)} disabled={working}>Edit</button>}
        {canCarry && !checked && (!item.work_id || (item.work && item.work.status !== "cancelled" && item.routine?.state !== "skipped"))
          && <button type="button" className="btn btn-ghost btn-sm" disabled={working} onClick={() => onCarry(item)}>Carry forward</button>}
        <button type="button" className="btn btn-ghost btn-sm" disabled={working} onClick={() => onDrop(item)}>Remove</button>
      </div>}
    </div>
    <span className="weekly-status" data-attention={needsDecision(item) || undefined}>{planItemStatus(item)}</span>
  </li>;
}

export default function WeeklyWorkPlan({ me, selection, openPlan, openItem, close }) {
  const todayWeek = currentPlanWeek();
  const pastor = me.is_exec && me.job_title?.trim().toLowerCase() === "group pastor";
  const [week, setWeek] = useEditorPosition(me, "weekly-work-plan-week", todayWeek);
  const [data, setData] = useState(null);
  const [editorData, setEditorData] = useState(null);
  const [editor, setEditor] = useState(null);
  const [newUnit, setNewUnit] = useState("");
  const [linkWork, setLinkWork] = useState("");
  const [addMode, setAddMode] = useState("quick");
  const [error, setError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [reload, setReload] = useState(0);
  const writing = useRef(false);
  const viewId = selection === "current" ? null : selection;
  const managed = (me.memberships || []).filter(member => member.role === "manager");
  const scope = [me.org_id, me.id, (me.memberships || []).filter(m => m.role === "manager").map(m => m.unit_id).sort().join(","), viewId || week].join(":");
  const current = data?.scope === scope ? data : null;
  const plan = viewId ? current?.plans[0] : null;
  const isPersonal = Boolean(plan?.owner_id);
  const canEdit = Boolean(plan && (isPersonal ? plan.owner_id === me.id : managed.some(member => member.unit_id === plan.unit_id)));
  const canRespond = Boolean(plan?.shared_at && !canEdit && (pastor || me.is_admin || (isPersonal && managed.some(member => member.unit_id === plan.unit_id))));
  const leadershipViewer = pastor || me.is_admin;
  const canCarry = canEdit && [todayWeek, shiftPlanDay(todayWeek, -7)].includes(plan.week_start);

  useEffect(() => {
    let alive = true;
    setError("");
    setEditor(null);
    setEditorData(null);
    setEditorError("");
    setLinkWork("");
    setAddMode("quick");
    (async () => {
      try {
        const plans = await readWeeklyPlans(supabase, week, viewId);
        const [items, changes] = await Promise.all([
          readPlanItems(supabase, plans),
          viewId && plans.length ? readPlanChanges(supabase, viewId) : [],
        ]);
        if (alive) setData({ scope, plans, items, changes });
        if (viewId && plans.length && (plans[0].owner_id === me.id ||
          (!plans[0].owner_id && managed.some(member => member.unit_id === plans[0].unit_id)))) {
          try {
            const result = await readPlanEditor(supabase, plans[0], me);
            if (alive) setEditorData({ scope, ...result });
          } catch (failure) {
            if (alive) setEditorError(humanError(failure, "Suggestions and department members could not be loaded."));
          }
        }
      } catch (failure) {
        if (alive) setError(humanError(failure, "Weekly plans could not be loaded. Try again."));
      }
    })();
    return () => { alive = false; };
    // The account key remounts the screen when the role or managed unit changes.
  }, [scope, reload]);

  const tool = editorData?.scope === scope ? editorData : null;
  const rows = current?.items || [];
  const linked = new Set(activeItems(rows).filter(row => row.work_id).map(itemKey));
  const carried = new Set(rows.map(row => row.carried_from).filter(Boolean));
  const suggestions = tool?.suggestions.filter(work => !linked.has(work.id + ":" + (work.routine || ""))) || [];
  const lastItems = tool?.lastItems.filter(item => !carried.has(item.id)) || [];
  const optionUnits = managed.filter(member => !current?.plans.some(row => !row.owner_id && row.unit_id === member.unit_id));
  const hasOwnPlan = Boolean(current?.plans.some(row => row.owner_id === me.id));
  const selectedUnit = optionUnits.some(member => member.unit_id === newUnit) ? newUnit : optionUnits[0]?.unit_id;
  const selectedEditor = editor?.scope === scope ? editor : null;
  const live = activeItems(rows);
  const editableWeek = [todayWeek, shiftPlanDay(todayWeek, 7)].includes(week);
  const doneCount = live.filter(isPlanItemDone).length;
  const openCount = live.length - doneCount;
  const availableLinks = tool?.linkable.filter(work => !linked.has(work.id + ":")) || [];

  async function write(action, { planId = plan?.id, itemId = null, values = {} } = {}) {
    if (writing.current) return null;
    writing.current = true;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const { data: result, error: failure } = await supabase.rpc("update_weekly_work_plan", { p_action: action, p_plan: planId || null, p_item: itemId, p_values: values });
      if (failure) throw failure;
      if (!result) throw new Error("The update could not be confirmed.");
      if (action === "share") {
        setNotice("Your plan was shared with its authorised reviewers. The memo has been sent.");
        window.dispatchEvent(new Event("ceac:notifications-changed"));
      }
      if (action === "carry") setNotice("Item carried forward. The original is still visible in its week.");
      setReload(count => count + 1);
      return result;
    } catch (failure) {
      setError(humanError(failure, "The update could not be confirmed. Reload the plan before trying again."));
      return null;
    } finally {
      writing.current = false;
      setWorking(false);
    }
  }

  function startEdit(item = null) {
    setAddMode(item?.work_id ? "linked" : "quick");
    setEditor({ scope, item, id: item?.id || crypto.randomUUID(), ...blankEditor, owner: item?.owner_id || (memberName(me.id) ? me.id : ""),
      title: item?.title || "", day: item?.planned_on || "", blocker: item?.blocker || "", decision: Boolean(item?.decision_requested) });
  }

  async function save(event) {
    event.preventDefault();
    const { item, title, owner, day, blocker, decision } = selectedEditor;
    const result = await write("save", { itemId: item?.id || selectedEditor.id, values: {
      title, owner, day: day || null, blocker, decision, updated_at: item?.updated_at,
    } });
    if (result) { setEditor(null); setLinkWork(""); setAddMode("quick"); }
  }

  function openSuggestion(work) {
    return write("save", { itemId: crypto.randomUUID(), values: { work: work.id, routine: work.routine || null, day: work.day || null } });
  }

  const carry = item => write("carry", { planId: item.plan_id, itemId: item.id });
  const changeEditor = (name, value) => setEditor(previous => ({ ...previous, [name]: value }));
  const memberName = id => tool?.members.find(member => member.profile_id === id)?.profiles.full_name;

  return <div className="body ev2-work-page weekly-work-plan">
    <header className="weekly-page-header">
      <div className="weekly-heading"><button type="button" className="weekly-back" onClick={viewId ? () => { if (plan) setWeek(plan.week_start); openPlan("current"); } : close}><ChevronLeft size={17} /> {viewId ? "Weekly plans" : "Work"}</button>
        <span className="weekly-eyebrow"><CalendarDays size={14} /> WEEKLY WORK</span><h1>{isPersonal ? "My weekly plan" : plan?.units?.name || "This Week"}</h1>
        <p>{weekLabel(plan?.week_start || week)}{plan && (plan.shared_at ? " · Shared" : " · Draft")}</p></div>
      {canEdit && !plan.shared_at && <button type="button" className="weekly-primary-action" disabled={working || !live.length} onClick={() => write("share")}><Send size={16} /> Share plan</button>}
    </header>
    {error && <ProductNotice tone="error" title="Weekly plan update"><p>{error}</p><button className="btn btn-ghost btn-sm" onClick={() => setReload(count => count + 1)}>Reload</button></ProductNotice>}
    {notice && <p role="status" className="weekly-notice">{notice}</p>}
    {!current && !error && <LoadingState label="Loading weekly plans…" />}
    {current && viewId && !plan && <p role="status">This plan is unavailable to your account.</p>}
    {current && !viewId && <>
      <div className="weekly-week-nav" aria-label="Choose a week">
        <button type="button" className="btn btn-ghost btn-sm" aria-label="Previous week" onClick={() => setWeek(shiftPlanDay(week, -7))}><ChevronLeft size={18} /></button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeek(todayWeek)}>Current week</button>
        <button type="button" className="btn btn-ghost btn-sm" aria-label="Next week" onClick={() => setWeek(shiftPlanDay(week, 7))}><ChevronRight size={18} /></button>
      </div>
      {leadershipViewer && <section className="weekly-panel"><h2>Needs your attention</h2>
        {rows.filter(needsDecision).length ? <ul className="weekly-team-list">{rows.filter(needsDecision).map(item => {
          const source = current.plans.find(row => row.id === item.plan_id);
          return <li key={item.id}><a href={weeklyPlanHref(source.id)} onClick={event => {
            if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openPlan(source.id); }
          }}><span><strong>{titleFor(item)}</strong><small>{source.units?.name} · {item.blocker}</small></span><ChevronRight size={18} /></a></li>;
        })}</ul> : <p>No decisions requested for this week.</p>}
      </section>}
      <section className="weekly-panel weekly-plans-panel"><div className="weekly-section-heading"><div><span className="weekly-section-kicker">OVERVIEW</span><h2>{leadershipViewer ? "Weekly plans awaiting review" : "Your weekly plans"}</h2></div>
        {editableWeek && <button type="button" className="weekly-primary-action" disabled={working} onClick={async () => {
          const existing = current?.plans.find(row => row.owner_id === me.id);
          if (existing) { openPlan(existing.id); return; }
          const id = await write("create", { values: { personal: true, unit: me.unit_id || null, week } });
          if (id) openPlan(id);
        }}><Plus size={16} /> {hasOwnPlan ? "Open my plan" : "Create my plan"}</button>}
      </div>
        {current.plans.length ? <ul className="weekly-team-list">{current.plans.map(row => {
          const items = live.filter(item => item.plan_id === row.id);
          const decisions = items.filter(needsDecision).length;
          return <li key={row.id}><a href={weeklyPlanHref(row.id)} onClick={event => {
            if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openPlan(row.id); }
          }}><span><strong>{row.owner_id ? row.owner_id === me.id ? "My weekly plan" : "Personal weekly plan" : row.units?.name || "Department"}</strong><small>{items.filter(isPlanItemDone).length} of {items.length} done
            {decisions ? " · " + decisions + " awaiting decision" : ""}{!row.shared_at && " · Draft"}</small></span><ChevronRight size={18} /></a></li>;
        })}</ul> : <p>{leadershipViewer ? "No plans have been shared for this week." : "No plans yet for this week."}</p>}
        {editableWeek && selectedUnit && <form className="weekly-create" onSubmit={async event => {
          event.preventDefault();
          const id = await write("create", { values: { unit: selectedUnit, week } });
          if (id) openPlan(id);
        }}>
          {optionUnits.length > 1 && <select className="field" aria-label="Department" value={selectedUnit} onChange={event => setNewUnit(event.target.value)}>
            {optionUnits.map(member => <option key={member.unit_id} value={member.unit_id}>{member.units?.name || member.unit_name || "Department"}</option>)}
          </select>}
          <button type="submit" className="weekly-primary-action" disabled={working}><Plus size={16} /> Create plan</button>
        </form>}
      </section>
    </>}
    {plan && <>
      {canEdit && <section className="weekly-panel weekly-build-surface" aria-label="Weekly plan editor">
        <header className="weekly-section-heading">
          <div><h2>{isPersonal ? "Plan your week" : "Plan your team's week"}</h2><p>{isPersonal ? "Set your own priorities, check them off, and share with your manager when ready." : "Add your team's work. You can update it before or after sharing."}</p></div>
          {!editor && <button type="button" className="weekly-primary-action" disabled={working || !tool} onClick={() => startEdit()}><Plus size={16} /> Add work</button>}
        </header>
        {editorError && <ProductNotice tone="error" title="Unable to load department work">{editorError}</ProductNotice>}
        {!tool && !editorError && <p role="status">Loading your department’s assignments…</p>}
        {selectedEditor && <form className="weekly-editor weekly-one-form" onSubmit={async event => {
          event.preventDefault();
          if (!selectedEditor.item && addMode === "linked") {
            if (!linkWork) return;
            const result = await write("save", { itemId: selectedEditor.id, values: {
              work: linkWork, day: selectedEditor.day || null,
              blocker: selectedEditor.blocker, decision: selectedEditor.decision,
            } });
            if (result) { setEditor(null); setLinkWork(""); setAddMode("quick"); }
            return;
          }
          await save(event);
        }}>
          <div className="weekly-editor-heading">
            <strong>{selectedEditor.item ? "Edit planned work" : "Add to weekly plan"}</strong>
            <button type="button" onClick={() => {setEditor(null);setLinkWork("");}} aria-label="Close form"><X size={18}/></button>
          </div>
          {!selectedEditor.item && <fieldset className="weekly-kind-select">
            <legend>Where is this work coming from?</legend>
            <div role="group" aria-label="Work source">
              <button type="button" aria-pressed={addMode === "quick"} className={addMode === "quick" ? "is-active" : ""} onClick={() => setAddMode("quick")}>New checklist item</button>
              <button type="button" aria-pressed={addMode === "linked"} className={addMode === "linked" ? "is-active" : ""} onClick={() => setAddMode("linked")}>Existing assignment</button>
            </div>
          </fieldset>}
          {(selectedEditor.item?.work_id || (!selectedEditor.item && addMode === "linked")) ?
            selectedEditor.item?.work_id ?
              <div className="weekly-linked-name"><Link2 size={16}/><strong>{titleFor(selectedEditor.item)}</strong></div> :
              <label className="weekly-editor-wide">Choose an assignment
                <select className="field" value={linkWork} required onChange={event => setLinkWork(event.target.value)}>
                  <option value="">Select work already assigned to your department</option>
                  {availableLinks.map(work => <option key={work.id} value={work.id}>{work.title}</option>)}
                </select>
              </label>
          : <>
            <label className="weekly-editor-wide">What needs to be done?
              <input className="field" required maxLength={240} placeholder="e.g. Finalise Sunday's production schedule"
                value={selectedEditor.title} onChange={event => changeEditor("title", event.target.value)}/>
            </label>
            {!isPersonal && <label>Who will handle it?
              <select className="field" value={selectedEditor.owner} required onChange={event => changeEditor("owner", event.target.value)}>
                <option value="">Select a team member</option>
                {tool?.members.map(member => <option key={member.profile_id} value={member.profile_id}>{member.profiles.full_name}</option>)}
              </select>
            </label>}
          </>}
          <label>When this week?
            <select className="field" value={selectedEditor.day} onChange={event => changeEditor("day", event.target.value)}>
              <option value="">No specific day</option>
              {Array.from({length:7},(_,i)=>shiftPlanDay(plan.week_start,i)).map(date=><option key={date} value={date}>{planDayLabel(date)}</option>)}
            </select>
          </label>
          <label className="weekly-editor-wide">Notes or help needed <span className="weekly-optional">(optional)</span>
            <textarea className="field" rows={3} maxLength={1000} placeholder="Add useful details for your team"
              required={selectedEditor.decision} value={selectedEditor.blocker} onChange={event => changeEditor("blocker", event.target.value)} />
          </label>
          <label className="weekly-editor-wide weekly-checkbox">
            <input type="checkbox" checked={selectedEditor.decision} onChange={event => changeEditor("decision", event.target.checked)}/>
            <span><strong>Request a leadership decision</strong><small>Direct a question to an authorised manager, Group Pastor or HR reviewer.</small></span>
          </label>
          <div className="weekly-editor-actions">
            <button type="submit" className="weekly-primary-action" disabled={working || !tool || (!selectedEditor.item && addMode === "linked" && !linkWork)}>Save to plan</button>
            <button type="button" className="weekly-secondary-action" onClick={() => {setEditor(null);setLinkWork("");}}>Cancel</button>
          </div>
        </form>}
        {!selectedEditor && live.length === 0 && <p className="weekly-getting-started">Start by adding the first item. You can share the finished plan with its reviewers.</p>}
        {(suggestions.length > 0 || lastItems.length > 0) && <details className="weekly-history weekly-suggestion-drawer">
          <summary>Bring in suggested or unfinished work <span>{suggestions.length + lastItems.length}</span></summary>
          <ul className="weekly-suggestions">
            {suggestions.map(work => <li key={work.id + ":" + (work.routine || "")}><span><strong>{work.title}</strong><small>{planDayLabel(work.day)} · {work.kind === "routine" ? "Routine" : "Due this week"}</small></span>
              <button type="button" className="weekly-secondary-action" disabled={working} onClick={() => openSuggestion(work)}>Add to plan</button></li>)}
            {lastItems.map(item => <li key={item.id}><span><strong>{titleFor(item)}</strong><small>Unfinished from last week</small></span>
              <button type="button" className="weekly-secondary-action" disabled={working} onClick={() => carry(item)}>Carry forward</button></li>)}
          </ul>
        </details>}
      </section>}
      <section className="weekly-panel weekly-commitments"><header className="weekly-section-heading"><div><span className="weekly-section-kicker">WEEKLY CHECKLIST</span><h2>Work to be done</h2></div><span className="weekly-count">{doneCount} of {live.length} complete</span></header>
        {live.length ? <ul className="weekly-plan-list">{live.map(item => <PlanItem key={item.id} item={item} me={me} canEdit={canEdit} canCarry={canCarry} working={working}
          onEdit={startEdit} onDrop={row => write("drop", { itemId: row.id, values: { updated_at: row.updated_at } })} onCarry={carry} openItem={openItem}
          onTick={(row, done) => write("tick", { itemId: row.id, values: { done } })}
          onAnswer={canRespond ? (row, response) => write("answer", { itemId: row.id, values: { note: response } }) : null} />)}</ul>
        : <p>No items in this plan yet.</p>}
      </section>
      {plan.shared_at && <section className="weekly-panel">
        <details className="weekly-history"><summary>Plan as shared</summary><ul>{(plan.original_plan || []).map(item =>
          <li key={item.id}>{item.title || titleFor(rows.find(row => row.id === item.id) || {})} · {planDayLabel(item.planned_on)}</li>)}</ul></details>
        {current.changes.length > 0 && <details className="weekly-history"><summary>Recent changes</summary><ul>{current.changes.map(change => {
          const row = rows.find(item => item.id === change.item_id);
          return <li key={change.id}>{change.action} · {titleFor(row || {})}
            {change.action === "Moved" && ` · ${planDayLabel(change.previous_day)} → ${planDayLabel(change.next_day)}`}</li>;
        })}</ul></details>}
      </section>}
    </>}
  </div>;
}
