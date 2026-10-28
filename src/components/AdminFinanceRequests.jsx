import {useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {expenseAmountMinor} from '../lib/expenseAmount';
import {FieldGroup,ProductNotice} from './bits';
import {Button,ComposerDrawer} from '../experience-v2/components';

const currencies=['GHS','USD','GBP','EUR','NGN','ZAR','CAD'];
export default function AdminFinanceRequests({me,units}){
 const [mode,setMode]=useState(null),[draft,setDraft]=useState(null),[rows,setRows]=useState([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef(false),mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function openHistory(){
  setMode('history');setBusy(true);setError('');
  try{
   const result=await supabase.from('finance_requests').select('id,title,unit_id,amount_minor,currency,state,needed_by,independent_path,created_at').eq('org_id',me.org_id).eq('requested_by',me.id).order('created_at',{ascending:false});
   if(result.error)throw result.error;
   if(mounted.current)setRows(result.data||[]);
  }catch(e){if(mounted.current)setError(e.message||'Your funds requests could not be loaded.');}
  finally{if(mounted.current)setBusy(false);}
 }
 function start(){
  setDraft({id:crypto.randomUUID(),unitId:units[0]?.id||'',title:'',amount:'',currency:'GHS',reason:'',neededBy:''});
  setError('');setNotice('');setMode('create');
 }
 async function submit(){
  const amount=expenseAmountMinor(draft?.amount);
  if(pending.current||busy||!me.is_admin||!draft?.title.trim()||!amount||!units.some(u=>u.id===draft.unitId))return;
  pending.current=true;setBusy(true);setError('');
  try{
   const result=await supabase.from('finance_requests').insert({id:draft.id,org_id:me.org_id,unit_id:draft.unitId,requested_by:me.id,title:draft.title.trim(),amount_minor:amount,currency:draft.currency,justification:draft.reason.trim()||null,needed_by:draft.neededBy||null}).select('id,state,independent_path').single();
   if(!mounted.current)return;
   if(result.error)throw result.error;
   if(result.data?.id!==draft.id||result.data.state!=='submitted'||JSON.stringify(result.data.independent_path)!==JSON.stringify(['finance','exec']))throw new Error('The independent request could not be confirmed. Check My funds requests before retrying.');
   setMode(null);setDraft(null);setNotice('Funds request submitted to Finance, then the Group Pastor.');
  }catch(e){if(mounted.current)setError(e.message||'The funds request could not be confirmed. Check My funds requests before retrying.');}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 const change=(key,value)=>setDraft(current=>({...current,[key]:value}));
 return <>
  <div className="ev2fin-actions">
   {units.length>0&&<Button icon="create" onClick={start}>Request funds</Button>}
   <Button variant="secondary" onClick={openHistory}>My funds requests</Button>
  </div>
  {notice&&<p role="status" className="screen-note">{notice}</p>}
  {mode==='create'&&draft&&<ComposerDrawer open title="Request funds" description="Finance reviews your request first, then the Group Pastor. You cannot approve your own request." onClose={()=>!busy&&setMode(null)} footer={<Button onClick={submit} disabled={busy||!draft.title.trim()||!expenseAmountMinor(draft.amount)}>{busy?'Submitting…':'Submit request'}</Button>}>
   {error&&<ProductNotice tone="error" title="Funds request not confirmed">{error}</ProductNotice>}
   <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
    <FieldGroup label="Department"><select className="field" aria-label="Request department" value={draft.unitId} onChange={e=>change('unitId',e.target.value)}>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></FieldGroup>
    <FieldGroup label="What the money is for"><input className="field" aria-label="Funds request title" value={draft.title} onChange={e=>change('title',e.target.value)}/></FieldGroup>
    <div className="finance-request-amount">
     <FieldGroup label="Amount"><input className="field" aria-label="Funds request amount" inputMode="decimal" value={draft.amount} onChange={e=>change('amount',e.target.value)}/></FieldGroup>
     <FieldGroup label="Currency"><select className="field" aria-label="Funds request currency" value={draft.currency} onChange={e=>change('currency',e.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></FieldGroup>
    </div>
    <FieldGroup label="Why it is needed (optional)"><textarea className="field" aria-label="Funds request context" rows={3} value={draft.reason} onChange={e=>change('reason',e.target.value)}/></FieldGroup>
    <FieldGroup label="Needed by (optional)"><input className="field" aria-label="Funds request needed by" type="date" value={draft.neededBy} onChange={e=>change('neededBy',e.target.value)}/></FieldGroup>
   </fieldset>
  </ComposerDrawer>}
  {mode==='history'&&<ComposerDrawer open title="My funds requests" onClose={()=>!busy&&setMode(null)}>
   {busy?<p role="status">Loading your requests…</p>:error?<ProductNotice tone="error" title="Requests unavailable" action={<Button onClick={openHistory}>Try again</Button>}>{error}</ProductNotice>:rows.length?rows.map(row=><article className="row" key={row.id}><div className="row-t">{row.title}</div><div className="row-m">{row.currency} {(Number(row.amount_minor)/100).toLocaleString('en-GH',{minimumFractionDigits:2,maximumFractionDigits:2})} · {row.state}</div>{row.independent_path&&<p className="screen-note">Finance → Group Pastor</p>}</article>):<p className="screen-note">You have no recorded funds requests.</p>}
  </ComposerDrawer>}
 </>;
}
