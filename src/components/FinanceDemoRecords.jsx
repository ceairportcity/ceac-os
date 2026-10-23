import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const kind = { spend_lines: "Spend", budgets: "Budget", finance_requests: "Request" };
const amount = (row) => `${row.currency} ${(Number(row.amount_minor) / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FinanceDemoRecords({ onChanged }) {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saving = useRef(false);
  const key = (row) => `${row.record_table}:${row.record_id}`;

  async function load() {
    setLoading(true); setError("");
    try {
      const result = await supabase.rpc("admin_finance_demo_records");
      if (result.error) throw result.error;
      setRecords(result.data || []);
    } catch (failure) {
      setRecords([]); setSelected([]);
      setError(failure.message || "Demo records could not be loaded.");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    if (saving.current) return;
    const archive = event.nativeEvent.submitter?.value === "archive";
    const chosen = records.filter((row) => selected.includes(key(row)));
    if (!chosen.length) { setError("Select the records to classify."); return; }
    if (chosen.some((row) => row.is_demo === archive)) {
      setError("Select only live records to archive, or archived records to restore."); return;
    }
    if (reason.trim().length < 10) { setError("Record a reason of at least 10 characters."); return; }
    saving.current = true; setBusy(true); setError(""); setNotice("");
    let changed = false;
    let failureMessage = "";
    try {
      for (const row of chosen) {
        const result = await supabase.rpc("admin_set_finance_demo_record", {
          p_table: row.record_table, p_id: row.record_id, p_is_demo: archive,
          p_expected_fingerprint: row.fingerprint, p_expected_event_no: row.event_no,
          p_reason: reason.trim(),
        });
        if (result.error) throw result.error;
        changed = true;
      }
      setSelected([]);
    } catch (failure) {
      failureMessage = failure.message || "The classification could not be recorded. Refresh and review the records.";
    } finally {
      setSelected([]); await load();
      if (changed) await onChanged();
      if (failureMessage) setError(failureMessage);
      else setNotice(archive ? "Selected demo records are archived and excluded from live finance." : "Selected records are restored to live finance.");
      saving.current = false; setBusy(false);
    }
  }

  return <section aria-label="Demonstration finance records" aria-busy={loading || busy}>
    <h2>Demo finance records</h2>
    <p className="screen-note">Archived demo records stay here for review and restoration. They are excluded from live totals and cannot be approved or recorded as spent. A demo title only suggests a record for review.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading demo records…</p> : <form method="post" onSubmit={save}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <legend>Choose records</legend>
        {!records.length && <p>No demo finance records to review.</p>}
        {records.map((row) => <div className="row" key={key(row)}>
          <label style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBlock: 12 }}>
            <input type="checkbox" name="records" value={key(row)} checked={selected.includes(key(row))}
              onChange={(event) => setSelected((current) => event.target.checked ? [...current, key(row)] : current.filter((value) => value !== key(row)))} />
            <span><strong>{row.description}</strong><br />{kind[row.record_table]} · {amount(row)} · {row.is_demo ? "Archived demo" : "Included in live records"}
              {row.reason && <><br />Last reason: {row.reason}</>}</span>
          </label>
        </div>)}
        <label htmlFor="finance-demo-reason">Reason for this classification (required)</label>
        <textarea id="finance-demo-reason" className="field" name="reason" required minLength={10} maxLength={1000}
          value={reason} onChange={(event) => setReason(event.target.value)} style={{ fontSize: "1rem" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="btn" type="submit" value="archive">{busy ? "Recording…" : "Archive selected demo records"}</button>
          <button className="btn secondary" type="submit" value="restore">Restore selected records</button>
        </div>
      </fieldset>
    </form>}
    {!loading && <button className="btn secondary" type="button" onClick={load} disabled={busy}>Refresh demo records</button>}
  </section>;
}
