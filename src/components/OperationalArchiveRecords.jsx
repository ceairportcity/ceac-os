import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const kinds = { projects: "Project", work_items: "Work", report_periods: "Reporting period", announcements: "Announcement", learning_courses: "Course", asset_items: "Asset", appraisal_cycles: "Appraisal cycle", meeting_sessions: "Meeting", compliance_policy_versions: "Policy version", strategy_nodes: "Ministry objective" };
const key = (row) => `${row.record_table}:${row.record_id}`;

export default function OperationalArchiveRecords({ onChanged }) {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState([]);
  const [reason, setReason] = useState("");
  const [canonical, setCanonical] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saving = useRef(false);
  const loadSequence = useRef(0);

  async function load() {
    const request = ++loadSequence.current;
    setLoading(true); setError("");
    try {
      const result = await supabase.rpc("admin_operational_archive_records");
      if (result.error) throw result.error;
      if (request !== loadSequence.current) return;
      setRecords(result.data || []); setSelected([]);
    } catch (failure) {
      if (request !== loadSequence.current) return;
      setRecords([]); setSelected([]); setError(failure.message || "Archive records could not be loaded.");
    } finally { if (request === loadSequence.current) setLoading(false); }
  }
  useEffect(() => { load(); return () => { loadSequence.current += 1; }; }, []);

  async function save(event) {
    event.preventDefault();
    if (saving.current || loading) return;
    const action = event.nativeEvent.submitter?.value;
    const archive = action !== "restore";
    const chosen = records.filter((row) => selected.includes(key(row)));
    setError(""); setNotice("");
    if (!chosen.length) { setError("Select the records to review."); return; }
    if (chosen.some((row) => row.archived === archive)) {
      setError("Choose live records to archive or archived records to restore."); return;
    }
    if (reason.trim().length < 10) { setError("Record a reason of at least 10 characters."); return; }
    if (action === "reconcile" && (chosen.length !== 1 || chosen[0].record_table !== "report_periods" || !canonical)) {
      setError("Choose one duplicate reporting period and its canonical period."); return;
    }
    saving.current = true; setBusy(true);
    try {
      const result = await supabase.rpc("admin_apply_operational_archive", {
        p_changes: chosen.map((row) => ({ record_table: row.record_table, record_id: row.record_id,
          archived: archive, fingerprint: row.fingerprint, event_no: row.event_no,
          canonical_period_id: action === "reconcile" ? canonical : null })),
        p_reason: reason.trim(),
      });
      if (result.error) throw result.error;
      await load();
      await onChanged();
      setNotice(action === "reconcile" ? "Duplicate period reconciled. Its original record is retained here."
        : archive ? "Selected demo records archived. Original records and history are retained."
          : "Selected records restored to live use.");
    } catch (failure) {
      setError(failure.message || "The archive change could not be recorded. Refresh and review the records.");
    } finally { saving.current = false; setBusy(false); }
  }

  return <section aria-label="Operational archive review" aria-busy={loading || busy}>
    <h2>Demo work & reporting archives</h2>
    <p className="screen-note">Review confirmed demonstration work, announcements, courses, assets, meetings, policy versions, ministry objectives and appraisal cycles here. Original learning, acknowledgement, custody and review histories are retained. Only content covered by your existing administration access is listed. Archive preserves their original states and history; restore makes them available again. A demo title is a review suggestion. Duplicate periods keep their canonical link; a duplicate containing reports requires a separate report review.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading archive records…</p> : <form method="post" onSubmit={save}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <legend>Choose records</legend>
        {!records.length && <p>No operational records to review.</p>}
        {records.map((row) => <div className="row" key={key(row)}>
          <label style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBlock: 12 }}>
            <input type="checkbox" name="records" checked={selected.includes(key(row))}
              onChange={(event) => setSelected((values) => event.target.checked ? [...values, key(row)] : values.filter((value) => value !== key(row)))} />
            <span><strong>{row.label}</strong><br />{kinds[row.record_table]} · {row.status} · {row.archived ? row.canonical_period_id ? "Reconciled duplicate" : "Archived demo" : "Included in live records"}
              {row.canonical_period_id && <><br />Canonical period: {records.find((item) => item.record_id === row.canonical_period_id)?.label || row.canonical_period_id}</>}
              {row.reason && <><br />Last reason: {row.reason}</>}</span>
          </label>
          {row.retained_reports?.length > 0 && <details><summary>{row.retained_reports.length} retained report(s)</summary>
            {row.retained_reports.map((report) => <article key={report.id}>
              <strong>{report.scope} report · {report.status} · version {report.version}</strong>
              <p>{report.narrative || "No narrative recorded"}</p>
              {report.challenges && <p>{report.challenges}</p>}
            </article>)}
          </details>}
        </div>)}
        <label htmlFor="operational-canonical">Canonical period for duplicate reconciliation</label>
        <select id="operational-canonical" className="field" name="canonical" value={canonical} onChange={(event) => setCanonical(event.target.value)}>
          <option value="">Choose the existing period to retain</option>
          {records.filter((row) => row.record_table === "report_periods" && !row.archived).map((row) =>
            <option key={row.record_id} value={row.record_id}>{row.label} · {row.status} · {row.record_id.slice(0, 8)}</option>)}
        </select>
        <label htmlFor="operational-archive-reason">Reason for this change (required)</label>
        <textarea id="operational-archive-reason" className="field" name="reason" required minLength={10} maxLength={1000}
          value={reason} onChange={(event) => setReason(event.target.value)} style={{ fontSize: "1rem" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="btn" type="submit" value="archive">Archive selected demo records</button>
          <button className="btn secondary" type="submit" value="reconcile">Reconcile duplicate period</button>
          <button className="btn secondary" type="submit" value="restore">Restore selected records</button>
        </div>
      </fieldset>
    </form>}
    {!loading && <button className="btn secondary" type="button" onClick={load} disabled={busy}>Refresh archive records</button>}
  </section>;
}
