import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// The code is returned once by the authorised RPC; never persist it,
// include it in a URL, or expose it to an ordinary staff account.
export default function AttendanceCodeIssuer({ me }) {
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [locationStatus, setLocationStatus] = useState("loading");
  const [minutes, setMinutes] = useState(10);
  const [issued, setIssued] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    setIssued(null);
    setError("");
    setLocationId("");
    setLocations([]);
    setLocationStatus("loading");
    busyRef.current = false;
    setBusy(false);
    supabase.from("office_locations").select("id,name")
      .eq("org_id", me.org_id).order("name")
      .then(({ data, error: failure }) => {
        if (current !== generation.current) return;
        if (failure) {
          setLocationStatus("error");
          setError("Authorised locations could not be loaded.");
          return;
        }
        setLocations(data || []);
        setLocationStatus("ready");
      }, () => {
        if (current === generation.current) {
          setLocationStatus("error");
          setError("Authorised locations could not be loaded.");
        }
      });
    return () => { generation.current += 1; };
  }, [me.id, me.org_id]);

  useEffect(() => {
    if (!issued?.valid_until) return undefined;
    const remaining = Date.parse(issued.valid_until) - Date.now();
    if (!(remaining > 0)) { setIssued(null); return undefined; }
    const timeout = setTimeout(() => setIssued(null), remaining);
    return () => clearTimeout(timeout);
  }, [issued]);

  async function rotate() {
    if (busyRef.current || locationStatus !== "ready" || !locationId) return;
    const current = generation.current;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setIssued(null);
    try {
      const { data, error: failure } = await supabase.rpc("attendance_set_office_code", {
        p_enabled: true,
        p_ttl_minutes: minutes,
        p_office_location_id: locationId,
      });
      if (failure) throw failure;
      if (!data?.code || data.office_location_id !== locationId || !data.valid_until) {
        throw new Error("The location-specific code could not be confirmed.");
      }
      if (current === generation.current) {
        setIssued({ code: data.code, valid_until: data.valid_until, locationId });
      }
    } catch (failure) {
      if (current === generation.current) {
        setError(failure?.message || "The location code could not be issued. Check its current state before retrying.");
      }
    } finally {
      if (current === generation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  const chosenName = locations.find((item) => item.id === locationId)?.name || "Selected location";
  return <section className="ev2wf-code-issuer" aria-labelledby="attendance-location-code-heading">
    <h3 id="attendance-location-code-heading">Duty-location verification code</h3>
    <p className="screen-note">Issue a short-lived code for the chosen authorised office or programme venue. Display it only at that location. This is corroborating evidence, not proof of physical presence or a disciplinary decision.</p>
    <div className="form-grid two">
      <label className="field-group">Authorised duty location
        <select className="field" aria-label="Code duty location" value={locationId}
          disabled={busy || locationStatus !== "ready"}
          onChange={(event) => { setIssued(null); setLocationId(event.target.value); }}>
          <option value="">Choose the location</option>
          {locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
        </select>
      </label>
      <label className="field-group">Code duration
        <select className="field" aria-label="Code duration in minutes" value={minutes}
          disabled={busy} onChange={(event) => { setIssued(null); setMinutes(Number(event.target.value)); }}>
          {[5, 10, 15, 30].map((value) => <option value={value} key={value}>{value} minutes</option>)}
        </select>
      </label>
    </div>
    {locationStatus === "ready" && locations.length === 0 &&
      <p className="screen-note">No approved duty locations are configured. Ask Administration to record the office or programme venue first.</p>}
    {error && <p className="ceac-support-error" role="alert">{error}</p>}
    <button type="button" className="btn" disabled={busy || !locationId || locationStatus !== "ready"} onClick={rotate}>
      {busy ? "Issuing code..." : "Issue new code for location"}
    </button>
    {issued && issued.locationId === locationId && Date.parse(issued.valid_until) > Date.now() &&
      <div role="status" className="ev2wf-code-result">
        <p><strong>{chosenName}</strong> · Valid until {new Date(issued.valid_until).toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" })}</p>
        <output aria-label="Current location verification code">{issued.code}</output>
        <p className="screen-note">Rotating this location's code revokes the previous code at this venue. It does not change codes at other venues.</p>
        <button type="button" className="btn btn-ghost" onClick={() => setIssued(null)}>Hide code</button>
      </div>}
  </section>;
}
