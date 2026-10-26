import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { dateOnly } from "../lib/time";
import { FieldGroup, LoadingState, ProductNotice } from "../components/bits";
import { Button, ComposerDrawer } from "../experience-v2/components";
import { Table } from "../components/primitives";
import { expenseAmountMinor } from "../lib/expenseAmount";
import { WorkPageHeader } from "../experience-v2/work-family/WorkFamilyV2";

// Cost. Spec section 10 — what does this unit cost, and what did it
// produce, on the same screen.
//
// CEAC keeps no digital budget or spend record: it is on paper, collated
// on report days. So this app is the record, not a mirror. Two
// consequences visible here:
//   * spend is entered in batches at collation time, not line by line
//   * every line keeps the paper it came from, so a figure can be traced
// Managers can see their unit's cost. They can never enter money.

const CURRENCIES = [["GHS","GHS — Ghana cedi"],["USD","USD — US dollar"],["GBP","GBP — Pound sterling"],["EUR","EUR — Euro"],["NGN","NGN — Naira"],["ZAR","ZAR — Rand"],["CAD","CAD — Canadian dollar"]];
// Totals are never converted between currencies. A rate moves daily and a
// converted total is a figure nobody can check afterwards. Amounts are
// grouped by currency and shown side by side instead.
const money = (minor, cur) => (cur || "GHS") + " " + (Number(minor || 0) / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toMinor = expenseAmountMinor;
function sumByCurrency(rows) {
  const by = {};
  rows.forEach((r) => { const c = r.currency || "GHS"; by[c] = (by[c] || 0) + Number(r.amount_minor || 0); });
  return by;
}
function showTotals(by) {
  const keys = Object.keys(by);
  if (!keys.length) return "No spending recorded";
  return keys.sort().map((c) => money(by[c], c)).join("  ·  ");
}


export default function Cost({ me }) {
  const [units, setUnits] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [spend, setSpend] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [canEnter, setCanEnter] = useState(false);
  const [open, setOpen] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const mutationBusy = useRef(false);
  const year = new Date().getFullYear();

  // batch entry state
  const [bUnit, setBUnit] = useState("");
  const [bPeriod, setBPeriod] = useState("");
  const [bSource, setBSource] = useState("");
  const [bCur, setBCur] = useState("GHS");
  const [lines, setLines] = useState([{ spent_on: "", description: "", amount: "" }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // budget state
  const [gUnit, setGUnit] = useState(null);
  const [gAmount, setGAmount] = useState("");
  const [gCur, setGCur] = useState("GHS");

  useEffect(() => { load(); }, [me.id, me.org_id]);

  async function load() {
    setLoading(true); setLoadError(null); setCanEnter(false);
    const [us, bs, sp, pr, fin] = await Promise.all([
      supabase.from("units").select("id, name, code, handles_finance").eq("active", true).order("name"),
      supabase.from("budgets").select("id, unit_id, project_id, year, amount_minor, note, currency").eq("year", year),
      supabase.from("spend_lines").select("id, unit_id, period_id, spent_on, description, amount_minor, source_note, entered_at, currency").eq("org_id", me.org_id).gte("spent_on", `${year}-01-01`).lte("spent_on", `${year}-12-31`),
      supabase.from("report_periods").select("id, label, starts_on, ends_on").order("starts_on", { ascending: false }).limit(24),
      supabase.from("unit_memberships").select("unit_id, units(handles_finance)").eq("profile_id", me.id),
    ]);
    if ([us, bs, sp, pr, fin].some(result => result.error)) {
      setUnits([]); setBudgets([]); setSpend([]); setPeriods([]);
      setLoadError("Expenses and budgets could not be verified. Try again before recording a change.");
      setLoading(false); return;
    }
    setUnits(us.data || []); setBudgets(bs.data || []); setSpend(sp.data || []); setPeriods(pr.data || []);
    setCanEnter(me.is_admin || (fin.data || []).some((m) => m.units && m.units.handles_finance));
    setLoading(false);
  }

  const budgetFor = (u) => (budgets.find((b) => b.unit_id === u.id && !b.project_id) || null);
  const spentFor = (u) => spend.filter((s) => s.unit_id === u.id && s.currency === (budgetFor(u) ? budgetFor(u).currency : "GHS")).reduce((t, s) => t + Number(s.amount_minor), 0);

  async function saveBudget() {
    if (mutationBusy.current || busy || loading || loadError || !me.is_admin || !gUnit) return;
    mutationBusy.current = true;
    setBusy(true); setMsg(null);
    try {
      const amount = toMinor(gAmount);
      if (amount === null) throw new Error("Enter a non-negative amount with at most two decimal places, for example 2500.50.");
      const existing = budgetFor(gUnit);
      let saved;
      if (existing) {
        saved = await supabase.from("budgets").update({ amount_minor: amount, currency: gCur, set_by: me.id, set_at: new Date().toISOString() }).eq("id", existing.id).eq("org_id", me.org_id).select("id,amount_minor,currency").single();
      } else {
        saved = await supabase.from("budgets").insert({
          org_id: me.org_id, unit_id: gUnit.id, year, amount_minor: amount, currency: gCur, set_by: me.id }).select("id,amount_minor,currency").single();
      }
      if (saved.error) throw saved.error;
      if (!saved.data?.id || Number(saved.data.amount_minor) !== amount || saved.data.currency !== gCur) throw new Error("The saved budget could not be verified. Review the recorded budget before retrying.");
      setSheet(null); setGAmount(""); setGUnit(null); await load();
    } catch (e) { setMsg(e.message); }
    finally { mutationBusy.current = false; setBusy(false); }
  }

  async function saveBatch() {
    if (mutationBusy.current || busy || loading || loadError || !canEnter) return;
    mutationBusy.current = true;
    setBusy(true); setMsg(null);
    try {
      const entered = lines.filter(l => l.description.trim() || String(l.amount).trim() || l.spent_on);
      if (entered.some(l => !l.description.trim() || !String(l.amount).trim())) throw new Error("Each entered expense needs both a description and an amount.");
      const clean = entered
        .map((l) => ({
          org_id: me.org_id, unit_id: bUnit, period_id: bPeriod || null,
          spent_on: l.spent_on || new Date().toISOString().slice(0, 10),
          description: l.description.trim(), amount_minor: toMinor(l.amount), currency: bCur,
          source_note: bSource.trim() || null, entered_by: me.id,
        }));
      if (!bUnit) throw new Error("Choose which unit this spending belongs to.");
      if (!clean.length) throw new Error("Add at least one line with a description and an amount.");
      if (clean.some((l) => l.amount_minor === null)) throw new Error("Enter non-negative amounts with at most two decimal places. No expense was saved.");
      const { data, error } = await supabase.from("spend_lines").insert(clean).select("id,unit_id,amount_minor,currency");
      if (error) throw error;
      const expected = clean.map(row=>JSON.stringify([row.unit_id,row.amount_minor,row.currency])).sort();
      const recorded = (data || []).filter(row=>row.id).map(row=>JSON.stringify([row.unit_id,Number(row.amount_minor),row.currency])).sort();
      if (JSON.stringify(expected) !== JSON.stringify(recorded)) throw new Error("The saved batch could not be verified. Inspect the recorded expenses before retrying.");
      setSheet(null); setLines([{ spent_on: "", description: "", amount: "" }]); setBSource(""); await load();
    } catch (e) { setMsg(e.message); }
    finally { mutationBusy.current = false; setBusy(false); }
  }

  if (loading) return <div className="body"><LoadingState label="Loading expenses…" /></div>;
  if (loadError) return <div className="body"><ProductNotice tone="error" title="Expenses unavailable" action={<button className="btn btn-ghost" onClick={load}>Try again</button>}>{loadError}</ProductNotice></div>;

  if (open) {
    const u = units.find((x) => x.id === open);
    const rows = spend.filter((s) => s.unit_id === open).sort((a, b) => b.spent_on.localeCompare(a.spent_on));
    return (
      <div className="body">
        <button className="back" onClick={() => setOpen(null)}>← All units</button>
        <h1 className="h1" style={{ marginTop: 6 }}>{u ? u.name : "Unit"}</h1>
        <p className="screen-note">Every line of spending recorded for this unit this year.</p>
        <div className="sec"><span>Spending</span><span>{rows.length}</span></div>
        <Table
          rows={rows}
          empty="Nothing has been entered for this unit yet."
          exportName={`ceac-${(u?.name || "unit").toLowerCase().replace(/[^a-z0-9]+/g,"-")}-spend`}
          columns={[
            { key:"spent_on",label:"Date",width:110,render:(row)=>dateOnly(row.spent_on) },
            { key:"description",label:"What for" },
            { key:"source_note",label:"Source",render:(row)=>row.source_note || "—" },
            { key:"amount_minor",label:"Amount",align:"right",render:(row)=>money(row.amount_minor,row.currency),sortValue:(row)=>Number(row.amount_minor)||0,csv:(row)=>(Number(row.amount_minor)/100).toFixed(2) },
            { key:"currency",label:"Currency",width:90 },
          ]}
        />
      </div>);
  }

  return (
    <div className="body">
      <WorkPageHeader eyebrow="Finance · actual spend" title="Expenses" description="Record departmental spending with its source record. Budgets are plans, not bank balances." />

      {canEnter && (
        <button className="btn wide-auto" style={{ marginTop: 16 }}
          onClick={() => { setSheet("batch"); setMsg(null); }}>Record expenses</button>)}

      <div className="flag flag-green">
        <h4>Where these figures come from</h4>
        Typed in from the paper records on collation day. Each line keeps the book it came from, so any figure here can be traced back and checked.
      </div>

      <div className="sec"><span>Units</span><span>{year}</span></div>
      {units.map((u) => {
        const b = budgetFor(u);
        const spent = spentFor(u);
        const budget = b ? Number(b.amount_minor) : null;
        const cur = b ? b.currency : "GHS";
        const over = budget !== null && spent > budget;
        const pct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : null;
        return (
          <div key={u.id} className="card" style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div className="row-t" style={{ fontSize: 15.5 }}>{u.name}</div>
              {over && <span className="pill p-brick">Over budget</span>}
            </div>
            <div className="row-m" style={{ marginTop: 4 }}>
              {budget === null
                ? "No budget set for " + year + " · " + showTotals(sumByCurrency(spend.filter(row => row.unit_id === u.id)))
                : money(spent, cur) + " spent of " + money(budget, cur) + (pct !== null ? " · " + pct + "%" : "")}
            </div>
            {budget !== null && (
              <div style={{ height: 6, background: "var(--line-soft)", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
                <div style={{ width: (pct || 0) + "%", height: "100%", background: over ? "var(--brick)" : "var(--green)" }} />
              </div>)}
            <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(u.id)}>See spending</button>
              {me.is_admin && (
                <button className="btn btn-ghost btn-sm"
                  onClick={() => { setGUnit(u); setGAmount(b ? String(Number(b.amount_minor) / 100) : ""); setGCur(b?.currency || "GHS"); setSheet("budget"); setMsg(null); }}>
                  {b ? "Change budget" : "Set budget"}</button>)}
            </div>
          </div>);
      })}

      {sheet === "budget" && gUnit && (
        <ComposerDrawer open onClose={() => !busy && setSheet(null)} title={`Budget for ${gUnit.name}`} description={`Planning amount for ${year}. Keep the recorded currency and enter up to two decimal places.`}
          footer={<><Button variant="secondary" disabled={busy} onClick={()=>setSheet(null)}>Cancel</Button><Button onClick={saveBudget} disabled={busy || !gAmount}>{busy?"Saving…":"Save budget"}</Button></>}>
          <FieldGroup label="Budget amount"><input className="field" aria-label="Budget amount" inputMode="decimal" placeholder="Amount" value={gAmount} onChange={(e) => setGAmount(e.target.value)} /></FieldGroup>
          <FieldGroup label="Budget currency"><select className="field" aria-label="Budget currency" value={gCur} onChange={(e) => setGCur(e.target.value)}>
              {CURRENCIES.map(([x]) => <option key={x} value={x}>{x}</option>)}
          </select></FieldGroup>
          {msg && <div className="flag flag-brick" style={{ marginTop: 12 }}>{msg}</div>}
        </ComposerDrawer>)}

      {sheet === "batch" && (
        <ComposerDrawer open onClose={() => !busy && setSheet(null)} title="Record expenses" description="Choose the department and source record, then enter each expense. Currency stays the same throughout this batch."
          footer={<><Button variant="secondary" disabled={busy} onClick={()=>setSheet(null)}>Cancel</Button><Button onClick={saveBatch} disabled={busy}>{busy?"Saving…":"Save this batch"}</Button></>}>
          <FieldGroup label="Department"><select className="field" aria-label="Expense department" value={bUnit} onChange={(e) => setBUnit(e.target.value)}>
            <option value="">Which unit is this spending for</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></FieldGroup>
          <FieldGroup label="Reporting period (optional)"><select className="field" aria-label="Expense reporting period" value={bPeriod} onChange={(e) => setBPeriod(e.target.value)}>
            <option value="">Which reporting period (optional)</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select></FieldGroup>
          <FieldGroup label="Source record"><input className="field" aria-label="Expense source record" placeholder="Which book or paper this came from" value={bSource} onChange={(e) => setBSource(e.target.value)} /></FieldGroup>
          <FieldGroup label="Currency"><select className="field" aria-label="Expense currency" value={bCur} onChange={(e) => setBCur(e.target.value)}>
            {CURRENCIES.map(([x, l]) => <option key={x} value={x}>{l}</option>)}
          </select></FieldGroup>
          <div className="sec"><span>Lines</span><span>{lines.filter((l) => l.description.trim()).length}</span></div>
          {lines.map((l, i) => (
            <div key={i} style={{ borderTop: i ? "1px solid var(--line-soft)" : "none", paddingTop: i ? 8 : 0 }}>
              <input className="field" aria-label={`Expense ${i+1} description`} placeholder="What it was for" value={l.description}
                onChange={(e) => setLines((x) => x.map((v, j) => j === i ? { ...v, description: e.target.value } : v))}
                onBlur={() => { if (l.description.trim() && i === lines.length - 1) setLines((x) => [...x, { spent_on: "", description: "", amount: "" }]); }} />
              <div style={{ display: "flex", gap: 8 }}>
                <input className="field" aria-label={`Expense ${i+1} date`} type="date" value={l.spent_on}
                  onChange={(e) => setLines((x) => x.map((v, j) => j === i ? { ...v, spent_on: e.target.value } : v))} />
                <input className="field" aria-label={`Expense ${i+1} amount`} inputMode="decimal" placeholder="Amount" value={l.amount}
                  onChange={(e) => setLines((x) => x.map((v, j) => j === i ? { ...v, amount: e.target.value } : v))} />
              </div>
            </div>))}
          <div className="card" style={{ marginTop: 10, display: "flex", justifyContent: "space-between" }}>
            <span className="small">Batch total</span>
            <b>{lines.some(l=>l.amount.trim()&&toMinor(l.amount)===null)?"Check entered amounts":money(lines.reduce((t, l) => t + (l.amount ? toMinor(l.amount) || 0 : 0), 0), bCur)}</b>
          </div>
          {msg && <div className="flag flag-brick" style={{ marginTop: 12 }}>{msg}</div>}
          <div className="hint">Check the total against the paper before saving.</div>
        </ComposerDrawer>)}
    </div>);
}
