import { supabase } from "./supabase";
import { getPositionOnce } from "./locationEvidence";

// This failure is known to occur before any work_sessions insert.
// Callers may safely let the employee retry without a session recheck.
export class WorkStartPreflightError extends Error {
  constructor(message) { super(message); this.name = "WorkStartPreflightError"; }
}
export async function openSession(orgId, userId) {
  const { data, error } = await supabase.from("work_sessions")
    .select("id, started_at, last_confirmed_at, place, work_item_id, flags")
    // The current employee can have historical records across CEAC units,
    // but this lookup must never bridge organisation boundaries.
    .eq("org_id", orgId).eq("profile_id", userId).is("ended_at", null)
    // Fetch two rows so duplicate simultaneous sessions are rejected rather
    // than silently selecting one. maybeSingle reports multiple rows as an
    // error, and callers then withhold all Start/End controls until verified.
    .order("started_at", { ascending: false }).limit(2).maybeSingle();
  if (error) throw error;
  return data || null;
}
export async function startWork(orgId, userId, place, workItemId, officeLocationId = null, offsiteLocationName = "") {
  if (place !== "office" && place !== "elsewhere") {
    throw new WorkStartPreflightError("Choose a valid working location before starting.");
  }
  const locationName = typeof offsiteLocationName === "string" ? offsiteLocationName.trim() : "";
  if (place === "elsewhere" && (!locationName || [...locationName].length > 200 || /[\u0000-\u001f\u007f]/.test(locationName))) {
    throw new WorkStartPreflightError("Enter where you are working from, using up to 200 characters. No session was started.");
  }
  // A responsibility is optional. If selected, it must still belong to this
  // employee and organisation and remain active at the time of starting.
  if (place === "elsewhere" && workItemId) {
    const { data: assigned, error: assignmentError } = await supabase.from("work_items")
      .select("id")
      .eq("org_id",orgId).eq("assignee_id",userId).eq("id",workItemId)
      .in("status",["not_started","in_progress","returned"])
      .limit(1).maybeSingle();
    if (assignmentError || !assigned?.id) {
      throw new WorkStartPreflightError(assignmentError ? "Your active responsibility could not be verified. Reload the start options and retry. No session was started." : "That work is no longer an authorised active responsibility. Choose current work and retry. No session was started.");
    }
  }
  const pos = await getPositionOnce();
  if (pos.failure) {
    throw new WorkStartPreflightError(`${pos.failure}. Turn on device location services and allow location for CEAC OS in browser site settings, then retry. No session was started.`);
  }
  let verifiedOfficeLocationId = null;
  if (place === "office") {
    // A declared office/programme location must be a recorded CEAC location
    // in the active organisation. Other callers retain the primary-office
    // fallback until they adopt the explicit location picker.
    let locationQuery = supabase.from("office_locations")
      .select("id").eq("org_id", orgId);
    locationQuery = officeLocationId
      ? locationQuery.eq("id", officeLocationId)
      : locationQuery.eq("is_primary", true);
    const { data: location, error: locationError } =
      await locationQuery.limit(1).maybeSingle();
    if (locationError) throw new WorkStartPreflightError("Your duty location could not be verified. Reload the start options and retry. No session was started.");
    if (!location) {
      throw new WorkStartPreflightError("Choose a CEAC-authorised office or programme location before starting work. No session was started.");
    }
    verifiedOfficeLocationId = location.id;
  }
  const { data, error } = await supabase.from("work_sessions").insert({
    org_id: orgId, profile_id: userId, place, work_item_id: place === "elsewhere" ? workItemId || null : null,
    flags: place === "elsewhere" ? { offsite_location_name: locationName } : {},
    office_location_id: verifiedOfficeLocationId,
    lat: pos.lat ?? null, lng: pos.lng ?? null,
    location_accuracy_m: pos.accuracy ?? null, location_captured_at: pos.capturedAt ?? null,
    device_time: new Date().toISOString(),
  }).select("id, started_at, last_confirmed_at, place, work_item_id, flags").single();
  if (error?.code === "P0001" && error.message?.includes("Recorded coordinates are outside this authorised CEAC duty location")) {
    throw new Error("Your device reports a location outside the selected venue. Check the selected venue and your device location settings.");
  }
  if (error) throw error;
  return data;
}
export async function endWork(sessionId) {
  const pos = await getPositionOnce();
  const { data, error } = await supabase.rpc("end_work_session_with_location", {
    p_session_id: sessionId, p_lat: pos.lat ?? null, p_lng: pos.lng ?? null,
    p_accuracy_m: pos.accuracy ?? null, p_captured_at: pos.capturedAt ?? null,
    p_device_time: new Date().toISOString(), p_failure: pos.failure ?? null,
  });
  if (error) throw error;
  return data;
}
export async function reconcileWorkSession(sessionId, action, effectiveEndedAt = null, note = null) {
  if (action === "continue") {
    const pos = await getPositionOnce();
    const { data, error } = await supabase.rpc("continue_work_session_with_location", {
      p_session_id: sessionId, p_lat: pos.lat ?? null, p_lng: pos.lng ?? null,
      p_accuracy_m: pos.accuracy ?? null, p_captured_at: pos.capturedAt ?? null,
    });
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.rpc("reconcile_work_session", {
    p_session_id: sessionId,
    p_action: action,
    p_effective_ended_at: effectiveEndedAt,
    p_note: note,
  });
  if (error) throw error;
  return data;
}
