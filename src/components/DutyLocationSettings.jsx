import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// Administrative configuration only. The office_locations RLS write policy
// requires app_is_admin(); listing venues grants no ability to verify presence.
const blank = { id: "", name: "", lat: "", lng: "", radius: "100" };

function validLocation(form) {
  const latitude = Number(form.lat);
  const longitude = Number(form.lng);
  const radius = Number(form.radius);
  return form.name.trim().length >= 3 && form.name.trim().length <= 120
    && String(form.lat).trim() !== "" && String(form.lng).trim() !== ""
    && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    && Number.isInteger(radius) && radius >= 10 && radius <= 1000;
}

export default function DutyLocationSettings({ me }) {
  const [locations, setLocations] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const busyRef = useRef(false);

  async function reload() {
    const token = ++generation.current;
    setLoaded(false);
    const { data, error: readError } = await supabase.from("office_locations")
      .select("id,name,lat,lng,radius_meters,is_primary")
      .eq("org_id", me.org_id).order("name");
    if (token !== generation.current) return false;
    if (readError) {
      setError("Authorised duty locations could not be loaded. No setting was changed.");
      setLoaded(true);
      return false;
    }
    setLocations(data || []);
    setLoaded(true);
    return true;
  }

  useEffect(() => {
    generation.current += 1;
    busyRef.current = false;
    setLocations([]);
    setLoaded(false);
    setDraft(blank);
    setError("");
    setSuccess("");
    void reload();
    return () => { generation.current += 1; };
  }, [me.id, me.org_id]);

  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
    setSuccess("");
  }

  function editVenue(location) {
    setDraft({
      id: location.id, name: location.name,
      lat: String(location.lat), lng: String(location.lng),
      radius: String(location.radius_meters),
    });
    setError("");
    setSuccess("");
  }

  async function save() {
    if (busyRef.current || !validLocation(draft)) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    const token = generation.current;
    const targetId = draft.id || crypto.randomUUID();
    const payload = {
      name: draft.name.trim(),
      lat: Number(draft.lat), lng: Number(draft.lng),
      radius_meters: Number(draft.radius),
      set_at: new Date().toISOString(),
      set_by: me.id,
    };
    let saved = false;
    try {
      const request = draft.id
        ? supabase.from("office_locations").update(payload)
          .eq("org_id", me.org_id).eq("id", targetId)
        : supabase.from("office_locations").insert({
          ...payload, id: targetId, org_id: me.org_id, is_primary: false,
        });
      const { data, error: saveError } = await request
        .select("id,is_primary").single();
      if (saveError || !data || data.id !== targetId || (!draft.id && data.is_primary)) {
        throw saveError || new Error("The location save could not be verified.");
      }
      saved = true;
      if (token !== generation.current) return;
      setDraft(blank);
      setSuccess("The duty location was recorded. Staff may now select this venue when starting on-site work.");
      // Failed refreshing must never imply the already confirmed write failed.
      try {
        const refreshed = await reload();
        if (!refreshed && token === generation.current - 1) {
          setError("The location was saved but the latest list could not be loaded. Refresh the list before further changes.");
        }
      } catch {
        if (token === generation.current - 1) {
          setError("The location was saved but the latest list could not be loaded.");
        }
      }
    } catch (saveFailure) {
      if (token === generation.current) {
        setError(saved
          ? "The location was saved but its latest state was not confirmed."
          : "The location save could not be confirmed. Refresh locations before retrying to avoid duplicate venues.");
      }
    } finally {
      if (token === generation.current || token === generation.current - 1) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  return <section id="duty-location-settings" className="office-settings-card office-settings-wide">
    <h2>Authorised duty locations</h2>
    <p className="screen-note">Configure additional church-office or programme venues for on-site attendance. The primary office remains managed in Office location above. No venue selection alone proves someone attended.</p>
    <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => { setError(""); void reload(); }}>Refresh locations</button>
    {!loaded && <p role="status">Loading approved locations...</p>}
    {error && <p role="alert" className="ceac-support-error">{error}</p>}
    {success && <p role="status">{success}</p>}
    {loaded && locations.length === 0 && <p className="screen-note">No authorised locations are configured.</p>}
    {locations.map((location) => <div key={location.id} className="admin-evidence-row">
      <div><strong>{location.name}</strong><span>{location.is_primary ? "Primary office" : "Programme / duty venue"} · {location.radius_meters} m radius</span></div>
      {!location.is_primary && <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => editVenue(location)}>Edit</button>}
    </div>)}
    <div className="form-grid two">
      <label>Venue name
        <input className="field" aria-label="Duty venue name" maxLength={120} value={draft.name}
          onChange={(event) => change("name", event.target.value)}
          placeholder="Approved programme venue" />
      </label>
      <label>Location radius in metres
        <input className="field" type="number" aria-label="Duty venue radius" min="10" max="1000"
          value={draft.radius} onChange={(event) => change("radius", event.target.value)} />
      </label>
      <label>Latitude
        <input className="field" type="number" step="any" min="-90" max="90" aria-label="Duty venue latitude"
          value={draft.lat} onChange={(event) => change("lat", event.target.value)} />
      </label>
      <label>Longitude
        <input className="field" type="number" step="any" min="-180" max="180" aria-label="Duty venue longitude"
          value={draft.lng} onChange={(event) => change("lng", event.target.value)} />
      </label>
    </div>
    <div className="workforce-setup-actions">
      <button className="btn" type="button" disabled={busy || !validLocation(draft)} onClick={save}>
        {busy ? "Saving venue..." : draft.id ? "Save venue changes" : "Add authorised venue"}
      </button>
      {draft.id && <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setDraft(blank)}>Cancel edit</button>}
    </div>
    <p className="screen-note">Only Administration can save these records. Coordinates and radius are configuration evidence; check-in location proof remains separately verified.</p>
  </section>;
}
