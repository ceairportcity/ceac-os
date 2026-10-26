import { WorkPageHeader } from "../experience-v2/work-family/WorkFamilyV2";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { EmptyState, FieldGroup, LoadingState, ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { createProtectedHrRequestScope } from "../lib/protectedHrRequestScope";
import {
  Button,
  ComposerDrawer,
  DataPanel,
  MotionDisclosure,
  QueueRow,
  StatusBadge,
} from "../experience-v2/components";

const TYPES = [
  ["identifier","Identifier"],
  ["employment_term","Employment term"],
  ["compensation","Compensation"],
  ["payment_detail","Payment detail"],
  ["document","Protected document"],
];

const GROUPS = [
  ["identifier","Identifiers","identifiers"],
  ["employment_term","Employment terms","employment_terms"],
  ["compensation","Compensation","compensation"],
  ["payment_detail","Payment details","payment_details"],
  ["document","Protected documents","documents"],
];

function dateLabel(value) {
  if (!value) return "Not recorded";
  return new Date(value + (value.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-GB", {
    day:"numeric", month:"short", year:"numeric", timeZone:"UTC",
  });
}

function safeFileName(name = "document") {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"") || "document";
}

function protectedMoney(minor, currency = "GHS") {
  if (minor == null) return "Not recorded";
  try {
    return new Intl.NumberFormat("en-GH", {
      style:"currency", currency, currencyDisplay:"code", maximumFractionDigits:2,
    }).format(Number(minor) / 100);
  } catch {
    return `${currency} ${(Number(minor) / 100).toFixed(2)}`;
  }
}

function amountToMinor(value) {
  const cleaned=String(value ?? "").replace(/,/g,"").trim();
  if(!cleaned) return null;
  const number=Number(cleaned);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function currentAndHistory(rows = []) {
  return {
    current: rows.filter((row) => row.status === "active"),
    history: rows.filter((row) => row.status !== "active"),
  };
}

function recordPresentation(type,row) {
  if (type === "identifier") return {
    title: row.identifier_type || "Identifier",
    meta: [row.identifier_value, row.expires_on ? `Expires ${dateLabel(row.expires_on)}` : null].filter(Boolean).join(" · "),
  };
  if (type === "employment_term") return {
    title: row.term_type || "Employment term",
    meta: [row.summary, row.starts_on ? `From ${dateLabel(row.starts_on)}` : null, row.ends_on ? `to ${dateLabel(row.ends_on)}` : null].filter(Boolean).join(" · "),
  };
  if (type === "compensation") return {
    title: `${protectedMoney(row.amount_minor,row.currency)} · ${row.basis_label || "Compensation"}`,
    meta: [row.effective_on ? `Effective ${dateLabel(row.effective_on)}` : null, row.ends_on ? `ends ${dateLabel(row.ends_on)}` : null, row.note].filter(Boolean).join(" · "),
  };
  if (type === "payment_detail") return {
    title: [row.provider_name,row.account_name].filter(Boolean).join(" · ") || "Payment detail",
    meta: [row.payment_type,row.account_reference,row.branch_reference].filter(Boolean).join(" · "),
  };
  return {
    title: row.title || "Protected document",
    meta: [row.document_type,row.issued_on ? `Issued ${dateLabel(row.issued_on)}` : null,row.expires_on ? `Expires ${dateLabel(row.expires_on)}` : null].filter(Boolean).join(" · "),
  };
}

function fieldsFromRecord(type,row) {
  if (!row) return {};
  if (type === "identifier") return {
    identifierType:row.identifier_type || "",
    identifierValue:row.identifier_value || "",
    issuedOn:row.issued_on || "",
    expiresOn:row.expires_on || "",
  };
  if (type === "employment_term") return {
    termType:row.term_type || "",
    summary:row.summary || "",
    startsOn:row.starts_on || "",
    endsOn:row.ends_on || "",
  };
  if (type === "compensation") return {
    amount:row.amount_minor == null ? "" : String(Number(row.amount_minor) / 100),
    currency:row.currency || "GHS",
    basisLabel:row.basis_label || "",
    effectiveOn:row.effective_on || "",
    endsOn:row.ends_on || "",
    note:row.note || "",
  };
  if (type === "payment_detail") return {
    paymentType:row.payment_type || "",
    providerName:row.provider_name || "",
    accountName:row.account_name || "",
    accountReference:row.account_reference || "",
    branchReference:row.branch_reference || "",
  };
  return {
    documentType:row.document_type || "",
    title:row.title || "",
    issuedOn:row.issued_on || "",
    expiresOn:row.expires_on || "",
  };
}

export default function AdminProtectedHR({ me }) {
  const [people,setPeople]=useState([]);
  const [employeeId,setEmployeeId]=useState("");
  const [summary,setSummary]=useState(null);
  const [loadedEmployeeId,setLoadedEmployeeId]=useState(null);
  const scopeRef=useRef(null);
  const rosterReadGeneration=useRef(0);
  if(!scopeRef.current) scopeRef.current=createProtectedHrRequestScope();
  const [recordType,setRecordType]=useState("identifier");
  const [replaceId,setReplaceId]=useState("");
  const [reason,setReason]=useState("");
  const [fields,setFields]=useState({});
  const [file,setFile]=useState(null);
  const [composerOpen,setComposerOpen]=useState(false);
  const [historyOpen,setHistoryOpen]=useState({});
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const saveBusyRef=useRef(false);
  const [error,setError]=useState(null);
  const [notice,setNotice]=useState(null);

  useEffect(()=>{
    void loadPeople();
    return ()=>{ rosterReadGeneration.current += 1; scopeRef.current.select(null); };
  },[me.id]);
  useEffect(()=>{ if(employeeId) loadSummary(employeeId); },[employeeId]);

  async function loadPeople() {
    const generation=++rosterReadGeneration.current;
    setLoading(true);
    setError(null);
    let response;
    try {
      response=await supabase.rpc("admin_employee_roster_summary");
    } catch(failure) {
      response={error:failure};
    }
    if(generation!==rosterReadGeneration.current) return;
    if(response.error){
      // A failed permission/roster refresh cannot justify retaining previously
      // authorised confidential records while current access is unknown.
      scopeRef.current.select(null);
      setPeople([]);
      setEmployeeId("");
      setSummary(null);
      setLoadedEmployeeId(null);
      setComposerOpen(false);
      setHistoryOpen({});
      setError(humanError(response.error,"Protected HR could not load the employee roster."));
      setLoading(false);
      return;
    }
    const rows=Array.isArray(response.data) ? response.data : [];
    setPeople(rows);
    // A refreshed authorised roster may remove an employee after an access
    // change. Do not preserve that employee's cached private HR detail.
    const currentId=scopeRef.current.snapshot().employeeId;
    if((currentId || rows.length) && !rows.some(person=>person.id===currentId)){
      let remembered="";
      try { remembered=sessionStorage.getItem(`ceac:protected-hr:employee:${me.id}`)||""; } catch {}
      const next=rows.some(person=>person.id===remembered) ? remembered : rows[0]?.id || "";
      scopeRef.current.select(next);
      setEmployeeId(next);
      setSummary(null);
      setLoadedEmployeeId(null);
      setHistoryOpen({});
      setComposerOpen(false);
    }
    setLoading(false);
  }

  async function loadSummary(id=employeeId) {
    const token=scopeRef.current.begin(id);
    if(!token) return;
    setDetailLoading(true);
    setError(null);
    let response;
    try {
      response=await supabase.rpc("hr_employee_protected_summary",{p_employee_id:id});
    } catch(failure) {
      response={error:failure};
    }
    // A request for another employee or an older same-employee refresh
    // must never render private HR data in the currently selected record.
    if(!scopeRef.current.matches(token)) return;
    setDetailLoading(false);
    if(response.error){
      setSummary(null);
      setLoadedEmployeeId(null);
      setError(humanError(response.error,"Protected HR records could not be opened."));
      return;
    }
    setSummary(response.data||{identifiers:[],employment_terms:[],compensation:[],payment_details:[],documents:[]});
    setLoadedEmployeeId(id);
  }

  const selectedPerson=people.find((person)=>person.id===employeeId)||null;
  const visibleSummary=loadedEmployeeId===employeeId ? summary : null;
  const collections=useMemo(()=>({
    identifier:visibleSummary?.identifiers||[],
    employment_term:visibleSummary?.employment_terms||[],
    compensation:visibleSummary?.compensation||[],
    payment_detail:visibleSummary?.payment_details||[],
    document:visibleSummary?.documents||[],
  }),[visibleSummary]);
  const activeReplacements=currentAndHistory(collections[recordType]).current;

  function resetForm(nextType=recordType) {
    setFields({});
    setReason("");
    setReplaceId("");
    setFile(null);
    setRecordType(nextType);
  }

  function openComposer(type="identifier",row=null) {
    setRecordType(type);
    setReplaceId(row?.id || "");
    setFields(fieldsFromRecord(type,row));
    setReason("");
    setFile(null);
    setComposerOpen(true);
  }

  function closeComposer() {
    if(busy) return;
    setComposerOpen(false);
    resetForm(recordType);
  }

  function payloadForType() {
    if(recordType==="identifier") return {
      identifier_type:fields.identifierType||"",
      identifier_value:fields.identifierValue||"",
      issued_on:fields.issuedOn||"",
      expires_on:fields.expiresOn||"",
    };
    if(recordType==="employment_term") return {
      term_type:fields.termType||"",
      summary:fields.summary||"",
      starts_on:fields.startsOn||"",
      ends_on:fields.endsOn||"",
    };
    if(recordType==="compensation") return {
      amount_minor:amountToMinor(fields.amount),
      currency:(fields.currency||"").toUpperCase(),
      basis_label:fields.basisLabel||"",
      effective_on:fields.effectiveOn||"",
      ends_on:fields.endsOn||"",
      note:fields.note||"",
    };
    if(recordType==="payment_detail") return {
      payment_type:fields.paymentType||"",
      provider_name:fields.providerName||"",
      account_name:fields.accountName||"",
      account_reference:fields.accountReference||"",
      branch_reference:fields.branchReference||"",
    };
    return {};
  }

  const formReady=useMemo(()=>{
    if(!employeeId || reason.trim().length<3) return false;
    if(recordType==="identifier") return Boolean(fields.identifierType?.trim() && fields.identifierValue?.trim());
    if(recordType==="employment_term") return Boolean(fields.termType?.trim() && fields.summary?.trim() && fields.startsOn);
    if(recordType==="compensation") return amountToMinor(fields.amount)!==null
      && Boolean(fields.currency?.trim().length===3 && fields.basisLabel?.trim() && fields.effectiveOn);
    if(recordType==="payment_detail") return Boolean(fields.paymentType?.trim() && fields.providerName?.trim() && fields.accountName?.trim() && fields.accountReference?.trim());
    if(recordType==="document") return Boolean(file && fields.documentType?.trim() && fields.title?.trim());
    return false;
  },[employeeId,reason,recordType,fields,file]);

  async function saveRecord() {
    // React state is batched; lock immediately to prevent duplicate protected
    // rows or private uploads from two clicks before the next render.
    if(!formReady || saveBusyRef.current) return;
    saveBusyRef.current=true;
    const saveScope=scopeRef.current.snapshot();
    setBusy(true);
    setError(null);
    setNotice(null);
    let uploadedPath=null;
    let recorded=false;
    let confirmedFailure=false;
    let phase="upload";
    try {
      let payload=payloadForType();
      if(recordType==="document") {
        uploadedPath=`${me.org_id}/${employeeId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const upload=await supabase.storage.from("ceac-hr-private").upload(uploadedPath,file,{upsert:false});
        if(upload.error) throw upload.error;
        payload={
          document_type:fields.documentType.trim(),
          title:fields.title.trim(),
          storage_path:uploadedPath,
          issued_on:fields.issuedOn||"",
          expires_on:fields.expiresOn||"",
        };
      }
      phase="record";
      const {error:e}=await supabase.rpc("hr_employee_protected_record",{
        p_employee_id:employeeId,
        p_record_type:recordType,
        p_payload:payload,
        p_replaces_id:replaceId||null,
        p_reason:reason.trim(),
      });
      if(e) {
        confirmedFailure=true;
        throw e;
      }
      recorded=true;
      if(!scopeRef.current.matches(saveScope)) return;
      setNotice("Protected HR record saved.");
      setComposerOpen(false);
      resetForm(recordType);
      await loadSummary(employeeId);
    } catch(failure) {
      // An explicit database error is a failed transaction; a rejected
      // network promise is ambiguous and must not erase possibly linked bytes.
      if(uploadedPath && !recorded && (phase==="upload" || confirmedFailure)) {
        try { await supabase.storage.from("ceac-hr-private").remove([uploadedPath]); }
        catch { /* Preserve the original error and keep Storage private. */ }
      }
      if(scopeRef.current.matches(saveScope)) {
        const message=recorded
          ? "The protected record was saved, but its latest state could not be loaded."
          : phase==="upload"
            ? "The protected document could not be uploaded."
            : confirmedFailure
              ? "The protected HR record could not be saved."
              : "The save outcome is unconfirmed. Review the protected record before trying again.";
        setError(humanError(failure,message));
      }
    } finally {
      saveBusyRef.current=false;
      setBusy(false);
    }
  }

  async function openDocument(row) {
    if(loadedEmployeeId!==employeeId) return;
    const token=scopeRef.current.snapshot();
    setError(null);
    let response;
    try {
      response=await supabase.storage.from(row.storage_bucket||"ceac-hr-private").createSignedUrl(row.storage_path,60);
    } catch(failure) {
      response={error:failure};
    }
    // Never open a signed protected document after its employee context changed.
    if(!scopeRef.current.matches(token)) return;
    if(response.error || !response.data?.signedUrl){
      setError(humanError(response.error,"The protected document could not be opened."));
      return;
    }
    window.open(response.data.signedUrl,"_blank","noopener,noreferrer");
  }

  const set=(key,value)=>setFields(current=>({...current,[key]:value}));

  if(loading) return <div className="body"><LoadingState label="Loading protected HR…" /></div>;

  return <div className="body">
    <WorkPageHeader eyebrow="Protected employee records" title="Protected HR" description="Review confidential employee information and documents. Access and every change remain separately authorised and recorded." />

    {error&&<ProductNotice tone="error" title="Protected HR">{error}<Button variant="secondary" size="compact" onClick={()=>void loadPeople()} disabled={busy}>Retry protected employee roster</Button></ProductNotice>}
    {notice&&<ProductNotice tone="success" title="Protected HR">{notice}</ProductNotice>}

    <DataPanel
      eyebrow="Employee"
      title={selectedPerson?.full_name || "Choose an employee"}
      supporting={selectedPerson ? [
        selectedPerson.job_title || selectedPerson.source_position || "No job title recorded",
        selectedPerson.account_email || "Roster only · no account linked",
        selectedPerson.employment_status ? `Employment ${selectedPerson.employment_status}` : null,
      ].filter(Boolean).join(" · ") : "Protected HR uses the canonical employee roster, not login identity."}
      action={<Button icon="create" onClick={()=>openComposer("identifier")} disabled={!employeeId||detailLoading||loadedEmployeeId!==employeeId}>Add protected record</Button>}
    >
      <FieldGroup label="Employee">
        <select
          className="field"
          aria-label="Protected HR employee"
          value={employeeId}
          disabled={busy}
          onChange={(event)=>{
            const next=event.target.value;
            scopeRef.current.select(next);
            setEmployeeId(next);
            setSummary(null);
            setLoadedEmployeeId(null);
            setDetailLoading(Boolean(next));
            setComposerOpen(false);
            setNotice(null);
            setHistoryOpen({});
            try { sessionStorage.setItem(`ceac:protected-hr:employee:${me.id}`,next); } catch {}
            resetForm("identifier");
          }}
        >
          {people.map((person)=><option key={person.id} value={person.id}>
            {person.full_name} · {person.account_email || "Roster only"}
          </option>)}
        </select>
      </FieldGroup>
      <p className="screen-note">Roster-only employees are valid employee records. CEAC does not fabricate an email or login account for them.</p>
    </DataPanel>

    {detailLoading ? <LoadingState label="Opening protected record…" /> : <div style={{display:"grid",gap:"var(--ev2-space-4)",marginTop:"var(--ev2-space-4)"}}>
      {GROUPS.map(([type,label,key])=>{
        const {current,history}=currentAndHistory(visibleSummary?.[key]||[]);
        const open=Boolean(historyOpen[type]);
        return <DataPanel
          key={type}
          eyebrow="Protected detail"
          title={label}
          supporting={current.length
            ? `${current.length} active record${current.length===1?"":"s"}. Earlier versions remain preserved below.`
            : "No active value is recorded. Missing protected data remains explicitly missing."}
          action={<Button variant="secondary" size="compact" onClick={()=>openComposer(type)}>Add</Button>}
        >
          {current.length ? current.map((row)=>{
            const presentation=recordPresentation(type,row);
            return <QueueRow
              key={row.id}
              icon={type==="document"?"file":type==="compensation"?"finance":"record"}
              title={presentation.title}
              meta={presentation.meta}
              status="Active"
              statusTone="success"
              trailing={<span style={{display:"inline-flex",gap:"var(--ev2-space-2)",flexWrap:"wrap"}}>
                {type==="document" ? <Button variant="quiet" size="compact" onClick={()=>openDocument(row)}>Open</Button> : null}
                <Button variant="quiet" size="compact" onClick={()=>openComposer(type,row)}>Correct</Button>
              </span>}
            />;
          }) : <EmptyState compact title={`No active ${label.toLowerCase()}`}>Nothing authoritative is recorded for this employee.</EmptyState>}

          {history.length ? <>
            <div style={{marginTop:"var(--ev2-space-3)"}}>
              <Button
                variant="quiet"
                size="compact"
                onClick={()=>setHistoryOpen((value)=>({...value,[type]:!open}))}
                aria-expanded={open}
              >
                {open ? "Hide version history" : `Show version history (${history.length})`}
              </Button>
            </div>
            <MotionDisclosure open={open} ariaLabel={`${label} version history`}>
              <div style={{display:"grid",gap:"var(--ev2-space-2)",paddingTop:"var(--ev2-space-2)"}}>
                {history.map((row)=>{
                  const presentation=recordPresentation(type,row);
                  return <QueueRow
                    key={row.id}
                    icon={type==="document"?"file":type==="compensation"?"finance":"record"}
                    title={presentation.title}
                    meta={presentation.meta}
                    status="Replaced"
                    statusTone="neutral"
                    trailing={type==="document" ? <Button variant="quiet" size="compact" onClick={()=>openDocument(row)}>Open</Button> : null}
                  />;
                })}
              </div>
            </MotionDisclosure>
          </> : null}
        </DataPanel>;
      })}
    </div>}

    <ComposerDrawer
      open={composerOpen}
      onClose={closeComposer}
      title={replaceId ? "Correct protected HR record" : "Add protected HR record"}
      description="This creates an attributable protected record. Corrections preserve the earlier version instead of overwriting history."
      footer={<>
        <Button variant="secondary" onClick={closeComposer} disabled={busy}>Cancel</Button>
        <Button onClick={saveRecord} busy={busy} disabled={!formReady}>{busy?"Saving…":"Save protected record"}</Button>
      </>}
    >
      <FieldGroup label="Record type">
        <select
          className="field"
          aria-label="Protected HR record type"
          value={recordType}
          disabled={Boolean(replaceId)}
          onChange={(event)=>resetForm(event.target.value)}
        >
          {TYPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select>
      </FieldGroup>

      {!replaceId && activeReplacements.length>0 ? <FieldGroup label="Correct an existing active record (optional)">
        <select className="field" aria-label="Protected HR replacement" value={replaceId} onChange={(event)=>{
          const id=event.target.value;
          setReplaceId(id);
          const row=activeReplacements.find((entry)=>entry.id===id);
          setFields(fieldsFromRecord(recordType,row));
        }}>
          <option value="">Add a new record</option>
          {activeReplacements.map((row)=>{
            const presentation=recordPresentation(recordType,row);
            return <option key={row.id} value={row.id}>{presentation.title}</option>;
          })}
        </select>
      </FieldGroup> : null}

      {recordType==="identifier"&&<>
        <FieldGroup label="Identifier type"><input className="field" aria-label="Identifier type" value={fields.identifierType||""} onChange={(event)=>set("identifierType",event.target.value)} placeholder="Ghana Card, SSNIT, tax identifier…" /></FieldGroup>
        <FieldGroup label="Identifier value"><input className="field" aria-label="Identifier value" value={fields.identifierValue||""} onChange={(event)=>set("identifierValue",event.target.value)} /></FieldGroup>
        <FieldGroup label="Issued on"><input className="field" aria-label="Identifier issued on" type="date" value={fields.issuedOn||""} onChange={(event)=>set("issuedOn",event.target.value)} /></FieldGroup>
        <FieldGroup label="Expires on"><input className="field" aria-label="Identifier expires on" type="date" value={fields.expiresOn||""} onChange={(event)=>set("expiresOn",event.target.value)} /></FieldGroup>
      </>}

      {recordType==="employment_term"&&<>
        <FieldGroup label="Term type"><input className="field" aria-label="Employment term type" value={fields.termType||""} onChange={(event)=>set("termType",event.target.value)} placeholder="Contract term, probation, appointment…" /></FieldGroup>
        <FieldGroup label="Summary"><textarea className="field" aria-label="Employment term summary" rows="4" value={fields.summary||""} onChange={(event)=>set("summary",event.target.value)} /></FieldGroup>
        <FieldGroup label="Starts on"><input className="field" aria-label="Employment term start date" type="date" value={fields.startsOn||""} onChange={(event)=>set("startsOn",event.target.value)} /></FieldGroup>
        <FieldGroup label="Ends on"><input className="field" aria-label="Employment term end date" type="date" value={fields.endsOn||""} onChange={(event)=>set("endsOn",event.target.value)} /></FieldGroup>
      </>}

      {recordType==="compensation"&&<>
        <FieldGroup label="Amount"><input className="field" aria-label="Compensation amount" inputMode="decimal" value={fields.amount||""} onChange={(event)=>set("amount",event.target.value)} placeholder="0.00" /></FieldGroup>
        <FieldGroup label="Currency"><input className="field" aria-label="Compensation currency" maxLength="3" value={fields.currency||"GHS"} onChange={(event)=>set("currency",event.target.value.toUpperCase())} placeholder="GHS" /></FieldGroup>
        <FieldGroup label="Basis"><input className="field" aria-label="Compensation basis" value={fields.basisLabel||""} onChange={(event)=>set("basisLabel",event.target.value)} placeholder="Monthly, annual, hourly…" /></FieldGroup>
        <FieldGroup label="Effective on"><input className="field" aria-label="Compensation effective date" type="date" value={fields.effectiveOn||""} onChange={(event)=>set("effectiveOn",event.target.value)} /></FieldGroup>
        <FieldGroup label="Ends on"><input className="field" aria-label="Compensation end date" type="date" value={fields.endsOn||""} onChange={(event)=>set("endsOn",event.target.value)} /></FieldGroup>
        <FieldGroup label="Note"><textarea className="field" aria-label="Compensation note" rows="3" value={fields.note||""} onChange={(event)=>set("note",event.target.value)} /></FieldGroup>
      </>}

      {recordType==="payment_detail"&&<>
        <FieldGroup label="Payment type"><input className="field" aria-label="Payment type" value={fields.paymentType||""} onChange={(event)=>set("paymentType",event.target.value)} placeholder="Bank transfer, mobile money…" /></FieldGroup>
        <FieldGroup label="Provider"><input className="field" aria-label="Payment provider" value={fields.providerName||""} onChange={(event)=>set("providerName",event.target.value)} /></FieldGroup>
        <FieldGroup label="Account name"><input className="field" aria-label="Payment account name" value={fields.accountName||""} onChange={(event)=>set("accountName",event.target.value)} /></FieldGroup>
        <FieldGroup label="Account reference"><input className="field" aria-label="Payment account reference" value={fields.accountReference||""} onChange={(event)=>set("accountReference",event.target.value)} /></FieldGroup>
        <FieldGroup label="Branch / routing detail"><input className="field" aria-label="Payment branch reference" value={fields.branchReference||""} onChange={(event)=>set("branchReference",event.target.value)} /></FieldGroup>
      </>}

      {recordType==="document"&&<>
        <FieldGroup label="Document type"><input className="field" aria-label="Protected document type" value={fields.documentType||""} onChange={(event)=>set("documentType",event.target.value)} placeholder="Contract, ID copy, appointment letter…" /></FieldGroup>
        <FieldGroup label="Title"><input className="field" aria-label="Protected document title" value={fields.title||""} onChange={(event)=>set("title",event.target.value)} /></FieldGroup>
        <FieldGroup label="Issued on"><input className="field" aria-label="Protected document issued on" type="date" value={fields.issuedOn||""} onChange={(event)=>set("issuedOn",event.target.value)} /></FieldGroup>
        <FieldGroup label="Expires on"><input className="field" aria-label="Protected document expires on" type="date" value={fields.expiresOn||""} onChange={(event)=>set("expiresOn",event.target.value)} /></FieldGroup>
        <FieldGroup label="File"><input className="field" aria-label="Protected document file" type="file" onChange={(event)=>setFile(event.target.files?.[0]||null)} /></FieldGroup>
      </>}

      <FieldGroup label="Reason / context"><textarea className="field" aria-label="Protected HR reason" rows="3" value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="Why this protected record is being created or corrected" /></FieldGroup>
      <p className="screen-note">Protected values are never inferred from attendance, work output, role, title or Payroll state.</p>
    </ComposerDrawer>
  </div>;
}
