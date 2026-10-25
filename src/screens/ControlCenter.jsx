import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Skeleton,
  StatePanel,
} from "../experience-v2/components";
import { CeacIcon } from "../experience-v2/icons";
import { humanError } from "../lib/productLanguage";
import "./ControlCenter.css";
import {getAdministrationTools} from "../experience-v2/shell/navigation";

const STATUSES = {
  ready:"Ready",
  attention:"Needs attention",
  partial:"Partly configured",
  missing:"Not configured",
  policy:"Awaiting policy",
  restricted:"Access not assigned",
  optional:"Optional",
  available:"Available",
};

function SettingRow({title,description,status,onClick,icon="settings"}) {
  return <button type="button" className="control-setting-row" onClick={onClick}>
    <CeacIcon name={icon} size="row" decorative/><span className="control-setting-copy"><strong>{title}</strong><span>{description}</span></span>
    {status && <span className="control-setting-status">{status}</span>}
    <span className="control-setting-chevron" aria-hidden="true">›</span>
  </button>;
}

export default function ControlCenter({me,go}){
  const caps=useMemo(()=>new Set(me.capabilities||[]),[me.capabilities]);
  const canPayroll=caps.has("payroll.prepare")||caps.has("payroll.approve");
  const canIntegrations=caps.has("integration.manage");
  const canAudit=caps.has("audit.view");
  const [snapshot,setSnapshot]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [query,setQuery]=useState("");
  const [attentionOnly,setAttentionOnly]=useState(false);
  const loadSerial=useRef(0);

  useEffect(()=>{ load(); return ()=>{loadSerial.current+=1;}; },[me.id,me.org_id,canPayroll,canIntegrations,canAudit]);

  async function must(result,label){
    const resolved=await result;
    if(resolved.error) throw new Error(`${label}: ${resolved.error.message}`);
    return resolved;
  }

  async function load(){
    const serial=++loadSerial.current;
    setLoading(true);
    setError(null);
    setSnapshot(null);
    try{
      const [
        officeResult,
        unitsResult,
        headsResult,
        leavePolicyResult,
        connectorsResult,
      ]=await Promise.all([
        must(supabase.from("office_locations").select("id,name").eq("is_primary",true).limit(1).maybeSingle(),"Office"),
        must(supabase.from("units").select("id,name").eq("org_id",me.org_id).eq("active",true).order("name"),"Units"),
        must(supabase.from("unit_memberships").select("unit_id,profile_id").eq("org_id",me.org_id).eq("role","manager"),"Unit Heads"),
        must(supabase.from("leave_policy_versions")
          .select("id,name,state,confirmed_at,leave_policy_rules(id,complete,approval_route,entitlement_amount,entitlement_unit,accrual_method,carryover_method)")
          .eq("org_id",me.org_id).eq("state","active").order("confirmed_at",{ascending:false}).limit(1).maybeSingle(),"Leave policy"),
        canIntegrations
          ? must(supabase.from("integration_connectors").select("id,provider_key,connection_state,last_error_message").eq("org_id",me.org_id),"Integration connections")
          : Promise.resolve({data:[]}),
      ]);

      if(serial!==loadSerial.current) return;
      setSnapshot({
        office:officeResult.data||null,
        units:unitsResult.data||[],
        heads:headsResult.data||[],
        leavePolicy:leavePolicyResult.data||null,
        connectors:connectorsResult.data||[],
      });
    }catch(loadError){
      if(serial===loadSerial.current) setError(humanError(loadError,"Control Center could not finish loading."));
    }finally{
      if(serial===loadSerial.current) setLoading(false);
    }
  }

  const statusFor = key => {
    if (!snapshot) return null;
    if (key === "departments") return snapshot.units.some(unit=>!snapshot.heads.some(head=>head.unit_id===unit.id)) ? STATUSES.attention : null;
    if (key === "office") return snapshot.office ? null : STATUSES.missing;
    if (key === "leave") return !snapshot.leavePolicy ? STATUSES.policy : !(snapshot.leavePolicy.leave_policy_rules||[]).length || snapshot.leavePolicy.leave_policy_rules.some(rule=>!rule.complete) ? STATUSES.partial : null;
    if (key === "integrations") return snapshot.connectors.some(row=>["needs_reconnect","error"].includes(row.connection_state)) ? STATUSES.attention : null;
    return null;
  };
  const needsReview = key => Boolean(statusFor(key));
  const settings = [
    {group:"Organisation",title:"Departments & reporting",description:"Departments, teams and their heads",key:"departments",icon:"organisation",onClick:()=>go("units")},
    {group:"Workplace",title:"Attendance & locations",description:"Office, duty locations and check-in codes",key:"office",icon:"location",onClick:()=>go("office-settings")},
    {group:"Workplace",title:"Leave rules",description:"Entitlements, balances and approvals",key:"leave",icon:"calendar",onClick:()=>go("office-settings",{setting:"leave"})},
    ...(caps.has("authority.manage")?[
      {group:"Access & rules",icon:"compliance",title:"Access permissions",description:"Who can see, edit and approve",key:"governance",onClick:()=>go("authority")},
      {group:"Access & rules",title:"Organisation rules",description:"Review current rules and record changes",key:"governance",onClick:()=>go("policies")},
    ]:[]),
    {group:"System",icon:"notification",title:"Alerts & reminders",description:"When HR is notified",onClick:()=>go("office-settings",{setting:"alerts"})},
    ...(canIntegrations?[{group:"System",icon:"link",title:"Connected apps",description:"Manage external connections",key:"integrations",onClick:()=>go("integrations")}]:[]),
    ...(canAudit?[
      {group:"System",icon:"record",title:"Activity history",description:"Review who changed what and when",key:"audit",onClick:()=>go("audit")},
      {group:"System",title:"System events",description:"Review recorded system notifications",key:"audit",onClick:()=>go("events")},
    ]:[]),
  ];
  const visibleSettings=settings.filter(item=>(!attentionOnly||needsReview(item.key))&&
    (!query.trim()||[item.title,item.description,item.group].some(value=>value.toLowerCase().includes(query.trim().toLowerCase()))));
  const groups=[...new Set(visibleSettings.map(item=>item.group))];
  const attention=settings.filter(item=>needsReview(item.key));

  return <div className="body control-center premium-admin-page ev2-control-center">
    <header className="admin-page-header ev2-control-center-header">
      <div><h1 className="h1">Control Center</h1><p className="screen-note">Set up how CEAC works.</p></div>
    </header>
    {error?<StatePanel state="error" title="Settings could not load" description={error} actionLabel="Try again" onAction={load}/>:null}
    {loading?<div role="status" aria-label="Loading Control Center"><Skeleton width="80%"/><Skeleton width="60%"/></div>:null}
    {!loading&&!error?<>
      <div className="control-settings-toolbar">
        <label>Find a setting<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search settings…"/></label>
        <div className="control-settings-views" role="group" aria-label="Settings view">
          <button type="button" aria-pressed={!attentionOnly} onClick={()=>setAttentionOnly(false)}>All settings</button>
          <button type="button" aria-pressed={attentionOnly} onClick={()=>setAttentionOnly(true)}>Needs attention <span>{attention.length}</span></button>
        </div>
      </div>
      {attention.length>0&&!attentionOnly?<div className="control-review-notice"><span>Some settings need review</span><button type="button" onClick={()=>setAttentionOnly(true)}>Review</button></div>:null}
      <div className="control-setting-groups">
        {groups.map(group=><section key={group} aria-label={group}><h2>{group}</h2><div className="control-setting-list">
          {visibleSettings.filter(item=>item.group===group).map(item=><SettingRow key={item.title} {...item} status={needsReview(item.key)?statusFor(item.key):null}/>)}
        </div></section>)}
      </div>
      {!visibleSettings.length?<StatePanel state="empty" title="No settings match" description="Try another search or show all settings." actionLabel="Show all settings" onAction={()=>{setQuery("");setAttentionOnly(false);}}/>:null}
      <aside className="control-related-work"><h2>Looking for daily work?</h2>
        <p>Employee records and invitations are in <button type="button" onClick={()=>go("people")}>People & Access</button>. Attendance, schedules and leave requests are in <button type="button" onClick={()=>go("attendance")}>Time & Leave</button>.</p>
        <p>Open <button type="button" onClick={()=>go("finance")}>Finance</button>{canPayroll?<> or <button type="button" onClick={()=>go("payroll")}>Payroll</button></>:null} for financial work.
        {caps.has("hr_private.access")?<> Confidential employee records remain in <button type="button" onClick={()=>go("protected-hr")}>Protected HR</button>.</>:null}</p>
        {caps.has("audit.view")||caps.has("people.manage")||caps.has("authority.manage")?<p><button type="button" onClick={()=>go("workflows")}>Pending decisions</button> contains requests waiting for action.</p>:null}
        {getAdministrationTools(me).length>0?<p>{getAdministrationTools(me).map(tool=><button key={tool.key} type="button" onClick={()=>go(tool.key)}>{tool.label}</button>)} remain separate workspaces.</p>:null}
      </aside>
    </>:null}
  </div>;
}
