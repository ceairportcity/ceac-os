import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { classifyPreviewFeatureResult } from "../lib/pendingFeatureCompatibility";
import { dateOnly } from "../lib/time";
import { leavePoolLabel } from "../lib/leavePools";
import { FieldGroup, ProductNotice, SectionHeader } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { StatusBadge } from "../experience-v2/components";
import DutyLocationSettings from "../components/DutyLocationSettings";
import AttendanceCodeIssuer from "../components/AttendanceCodeIssuer";

export default function OfficeSettings({ me, openWorkforce }) {
  const [office, setOffice] = useState(null);
  const [name, setName] = useState("CEAC main office");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState(100);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState(null);
  const [message, setMessage] = useState(null);

  const [leavePolicy, setLeavePolicy] = useState(null);
  const [leaveRules, setLeaveRules] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  // A late settings refresh must not replace unsaved local attention-rule edits.
  const thresholdDraftsRef = useRef(new Map());
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [integrity, setIntegrity] = useState(null);
  const [integrityAvailable, setIntegrityAvailable] = useState(true);
  const [integrityMinutes, setIntegrityMinutes] = useState(10);
  const [integrityBusy, setIntegrityBusy] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setMessage(null);
    const [officeResult, leaveResult, thresholdResult, inviteResult, integrityResult] = await Promise.all([
      supabase.from("office_locations").select("*").eq("is_primary", true).limit(1).maybeSingle(),
      supabase.from("leave_policy_versions").select("id,name,state,confirmed_at,source_reference,reason,leave_policy_rules(id,leave_kind,employment_type,entitlement_amount,entitlement_unit,accrual_method,accrual_rate,carryover_method,carryover_limit,approval_route,opening_balance_required,complete)").eq("org_id", me.org_id).eq("state","active").order("confirmed_at",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("thresholds").select("name,label,value,unit_label").eq("org_id",me.org_id).neq("name","pay_change_pct").order("label"),
      supabase.from("pending_invitations").select("id,email,full_name,unit_id,invited_at,expires_at,units(name)").is("resolved_at",null).gt("expires_at",new Date().toISOString()).order("invited_at",{ascending:false}),
      supabase.rpc("attendance_integrity_status"),
    ]);

    const integrityFeature = classifyPreviewFeatureResult("attendanceIntegrity", integrityResult);
    if (officeResult.error) {
      setMessage({ tone: "error", title: "Office settings could not load", body: humanError(officeResult.error) });
      return;
    }
    if (leaveResult.error) {
      setMessage({ tone: "error", title: "Leave settings could not load", body: humanError(leaveResult.error) });
      return;
    }
    if (thresholdResult.error) {
      setMessage({ tone: "error", title: "Attention rules could not load", body: humanError(thresholdResult.error) });
      return;
    }
    if (inviteResult.error) {
      setMessage({ tone: "error", title: "People & access status could not load", body: humanError(inviteResult.error) });
      return;
    }
    if (integrityFeature.error) {
      setMessage({ tone: "error", title: "Attendance integrity status could not load", body: humanError(integrityFeature.error) });
      return;
    }

    const o = officeResult.data;
    if (o) {
      setOffice(o);
      setName(o.name);
      setLat(String(o.lat));
      setLng(String(o.lng));
      setRadius(o.radius_meters);
    }

    setThresholds((thresholdResult.data || []).map((row) => ({
      ...row,
      value: thresholdDraftsRef.current.get(row.name) ?? String(row.value ?? ""),
    })));
    setPendingInvitations(inviteResult.data || []);
    setIntegrityAvailable(integrityFeature.available);
    setIntegrity(integrityFeature.data || null);
    if (integrityFeature.data?.front_desk_code_ttl_minutes) setIntegrityMinutes(integrityFeature.data.front_desk_code_ttl_minutes);

    const policy = leaveResult.data || null;
    setLeavePolicy(policy);
    setLeaveRules(policy?.leave_policy_rules || []);
  }

  function jumpTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pickHere() {
    setLocErr(null);
    if (!("geolocation" in navigator)) {
      setLocErr("This device cannot report its location. Open CEAC OS on a phone inside the building.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocErr("Could not read this device location. Allow location access for CEAC OS and try again.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function saveOffice() {
    setSaving(true);
    setMessage(null);
    try {
      const lt = Number.parseFloat(lat);
      const ln = Number.parseFloat(lng);
      if (!Number.isFinite(lt) || !Number.isFinite(ln)) throw new Error("Enter both latitude and longitude.");

      const payload = {
        name: name.trim() || "CEAC main office",
        lat: lt,
        lng: ln,
        radius_meters: Number(radius) || 100,
        set_by: me.id,
        set_at: new Date().toISOString(),
      };

      const result = office
        ? await supabase.from("office_locations").update(payload).eq("id", office.id)
        : await supabase.from("office_locations").insert({ ...payload, org_id: me.org_id, is_primary: true });

      if (result.error) throw result.error;
      await load();
      setMessage({ tone: "success", title: "Office location saved", body: "Attendance can now distinguish the office from other work locations." });
    } catch (error) {
      setMessage({ tone: "error", title: "Office location was not saved", body: humanError(error) });
    } finally {
      setSaving(false);
    }
  }

  async function rotatePresenceCode(enabled = true) {
    if (!integrityAvailable) return; // The pending RPC must never be invoked in preview compatibility mode.
    setIntegrityBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.rpc("attendance_set_office_code", {
        p_enabled: enabled,
        p_ttl_minutes: Math.max(5, Math.min(30, Number(integrityMinutes) || 10)),
      });
      if (error) throw error;
      const status = await supabase.rpc("attendance_integrity_status");
      if (status.error) throw status.error;
      setIntegrity({
        ...(status.data || {}),
        front_desk_code: data?.code || status.data?.front_desk_code || null,
        front_desk_code_valid_until: data?.valid_until || status.data?.front_desk_code_valid_until || null,
      });
      setMessage({
        tone: "success",
        title: enabled ? "Office presence code rotated" : "Office presence code disabled",
        body: enabled
          ? "The short-lived code is corroborating evidence only. It does not create attendance, pay or disciplinary conclusions."
          : "Front-desk code corroboration is disabled. Existing evidence history remains preserved.",
      });
    } catch (error) {
      setMessage({ tone: "error", title: "Office presence code was not changed", body: humanError(error) });
    } finally {
      setIntegrityBusy(false);
    }
  }

    async function saveThreshold(row) {
    setSaving(true);
    setMessage(null);
    try {
      const draft = thresholdDraftsRef.current.get(row.name) ?? row.value;
      const value = Number(draft);
      if (!Number.isFinite(value) || value < 0) throw new Error("Enter a valid non-negative number.");
      const result = await supabase.from("thresholds")
        .update({ value, updated_by: me.id, updated_at: new Date().toISOString() })
        .eq("org_id", me.org_id)
        .eq("name", row.name)
        .select("name,value,updated_by,updated_at")
        .single();
      if (result.error) throw result.error;
      if (!result.data || Number(result.data.value) !== value) throw new Error("The attention rule was not persisted.");
      // Clear only the draft actually saved; an edit made during Save remains intact.
      if (thresholdDraftsRef.current.get(row.name) === draft) thresholdDraftsRef.current.delete(row.name);
      await load();
      setMessage({ tone: "success", title: "Attention rule updated", body: `${row.label} ${value} ${row.unit_label}.` });
    } catch (error) {
      setMessage({ tone: "error", title: "Attention rule was not saved", body: humanError(error) });
    } finally {
      setSaving(false);
    }
  }

  const leaveConfigured = Boolean(leavePolicy);
  const mapSrc = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed` : null;

  return <div className="body office-settings ev2-office-settings">
    <div className="office-page-intro ev2-office-settings-header">
      <div><div className="eyebrow">Control room</div>
      <h1 className="h1">Organisation settings</h1>
      <p className="screen-note">Organisation rules CEAC can maintain without a developer. Unconfirmed policy stays visibly unconfigured rather than being guessed.</p></div>
      <StatusBadge tone={leaveConfigured && office ? "success" : "warning"} icon={false}>{leaveConfigured && office ? "Core setup recorded" : "Setup needs attention"}</StatusBadge>
    </div>

    {message && <ProductNotice tone={message.tone} title={message.title}>{message.body}</ProductNotice>}

    <div className="office-settings-grid">
      <section id="office-location-settings" className="office-settings-card">
        <SectionHeader eyebrow="Attendance context" title="Office location" />
        <p className="screen-note">This location tells CEAC OS whether a work session began at the office or elsewhere. It does not determine productivity.</p>
        <FieldGroup label="Location name">
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="CEAC main office" />
        </FieldGroup>
        <button className="btn btn-ghost" onClick={pickHere} disabled={locating}>
          {locating ? "Finding this device…" : lat && lng ? "Use where I am standing now instead" : "Use where I am standing now"}
        </button>
        {locErr && <ProductNotice tone="error" title="Location unavailable">{locErr}</ProductNotice>}
        <FieldGroup label="Office radius" hint="The distance around the saved point that still counts as the office.">
          <div className="office-inline-field"><input className="field" type="number" min="10" value={radius} onChange={(event) => setRadius(event.target.value)} /><span>metres</span></div>
        </FieldGroup>
        {mapSrc && <iframe title="Office location" src={mapSrc} className="office-settings-map" />}
        <button className="btn" onClick={saveOffice} disabled={saving || !lat || !lng}>
          {saving ? "Saving…" : office ? "Update office location" : "Save office location"}
        </button>
        {office && <div className="office-setting-footnote">Last confirmed {dateOnly(office.set_at)}.</div>}
      </section>

      <DutyLocationSettings me={me} />
      <section id="attendance-integrity-settings" className="office-settings-card">
        <SectionHeader eyebrow="Attendance integrity" title="Approved location codes" />
        {!integrityAvailable && <ProductNotice tone="attention" title="Attendance codes awaiting backend acceptance">
          The original Stage 1 database has not yet applied the reviewed attendance migrations. The code issuer cannot operate until the next one-bundle schema release is accepted.
        </ProductNotice>}
        {integrityAvailable && <AttendanceCodeIssuer me={me} />}
        <p className="screen-note">Codes are issued separately for each authorised duty location. They expire automatically and are corroborating evidence only, never an automatic attendance, pay or disciplinary decision.</p>
      </section>

      <section id="leave-policy-settings" className="office-settings-card">
        <SectionHeader eyebrow="Policy" title="Leave rules" />
        {!leaveConfigured && <ProductNotice tone="attention" title="Leave policy not configured">
          The old prototype leave defaults are not CEAC policy. Configure entitlement, accrual, carry-over and approval route explicitly in Workforce.
        </ProductNotice>}
        {leaveConfigured && <ProductNotice tone="success" title="Leave policy configured">
          {leavePolicy.name} is the active confirmed Stage 9 policy. Historical prototype defaults are not used.
        </ProductNotice>}
        {leaveConfigured && <div className="office-policy-grid">
          {leaveRules.map((rule) => <div className="card small" key={rule.id}>
            <strong>{leavePoolLabel(rule.leave_kind)||rule.leave_kind}</strong><br />
            {rule.complete ? `${rule.entitlement_amount} ${rule.entitlement_unit}` : "Incomplete rule"} ·
            {" "}accrual {rule.accrual_method || "not configured"} ·
            {" "}carry-over {rule.carryover_method || "not configured"} ·
            {" "}route {rule.approval_route || "not configured"}
            {rule.opening_balance_required ? " · opening balance required" : ""}
          </div>)}
        </div>}
        <button className="btn" onClick={() => openWorkforce?.()}>
          {leaveConfigured ? "Review policy in Workforce" : "Configure policy in Workforce"}
        </button>
      </section>

      <section id="attention-rule-settings" className="office-settings-card office-settings-wide">
        <SectionHeader eyebrow="Quiet by default" title="When to tell Administration" />
        <p className="screen-note">These are deterministic rules already used by CEAC OS. Changing a value changes when an item becomes visible; it does not change the underlying work or create a score.</p>
        <div className="office-threshold-list">
          {thresholds.map((row) => <div key={row.name} className="office-threshold-row">
            <div><strong>{row.label}</strong><span>{row.unit_label}</span></div>
            <input aria-label={row.label} className="field" type="number" min="0" step={row.unit_label === "%" ? "1" : "1"} value={row.value} onChange={(event) => { const draft = event.target.value; thresholdDraftsRef.current.set(row.name, draft); setThresholds((current) => current.map((item) => item.name === row.name ? { ...item, value:draft } : item)); }} />
            <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => saveThreshold(row)}>Save</button>
          </div>)}
        </div>
      </section>

      <section id="access-settings" className="office-settings-card office-settings-wide">
        <SectionHeader eyebrow="People & access" title="Pending invitations" count={pendingInvitations.length} />
        <p className="screen-note">New accounts always activate as Staff. Administration assigns official authority only after activation.</p>
        {pendingInvitations.length === 0 && <div className="card small">No active invitations are waiting.</div>}
        {pendingInvitations.map((invite) => <div key={invite.id} className="admin-evidence-row">
          <div><strong>{invite.full_name || invite.email}</strong><span>{invite.email} · {invite.units?.name || "Unit"} · expires {dateOnly(invite.expires_at)}</span></div>
        </div>)}
      </section>

      <section className="office-settings-card office-settings-wide">
        <SectionHeader eyebrow="Administration & HR" title="Setup & configuration" />
        <p className="screen-note">Open the settings CEAC can control here. Items that still need an approved CEAC policy remain clearly unavailable rather than pretending to be configurable.</p>
        <div className="office-config-status">
          <button type="button" className="office-config-card" onClick={() => jumpTo("office-location-settings")}>
            <span>Office location</span><strong>{office ? "Configured" : "Needs setup"}</strong><small>{office ? "Review or change" : "Set up now"} ↑</small>
          </button>
          <button type="button" className="office-config-card" onClick={() => jumpTo("leave-policy-settings")}>
            <span>Leave policy</span><strong>{leaveConfigured ? "Configured" : "Needs confirmation"}</strong><small>Managed in Workforce ↑</small>
          </button>
          <button type="button" className="office-config-card" onClick={() => jumpTo("attention-rule-settings")}>
            <span>Attention rules</span><strong>{thresholds.length ? "Configurable" : "Needs setup"}</strong><small>Review rules ↑</small>
          </button>
          <button type="button" className="office-config-card" onClick={() => jumpTo("access-settings")}>
            <span>People & access</span><strong>{pendingInvitations.length ? pendingInvitations.length + " invitation" + (pendingInvitations.length === 1 ? "" : "s") + " waiting" : "No invitations waiting"}</strong><small>Review access ↑</small>
          </button>
          <div className="office-config-card is-deferred"><span>Salary structure</span><strong>Awaiting CEAC policy</strong><small>Not enabled yet</small></div>
          <div className="office-config-card is-deferred"><span>Payroll approval chain</span><strong>Awaiting CEAC policy</strong><small>Not enabled yet</small></div>
          <div className="office-config-card is-deferred"><span>Protected HR storage</span><strong>Security foundation ready</strong><small>Protected HR is active and access-controlled</small></div>
        </div>
      </section>
    </div>
  </div>;
}
