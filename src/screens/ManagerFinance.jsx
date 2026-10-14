import { useEffect, useMemo, useState } from "react";
import AssistiveTextarea from "../components/AssistiveTextarea";
import { supabase } from "../lib/supabase";
import { Sheet, FieldGroup, ProductNotice, LoadingState, ProgressMeter, EmptyState } from "../components/bits";
import { Button } from "../experience-v2/components";
import { FinanceCurrencyCard, FinancePageHeader, FinanceSection, FinanceFootnote } from "../experience-v2/finance-family/FinanceFamilyV2";
import { humanError } from "../lib/productLanguage";
import FinanceRequestQueue from "../components/FinanceRequestQueue";
import VolunteerExpenseWorkflow from "../components/VolunteerExpenseWorkflow";

const money=(minor,cur)=>`${cur} ${(Number(minor||0)/100).toLocaleString("en-GH",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
function totals(rows){const out={}; rows.forEach(r=>{if(!r.currency)return; out[r.currency]=(out[r.currency]||0)+Number(r.amount_minor||0);}); return out;}
function spendTotals(rows){const out={}; rows.forEach(r=>{if(!r.currency)return; out[r.currency]=(out[r.currency]||0)+(r.reverses_id?-Number(r.amount_minor||0):Number(r.amount_minor||0));}); return out;}
function MoneyLines({title,values,empty,onOpen}){const keys=Object.keys(values).sort(); return <div className="metric"><span>{title}</span>{keys.length?keys.map(k=><button key={k} onClick={()=>onOpen?.(k)} style={{display:"block",width:"100%",textAlign:"left"}}><b style={{fontSize:15,textDecoration:"underline"}}>{money(values[k],k)}</b></button>):<b style={{fontSize:14}}>{empty}</b>}</div>;}

export default function ManagerFinance({me,openProject}){
 const [budgets,setBudgets]=useState([]),[spend,setSpend]=useState([]),[transfers,setTransfers]=useState([]),[projects,setProjects]=useState([]),[positions,setPositions]=useState([]),[operating,setOperating]=useState([]),[requests,setRequests]=useState([]);
 const [error,setError]=useState(null),[loading,setLoading]=useState(true),[drill,setDrill]=useState(null);
 const [financeHandler,setFinanceHandler]=useState(false);
 const [sheet,setSheet]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null);
 const [requestTitle,setRequestTitle]=useState(""),[requestJustification,setRequestJustification]=useState(""),[requestAmount,setRequestAmount]=useState(""),[requestCurrency,setRequestCurrency]=useState("GHS"),[requestNeededBy,setRequestNeededBy]=useState(""),[requestProject,setRequestProject]=useState("");
 const [expenseTitle,setExpenseTitle]=useState(""),[expenseAmount,setExpenseAmount]=useState(""),[expenseCurrency,setExpenseCurrency]=useState("GHS"),[expenseDate,setExpenseDate]=useState(""),[expenseSource,setExpenseSource]=useState(""),[expenseProject,setExpenseProject]=useState("");
 const year=new Date().getFullYear();
 useEffect(()=>{load();},[me.id,me.unit_id]);
 async function load(){
  setLoading(true);setError(null);
  const [b,s,t,p,pos,op,req,u]=await Promise.all([
   supabase.from("budgets").select("id,unit_id,project_id,year,amount_minor,currency,note").eq("unit_id",me.unit_id).eq("year",year),
   supabase.from("spend_lines").select("id,unit_id,project_id,spent_on,description,amount_minor,currency,reverses_id").eq("unit_id",me.unit_id),
   supabase.from("internal_transfers").select("id,from_unit_id,to_unit_id,amount_minor,currency,sent_on,purpose,state,response_note").or(`from_unit_id.eq.${me.unit_id},to_unit_id.eq.${me.unit_id}`),
   supabase.from("projects").select("id,name,lead_unit_id,project_units(unit_id)"),
   supabase.rpc("unit_budget_position",{p_unit_id:me.unit_id,p_year:year}),
   supabase.rpc("unit_operating_position",{p_unit_id:me.unit_id}),
   supabase.from("finance_requests").select("id,project_id,title,justification,amount_minor,currency,needed_by,state,created_at,decided_at,fulfilled_spend_id").eq("unit_id",me.unit_id).order("created_at",{ascending:false}),
   supabase.from("units").select("handles_finance").eq("id",me.unit_id).single()
  ]);
  const e=[b.error,s.error,t.error,p.error,pos.error,op.error,req.error,u.error].find(Boolean); if(e){setError(humanError(e,"Finance could not be loaded."));setLoading(false);return;}
  setBudgets(b.data||[]);setSpend(s.data||[]);setTransfers(t.data||[]);setProjects((p.data||[]).filter(project=>project.lead_unit_id===me.unit_id||(project.project_units||[]).some(row=>row.unit_id===me.unit_id)));setPositions(pos.data||[]);setOperating(op.data||[]);setRequests(req.data||[]);setFinanceHandler(Boolean(u.data?.handles_finance));setLoading(false);
 }

 function amountToMinor(value){
  const clean=String(value||"").trim();
  if(!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole,fraction=""]=clean.split(".");
  const minor=Number(whole)*100+Number((fraction+"00").slice(0,2));
  return Number.isSafeInteger(minor)&&minor>0?minor:null;
 }

 async function createRequest(){
  const amountMinor=amountToMinor(requestAmount);
  if(!requestTitle.trim()||!amountMinor) return;
  setBusy(true);setError(null);setNotice(null);
  try{
   const {error:insertError}=await supabase.from("finance_requests").insert({
    org_id:me.org_id,
    unit_id:me.unit_id,
    project_id:requestProject||null,
    requested_by:me.id,
    title:requestTitle.trim(),
    justification:requestJustification.trim()||null,
    amount_minor:amountMinor,
    currency:requestCurrency,
    needed_by:requestNeededBy||null
   });
   if(insertError) throw insertError;
   setSheet(null);setRequestTitle("");setRequestJustification("");setRequestAmount("");setRequestCurrency("GHS");setRequestNeededBy("");setRequestProject("");
   setNotice("Finance request submitted. It is now waiting for the authorised CEAC decision path.");
   await load();
  }catch(err){setError(humanError(err,"The finance request could not be submitted."));}
  finally{setBusy(false);}
 }

 async function createExpense(){
  const amountMinor=amountToMinor(expenseAmount);
  if(!expenseTitle.trim()||!amountMinor) return;
  setBusy(true);setError(null);setNotice(null);
  try{
   const {error:insertError}=await supabase.from("spend_lines").insert({
    org_id:me.org_id,
    unit_id:me.unit_id,
    project_id:expenseProject||null,
    spent_on:expenseDate||new Date().toISOString().slice(0,10),
    description:expenseTitle.trim(),
    amount_minor:amountMinor,
    currency:expenseCurrency,
    source_note:expenseSource.trim()||null,
    entered_by:me.id
   });
   if(insertError) throw insertError;
   setSheet(null);setExpenseTitle("");setExpenseAmount("");setExpenseCurrency("GHS");setExpenseDate("");setExpenseSource("");setExpenseProject("");
   setNotice("Expense recorded for your unit. The entry is append-only and visible in the audit trail.");
   await load();
  }catch(err){setError(humanError(err,"The expense could not be recorded."));}
  finally{setBusy(false);}
 }
 const unitBudget=useMemo(()=>totals(budgets.filter(x=>!x.project_id)),[budgets]);
 const budgetCurrencies=new Set(Object.keys(unitBudget));
 const planned={},recorded={},committed={},remaining={};
 positions.forEach(row=>{
  if(budgetCurrencies.has(row.currency)) planned[row.currency]=Number(row.budget_minor||0);
  recorded[row.currency]=Number(row.spent_minor||0);
  committed[row.currency]=Number(row.committed_minor||0);
  if(budgetCurrencies.has(row.currency)) remaining[row.currency]=Number(row.remaining_minor||0);
 });
 if(loading)return <div className="body manager-finance ev2-finance-page ev2-finance-manager"><LoadingState label="Loading finance…" /></div>;
 return <div className="body manager-finance ev2-finance-page ev2-finance-manager">
  <FinancePageHeader eyebrow={me.unit_name} title="Finance" description="Your unit’s actual money in, spending, commitments, transfers and budget context. Managers can record their own unit spending; entries remain append-only." />
  <div className="ev2fin-actions"><Button icon="create" onClick={()=>{setSheet("request");setError(null);setNotice(null);}}>Request funds</Button><Button variant="secondary" icon="finance" onClick={()=>{setSheet("expense");setError(null);setNotice(null);}}>Record expense</Button></div>
  {error&&<ProductNotice tone="error" title="Could not complete that">{error}</ProductNotice>}
  {notice&&<ProductNotice tone="success" title="Finance request updated">{notice}</ProductNotice>}
  <div className="manager-finance-positions">
  <FinanceSection eyebrow="Actual records" title="Unit operating position" description="Confirmed incoming transfers, recorded spend and approved commitments for your unit, kept separate by currency.">
  <div className="manager-finance-position-grid">
    {operating.length===0&&<EmptyState compact title="No operating money recorded">Confirmed incoming transfers, spending and approved commitments will build this view automatically.</EmptyState>}
    {operating.map(row=><FinanceCurrencyCard key={"op-"+row.currency} currency={row.currency} contextLabel="Actual records only" facts={[
      {label:"In",value:money(row.in_minor,row.currency),onClick:()=>setDrill({kind:"source",currency:row.currency,title:`Money in · ${row.currency}`})},
      {label:"Out",value:money(row.out_minor,row.currency),onClick:()=>setDrill({kind:"spend",currency:row.currency,title:`Recorded spend · ${row.currency}`})},
      {label:"Committed",value:money(row.committed_minor,row.currency),onClick:()=>setDrill({kind:"committed",currency:row.currency,title:`Approved, not yet spent · ${row.currency}`})},
      {label:"Remaining",value:money(row.remaining_minor,row.currency),onClick:()=>setDrill({kind:"operatingRemaining",currency:row.currency,title:`Operating remaining · ${row.currency}`})},
    ]} />)}
  </div>
  <p className="ev2fin-note">Money in means confirmed transfers received by this unit. Remaining is confirmed money in minus recorded spend minus approved commitments. It is not a bank balance.</p>
  </FinanceSection>

  <FinanceSection eyebrow={String(year)} title="Budget planning position" description="Recorded budget, actual spend and approved commitments. Missing budget is not treated as zero.">
  <div className="manager-finance-position-grid">
    {positions.length===0&&<EmptyState compact title="No finance position recorded">Budgets, spend and approved requests will build this view automatically.</EmptyState>}
    {positions.map(row=>{
      const hasBudget=budgetCurrencies.has(row.currency);
      const plannedValue=hasBudget?Number(row.budget_minor||0):null;
      const spentValue=Number(row.spent_minor||0);
      const committedValue=Number(row.committed_minor||0);
      const remainingValue=hasBudget?Number(row.remaining_minor||0):null;
      return <FinanceCurrencyCard key={row.currency} currency={row.currency} contextLabel={hasBudget?"Budget recorded":"No budget recorded"} facts={[
        {label:"Planned",value:plannedValue===null?"—":money(plannedValue,row.currency),onClick:()=>setDrill({kind:"planned",currency:row.currency,title:`Planned · ${row.currency}`})},
        {label:"Recorded spend",value:money(spentValue,row.currency),onClick:()=>setDrill({kind:"spend",currency:row.currency,title:`Recorded spend · ${row.currency}`})},
        {label:"Committed",value:money(committedValue,row.currency),onClick:()=>setDrill({kind:"committed",currency:row.currency,title:`Approved, not yet spent · ${row.currency}`})},
        {label:"Remaining",value:remainingValue===null?"—":money(remainingValue,row.currency),onClick:()=>setDrill({kind:"remaining",currency:row.currency,title:`Remaining · ${row.currency}`})},
      ]}>{hasBudget&&<ProgressMeter value={spentValue+committedValue} max={plannedValue} label="Spent + approved commitments" detail={money(spentValue+committedValue,row.currency)+" of "+money(plannedValue,row.currency)} />}</FinanceCurrencyCard>;
    })}
  </div>
  {positions.some(row=>!budgetCurrencies.has(row.currency))&&<p className="ev2fin-note">A currency can have recorded spend or an approved request without a recorded budget. Missing budget is not treated as zero.</p>}
  </FinanceSection>
  </div>
  {financeHandler&&<div className="ev2fin-authority"><FinanceRequestQueue me={me} authority="finance" canFulfil title="Requests needing Finance" /></div>}
  {financeHandler&&<VolunteerExpenseWorkflow me={me} view="finance" />}
  {drill&&<div className="ev2fin-drill">
   <div className="sec"><span>{drill.title}</span></div>
   {drill.kind==="source"&&transfers.filter(x=>x.to_unit_id===me.unit_id&&x.state==="confirmed"&&x.currency===drill.currency).map(x=><div className="row" key={"t-"+x.id}><div className="row-t">{money(x.amount_minor,x.currency)} received</div><div className="row-m">{x.sent_on} · {x.purpose}</div><div className="row-note">Confirmed transfer into your unit</div></div>)}
   {(drill.kind==="planned"||drill.kind==="remaining")&&budgets.filter(x=>x.currency===drill.currency).map(x=><div className="row" key={"b-"+x.id}><div className="row-t">{money(x.amount_minor,x.currency)} budget</div><div className="row-m">{x.project_id?"Project budget":"Unit budget"} · {year}</div>{x.note&&<div className="row-note">{x.note}</div>}</div>)}
   {(drill.kind==="spend"||drill.kind==="remaining")&&spend.filter(x=>x.currency===drill.currency).map(x=><div className="row" key={"s-"+x.id}><div className="row-t">{x.description} · {money(x.reverses_id?-Number(x.amount_minor):x.amount_minor,x.currency)}</div><div className="row-m">{x.spent_on}{x.project_id?" · project spend":""}{x.reverses_id?" · correction":""}</div></div>)}
   {(drill.kind==="committed"||drill.kind==="remaining")&&requests.filter(x=>x.currency===drill.currency&&x.state==="approved").map(x=><div className="row" key={"r-"+x.id}><div className="row-t">{x.title} · {money(x.amount_minor,x.currency)}</div><div className="row-m">Approved, not yet spent{x.needed_by?` · needed by ${x.needed_by}`:""}</div></div>)}
   {drill.kind==="remaining"&&<div className="card small">Budget remaining is recorded budget minus recorded spend and approved requests that have not yet been spent.</div>}
   {drill.kind==="operatingRemaining"&&<div className="card small">Operating remaining is confirmed transfers received minus recorded spend and approved commitments for this currency.</div>}
  </div>}
  <details className="finance-section">
   <summary><span>Projects</span><b>${projects.length}</b></summary>
   <div className="finance-section-body">
  {projects.map(p=>{const pb=totals(budgets.filter(x=>x.project_id===p.id));const ps=spendTotals(spend.filter(x=>x.project_id===p.id));const pc=totals(requests.filter(x=>x.project_id===p.id&&x.state==="approved"));const keys=[...new Set([...Object.keys(pb),...Object.keys(pc),...Object.keys(ps)])].sort();return <button key={p.id} className="row" onClick={()=>openProject(p.id)} style={{width:"100%",textAlign:"left"}}>
   <div className="row-t">{p.name}</div>
   {keys.length?keys.map(c=><div key={c} className="row-m">{c}: {pb[c]!=null?`planned ${money(pb[c],c)}`:"no budget recorded"} · {pc[c]!=null?`committed ${money(pc[c],c)}`:"no approved commitment"} · {ps[c]!=null?`actual ${money(ps[c],c)}`:"no spend recorded"}</div>):<div className="row-m">No project cost has been recorded.</div>}
  </button>})}
  {projects.length===0&&<div className="card small">No projects are visible for this unit.</div>}
</div>
  </details>
  <details className="finance-section">
   <summary><span>Between departments</span><b>${transfers.length}</b></summary>
   <div className="finance-section-body">
  {transfers.sort((a,b)=>String(b.sent_on).localeCompare(String(a.sent_on))).map(t=><div key={t.id} className="row">
   <div className="row-t">{t.from_unit_id===me.unit_id?"Sent":"Received"} · {money(t.amount_minor,t.currency)}</div>
   <div className="row-m">{t.sent_on} · {t.purpose}</div>
   <div className="row-note">{t.state==="sent"?"Awaiting confirmation":t.state==="disputed"?"Disputed":t.state==="confirmed"?"Confirmed":t.state}</div>
  </div>)}
  {transfers.length===0&&<div className="card small">No transfers involving this unit are visible.</div>}
</div>
  </details>
  <div className="sec"><span>Requests</span><span>{requests.length}</span></div>
  {requests.map(r=><div key={r.id} className="row">
   <div className="row-t">{r.title} · {money(r.amount_minor,r.currency)}</div>
   <div className="row-m">{r.state==="submitted"?"Awaiting decision":r.state==="approved"?"Approved — not yet spent":r.state==="fulfilled"?"Fulfilled":r.state==="declined"?"Declined":r.state==="cancelled"?"Cancelled":r.state}{r.needed_by?` · needed by ${r.needed_by}`:""}</div>
   {r.justification&&<div className="row-note">{r.justification}</div>}
  </div>)}
  {requests.length===0&&<div className="card small">No finance requests are recorded for this unit.</div>}
  <FinanceFootnote>These figures are CEAC OS records, not a bank balance. Managers can add spending only for their own unit; recorded lines cannot be edited or deleted.</FinanceFootnote>

  {sheet==="expense"&&<Sheet onClose={()=>!busy&&setSheet(null)}>
   <div className="eyebrow">Unit spending</div>
   <div className="h2" style={{marginTop:5}}>Record expense</div>
   <p className="screen-note">Record actual spending for {me.unit_name}. This is visible immediately and cannot be edited or deleted later; a correction is a separate reversing entry.</p>
   <FieldGroup label="What was the money spent on"><input className="field" aria-label="Expense description" value={expenseTitle} onChange={e=>setExpenseTitle(e.target.value)} /></FieldGroup>
   <div className="finance-request-amount">
    <FieldGroup label="Amount"><input className="field" aria-label="Expense amount" inputMode="decimal" value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)} /></FieldGroup>
    <FieldGroup label="Currency"><select className="field" aria-label="Expense currency" value={expenseCurrency} onChange={e=>setExpenseCurrency(e.target.value)}>{["GHS","USD","GBP","EUR","NGN","ZAR","CAD"].map(currency=><option key={currency} value={currency}>{currency}</option>)}</select></FieldGroup>
   </div>
   <FieldGroup label="Spent on"><input className="field" aria-label="Expense date" type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)} /></FieldGroup>
   <FieldGroup label="Source record" hint="Receipt, book, mobile-money reference or other traceable source."><input className="field" aria-label="Expense source" value={expenseSource} onChange={e=>setExpenseSource(e.target.value)} /></FieldGroup>
   <FieldGroup label="Project" hint="Optional."><select className="field" aria-label="Expense project" value={expenseProject} onChange={e=>setExpenseProject(e.target.value)}><option value="">General unit spending</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></FieldGroup>
   <button className="btn" style={{marginTop:14}} disabled={busy||!expenseTitle.trim()||!amountToMinor(expenseAmount)} onClick={createExpense}>{busy?"Saving...":"Record expense"}</button>
  </Sheet>}

  {sheet==="request"&&<Sheet onClose={()=>!busy&&setSheet(null)}>
   <div className="eyebrow">Finance request</div>
   <div className="h2" style={{marginTop:5}}>Request funds</div>
   <p className="screen-note">Submit what your unit needs. CEAC OS records the request and the authorised approval workflow handles the decision.</p>
   <FieldGroup label="What the money is for"><input className="field" placeholder="Short request title" value={requestTitle} onChange={e=>setRequestTitle(e.target.value)} /></FieldGroup>
   <FieldGroup label="Why it is needed" hint="Optional context for the decision-maker."><AssistiveTextarea className="field" rows={3} placeholder="Explain the need" value={requestJustification} onChange={e=>setRequestJustification(e.target.value)} /></FieldGroup>
   <div className="finance-request-amount">
    <FieldGroup label="Amount"><input className="field" inputMode="decimal" placeholder="e.g. 850.00" value={requestAmount} onChange={e=>setRequestAmount(e.target.value)} /></FieldGroup>
    <FieldGroup label="Currency"><select className="field" value={requestCurrency} onChange={e=>setRequestCurrency(e.target.value)}>
     {["GHS","USD","GBP","EUR","NGN","ZAR","CAD"].map(currency=><option key={currency} value={currency}>{currency}</option>)}
    </select></FieldGroup>
   </div>
   <FieldGroup label="Project" hint="Optional. Leave blank for a general unit request."><select className="field" value={requestProject} onChange={e=>setRequestProject(e.target.value)}>
    <option value="">No project / general unit request</option>
    {projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}
   </select></FieldGroup>
   <FieldGroup label="Needed by" hint="Optional."><input className="field" type="date" value={requestNeededBy} onChange={e=>setRequestNeededBy(e.target.value)} /></FieldGroup>
   <div className="hint">Amounts are stored in the selected currency. CEAC OS does not convert currencies or treat this request as money already spent.</div>
   <button className="btn" style={{marginTop:14}} disabled={busy||!requestTitle.trim()||!amountToMinor(requestAmount)} onClick={createRequest}>{busy?"Submitting...":"Submit request"}</button>
  </Sheet>}
 </div>;
}
