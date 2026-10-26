import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import WorkforceStreetMap from "./WorkforceStreetMap";
import { primaryOfficePoint } from "../lib/workforceStreetMap";
import { FieldGroup } from "./bits";
import { Button, DataPanel } from "../experience-v2/components";

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
  const [readFailed, setReadFailed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const busyRef = useRef(false);

  async function reload() {
    const token = ++generation.current;
    setLoaded(false);
    setReadFailed(false);
    const { data, error: readError } = await supabase.from("office_locations")
      .select("id,name,lat,lng,radius_meters,is_primary")
      .eq("org_id", me.org_id).order("name");
    if (token !== generation.current) return false;
    if (readError) {
      setLocations([]);
      setReadFailed(true);
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
    if (busyRef.current || !loaded || readFailed || !validLocation(draft)) return;
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

  const office=useMemo(()=>primaryOfficePoint(locations.find(location=>location.is_primary)),[locations]);
  const chosen=String(draft.lat).trim()!==""&&String(draft.lng).trim()!=="";
  const focusLocation=useMemo(()=>chosen?{lat:Number(draft.lat),lng:Number(draft.lng)}:office,[chosen,draft.lat,draft.lng,office]);
  return <DataPanel id="duty-location-settings" className="office-settings-card office-settings-wide"
    title="Authorised duty locations" supporting="Configure other church-office or programme venues. Manage the primary office in Office location. A venue selection never proves attendance."
    action={<Button variant="secondary" disabled={busy} onClick={() => { setError(""); void reload(); }}>Refresh locations</Button>}>
    {!loaded && <p role="status">Loading approved locations...</p>}
    {error && <p role="alert" className="ceac-support-error">{error}</p>}
    {success && <p role="status">{success}</p>}
    {loaded && !readFailed && locations.length === 0 && <p className="screen-note">No authorised locations are configured.</p>}
    {locations.map((location) => <div key={location.id} className="admin-evidence-row">
      <div><strong>{location.name}</strong><span>{location.is_primary ? "Primary office" : "Programme / duty venue"} · {location.radius_meters} m radius</span></div>
      {!location.is_primary && <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => editVenue(location)}>Edit</button>}
    </div>)}
    <div className="form-grid two">
      <FieldGroup label="Venue name">
        <input className="field" aria-label="Duty venue name" maxLength={120} value={draft.name}
          onChange={(event) => change("name", event.target.value)}
          placeholder="Approved programme venue" />
      </FieldGroup>
      <FieldGroup label="Check-in area (metres)">
        <input className="field" type="number" aria-label="Duty venue radius" min="10" max="1000"
          value={draft.radius} onChange={(event) => change("radius", event.target.value)} />
      </FieldGroup>
    </div>
    <p role="status">{chosen?"Venue point chosen. Check the map before saving.":"Choose the venue point on the map before saving."}</p>
    {loaded&&!readFailed&&<WorkforceStreetMap office={office} focusLocation={focusLocation}
      onChooseLocation={point=>{if(busy)return;setDraft(current=>({...current,lat:String(point.lat),lng:String(point.lng)}));setError("");setSuccess("");}} />}
    <div className="workforce-setup-actions">
      <button className="btn" type="button" disabled={busy || !loaded || readFailed || !validLocation(draft)} onClick={save}>
        {busy ? "Saving venue..." : draft.id ? "Save venue changes" : "Add authorised venue"}
      </button>
      {draft.id && <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setDraft(blank)}>Cancel edit</button>}
    </div>
    <p className="screen-note">Only Administration can save these records. A saved venue and check-in area support attendance review; choosing a venue never proves attendance.</p>
  </DataPanel>;
}
