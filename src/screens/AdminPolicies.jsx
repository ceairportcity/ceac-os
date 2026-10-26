import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, LoadingState, ProductNotice } from "../components/bits";
import { Button, ComposerDrawer, DataPanel, MotionDisclosure, QueueRow, StatePanel, StatusBadge } from "../experience-v2/components";
import { humanError } from "../lib/productLanguage";

function formatValue(def, value) {
  if (value === null || value === undefined) return "Not configured";
  if (def?.value_type === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function AdminPolicies({ me }) {
  const [defs,setDefs]=useState([]);
  const [versions,setVersions]=useState([]);
  const [selected,setSelected]=useState(null);
  const [value,setValue]=useState("");
  const [effectiveOn,setEffectiveOn]=useState(new Date().toISOString().slice(0,10));
  const [reason,setReason]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(null);
  const [notice,setNotice]=useState(null);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [revisionOpen,setRevisionOpen]=useState(false);
  const mutationBusy=useRef(false);

  useEffect(()=>{ load(); },[me.id]);

  async function load(){
    setLoading(true); setError(null);
    const [d,v]=await Promise.all([
      supabase.from("policy_rule_definitions").select("*").eq("active",true).order("domain").order("label"),
      supabase.from("policy_rule_versions").select("*").eq("org_id",me.org_id).order("effective_on",{ascending:false}).order("recorded_at",{ascending:false}),
    ]);
    const e=d.error||v.error;
    if(e){setError(humanError(e,"Policies and rules could not load.")); setLoading(false); return;}
    setDefs(d.data||[]); setVersions(v.data||[]);
    if(!selected && d.data?.length) setSelected(d.data[0].rule_key);
    setLoading(false);
  }

  const def=defs.find((item)=>item.rule_key===selected)||null;
  const history=versions.filter((item)=>item.rule_key===selected);
  const today=new Date().toISOString().slice(0,10);
  const current=history.find((item)=>item.effective_on<=today)||null;

  async function save(){
    if(mutationBusy.current||busy||loading||!def||!reason.trim()||value==="") return;
    let jsonValue;
    if(["integer","numeric"].includes(def.value_type)){
      jsonValue=Number(value);
      if(!value.trim()||!Number.isFinite(jsonValue)||(def.value_type==="integer"&&!Number.isSafeInteger(jsonValue))||(def.min_numeric!=null&&jsonValue<Number(def.min_numeric))||(def.max_numeric!=null&&jsonValue>Number(def.max_numeric))){setError("Enter a valid value within this rule’s recorded limits. Whole-number rules cannot contain a decimal.");return;}
    }
    else if(def.value_type==="boolean") jsonValue=value==="true";
    else jsonValue=value;
    if(!effectiveOn){setError("Choose the date when this rule should take effect.");return;}
    mutationBusy.current=true;
    setBusy(true); setError(null); setNotice(null);
    const {error:insertError}=await supabase.from("policy_rule_versions").insert({
      org_id:me.org_id,rule_key:def.rule_key,value:jsonValue,effective_on:effectiveOn,
      reason:reason.trim(),recorded_by:me.id,
    });
    mutationBusy.current=false;
    setBusy(false);
    if(insertError){setError(humanError(insertError,"The rule version could not be recorded.")); return;}
    setReason(""); setValue(""); setRevisionOpen(false); setNotice("Policy rule recorded."); await load();
  }

  if(loading) return <div className="body"><LoadingState label="Loading policies and rules…" /></div>;

  return <div className="body">
    <div style={{paddingTop:26}}>
      <div className="eyebrow">Control Center</div>
      <h1 className="h1">Organisation rules</h1>
      <p className="screen-note">Review CEAC’s rules and record an updated version when a rule changes. Earlier versions stay in history.</p>
    </div>
    {error&&<ProductNotice tone="error" title="Policies & rules">{error}</ProductNotice>}
    {notice&&<ProductNotice tone="success" title="Policy updated">{notice}</ProductNotice>}

    <div className="split" style={{marginTop:18}}>
      <div className="main-col">
        <DataPanel eyebrow="Settings" title="Choose a rule" supporting="Select a rule to see its current value, effective date and history." action={<StatusBadge tone="neutral" icon={false}>{defs.length} active</StatusBadge>}>
          {defs.map((item)=>{
            const rows=versions.filter((v)=>v.rule_key===item.rule_key);
            const latest=rows.find(item=>item.effective_on<=today)||null;
            return <QueueRow key={item.rule_key} icon="settings" title={item.label}
              meta={`${item.domain} · ${formatValue(item,latest?.value)}${latest?" · effective "+latest.effective_on:""} · ${item.description}`}
              status={selected===item.rule_key?"Selected":undefined} statusTone="action"
              onClick={()=>{setSelected(item.rule_key);setHistoryOpen(false);setRevisionOpen(false);}} />;
          })}
          {!defs.length&&<StatePanel state="empty" title="No policy definitions" description="No policy definitions are active." />}
        </DataPanel>
      </div>

      <div className="side-col">
        <DataPanel eyebrow="Selected rule" title={def?.label||"Rule settings"} supporting={def?.description||"Choose a rule from the catalogue."}
          action={def?<Button size="compact" onClick={()=>setRevisionOpen(true)}>Record new version</Button>:null}>
          {def?<><div className="small">Current: {formatValue(def,current?.value)}</div><div className="small">Effective: {current?.effective_on||"Not recorded"}</div><div className="small">Reason: {current?.reason||"Not recorded"}</div></>:<StatePanel state="info" title="Choose a rule" description="Select a rule to inspect its current version." />}
        </DataPanel>

        <DataPanel eyebrow="History" title="Version history" supporting="Older versions remain attributable and are collapsed until needed.">
          <Button variant="quiet" size="compact" disabled={!def} onClick={()=>setHistoryOpen((open)=>!open)}>{historyOpen?"Hide version history":"Show version history"}</Button>
          <MotionDisclosure open={historyOpen} ariaLabel="Policy version history">
            {history.slice(0,10).map((item)=><QueueRow key={item.id} icon="history" title={formatValue(def,item.value)}
              meta={`Effective ${item.effective_on} · ${item.reason}`} status={item.effective_on>today?"Scheduled":item.id===current?.id?"Current":"Previous"} statusTone={item.id===current?.id?"success":"neutral"} />)}
            {!history.length&&<StatePanel state="empty" title="No version history" description="No version has been recorded for this rule yet." />}
          </MotionDisclosure>
        </DataPanel>
      </div>
    </div>

    <ComposerDrawer open={revisionOpen} onClose={()=>!busy&&setRevisionOpen(false)} title="Record new policy version"
      description={def ? "Update the rule for " + def.label + ". Existing versions are preserved." : "Record a new version of this rule."}
      footer={<><Button variant="secondary" disabled={busy} onClick={()=>setRevisionOpen(false)}>Cancel</Button><Button busy={busy} disabled={!def||value===""||!reason.trim()} onClick={save}>{busy?"Recording…":"Record new version"}</Button></>}>
      {def&&<>
        <FieldGroup label="New value">
          {def.value_type==="boolean"
            ? <select className="field" aria-label="Policy rule value" value={value} onChange={(e)=>setValue(e.target.value)}><option value="">Choose</option><option value="true">Yes</option><option value="false">No</option></select>
            : <input className="field" aria-label="Policy rule value" type={def.value_type==="text"?"text":"number"} value={value} min={def.min_numeric??undefined} max={def.max_numeric??undefined} onChange={(e)=>setValue(e.target.value)} />}
        </FieldGroup>
        <FieldGroup label="Effective date"><input className="field" aria-label="Policy effective date" type="date" value={effectiveOn} onChange={(e)=>setEffectiveOn(e.target.value)} /></FieldGroup>
        <FieldGroup label="Reason"><textarea className="field" aria-label="Policy reason" rows="3" value={reason} onChange={(e)=>setReason(e.target.value)} /></FieldGroup>
      </>}
    </ComposerDrawer>
  </div>;
}
