import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Avatar, EmptyState, FieldGroup, LoadingState, ProductNotice } from "../components/bits";
import { Button, ComposerDrawer } from "../experience-v2/components";

const LINE_TYPES = [
  ["transport_allowance","addition","Transport allowance"],
  ["bonus","addition","Bonus"],
  ["annual_bonus","addition","December annual bonus"],
  ["reimbursement","addition","Reimbursement"],
  ["other_allowance","addition","Other allowance"],
  ["loan_advance","deduction","Loan / advance deduction"],
  ["penalty_deduction","deduction","Penalty / deduction"],
  ["tax","deduction","PAYE / tax"],
  ["ssnit","deduction","SSNIT"],
  ["other_deduction","deduction","Other deduction"],
  ["correction","addition","Correction"],
];

function money(minor, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(Number(minor || 0) / 100);
}

function dateLabel(value) {
  if (!value) return "Not recorded";
  return new Date(value + (String(value).length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function amountToMinor(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function statusLabel(status) {
  if (status === "in_review") return "Awaiting Group Pastor approval";
  if (status === "approved") return "Approved";
  return "Draft";
}

function statusTone(status) {
  if (status === "approved") return "is-approved";
  if (status === "in_review") return "is-review";
  return "is-draft";
}

export default function AdminPayroll({ me }) {
  const capabilities = new Set(me.capabilities || []);
  const canPrepare = capabilities.has("payroll.prepare");
  const canApprove = capabilities.has("payroll.approve");
  const [runs, setRuns] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => { loadRuns(); }, [me.id]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); else setDetail(null); }, [selectedId]);

  async function loadRuns(preferId = null) {
    setLoading(true); setError(null);
    const [runsResult, readinessResult] = await Promise.all([
      supabase.rpc("payroll_list_runs"),
      supabase.rpc("payroll_readiness_summary"),
    ]);
    setLoading(false);
    if (runsResult.error || readinessResult.error) {
      setError((runsResult.error || readinessResult.error)?.message || "Payroll could not load.");
      return;
    }
    const rows = Array.isArray(runsResult.data) ? runsResult.data : [];
    setRuns(rows);
    setReadiness(readinessResult.data || null);
    const next = preferId || selectedId || rows[0]?.id || null;
    setSelectedId(next && rows.some((row) => row.id === next) ? next : rows[0]?.id || null);
  }

  async function loadDetail(id) {
    setDetailLoading(true); setError(null);
    const { data, error: detailError } = await supabase.rpc("payroll_run_detail", { p_run_id: id });
    setDetailLoading(false);
    if (detailError) { setError(detailError.message || "Payroll run could not be opened."); return; }
    setDetail(data || null);
  }

  async function createRun(form) {
    setBusy(true); setError(null); setNotice(null);
    const { data, error: createError } = await supabase.rpc("payroll_create_run", {
      p_label: form.label.trim(),
      p_period_start: form.start,
      p_period_end: form.end,
      p_currency: form.currency,
      p_pay_date: form.payDate || null,
      p_note: form.note.trim() || null,
    });
    setBusy(false);
    if (createError) { setError(createError.message || "Payroll run could not be created."); return; }
    setSheet(null);
    setNotice("Draft payroll run created from salary-eligible protected employee records. Active volunteers remain outside ordinary salary payroll.");
    await loadRuns(data);
  }

  async function saveLine(form) {
    if (!detail?.run?.id || !form.employeeId) return;
    setBusy(true); setError(null); setNotice(null);
    const { error: lineError } = await supabase.rpc("payroll_set_line", {
      p_run_id: detail.run.id,
      p_profile_id: form.employeeId,
      p_line_id: form.lineId || null,
      p_category: form.category,
      p_direction: form.direction,
      p_label: form.label.trim(),
      p_amount_minor: amountToMinor(form.amount),
      p_note: form.note.trim() || null,
    });
    setBusy(false);
    if (lineError) { setError(lineError.message || "Payroll line could not be saved."); return; }
    setSheet(null);
    setNotice("Payroll line recorded.");
    await Promise.all([loadDetail(detail.run.id), loadRuns(detail.run.id)]);
  }

  async function removeLine(entry, line) {
    if (!detail?.run?.id || line.category === "base_salary") return;
    setBusy(true); setError(null); setNotice(null);
    const { error: removeError } = await supabase.rpc("payroll_set_line", {
      p_run_id: detail.run.id,
      p_profile_id: entry.employee_id || entry.profile_id,
      p_line_id: line.id,
      p_category: line.category,
      p_direction: line.direction,
      p_label: line.label,
      p_amount_minor: null,
      p_note: "Removed during payroll preparation",
    });
    setBusy(false);
    if (removeError) { setError(removeError.message || "Payroll line could not be removed."); return; }
    setNotice("Payroll line removed from the draft.");
    await Promise.all([loadDetail(detail.run.id), loadRuns(detail.run.id)]);
  }

  async function submitRun(note) {
    setBusy(true); setError(null); setNotice(null);
    const { error: submitError } = await supabase.rpc("payroll_submit_run", { p_run_id: detail.run.id, p_note: note.trim() });
    setBusy(false);
    if (submitError) { setError(submitError.message || "Payroll could not be submitted."); return; }
    setSheet(null);
    setNotice("Payroll submitted for Group Pastor approval.");
    await Promise.all([loadDetail(detail.run.id), loadRuns(detail.run.id)]);
  }

  async function approveRun(note) {
    setBusy(true); setError(null); setNotice(null);
    const { error: approveError } = await supabase.rpc("payroll_approve_run", { p_run_id: detail.run.id, p_note: note.trim() });
    setBusy(false);
    if (approveError) { setError(approveError.message || "Payroll could not be approved."); return; }
    setSheet(null);
    setNotice("Payroll approved and locked.");
    await Promise.all([loadDetail(detail.run.id), loadRuns(detail.run.id)]);
  }

  async function createCorrection(reason) {
    setBusy(true); setError(null); setNotice(null);
    const { data, error: correctionError } = await supabase.rpc("payroll_create_correction", {
      p_source_run_id: detail.run.id,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (correctionError) { setError(correctionError.message || "Payroll correction could not be created."); return; }
    setSheet(null);
    setNotice("Attributable correction draft created.");
    await loadRuns(data);
  }

  const run = detail?.run || null;
  const entries = Array.isArray(detail?.entries) ? detail.entries : [];
  const flagged = useMemo(() => entries.filter((entry) => Array.isArray(entry.flags) && entry.flags.length), [entries]);

  if (loading) return <div className="body fpg-payroll"><LoadingState label="Loading Payroll…" /></div>;

  return <div className="body fpg-payroll">
    <header className="fpg-payroll-head">
      <div>
        <span>Protected finance operation</span>
        <h1>Payroll</h1>
        <p>{canPrepare
          ? "Prepare payroll from protected compensation records, review explicit changes, then submit for Group Pastor approval."
          : "Review Administration-prepared payroll and approve only after the employee-level figures are satisfactory."}</p>
      </div>
      <div className="fpg-payroll-head-actions">
        <span className="fpg-payroll-authority">{canPrepare ? "Administration prepares" : "Group Pastor approves"}</span>
        {canPrepare && <button className="btn" onClick={() => setSheet({ type:"create" })}>Create payroll run</button>}
      </div>
    </header>

    {error && <ProductNotice tone="error" title="Payroll">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Payroll">{notice}</ProductNotice>}

    {readiness && <section className="fpg-payroll-table-card">
      <div className="fpg-payroll-table-head">
        <div><span>Payroll readiness</span><h3>{readiness.employee_count || 0} salary-eligible employee{readiness.employee_count === 1 ? "" : "s"}</h3></div>
        <small>{readiness.linked_count || 0} linked account{readiness.linked_count === 1 ? "" : "s"} · {readiness.roster_only_count || 0} roster only</small>
      </div>
      <section className="fpg-payroll-metrics">
        <article><span>Salary-eligible</span><strong>{readiness.employee_count || 0}</strong><small>Active non-volunteer payroll population</small></article>
        <article className={readiness.compensation_missing_count ? "has-flags" : ""}><span>Compensation recorded</span><strong>{readiness.compensation_recorded_count || 0}</strong><small>{readiness.compensation_missing_count || 0} still missing</small></article>
        <article className={readiness.payment_missing_count ? "has-flags" : ""}><span>Payment details recorded</span><strong>{readiness.payment_recorded_count || 0}</strong><small>{readiness.payment_missing_count || 0} still missing</small></article>
        <article><span>Volunteers excluded</span><strong>{readiness.volunteer_count || 0}</strong><small>Active volunteers remain outside ordinary salary payroll</small></article>
      </section>
      {(readiness.compensation_missing_count > 0 || readiness.payment_missing_count > 0) && <ProductNotice tone="attention" title="Payroll setup is incomplete">
        Every salary-eligible employee is represented. Missing salary or payment information is shown as missing and is not invented. Active volunteers are excluded from ordinary salary payroll unless Administration formally changes their engagement.
      </ProductNotice>}
      {(readiness.volunteer_count || 0) > 0 && <ProductNotice tone="info" title="Volunteer payroll boundary">
        {readiness.volunteer_count} active volunteer{readiness.volunteer_count === 1 ? "" : "s"} excluded from this ordinary salary-payroll population. Stipend or support does not silently convert a volunteer into a salaried employee.
      </ProductNotice>}
    </section>}

    <div className="fpg-payroll-layout">
      <aside className="fpg-payroll-runs" aria-label="Payroll runs">
        <div className="fpg-payroll-side-title"><span>Payroll periods</span><b>{runs.length}</b></div>
        {runs.map((row) => <button key={row.id} type="button" className={selectedId === row.id ? "is-selected" : ""} onClick={() => setSelectedId(row.id)}>
          <span><strong>{row.label}</strong><small>{dateLabel(row.period_start)} – {dateLabel(row.period_end)}</small></span>
          <span className={"fpg-payroll-status " + statusTone(row.status)}>{statusLabel(row.status)}</span>
          <b>{money(row.total_net_minor, row.currency)}</b>
        </button>)}
        {!runs.length && <EmptyState compact title="No payroll runs">The salary-eligible roster is available. Administration can create the first protected payroll run when ready.</EmptyState>}
      </aside>

      <main className="fpg-payroll-main">
        {!selectedId && <EmptyState title="No payroll run selected">Create or select a payroll period. A draft includes every active salary-eligible employee, including roster-only employees without login accounts, and excludes volunteers by default.</EmptyState>}
        {selectedId && detailLoading && <LoadingState label="Opening Payroll run…" />}
        {run && !detailLoading && <>
          <section className="fpg-payroll-run-head">
            <div>
              <span>{run.currency} · Revision {run.revision}</span>
              <h2>{run.label}</h2>
              <p>{dateLabel(run.period_start)} – {dateLabel(run.period_end)}{run.pay_date ? " · Pay date " + dateLabel(run.pay_date) : " · Pay date not recorded"}</p>
            </div>
            <span className={"fpg-payroll-status " + statusTone(run.status)}>{statusLabel(run.status)}</span>
          </section>

          <section className="fpg-payroll-metrics">
            <article><span>Total additions</span><strong>{money(run.total_additions_minor, run.currency)}</strong><small>Recorded employee additions</small></article>
            <article><span>Total deductions</span><strong>{money(run.total_deductions_minor, run.currency)}</strong><small>Recorded employee deductions</small></article>
            <article><span>Net payroll</span><strong>{money(run.total_net_minor, run.currency)}</strong><small>Recorded additions minus deductions</small></article>
            <article className={flagged.length ? "has-flags" : ""}><span>Needs review</span><strong>{flagged.length}</strong><small>Employee entries with factual flags</small></article>
          </section>

          <div className="fpg-payroll-actions">
            {canPrepare && run.status === "draft" && <button className="btn" disabled={busy} onClick={() => setSheet({ type:"submit" })}>Submit for approval</button>}
            {canApprove && run.status === "in_review" && <button className="btn" disabled={busy} onClick={() => setSheet({ type:"approve" })}>Approve payroll</button>}
            {canPrepare && run.status === "approved" && <button className="btn btn-ghost" disabled={busy} onClick={() => setSheet({ type:"correction" })}>Create correction</button>}
            <span>Approved payroll is immutable. Corrections create a new attributable revision.</span>
          </div>

          <section className="fpg-payroll-table-card">
            <div className="fpg-payroll-table-head"><div><span>Employee payroll</span><h3>{entries.length} employee entr{entries.length === 1 ? "y" : "ies"}</h3></div><small>Protected data · {run.currency}</small></div>
            <div className="fpg-payroll-table-wrap">
              <table className="fpg-payroll-table">
                <thead><tr><th>Employee</th><th>Additions</th><th>Deductions</th><th>Net</th><th>Review</th><th /></tr></thead>
                <tbody>{entries.map((entry) => <tr key={entry.id}>
                  <td><div className="fpg-payroll-person"><Avatar name={entry.employee_name} size="sm" /><span><strong>{entry.employee_name}</strong><small>{entry.payment_detail_id ? "Payment detail recorded" : "Payment detail missing"}</small></span></div></td>
                  <td>{money(entry.additions_minor, entry.currency)}</td>
                  <td>{money(entry.deductions_minor, entry.currency)}</td>
                  <td><strong>{money(entry.net_minor, entry.currency)}</strong></td>
                  <td>{entry.flags?.length ? <span className="fpg-payroll-flags">{entry.flags.map((flag) => flag.replaceAll("_"," ")).join(" · ")}</span> : <span className="fpg-payroll-clear">Clear</span>}</td>
                  <td>{canPrepare && run.status === "draft" ? <button type="button" className="fpg-payroll-row-action" onClick={() => setSheet({ type:"entry", entry })}>Adjust</button> : <button type="button" className="fpg-payroll-row-action" onClick={() => setSheet({ type:"view", entry })}>Review</button>}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>

          <ProductNotice tone="info" title="Output policy not invented">
            Payslip distribution, payment export, statutory calculation and automatic deductions remain unavailable until CEAC confirms those policies. This screen records only authoritative Payroll data and decisions.
          </ProductNotice>
        </>}
      </main>
    </div>

    {sheet?.type === "create" && <CreateRunSheet busy={busy} onClose={() => setSheet(null)} onSave={createRun} />}
    {sheet?.type === "entry" && <EntrySheet entry={sheet.entry} busy={busy} onClose={() => setSheet(null)} onSave={saveLine} onRemove={removeLine} />}
    {sheet?.type === "view" && <ViewEntrySheet entry={sheet.entry} onClose={() => setSheet(null)} />}
    {sheet?.type === "submit" && <DecisionSheet title="Submit Payroll" action="Submit for approval" busy={busy} onClose={() => setSheet(null)} onSave={submitRun} />}
    {sheet?.type === "approve" && <DecisionSheet title="Approve Payroll" action="Approve and lock" busy={busy} onClose={() => setSheet(null)} onSave={approveRun} />}
    {sheet?.type === "correction" && <DecisionSheet title="Create correction" action="Create correction draft" busy={busy} onClose={() => setSheet(null)} onSave={createCorrection} />}
  </div>;
}

function CreateRunSheet({ busy, onClose, onSave }) {
  const [label,setLabel]=useState("");
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [payDate,setPayDate]=useState("");
  const [currency,setCurrency]=useState("GHS");
  const [note,setNote]=useState("");
  const valid=Boolean(label.trim() && start && end && end>=start);

  return <ComposerDrawer
    open
    onClose={onClose}
    title="Create Payroll run"
    description="Administration prepares the draft from protected salary-eligible employee records. Active volunteers are excluded by default. Creating a run does not approve it."
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button onClick={()=>onSave({label,start,end,payDate,currency,note})} busy={busy} disabled={!valid}>
        Create draft Payroll
      </Button>
    </>}
  >
    <FieldGroup label="Period label"><input className="field" value={label} onChange={(event)=>setLabel(event.target.value)} placeholder="October 2026 Payroll" /></FieldGroup>
    <div className="fpg-payroll-form-grid">
      <FieldGroup label="Period start"><input className="field" type="date" value={start} onChange={(event)=>setStart(event.target.value)} /></FieldGroup>
      <FieldGroup label="Period end"><input className="field" type="date" value={end} onChange={(event)=>setEnd(event.target.value)} /></FieldGroup>
    </div>
    <div className="fpg-payroll-form-grid">
      <FieldGroup label="Currency"><select className="field" value={currency} onChange={(event)=>setCurrency(event.target.value)}>{["GHS","USD","GBP","EUR","NGN","ZAR","CAD"].map((value)=><option key={value}>{value}</option>)}</select></FieldGroup>
      <FieldGroup label="Pay date" hint="Optional until CEAC confirms its normal pay cycle."><input className="field" type="date" value={payDate} onChange={(event)=>setPayDate(event.target.value)} /></FieldGroup>
    </div>
    <FieldGroup label="Preparation note"><textarea className="field" rows="3" value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Context for this Payroll run" /></FieldGroup>
    <ProductNotice tone="info" title="Preparation is not approval">Administration prepares. The Group Pastor / CEO remains the approval authority.</ProductNotice>
  </ComposerDrawer>;
}

function EntrySheet({ entry, busy, onClose, onSave, onRemove }) {
  const [category,setCategory]=useState("transport_allowance");
  const initial=LINE_TYPES.find(([key])=>key===category);
  const [direction,setDirection]=useState(initial?.[1] || "addition");
  const [label,setLabel]=useState(initial?.[2] || "");
  const [amount,setAmount]=useState("");
  const [note,setNote]=useState("");

  function choose(value) {
    const row=LINE_TYPES.find(([key])=>key===value);
    setCategory(value);
    setDirection(row?.[1] || "addition");
    setLabel(row?.[2] || "");
  }

  const valid=Boolean(label.trim() && amountToMinor(amount)>0);

  return <ComposerDrawer
    open
    onClose={onClose}
    title="Employee adjustments"
    description={`Draft Payroll · ${entry.employee_name}. Add only an authoritative line; attendance and leave never create an automatic deduction.`}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button
        onClick={()=>onSave({employeeId:entry.employee_id || entry.profile_id,category,direction,label,amount,note})}
        busy={busy}
        disabled={!valid}
      >
        Add Payroll line
      </Button>
    </>}
  >
    <div className="fpg-payroll-entry-summary">
      <span>Additions <b>{money(entry.additions_minor,entry.currency)}</b></span>
      <span>Deductions <b>{money(entry.deductions_minor,entry.currency)}</b></span>
      <span>Net <b>{money(entry.net_minor,entry.currency)}</b></span>
    </div>
    {entry.lines?.length ? <div className="fpg-payroll-lines">{entry.lines.map((line)=><div key={line.id}>
      <span><strong>{line.label}</strong><small>{line.category.replaceAll("_"," ")} · {line.source}</small></span>
      <b>{line.direction==="deduction" ? "−" : "+"}{money(line.amount_minor,entry.currency)}</b>
      {line.category!=="base_salary"&&<button type="button" disabled={busy} onClick={()=>onRemove(entry,line)}>Remove</button>}
    </div>)}</div> : <EmptyState compact title="No payroll lines">Add an authoritative line below.</EmptyState>}
    <div className="sec"><span>Add a line</span></div>
    <FieldGroup label="Type"><select className="field" value={category} onChange={(event)=>choose(event.target.value)}>{LINE_TYPES.map(([key,,text])=><option key={key} value={key}>{text}</option>)}</select></FieldGroup>
    {category==="correction"&&<FieldGroup label="Direction"><select className="field" value={direction} onChange={(event)=>setDirection(event.target.value)}><option value="addition">Addition</option><option value="deduction">Deduction</option></select></FieldGroup>}
    <FieldGroup label="Label"><input className="field" value={label} onChange={(event)=>setLabel(event.target.value)} /></FieldGroup>
    <FieldGroup label={`Amount (${entry.currency})`}><input className="field" inputMode="decimal" value={amount} onChange={(event)=>setAmount(event.target.value)} placeholder="0.00" /></FieldGroup>
    <FieldGroup label="Reason / source note"><textarea className="field" rows="3" value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Why this line is authoritative" /></FieldGroup>
  </ComposerDrawer>;
}

function ViewEntrySheet({ entry, onClose }) {
  return <ComposerDrawer
    open
    onClose={onClose}
    title={entry.employee_name}
    description="Protected employee Payroll review. This view does not grant preparation or approval authority."
    footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
  >
    <div className="fpg-payroll-entry-summary">
      <span>Additions <b>{money(entry.additions_minor,entry.currency)}</b></span>
      <span>Deductions <b>{money(entry.deductions_minor,entry.currency)}</b></span>
      <span>Net <b>{money(entry.net_minor,entry.currency)}</b></span>
    </div>
    {entry.flags?.length
      ? <ProductNotice tone="attention" title="Needs review">{entry.flags.map((flag)=>flag.replaceAll("_"," ")).join(" · ")}</ProductNotice>
      : <ProductNotice tone="success" title="No blocking calculation flag">The recorded employee lines are internally consistent.</ProductNotice>}
    <div className="fpg-payroll-lines">{(entry.lines||[]).map((line)=><div key={line.id}>
      <span><strong>{line.label}</strong><small>{line.category.replaceAll("_"," ")} · {line.source}</small></span>
      <b>{line.direction==="deduction" ? "−" : "+"}{money(line.amount_minor,entry.currency)}</b>
    </div>)}</div>
  </ComposerDrawer>;
}

function DecisionSheet({ title, action, busy, onClose, onSave }) {
  const [note,setNote]=useState("");
  const valid=note.trim().length>=3;
  return <ComposerDrawer
    open
    onClose={onClose}
    title={title}
    description="Attributable Payroll decision. Existing preparation and approval authority remains unchanged."
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button onClick={()=>onSave(note)} busy={busy} disabled={!valid}>{action}</Button>
    </>}
  >
    <FieldGroup label="Decision note"><textarea className="field" rows="4" value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Record the reason and review context" /></FieldGroup>
    <p className="screen-note">Approved Payroll is immutable. Corrections create a new attributable successor revision.</p>
  </ComposerDrawer>;
}
