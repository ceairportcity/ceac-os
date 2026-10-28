import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { dateOnly } from "../lib/time";
import { Sheet, ProgressMeter, ProductNotice } from "../components/bits";
import FinanceRequestQueue from "../components/FinanceRequestQueue";
import AdminFinanceRequests from "../components/AdminFinanceRequests";
import FinanceDemoRecords from "../components/FinanceDemoRecords";
import { Table } from "../components/primitives";
import { Button, ComposerDrawer, Skeleton, StatePanel } from "../experience-v2/components";
import { FinanceCurrencyCard, FinanceEmpty, FinanceFootnote, FinancePageHeader, FinanceRecordRow, FinanceSection, FinanceTabs } from "../experience-v2/finance-family/FinanceFamilyV2";
import { CeacIcon } from "../experience-v2/icons";
import { expenseAmountMinor } from "../lib/expenseAmount";

// Finance — the whole church in one place. In, out, and what is moving
// between departments.
//
// Nothing here can be edited or deleted. A wrong figure is corrected by
// adding a reversing entry that points at the original, and both stay
// visible. Every entry keeps who recorded it and when, so a question in
// six months has a name and a date attached.
const CURRENCIES = [["GHS","GHS — Ghana cedi"],["USD","USD — US dollar"],["GBP","GBP — Pound sterling"],["EUR","EUR — Euro"],["NGN","NGN — Naira"],["ZAR","ZAR — Rand"],["CAD","CAD — Canadian dollar"]];
// Totals are never converted between currencies. A rate moves daily and a
// converted total is a figure nobody can check afterwards. Amounts are
// grouped by currency and shown side by side instead.
const money = (minor, cur) => (cur || "GHS") + " " + (Number(minor || 0) / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toMinor = expenseAmountMinor;
function sumByCurrency(rows, { reversals = false } = {}) {
  const by = {};
  rows.forEach((r) => {
    const c = r.currency || "GHS";
    const amount = Number(r.amount_minor || 0);
    by[c] = (by[c] || 0) + (reversals && r.reverses_id ? -amount : amount);
  });
  return by;
}
function showTotals(by) {
  const keys = Object.keys(by);
  if (!keys.length) return money(0, "GHS");
  return keys.sort().map((c) => money(by[c], c)).join("  ·  ");
}

const TABS = [["overview","Overview"],["in","Money in"],["out","Money out"],["moving","Between departments"]];
const SOURCES = [["offering","Offering"],["partnership","Partnership"],["donation","Donation"],["event","Event"],["other","Other"]];
const MONTHS = ["J","F","M","A","M","J","J","A","S","O","N","D"];

export default function Finance({ me, openExpenses }) {
  const [tab, setTab] = useState("overview");
  const [units, setUnits] = useState([]);
  const [income, setIncome] = useState([]);
  const [spend, setSpend] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [demoRevision, setDemoRevision] = useState(0);
  const [canEnter, setCanEnter] = useState(false);
  const [myUnits, setMyUnits] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const mutationBusy = useRef(false);
  const [movementView,setMovementView] = useState("chart");
  const year = new Date().getFullYear();

  const [iDate, setIDate] = useState("");
  const [iKind, setIKind] = useState("offering");
  const [iDesc, setIDesc] = useState("");
  const [iAmount, setIAmount] = useState("");
  const [iSource, setISource] = useState("");
  const [iCur, setICur] = useState("GHS");

  const [tFrom, setTFrom] = useState("");
  const [tTo, setTTo] = useState("");
  const [tAmount, setTAmount] = useState("");
  const [tPurpose, setTPurpose] = useState("");
  const [tDate, setTDate] = useState("");
  const [tCur, setTCur] = useState("GHS");

  useEffect(() => { load(); }, []);

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.all([
        supabase.from("units").select("id, name, code, handles_finance").eq("active", true).order("name"),
        supabase.from("income_lines").select("id, received_on, source_kind, description, amount_minor, source_note, reverses_id, entered_at, currency"),
        supabase.from("spend_lines").select("id, unit_id, spent_on, description, amount_minor, source_note, reverses_id, currency"),
        supabase.from("internal_transfers").select("id, from_unit_id, to_unit_id, amount_minor, sent_on, purpose, state, response_note, sent_at, currency"),
        supabase.from("budgets").select("unit_id, project_id, year, amount_minor, currency").eq("year", year),
        supabase.from("unit_memberships").select("unit_id, role, units(name, handles_finance)").eq("profile_id", me.id),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      const [us, inc, sp, tr, bg, mem] = results;
      setUnits(us.data || []); setIncome(inc.data || []); setSpend(sp.data || []);
      setTransfers(tr.data || []); setBudgets(bg.data || []);
      const mine = (mem.data || []);
      setMyUnits(mine.filter((m) => m.role === "manager").map((m) => m.unit_id));
      setCanEnter(me.is_admin || mine.some((m) => m.units && m.units.handles_finance));
    } catch (error) {
      setLoadError(error?.message || "Finance records could not be loaded.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  const nameOf = (id) => { const u = units.find((x) => x.id === id); return u ? u.name : "Central church funds"; };
  const annualIncome = income.filter(row=>String(row.received_on).startsWith(`${year}-`));
  const annualSpend = spend.filter(row=>String(row.spent_on).startsWith(`${year}-`));
  const inBy = sumByCurrency(annualIncome,{reversals:true}), outBy = sumByCurrency(annualSpend, { reversals: true }), budBy = sumByCurrency(budgets);
  const diffBy = {};
  [...new Set([...Object.keys(inBy), ...Object.keys(outBy)])].forEach((c) => { diffBy[c] = (inBy[c] || 0) - (outBy[c] || 0); });
  const unconfirmed = transfers.filter((t) => t.state === "sent");
  const disputed = transfers.filter((t) => t.state === "disputed");
  const financeCurrencies = [...new Set([...Object.keys(inBy), ...Object.keys(outBy), ...Object.keys(budBy)])].sort();
  const focalCurrency = financeCurrencies.includes("GHS") ? "GHS" : (financeCurrencies[0] || "GHS");
  const movement = Array.from({ length: 12 }, (_, month) => ({ month, received: 0, spent: 0 }));
  annualIncome.filter((row) => (row.currency || "GHS") === focalCurrency).forEach((row) => {
    const month = Number(String(row.received_on || "").slice(5, 7)) - 1;
    if (month >= 0 && month < 12) movement[month].received += row.reverses_id ? -Number(row.amount_minor || 0) : Number(row.amount_minor || 0);
  });
  annualSpend.filter((row) => (row.currency || "GHS") === focalCurrency).forEach((row) => {
    const month = Number(String(row.spent_on || "").slice(5, 7)) - 1;
    if (month >= 0 && month < 12) movement[month].spent += row.reverses_id ? -Number(row.amount_minor || 0) : Number(row.amount_minor || 0);
  });
  const movementValues = movement.flatMap((row) => [row.received, row.spent, 0]);
  const movementLow = Math.min(...movementValues);
  const movementHigh = Math.max(...movementValues);
  const movementSpan = Math.max(1, movementHigh - movementLow);
  const chartY = (value) => 86 - ((Number(value || 0) - movementLow) / movementSpan) * 72;
  const chartX = (month) => 4 + (month * 92 / 11);
  const receivedPoints = movement.map((row) => chartX(row.month).toFixed(2)+","+chartY(row.received).toFixed(2)).join(" ");
  const spentPoints = movement.map((row) => chartX(row.month).toFixed(2)+","+chartY(row.spent).toFixed(2)).join(" ");
  const zeroY = chartY(0).toFixed(2);
  const hasFocalReceived = Object.prototype.hasOwnProperty.call(inBy, focalCurrency);
  const hasFocalSpent = Object.prototype.hasOwnProperty.call(outBy, focalCurrency);
  const hasFocalBudget = Object.prototype.hasOwnProperty.call(budBy, focalCurrency);
  const overviewMetrics = [
    { label: "Recorded position", icon: "finance", value: (hasFocalReceived || hasFocalSpent) ? money(Number(inBy[focalCurrency] || 0) - Number(outBy[focalCurrency] || 0), focalCurrency) : "Not recorded", detail: "Recorded in minus recorded out" },
    { label: "Money received", icon: "record", value: hasFocalReceived ? money(inBy[focalCurrency], focalCurrency) : "Not recorded", detail: String(year) },
    { label: "Money spent", icon: "budget", value: hasFocalSpent ? money(outBy[focalCurrency], focalCurrency) : "Not recorded", detail: String(year) },
    { label: "Recorded budget", icon: "chart", value: hasFocalBudget ? money(budBy[focalCurrency], focalCurrency) : "Not recorded", detail: String(year) },
  ];
  const recentFinance = [
    ...income.map((row) => ({ id: "in-" + row.id, date: row.received_on, label: row.description, kind: "Received", amount: row.amount_minor, currency: row.currency || "GHS" })),
    ...spend.map((row) => ({ id: "out-" + row.id, date: row.spent_on, label: row.description, kind: row.reverses_id ? "Spend correction" : "Spent", amount: row.reverses_id ? -Number(row.amount_minor || 0) : row.amount_minor, currency: row.currency || "GHS" })),
  ].filter((row) => row.date).sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0, 7);

  async function saveIncome() {
    if (mutationBusy.current || busy || loading || loadError || !canEnter) return;
    mutationBusy.current = true;
    setBusy(true); setMsg(null);
    try {
      if (!iDesc.trim()) throw new Error("Say what this money was.");
      const amount = toMinor(iAmount);
      if (amount === null || amount <= 0) throw new Error("Enter a positive amount with at most two decimal places.");
      const { error } = await supabase.from("income_lines").insert({
        org_id: me.org_id, received_on: iDate || new Date().toISOString().slice(0, 10),
        source_kind: iKind, description: iDesc.trim(), amount_minor: amount,
        source_note: iSource.trim() || null, currency: iCur, entered_by: me.id });
      if (error) throw error;
      setSheet(null); setIDesc(""); setIAmount(""); setISource(""); await load();
    } catch (e) { setMsg(e.message); } finally { mutationBusy.current = false; setBusy(false); }
  }

  async function saveTransfer() {
    if (mutationBusy.current || busy || loading || loadError || !(canEnter || myUnits.length)) return;
    mutationBusy.current = true;
    setBusy(true); setMsg(null);
    try {
      if (!tTo) throw new Error("Choose which department is receiving.");
      if (tFrom && tFrom === tTo) throw new Error("A department cannot send money to itself.");
      const amount = toMinor(tAmount);
      if (amount === null || amount <= 0) throw new Error("Enter a positive amount with at most two decimal places.");
      if (!tPurpose.trim()) throw new Error("Say what the money is for.");
      const { error } = await supabase.from("internal_transfers").insert({
        org_id: me.org_id, from_unit_id: tFrom || null, to_unit_id: tTo,
        amount_minor: amount, sent_on: tDate || new Date().toISOString().slice(0, 10),
        purpose: tPurpose.trim(), currency: tCur, sent_by: me.id });
      if (error) throw error;
      setSheet(null); setTAmount(""); setTPurpose(""); await load();
    } catch (e) { setMsg(e.message); } finally { mutationBusy.current = false; setBusy(false); }
  }

  async function respond(t, state, note) {
    const { error } = await supabase.from("internal_transfers").update({
      state, responded_by: me.id, responded_at: new Date().toISOString(),
      response_note: note || null }).eq("id", t.id);
    if (error) {
      setMsg(error.message || "The transfer decision could not be saved.");
      return;
    }
    await load();
  }

  if (loading) return (
    <div className="body ev2-finance-page ev2-finance-admin" aria-busy="true">
      <FinancePageHeader
        eyebrow="Organisation finance"
        title="Finance"
        description="Administration view of requests, recorded income, spend, budgets and two-sided transfers. Currencies stay separate and recorded position is not a bank balance."
        statusLabel="Loading records"
        statusTone="neutral"
      />
      <div className="ev2fin-loading" aria-label="Loading finance">
        <Skeleton variant="block" height="5rem" />
        <Skeleton variant="block" height="10rem" />
        <Skeleton variant="block" height="8rem" />
      </div>
    </div>
  );

  if (loadError) return (
    <div className="body ev2-finance-page ev2-finance-admin">
      <FinancePageHeader
        eyebrow="Organisation finance"
        title="Finance"
        description="Administration view of requests, recorded income, spend, budgets and two-sided transfers. Currencies stay separate and recorded position is not a bank balance."
        statusLabel="Records unavailable"
        statusTone="danger"
      />
      <div className="ev2fin-state">
        <StatePanel
          state="error"
          title="Finance records could not be loaded"
          description="No finance figures are being shown because the current records could not be retrieved."
          actionLabel="Try again"
          onAction={load}
          icon="finance"
        />
      </div>
    </div>
  );

  return (
    <div className="body ev2-finance-page ev2-finance-admin">
      <FinancePageHeader
        eyebrow="Organisation finance"
        title="Finance"
        description="Administration view of requests, recorded income, spend, budgets and two-sided transfers. Currencies stay separate and recorded position is not a bank balance."
        statusLabel={financeCurrencies.length ? financeCurrencies.length+" currencies recorded" : "No position recorded"}
        statusTone="neutral"
      />
      <FinanceTabs items={TABS} value={tab} onChange={setTab} label="Administration finance sections" />
      {msg&&!sheet&&<ProductNotice tone="error" title="Finance action could not be confirmed">{msg}</ProductNotice>}
      {me.is_admin && <AdminFinanceRequests key={`${me.org_id}:${me.id}`} me={me} units={units.filter(unit=>myUnits.includes(unit.id))} />}
      {me.is_admin && <Button variant="secondary" onClick={() => setSheet("demo")}>Review demo finance records</Button>}

      {tab === "overview" && (<>
        <section className="fpg-finance-dashboard" aria-label="Recorded finance overview">
          <div className="fpg-finance-metrics">
            {overviewMetrics.map((metric,index) => <button type="button" className="fpg-finance-metric" key={metric.label} aria-label={`Inspect ${metric.label.toLowerCase()}`} onClick={()=>index===0?setMovementView("table"):index===1?setTab("in"):index===2?setTab("out"):openExpenses?.()}>
              <div><span><CeacIcon name={metric.icon} size={14} decorative />{metric.label}</span><small>{focalCurrency}</small></div>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
            </button>)}
          </div>

          <div className="fpg-finance-grid">
            <article className="fpg-finance-panel fpg-finance-trend">
              <header><div><span>Recorded movement</span><h2>{focalCurrency} monthly activity</h2></div><small>{year}</small></header>
              <Button variant="secondary" size="compact" onClick={()=>setMovementView(current=>current==="chart"?"table":"chart")}>{movementView==="chart"?"Show monthly table":"Show monthly chart"}</Button>
              {movementView==="table"?<Table rows={movement} exportName={`ceac-monthly-${focalCurrency}-${year}`} columns={[{key:"month",label:"Month",render:row=>new Date(Date.UTC(year,row.month,1)).toLocaleDateString("en-GB",{month:"long",timeZone:"UTC"})},{key:"received",label:`Received (${focalCurrency})`,align:"right",render:row=>money(row.received,focalCurrency)},{key:"spent",label:`Spent (${focalCurrency})`,align:"right",render:row=>money(row.spent,focalCurrency)}]}/>:<>
              <div className="fpg-finance-legend"><span><i className="is-in" />Received</span><span><i className="is-out" />Spent</span></div>
              <div className="fpg-finance-chart" role="img" aria-label={"Monthly recorded received and spent movement in " + focalCurrency}>
                <svg viewBox="0 0 100 92" preserveAspectRatio="none" aria-hidden="true">
                  {[14,32,50,68,86].map((y) => <line key={y} x1="4" x2="96" y1={y} y2={y} vectorEffect="non-scaling-stroke" />)}
                  <polygon className="is-in-area" points={"4,"+zeroY+" "+receivedPoints+" 96,"+zeroY} />
                  <polyline className="is-in-line" points={receivedPoints} vectorEffect="non-scaling-stroke" />
                  <polyline className="is-out-line" points={spentPoints} vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="fpg-finance-months">{MONTHS.map((month, index) => <span key={index}>{month}</span>)}</div>
              </div>
              </>}
              <p>Truthful recorded activity only. This is not a bank balance and currencies are never combined.</p>
            </article>

            <article className="fpg-finance-panel fpg-finance-budget">
              <header><div><span>Budget overview</span><h2>Spend against recorded budget</h2></div></header>
              <div className="fpg-budget-list">
                {financeCurrencies.map((currency) => {
                  const budgeted = Number(budBy[currency] || 0);
                  const spent = Number(outBy[currency] || 0);
                  const pct = budgeted > 0 ? Math.min(100, Math.round(spent / budgeted * 100)) : 0;
                  return <div key={currency}><div><strong>{currency}</strong><span>{budgeted ? pct + "%" : "No budget"}</span></div><i><b style={{width:pct + "%"}} /></i><small>{budgeted ? money(spent,currency) + " of " + money(budgeted,currency) : "No authoritative budget recorded"}</small></div>;
                })}
                {!financeCurrencies.length && <p className="fpg-finance-empty">No budget records are available.</p>}
              </div>
            </article>

            <article className="fpg-finance-panel fpg-finance-recent">
              <header><div><span>Ledger</span><h2>Recent records</h2></div></header>
              <div className="fpg-recent-table">
                <div className="fpg-recent-head"><span>Date</span><span>Description</span><span>Type</span><span>Amount</span></div>
                {recentFinance.map((row) => <div className="fpg-recent-row" key={row.id}><span>{dateOnly(row.date)}</span><strong>{row.label}</strong><span>{row.kind}</span><b>{money(row.amount,row.currency)}</b></div>)}
                {!recentFinance.length && <p className="fpg-finance-empty">No recent finance records.</p>}
              </div>
            </article>
          </div>
        </section>
        <div className="ev2fin-authority"><FinanceRequestQueue key={demoRevision} me={me} authority="admin" canFulfil title="Requests needing Administration" /></div>
        {(unconfirmed.length > 0 || disputed.length > 0) && <ProductNotice tone="attention" title={disputed.length ? "Transfers need review" : "Transfers awaiting confirmation"}>
          {unconfirmed.length} transfer{unconfirmed.length === 1 ? "" : "s"} not yet confirmed{disputed.length ? " · "+disputed.length+" disputed" : ""}. Money is only treated as confirmed once the receiving department confirms it.
        </ProductNotice>}
        <div className="ev2fin-admin-overview-grid">
        <FinanceSection eyebrow={String(year)} title="Financial position by currency" description="Confirmed income, recorded spend and recorded budgets remain separated by currency.">
        <div className="ev2fin-card-grid">
          {financeCurrencies.length === 0 && <FinanceEmpty title="No finance records yet" description="Income, spend and budget records will build this view automatically." />}
          {financeCurrencies.map((currency) => {
            const received = Number(inBy[currency] || 0);
            const spent = Number(outBy[currency] || 0);
            const hasBudget = budgets.some((budget) => (budget.currency || "GHS") === currency);
            const budgeted = Number(budBy[currency] || 0);
            const difference = received - spent;
            return <FinanceCurrencyCard key={currency} currency={currency} contextLabel={String(year)} facts={[
              {label:"Received",value:money(received,currency),onClick:()=>setTab("in")},
              {label:"Spent",value:money(spent,currency),onClick:()=>setTab("out")},
              {label:"Budgeted",value:hasBudget ? money(budgeted,currency) : "Not recorded",detail:hasBudget ? null : "No budget recorded for this currency"},
              {label:"Recorded in minus out",value:money(difference,currency)},
            ]}>
              {budgeted > 0 && <ProgressMeter value={spent} max={budgeted} label="Spend against recorded budget" detail={money(spent,currency) + " of " + money(budgeted,currency)} />}
              {budgeted > 0 && spent > budgeted && <ProductNotice tone="attention" title="Recorded spend is above recorded budget">Open the department movement below before drawing a conclusion.</ProductNotice>}
            </FinanceCurrencyCard>;
          })}
        </div>
        <FinanceFootnote>Recorded in minus recorded out is not a bank balance and does not include opening balances or unrecorded activity. Currencies are never converted into one another.</FinanceFootnote>
        </FinanceSection>

        <FinanceSection eyebrow="Departments" title="Where money is moving" description="Recorded spend, recorded budget and confirmed internal receipts by department.">
        <div className="ev2fin-list">
        {units.map((u) => {
          const outB = sumByCurrency(spend.filter((s) => s.unit_id === u.id), { reversals: true });
          const gotB = sumByCurrency(transfers.filter((x) => x.to_unit_id === u.id && x.state === "confirmed"));
          const budB = sumByCurrency(budgets.filter((b) => b.unit_id === u.id));
          const out = Object.keys(outB).length, got = Object.keys(gotB).length, bud = Object.keys(budB).length;
          if (!out && !got && !bud) return null;
          return <FinanceRecordRow
            key={u.id}
            eyebrow="Department"
            title={u.name}
            meta={showTotals(outB)+" spent"}
            note={(bud ? showTotals(budB)+" budget recorded" : "No budget recorded")+" · "+(got ? showTotals(gotB)+" confirmed transfers received" : "No confirmed transfers received")}
          />;
        })}
        </div>
        {units.every((u) => !spend.some((s) => s.unit_id === u.id)) && <FinanceEmpty title="No department spend recorded" description="Expense entries will appear here once they are recorded against a department." />}
        </FinanceSection>
        </div>
      </>)}

      {tab === "in" && (<>
        {canEnter && <div className="ev2fin-actions"><Button icon="create" onClick={() => { setSheet("income"); setMsg(null); }}>Record money received</Button></div>}
        <FinanceSection eyebrow="Ledger" title="Money received" meta={showTotals(sumByCurrency(income,{reversals:true}))} description="External income records stay attributable and append-only; corrections remain visible as separate records.">
          <div className="ev2fin-list">
          {income.sort((a, b) => b.received_on.localeCompare(a.received_on)).map((r) => (
            <FinanceRecordRow
              key={r.id}
              eyebrow={(SOURCES.find((s) => s[0] === r.source_kind) || ["", r.source_kind])[1]}
              title={r.description}
              meta={money(r.amount_minor, r.currency)}
              note={dateOnly(r.received_on)+(r.source_note ? " · from "+r.source_note : "")}
              statusLabel={r.reverses_id ? "Correction" : null}
              statusTone={r.reverses_id ? "warning" : "neutral"}
            />
          ))}
          </div>
          {income.length === 0 && <FinanceEmpty title="No money received recorded" description="Offerings, partnerships, donations and event income will appear here once recorded." />}
        </FinanceSection>
      </>)}

      {tab === "out" && (<>
        <FinanceSection eyebrow="Ledger" title="Money spent" meta={showTotals(sumByCurrency(spend,{reversals:true}))} description="Actual spend remains separate from requests, approved commitments and transfers.">
          {openExpenses && <div className="ev2fin-actions"><Button variant="secondary" onClick={openExpenses}>Open Expenses</Button></div>}
          <div className="ev2fin-table-wrap">
          <Table exportName="ceac-spending" rows={spend} empty="Nothing recorded yet."
            columns={[
              { key: "spent_on", label: "Date", width: 104, render: (r) => dateOnly(r.spent_on) },
              { key: "description", label: "What for" },
              { key: "unit_id", label: "Department", render: (r) => nameOf(r.unit_id) },
              { key: "source_note", label: "From", render: (r) => r.source_note || "—" },
              { key: "amount_minor", label: "Amount", align: "right",
                render: (r) => money(r.amount_minor, r.currency),
                sortValue: (r) => Number(r.amount_minor) || 0,
                csv: (r) => (Number(r.amount_minor) / 100).toFixed(2) },
            ]} />
          </div>
        </FinanceSection>
      </>)}

      {tab === "moving" && (<>
        {(canEnter || myUnits.length > 0) && <div className="ev2fin-actions"><Button icon="create" onClick={() => { setSheet("transfer"); setMsg(null); }}>Record money sent</Button></div>}
        <ProductNotice tone="success" title="Two-sided transfer confirmation">The sending department records the transfer. Only the receiving department can confirm it. Until both sides agree it remains unconfirmed and both records stay visible.</ProductNotice>
        <FinanceSection eyebrow="Transfers" title="Between departments" meta={transfers.length+" records"} description="Sent, confirmed and disputed states stay explicit; unconfirmed transfers are not counted as confirmed money in.">
          <div className="ev2fin-list">
          {transfers.sort((a, b) => b.sent_on.localeCompare(a.sent_on)).map((t) => {
            const mineToConfirm = t.state === "sent" && (me.is_admin || myUnits.includes(t.to_unit_id));
            return <FinanceRecordRow
              key={t.id}
              eyebrow={dateOnly(t.sent_on)}
              title={nameOf(t.from_unit_id)+" → "+nameOf(t.to_unit_id)}
              meta={money(t.amount_minor, t.currency)+" · "+t.purpose}
              note={t.response_note ? "Response: "+t.response_note : null}
              statusLabel={t.state === "confirmed" ? "Confirmed by them" : t.state === "disputed" ? "They disagree" : "Waiting for them to confirm"}
              statusTone={t.state === "confirmed" ? "success" : t.state === "disputed" ? "danger" : "warning"}
            >
              {mineToConfirm && <>
                <Button variant="quiet" onClick={() => { const n = prompt("What is different? Both accounts stay visible."); if (n) respond(t, "disputed", n); }}>That is not right</Button>
                <Button onClick={() => respond(t, "confirmed")}>We received this</Button>
              </>}
            </FinanceRecordRow>;
          })}
          </div>
          {transfers.length === 0 && <FinanceEmpty title="No department transfers recorded" description="Internal transfers will appear here when recorded." />}
        </FinanceSection>
        <FinanceFootnote>Confirmation is two-sided. A sent or disputed transfer is not treated as confirmed money received.</FinanceFootnote>
      </>)}

      <FinanceFootnote>Finance records are factual ledger context. Income, spend, commitments and transfers remain traceable, currencies are never converted, and corrections do not erase original entries.</FinanceFootnote>

      {sheet === "income" && (
        <ComposerDrawer open onClose={() => !busy && setSheet(null)} title="Record money received" description="Record external income with its date, currency and source. Recorded entries stay in history." footer={<><Button variant="secondary" disabled={busy} onClick={()=>setSheet(null)}>Cancel</Button><Button disabled={busy} onClick={saveIncome}>{busy?"Saving…":"Record income"}</Button></>}>
          <select className="field" aria-label="Income type" value={iKind} onChange={(e) => setIKind(e.target.value)}>
            {SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className="field" aria-label="Income description" placeholder="What this money was" value={iDesc} onChange={(e) => setIDesc(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <input className="field" aria-label="Income date" type="date" value={iDate} onChange={(e) => setIDate(e.target.value)} />
            <input className="field" aria-label="Income amount" inputMode="decimal" placeholder="Amount" value={iAmount} onChange={(e) => setIAmount(e.target.value)} />
            <select className="field" aria-label="Income currency" value={iCur} onChange={(e) => setICur(e.target.value)} style={{ maxWidth: 110 }}>
              {CURRENCIES.map(([c]) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input className="field" aria-label="Income source record" placeholder="Which book or record this came from" value={iSource} onChange={(e) => setISource(e.target.value)} />
          {msg && <div className="flag flag-brick" style={{ marginTop: 12 }}>{msg}</div>}
        </ComposerDrawer>)}

      {sheet === "demo" && me.is_admin && <Sheet onClose={() => setSheet(null)}><FinanceDemoRecords onChanged={async () => { await load({ quiet: true }); setDemoRevision((value) => value + 1); }} /></Sheet>}

      {sheet === "transfer" && (
        <ComposerDrawer open onClose={() => !busy && setSheet(null)} title="Record money sent" description="The receiving department must separately confirm this record. Recorded entries stay in history." footer={<><Button variant="secondary" disabled={busy} onClick={()=>setSheet(null)}>Cancel</Button><Button disabled={busy} onClick={saveTransfer}>{busy?"Saving…":"Record transfer"}</Button></>}>
          <select className="field" aria-label="Sending department" value={tFrom} onChange={(e) => setTFrom(e.target.value)}>
            <option value="">From central church funds</option>
            {units.filter((u) => me.is_admin || canEnter || myUnits.includes(u.id)).map((u) => <option key={u.id} value={u.id}>From {u.name}</option>)}
          </select>
          <select className="field" aria-label="Receiving department" value={tTo} onChange={(e) => setTTo(e.target.value)}>
            <option value="">Which department is receiving</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input className="field" aria-label="Transfer purpose" placeholder="What the money is for" value={tPurpose} onChange={(e) => setTPurpose(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <input className="field" aria-label="Transfer date" type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} />
            <input className="field" aria-label="Transfer amount" inputMode="decimal" placeholder="Amount" value={tAmount} onChange={(e) => setTAmount(e.target.value)} />
            <select className="field" aria-label="Transfer currency" value={tCur} onChange={(e) => setTCur(e.target.value)} style={{ maxWidth: 110 }}>
              {CURRENCIES.map(([c]) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {msg && <div className="flag flag-brick" style={{ marginTop: 12 }}>{msg}</div>}
        </ComposerDrawer>)}
    </div>);
}
