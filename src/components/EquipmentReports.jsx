import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import { ComposerDrawer } from "../experience-v2/components";
import { ProductNotice } from "./bits";


const blankReport = {
  category: "", manufacturer: "", model: "", serial: "", tag: "",
  location: "", condition: "", details: "",
};

// Reuse CEAC's existing card/field/button design instead of adding a new
// stylesheet to the large shared CSS bundle.
const sectionStyle = { margin: "18px 0 24px", padding: "20px 22px" };
const headerStyle = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" };
const subtitleStyle = { color: "var(--ev2-text-secondary,var(--c236))", fontSize: 13, lineHeight: 1.55, maxWidth: 600 };
const mutedStyle = { color: "var(--ev2-text-secondary,var(--c236))", fontSize: 13 };
const listStyle = { display: "grid", gap: 0, marginTop: 14 };
const rowStyle = { display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--ev2-border,var(--c237))" };
const metaStyle = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--ev2-text-secondary,var(--c236))" };
const formStyle = { display: "grid", gap: 14, padding: "8px 0" };
const formLabelStyle = { display: "grid", gap: 7, fontSize: 13, fontWeight: 600 };
const columnsStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))", gap: 12 };

function readableDate(value) {
  if (!value) return "Date not available";
  return new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Africa/Accra", day: "numeric", month: "short", year: "numeric",
  });
}
function equipmentName(record) {
  return [record.category, record.manufacturer, record.model].filter(Boolean).join(" · ");
}
function statusLabel(status) {
  if (status === "pending") return "Awaiting HR verification";
  if (status === "recorded") return "Recorded by HR";
  return "Not confirmed by HR";
}

// The staff report is deliberately NOT an inventory write.
// Only the existing asset.manage authority can create/assign an official asset.
export default function EquipmentReports({ me, canManage, assets = [], people = [], onAccepted }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const [notice, setNotice] = useState("");
  const [writeError, setWriteError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(blankReport);
  const [reviewing, setReviewing] = useState(null);
  const [reviewAction, setReviewAction] = useState("register");
  const [assetCode, setAssetCode] = useState("");
  const [existingAssetId, setExistingAssetId] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const latestIdentity = useRef("");

  const scope = me.org_id + ":" + me.id + ":" + canManage;
  latestIdentity.current = scope;

  async function fetchReports(expectedScope = scope) {
    let query = supabase.from("asset_staff_reports")
      .select("id,org_id,reporter_id,category,manufacturer,model,serial_number,reported_asset_tag,current_location,condition_note,details,status,asset_id,created_at,reviewed_at,resolution_note")
      .eq("org_id", me.org_id).order("created_at", { ascending: false }).limit(100);
    if (!canManage) query = query.eq("reporter_id", me.id);
    const { data, error } = await query;
    if (latestIdentity.current !== expectedScope) return false;
    if (error || !Array.isArray(data)) {
      setReadError(humanError(error, "Equipment reports could not be loaded. Try again."));
      return false;
    }
    setReports(data);
    setReadError("");
    return true;
  }

  useEffect(() => {
    let active = true;
    const current = scope;
    setReports([]); setNotice(""); setReadError(""); setWriteError(""); setLoading(true);
    setFormOpen(false); setReviewing(null);
    const query = supabase.from("asset_staff_reports")
      .select("id,org_id,reporter_id,category,manufacturer,model,serial_number,reported_asset_tag,current_location,condition_note,details,status,asset_id,created_at,reviewed_at,resolution_note")
      .eq("org_id", me.org_id).order("created_at", { ascending: false }).limit(100);
    (canManage ? query : query.eq("reporter_id", me.id)).then(({ data, error }) => {
      if (!active || latestIdentity.current !== current) return;
      if (error || !Array.isArray(data)) setReadError(humanError(error, "Equipment reports could not be loaded."));
      else setReports(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [me.id, me.org_id, canManage, scope]);

  const pending = useMemo(() => reports.filter(r => r.status === "pending"), [reports]);
  const assignableAssets = useMemo(
    () => assets.filter(asset => asset.current_status === "available" || asset.current_status === "assigned"),
    [assets]
  );

  function updateDraft(field, value) {
    setDraft(prev => ({ ...prev, [field]: value }));
  }
  function openStaffForm() {
    setDraft(blankReport); setWriteError(""); setNotice(""); setFormOpen(true);
  }
  function openReview(report) {
    setReviewing(report); setReviewAction("register");
    setAssetCode(report.reported_asset_tag || "");
    setExistingAssetId(""); setReviewReason(""); setWriteError(""); setNotice("");
  }
  async function submitReport() {
    if (writing.current || !draft.category.trim()) return;
    writing.current = true; setBusy(true); setWriteError(""); setNotice("");
    try {
      const { data, error } = await supabase.rpc("asset_submit_staff_report", {
        p_category: draft.category.trim(),
        p_manufacturer: draft.manufacturer.trim() || null,
        p_model: draft.model.trim() || null,
        p_serial_number: draft.serial.trim() || null,
        p_asset_tag: draft.tag.trim() || null,
        p_location: draft.location.trim() || null,
        p_condition_note: draft.condition.trim() || null,
        p_details: draft.details.trim() || null,
      });
      if (error || !data) throw error || new Error("HR could not be notified of this report.");
      setFormOpen(false);
      setNotice("Your equipment report has been sent to HR for verification. It is not yet an official equipment assignment.");
      await fetchReports();
    } catch (e) {
      setWriteError(humanError(e, "Your equipment report could not be sent."));
    } finally { writing.current = false; setBusy(false); }
  }
  async function resolveReport() {
    if (writing.current || !reviewing || !reviewReason.trim()) return;
    writing.current = true; setBusy(true); setWriteError(""); setNotice("");
    try {
      const { error } = await supabase.rpc("asset_resolve_staff_report", {
        p_report_id: reviewing.id,
        p_action: reviewAction,
        p_asset_code: reviewAction === "register" ? assetCode.trim() : null,
        p_asset_id: reviewAction === "assign_existing" ? (existingAssetId || null) : null,
        p_reason: reviewReason.trim(),
      });
      if (error) throw error;
      setReviewing(null);
      setNotice(reviewAction === "decline"
        ? "Report reviewed. The staff member can see the reason."
        : "Official equipment assignment recorded. It now appears in the employee's My Hub.");
      await Promise.all([fetchReports(), onAccepted?.()]);
    } catch (e) {
      setWriteError(humanError(e, "HR could not record the equipment decision."));
    } finally { writing.current = false; setBusy(false); }
  }

  return <section className="card ceac-equipment-reporting" style={sectionStyle} aria-label={canManage ? "Staff equipment reports" : "Report missing equipment"}>
    <div className="ceac-equipment-reporting-header" style={headerStyle}>
      <div>
        <span className="eyebrow">{canManage ? "Administration · Equipment" : "My Hub · Equipment"}</span>
        <h2 className="h2">{canManage ? "Equipment reported by staff" : "Equipment missing from your record?"}</h2>
        <p style={subtitleStyle}>{canManage
          ? "Check staff-reported equipment before adding it to the official register or assigning an existing item."
          : "Tell HR about church equipment in your care that is not shown here. HR checks each report and records the official assignment."}</p>
      </div>
      {!canManage && <button type="button" className="btn" onClick={openStaffForm}>
        Report equipment
      </button>}
      {canManage && <strong className="ceac-equipment-report-count">{loading ? "…" : pending.length} awaiting review</strong>}
    </div>

    {readError && <ProductNotice tone="error" title="Could not load equipment reports">
      {readError} <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setReadError(""); void fetchReports(); }}>Retry</button>
    </ProductNotice>}
    {notice && <ProductNotice tone="success" title="Equipment record">{notice}</ProductNotice>}
    {loading && <p className="screen-note">Loading equipment reports…</p>}
    {!loading && !readError && (
      (canManage ? pending : reports).length === 0
        ? <p className="ceac-equipment-report-empty" style={mutedStyle}>{canManage
          ? "No staff equipment reports are awaiting review."
          : "No reports submitted yet. Equipment officially assigned by HR appears in the register below."}</p>
        : <div className="ceac-equipment-report-list" style={listStyle}>
          {(canManage ? pending : reports).map(report => <article className="ceac-equipment-report-row" style={rowStyle} key={report.id}>
            <div>
              <div className="ceac-equipment-report-meta" style={metaStyle}>
                {canManage
                  ? (people.find(person => person.id === report.reporter_id)?.full_name || "Employee")
                  : statusLabel(report.status)}
                <span>·</span>{readableDate(report.created_at)}
              </div>
              <strong>{equipmentName(report)}</strong>
              <p>{[report.reported_asset_tag && "Tag " + report.reported_asset_tag,
                report.serial_number && "Serial " + report.serial_number,
                report.current_location].filter(Boolean).join(" · ") || "No tag or location provided"}</p>
              {report.condition_note && <p>Condition: {report.condition_note}</p>}
              {report.details && <p>Staff note: {report.details}</p>}
              {!canManage && report.status !== "pending" && report.resolution_note &&
                <p><strong>HR response:</strong> {report.resolution_note}</p>}
            </div>
            {canManage && <button type="button" className="btn btn-ghost btn-sm" onClick={() => openReview(report)}>
              Review report
            </button>}
          </article>)}
        </div>
    )}

    {formOpen && !canManage && <ComposerDrawer open title="Report equipment to HR"
      description="This records what you report. HR will verify it before an official assignment appears."
      onClose={() => { if (!busy) setFormOpen(false); }}>
      <div className="ceac-equipment-report-form" style={formStyle}>
        <label style={formLabelStyle} style={formLabelStyle}>Equipment type *
          <input className="field" aria-label="Reported equipment type" required maxLength={80}
            placeholder="Laptop, camera, microphone…" value={draft.category}
            onChange={e => updateDraft("category", e.target.value)} />
        </label>
        <div className="ceac-equipment-report-two" style={columnsStyle}>
          <label style={formLabelStyle} style={formLabelStyle}>Brand or manufacturer
            <input className="field" maxLength={120} value={draft.manufacturer}
              onChange={e => updateDraft("manufacturer", e.target.value)} />
          </label>
          <label style={formLabelStyle} style={formLabelStyle}>Model
            <input className="field" maxLength={120} value={draft.model}
              onChange={e => updateDraft("model", e.target.value)} />
          </label>
          <label style={formLabelStyle} style={formLabelStyle}>Existing equipment tag (if any)
            <input className="field" maxLength={80} value={draft.tag}
              onChange={e => updateDraft("tag", e.target.value)} />
          </label>
          <label style={formLabelStyle} style={formLabelStyle}>Serial number (if known)
            <input className="field" maxLength={120} value={draft.serial}
              onChange={e => updateDraft("serial", e.target.value)} />
          </label>
        </div>
        <label style={formLabelStyle} style={formLabelStyle}>Where is it kept?
          <input className="field" maxLength={200} value={draft.location}
            onChange={e => updateDraft("location", e.target.value)}
            placeholder="Office, media room, at home…" />
        </label>
        <label style={formLabelStyle} style={formLabelStyle}>Condition
          <textarea className="field" rows={2} maxLength={500} value={draft.condition}
            onChange={e => updateDraft("condition", e.target.value)}
            placeholder="Working normally, needs repair…" />
        </label>
        <label style={formLabelStyle} style={formLabelStyle}>Anything HR should know?
          <textarea className="field" rows={2} maxLength={1000} value={draft.details}
            onChange={e => updateDraft("details", e.target.value)}
            placeholder="When you received it, who issued it, or any missing information" />
        </label>
        {writeError && <ProductNotice tone="error" title="Could not submit">{writeError}</ProductNotice>}
        <button type="button" className="btn" disabled={busy || draft.category.trim().length < 2}
          onClick={submitReport}>{busy ? "Sending…" : "Send report to HR"}</button>
      </div>
    </ComposerDrawer>}

    {reviewing && canManage && <ComposerDrawer open title="Verify reported equipment"
      description={equipmentName(reviewing)}
      onClose={() => { if (!busy) setReviewing(null); }}>
      <div className="ceac-equipment-report-form" style={formStyle}>
        <p className="screen-note">Verify the physical item and ownership before recording an official assignment. The staff member cannot approve their own report.</p>
        <label style={formLabelStyle} style={formLabelStyle}>HR decision
          <select className="field" aria-label="Equipment review action" value={reviewAction}
            onChange={e => setReviewAction(e.target.value)}>
            <option value="register">Register new equipment and assign it</option>
            <option value="assign_existing">Assign equipment already in the register</option>
            <option value="decline">Cannot confirm this report</option>
          </select>
        </label>
        {reviewAction === "register" && <label style={formLabelStyle} style={formLabelStyle}>Verified CEAC equipment tag *
          <input className="field" aria-label="Verified equipment tag" maxLength={80}
            value={assetCode} onChange={e => setAssetCode(e.target.value)}
            placeholder="e.g. CEAC-LAP-014" />
        </label>}
        {reviewAction === "assign_existing" && <label style={formLabelStyle} style={formLabelStyle}>Choose equipment from the register *
          <select className="field" aria-label="Existing equipment item" value={existingAssetId}
            onChange={e => setExistingAssetId(e.target.value)}>
            <option value="">Choose equipment</option>
            {assignableAssets.map(asset => <option key={asset.id} value={asset.id}>
              {asset.asset_code} · {asset.category} · {asset.current_status}
            </option>)}
          </select>
        </label>}
        {reviewAction === "assign_existing" && !assignableAssets.length &&
          <p role="status">No assignable equipment is available. Use Register new equipment instead.</p>}
        <label style={formLabelStyle} style={formLabelStyle}>HR verification note *
          <textarea className="field" aria-label="Equipment verification reason" rows={3}
            maxLength={1000} value={reviewReason} onChange={e => setReviewReason(e.target.value)}
            placeholder={reviewAction === "decline" ? "Explain why it cannot be confirmed" : "Record how HR verified the equipment and handover"} />
        </label>
        {writeError && <ProductNotice tone="error" title="Could not save HR decision">{writeError}</ProductNotice>}
        <button type="button" className="btn"
          disabled={busy || reviewReason.trim().length < 3 ||
            (reviewAction === "register" && assetCode.trim().length < 2) ||
            (reviewAction === "assign_existing" && !existingAssetId)}
          onClick={resolveReport}>{busy ? "Recording…" :
            reviewAction === "decline" ? "Record HR decision" : "Confirm and assign equipment"}</button>
      </div>
    </ComposerDrawer>}
  </section>;
}
