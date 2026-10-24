import { Fragment, Suspense, lazy, useEffect, useRef, useState } from "react";
import { leaveStageLabel } from "../lib/leaveDecisionStage";
import { confirmedLeaveSplitRules, hasConfirmedLeaveSplit, leavePoolLabel } from "../lib/leavePools";
import "../final-product/fpg7-people-workforce.css";
import { supabase } from "../lib/supabase";
const AttendanceEvidence = lazy(() => import("../components/AttendanceEvidence"));
import AttendanceCorrectionWorkflow from "../components/AttendanceCorrectionWorkflow";
import AttendanceCodeIssuer from "../components/AttendanceCodeIssuer";
import WorkforceEmployeeScheduleWorkspace from "../components/WorkforceEmployeeScheduleWorkspace";
import TimeLeavePlanner from "../components/TimeLeavePlanner";
import WorkforceTodayReviewList from "../components/WorkforceTodayReviewList";
import { dailyClocks } from "../lib/attendance";
import { accraDayOffset } from "../lib/workforceDate";
import { settleWorkforceDatasets } from "../lib/workforceQueries";
import { isValidPolicyAmount } from "../lib/workforcePolicyNumbers";
import { Avatar, EmptyState, FieldGroup, LoadingState, Pill, ProductNotice, Sheet } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { isMissingAnnualLeaveStageSchema } from "../lib/stage1SchemaCompatibility";
import { Button, SelectField } from "../experience-v2/components";
import {
  WorkforceDecisionRow,
  WorkforceEmpty,
  WorkforceFactGrid,
  WorkforceFootnote,
  WorkforcePageHeader,
  WorkforceRecordRow,
  WorkforceSection,
  WorkforceTabs,
  WorkforceTodayCard,
} from "../experience-v2/workforce-family/WorkforceFamilyV2";

const DAY_KEYS=["sun","mon","tue","wed","thu","fri","sat"];
const DAY_LABELS={sun:"Sun",mon:"Mon",tue:"Tue",wed:"Wed",thu:"Thu",fri:"Fri",sat:"Sat"};
const OWNER_CONFIRMED_LEAVE_KINDS=new Set(["annual","sick","maternity","paternity","study"]);

function isoDay(value){ return new Date(value).toISOString().slice(0,10); }
function niceDay(value){ return new Date(value+"T00:00:00Z").toLocaleDateString("en-GB",{timeZone:"Africa/Accra",weekday:"short",day:"numeric",month:"short"}); }
function human(value=""){ return String(value).replaceAll("_"," ").replace(/\b\w/g,(m)=>m.toUpperCase()); }
function clock(value){
  if(!value) return "Not recorded";
  const date=new Date(value);
  return date.toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"});
}
function metresBetween(aLat,aLng,bLat,bLng){
  const R=6371000,toRad=(d)=>(d*Math.PI)/180;
  const dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng);
  const x=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)));
}

export default function Workforce({ me }) {
  const caps=me.capabilities||[];
  const canManage=caps.includes("workforce.manage");
  const canCorrect=caps.includes("attendance.correct");
  const isManager=me.role==="manager" || (me.managed_units||[]).length>0;
  const isStaffView=!me.is_admin && !me.is_exec && !isManager;
  const isManagerView=!me.is_admin && !me.is_exec && isManager;
  const isAdminView=Boolean(me.is_admin);
  const [tab,setTab]=useState("today");
  const [people,setPeople]=useState([]);
  const [sessions,setSessions]=useState([]);
  const [lastActivity,setLastActivity]=useState([]);
  const [leave,setLeave]=useState([]);
  const [leaveEvents,setLeaveEvents]=useState([]);
  const [dayTypes,setDayTypes]=useState([]);
  const [schedules,setSchedules]=useState([]);
  const [corrections,setCorrections]=useState([]);
  const [policies,setPolicies]=useState([]);
  const [policyRules,setPolicyRules]=useState([]);
  const [office,setOffice]=useState(null);
  const [meetings,setMeetings]=useState([]);
  const [ministryEvents,setMinistryEvents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [datasetErrors,setDatasetErrors]=useState({});
  const [annualWorkingDayReady,setAnnualWorkingDayReady]=useState(true);
  const [notice,setNotice]=useState(null);
  const [busy,setBusy]=useState(false);
  const mutationBusyRef=useRef(false);
  const readGeneration=useRef(0);
  const [calendarUnit,setCalendarUnit]=useState("");
  const [calendarPerson,setCalendarPerson]=useState("");

  const [scheduleSheet,setScheduleSheet]=useState(false);
  const [schedulePerson,setSchedulePerson]=useState("");
  const [scheduleEmployeeFocus,setScheduleEmployeeFocus]=useState("");
  const [sessionProfileFocus,setSessionProfileFocus]=useState("");
  const [scheduleDayType,setScheduleDayType]=useState("");
  const [scheduleDay,setScheduleDay]=useState("mon");
  const [scheduleFrom,setScheduleFrom]=useState(isoDay(new Date()));
  const [scheduleTo,setScheduleTo]=useState("");
  const [scheduleStart,setScheduleStart]=useState("");
  const [scheduleEnd,setScheduleEnd]=useState("");
  const [scheduleReason,setScheduleReason]=useState("");


  const [dayTypeSheet,setDayTypeSheet]=useState(false);
  const [dayTypeName,setDayTypeName]=useState("");
  const [dayTypeDescription,setDayTypeDescription]=useState("");
  const [dayTypeExpected,setDayTypeExpected]=useState(true);

  const splitWriteBusy = useRef(false);
  const [myLeaveSummary,setMyLeaveSummary]=useState(null);
  const [policySheet,setPolicySheet]=useState(false);
  const [policyName,setPolicyName]=useState("");
  const [policyFrom,setPolicyFrom]=useState(isoDay(new Date()));
  const [policySource,setPolicySource]=useState("");
  const [policyReason,setPolicyReason]=useState("");
  const [policyKind,setPolicyKind]=useState("annual");
  const [policyEntitlement,setPolicyEntitlement]=useState("");
  const [policyEntitlementUnit,setPolicyEntitlementUnit]=useState("");
  const [policyAccrualMethod,setPolicyAccrualMethod]=useState("");
  const [policyAccrualRate,setPolicyAccrualRate]=useState("");
  const [policyCarryoverMethod,setPolicyCarryoverMethod]=useState("");
  const [policyCarryoverLimit,setPolicyCarryoverLimit]=useState("");
  const [policyOpeningBalanceRequired,setPolicyOpeningBalanceRequired]=useState(false);
  const [policyRoute,setPolicyRoute]=useState("");

  useEffect(()=>{
    void load();
    return ()=>{ readGeneration.current+=1; };
  },[me.id,me.org_id,me.unit_id,me.role]);

  async function load(){
    const generation=++readGeneration.current;
    setLoading(true); setError(null);
    const since=new Date(Date.now()-31*86400000).toISOString();
    const datasets=[
      ["people", supabase.from("employment_records").select("profile_id,unit_id,manager_profile_id,employment_type,working_pattern,profiles!employment_records_profile_id_fkey(full_name,job_title,active),units(name)").eq("org_id",me.org_id).eq("employment_status","active")],
      ["sessions", supabase.from("work_sessions").select("id,profile_id,started_at,ended_at,place,end_reason,flags,lat,lng,ip,location_captured_at,location_accuracy_m,start_geofence,end_location_captured_at,end_location_status,end_location_failure,end_lat,end_lng,end_accuracy_m").eq("org_id",me.org_id).gte("started_at",since).order("started_at",{ascending:false})],
      ["last CEAC activity", supabase.rpc("visible_last_ceac_activity")],
      ["leave", supabase.from("leave_requests").select("id,profile_id,kind,start_date,end_date,days,working_days,working_days_basis,status,reason,requested_at,decided_by,decided_at,decision_note,profiles!leave_requests_profile_id_fkey(full_name)").eq("org_id",me.org_id).order("start_date",{ascending:false})],
      ["leave history", supabase.from("leave_request_events").select("*").eq("org_id",me.org_id).order("created_at",{ascending:false})],
      ["day types", supabase.from("workforce_day_types").select("*").eq("org_id",me.org_id).eq("active",true).order("name")],
      ["schedules", supabase.from("workforce_schedule_versions").select("*").eq("org_id",me.org_id).order("created_at",{ascending:false})],
      ["corrections", supabase.from("attendance_corrections").select("*").eq("org_id",me.org_id).order("created_at",{ascending:false})],
      ["my leave balances", supabase.rpc("workforce_annual_leave_summary",{p_profile_id:me.id,p_as_of:isoDay(new Date())})],
      ["leave policies", supabase.from("leave_policy_versions").select("*").eq("org_id",me.org_id).order("created_at",{ascending:false})],
      ["leave policy rules", supabase.from("leave_policy_rules").select("*").eq("org_id",me.org_id).order("leave_kind")],
      ["office location", supabase.from("office_locations").select("name,lat,lng,radius_meters").eq("org_id",me.org_id).eq("is_primary",true).limit(1).maybeSingle()],
      ["meetings", supabase.from("meeting_sessions").select("id,title,starts_at,ends_at,status,scope,unit_id,meeting_participants(profile_id)").eq("org_id",me.org_id).gte("starts_at",new Date().toISOString()).lte("starts_at",new Date(Date.now()+7*86400000).toISOString()).neq("status","cancelled")],
      ["ministry events", supabase.from("ministry_events").select("id,title,starts_at,ends_at,location,cancelled,scope,unit_id").eq("org_id",me.org_id).gte("starts_at",new Date().toISOString()).lte("starts_at",new Date(Date.now()+7*86400000).toISOString())],
    ];
    const results=await settleWorkforceDatasets(datasets);
    // A later refresh or scope switch owns the UI. Older results must never
    // replace the latest verified employment, leave and correction records.
    if(generation!==readGeneration.current) return {errors:{},superseded:true};
    const byName=Object.fromEntries(results.map((row)=>[row.name,row]));
    let annualStageAvailable=true;
    if(byName.leave.error&&isMissingAnnualLeaveStageSchema(byName.leave.error)){
      annualStageAvailable=false;
      const legacyLeave=await supabase.from("leave_requests")
        .select("id,profile_id,kind,start_date,end_date,days,status,reason,requested_at,decided_by,decided_at,decision_note,profiles!leave_requests_profile_id_fkey(full_name)")
        .eq("org_id",me.org_id).order("start_date",{ascending:false});
      if(generation!==readGeneration.current) return {errors:{},superseded:true};
      byName.leave={name:"leave",data:legacyLeave.data||[],error:legacyLeave.error||null};
    }
    const errors={};
    for(const row of Object.values(byName)){
      if(row.error) errors[row.name]=humanError(row.error, row.name+" could not load.");
    }

    setPeople(!byName.people.error ? (byName.people.data||[]).filter((row)=>row.profiles?.active!==false) : []);
    setLastActivity(!byName["last CEAC activity"].error ? byName["last CEAC activity"].data||[] : []);
    setSessions(!byName.sessions.error ? byName.sessions.data||[] : []);
    setLeave(!byName.leave.error ? byName.leave.data||[] : []);
    setLeaveEvents(!byName["leave history"].error ? byName["leave history"].data||[] : []);
    setDayTypes(!byName["day types"].error ? byName["day types"].data||[] : []);
    setSchedules(!byName.schedules.error ? byName.schedules.data||[] : []);
    setCorrections(!byName.corrections.error ? byName.corrections.data||[] : []);
    setMyLeaveSummary(!byName["my leave balances"].error ? byName["my leave balances"].data : null);
    setPolicies(!byName["leave policies"].error ? byName["leave policies"].data||[] : []);
    setPolicyRules(!byName["leave policy rules"].error ? byName["leave policy rules"].data||[] : []);
    setOffice(!byName["office location"].error ? byName["office location"].data||null : null);
    setMeetings(!byName.meetings.error ? byName.meetings.data||[] : []);
    setMinistryEvents(!byName["ministry events"].error ? (byName["ministry events"].data||[]).filter((row)=>!row.cancelled) : []);

    setDatasetErrors(errors);
    setAnnualWorkingDayReady(annualStageAvailable);
    if(Object.keys(errors).length) setError("Some workforce data could not load. The affected dataset is identified below; available datasets remain usable.");
    setLoading(false);
    return {errors};
  }

  const today=isoDay(new Date());
  // Source failures are unknown evidence, never proof of zero attendance.
  const sessionReadFailed=Boolean(datasetErrors.sessions);
  const peopleById=Object.fromEntries(people.map((p)=>[p.profile_id,p]));
  const dayTypesById=Object.fromEntries(dayTypes.map((d)=>[d.id,d]));
  const activePolicy=policies.find((p)=>p.state==="active")||null;
  const activeRules=activePolicy?policyRules.filter((r)=>r.policy_version_id===activePolicy.id):[];
  const confirmedLeaveSummary=<><ProductNotice tone="info" title="Confirmed leave process">The 24-day yearly allowance comprises 15 annual-leave days and one shared nine-day sick/study allowance. Each completed quarter earns 3.75 annual days and 2.25 shared days, with joiner pro-rating and ordinary year-end expiry subject to protected exceptions. Every leave request follows Manager approval → Administration final approval. Maternity and paternity retain their separate policy treatment.</ProductNotice>{canManage&&!hasConfirmedLeaveSplit(activeRules)?<ProductNotice tone="attention" title="Apply the confirmed leave split">The recorded policy has not yet been aligned to 15 annual days plus one shared nine-day allowance. This records a new policy version and preserves existing requests and history. <button className="btn" disabled={busy||loading||Boolean(datasetErrors["leave policies"]||datasetErrors["leave policy rules"])} onClick={activateConfirmedLeaveSplit}>Activate confirmed 15 + 9 policy</button></ProductNotice>:null}{!canManage&&myLeaveSummary?<ProductNotice tone="info" title="Your recorded leave balances">Annual leave: {myLeaveSummary.balance_available?myLeaveSummary.available_days:"unavailable"} working days available. Shared sick/study allowance: {myLeaveSummary.shared_other?.balance_available?myLeaveSummary.shared_other.available_days:"unavailable"} working days available. Pending requests do not reduce either balance.</ProductNotice>:null}{datasetErrors["my leave balances"]?<ProductNotice tone="attention" title="Your leave balances could not load">{datasetErrors["my leave balances"]}</ProductNotice>:null}{!annualWorkingDayReady?<ProductNotice tone="attention" title="Working-day counts come after migration acceptance">Existing leave requests and approvals remain available. CEAC OS will not invent working-day calculations until the annual-leave migration has passed restored-data acceptance and is separately approved.</ProductNotice>:null}</>;

  function rawSchedule(profileId,date=today){
    const rows=schedules.filter((s)=>s.profile_id===profileId && s.effective_from<=date && (!s.effective_to || s.effective_to>=date));
    const superseded=new Set(rows.map((s)=>s.supersedes_id).filter(Boolean));
    return rows.find((s)=>!superseded.has(s.id))||rows[0]||null;
  }
  function latestSchedule(profileId,date=today){
    const row=rawSchedule(profileId,date);
    if(!row) return null;
    const clocks=dailyClocks(row,date);
    return {...row,expected_start:clocks.start,expected_end:clocks.end};
  }
  function sessionsOn(profileId,date=today){
    return sessions.filter((s)=>s.profile_id===profileId && s.started_at?.slice(0,10)===date);
  }
  function approvedLeave(profileId,date=today){
    return leave.find((l)=>l.profile_id===profileId && l.status==="approved" && l.start_date<=date && l.end_date>=date)||null;
  }
  function currentDayType(profileId,date=today){
    const schedule=latestSchedule(profileId,date);
    const key=DAY_KEYS[new Date(date+"T00:00:00Z").getUTCDay()];
    const id=schedule?.day_map?.[key];
    return id?dayTypesById[id]||null:null;
  }
  function contextFor(profileId,date=today){
    const leaveRow=approvedLeave(profileId,date);
    if(leaveRow) return {label:"Approved leave",tone:"blue",detail:human(leaveRow.kind)+" leave"};
    if(sessionReadFailed) return {label:"Session evidence unavailable",tone:"amber",detail:"Work-session data could not be verified. Retry Workforce data; no attendance conclusion is shown."};
    const rows=sessionsOn(profileId,date);
    if(rows.length) return {label:"Session recorded",tone:"green",detail:rows.length+" recorded session"+(rows.length===1?"":"s")};
    const dayType=currentDayType(profileId,date);
    if(!dayType) return {label:"Schedule not configured",tone:"grey",detail:"No workforce schedule is recorded for this date."};
    if(dayType.session_expected) return {label:"No session recorded",tone:"amber",detail:"This is recorded context only, not an absence judgement."};
    return {label:dayType.name,tone:"grey",detail:"A work session is not ordinarily expected for this configured day type."};
  }

  async function runRpc(name,args,success,requiredDatasets=[]){
    // Busy React state alone is not a synchronous double-submit lock.
    // Every correction, policy, schedule and leave decision uses this gate.
    if(mutationBusyRef.current || busy || loading) return false;
    const unavailable=requiredDatasets.filter((dataset)=>datasetErrors[dataset]);
    if(unavailable.length){
      setError("Required Workforce records are currently unavailable: "+unavailable.join(", ")+". Reopen Workforce or refresh the page before recording a change.");
      return false;
    }
    mutationBusyRef.current=true;
    setBusy(true); setError(null); setNotice(null);
    let recorded=false;
    try {
      const {error:e}=await supabase.rpc(name,args);
      if(e) throw e;
      recorded=true;
      const reload=await load();
      if(reload.superseded){
        setError("Workforce records changed during verification. Review the current record before retrying.");
        return false;
      }
      const missing=requiredDatasets.filter((dataset)=>reload.errors[dataset]);
      if(missing.length){
        setError("The change was recorded, but these required datasets failed to reload: "+missing.join(", ")+". Review recorded state before trying again.");
        return false;
      }
      setNotice(success);
      return true;
    } catch (failure) {
      setError(recorded
        ? "The change was recorded but refresh could not be confirmed. Review the current record before retrying."
        : humanError(failure,"The workforce action could not be confirmed. Check its current state before repeating."));
      return false;
    } finally {
      mutationBusyRef.current=false;
      setBusy(false);
    }
  }

  function beginDayType(){
    setDayTypeName(""); setDayTypeDescription(""); setDayTypeExpected(true);
    setDayTypeSheet(true);
  }

  async function recordDayType(){
    const ok=await runRpc("workforce_record_day_type",{
      p_id:null,p_name:dayTypeName.trim(),p_description:dayTypeDescription.trim()||null,
      p_session_expected:dayTypeExpected,p_leave_overlay_allowed:true,p_active:true,
    },"Day type recorded.",["people","day types"]);
    if(ok){ setDayTypeSheet(false); setDayTypeName(""); setDayTypeDescription(""); setDayTypeExpected(true); }
  }

  async function recordSchedule(){
    const prior=rawSchedule(schedulePerson,scheduleFrom);
    const previousClocks=Object.fromEntries(Object.keys(prior?.day_map||{}).map(key=>[key,prior?.clock_map?.[key]||{start:prior?.expected_start||null,end:prior?.expected_end||null}]));
    // workforce_record_schedule remains the legacy compatibility contract.
    const ok=await runRpc("workforce_record_pattern",{
      p_profile_id:schedulePerson,p_unit_id:peopleById[schedulePerson]?.unit_id||null,
      p_effective_from:scheduleFrom,p_effective_to:scheduleTo||null,
      p_day_map:{...(prior?.day_map||{}),[scheduleDay]:scheduleDayType},
      p_clock_map:{...previousClocks,[scheduleDay]:{start:scheduleStart||null,end:scheduleEnd||null}},
      p_reason:scheduleReason.trim(),p_supersedes_id:prior?.id||null,
    },"Workforce schedule recorded.",["people","day types","schedules"]);
    if(ok){ setScheduleSheet(false); setScheduleReason(""); }
  }

  async function leaveAction(id,action){
    const reason=window.prompt(action==="manager_approved"?"Reason for approval":"Reason for this leave decision");
    if(!reason) return;
    await runRpc("workforce_leave_action",{p_leave_request_id:id,p_action:action,p_reason:reason},"Leave decision recorded.",["leave","leave history","my leave balances"]);
  }

  async function activateConfirmedLeaveSplit(){
    if(splitWriteBusy.current||busy||loading||!canManage||datasetErrors["leave policies"]||datasetErrors["leave policy rules"]) return;
    splitWriteBusy.current=true;
    try {
      await runRpc("workforce_record_leave_policy",{
        p_name:"CEAC leave: 15 annual + 9 shared sick/study days",
        p_effective_from:today,p_effective_to:null,
        p_source_reference:"CEAC owner clarification, 23 October 2026: 15 + shared 9, earned gradually",
        p_reason:"Apply the owner-confirmed two-balance split using existing quarterly accrual and joiner pro-rating; preserve requests, protected leave and history.",
        p_rules:confirmedLeaveSplitRules(activeRules),p_activate:true,p_supersedes_id:activePolicy?.id||null,
      },"Confirmed 15 + 9 leave policy activated.",["leave policies","leave policy rules","my leave balances"]);
    } finally { splitWriteBusy.current=false; }
  }

  async function recordPolicy(){
    const entitlement=policyEntitlement===""?null:Number(policyEntitlement);
    const accrualRate=policyAccrualRate===""?null:Number(policyAccrualRate);
    const carryoverLimit=policyCarryoverLimit===""?null:Number(policyCarryoverLimit);
    const retainedRules=activeRules
      .filter((rule)=>rule.leave_kind!==policyKind.trim() || Boolean(rule.employment_type))
      .map((rule)=>({
        leave_kind:rule.leave_kind,
        employment_type:rule.employment_type||null,
        entitlement_amount:rule.entitlement_amount,
        entitlement_unit:rule.entitlement_unit,
        accrual_method:rule.accrual_method,
        accrual_rate:rule.accrual_rate,
        carryover_method:rule.carryover_method,
        carryover_limit:rule.carryover_limit,
        approval_route:rule.approval_route,
        opening_balance_required:rule.opening_balance_required,
      }));
    const rules=[...retainedRules,{
      leave_kind:policyKind.trim(),
      employment_type:null,
      entitlement_amount:Number.isFinite(entitlement)?entitlement:null,
      entitlement_unit:policyEntitlementUnit||null,
      accrual_method:policyAccrualMethod||null,
      accrual_rate:Number.isFinite(accrualRate)?accrualRate:null,
      carryover_method:policyCarryoverMethod||null,
      carryover_limit:Number.isFinite(carryoverLimit)?carryoverLimit:null,
      approval_route:policyRoute||null,
      opening_balance_required:policyOpeningBalanceRequired,
    }];
    const ok=await runRpc("workforce_record_leave_policy",{
      p_name:policyName.trim(),p_effective_from:policyFrom,p_effective_to:null,
      p_source_reference:policySource.trim()||null,p_reason:policyReason.trim(),
      p_rules:rules,p_activate:true,p_supersedes_id:activePolicy?.id||null,
    },"Confirmed leave policy activated.",["leave policies","leave policy rules"]);
    if(ok){ setPolicySheet(false); setPolicyReason(""); }
  }

  const policyReady=
    policyName.trim().length>=3
    && policyKind.trim().length>=2
    && isValidPolicyAmount(policyEntitlement)
    && Boolean(policyEntitlementUnit)
    && Boolean(policyAccrualMethod)
    && (!["monthly","quarterly"].includes(policyAccrualMethod) || isValidPolicyAmount(policyAccrualRate))
    && Boolean(policyCarryoverMethod)
    && (policyCarryoverMethod!=="limited" || isValidPolicyAmount(policyCarryoverLimit))
    && Boolean(policyRoute)
    && policyReason.trim().length>=3;

  const waitingLeave=leave.filter((l)=>["pending","escalated"].includes(l.status));
  const reversedCorrectionIds=new Set(corrections.filter((row)=>row.correction_type==="reversal"&&row.reverses_id).map((row)=>row.reverses_id));
  const units=Array.from(new Map(people.filter((row)=>row.unit_id).map((row)=>[row.unit_id,row.units?.name||"Unit"])).entries());
  const calendarPeople=people.filter((row)=>
    (!calendarUnit||row.unit_id===calendarUnit)
    && (!calendarPerson||row.profile_id===calendarPerson)
  );

  function effectiveCorrections(profileId,date){
    return corrections.filter((row)=>
      row.profile_id===profileId
      && row.work_date===date
      && row.correction_type!=="reversal"
      && !reversedCorrectionIds.has(row.id)
    );
  }

  function sessionFacts(profileId,date=today){
    const rows=sessionsOn(profileId,date).slice().sort((a,b)=>new Date(a.started_at)-new Date(b.started_at));
    return {
      rows,
      first:rows[0]||null,
      last:rows[rows.length-1]||null,
      lastEnd:rows.filter((row)=>row.ended_at).map((row)=>row.ended_at).sort().at(-1)||null,
    };
  }

  function recordedDifferences(session){
    const out=[];
    if(session.end_reason&&session.end_reason!=="manual") out.push("Ended by the system rather than a manual end");
    if(!session.ended_at&&isoDay(session.started_at)!==today) out.push("Session has no recorded end");
    if(session.place==="office"&&office&&session.lat!=null&&session.lng!=null){
      const distance=metresBetween(Number(office.lat),Number(office.lng),Number(session.lat),Number(session.lng));
      if(distance>Number(office.radius_meters||100)) out.push("Marked as office; recorded "+distance+"m from the configured office point");
    }
    if(session.place==="office"&&(session.lat==null||session.lng==null)) out.push("Marked as office; no location was recorded");
    if(session.end_location_status==="not_verified") out.push("End location not verified");
    if(session.flags&&typeof session.flags==="object"){
      Object.entries(session.flags).forEach(([key,value])=>{if(value) out.push(human(key));});
    }
    return out;
  }

  function ruleForLeave(row){
    if(OWNER_CONFIRMED_LEAVE_KINDS.has(row.kind)){
      return {approval_route:"manager_then_admin",routing_confirmed:true,complete:false};
    }
    if(!activePolicy) return null;
    const employmentType=peopleById[row.profile_id]?.employment_type;
    return activeRules.find((rule)=>rule.leave_kind===row.kind&&rule.employment_type===employmentType)
      || activeRules.find((rule)=>rule.leave_kind===row.kind&&!rule.employment_type)
      || null;
  }

  function calendarEventsOn(date){
    const personUnit=calendarPerson?peopleById[calendarPerson]?.unit_id:null;
    const unit=calendarUnit||personUnit||"";
    const meetingRows=meetings.filter((row)=>{
      if(isoDay(row.starts_at)!==date) return false;
      if(calendarPerson){
        return (row.meeting_participants||[]).some((p)=>p.profile_id===calendarPerson);
      }
      if(unit) return row.scope==="organisation"||row.unit_id===unit;
      return true;
    }).map((row)=>({id:"meeting-"+row.id,label:"Meeting",title:row.title,at:row.starts_at}));
    const ministryRows=ministryEvents.filter((row)=>{
      if(isoDay(row.starts_at)!==date) return false;
      if(unit) return row.scope==="church"||row.unit_id===unit;
      return true;
    }).map((row)=>({id:"ministry-"+row.id,label:"Ministry activity",title:row.title,at:row.starts_at}));
    return [...meetingRows,...ministryRows].sort((a,b)=>new Date(a.at)-new Date(b.at));
  }

  const flaggedSessions=sessions.map((session)=>({session,differences:recordedDifferences(session)})).filter((row)=>row.differences.length);
  const staffTabs=[["today","Today"],["calendar","My week"],["leave","Leave"],["sessions","Sessions"],["differences","Recorded differences"],["corrections","Corrections"]];
  const managerTabs=[["today","Today"],["leave","Leave"],["calendar","Calendar"],["sessions","Sessions"],["differences","Recorded differences"],["corrections","Corrections"],...(canManage?[["setup","Schedules & policy"]]:[])];
  const adminTabs=[["today","Today"],["calendar","Calendar"],["sessions","Sessions"],["differences","Recorded differences"],["leave","Leave"],["corrections","Corrections"],...(canManage?[["setup","Schedules & policy"]]:[])];
  const tabs=isStaffView?staffTabs:isManagerView?managerTabs:adminTabs;

  const locationPanel=<Suspense fallback={<LoadingState label="Loading attendance evidence…"/>}><AttendanceEvidence me={me}/></Suspense>;

  if(loading) return <div className="body"><LoadingState label="Loading workforce…" /></div>;

  if(isStaffView){
    const person=people[0]||null;
    const personId=person?.profile_id||me.id;
    const personContext=person?contextFor(personId):{label:"No workforce record",tone:"grey",detail:"No active workforce record is visible for your account."};
    const personSchedule=person?latestSchedule(personId):null;
    const personDayType=person?currentDayType(personId):null;
    const personFacts=person?sessionFacts(personId):{rows:[],first:null,last:null,lastEnd:null};
    const personLeaveToday=person?approvedLeave(personId):null;
    const personCorrections=corrections.filter((row)=>row.profile_id===personId);
    const personSessions=sessions.filter((row)=>row.profile_id===personId);
    const personLeave=leave.filter((row)=>row.profile_id===personId);
    const personLeaveEvents=leaveEvents.filter((row)=>row.profile_id===personId);
    const todayCorrections=effectiveCorrections(personId,today);
    const configuredTime=personSchedule?.expected_start
      ? String(personSchedule.expected_start).slice(0,5)+(personSchedule?.expected_end?"–"+String(personSchedule.expected_end).slice(0,5):"")
      : "Not recorded";

    return <div className="body ev2-workforce-page ev2-workforce-staff workforce-page">
      <WorkforcePageHeader
        eyebrow="My time & leave"
        title="Workforce"
        description="Your schedule, recorded work-session context, leave and attributable corrections. Missing activity is context only, never an automatic absence or performance judgement."
        statusLabel={personContext.label}
        statusTone={personContext.tone}
      />

      {error&&<ProductNotice tone="error" title="Workforce">{error}<Button variant="secondary" size="compact" disabled={busy||loading} onClick={()=>void load()}>Retry Workforce data</Button></ProductNotice>}
      {notice&&<ProductNotice tone="success" title="Recorded">{notice}</ProductNotice>}

      {["today","calendar","leave"].includes(tab)?<TimeLeavePlanner rows={personLeave} scope="My" unavailable={Boolean(datasetErrors.leave)} onOpenLeave={()=>setTab("leave")} onOpenSessions={()=>setTab("sessions")}/>:null}

      <WorkforceTabs items={tabs} value={tab} onChange={setTab} ariaLabel="My workforce sections"/>

      <details className="timeleave-policy"><summary>Leave policy &amp; balances{!canManage&&myLeaveSummary?<span> · Annual: {myLeaveSummary.balance_available?myLeaveSummary.available_days:"unavailable"} days · Sick/study: {myLeaveSummary.shared_other?.balance_available?myLeaveSummary.shared_other.available_days:"unavailable"} days</span>:null}</summary>{confirmedLeaveSummary}</details>

      {!activePolicy&&<ProductNotice tone="attention" title="Leave policy not configured">Your leave requests remain available. CEAC OS will not invent entitlement, accrual, carry-over or remaining-day figures from old seeded defaults.</ProductNotice>}

      {tab==="today"&&<>
        {locationPanel}
        {person?<WorkforceTodayCard
          name={person.profiles?.full_name||"My workforce record"}
          meta={[person.units?.name,person.profiles?.job_title].filter(Boolean).join(" · ")||"Employment context"}
          statusLabel={personContext.label}
          statusTone={personContext.tone}
          detail={personContext.detail}
        >
          <WorkforceFactGrid items={[
            {label:"Day type",value:personDayType?.name||"Not configured"},
            {label:"Configured time",value:configuredTime},
            {label:"First recorded session",value:sessionReadFailed?"Unavailable":personFacts.first?clock(personFacts.first.started_at):"None recorded"},
            {label:"Final recorded end",value:sessionReadFailed?"Unavailable":personFacts.lastEnd?clock(personFacts.lastEnd):personFacts.rows.length?"No final end recorded":"None recorded"},
            {label:"Approved leave",value:personLeaveToday?human(personLeaveToday.kind):"None recorded"},
            {label:"Effective corrections",value:String(todayCorrections.length)},
          ]}/>
        </WorkforceTodayCard>:<WorkforceEmpty title="No workforce record is visible" description="Your active employment/workforce record will appear here when it is available in your authorised scope."/>}

        <WorkforceSection title="What this means" description="The page separates configured expectations from recorded activity. A missing or different record is not converted into absence, lateness or a performance conclusion.">
          <WorkforceRecordRow
            icon="time"
            eyebrow="Configured context"
            title={personDayType?.name||"Schedule not configured"}
            meta={personSchedule?("Configured clock context: "+configuredTime):"No workforce schedule is recorded for today."}
          />
          <WorkforceRecordRow
            icon="record"
            eyebrow="Recorded activity"
            title={sessionReadFailed?"Session evidence unavailable":personFacts.first?"Session recorded":"No session recorded"}
            meta={sessionReadFailed?"Work-session data unavailable; retry verification.":personFacts.first?(clock(personFacts.first.started_at)+(personFacts.lastEnd?" → "+clock(personFacts.lastEnd):" · no final end recorded")):"No work-session row is recorded for today."}
            statusLabel={personContext.label}
            statusTone={personContext.tone}
          />
        </WorkforceSection>
      </>}

      {tab==="calendar"&&<WorkforceSection title="My next seven days" description="Schedule, recorded activity, approved leave and shared calendar context are shown as separate facts.">
        {Array.from({length:7},(_,i)=>{
          const d=accraDayOffset(i); const date=isoDay(d);
          const ctx=contextFor(personId,date);
          const facts=sessionFacts(personId,date);
          const schedule=latestSchedule(personId,date);
          const dayType=currentDayType(personId,date);
          const events=calendarEventsOn(date);
          const time=schedule?.expected_start?String(schedule.expected_start).slice(0,5)+(schedule?.expected_end?"–"+String(schedule.expected_end).slice(0,5):""):"No clock context";
          const eventNote=events.length?events.map((event)=>event.label+": "+event.title).join(" · "):null;
          return <WorkforceRecordRow
            key={date}
            icon="calendar"
            eyebrow={niceDay(date)}
            title={dayType?.name||"Schedule not configured"}
            meta={time+(sessionReadFailed?" · session evidence unavailable":facts.first?" · first recorded "+clock(facts.first.started_at):" · no session recorded")}
            note={eventNote}
            statusLabel={ctx.label}
            statusTone={ctx.tone}
          />;
        })}
      </WorkforceSection>}

      {tab==="sessions"&&<WorkforceSection title="Recorded sessions" description="Last 31 days of factual work-session activity. These records are not payroll time or a performance score.">
        {personSessions.slice(0,120).map((session)=>{
          const diff=recordedDifferences(session);
          const sessionCorrections=effectiveCorrections(personId,isoDay(session.started_at)).filter((row)=>!row.work_session_id||row.work_session_id===session.id);
          return <WorkforceRecordRow
            key={session.id}
            icon="time"
            eyebrow={new Date(session.started_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",weekday:"short",day:"numeric",month:"short"})}
            title={clock(session.started_at)+" → "+(session.ended_at?clock(session.ended_at):"no recorded end")}
            meta={session.place||"Place not recorded"}
            note={(diff.length||sessionCorrections.length)?(diff.length+" recorded difference"+(diff.length===1?"":"s")+" · "+sessionCorrections.length+" effective correction"+(sessionCorrections.length===1?"":"s")):null}
          />;
        })}
        {!personSessions.length&&!sessionReadFailed&&<WorkforceEmpty compact title="No sessions recorded in this period" description="Nothing is inferred from the absence of session rows."/>}
        {sessionReadFailed&&<WorkforceEmpty compact title="Session evidence unavailable" description="Work-session records could not be verified. Retry Workforce data."/>}
      </WorkforceSection>}

      {tab==="differences"&&<>
        <WorkforceSection title="Expected and recorded today" description="Configured schedule context and recorded activity are intentionally shown side by side.">
          <WorkforceRecordRow
            icon="calendar"
            eyebrow="Scheduled"
            title={personDayType?.name||"Schedule not configured"}
            meta={personSchedule?configuredTime:"No configured clock context"}
          />
          <WorkforceRecordRow
            icon="record"
            eyebrow="Recorded"
            title={sessionReadFailed?"Session evidence unavailable":personFacts.first?"Session recorded":"No session recorded"}
            meta={sessionReadFailed?"Work-session data unavailable; retry verification.":personFacts.first?(clock(personFacts.first.started_at)+(personFacts.lastEnd?" → "+clock(personFacts.lastEnd):" · no final end recorded")):"No session row is recorded for today."}
            statusLabel={personContext.label}
            statusTone={personContext.tone}
          />
        </WorkforceSection>
        <WorkforceSection title="Recorded session differences" description="These are descriptive records, not findings about honesty, effort or attendance.">
          {personSessions.map((session)=>({session,differences:recordedDifferences(session)})).filter((row)=>row.differences.length).map(({session,differences})=><WorkforceRecordRow
            key={session.id}
            icon="warning"
            eyebrow={new Date(session.started_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short"})}
            title={clock(session.started_at)}
            meta={session.place||"Place not recorded"}
            note={differences.join(" · ")}
            statusLabel="Recorded difference"
            statusTone="amber"
          />)}
          {!personSessions.some((session)=>recordedDifferences(session).length)&&<WorkforceEmpty compact title="No recorded session differences" description="Nothing in the last 31 days matches the factual difference checks."/>}
        </WorkforceSection>
      </>}

      {tab==="leave"&&<>
        <WorkforceSection title="My leave requests" description="Requests and cancellations remain in My Hub → Leave. This view keeps the recorded request state and decision context together.">
          {personLeave.map((row)=><WorkforceRecordRow
            key={row.id}
            icon="calendar"
            eyebrow={human(row.kind)+" leave"}
            title={niceDay(row.start_date)+" → "+niceDay(row.end_date)}
            meta={row.days+" day"+(Number(row.days)===1?"":"s")}
            note={row.decision_note||null}
            statusLabel={human(row.status)}
            statusTone={row.status==="approved"?"green":row.status==="declined"?"amber":row.status==="cancelled"?"grey":"blue"}
          />)}
          {!personLeave.length&&<WorkforceEmpty compact title="No leave requests recorded" description="Your requests will appear here after they are submitted from My Hub."/>}
        </WorkforceSection>
        <WorkforceSection title="Decision history" description="Each recorded leave action remains attributable in the existing history.">
          {personLeaveEvents.slice(0,80).map((event)=><WorkforceRecordRow
            key={event.id}
            icon="record"
            eyebrow={new Date(event.created_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}
            title={human(event.action)}
            meta={human(event.from_status||"new")+" → "+human(event.to_status)}
            note={event.reason||null}
          />)}
          {!personLeaveEvents.length&&<WorkforceEmpty compact title="No leave decision history" description="Recorded decisions, reversals and cancellations will appear here."/>}
        </WorkforceSection>
      </>}

      {tab==="corrections"&&<WorkforceSection title="Attendance correction history" description="Corrections overlay the factual record. Original work-session rows are not rewritten, and a reversal is another linked history row.">
        <AttendanceCorrectionWorkflow me={me} />
        {personCorrections.map((row)=>{
          const reversed=row.correction_type!=="reversal"&&reversedCorrectionIds.has(row.id);
          return <WorkforceRecordRow
            key={row.id}
            icon="record"
            eyebrow={niceDay(row.work_date)}
            title={human(row.correction_type)+(reversed?" · reversed":"")}
            meta={row.reason}
            note={row.after_context?.note||null}
            statusLabel={row.correction_type==="reversal"?"Reversal recorded":reversed?"Reversed":"Recorded"}
            statusTone={reversed||row.correction_type==="reversal"?"grey":"blue"}
          />;
        })}
        {!personCorrections.length&&<WorkforceEmpty compact title="No attendance corrections recorded" description="Nothing has been corrected in your visible scope."/>}
      </WorkforceSection>}

      <WorkforceFootnote>Workforce records describe what CEAC OS has recorded. They do not score effort, honesty, productivity or performance.</WorkforceFootnote>
    </div>;
  }


  if(isManagerView){
    const managerLeaveRow=(l)=>{
      const rule=ruleForLeave(l);
      const route=rule?.approval_route||null;
      const name=l.profiles?.full_name||peopleById[l.profile_id]?.profiles?.full_name||"Employee";
      const canApprove=l.status==="pending"&&(route==="manager"||route==="manager_then_admin");
      const routeNote=route==="manager_then_admin"
        ?"Manager approval → Administration final approval"
        :l.status==="pending"&&route==="admin"
          ?"This configured route is Administration approval; no manager approval action is available."
          :route?"Policy route: "+human(route):"No confirmed route for this leave kind";
      return <WorkforceDecisionRow
        key={l.id}
        icon="calendar"
        eyebrow={human(l.kind)+" leave"}
        title={name+" · "+(l.kind==="annual"?(l.working_days==null?"working-day count unavailable":l.working_days+" working day"+(Number(l.working_days)===1?"":"s")):l.days+" calendar-day span")}
        meta={niceDay(l.start_date)+" → "+niceDay(l.end_date)}
        note={routeNote}
        statusLabel={human(l.status)}
        statusTone={l.status==="escalated"?"amber":"blue"}
      >
        {canApprove&&<Button variant="secondary" busy={busy} onClick={()=>leaveAction(l.id,"manager_approved")}>Approve</Button>}
        {l.status==="pending"&&<Button variant="quiet" busy={busy} onClick={()=>leaveAction(l.id,"declined")}>Decline</Button>}
      </WorkforceDecisionRow>;
    };

    return <div className="body ev2-workforce-page ev2-workforce-manager workforce-page">
      <WorkforcePageHeader
        eyebrow="Team time & leave"
        title="Workforce"
        description="Managed-unit schedule, recorded session, leave and correction context. Missing activity remains descriptive context and is never converted into an automatic absence or performance judgement."
        statusLabel={people.length+" people in managed scope"}
        statusTone="neutral"
      />

      {error&&<ProductNotice tone="error" title="Workforce">{error}<Button variant="secondary" size="compact" disabled={busy||loading} onClick={()=>void load()}>Retry Workforce data</Button></ProductNotice>}
      {notice&&<ProductNotice tone="success" title="Recorded">{notice}</ProductNotice>}

      {["today","calendar","leave"].includes(tab)?<TimeLeavePlanner rows={leave} scope="Team" unavailable={Boolean(datasetErrors.leave)} renderDecision={managerLeaveRow} onOpenLeave={()=>setTab("leave")} onOpenSessions={()=>setTab("sessions")}/>:null}

      <WorkforceTabs items={tabs} value={tab} onChange={setTab} ariaLabel="Manager workforce sections"/>

      <details className="timeleave-policy"><summary>Leave policy &amp; balances{!canManage&&myLeaveSummary?<span> · Annual: {myLeaveSummary.balance_available?myLeaveSummary.available_days:"unavailable"} days · Sick/study: {myLeaveSummary.shared_other?.balance_available?myLeaveSummary.shared_other.available_days:"unavailable"} days</span>:null}</summary>{confirmedLeaveSummary}</details>

      {!activePolicy&&<ProductNotice tone="attention" title="Leave policy not configured">Leave decisions remain available on the existing route. CEAC OS will not invent entitlement, accrual, carry-over or remaining balance from old seeded defaults.</ProductNotice>}

      {tab==="today"&&<>
        {locationPanel}
        <WorkforceSection title="Leave decisions" description="Requests requiring a recorded manager or Administration step appear here according to the established leave route." meta={waitingLeave.length+" waiting"}>
          {waitingLeave.map(managerLeaveRow)}
          {!waitingLeave.length&&<WorkforceEmpty compact title="No leave requests are waiting" description="New requests will appear here with their recorded route and history."/>}
        </WorkforceSection>

        <WorkforceSection title="Today across my team" description="Configured expectations and recorded activity are shown as separate facts for people inside your authorised managed-unit scope." meta={people.length+" people"}>
          {people.map((row)=>{
            const ctx=contextFor(row.profile_id);
            const schedule=latestSchedule(row.profile_id);
            const dayType=currentDayType(row.profile_id);
            const facts=sessionFacts(row.profile_id);
            const time=schedule?.expected_start?String(schedule.expected_start).slice(0,5)+(schedule?.expected_end?"–"+String(schedule.expected_end).slice(0,5):""):"No clock context";
            return <WorkforceRecordRow
              key={row.profile_id}
              icon="person"
              eyebrow={row.units?.name||"Managed unit"}
              title={row.profiles?.full_name||"Employee"}
              meta={(dayType?.name||"Schedule not configured")+" · "+time+(sessionReadFailed?" · session evidence unavailable":facts.first?" · first recorded "+clock(facts.first.started_at):" · no session recorded")}
              note={ctx.detail}
              statusLabel={ctx.label}
              statusTone={ctx.tone}
            />;
          })}
          {!people.length&&<WorkforceEmpty compact title="No workforce records in managed scope" description="Only people available through the existing managed-unit authority will appear here."/>}
        </WorkforceSection>
      </>}

      {tab==="leave"&&<>
        <WorkforceSection title="Waiting on a decision" description="Actions follow the existing configured route; this presentation does not create new decision authority." meta={waitingLeave.length+" waiting"}>
          {waitingLeave.map(managerLeaveRow)}
          {!waitingLeave.length&&<WorkforceEmpty compact title="No leave requests are waiting" description="New requests will appear here with their recorded history."/>}
        </WorkforceSection>

        <WorkforceSection title="Recent resolved requests" description="Recorded outcomes remain factual and attributable.">
          {leave.filter((row)=>["approved","declined","cancelled"].includes(row.status)).slice(0,60).map((row)=><WorkforceRecordRow
            key={row.id}
            icon="calendar"
            eyebrow={human(row.kind)+" leave"}
            title={row.profiles?.full_name||peopleById[row.profile_id]?.profiles?.full_name||"Employee"}
            meta={niceDay(row.start_date)+" → "+niceDay(row.end_date)}
            note={row.decision_note||null}
            statusLabel={human(row.status)}
            statusTone={row.status==="approved"?"green":row.status==="declined"?"amber":"grey"}
          />)}
          {!leave.some((row)=>["approved","declined","cancelled"].includes(row.status))&&<WorkforceEmpty compact title="No resolved leave requests" description="Resolved requests will remain visible here."/>}
        </WorkforceSection>

        <WorkforceSection title="Decision history" description="Each leave action remains attributable in the existing append-only history.">
          {leaveEvents.slice(0,80).map((event)=><WorkforceRecordRow
            key={event.id}
            icon="record"
            eyebrow={new Date(event.created_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}
            title={peopleById[event.profile_id]?.profiles?.full_name||"Employee"}
            meta={human(event.action)+" · "+human(event.from_status||"new")+" → "+human(event.to_status)}
            note={event.reason||null}
          />)}
          {!leaveEvents.length&&<WorkforceEmpty compact title="No leave decision history" description="Recorded decisions, reversals and cancellations will appear here."/>}
        </WorkforceSection>
      </>}

      {tab==="calendar"&&<>
        <div className="ev2wf-filter-grid">
          <SelectField
            label="Unit"
            aria-label="Workforce calendar unit filter"
            value={calendarUnit}
            onChange={(e)=>{setCalendarUnit(e.target.value);setCalendarPerson("");}}
            options={[{value:"",label:"All visible units"},...units.map(([id,name])=>({value:id,label:name}))]}
          />
          <SelectField
            label="Person"
            aria-label="Workforce calendar person filter"
            value={calendarPerson}
            onChange={(e)=>setCalendarPerson(e.target.value)}
            options={[{value:"",label:"All visible people"},...people.filter((row)=>!calendarUnit||row.unit_id===calendarUnit).map((row)=>({value:row.profile_id,label:row.profiles?.full_name||"Employee"}))]}
          />
        </div>
        {Array.from({length:7},(_,i)=>{
          const d=accraDayOffset(i); const date=isoDay(d);
          const events=calendarEventsOn(date);
          return <WorkforceSection key={date} title={niceDay(date)} description="Configured schedule and recorded activity for the selected managed scope." meta={calendarPeople.length+" people"}>
            {calendarPeople.map((person)=>{
              const ctx=contextFor(person.profile_id,date);
              const facts=sessionFacts(person.profile_id,date);
              const schedule=latestSchedule(person.profile_id,date);
              const dayType=currentDayType(person.profile_id,date);
              const time=schedule?.expected_start?String(schedule.expected_start).slice(0,5)+(schedule?.expected_end?"–"+String(schedule.expected_end).slice(0,5):""):"No clock context";
              return <WorkforceRecordRow
                key={person.profile_id+"-"+date}
                icon="person"
                eyebrow={person.units?.name||"Managed unit"}
                title={person.profiles?.full_name||"Employee"}
                meta={(dayType?.name||"Schedule not configured")+" · "+time+(sessionReadFailed?" · session evidence unavailable":facts.first?" · first recorded "+clock(facts.first.started_at):" · no session recorded")}
                statusLabel={ctx.label}
                statusTone={ctx.tone}
              />;
            })}
            {events.map((event)=><WorkforceRecordRow key={event.id} icon="meeting" eyebrow={event.label} title={event.title} meta={clock(event.at)} />)}
            {!calendarPeople.length&&!events.length&&<WorkforceEmpty compact title="No workforce context in this selection" description="Change the filters or choose another date."/>}
          </WorkforceSection>;
        })}
      </>}

      {tab==="sessions"&&<WorkforceSection title="Recorded sessions" description="Last 31 days of factual activity in your authorised managed-unit scope. Session history is not payroll time or a performance score." meta={sessionReadFailed?"Evidence unavailable":sessions.length+" records"}>
        {sessions.slice(0,160).map((session)=>{
          const person=peopleById[session.profile_id];
          const diff=recordedDifferences(session);
          const sessionCorrections=effectiveCorrections(session.profile_id,isoDay(session.started_at)).filter((row)=>!row.work_session_id||row.work_session_id===session.id);
          return <WorkforceRecordRow
            key={session.id}
            icon="time"
            eyebrow={person?.units?.name||"Managed unit"}
            title={person?.profiles?.full_name||"Employee"}
            meta={new Date(session.started_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",weekday:"short",day:"numeric",month:"short"})+" · "+clock(session.started_at)+" → "+(session.ended_at?clock(session.ended_at):"no recorded end")}
            note={(session.place||"Place not recorded")+(diff.length||sessionCorrections.length?" · "+diff.length+" recorded difference"+(diff.length===1?"":"s")+" · "+sessionCorrections.length+" effective correction"+(sessionCorrections.length===1?"":"s"):"")}
          />;
        })}
        {!sessions.length&&!sessionReadFailed&&<WorkforceEmpty compact title="No sessions recorded in this period" description="Nothing is inferred from the absence of session rows."/>}
        {sessionReadFailed&&<WorkforceEmpty compact title="Session evidence unavailable" description="Work-session records could not be verified. Retry Workforce data."/>}
      </WorkforceSection>}

      {tab==="differences"&&<>
        <WorkforceSection title="Expected and recorded today" description="Configured schedule context and recorded activity are shown side by side without creating an attendance finding.">
          {people.map((row)=>{
            const schedule=latestSchedule(row.profile_id);
            const dayType=currentDayType(row.profile_id);
            const facts=sessionFacts(row.profile_id);
            const ctx=contextFor(row.profile_id);
            return <WorkforceRecordRow
              key={row.profile_id}
              icon="person"
              eyebrow={row.units?.name||"Managed unit"}
              title={row.profiles?.full_name||"Employee"}
              meta={"Scheduled: "+(dayType?.name||"not configured")+(schedule?.expected_start?" · "+String(schedule.expected_start).slice(0,5):"")+(schedule?.expected_end?"–"+String(schedule.expected_end).slice(0,5):"")}
              note={"Recorded: "+(sessionReadFailed?"session evidence unavailable":facts.first?clock(facts.first.started_at):"no session")+(sessionReadFailed?"":facts.lastEnd?" → "+clock(facts.lastEnd):facts.rows.length?" · no final end":"")}
              statusLabel={ctx.label}
              statusTone={ctx.tone}
            />;
          })}
          {!people.length&&<WorkforceEmpty compact title="No workforce records in managed scope" description="Only authorised managed-unit records are available here."/>}
        </WorkforceSection>
        <WorkforceSection title="Recorded session differences" description="Descriptive evidence only; no lateness, absence, underwork or performance conclusion is generated." meta={sessionReadFailed?"Evidence unavailable":flaggedSessions.length+" records"}>
          {flaggedSessions.map(({session,differences})=><WorkforceRecordRow
            key={session.id}
            icon="warning"
            eyebrow={new Date(session.started_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short"})}
            title={peopleById[session.profile_id]?.profiles?.full_name||"Employee"}
            meta={clock(session.started_at)}
            note={differences.join(" · ")}
            statusLabel="Recorded difference"
            statusTone="amber"
          />)}
          {!flaggedSessions.length&&!sessionReadFailed&&<WorkforceEmpty compact title="No recorded session differences" description="Nothing in the last 31 days matches the factual difference checks."/>}
        </WorkforceSection>
      </>}

      {tab==="corrections"&&<>
        <AttendanceCorrectionWorkflow me={me} />

        <WorkforceSection title="Attendance correction history" description="Corrections overlay factual evidence; original work-session rows are not rewritten. Manager access remains read-only unless attendance.correct is explicitly granted.">
          {corrections.map((row)=>{
            const reversed=row.correction_type!=="reversal"&&reversedCorrectionIds.has(row.id);
            return <WorkforceDecisionRow
              key={row.id}
              icon="record"
              eyebrow={niceDay(row.work_date)}
              title={(peopleById[row.profile_id]?.profiles?.full_name||"Employee")+" · "+human(row.correction_type)+(reversed?" · reversed":"")}
              meta={row.reason}
              note={row.after_context?.note||null}
              statusLabel={row.correction_type==="reversal"?"Reversal recorded":reversed?"Reversed":"Recorded"}
              statusTone={reversed||row.correction_type==="reversal"?"grey":"blue"}
            >

            </WorkforceDecisionRow>;
          })}
          {!corrections.length&&<WorkforceEmpty compact title="No attendance corrections recorded" description="Nothing has been corrected in your visible managed scope."/>}
        </WorkforceSection>
      </>}

      {tab==="setup"&&canManage&&<>
        {Object.keys(datasetErrors).length>0&&<ProductNotice tone="error" title="Workforce data status">{Object.entries(datasetErrors).map(([name,message])=><div key={name}><strong>{human(name)}</strong>: {message}</div>)}</ProductNotice>}
        <p className="ev2wf-manager-scope">These controls appear only because workforce.manage is explicitly present. Manager role alone does not grant this authority.</p>
        <div className="ev2wf-toolbar">
          <Button variant="secondary" onClick={beginDayType}>Add day type</Button>
          <Button variant="secondary" disabled={busy||!dayTypes.length||!people.length} onClick={()=>{setSchedulePerson(people[0]?.profile_id||"");setScheduleDayType(dayTypes[0]?.id||"");setScheduleSheet(true)}}>Record schedule</Button>
          <Button onClick={()=>setPolicySheet(true)}>{activePolicy?"Create policy revision":"Configure leave policy"}</Button>
        </div>
        <AttendanceCodeIssuer me={me} />
        <WorkforceSection title="Day types" meta={dayTypes.length+" active"}>
          {dayTypes.map((d)=><WorkforceRecordRow key={d.id} icon="calendar" title={d.name} meta={d.session_expected?"Session ordinarily expected":"Session not ordinarily expected"} note={d.description||"No description"}/>)}
          {!dayTypes.length&&<WorkforceEmpty compact title="No active day types" description="No day types are visible in the current organisation scope."/>}
        </WorkforceSection>
        <WorkforceSection title="Leave policy status">
          {activePolicy?<WorkforceRecordRow icon="record" eyebrow="Confirmed policy" title={activePolicy.name} meta={"Confirmed "+new Date(activePolicy.confirmed_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})} note={activeRules.map((r)=>(leavePoolLabel(r.leave_kind)||human(r.leave_kind))+" · "+(r.complete?String(r.entitlement_amount)+" "+r.entitlement_unit:"rule incomplete")+" · route "+(r.approval_route?human(r.approval_route):"not configured")).join(" | ")} />:<WorkforceEmpty compact title="No confirmed CEAC leave policy is active" description="Legacy seeded defaults are not used as policy."/>}
        </WorkforceSection>
      </>}

      <WorkforceFootnote>Manager Workforce shows authorised managed-unit facts. It does not rank people, score attendance or convert missing activity into a performance conclusion.</WorkforceFootnote>

      {dayTypeSheet&&canManage&&<Sheet onClose={()=>!busy&&setDayTypeSheet(false)}>
        <div className="h2">Add workforce day type</div>
        <FieldGroup label="Name"><input className="field" aria-label="Day type name" value={dayTypeName} onChange={e=>setDayTypeName(e.target.value)}/></FieldGroup>
        <FieldGroup label="Description"><textarea className="field" aria-label="Day type description" rows="2" value={dayTypeDescription} onChange={e=>setDayTypeDescription(e.target.value)}/></FieldGroup>
        <label className="check-row"><input type="checkbox" checked={dayTypeExpected} onChange={e=>setDayTypeExpected(e.target.checked)}/><span>A work session is ordinarily expected on this day type</span></label>
        <button className="btn" style={{marginTop:14}} disabled={busy||dayTypeName.trim().length<2} onClick={recordDayType}>Record day type</button>
      </Sheet>}

      {policySheet&&canManage&&<Sheet onClose={()=>!busy&&setPolicySheet(false)}>
        <div className="h2">{activePolicy?"Create leave policy revision":"Configure confirmed leave policy"}</div>
        <p className="screen-note">Enter only CEAC-confirmed values. Activating this version makes it the organisation policy record.</p>
        <FieldGroup label="Policy name"><input className="field" aria-label="Policy name" value={policyName} onChange={e=>setPolicyName(e.target.value)}/></FieldGroup>
        <FieldGroup label="Effective from"><input className="field" type="date" value={policyFrom} onChange={e=>setPolicyFrom(e.target.value)}/></FieldGroup>
        <FieldGroup label="Source reference"><input className="field" aria-label="Policy source reference" value={policySource} onChange={e=>setPolicySource(e.target.value)} placeholder="Document, approval or reference"/></FieldGroup>
        <div className="form-grid two"><FieldGroup label="Leave kind"><input className="field" aria-label="Policy leave kind" value={policyKind} onChange={e=>setPolicyKind(e.target.value)}/></FieldGroup><FieldGroup label="Entitlement amount"><input className="field" aria-label="Policy entitlement amount" type="number" min="0" value={policyEntitlement} onChange={e=>setPolicyEntitlement(e.target.value)}/></FieldGroup></div>
        <FieldGroup label="Entitlement unit"><select className="field" aria-label="Policy entitlement unit" value={policyEntitlementUnit} onChange={e=>setPolicyEntitlementUnit(e.target.value)}><option value="">Not configured</option><option value="days">Days</option><option value="weeks">Weeks</option><option value="hours">Hours</option></select></FieldGroup>
        <div className="form-grid two"><FieldGroup label="Accrual method"><select className="field" aria-label="Policy accrual method" value={policyAccrualMethod} onChange={e=>setPolicyAccrualMethod(e.target.value)}><option value="">Not configured</option><option value="none">No accrual</option><option value="annual">Annual</option><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option><option value="manual">Manual</option></select></FieldGroup><FieldGroup label="Accrual rate"><input className="field" aria-label="Policy accrual rate" type="number" min="0" step="0.01" value={policyAccrualRate} onChange={e=>setPolicyAccrualRate(e.target.value)}/></FieldGroup></div>
        <div className="form-grid two"><FieldGroup label="Carry-over method"><select className="field" aria-label="Policy carryover method" value={policyCarryoverMethod} onChange={e=>setPolicyCarryoverMethod(e.target.value)}><option value="">Not configured</option><option value="none">No carry-over</option><option value="limited">Limited</option><option value="full">Full</option><option value="manual">Manual</option></select></FieldGroup><FieldGroup label="Carry-over limit"><input className="field" aria-label="Policy carryover limit" type="number" min="0" step="0.01" value={policyCarryoverLimit} onChange={e=>setPolicyCarryoverLimit(e.target.value)}/></FieldGroup></div>
        <FieldGroup label="Approval route"><select className="field" aria-label="Policy approval route" value={policyRoute} onChange={e=>setPolicyRoute(e.target.value)}><option value="">Not configured</option><option value="manager">Manager</option><option value="admin">Administration</option><option value="manager_then_admin">Manager then Administration</option></select></FieldGroup>
        <label className="check-row"><input type="checkbox" checked={policyOpeningBalanceRequired} onChange={e=>setPolicyOpeningBalanceRequired(e.target.checked)}/><span>This rule requires an explicitly recorded opening balance before remaining balance may be calculated</span></label>
        <FieldGroup label="Reason for this policy version"><textarea className="field" aria-label="Policy reason" rows="2" value={policyReason} onChange={e=>setPolicyReason(e.target.value)}/></FieldGroup>
        {!policyReady&&<div className="card small">Activation stays disabled until entitlement, unit, accrual method, carry-over method, approval route and any conditional rate/limit are explicitly configured. Nothing is inferred.</div>}
        <button className="btn" style={{marginTop:14}} disabled={busy||!policyReady} onClick={recordPolicy}>Activate confirmed policy</button>
      </Sheet>}
    </div>;
  }


  if(isAdminView){
    const absenceDays=Array.from({length:14},(_,i)=>{
      const d=accraDayOffset(i); return {date:isoDay(d),dateObject:d};
    });
    const absenceFor=(profileId,date)=>leave.find((row)=>
      row.profile_id===profileId
      && ["approved","pending","escalated"].includes(row.status)
      && row.start_date<=date
      && row.end_date>=date
    )||null;
    const calendarContextEvents=absenceDays.flatMap(({date})=>calendarEventsOn(date).map((event)=>({...event,date})));

    const adminLeaveRow=(l)=>{
      const rule=ruleForLeave(l);
      const route=rule?.approval_route||null;
      const name=l.profiles?.full_name||peopleById[l.profile_id]?.profiles?.full_name||"Employee";
      return <WorkforceDecisionRow
        key={l.id}
        icon="calendar"
        eyebrow={human(l.kind)+" leave"}
        title={name+" · "+l.days+" day"+(Number(l.days)===1?"":"s")}
        meta={niceDay(l.start_date)+" → "+niceDay(l.end_date)}
        note={route==="manager_then_admin"
          ?leaveStageLabel(l,route)
          :route?"Policy route: "+human(route):"No confirmed route for this leave kind"}
        statusLabel={human(l.status)}
        statusTone={l.status==="escalated"?"amber":"blue"}
      >
        {l.status==="pending"&&route==="admin"&&canManage&&<Button busy={busy} onClick={()=>leaveAction(l.id,"admin_approved")}>Admin approve</Button>}
        {l.status==="escalated"&&canManage&&<Button busy={busy} onClick={()=>leaveAction(l.id,"admin_approved")}>Admin approve</Button>}
        {canManage&&((route==="manager_then_admin"&&l.status==="escalated")||(route!=="manager_then_admin"&&["pending","escalated"].includes(l.status)))&&<Button variant="quiet" busy={busy} onClick={()=>leaveAction(l.id,"declined")}>Decline</Button>}
      </WorkforceDecisionRow>;
    };

    return <div className="body ev2-workforce-page ev2-workforce-admin workforce-page">
      <WorkforcePageHeader
        eyebrow="Organisation time & leave"
        title="Workforce"
        description="Organisation-wide schedule, recorded-session, leave and attributable correction context. “No session recorded” is descriptive context only and is never an automatic absence finding or performance judgement."
        statusLabel={people.length+" people visible"}
        statusTone="neutral"
      />

      {error&&<ProductNotice tone="error" title="Workforce">{error}<Button variant="secondary" size="compact" disabled={busy||loading} onClick={()=>void load()}>Retry Workforce data</Button></ProductNotice>}
      {notice&&<ProductNotice tone="success" title="Recorded">{notice}</ProductNotice>}

      {["today","calendar","leave"].includes(tab)?<TimeLeavePlanner rows={leave} scope="Organisation" unavailable={Boolean(datasetErrors.leave)} renderDecision={adminLeaveRow} onOpenLeave={()=>setTab("leave")} onOpenSessions={()=>setTab("sessions")}/>:null}

      <WorkforceTabs items={tabs} value={tab} onChange={setTab} ariaLabel="Administration workforce sections"/>

      <details className="timeleave-policy"><summary>Leave policy &amp; balances{!canManage&&myLeaveSummary?<span> · Annual: {myLeaveSummary.balance_available?myLeaveSummary.available_days:"unavailable"} days · Sick/study: {myLeaveSummary.shared_other?.balance_available?myLeaveSummary.shared_other.available_days:"unavailable"} days</span>:null}</summary>{confirmedLeaveSummary}</details>

      {!activePolicy&&<ProductNotice tone="info" title="Secondary leave quantities not configured">The confirmed Annual rule is available independently of the incomplete secondary leave quantities. CEAC OS will not invent Sick, Maternity, Paternity or Study entitlement values.</ProductNotice>}

      {tab==="today"&&<>
        {locationPanel}
        <WorkforceSection title="Administration actions" description="Leave items requiring a recorded decision are presented before organisation context. Existing policy routes and server authority remain decisive." meta={waitingLeave.length+" waiting"}>
          {waitingLeave.map(adminLeaveRow)}
          {!waitingLeave.length&&<WorkforceEmpty compact title="No leave requests are waiting" description="New requests will appear here with their recorded route and history."/>}
        </WorkforceSection>

        <WorkforceSection title="Today · evidence needing review"
          description="A compact queue for account-linked employees: unconfigured schedules, missing or unavailable session evidence, recorded starts and approved leave remain distinct. No attendance finding is automatic."
          meta={people.length+" linked people"}>
          <WorkforceTodayReviewList me={me} date={today}
          schedules={schedules} dayTypes={dayTypes}
          sourceUnavailable={["people","sessions","schedules","day types","leave"].some(name=>Boolean(datasetErrors[name]))}
          rows={people.map(row=>{
            const schedule=latestSchedule(row.profile_id);
            const dayType=currentDayType(row.profile_id);
            const facts=sessionFacts(row.profile_id);
            const approvedLeave=leave.some(item=>
              item.profile_id===row.profile_id
              &&item.status==="approved"&&item.start_date<=today&&item.end_date>=today);
            const clockLabel=schedule?.expected_start
              ?String(schedule.expected_start).slice(0,5)
                 +(schedule.expected_end?"–"+String(schedule.expected_end).slice(0,5):"")
              :null;
            return {
              profileId:row.profile_id,name:row.profiles?.full_name||"Employee",
              unit:row.units?.name||"Unit not recorded",
              configured:Boolean(schedule&&dayType),
              dayType:dayType?.name||null,
              expected:dayType?Boolean(dayType.session_expected):null,
              started:!sessionReadFailed&&Boolean(facts.first),
              firstStart:!sessionReadFailed?facts.first?.started_at:null,
              approvedLeave,sessionEvidenceUnavailable:sessionReadFailed,
              clockLabel,
            };
          })}
          onSchedule={canManage?(employeeId)=>{setScheduleEmployeeFocus(employeeId);setTab("setup");}:null}
          onSessions={(profileId)=>{setSessionProfileFocus(profileId);setTab("sessions");}}
          />
        </WorkforceSection>
      </>}

      {tab==="calendar"&&<>
        <div className="ev2wf-filter-grid">
          <SelectField
            label="Unit"
            aria-label="Workforce calendar unit filter"
            value={calendarUnit}
            onChange={(e)=>{setCalendarUnit(e.target.value);setCalendarPerson("");}}
            options={[{value:"",label:"All visible units"},...units.map(([id,name])=>({value:id,label:name}))]}
          />
          <SelectField
            label="Person"
            aria-label="Workforce calendar person filter"
            value={calendarPerson}
            onChange={(e)=>setCalendarPerson(e.target.value)}
            options={[{value:"",label:"All visible people"},...people.filter((row)=>!calendarUnit||row.unit_id===calendarUnit).map((row)=>({value:row.profile_id,label:row.profiles?.full_name||"Employee"}))]}
          />
        </div>
        <section className="ev2wf-admin-calendar-week fpg-absence-board" aria-label="Planned absences">
          <header className="fpg-absence-board-head">
            <div><span>Employees</span><h2>Planned absences</h2></div>
            <small>Next 14 days · approved and waiting leave only</small>
          </header>
          <div className="fpg-absence-scroll">
            <div className="fpg-absence-grid" style={{"--fpg-days":absenceDays.length}}>
              <div className="fpg-absence-corner">Employee</div>
              {absenceDays.map(({date,dateObject})=><div className={date===today?"fpg-absence-day is-today":"fpg-absence-day"} key={"head-"+date}>
                <span>{dateObject.toLocaleDateString("en-GB",{weekday:"short"})}</span>
                <b>{dateObject.getDate()}</b>
              </div>)}
              {calendarPeople.map((person)=><Fragment key={person.profile_id}>
                <div className="fpg-absence-person">
                  <span className="fpg-absence-avatar" aria-hidden="true">{(person.profiles?.full_name||"?").slice(0,1).toUpperCase()}</span>
                  <span><strong>{person.profiles?.full_name||"Employee"}</strong><small>{person.profiles?.job_title||person.units?.name||"Position not recorded"}</small></span>
                </div>
                {absenceDays.map(({date})=>{
                  const row=absenceFor(person.profile_id,date);
                  if(!row) return <div className={date===today?"fpg-absence-cell is-today":"fpg-absence-cell"} key={person.profile_id+"-"+date} />;
                  const isStart=row.start_date===date;
                  const isEnd=row.end_date===date;
                  return <div
                    key={person.profile_id+"-"+date}
                    className={"fpg-absence-cell has-leave is-"+row.status+(date===today?" is-today":"")+(isStart?" is-start":"")+(isEnd?" is-end":"")}
                    title={human(row.kind)+" leave · "+human(row.status)}
                  >
                    {isStart&&<span>{human(row.kind)} leave</span>}
                  </div>;
                })}
              </Fragment>)}
            </div>
          </div>
          {!calendarPeople.length&&<WorkforceEmpty compact title="No employees match this selection" description="Change the unit or person filter."/>}
          <div className="fpg-absence-legend">
            <span><i className="is-approved"/>Approved leave</span>
            <span><i className="is-pending"/>Pending</span>
            <span><i className="is-escalated"/>Escalated</span>
          </div>
        </section>
        <WorkforceSection title="Shared calendar context" description="Actual CEAC meetings and ministry events in the same 14-day window; these are not leave records." meta={calendarContextEvents.length+" events"}>
          {calendarContextEvents.slice(0,24).map((event)=><WorkforceRecordRow key={event.id+"-"+event.date} icon="meeting" eyebrow={event.label+" · "+niceDay(event.date)} title={event.title} meta={clock(event.at)} />)}
          {!calendarContextEvents.length&&<WorkforceEmpty compact title="No shared calendar events recorded" description="Only authoritative meetings and ministry events appear here."/>}
        </WorkforceSection>
      </>}

      {tab==="sessions"&&<WorkforceSection title="Recorded sessions · last 31 days" description="Session history is factual activity context. It is not a performance score and it is not used as payroll time." meta={sessionReadFailed?"Evidence unavailable":(sessionProfileFocus?sessions.filter(x=>x.profile_id===sessionProfileFocus):sessions).length+" records"}>
        {sessionProfileFocus&&<div className="workforce-setup-actions"><p className="screen-note">Showing records for the selected staff account only.</p><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setSessionProfileFocus("")}>All staff sessions</button></div>}
        {(sessionProfileFocus?sessions.filter(row=>row.profile_id===sessionProfileFocus):sessions).slice(0,160).map((session)=>{
          const person=peopleById[session.profile_id];
          const diff=recordedDifferences(session);
          const sessionCorrections=effectiveCorrections(session.profile_id,isoDay(session.started_at)).filter((row)=>!row.work_session_id||row.work_session_id===session.id);
          return <WorkforceRecordRow
            key={session.id}
            className="workforce-session-row"
            icon="time"
            eyebrow={person?.units?.name||"Unit not recorded"}
            title={person?.profiles?.full_name||"Employee"}
            meta={new Date(session.started_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",weekday:"short",day:"numeric",month:"short"})+" · "+clock(session.started_at)+" → "+(session.ended_at?clock(session.ended_at):"no recorded end")+" · "+(session.place||"place not recorded")}
            note={(diff.length||sessionCorrections.length)?diff.length+" recorded difference"+(diff.length===1?"":"s")+" · "+sessionCorrections.length+" effective correction"+(sessionCorrections.length===1?"":"s"):null}
          />;
        })}
        {!(sessionProfileFocus?sessions.some(row=>row.profile_id===sessionProfileFocus):sessions.length)&&!sessionReadFailed&&<WorkforceEmpty compact title="No sessions recorded in this selection" description="Nothing is inferred from the absence of session rows."/>}
        {sessionReadFailed&&<WorkforceEmpty compact title="Session evidence unavailable" description="Work-session records could not be verified. Retry Workforce data."/>}
      </WorkforceSection>}

      {tab==="differences"&&<>
        <ProductNotice tone="info" title="Descriptive context only">Configured schedule context and recorded activity are shown side by side. CEAC OS does not convert a missing or different record into “absent”, “late”, “underworked” or a performance judgement.</ProductNotice>
        <WorkforceSection title="Expected versus recorded today" description="Organisation evidence remains descriptive; any administrative finding must be recorded by an authorised human.">
          {people.map((row)=>{
            const schedule=latestSchedule(row.profile_id);
            const dayType=currentDayType(row.profile_id);
            const facts=sessionFacts(row.profile_id);
            const ctx=contextFor(row.profile_id);
            return <WorkforceRecordRow
              key={row.profile_id}
              className="workforce-compare-row"
              icon="person"
              eyebrow={row.units?.name||"Unit not recorded"}
              title={row.profiles?.full_name||"Employee"}
              meta={"Scheduled: "+(dayType?.name||"not configured")+(schedule?.expected_start?" · "+String(schedule.expected_start).slice(0,5):"")+(schedule?.expected_end?"–"+String(schedule.expected_end).slice(0,5):"")}
              note={"Recorded: "+(sessionReadFailed?"session evidence unavailable":facts.first?clock(facts.first.started_at):"no session")+(sessionReadFailed?"":facts.lastEnd?" → "+clock(facts.lastEnd):facts.rows.length?" · no final end":"")}
              statusLabel={ctx.label}
              statusTone={ctx.tone}
            />;
          })}
        </WorkforceSection>
        {!office&&<ProductNotice tone="info" title="Office point not configured">Location-based differences stay unavailable until a primary office point exists. Other factual differences still appear.</ProductNotice>}
        <WorkforceSection title="Recorded session differences" description="Factual evidence only; no automated lateness, absence, underwork or performance conclusion is generated." meta={sessionReadFailed?"Evidence unavailable":flaggedSessions.length+" records"}>
          {flaggedSessions.map(({session,differences})=><WorkforceRecordRow
            key={session.id}
            icon="warning"
            eyebrow={new Date(session.started_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short"})}
            title={peopleById[session.profile_id]?.profiles?.full_name||"Employee"}
            meta={clock(session.started_at)}
            note={differences.join(" · ")}
            statusLabel="Recorded difference"
            statusTone="amber"
          />)}
          {!flaggedSessions.length&&!sessionReadFailed&&<WorkforceEmpty compact title="No recorded session differences" description="Nothing in the last 31 days matches the factual difference checks."/>}
        </WorkforceSection>
      </>}

      {tab==="leave"&&<>
        <WorkforceSection title="Waiting on a decision" description="Administration actions remain on the existing policy route and reviewed workforce RPC." meta={waitingLeave.length+" waiting"}>
          {waitingLeave.map(adminLeaveRow)}
          {!waitingLeave.length&&<WorkforceEmpty compact title="No leave requests are waiting" description="New requests will appear here with their recorded history."/>}
        </WorkforceSection>

        <WorkforceSection title="Recent resolved requests" description="Approvals, declines, cancellations and reversals remain attributable.">
          {leave.filter((row)=>["approved","declined","cancelled"].includes(row.status)).slice(0,60).map((row)=><WorkforceDecisionRow
            key={row.id}
            icon="calendar"
            eyebrow={human(row.kind)+" leave"}
            title={row.profiles?.full_name||peopleById[row.profile_id]?.profiles?.full_name||"Employee"}
            meta={niceDay(row.start_date)+" → "+niceDay(row.end_date)}
            note={row.decision_note||null}
            statusLabel={human(row.status)}
            statusTone={row.status==="approved"?"green":row.status==="declined"?"amber":"grey"}
          >
            {canManage&&row.status==="approved"?<Button variant="quiet" busy={busy} onClick={()=>leaveAction(row.id,"approval_reversed")}>Reverse approval</Button>:null}
          </WorkforceDecisionRow>)}
          {!leave.some((row)=>["approved","declined","cancelled"].includes(row.status))&&<WorkforceEmpty compact title="No resolved leave requests" description="Resolved requests will remain visible here."/>}
        </WorkforceSection>

        <WorkforceSection title="Decision history" description="Every request, decision, reversal and cancellation remains in the append-only history.">
          {leaveEvents.slice(0,80).map((event)=><WorkforceRecordRow
            key={event.id}
            icon="record"
            eyebrow={new Date(event.created_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}
            title={peopleById[event.profile_id]?.profiles?.full_name||"Employee"}
            meta={human(event.action)+" · "+human(event.from_status||"new")+" → "+human(event.to_status)}
            note={event.reason||null}
          />)}
          {!leaveEvents.length&&<WorkforceEmpty compact title="No leave decision history" description="Recorded decisions, reversals and cancellations will appear here."/>}
        </WorkforceSection>
      </>}

      {tab==="corrections"&&<>
        <AttendanceCorrectionWorkflow me={me} />

        <WorkforceSection title="Attendance correction history" description="Corrections overlay the factual record. Original work-session rows are not rewritten; reversal is another linked history row.">
          {corrections.map((row)=>{
            const reversed=row.correction_type!=="reversal"&&reversedCorrectionIds.has(row.id);
            return <WorkforceDecisionRow
              key={row.id}
              icon="record"
              eyebrow={niceDay(row.work_date)}
              title={(peopleById[row.profile_id]?.profiles?.full_name||"Employee")+" · "+human(row.correction_type)+(reversed?" · reversed":"")}
              meta={row.reason}
              note={row.after_context?.note||null}
              statusLabel={row.correction_type==="reversal"?"Reversal recorded":reversed?"Reversed":"Recorded"}
              statusTone={reversed||row.correction_type==="reversal"?"grey":"blue"}
            >

            </WorkforceDecisionRow>;
          })}
          {!corrections.length&&<WorkforceEmpty compact title="No attendance corrections recorded" description="Nothing has been corrected in your visible scope."/>}
        </WorkforceSection>
      </>}

      {tab==="setup"&&canManage&&<>
        {Object.keys(datasetErrors).length>0&&<ProductNotice tone="error" title="Workforce data status">{Object.entries(datasetErrors).map(([name,message])=><div key={name}><strong>{human(name)}</strong>: {message}</div>)}</ProductNotice>}
        <div className="ev2wf-manager-scope workforce-data-status">Visible people: <strong>{people.length}</strong> · Active day types: <strong>{dayTypes.length}</strong></div>
        <WorkforceEmployeeScheduleWorkspace me={me} initialEmployeeId={scheduleEmployeeFocus} />
        <div className="ev2wf-toolbar">
          <Button variant="secondary" onClick={beginDayType}>Add day type</Button>
          <p className="screen-note">Choose an employee above to review all seven days, change a weekday and confirm an effective-dated successor. Historical one-day schedule records remain preserved; new changes use the unified editor.</p>
          <Button onClick={()=>setPolicySheet(true)}>{activePolicy?"Create policy revision":"Configure leave policy"}</Button>
        </div>
        <details className="ev2wf-admin-advanced" style={{margin:"12px 0"}}><summary>Duty-location check-in codes</summary><AttendanceCodeIssuer me={me} /></details>
        <WorkforceSection title="Day types" description="Organisation schedule vocabulary remains explicit and attributable." meta={dayTypes.length+" active"}>
          {dayTypes.map((d)=><WorkforceRecordRow key={d.id} icon="calendar" title={d.name} meta={d.session_expected?"Session ordinarily expected":"Session not ordinarily expected"} note={d.description||"No description"}/>)}
          {!dayTypes.length&&<WorkforceEmpty compact title="No active day types" description="Record a confirmed day type before creating schedules."/>}
        </WorkforceSection>
        <WorkforceSection title="Leave policy status" description="Only an explicitly complete confirmed policy may be activated.">
          {activePolicy?<WorkforceRecordRow
            icon="record"
            eyebrow="Confirmed policy"
            title={activePolicy.name}
            meta={"Confirmed "+new Date(activePolicy.confirmed_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}
            note={activeRules.map((r)=>(leavePoolLabel(r.leave_kind)||human(r.leave_kind))+" · "+(r.complete?String(r.entitlement_amount)+" "+r.entitlement_unit:"rule incomplete")+" · accrual "+(r.accrual_method?human(r.accrual_method):"not configured")+" · carry-over "+(r.carryover_method?human(r.carryover_method):"not configured")+" · route "+(r.approval_route?human(r.approval_route):"not configured")+(r.opening_balance_required?" · opening balance required":"")).join(" | ")}
            statusLabel="Active"
            statusTone="green"
          />:<WorkforceEmpty compact title="No confirmed CEAC leave policy is active" description="Legacy seeded defaults are not used as policy."/>}
        </WorkforceSection>
      </>}

      <WorkforceFootnote>Administration Workforce is an evidence and workflow console. It does not rank people, score attendance, infer absence from missing sessions or treat recorded activity as payroll time.</WorkforceFootnote>

      {dayTypeSheet&&canManage&&<Sheet onClose={()=>!busy&&setDayTypeSheet(false)}>
        <div className="h2">Add workforce day type</div>
        <FieldGroup label="Name"><input className="field" aria-label="Day type name" value={dayTypeName} onChange={e=>setDayTypeName(e.target.value)}/></FieldGroup>
        <FieldGroup label="Description"><textarea className="field" aria-label="Day type description" rows="2" value={dayTypeDescription} onChange={e=>setDayTypeDescription(e.target.value)}/></FieldGroup>
        <label className="check-row"><input type="checkbox" checked={dayTypeExpected} onChange={e=>setDayTypeExpected(e.target.checked)}/><span>A work session is ordinarily expected on this day type</span></label>
        <button className="btn" style={{marginTop:14}} disabled={busy||dayTypeName.trim().length<2} onClick={recordDayType}>Record day type</button>
      </Sheet>}

      {scheduleSheet&&canManage&&<Sheet onClose={()=>!busy&&setScheduleSheet(false)}>
        <div className="h2">Record workforce schedule</div><p className="screen-note">Hours apply to the selected weekday only. Leave both clocks blank to record hours as unconfigured.</p>
        <FieldGroup label="Person"><select className="field" aria-label="Schedule person" value={schedulePerson} onChange={e=>setSchedulePerson(e.target.value)}>{people.map(p=><option key={p.profile_id} value={p.profile_id}>{p.profiles?.full_name}</option>)}</select></FieldGroup>
        <div className="form-grid two"><FieldGroup label="Day"><select className="field" aria-label="Schedule weekday" value={scheduleDay} onChange={e=>setScheduleDay(e.target.value)}>{DAY_KEYS.map(k=><option key={k} value={k}>{DAY_LABELS[k]}</option>)}</select></FieldGroup><FieldGroup label="Day type"><select className="field" aria-label="Schedule day type" value={scheduleDayType} onChange={e=>setScheduleDayType(e.target.value)}>{dayTypes.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></FieldGroup></div>
        <div className="form-grid two"><FieldGroup label="Effective from"><input className="field" type="date" value={scheduleFrom} onChange={e=>setScheduleFrom(e.target.value)}/></FieldGroup><FieldGroup label="Effective to"><input className="field" type="date" value={scheduleTo} onChange={e=>setScheduleTo(e.target.value)}/></FieldGroup></div>
        <div className="form-grid two"><FieldGroup label="Expected start"><input className="field" type="time" value={scheduleStart} onChange={e=>setScheduleStart(e.target.value)}/></FieldGroup><FieldGroup label="Expected end"><input className="field" type="time" value={scheduleEnd} onChange={e=>setScheduleEnd(e.target.value)}/></FieldGroup></div>
        <FieldGroup label="Reason"><textarea className="field" aria-label="Schedule reason" rows="2" value={scheduleReason} onChange={e=>setScheduleReason(e.target.value)}/></FieldGroup>
        <button className="btn" style={{marginTop:14}} disabled={busy||!schedulePerson||!scheduleDayType||scheduleReason.trim().length<3} onClick={recordSchedule}>Record schedule</button>
      </Sheet>}



      {policySheet&&canManage&&<Sheet onClose={()=>!busy&&setPolicySheet(false)}>
        <div className="h2">{activePolicy?"Create leave policy revision":"Configure confirmed leave policy"}</div>
        <p className="screen-note">Enter only CEAC-confirmed values. Activating this version makes it the organisation policy record.</p>
        <FieldGroup label="Policy name"><input className="field" aria-label="Policy name" value={policyName} onChange={e=>setPolicyName(e.target.value)}/></FieldGroup>
        <FieldGroup label="Effective from"><input className="field" type="date" value={policyFrom} onChange={e=>setPolicyFrom(e.target.value)}/></FieldGroup>
        <FieldGroup label="Source reference"><input className="field" aria-label="Policy source reference" value={policySource} onChange={e=>setPolicySource(e.target.value)} placeholder="Document, approval or reference"/></FieldGroup>
        <div className="form-grid two"><FieldGroup label="Leave kind"><input className="field" aria-label="Policy leave kind" value={policyKind} onChange={e=>setPolicyKind(e.target.value)}/></FieldGroup><FieldGroup label="Entitlement amount"><input className="field" aria-label="Policy entitlement amount" type="number" min="0" value={policyEntitlement} onChange={e=>setPolicyEntitlement(e.target.value)}/></FieldGroup></div>
        <FieldGroup label="Entitlement unit"><select className="field" aria-label="Policy entitlement unit" value={policyEntitlementUnit} onChange={e=>setPolicyEntitlementUnit(e.target.value)}><option value="">Not configured</option><option value="days">Days</option><option value="weeks">Weeks</option><option value="hours">Hours</option></select></FieldGroup>
        <div className="form-grid two"><FieldGroup label="Accrual method"><select className="field" aria-label="Policy accrual method" value={policyAccrualMethod} onChange={e=>setPolicyAccrualMethod(e.target.value)}><option value="">Not configured</option><option value="none">No accrual</option><option value="annual">Annual</option><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option><option value="manual">Manual</option></select></FieldGroup><FieldGroup label="Accrual rate"><input className="field" aria-label="Policy accrual rate" type="number" min="0" step="0.01" value={policyAccrualRate} onChange={e=>setPolicyAccrualRate(e.target.value)}/></FieldGroup></div>
        <div className="form-grid two"><FieldGroup label="Carry-over method"><select className="field" aria-label="Policy carryover method" value={policyCarryoverMethod} onChange={e=>setPolicyCarryoverMethod(e.target.value)}><option value="">Not configured</option><option value="none">No carry-over</option><option value="limited">Limited</option><option value="full">Full</option><option value="manual">Manual</option></select></FieldGroup><FieldGroup label="Carry-over limit"><input className="field" aria-label="Policy carryover limit" type="number" min="0" step="0.01" value={policyCarryoverLimit} onChange={e=>setPolicyCarryoverLimit(e.target.value)}/></FieldGroup></div>
        <FieldGroup label="Approval route"><select className="field" aria-label="Policy approval route" value={policyRoute} onChange={e=>setPolicyRoute(e.target.value)}><option value="">Not configured</option><option value="manager">Manager</option><option value="admin">Administration</option><option value="manager_then_admin">Manager then Administration</option></select></FieldGroup>
        <label className="check-row"><input type="checkbox" checked={policyOpeningBalanceRequired} onChange={e=>setPolicyOpeningBalanceRequired(e.target.checked)}/><span>This rule requires an explicitly recorded opening balance before remaining balance may be calculated</span></label>
        <FieldGroup label="Reason for this policy version"><textarea className="field" aria-label="Policy reason" rows="2" value={policyReason} onChange={e=>setPolicyReason(e.target.value)}/></FieldGroup>
        {!policyReady&&<div className="card small">Activation stays disabled until entitlement, unit, accrual method, carry-over method, approval route and any conditional rate/limit are explicitly configured. Nothing is inferred.</div>}
        <button className="btn" style={{marginTop:14}} disabled={busy||!policyReady} onClick={recordPolicy}>Activate confirmed policy</button>
      </Sheet>}
    </div>;
  }

  return <div className="body workforce-page">
    <div style={{paddingTop:26}}>
      <div className="eyebrow">Workforce management</div>
      <h1 className="h1">Workforce</h1>
      <p className="screen-note">Schedules, recorded sessions, approved leave and attributable corrections. “No session recorded” is context only and never an automatic absence finding.</p>
    </div>
    {error&&<ProductNotice tone="error" title="Workforce">{error}<Button variant="secondary" size="compact" disabled={busy||loading} onClick={()=>void load()}>Retry Workforce data</Button></ProductNotice>}
    {notice&&<ProductNotice tone="success" title="Recorded">{notice}</ProductNotice>}

    <div className="workforce-tabs" role="tablist" aria-label="Workforce sections">
      {tabs.map(([key,label])=><button key={key} role="tab" aria-selected={tab===key} className={tab===key?"on":""} onClick={()=>setTab(key)}>{label}</button>)}
    </div>

    {!activePolicy&&<ProductNotice tone="attention" title="Leave policy not configured">Leave requests remain available. CEAC OS will not calculate entitlement, accrual, carry-over or remaining balance from the old seeded defaults.</ProductNotice>}

    {tab==="today"&&<>
        {locationPanel}
      <div className="sec"><span>Today</span><span>{people.length} people in your visible workforce scope</span></div>
      <div className="workforce-grid">
        {people.map((row)=>{
          const ctx=contextFor(row.profile_id);
          const schedule=latestSchedule(row.profile_id);
          const dayType=currentDayType(row.profile_id);
          const facts=sessionFacts(row.profile_id);
          const leaveRow=approvedLeave(row.profile_id);
          const activeCorrections=effectiveCorrections(row.profile_id,today);
          return <article className="card workforce-person" key={row.profile_id}>
            <div className="workforce-person-head"><Avatar name={row.profiles?.full_name} size="sm"/><div><strong>{row.profiles?.full_name}</strong><span>{row.units?.name||"Unit not recorded"} · {row.profiles?.job_title||"Position not recorded"}</span></div><Pill tone={ctx.tone}>{ctx.label}</Pill></div>
            <p>{ctx.detail}</p>
            <div className="workforce-facts">
              <span>Day type <b>{dayType?.name||"Not configured"}</b></span>
              <span>Configured clock context <b>{schedule?.expected_start?String(schedule.expected_start).slice(0,5):"Not recorded"}{schedule?.expected_end?"–"+String(schedule.expected_end).slice(0,5):""}</b></span>
              <span>First recorded session <b>{facts.first?clock(facts.first.started_at):"None recorded"}</b></span>
              <span>Final recorded end <b>{facts.lastEnd?clock(facts.lastEnd):facts.rows.length?"No final end recorded":"None recorded"}</b></span>
              <span>Approved leave <b>{leaveRow?human(leaveRow.kind):"None recorded"}</b></span>
              <span>Effective corrections <b>{activeCorrections.length}</b></span>
            </div>
          </article>;
        })}
      </div>
      {!people.length&&<EmptyState title="No workforce records in scope">Your authorised people will appear here.</EmptyState>}
    </>}

    {tab==="calendar"&&<>
      <div className="sec"><span>Seven-day workforce context</span><span>{calendarPeople.length} visible people</span></div>
      <div className="workforce-calendar-filters">
        <FieldGroup label="Unit">
          <select className="field" aria-label="Workforce calendar unit filter" value={calendarUnit} onChange={(e)=>{setCalendarUnit(e.target.value);setCalendarPerson("");}}>
            <option value="">All visible units</option>
            {units.map(([id,name])=><option key={id} value={id}>{name}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Person">
          <select className="field" aria-label="Workforce calendar person filter" value={calendarPerson} onChange={(e)=>setCalendarPerson(e.target.value)}>
            <option value="">All visible people</option>
            {people.filter((row)=>!calendarUnit||row.unit_id===calendarUnit).map((row)=><option key={row.profile_id} value={row.profile_id}>{row.profiles?.full_name}</option>)}
          </select>
        </FieldGroup>
      </div>
      <div className="workforce-calendar">
        {Array.from({length:7},(_,i)=>{
          const d=accraDayOffset(i); const date=isoDay(d);
          const events=calendarEventsOn(date);
          return <section key={date}>
            <header><strong>{niceDay(date)}</strong><small>{events.length?events.length+" calendar item"+(events.length===1?"":"s"):"No shared calendar items"}</small></header>
            {calendarPeople.map((p)=>{
              const ctx=contextFor(p.profile_id,date);
              const facts=sessionFacts(p.profile_id,date);
              const schedule=latestSchedule(p.profile_id,date);
              return <div className="workforce-calendar-person" key={p.profile_id}>
                <span><strong>{p.profiles?.full_name}</strong><small>{currentDayType(p.profile_id,date)?.name||"Schedule not configured"}{schedule?.expected_start?" · configured "+String(schedule.expected_start).slice(0,5):""}{facts.first?" · first recorded "+clock(facts.first.started_at):""}</small></span>
                <Pill tone={ctx.tone}>{ctx.label}</Pill>
              </div>;
            })}
            {events.length>0&&<div className="workforce-calendar-events">{events.map((event)=><div key={event.id}><span>{event.label}</span><strong>{event.title}</strong><small>{clock(event.at)}</small></div>)}</div>}
          </section>;
        })}
      </div>
    </>}

    {tab==="sessions"&&<>
      <div className="sec"><span>Recorded sessions · last 31 days</span><span>{sessionReadFailed?"Unavailable":sessions.length}</span></div>
      <p className="screen-note">Session history is factual activity context. It is not a performance score and it is not used as payroll time.</p>
      {sessions.slice(0,160).map((session)=>{
        const person=peopleById[session.profile_id];
        const diff=recordedDifferences(session);
        const sessionCorrections=effectiveCorrections(session.profile_id,isoDay(session.started_at)).filter((row)=>!row.work_session_id||row.work_session_id===session.id);
        return <div className="row workforce-session-row" key={session.id}>
          <div className="row-t">{person?.profiles?.full_name||"Employee"}</div>
          <div className="row-m">{new Date(session.started_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",weekday:"short",day:"numeric",month:"short"})} · {clock(session.started_at)} → {session.ended_at?clock(session.ended_at):"no recorded end"} · {session.place||"place not recorded"}</div>
          {(diff.length>0||sessionCorrections.length>0)&&<div className="row-note">{diff.length} recorded difference{diff.length===1?"":"s"} · {sessionCorrections.length} effective correction{sessionCorrections.length===1?"":"s"}</div>}
        </div>;
      })}
      {!sessions.length&&!sessionReadFailed&&<EmptyState compact title="No sessions recorded in this period">Nothing is inferred from the absence of session rows.</EmptyState>}
      {sessionReadFailed&&<EmptyState compact title="Session evidence unavailable">Work-session records could not be verified. Retry Workforce data.</EmptyState>}
    </>}

    {tab==="differences"&&<>
      <div className="sec"><span>Expected versus recorded today</span></div>
      <ProductNotice tone="info" title="Descriptive context only">Configured schedule context and recorded activity are shown side by side. CEAC OS does not convert a missing or different record into “absent”, “late”, “underworked” or a performance judgement.</ProductNotice>
      {people.map((row)=>{
        const schedule=latestSchedule(row.profile_id);
        const dayType=currentDayType(row.profile_id);
        const facts=sessionFacts(row.profile_id);
        const ctx=contextFor(row.profile_id);
        return <div className="row workforce-compare-row" key={row.profile_id}>
          <div className="row-t">{row.profiles?.full_name}</div>
          <div className="row-m">Scheduled: {dayType?.name||"not configured"}{schedule?.expected_start?" · "+String(schedule.expected_start).slice(0,5):""}{schedule?.expected_end?"–"+String(schedule.expected_end).slice(0,5):""}</div>
          <div className="row-note">Recorded: {facts.first?clock(facts.first.started_at):"no session"}{facts.lastEnd?" → "+clock(facts.lastEnd):facts.rows.length?" · no final end":""} · {ctx.label}</div>
        </div>;
      })}

      <div className="sec"><span>Recorded session differences</span><span>{flaggedSessions.length}</span></div>
      {!office&&<ProductNotice tone="info" title="Office point not configured">Location-based differences stay unavailable until a primary office point exists. Other factual differences still appear.</ProductNotice>}
      {flaggedSessions.map(({session,differences})=><div className="row" key={session.id}>
        <div className="row-t">{peopleById[session.profile_id]?.profiles?.full_name||"Employee"}</div>
        <div className="row-m">{new Date(session.started_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short"})} · {clock(session.started_at)}</div>
        {differences.map((difference,index)=><div className="row-note" key={index}>{difference}</div>)}
      </div>)}
      {!flaggedSessions.length&&<EmptyState compact title="No recorded session differences">Nothing in the last 31 days matches the factual difference checks.</EmptyState>}
    </>}

    {tab==="leave"&&<>
      <div className="sec"><span>Waiting on a decision</span><span>{waitingLeave.length}</span></div>
      {waitingLeave.map((l)=>{
        const rule=ruleForLeave(l);
        const route=rule?.approval_route||null;
        return <div className="row" key={l.id}>
          <div className="row-t">{l.profiles?.full_name||peopleById[l.profile_id]?.profiles?.full_name||"Employee"} · {l.days} day{Number(l.days)===1?"":"s"} {human(l.kind)}</div>
          <div className="row-m">{niceDay(l.start_date)} → {niceDay(l.end_date)} · {human(l.status)} · {route==="manager_then_admin"?"Manager approval → Administration final approval":route?"Policy route: "+human(route):"No confirmed route for this leave kind"}</div>
          {isManager&&!canManage&&l.status==="pending"&&(route==="manager"||route==="manager_then_admin")&&<div className="workforce-row-actions">
            <button className="btn btn-ghost btn-sm" onClick={()=>leaveAction(l.id,"manager_approved")}>Approve</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>leaveAction(l.id,"declined")}>Decline</button>
          </div>}
          {canManage&&<div className="workforce-row-actions">
            {l.status==="pending"&&route==="admin"&&<button className="btn btn-sm" onClick={()=>leaveAction(l.id,"admin_approved")}>Admin approve</button>}
            {l.status==="escalated"&&<button className="btn btn-sm" onClick={()=>leaveAction(l.id,"admin_approved")}>Admin approve</button>}
            {((route==="manager_then_admin"&&l.status==="escalated")||(route!=="manager_then_admin"&&["pending","escalated"].includes(l.status)))&&<button className="btn btn-ghost btn-sm" onClick={()=>leaveAction(l.id,"declined")}>Decline</button>}
          </div>}
          {l.status==="pending"&&route==="manager_then_admin"&&canManage&&<div className="row-note">Waiting for Manager approval before Administration can make the final decision.</div>}
          {l.status==="pending"&&route==="admin"&&isManager&&!canManage&&<div className="row-note">This configured route is Administration approval; the manager has no approval action here.</div>}
        </div>;
      })}
      {!waitingLeave.length&&<EmptyState compact title="No leave requests are waiting">New requests will appear here with their recorded history.</EmptyState>}

      <div className="sec"><span>Recent resolved requests</span></div>
      {leave.filter((row)=>["approved","declined","cancelled"].includes(row.status)).slice(0,60).map((row)=><div className="row" key={row.id}>
        <div className="row-t">{row.profiles?.full_name||peopleById[row.profile_id]?.profiles?.full_name||"Employee"} · {human(row.kind)} leave</div>
        <div className="row-m">{niceDay(row.start_date)} → {niceDay(row.end_date)} · {human(row.status)}</div>
        {canManage&&row.status==="approved"&&<div className="workforce-row-actions"><button className="btn btn-ghost btn-sm" onClick={()=>leaveAction(row.id,"approval_reversed")}>Reverse approval</button></div>}
      </div>)}

      <div className="sec"><span>Decision history</span></div>
      {leaveEvents.slice(0,80).map((e)=><div className="row" key={e.id}><div className="row-t">{human(e.action)}</div><div className="row-m">{peopleById[e.profile_id]?.profiles?.full_name||"Employee"} · {human(e.from_status||"new")} → {human(e.to_status)} · {new Date(e.created_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}</div>{e.reason&&<div className="row-note">{e.reason}</div>}</div>)}
    </>}

    {tab==="corrections"&&<>
        <AttendanceCorrectionWorkflow me={me} />
      <div className="sec"><span>Attendance correction history</span></div>
      <p className="screen-note">Corrections overlay the factual record. Original work-session rows are not rewritten; reversal is another linked history row.</p>
      {corrections.map((row)=>{
        const reversed=row.correction_type!=="reversal"&&reversedCorrectionIds.has(row.id);
        return <div className="row" key={row.id}>
          <div className="row-t">{peopleById[row.profile_id]?.profiles?.full_name||"Employee"} · {human(row.correction_type)}{reversed?" · reversed":""}</div>
          <div className="row-m">{niceDay(row.work_date)} · {row.reason}</div>
          {row.after_context?.note&&<div className="row-note">{row.after_context.note}</div>}

        </div>;
      })}
      {!corrections.length&&<EmptyState compact title="No attendance corrections recorded">Nothing has been corrected in your visible scope.</EmptyState>}
    </>}

    {tab==="setup"&&canManage&&<>
      {Object.keys(datasetErrors).length>0&&<ProductNotice tone="error" title="Workforce data status">{Object.entries(datasetErrors).map(([name,message])=><div key={name}><strong>{human(name)}</strong>: {message}</div>)}</ProductNotice>}
      <div className="card small workforce-data-status">Visible people: <strong>{people.length}</strong> · Active day types: <strong>{dayTypes.length}</strong></div>
      <div className="workforce-setup-actions">
        <button className="btn btn-ghost" onClick={beginDayType}>Add day type</button>
        <button className="btn btn-ghost" disabled={busy||!dayTypes.length||!people.length} title={!people.length?"No visible active people loaded":!dayTypes.length?"No active day types loaded":""} onClick={()=>{setSchedulePerson(people[0]?.profile_id||"");setScheduleDayType(dayTypes[0]?.id||"");setScheduleSheet(true)}}>Record schedule</button>
        <button className="btn" onClick={()=>setPolicySheet(true)}>{activePolicy?"Create policy revision":"Configure leave policy"}</button>
      </div>
      <AttendanceCodeIssuer me={me} />
      <div className="sec"><span>Day types</span><span>{dayTypes.length}</span></div>
      {dayTypes.map((d)=><div className="row" key={d.id}><div className="row-t">{d.name}</div><div className="row-m">{d.session_expected?"Session ordinarily expected":"Session not ordinarily expected"} · {d.description||"No description"}</div></div>)}
      <div className="sec"><span>Leave policy status</span></div>
      {activePolicy?<div className="card workforce-policy"><strong>{activePolicy.name}</strong><span>Confirmed {new Date(activePolicy.confirmed_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}</span>{activeRules.map((r)=><small key={r.id}>{(leavePoolLabel(r.leave_kind)||human(r.leave_kind))} · {r.complete?(String(r.entitlement_amount)+" "+r.entitlement_unit):"rule incomplete"} · accrual {r.accrual_method?human(r.accrual_method):"not configured"} · carry-over {r.carryover_method?human(r.carryover_method):"not configured"} · route {r.approval_route?human(r.approval_route):"not configured"}{r.opening_balance_required?" · opening balance required":""}</small>)}</div>:<div className="card small">No confirmed CEAC leave policy is active. Legacy seeded defaults are not used as policy.</div>}
    </>}

    {dayTypeSheet&&<Sheet onClose={()=>!busy&&setDayTypeSheet(false)}>
      <div className="h2">Add workforce day type</div>
      <FieldGroup label="Name"><input className="field" aria-label="Day type name" value={dayTypeName} onChange={e=>setDayTypeName(e.target.value)}/></FieldGroup>
      <FieldGroup label="Description"><textarea className="field" aria-label="Day type description" rows="2" value={dayTypeDescription} onChange={e=>setDayTypeDescription(e.target.value)}/></FieldGroup>
      <label className="check-row"><input type="checkbox" checked={dayTypeExpected} onChange={e=>setDayTypeExpected(e.target.checked)}/><span>A work session is ordinarily expected on this day type</span></label>
      <button className="btn" style={{marginTop:14}} disabled={busy||dayTypeName.trim().length<2} onClick={recordDayType}>Record day type</button>
    </Sheet>}

    {scheduleSheet&&<Sheet onClose={()=>!busy&&setScheduleSheet(false)}>
      <div className="h2">Record workforce schedule</div><p className="screen-note">Hours apply to the selected weekday only. Leave both clocks blank to record hours as unconfigured.</p>
      <FieldGroup label="Person"><select className="field" aria-label="Schedule person" value={schedulePerson} onChange={e=>setSchedulePerson(e.target.value)}>{people.map(p=><option key={p.profile_id} value={p.profile_id}>{p.profiles?.full_name}</option>)}</select></FieldGroup>
      <div className="form-grid two"><FieldGroup label="Day"><select className="field" aria-label="Schedule weekday" value={scheduleDay} onChange={e=>setScheduleDay(e.target.value)}>{DAY_KEYS.map(k=><option key={k} value={k}>{DAY_LABELS[k]}</option>)}</select></FieldGroup><FieldGroup label="Day type"><select className="field" aria-label="Schedule day type" value={scheduleDayType} onChange={e=>setScheduleDayType(e.target.value)}>{dayTypes.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></FieldGroup></div>
      <div className="form-grid two"><FieldGroup label="Effective from"><input className="field" type="date" value={scheduleFrom} onChange={e=>setScheduleFrom(e.target.value)}/></FieldGroup><FieldGroup label="Effective to"><input className="field" type="date" value={scheduleTo} onChange={e=>setScheduleTo(e.target.value)}/></FieldGroup></div>
      <div className="form-grid two"><FieldGroup label="Expected start"><input className="field" type="time" value={scheduleStart} onChange={e=>setScheduleStart(e.target.value)}/></FieldGroup><FieldGroup label="Expected end"><input className="field" type="time" value={scheduleEnd} onChange={e=>setScheduleEnd(e.target.value)}/></FieldGroup></div>
      <FieldGroup label="Reason"><textarea className="field" aria-label="Schedule reason" rows="2" value={scheduleReason} onChange={e=>setScheduleReason(e.target.value)}/></FieldGroup>
      <button className="btn" style={{marginTop:14}} disabled={busy||!schedulePerson||!scheduleDayType||scheduleReason.trim().length<3} onClick={recordSchedule}>Record schedule</button>
    </Sheet>}



    {policySheet&&<Sheet onClose={()=>!busy&&setPolicySheet(false)}>
      <div className="h2">{activePolicy?"Create leave policy revision":"Configure confirmed leave policy"}</div>
      <p className="screen-note">Enter only CEAC-confirmed values. Activating this version makes it the organisation policy record.</p>
      <FieldGroup label="Policy name"><input className="field" aria-label="Policy name" value={policyName} onChange={e=>setPolicyName(e.target.value)}/></FieldGroup>
      <FieldGroup label="Effective from"><input className="field" type="date" value={policyFrom} onChange={e=>setPolicyFrom(e.target.value)}/></FieldGroup>
      <FieldGroup label="Source reference"><input className="field" aria-label="Policy source reference" value={policySource} onChange={e=>setPolicySource(e.target.value)} placeholder="Document, approval or reference"/></FieldGroup>
      <div className="form-grid two">
        <FieldGroup label="Leave kind"><input className="field" aria-label="Policy leave kind" value={policyKind} onChange={e=>setPolicyKind(e.target.value)}/></FieldGroup>
        <FieldGroup label="Entitlement amount"><input className="field" aria-label="Policy entitlement amount" type="number" min="0" value={policyEntitlement} onChange={e=>setPolicyEntitlement(e.target.value)}/></FieldGroup>
      </div>
      <FieldGroup label="Entitlement unit"><select className="field" aria-label="Policy entitlement unit" value={policyEntitlementUnit} onChange={e=>setPolicyEntitlementUnit(e.target.value)}><option value="">Not configured</option><option value="days">Days</option><option value="weeks">Weeks</option><option value="hours">Hours</option></select></FieldGroup>
      <div className="form-grid two">
        <FieldGroup label="Accrual method"><select className="field" aria-label="Policy accrual method" value={policyAccrualMethod} onChange={e=>setPolicyAccrualMethod(e.target.value)}><option value="">Not configured</option><option value="none">No accrual</option><option value="annual">Annual</option><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option><option value="manual">Manual</option></select></FieldGroup>
        <FieldGroup label="Accrual rate" hint={["monthly","quarterly"].includes(policyAccrualMethod)?"Required for monthly or quarterly accrual.":"Leave blank unless the confirmed policy defines a rate."}><input className="field" aria-label="Policy accrual rate" type="number" min="0" step="0.01" value={policyAccrualRate} onChange={e=>setPolicyAccrualRate(e.target.value)}/></FieldGroup>
      </div>
      <div className="form-grid two">
        <FieldGroup label="Carry-over method"><select className="field" aria-label="Policy carryover method" value={policyCarryoverMethod} onChange={e=>setPolicyCarryoverMethod(e.target.value)}><option value="">Not configured</option><option value="none">No carry-over</option><option value="limited">Limited</option><option value="full">Full</option><option value="manual">Manual</option></select></FieldGroup>
        <FieldGroup label="Carry-over limit" hint={policyCarryoverMethod==="limited"?"Required for limited carry-over.":"Leave blank unless the confirmed policy defines a limit."}><input className="field" aria-label="Policy carryover limit" type="number" min="0" step="0.01" value={policyCarryoverLimit} onChange={e=>setPolicyCarryoverLimit(e.target.value)}/></FieldGroup>
      </div>
      <FieldGroup label="Approval route"><select className="field" aria-label="Policy approval route" value={policyRoute} onChange={e=>setPolicyRoute(e.target.value)}><option value="">Not configured</option><option value="manager">Manager</option><option value="admin">Administration</option><option value="manager_then_admin">Manager then Administration</option></select></FieldGroup>
      <label className="check-row"><input type="checkbox" checked={policyOpeningBalanceRequired} onChange={e=>setPolicyOpeningBalanceRequired(e.target.checked)}/><span>This rule requires an explicitly recorded opening balance before remaining balance may be calculated</span></label>
      <FieldGroup label="Reason for this policy version"><textarea className="field" aria-label="Policy reason" rows="2" value={policyReason} onChange={e=>setPolicyReason(e.target.value)}/></FieldGroup>
      {!policyReady&&<div className="card small">Activation stays disabled until entitlement, unit, accrual method, carry-over method, approval route and any conditional rate/limit are explicitly configured. Nothing is inferred.</div>}
      <button className="btn" style={{marginTop:14}} disabled={busy||!policyReady} onClick={recordPolicy}>Activate confirmed policy</button>
    </Sheet>}
  </div>;
}
