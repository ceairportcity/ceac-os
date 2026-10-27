import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { EmptyState, FieldGroup, ProductNotice, Sheet } from "./bits";
import { humanError } from "../lib/productLanguage";
import { QueueRow, byOldest } from "./primitives";

const money=(minor,currency)=>(currency||"GHS")+" "+(Number(minor||0)/100).toLocaleString("en-GH",{minimumFractionDigits:2,maximumFractionDigits:2});

function pathFor(request,rules){
  if(Array.isArray(request.independent_path)&&request.independent_path.length)return request.independent_path;
  const rule=rules.find(row=>row.currency===request.currency);
  if(!rule) return ["finance","exec"];
  if(Number(request.amount_minor)<=Number(rule.admin_limit_minor)) return ["admin"];
  if(Number(request.amount_minor)<=Number(rule.finance_limit_minor)) return ["finance"];
  return ["finance","exec"];
}

function nextAuthority(request,decisions,rules){
  if(request.state!=="submitted") return null;
  const path=pathFor(request,rules);
  const stages=decisions.filter(row=>row.request_id===request.id).map(row=>Number(row.stage||0));
  const next=(stages.length?Math.max(...stages):0)+1;
  return path[next-1]||null;
}

export default function FinanceRequestQueue({me,authority,canFulfil=false,title="Requests needing your decision"}){
  const [requests,setRequests]=useState([]);
  const [decisions,setDecisions]=useState([]);
  const [rules,setRules]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(null);
  const [notice,setNotice]=useState(null);
  const [action,setAction]=useState(null);
  const [note,setNote]=useState("");
  const [spentOn,setSpentOn]=useState(()=>new Date().toISOString().slice(0,10));

  useEffect(()=>{load();},[me.org_id]);

  async function load(){
    setLoading(true);setError(null);
    const [r,d,rule]=await Promise.all([
      supabase.from("finance_requests")
        .select("id,org_id,unit_id,project_id,requested_by,title,justification,amount_minor,currency,needed_by,state,created_at,decided_at,fulfilled_spend_id,independent_path,units(name)")
        .eq("org_id",me.org_id).order("created_at",{ascending:false}).limit(250),
      supabase.from("finance_request_decisions")
        .select("id,request_id,stage,authority,decider_id,decision,note,decided_at")
        .order("decided_at",{ascending:true}).limit(500),
      supabase.from("finance_approval_rules")
        .select("currency,admin_limit_minor,finance_limit_minor")
        .eq("org_id",me.org_id),
    ]);
    const first=[r.error,d.error,rule.error].find(Boolean);
    if(first){setError(humanError(first,"Finance requests could not be loaded."));setLoading(false);return;}
    setRequests(r.data||[]);setDecisions(d.data||[]);setRules(rule.data||[]);setLoading(false);
  }

  const pending=useMemo(()=>byOldest(requests.filter(request=>request.requested_by!==me.id&&!decisions.some(d=>d.request_id===request.id&&d.decider_id===me.id)&&nextAuthority(request,decisions,rules)===authority),"created_at"),[requests,decisions,rules,authority,me.id]);
  const fulfil=useMemo(()=>canFulfil?requests.filter(request=>request.state==="approved"&&!request.fulfilled_spend_id):[],[requests,canFulfil]);

  async function decide(decision){
    if(!action?.request)return;
    if(decision==="declined"&&!note.trim()){setError("Record a reason before declining a finance request.");return;}
    setBusy(true);setError(null);setNotice(null);
    const {data,error:e}=await supabase.rpc("decide_finance_request",{
      p_request_id:action.request.id,
      p_decision:decision,
      p_note:note.trim()||null,
    });
    setBusy(false);
    if(e){setError(humanError(e,"The finance decision could not be recorded."));return;}
    setAction(null);setNote("");
    setNotice(data==="approved"?"Finance request approved.":data?.startsWith("awaiting")?"Your decision was recorded. The request moved to its next authority.":"Finance decision recorded.");
    await load();
  }

  async function fulfilRequest(){
    if(!action?.request||!note.trim())return;
    setBusy(true);setError(null);setNotice(null);
    const {error:e}=await supabase.rpc("fulfil_finance_request",{
      p_request_id:action.request.id,
      p_spent_on:spentOn||null,
      p_source_note:note.trim(),
    });
    setBusy(false);
    if(e){setError(humanError(e,"The approved request could not be recorded as spend."));return;}
    setAction(null);setNote("");setSpentOn(new Date().toISOString().slice(0,10));
    setNotice("Approved request recorded as actual spend.");
    await load();
  }

  if(loading)return <section className="finance-decision-queue"><div className="spin">Loading finance decisions…</div></section>;

  return <section className="finance-decision-queue">
    {error&&<ProductNotice tone="error" title="Finance decision">{error}</ProductNotice>}
    {notice&&<ProductNotice tone="success" title="Finance decision">{notice}</ProductNotice>}

    <div className="sec"><span>{title}</span><span>{pending.length}</span></div>
    {pending.map(request=><div className="finance-request-row" key={request.id}>
      <QueueRow
        since={request.created_at}
        title={request.title}
        meta={(request.units?.name||"Unit") + (request.needed_by?` · needed by ${request.needed_by}`:"")}
        amount={money(request.amount_minor,request.currency)}
        onOpen={()=>{setAction({mode:"decision",request});setNote("");}}
        actions={<button className="btn btn-ghost btn-sm" onClick={()=>{setAction({mode:"decision",request});setNote("");}}>Review</button>}
      />
      {request.justification&&<div className="row-note">{request.justification}</div>}
    </div>)}
    {!pending.length&&<EmptyState compact title="Nothing waiting here">No finance request currently needs this authority.</EmptyState>}

    {canFulfil&&<>
      <div className="sec"><span>Approved, not yet recorded as spend</span><span>{fulfil.length}</span></div>
      {fulfil.map(request=><div className="row finance-fulfil-row" key={request.id}>
        <div className="row-t">{request.title} · {money(request.amount_minor,request.currency)}</div>
        <div className="row-m">{request.units?.name||"Unit"} · approved commitment, not yet actual spend</div>
        <button className="btn btn-sm" style={{marginTop:9}} onClick={()=>{setAction({mode:"fulfil",request});setNote("");setSpentOn(new Date().toISOString().slice(0,10));}}>Record as spent</button>
      </div>)}
      {!fulfil.length&&<div className="card small">No approved request is waiting to become recorded spend.</div>}
    </>}

    {action?.mode==="decision"&&<Sheet onClose={()=>!busy&&setAction(null)}>
      <div className="eyebrow">Finance decision</div>
      <div className="h2">{action.request.title}</div>
      <p className="screen-note">{money(action.request.amount_minor,action.request.currency)} · {action.request.units?.name||"Unit"}. The server will accept this decision only if this authority is next in the configured path.</p>
      <FieldGroup label="Decision note" hint="Required when declining; recommended for approvals.">
        <textarea className="field" rows="4" aria-label="Finance decision note" value={note} onChange={e=>setNote(e.target.value)} />
      </FieldGroup>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button className="btn btn-ghost" disabled={busy||!note.trim()} onClick={()=>decide("declined")}>Decline</button>
        <button className="btn" disabled={busy} onClick={()=>decide("approved")}>{busy?"Recording…":"Approve"}</button>
      </div>
    </Sheet>}

    {action?.mode==="fulfil"&&<Sheet onClose={()=>!busy&&setAction(null)}>
      <div className="eyebrow">Actual spend</div>
      <div className="h2">Record approved request as spent</div>
      <p className="screen-note">{action.request.title} · {money(action.request.amount_minor,action.request.currency)}. This creates the actual spend record and links it back to the approved request.</p>
      <FieldGroup label="Spent on"><input className="field" aria-label="Finance spend date" type="date" value={spentOn} onChange={e=>setSpentOn(e.target.value)} /></FieldGroup>
      <FieldGroup label="Source / evidence reference" hint="Record the receipt, voucher, payment reference or other source record used to verify the spend.">
        <textarea className="field" rows="4" aria-label="Finance spend evidence reference" value={note} onChange={e=>setNote(e.target.value)} />
      </FieldGroup>
      <p className="screen-note">This stores the evidence reference with the ledger entry; it does not imply that an external receipt file was uploaded.</p>
      <button className="btn" style={{marginTop:14}} disabled={busy||!spentOn||!note.trim()} onClick={fulfilRequest}>{busy?"Recording…":"Record actual spend"}</button>
    </Sheet>}
  </section>;
}
