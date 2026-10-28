import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { classifyPreviewFeatureResult } from "../lib/pendingFeatureCompatibility";
import { dateOnly } from "../lib/time";
import { leavePoolLabel } from "../lib/leavePools";
import { ProductNotice } from "../components/bits";
import { CeacIcon } from "../experience-v2/icons";
import { humanError } from "../lib/productLanguage";
import DutyLocationSettings from "../components/DutyLocationSettings";
import AttendanceCodeIssuer from "../components/AttendanceCodeIssuer";
import "../components/SettingsBack.css";
import "./ControlCenter.css";
import "./OfficeSettings.css";

export default function OfficeSettings({ me, openWorkforce, section: requestedSection, openSection, back }) {
  const section = ["office", "locations", "codes", "leave", "alerts"].includes(requestedSection) ? requestedSection : null;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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


  const [integrityAvailable, setIntegrityAvailable] = useState(true);



  const loadGeneration = useRef(0);
  useEffect(() => { load(); return () => { loadGeneration.current += 1; }; }, [section]);

  async function load() {
    const generation = ++loadGeneration.current;
    setMessage(null);
    setLoading(true);
    setLoadError(false);
    const [officeResult, leaveResult, thresholdResult, integrityResult] = await Promise.all([
      (!section || section === "office") ? supabase.from("office_locations").select("*").eq("is_primary", true).limit(1).maybeSingle() : Promise.resolve({data:null}),
      section === "leave" ? supabase.from("leave_policy_versions").select("id,name,state,confirmed_at,source_reference,reason,leave_policy_rules(id,leave_kind,employment_type,entitlement_amount,entitlement_unit,accrual_method,accrual_rate,carryover_method,carryover_limit,approval_route,opening_balance_required,complete)").eq("org_id", me.org_id).eq("state","active").order("confirmed_at",{ascending:false}).limit(1).maybeSingle() : Promise.resolve({data:null}),
      section === "alerts" ? supabase.from("thresholds").select("name,label,value,unit_label").eq("org_id",me.org_id).neq("name","pay_change_pct").order("label") : Promise.resolve({data:[]}),
      section === "codes" ? supabase.rpc("attendance_integrity_status") : Promise.resolve({data:null}),
    ]);

    if (generation !== loadGeneration.current) return;
    setLoading(false);
    const integrityFeature = classifyPreviewFeatureResult("attendanceIntegrity", integrityResult);
    if (officeResult.error) {
      setLoadError(true);
      setMessage({ tone: "error", title: "Office settings could not load", body: humanError(officeResult.error) });
      return;
    }
    if (leaveResult.error) {
      setLoadError(true);
      setMessage({ tone: "error", title: "Leave settings could not load", body: humanError(leaveResult.error) });
      return;
    }
    if (thresholdResult.error) {
      setLoadError(true);
      setMessage({ tone: "error", title: "Alert rules could not load", body: humanError(thresholdResult.error) });
      return;
    }
    if (integrityFeature.error) {
      setLoadError(true);
      setMessage({ tone: "error", title: "Attendance integrity status could not load", body: humanError(integrityFeature.error) });
      return;
    }

    const o = officeResult.data;
    if (!section || section === "office") {
      setOffice(o || null);
      setName(o?.name || "CEAC main office");
      setLat(o ? String(o.lat) : "");
      setLng(o ? String(o.lng) : "");
      setRadius(o?.radius_meters ?? 100);
    }
    setThresholds((thresholdResult.data || []).map((row) => ({
      ...row,
      value: thresholdDraftsRef.current.get(row.name) ?? String(row.value ?? ""),
    })));
    setIntegrityAvailable(integrityFeature.available);

    const policy = leaveResult.data || null;
    setLeavePolicy(policy);
    setLeaveRules(policy?.leave_policy_rules || []);
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
      if (!Number.isFinite(lt) || !Number.isFinite(ln) || lt < -90 || lt > 90 || ln < -180 || ln > 180) throw new Error("Choose a valid office location first.");
      if (!Number.isInteger(Number(radius)) || Number(radius) < 10 || Number(radius) > 1000) throw new Error("Choose a check-in area between 10 and 1,000 metres.");

      const payload = {
        name: name.trim() || "CEAC main office",
        lat: lt,
        lng: ln,
        radius_meters: Number(radius) || 100,
        set_by: me.id,
        set_at: new Date().toISOString(),
      };

      const result = office
        ? await supabase.from("office_locations").update(payload).eq("org_id", me.org_id).eq("id", office.id).select("id,name,lat,lng,radius_meters").single()
        : await supabase.from("office_locations").insert({ ...payload, org_id: me.org_id, is_primary: true }).select("id,name,lat,lng,radius_meters").single();

      if (result.error) throw result.error;
      if (!result.data || result.data.name !== payload.name || Number(result.data.lat) !== lt || Number(result.data.lng) !== ln || Number(result.data.radius_meters) !== Number(radius)) throw new Error("The office location could not be confirmed. Please try again.");
      await load();
      setMessage({ tone: "success", title: "Office location saved", body: "Attendance can now distinguish the office from other work locations." });
    } catch (error) {
      setMessage({ tone: "error", title: "Office location was not saved", body: humanError(error) });
    } finally {
      setSaving(false);
    }
  }

    async function saveThreshold(row) {
    setSaving(true);
    setMessage(null);
    try {
      const draft = thresholdDraftsRef.current.get(row.name) ?? row.value;
      const value = Number(draft);
      if (String(draft).trim() === "" || !Number.isFinite(value) || value < 0) throw new Error("Enter a valid non-negative number.");
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

  const titles = {office:"Office location",locations:"Duty locations",codes:"Check-in codes",leave:"Leave rules",alerts:"Alerts & reminders"};
  const descriptions = {
    office:"Set where office check-ins are recognised.", locations:"Manage other approved places to work.",
    codes:"Issue a temporary code for an approved work location.",leave:"Review entitlements, balances and approval rules.",alerts:"Choose when an item is brought to HR’s attention.",
  };
  function returnFromPage() {
    const officeDirty=section==="office"&&(name!==(office?.name||"CEAC main office")||lat!==String(office?.lat??"")||lng!==String(office?.lng??"")||Number(radius)!==Number(office?.radius_meters??100));
    if ((officeDirty||thresholdDraftsRef.current.size>0)&&!window.confirm("Leave without saving your changes?")) return;
    thresholdDraftsRef.current.clear();
    if (["office","locations","codes"].includes(section)) openSection?.(null); else back?.();
  }
  return <div className="body office-settings ev2-office-settings focused-settings">
    <header className="focused-settings-header">
      <button type="button" className="settings-back" onClick={returnFromPage} disabled={saving} aria-label={section&&["office","locations","codes"].includes(section)?"Back to Attendance & locations":"Back to Control Center"}>← Back</button>
      <h1 className="settings-page-title">{titles[section]||"Attendance & locations"}</h1>
      <p className="screen-note">{descriptions[section]||"Choose what you want to set up."}</p>
    </header>
    {message&&<ProductNotice tone={message.tone} title={message.title}>{message.body}</ProductNotice>}
    {loading?<p role="status">Loading settings…</p>:loadError?<button type="button" className="btn" onClick={load}>Try again</button>:<>
      {!section?<>
        <div className="control-setting-list">
          {[["office","Office location","Set the office point and check-in area"],["locations","Duty locations","Manage other approved places to work"],["codes","Check-in codes","Issue temporary codes for a work location"]].map(([key,title,description])=><button type="button" key={key} className="control-setting-row" onClick={()=>openSection?.(key)}>
            <CeacIcon name={key === "office" ? "organisation" : key === "locations" ? "location" : "record"} size="row" decorative/><span className="control-setting-copy"><strong>{title}</strong><span>{description}</span></span>
            {key==="office"?<span className="control-setting-status">{office?"Configured":"Needs setup"}</span>:null}<span className="control-setting-chevron" aria-hidden="true">›</span>
          </button>)}
        </div>
        <aside className="settings-help"><strong>Looking for today’s attendance?</strong><p>View staff attendance in Time & Leave.</p><button type="button" onClick={()=>openWorkforce?.()}>Open Time & Leave →</button></aside>
      </>:null}
      {section==="office"?<form className="focused-setting-editor" onSubmit={event=>{event.preventDefault();saveOffice();}}>
        <label htmlFor="office-name">Office name</label><input id="office-name" className="field" value={name} onChange={event=>setName(event.target.value)} required maxLength={120}/>
        {mapSrc?<iframe title="Office location" src={mapSrc} className="office-settings-map"/>:<p className="settings-help">Stand at the office and use your current location to set the office point.</p>}
        <button type="button" className="btn btn-ghost" onClick={pickHere} disabled={locating||saving}>{locating?"Finding your location…":"Use my current location"}</button>
        {locErr?<ProductNotice tone="error" title="Location unavailable">{locErr}</ProductNotice>:null}
        <label htmlFor="office-radius">Check-in area</label><div className="office-inline-field"><input id="office-radius" aria-describedby="office-radius-help" className="field" type="number" min="10" max="1000" step="1" required value={radius} onChange={event=>setRadius(event.target.value)}/><span>metres</span></div>
        <p id="office-radius-help" className="screen-note">Distance around the saved office point.</p>
        <p className="settings-help">Location supports attendance review. It does not measure productivity.</p>
        <div className="settings-editor-actions"><button type="submit" className="btn" disabled={saving||locating||!lat||!lng}>{saving?"Saving…":"Save changes"}</button><button type="button" className="btn btn-ghost" disabled={saving} onClick={returnFromPage}>Cancel</button></div>
        {office?.set_at?<p className="office-setting-footnote">Last confirmed {dateOnly(office.set_at)}.</p>:null}
      </form>:null}
      {section==="locations"?<DutyLocationSettings me={me} />:null}
      {section==="codes"?<section className="focused-setting-editor">
        {integrityAvailable?<AttendanceCodeIssuer me={me}/>:<ProductNotice tone="attention" title="Check-in codes unavailable">Check-in codes are not enabled in this environment.</ProductNotice>}
        <p className="screen-note">Each code belongs to one approved work location and expires automatically. Codes support a review; they do not decide attendance, pay or disciplinary action.</p>
      </section>:null}
      {section==="leave"?<section className="focused-setting-editor">
        <ProductNotice tone={leaveConfigured?"success":"attention"} title={leaveConfigured?"Active leave policy":"Leave policy not configured"}>{leaveConfigured?leavePolicy.name:"Confirm CEAC’s leave rules before assigning entitlements."}</ProductNotice>
        {leaveRules.map(rule=><div className="settings-leave-rule" key={rule.id}><h2>{rule.leave_kind==="annual"?"Annual leave":leavePoolLabel(rule.leave_kind)||rule.leave_kind}</h2><dl>
          <div><dt>Entitlement</dt><dd>{rule.complete?`${rule.entitlement_amount} ${rule.entitlement_unit}`:"Needs confirmation"}</dd></div>
          <div><dt>How leave builds up</dt><dd>{(rule.accrual_method||"Not configured").replaceAll("_"," ")}</dd></div>
          <div><dt>Unused leave</dt><dd>{(rule.carryover_method||"Not configured").replaceAll("_"," ")}</dd></div>
          <div><dt>Approval route</dt><dd>{(rule.approval_route||"Not configured").replaceAll("_"," ")}</dd></div>
        </dl></div>)}
        <button type="button" className="btn" onClick={()=>openWorkforce?.("setup")}>Manage leave rules in Time & Leave</button>
      </section>:null}
      {section==="alerts"?<section className="focused-setting-editor"><p className="screen-note">Changing these values changes when HR sees an item for review. It does not change the underlying work or create a score.</p>
        <div className="office-threshold-list">{thresholds.map(row=><div key={row.name} className="office-threshold-row"><div><strong>{row.label}</strong><span>{row.unit_label}</span></div>
          <input aria-label={row.label} className="field" type="number" min="0" step="1" value={row.value} onChange={event=>{const draft=event.target.value;thresholdDraftsRef.current.set(row.name,draft);setThresholds(current=>current.map(item=>item.name===row.name?{...item,value:draft}:item));}}/>
          <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={()=>saveThreshold(row)}>Save</button>
        </div>)}</div>{!thresholds.length?<p>No alert rules are configured.</p>:null}
      </section>:null}
    </>}
  </div>;
}
