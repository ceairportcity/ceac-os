import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Button,
  DataPanel,
  Skeleton,
  StatePanel,
  StatusBadge,
  Surface,
} from "../experience-v2/components";
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

function statusTone(status){
  if(status===STATUSES.ready) return "success";
  if(status===STATUSES.attention) return "warning";
  if(status===STATUSES.partial) return "action";
  return "neutral";
}

function DomainCard({title,description,status,detail,actions=[]}){
  return <DataPanel
    title={title}
    action={<StatusBadge tone={statusTone(status)} icon={false}>{status}</StatusBadge>}
    className="control-card ev2-control-card"
  >
    <p className="screen-note" style={{marginTop:0}}>{detail}</p>
    {actions.length ? <div style={{display:"flex",gap:"var(--ev2-space-2)",flexWrap:"wrap"}}>
      {actions.map((action)=><Button
        key={action.label}
        variant="quiet"
        size="compact"
        onClick={action.onClick}
      >{action.label}</Button>)}
    </div> : null}
  </DataPanel>;
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
        rosterResult,
        invitesResult,
        checksResult,
        leavePolicyResult,
        payrollResult,
        providersResult,
        connectorsResult,
        auditResult,
      ]=await Promise.all([
        must(supabase.from("office_locations").select("id,name").eq("is_primary",true).limit(1).maybeSingle(),"Office"),
        must(supabase.from("units").select("id,name").eq("org_id",me.org_id).eq("active",true).order("name"),"Units"),
        must(supabase.from("unit_memberships").select("unit_id,profile_id").eq("org_id",me.org_id).eq("role","manager"),"Unit Heads"),
        must(supabase.rpc("admin_employee_roster_summary"),"Employee roster"),
        must(supabase.from("pending_invitations").select("id,unit_id").is("resolved_at",null).gt("expires_at",new Date().toISOString()),"Pending invitations"),
        must(supabase.from("workflow_run_steps").select("id,required_capability").eq("org_id",me.org_id).eq("state","ready").limit(100),"Waiting checks"),
        must(supabase.from("leave_policy_versions")
          .select("id,name,state,confirmed_at,leave_policy_rules(id,complete,approval_route,entitlement_amount,entitlement_unit,accrual_method,carryover_method)")
          .eq("org_id",me.org_id).eq("state","active").order("confirmed_at",{ascending:false}).limit(1).maybeSingle(),"Leave policy"),
        canPayroll
          ? must(supabase.rpc("payroll_readiness_summary"),"Payroll readiness")
          : Promise.resolve({data:null}),
        canIntegrations
          ? must(supabase.from("integration_provider_definitions").select("provider_key,display_name").eq("active",true),"Integration providers")
          : Promise.resolve({data:[]}),
        canIntegrations
          ? must(supabase.from("integration_connectors").select("id,provider_key,connection_state,last_error_message").eq("org_id",me.org_id),"Integration connections")
          : Promise.resolve({data:[]}),
        canAudit
          ? must(supabase.from("platform_audit_events").select("id,created_at").eq("org_id",me.org_id).order("created_at",{ascending:false}).limit(1),"Audit")
          : Promise.resolve({data:[]}),
      ]);

      if(serial!==loadSerial.current) return;
      setSnapshot({
        office:officeResult.data||null,
        units:unitsResult.data||[],
        heads:headsResult.data||[],
        roster:Array.isArray(rosterResult.data)?rosterResult.data:[],
        invitations:invitesResult.data||[],
        checks:checksResult.data||[],
        leavePolicy:leavePolicyResult.data||null,
        payroll:payrollResult.data||null,
        providers:providersResult.data||[],
        connectors:connectorsResult.data||[],
        audit:auditResult.data||[],
      });
    }catch(loadError){
      if(serial===loadSerial.current) setError(humanError(loadError,"Control Center could not finish loading."));
    }finally{
      if(serial===loadSerial.current) setLoading(false);
    }
  }

  const domains=useMemo(()=>{
    if(!snapshot) return [];

    const headUnitIds=new Set(snapshot.heads.map((row)=>row.unit_id));
    const headlessUnits=snapshot.units.filter((unit)=>!headUnitIds.has(unit.id));
    const peopleGaps=snapshot.roster.filter((person)=>
      person.identity_state==="needs_review"
      || person.employment_type==="not_recorded"
      || !(person.job_title||person.source_position)
      || !(person.units||[]).length
    );

    const organisationStatus=!snapshot.office && headlessUnits.length
      ? STATUSES.attention
      : !snapshot.office || headlessUnits.length
        ? STATUSES.partial
        : STATUSES.ready;

    const peopleStatus=peopleGaps.some((person)=>person.identity_state==="needs_review")
      ? STATUSES.attention
      : peopleGaps.length || snapshot.invitations.length
        ? STATUSES.partial
        : STATUSES.ready;

    const workStatus=snapshot.checks.length ? STATUSES.attention : STATUSES.ready;

    const rules=snapshot.leavePolicy?.leave_policy_rules||[];
    const leaveStatus=!snapshot.leavePolicy
      ? STATUSES.policy
      : !rules.length || rules.some((rule)=>!rule.complete)
        ? STATUSES.partial
        : STATUSES.ready;

    let payrollStatus=STATUSES.restricted;
    let payrollDetail="Payroll preparation and approval require separately assigned access.";
    if(snapshot.payroll){
      const identity=Number(snapshot.payroll.identity_review_count||0);
      const missingComp=Number(snapshot.payroll.compensation_missing_count||0);
      const missingPay=Number(snapshot.payroll.payment_missing_count||0);
      payrollStatus=identity ? STATUSES.attention : (missingComp||missingPay) ? STATUSES.partial : STATUSES.ready;
      payrollDetail=identity
        ? `${identity} employee record${identity===1?"":"s"} need identity review before Payroll is fully ready.`
        : missingComp||missingPay
          ? `${missingComp} compensation record${missingComp===1?"":"s"} and ${missingPay} payment detail${missingPay===1?"":"s"} are still not recorded.`
          : "Protected compensation and payment readiness is recorded for the active employee roster. Finance remains separate by currency.";
    }

    const governanceStatus=caps.has("authority.manage") ? STATUSES.available : STATUSES.restricted;

    const connectorByProvider=new Map(snapshot.connectors.map((row)=>[row.provider_key,row]));
    const broken=snapshot.connectors.filter((row)=>["needs_reconnect","error"].includes(row.connection_state));
    const connected=snapshot.providers.filter((provider)=>connectorByProvider.get(provider.provider_key)?.connection_state==="connected");
    const integrationsStatus=!canIntegrations ? STATUSES.restricted
      : broken.length ? STATUSES.attention : connected.length ? STATUSES.ready : STATUSES.optional;

    const auditStatus=canAudit ? STATUSES.available : STATUSES.restricted;

    return [
      {
        key:"organisation",
        title:"Organisation",
        description:"Office location and Unit Head configuration.",
        status:organisationStatus,
        detail:[
          snapshot.office ? `Primary office: ${snapshot.office.name||"Recorded"}.` : "Primary office is not configured.",
          headlessUnits.length ? `${headlessUnits.length} active unit${headlessUnits.length===1?"":"s"} have no recorded Unit Head.` : "Every active unit has a recorded Unit Head.",
        ].join(" "),
        actions:[
          {label:"Office settings",onClick:()=>go("office-settings")},
          {label:"Units",onClick:()=>go("units")},
        ],
      },
      {
        key:"people",
        title:"People & access",
        description:"Employee records and invitations here; security permissions are reviewed through one protected Authority workspace.",
        status:peopleStatus,
        detail:peopleGaps.length
          ? `${peopleGaps.length} employee record${peopleGaps.length===1?" needs":"s need"} identity, employment or department details reviewed.`
          : snapshot.invitations.length
            ? `${snapshot.invitations.length} Staff invitation${snapshot.invitations.length===1?" is":"s are"} still pending activation.`
            : "No employee data exception or pending Staff invitation is currently recorded.",
        actions:[
          {label:"People & Access",onClick:()=>go("people")},
          ...(caps.has("authority.manage")?[{label:"Manage permissions",onClick:()=>go("authority")}]:[]),
          ...(caps.has("hr_private.access")?[{label:"Protected HR",onClick:()=>go("protected-hr")}]:[]),
        ],
      },
      {
        key:"work",
        title:"Work & operations",
        description:"Checks and operational workflow state.",
        status:workStatus,
        detail:snapshot.checks.length
          ? `${snapshot.checks.length} authorised check${snapshot.checks.length===1?" is":"s are"} waiting for action.`
          : "No checks are waiting for action.",
        actions:[{label:"Checks & workflows",onClick:()=>go("workflows")}],
      },
      {
        key:"leave",
        title:"Time & Leave",
        description:"Daily workforce context stays separate from advanced schedule and policy setup.",
        status:leaveStatus,
        detail:!snapshot.leavePolicy
          ? "No active leave policy is recorded. Review the rules before assigning entitlements."
          : rules.some((rule)=>!rule.complete)
            ? "A confirmed Leave policy exists, but one or more rules remain incomplete."
            : `Active policy: ${snapshot.leavePolicy.name}. Open Workforce to review its rules.`,
        actions:[{label:"Workforce",onClick:()=>go("attendance")}],
      },
      {
        key:"payroll",
        title:canPayroll ? "Payroll & Finance" : "Finance",
        description:"Protected Payroll readiness and separate financial records.",
        status:canPayroll ? payrollStatus : STATUSES.available,
        detail:canPayroll ? payrollDetail : "View finance records available to your account.",
        actions:[
          ...(canPayroll?[{label:"Payroll",onClick:()=>go("payroll")}]:[]),
          {label:"Finance",onClick:()=>go("finance")},
        ],
      },
      {
        key:"development",
        title:"Reviews & learning",
        description:"Authorised employee development workspaces.",
        status:getAdministrationTools(me).length ? STATUSES.available : STATUSES.restricted,
        detail:"Open the tools assigned to your account. Quarterly leadership scheduling is available in Reports; protected appraisal publication remains an independent HR decision.",
        actions:getAdministrationTools(me).map(tool=>({label:tool.label,onClick:()=>go(tool.key)})),
      },
      {
        key:"governance",
        title:"Security & governance",
        description:"Explicit authority, versioned rules and consequential checks.",
        status:governanceStatus,
        detail:governanceStatus===STATUSES.available
          ? "Review versioned organisation rules. Employee permissions are managed directly through People & Access."
          : "Permission management requires separately assigned access.",
        actions:[
          ...(caps.has("authority.manage")?[{label:"System rules",onClick:()=>go("policies")}]:[]),
        ],
      },
      {
        key:"integrations",
        title:"Integrations",
        description:"Approved provider adapters and server-secured connection state.",
        status:integrationsStatus,
        detail:!canIntegrations
          ? "Integration management is not assigned to this account."
          : broken.length
            ? `${broken.length} connection${broken.length===1?" needs":"s need"} attention or reconnection.`
            : connected.length
              ? `${connected.length} approved app connection${connected.length===1?" is":"s are"} active.`
              : "App connections are optional. Connect an approved app when it is needed.",
        actions:canIntegrations?[{label:"Connected Apps",onClick:()=>go("integrations")}]:[],
      },
      {
        key:"audit",
        title:"Audit & records",
        description:"Append-only consequential history and internal event evidence.",
        status:auditStatus,
        detail:canAudit
          ? snapshot.audit.length
            ? `Latest recorded event: ${new Date(snapshot.audit[0].created_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}.`
            : "No recent events are recorded."
          : "Audit review is not assigned to this account.",
        actions:canAudit?[
          {label:"Audit",onClick:()=>go("audit")},
          {label:"System events",onClick:()=>go("events")},
        ]:[],
      },
    ];
  },[snapshot,caps,canPayroll,canIntegrations,canAudit,go,me]);

  // Non-actionable permission notices used to fill the Control Center with
  // redundant cards. Keep every genuinely actionable domain, including
  // Finance when Payroll is restricted; never create a fake access route.
  const accessibleDomains=domains.filter((domain)=>
    domain.status!==STATUSES.restricted || domain.actions.length>0
  );
  const attention=accessibleDomains.filter((domain)=>[STATUSES.attention,STATUSES.partial,STATUSES.missing,STATUSES.policy].includes(domain.status));
  const visibleDomains=accessibleDomains.filter((domain)=>
    (!attentionOnly || attention.includes(domain)) &&
    (!query.trim() || [domain.title,domain.description,domain.detail,...domain.actions.map(action=>action.label)]
      .some(text=>text.toLowerCase().includes(query.trim().toLowerCase())))
  );

  const domainGroups=[
    {
      key:"organisation",
      eyebrow:"Organisation",
      title:"Organisation & people",
      description:"Durable structure, employee identity and access configuration.",
      domainKeys:["people","organisation"],
    },
    {
      key:"operations",
      eyebrow:"Operations",
      title:"Operational configuration",
      description:"Workflow, Time & Leave and Payroll / Finance readiness.",
      domainKeys:["work","leave","development","payroll"],
    },
    {
      key:"governance",
      eyebrow:"Governance",
      title:"Security, integrations & records",
      description:"Authority, connected systems and append-only evidence.",
      domainKeys:["governance","integrations","audit"],
    },
  ];

  return <div className="body control-center premium-admin-page ev2-control-center">
    <header className="admin-page-header ev2-control-center-header">
      <div>
        <span className="eyebrow">Administration</span>
        <h1 className="h1">Control Center</h1>
        <p className="screen-note">Manage departments, people, policies and system access.</p>
      </div>
      <Button variant="quiet" size="compact" onClick={()=>go("home")}>← Overview</Button>
    </header>

    {error ? <StatePanel
      state="error"
      title="Control Center could not finish loading"
      description={error}
      actionLabel="Try again"
      onAction={load}
    /> : null}

    {loading ? <div style={{display:"grid",gap:"var(--ev2-space-3)"}} role="status" aria-label="Loading Control Center">
      <Surface variant="plain" padding="standard"><Skeleton width="30%" /><Skeleton width="88%" /></Surface>
      <Surface variant="plain" padding="standard"><Skeleton width="34%" /><Skeleton width="92%" /></Surface>
    </div> : null}

    {!loading&&!error ? <>
      <div className="control-settings-toolbar">
        <label>Find a setting
          <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="People, departments, leave, access…" />
        </label>
        <div className="control-settings-views" role="group" aria-label="Settings view">
          <button type="button" aria-pressed={!attentionOnly} onClick={()=>setAttentionOnly(false)}>All settings</button>
          <button type="button" aria-pressed={attentionOnly} onClick={()=>setAttentionOnly(true)}>Needs attention <span>{attention.length}</span></button>
        </div>
      </div>

      <div className="phase5-control-groups">
        {domainGroups.filter(group=>group.domainKeys.some(key=>visibleDomains.some(domain=>domain.key===key))).map((group)=><section className="phase5-control-group" key={group.key} aria-labelledby={`phase5-control-${group.key}`}>
          <header className="phase5-control-group-head">
            <h2 id={`phase5-control-${group.key}`}>{group.title}</h2>
          </header>
          <div className="phase5-control-ledger">
            {group.domainKeys
              .map((key)=>visibleDomains.find((domain)=>domain.key===key))
              .filter(Boolean)
              .map((domain)=><DomainCard key={domain.key}{...domain}/>)}
          </div>
        </section>)}
      </div>
      {!visibleDomains.length && <StatePanel state="empty" title="No settings match" description="Try another search or show all settings." actionLabel="Show all settings" onAction={()=>{setQuery("");setAttentionOnly(false);}} />}
    </> : null}
  </div>;
}
